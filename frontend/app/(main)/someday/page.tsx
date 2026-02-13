"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api, type Item } from "@/lib/api";

export default function SomedayPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snoozeId, setSnoozeId] = useState<string | null>(null);

  const fetchSomeday = () => {
    setLoading(true);
    api.items
      .list("SOMEDAY")
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSomeday();
  }, []);

  const handlePromote = (itemId: string) => {
    window.location.href = `/inbox/disposition?itemId=${itemId}&type=project`;
  };

  const handleTrash = async (itemId: string) => {
    try {
      await api.items.patch(itemId, { disposition: "trash" });
      fetchSomeday();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleSnoozeReview = async (itemId: string) => {
    setSnoozeId(itemId);
    try {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      await api.items.addReminder(itemId, { dueAt: d.toISOString(), kind: "review" });
      setSnoozeId(null);
      fetchSomeday();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSnoozeId(null);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        Someday
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
        Ideas and non-commitments. Promote to a project when ready, or snooze for later review.
      </p>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}
      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">No someday items. Capture ideas from Inbox.</p>
      ) : (
        <ul className="space-y-4">
          {items
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((item) => (
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
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  Added {formatDate(item.createdAt)}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => handlePromote(item.id)}
                    className="rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Promote to Project
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSnoozeReview(item.id)}
                    disabled={snoozeId === item.id}
                    className="rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {snoozeId === item.id ? "Adding…" : "Snooze for review (1 week)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => confirm("Move to trash?") && handleTrash(item.id)}
                    className="rounded border border-red-200 dark:border-red-900 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}

      <p className="mt-6 text-zinc-500 dark:text-zinc-400 text-sm">
        <Link href="/inbox" className="underline">Inbox</Link> · <Link href="/review" className="underline">Review</Link>
      </p>
    </div>
  );
}
