"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SnoozeModal } from "@/components/SnoozeModal";

type Step = "D1" | "D2" | "D3" | "D4" | "D5" | "D6";

type Snapshot = {
  inboxCount: number;
  overdueCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  waitingFollowUpsDueCount: number;
  projectsNoNextActionCount: number;
  unverifiedCount: number;
};

export default function DailyReviewPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("D1");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [stepData, setStepData] = useState<{ items: unknown[] }>({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [snoozeTaskId, setSnoozeTaskId] = useState<string | null>(null);
  const [focusIds, setFocusIds] = useState<string[]>([]);
  const [allProjects, setAllProjects] = useState<{ id: string; title: string }[]>([]);
  const [sessionCounts, setSessionCounts] = useState({ processed: 0, skipped: 0 });

  const loadSnapshot = useCallback(async () => {
    const data = await api.reviews.getDailySnapshot();
    setSnapshot(data);
  }, []);

  useEffect(() => {
    if (step === "D1") {
      loadSnapshot().catch((e) => setError(e instanceof Error ? e.message : "Failed")).finally(() => setLoading(false));
    }
  }, [step, loadSnapshot]);

  useEffect(() => {
    if (step === "D2" || step === "D3" || step === "D5") {
      setLoading(true);
      api.reviews
        .getDailyStep(step)
        .then(setStepData)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
        .finally(() => setLoading(false));
    }
    if (step === "D4") {
      api.reviews.getDailyStep("D4").then((d) => {
        setStepData(d);
        setAllProjects((d.items as { id: string; title: string }[]) ?? []);
      }).catch((e) => setError(e instanceof Error ? e.message : "Failed")).finally(() => setLoading(false));
    }
  }, [step]);

  const handleStartDaily = async () => {
    try {
      const session = await api.reviews.createSession("daily");
      setSessionId(session.sessionId);
      setResolved(new Set());
      setSkipped(new Set());
      setSessionCounts({ processed: 0, skipped: 0 });
      setStep("D2");
      setLoading(true);
      const d = await api.reviews.getDailyStep("D2");
      setStepData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSnooze = (taskId: string) => setSnoozeTaskId(taskId);
  const handleSnoozeConfirm = async (taskId: string, snoozedUntil: string) => {
    try {
      await api.tasks.patch(taskId, { snoozedUntil });
      setResolved((r) => new Set(r).add(taskId));
      setSnoozeTaskId(null);
      const d = await api.reviews.getDailyStep("D2");
      setStepData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Snooze failed");
    }
  };

  const markResolved = (id: string) => setResolved((r) => new Set(r).add(id));
  const markSkipped = (id: string) => setSkipped((s) => new Set(s).add(id));

  const goNext = async () => {
    if (!sessionId) return;
    const processed = resolved.size;
    const skipCount = skipped.size;
    try {
      await api.reviews.updateSession(sessionId, {
        stepCompleted: step,
        itemsProcessed: processed,
        itemsSkipped: skipCount,
      });
      setSessionCounts((c) => ({ processed: c.processed + processed, skipped: c.skipped + skipCount }));
      setResolved(new Set());
      setSkipped(new Set());
      if (step === "D2") setStep("D3");
      else if (step === "D3") setStep("D4");
      else if (step === "D4") setStep("D5");
      else if (step === "D5") setStep("D6");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleD4Save = async () => {
    try {
      await api.reviews.weeklyPost({ focusProjectIds: focusIds.slice(0, 3) });
      await goNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save focus");
    }
  };

  const handleComplete = async () => {
    if (sessionId) {
      try {
        await api.reviews.updateSession(sessionId, { completedAt: new Date().toISOString() });
      } catch (_) {}
    }
    router.push("/");
  };

  if (loading && step === "D1") return <p className="text-zinc-500">Loading...</p>;
  if (error && step === "D1" && !snapshot) {
    return (
      <div>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href="/" className="underline mt-2 inline-block">Back</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Daily Review</h1>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
        <strong>Daily Check</strong> · <Link href="/review" className="underline">Weekly Review</Link>
      </p>

      {error && <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>}

      {/* D1 — Snapshot */}
      {step === "D1" && snapshot && (
        <div className="space-y-4">
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 grid grid-cols-2 gap-2 text-sm">
            <span className="text-zinc-500">Inbox</span>
            <span>{snapshot.inboxCount}</span>
            <span className="text-zinc-500">Overdue</span>
            <span>{snapshot.overdueCount}</span>
            <span className="text-zinc-500">Due today / tomorrow</span>
            <span>{snapshot.dueTodayCount} / {snapshot.dueTomorrowCount}</span>
            <span className="text-zinc-500">Waiting follow-ups due</span>
            <span>{snapshot.waitingFollowUpsDueCount}</span>
            <span className="text-zinc-500">Projects no next action</span>
            <span>{snapshot.projectsNoNextActionCount}</span>
            <span className="text-zinc-500">Unverified</span>
            <span>{snapshot.unverifiedCount}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStartDaily}
              className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium"
            >
              Start Daily Review
            </button>
            <Link href="/" className="rounded border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm">
              Skip to Now
            </Link>
          </div>
        </div>
      )}

      {/* D2 — Overdue + Due Soon */}
      {step === "D2" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Overdue & due today</h2>
          {loading ? (
            <p className="text-zinc-500">Loading...</p>
          ) : (
            <>
              <ul className="space-y-2">
                {(stepData.items as { id: string; itemId: string | null; actionText: string; dueDate: string | null; project: { id: string; title: string } | null; reasonTags: string[] }[]).map((t) => (
                  <li key={t.id} className="border border-zinc-200 dark:border-zinc-700 rounded p-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{t.actionText}</span>
                      {t.reasonTags?.length ? <span className="text-sm text-zinc-500 ml-2">{t.reasonTags.join(", ")}</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Link href={`/tasks/${t.id}/complete`} className="rounded bg-accent text-accent-foreground hover:bg-accent/90 px-2 py-1 text-xs" onClick={() => markResolved(t.id)}>Done</Link>
                      <button type="button" onClick={() => { setSnoozeTaskId(t.id); }} className="rounded border px-2 py-1 text-xs">Snooze</button>
                      {t.itemId && <Link href={`/inbox/clarify/${t.itemId}`} className="rounded border px-2 py-1 text-xs">Edit</Link>}
                      <button type="button" onClick={async () => { await api.tasks.patch(t.id, { dueDate: null }); markResolved(t.id); const d = await api.reviews.getDailyStep("D2"); setStepData(d); }} className="rounded border px-2 py-1 text-xs">Remove due</button>
                      <button type="button" onClick={() => markSkipped(t.id)} className="rounded border px-2 py-1 text-xs">Skip</button>
                    </div>
                  </li>
                ))}
              </ul>
              {stepData.items.length === 0 && <p className="text-zinc-500">None.</p>}
              <div className="flex gap-2">
                <button type="button" onClick={goNext} className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm">Next</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* D3 — Waiting follow-ups due */}
      {step === "D3" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Waiting follow-ups due</h2>
          {loading ? (
            <p className="text-zinc-500">Loading...</p>
          ) : (
            <>
              <ul className="space-y-2">
                {(stepData.items as { id: string; title: string; waitingOn: string | null; waitingSince: string | null }[]).map((i) => (
                  <li key={i.id} className="border border-zinc-200 dark:border-zinc-700 rounded p-3 flex flex-wrap items-center justify-between gap-2">
                    <div>Follow up: waiting on {i.waitingOn ?? "?"} — {i.title}</div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await api.items.createFollowUpTask(i.id);
                          markResolved(i.id);
                          const d = await api.reviews.getDailyStep("D3");
                          setStepData(d);
                        }}
                        className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-2 py-1 text-xs"
                      >
                        Create follow-up task
                      </button>
                      <Link href={`/inbox/clarify/${i.id}`} className="rounded border px-2 py-1 text-xs">Review</Link>
                      <button type="button" onClick={() => markSkipped(i.id)} className="rounded border px-2 py-1 text-xs">Skip</button>
                    </div>
                  </li>
                ))}
              </ul>
              {stepData.items.length === 0 && <p className="text-zinc-500">None.</p>}
              <button type="button" onClick={goNext} className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm">Next</button>
            </>
          )}
        </div>
      )}

      {/* D4 — Today focus */}
      {step === "D4" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Today focus (optional)</h2>
          <p className="text-sm text-zinc-500">Pick up to 3 projects to focus today.</p>
          <ul className="space-y-1">
            {(stepData.items as { id: string; title: string; focusThisWeek?: boolean }[]).map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusIds.includes(p.id)}
                    onChange={() => setFocusIds((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : prev.length >= 3 ? prev : [...prev, p.id])}
                    className="rounded"
                  />
                  <span>{p.title}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={handleD4Save} className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm">Save & Next</button>
            <button type="button" onClick={goNext} className="rounded border px-4 py-2 text-sm">Skip</button>
          </div>
        </div>
      )}

      {/* D5 — Broken items */}
      {step === "D5" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Broken items</h2>
          {loading ? (
            <p className="text-zinc-500">Loading...</p>
          ) : (
            <>
              <ul className="space-y-2">
                {(stepData.items as { type: string; id: string; itemId?: string; actionText?: string; title?: string }[]).map((x) => (
                  <li key={x.id} className="border border-zinc-200 dark:border-zinc-700 rounded p-3 flex flex-wrap items-center justify-between gap-2">
                    <span>{x.type === "task" ? (x as { actionText: string }).actionText : (x as { title: string }).title}</span>
                    <div className="flex gap-1">
                      {x.type === "task" && x.itemId && <Link href={`/inbox/clarify/${x.itemId}`} className="rounded border px-2 py-1 text-xs">Fix</Link>}
                      {x.type === "project" && <Link href={`/projects/${x.id}`} className="rounded border px-2 py-1 text-xs">Fix</Link>}
                      <button type="button" onClick={() => markSkipped(x.id)} className="rounded border px-2 py-1 text-xs">Skip</button>
                    </div>
                  </li>
                ))}
              </ul>
              {stepData.items.length === 0 && <p className="text-zinc-500">None.</p>}
              <button type="button" onClick={goNext} className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm">Next</button>
            </>
          )}
        </div>
      )}

      {/* D6 — Completion */}
      {step === "D6" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Daily review complete</h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            Processed: {sessionCounts.processed} · Skipped: {sessionCounts.skipped}
          </p>
          <button
            type="button"
            onClick={handleComplete}
            className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium"
          >
            Go to Now
          </button>
        </div>
      )}

      {snoozeTaskId && (
        <SnoozeModal
          taskId={snoozeTaskId}
          onConfirm={handleSnoozeConfirm}
          onCancel={() => setSnoozeTaskId(null)}
        />
      )}

      <p className="mt-6">
        <Link href="/" className="text-zinc-600 dark:text-zinc-400 hover:underline">Back to Now</Link>
      </p>
    </div>
  );
}
