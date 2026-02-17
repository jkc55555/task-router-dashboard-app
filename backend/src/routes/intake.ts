import { Router, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { upload as storageUpload } from "../services/storage";
import { getStorageConfig } from "../lib/intake-config";
import * as itemsService from "../services/items";
import * as calendarImport from "../services/calendar-import";
import path from "path";
import fs from "fs/promises";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB
const uploadIcs = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

const intakeBodySchema = z.object({
  title: z.string().min(1).max(2000),
  body: z.string().optional(),
  source: z.string().optional(),
  attachments: z
    .array(
      z.object({
        type: z.enum(["file", "image"]).optional(),
        storageKey: z.string(),
        url: z.string(),
        filename: z.string(),
        mimeType: z.string().optional(),
        size: z.number().optional(),
      })
    )
    .optional(),
  externalId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const intakeRouter = Router();

/** Optional API key: if INTAKE_API_KEY is set, request must send it via Authorization: Bearer <key> or X-API-Key: <key>. */
function checkIntakeApiKey(req: Request, res: Response, next: () => void): void {
  const expected = process.env.INTAKE_API_KEY;
  if (!expected) {
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  const bearer = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const apiKey = bearer || (req.headers["x-api-key"] as string | undefined);
  if (apiKey !== expected) {
    res.status(401).json({ error: "Invalid or missing API key" });
    return;
  }
  next();
}

/** POST /intake - canonical intake: create inbox item (title, body?, source?, attachments?). */
intakeRouter.post("/intake", checkIntakeApiKey, async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const titlePreview = typeof body?.title === "string" ? body.title.slice(0, 50) : "";
  const source = typeof body?.source === "string" ? body.source : "";
  console.log(`[INTAKE] POST /intake received titlePreview="${titlePreview}" source=${source}`);
  try {
    const parsed = intakeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      console.log("[INTAKE] POST /intake validation failed", JSON.stringify(parsed.error.flatten()));
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const { title, body: bodyVal, source: src, attachments, externalId: _externalId, metadata: _metadata } = parsed.data;
    const normalizedTitle = title.trim() || "Untitled";
    console.log(`[INTAKE] POST /intake validation passed title="${normalizedTitle.slice(0, 50)}" source=${src ?? "intake"}`);
    const item = await itemsService.createItem({
      title: normalizedTitle,
      body: bodyVal?.trim(),
      source: src ?? "intake",
      attachments,
    });
    console.log(`[INTAKE] createItem succeeded id=${item.id}`);
    console.log(`[INTAKE] POST /intake responding 201 id=${item.id}`);
    res.status(201).json(item);
  } catch (e) {
    console.error("[INTAKE] POST /intake error", String(e), e instanceof Error ? e.stack : "");
    res.status(500).json({ error: String(e) });
  }
});

/** POST /intake/upload - multipart file(s), returns refs for use in POST /items or POST /intake */
intakeRouter.post("/intake/upload", upload.array("file", 10), async (req: Request, res: Response) => {
  try {
    const files = (req as unknown as { files?: Express.Multer.File[] }).files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    const uploads = await Promise.all(
      files.map((f) =>
        storageUpload({
          buffer: f.buffer,
          filename: f.originalname || "file",
          mimeType: f.mimetype || "application/octet-stream",
        })
      )
    );
    res.json({ uploads });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/** POST /intake/ics - multipart .ics file; imports into calendar and returns { sourceId, created, updated, total } */
intakeRouter.post("/intake/ics", uploadIcs.single("ics"), async (req: Request, res: Response) => {
  try {
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: "No .ics file uploaded" });
    }
    const name = (req.body?.name as string) || file.originalname || "Imported calendar";
    const icsContent = file.buffer.toString("utf-8");
    const result = await calendarImport.importIcsToSource(name, icsContent);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/** Serve local uploads - only when STORAGE_PROVIDER=local */
intakeRouter.get("/uploads/:key", async (req: Request, res: Response) => {
  try {
    const config = getStorageConfig();
    if (config.provider !== "local") {
      return res.status(404).json({ error: "Local uploads not enabled" });
    }
    const key = decodeURIComponent(req.params.key);
    if (key.includes("..") || key.includes("/")) {
      return res.status(400).json({ error: "Invalid key" });
    }
    const uploadDir = path.resolve(process.cwd(), config.localUploadDir);
    const filePath = path.join(uploadDir, key);
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});
