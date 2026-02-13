"use client";

const TIME_OPTS = [
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "60m" },
  { value: 120, label: "2h+" },
];
const ENERGY_OPTS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
const CONTEXT_OPTS = [
  { value: "calls", label: "Calls" },
  { value: "errands", label: "Errands" },
  { value: "computer", label: "Computer" },
  { value: "deep_work", label: "Deep Work" },
];

type Props = {
  timeAvailable?: number;
  energy?: string;
  context?: string;
  onTimeChange?: (v: number | undefined) => void;
  onEnergyChange?: (v: string | undefined) => void;
  onContextChange?: (v: string | undefined) => void;
};

export function FilterPills({
  timeAvailable,
  energy,
  context,
  onTimeChange,
  onEnergyChange,
  onContextChange,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm text-zinc-500 dark:text-zinc-400 mr-1">Time:</span>
      {TIME_OPTS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onTimeChange?.(timeAvailable === o.value ? undefined : o.value)}
          className={`rounded-full px-3 py-1 text-sm ${
            timeAvailable === o.value
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          {o.label}
        </button>
      ))}
      <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-2 mr-1">Energy:</span>
      {ENERGY_OPTS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onEnergyChange?.(energy === o.value ? undefined : o.value)}
          className={`rounded-full px-3 py-1 text-sm ${
            energy === o.value
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          {o.label}
        </button>
      ))}
      <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-2 mr-1">Context:</span>
      {CONTEXT_OPTS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onContextChange?.(context === o.value ? undefined : o.value)}
          className={`rounded-full px-3 py-1 text-sm ${
            context === o.value
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
