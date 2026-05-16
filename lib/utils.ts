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
