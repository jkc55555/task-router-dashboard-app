import { prisma } from "../lib/prisma.js";

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export async function getDeadlines() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const day7 = new Date(now);
  day7.setDate(day7.getDate() + 7);
  const day30 = new Date(now);
  day30.setDate(day30.getDate() + 30);

  const tasksToday = await prisma.task.findMany({
    where: {
      dueDate: { gte: todayStart, lte: todayEnd },
      item: { state: { not: "DONE" } },
    },
    include: { item: true },
  });

  const tasksNext7 = await prisma.task.findMany({
    where: {
      dueDate: { gt: todayEnd, lte: endOfDay(day7) },
      item: { state: { not: "DONE" } },
    },
    include: { item: true },
    orderBy: { dueDate: "asc" },
  });

  const tasksNext30 = await prisma.task.findMany({
    where: {
      dueDate: { gt: endOfDay(day7), lte: endOfDay(day30) },
      item: { state: { not: "DONE" } },
    },
    include: { item: true },
    orderBy: { dueDate: "asc" },
  });

  const projectsWithDue = await prisma.project.findMany({
    where: { dueDate: { not: null } },
    include: { item: true },
  });

  const todayProjects = projectsWithDue.filter(
    (p) => p.dueDate && p.dueDate >= todayStart && p.dueDate <= todayEnd
  );
  const next7Projects = projectsWithDue.filter(
    (p) => p.dueDate && p.dueDate > todayEnd && p.dueDate <= endOfDay(day7)
  );
  const next30Projects = projectsWithDue.filter(
    (p) => p.dueDate && p.dueDate > endOfDay(day7) && p.dueDate <= endOfDay(day30)
  );

  const calendarToday = await prisma.calendarEvent.findMany({
    where: {
      start: { gte: todayStart, lte: todayEnd },
    },
    orderBy: { start: "asc" },
  });
  const calendarNext7 = await prisma.calendarEvent.findMany({
    where: {
      start: { gt: todayEnd, lte: endOfDay(day7) },
    },
    orderBy: { start: "asc" },
  });
  const calendarNext30 = await prisma.calendarEvent.findMany({
    where: {
      start: { gt: endOfDay(day7), lte: endOfDay(day30) },
    },
    orderBy: { start: "asc" },
  });

  const toCalendarEntry = (ev: { id: string; title: string; start: Date; end: Date; allDay: boolean }) => ({
    type: "calendar" as const,
    id: ev.id,
    title: ev.title,
    dueDate: ev.start,
    start: ev.start,
    end: ev.end,
    allDay: ev.allDay,
  });

  return {
    today: [
      ...tasksToday.map((t) => ({ type: "task" as const, id: t.id, title: t.item?.title ?? t.actionText, dueDate: t.dueDate })),
      ...todayProjects.map((p) => ({
        type: "project" as const,
        id: p.id,
        title: p.item?.title ?? p.outcomeStatement,
        dueDate: p.dueDate,
      })),
      ...calendarToday.map(toCalendarEntry),
    ],
    next7: [
      ...tasksNext7.map((t) => ({ type: "task" as const, id: t.id, title: t.item?.title ?? t.actionText, dueDate: t.dueDate })),
      ...next7Projects.map((p) => ({
        type: "project" as const,
        id: p.id,
        title: p.item?.title ?? p.outcomeStatement,
        dueDate: p.dueDate,
      })),
      ...calendarNext7.map(toCalendarEntry),
    ],
    next30: [
      ...tasksNext30.map((t) => ({ type: "task" as const, id: t.id, title: t.item?.title ?? t.actionText, dueDate: t.dueDate })),
      ...next30Projects.map((p) => ({
        type: "project" as const,
        id: p.id,
        title: p.item?.title ?? p.outcomeStatement,
        dueDate: p.dueDate,
      })),
      ...calendarNext30.map(toCalendarEntry),
    ],
  };
}
