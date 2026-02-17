import ical from "node-ical";
import { prisma } from "../lib/prisma.js";

export type ImportResult = {
  sourceId: string;
  created: number;
  updated: number;
  total: number;
};

function toStringVal(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "val" in v) return String((v as { val: unknown }).val);
  return String(v);
}

/**
 * Parse ICS string and return VEVENTs. Expands recurring events within a reasonable window.
 */
function parseEvents(icsContent: string): Array<{
  uid: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  description?: string;
  rrule?: string;
}> {
  const parsed = ical.parseICS(icsContent);
  const now = new Date();
  const rangeEnd = new Date(now);
  rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);

  const out: Array<{
    uid: string;
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    description?: string;
    rrule?: string;
  }> = [];

  for (const key of Object.keys(parsed)) {
    const ev = parsed[key];
    if (!ev || (ev as { type?: string }).type !== "VEVENT") continue;
    const e = ev as {
      uid?: string;
      summary?: string;
      start?: Date;
      end?: Date;
      description?: string;
      rrule?: string;
      dateOnly?: boolean;
    };
    const uid = e.uid || key;
    const start = e.start ? new Date(e.start) : new Date();
    const end = e.end ? new Date(e.end) : new Date(start.getTime() + 3600000);
    const allDay = !!(e as { dateOnly?: boolean }).dateOnly || start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 0 && end.getMinutes() === 0;

    if (e.rrule && typeof (ical as { expandRecurringEvent?: (ev: unknown, opts: { from: Date; to: Date }) => unknown[] }).expandRecurringEvent === "function") {
      const expanded = (ical as { expandRecurringEvent: (ev: unknown, opts: { from: Date; to: Date }) => Array<{ summary?: string; start: Date; end: Date; isFullDay?: boolean; description?: string }> }).expandRecurringEvent(ev, { from: now, to: rangeEnd });
      expanded.forEach((inst, i) => {
        out.push({
          uid: `${uid}-${i}-${inst.start.getTime()}`,
          title: (toStringVal(inst.summary) ?? toStringVal(e.summary) ?? "Untitled").trim(),
          start: inst.start,
          end: inst.end,
          allDay: !!inst.isFullDay,
          description: toStringVal(inst.description) ?? toStringVal(e.description),
        });
      });
    } else {
      if (end < now) continue; // skip past non-recurring
      out.push({
        uid,
        title: (toStringVal(e.summary) ?? "Untitled").trim(),
        start,
        end,
        allDay,
        description: toStringVal(e.description),
        rrule: e.rrule,
      });
    }
  }
  return out;
}

export async function importIcsToSource(
  userId: string,
  sourceName: string,
  icsContent: string
): Promise<ImportResult> {
  const events = parseEvents(icsContent);
  let sourceRecord = await prisma.calendarSource.findFirst({
    where: { userId, name: sourceName, kind: "ics_import" },
  });
  if (!sourceRecord) {
    sourceRecord = await prisma.calendarSource.create({
      data: { userId, name: sourceName, kind: "ics_import", lastSyncedAt: new Date() },
    });
  } else {
    await prisma.calendarSource.update({
      where: { id: sourceRecord.id },
      data: { lastSyncedAt: new Date() },
    });
  }

  let created = 0;
  let updated = 0;
  for (const ev of events) {
    const existing = await prisma.calendarEvent.findUnique({
      where: {
        calendarSourceId_externalId: {
          calendarSourceId: sourceRecord.id,
          externalId: ev.uid,
        },
      },
    });
    if (existing) {
      await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: {
          title: ev.title,
          start: ev.start,
          end: ev.end,
          allDay: ev.allDay,
          description: ev.description ?? null,
          recurrenceRule: ev.rrule ?? null,
        },
      });
      updated++;
    } else {
      await prisma.calendarEvent.create({
        data: {
          calendarSourceId: sourceRecord.id,
          externalId: ev.uid,
          title: ev.title,
          start: ev.start,
          end: ev.end,
          allDay: ev.allDay,
          description: ev.description ?? null,
          recurrenceRule: ev.rrule ?? null,
        },
      });
      created++;
    }
  }
  return {
    sourceId: sourceRecord.id,
    created,
    updated,
    total: events.length,
  };
}
