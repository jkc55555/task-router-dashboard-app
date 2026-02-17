import { Router, Request, Response } from "express";
import { z } from "zod";
import { getAllowedProjectTransitions } from "../lib/project-transition-rules";
import * as projectsService from "../services/projects";

export const projectsRouter = Router();

const projectStatusEnum = z.enum(["CLARIFYING", "ACTIVE", "WAITING", "SOMEDAY", "ON_HOLD", "DONE", "ARCHIVED"]);

const createProjectSchema = z.object({
  itemId: z.string().min(1).optional(),
  outcomeStatement: z.string().optional(),
  nextActionText: z.string().min(1).optional(),
  status: projectStatusEnum.optional(),
  dueDate: z.string().optional(),
  priority: z.number().int().optional(),
  themeTag: z.string().optional(),
});

const patchProjectSchema = z.object({
  outcomeStatement: z.string().optional(),
  nextActionTaskId: z.string().nullable().optional(),
  nextActionText: z.string().min(1).optional(),
  status: projectStatusEnum.optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.number().int().optional(),
  focusThisWeek: z.boolean().optional(),
  themeTag: z.string().nullable().optional(),
  waitingOn: z.string().nullable().optional(),
  waitingSince: z.string().nullable().optional(),
  followUpAt: z.string().nullable().optional(),
});

const completeProjectSchema = z.object({
  confirmOutcome: z.boolean(),
  remainingTaskPolicy: z.enum(["strict", "flexible"]).optional(),
});

const assignProjectSchema = z.object({ itemId: z.string().min(1) });

projectsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const list = await projectsService.listProjects();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

projectsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const project = await projectsService.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Not found" });
    res.json(project);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

projectsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const result = await projectsService.createProject({
      itemId: parsed.data.itemId,
      outcomeStatement: parsed.data.outcomeStatement ?? "",
      nextActionText: parsed.data.nextActionText,
      status: parsed.data.status,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      priority: parsed.data.priority,
      themeTag: parsed.data.themeTag,
    });
    if (!result.success) return res.status(400).json({ reason: result.reason });
    if (!result.project) return res.status(500).json({ error: "Project created but failed to load" });
    res.status(201).json(result.project);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

projectsRouter.post("/:id/assign", async (req: Request, res: Response) => {
  try {
    const body = assignProjectSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Invalid body", details: body.error.flatten() });
    }
    const result = await projectsService.assignItemToProject(req.params.id, body.data.itemId);
    if (!result.success) {
      if (result.reason === "Project not found" || result.reason === "Item not found") {
        return res.status(404).json({ error: result.reason });
      }
      return res.status(400).json({ error: result.reason });
    }
    res.json(result.project);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

projectsRouter.get("/:id/allowed-transitions", async (req: Request, res: Response) => {
  try {
    const project = await projectsService.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Not found" });
    const allowed = getAllowedProjectTransitions(project.status);
    res.json({ allowed });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

projectsRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const parsed = patchProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const result = await projectsService.patchProject(req.params.id, parsed.data);
    if (result && typeof result === "object" && "error" in result) return res.status(400).json({ error: result.error });
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

projectsRouter.post("/:id/complete", async (req: Request, res: Response) => {
  try {
    const parsed = completeProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const result = await projectsService.completeProject(req.params.id, {
      confirmOutcome: parsed.data.confirmOutcome,
      remainingTaskPolicy: parsed.data.remainingTaskPolicy,
    });
    if (!result.success) {
      const status = result.error.includes("not found") ? 404 : 400;
      return res.status(status).json({ error: result.error, remainingTasks: result.remainingTasks });
    }
    res.json(result.project);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
