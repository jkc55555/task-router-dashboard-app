import type { ProjectStatus } from "@prisma/client";

/** Allowed (fromStatus, toStatus) transitions per spec §4. SOMEDAY treated like ON_HOLD. */
const ALLOWED: Record<ProjectStatus, ProjectStatus[]> = {
  CLARIFYING: ["ACTIVE", "ON_HOLD", "ARCHIVED"],
  ACTIVE: ["WAITING", "ON_HOLD", "DONE", "CLARIFYING"],
  WAITING: ["ACTIVE", "ON_HOLD", "DONE", "CLARIFYING"],
  ON_HOLD: ["ACTIVE", "CLARIFYING", "ARCHIVED"],
  SOMEDAY: ["ACTIVE", "CLARIFYING", "ARCHIVED"], // same as ON_HOLD
  DONE: ["ARCHIVED"],
  ARCHIVED: [],
};

/**
 * Returns true if transitioning from `from` to `to` is allowed.
 */
export function isProjectTransitionAllowed(
  from: ProjectStatus,
  to: ProjectStatus
): boolean {
  const allowed = ALLOWED[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Returns the list of statuses that are valid transitions from the given status.
 */
export function getAllowedProjectTransitions(
  from: ProjectStatus
): ProjectStatus[] {
  return ALLOWED[from] ?? [];
}
