import { Router, Request, Response } from "express";
import * as deadlinesService from "../services/deadlines";

export const deadlinesRouter = Router();

deadlinesRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const data = await deadlinesService.getDeadlines();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
