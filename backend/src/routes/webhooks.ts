import { Router, Request, Response } from "express";
import multer from "multer";
import { Resend } from "resend";
import { prisma } from "../lib/prisma.js";
import { getInboundEmailConfig } from "../lib/intake-config.js";
import {
  processInboundEmail,
  extractInboxToken,
  type InboundEmailPayload,
} from "../services/inbound-email.js";
import { processResendInbound, type ResendWebhookPayload } from "../services/resend-inbound.js";
import { parsePostmarkPayload } from "../services/postmark-inbound.js";

export const webhooksRouter = Router();

/** Multer for multipart/form-data - 20MB per file, accept any field name for attachments */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
}).any();

function verifyWebhookSecret(req: Request): boolean {
  const secret = getInboundEmailConfig().webhookSecret;
  if (!secret) return true;
  const authHeader = req.headers.authorization;
  const bearer = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const headerSecret = bearer || (req.headers["x-webhook-secret"] as string | undefined);
  return headerSecret === secret;
}

/**
 * Parse SendGrid Inbound Parse multipart payload into InboundEmailPayload.
 * SendGrid sends: to, from, subject, text, html, envelope (JSON), attachment1..N (files)
 */
function parseSendGridPayload(
  body: Record<string, unknown>,
  files: Express.Multer.File[]
): InboundEmailPayload | null {
  let to = "";
  if (typeof body.to === "string") {
    to = body.to;
  } else if (body.envelope && typeof body.envelope === "object") {
    const env = body.envelope as { to?: string[] };
    if (Array.isArray(env.to) && env.to.length > 0 && typeof env.to[0] === "string") {
      to = env.to[0];
    }
  }
  if (!to) return null;

  const subject = typeof body.subject === "string" ? body.subject : "";
  const from = typeof body.from === "string" ? body.from : "";
  const text = typeof body.text === "string" ? body.text : undefined;
  const html = typeof body.html === "string" ? body.html : undefined;

  let envelope: { to?: string[] } | undefined;
  if (body.envelope && typeof body.envelope === "object") {
    const env = body.envelope as { to?: string[] };
    if (Array.isArray(env.to)) envelope = env;
  }

  let spamScore: number | undefined;
  if (typeof body.spam_score === "number") spamScore = body.spam_score;
  else if (typeof body.spam_score === "string") spamScore = parseFloat(body.spam_score);

  const attachments = files.map((f) => ({
    buffer: f.buffer,
    filename: f.originalname || "attachment",
    mimeType: f.mimetype || "application/octet-stream",
  }));

  return {
    to,
    from,
    subject,
    text,
    html,
    envelope,
    attachments: attachments.length > 0 ? attachments : undefined,
    spamScore,
  };
}

/** POST /webhooks/inbound-email - Receive parsed email from SendGrid Inbound Parse (or compatible) */
webhooksRouter.post(
  "/inbound-email",
  (req: Request, res: Response, next) => {
    upload(req, res, (err) => {
      if (err) {
        console.error("[WEBHOOK] inbound-email multer error", err);
        return res.status(400).json({ error: "Invalid multipart body" });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const config = getInboundEmailConfig();
      if (!config.enabled || config.provider === "resend" || config.provider === "postmark") {
        return res.status(404).json({ error: "Inbound email not enabled" });
      }

      if (!verifyWebhookSecret(req)) {
        return res.status(401).json({ error: "Invalid webhook secret" });
      }

      const body = req.body as Record<string, unknown>;
      const files = (req as { files?: Express.Multer.File[] }).files ?? [];

      const payload = parseSendGridPayload(body, files);
      if (!payload) {
        console.log("[WEBHOOK] inbound-email: no valid 'to' address in payload");
        return res.status(200).send();
      }

      const token = extractInboxToken(payload.to);
      if (!token) {
        console.log("[WEBHOOK] inbound-email: address does not match inbox+token format", payload.to);
        return res.status(200).send();
      }

      const user = await prisma.user.findFirst({
        where: { inboxEmailToken: token, inboxEmailEnabled: true },
        select: { id: true },
      });
      if (!user) {
        console.log("[WEBHOOK] inbound-email: no user found for token");
        return res.status(200).send();
      }

      const result = await processInboundEmail(user.id, payload);
      if (!result.success) {
        console.error("[WEBHOOK] inbound-email processInboundEmail failed", result.reason);
        return res.status(500).json({ error: "Failed to create inbox item" });
      }

      console.log("[WEBHOOK] inbound-email created item", result.itemId, "for user", user.id);
      return res.status(200).json({ ok: true, itemId: result.itemId });
    } catch (e) {
      console.error("[WEBHOOK] inbound-email error", e);
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

/** POST /webhooks/resend - Resend email.received webhook (JSON, Svix-signed) */
webhooksRouter.post("/resend", async (req: Request, res: Response) => {
  try {
    const config = getInboundEmailConfig();
    if (!config.enabled || config.provider !== "resend") {
      return res.status(404).json({ error: "Resend inbound not enabled" });
    }
    if (!config.resendApiKey || !config.resendWebhookSecret) {
      return res.status(500).json({ error: "Resend not configured" });
    }

    const rawBody = (req as { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      return res.status(400).json({ error: "Raw body required for verification" });
    }

    const resend = new Resend(config.resendApiKey);
    let payload: ResendWebhookPayload;
    try {
      payload = resend.webhooks.verify({
        payload: rawBody.toString("utf8"),
        headers: {
          id: (req.headers["svix-id"] as string) ?? "",
          timestamp: (req.headers["svix-timestamp"] as string) ?? "",
          signature: (req.headers["svix-signature"] as string) ?? "",
        },
        webhookSecret: config.resendWebhookSecret,
      }) as ResendWebhookPayload;
    } catch (e) {
      console.error("[WEBHOOK] resend verify failed", e);
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    if (payload.type !== "email.received") {
      return res.status(200).json({ ok: true, ignored: payload.type });
    }

    const toList = payload.data.to;
    const recipient = Array.isArray(toList) && toList.length > 0 ? toList[0] : "";
    if (!recipient || typeof recipient !== "string") {
      console.log("[WEBHOOK] resend: no recipient");
      return res.status(200).send();
    }

    const token = extractInboxToken(recipient);
    if (!token) {
      console.log("[WEBHOOK] resend: address does not match inbox+token format", recipient);
      return res.status(200).send();
    }

    const user = await prisma.user.findFirst({
      where: { inboxEmailToken: token, inboxEmailEnabled: true },
      select: { id: true },
    });
    if (!user) {
      console.log("[WEBHOOK] resend: no user found for token");
      return res.status(200).send();
    }

    const result = await processResendInbound(user.id, config.resendApiKey, payload);
    if (!result.success) {
      console.error("[WEBHOOK] resend processResendInbound failed", result.reason);
      return res.status(500).json({ error: "Failed to create inbox item" });
    }

    console.log("[WEBHOOK] resend created item", result.itemId, "for user", user.id);
    return res.status(200).json({ ok: true, itemId: result.itemId });
  } catch (e) {
    console.error("[WEBHOOK] resend error", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

/** POST /webhooks/postmark - Postmark inbound webhook (JSON, body + attachments inline) */
webhooksRouter.post("/postmark", async (req: Request, res: Response) => {
  try {
    const config = getInboundEmailConfig();
    if (!config.enabled || config.provider !== "postmark") {
      return res.status(404).json({ error: "Postmark inbound not enabled" });
    }

    if (!verifyWebhookSecret(req)) {
      return res.status(401).json({ error: "Invalid webhook secret" });
    }

    const body = req.body as Record<string, unknown>;
    const parsed = parsePostmarkPayload(body);
    if (!parsed) {
      console.log("[WEBHOOK] postmark: no valid recipient in payload");
      return res.status(200).send();
    }

    const { payload, token } = parsed;
    if (!token) {
      console.log("[WEBHOOK] postmark: no token (MailboxHash or inbox+token format)", payload.to);
      return res.status(200).send();
    }

    const user = await prisma.user.findFirst({
      where: { inboxEmailToken: token, inboxEmailEnabled: true },
      select: { id: true },
    });
    if (!user) {
      console.log("[WEBHOOK] postmark: no user found for token");
      return res.status(200).send();
    }

    const result = await processInboundEmail(user.id, payload);
    if (!result.success) {
      console.error("[WEBHOOK] postmark processInboundEmail failed", result.reason);
      return res.status(500).json({ error: "Failed to create inbox item" });
    }

    console.log("[WEBHOOK] postmark created item", result.itemId, "for user", user.id);
    return res.status(200).json({ ok: true, itemId: result.itemId });
  } catch (e) {
    console.error("[WEBHOOK] postmark error", e);
    return res.status(500).json({ error: "Internal error" });
  }
});
