"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRealtimeMatch } from "@/lib/hooks/useRealtimeMatch";
import { useActionRunner } from "@/components/admin/FormButton";
import { TeamCrest } from "@/components/TeamCrest";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getCurrentMinute, phaseLabel } from "@/lib/matchClock";
import {
  createMatchEvent,
  deleteMatchEvent,
  startFirstHalf,
  endFirstHalf,
  startSecondHalf,
  finishMatch,
  startExtraTime,
  endExtraTime,
  finishPenalties,
} from "../../../actions";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"] & {
  home_team: { id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null } | null;
  away_team: { id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null } | null;
  round?: { stage: string; name: string } | null;
};
type Ev = Database["public"]["Tables"]["match_events"]["Row"];
type PlayerLite = { id: string; name: string; team_id: string | null; photo_url: string | null };

const eventIcon = (t: string) => t === "goal" ? "⚽" : t === "own_goal" ? "⚽AG" : t === "yellow_card" ? "🟨" : t === "red_card" ? "🟥" : "•";

function FinishMatchButtons({ match, run }: { match: Match; run: ReturnType<typeof useActionRunner> }) {
  const isKnockout = match.round?.stage === "knockout";
  const tied = match.home_score === match.away_score;

  async function finishWithWinner(winnerId: string | null) {
    const fd = new FormData();
    fd.set("id", match.id);
    if (winnerId) fd.set("knockout_winner_id", winnerId);
    await run(finishMatch, fd, { successMessage: "Završeno" });
  }

  async function onStartExtraTime() {
    const fd = new FormData();
    fd.set("id", match.id);
    await run(startExtraTime, fd, { successMessage: "Produžeci pokrenuti" });
  }

  // End-of-regulation in tied knockout → offer to start extra time
  if (isKnockout && tied) {
    return (
      <div className="flex flex-wrap gap-2">
        <button onClick={onStartExtraTime} className="btn-primary">Idi na produžetke (2×5 min)</button>
      </div>
    );
  }

  return (
    <button onClick={() => {
      if (!confirm("Završi meč?")) return;
      finishWithWinner(null);
    }} className="btn-danger">Završi meč</button>
  );
}

function ExtraTimeFinishButton({ match, run }: { match: Match; run: ReturnType<typeof useActionRunner> }) {
  const tied = match.home_score === match.away_score;
  async function onEnd() {
    const fd = new FormData();
    fd.set("id", match.id);
    await run(endExtraTime, fd, { successMessage: tied ? "Idemo na penale" : "Završeno u produžecima" });
  }
  return (
    <button onClick={onEnd} className="btn-primary">
      Završi produžetke {tied ? "→ penali" : "(meč je rešen)"}
    </button>
  );
}

function PenaltyEntry({ match, run }: { match: Match; run: ReturnType<typeof useActionRunner> }) {
  const [homePen, setHomePen] = useState<number>(match.home_pen ?? 0);
  const [awayPen, setAwayPen] = useState<number>(match.away_pen ?? 0);
  async function onFinish() {
    if (homePen === awayPen) {
      alert("Penal-šut mora imati pobednika.");
      return;
    }
    const fd = new FormData();
    fd.set("id", match.id);
    fd.set("home_pen", String(homePen));
    fd.set("away_pen", String(awayPen));
    await run(finishPenalties, fd, { successMessage: "Meč završen" });
  }
  return (
    <div className="card border-amber-300 bg-amber-50 space-y-3">
      <div className="text-sm font-medium text-amber-900">Penali — unesi rezultat šutiranja:</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-zinc-600">{match.home_team?.name}</span>
          <input
            type="number"
            min={0}
            max={20}
            value={homePen}
            onChange={(e) => setHomePen(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="input text-center text-xl font-bold tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-600">{match.away_team?.name}</span>
          <input
            type="number"
            min={0}
            max={20}
            value={awayPen}
            onChange={(e) => setAwayPen(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="input text-center text-xl font-bold tabular-nums"
          />
        </label>
      </div>
      <button onClick={onFinish} disabled={homePen === awayPen} className="btn-primary w-full">
        Završi meč (penali {homePen}-{awayPen})
      </button>
    </div>
  );
}

function LiveClock({ match }: { match: Match }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (match.phase === "first_half" || match.phase === "second_half") {
      const id = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(id);
    }
  }, [match.phase]);
  const minute = getCurrentMinute(match as any);
  const isLive = match.phase === "first_half" || match.phase === "second_half";
  return (
    <div className="text-center">
      {isLive && (
        <div className="text-red-600 font-bold text-2xl animate-pulse">{minute}&apos;</div>
      )}
      <div className="text-xs text-zinc-500">{phaseLabel(match.phase)}</div>
    </div>
  );
}

export function LiveEventEntry({ matchInit, eventsInit, players }: { matchInit: Match; eventsInit: Ev[]; players: PlayerLite[] }) {
  const { match, events } = useRealtimeMatch(matchInit.id, matchInit, eventsInit);
  const run = useActionRunner();
  const m = match as Match;

  const [selectedTeam, setSelectedTeam] = useState<string>(m.home_team_id ?? "");
  const [eventType, setEventType] = useState("goal");
  const [playerId, setPlayerId] = useState("");
  const [assistId, setAssistId] = useState("");

  const teamPlayers = players.filter((p) => p.team_id === selectedTeam);
  const playerMap = new Map(players.map((p) => [p.id, p]));

  async function onAddEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!playerId) return;
    // Minute is auto-computed from the match clock — admin doesn't enter it.
    const liveMinute = getCurrentMinute(m as any);
    const minuteToSend = liveMinute != null
      ? liveMinute
      : m.phase === "halftime"
      ? 20
      : m.phase === "finished"
      ? 40
      : 0;
    const fd = new FormData();
    fd.set("match_id", m.id);
    fd.set("team_id", selectedTeam);
    fd.set("player_id", playerId);
    fd.set("event_type", eventType);
    if (assistId && eventType === "goal") fd.set("assist_player_id", assistId);
    fd.set("minute", String(minuteToSend));
    const ok = await run(createMatchEvent, fd, { successMessage: "Dodato" });
    if (ok) {
      setPlayerId(""); setAssistId("");
    }
  }

  async function onDeleteEvent(id: string) {
    if (!confirm("Obrisati događaj?")) return;
    const fd = new FormData(); fd.set("id", id); fd.set("match_id", m.id);
    await run(deleteMatchEvent, fd, { successMessage: "Obrisano" });
  }

  async function setPhase(action: (fd: FormData) => Promise<any>, label: string) {
    const fd = new FormData(); fd.set("id", m.id);
    await run(action, fd, { successMessage: label });
  }

  const canLogEvents = m.phase === "first_half" || m.phase === "second_half";

  return (
    <div className="space-y-4">
      <Link href="/admin/matches" className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-blue-700">
        <ArrowLeft className="w-4 h-4" /> Nazad na mečeve
      </Link>
      <div className="card">
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="text-center min-w-0">
            <TeamCrest name={m.home_team?.name ?? "?"} shortName={m.home_team?.short_name} primaryColor={m.home_team?.primary_color} secondaryColor={m.home_team?.secondary_color} size={48} className="mx-auto" />
            <div className="font-semibold mt-1 text-xs sm:text-sm break-words leading-tight">{m.home_team?.name}</div>
            <div className="text-2xl font-bold tabular-nums">{m.home_score}</div>
          </div>
          <LiveClock match={m} />
          <div className="text-center min-w-0">
            <TeamCrest name={m.away_team?.name ?? "?"} shortName={m.away_team?.short_name} primaryColor={m.away_team?.primary_color} secondaryColor={m.away_team?.secondary_color} size={48} className="mx-auto" />
            <div className="font-semibold mt-1 text-xs sm:text-sm break-words leading-tight">{m.away_team?.name}</div>
            <div className="text-2xl font-bold tabular-nums">{m.away_score}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {(!m.phase || m.phase === "scheduled") && (
            <button onClick={() => setPhase(startFirstHalf, "Pokrenuto")} className="btn-primary">Pokreni meč</button>
          )}
          {m.phase === "first_half" && (
            <button onClick={() => setPhase(endFirstHalf, "Pauza")} className="btn-secondary">Kraj prvog poluvremena</button>
          )}
          {m.phase === "halftime" && (
            <button onClick={() => setPhase(startSecondHalf, "Drugo poluvreme")} className="btn-primary">Pokreni drugo poluvreme</button>
          )}
          {m.phase === "second_half" && <FinishMatchButtons match={m} run={run} />}
          {m.phase === "extra_time" && <ExtraTimeFinishButton match={m} run={run} />}
          {m.phase === "finished" && (
            <span className="text-sm text-zinc-500">
              Meč je završen{m.home_pen != null && m.away_pen != null ? ` (penali ${m.home_pen}-${m.away_pen})` : ""}.
            </span>
          )}
        </div>
        {m.phase === "penalties" && (
          <div className="mt-3">
            <PenaltyEntry match={m} run={run} />
          </div>
        )}
      </div>

      {canLogEvents && (
        <form onSubmit={onAddEvent} className="card space-y-2">
          <h2 className="font-medium">Dodaj događaj</h2>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={selectedTeam} onChange={(e) => { setSelectedTeam(e.target.value); setPlayerId(""); setAssistId(""); }}>
              <option value={m.home_team_id ?? ""}>{m.home_team?.name}</option>
              <option value={m.away_team_id ?? ""}>{m.away_team?.name}</option>
            </select>
            <select className="input" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="goal">Gol</option>
              <option value="own_goal">Autogol</option>
              <option value="yellow_card">Žuti karton</option>
              <option value="red_card">Crveni karton</option>
            </select>
            <select className="input" value={playerId} onChange={(e) => setPlayerId(e.target.value)} required>
              <option value="">Igrač</option>
              {teamPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {eventType === "goal" && (
              <select className="input" value={assistId} onChange={(e) => setAssistId(e.target.value)}>
                <option value="">Bez asistencije</option>
                {teamPlayers.filter((p) => p.id !== playerId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            Minut: <b className="tabular-nums">{getCurrentMinute(m as any) ?? (m.phase === "halftime" ? 20 : m.phase === "finished" ? 40 : "—")}&apos;</b> (automatski iz sata meča)
          </p>
          <button className="btn-primary w-full">Sačuvaj događaj</button>
        </form>
      )}

      <div className="card">
        <h2 className="font-medium mb-2">Tok meča</h2>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500">Još nema događaja.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {events.map((e) => {
              const p = playerMap.get(e.player_id);
              const assist = e.assist_player_id ? playerMap.get(e.assist_player_id) : null;
              return (
                <li key={e.id} className="py-2 flex items-center gap-2 text-sm">
                  <span className="text-xs text-zinc-500 w-8 tabular-nums">{e.minute != null ? `${e.minute}'` : "—"}</span>
                  <span>{eventIcon(e.event_type)}</span>
                  <PlayerAvatar name={p?.name ?? "?"} photoUrl={p?.photo_url ?? null} size={24} />
                  <span className="font-medium">{p?.name ?? "?"}</span>
                  {assist && <span className="text-xs text-zinc-500">asist: {assist.name}</span>}
                  <button onClick={() => onDeleteEvent(e.id)} className="ml-auto text-xs text-red-600 hover:underline">obriši</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
