"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, type Project, type AreaOfFocus } from "@/lib/api";

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const areaParam = searchParams.get("area");
  const [projects, setProjects] = useState<Project[]>([]);
  const [areas, setAreas] = useState<AreaOfFocus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAreaIds, setFilterAreaIds] = useState<string[]>([]);
  const [groupByArea, setGroupByArea] = useState(false);

  useEffect(() => {
    if (areaParam) setFilterAreaIds((prev) => (prev.includes(areaParam) ? prev : [areaParam]));
  }, [areaParam]);

  useEffect(() => {
    Promise.all([api.projects.list(), api.areas.list()])
      .then(([projList, areaList]) => {
        setProjects(projList);
        setAreas(areaList);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const projectTitle = (p: Project) => p.item?.title ?? p.outcomeStatement ?? "Untitled project";

  const filteredProjects = useMemo(() => {
    if (filterAreaIds.length === 0) return projects;
    return projects.filter((p) => {
      if (!p.areaId) return filterAreaIds.includes("__unassigned__");
      return filterAreaIds.includes(p.areaId);
    });
  }, [projects, filterAreaIds]);

  const toggleFilterArea = (id: string) => {
    setFilterAreaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const groupedByArea = useMemo(() => {
    if (!groupByArea) return null;
    const map = new Map<string | null, Project[]>();
    map.set(null, []);
    areas.forEach((a) => map.set(a.id, []));
    filteredProjects.forEach((p) => {
      const key = p.areaId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return map;
  }, [filteredProjects, areas, groupByArea]);

  const clarifying = filteredProjects.filter((p) => p.status === "CLARIFYING");
  const focusProjects = filteredProjects.filter((p) => p.focusThisWeek);
  const active = filteredProjects.filter((p) => p.status === "ACTIVE" && !p.focusThisWeek);
  const waiting = filteredProjects.filter((p) => p.status === "WAITING");
  const onHold = filteredProjects.filter((p) => p.status === "ON_HOLD" || p.status === "SOMEDAY");
  const doneArchived = filteredProjects.filter((p) => p.status === "DONE" || p.status === "ARCHIVED");

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
      {areas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-sm text-zinc-500">Filter by area:</span>
          <button
            type="button"
            onClick={() => toggleFilterArea("__unassigned__")}
            className={`rounded-full px-2 py-1 text-xs ${filterAreaIds.includes("__unassigned__") ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-600"}`}
          >
            Unassigned
          </button>
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleFilterArea(a.id)}
              className={`rounded-full px-2 py-1 text-xs ${filterAreaIds.includes(a.id) ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-600"}`}
            >
              {a.name}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm ml-2">
            <input type="checkbox" checked={groupByArea} onChange={(e) => setGroupByArea(e.target.checked)} className="rounded" />
            Group by area
          </label>
        </div>
      )}
      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      ) : groupByArea && groupedByArea ? (
        <div className="space-y-6">
          {Array.from(groupedByArea.entries()).map(([areaId, projs]) => {
            if (projs.length === 0) return null;
            const areaName = areaId ? areas.find((a) => a.id === areaId)?.name ?? "Unknown" : "Unassigned";
            return (
              <section key={areaId ?? "__unassigned__"} className="mb-6">
                <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">{areaName}</h2>
                <ul className="space-y-2">
                  {projs.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="text-zinc-900 dark:text-zinc-100 hover:underline">
                        {projectTitle(p)}
                      </Link>
                      <span className="text-zinc-500 text-sm ml-2">({p.status})</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
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
