import OpenAI from "openai";

const verifierApiKey = process.env.VERIFIER_AI_API_KEY;
const verifierModel = process.env.VERIFIER_AI_MODEL || "gpt-4o-mini";
const openai = verifierApiKey ? new OpenAI({ apiKey: verifierApiKey }) : null;

export type VerifierOutput = {
  status: "PASS" | "FAIL" | "NEEDS_USER";
  failures: Array<{ code: string; severity: string; message: string; fieldRef?: string }>;
  missingInputs: string[];
  vaguenessFlags: string[];
  unverifiableClaims: string[];
};

const VERIFIER_NEXT_ACTION_SYSTEM = `You are an auditor. Evaluate whether the "next action" is valid.
Valid = starts with a verb (call, email, draft, buy, schedule, etc.), has a concrete object (person/file/place), doable in one sitting, no placeholders (TBD, figure out, work on, handle).
Return PASS only if all criteria are met. Return FAIL with specific reasons otherwise. Return NEEDS_USER if the user must provide missing info.`;

const VERIFIER_COMPLETION_SYSTEM = `You are an auditor. Evaluate whether a task can be marked DONE given the evidence provided.
Evidence might be: draft text, email draft (recipient + subject + body), decision note, or file/schedule reference.
Return PASS only if the evidence is sufficient to confirm the work was done. Return FAIL with reasons if evidence is missing or vague.`;

export async function verifyNextAction(actionText: string): Promise<VerifierOutput> {
  if (!openai) {
    return {
      status: "PASS",
      failures: [],
      missingInputs: [],
      vaguenessFlags: [],
      unverifiableClaims: [],
    };
  }

  const response = await openai.chat.completions.create({
    model: verifierModel,
    messages: [
      { role: "system", content: VERIFIER_NEXT_ACTION_SYSTEM },
      { role: "user", content: `Next action: "${actionText}"` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "verifier_output",
        strict: true,
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["PASS", "FAIL", "NEEDS_USER"] },
            failures: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  severity: { type: "string" },
                  message: { type: "string" },
                  fieldRef: { type: "string" },
                },
                required: ["code", "severity", "message"],
                additionalProperties: false,
              },
            },
            missingInputs: { type: "array", items: { type: "string" } },
            vaguenessFlags: { type: "array", items: { type: "string" } },
            unverifiableClaims: { type: "array", items: { type: "string" } },
          },
          required: ["status", "failures", "missingInputs", "vaguenessFlags", "unverifiableClaims"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty Verifier response");
  return JSON.parse(raw) as VerifierOutput;
}

export async function verifyCompletion(
  taskTitle: string,
  actionText: string,
  evidence: { artifactType: string; content?: string | null; filePointer?: string | null }
): Promise<VerifierOutput> {
  if (!openai) {
    const hasContent = !!(evidence.content?.trim() || evidence.filePointer);
    return {
      status: hasContent ? "PASS" : "FAIL",
      failures: hasContent ? [] : [{ code: "NO_EVIDENCE", severity: "high", message: "No draft artifact attached" }],
      missingInputs: [],
      vaguenessFlags: [],
      unverifiableClaims: [],
    };
  }

  const evidenceSummary = evidence.content
    ? `Content: ${evidence.content.slice(0, 1500)}${evidence.content.length > 1500 ? "..." : ""}`
    : evidence.filePointer
      ? `File/pointer: ${evidence.filePointer}`
      : "No content or file provided.";

  const response = await openai.chat.completions.create({
    model: verifierModel,
    messages: [
      { role: "system", content: VERIFIER_COMPLETION_SYSTEM },
      {
        role: "user",
        content: `Task: "${taskTitle}"\nAction: "${actionText}"\nEvidence type: ${evidence.artifactType}\n${evidenceSummary}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "verifier_output",
        strict: true,
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["PASS", "FAIL", "NEEDS_USER"] },
            failures: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  severity: { type: "string" },
                  message: { type: "string" },
                  fieldRef: { type: "string" },
                },
                required: ["code", "severity", "message"],
                additionalProperties: false,
              },
            },
            missingInputs: { type: "array", items: { type: "string" } },
            vaguenessFlags: { type: "array", items: { type: "string" } },
            unverifiableClaims: { type: "array", items: { type: "string" } },
          },
          required: ["status", "failures", "missingInputs", "vaguenessFlags", "unverifiableClaims"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty Verifier response");
  return JSON.parse(raw) as VerifierOutput;
}

const VERIFIER_PROJECT_OUTCOME_SYSTEM = `You are an auditor. Evaluate whether a project "outcome statement" is concrete and testable.
Valid = specific, measurable or verifiable result (e.g. "Have signed contract with vendor X", "Launch feature Y on staging").
Return PASS only if the outcome is clear enough to know when the project is done. Return FAIL for vague outcomes (e.g. "improve things", "get organized"). Return NEEDS_USER if the user must provide missing info.`;

export async function verifyProjectOutcome(outcomeStatement: string): Promise<VerifierOutput> {
  if (!openai) {
    return {
      status: "PASS",
      failures: [],
      missingInputs: [],
      vaguenessFlags: [],
      unverifiableClaims: [],
    };
  }

  const response = await openai.chat.completions.create({
    model: verifierModel,
    messages: [
      { role: "system", content: VERIFIER_PROJECT_OUTCOME_SYSTEM },
      { role: "user", content: `Outcome statement: "${outcomeStatement}"` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "verifier_output",
        strict: true,
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["PASS", "FAIL", "NEEDS_USER"] },
            failures: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  severity: { type: "string" },
                  message: { type: "string" },
                  fieldRef: { type: "string" },
                },
                required: ["code", "severity", "message"],
                additionalProperties: false,
              },
            },
            missingInputs: { type: "array", items: { type: "string" } },
            vaguenessFlags: { type: "array", items: { type: "string" } },
            unverifiableClaims: { type: "array", items: { type: "string" } },
          },
          required: ["status", "failures", "missingInputs", "vaguenessFlags", "unverifiableClaims"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawOutcome = response.choices[0]?.message?.content;
  if (!rawOutcome) throw new Error("Empty Verifier response");
  return JSON.parse(rawOutcome) as VerifierOutput;
}

export async function verifyProjectNextAction(
  outcomeStatement: string,
  nextActionText: string
): Promise<VerifierOutput> {
  if (!openai) {
    return { status: "PASS", failures: [], missingInputs: [], vaguenessFlags: [], unverifiableClaims: [] };
  }

  const response = await openai.chat.completions.create({
    model: verifierModel,
    messages: [
      { role: "system", content: VERIFIER_NEXT_ACTION_SYSTEM + "\nAlso check that the next action is a legitimate first step toward the outcome." },
      { role: "user", content: `Outcome: "${outcomeStatement}"\nNext action: "${nextActionText}"` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "verifier_output",
        strict: true,
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["PASS", "FAIL", "NEEDS_USER"] },
            failures: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  severity: { type: "string" },
                  message: { type: "string" },
                  fieldRef: { type: "string" },
                },
                required: ["code", "severity", "message"],
                additionalProperties: false,
              },
            },
            missingInputs: { type: "array", items: { type: "string" } },
            vaguenessFlags: { type: "array", items: { type: "string" } },
            unverifiableClaims: { type: "array", items: { type: "string" } },
          },
          required: ["status", "failures", "missingInputs", "vaguenessFlags", "unverifiableClaims"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawNA = response.choices[0]?.message?.content;
  if (!rawNA) throw new Error("Empty Verifier response");
  return JSON.parse(rawNA) as VerifierOutput;
}

export async function verifyProjectDone(
  outcomeStatement: string,
  remainingTaskCount: number
): Promise<VerifierOutput> {
  if (!openai) {
    return {
      status: remainingTaskCount === 0 ? "PASS" : "NEEDS_USER",
      failures: remainingTaskCount > 0 ? [{ code: "OPEN_TASKS", severity: "medium", message: `${remainingTaskCount} open task(s) remain` }] : [],
      missingInputs: [],
      vaguenessFlags: [],
      unverifiableClaims: [],
    };
  }

  const response = await openai.chat.completions.create({
    model: verifierModel,
    messages: [
      {
        role: "system",
        content: `You are an auditor. Evaluate whether a project can be marked DONE. Outcome: "${outcomeStatement}". Remaining open tasks: ${remainingTaskCount}. Return PASS if outcome is achieved and user can confirm. Return NEEDS_USER if open tasks should be resolved or acknowledged.`,
      },
      { role: "user", content: `Can this project be marked done? Open tasks: ${remainingTaskCount}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "verifier_output",
        strict: true,
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["PASS", "FAIL", "NEEDS_USER"] },
            failures: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  severity: { type: "string" },
                  message: { type: "string" },
                  fieldRef: { type: "string" },
                },
                required: ["code", "severity", "message"],
                additionalProperties: false,
              },
            },
            missingInputs: { type: "array", items: { type: "string" } },
            vaguenessFlags: { type: "array", items: { type: "string" } },
            unverifiableClaims: { type: "array", items: { type: "string" } },
          },
          required: ["status", "failures", "missingInputs", "vaguenessFlags", "unverifiableClaims"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawDone = response.choices[0]?.message?.content;
  if (!rawDone) throw new Error("Empty Verifier response");
  return JSON.parse(rawDone) as VerifierOutput;
}
