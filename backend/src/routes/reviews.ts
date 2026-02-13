import { Router, Request, Response } from "express";
import { z } from "zod";
import * as reviewsService from "../services/reviews";

export const reviewsRouter = Router();

const postWeeklySchema = z.object({
  focusProjectIds: z.array(z.string()).optional(),
  stepsCompleted: z.array(z.string()).optional(),
});

const postSessionSchema = z.object({
  type: z.enum(["daily", "weekly"]),
});

const patchSessionSchema = z.object({
  stepCompleted: z.string().optional(),
  itemsProcessed: z.number().int().min(0).optional(),
  itemsSkipped: z.number().int().min(0).optional(),
  completedAt: z.string().nullable().optional(),
});

reviewsRouter.post("/sessions", async (req: Request, res: Response) => {
  try {
    const parsed = postSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const session = await reviewsService.createSession(parsed.data.type);
    res.status(201).json(session);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

reviewsRouter.patch("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const parsed = patchSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const result = await reviewsService.updateSession(req.params.id, parsed.data);
    if (result === null) return res.status(404).json({ error: "Session not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

reviewsRouter.get("/daily/snapshot", async (_req: Request, res: Response) => {
  try {
    const data = await reviewsService.getDailySnapshot();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

reviewsRouter.get("/daily/step/:stepId", async (req: Request, res: Response) => {
  try {
    const data = await reviewsService.getDailyStep(req.params.stepId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

reviewsRouter.get("/weekly/snapshot", async (_req: Request, res: Response) => {
  try {
    const data = await reviewsService.getWeeklySnapshot();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

reviewsRouter.get("/weekly/step/:stepId", async (req: Request, res: Response) => {
  try {
    const data = await reviewsService.getWeeklyStep(req.params.stepId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

reviewsRouter.get("/daily", async (_req: Request, res: Response) => {
  try {
    const data = await reviewsService.getDailyReview();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

reviewsRouter.get("/weekly", async (_req: Request, res: Response) => {
  try {
    const data = await reviewsService.getWeeklyReview();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

reviewsRouter.post("/weekly", async (req: Request, res: Response) => {
  try {
    const parsed = postWeeklySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    await reviewsService.postWeeklyReview(parsed.data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
