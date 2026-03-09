/**
 * Parse Postmark inbound webhook payload and map to InboundEmailPayload.
 * Postmark sends JSON with Subject, TextBody, HtmlBody, Attachments (base64 Content).
 */

import { extractInboxToken, type InboundEmailPayload } from "./inbound-email.js";

export type PostmarkWebhookPayload = {
  From?: string;
  To?: string;
  OriginalRecipient?: string;
  ToFull?: Array<{ Email?: string; MailboxHash?: string }>;
  MailboxHash?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  Attachments?: Array<{
    Name?: string;
    Content?: string;
    ContentType?: string;
    ContentLength?: number;
  }>;
};

export type ParseResult = {
  payload: InboundEmailPayload;
  token: string | null;
};

/**
 * Parse Postmark inbound webhook body into InboundEmailPayload and extract user token.
 * Prefer MailboxHash when present; otherwise use extractInboxToken on recipient address.
 */
export function parsePostmarkPayload(body: Record<string, unknown>): ParseResult | null {
  const recipient =
    (typeof body.OriginalRecipient === "string" ? body.OriginalRecipient : null) ??
    (Array.isArray(body.ToFull) && body.ToFull[0] && typeof (body.ToFull[0] as { Email?: string }).Email === "string"
      ? (body.ToFull[0] as { Email: string }).Email
      : null) ??
    (typeof body.To === "string" ? body.To : null);

  if (!recipient || typeof recipient !== "string") {
    return null;
  }

  const token: string | null =
    (typeof body.MailboxHash === "string" && body.MailboxHash.trim() ? body.MailboxHash.trim() : null) ??
    extractInboxToken(recipient);

  const subject = typeof body.Subject === "string" ? body.Subject : "";
  const from = typeof body.From === "string" ? body.From : "";
  const text = typeof body.TextBody === "string" ? body.TextBody : undefined;
  const html = typeof body.HtmlBody === "string" ? body.HtmlBody : undefined;

  const attachments: Array<{ buffer: Buffer; filename: string; mimeType: string }> = [];
  const attList = body.Attachments;
  if (Array.isArray(attList)) {
    for (const att of attList) {
      const content = typeof (att as { Content?: string }).Content === "string" ? (att as { Content: string }).Content : "";
      if (!content) continue;
      try {
        const buffer = Buffer.from(content, "base64");
        const name = typeof (att as { Name?: string }).Name === "string" ? (att as { Name: string }).Name : "attachment";
        const contentType =
          typeof (att as { ContentType?: string }).ContentType === "string"
            ? (att as { ContentType: string }).ContentType
            : "application/octet-stream";
        attachments.push({
          buffer,
          filename: name,
          mimeType: contentType,
        });
      } catch {
        continue;
      }
    }
  }

  const payload: InboundEmailPayload = {
    to: recipient,
    from,
    subject: subject || "No subject",
    text,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  };

  return { payload, token };
}
