"use client";

import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { Lock } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";
import { useActionRunner } from "@/components/admin/FormButton";
import { useToast } from "@/components/ui/Toast";
import { moveMatchToRound } from "../actions";
import { formatDateTime } from "@/lib/utils";

type Team = { id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null };
type Match = {
  id: string;
  round_id: string;
  status: string;
  phase: string | null;
  kickoff_at: string | null;
  home: Team | null;
  away: Team | null;
};
type Round = { id: string; name: string; status: string; display_order: number };

function MatchCard({ match, disabled }: { match: Match; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: match.id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`bg-white border border-zinc-200 rounded-md p-2 text-xs ${disabled ? "opacity-60" : "cursor-grab hover:border-blue-300"} ${isDragging ? "opacity-30" : ""}`}
    >
      <div className="text-[10px] text-zinc-500 mb-1">{formatDateTime(match.kickoff_at)}</div>
      <div className="flex items-center gap-1 mb-1">
        <TeamCrest name={match.home?.name ?? "?"} shortName={match.home?.short_name} primaryColor={match.home?.primary_color} secondaryColor={match.home?.secondary_color} size={18} />
        <span className="truncate">{match.home?.name ?? "?"}</span>
      </div>
      <div className="flex items-center gap-1">
        <TeamCrest name={match.away?.name ?? "?"} shortName={match.away?.short_name} primaryColor={match.away?.primary_color} secondaryColor={match.away?.secondary_color} size={18} />
        <span className="truncate">{match.away?.name ?? "?"}</span>
      </div>
    </div>
  );
}

function RoundColumn({ round, children }: { round: Round; children: React.ReactNode }) {
  const locked = round.status !== "upcoming";
  const { setNodeRef, isOver } = useDroppable({ id: round.id, disabled: locked });
  return (
    <div
      ref={setNodeRef}
      className={`w-56 shrink-0 bg-zinc-50 rounded-lg p-2 border ${isOver ? "border-blue-400 bg-blue-50" : "border-zinc-200"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">{round.name}</div>
        {locked && <Lock className="w-3.5 h-3.5 text-zinc-400" />}
      </div>
      <div className="space-y-2 min-h-[80px]">{children}</div>
    </div>
  );
}

export function ScheduleBoard({ rounds, matches }: { rounds: Round[]; matches: Match[] }) {
  const run = useActionRunner();
  const { push } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Optimistic update: maintain local state for round assignments
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const effectiveMatches = useMemo(() => matches.map((m) => ({ ...m, round_id: overrides[m.id] ?? m.round_id })), [matches, overrides]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const activeMatch = effectiveMatches.find((m) => m.id === activeId);
  const matchById = new Map(effectiveMatches.map((m) => [m.id, m]));

  function lockedRound(r: Round) { return r.status !== "upcoming"; }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const matchId = e.active.id as string;
    const targetRoundId = e.over?.id as string | undefined;
    if (!targetRoundId) return;
    const current = matchById.get(matchId);
    if (!current || current.round_id === targetRoundId) return;
    const target = rounds.find((r) => r.id === targetRoundId);
    if (!target || lockedRound(target)) { push("Kolo je zaključano", "error"); return; }
    setOverrides((s) => ({ ...s, [matchId]: targetRoundId }));
    const fd = new FormData(); fd.set("match_id", matchId); fd.set("round_id", targetRoundId);
    const ok = await run(moveMatchToRound, fd, { successMessage: "Pomereno" });
    if (!ok) {
      setOverrides((s) => { const c = { ...s }; delete c[matchId]; return c; });
    }
  }

  if (rounds.length === 0) {
    return <div className="card text-sm text-zinc-600">Još nema kola. Pokreni žreb iz <a href="/admin/draw" className="text-blue-700 underline">/admin/draw</a>.</div>;
  }

  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {rounds.map((r) => (
          <RoundColumn key={r.id} round={r}>
            {effectiveMatches.filter((m) => m.round_id === r.id).map((m) => (
              <MatchCard key={m.id} match={m} disabled={lockedRound(r) || m.status !== "scheduled"} />
            ))}
          </RoundColumn>
        ))}
      </div>
      <DragOverlay>
        {activeMatch ? (
          <div className="bg-white border border-blue-400 shadow-lg rounded-md p-2 text-xs w-52">
            <div className="flex items-center gap-1 mb-1">
              <TeamCrest name={activeMatch.home?.name ?? "?"} shortName={activeMatch.home?.short_name} primaryColor={activeMatch.home?.primary_color} secondaryColor={activeMatch.home?.secondary_color} size={18} />
              <span className="truncate">{activeMatch.home?.name ?? "?"}</span>
            </div>
            <div className="flex items-center gap-1">
              <TeamCrest name={activeMatch.away?.name ?? "?"} shortName={activeMatch.away?.short_name} primaryColor={activeMatch.away?.primary_color} secondaryColor={activeMatch.away?.secondary_color} size={18} />
              <span className="truncate">{activeMatch.away?.name ?? "?"}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
