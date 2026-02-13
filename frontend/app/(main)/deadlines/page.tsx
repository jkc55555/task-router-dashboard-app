"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api, type DeadlineEntry } from "@/lib/api";

export default function DeadlinesPage() {
  const [data, setData] = useState<{
    today: DeadlineEntry[];
    next7: DeadlineEntry[];
    next30: DeadlineEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.deadlines
      .get()
      .then((r) => setData({ today: r.today, next7: r.next7, next30: r.next30 }))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const formatEntrySub = (i: DeadlineEntry) => {
    if (i.type === "calendar" && (i.start != null || i.dueDate != null)) {
      const d = i.start ?? i.dueDate;
      if (i.allDay) return formatDate(d ?? null);
      return d ? `${formatDate(d)} ${formatTime(d)}` : "";
    }
    return i.dueDate ? formatDate(i.dueDate) : "";
  };
  const typeLabel = (i: DeadlineEntry) =>
    i.type === "calendar" ? "Calendar" : i.type === "project" ? "Project" : "Task";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
        Deadlines
      </h1>
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}
      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      ) : data ? (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">
              Today
            </h2>
            {data.today.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Nothing due today.</p>
            ) : (
              <ul className="space-y-1">
                {data.today.map((i) => (
                  <li key={`${i.type}-${i.id}`} className="text-zinc-900 dark:text-zinc-100">
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs mr-2">[{typeLabel(i)}]</span>
                    {i.title}
                    <span className="text-zinc-500 dark:text-zinc-400 text-sm ml-2">
                      {formatEntrySub(i)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">
              Next 7 Days
            </h2>
            {data.next7.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Nothing.</p>
            ) : (
              <ul className="space-y-1">
                {data.next7.map((i) => (
                  <li key={`${i.type}-${i.id}`} className="text-zinc-900 dark:text-zinc-100">
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs mr-2">[{typeLabel(i)}]</span>
                    {i.title}
                    <span className="text-zinc-500 dark:text-zinc-400 text-sm ml-2">
                      {formatEntrySub(i)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">
              Next 30 Days
            </h2>
            {data.next30.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Nothing.</p>
            ) : (
              <ul className="space-y-1">
                {data.next30.map((i) => (
                  <li key={`${i.type}-${i.id}`} className="text-zinc-900 dark:text-zinc-100">
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs mr-2">[{typeLabel(i)}]</span>
                    {i.title}
                    <span className="text-zinc-500 dark:text-zinc-400 text-sm ml-2">
                      {formatEntrySub(i)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
      <p className="mt-6 text-zinc-500 dark:text-zinc-400 text-sm">
        Only real due dates / milestones appear here.
      </p>
      <p className="mt-2">
        <Link href="/" className="underline">Now</Link> · <Link href="/projects" className="underline">Projects</Link>
        {" · "}
        <Link href="/calendars" className="underline">Import calendar</Link>
      </p>
    </div>
  );
}
