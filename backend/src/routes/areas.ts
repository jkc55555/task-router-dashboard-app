import { Router, Request, Response } from "express";
import { z } from "zod";
import * as areasService from "../services/areas.js";

export const areasRouter = Router();

const getUserId = (req: Request): string | null => (req.session as { userId?: string }).userId ?? null;

const createAreaSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

const patchAreaSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.union([z.string(), z.null()]).optional(),
  color: z.union([z.string(), z.null()]).optional(),
  sortOrder: z.number().int().optional(),
});

const acknowledgeSchema = z.object({
  note: z.string().optional(),
});

areasRouter.get("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const includeArchived = req.query.archived === "true";
    const list = await areasService.listAreas(userId, includeArchived);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

areasRouter.get("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const area = await areasService.getArea(req.params.id, userId);
    if (!area) return res.status(404).json({ error: "Not found" });
    res.json(area);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

areasRouter.post("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const parsed = createAreaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const area = await areasService.createArea(userId, parsed.data);
    res.status(201).json(area);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists")) return res.status(400).json({ error: msg });
    res.status(500).json({ error: msg });
  }
});

areasRouter.patch("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const parsed = patchAreaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const area = await areasService.patchArea(req.params.id, userId, parsed.data);
    if (!area) return res.status(404).json({ error: "Not found" });
    res.json(area);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists") || msg.includes("cannot be empty")) {
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: msg });
  }
});

areasRouter.post("/:id/archive", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const area = await areasService.archiveArea(req.params.id, userId);
    if (!area) return res.status(404).json({ error: "Not found" });
    res.json(area);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

areasRouter.post("/:id/restore", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const area = await areasService.restoreArea(req.params.id, userId);
    if (!area) return res.status(404).json({ error: "Not found" });
    res.json(area);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

areasRouter.post("/:id/acknowledge", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const parsed = acknowledgeSchema.safeParse(req.body);
    const note = parsed.success ? parsed.data.note : undefined;
    const area = await areasService.acknowledgeArea(req.params.id, userId, note);
    if (!area) return res.status(404).json({ error: "Not found" });
    res.json(area);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
