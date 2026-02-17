import { prisma } from "../lib/prisma.js";
import { isPlausibleNextAction } from "../lib/state.js";
import { verifyProjectOutcome, verifyProjectNextAction } from "../ai/verifier.js";
import type { ProjectStatus } from "../generated/prisma/client.js";

const MIN_OUTCOME_LENGTH = 10;

export type GateAResult =
  | { pass: true }
  | { pass: false; reason: string; verifierFailures?: Array<{ code: string; severity: string; message: string; fieldRef?: string }> };

/**
 * Gate A: Entering ACTIVE. Boss checks + optional Verifier.
 */
export async function checkGateA(
  outcomeStatement: string | null | undefined,
  nextActionTaskId: string | null | undefined,
  options?: { runVerifier?: boolean }
): Promise<GateAResult> {
  const outcome = (outcomeStatement ?? "").trim();
  if (!outcome || outcome.length < MIN_OUTCOME_LENGTH) {
    return { pass: false, reason: "Outcome statement is required and must be at least 10 characters for ACTIVE." };
  }
  if (!nextActionTaskId) {
    return { pass: false, reason: "Next action is required for ACTIVE." };
  }

  const task = await prisma.task.findUnique({
    where: { id: nextActionTaskId },
    include: { item: true },
  });
  if (!task) {
    return { pass: false, reason: "Next action task not found." };
  }
  const itemState = task.item?.state ?? null;
  if (itemState === "WAITING") {
    return { pass: false, reason: "Next action task is waiting; project should be WAITING." };
  }
  if (itemState === "SNOOZED") {
    return { pass: false, reason: "Next action task is snoozed; cannot be ACTIVE." };
  }
  if (itemState !== "ACTIONABLE") {
    return { pass: false, reason: "Next action task must be ACTIONABLE." };
  }
  if (task.snoozedUntil && task.snoozedUntil > new Date()) {
    return { pass: false, reason: "Next action task is snoozed." };
  }

  const rule = isPlausibleNextAction(task.actionText);
  if (!rule.valid) {
    return { pass: false, reason: rule.reason ?? "Next action is too vague." };
  }

  if (options?.runVerifier) {
    const outcomeVerifier = await verifyProjectOutcome(outcome);
    if (outcomeVerifier.status !== "PASS") {
      return {
        pass: false,
        reason: "Outcome did not pass verification.",
        verifierFailures: outcomeVerifier.failures,
      };
    }
    const nextActionVerifier = await verifyProjectNextAction(outcome, task.actionText);
    if (nextActionVerifier.status !== "PASS") {
      return {
        pass: false,
        reason: "Next action did not pass verification.",
        verifierFailures: nextActionVerifier.failures,
      };
    }
  }

  return { pass: true };
}

/**
 * Gate B: Staying ACTIVE after outcome or next action change. Returns suggested status if invalid.
 */
export async function checkGateB(
  projectId: string,
  outcomeStatement: string | null | undefined,
  nextActionTaskId: string | null | undefined
): Promise<{ valid: boolean; suggestStatus?: ProjectStatus }> {
  const result = await checkGateA(outcomeStatement, nextActionTaskId, { runVerifier: false });
  if (result.pass) return { valid: true };

  const task = nextActionTaskId
    ? await prisma.task.findUnique({
        where: { id: nextActionTaskId },
        include: { item: true },
      })
    : null;
  const itemState = task?.item?.state ?? null;
  if (itemState === "WAITING") {
    return { valid: false, suggestStatus: "WAITING" };
  }
  return { valid: false, suggestStatus: "CLARIFYING" };
}
