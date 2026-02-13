"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { api, type Project, type ProjectStatus } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function ProjectDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const nextActionRequired = searchParams.get("nextActionRequired") === "1";
  const createdAsClarifying = searchParams.get("clarifying") === "1";
  const [project, setProject] = useState<Project | null>(null);
  const [allowedStatuses, setAllowedStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusToggleLoading, setFocusToggleLoading] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [inboxItems, setInboxItems] = useState<{ id: string; title: string }[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [markDoneModal, setMarkDoneModal] = useState(false);
  const [markDoneConfirm, setMarkDoneConfirm] = useState(false);
  const [markDoneLoading, setMarkDoneLoading] = useState(false);
  const [markDoneError, setMarkDoneError] = useState<string | null>(null);

  const fetchProject = useCallback(() => {
    if (!id) return;
    api.projects.get(id).then(setProject).catch(() => setProject(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.projects
      .get(id)
      .then((p) => {
        setProject(p);
        return api.projects.allowedTransitions(id);
      })
      .then((r) => setAllowedStatuses(r.allowed))
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (assignModal) {
      api.items.list("INBOX").then((list) => setInboxItems(list.map((i) => ({ id: i.id, title: i.title }))));
    }
  }, [assignModal]);

  const toggleFocus = async () => {
    if (!project) return;
    setFocusToggleLoading(true);
    try {
      await api.projects.patch(id, { focusThisWeek: !project.focusThisWeek });
      setProject((p) => (p ? { ...p, focusThisWeek: !p.focusThisWeek } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setFocusToggleLoading(false);
    }
  };

  const handleAssignItem = async (itemId: string) => {
    setAssigning(true);
    try {
      await api.projects.assignItem(project!.id, itemId);
      setAssignModal(false);
      fetchProject();
      toast.success("Item assigned to project");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Assign failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!project) return;
    try {
      await api.projects.patch(id, { status: newStatus });
      setProject((p) => (p ? { ...p, status: newStatus } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleThemeTagChange = async (value: string) => {
    if (!project) return;
    try {
      await api.projects.patch(id, { themeTag: value || null });
      setProject((p) => (p ? { ...p, themeTag: value || null } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleMarkDone = async () => {
    if (!project || !markDoneConfirm) return;
    setMarkDoneLoading(true);
    setMarkDoneError(null);
    try {
      const updated = await api.projects.complete(id, {
        confirmOutcome: true,
        remainingTaskPolicy: "flexible",
      });
      setProject(updated);
      setMarkDoneModal(false);
      setMarkDoneConfirm(false);
      const res = await api.projects.allowedTransitions(id);
      setAllowedStatuses(res.allowed);
      toast.success("Project marked done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to mark done";
      setMarkDoneError(msg);
      toast.error(msg);
    } finally {
      setMarkDoneLoading(false);
    }
  };

  if (loading) return <p className="text-zinc-500">Loading...</p>;
  if (error || !project) {
    return (
      <div>
        <p className="text-red-600 dark:text-red-400">{error || "Not found"}</p>
        <Link href="/projects" className="underline mt-2 inline-block">Back to Projects</Link>
      </div>
    );
  }

  const title = project.item?.title ?? project.outcomeStatement ?? "Untitled project";
  const nextAction = project.nextActionTask;
  const hasNoNextAction = !project.nextActionTaskId;
  const remainingTasks = project.tasks?.filter((t) => t.status !== "completed") ?? [];
  const statusOptions =
    allowedStatuses.length > 0
      ? [project.status, ...allowedStatuses.filter((s) => s !== project.status)]
      : [project.status];

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Project: {title}
        </h1>
        <Link href="/projects" className="text-zinc-600 dark:text-zinc-400 hover:underline">
          Back to Projects
        </Link>
      </div>

      {(nextActionRequired || (project.status === "ACTIVE" && hasNoNextAction)) && (
        <div className="mb-4 p-3 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Next action required</p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
            Set a new next action, or mark this project Done / On Hold.
          </p>
        </div>
      )}

      {(project.status === "CLARIFYING" || createdAsClarifying) && (
        <div className="mb-4 p-3 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
            {createdAsClarifying ? "Created as Needs clarification" : "Needs clarification"}
          </p>
          <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
            {(!project.outcomeStatement || !project.outcomeStatement.trim()) && <li>Add an outcome statement (min 10 characters for ACTIVE)</li>}
            {!project.nextActionTaskId && <li>Add at least one valid next action (verb first, concrete)</li>}
          </ul>
        </div>
      )}

      {!project.itemId && (
        <div className="mb-4 p-3 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">No inbox item assigned yet.</p>
          <button
            type="button"
            onClick={() => setAssignModal(true)}
            className="rounded bg-amber-700 dark:bg-amber-600 text-white px-3 py-1 text-sm"
          >
            Assign from inbox
          </button>
        </div>
      )}

      <Dialog open={assignModal} onOpenChange={(open) => { if (!open && !assigning) setAssignModal(false); }}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Choose an inbox item to assign</DialogTitle>
          </DialogHeader>
          {inboxItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">No items in inbox.</p>
          ) : (
            <ul className="space-y-1 max-h-60 overflow-auto">
              {inboxItems.map((i) => (
                <li key={i.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => handleAssignItem(i.id)}
                    disabled={assigning}
                  >
                    {i.title}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <dl className="space-y-3 mb-6">
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Outcome</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{project.outcomeStatement ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Status</dt>
          <dd>
            <select
              value={project.status}
              onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
              className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-100"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Theme tag</dt>
          <dd>
            <input
              type="text"
              defaultValue={project.themeTag ?? ""}
              onBlur={(e) => handleThemeTagChange(e.target.value.trim())}
              placeholder="e.g. Ireland, cashflow"
              className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-100 w-48"
            />
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Due date</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">
            {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "Optional"}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Focus</dt>
          <dd>
            <button
              type="button"
              onClick={toggleFocus}
              disabled={focusToggleLoading}
              className="rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1 text-sm"
            >
              {project.focusThisWeek ? "Unfocus" : "Focus this week"}
            </button>
          </dd>
        </div>
        {project.lastProgressAt && (
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Last progress</dt>
            <dd className="text-zinc-900 dark:text-zinc-100 text-sm">
              {new Date(project.lastProgressAt).toLocaleDateString()}
            </dd>
          </div>
        )}
      </dl>

      {project.status !== "DONE" && project.status !== "ARCHIVED" && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setMarkDoneModal(true)}
            className="rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm"
          >
            Mark project done
          </button>
        </div>
      )}

      <Dialog open={markDoneModal} onOpenChange={(open) => { if (!open && !markDoneLoading) setMarkDoneModal(false); }}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Mark project done</DialogTitle>
          </DialogHeader>
          {remainingTasks.length > 0 && (
            <p className="text-muted-foreground text-sm">
              This project has {remainingTasks.length} open task(s). You can mark the project done and resolve or archive them later (flexible policy).
            </p>
          )}
          <div className="flex items-center gap-2 space-y-0">
            <input
              id="mark-done-confirm"
              type="checkbox"
              checked={markDoneConfirm}
              onChange={(e) => setMarkDoneConfirm(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="mark-done-confirm" className="text-sm font-normal cursor-pointer">
              I confirm the outcome is achieved
            </Label>
          </div>
          {markDoneError && <p className="text-destructive text-sm">{markDoneError}</p>}
          <DialogFooter>
            <Button
              onClick={handleMarkDone}
              disabled={markDoneLoading || !markDoneConfirm}
            >
              {markDoneLoading ? "Saving…" : "Mark done"}
            </Button>
            <Button variant="outline" onClick={() => setMarkDoneModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">
        Next Action {project.status === "ACTIVE" ? "(required)" : ""}
      </h2>
      {hasNoNextAction && project.status === "ACTIVE" ? (
        <p className="text-amber-600 dark:text-amber-400 text-sm mb-2">
          This project needs a next action before it can be active.
        </p>
      ) : nextAction ? (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 mb-4">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {nextAction.actionText}
          </p>
          {(nextAction.estimatedMinutes || nextAction.context) && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {nextAction.estimatedMinutes && `~${nextAction.estimatedMinutes} min`}
              {nextAction.context && ` · ${nextAction.context}`}
            </p>
          )}
          {nextAction.itemId ? (
            <Link
              href={`/tasks/${nextAction.id}/complete`}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
            >
              Edit / Complete
            </Link>
          ) : (
            <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
              See in Now
            </Link>
          )}
        </div>
      ) : null}

      <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">
        Task list
      </h2>
      {project.tasks && project.tasks.length > 0 ? (
        <ul className="space-y-2">
          {project.tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <span className={t.id === project.nextActionTaskId ? "font-medium" : ""}>
                {t.actionText}
                {t.id === project.nextActionTaskId && " (next)"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">No tasks yet.</p>
      )}
    </div>
  );
}
