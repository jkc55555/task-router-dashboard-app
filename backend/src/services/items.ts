import { prisma } from "../lib/prisma.js";
import { dispositionToTypeAndState, isPlausibleNextAction } from "../lib/state.js";
import type { ItemState, ItemType } from "../generated/prisma/client.js";

const itemInclude = {
  task: true,
  project: { include: { nextActionTask: true } },
  artifacts: true,
  reminders: true,
};

export async function listItems(state?: ItemState) {
  const where = state ? { state } : {};
  return prisma.item.findMany({
    where,
    include: itemInclude,
    orderBy: { updatedAt: "desc" },
  });
}

/** WAITING items that have at least one reminder with dueAt <= now (follow-up due). For Now list. */
export async function listWaitingWithFollowUpDue() {
  const now = new Date();
  return prisma.item.findMany({
    where: {
      state: "WAITING",
      reminders: {
        some: { dueAt: { lte: now } },
      },
    },
    include: itemInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getItem(id: string) {
  return prisma.item.findUnique({
    where: { id },
    include: itemInclude,
  });
}

export async function addReminder(itemId: string, dueAt: Date, kind: string = "follow_up") {
  const item = await getItem(itemId);
  if (!item) return null;
  return prisma.reminder.create({
    data: { itemId, dueAt, kind },
  });
}

export type AttachmentInput = {
  type?: "file" | "image";
  storageKey: string;
  url: string;
  filename: string;
  mimeType?: string;
  size?: number;
};

export async function createItem(data: {
  title: string;
  body?: string;
  source?: string;
  attachments?: AttachmentInput[];
}) {
  const titlePreview = (data.title?.trim() || "Untitled").slice(0, 50);
  const attachmentsCount = data.attachments?.length ?? 0;
  console.log(`[ITEMS_SVC] createItem input titlePreview="${titlePreview}" source=${data.source ?? ""} attachments=${attachmentsCount}`);
  const title = data.title.trim() || "Untitled";
  const bodyStr = data.body?.trim() ?? "";
  const attachmentsJson =
    data.attachments && data.attachments.length > 0
      ? (data.attachments.map((a) => ({
          type: a.type ?? "file",
          storageKey: a.storageKey,
          url: a.url,
          filename: a.filename,
          mimeType: a.mimeType ?? null,
          size: a.size ?? null,
        })) as unknown)
      : undefined;
  const createData = {
    title,
    body: bodyStr,
    source: data.source ?? "manual",
    state: "INBOX" as const,
    type: "task" as const,
    attachments: attachmentsJson ?? undefined,
  };
  console.log(`[ITEMS_SVC] prisma.item.create called titleLen=${title.length} bodyLen=${bodyStr.length} source=${createData.source} state=${createData.state} type=${createData.type}`);
  try {
    const item = await prisma.item.create({
      data: createData,
      include: itemInclude,
    });
    console.log(`[ITEMS_SVC] prisma.item.create succeeded id=${item.id} title="${(item.title || "").slice(0, 50)}" state=${item.state} createdAt=${item.createdAt?.toISOString() ?? ""}`);
    return item;
  } catch (e) {
    console.error("[ITEMS_SVC] createItem error", e instanceof Error ? e.message : String(e), e instanceof Error ? e.stack : "");
    throw e;
  }
}

export async function patchItem(
  id: string,
  body: {
    disposition?: string;
    title?: string;
    body?: string;
    type?: ItemType;
    state?: ItemState;
  }
) {
  const item = await getItem(id);
  if (!item) return null;

  const updates: Parameters<typeof prisma.item.update>[0]["data"] = {};
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.body !== undefined) updates.body = body.body.trim();
  if (body.type !== undefined) updates.type = body.type;
  if (body.state !== undefined) updates.state = body.state;

  if (body.disposition) {
    const mapped = dispositionToTypeAndState(body.disposition);
    if (mapped) {
      updates.type = mapped.type;
      updates.state = mapped.state;
    }
  }

  return prisma.item.update({
    where: { id },
    data: updates,
    include: itemInclude,
  });
}

/**
 * Disposition to "next action": create Task and set state to ACTIONABLE only if actionText passes rule + (later) Verifier.
 */
export async function setDispositionNextAction(
  itemId: string,
  actionText: string,
  options?: { context?: string; energy?: string; estimatedMinutes?: number; dueDate?: string }
) {
  const rule = isPlausibleNextAction(actionText);
  if (!rule.valid) return { success: false, reason: rule.reason, item: null };

  const item = await getItem(itemId);
  if (!item) return { success: false, reason: "Item not found", item: null };

  const context = options?.context as "calls" | "errands" | "computer" | "deep_work" | undefined;
  const energy = options?.energy as "low" | "medium" | "high" | undefined;

  const task = await prisma.task.create({
    data: {
      itemId,
      actionText: actionText.trim(),
      context: context ?? null,
      energy: energy ?? null,
      estimatedMinutes: options?.estimatedMinutes ?? null,
      dueDate: options?.dueDate ? new Date(options.dueDate) : null,
    },
  });

  await prisma.item.update({
    where: { id: itemId },
    data: { type: "task", state: "ACTIONABLE" },
  });

  const updated = await getItem(itemId);
  return { success: true, item: updated, task };
}

/**
 * Create a new ACTIONABLE task from a WAITING item (follow-up due).
 * Action text: "Follow up with {waitingOn} re: {title}". Original item stays WAITING.
 */
export async function createFollowUpTaskFromWaiting(itemId: string) {
  const item = await getItem(itemId);
  if (!item) return { success: false, reason: "Item not found" };
  if (item.state !== "WAITING") return { success: false, reason: "Item is not WAITING" };
  const now = new Date();
  const hasDueReminder = item.reminders?.some((r) => r.dueAt <= now);
  if (!hasDueReminder) return { success: false, reason: "No follow-up due for this item" };

  const who = item.waitingOn?.trim() || "someone";
  const topic = item.title?.trim() || "pending";
  const actionText = `Follow up with ${who} re: ${topic}`;

  const newItem = await createItem({
    title: actionText,
    body: item.body ? `(Follow-up from: ${item.title})\n\n${item.body}` : `(Follow-up from: ${item.title})`,
    source: "review_follow_up",
  });
  const result = await setDispositionNextAction(newItem.id, actionText);
  if (!result.success) return { success: false, reason: result.reason ?? "Failed to create task" };
  const updated = await getItem(newItem.id);
  return { success: true, item: updated!, task: updated!.task ?? result.task };
}

export async function setDispositionProject(
  itemId: string,
  outcomeStatement: string,
  nextActionText: string,
  options?: { dueDate?: string; priority?: number }
) {
  const item = await getItem(itemId);
  if (!item) return { success: false, reason: "Item not found", item: null, project: null };

  const outcome = outcomeStatement.trim();
  const nextAction = nextActionText.trim();
  const outcomeOk = outcome.length >= 10;
  const rule = nextAction ? isPlausibleNextAction(nextAction) : { valid: false as const, reason: "Next action required for ACTIVE" };

  let taskId: string | null = null;
  if (nextAction && rule.valid) {
    const task = await prisma.task.create({
      data: { itemId, actionText: nextAction },
    });
    taskId = task.id;
  }

  const status = outcomeOk && taskId ? "ACTIVE" : "CLARIFYING";
  const project = await prisma.project.create({
    data: {
      itemId,
      outcomeStatement: outcome || null,
      status,
      nextActionTaskId: taskId,
      dueDate: options?.dueDate ? new Date(options.dueDate) : null,
      priority: options?.priority ?? 0,
      lastProgressAt: new Date(),
    },
    include: { item: true, nextActionTask: true, tasks: true },
  });

  if (taskId) {
    await prisma.task.update({
      where: { id: taskId },
      data: { projectId: project.id },
    });
  }

  await prisma.item.update({
    where: { id: itemId },
    data: { type: "project", state: "PROJECT" },
  });

  const updated = await getItem(itemId);
  const task = taskId ? await prisma.task.findUnique({ where: { id: taskId }, include: { item: true, project: true, projectNextAction: true } }) : null;
  return {
    success: true,
    item: updated,
    project,
    task,
    createdAsClarifying: status === "CLARIFYING",
    reason: status === "CLARIFYING" ? (rule.valid ? "Outcome or next action missing or too short for ACTIVE." : rule.reason) : undefined,
  };
}
