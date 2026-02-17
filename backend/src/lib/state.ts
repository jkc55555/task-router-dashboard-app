import type { ItemState, ItemType } from "../generated/prisma/client.js";

const VAGUE_PLACEHOLDERS = [
  "tbd",
  "figure out",
  "work on",
  "handle",
  "look into",
  "fix",
  "review",
  "check",
  "something",
  "stuff",
  "things",
];

const VALID_VERBS = [
  "call",
  "email",
  "draft",
  "write",
  "send",
  "buy",
  "schedule",
  "book",
  "download",
  "fill",
  "submit",
  "compare",
  "ask",
  "reply",
  "create",
  "update",
  "delete",
  "add",
  "remove",
  "find",
  "get",
  "pick",
  "choose",
  "confirm",
  "cancel",
  "pay",
  "file",
  "sign",
  "upload",
  "copy",
  "paste",
  "move",
  "organize",
  "list",
  "research",
  "read",
  "watch",
  "test",
  "install",
  "set up",
  "configure",
];

/**
 * Rule-based check for valid next action (spec §4).
 * Verifier AI provides semantic check; this catches obvious placeholders and missing verbs.
 */
export function isPlausibleNextAction(actionText: string): { valid: boolean; reason?: string } {
  const t = actionText.trim();
  if (!t || t.length < 5) return { valid: false, reason: "Too short to be a concrete action" };
  const lower = t.toLowerCase();
  for (const p of VAGUE_PLACEHOLDERS) {
    if (lower.includes(p)) return { valid: false, reason: `Vague placeholder: "${p}"` };
  }
  const firstWord = t.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/, "") ?? "";
  const hasVerb = VALID_VERBS.some((v) => firstWord === v || firstWord.startsWith(v));
  if (!hasVerb) return { valid: false, reason: "Next action should start with a verb (e.g. call, email, draft)" };
  return { valid: true };
}

export function dispositionToTypeAndState(
  disposition: string
): { type: ItemType; state: ItemState } | null {
  const map: Record<string, { type: ItemType; state: ItemState }> = {
    "next_action": { type: "task", state: "ACTIONABLE" },
    project: { type: "project", state: "PROJECT" },
    waiting: { type: "waiting", state: "WAITING" },
    someday: { type: "someday", state: "SOMEDAY" },
    reference: { type: "reference", state: "REFERENCE" },
    trash: { type: "trash", state: "ARCHIVED" },
  };
  return map[disposition] ?? null;
}
