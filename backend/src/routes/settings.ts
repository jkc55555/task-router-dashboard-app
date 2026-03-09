import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getInboundEmailConfig } from "../lib/intake-config.js";

export const settingsRouter = Router();

const patchInboxEmailSchema = z.object({
  enabled: z.boolean(),
});

function generateInboxToken(): string {
  return crypto.randomBytes(8).toString("base64url");
}

/** GET /settings/inbox-email - Return inbox email settings and address when enabled */
settingsRouter.get("/inbox-email", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as { userId: string }).userId;
    const config = getInboundEmailConfig();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { inboxEmailToken: true, inboxEmailEnabled: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const enabled = user.inboxEmailEnabled ?? false;
    const token = user.inboxEmailToken;
    const postmarkMailboxConfigured = config.provider === "postmark" && !!config.postmarkMailbox;
    let address: string | null = null;
    if (config.enabled && config.parseDomain && enabled && token) {
      if (config.provider === "postmark" && config.postmarkMailbox) {
        address = `${config.postmarkMailbox}+${token}@${config.parseDomain}`;
      } else if (config.provider !== "postmark") {
        address = `inbox+${token}@${config.parseDomain}`;
      }
      // Postmark without mailbox: address stays null (inbox+token does not work for Postmark)
    }
    return res.json({ enabled, address, parseDomainConfigured: !!config.parseDomain, postmarkMailboxConfigured });
  } catch (e) {
    console.error("[SETTINGS] GET inbox-email error", e);
    return res.status(500).json({ error: "Failed to load inbox email settings" });
  }
});

/** PATCH /settings/inbox-email - Enable or disable email-to-inbox */
settingsRouter.patch("/inbox-email", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = patchInboxEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const userId = (req.session as { userId: string }).userId;
    const { enabled } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { inboxEmailToken: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let token = user.inboxEmailToken;
    if (enabled && !token) {
      do {
        token = generateInboxToken();
      } while (await prisma.user.findUnique({ where: { inboxEmailToken: token } }));
    }

    const updateData: { inboxEmailEnabled: boolean; inboxEmailToken?: string | null } = {
      inboxEmailEnabled: enabled,
    };
    if (enabled && token) {
      updateData.inboxEmailToken = token;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const config = getInboundEmailConfig();
    const postmarkMailboxConfigured = config.provider === "postmark" && !!config.postmarkMailbox;
    let address: string | null = null;
    if (config.enabled && config.parseDomain && updated.inboxEmailEnabled && updated.inboxEmailToken) {
      if (config.provider === "postmark" && config.postmarkMailbox) {
        address = `${config.postmarkMailbox}+${updated.inboxEmailToken}@${config.parseDomain}`;
      } else if (config.provider !== "postmark") {
        address = `inbox+${updated.inboxEmailToken}@${config.parseDomain}`;
      }
    }
    return res.json({ enabled: updated.inboxEmailEnabled, address, postmarkMailboxConfigured });
  } catch (e) {
    console.error("[SETTINGS] PATCH inbox-email error", e);
    return res.status(500).json({ error: "Failed to update inbox email settings" });
  }
});
