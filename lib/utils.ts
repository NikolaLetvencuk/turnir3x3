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
