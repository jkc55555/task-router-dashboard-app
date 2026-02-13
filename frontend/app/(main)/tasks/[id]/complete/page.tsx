"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Task, type GateFailure } from "@/lib/api";

export default function TaskCompletePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [task, setTask] = useState<Task | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateFailure, setGateFailure] = useState<GateFailure | null>(null);
  const [forceConfirm, setForceConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.tasks
      .get(id)
      .then(setTask)
      .catch(() => setError("Task not found"));
  }, [id]);

  const handleAddDraft = async () => {
    if (!task || !draft.trim() || !task.itemId) return;
    setLoading(true);
    setError(null);
    setGateFailure(null);
    try {
      await api.items.addArtifact(task.itemId, {
        artifactType: "draft",
        content: draft.trim(),
      });
      setDraft("");
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft");
      setLoading(false);
    }
  };

  const handleComplete = async (force?: boolean) => {
    if (!task) return;
    setLoading(true);
    setError(null);
    setGateFailure(null);
    try {
      const result = await api.tasks.complete(id, force ? { force: true } : undefined);
      if (result.projectId && result.nextActionRequired) {
        router.push(`/projects/${result.projectId}?nextActionRequired=1`);
      } else {
        router.push("/");
      }
    } catch (e) {
      const err = e as Error & { gateFailure?: GateFailure };
      if (err.gateFailure) {
        setGateFailure(err.gateFailure);
        setError(err.message || "Completion blocked. Add evidence or edit and try again.");
      } else {
        setError(err.message || "Completion failed. Add a draft first.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (error && !task) {
    return (
      <div>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href="/" className="underline mt-2 inline-block">Back to Now</Link>
      </div>
    );
  }
  if (!task) return <p className="text-zinc-500">Loading...</p>;

  const hasItem = task.itemId != null;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        Complete: {task.actionText}
      </h1>
      {hasItem ? (
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
          Add evidence (draft, note, or decision) before marking done. The system will verify before allowing completion.
        </p>
      ) : (
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
          This is a project next action. Mark done when finished (no evidence required).
        </p>
      )}

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}

      {gateFailure && (
        <div className="mb-4 p-3 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Completion blocked</p>
          {gateFailure.failures?.length > 0 && (
            <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 mb-2">
              {gateFailure.failures.map((f, i) => (
                <li key={i}>{f.message}</li>
              ))}
            </ul>
          )}
          {gateFailure.suggested_questions && gateFailure.suggested_questions.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
              {gateFailure.suggested_questions.join(" ")}
            </p>
          )}
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Add evidence above, then click &quot;Mark done&quot; again, or edit the task and re-run the check.
          </p>
        </div>
      )}

      {hasItem && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Draft / note (evidence)
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste or type your draft, email, or decision..."
            className="w-full min-h-[120px] rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleAddDraft}
            disabled={loading || !draft.trim()}
            className="mt-2 rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm"
          >
            Save draft
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => handleComplete()}
        disabled={loading}
        className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        Mark done
      </button>
      {hasItem && (
        <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-sm">
          You must have at least one draft/artifact saved. Verifier will check before marking done.
        </p>
      )}

      <p className="mt-6">
        <Link href="/" className="text-zinc-600 dark:text-zinc-400 hover:underline">
          Back to Now
        </Link>
      </p>
    </div>
  );
}
