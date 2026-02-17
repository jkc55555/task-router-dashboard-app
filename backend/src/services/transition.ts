import { prisma } from "../lib/prisma.js";
import { isTransitionAllowed } from "../lib/transition-rules.js";
import { isPlausibleNextAction } from "../lib/state.js";
import { verifyNextAction, verifyCompletion } from "../ai/verifier.js";
import * as itemsService from "./items.js";
import * as tasksService from "./tasks.js";
import * as artifactsService from "./artifacts.js";
import * as projectsService from "./projects.js";
import type { ItemState } from "../generated/prisma/client.js";

export type TransitionPayload = {
  actionText?: string;
  context?: string;
  energy?: string;
  estimatedMinutes?: number;
  dueDate?: string;
  snoozedUntil?: string;
  waitingOn?: string;
  followUpAt?: string;
};

export type TransitionOptions = {
  force?: boolean;
  overrideReason?: string;
};

export type TransitionSuccess = {
  success: true;
  item: Awaited<ReturnType<typeof itemsService.getItem>>;
  task?: Awaited<ReturnType<typeof tasksService.getTask>> | null;
  /** Set when the completed task was a project's next action; frontend should redirect to project to set new next action. */
  projectId?: string | null;
  nextActionRequired?: boolean;
};

export type GateFailure = {
  gate_failed: "valid_next_action" | "completion";
  failures: Array<{ code: string; severity: string; message: string; fieldRef?: string }>;
  missing_inputs: string[];
  vagueness_flags?: string[];
  suggested_questions?: string[];
};

export type TransitionRejected = {
  success: false;
  reason: string;
  gate_failed?: GateFailure["gate_failed"];
  failures?: GateFailure["failures"];
  missing_inputs?: string[];
  vagueness_flags?: string[];
  suggested_questions?: string[];
};

export type TransitionResult = TransitionSuccess | TransitionRejected;

async function writeAudit(
  itemId: string,
  fromState: ItemState,
  toStateAttempted: ItemState,
  decision: "approved" | "rejected",
  actor: string,
  reasons: Record<string, unknown> | null,
  override: boolean,
  overrideReason: string | null,
  userId?: string
) {
  await prisma.transitionAuditLog.create({
    data: {
      itemId,
      userId: userId ?? undefined,
      fromState,
      toStateAttempted,
      decision,
      actor,
      reasons: reasons ? (reasons as object) : undefined,
      override,
      overrideReason,
    },
  });
}

/**
 * Execute a single state transition. All transitions go through here and are audited.
 */
export async function executeTransition(
  itemId: string,
  userId: string,
  targetState: ItemState,
  payload: TransitionPayload,
  actor: string,
  options: TransitionOptions = {}
): Promise<TransitionResult> {
  const item = await itemsService.getItem(itemId, userId);
  if (!item) return { success: false, reason: "Item not found" };

  const currentState = item.state;
  if (!isTransitionAllowed(currentState, targetState)) {
    await writeAudit(
      itemId,
      currentState,
      targetState,
      "rejected",
      actor,
      { reason: "transition_not_allowed" },
      false,
      null,
      userId
    );
    return { success: false, reason: `Transition from ${currentState} to ${targetState} is not allowed` };
  }

  const force = options.force ?? false;
  const overrideReason = options.overrideReason ?? null;

  // --- Gate 1: To ACTIONABLE ---
  if (targetState === "ACTIONABLE") {
    const actionText = payload.actionText?.trim();
    if (!actionText) {
      await writeAudit(itemId, currentState, targetState, "rejected", actor, { reason: "missing_actionText" }, false, null);
      return {
        success: false,
        reason: "actionText required for ACTIONABLE",
        gate_failed: "valid_next_action",
        failures: [{ code: "MISSING", severity: "high", message: "actionText is required" }],
        missing_inputs: ["actionText"],
        suggested_questions: [],
      };
    }

    const rule = isPlausibleNextAction(actionText);
    if (!rule.valid && !force) {
      // Deterministic fail: set CLARIFYING, ensure Task exists, return structured error
      const taskData = {
        actionText,
        context: payload.context as "calls" | "errands" | "computer" | "deep_work" | undefined,
        energy: payload.energy as "low" | "medium" | "high" | undefined,
        estimatedMinutes: payload.estimatedMinutes ?? undefined,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      };
      if (item.task) {
        await prisma.task.update({ where: { id: item.task.id }, data: taskData });
      } else {
        await prisma.task.create({ data: { userId, itemId, ...taskData } });
      }
      await prisma.item.update({
        where: { id: itemId },
        data: { type: "task", state: "CLARIFYING" },
      });
      await writeAudit(
        itemId,
        currentState,
        targetState,
        "rejected",
        actor,
        { reason: "deterministic_fail", ruleReason: rule.reason },
        false,
        null,
        userId
      );
      return {
        success: false,
        reason: rule.reason ?? "Invalid next action",
        gate_failed: "valid_next_action",
        failures: [{ code: "VAGUE", severity: "high", message: rule.reason ?? "Invalid", fieldRef: "actionText" }],
        missing_inputs: [],
        suggested_questions: [],
      };
    }

    if (rule.valid && !force) {
      const verifierResult = await verifyNextAction(actionText);
      if (verifierResult.status !== "PASS") {
        const taskData = {
          actionText,
          context: payload.context as "calls" | "errands" | "computer" | "deep_work" | undefined,
          energy: payload.energy as "low" | "medium" | "high" | undefined,
          estimatedMinutes: payload.estimatedMinutes ?? undefined,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
        };
        if (item.task) {
          await prisma.task.update({ where: { id: item.task.id }, data: taskData });
        } else {
          await prisma.task.create({ data: { userId, itemId, ...taskData } });
        }
        await prisma.item.update({
          where: { id: itemId },
          data: { type: "task", state: "CLARIFYING" },
        });
        await writeAudit(
          itemId,
          currentState,
          targetState,
          "rejected",
          actor,
          { verifier: verifierResult.status, failures: verifierResult.failures },
          false,
          null,
          userId
        );
        return {
          success: false,
          reason: "Verifier did not pass",
          gate_failed: "valid_next_action",
          failures: verifierResult.failures,
          missing_inputs: verifierResult.missingInputs,
          vagueness_flags: verifierResult.vaguenessFlags,
          suggested_questions: verifierResult.missingInputs?.length ? verifierResult.missingInputs : [],
        };
      }
    }

    const context = payload.context as "calls" | "errands" | "computer" | "deep_work" | undefined;
    const energy = payload.energy as "low" | "medium" | "high" | undefined;
    if (item.task) {
      await prisma.task.update({
        where: { id: item.task.id },
        data: {
          actionText: actionText.trim(),
          context: context ?? undefined,
          energy: energy ?? undefined,
          estimatedMinutes: payload.estimatedMinutes ?? undefined,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
        },
      });
    } else {
      await prisma.task.create({
        data: {
          userId,
          itemId,
          actionText: actionText.trim(),
          context: context ?? null,
          energy: energy ?? null,
          estimatedMinutes: payload.estimatedMinutes ?? null,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        },
      });
    }
    await prisma.item.update({
      where: { id: itemId },
      data: { type: "task", state: "ACTIONABLE" },
    });
    await writeAudit(
      itemId,
      currentState,
      targetState,
      "approved",
      actor,
      { actionText, override: force },
      force,
      overrideReason,
      userId
    );
    const updated = await itemsService.getItem(itemId, userId);
    const task = updated?.task ? await tasksService.getTask(updated.task.id, userId) : null;
    return { success: true, item: updated!, task };
  }

  // --- Gate 2: To DONE ---
  if (targetState === "DONE") {
    const task = item.task ? await tasksService.getTask(item.task.id, userId) : null;
    if (!task) {
      await writeAudit(itemId, currentState, targetState, "rejected", actor, { reason: "no_task" }, false, null, userId);
      return { success: false, reason: "Item has no task; cannot mark DONE" };
    }

    if (!force && task.itemId) {
      const hasEvidence = await artifactsService.hasEvidenceForItem(task.itemId);
      if (!hasEvidence) {
        await writeAudit(itemId, currentState, targetState, "rejected", actor, { reason: "no_evidence" }, false, null, userId);
        return {
          success: false,
          reason: "No draft artifact attached",
          gate_failed: "completion",
          failures: [{ code: "NO_EVIDENCE", severity: "high", message: "No draft artifact attached" }],
          missing_inputs: ["evidence"],
          suggested_questions: ["Add a draft, note, or file as evidence before marking done."],
        };
      }
      const artifacts = await artifactsService.listArtifactsForItem(task.itemId);
      const latest = artifacts[0];
      const evidence = latest
        ? { artifactType: latest.artifactType, content: latest.content, filePointer: latest.filePointer }
        : { artifactType: "note" as const, content: null, filePointer: null };
      const title = item.title ?? task.actionText;
      const verifierResult = await verifyCompletion(title, task.actionText, evidence);
      if (verifierResult.status !== "PASS" && !force) {
        await writeAudit(
          itemId,
          currentState,
          targetState,
          "rejected",
          actor,
          { verifier: verifierResult },
          false,
          null,
          userId
        );
        return {
          success: false,
          reason: "Verification failed",
          gate_failed: "completion",
          failures: verifierResult.failures,
          missing_inputs: verifierResult.missingInputs,
          suggested_questions: verifierResult.missingInputs?.length ? verifierResult.missingInputs : [],
        };
      }
    }

    await prisma.item.update({
      where: { id: itemId },
      data: { state: "DONE" },
    });
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "completed", unverified: force },
    });
    const projectAsNextAction = await prisma.project.findFirst({
      where: { nextActionTaskId: task.id },
      select: { id: true },
    });
    const projectId = projectAsNextAction?.id ?? null;
    if (projectAsNextAction) {
      await prisma.project.update({
        where: { id: projectAsNextAction.id },
        data: { nextActionTaskId: null, lastProgressAt: new Date() },
      });
    } else if (task.projectId) {
      await prisma.project.update({
        where: { id: task.projectId },
        data: { lastProgressAt: new Date() },
      });
    }
    await writeAudit(
      itemId,
      currentState,
      targetState,
      "approved",
      actor,
      { override: force, unverified: force },
      force,
      overrideReason,
      userId
    );
    const updated = await itemsService.getItem(itemId, userId);
    const updatedTask = await tasksService.getTask(task.id, userId);
    return {
      success: true,
      item: updated!,
      task: updatedTask,
      projectId: projectId ?? undefined,
      nextActionRequired: !!projectId,
    };
  }

  // --- SNOOZED: require snoozedUntil ---
  if (targetState === "SNOOZED") {
    const snoozedUntil = payload.snoozedUntil;
    if (!snoozedUntil && !force) {
      await writeAudit(itemId, currentState, targetState, "rejected", actor, { reason: "missing_snoozedUntil" }, false, null);
      return {
        success: false,
        reason: "snoozedUntil (wake time) is required for SNOOZED",
        gate_failed: undefined,
        failures: [],
        missing_inputs: ["snoozedUntil"],
        suggested_questions: [],
      };
    }
    const at = snoozedUntil ? new Date(snoozedUntil) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.item.update({
      where: { id: itemId },
      data: { state: "SNOOZED" },
    });
    if (item.task) {
      await prisma.task.update({
        where: { id: item.task.id },
        data: { snoozedUntil: at },
      });
    }
    await writeAudit(itemId, currentState, targetState, "approved", actor, { snoozedUntil: at.toISOString() }, false, null, userId);
    if (item.task) await projectsService.syncProjectStateForNextActionTask(item.task.id, "SNOOZED");
    const updated = await itemsService.getItem(itemId, userId);
    return { success: true, item: updated!, task: item.task ? await tasksService.getTask(item.task.id, userId) : null };
  }

  // --- WAITING: set waitingOn, waitingSince, optional reminder ---
  if (targetState === "WAITING") {
    const now = new Date();
    await prisma.item.update({
      where: { id: itemId },
      data: {
        state: "WAITING",
        waitingOn: payload.waitingOn ?? null,
        waitingSince: now,
      },
    });
    if (payload.followUpAt) {
      const dueAt = new Date(payload.followUpAt);
      const existing = await prisma.reminder.findFirst({ where: { itemId, kind: "follow_up" } });
      if (existing) {
        await prisma.reminder.update({ where: { id: existing.id }, data: { dueAt } });
      } else {
        await prisma.reminder.create({ data: { itemId, dueAt, kind: "follow_up" } });
      }
    }
    await writeAudit(
      itemId,
      currentState,
      targetState,
      "approved",
      actor,
      { waitingOn: payload.waitingOn, followUpAt: payload.followUpAt },
      false,
      null,
      userId
    );
    if (item.task) await projectsService.syncProjectStateForNextActionTask(item.task.id, "WAITING");
    const updated = await itemsService.getItem(itemId, userId);
    return { success: true, item: updated!, task: item.task ? await tasksService.getTask(item.task.id, userId) : null };
  }

  // --- Other transitions (CLARIFYING, ARCHIVED, PROJECT, REFERENCE, SOMEDAY) ---
  await prisma.item.update({
    where: { id: itemId },
    data: { state: targetState },
  });
  await writeAudit(itemId, currentState, targetState, "approved", actor, null, false, null, userId);
  if (item.task && (targetState === "CLARIFYING" || targetState === "ARCHIVED" || targetState === "REFERENCE" || targetState === "SOMEDAY")) {
    await projectsService.syncProjectStateForNextActionTask(item.task.id, targetState);
  }
  const updated = await itemsService.getItem(itemId, userId);
  return { success: true, item: updated!, task: item.task ? await tasksService.getTask(item.task.id, userId) : null };
}
