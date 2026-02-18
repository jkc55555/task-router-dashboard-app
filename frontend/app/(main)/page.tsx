"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, type Task, type Item, type ScoreBreakdown } from "@/lib/api";
import { FilterPills } from "@/components/FilterPills";
import { ItemCard } from "@/components/ItemCard";
import { SnoozeModal } from "@/components/SnoozeModal";

export default function NowPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reasonTags, setReasonTags] = useState<Record<string, string[]>>({});
  const [scoreBreakdowns, setScoreBreakdowns] = useState<Record<string, ScoreBreakdown>>({});
  const [excluded, setExcluded] = useState<Array<{ task: Task; reason: string }>>([]);
  const [followUpDue, setFollowUpDue] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeAvailable, setTimeAvailable] = useState<number | undefined>();
  const [energy, setEnergy] = useState<string | undefined>();
  const [context, setContext] = useState<string | undefined>();
  const [filterMode, setFilterMode] = useState<"strict" | "soft">("soft");
  const [snoozeTaskId, setSnoozeTaskId] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [whyTaskId, setWhyTaskId] = useState<string | null>(null);

  const fetchNow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.tasks.now({
        timeAvailable,
        energy,
        context,
        filterMode,
      });
      setTasks(res.tasks);
      setReasonTags(res.reasonTags);
      setScoreBreakdowns(res.scoreBreakdowns ?? {});
      setExcluded(res.excluded ?? []);
      setFollowUpDue(res.followUpDue ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [timeAvailable, energy, context, filterMode]);

  useEffect(() => {
    fetchNow();
  }, [fetchNow]);

  const handleSnooze = (taskId: string) => setSnoozeTaskId(taskId);
  const handleSnoozeConfirm = async (taskId: string, snoozedUntil: string) => {
    try {
      await api.tasks.patch(taskId, { snoozedUntil });
      setSnoozeTaskId(null);
      fetchNow();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Snooze failed");
    }
  };
  const handlePin = async (taskId: string) => {
    try {
      const task = tasks.find((t) => t.id === taskId);
      const currentOrder = task?.pinnedOrder ?? null;
      const pinnedOrder = currentOrder == null ? 0 : null;
      await api.tasks.patch(taskId, { pinnedOrder });
      fetchNow();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pin failed");
    }
  };

  const taskForWhy = whyTaskId && (tasks.find((t) => t.id === whyTaskId) ?? excluded.find((e) => e.task.id === whyTaskId)?.task);
  const breakdownForWhy = taskForWhy ? scoreBreakdowns[taskForWhy.id] : null;
  const excludedReasonForWhy = taskForWhy ? excluded.find((e) => e.task.id === taskForWhy.id)?.reason : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Now
        </h1>
      </div>

      <div className="mb-4">
        <FilterPills
          timeAvailable={timeAvailable}
          energy={energy}
          context={context}
          onTimeChange={setTimeAvailable}
          onEnergyChange={setEnergy}
          onContextChange={setContext}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Filters:</span>
        <button
          type="button"
          onClick={() => setFilterMode("strict")}
          className={`rounded-full px-3 py-1 text-sm ${
            filterMode === "strict"
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          Strict
        </button>
        <button
          type="button"
          onClick={() => setFilterMode("soft")}
          className={`rounded-full px-3 py-1 text-sm ${
            filterMode === "soft"
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          Soft
        </button>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {filterMode === "strict" ? "Hide tasks that don't match" : "Show all, penalize mismatches"}
        </span>
      </div>

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowWhy((s) => !s)}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline"
        >
          Why is this here?
        </button>
        {showWhy && (
          <div className="mt-2 p-3 rounded bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
            <p className="mb-2">
              Tasks are ranked by <strong>urgency</strong>, <strong>importance</strong>, <strong>leverage</strong>, <strong>staleness</strong>, <strong>fit</strong> (time/energy/context), minus <strong>friction</strong> and <strong>risk</strong>. Pinned tasks stay at the top.
            </p>
            <p className="mb-2">
              Click a task below to see its score breakdown, or use the Excluded list when in Strict mode.
            </p>
            {taskForWhy && (
              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-600">
                <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  {taskForWhy.actionText}
                </div>
                {excludedReasonForWhy ? (
                  <p className="text-amber-600 dark:text-amber-400">Excluded: {excludedReasonForWhy}</p>
                ) : breakdownForWhy ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <dt>Urgency</dt>
                    <dd>{breakdownForWhy.urgency.toFixed(1)}</dd>
                    <dt>Importance</dt>
                    <dd>{breakdownForWhy.importance.toFixed(1)}</dd>
                    <dt>Leverage</dt>
                    <dd>{breakdownForWhy.leverage.toFixed(1)}</dd>
                    <dt>Staleness</dt>
                    <dd>{breakdownForWhy.staleness.toFixed(1)}</dd>
                    <dt>Fit</dt>
                    <dd>{breakdownForWhy.fit.toFixed(1)}</dd>
                    <dt>Friction</dt>
                    <dd>-{breakdownForWhy.friction.toFixed(1)}</dd>
                    <dt>Risk</dt>
                    <dd>-{breakdownForWhy.riskPenalty.toFixed(1)}</dd>
                    <dt className="font-medium">Total</dt>
                    <dd className="font-medium">{breakdownForWhy.total.toFixed(1)}</dd>
                  </dl>
                ) : null}
              </div>
            )}
            {excluded.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-600">
                <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">Excluded ({excluded.length})</div>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {excluded.map((e) => (
                    <li key={e.task.id}>
                      <button
                        type="button"
                        onClick={() => setWhyTaskId(e.task.id)}
                        className="text-left hover:underline"
                      >
                        {e.task.actionText}: {e.reason}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}

      {followUpDue.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">Follow-up due</h2>
          <ul className="space-y-2">
            {followUpDue.map((item) => (
              <li
                key={item.id}
                className="border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.title}</span>
                <span className="text-sm text-amber-600 dark:text-amber-400">Follow-up due</span>
                <Link
                  href={item.id ? `/inbox/clarify/${item.id}` : "/inbox"}
                  className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-sm"
                >
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          No actionable tasks. Capture something or move items from Inbox.
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li key={task.id}>
              <ItemCard
                task={task}
                reasonTags={reasonTags[task.id] ?? []}
                onStart={() => (window.location.href = `/tasks/${task.id}/complete`)}
                onSnooze={handleSnooze}
                onPin={handlePin}
                onEdit={task.itemId ? () => (window.location.href = `/inbox?edit=${task.itemId}`) : undefined}
                onShowWhy={() => {
                setWhyTaskId(task.id);
                setShowWhy(true);
              }}
                showWhyActive={showWhy && whyTaskId === task.id}
              />
            </li>
          ))}
        </ul>
      )}

      {snoozeTaskId && (
        <SnoozeModal
          taskId={snoozeTaskId}
          onConfirm={handleSnoozeConfirm}
          onCancel={() => setSnoozeTaskId(null)}
        />
      )}
    </div>
  );
}
