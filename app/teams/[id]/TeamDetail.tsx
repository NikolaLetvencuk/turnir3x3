"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { TeamCrest } from "@/components/TeamCrest";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { formatKickoff } from "@/lib/utils";

type TeamMeta = {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export type TeamMatchRow = {
  id: string;
  round_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number;
  away_score: number;
  phase: string | null;
  kickoff_at: string | null;
  finished_at: string | null;
  knockout_winner_id: string | null;
  home_team: TeamMeta | null;
  away_team: TeamMeta | null;
  round: { id: string; name: string; stage: string; display_order: number } | null;
};

type PlayerWithStats = {
  id: string;
  name: string;
  team_id: string | null;
  photo_url: string | null;
  stats: { goals: number; assists: number; yellows: number; reds: number; own_goals: number };
};

type Tab = "results" | "players" | "stats";

function ResultBadge({ result }: { result: "W" | "L" | "D" }) {
  const cls =
    result === "W" ? "bg-blue-500 text-white" :
    result === "L" ? "bg-red-500 text-white" :
    "bg-amber-400 text-zinc-100";
  return <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${cls}`}>{result}</span>;
}

function resultForTeam(m: TeamMatchRow, teamId: string): "W" | "L" | "D" | null {
  if (m.phase !== "finished") return null;
  if (m.knockout_winner_id) return m.knockout_winner_id === teamId ? "W" : "L";
  const isHome = m.home_team_id === teamId;
  const us = isHome ? m.home_score : m.away_score;
  const them = isHome ? m.away_score : m.home_score;
  if (us > them) return "W";
  if (us < them) return "L";
  return "D";
}

export function TeamDetail({ team, players, matches }: { team: TeamMeta; players: PlayerWithStats[]; matches: TeamMatchRow[] }) {
  const [tab, setTab] = useState<Tab>("results");

  const finished = useMemo(() => matches.filter((m) => m.phase === "finished"), [matches]);
  const upcoming = useMemo(() => matches.filter((m) => m.phase !== "finished"), [matches]);

  const stats = useMemo(() => {
    let played = 0, wins = 0, draws = 0, losses = 0, gf = 0, ga = 0, cleanSheets = 0, failedToScore = 0;
    let biggestWin: { m: TeamMatchRow; diff: number; us: number; them: number; opp: TeamMeta | null } | null = null;
    let worstLoss: { m: TeamMatchRow; diff: number; us: number; them: number; opp: TeamMeta | null } | null = null;
    for (const m of finished) {
      const isHome = m.home_team_id === team.id;
      const us = isHome ? m.home_score : m.away_score;
      const them = isHome ? m.away_score : m.home_score;
      const opp = isHome ? m.away_team : m.home_team;
      played++; gf += us; ga += them;
      if (them === 0) cleanSheets++;
      if (us === 0) failedToScore++;
      const res = resultForTeam(m, team.id);
      if (res === "W") {
        wins++;
        const diff = us - them;
        if (!biggestWin || diff > biggestWin.diff) biggestWin = { m, diff, us, them, opp };
      } else if (res === "D") {
        draws++;
      } else if (res === "L") {
        losses++;
        const diff = them - us;
        if (!worstLoss || diff > worstLoss.diff) worstLoss = { m, diff, us, them, opp };
      }
    }
    const points = wins * 3 + draws;
    const topScorer = [...players].sort((a, b) => b.stats.goals - a.stats.goals)[0];
    const topAssister = [...players].sort((a, b) => b.stats.assists - a.stats.assists)[0];
    const mostCards = [...players].sort((a, b) => (b.stats.yellows + b.stats.reds * 3) - (a.stats.yellows + a.stats.reds * 3))[0];
    return {
      played, wins, draws, losses, gf, ga, gd: gf - ga, points,
      cleanSheets, failedToScore,
      avgFor: played > 0 ? gf / played : 0,
      avgAgainst: played > 0 ? ga / played : 0,
      biggestWin, worstLoss,
      topScorer: topScorer && topScorer.stats.goals > 0 ? topScorer : null,
      topAssister: topAssister && topAssister.stats.assists > 0 ? topAssister : null,
      mostCards: mostCards && (mostCards.stats.yellows + mostCards.stats.reds) > 0 ? mostCards : null,
    };
  }, [finished, team.id, players]);

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-3 sm:gap-4">
        <div className="shrink-0">
          <TeamCrest name={team.name} shortName={team.short_name} primaryColor={team.primary_color} secondaryColor={team.secondary_color} size={56} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold break-words leading-tight">{team.name}</h1>
          {team.short_name && <p className="text-sm text-zinc-500">{team.short_name}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-block w-4 h-4 rounded border border-zinc-700" style={{ background: team.primary_color ?? "#1f2937" }} />
            <span className="inline-block w-4 h-4 rounded border border-zinc-700" style={{ background: team.secondary_color ?? "#f3f4f6" }} />
            <span className="text-xs text-zinc-400">{players.length} {players.length === 1 ? "igrač" : "igrača"}</span>
          </div>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="flex border-b border-zinc-800">
          {([
            ["results", "Rezultati"],
            ["players", "Igrači"],
            ["stats", "Statistika"],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-2 px-3 text-sm font-medium transition ${tab === k ? "bg-blue-50 text-blue-300 border-b-2 border-blue-600" : "text-zinc-400 hover:bg-zinc-800"}`}
            >{l}</button>
          ))}
        </div>

        <div className="p-3">
          {tab === "results" && (
            <div className="space-y-4">
              {finished.length > 0 && (
                <section>
                  <h3 className="font-medium text-sm text-zinc-400 mb-2">Odigrani mečevi</h3>
                  <ul className="divide-y divide-zinc-800">
                    {finished.map((m) => {
                      const isHome = m.home_team_id === team.id;
                      const opp = isHome ? m.away_team : m.home_team;
                      const us = isHome ? m.home_score : m.away_score;
                      const them = isHome ? m.away_score : m.home_score;
                      const res = resultForTeam(m, team.id);
                      return (
                        <li key={m.id}>
                          <Link href={`/matches/${m.id}`} className="flex items-center gap-2 py-2 hover:bg-zinc-800 -mx-2 px-2 rounded">
                            {res && <ResultBadge result={res} />}
                            <span className="tabular-nums font-semibold shrink-0">{us} : {them}</span>
                            {opp && (
                              <span className="inline-flex items-center gap-1.5 text-sm min-w-0">
                                <TeamCrest name={opp.name} shortName={opp.short_name} primaryColor={opp.primary_color} secondaryColor={opp.secondary_color} size={20} />
                                <span className="truncate">{opp.name}</span>
                              </span>
                            )}
                            <span className="text-xs text-zinc-400 ml-auto shrink-0">{m.round?.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              {upcoming.length > 0 && (
                <section>
                  <h3 className="font-medium text-sm text-zinc-400 mb-2">Predstojeći</h3>
                  <ul className="divide-y divide-zinc-800">
                    {upcoming.map((m) => {
                      const isHome = m.home_team_id === team.id;
                      const opp = isHome ? m.away_team : m.home_team;
                      return (
                        <li key={m.id}>
                          <Link href={`/matches/${m.id}`} className="flex items-center gap-2 py-2 hover:bg-zinc-800 -mx-2 px-2 rounded">
                            <span className="text-xs text-zinc-500 shrink-0">{m.round?.name}</span>
                            {opp && (
                              <span className="inline-flex items-center gap-1.5 text-sm min-w-0">
                                <TeamCrest name={opp.name} shortName={opp.short_name} primaryColor={opp.primary_color} secondaryColor={opp.secondary_color} size={20} />
                                <span className="truncate">{opp.name}</span>
                              </span>
                            )}
                            <span className="text-xs text-zinc-400 ml-auto shrink-0">{formatKickoff(m.kickoff_at)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              {matches.length === 0 && <p className="text-sm text-zinc-500">Nema mečeva.</p>}
            </div>
          )}

          {tab === "players" && (
            <div>
              {players.length === 0 ? (
                <p className="text-sm text-zinc-500">Nema igrača u timu.</p>
              ) : (
                <ul className="divide-y divide-zinc-800">
                  {[...players].sort((a, b) => b.stats.goals - a.stats.goals || a.name.localeCompare(b.name)).map((p) => (
                    <li key={p.id}>
                      <Link href={`/players/${p.id}`} className="flex items-center gap-3 py-2 hover:bg-zinc-800 -mx-2 px-2 rounded">
                        <PlayerAvatar name={p.name} photoUrl={p.photo_url} teamPrimary={team.primary_color} size={36} />
                        <div className="flex-1">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-zinc-500">
                            {p.stats.goals}G · {p.stats.assists}A · {p.stats.yellows}🟨 · {p.stats.reds}🟥
                          </div>
                        </div>
                        <span className="text-blue-300 text-sm">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "stats" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  ["Odigrano", stats.played],
                  ["Pobeda", stats.wins],
                  ["Nerešeno", stats.draws],
                  ["Poraza", stats.losses],
                  ["Datih golova", stats.gf],
                  ["Primljenih", stats.ga],
                  ["Gol-razlika", stats.gd > 0 ? `+${stats.gd}` : stats.gd],
                  ["Bodova", stats.points],
                ] as const).map(([l, v]) => (
                  <div key={l} className="card !p-3 text-center">
                    <div className="text-xs text-zinc-500">{l}</div>
                    <div className="text-2xl font-bold tabular-nums">{v}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  ["Čista mreža", stats.cleanSheets],
                  ["Mečeva bez gola", stats.failedToScore],
                  ["Prosek datih", stats.avgFor.toFixed(2)],
                  ["Prosek primljenih", stats.avgAgainst.toFixed(2)],
                ] as const).map(([l, v]) => (
                  <div key={l} className="card !p-3 text-center">
                    <div className="text-xs text-zinc-500">{l}</div>
                    <div className="text-xl font-bold tabular-nums">{v}</div>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {stats.biggestWin && (
                  <div className="card border-blue-200 bg-blue-50">
                    <div className="text-xs text-blue-300 font-medium mb-1">Najveća pobeda</div>
                    <div className="font-bold tabular-nums text-lg">{stats.biggestWin.us} : {stats.biggestWin.them}</div>
                    {stats.biggestWin.opp && (
                      <div className="text-sm text-zinc-400 inline-flex items-center gap-1.5 mt-1">
                        protiv
                        <TeamCrest name={stats.biggestWin.opp.name} shortName={stats.biggestWin.opp.short_name} primaryColor={stats.biggestWin.opp.primary_color} secondaryColor={stats.biggestWin.opp.secondary_color} size={18} />
                        {stats.biggestWin.opp.name}
                      </div>
                    )}
                  </div>
                )}
                {stats.worstLoss && (
                  <div className="card border-red-200 bg-red-50">
                    <div className="text-xs text-red-700 font-medium mb-1">Najteži poraz</div>
                    <div className="font-bold tabular-nums text-lg">{stats.worstLoss.us} : {stats.worstLoss.them}</div>
                    {stats.worstLoss.opp && (
                      <div className="text-sm text-zinc-400 inline-flex items-center gap-1.5 mt-1">
                        protiv
                        <TeamCrest name={stats.worstLoss.opp.name} shortName={stats.worstLoss.opp.short_name} primaryColor={stats.worstLoss.opp.primary_color} secondaryColor={stats.worstLoss.opp.secondary_color} size={18} />
                        {stats.worstLoss.opp.name}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {stats.topScorer && (
                  <Link href={`/players/${stats.topScorer.id}`} className="card flex items-center gap-3 hover:border-blue-300">
                    <PlayerAvatar name={stats.topScorer.name} photoUrl={stats.topScorer.photo_url} teamPrimary={team.primary_color} size={40} />
                    <div className="flex-1">
                      <div className="text-xs text-zinc-500">Najbolji strelac</div>
                      <div className="font-semibold">{stats.topScorer.name}</div>
                    </div>
                    <div className="text-2xl font-bold tabular-nums">{stats.topScorer.stats.goals}</div>
                  </Link>
                )}
                {stats.topAssister && (
                  <Link href={`/players/${stats.topAssister.id}`} className="card flex items-center gap-3 hover:border-blue-300">
                    <PlayerAvatar name={stats.topAssister.name} photoUrl={stats.topAssister.photo_url} teamPrimary={team.primary_color} size={40} />
                    <div className="flex-1">
                      <div className="text-xs text-zinc-500">Najviše asistencija</div>
                      <div className="font-semibold">{stats.topAssister.name}</div>
                    </div>
                    <div className="text-2xl font-bold tabular-nums">{stats.topAssister.stats.assists}</div>
                  </Link>
                )}
                {stats.mostCards && (
                  <Link href={`/players/${stats.mostCards.id}`} className="card flex items-center gap-3 hover:border-blue-300">
                    <PlayerAvatar name={stats.mostCards.name} photoUrl={stats.mostCards.photo_url} teamPrimary={team.primary_color} size={40} />
                    <div className="flex-1">
                      <div className="text-xs text-zinc-500">Najviše kartona</div>
                      <div className="font-semibold">{stats.mostCards.name}</div>
                    </div>
                    <div className="text-right text-sm">
                      <span className="tabular-nums">{stats.mostCards.stats.yellows}🟨</span> · <span className="tabular-nums">{stats.mostCards.stats.reds}🟥</span>
                    </div>
                  </Link>
                )}
              </div>

              {stats.played === 0 && <p className="text-sm text-zinc-500 text-center">Tim još nije odigrao nijedan meč.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
