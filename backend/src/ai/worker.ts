import OpenAI from "openai";

const workerApiKey = process.env.WORKER_AI_API_KEY;
const workerModel = process.env.WORKER_AI_MODEL || "gpt-4o-mini";
const openai = workerApiKey ? new OpenAI({ apiKey: workerApiKey }) : null;

export type WorkerOutput = {
  suggestedType: "task" | "project" | "reference" | "waiting" | "someday" | "unclear";
  suggestedState: string;
  proposedTitle: string;
  proposedNextAction: string | null;
  proposedQuestions: string[];
  projectOutcome: string | null;
  subtasks: string[];
  metadata: {
    timeEstimateMinutes?: number;
    context?: "calls" | "errands" | "computer" | "deep_work";
    energy?: "low" | "medium" | "high";
  };
};

const WORKER_SYSTEM = `You are a GTD-style assistant. Classify the user's capture into one of: task (single next action), project (multiple steps + outcome), reference (info only), waiting (blocked by others), someday (maybe later), or unclear (need more info).
For tasks: propose a single, concrete next action that starts with a verb and has a specific object (e.g. "Email CPA asking what docs are needed for 2025 filing").
For projects: propose an outcome statement and one next action. Never use placeholders like "TBD", "figure out", "work on", "handle".
If unclear, ask 1-3 short, targeted questions.`;

export async function classifyItem(title: string, body: string): Promise<WorkerOutput> {
  if (!openai) {
    return {
      suggestedType: "task",
      suggestedState: "INBOX",
      proposedTitle: title || "Untitled",
      proposedNextAction: null,
      proposedQuestions: [],
      projectOutcome: null,
      subtasks: [],
      metadata: {},
    };
  }

  const response = await openai.chat.completions.create({
    model: workerModel,
    messages: [
      { role: "system", content: WORKER_SYSTEM },
      { role: "user", content: `Title: ${title}\n\nBody:\n${body || "(none)"}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "worker_output",
        strict: true,
        schema: {
          type: "object",
          properties: {
            suggestedType: {
              type: "string",
              enum: ["task", "project", "reference", "waiting", "someday", "unclear"],
            },
            suggestedState: { type: "string" },
            proposedTitle: { type: "string" },
            proposedNextAction: { type: ["string", "null"] },
            proposedQuestions: { type: "array", items: { type: "string" }, maxItems: 3 },
            projectOutcome: { type: ["string", "null"] },
            subtasks: { type: "array", items: { type: "string" } },
            metadata: {
              type: "object",
              properties: {
                timeEstimateMinutes: { type: "number" },
                context: { type: "string", enum: ["calls", "errands", "computer", "deep_work"] },
                energy: { type: "string", enum: ["low", "medium", "high"] },
              },
              additionalProperties: false,
            },
          },
          required: [
            "suggestedType",
            "suggestedState",
            "proposedTitle",
            "proposedNextAction",
            "proposedQuestions",
            "projectOutcome",
            "subtasks",
            "metadata",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty AI response");
  const parsed = JSON.parse(raw) as WorkerOutput;
  return parsed;
}
