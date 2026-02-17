/**
 * Unit tests for Now ranking: scoring, reason tags, strict/soft filters, pin order.
 * Run: npm run build && node --test dist/services/ranking.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import type { TaskWithRelations } from "./ranking.js";
import { rankAndTag, computeScore } from "./ranking.js";

const now = new Date();

function mkTask(overrides: Partial<TaskWithRelations> = {}): TaskWithRelations {
  return {
    id: "t1",
    itemId: "i1",
    actionText: "Do something",
    context: null,
    energy: null,
    estimatedMinutes: null,
    dueDate: null,
    projectId: null,
    project: null,
    priority: 0,
    status: "active",
    snoozedUntil: null,
    pinnedOrder: null,
    unverified: false,
    createdAt: now,
    updatedAt: now,
    projectNextAction: null,
    item: { id: "i1", state: "ACTIONABLE", title: "", body: "", type: "task", source: "manual", createdAt: now, updatedAt: now } as TaskWithRelations["item"],
    ...overrides,
  } as TaskWithRelations;
}

describe("rankAndTag", () => {
  it("sorts pinned task first", () => {
    const tasks = [
      mkTask({ id: "a", pinnedOrder: null }),
      mkTask({ id: "b", pinnedOrder: 1 }),
      mkTask({ id: "c", pinnedOrder: null }),
    ];
    const { ranked } = rankAndTag(tasks, {});
    assert.strictEqual(ranked[0].task.id, "b");
    assert.strictEqual(ranked[0].task.pinnedOrder, 1);
  });

  it("overdue task shows Overdue tag and ranks high", () => {
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tasks = [
      mkTask({ id: "normal", dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }),
      mkTask({ id: "overdue", dueDate: past }),
    ];
    const { ranked } = rankAndTag(tasks, {});
    assert.strictEqual(ranked[0].task.id, "overdue");
    assert.ok(ranked[0].reasonTags.includes("Overdue"));
  });

  it("unverified task shows Needs review and remains in list", () => {
    const tasks = [mkTask({ id: "u", unverified: true })];
    const { ranked } = rankAndTag(tasks, {});
    assert.strictEqual(ranked.length, 1);
    assert.ok(ranked[0].reasonTags.includes("Needs review"));
    assert.ok(ranked[0].scoreBreakdown.riskPenalty > 0);
  });

  it("strict mode excludes task when time filter does not match", () => {
    const tasks = [mkTask({ id: "long", estimatedMinutes: 60 })];
    const { ranked, excluded } = rankAndTag(tasks, {
      filters: { timeAvailable: 15 },
      filterMode: "strict",
    });
    assert.strictEqual(ranked.length, 0);
    assert.strictEqual(excluded.length, 1);
    assert.strictEqual(excluded[0].task.id, "long");
    assert.ok(excluded[0].reason.includes("60 min"));
  });

  it("soft mode keeps task but applies fit penalty when time does not match", () => {
    const tasks = [mkTask({ id: "long", estimatedMinutes: 60 })];
    const { ranked, excluded } = rankAndTag(tasks, {
      filters: { timeAvailable: 15 },
      filterMode: "soft",
    });
    assert.strictEqual(ranked.length, 1);
    assert.strictEqual(excluded.length, 0);
    assert.ok(ranked[0].scoreBreakdown.fit < 0);
  });

  it("returns score breakdown for each ranked task", () => {
    const tasks = [mkTask({ id: "x" })];
    const { ranked } = rankAndTag(tasks, {});
    assert.strictEqual(ranked.length, 1);
    const b = ranked[0].scoreBreakdown;
    assert.ok(typeof b.urgency === "number");
    assert.ok(typeof b.importance === "number");
    assert.ok(typeof b.leverage === "number");
    assert.ok(typeof b.staleness === "number");
    assert.ok(typeof b.fit === "number");
    assert.ok(typeof b.friction === "number");
    assert.ok(typeof b.riskPenalty === "number");
    assert.ok(typeof b.total === "number");
    assert.ok(b.overrides?.pinned === false);
  });

  it("focus project task gets importance and can show Focus project tag", () => {
    const tasks = [
      mkTask({
        id: "f",
        project: {
          id: "p1",
          focusThisWeek: true,
          priority: 5,
          dueDate: null,
          lastProgressAt: null,
        } as TaskWithRelations["project"],
      }),
    ];
    const { ranked } = rankAndTag(tasks, {});
    assert.strictEqual(ranked.length, 1);
    assert.ok(ranked[0].scoreBreakdown.importance >= 0);
    assert.ok(ranked[0].reasonTags.some((t) => t === "Focus project"));
  });

  it("stale task (old updatedAt) gets staleness score", () => {
    const oldDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const tasks = [mkTask({ id: "stale", updatedAt: oldDate, createdAt: oldDate })];
    const { ranked } = rankAndTag(tasks, {});
    assert.strictEqual(ranked.length, 1);
    assert.ok(ranked[0].scoreBreakdown.staleness > 0);
    assert.ok(ranked[0].reasonTags.some((t) => t.includes("Stale") || t.includes("Ignored")));
  });
});

describe("computeScore (legacy)", () => {
  it("returns a number", () => {
    const task = mkTask({ id: "x" });
    const score = computeScore(task);
    assert.ok(typeof score === "number");
  });
});
