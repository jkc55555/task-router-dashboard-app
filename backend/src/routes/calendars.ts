import { Router, Request, Response } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import * as calendarImport from "../services/calendar-import.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

export const calendarsRouter = Router();

/** GET /calendars/sources - list calendar sources */
calendarsRouter.get("/sources", async (_req: Request, res: Response) => {
  try {
    const sources = await prisma.calendarSource.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, kind: true, lastSyncedAt: true, createdAt: true },
    });
    res.json(sources);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/** DELETE /calendars/sources/:id */
calendarsRouter.delete("/sources/:id", async (req: Request, res: Response) => {
  try {
    await prisma.calendarSource.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/** POST /calendars/import - multipart .ics file, optional name */
calendarsRouter.post(
  "/import",
  upload.single("ics"),
  async (req: Request, res: Response) => {
    try {
      const file = (req as unknown as { file?: Express.Multer.File }).file;
      if (!file || !file.buffer) {
        return res.status(400).json({ error: "No .ics file uploaded" });
      }
      const name = (req.body?.name as string) || file.originalname || "Imported calendar";
      const icsContent = file.buffer.toString("utf-8");
      const result = await calendarImport.importIcsToSource(name, icsContent);
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  }
);

/** GET /calendars/export.ics - export all calendar events as .ics */
calendarsRouter.get("/export.ics", async (_req: Request, res: Response) => {
  try {
    const events = await prisma.calendarEvent.findMany({
      include: { calendarSource: true },
      orderBy: [{ start: "asc" }],
    });
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Task Router//EN",
      "CALSCALE:GREGORIAN",
    ];
    for (const ev of events) {
      const formatDate = (d: Date) => {
        const x = new Date(d);
        return x.toISOString().replace(/[-:]/g, "").slice(0, 15);
      };
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${ev.externalId || ev.id}`);
      lines.push(`DTSTART:${formatDate(ev.start)}`);
      lines.push(`DTEND:${formatDate(ev.end)}`);
      lines.push(`SUMMARY:${(ev.title || "").replace(/\n/g, "\\n")}`);
      if (ev.description) {
        lines.push(`DESCRIPTION:${ev.description.replace(/\n/g, "\\n")}`);
      }
      if (ev.allDay) {
        lines.push("TRANSP:TRANSPARENT");
      }
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="export.ics"');
    res.send(lines.join("\r\n"));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
