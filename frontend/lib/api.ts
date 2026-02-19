export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type AuthUser = { id: string; email: string; name: string | null; theme?: string | null };

/** Signal session expired and throw a user-friendly error. Use when any API returns 401. */
function throwIfUnauthorized(res: Response): void {
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("session-expired"));
    }
    throw new Error("Session expired. Please log in again.");
  }
}

/** Parse error from a non-ok response; avoids "Unexpected end of JSON input" when body is empty or not JSON. */
async function parseAuthError(res: Response, fallback: string): Promise<never> {
  const text = await res.text();
  try {
    const b = JSON.parse(text) as { error?: string };
    throw new Error(b.error || fallback);
  } catch (e) {
    if (e instanceof SyntaxError || (e instanceof Error && e.message.includes("JSON")))
      throw new Error("Server error");
    throw e;
  }
}

export const authApi = {
  me: (): Promise<{ user: AuthUser }> =>
    fetch(`${API_URL}/auth/me`, { credentials: "include" }).then((r) => {
      if (!r.ok) throw new Error("Not authenticated");
      return r.json();
    }),
  login: (email: string, password: string): Promise<{ user: AuthUser }> =>
    fetch(`${API_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(async (r) => {
      if (!r.ok) await parseAuthError(r, "Login failed");
      return r.json();
    }),
  register: (email: string, password: string, name?: string): Promise<{ user: AuthUser }> =>
    fetch(`${API_URL}/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    }).then(async (r) => {
      if (!r.ok) await parseAuthError(r, "Registration failed");
      return r.json();
    }),
  logout: (): Promise<void> =>
    fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }).then((r) => {
      if (!r.ok) throw new Error("Logout failed");
    }),
  changePassword: (currentPassword: string, newPassword: string): Promise<void> =>
    fetch(`${API_URL}/auth/change-password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    }).then(async (r) => {
      if (!r.ok) await parseAuthError(r, "Change password failed");
    }),
  patchMe: (data: { theme?: string; name?: string }): Promise<{ user: AuthUser }> =>
    fetch(`${API_URL}/auth/me`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (r) => {
      if (!r.ok) await parseAuthError(r, "Update failed");
      return r.json();
    }),
};

/** Resolve attachment URL (backend may return path like /uploads/xxx). */
export function getAttachmentUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${API_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

async function fetchApi<T>(
  path: string,
  options?: RequestInit & { params?: Record<string, string | number | undefined> }
): Promise<T> {
  const { params, ...rest } = options ?? {};
  let url = `${API_URL}${path}`;
  if (params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") search.set(k, String(v));
    }
    const q = search.toString();
    if (q) url += (path.includes("?") ? "&" : "?") + q;
  }
  const res = await fetch(url, {
    ...rest,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...rest.headers },
  });
  if (!res.ok) {
    throwIfUnauthorized(res);
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string; reason?: string }).error || (err as { reason?: string }).reason || res.statusText);
  }
  return res.json() as Promise<T>;
}

export type Attachment = {
  type?: "file" | "image";
  storageKey: string;
  url: string;
  filename: string;
  mimeType?: string;
  size?: number;
};

export type Reminder = {
  id: string;
  itemId: string | null;
  dueAt: string;
  kind: string;
  createdAt: string;
};

export type Item = {
  id: string;
  title: string;
  body: string;
  type: string;
  state: string;
  source: string;
  waitingOn?: string | null;
  waitingSince?: string | null;
  attachments?: Attachment[] | null;
  createdAt: string;
  updatedAt: string;
  task?: Task;
  project?: Project;
  artifacts?: Artifact[];
  reminders?: Reminder[];
};

/** Structured error when Gate 1 (valid_next_action) or Gate 2 (completion) blocks a transition. */
export type GateFailure = {
  gate_failed: "valid_next_action" | "completion";
  failures: Array<{ code: string; severity: string; message: string; fieldRef?: string }>;
  missing_inputs: string[];
  suggested_questions?: string[];
};

export type Task = {
  id: string;
  itemId: string | null;
  actionText: string;
  context?: string;
  energy?: string;
  estimatedMinutes?: number;
  dueDate?: string | null;
  projectId?: string | null;
  priority?: number | null;
  status: string;
  snoozedUntil?: string | null;
  pinnedOrder?: number | null;
  manualRank?: number | null;
  unverified?: boolean;
  item: Item | null;
  project?: Project | null;
  validation_failure?: GateFailure;
};

export type ScoreBreakdown = {
  urgency: number;
  importance: number;
  leverage: number;
  staleness: number;
  fit: number;
  friction: number;
  riskPenalty: number;
  total: number;
  overrides?: { pinned: boolean; manualRank: number | null };
};

export type NowResponse = {
  tasks: Task[];
  reasonTags: Record<string, string[]>;
  scoreBreakdowns: Record<string, ScoreBreakdown>;
  excluded: Array<{ task: Task; reason: string }>;
  followUpDue?: Item[];
};

export type ProjectStatus = "CLARIFYING" | "ACTIVE" | "WAITING" | "SOMEDAY" | "ON_HOLD" | "DONE" | "ARCHIVED";

export type Project = {
  id: string;
  itemId: string | null;
  outcomeStatement: string | null;
  status: ProjectStatus;
  nextActionTaskId?: string | null;
  dueDate?: string | null;
  priority?: number | null;
  focusThisWeek: boolean;
  lastProgressAt?: string | null;
  themeTag?: string | null;
  waitingOn?: string | null;
  waitingSince?: string | null;
  followUpAt?: string | null;
  item: Item | null;
  nextActionTask?: Task | null;
  tasks?: Task[];
};

export type Artifact = {
  id: string;
  artifactType: string;
  content?: string | null;
  filePointer?: string | null;
  linkedItemId: string;
  createdAt: string;
};

export type ClassifyResult = {
  suggestedType: string;
  suggestedState: string;
  proposedTitle: string;
  proposedNextAction: string | null;
  proposedQuestions: string[];
  projectOutcome: string | null;
  subtasks: string[];
  metadata: { timeEstimateMinutes?: number; context?: string; energy?: string };
};

export type VerifierResult = {
  status: "PASS" | "FAIL" | "NEEDS_USER";
  failures: Array<{ code: string; severity: string; message: string; fieldRef?: string }>;
  missingInputs: string[];
  vaguenessFlags: string[];
  unverifiableClaims?: string[];
};

export type DeadlineEntry = {
  type: string;
  id: string;
  title: string;
  dueDate: string | null;
  start?: string;
  end?: string;
  allDay?: boolean;
};

export const api = {
  items: {
    list: (state?: string) =>
      fetchApi<Item[]>(state ? `/items?state=${state}` : "/items"),
    get: (id: string) => fetchApi<Item>(`/items/${id}`),
    create: (data: { title: string; body?: string; source?: string; attachments?: Attachment[] }) =>
      fetchApi<Item>("/items", { method: "POST", body: JSON.stringify(data) }),
    patch: (id: string, data: { disposition?: string; title?: string; body?: string }) =>
      fetchApi<Item>(`/items/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    classify: (id: string) =>
      fetchApi<ClassifyResult>(`/items/${id}/classify`, { method: "POST" }),
    addArtifact: (id: string, data: { artifactType: string; content?: string; filePointer?: string }) =>
      fetchApi<Artifact>(`/items/${id}/artifacts`, { method: "POST", body: JSON.stringify(data) }),
    addReminder: (id: string, data: { dueAt: string; kind?: string }) =>
      fetchApi<Reminder>(`/items/${id}/reminders`, { method: "POST", body: JSON.stringify(data) }),
    createFollowUpTask: (id: string) =>
      fetchApi<{ task: Task; item: Item }>(`/items/${id}/create-follow-up-task`, { method: "POST" }),
    dispositionNextAction: async (
      id: string,
      data: { actionText: string; context?: string; energy?: string; estimatedMinutes?: number; dueDate?: string }
    ): Promise<{ success: true; item: Item; task: Task } | { success: false; reason: string; gate_failed?: GateFailure["gate_failed"]; failures?: GateFailure["failures"]; missing_inputs?: string[]; suggested_questions?: string[] }> => {
      const res = await fetch(`${API_URL}/items/${id}/disposition/next_action`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      throwIfUnauthorized(res);
      const body = await res.json();
      if (res.ok) return body as { success: true; item: Item; task: Task };
      return { success: false, ...body } as { success: false; reason: string; gate_failed?: GateFailure["gate_failed"]; failures?: GateFailure["failures"]; missing_inputs?: string[]; suggested_questions?: string[] };
    },
    transition: (id: string, data: { target_state: string; proposed_changes?: Record<string, unknown>; force?: boolean; overrideReason?: string }) =>
      fetchApi<{ success: true; item: Item; task?: Task | null }>(`/items/${id}/transition`, { method: "POST", body: JSON.stringify(data) }),
    dispositionProject: async (
      id: string,
      data: { outcomeStatement: string; nextActionText: string; dueDate?: string }
    ): Promise<{ item: Item; project: Project; task?: Task | null; createdAsClarifying?: boolean; reason?: string }> => {
      const res = await fetch(`${API_URL}/items/${id}/disposition/project`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      throwIfUnauthorized(res);
      const body = await res.json();
      if (!res.ok) throw new Error((body as { reason?: string }).reason || "Failed");
      return body;
    },
  },
  tasks: {
    now: (params?: {
      timeAvailable?: number;
      energy?: string;
      context?: string;
      filterMode?: "strict" | "soft";
    }) => fetchApi<NowResponse>("/tasks/now", { params }),
    get: (id: string) => fetchApi<Task>(`/tasks/${id}`),
    patch: (id: string, data: { pinnedOrder?: number | null; manualRank?: number | null; snoozedUntil?: string | null; actionText?: string; context?: string; energy?: string; estimatedMinutes?: number; dueDate?: string | null; priority?: number }) =>
      fetchApi<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    verify: (id: string) =>
      fetchApi<VerifierResult>(`/tasks/${id}/verify`, { method: "POST" }),
    complete: async (
      id: string,
      options?: { force?: boolean; overrideReason?: string }
    ): Promise<{ ok: boolean; task: Task; projectId?: string; nextActionRequired?: boolean }> => {
      const res = await fetch(`${API_URL}/tasks/${id}/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options ?? {}),
      });
      throwIfUnauthorized(res);
      const body = await res.json();
      if (res.ok) return body as { ok: boolean; task: Task; projectId?: string; nextActionRequired?: boolean };
      const err = new Error((body as { error?: string }).error || "Completion failed") as Error & { gateFailure?: GateFailure };
      err.gateFailure = body as GateFailure & { error?: string };
      throw err;
    },
  },
  projects: {
    list: () => fetchApi<Project[]>("/projects"),
    get: (id: string) => fetchApi<Project>(`/projects/${id}`),
    create: (data: {
      itemId?: string;
      outcomeStatement?: string;
      nextActionText?: string;
      status?: ProjectStatus;
      dueDate?: string;
      priority?: number;
      themeTag?: string;
    }) => fetchApi<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
    patch: (id: string, data: {
      outcomeStatement?: string;
      nextActionTaskId?: string | null;
      nextActionText?: string;
      status?: ProjectStatus;
      dueDate?: string | null;
      priority?: number;
      focusThisWeek?: boolean;
      themeTag?: string | null;
      waitingOn?: string | null;
      waitingSince?: string | null;
      followUpAt?: string | null;
    }) => fetchApi<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    allowedTransitions: (id: string) =>
      fetchApi<{ allowed: ProjectStatus[] }>(`/projects/${id}/allowed-transitions`),
    complete: (id: string, data: { confirmOutcome: boolean; remainingTaskPolicy?: "strict" | "flexible" }) =>
      fetchApi<Project>(`/projects/${id}/complete`, { method: "POST", body: JSON.stringify(data) }),
    assignItem: (projectId: string, itemId: string) =>
      fetchApi<Project>(`/projects/${projectId}/assign`, { method: "POST", body: JSON.stringify({ itemId }) }),
  },
  deadlines: {
    get: () =>
      fetchApi<{
        today: DeadlineEntry[];
        next7: DeadlineEntry[];
        next30: DeadlineEntry[];
      }>("/deadlines"),
  },
  calendars: {
    listSources: () =>
      fetchApi<{ id: string; name: string; kind: string; lastSyncedAt: string | null; createdAt: string }[]>("/calendars/sources"),
    deleteSource: async (id: string): Promise<void> => {
      const res = await fetch(`${API_URL}/calendars/sources/${id}`, { method: "DELETE", credentials: "include" });
      throwIfUnauthorized(res);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
    },
    importIcs: async (file: File, name?: string): Promise<{ sourceId: string; created: number; updated: number; total: number }> => {
      const form = new FormData();
      form.append("ics", file);
      if (name) form.append("name", name);
      const res = await fetch(`${API_URL}/calendars/import`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      throwIfUnauthorized(res);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      return res.json();
    },
    exportUrl: () => `${API_URL}/calendars/export.ics`,
  },
  reviews: {
    daily: () =>
      fetchApi<{
        inboxCount: number;
        overdue: { id: string; title: string; dueDate: string | null }[];
        waitingFollowUps: { id: string; title: string }[];
        projectsWithoutNextAction: number;
        projectsNeedingClarification: { id: string; title: string }[];
      }>("/reviews/daily"),
    weekly: () =>
      fetchApi<{
        inboxCount: number;
        projectsWithoutNextAction: { id: string; title: string; outcomeStatement: string }[];
        projectsNeedingClarification: { id: string; title: string }[];
        waiting: { id: string; title: string }[];
        someday: { id: string; title: string }[];
        focusProjects: { id: string; title: string }[];
      }>("/reviews/weekly"),
    weeklyPost: (data: { focusProjectIds?: string[]; stepsCompleted?: string[] }) =>
      fetchApi<{ ok: boolean }>("/reviews/weekly", { method: "POST", body: JSON.stringify(data) }),
    createSession: (type: "daily" | "weekly") =>
      fetchApi<{ sessionId: string; type: string; startedAt: string }>("/reviews/sessions", {
        method: "POST",
        body: JSON.stringify({ type }),
      }),
    getDailySnapshot: () =>
      fetchApi<{
        inboxCount: number;
        overdueCount: number;
        dueTodayCount: number;
        dueTomorrowCount: number;
        waitingFollowUpsDueCount: number;
        projectsNoNextActionCount: number;
        unverifiedCount: number;
      }>("/reviews/daily/snapshot"),
    getDailyStep: (stepId: string) =>
      fetchApi<{ items: unknown[]; stepId: string }>(`/reviews/daily/step/${stepId}`),
    getWeeklySnapshot: () =>
      fetchApi<{
        inboxCount: number;
        projectsActiveCount: number;
        projectsWaitingCount: number;
        projectsOnHoldCount: number;
        projectsMissingNextActionCount: number;
        waitingMissingFollowUpCount: number;
        somedayCount: number;
        unverifiedCount: number;
        staleTasksCount: number;
      }>("/reviews/weekly/snapshot"),
    getWeeklyStep: (stepId: string) =>
      fetchApi<{ items: unknown[]; stepId: string }>(`/reviews/weekly/step/${stepId}`),
    updateSession: (id: string, data: { stepCompleted?: string; itemsProcessed?: number; itemsSkipped?: number; completedAt?: string | null }) =>
      fetchApi<{ ok: boolean }>(`/reviews/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },
  intake: {
    upload: async (files: File[]): Promise<{ uploads: Attachment[] }> => {
      const form = new FormData();
      files.forEach((f) => form.append("file", f));
      const res = await fetch(`${API_URL}/intake/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      throwIfUnauthorized(res);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      return res.json();
    },
    create: (data: { title: string; body?: string; source?: string; attachments?: Attachment[] }) =>
      fetchApi<Item>("/intake", { method: "POST", body: JSON.stringify(data) }),
  },
};
