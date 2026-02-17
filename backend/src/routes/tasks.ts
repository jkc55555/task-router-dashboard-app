import { Router, Request, Response } from "express";
import { z } from "zod";
import * as tasksService from "../services/tasks.js";

export const tasksRouter = Router();

const patchTaskSchema = z.object({
  pinnedOrder: z.number().int().nullable().optional(),
  manualRank: z.number().int().nullable().optional(),
  snoozedUntil: z.string().nullable().optional(),
  actionText: z.string().optional(),
  context: z.enum(["calls", "errands", "computer", "deep_work"]).nullable().optional(),
  energy: z.enum(["low", "medium", "high"]).nullable().optional(),
  estimatedMinutes: z.number().int().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.number().nullable().optional(),
});

tasksRouter.get("/now", async (req: Request, res: Response) => {
  const userId = (req.session as { userId?: string }).userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const timeAvailable = req.query.timeAvailable
      ? parseInt(String(req.query.timeAvailable), 10)
      : undefined;
    const energy = req.query.energy as string | undefined;
    const context = req.query.context as string | undefined;
    const filterMode = (req.query.filterMode as "strict" | "soft" | undefined) || undefined;
    const filters =
      timeAvailable || energy || context
        ? { timeAvailable, energy, context }
        : undefined;

    const wokenIds = await tasksService.wakeSnoozedTasks(userId);
    const [tasks, followUpDueItems] = await Promise.all([
      tasksService.listActionableTasks(userId),
      (await import("../services/items.js")).listWaitingWithFollowUpDue(userId),
    ]);
    const { rankAndTag } = await import("../services/ranking.js");
    const { getNowRankingConfig } = await import("../lib/now-ranking-config.js");
    const maxTags = getNowRankingConfig().tags.max_tags;
    const { ranked, excluded } = rankAndTag(
      tasks as import("../services/ranking.js").TaskWithRelations[],
      { filters, filterMode }
    );

    if (wokenIds.length > 0) {
      for (const r of ranked) {
        if (wokenIds.includes(r.task.id)) {
          r.reasonTags = ["Snoozed until today", ...r.reasonTags.filter((t: string) => t !== "Snoozed until today")].slice(
            0,
            maxTags
          );
        }
      }
    }

    const tasksOut = ranked.map((r) => r.task);
    const reasonTags: Record<string, string[]> = {};
    const scoreBreakdowns: Record<string, import("../services/ranking.js").ScoreBreakdown> = {};
    for (const r of ranked) {
      reasonTags[r.task.id] = r.reasonTags;
      scoreBreakdowns[r.task.id] = r.scoreBreakdown;
    }

    res.json({
      tasks: tasksOut,
      reasonTags,
      scoreBreakdowns,
      excluded: excluded.map((e: { task: unknown; reason: string }) => ({ task: e.task, reason: e.reason })),
      followUpDue: followUpDueItems,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

tasksRouter.get("/:id", async (req: Request, res: Response) => {
  const userId = (req.session as { userId?: string }).userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const task = await tasksService.getTask(req.params.id, userId);
    if (!task) return res.status(404).json({ error: "Not found" });
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

tasksRouter.patch("/:id", async (req: Request, res: Response) => {
  const userId = (req.session as { userId?: string }).userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const parsed = patchTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const task = await tasksService.patchTask(req.params.id, userId, parsed.data);
    if (!task) return res.status(404).json({ error: "Not found" });

    // When snoozedUntil is set, set linked item state to SNOOZED
    if (parsed.data.snoozedUntil !== undefined && task.itemId) {
      const { prisma } = await import("../lib/prisma.js");
      await prisma.item.update({
        where: { id: task.itemId },
        data: { state: "SNOOZED" },
      });
      // Refetch so response includes updated item.state
      const refetched = await tasksService.getTask(req.params.id, userId);
      if (parsed.data.actionText === undefined) return res.json(refetched);
      Object.assign(task, refetched);
    }

    // Edit invalidation: if actionText was updated and item is ACTIONABLE, re-run Gate 1
    if (parsed.data.actionText !== undefined && task.item?.state === "ACTIONABLE") {
      const { isPlausibleNextAction } = await import("../lib/state.js");
      const { verifyNextAction } = await import("../ai/verifier.js");
      const rule = isPlausibleNextAction(task.actionText);
      if (!rule.valid) {
        const { prisma } = await import("../lib/prisma.js");
        if (task.itemId) {
          await prisma.item.update({
            where: { id: task.itemId },
            data: { state: "CLARIFYING" },
          });
        }
        const updated = await tasksService.getTask(req.params.id, userId);
        return res.json({
          ...updated,
          validation_failure: {
            gate_failed: "valid_next_action",
            failures: [{ code: "VAGUE", severity: "high", message: rule.reason ?? "Invalid", fieldRef: "actionText" }],
            missing_inputs: [],
            suggested_questions: [],
          },
        });
      }
      const verifierResult = await verifyNextAction(task.actionText);
      if (verifierResult.status !== "PASS") {
        const { prisma } = await import("../lib/prisma.js");
        if (task.itemId) {
          await prisma.item.update({
            where: { id: task.itemId },
            data: { state: "CLARIFYING" },
          });
        }
        const updated = await tasksService.getTask(req.params.id, userId);
        return res.json({
          ...updated,
          validation_failure: {
            gate_failed: "valid_next_action",
            failures: verifierResult.failures,
            missing_inputs: verifierResult.missingInputs,
            suggested_questions: verifierResult.missingInputs?.length ? verifierResult.missingInputs : [],
          },
        });
      }
    }

    res.json(task);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

tasksRouter.post("/:id/verify", async (req: Request, res: Response) => {
  const userId = (req.session as { userId?: string }).userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const task = await tasksService.getTask(req.params.id, userId);
    if (!task) return res.status(404).json({ error: "Not found" });
    const { isPlausibleNextAction } = await import("../lib/state.js");
    const rule = isPlausibleNextAction(task.actionText);
    if (!rule.valid) {
      return res.json({
        status: "FAIL" as const,
        failures: [{ code: "VAGUE", severity: "high", message: rule.reason ?? "Invalid", fieldRef: "actionText" }],
        missingInputs: [],
        vaguenessFlags: [rule.reason ?? ""],
        unverifiableClaims: [],
      });
    }
    const { verifyNextAction } = await import("../ai/verifier.js");
    const verifierResult = await verifyNextAction(task.actionText);
    res.json(verifierResult);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

tasksRouter.post("/:id/complete", async (req: Request, res: Response) => {
  const userId = (req.session as { userId?: string }).userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const task = await tasksService.getTask(req.params.id, userId);
    if (!task) return res.status(404).json({ error: "Not found" });
    const itemId = task.itemId;
    if (!itemId) {
      return res.status(400).json({
        error: "Task has no linked item",
        gate_failed: "completion",
        failures: [],
        missing_inputs: [],
        suggested_questions: [],
      });
    }
    const transitionService = await import("../services/transition.js");
    const body = (req.body as { force?: boolean; overrideReason?: string }) ?? {};
    const result = await transitionService.executeTransition(
      itemId,
      userId,
      "DONE",
      {},
      "user",
      { force: body.force, overrideReason: body.overrideReason }
    );
    if (!result.success) {
      const status = result.reason === "Item not found" ? 404 : 400;
      return res.status(status).json({
        error: result.reason,
        gate_failed: result.gate_failed,
        failures: result.failures ?? [],
        missing_inputs: result.missing_inputs ?? [],
        suggested_questions: result.suggested_questions ?? [],
      });
    }
    res.json({
      ok: true,
      task: result.task ?? (await tasksService.getTask(req.params.id, userId)),
      projectId: result.projectId,
      nextActionRequired: result.nextActionRequired,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
