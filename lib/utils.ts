import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BG_TZ = "Europe/Belgrade";

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  try {
    return new Intl.DateTimeFormat("sr-Latn-RS", {
      timeZone: BG_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return format(d, "dd.MM.yyyy. HH:mm");
  }
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  try {
    return new Intl.DateTimeFormat("sr-Latn-RS", {
      timeZone: BG_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return format(d, "dd.MM.yyyy.");
  }
}

/**
 * Convert a wall-clock string "YYYY-MM-DDTHH:mm" (as typed in datetime-local) interpreted
 * in Europe/Belgrade into an ISO UTC timestamp string. Server timezone-independent.
 * Two-pass iteration handles DST transitions correctly.
 */
export function belgradeLocalToUTCISO(raw: string): string | null {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = m[6] ? Number(m[6]) : 0;
  const targetWallMs = Date.UTC(y, mo - 1, d, h, mi, s);

  // Compute what Belgrade wall-clock shows at a given UTC instant
  function belgradeWallAt(utcMs: number): number {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: BG_TZ,
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    let bh = get("hour");
    if (bh === 24) bh = 0; // Intl quirk on midnight
    return Date.UTC(get("year"), get("month") - 1, get("day"), bh, get("minute"), get("second"));
  }

  // The Belgrade offset at any UTC instant = belgradeWall - utc
  // We want utcMs such that belgradeWallAt(utcMs) === targetWallMs
  let utcMs = targetWallMs - (belgradeWallAt(targetWallMs) - targetWallMs);
  // Second pass for DST edge: refine once more in case the first guess crossed a transition
  utcMs = targetWallMs - (belgradeWallAt(utcMs) - utcMs);
  return new Date(utcMs).toISOString();
}

/**
 * Format kickoff with weekday: "nedelja, 17.05.2026. u 21:00"
 */
export function formatKickoff(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  try {
    const weekday = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: BG_TZ, weekday: "long" }).format(d);
    const date = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: BG_TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
    const time = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: BG_TZ, hour: "2-digit", minute: "2-digit" }).format(d);
    return `${weekday}, ${date} u ${time}`;
  } catch {
    return format(d, "EEEE, dd.MM.yyyy. 'u' HH:mm");
  }
}

/**
 * ISO timestamp → "YYYY-MM-DDTHH:mm" suitable for <input type="datetime-local"> value in Europe/Belgrade
 */
export function toDatetimeLocalValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? parseISO(value) : value;
  try {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: BG_TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return format(d, "yyyy-MM-dd'T'HH:mm");
  }
}

/**
 * Local YYYY-MM-DD string from a timestamp, in Europe/Belgrade.
 * Used for grouping/filtering matches by their kickoff day.
 */
export function toLocalDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : value;
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: BG_TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
  } catch {
    return format(d, "yyyy-MM-dd");
  }
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  try {
    return new Intl.DateTimeFormat("sr-Latn-RS", {
      timeZone: BG_TZ,
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return format(d, "HH:mm");
  }
}

const isDev = process.env.NODE_ENV !== "production";
export const log = {
  info: (...args: unknown[]) => { if (isDev) console.log("[info]", ...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn("[warn]", ...args); },
  error: (...args: unknown[]) => { console.error("[error]", ...args); },
};
