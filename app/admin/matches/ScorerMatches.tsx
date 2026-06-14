"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { ListChecks, ChevronRight } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/admin/PageHeader";

type Match = any;

function statusBadge(m: Match) {
  const phase = m.phase ?? m.status;
  if (phase === "finished" || m.status === "finished") return { label: "Završen", cls: "badge-finished" };
  if (phase && phase !== "scheduled") return { label: "UŽIVO", cls: "badge-live" };
  return { label: "Zakazan", cls: "badge-scheduled" };
}

/**
 * Maximally simple match list for the "scorer" role: pick a match → enter the
 * result. No scheduling, no other tabs. Grouped by round (Kolo).
 */
export function ScorerMatches({ matches }: { matches: Match[] }) {
  const byRound = useMemo(() => {
    const map = new Map<string, { name: string; order: number; items: Match[] }>();
    for (const m of matches) {
      const r = m.round;
      const key = r?.id ?? "—";
      if (!map.has(key)) map.set(key, { name: r?.name ?? "Ostali mečevi", order: r?.display_order ?? 999, items: [] });
      map.get(key)!.items.push(m);
    }
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [matches]);

  // Next match to play: a live one if any, else the first not-finished match
  // (in the displayed round order). The list auto-scrolls there on open.
  const targetId = useMemo(() => {
    const flat = byRound.flatMap((r) => r.items);
    const finished = (m: Match) => (m.phase ?? m.status) === "finished" || m.status === "finished";
    const live = (m: Match) => {
      const p = m.phase ?? m.status;
      return !!p && p !== "scheduled" && !finished(m);
    };
    return flat.find(live)?.id ?? flat.find((m) => !finished(m))?.id ?? null;
  }, [byRound]);

  const targetRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (!targetId) return;
    // Defer to after paint so layout is settled before scrolling.
    const t = setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => clearTimeout(t);
  }, [targetId]);

  return (
    <div className="space-y-4">
      <LiveRefresh tag="scorer-matches" />
      <PageHeader
        icon={ListChecks}
        title="Mečevi"
        hint="Izaberi meč → unesi rezultat (započni, dodaj golove/kartone, završi)."
        tone="purple"
      />

      {matches.length === 0 ? (
        <div className="card text-center py-10 text-zinc-400">Još nema mečeva.</div>
      ) : (
        byRound.map((round) => (
          <div key={round.name} className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-400 px-1">{round.name}</h2>
            <ul className="space-y-2">
              {round.items.map((m) => {
                const b = statusBadge(m);
                const finished = b.label === "Završen";
                const live = b.label === "UŽIVO";
                const isTarget = m.id === targetId;
                return (
                  <li key={m.id} ref={isTarget ? targetRef : undefined}>
                    <Link
                      href={`/admin/matches/${m.id}/live`}
                      className={`card flex items-center gap-3 active:scale-[0.99] transition ${
                        isTarget ? "border-blue-400 ring-2 ring-blue-500/40" : "hover:border-blue-400"
                      }`}
                    >
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {isTarget && (
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                            {live ? "Trenutno se igra" : "Sledeći meč"}
                          </div>
                        )}
                        <Row team={m.home} score={finished || live ? m.home_score : null} />
                        <Row team={m.away} score={finished || live ? m.away_score : null} />
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={b.cls}>{b.label}</span>
                        <ChevronRight className="w-5 h-5 text-zinc-500" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function Row({ team, score }: { team: any; score: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <TeamCrest
        name={team?.name ?? "?"}
        shortName={team?.short_name}
        primaryColor={team?.primary_color}
        secondaryColor={team?.secondary_color}
        logoUrl={team?.logo_url}
        size={26}
      />
      <span className="font-medium truncate flex-1 min-w-0">{team?.name ?? "?"}</span>
      {score != null && <span className="text-lg font-bold tabular-nums w-6 text-center">{score}</span>}
    </div>
  );
}
