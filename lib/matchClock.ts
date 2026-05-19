export type Phase = "scheduled" | "first_half" | "halftime" | "second_half" | "extra_time" | "penalties" | "finished";

export type ClockMatch = {
  phase: Phase | string | null;
  started_at: string | null;
  second_half_started_at: string | null;
  extra_time_started_at?: string | null;
};

export const HALF_LENGTH = 20;
export const EXTRA_TIME_LENGTH = 10; // 2 × 5 minutes

export function getCurrentMinute(m: ClockMatch, now: number = Date.now()): number | null {
  if (m.phase === "first_half" && m.started_at) {
    const elapsed = (now - new Date(m.started_at).getTime()) / 60000;
    return Math.max(1, Math.min(HALF_LENGTH, Math.floor(elapsed) + 1));
  }
  if (m.phase === "second_half" && m.second_half_started_at) {
    const elapsed = (now - new Date(m.second_half_started_at).getTime()) / 60000;
    return Math.max(HALF_LENGTH + 1, Math.min(HALF_LENGTH * 2, HALF_LENGTH + Math.floor(elapsed) + 1));
  }
  if (m.phase === "extra_time" && m.extra_time_started_at) {
    const elapsed = (now - new Date(m.extra_time_started_at).getTime()) / 60000;
    return Math.max(HALF_LENGTH * 2 + 1, Math.min(HALF_LENGTH * 2 + EXTRA_TIME_LENGTH, HALF_LENGTH * 2 + Math.floor(elapsed) + 1));
  }
  return null;
}

export function phaseLabel(phase: Phase | string | null | undefined): string {
  switch (phase) {
    case "first_half": return "1. poluvreme";
    case "halftime": return "POLUVREME";
    case "second_half": return "2. poluvreme";
    case "extra_time": return "PRODUŽECI";
    case "penalties": return "PENALI";
    case "finished": return "ZAVRŠENO";
    default: return "Zakazano";
  }
}
