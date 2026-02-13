"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  getAttachmentUrl,
  type Item,
  type ClassifyResult,
} from "@/lib/api";
import { DispositionButtons } from "@/components/DispositionButtons";

type Step =
  | null
  | "waiting_form"
  | "task_draft"
  | "task_fail"
  | "project_setup"
  | "project_fail"
  | "not_actionable";

type GateFailureState = {
  reason: string;
  failures: Array<{ code: string; severity: string; message: string; fieldRef?: string }>;
  missing_inputs: string[];
  suggested_questions: string[];
};

export default function ClarifyPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.itemId as string;
  const [item, setItem] = useState<Item | null>(null);
  const [classify, setClassify] = useState<ClassifyResult | null>(null);
  const [loadingClassify, setLoadingClassify] = useState(false);
  const [editBody, setEditBody] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [step, setStep] = useState<Step>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Waiting form
  const [waitingOn, setWaitingOn] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [waitingNotes, setWaitingNotes] = useState("");

  // Task draft
  const [actionText, setActionText] = useState("");
  const [context, setContext] = useState("");
  const [energy, setEnergy] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taskFail, setTaskFail] = useState<GateFailureState | null>(null);

  // Project setup
  const [outcomeStatement, setOutcomeStatement] = useState("");
  const [nextActionText, setNextActionText] = useState("");
  const [projectDueDate, setProjectDueDate] = useState("");
  const [focusThisWeek, setFocusThisWeek] = useState(false);
  const [projectFail, setProjectFail] = useState<string | null>(null);

  const fetchItem = useCallback(() => {
    if (!itemId) return;
    api.items
      .get(itemId)
      .then((i) => {
        setItem(i);
        setTitle(i.title);
        setBody(i.body ?? "");
      })
      .catch(() => setError("Item not found"));
  }, [itemId]);

  const fetchClassify = useCallback(() => {
    if (!itemId) return;
    setLoadingClassify(true);
    api.items
      .classify(itemId)
      .then((c) => {
        setClassify(c);
        if (c.proposedNextAction && !actionText) setActionText(c.proposedNextAction);
        if (c.projectOutcome && !outcomeStatement) setOutcomeStatement(c.projectOutcome);
        if (c.proposedNextAction && !nextActionText) setNextActionText(c.proposedNextAction);
        if (c.metadata?.context) setContext(c.metadata.context ?? "");
        if (c.metadata?.energy) setEnergy(c.metadata.energy ?? "");
        if (c.metadata?.timeEstimateMinutes != null)
          setEstimatedMinutes(String(c.metadata.timeEstimateMinutes));
      })
      .catch(() => setError("Classify failed"))
      .finally(() => setLoadingClassify(false));
  }, [itemId]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  useEffect(() => {
    if (itemId) fetchClassify();
  }, [itemId]);

  const handleSaveTitleBody = async () => {
    if (!itemId || !item) return;
    setLoading(true);
    try {
      await api.items.patch(itemId, { title: title.trim(), body: body.trim() });
      setItem((p) => (p ? { ...p, title: title.trim(), body: body.trim() } : null));
      setEditBody(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleNotActionable = async (disposition: "reference" | "someday" | "trash") => {
    if (!itemId) return;
    setLoading(true);
    setError(null);
    try {
      await api.items.patch(itemId, { disposition });
      router.push("/inbox");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleWaitingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !waitingOn.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.items.transition(itemId, {
        target_state: "WAITING",
        proposed_changes: {
          waitingOn: waitingOn.trim(),
          ...(followUpAt ? { followUpAt: new Date(followUpAt).toISOString() } : {}),
        },
      });
      router.push("/inbox");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set Waiting");
    } finally {
      setLoading(false);
    }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !actionText.trim()) return;
    setLoading(true);
    setError(null);
    setTaskFail(null);
    try {
      const result = await api.items.dispositionNextAction(itemId, {
        actionText: actionText.trim(),
        context: context || undefined,
        energy: energy || undefined,
        estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined,
        dueDate: dueDate || undefined,
      });
      if (result.success) {
        router.push("/inbox");
      } else {
        if (result.gate_failed === "valid_next_action") {
          setTaskFail({
            reason: result.reason ?? "Validation failed",
            failures: result.failures ?? [],
            missing_inputs: result.missing_inputs ?? [],
            suggested_questions: result.suggested_questions ?? [],
          });
          setStep("task_fail");
        } else {
          setError(result.reason ?? "Failed");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !outcomeStatement.trim() || !nextActionText.trim()) return;
    setLoading(true);
    setError(null);
    setProjectFail(null);
    try {
      const result = await api.items.dispositionProject(itemId, {
        outcomeStatement: outcomeStatement.trim(),
        nextActionText: nextActionText.trim(),
        dueDate: projectDueDate || undefined,
      });
      if (result.createdAsClarifying && result.project) {
        router.push(`/projects/${result.project.id}?clarifying=1`);
      } else {
        router.push("/projects");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { reason?: string }).reason ?? "Failed");
      setProjectFail(e instanceof Error ? e.message : "Failed");
      setStep("project_fail");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptSuggestion = async () => {
    if (!itemId || !classify) return;
    setLoading(true);
    setError(null);
    setTaskFail(null);
    setProjectFail(null);
    try {
      if (classify.suggestedType === "project" && classify.projectOutcome && classify.proposedNextAction) {
        const result = await api.items.dispositionProject(itemId, {
          outcomeStatement: classify.projectOutcome.trim(),
          nextActionText: classify.proposedNextAction.trim(),
        });
        if (result.createdAsClarifying && result.project) {
          router.push(`/projects/${result.project.id}?clarifying=1`);
          return;
        }
        router.push("/projects");
        return;
      }
      if (classify.proposedNextAction) {
        const result = await api.items.dispositionNextAction(itemId, {
          actionText: classify.proposedNextAction.trim(),
          context: classify.metadata?.context,
          energy: classify.metadata?.energy,
          estimatedMinutes: classify.metadata?.timeEstimateMinutes,
        });
        if (result.success) {
          router.push("/inbox");
          return;
        }
        if (result.gate_failed === "valid_next_action") {
          setTaskFail({
            reason: result.reason ?? "Validation failed",
            failures: result.failures ?? [],
            missing_inputs: result.missing_inputs ?? [],
            suggested_questions: result.suggested_questions ?? [],
          });
          setActionText(classify.proposedNextAction ?? "");
          setStep("task_fail");
        } else {
          setError(result.reason ?? "Failed");
        }
        return;
      }
      setStep("task_draft");
      setActionText(classify.proposedNextAction ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setError(msg);
      if (classify.suggestedType === "project") {
        setProjectFail(msg);
        setStep("project_fail");
        setOutcomeStatement(classify.projectOutcome ?? "");
        setNextActionText(classify.proposedNextAction ?? "");
      } else {
        setTaskFail({
          reason: msg,
          failures: [],
          missing_inputs: [],
          suggested_questions: [],
        });
        setActionText(classify.proposedNextAction ?? "");
        setStep("task_fail");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!itemId) {
    return (
      <div>
        <p className="text-zinc-500">Missing item.</p>
        <Link href="/inbox" className="underline mt-2 inline-block">Back to Inbox</Link>
      </div>
    );
  }

  if (error && !item) {
    return (
      <div>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href="/inbox" className="underline mt-2 inline-block">Back to Inbox</Link>
      </div>
    );
  }

  if (!item) return <p className="text-zinc-500">Loading...</p>;

  const showMain = step === null || step === "not_actionable";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Clarify</h1>
        <Link href="/inbox" className="text-zinc-600 dark:text-zinc-400 hover:underline text-sm">
          Back to Inbox
        </Link>
      </div>

      {/* Raw capture */}
      <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 mb-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Original capture</h2>
        <div className="mb-2">
          <label className="block text-xs text-zinc-500 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitleBody}
            className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-sm"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-zinc-500">Body</label>
            <button
              type="button"
              onClick={() => setEditBody(!editBody)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {editBody ? "Done" : "Edit original"}
            </button>
          </div>
          {editBody ? (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={handleSaveTitleBody}
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-sm min-h-[80px]"
            />
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {body || "—"}
            </p>
          )}
        </div>
        {item.attachments && item.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {item.attachments.map((a, i) => (
              <a
                key={i}
                href={getAttachmentUrl(a.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {a.filename}
              </a>
            ))}
          </div>
        )}
      </section>

      {/* AI suggestion card */}
      <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 mb-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">AI suggestion</h2>
        {loadingClassify ? (
          <p className="text-sm text-zinc-500">Classifying...</p>
        ) : classify ? (
          <div className="text-sm">
            <p className="text-zinc-700 dark:text-zinc-300">
              Suggested: <strong>{classify.suggestedType}</strong>
              {classify.projectOutcome && (
                <> · Outcome: {classify.projectOutcome}</>
              )}
              {classify.proposedNextAction && (
                <> · Next action: {classify.proposedNextAction}</>
              )}
            </p>
            {classify.proposedQuestions?.length > 0 && (
              <p className="mt-1 text-zinc-500">Questions: {classify.proposedQuestions.join(" ")}</p>
            )}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={fetchClassify}
                className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-xs"
              >
                Edit suggestion
              </button>
              {(classify.proposedNextAction || classify.projectOutcome) && (
                <button
                  type="button"
                  onClick={handleAcceptSuggestion}
                  className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-2 py-1 text-xs font-medium"
                >
                  Accept suggestion
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={fetchClassify}
            className="rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm"
          >
            Get AI suggestion
          </button>
        )}
      </section>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}

      {/* Primary: six disposition buttons — only when no sub-step */}
      {showMain && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">What is this?</h2>
          <DispositionButtons
            itemId={itemId}
            onNextAction={() => setStep("task_draft")}
            onProject={() => setStep("project_setup")}
            onWaiting={() => setStep("waiting_form")}
            onSomeday={() => handleNotActionable("someday")}
            onReference={() => handleNotActionable("reference")}
            onTrash={() => handleNotActionable("trash")}
            onEditSuggestion={fetchClassify}
          />
        </section>
      )}

      {/* STEP 2 — Waiting form */}
      {step === "waiting_form" && (
        <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 mb-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200 mb-3">Waiting on</h2>
          <form onSubmit={handleWaitingSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Waiting on (required)
              </label>
              <input
                type="text"
                value={waitingOn}
                onChange={(e) => setWaitingOn(e.target.value)}
                placeholder="e.g. John to send contract"
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Follow-up date (optional)
              </label>
              <input
                type="date"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={waitingNotes}
                onChange={(e) => setWaitingNotes(e.target.value)}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-sm min-h-[60px]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !waitingOn.trim()}
                className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Saving…" : "Set Waiting"}
              </button>
              <button
                type="button"
                onClick={() => setStep(null)}
                className="rounded border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
              >
                Back
              </button>
            </div>
          </form>
        </section>
      )}

      {/* STEP 4 — Task draft */}
      {(step === "task_draft" || step === "task_fail") && (
        <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 mb-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200 mb-3">Make Next Action</h2>
          {step === "task_fail" && taskFail && (
            <div className="mb-4 p-3 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                {taskFail.reason}
              </p>
              <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 mb-2">
                {taskFail.failures.map((f, i) => (
                  <li key={i}>{f.message}</li>
                ))}
              </ul>
              {taskFail.suggested_questions?.length > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {taskFail.suggested_questions.join(" · ")}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setStep("task_draft")}
                  className="rounded border border-amber-600 px-2 py-1 text-xs"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setStep("project_setup")}
                  className="rounded border border-amber-600 px-2 py-1 text-xs"
                >
                  Convert to Project
                </button>
                <button
                  type="button"
                  onClick={() => setStep("waiting_form")}
                  className="rounded border border-amber-600 px-2 py-1 text-xs"
                >
                  Set Waiting
                </button>
                <button
                  type="button"
                  onClick={() => handleNotActionable("someday")}
                  className="rounded border border-amber-600 px-2 py-1 text-xs"
                >
                  Someday
                </button>
                <button
                  type="button"
                  onClick={() => handleNotActionable("reference")}
                  className="rounded border border-amber-600 px-2 py-1 text-xs"
                >
                  Reference
                </button>
                <button
                  type="button"
                  onClick={() => handleNotActionable("trash")}
                  className="rounded border border-red-600 text-red-600 px-2 py-1 text-xs"
                >
                  Trash
                </button>
              </div>
            </div>
          )}
          <form onSubmit={handleTaskSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Action text (required)
              </label>
              <input
                type="text"
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="e.g. Email CPA asking for docs list"
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Context</label>
                <select
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">—</option>
                  <option value="calls">Calls</option>
                  <option value="errands">Errands</option>
                  <option value="computer">Computer</option>
                  <option value="deep_work">Deep Work</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Energy</label>
                <select
                  value={energy}
                  onChange={(e) => setEnergy(e.target.value)}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">—</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Estimate (min)</label>
                <input
                  type="number"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  className="w-24 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-green-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Saving…" : "Make Actionable"}
              </button>
              <button
                type="button"
                onClick={() => { setStep(null); setTaskFail(null); }}
                className="rounded border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
              >
                Back
              </button>
            </div>
          </form>
        </section>
      )}

      {/* STEP 5 — Project setup */}
      {(step === "project_setup" || step === "project_fail") && (
        <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 mb-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200 mb-3">Make Project</h2>
          {step === "project_fail" && projectFail && (
            <div className="mb-4 p-3 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                {projectFail}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStep("project_setup")}
                  className="rounded border border-amber-600 px-2 py-1 text-xs"
                >
                  Edit outcome
                </button>
                <button
                  type="button"
                  onClick={() => setStep("project_setup")}
                  className="rounded border border-amber-600 px-2 py-1 text-xs"
                >
                  Edit next action
                </button>
                <button
                  type="button"
                  onClick={() => setStep("task_draft")}
                  className="rounded border border-amber-600 px-2 py-1 text-xs"
                >
                  Convert to Task
                </button>
                <button
                  type="button"
                  onClick={() => handleNotActionable("someday")}
                  className="rounded border border-amber-600 px-2 py-1 text-xs"
                >
                  Someday
                </button>
                <button
                  type="button"
                  onClick={() => handleNotActionable("reference")}
                  className="rounded border border-amber-600 px-2 py-1 text-xs"
                >
                  Reference
                </button>
                <button
                  type="button"
                  onClick={() => handleNotActionable("trash")}
                  className="rounded border border-red-600 text-red-600 px-2 py-1 text-xs"
                >
                  Trash
                </button>
              </div>
            </div>
          )}
          <form onSubmit={handleProjectSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Outcome statement (required)
              </label>
              <input
                type="text"
                value={outcomeStatement}
                onChange={(e) => setOutcomeStatement(e.target.value)}
                placeholder="e.g. Have working phone plans for Ireland trip"
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Next action (required)
              </label>
              <input
                type="text"
                value={nextActionText}
                onChange={(e) => setNextActionText(e.target.value)}
                placeholder="e.g. Compare Vodafone vs Three plans online"
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
                required
              />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Due date</label>
                <input
                  type="date"
                  value={projectDueDate}
                  onChange={(e) => setProjectDueDate(e.target.value)}
                  className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={focusThisWeek}
                  onChange={(e) => setFocusThisWeek(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Focus this week</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Creating…" : "Create Project"}
              </button>
              <button
                type="button"
                onClick={() => { setStep(null); setProjectFail(null); }}
                className="rounded border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
              >
                Back
              </button>
            </div>
          </form>
        </section>
      )}

      <p className="mt-4 text-zinc-500 text-sm">
        <Link href="/inbox" className="hover:underline">Inbox</Link>
        {" · "}
        <Link href="/" className="hover:underline">Now</Link>
      </p>
    </div>
  );
}
