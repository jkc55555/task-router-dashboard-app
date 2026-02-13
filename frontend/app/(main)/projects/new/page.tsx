"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type ProjectStatus } from "@/lib/api";

const STATUSES: ProjectStatus[] = ["CLARIFYING", "ACTIVE", "WAITING", "SOMEDAY", "ON_HOLD", "DONE", "ARCHIVED"];

export default function NewProjectPage() {
  const router = useRouter();
  const [outcomeStatement, setOutcomeStatement] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("CLARIFYING");
  const [nextActionText, setNextActionText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<number>(1);
  const [themeTag, setThemeTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const outcome = outcomeStatement.trim();
    const nextAction = nextActionText.trim();
    if (status === "ACTIVE" && (!outcome || outcome.length < 10)) {
      setError("Outcome statement (at least 10 characters) is required for ACTIVE.");
      return;
    }
    if (status === "ACTIVE" && !nextAction) {
      setError("Next action is required for ACTIVE.");
      return;
    }
    if (status === "CLARIFYING" && !outcome && !nextAction) {
      setError("Add at least an outcome or a next action.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const project = await api.projects.create({
        outcomeStatement: outcome || undefined,
        status,
        nextActionText: nextAction || undefined,
        dueDate: dueDate || undefined,
        priority,
        themeTag: themeTag.trim() || undefined,
      });
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        New project
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-4">
        Create a project first. You can assign an inbox item to it from the project page.
      </p>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label htmlFor="outcome" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Outcome {status === "ACTIVE" ? "(required, min 10 chars)" : "(optional for Clarifying)"}
          </label>
          <textarea
            id="outcome"
            value={outcomeStatement}
            onChange={(e) => setOutcomeStatement(e.target.value)}
            placeholder="Short description of done, e.g. Have working phone plans for Ireland trip"
            className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
            rows={2}
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
        {(status === "ACTIVE" || status === "CLARIFYING") && (
          <div>
            <label htmlFor="nextAction" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Next action {status === "ACTIVE" ? "(required)" : "(optional)"}
            </label>
            <input
              id="nextAction"
              type="text"
              value={nextActionText}
              onChange={(e) => setNextActionText(e.target.value)}
              placeholder="Concrete, doable next step (verb first: call, email, draft…)"
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
            />
          </div>
        )}
        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Due date
          </label>
          <input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Priority (0=Low, 1=Normal, 2=High, 3=Critical)
          </label>
          <input
            id="priority"
            type="number"
            min={0}
            max={3}
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
            className="w-24 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="themeTag" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Theme tag
          </label>
          <input
            id="themeTag"
            type="text"
            value={themeTag}
            onChange={(e) => setThemeTag(e.target.value)}
            placeholder="e.g. Ireland, cashflow"
            className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || (status === "CLARIFYING" && !outcomeStatement.trim() && !nextActionText.trim()) || (status === "ACTIVE" && (!outcomeStatement.trim() || outcomeStatement.trim().length < 10 || !nextActionText.trim()))}
            className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create project"}
          </button>
          <Link
            href="/projects"
            className="rounded border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>

      <p className="mt-4">
        <Link href="/projects" className="text-zinc-600 dark:text-zinc-400 hover:underline">Back to Projects</Link>
      </p>
    </div>
  );
}
