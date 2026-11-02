export function useLocalZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function formatInZone(iso: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toUTCString();
  }
}

export function timeLeft(iso: string, now: number) {
  const ms = Date.parse(iso) - now;
  const past = ms < 0;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 864e5);
  const hours = Math.floor((abs % 864e5) / 36e5);
  const minutes = Math.floor((abs % 36e5) / 6e4);
  const seconds = Math.floor((abs % 6e4) / 1e3);
  return { ms, past, days, hours, minutes, seconds };
}

export function urgency(ms: number): "past" | "critical" | "soon" | "calm" {
  if (ms < 0) return "past";
  if (ms < 48 * 36e5) return "critical";
  if (ms < 7 * 864e5) return "soon";
  return "calm";
}

export const URGENCY_STYLES: Record<ReturnType<typeof urgency>, string> = {
  past: "text-muted-foreground",
  critical: "text-red-600 dark:text-red-400",
  soon: "text-amber-600 dark:text-amber-400",
  calm: "text-emerald-600 dark:text-emerald-400",
};

export const COMMON_ZONES = [
  "America/Los_Angeles",
  "America/New_York",
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];
