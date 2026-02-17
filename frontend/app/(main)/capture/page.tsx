"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Attachment } from "@/lib/api";

export default function CapturePage() {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFilesToList = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
  };

  const handleSave = async () => {
    const title = text.trim().slice(0, 500) || "Untitled";
    const body = text.trim();
    setLoading(true);
    setError(null);
    try {
      let attachments: Attachment[] | undefined;
      if (files.length > 0) {
        const { uploads } = await api.intake.upload(files);
        attachments = uploads;
      }
      const item = await api.items.create({ title, body, source: "capture", attachments });
      if (!item?.id) {
        throw new Error("Server did not return the created item");
      }
      toast.success("Saved to inbox");
      setSavedId(item.id);
      setText("");
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFilesToList(Array.from(e.target.files ?? []));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files;
    if (dropped?.length) addFilesToList(Array.from(dropped));
  };
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        Capture
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-4">
        Dump anything here: notes, tasks, links, emails, ideas...
      </p>

      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={`rounded border transition-colors ${isDragOver ? "border-primary ring-2 ring-primary/30" : "border-zinc-300 dark:border-zinc-600"} p-4`}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type..."
          className="w-full min-h-[200px] rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
          disabled={loading}
        />

        <div className="mt-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={addFiles}
            className="hidden"
            accept="*/*"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300"
          >
            Attach files ({files.length}/10)
          </button>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-red-600 dark:text-red-400 shrink-0"
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mt-2">{error}</p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save to Inbox"}
        </button>
      </div>

      {savedId && (
        <p className="mt-4 text-zinc-600 dark:text-zinc-400 text-sm">
          Saved to Inbox.{" "}
          <Link href={`/inbox/clarify/${savedId}`} className="underline font-medium">
            Clarify now
          </Link>{" "}
          or{" "}
          <button type="button" onClick={() => setSavedId(null)} className="underline">
            Later
          </button>
        </p>
      )}
    </div>
  );
}
