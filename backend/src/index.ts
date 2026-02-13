import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs/promises";
import { itemsRouter } from "./routes/items";
import { tasksRouter } from "./routes/tasks";
import { projectsRouter } from "./routes/projects";
import { deadlinesRouter } from "./routes/deadlines";
import { reviewsRouter } from "./routes/reviews";
import { intakeRouter } from "./routes/intake";
import { calendarsRouter } from "./routes/calendars";

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
  const { getStorageConfig } = await import("./lib/intake-config");
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
