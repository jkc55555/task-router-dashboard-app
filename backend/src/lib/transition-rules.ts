import type { ItemState } from "@prisma/client";

/** Allowed (fromState, toState) transitions per spec §4. */
const ALLOWED: Record<ItemState, ItemState[]> = {
  INBOX: ["CLARIFYING", "ACTIONABLE", "PROJECT", "REFERENCE", "SOMEDAY", "ARCHIVED", "WAITING"],
  CLARIFYING: ["ACTIONABLE", "WAITING", "PROJECT", "REFERENCE", "SOMEDAY", "ARCHIVED"],
  ACTIONABLE: ["DONE", "WAITING", "SNOOZED", "CLARIFYING"],
  WAITING: ["ACTIONABLE", "SNOOZED", "DONE", "CLARIFYING"],
  SNOOZED: ["ACTIONABLE", "WAITING", "DONE", "CLARIFYING"],
  DONE: ["ARCHIVED"],
  ARCHIVED: [],
  PROJECT: [], // project items are governed by Project model
  SOMEDAY: ["ACTIONABLE", "CLARIFYING", "REFERENCE", "ARCHIVED"],
  REFERENCE: ["ARCHIVED"],
};

/**
 * Returns true if transitioning from `from` to `to` is allowed.
 */
export function isTransitionAllowed(from: ItemState, to: ItemState): boolean {
  const allowed = ALLOWED[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** Transitions that require Gate 1 (deterministic + Verifier) to enter ACTIONABLE. */
export function requiresGate1(to: ItemState): boolean {
  return to === "ACTIONABLE";
}

/** Transitions that require Gate 2 (evidence + Verifier) to enter DONE. */
export function requiresGate2(to: ItemState): boolean {
  return to === "DONE";
}

/** Transitions that require snoozedUntil (wake_at) in payload. */
export function requiresSnoozedUntil(to: ItemState): boolean {
  return to === "SNOOZED";
}

/** Transitions that use waitingOn / waitingSince (optional but recommended for WAITING). */
export function usesWaitingMetadata(to: ItemState): boolean {
  return to === "WAITING";
}
