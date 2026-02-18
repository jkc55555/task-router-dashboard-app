"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { api, getAttachmentUrl, type Item, type ClassifyResult } from "@/lib/api";
import { DispositionButtons } from "@/components/DispositionButtons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function InboxContent() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const reviewWeekly = searchParams.get("review") === "weekly";
  const sessionId = searchParams.get("sessionId");
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classifyMap, setClassifyMap] = useState<Record<string, ClassifyResult>>({});
  const [loadingClassify, setLoadingClassify] = useState<Record<string, boolean>>({});
  const [assignToProjectItemId, setAssignToProjectItemId] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; outcomeStatement: string | null; itemId: string | null }[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.items.list("INBOX");
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const classify = async (id: string) => {
    setLoadingClassify((p) => ({ ...p, [id]: true }));
    try {
      const result = await api.items.classify(id);
      setClassifyMap((m) => ({ ...m, [id]: result }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classify failed");
    } finally {
      setLoadingClassify((p) => ({ ...p, [id]: false }));
    }
  };

  const setDisposition = async (
    id: string,
    disposition: "waiting" | "someday" | "reference" | "trash"
  ) => {
    try {
      await api.items.patch(id, { disposition });
      fetchInbox();
      toast.success("Item updated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleNextAction = (itemId: string) => {
    const c = classifyMap[itemId];
    if (c?.proposedNextAction) {
      api.items
        .dispositionNextAction(itemId, {
          actionText: c.proposedNextAction,
          context: c.metadata?.context,
          energy: c.metadata?.energy,
          estimatedMinutes: c.metadata?.timeEstimateMinutes,
        })
        .then((result) => {
          if (result.success) {
            fetchInbox();
            toast.success("Next action created");
          } else {
            if (result.gate_failed === "valid_next_action") {
              try {
                sessionStorage.setItem(
                  `gateFailure_${itemId}`,
                  JSON.stringify({
                    failures: result.failures ?? [],
                    missing_inputs: result.missing_inputs ?? [],
                    suggested_questions: result.suggested_questions ?? [],
                    reason: result.reason,
                  })
                );
              } catch (_) {}
              window.location.href = `/inbox/disposition?itemId=${itemId}&type=next_action`;
            } else {
              setError(result.reason || "Validation failed.");
            }
          }
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : "Failed";
          setError(msg);
          toast.error(msg);
        });
    } else {
      window.location.href = `/inbox/disposition?itemId=${itemId}&type=next_action`;
    }
  };

  const handleProject = (itemId: string) => {
    const c = classifyMap[itemId];
    if (c?.projectOutcome && c?.proposedNextAction) {
      api.items
        .dispositionProject(itemId, {
          outcomeStatement: c.projectOutcome,
          nextActionText: c.proposedNextAction,
        })
        .then(() => {
          fetchInbox();
          toast.success("Project created");
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : "Failed";
          setError(msg);
          toast.error(msg);
        });
    } else {
      window.location.href = `/inbox/disposition?itemId=${itemId}&type=project`;
    }
  };

  const openAssignToProject = (itemId: string) => {
    setAssignToProjectItemId(itemId);
    api.projects.list().then((list) =>
      setProjects(list.map((p) => ({ id: p.id, outcomeStatement: p.outcomeStatement, itemId: p.itemId })))
    );
  };

  const handleAssignToProject = async (projectId: string) => {
    if (!assignToProjectItemId) return;
    setAssigning(true);
    try {
      await api.projects.assignItem(projectId, assignToProjectItemId);
      setAssignToProjectItemId(null);
      fetchInbox();
      toast.success("Item assigned to project");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Assign failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Inbox
        </h1>
        {reviewWeekly && sessionId && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {items.length} item{items.length !== 1 ? "s" : ""} left
          </span>
        )}
      </div>

      {reviewWeekly && sessionId && (
        <div className="mb-4 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">Weekly review — clear inbox to zero, then continue.</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await api.reviews.updateSession(sessionId, { stepCompleted: "W2" });
                router.push(`/review?step=W3&sessionId=${sessionId}`);
              } catch (_) {}
            }}
            className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium"
          >
            Done with inbox → Next
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">Inbox zero.</p>
      ) : (
        <ul className="space-y-6">
          {items.map((item) => {
            const c = classifyMap[item.id];
            const loadingC = loadingClassify[item.id];
            const needsClarify = c?.proposedQuestions?.length;
            return (
              <li
                key={item.id}
                id={focusId === item.id ? "focus" : undefined}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                  {item.title}
                </div>
                {item.body && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap mb-3">
                    {item.body.slice(0, 300)}
                    {item.body.length > 300 ? "..." : ""}
                  </p>
                )}
                {item.attachments && item.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {item.attachments.map((a, i) => (
                      <a
                        key={i}
                        href={getAttachmentUrl(a.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        📎 {a.filename}
                      </a>
                    ))}
                  </div>
                )}
                {!c && !loadingC && (
                  <button
                    type="button"
                    onClick={() => classify(item.id)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-3"
                  >
                    Get AI suggestion
                  </button>
                )}
                {loadingC && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                    Classifying...
                  </p>
                )}
                {c && !loadingC && (
                  <div className="mb-3 text-sm">
                    <p className="text-zinc-600 dark:text-zinc-400">
                      AI thinks this is: <strong>{c.suggestedType}</strong>
                      {c.proposedNextAction && (
                        <> · Suggested next action: {c.proposedNextAction}</>
                      )}
                      {c.projectOutcome && (
                        <> · Proposed outcome: {c.projectOutcome}</>
                      )}
                    </p>
                    {needsClarify ? (
                      <p className="mt-2 text-zinc-500">
                        This needs clarification: {c.proposedQuestions?.join(" ")}
                      </p>
                    ) : null}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Link
                    href={`/inbox/clarify/${item.id}`}
                    className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium hover:opacity-90"
                  >
                    Clarify
                  </Link>
                  <DispositionButtons
                    itemId={item.id}
                    onNextAction={() => handleNextAction(item.id)}
                    onProject={() => handleProject(item.id)}
                    onWaiting={() => setDisposition(item.id, "waiting")}
                    onSomeday={() => setDisposition(item.id, "someday")}
                    onReference={() => setDisposition(item.id, "reference")}
                    onTrash={() => setDisposition(item.id, "trash")}
                    onEditSuggestion={() => classify(item.id)}
                    showAskMe={!!c}
                    onAskLater={() => {}}
                    showAnswerQuestions={!!needsClarify}
                    onAnswerQuestions={() => {}}
                  />
                  <button
                    type="button"
                    onClick={() => openAssignToProject(item.id)}
                    className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline"
                  >
                    Assign to project
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!assignToProjectItemId} onOpenChange={(open) => { if (!open && !assigning) setAssignToProjectItemId(null); }}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Assign to which project?</DialogTitle>
          </DialogHeader>
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-sm">No projects. Create one from Projects.</p>
          ) : (
            <ul className="space-y-1 max-h-60 overflow-auto">
              {projects.filter((p) => !p.itemId).map((p) => (
                <li key={p.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => handleAssignToProject(p.id)}
                    disabled={assigning}
                  >
                    {p.outcomeStatement ?? "Untitled project"}
                  </Button>
                </li>
              ))}
              {projects.filter((p) => !p.itemId).length === 0 && projects.length > 0 && (
                <p className="text-muted-foreground text-sm">All projects already have an item. Create a new project first.</p>
              )}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignToProjectItemId(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-4 text-zinc-500 dark:text-zinc-400 text-sm">
        <Link href="/" className="underline">Now</Link> · <Link href="/deadlines" className="underline">Deadlines</Link> · <Link href="/projects" className="underline">Projects</Link>
      </p>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading...</p>}>
      <InboxContent />
    </Suspense>
  );
}
