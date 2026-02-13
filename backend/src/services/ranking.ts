import type { Task, Item, Project } from "@prisma/client";
import { getNowRankingConfig } from "../lib/now-ranking-config";

type ProjectWithTasks = Project & { tasks?: { id: string }[] };

export type TaskWithRelations = Task & {
  item: Item | null;
  project: Project | null;
  projectNextAction?: ProjectWithTasks | null;
  manualRank?: number | null;
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

export type RankedTask = {
  task: TaskWithRelations;
  score: number;
  reasonTags: string[];
  scoreBreakdown: ScoreBreakdown;
};

export type ExcludedTask = {
  task: TaskWithRelations;
  reason: string;
};

function hoursFromNow(d: Date | null): number | null {
  if (!d) return null;
  return (d.getTime() - Date.now()) / (60 * 60 * 1000);
}

function daysFromNow(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function daysSince(d: Date): number {
  return (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
}

/** Map task priority (0-10) to importance score 0-10 using config. */
function taskPriorityScore(priority: number | null, config: ReturnType<typeof getNowRankingConfig>): number {
  const map = config.importance.task_priority_map;
  if (priority == null) return 0;
  if (priority <= 2) return map.low ?? 2;
  if (priority <= 5) return map.normal ?? 5;
  if (priority <= 8) return map.high ?? 8;
  return map.critical ?? 10;
}

/** Urgency 0-40 from task due date; if none, from project due date capped at project_cap. */
function scoreUrgency(
  task: TaskWithRelations,
  config: ReturnType<typeof getNowRankingConfig>
): number {
  const u = config.urgency;
  const w = config.weights.urgency;
  let dueDate: Date | null = task.dueDate;
  let cap = 40;
  if (!dueDate && task.project) {
    dueDate = task.project.dueDate;
    cap = config.urgency.project_cap;
  }
  const hours = dueDate ? hoursFromNow(dueDate) : null;
  if (hours === null) return 0;
  if (hours < 0) return w * Math.min(u.overdue, cap);
  if (hours <= 24) return w * Math.min(u.due_24h, cap);
  if (hours <= 48) return w * Math.min(u.due_48h, cap);
  const days = Math.ceil(hours / 24);
  if (days <= 7) return w * Math.min(u.due_7d, cap);
  if (days <= 30) return w * Math.min(u.due_30d, cap);
  return w * Math.min(u.else, cap);
}

/** Importance 0-20: task priority (0-10) + project priority (0-8) + focus bonus. */
function scoreImportance(
  task: TaskWithRelations,
  config: ReturnType<typeof getNowRankingConfig>
): number {
  const w = config.weights.importance;
  let s = taskPriorityScore(task.priority ?? 0, config);
  const proj = task.project;
  if (proj) {
    const projP = Math.min(config.importance.project_priority_max, proj.priority ?? 0);
    s += projP;
    if (proj.focusThisWeek) s += config.importance.focus_bonus;
  }
  return w * Math.min(20, s);
}

/** Leverage 0-20 from blocked dependents (project tasks when this is next action). */
function scoreLeverage(
  task: TaskWithRelations,
  config: ReturnType<typeof getNowRankingConfig>
): number {
  const w = config.weights.leverage;
  const proj = task.projectNextAction as ProjectWithTasks | undefined;
  const count = proj?.tasks?.length ?? 0;
  const blocked = Math.max(0, count - 1);
  let score = 0;
  if (blocked >= 7) score = config.leverage.dependents_map["7+"] ?? 20;
  else if (blocked >= 4) score = config.leverage.dependents_map["4-6"] ?? 15;
  else if (blocked >= 2) score = config.leverage.dependents_map["2-3"] ?? 10;
  else if (blocked === 1) score = config.leverage.dependents_map["1"] ?? 5;
  return w * score;
}

/** Staleness 0-15 from days since touched; +project_stalled_bonus if project stalled. */
function scoreStaleness(
  task: TaskWithRelations,
  config: ReturnType<typeof getNowRankingConfig>
): number {
  const w = config.weights.staleness;
  const touched = task.updatedAt ?? task.createdAt;
  const days = daysSince(touched);
  const bins = config.staleness.bins;
  let score = 0;
  for (const bin of bins) {
    if (days <= bin.days_max) {
      score = bin.score;
      break;
    }
  }
  const proj = task.project;
  if (proj?.lastProgressAt) {
    const projectDays = daysSince(proj.lastProgressAt);
    if (projectDays > config.staleness.project_stalled_days) {
      score += config.staleness.project_stalled_bonus;
    }
  }
  return w * Math.min(15, score);
}

/** Fit -15 to +15 from time/context/energy filters. */
function scoreFit(
  task: TaskWithRelations,
  filters: { timeAvailable?: number; energy?: string; context?: string },
  config: ReturnType<typeof getNowRankingConfig>
): number {
  const w = config.weights.fit;
  if (!filters || (!filters.timeAvailable && !filters.energy && !filters.context)) {
    return 0;
  }
  let fit = 0;
  if (filters.timeAvailable && task.estimatedMinutes != null) {
    const avail = filters.timeAvailable;
    if (task.estimatedMinutes <= avail) fit += config.fit.time.fits;
    else if (task.estimatedMinutes <= avail * 1.25) fit += config.fit.time.near_fits;
    else fit += config.fit.time.over;
  }
  if (filters.context && task.context != null) {
    if (task.context === filters.context) fit += config.fit.context.match;
    else fit += config.fit.context.mismatch;
  }
  if (filters.energy && task.energy != null) {
    const order = ["low", "medium", "high"];
    const taskIdx = order.indexOf(task.energy);
    const filterIdx = order.indexOf(filters.energy);
    if (taskIdx === filterIdx) fit += config.fit.energy.match;
    else if (Math.abs(taskIdx - filterIdx) === 1) fit += config.fit.energy.off_by_one;
    else fit += config.fit.energy.extreme_mismatch;
  }
  return w * fit;
}

/** Friction 0-10 penalty by estimate bins. */
function scoreFriction(
  task: TaskWithRelations,
  config: ReturnType<typeof getNowRankingConfig>
): number {
  const w = config.weights.friction;
  const min = task.estimatedMinutes ?? 0;
  const bins = config.friction.bins;
  let penalty = 0;
  for (const bin of bins) {
    if (min <= bin.minutes_max) {
      penalty = bin.penalty;
      break;
    }
  }
  return w * penalty;
}

/** Risk penalty: unverified + optional missing metadata. */
function scoreRisk(
  task: TaskWithRelations,
  config: ReturnType<typeof getNowRankingConfig>
): number {
  const w = config.weights.risk;
  let penalty = 0;
  if (task.unverified) penalty += config.risk.unverified_penalty;
  return w * penalty;
}

function computeScoreAndBreakdown(
  task: TaskWithRelations,
  filters: { timeAvailable?: number; energy?: string; context?: string } | undefined,
  config: ReturnType<typeof getNowRankingConfig>
): { total: number; breakdown: ScoreBreakdown } {
  const urgency = scoreUrgency(task, config);
  const importance = scoreImportance(task, config);
  const leverage = scoreLeverage(task, config);
  const staleness = scoreStaleness(task, config);
  const fit = scoreFit(task, filters ?? {}, config);
  const friction = scoreFriction(task, config);
  const riskPenalty = scoreRisk(task, config);
  const total = urgency + importance + leverage + staleness + fit - friction - riskPenalty;
  const breakdown: ScoreBreakdown = {
    urgency,
    importance,
    leverage,
    staleness,
    fit,
    friction,
    riskPenalty,
    total,
    overrides: {
      pinned: task.pinnedOrder != null,
      manualRank: (task as TaskWithRelations).manualRank ?? null,
    },
  };
  return { total, breakdown };
}

/** Should this task be excluded in strict mode due to filters? */
function isExcludedByStrictFilters(
  task: TaskWithRelations,
  filters: { timeAvailable?: number; energy?: string; context?: string }
): string | null {
  if (filters.timeAvailable && task.estimatedMinutes != null && task.estimatedMinutes > filters.timeAvailable) {
    return `Time: needs ${task.estimatedMinutes} min`;
  }
  if (filters.energy && task.energy != null && task.energy !== filters.energy) {
    return `Energy: doesn't match ${filters.energy}`;
  }
  if (filters.context && task.context != null && task.context !== filters.context) {
    return `Context: doesn't match ${filters.context}`;
  }
  return null;
}

const CONTEXT_LABELS: Record<string, string> = {
  calls: "Calls",
  errands: "Errands",
  computer: "Computer",
  deep_work: "Deep work",
};

/** Build reason tags by config priority order; max_tags. */
function getReasonTags(
  task: TaskWithRelations,
  config: ReturnType<typeof getNowRankingConfig>
): string[] {
  const maxTags = config.tags.max_tags;
  const order = config.tags.priority_order;
  let tags: string[] = [];
  const dueDays = task.dueDate ? daysFromNow(task.dueDate) : null;
  const proj = task.projectNextAction as ProjectWithTasks | undefined;
  const blocked = Math.max(0, (proj?.tasks?.length ?? 0) - 1);
  const touched = task.updatedAt ?? task.createdAt;
  const daysSinceTouched = daysSince(touched);
  const project = task.project;

  const candidates: Array<{ key: string; label: string }> = [];

  if (dueDays !== null) {
    if (dueDays < 0) candidates.push({ key: "overdue", label: "Overdue" });
    else if (dueDays === 0) candidates.push({ key: "due_today", label: "Due today" });
    else if (dueDays === 1) candidates.push({ key: "due_tomorrow", label: "Due tomorrow" });
    else if (dueDays <= 2) candidates.push({ key: "due_in_2_days", label: "Due in 2 days" });
    else if (dueDays <= 7) candidates.push({ key: "due_this_week", label: "Due this week" });
    else if (dueDays <= 30) candidates.push({ key: "due_soon", label: "Due soon" });
  }
  if (blocked >= 1) {
    if (blocked >= 7) candidates.push({ key: "unblocks", label: `Unblocks 7+ tasks` });
    else if (blocked >= 3) candidates.push({ key: "unblocks", label: `Unblocks ${blocked} tasks` });
    else candidates.push({ key: "unblocks", label: `Unblocks ${blocked} task` });
  }
  if (project?.focusThisWeek) candidates.push({ key: "focus_project", label: "Focus project" });
  if (project?.dueDate && daysFromNow(project.dueDate) != null && (daysFromNow(project.dueDate) ?? 999) <= 7) {
    candidates.push({ key: "project_due_soon", label: "Project due soon" });
  }
  if (project?.lastProgressAt && daysSince(project.lastProgressAt) > config.staleness.project_stalled_days) {
    candidates.push({ key: "project_stalled", label: "Project stalled" });
  }
  if (daysSinceTouched >= 30) candidates.push({ key: "stale", label: "Stale 30+ days" });
  else if (daysSinceTouched >= 14) candidates.push({ key: "stale", label: "Stale 2+ weeks" });
  else if (daysSinceTouched >= 7) candidates.push({ key: "stale", label: "Ignored 7 days" });
  if (task.estimatedMinutes != null) {
    if (task.estimatedMinutes <= 10) candidates.push({ key: "fit", label: "Fits 10 min" });
    else if (task.estimatedMinutes <= 30) candidates.push({ key: "fit", label: "Fits 30 min" });
  }
  if (task.context) {
    candidates.push({ key: "fit", label: `Matches ${CONTEXT_LABELS[task.context] ?? task.context}` });
  }
  if (task.unverified) candidates.push({ key: "needs_review", label: "Needs review" });

  for (const key of order) {
    const c = candidates.find((x) => x.key === key || (key === "unblocks" && x.key === "unblocks"));
    if (c && !tags.includes(c.label)) {
      tags.push(c.label);
      if (tags.length >= maxTags) break;
    }
  }
  if (task.unverified && !tags.includes("Needs review")) {
    tags = ["Needs review", ...tags.filter((t) => t !== "Needs review")].slice(0, maxTags);
  }
  return tags;
}

export type RankAndTagOptions = {
  filters?: { timeAvailable?: number; energy?: string; context?: string };
  filterMode?: "strict" | "soft";
};

export function rankAndTag(
  tasks: TaskWithRelations[],
  options: RankAndTagOptions = {}
): { ranked: RankedTask[]; excluded: ExcludedTask[] } {
  const config = getNowRankingConfig();
  const filters = options.filters;
  const filterMode = options.filterMode ?? config.filters.mode;
  const now = new Date();

  const eligible = tasks.filter((t) => {
    if (t.snoozedUntil && t.snoozedUntil > now) return false;
    return true;
  });

  const excluded: ExcludedTask[] = [];
  let toScore: TaskWithRelations[];

  if (filterMode === "strict" && filters && (filters.timeAvailable || filters.energy || filters.context)) {
    toScore = [];
    for (const task of eligible) {
      const reason = isExcludedByStrictFilters(task, filters);
      if (reason) {
        excluded.push({ task, reason });
      } else {
        toScore.push(task);
      }
    }
  } else {
    toScore = [...eligible];
  }

  const withScores: RankedTask[] = toScore.map((task) => {
    const { total, breakdown } = computeScoreAndBreakdown(task, filters, config);
    const reasonTags = getReasonTags(task, config);
    return {
      task,
      score: total,
      reasonTags,
      scoreBreakdown: breakdown,
    };
  });

  withScores.sort((a, b) => {
    const pinA = a.task.pinnedOrder ?? 9999;
    const pinB = b.task.pinnedOrder ?? 9999;
    if (pinA !== pinB) return pinA - pinB;
    const manualA = (a.task as TaskWithRelations).manualRank ?? 999999;
    const manualB = (b.task as TaskWithRelations).manualRank ?? 999999;
    if (manualA !== manualB) return manualA - manualB;
    if (b.score !== a.score) return b.score - a.score;
    const dueA = a.task.dueDate?.getTime() ?? 9999999999999;
    const dueB = b.task.dueDate?.getTime() ?? 9999999999999;
    if (dueA !== dueB) return dueA - dueB;
    const focusA = a.task.project?.focusThisWeek ? 1 : 0;
    const focusB = b.task.project?.focusThisWeek ? 1 : 0;
    if (focusB !== focusA) return focusB - focusA;
    const upA = a.task.updatedAt.getTime();
    const upB = b.task.updatedAt.getTime();
    if (upA !== upB) return upA - upB;
    return a.task.createdAt.getTime() - b.task.createdAt.getTime();
  });

  return { ranked: withScores, excluded };
}

/** Legacy export: computeScore for backwards compatibility during migration. */
export function computeScore(
  task: TaskWithRelations,
  filters?: { timeAvailable?: number; energy?: string; context?: string }
): number {
  const config = getNowRankingConfig();
  const { total } = computeScoreAndBreakdown(task, filters, config);
  return total;
}
