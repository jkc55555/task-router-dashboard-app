import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs/promises";
import { itemsRouter } from "./routes/items.js";
import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { deadlinesRouter } from "./routes/deadlines.js";
import { reviewsRouter } from "./routes/reviews.js";
import { intakeRouter } from "./routes/intake.js";
import { calendarsRouter } from "./routes/calendars.js";

const app = express();
const PORT = process.env.PORT || 3001;

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
const origins = corsOrigin.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: origins.length === 1 ? origins[0] : origins,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

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
