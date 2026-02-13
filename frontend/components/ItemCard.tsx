"use client";

import type { Task } from "@/lib/api";

type Props = {
  task: Task;
  reasonTags: string[];
  onStart?: (taskId: string) => void;
  onSnooze?: (taskId: string) => void;
  onPin?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  onShowWhy?: (taskId: string) => void;
  showWhyActive?: boolean;
};

export function ItemCard({ task, reasonTags, onStart, onSnooze, onPin, onEdit, onShowWhy, showWhyActive }: Props) {
  const tags = reasonTags.length ? reasonTags : [];
  const showNeedsReview = task.unverified && !tags.includes("Needs review");
  const displayTags = showNeedsReview ? ["Needs review", ...tags] : tags;
  const isPinned = task.pinnedOrder != null;

  return (
    <div
      className={`border rounded-lg p-4 flex flex-col gap-2 ${
        showWhyActive ? "border-zinc-400 dark:border-zinc-500 ring-1 ring-zinc-400 dark:ring-zinc-500" : "border-zinc-200 dark:border-zinc-700"
      }`}
    >
      <div className="font-medium text-zinc-900 dark:text-zinc-100">
        {task.actionText}
      </div>
      {displayTags.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {displayTags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {onStart && (
          <button
            type="button"
            onClick={() => onStart(task.id)}
            className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            Start
          </button>
        )}
        {onSnooze && (
          <button
            type="button"
            onClick={() => onSnooze(task.id)}
            className="rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Snooze
          </button>
        )}
        {onPin && (
          <button
            type="button"
            onClick={() => onPin(task.id)}
            className="rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {isPinned ? "Unpin" : "Pin"}
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(task.id)}
            className="rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
        )}
        {onShowWhy && (
          <button
            type="button"
            onClick={() => onShowWhy(task.id)}
            className={`text-sm ${showWhyActive ? "underline font-medium" : "text-zinc-500 dark:text-zinc-400 hover:underline"}`}
          >
            Why?
          </button>
        )}
      </div>
    </div>
  );
}
