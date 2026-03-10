/**
 * Parse Postmark inbound webhook payload and map to InboundEmailPayload.
 * Postmark sends JSON with Subject, TextBody, HtmlBody, Attachments (base64 Content).
 */

import { extractInboxToken, extractTokenFromPlusAddress, type InboundEmailPayload } from "./inbound-email.js";

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

/** Extract bare email from "Name" <email@domain> or return as-is if no angle brackets. */
function extractEmailFromRecipient(s: string): string {
  const trimmed = s.trim();
  const angleStart = trimmed.indexOf("<");
  const angleEnd = trimmed.indexOf(">");
  if (angleStart >= 0 && angleEnd > angleStart) {
    return trimmed.slice(angleStart + 1, angleEnd).trim();
  }
  return trimmed;
}

/**
 * Parse Postmark inbound webhook body into InboundEmailPayload and extract user token.
 * Per Postmark docs: prefer ToFull[0].Email and ToFull[0].MailboxHash; fall back to OriginalRecipient/To and top-level MailboxHash.
 * See https://postmarkapp.com/developer/user-guide/inbound/parse-an-email
 */
export function parsePostmarkPayload(body: Record<string, unknown>): ParseResult | null {
  const toFull0 = Array.isArray(body.ToFull) && body.ToFull[0] ? (body.ToFull[0] as { Email?: string; MailboxHash?: string }) : null;
  const rawRecipient =
    (toFull0 && typeof toFull0.Email === "string" ? toFull0.Email : null) ??
    (typeof body.OriginalRecipient === "string" ? body.OriginalRecipient : null) ??
    (typeof body.To === "string" ? body.To : null);

  if (!rawRecipient || typeof rawRecipient !== "string") {
    return null;
  }

  const recipient = extractEmailFromRecipient(rawRecipient);
  if (!recipient || !recipient.includes("@")) {
    return null;
  }

  const recipientSource = toFull0?.Email ? "ToFull[0].Email" : typeof body.OriginalRecipient === "string" ? "OriginalRecipient" : "To";
  console.log("[WEBHOOK] postmark parse: recipient from", recipientSource, "recipient=", recipient);

  const mailboxHash =
    (toFull0 && typeof toFull0.MailboxHash === "string" && toFull0.MailboxHash.trim() ? toFull0.MailboxHash.trim() : null) ??
    (typeof body.MailboxHash === "string" && body.MailboxHash.trim() ? body.MailboxHash.trim() : null);
  const inboxToken = extractInboxToken(recipient);
  const plusToken = extractTokenFromPlusAddress(recipient);
  const token: string | null = mailboxHash ?? inboxToken ?? plusToken;

  const tokenSource = mailboxHash ? "MailboxHash" : inboxToken ? "extractInboxToken" : plusToken ? "extractTokenFromPlusAddress" : "none";
  console.log("[WEBHOOK] postmark parse: token from", tokenSource, "token=", token ? "(present)" : "null");

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
