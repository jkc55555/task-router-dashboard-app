"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Source = { id: string; name: string; kind: string; lastSyncedAt: string | null; createdAt: string };

export default function CalendarsPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [name, setName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSources = async () => {
    try {
      const list = await api.calendars.listSources();
      setSources(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const result = await api.calendars.importIcs(file, name || undefined);
      setImportResult(`Imported ${result.total} events (${result.created} new, ${result.updated} updated).`);
      setName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const deleteSource = async (id: string) => {
    if (!confirm("Remove this calendar source? Events will be deleted.")) return;
    try {
      await api.calendars.deleteSource(id);
      fetchSources();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
        Calendars
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-4">
        Import .ics files to see events in Deadlines. Events are merged into Today / Next 7 / Next 30.
      </p>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}
      {importResult && (
        <p className="text-green-600 dark:text-green-400 text-sm mb-4">{importResult}</p>
      )}

      <div className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".ics"
          onChange={handleImport}
          className="hidden"
        />
        <input
          type="text"
          placeholder="Calendar name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 mr-2 mb-2"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import .ics file"}
        </button>
      </div>

      <section>
        <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">
          Calendar sources
        </h2>
        {loading ? (
          <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
        ) : sources.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">No calendar sources yet. Import an .ics file above.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2"
              >
                <span className="text-zinc-900 dark:text-zinc-100">{s.name}</span>
                <div className="flex items-center gap-2">
                  {s.lastSyncedAt && (
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs">
                      Synced {new Date(s.lastSyncedAt).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteSource(s.id)}
                    className="text-red-600 dark:text-red-400 text-sm hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sources.length > 0 && (
        <p className="mt-4 text-zinc-600 dark:text-zinc-400 text-sm">
          <a
            href={api.calendars.exportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Download all events as .ics
          </a>
        </p>
      )}

      <p className="mt-6">
        <Link href="/deadlines" className="underline">Deadlines</Link> · <Link href="/" className="underline">Now</Link>
      </p>
    </div>
  );
}
