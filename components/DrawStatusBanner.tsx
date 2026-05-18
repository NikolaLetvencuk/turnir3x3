"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Sparkles, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DrawState = {
  state: "idle" | "scheduled" | "running" | "committed";
  scheduled_at: string | null;
  per_pick_ms: number;
  result: any | null;
};

type Variant = "countdown" | "running" | "awaiting-commit" | "idle";

function compute(state: DrawState | null, now: number): { variant: Variant; secondsToStart: number; secondsToEnd: number } {
  if (!state || state.state === "idle" || state.state === "committed" || !state.result) {
    return { variant: "idle", secondsToStart: 0, secondsToEnd: 0 };
  }
  const startMs = state.scheduled_at ? new Date(state.scheduled_at).getTime() : null;
  const teamCount = (state.result.groups ?? []).reduce((acc: number, g: any) => acc + (g.teams?.length ?? 0), 0);
  const SHUFFLE_MS = 5000;
  const animDuration = SHUFFLE_MS + teamCount * (state.per_pick_ms ?? 5000);
  if (!startMs) return { variant: "idle", secondsToStart: 0, secondsToEnd: 0 };
  const ttStart = Math.ceil((startMs - now) / 1000);
  const endMs = startMs + animDuration;
  const ttEnd = Math.ceil((endMs - now) / 1000);
  if (ttStart > 0) return { variant: "countdown", secondsToStart: ttStart, secondsToEnd: ttEnd };
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

  return (
    <Link
      href="/draw"
      className="block rounded-xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 transition p-3 sm:p-4"
    >
      <div className="flex items-center gap-3">
        {variant === "countdown" && <Clock className="w-6 h-6 text-emerald-700 shrink-0" />}
        {variant === "running" && <Sparkles className="w-6 h-6 text-emerald-700 shrink-0 animate-pulse" />}
        {variant === "awaiting-commit" && <AlertCircle className="w-6 h-6 text-amber-700 shrink-0" />}
        <div className="flex-1 min-w-0">
          {variant === "countdown" && (
            <>
              <div className="text-sm font-semibold text-emerald-900">Žreb počinje za</div>
              <div className="text-2xl sm:text-3xl font-bold tabular-nums text-emerald-700 font-mono">{fmt(secondsToStart)}</div>
            </>
          )}
          {variant === "running" && (
            <>
              <div className="text-sm font-semibold text-emerald-900">Žreb je u toku — uđi i prati!</div>
              <div className="text-xs text-emerald-700 tabular-nums">do kraja {fmt(secondsToEnd)}</div>
            </>
          )}
          {variant === "awaiting-commit" && (
            <>
              <div className="text-sm font-semibold text-amber-900">Žreb je završen</div>
              <div className="text-xs text-amber-800">Čeka se da admin potvrdi rezultat</div>
            </>
          )}
        </div>
        <span className="text-emerald-700 text-sm shrink-0">Otvori →</span>
      </div>
    </Link>
  );
}

// Server-side fetch helper: page renders <DrawStatusBanner initial={await loadInitialDrawState()} />
export type { DrawState };
