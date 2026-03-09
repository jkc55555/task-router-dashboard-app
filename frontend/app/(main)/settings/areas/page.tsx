"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, type AreaOfFocus } from "@/lib/api";

export default function AreasSettingsPage() {
  const [areas, setAreas] = useState<AreaOfFocus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("");

  const load = () => {
    setLoading(true);
    api.areas
      .list(showArchived)
      .then(setAreas)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [showArchived]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    try {
      await api.areas.create({ name, description: newDesc.trim() || undefined, color: newColor.trim() || undefined });
      toast.success("Area created");
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      setNewColor("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await api.areas.patch(editingId, { name: editName.trim(), description: editDesc.trim() || null });
      toast.success("Area updated");
      setEditingId(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Archive "${name}"? Projects in this area will become unassigned.`)) return;
    try {
      await api.areas.archive(id);
      toast.success("Area archived");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to archive");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await api.areas.restore(id);
      toast.success("Area restored");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to restore");
    }
  };

  const startEdit = (a: AreaOfFocus) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditDesc(a.description ?? "");
  };

  const activeAreas = areas.filter((a) => !a.archivedAt);
  const archivedAreas = areas.filter((a) => a.archivedAt);

  return (
    <div>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
        Areas of Focus are ongoing responsibilities. They support reflection and Weekly Review—they do not appear in Now or Inbox.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded"
          />
          Show archived
        </label>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium"
        >
          + New area
        </button>
      </div>

      {createOpen && (
        <form onSubmit={handleCreate} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 mb-4">
          <h3 className="font-medium mb-2">New area</h3>
          <div className="space-y-2 mb-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (required)"
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-background px-3 py-2 text-sm"
              required
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-background px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              placeholder="Color (optional, e.g. #3b82f6)"
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-sm">
              Create
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : (
        <ul className="space-y-2">
          {activeAreas.map((a) => (
            <li key={a.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 flex items-center justify-between gap-4">
              {editingId === a.id ? (
                <>
                  <div className="flex-1 min-w-0 space-y-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-background px-2 py-1 text-sm"
                    />
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description"
                      className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-background px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleSaveEdit} className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-2 py-1 text-xs">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded border px-2 py-1 text-xs">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="font-medium">{a.name}</span>
                    {a.description && <span className="text-zinc-500 text-sm ml-2">{a.description}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(a)} className="rounded border px-2 py-1 text-xs">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleArchive(a.id, a.name)} className="rounded border border-amber-500 text-amber-600 dark:text-amber-400 px-2 py-1 text-xs">
                      Archive
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
          {showArchived && archivedAreas.map((a) => (
            <li key={a.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 flex items-center justify-between gap-4 opacity-70">
              <span className="text-zinc-500">{a.name}</span>
              <button type="button" onClick={() => handleRestore(a.id)} className="rounded border px-2 py-1 text-xs">
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && areas.length === 0 && (
        <p className="text-zinc-500 text-sm">No areas yet. Create one to organize projects by responsibility.</p>
      )}
    </div>
  );
}
