import { Router, Request, Response } from "express";
import { z } from "zod";
import * as itemsService from "../services/items";
import * as artifactsService from "../services/artifacts";
import * as transitionService from "../services/transition";
import type { ItemState } from "@prisma/client";

export const itemsRouter = Router();

const attachmentSchema = z.object({
  type: z.enum(["file", "image"]).optional(),
  storageKey: z.string(),
  url: z.string(),
  filename: z.string(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
});
const createItemSchema = z.object({
  title: z.string().min(1).max(2000),
  body: z.string().optional(),
  source: z.string().optional(),
  attachments: z.array(attachmentSchema).optional(),
});

const patchItemSchema = z.object({
  disposition: z.enum(["next_action", "project", "waiting", "someday", "reference", "trash"]).optional(),
  title: z.string().min(1).max(2000).optional(),
  body: z.string().optional(),
  type: z.enum(["task", "project", "reference", "waiting", "someday", "trash"]).optional(),
  state: z.enum(["INBOX", "CLARIFYING", "ACTIONABLE", "PROJECT", "WAITING", "SNOOZED", "SOMEDAY", "REFERENCE", "DONE", "ARCHIVED"]).optional(),
});

const nextActionSchema = z.object({
  actionText: z.string().min(1),
  context: z.enum(["calls", "errands", "computer", "deep_work"]).optional(),
  energy: z.enum(["low", "medium", "high"]).optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  dueDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
});

const projectDispositionSchema = z.object({
  outcomeStatement: z.string().min(1),
  nextActionText: z.string().min(1),
  dueDate: z.string().optional(),
  priority: z.number().int().optional(),
});

const artifactSchema = z.object({
  artifactType: z.enum(["draft", "email", "decision", "note", "file"]),
  content: z.string().optional(),
  filePointer: z.string().optional(),
});

const addReminderSchema = z.object({
  dueAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  kind: z.string().optional(),
});

const transitionSchema = z.object({
  target_state: z.enum(["CLARIFYING", "ACTIONABLE", "WAITING", "SNOOZED", "DONE", "ARCHIVED", "PROJECT", "REFERENCE", "SOMEDAY"]),
  proposed_changes: z
    .object({
      actionText: z.string().optional(),
      context: z.string().optional(),
      energy: z.string().optional(),
      estimatedMinutes: z.number().optional(),
      dueDate: z.string().optional(),
      snoozedUntil: z.string().optional(),
      waitingOn: z.string().optional(),
      followUpAt: z.string().optional(),
    })
    .optional(),
  force: z.boolean().optional(),
  overrideReason: z.string().optional(),
});

itemsRouter.get("/items", async (req: Request, res: Response) => {
  const state = req.query.state as ItemState | undefined;
  console.log(`[ITEMS] GET /items state=${state ?? "undefined"}`);
  try {
    const list = await itemsService.listItems(state);
    const payload: Record<string, unknown> = { count: list.length };
    if (state === "INBOX") payload.ids = list.map((i) => i.id);
    console.log(`[ITEMS] listItems returned ${JSON.stringify(payload)}`);
    res.json(list);
  } catch (e) {
    console.error("[ITEMS] GET /items error", e instanceof Error ? e.message : String(e), e instanceof Error ? e.stack : "");
    res.status(500).json({ error: String(e) });
  }
});

itemsRouter.post("/items", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const titleLen = typeof body?.title === "string" ? body.title.length : 0;
  const source = typeof body?.source === "string" ? body.source : "";
  const attachmentsCount = Array.isArray(body?.attachments) ? body.attachments.length : 0;
  const bodyLen = typeof body?.body === "string" ? body.body.length : 0;
  console.log(`[ITEMS] POST /items received titleLen=${titleLen} source=${source} bodyLen=${bodyLen} attachments=${attachmentsCount}`);
  try {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log("[ITEMS] POST /items validation failed", JSON.stringify(parsed.error.flatten()));
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const d = parsed.data;
    console.log(`[ITEMS] POST /items validation passed title="${(d.title || "").slice(0, 50)}" source=${d.source ?? ""} attachments=${d.attachments?.length ?? 0}`);
    console.log(`[ITEMS] createItem called title="${(d.title || "").slice(0, 50)}" source=${d.source ?? ""}`);
    const item = await itemsService.createItem(parsed.data);
    console.log(`[ITEMS] createItem succeeded id=${item.id} title="${(item.title || "").slice(0, 50)}" state=${item.state}`);
    console.log(`[ITEMS] POST /items responding 201 id=${item.id}`);
    res.status(201).json(item);
  } catch (e) {
    console.error("[ITEMS] POST /items error", String(e), e instanceof Error ? e.stack : "");
    res.status(500).json({ error: String(e) });
  }
});

itemsRouter.get("/items/:id", async (req: Request, res: Response) => {
  try {
    const item = await itemsService.getItem(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

itemsRouter.patch("/items/:id", async (req: Request, res: Response) => {
  try {
    const parsed = patchItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const item = await itemsService.patchItem(req.params.id, parsed.data);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

itemsRouter.post("/items/:id/classify", async (req: Request, res: Response) => {
  try {
    const item = await itemsService.getItem(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    const { classifyItem } = await import("../ai/worker");
    const result = await classifyItem(item.title, item.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

itemsRouter.post("/items/:id/artifacts", async (req: Request, res: Response) => {
  try {
    const parsed = artifactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const artifact = await artifactsService.addArtifact(req.params.id, parsed.data);
    res.status(201).json(artifact);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

itemsRouter.post("/items/:id/reminders", async (req: Request, res: Response) => {
  try {
    const parsed = addReminderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const dueAt = new Date(parsed.data.dueAt);
    const reminder = await itemsService.addReminder(req.params.id, dueAt, parsed.data.kind ?? "follow_up");
    if (!reminder) return res.status(404).json({ error: "Not found" });
    res.status(201).json(reminder);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Canonical transition (Boss layer): all state changes go through here
itemsRouter.post("/items/:id/transition", async (req: Request, res: Response) => {
  try {
    const parsed = transitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const payload = parsed.data.proposed_changes ?? {};
    const result = await transitionService.executeTransition(
      req.params.id,
      parsed.data.target_state,
      payload,
      "user",
      { force: parsed.data.force, overrideReason: parsed.data.overrideReason }
    );
    if (!result.success) {
      const status = result.reason === "Item not found" ? 404 : 400;
      return res.status(status).json(result);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Disposition: next action (creates task, sets state) — delegates to transition service (Gate 1 + audit)
itemsRouter.post("/items/:id/disposition/next_action", async (req: Request, res: Response) => {
  try {
    const parsed = nextActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const result = await transitionService.executeTransition(
      req.params.id,
      "ACTIONABLE",
      {
        actionText: parsed.data.actionText,
        context: parsed.data.context,
        energy: parsed.data.energy,
        estimatedMinutes: parsed.data.estimatedMinutes,
        dueDate: parsed.data.dueDate,
      },
      "user"
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Disposition: project (creates project + next action task)
itemsRouter.post("/items/:id/disposition/project", async (req: Request, res: Response) => {
  try {
    const parsed = projectDispositionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const result = await itemsService.setDispositionProject(
      req.params.id,
      parsed.data.outcomeStatement,
      parsed.data.nextActionText,
      { dueDate: parsed.data.dueDate }
    );
    if (!result.success) return res.status(400).json({ reason: result.reason });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Create follow-up task from WAITING item (review flow)
itemsRouter.post("/items/:id/create-follow-up-task", async (req: Request, res: Response) => {
  try {
    const result = await itemsService.createFollowUpTaskFromWaiting(req.params.id);
    if (!result.success) {
      const status = result.reason === "Item not found" ? 404 : 400;
      return res.status(status).json({ error: result.reason });
    }
    res.status(201).json({ task: result.task, item: result.item });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
