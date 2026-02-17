import { prisma } from "../lib/prisma.js";
import { isPlausibleNextAction } from "../lib/state.js";
import { isProjectTransitionAllowed } from "../lib/project-transition-rules.js";
import { checkGateA, checkGateB } from "./project-gates.js";
import type { ContextTag, EnergyLevel, ProjectStatus, ItemState } from "../generated/prisma/client.js";

const projectInclude = {
  item: true,
  nextActionTask: true,
  tasks: true,
};

export async function listProjects() {
  return prisma.project.findMany({
    include: projectInclude,
    orderBy: [{ focusThisWeek: "desc" }, { priority: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: projectInclude,
  });
}

const ACTIVE: ProjectStatus = "ACTIVE";
const CLARIFYING: ProjectStatus = "CLARIFYING";

export async function createProject(data: {
  itemId?: string;
  outcomeStatement?: string;
  nextActionText?: string;
  status?: ProjectStatus;
  dueDate?: Date;
  priority?: number;
  themeTag?: string;
}) {
  const status = data.status ?? CLARIFYING;
  const hasItem = data.itemId != null && data.itemId !== "";
  const outcome = (data.outcomeStatement ?? "").trim();
  const nextActionText = (data.nextActionText ?? "").trim();

  if (status === ACTIVE) {
    if (!outcome || outcome.length < 10) {
      return { success: false, reason: "Outcome statement is required and must be at least 10 characters for ACTIVE.", project: null };
    }
    if (!nextActionText) {
      return { success: false, reason: "Next action is required for ACTIVE.", project: null };
    }
    const rule = isPlausibleNextAction(nextActionText);
    if (!rule.valid) return { success: false, reason: rule.reason, project: null };
  }

  let taskId: string | null = null;
  if (status === ACTIVE && nextActionText) {
    const task = await prisma.task.create({
      data: {
        itemId: hasItem ? data.itemId! : null,
        actionText: nextActionText,
        projectId: undefined,
      },
    });
    taskId = task.id;
  }

  const project = await prisma.project.create({
    data: {
      itemId: hasItem ? data.itemId! : null,
      outcomeStatement: outcome || null,
      status,
      nextActionTaskId: taskId,
      dueDate: data.dueDate ?? null,
      priority: data.priority ?? 0,
      themeTag: data.themeTag?.trim() ?? null,
      lastProgressAt: new Date(),
    },
    include: projectInclude,
  });

  if (taskId) {
    await prisma.task.update({
      where: { id: taskId },
      data: { projectId: project.id },
    });
  }

  if (hasItem) {
    await prisma.item.update({
      where: { id: data.itemId! },
      data: { type: "project", state: projectStatusToItemState(project.status) },
    });
  }

  return { success: true, project: await getProject(project.id) };
}

export function projectStatusToItemState(status: ProjectStatus): "PROJECT" | "WAITING" | "SOMEDAY" | "DONE" | "ARCHIVED" {
  switch (status) {
    case "CLARIFYING":
    case "ACTIVE":
    case "ON_HOLD":
      return "PROJECT";
    case "WAITING":
      return "WAITING";
    case "SOMEDAY":
      return "SOMEDAY";
    case "DONE":
      return "DONE";
    case "ARCHIVED":
      return "ARCHIVED";
    default:
      return "PROJECT";
  }
}

export async function assignItemToProject(projectId: string, itemId: string): Promise<
  | { success: true; project: Awaited<ReturnType<typeof getProject>> }
  | { success: false; reason: string }
> {
  const project = await getProject(projectId);
  if (!project) return { success: false, reason: "Project not found" };
  if (project.itemId != null) return { success: false, reason: "Project already has an item assigned" };

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return { success: false, reason: "Item not found" };

  const itemState = projectStatusToItemState(project.status);

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { itemId, lastProgressAt: new Date() },
    }),
    prisma.item.update({
      where: { id: itemId },
      data: { type: "project", state: itemState },
    }),
  ]);

  if (project.nextActionTaskId) {
    const nextTask = await prisma.task.findUnique({
      where: { id: project.nextActionTaskId },
    });
    if (nextTask?.itemId == null) {
      await prisma.task.update({
        where: { id: project.nextActionTaskId },
        data: { itemId },
      });
    }
  }

  return { success: true, project: await getProject(projectId) };
}

export async function patchProject(
  id: string,
  body: {
    outcomeStatement?: string;
    nextActionTaskId?: string | null;
    nextActionText?: string;
    status?: ProjectStatus;
    dueDate?: string | null;
    priority?: number;
    focusThisWeek?: boolean;
    themeTag?: string | null;
    waitingOn?: string | null;
    waitingSince?: string | null;
    followUpAt?: string | null;
  }
): Promise<Awaited<ReturnType<typeof getProject>> | { error: string } | null> {
  const project = await getProject(id);
  if (!project) return null;

  const updates: Parameters<typeof prisma.project.update>[0]["data"] = {};
  let effectiveNextActionId: string | null = project.nextActionTaskId;

  if (body.outcomeStatement !== undefined) {
    const trimmed = body.outcomeStatement.trim();
    updates.outcomeStatement = trimmed || null;
    updates.lastProgressAt = new Date();
  }
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.focusThisWeek !== undefined) updates.focusThisWeek = body.focusThisWeek;
  if (body.themeTag !== undefined) updates.themeTag = body.themeTag?.trim() ?? null;
  if (body.waitingOn !== undefined) updates.waitingOn = body.waitingOn?.trim() ?? null;
  if (body.waitingSince !== undefined) updates.waitingSince = body.waitingSince ? new Date(body.waitingSince) : null;
  if (body.followUpAt !== undefined) updates.followUpAt = body.followUpAt ? new Date(body.followUpAt) : null;

  if (body.status !== undefined) {
    if (!isProjectTransitionAllowed(project.status, body.status)) {
      return { error: `Transition from ${project.status} to ${body.status} is not allowed.` };
    }
    if (body.status === ACTIVE) {
      const outcome = body.outcomeStatement !== undefined ? body.outcomeStatement.trim() : (project.outcomeStatement ?? "");
      let resolvedNextId: string | null = body.nextActionTaskId ?? project.nextActionTaskId;
      if (body.nextActionText?.trim()) {
        const rule = isPlausibleNextAction(body.nextActionText.trim());
        if (!rule.valid) return { error: rule.reason ?? "Invalid next action" };
        const task = await prisma.task.create({
          data: {
            itemId: project.itemId ?? undefined,
            actionText: body.nextActionText.trim(),
            projectId: id,
          },
        });
        resolvedNextId = task.id;
        effectiveNextActionId = task.id;
        updates.nextActionTaskId = task.id;
        updates.lastProgressAt = new Date();
      }
      const gateA = await checkGateA(outcome || null, resolvedNextId, { runVerifier: false });
      if (!gateA.pass) return { error: gateA.reason };
    }
    updates.status = body.status;
  }

  if (body.nextActionText !== undefined && body.status !== ACTIVE) {
    const rule = isPlausibleNextAction(body.nextActionText);
    if (!rule.valid) return { error: rule.reason ?? "Invalid next action" };
    const task = await prisma.task.create({
      data: {
        itemId: project.itemId ?? undefined,
        actionText: body.nextActionText.trim(),
        projectId: id,
      },
    });
    effectiveNextActionId = task.id;
    updates.nextActionTaskId = task.id;
    updates.lastProgressAt = new Date();
  } else if (body.nextActionTaskId !== undefined) {
    effectiveNextActionId = body.nextActionTaskId;
    updates.nextActionTaskId = body.nextActionTaskId;
    updates.lastProgressAt = new Date();
  }

  if (project.status === ACTIVE && (body.outcomeStatement !== undefined || body.nextActionTaskId !== undefined || body.nextActionText !== undefined)) {
    const newOutcome = body.outcomeStatement !== undefined ? body.outcomeStatement.trim() : (project.outcomeStatement ?? "");
    const gateB = await checkGateB(id, newOutcome || null, effectiveNextActionId);
    if (!gateB.valid && gateB.suggestStatus) {
      updates.status = gateB.suggestStatus;
      if (gateB.suggestStatus === "CLARIFYING") updates.nextActionTaskId = null;
    }
  }

  const updated = await prisma.project.update({
    where: { id },
    data: updates,
    include: projectInclude,
  });

  if (project.itemId && updates.status) {
    await prisma.item.update({
      where: { id: project.itemId },
      data: { state: projectStatusToItemState(updated.status) },
    });
  }

  return updated;
}

export async function listProjectsWithoutNextAction() {
  return prisma.project.findMany({
    where: {
      nextActionTaskId: null,
      status: { in: ["ACTIVE", "WAITING", "ON_HOLD", "CLARIFYING"] },
    },
    include: projectInclude,
  });
}

/**
 * When a task that is a project's next action changes state, update the project (Gate B from task side).
 */
export async function syncProjectStateForNextActionTask(
  taskId: string,
  newItemState: ItemState
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { nextActionTaskId: taskId },
    select: { id: true, status: true },
  });
  if (!project) return;
  if (newItemState === "WAITING") {
    if (isProjectTransitionAllowed(project.status, "WAITING")) {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "WAITING", lastProgressAt: new Date() },
      });
    }
  } else if (
    newItemState === "SNOOZED" ||
    newItemState === "CLARIFYING" ||
    newItemState === "ARCHIVED" ||
    newItemState === "REFERENCE" ||
    newItemState === "SOMEDAY"
  ) {
    if (isProjectTransitionAllowed(project.status, "CLARIFYING")) {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "CLARIFYING", nextActionTaskId: null, lastProgressAt: new Date() },
      });
    }
  }
}

export async function listProjectsByStatus(statuses: ProjectStatus[]) {
  return prisma.project.findMany({
    where: { status: { in: statuses } },
    include: projectInclude,
    orderBy: [{ updatedAt: "desc" }],
  });
}

/** Remaining open tasks for a project (task status not "completed"). */
export async function getProjectRemainingTaskCount(projectId: string): Promise<number> {
  return prisma.task.count({
    where: {
      projectId,
      status: { not: "completed" },
    },
  });
}

export type CompleteProjectResult =
  | { success: true; project: Awaited<ReturnType<typeof getProject>> }
  | { success: false; error: string; remainingTasks?: Array<{ id: string; actionText: string }> };

export async function completeProject(
  id: string,
  options: { confirmOutcome: boolean; remainingTaskPolicy?: "strict" | "flexible" }
): Promise<CompleteProjectResult> {
  const project = await getProject(id);
  if (!project) return { success: false, error: "Project not found" };
  if (!isProjectTransitionAllowed(project.status, "DONE")) {
    return { success: false, error: `Cannot mark project DONE from ${project.status}.` };
  }
  if (!options.confirmOutcome) {
    return { success: false, error: "confirmOutcome is required to mark project done." };
  }

  const remainingCount = await getProjectRemainingTaskCount(id);
  const policy = options.remainingTaskPolicy ?? "flexible";
  if (policy === "strict" && remainingCount > 0) {
    const tasks = await prisma.task.findMany({
      where: { projectId: id, status: { not: "completed" } },
      select: { id: true, actionText: true },
    });
    return {
      success: false,
      error: "Strict policy: complete or archive all tasks before marking project done.",
      remainingTasks: tasks,
    };
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { status: "DONE", lastProgressAt: new Date() },
    include: projectInclude,
  });
  if (project.itemId) {
    await prisma.item.update({
      where: { id: project.itemId },
      data: { state: "DONE" },
    });
  }
  return { success: true, project: updated };
}

export async function listStalledProjects(days: number = 14) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const projects = await prisma.project.findMany({
    where: { status: { in: ["ACTIVE", "WAITING", "ON_HOLD"] } },
    include: { item: true, nextActionTask: true, tasks: true },
  });
  return projects.filter((p) => {
    const lastActivity = p.lastProgressAt ?? p.nextActionTask?.updatedAt ?? p.updatedAt;
    return lastActivity < since;
  });
}
