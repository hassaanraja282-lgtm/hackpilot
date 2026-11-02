import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { timeLeft, urgency, URGENCY_STYLES } from "./time";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Countdown({
  deadlineAt,
  size = "sm",
}: {
  deadlineAt: string;
  size?: "sm" | "lg";
}) {
  const now = useNow(1000);
  const t = timeLeft(deadlineAt, now);
  const tone = URGENCY_STYLES[urgency(t.ms)];
  if (t.past) {
    return <span className={cn("font-mono tabular-nums", tone)}>Closed</span>;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  if (size === "lg") {
    const cells: [string, number][] = [
      ["days", t.days],
      ["hrs", t.hours],
      ["min", t.minutes],
      ["sec", t.seconds],
    ];
    return (
      <div className={cn("flex items-end gap-3", tone)} aria-label="Time left">
        {cells.map(([label, value]) => (
          <div key={label} className="flex flex-col items-center">
            <span className="font-mono text-4xl font-semibold leading-none tabular-nums sm:text-5xl">
              {pad(value)}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <span className={cn("font-mono tabular-nums", tone)}>
      {t.days > 0 ? `${t.days}d ` : ""}
      {pad(t.hours)}h {pad(t.minutes)}m
    </span>
  );
}

export function ProgressBar({
  percent,
  ready,
}: {
  percent: number;
  ready?: boolean;
}) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          ready ? "bg-emerald-500" : "bg-primary",
        )}
        style={{ width: `${Math.max(2, percent)}%` }}
      />
    </div>
  );
}
