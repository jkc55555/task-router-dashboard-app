/**
 * Now Ranking config: tunable weights and thresholds for the Now list.
 * Load from config/now-ranking.json if present; otherwise use defaults below.
 */

import * as fs from "fs";
import * as path from "path";

export type NowRankingConfig = {
  weights: {
    urgency: number;
    importance: number;
    leverage: number;
    staleness: number;
    fit: number;
    friction: number;
    risk: number;
  };
  urgency: {
    overdue: number;
    due_24h: number;
    due_48h: number;
    due_7d: number;
    due_30d: number;
    else: number;
    project_cap: number;
  };
  importance: {
    task_priority_map: Record<string, number>;
    project_priority_max: number;
    focus_bonus: number;
  };
  leverage: {
    dependents_map: Record<string, number>;
    heuristics: { send_ask_confirm: number; manual_blocking: number };
  };
  staleness: {
    bins: Array<{ days_max: number; score: number }>;
    project_stalled_days: number;
    project_stalled_bonus: number;
  };
  fit: {
    time: { fits: number; near_fits: number; over: number };
    context: { match: number; mismatch: number };
    energy: { match: number; off_by_one: number; extreme_mismatch: number };
  };
  friction: {
    bins: Array<{ minutes_max: number; penalty: number }>;
  };
  risk: {
    unverified_penalty: number;
    missing_metadata_penalty: number;
  };
  filters: {
    mode: "strict" | "soft";
    strict_hide_mismatch: boolean;
  };
  tags: {
    max_tags: number;
    priority_order: string[];
  };
};

const DEFAULT_CONFIG: NowRankingConfig = {
  weights: {
    urgency: 1.0,
    importance: 1.0,
    leverage: 1.0,
    staleness: 1.0,
    fit: 1.0,
    friction: 1.0,
    risk: 1.0,
  },
  urgency: {
    overdue: 40,
    due_24h: 35,
    due_48h: 30,
    due_7d: 20,
    due_30d: 10,
    else: 5,
    project_cap: 20,
  },
  importance: {
    task_priority_map: { low: 2, normal: 5, high: 8, critical: 10 },
    project_priority_max: 8,
    focus_bonus: 2,
  },
  leverage: {
    dependents_map: { "1": 5, "2-3": 10, "4-6": 15, "7+": 20 },
    heuristics: { send_ask_confirm: 5, manual_blocking: 10 },
  },
  staleness: {
    bins: [
      { days_max: 2, score: 0 },
      { days_max: 6, score: 3 },
      { days_max: 13, score: 7 },
      { days_max: 29, score: 12 },
      { days_max: 9999, score: 15 },
    ],
    project_stalled_days: 10,
    project_stalled_bonus: 3,
  },
  fit: {
    time: { fits: 5, near_fits: 2, over: -10 },
    context: { match: 5, mismatch: -15 },
    energy: { match: 5, off_by_one: -5, extreme_mismatch: -12 },
  },
  friction: {
    bins: [
      { minutes_max: 10, penalty: 0 },
      { minutes_max: 30, penalty: 2 },
      { minutes_max: 60, penalty: 4 },
      { minutes_max: 120, penalty: 7 },
      { minutes_max: 9999, penalty: 10 },
    ],
  },
  risk: {
    unverified_penalty: 5,
    missing_metadata_penalty: 2,
  },
  filters: {
    mode: "soft",
    strict_hide_mismatch: true,
  },
  tags: {
    max_tags: 2,
    priority_order: [
      "overdue",
      "due_today",
      "due_tomorrow",
      "unblocks",
      "focus_project",
      "project_due_soon",
      "stale",
      "fit",
      "needs_review",
    ],
  },
};

let cachedConfig: NowRankingConfig | null = null;

const CONFIG_PATH =
  process.env.NOW_RANKING_CONFIG_PATH ||
  path.join(process.cwd(), "config", "now-ranking.json");

export function getNowRankingConfig(): NowRankingConfig {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<NowRankingConfig>;
    cachedConfig = { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    cachedConfig = DEFAULT_CONFIG;
  }
  return cachedConfig;
}

export function resetNowRankingConfigCache(): void {
  cachedConfig = null;
}
