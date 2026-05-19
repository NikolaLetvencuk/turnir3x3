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

type EventKind = "goal" | "own_goal" | "yellow_card" | "red_card";

const KIND_LABELS: Record<EventKind, { verb: string; label: string; icon: string; tone: string }> = {
  goal: { verb: "postiže gol", label: "Gol", icon: "⚽", tone: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  own_goal: { verb: "autogol", label: "Autogol", icon: "⚽", tone: "bg-zinc-700 hover:bg-zinc-800 text-white" },
  yellow_card: { verb: "žuti karton", label: "Žuti karton", icon: "🟨", tone: "bg-yellow-400 hover:bg-yellow-500 text-zinc-900" },
  red_card: { verb: "crveni karton", label: "Crveni karton", icon: "🟥", tone: "bg-red-600 hover:bg-red-700 text-white" },
};

function TeamEventPanel({
  team,
  teamPlayers,
  onOpen,
}: {
  team: { id: string; name: string } | null;
  teamPlayers: PlayerLite[];
  onOpen: (kind: EventKind, teamId: string) => void;
}) {
  if (!team) return null;
  const disabled = teamPlayers.length === 0;
  const kinds: EventKind[] = ["goal", "own_goal", "yellow_card", "red_card"];
  return (
    <div className="card !p-2 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 text-center font-semibold truncate">{team.name}</div>
      {kinds.map((k) => {
        const cfg = KIND_LABELS[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => onOpen(k, team.id)}
            disabled={disabled}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${cfg.tone}`}
          >
            <span aria-hidden>{cfg.icon}</span>
            <span className="truncate">{team.name} {cfg.verb}</span>
          </button>
        );
      })}
    </div>
  );
}

function EventModal({
  kind,
  team,
  teamPlayers,
  onCancel,
  onConfirm,
  pending,
}: {
  kind: EventKind;
  team: { id: string; name: string };
  teamPlayers: PlayerLite[];
  onCancel: () => void;
  onConfirm: (playerId: string, assistId: string | null) => void;
  pending: boolean;
}) {
  const [playerId, setPlayerId] = useState("");
  const [assistId, setAssistId] = useState("");
  const cfg = KIND_LABELS[kind];
  const askAssist = kind === "goal";
  const playerLabel =
    kind === "goal" ? "Strelac"
    : kind === "own_goal" ? "Igrač (autogol)"
    : "Igrač";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl max-w-md w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>{cfg.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{team.name} — {cfg.label}</div>
          </div>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none" aria-label="Zatvori">×</button>
        </div>
        <label className="block">
          <span className="text-xs text-zinc-600">{playerLabel}</span>
          <select
            className="input"
            value={playerId}
            onChange={(e) => { setPlayerId(e.target.value); if (e.target.value === assistId) setAssistId(""); }}
            autoFocus
          >
            <option value="">Izaberi igrača…</option>
            {teamPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {askAssist && (
          <label className="block">
            <span className="text-xs text-zinc-600">Asistent (opciono)</span>
            <select
              className="input"
              value={assistId}
              onChange={(e) => setAssistId(e.target.value)}
            >
              <option value="">Bez asistencije</option>
              {teamPlayers.filter((p) => p.id !== playerId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1">Otkaži</button>
          <button
            onClick={() => onConfirm(playerId, assistId || null)}
            disabled={!playerId || pending}
            className="btn-primary flex-1"
          >
            {pending ? "Snimam…" : "Potvrdi"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveEventEntry({ matchInit, eventsInit, players }: { matchInit: Match; eventsInit: Ev[]; players: PlayerLite[] }) {
  const { match, events } = useRealtimeMatch(matchInit.id, matchInit, eventsInit);
  const run = useActionRunner();
  const m = match as Match;

  const [modal, setModal] = useState<{ kind: EventKind; teamId: string } | null>(null);
  const [pending, setPending] = useState(false);

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const homePlayers = players.filter((p) => p.team_id === m.home_team_id);
  const awayPlayers = players.filter((p) => p.team_id === m.away_team_id);

  function openModal(kind: EventKind, teamId: string) {
    setModal({ kind, teamId });
  }

  async function onConfirmEvent(playerId: string, assistId: string | null) {
    if (!modal) return;
    setPending(true);
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
    fd.set("team_id", modal.teamId);
    fd.set("player_id", playerId);
    fd.set("event_type", modal.kind);
    if (assistId && modal.kind === "goal") fd.set("assist_player_id", assistId);
    fd.set("minute", String(minuteToSend));
    const ok = await run(createMatchEvent, fd, { successMessage: "Dodato" });
    setPending(false);
    if (ok) setModal(null);
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

  const canLogEvents = m.phase === "first_half" || m.phase === "second_half" || m.phase === "extra_time";

  const modalTeam = modal
    ? (modal.teamId === m.home_team_id ? m.home_team : m.away_team)
    : null;
  const modalPlayers = modal
    ? (modal.teamId === m.home_team_id ? homePlayers : awayPlayers)
    : [];

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
        <div className="grid grid-cols-2 gap-2">
          <TeamEventPanel
            team={m.home_team ? { id: m.home_team.id, name: m.home_team.name } : null}
            teamPlayers={homePlayers}
            onOpen={openModal}
          />
          <TeamEventPanel
            team={m.away_team ? { id: m.away_team.id, name: m.away_team.name } : null}
            teamPlayers={awayPlayers}
            onOpen={openModal}
          />
        </div>
      )}

      {modal && modalTeam && (
        <EventModal
          kind={modal.kind}
          team={{ id: modalTeam.id, name: modalTeam.name }}
          teamPlayers={modalPlayers}
          onCancel={() => setModal(null)}
          onConfirm={onConfirmEvent}
          pending={pending}
        />
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
