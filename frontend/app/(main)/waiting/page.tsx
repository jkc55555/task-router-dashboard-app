"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api, type Item } from "@/lib/api";

export default function WaitingPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.items
      .list("WAITING")
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        Waiting
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
        Things you’re blocked on but responsible for. When a follow-up date hits, the item can surface in Now.
      </p>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}
      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">Nothing waiting. Nothing falls through the cracks.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const reminders = item.reminders ?? [];
            const nextDue = reminders
              .filter((r) => new Date(r.dueAt) >= now)
              .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
            const overdue = reminders.some((r) => new Date(r.dueAt) < now);
            return (
              <li
                key={item.id}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {item.title}
                </div>
                {item.body && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 whitespace-pre-wrap line-clamp-2">
                    {item.body}
                  </p>
                )}
                <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  <span>Since {formatDate(item.updatedAt)}</span>
                  {nextDue && (
                    <span className="ml-3">
                      Follow-up: {formatDate(nextDue.dueAt)}
                      {overdue && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                          (overdue – consider in Now)
                        </span>
                      )}
                    </span>
                  )}
                  {reminders.length === 0 && (
                    <span className="ml-3 text-zinc-400">No follow-up date set</span>
                  )}
                </div>
                <Link
                  href={`/inbox?focus=${item.id}`}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                >
                  View / Edit
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-zinc-500 dark:text-zinc-400 text-sm">
        <Link href="/inbox" className="underline">Inbox</Link> · <Link href="/" className="underline">Now</Link> · <Link href="/review" className="underline">Review</Link>
      </p>
    </div>
  );
}
