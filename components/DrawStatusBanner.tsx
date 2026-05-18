"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DrawState = {
  state: "idle" | "scheduled" | "running" | "committed";
  scheduled_at: string | null;
  per_pick_ms: number;
  result: any | null;
};

type Variant = "countdown" | "running" | "awaiting-commit" | "idle";

function compute(state: DrawState | null, now: number): { variant: Variant; secondsToStart: number; secondsToEnd: number } {
  if (!state || state.state === "idle" || state.state === "committed") {
    return { variant: "idle", secondsToStart: 0, secondsToEnd: 0 };
  }
  const startMs = state.scheduled_at ? new Date(state.scheduled_at).getTime() : null;
  if (!startMs) return { variant: "idle", secondsToStart: 0, secondsToEnd: 0 };
  const ttStart = Math.ceil((startMs - now) / 1000);

  // Countdown phase: scheduled but timer hasn't fired yet. Result may still be null —
  // it only gets computed at T-0 by triggerDrawIfDue(). We don't need it for countdown.
  if (ttStart > 0) return { variant: "countdown", secondsToStart: ttStart, secondsToEnd: 0 };

  // Past T-0: result should be populated. If not (race during compute), show "running"
  // anyway so the banner stays visible and links to /draw.
  if (!state.result) return { variant: "running", secondsToStart: 0, secondsToEnd: 0 };
  const teamCount = (state.result.groups ?? []).reduce((acc: number, g: any) => acc + (g.teams?.length ?? 0), 0);
  const SHUFFLE_MS = 5000;
  const animDuration = SHUFFLE_MS + teamCount * (state.per_pick_ms ?? 5000);
  const endMs = startMs + animDuration;
  const ttEnd = Math.ceil((endMs - now) / 1000);
  if (ttEnd > 0) return { variant: "running", secondsToStart: 0, secondsToEnd: ttEnd };
  return { variant: "awaiting-commit", secondsToStart: 0, secondsToEnd: 0 };
}

function fmt(seconds: number): string {
  const s = Math.max(0, seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

export function DrawStatusBanner({ initial }: { initial: DrawState | null }) {
  const [state, setState] = useState<DrawState | null>(initial);
  const [now, setNow] = useState<number>(() => Date.now());

  // Sync banner state with new SSR-fetched initial whenever page re-renders.
  // Without this, useState's initial is only read on first mount and later page
  // refreshes silently keep the stale value.
  useEffect(() => {
    setState(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("draw_state-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "draw_state" }, (payload) => {
        if (payload.new) setState(payload.new as DrawState);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { variant, secondsToStart, secondsToEnd } = compute(state, now);
  if (variant === "idle") return null;

  const isAmber = variant === "awaiting-commit";
  const ctaLabel =
    variant === "countdown" ? "Otvori žreb" : variant === "running" ? "Uđi u žreb" : "Pogledaj žreb";

  return (
    <div
      className={`rounded-xl border-2 p-3 sm:p-4 ${
        isAmber ? "border-amber-300 bg-amber-50" : "border-blue-300 bg-blue-50"
      }`}
    >
      <div className="flex items-center gap-3">
        {variant === "countdown" && <Clock className="w-6 h-6 text-blue-700 shrink-0" />}
        {variant === "running" && <Sparkles className="w-6 h-6 text-blue-700 shrink-0 animate-pulse" />}
        {variant === "awaiting-commit" && <AlertCircle className="w-6 h-6 text-amber-700 shrink-0" />}
        <div className="flex-1 min-w-0">
          {variant === "countdown" && (
            <>
              <div className="text-sm font-semibold text-blue-900">Žreb počinje za</div>
              <div className="text-2xl sm:text-3xl font-bold tabular-nums text-blue-700 font-mono">{fmt(secondsToStart)}</div>
            </>
          )}
          {variant === "running" && (
            <>
              <div className="text-sm font-semibold text-blue-900">Žreb je u toku!</div>
              <div className="text-xs text-blue-700">Uđi i prati animaciju</div>
            </>
          )}
          {variant === "awaiting-commit" && (
            <>
              <div className="text-sm font-semibold text-amber-900">Žreb je završen</div>
              <div className="text-xs text-amber-800">Čeka se da admin potvrdi rezultat</div>
            </>
          )}
        </div>
        <Link
          href="/draw"
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition ${
            isAmber ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          <span className="hidden sm:inline">{ctaLabel}</span>
          <span className="sm:hidden">Otvori</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// Server-side fetch helper: page renders <DrawStatusBanner initial={await loadInitialDrawState()} />
export type { DrawState };
