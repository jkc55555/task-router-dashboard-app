import "dotenv/config";
import { createRequire } from "module";
import path from "path";
import fs from "fs/promises";
import express from "express";
import cors from "cors";
import session from "express-session";
import { Pool } from "pg";
import { itemsRouter } from "./routes/items.js";
import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { deadlinesRouter } from "./routes/deadlines.js";
import { reviewsRouter } from "./routes/reviews.js";
import { intakeRouter } from "./routes/intake.js";
import { calendarsRouter } from "./routes/calendars.js";
import { authRouter } from "./routes/auth.js";
import { requireAuth } from "./middleware/requireAuth.js";

const require = createRequire(import.meta.url);
const ConnectPgSimple = require("connect-pg-simple")(session);

const app = express();
const PORT = process.env.PORT || 3001;

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
const origins = corsOrigin.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: origins.length === 1 ? origins[0] : origins,
    optionsSuccessStatus: 200,
    credentials: true,
  })
);
app.use(express.json());

const sessionSecret = process.env.SESSION_SECRET || "dev-secret-change-in-production";
const sessionStore =
  process.env.DATABASE_URL
    ? new ConnectPgSimple({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
        tableName: "session",
      })
    : undefined;

app.use(
  session({
    store: sessionStore,
    secret: sessionSecret,
    name: "sid",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  const pathWithQuery = req.originalUrl || req.url || req.path;
  const method = req.method;
  let bodySummary = "";
  if (["POST", "PUT", "PATCH"].includes(method) && req.body && typeof req.body === "object") {
    const b = req.body as Record<string, unknown>;
    const title = typeof b.title === "string" ? b.title : "";
    const source = typeof b.source === "string" ? b.source : "";
    const bodyLen = typeof b.body === "string" ? b.body.length : 0;
    const attachments = Array.isArray(b.attachments) ? b.attachments.length : 0;
    bodySummary = ` bodySummary: titleLen=${title.length} source=${source || "(none)"} bodyLen=${bodyLen} attachments=${attachments}`;
  }
  console.log(`${ts} ${method} ${pathWithQuery}${bodySummary}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

app.use("/auth", authRouter);
app.use(requireAuth);
app.use(itemsRouter);
app.use(intakeRouter);
app.use("/tasks", tasksRouter);
app.use("/projects", projectsRouter);
app.use("/deadlines", deadlinesRouter);
app.use("/reviews", reviewsRouter);
app.use("/calendars", calendarsRouter);

async function ensureUploadDir() {
  const { getStorageConfig } = await import("./lib/intake-config.js");
  const config = getStorageConfig();
  if (config.provider === "local") {
    const dir = path.resolve(process.cwd(), config.localUploadDir);
    await fs.mkdir(dir, { recursive: true });
  }
}

ensureUploadDir()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to ensure upload dir:", err);
    process.exit(1);
  });
