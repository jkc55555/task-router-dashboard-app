"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Item } from "@/lib/api";

type GateFailureState = {
  reason: string;
  failures: Array<{ code: string; severity: string; message: string; fieldRef?: string }>;
  missing_inputs: string[];
  suggested_questions: string[];
};

function DispositionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const itemId = searchParams.get("itemId");
  const type = searchParams.get("type"); // next_action | project
  const [item, setItem] = useState<Item | null>(null);
  const [actionText, setActionText] = useState("");
  const [outcomeStatement, setOutcomeStatement] = useState("");
  const [nextActionText, setNextActionText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateFailure, setGateFailure] = useState<GateFailureState | null>(null);

  useEffect(() => {
    if (!itemId) return;
    api.items
      .get(itemId)
      .then((i) => {
        setItem(i);
        if (i.task?.actionText) setActionText(i.task.actionText);
      })
      .catch(() => setError("Item not found"));
  }, [itemId]);

  useEffect(() => {
    if (!itemId || type !== "next_action") return;
    try {
      const raw = sessionStorage.getItem(`gateFailure_${itemId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as GateFailureState;
        setGateFailure(parsed);
        sessionStorage.removeItem(`gateFailure_${itemId}`);
      }
    } catch (_) {}
  }, [itemId, type]);

  const handleNextAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !actionText.trim()) return;
    setLoading(true);
    setError(null);
    setGateFailure(null);
    try {
      const result = await api.items.dispositionNextAction(itemId, { actionText: actionText.trim() });
      if (result.success) {
        router.push("/inbox");
      } else {
        if (result.gate_failed === "valid_next_action") {
          setGateFailure({
            reason: result.reason ?? "Validation failed",
            failures: result.failures ?? [],
            missing_inputs: result.missing_inputs ?? [],
            suggested_questions: result.suggested_questions ?? [],
          });
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

  const handleProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !outcomeStatement.trim() || !nextActionText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.items.dispositionProject(itemId, {
        outcomeStatement: outcomeStatement.trim(),
        nextActionText: nextActionText.trim(),
        dueDate: dueDate || undefined,
      });
      if (result.createdAsClarifying && result.project) {
        router.push(`/projects/${result.project.id}?clarifying=1`);
      } else {
        router.push("/projects");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { reason?: string }).reason || "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (!itemId || !type) {
    return (
      <div>
        <p className="text-zinc-500">Missing item or type.</p>
        <Link href="/inbox" className="underline mt-2 inline-block">Back to Inbox</Link>
      </div>
    );
  }

  if (!item && !error) {
    return <p className="text-zinc-500">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        {type === "next_action" ? "Make Next Action" : "Make Project"}
      </h1>
      {item && (
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">Item: {item.title}</p>
      )}
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}

      {type === "next_action" && gateFailure && (
        <div className="mb-4 p-3 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Clarify your next action</p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">{gateFailure.reason}</p>
          {gateFailure.failures.length > 0 && (
            <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 mb-2">
              {gateFailure.failures.map((f, i) => (
                <li key={i}>{f.message}</li>
              ))}
            </ul>
          )}
          {gateFailure.suggested_questions.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Suggested: {gateFailure.suggested_questions.join(" · ")}
            </p>
          )}
        </div>
      )}

      {type === "next_action" && (
        <form onSubmit={handleNextAction}>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Next action (start with a verb, e.g. Email CPA asking what docs are needed)
          </label>
          <input
            type="text"
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            placeholder="e.g. Email CPA asking what docs are needed for 2025 filing"
            className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 mb-4"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {gateFailure ? "Re-run validation" : "Make Next Action"}
          </button>
        </form>
      )}

      {type === "project" && (
        <form onSubmit={handleProject}>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Outcome statement
          </label>
          <input
            type="text"
            value={outcomeStatement}
            onChange={(e) => setOutcomeStatement(e.target.value)}
            placeholder="e.g. Have working phone plans for Ireland trip"
            className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 mb-4"
            required
          />
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Next action (required)
          </label>
          <input
            type="text"
            value={nextActionText}
            onChange={(e) => setNextActionText(e.target.value)}
            placeholder="e.g. Compare Vodafone vs Three plans online"
            className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 mb-4"
            required
          />
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Due date (optional)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 mb-4"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Make Project
          </button>
        </form>
      )}

      <p className="mt-4">
        <Link href="/inbox" className="text-zinc-600 dark:text-zinc-400 hover:underline">
          Back to Inbox
        </Link>
      </p>
    </div>
  );
}

export default function DispositionPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading...</p>}>
      <DispositionContent />
    </Suspense>
  );
}
