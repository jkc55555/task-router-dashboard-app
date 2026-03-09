/**
 * Parse inbound email webhook payloads (SendGrid Inbound Parse format) and create inbox items.
 * Abstracts provider-specific formats so Mailgun/Postmark adapters can be added later.
 */

import { upload as storageUpload } from "./storage.js";
import * as itemsService from "./items.js";

export type InboundEmailPayload = {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  envelope?: { to?: string[] };
  attachments?: Array<{ buffer: Buffer; filename: string; mimeType: string }>;
  spamScore?: number;
};

/** Extract token from address like inbox+TOKEN@domain.com. Returns null if no match. */
export function extractInboxToken(address: string): string | null {
  if (!address || typeof address !== "string") return null;
  const trimmed = address.trim().toLowerCase();
  const match = trimmed.match(/^inbox\+([a-zA-Z0-9_-]+)@/);
  return match ? match[1] : null;
}

/** Strip HTML tags to get plain text. Basic implementation. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Process inbound email: upload attachments, create inbox item.
 * Returns { success: true, itemId } or { success: false, reason }.
 */
export async function processInboundEmail(
  userId: string,
  payload: InboundEmailPayload
): Promise<{ success: true; itemId: string } | { success: false; reason: string }> {
  const title = (payload.subject || "").trim() || "No subject";
  const body = (payload.text || "").trim() || (payload.html ? stripHtml(payload.html) : "");
  const attachments: Array<{ type: "file" | "image"; storageKey: string; url: string; filename: string; mimeType?: string; size?: number }> = [];

  if (payload.attachments && payload.attachments.length > 0) {
    for (const att of payload.attachments) {
      try {
        const result = await storageUpload({
          buffer: att.buffer,
          filename: att.filename || "attachment",
          mimeType: att.mimeType || "application/octet-stream",
        });
        const isImage = /^image\//i.test(result.mimeType);
        attachments.push({
          type: isImage ? "image" : "file",
          storageKey: result.storageKey,
          url: result.url,
          filename: result.filename,
          mimeType: result.mimeType,
          size: att.buffer.length,
        });
      } catch (e) {
        console.error("[INBOUND_EMAIL] Failed to upload attachment", att.filename, e);
      }
    }
  }

  try {
    const item = await itemsService.createItem(userId, {
      title,
      body: body || undefined,
      source: "email",
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    return { success: true, itemId: item.id };
  } catch (e) {
    console.error("[INBOUND_EMAIL] createItem failed", e);
    return { success: false, reason: String(e) };
  }
}
