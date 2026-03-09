/**
 * Fetch email content and attachments from Resend API and create inbox items.
 * Resend webhooks send metadata only; we fetch full content via API.
 */

import { processInboundEmail } from "./inbound-email.js";

const RESEND_API = "https://api.resend.com";

export type ResendWebhookPayload = {
  type: "email.received";
  created_at: string;
  data: {
    email_id: string;
    created_at: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    message_id?: string;
    subject: string;
    attachments?: Array<{
      id: string;
      filename: string;
      content_type: string;
      content_disposition?: string;
      content_id?: string;
    }>;
  };
};

async function fetchReceivingEmail(apiKey: string, emailId: string): Promise<{
  html?: string;
  text?: string;
  from?: string;
  to?: string[];
  subject?: string;
}> {
  const res = await fetch(`${RESEND_API}/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API get email failed: ${res.status} ${err}`);
  }
  return res.json() as Promise<{
    html?: string;
    text?: string;
    from?: string;
    to?: string[];
    subject?: string;
  }>;
}

async function listReceivingAttachments(
  apiKey: string,
  emailId: string
): Promise<Array<{ id: string; filename?: string; content_type: string; download_url: string }>> {
  const res = await fetch(`${RESEND_API}/emails/receiving/${emailId}/attachments`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API list attachments failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { data?: Array<{ id: string; filename?: string; content_type?: string; download_url: string }> };
  const list = data.data ?? [];
  return list.map((a) => ({
    id: a.id,
    filename: a.filename ?? "attachment",
    content_type: a.content_type ?? "application/octet-stream",
    download_url: a.download_url,
  }));
}

async function downloadAttachment(downloadUrl: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Failed to download attachment: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentDisposition = res.headers.get("content-disposition");
  let filename = "attachment";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
    if (match) filename = match[1].trim();
  }
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  return { buffer, filename, mimeType };
}

/**
 * Process Resend email.received webhook: fetch content + attachments, create inbox item.
 */
export async function processResendInbound(
  userId: string,
  apiKey: string,
  payload: ResendWebhookPayload
): Promise<{ success: true; itemId: string } | { success: false; reason: string }> {
  const { email_id, to, subject } = payload.data;
  const recipient = Array.isArray(to) && to.length > 0 ? to[0] : "";
  if (!recipient || typeof recipient !== "string") {
    return { success: false, reason: "No recipient in payload" };
  }

  const emailData = await fetchReceivingEmail(apiKey, email_id);
  const text = emailData.text ?? "";
  const html = emailData.html ?? "";
  const title = (subject ?? emailData.subject ?? "").trim() || "No subject";

  const attachments: Array<{ buffer: Buffer; filename: string; mimeType: string }> = [];
  const attList = await listReceivingAttachments(apiKey, email_id);
  for (const att of attList) {
    try {
      const downloaded = await downloadAttachment(att.download_url);
      attachments.push({
        buffer: downloaded.buffer,
        filename: downloaded.filename || att.filename || "attachment",
        mimeType: downloaded.mimeType || att.content_type || "application/octet-stream",
      });
    } catch (e) {
      console.error("[RESEND_INBOUND] Failed to download attachment", att.filename, e);
    }
  }

  return processInboundEmail(userId, {
    to: recipient,
    from: payload.data.from ?? "",
    subject: title || "No subject",
    text: text || undefined,
    html: html || undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}
