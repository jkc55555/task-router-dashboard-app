import { prisma } from "../lib/prisma";
import { listProjectsWithoutNextAction, listProjectsByStatus } from "./projects";
import type { ReviewSessionType } from "@prisma/client";

function startOfToday(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function endOfToday(): Date {
  const s = startOfToday();
  return new Date(s.getTime() + 24 * 60 * 60 * 1000 - 1);
}
function startOfTomorrow(): Date {
  const s = startOfToday();
  return new Date(s.getTime() + 24 * 60 * 60 * 1000);
}
function endOfTomorrow(): Date {
  return new Date(startOfTomorrow().getTime() + 24 * 60 * 60 * 1000 - 1);
}

export async function getDailySnapshot() {
  const now = new Date();
  const eot = endOfToday();
  const sotTomorrow = startOfTomorrow();
  const eotTomorrow = endOfTomorrow();

  const inboxCount = await prisma.item.count({ where: { state: "INBOX" } });
  const overdueCount = await prisma.task.count({
    where: {
      dueDate: { lt: now },
      item: { state: "ACTIONABLE" },
    },
  });
  const dueTodayCount = await prisma.task.count({
    where: {
      dueDate: { gte: startOfToday(), lte: eot },
      item: { state: "ACTIONABLE" },
    },
  });
  const dueTomorrowCount = await prisma.task.count({
    where: {
      dueDate: { gte: sotTomorrow, lte: eotTomorrow },
      item: { state: "ACTIONABLE" },
    },
  });
  const waitingItems = await prisma.item.findMany({
    where: { state: "WAITING" },
    include: { reminders: true },
  });
  const waitingFollowUpsDueCount = waitingItems.filter((i) =>
    i.reminders.some((r) => r.dueAt <= now)
  ).length;
  const projectsNoNext = await listProjectsWithoutNextAction();
  const unverifiedCount = await prisma.task.count({
    where: { unverified: true, item: { state: { notIn: ["DONE", "ARCHIVED"] } } },
  });

  return {
    inboxCount,
    overdueCount,
    dueTodayCount,
    dueTomorrowCount,
    waitingFollowUpsDueCount,
    projectsNoNextActionCount: projectsNoNext.length,
    unverifiedCount,
  };
}

export async function getDailyStep(stepId: string): Promise<{ items: unknown[]; stepId: string }> {
  const now = new Date();
  const eot = endOfToday();

  if (stepId === "D2") {
    const tasks = await prisma.task.findMany({
      where: {
        item: { state: "ACTIONABLE" },
        dueDate: { lte: eot },
      },
      include: { item: true, project: { include: { item: true } } },
      orderBy: { dueDate: "asc" },
    });
    return {
      stepId: "D2",
      items: tasks.map((t) => ({
        id: t.id,
        itemId: t.itemId,
        actionText: t.actionText,
        dueDate: t.dueDate,
        project: t.project ? { id: t.project.id, title: t.project.item?.title ?? t.project.outcomeStatement } : null,
        reasonTags: t.dueDate && t.dueDate < now ? ["Overdue"] : t.dueDate && t.dueDate <= eot ? ["Due today"] : [],
      })),
    };
  }

  if (stepId === "D3") {
    const items = await prisma.item.findMany({
      where: {
        state: "WAITING",
        reminders: { some: { dueAt: { lte: now } } },
      },
      include: { reminders: true },
    });
    return {
      stepId: "D3",
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        waitingOn: i.waitingOn,
        waitingSince: i.waitingSince,
        nextReminderDue: i.reminders.find((r) => r.dueAt <= now)?.dueAt ?? null,
      })),
    };
  }

  if (stepId === "D4") {
    const projects = await prisma.project.findMany({
      where: {
        status: { in: ["ACTIVE", "WAITING", "ON_HOLD"] },
      },
      include: { item: true },
      orderBy: [{ focusThisWeek: "desc" }, { dueDate: "asc" }, { lastProgressAt: "desc" }],
    });
    return {
      stepId: "D4",
      items: projects.map((p) => ({
        id: p.id,
        title: p.item?.title ?? p.outcomeStatement ?? "Untitled project",
        focusThisWeek: p.focusThisWeek,
        dueDate: p.dueDate,
        lastProgressAt: p.lastProgressAt,
      })),
    };
  }

  if (stepId === "D5") {
    const unverifiedTasks = await prisma.task.findMany({
      where: { unverified: true, item: { state: { notIn: ["DONE", "ARCHIVED"] } } },
      include: { item: true, project: { include: { item: true } } },
    });
    const projectsNoNext = await listProjectsWithoutNextAction();
    const items = [
      ...unverifiedTasks.map((t) => ({
        type: "task" as const,
        id: t.id,
        itemId: t.itemId,
        actionText: t.actionText,
        unverified: true,
        project: t.project ? { id: t.project.id, title: t.project.item?.title ?? t.project.outcomeStatement } : null,
      })),
      ...projectsNoNext.map((p) => ({
        type: "project" as const,
        id: p.id,
        title: p.item?.title ?? p.outcomeStatement ?? "Untitled project",
        missingNextAction: true,
      })),
    ];
    return { stepId: "D5", items };
  }

  return { stepId, items: [] };
}

export async function getWeeklySnapshot() {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const inboxCount = await prisma.item.count({ where: { state: "INBOX" } });
  const projectsActiveCount = await prisma.project.count({ where: { status: "ACTIVE" } });
  const projectsWaitingCount = await prisma.project.count({ where: { status: "WAITING" } });
  const projectsOnHoldCount = await prisma.project.count({ where: { status: "ON_HOLD" } });
  const projectsMissingNextAction = await listProjectsWithoutNextAction();
  const waitingItems = await prisma.item.findMany({
    where: { state: "WAITING" },
    include: { reminders: true },
  });
  const waitingMissingFollowUpCount = waitingItems.filter(
    (i) => i.reminders.length === 0 || i.reminders.every((r) => r.dueAt > now)
  ).length;
  const somedayCount = await prisma.item.count({ where: { state: "SOMEDAY" } });
  const unverifiedCount = await prisma.task.count({
    where: { unverified: true, item: { state: { notIn: ["DONE", "ARCHIVED"] } } },
  });
  const staleTasksCount = await prisma.task.count({
    where: {
      updatedAt: { lt: staleThreshold },
      item: { state: "ACTIONABLE" },
    },
  });

  return {
    inboxCount,
    projectsActiveCount,
    projectsWaitingCount,
    projectsOnHoldCount,
    projectsMissingNextActionCount: projectsMissingNextAction.length,
    waitingMissingFollowUpCount,
    somedayCount,
    unverifiedCount,
    staleTasksCount,
  };
}

export async function getWeeklyStep(stepId: string): Promise<{ items: unknown[]; stepId: string }> {
  const now = new Date();

  if (stepId === "W2") {
    const items = await prisma.item.findMany({
      where: { state: "INBOX" },
      include: { task: true, project: true },
      orderBy: { updatedAt: "desc" },
    });
    return {
      stepId: "W2",
      items: items.map((i) => ({ id: i.id, title: i.title, body: i.body })),
    };
  }

  if (stepId === "W3") {
    const projects = await prisma.project.findMany({
      where: { status: { in: ["ACTIVE", "WAITING", "ON_HOLD", "CLARIFYING"] } },
      include: { item: true, nextActionTask: true },
    });
    const items = projects.map((p) => ({
      id: p.id,
      title: p.item?.title ?? p.outcomeStatement ?? "Untitled project",
      status: p.status,
      outcomeStatement: p.outcomeStatement,
      nextActionTaskId: p.nextActionTaskId,
      hasValidNextAction: p.nextActionTaskId != null,
      followUpAt: p.followUpAt,
      waitingOn: p.waitingOn,
    }));
    return { stepId: "W3", items };
  }

  if (stepId === "W4") {
    const items = await prisma.item.findMany({
      where: { state: "WAITING" },
      include: { reminders: true },
    });
    return {
      stepId: "W4",
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        waitingOn: i.waitingOn,
        waitingSince: i.waitingSince,
        hasFollowUp: i.reminders.some((r) => r.kind === "follow_up"),
        nextDue: i.reminders.find((r) => r.kind === "follow_up")?.dueAt ?? null,
      })),
    };
  }

  if (stepId === "W5") {
    const items = await prisma.item.findMany({
      where: { state: "SOMEDAY" },
      orderBy: { updatedAt: "desc" },
    });
    return {
      stepId: "W5",
      items: items.map((i) => ({ id: i.id, title: i.title })),
    };
  }

  return { stepId, items: [] };
}

export async function createSession(type: "daily" | "weekly") {
  const session = await prisma.reviewSession.create({
    data: {
      type: type.toUpperCase() as ReviewSessionType,
    },
  });
  return {
    sessionId: session.id,
    type: session.type,
    startedAt: session.startedAt,
  };
}

export async function updateSession(
  id: string,
  body: {
    stepCompleted?: string;
    itemsProcessed?: number;
    itemsSkipped?: number;
    completedAt?: string | null;
  }
) {
  const session = await prisma.reviewSession.findUnique({ where: { id } });
  if (!session) return null;

  const stepsCompleted = session.stepsCompleted as string[] | null;
  const newSteps = body.stepCompleted
    ? [...(stepsCompleted ?? []), body.stepCompleted]
    : stepsCompleted;

  await prisma.reviewSession.update({
    where: { id },
    data: {
      ...(newSteps && { stepsCompleted: newSteps }),
      ...(body.itemsProcessed !== undefined && {
        itemsProcessedCount: session.itemsProcessedCount + body.itemsProcessed,
      }),
      ...(body.itemsSkipped !== undefined && {
        itemsSkippedCount: session.itemsSkippedCount + body.itemsSkipped,
      }),
      ...(body.completedAt !== undefined && {
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
      }),
    },
  });
  return { ok: true };
}

export async function getDailyReview() {
  const inboxCount = await prisma.item.count({ where: { state: "INBOX" } });
  const overdueTasks = await prisma.task.findMany({
    where: {
      dueDate: { lt: new Date() },
      item: { state: { notIn: ["DONE", "ARCHIVED"] } },
    },
    include: { item: true },
  });
  const waitingItems = await prisma.item.findMany({
    where: { state: "WAITING" },
    include: { reminders: true },
  });
  const waitingFollowUps = waitingItems.filter((i) =>
    i.reminders.some((r) => r.dueAt <= new Date())
  );
  const projectsNoNext = await listProjectsWithoutNextAction();
  const projectsNeedingClarification = await listProjectsByStatus(["CLARIFYING"]);
  return {
    inboxCount,
    overdue: overdueTasks.map((t) => ({ id: t.id, title: t.item?.title ?? t.actionText, dueDate: t.dueDate })),
    waitingFollowUps: waitingFollowUps.map((i) => ({ id: i.id, title: i.title })),
    projectsWithoutNextAction: projectsNoNext.length,
    projectsNeedingClarification: projectsNeedingClarification.map((p) => ({
      id: p.id,
      title: p.item?.title ?? p.outcomeStatement ?? "Untitled project",
    })),
  };
}

export async function getWeeklyReview() {
  const inboxCount = await prisma.item.count({ where: { state: "INBOX" } });
  const projectsWithoutNextAction = await listProjectsWithoutNextAction();
  const projectsNeedingClarification = await listProjectsByStatus(["CLARIFYING"]);
  const waiting = await prisma.item.findMany({
    where: { state: "WAITING" },
    include: { reminders: true },
  });
  const someday = await prisma.item.findMany({
    where: { state: "SOMEDAY" },
  });
  const focusProjects = await prisma.project.findMany({
    where: { focusThisWeek: true },
    include: { item: true },
  });
  return {
    inboxCount,
    projectsWithoutNextAction: projectsWithoutNextAction.map((p) => ({
      id: p.id,
      title: p.item?.title ?? p.outcomeStatement ?? "Untitled project",
      outcomeStatement: p.outcomeStatement ?? "",
    })),
    projectsNeedingClarification: projectsNeedingClarification.map((p) => ({
      id: p.id,
      title: p.item?.title ?? p.outcomeStatement ?? "Untitled project",
    })),
    waiting: waiting.map((i) => ({ id: i.id, title: i.title })),
    someday: someday.map((i) => ({ id: i.id, title: i.title })),
    focusProjects: focusProjects.map((p) => ({ id: p.id, title: p.item?.title ?? p.outcomeStatement ?? "Untitled project" })),
  };
}

export async function postWeeklyReview(body: {
  focusProjectIds?: string[];
  stepsCompleted?: string[];
}) {
  if (body.focusProjectIds !== undefined) {
    await prisma.project.updateMany({
      data: { focusThisWeek: false },
    });
    if (body.focusProjectIds.length > 0) {
      await prisma.project.updateMany({
        where: { id: { in: body.focusProjectIds } },
        data: { focusThisWeek: true },
      });
    }
  }
  return { ok: true };
}
