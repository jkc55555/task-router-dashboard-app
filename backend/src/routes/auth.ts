import { Router, Request, Response } from "express";
import { z } from "zod";
import argon2 from "argon2";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts, try again later" },
  standardHeaders: true,
});

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  name: z.string().max(255).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

const patchMeSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  name: z.string().max(255).optional(),
});

function sanitizeUser(u: { id: string; email: string; name: string | null; theme: string | null }) {
  return { id: u.id, email: u.email, name: u.name ?? null, theme: u.theme ?? null };
}

authRouter.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const { email, password, name } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash, name: name?.trim() || null },
    });
    (req.session as { userId?: string }).userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (e) {
    console.error("[AUTH] register error", e);
    return res.status(500).json({ error: "Registration failed" });
  }
});

authRouter.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body" });
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    (req.session as { userId?: string }).userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    return res.json({ user: sanitizeUser(user) });
  } catch (e) {
    console.error("[AUTH] login error", e);
    return res.status(500).json({ error: "Login failed" });
  }
});

authRouter.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("[AUTH] logout error", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("sid", { httpOnly: true, path: "/", sameSite: "lax" });
    return res.status(204).send();
  });
});

authRouter.get("/me", (req: Request, res: Response) => {
  const userId = (req.session as undefined | { userId?: string })?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  prisma.user
    .findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, theme: true },
    })
    .then((user) => {
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      return res.json({ user: sanitizeUser(user) });
    })
    .catch((e) => {
      console.error("[AUTH] me error", e);
      return res.status(500).json({ error: "Failed to load user" });
    });
});

authRouter.post("/change-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const userId = (req.session as { userId: string }).userId;
    const { currentPassword, newPassword } = parsed.data;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    const passwordHash = await argon2.hash(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[AUTH] change-password error", e);
    return res.status(500).json({ error: "Password change failed" });
  }
});

authRouter.patch("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = patchMeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const userId = (req.session as { userId: string }).userId;
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(parsed.data.theme != null && { theme: parsed.data.theme }),
        ...(parsed.data.name !== undefined && { name: parsed.data.name || null }),
      },
    });
    return res.json({ user: sanitizeUser(user) });
  } catch (e) {
    console.error("[AUTH] patch me error", e);
    return res.status(500).json({ error: "Update failed" });
  }
});
