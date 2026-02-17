import { Router, Request, Response } from "express";
import * as deadlinesService from "../services/deadlines.js";

export const deadlinesRouter = Router();

deadlinesRouter.get("/", async (req: Request, res: Response) => {
  const userId = (req.session as { userId?: string }).userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const data = await deadlinesService.getDeadlines(userId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
