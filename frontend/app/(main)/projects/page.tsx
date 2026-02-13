"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { api, type Project } from "@/lib/api";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.projects
      .list()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const projectTitle = (p: Project) => p.item?.title ?? p.outcomeStatement ?? "Untitled project";
  const clarifying = projects.filter((p) => p.status === "CLARIFYING");
  const focusProjects = projects.filter((p) => p.focusThisWeek);
  const active = projects.filter((p) => p.status === "ACTIVE" && !p.focusThisWeek);
  const waiting = projects.filter((p) => p.status === "WAITING");
  const onHold = projects.filter((p) => p.status === "ON_HOLD" || p.status === "SOMEDAY");
  const doneArchived = projects.filter((p) => p.status === "DONE" || p.status === "ARCHIVED");

  const [showDone, setShowDone] = useState(false);
  const stalledCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.getTime();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Projects
        </h1>
        <Link
          href="/projects/new"
          className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium"
        >
          New project
        </Link>
      </div>
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}
      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      ) : (
        <>
          {clarifying.length > 0 && (
            <section className="mb-6">
              <h2 className="text-lg font-medium text-amber-800 dark:text-amber-200 mb-2">
                Needs clarification
              </h2>
              <ul className="space-y-2">
                {clarifying.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-zinc-900 dark:text-zinc-100 hover:underline font-medium"
                    >
                      {projectTitle(p)}
                    </Link>
                    <span className="text-amber-600 dark:text-amber-400 text-sm ml-2">
                      (add outcome and next action)
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {focusProjects.length > 0 && (
            <section className="mb-6">
              <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">
                Focus this week (top 3)
              </h2>
              <ul className="space-y-2">
                {focusProjects.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-zinc-900 dark:text-zinc-100 hover:underline font-medium"
                    >
                      {projectTitle(p)}
                    </Link>
                    {p.nextActionTask ? (
                      <span className="text-zinc-500 dark:text-zinc-400 text-sm ml-2">
                        · {p.nextActionTask.actionText}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 text-sm ml-2">(needs next action)</span>
                    )}
                    {p.dueDate && (
                      <span className="text-zinc-400 text-sm ml-2">
                        Due {new Date(p.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {active.length > 0 && (
            <section className="mb-6">
              <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">
                Active
              </h2>
              <ul className="space-y-2">
                {active.map((p) => {
                  const lastProgress = p.lastProgressAt ? new Date(p.lastProgressAt).getTime() : null;
                  const stalled = lastProgress != null && lastProgress < stalledCutoff;
                  return (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="text-zinc-900 dark:text-zinc-100 hover:underline">
                        {projectTitle(p)}
                      </Link>
                      {!p.nextActionTaskId && p.status === "ACTIVE" && (
                        <span className="text-amber-600 dark:text-amber-400 text-sm ml-2">(needs next action)</span>
                      )}
                      {stalled && (
                        <span className="text-zinc-500 text-sm ml-2">(stalled)</span>
                      )}
                      {p.dueDate && (
                        <span className="text-zinc-400 text-sm ml-2">
                          Due {new Date(p.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {doneArchived.length > 0 && (
            <section className="mb-6">
              <button
                type="button"
                onClick={() => setShowDone((s) => !s)}
                className="text-lg font-medium text-zinc-600 dark:text-zinc-400 hover:underline mb-2"
              >
                Done / Archived ({doneArchived.length}) {showDone ? "▼" : "▶"}
              </button>
              {showDone && (
                <ul className="space-y-2">
                  {doneArchived.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="text-zinc-500 dark:text-zinc-400 hover:underline">
                        {projectTitle(p)}
                      </Link>
                      <span className="text-zinc-400 text-sm ml-2">({p.status})</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {clarifying.length === 0 && focusProjects.length === 0 && active.length === 0 && waiting.length === 0 && onHold.length === 0 && doneArchived.length === 0 && (
            <p className="text-zinc-500 dark:text-zinc-400">No projects yet. Create one or promote from Inbox.</p>
          )}
        </>
      )}
      <p className="mt-4">
        <Link href="/inbox" className="text-zinc-600 dark:text-zinc-400 hover:underline">Inbox</Link>
        {" · "}
        <Link href="/review" className="text-zinc-600 dark:text-zinc-400 hover:underline">Review</Link>
      </p>
    </div>
  );
}
