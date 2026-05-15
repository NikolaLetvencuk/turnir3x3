export type Phase = "scheduled" | "first_half" | "halftime" | "second_half" | "finished";

export type ClockMatch = {
  phase: Phase | string | null;
  started_at: string | null;
  second_half_started_at: string | null;
};

export const HALF_LENGTH = 20;

export function getCurrentMinute(m: ClockMatch, now: number = Date.now()): number | null {
  if (m.phase === "first_half" && m.started_at) {
    const elapsed = (now - new Date(m.started_at).getTime()) / 60000;
    return Math.max(1, Math.min(HALF_LENGTH, Math.floor(elapsed) + 1));
  }
  if (m.phase === "second_half" && m.second_half_started_at) {
    const elapsed = (now - new Date(m.second_half_started_at).getTime()) / 60000;
    return Math.max(HALF_LENGTH + 1, Math.min(HALF_LENGTH * 2, HALF_LENGTH + Math.floor(elapsed) + 1));
  }
  return null;
}

export function phaseLabel(phase: Phase | string | null | undefined): string {
  switch (phase) {
    case "first_half": return "1. poluvreme";
    case "halftime": return "POLUVREME";
    case "second_half": return "2. poluvreme";
    case "finished": return "ZAVRŠENO";
    default: return "Zakazano";
  }
}
