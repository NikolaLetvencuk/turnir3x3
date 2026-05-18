"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DrawAnimation } from "@/components/admin/DrawAnimation";
import { TeamCrest } from "@/components/TeamCrest";
import { useToast } from "@/components/ui/Toast";
import { commitScheduledDraw, cancelScheduledDraw } from "@/app/admin/actions";
import type { DrawResult } from "@/lib/draw";

type DrawState = {
  state: "idle" | "scheduled" | "running" | "committed";
  scheduled_at: string | null;
  per_pick_ms: number;
  result: DrawResult | null;
  updated_at: string | null;
};

function formatCountdown(ms: number): { d: string; h: string; m: string; s: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: pad(days), h: pad(hours), m: pad(minutes), s: pad(seconds) };
}

export function DrawWatcher({ initial, isAdmin = false }: { initial: DrawState | null; isAdmin?: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [state, setState] = useState<DrawState | null>(initial);
  const [now, setNow] = useState<number>(() => Date.now());
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("draw_state-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "draw_state" }, (payload) => {
        if (payload.new) setState(payload.new as DrawState);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const scheduledMs = state?.scheduled_at ? new Date(state.scheduled_at).getTime() : null;
  const timeToStart = scheduledMs != null ? scheduledMs - now : null;
  const SHUFFLE_MS = 5000;
  const totalAnimMs = state?.result
    ? SHUFFLE_MS + state.result.groups.reduce((acc, g) => acc + g.teams.length, 0) * (state.per_pick_ms ?? 5000)
    : 0;
  const animationDone =
    scheduledMs != null && totalAnimMs > 0 && now - scheduledMs >= totalAnimMs;

  async function onCommit() {
    setCommitting(true);
    const res = await commitScheduledDraw();
    setCommitting(false);
    if (!res.ok) { push(res.error, "error"); return; }
    push("Žreb sačuvan!", "success");
    router.push("/admin/schedule");
    router.refresh();
  }
  async function onCancel() {
    if (!confirm("Otkazati žreb?")) return;
    const res = await cancelScheduledDraw();
    if (!res.ok) { push(res.error, "error"); return; }
    push("Otkazano", "success");
    router.refresh();
  }

  // Decide which screen to show
  if (!state || state.state === "idle" || !state.result) {
    return (
      <div className="card text-center py-12 space-y-2">
        <Sparkles className="w-10 h-10 text-zinc-300 mx-auto" />
        <h1 className="font-semibold text-zinc-700">Nema zakazanog žreba</h1>
        <p className="text-sm text-zinc-500">Stranica će se ažurirati kad admin pokrene ili zakaže žreb.</p>
        <Link href="/" className="btn-secondary inline-flex mt-3">Početna</Link>
      </div>
    );
  }

  if (state.state === "committed") {
    return (
      <div className="space-y-4">
        <div className="card text-center bg-emerald-50 border-emerald-200">
          <div className="text-emerald-700 font-semibold">Žreb je završen</div>
          <p className="text-sm text-emerald-800/80 mt-1">Grupe i mečevi su sačuvani.</p>
          <div className="flex gap-2 justify-center mt-3 flex-wrap">
            <Link href="/standings" className="btn-primary">Tabele →</Link>
            <Link href="/matches" className="btn-secondary">Mečevi</Link>
          </div>
        </div>
        <FinalGroups result={state.result} />
      </div>
    );
  }

  if (timeToStart != null && timeToStart > 0) {
    // Show countdown
    return <Countdown scheduledMs={scheduledMs!} now={now} result={state.result} />;
  }

  // Animation done — show final groups + admin commit prompt
  if (animationDone) {
    return (
      <div className="space-y-4">
        <div className="card bg-amber-50 border-amber-200 text-center">
          <div className="font-semibold text-amber-900">Žreb je odgledan</div>
          {isAdmin ? (
            <>
              <p className="text-sm text-amber-800 mt-1">Pregledaj raspored i klikni „Potvrdi“ da snimiš.</p>
              <div className="mt-3 flex gap-2 justify-center flex-wrap">
                <button onClick={onCommit} disabled={committing} className="btn-primary">{committing ? "Snimam…" : "Potvrdi i sačuvaj"}</button>
                <button onClick={onCancel} disabled={committing} className="btn-secondary">Otkaži</button>
              </div>
            </>
          ) : (
            <p className="text-sm text-amber-800 mt-1">Čekamo da admin potvrdi rezultat…</p>
          )}
        </div>
        <FinalGroups result={state.result} />
      </div>
    );
  }

  // Animation running (or about to start)
  return (
    <DrawAnimation
      result={state.result}
      startedAtMs={scheduledMs ?? now}
      perPickMs={state.per_pick_ms}
      allowSkip={false}
    />
  );
}

function Countdown({ scheduledMs, now, result }: { scheduledMs: number; now: number; result: DrawResult }) {
  const c = formatCountdown(scheduledMs - now);
  const teamCount = result.groups.reduce((acc, g) => acc + g.teams.length, 0);
  return (
    <div className="space-y-4">
      <div className="card bg-gradient-to-br from-emerald-600 to-emerald-700 text-white text-center py-10">
        <Clock className="w-12 h-12 mx-auto text-emerald-100/80" />
        <h1 className="text-xl font-bold mt-3">Žreb počinje za</h1>
        <div className="mt-4 inline-flex items-baseline gap-3 tabular-nums font-mono">
          {c.d !== "00" && (
            <div className="text-center">
              <div className="text-4xl font-bold">{c.d}</div>
              <div className="text-[10px] text-emerald-100/80 uppercase tracking-wider">dana</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-4xl font-bold">{c.h}</div>
            <div className="text-[10px] text-emerald-100/80 uppercase tracking-wider">sati</div>
          </div>
          <span className="text-3xl">:</span>
          <div className="text-center">
            <div className="text-4xl font-bold">{c.m}</div>
            <div className="text-[10px] text-emerald-100/80 uppercase tracking-wider">min</div>
          </div>
          <span className="text-3xl">:</span>
          <div className="text-center">
            <div className="text-4xl font-bold">{c.s}</div>
            <div className="text-[10px] text-emerald-100/80 uppercase tracking-wider">sek</div>
          </div>
        </div>
        <p className="text-sm text-emerald-100/80 mt-4">{teamCount} timova · {result.groups.length} grupa</p>
      </div>

      <div className="card">
        <h2 className="font-medium mb-2">Timovi u žrebu</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {result.groups.flatMap((g) => g.teams).map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-sm min-w-0">
              <TeamCrest name={t.name} shortName={t.short_name} primaryColor={t.primary_color} secondaryColor={t.secondary_color} size={28} />
              <span className="truncate">{t.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FinalGroups({ result }: { result: DrawResult }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {result.groups.map((g) => (
        <div key={g.name} className="card">
          <h3 className="font-semibold mb-2">{g.name}</h3>
          <ul className="space-y-1 text-sm">
            {g.teams.map((t) => (
              <li key={t.id} className="flex items-center gap-2 min-w-0">
                <TeamCrest name={t.name} shortName={t.short_name} primaryColor={t.primary_color} secondaryColor={t.secondary_color} size={24} />
                <span className="truncate">{t.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
