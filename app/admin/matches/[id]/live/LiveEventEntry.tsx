"use client";

import { useState } from "react";
import { useRealtimeMatch } from "@/lib/hooks/useRealtimeMatch";
import { useActionRunner } from "@/components/admin/FormButton";
import { createMatchEvent, deleteMatchEvent, startMatch, finishMatch, updateMatchScore } from "../../../actions";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"] & {
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
};
type Ev = Database["public"]["Tables"]["match_events"]["Row"];
type PlayerLite = { id: string; name: string; team_id: string | null };

const eventIcon = (t: string) => t === "goal" ? "⚽" : t === "own_goal" ? "⚽AG" : t === "yellow_card" ? "🟨" : t === "red_card" ? "🟥" : "•";

export function LiveEventEntry({ matchInit, eventsInit, players }: { matchInit: Match; eventsInit: Ev[]; players: PlayerLite[] }) {
  const { match, events } = useRealtimeMatch(matchInit.id, matchInit, eventsInit);
  const run = useActionRunner();
  const m = match as Match;

  const [selectedTeam, setSelectedTeam] = useState<string>(m.home_team_id);
  const [eventType, setEventType] = useState("goal");
  const [playerId, setPlayerId] = useState("");
  const [assistId, setAssistId] = useState("");
  const [minute, setMinute] = useState<string>("");

  const teamPlayers = players.filter((p) => p.team_id === selectedTeam);
  const playerMap = new Map(players.map((p) => [p.id, p]));

  async function onAddEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!playerId) return;
    const fd = new FormData();
    fd.set("match_id", m.id);
    fd.set("team_id", selectedTeam);
    fd.set("player_id", playerId);
    fd.set("event_type", eventType);
    if (assistId && eventType === "goal") fd.set("assist_player_id", assistId);
    if (minute) fd.set("minute", minute);
    const ok = await run(createMatchEvent, fd, { successMessage: "Dodato" });
    if (ok) { setPlayerId(""); setAssistId(""); setMinute(""); }
  }

  async function onDeleteEvent(id: string) {
    if (!confirm("Obrisati događaj?")) return;
    const fd = new FormData(); fd.set("id", id); fd.set("match_id", m.id);
    await run(deleteMatchEvent, fd, { successMessage: "Obrisano" });
  }

  async function adjustScore(side: "home" | "away", delta: number) {
    const fd = new FormData();
    fd.set("id", m.id);
    fd.set("home_score", String(side === "home" ? Math.max(0, m.home_score + delta) : m.home_score));
    fd.set("away_score", String(side === "away" ? Math.max(0, m.away_score + delta) : m.away_score));
    await run(updateMatchScore, fd, { successMessage: "Rezultat" });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="text-center">
            <div className="font-semibold">{m.home_team?.name}</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <button onClick={() => adjustScore("home", -1)} className="btn-secondary !py-1 !px-2 text-xs">−</button>
              <span className="text-2xl font-bold tabular-nums">{m.home_score}</span>
              <button onClick={() => adjustScore("home", 1)} className="btn-secondary !py-1 !px-2 text-xs">+</button>
            </div>
          </div>
          <div className="text-center">
            {m.status === "live" && <span className="badge-live"><span className="live-dot" />UŽIVO</span>}
            {m.status === "scheduled" && (
              <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(); fd.set("id", m.id); await run(startMatch, fd, { successMessage: "Uživo" }); }}>
                <button className="btn-primary text-xs">Go Live</button>
              </form>
            )}
            {m.status === "finished" && <span className="badge-finished">Završeno</span>}
          </div>
          <div className="text-center">
            <div className="font-semibold">{m.away_team?.name}</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <button onClick={() => adjustScore("away", -1)} className="btn-secondary !py-1 !px-2 text-xs">−</button>
              <span className="text-2xl font-bold tabular-nums">{m.away_score}</span>
              <button onClick={() => adjustScore("away", 1)} className="btn-secondary !py-1 !px-2 text-xs">+</button>
            </div>
          </div>
        </div>
        {m.status === "live" && (
          <form className="mt-3 text-center" onSubmit={async (e) => { e.preventDefault(); if (!confirm("Završi meč?")) return; const fd = new FormData(); fd.set("id", m.id); await run(finishMatch, fd, { successMessage: "Završeno" }); }}>
            <button className="btn-danger">Završi meč</button>
          </form>
        )}
      </div>

      <form onSubmit={onAddEvent} className="card space-y-2">
        <h2 className="font-medium">Dodaj događaj</h2>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={selectedTeam} onChange={(e) => { setSelectedTeam(e.target.value); setPlayerId(""); setAssistId(""); }}>
            <option value={m.home_team_id}>{m.home_team?.name}</option>
            <option value={m.away_team_id}>{m.away_team?.name}</option>
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
          {eventType === "goal" ? (
            <select className="input" value={assistId} onChange={(e) => setAssistId(e.target.value)}>
              <option value="">Bez asistencije</option>
              {teamPlayers.filter((p) => p.id !== playerId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <input className="input" type="number" placeholder="Minut" value={minute} onChange={(e) => setMinute(e.target.value)} />
          )}
          {eventType === "goal" && <input className="input" type="number" placeholder="Minut" value={minute} onChange={(e) => setMinute(e.target.value)} />}
        </div>
        <button className="btn-primary w-full">Sačuvaj događaj</button>
      </form>

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
