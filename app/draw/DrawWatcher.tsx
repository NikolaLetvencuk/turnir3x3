"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DrawAnimation } from "@/components/admin/DrawAnimation";
import { TeamCrest } from "@/components/TeamCrest";
import { useToast } from "@/components/ui/Toast";
import { commitScheduledDraw, cancelScheduledDraw, triggerDrawIfDue } from "@/app/admin/actions";
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

  // When countdown expires and result is still null, ask the server to compute.
  // Idempotent — only the first concurrent call wins.
  useEffect(() => {
    if (!state || state.state !== "scheduled" || state.result) return;
    if (!state.scheduled_at) return;
    const due = new Date(state.scheduled_at).getTime() <= Date.now();
    if (!due) return;
    let cancelled = false;
    (async () => {
      const res = await triggerDrawIfDue();
      // Ignore the result; either we won the race (realtime will deliver the update)
      // or someone else did, or we got "Tajmer još nije istekao" — all OK.
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [state?.state, state?.result, state?.scheduled_at, now]);

  const scheduledMs = state?.scheduled_at ? new Date(state.scheduled_at).getTime() : null;
  const timeToStart = scheduledMs != null ? scheduledMs - now : null;
  const SHUFFLE_MS = 5000;
  const totalAnimMs = state?.result
    ? SHUFFLE_MS + state.result.groups.reduce((acc, g) => acc + g.teams.length, 0) * (state.per_pick_ms ?? 5000)
    : 0;
  const animationDone =
    scheduledMs != null && totalAnimMs > 0 && now - scheduledMs >= totalAnimMs;

  // Auto-commit: the moment the animation finishes, the admin's client saves
  // the draw to the DB automatically — no manual "Potvrdi i snimi" click.
  // Guarded so it fires once per draw.
  const autoCommittedRef = useRef(false);
  useEffect(() => {
    if (!isAdmin) return;
    if (!animationDone) return;
    if (!state || state.state === "committed") return;
    if (autoCommittedRef.current || committing) return;
    autoCommittedRef.current = true;
    void onCommit({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationDone, isAdmin, state?.state]);

  async function onCommit(opts?: { silent?: boolean }) {
    setCommitting(true);
    const res = await commitScheduledDraw();
    setCommitting(false);
    if (!res.ok) {
      if (!opts?.silent) push(res.error, "error");
      return;
    }
    push("Žreb sačuvan!", "success");
    if (!opts?.silent) {
      router.push("/admin/schedule");
    }
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
  if (!state || state.state === "idle") {
    return (
      <div className="card text-center py-12 space-y-2">
        <Sparkles className="w-10 h-10 text-zinc-300 mx-auto" />
        <h1 className="font-semibold text-zinc-300">Nema zakazanog žreba</h1>
        <p className="text-sm text-zinc-500">Stranica će se ažurirati kad admin pokrene ili zakaže žreb.</p>
        <Link href="/" className="btn-secondary inline-flex mt-3">Početna</Link>
      </div>
    );
  }

  if (state.state === "committed" && state.result) {
    return (
      <div className="space-y-4">
        <div className="card text-center bg-blue-50 border-blue-200">
          <div className="text-blue-300 font-semibold">Žreb je završen</div>
          <p className="text-sm text-blue-200/80 mt-1">Grupe i mečevi su sačuvani.</p>
          <div className="flex gap-2 justify-center mt-3 flex-wrap">
            <Link href="/standings" className="btn-primary">Tabele →</Link>
            <Link href="/matches" className="btn-secondary">Mečevi</Link>
          </div>
        </div>
        <FinalGroups result={state.result} />
      </div>
    );
  }

  // Countdown phase: timer in future, no result yet
  if (timeToStart != null && timeToStart > 0) {
    return <Countdown scheduledMs={scheduledMs!} now={now} />;
  }

  // Timer expired but result not yet computed — show "drawing now" spinner
  if (!state.result) {
    return (
      <div className="card text-center py-12 space-y-3">
        <Sparkles className="w-12 h-12 text-blue-500 mx-auto animate-pulse" />
        <h1 className="font-semibold text-zinc-200 text-lg">Povlačenje žreba…</h1>
        <p className="text-sm text-zinc-500">Sačekaj nekoliko sekundi.</p>
      </div>
    );
  }

  // Animation done — show final groups; same "completed" message for everyone.
  // Admin gets extra commit/cancel controls below.
  if (animationDone) {
    return (
      <div className="space-y-4">
        <div className="card text-center bg-blue-50 border-blue-200">
          <div className="text-blue-300 font-semibold">Žreb je završen</div>
          <p className="text-sm text-blue-200/80 mt-1">Grupe i mečevi su sačuvani.</p>
          <div className="flex gap-2 justify-center mt-3 flex-wrap">
            <Link href="/standings" className="btn-primary">Tabele →</Link>
            <Link href="/matches" className="btn-secondary">Mečevi</Link>
          </div>
        </div>
        <FinalGroups result={state.result} />
        {isAdmin && (
          <div className="card border-dashed border-zinc-700">
            <div className="text-xs text-zinc-500 mb-2">
              {committing ? "Snimam žreb u bazu…" : "Žreb je automatski snimljen u bazu."}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link href="/admin/schedule" className="btn-primary">Raspored →</Link>
              <button onClick={onCancel} disabled={committing} className="btn-secondary">Otkaži ovaj žreb</button>
            </div>
          </div>
        )}
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

function Countdown({ scheduledMs, now }: { scheduledMs: number; now: number }) {
  const c = formatCountdown(scheduledMs - now);
  return (
    <div className="space-y-4">
      <div className="card bg-gradient-to-br from-blue-600 to-blue-700 text-white text-center py-10">
        <Clock className="w-12 h-12 mx-auto text-blue-100/80" />
        <h1 className="text-xl font-bold mt-3">Žreb počinje za</h1>
        <div className="mt-4 inline-flex items-baseline gap-3 tabular-nums font-mono">
          {c.d !== "00" && (
            <div className="text-center">
              <div className="text-4xl font-bold">{c.d}</div>
              <div className="text-[10px] text-blue-100/80 uppercase tracking-wider">dana</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-4xl font-bold">{c.h}</div>
            <div className="text-[10px] text-blue-100/80 uppercase tracking-wider">sati</div>
          </div>
          <span className="text-3xl">:</span>
          <div className="text-center">
            <div className="text-4xl font-bold">{c.m}</div>
            <div className="text-[10px] text-blue-100/80 uppercase tracking-wider">min</div>
          </div>
          <span className="text-3xl">:</span>
          <div className="text-center">
            <div className="text-4xl font-bold">{c.s}</div>
            <div className="text-[10px] text-blue-100/80 uppercase tracking-wider">sek</div>
          </div>
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
                <TeamCrest name={t.name} shortName={t.short_name} primaryColor={t.primary_color} secondaryColor={t.secondary_color} logoUrl={t.logo_url} size={24} />
                <span className="truncate">{t.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
