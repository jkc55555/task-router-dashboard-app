"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, type Project } from "@/lib/api";

type Step = "W1" | "W2" | "W3" | "W4" | "W4A" | "W5" | "W6" | "W7" | "W8" | "W9";

type Snapshot = {
  inboxCount: number;
  projectsActiveCount: number;
  projectsWaitingCount: number;
  projectsOnHoldCount: number;
  projectsMissingNextActionCount: number;
  waitingMissingFollowUpCount: number;
  somedayCount: number;
  unverifiedCount: number;
  staleTasksCount: number;
};

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step") as Step | null;
  const sessionIdParam = searchParams.get("sessionId");
  const [step, setStep] = useState<Step>(stepParam ?? "W1");
  const [sessionId, setSessionId] = useState<string | null>(sessionIdParam);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [stepData, setStepData] = useState<{ items: unknown[] }>({ items: [] });
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusIds, setFocusIds] = useState<string[]>([]);
  const [sessionCounts, setSessionCounts] = useState({ processed: 0, skipped: 0 });

  useEffect(() => {
    if (stepParam && ["W2","W3","W4","W4A","W5","W6","W7","W8","W9"].includes(stepParam)) {
      setStep(stepParam);
    }
    if (sessionIdParam) setSessionId(sessionIdParam);
  }, [stepParam, sessionIdParam]);

  useEffect(() => {
    if (step === "W1") {
      api.reviews
        .getWeeklySnapshot()
        .then(setSnapshot)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
        .finally(() => setLoading(false));
    }
  }, [step]);

  useEffect(() => {
    if (step === "W3" || step === "W4" || step === "W4A" || step === "W5") {
      setLoading(true);
      api.reviews
        .getWeeklyStep(step)
        .then(setStepData)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
        .finally(() => setLoading(false));
    }
    if (step === "W7") {
      api.projects.list().then(setAllProjects).catch(() => {});
      api.reviews.weekly().then((d) => setFocusIds(d.focusProjects.map((p) => p.id))).catch(() => {});
    }
  }, [step]);

  const handleStartWeekly = async () => {
    try {
      const session = await api.reviews.createSession("weekly");
      setSessionId(session.sessionId);
      setStep("W2");
      router.replace(`/review?step=W2&sessionId=${session.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const goNext = useCallback(async (currentStep: Step, processed = 0, skipped = 0) => {
    if (!sessionId) return;
    try {
      await api.reviews.updateSession(sessionId, {
        stepCompleted: currentStep,
        itemsProcessed: processed,
        itemsSkipped: skipped,
      });
      setSessionCounts((c) => ({ processed: c.processed + processed, skipped: c.skipped + skipped }));
      const next: Step[] = ["W1","W2","W3","W4","W4A","W5","W6","W7","W8","W9"];
      const i = next.indexOf(currentStep);
      const nextStep = next[i + 1] ?? "W9";
      setStep(nextStep);
      router.replace(`/review${nextStep !== "W1" ? `?step=${nextStep}&sessionId=${sessionId}` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [sessionId, router]);

  const handleComplete = async () => {
    if (sessionId) {
      try {
        await api.reviews.updateSession(sessionId, { completedAt: new Date().toISOString() });
      } catch (_) {}
    }
    router.push("/");
  };

  if (loading && step === "W1") return <p className="text-zinc-500">Loading...</p>;
  if (error && step === "W1" && !snapshot) {
    return (
      <div>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href="/" className="underline mt-2 inline-block">Back</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Weekly Review</h1>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
        <Link href="/review/daily" className="underline">Daily Check</Link> · <strong>Weekly Review</strong>
      </p>

      {error && <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>}

      {/* W1 — Snapshot */}
      {step === "W1" && snapshot && (
        <div className="space-y-4">
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 grid grid-cols-2 gap-2 text-sm">
            <span className="text-zinc-500">Inbox</span>
            <span>{snapshot.inboxCount}</span>
            <span className="text-zinc-500">Projects (Active / Waiting / On Hold)</span>
            <span>{snapshot.projectsActiveCount} / {snapshot.projectsWaitingCount} / {snapshot.projectsOnHoldCount}</span>
            <span className="text-zinc-500">Projects missing next action</span>
            <span>{snapshot.projectsMissingNextActionCount}</span>
            <span className="text-zinc-500">Waiting missing follow-up</span>
            <span>{snapshot.waitingMissingFollowUpCount}</span>
            <span className="text-zinc-500">Someday</span>
            <span>{snapshot.somedayCount}</span>
            <span className="text-zinc-500">Unverified / Stale tasks</span>
            <span>{snapshot.unverifiedCount} / {snapshot.staleTasksCount}</span>
          </div>
          <button
            type="button"
            onClick={handleStartWeekly}
            className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium"
          >
            Start Weekly Review
          </button>
        </div>
      )}

      {/* W2 — Clear Inbox */}
      {step === "W2" && sessionId && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Step 2: Clear Inbox to zero</h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            Open Inbox and clarify each item (Next Action, Project, Waiting, Someday, Reference, Trash). When you are done, click below.
          </p>
          <Link
            href={`/inbox?review=weekly&sessionId=${sessionId}`}
            className="inline-block rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium"
          >
            Open Inbox
          </Link>
          <div>
            <button
              type="button"
              onClick={() => goNext("W2", 0, 0)}
              className="rounded border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
            >
              Done with inbox → Next
            </button>
          </div>
        </div>
      )}

      {/* W3 — Project integrity */}
      {step === "W3" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Step 3: Project integrity</h2>
          {loading ? (
            <p className="text-zinc-500">Loading...</p>
          ) : (
            <>
              <ul className="space-y-2">
                {(stepData.items as { id: string; title: string; status: string; hasValidNextAction?: boolean; outcomeStatement?: string | null }[]).map((p) => (
                  <li key={p.id} className="border border-zinc-200 dark:border-zinc-700 rounded p-3 flex flex-wrap items-center justify-between gap-2">
                    <span>{p.title}</span>
                    <span className="text-xs text-zinc-500">{p.status}</span>
                    <Link href={`/projects/${p.id}`} className="rounded border px-2 py-1 text-xs">Fix</Link>
                  </li>
                ))}
              </ul>
              {stepData.items.length === 0 && <p className="text-zinc-500">None.</p>}
              <button type="button" onClick={() => goNext("W3", 0, 0)} className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm">Next</button>
            </>
          )}
        </div>
      )}

      {/* W4 — Waiting list */}
      {step === "W4" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Step 4: Waiting list</h2>
          {loading ? (
            <p className="text-zinc-500">Loading...</p>
          ) : (
            <>
              <ul className="space-y-2">
                {(stepData.items as { id: string; title: string; waitingOn: string | null; hasFollowUp?: boolean }[]).map((i) => (
                  <li key={i.id} className="border border-zinc-200 dark:border-zinc-700 rounded p-3 flex flex-wrap items-center justify-between gap-2">
                    <span>{i.title} {i.waitingOn ? `(waiting on ${i.waitingOn})` : ""}</span>
                    <Link href={`/inbox/clarify/${i.id}`} className="rounded border px-2 py-1 text-xs">Review</Link>
                  </li>
                ))}
              </ul>
              {stepData.items.length === 0 && <p className="text-zinc-500">None.</p>}
              <button type="button" onClick={() => goNext("W4", 0, 0)} className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm">Next</button>
            </>
          )}
        </div>
      )}

      {/* W4A — Area Health Check */}
      {step === "W4A" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Step 4A: Area Health Check</h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            Scan your responsibilities and ensure each has the right projects.
          </p>
          {loading ? (
            <p className="text-zinc-500">Loading...</p>
          ) : (
            <>
              {Array.isArray((stepData as { items?: unknown[] }).items) && (stepData as { items?: unknown[]; stats?: { needingAttention?: number; zeroActive?: number; stale?: number } }).items?.length === 0 ? (
                <p className="text-zinc-500">No areas of focus. Add them in Settings → Areas of Focus.</p>
              ) : (
                <ul className="space-y-3">
                  {((stepData as { items?: Array<{ id: string; name: string; description?: string | null; activeCount: number; waitingCount: number; onHoldCount: number; lastActivity: string | null; hasZeroActive: boolean; isStale: boolean; onlyWaiting: boolean }> }).items ?? []).map((a) => (
                    <li key={a.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium">{a.name}</span>
                        {a.hasZeroActive && <span className="rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 text-xs">0 Active</span>}
                        {a.isStale && <span className="rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-xs">Stale</span>}
                        {a.onlyWaiting && <span className="rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-xs">Only Waiting</span>}
                        <span className="text-zinc-500 text-sm">
                          Active {a.activeCount} / Waiting {a.waitingCount} / On Hold {a.onHoldCount}
                        </span>
                        {a.lastActivity && (
                          <span className="text-zinc-400 text-xs">
                            Last activity {Math.floor((Date.now() - new Date(a.lastActivity).getTime()) / (24 * 60 * 60 * 1000))}d ago
                          </span>
                        )}
                      </div>
                      {a.description && <p className="text-zinc-500 text-sm mb-2">{a.description}</p>}
                      <div className="flex gap-2">
                        <Link href={`/projects/new?areaId=${a.id}`} className="rounded border px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800">
                          Create project
                        </Link>
                        <Link href={`/projects?area=${encodeURIComponent(a.id)}`} className="rounded border px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800">
                          View projects
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => goNext("W4A", 0, 0)} className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm">
                Next
              </button>
            </>
          )}
        </div>
      )}

      {/* W5 — Someday (optional) */}
      {step === "W5" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Step 5: Someday (optional)</h2>
          {loading ? <p className="text-zinc-500">Loading...</p> : (
            <>
              <ul className="space-y-1">
                {(stepData.items as { id: string; title: string }[]).map((i) => (
                  <li key={i.id}><Link href={`/inbox/clarify/${i.id}`} className="hover:underline">{i.title}</Link></li>
                ))}
              </ul>
              <button type="button" onClick={() => goNext("W5", 0, 0)} className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm">Next</button>
            </>
          )}
        </div>
      )}

      {/* W6 — Deadlines (skip) */}
      {step === "W6" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Step 6: Deadlines (optional)</h2>
          <p className="text-zinc-500 text-sm">Review tasks/projects due in the next 14 days if needed.</p>
          <Link href="/deadlines" className="rounded border px-4 py-2 text-sm inline-block">View deadlines</Link>
          <button type="button" onClick={() => goNext("W6", 0, 0)} className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm ml-2">Skip</button>
        </div>
      )}

      {/* W7 — Weekly focus */}
      {step === "W7" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Step 7: Weekly focus</h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">Pick up to 3 focus projects for this week.</p>
          <ul className="space-y-1">
            {allProjects.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusIds.includes(p.id)}
                    onChange={() => setFocusIds((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : prev.length >= 3 ? prev : [...prev, p.id])}
                    className="rounded"
                  />
                  <span>{p.item?.title ?? p.outcomeStatement ?? "Untitled project"}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={async () => {
              await api.reviews.weeklyPost({ focusProjectIds: focusIds.slice(0, 3) });
              await goNext("W7", 0, 0);
            }}
            className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm"
          >
            Save & Next
          </button>
        </div>
      )}

      {/* W8 — Cleanup (skip) */}
      {step === "W8" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Step 8: Cleanup (optional)</h2>
          <p className="text-zinc-500 text-sm">Archive completed projects/tasks if desired.</p>
          <button type="button" onClick={() => goNext("W8", 0, 0)} className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm">Next</button>
        </div>
      )}

      {/* W9 — Completion */}
      {step === "W9" && (
        <div className="space-y-4">
          <h2 className="font-medium text-zinc-800 dark:text-zinc-200">Weekly review complete</h2>
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

      <p className="mt-6">
        <Link href="/review/daily" className="text-zinc-600 dark:text-zinc-400 hover:underline mr-4">Daily check</Link>
        <Link href="/" className="text-zinc-600 dark:text-zinc-400 hover:underline">Back to Now</Link>
      </p>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading...</p>}>
      <ReviewContent />
    </Suspense>
  );
}
