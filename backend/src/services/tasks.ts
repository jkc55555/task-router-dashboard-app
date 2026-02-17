import { prisma } from "../lib/prisma.js";
import type { ContextTag, EnergyLevel } from "../generated/prisma/client.js";

export const taskInclude = {
  item: true,
  project: true,
  projectNextAction: { include: { tasks: true } },
};

export async function getTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: taskInclude,
  });
}

export async function patchTask(
  id: string,
  body: {
    pinnedOrder?: number | null;
    manualRank?: number | null;
    snoozedUntil?: string | null;
    actionText?: string;
    context?: ContextTag | null;
    energy?: EnergyLevel | null;
    estimatedMinutes?: number | null;
    dueDate?: string | null;
    priority?: number | null;
  }
) {
  const updates: Parameters<typeof prisma.task.update>[0]["data"] = {};
  if (body.pinnedOrder !== undefined) updates.pinnedOrder = body.pinnedOrder;
  if (body.manualRank !== undefined) updates.manualRank = body.manualRank;
  if (body.snoozedUntil !== undefined)
    updates.snoozedUntil = body.snoozedUntil ? new Date(body.snoozedUntil) : null;
  if (body.actionText !== undefined) updates.actionText = body.actionText.trim();
  if (body.context !== undefined) updates.context = body.context;
  if (body.energy !== undefined) updates.energy = body.energy;
  if (body.estimatedMinutes !== undefined) updates.estimatedMinutes = body.estimatedMinutes;
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.priority !== undefined) updates.priority = body.priority;

  return prisma.task.update({
    where: { id },
    data: updates,
    include: taskInclude,
  });
}

/** Only ACTIONABLE (snoozedUntil null or past) or project next actions. SNOOZED tasks are woken separately via wakeSnoozedTasks(). */
export async function listActionableTasks() {
  const now = new Date();
  return prisma.task.findMany({
    where: {
      status: "active",
      OR: [
        { item: { state: "ACTIONABLE" }, snoozedUntil: null },
        { item: { state: "ACTIONABLE" }, snoozedUntil: { lte: now } },
        { itemId: null, project: { status: "ACTIVE" } },
      ],
    },
    include: taskInclude,
    orderBy: [{ pinnedOrder: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
  });
}

/** Transition items from SNOOZED to ACTIONABLE when snoozedUntil <= now. Returns task ids that were woken. */
export async function wakeSnoozedTasks(): Promise<string[]> {
  const now = new Date();
  const snoozed = await prisma.task.findMany({
    where: {
      status: "active",
      item: { state: "SNOOZED" },
      snoozedUntil: { lte: now },
    },
    select: { id: true, itemId: true },
  });
  const wokenIds: string[] = [];
  for (const t of snoozed) {
    if (t.itemId) {
      await prisma.item.update({
        where: { id: t.itemId },
        data: { state: "ACTIONABLE" },
      });
      wokenIds.push(t.id);
    }
  }
  return wokenIds;
}
