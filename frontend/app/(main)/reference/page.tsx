"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { api, type Item } from "@/lib/api";

export default function ReferencePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.items
      .list("REFERENCE")
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.body && i.body.toLowerCase().includes(q))
    );
  }, [items, search]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        Reference
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
        Notes, docs, and records. No action pressure — never appears in Now.
      </p>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}

      {!loading && items.length > 0 && (
        <div className="mb-4">
          <input
            type="search"
            placeholder="Search by title or body…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
          />
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          {search.trim() ? "No reference items match your search." : "No reference items yet. Move items from Inbox to Reference when they’re just for keeping."}
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((item) => (
            <li
              key={item.id}
              className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
            >
              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                {item.title}
              </div>
              {item.body && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 whitespace-pre-wrap line-clamp-3">
                  {item.body}
                </p>
              )}
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                {formatDate(item.updatedAt)}
              </p>
              <Link
                href={`/inbox?focus=${item.id}`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-zinc-500 dark:text-zinc-400 text-sm">
        <Link href="/inbox" className="underline">Inbox</Link> · <Link href="/" className="underline">Now</Link>
      </p>
    </div>
  );
}
