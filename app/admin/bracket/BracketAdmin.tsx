"use client";

import { useState } from "react";
import { AlertTriangle, Lock, Unlock, Trophy } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";
import { BracketTree, type BracketMatchView, type TeamLite } from "@/components/bracket/BracketTree";
import { useActionRunner } from "@/components/admin/FormButton";
import { PageHeader } from "@/components/admin/PageHeader";
import { useToast } from "@/components/ui/Toast";
import type { WildcardReport } from "@/lib/resolveBracket";
import {
  generateKnockoutBracket,
  setBracketSlot,
  clearBracketOverride,
  lockGroupStage,
  unlockGroupStage,
  resolveBracketNow,
} from "./actions";

type Group = { id: string; name: string; display_order: number };
type Round = { id: string; name: string; display_order: number };
type Match = BracketMatchView & { round_id: string };
type State = {
  group_stage_locked: boolean;
  advancing_per_group: number | null;
  best_thirds: number | null;
  include_third_place: boolean;
} | null;

const ORDINAL_LABEL_TITLE: Record<number, string> = {
  1: "drugoplasirani",
  2: "trećeplasirani",
  3: "četvrtoplasirani",
  4: "petoplasirani",
  5: "šestoplasirani",
  6: "sedmoplasirani",
  7: "osmoplasirani",
};

export function BracketAdmin({
  groups,
  teams,
  rounds,
  matches,
  state,
  wildcardReport,
  totalAdvancing: savedTotalAdvancing,
}: {
  groups: Group[];
  teams: TeamLite[];
  rounds: Round[];
  matches: Match[];
  state: State;
  wildcardReport: WildcardReport | null;
  totalAdvancing: number;
}) {
  const run = useActionRunner();
  const { push } = useToast();
  const [advancingTotal, setAdvancingTotal] = useState<number>(state?.advancing_per_group ? state.advancing_per_group * groups.length + (state.best_thirds ?? 0) : Math.min(8, Math.max(2, groups.length * 2)));
  const [advancingPerGroup, setAdvancingPerGroup] = useState<number>(state?.advancing_per_group ?? Math.floor(advancingTotal / Math.max(1, groups.length)));
  const [includeThird, setIncludeThird] = useState<boolean>(state?.include_third_place !== false);

  const bestThirds = Math.max(0, advancingTotal - advancingPerGroup * groups.length);
  const validPowerOf2 = [2, 4, 8, 16].includes(advancingTotal);
  const enoughTeams = advancingTotal <= teams.length;

  const [editingSlot, setEditingSlot] = useState<{ match_id: string; slot: "home" | "away"; current: string | null } | null>(null);

  async function onGenerate() {
    if (matches.length > 0) {
      if (!confirm("Postojeći nokaut će biti obrisan. Nastaviti?")) return;
    }
    const res = await generateKnockoutBracket({ advancingPerGroup, bestThirds, includeThirdPlace: includeThird });
    if (!res.ok) { push(res.error, "error"); return; }
    push("Nokaut kostur generisan", "success");
  }

  async function onLock(force: boolean) {
    if (force && !confirm("Force lock — neke meč može da bude nezavršen. Nastaviti?")) return;
    const res = await lockGroupStage({ force });
    if (!res.ok) { push(res.error, "error"); return; }
    push("Grupna faza zaključana", "success");
  }

  async function onUnlock() {
    if (!confirm("Otključati grupnu fazu? Auto-rešeni slotovi se brišu (manuelno postavljeni ostaju).")) return;
    const res = await unlockGroupStage();
    if (!res.ok) { push(res.error, "error"); return; }
    push("Otključano", "success");
  }

  async function onResolveNow() {
    const res = await resolveBracketNow();
    if (!res.ok) { push(res.error, "error"); return; }
    push("Slotovi osveženi", "success");
  }

  async function onAssignSlot(team_id: string | null) {
    if (!editingSlot) return;
    const res = await setBracketSlot({ match_id: editingSlot.match_id, slot: editingSlot.slot, team_id });
    if (!res.ok) { push(res.error, "error"); return; }
    push("Sačuvano", "success");
    setEditingSlot(null);
  }

  async function onClearOverride() {
    if (!editingSlot) return;
    const res = await clearBracketOverride({ match_id: editingSlot.match_id, slot: editingSlot.slot });
    if (!res.ok) { push(res.error, "error"); return; }
    push("Vraćeno na placeholder", "success");
    setEditingSlot(null);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Trophy}
        title="Eliminacije"
        hint="Generiši nokaut stablo posle grupne faze. Pobednik osmine ide u četvrtfinale, pa polufinale, finale."
        tone="purple"
      />

      <div className="card space-y-3">
        <h2 className="font-medium">Konfiguracija nokauta</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="text-sm">
            <span className="label">Ukupno timova koji prolaze</span>
            <select value={advancingTotal} onChange={(e) => setAdvancingTotal(Number(e.target.value))} className="input">
              {[2, 4, 8, 16].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="label">Direktno po grupi</span>
            <input type="number" min={1} max={advancingTotal} value={advancingPerGroup} onChange={(e) => setAdvancingPerGroup(Math.max(1, Number(e.target.value) || 1))} className="input" />
          </label>
          <div className="text-sm">
            <span className="label">Najbolji {ORDINAL_LABEL_TITLE[Math.max(1, advancingPerGroup)] ?? `${advancingPerGroup + 1}-toplasirani`}</span>
            <div className="input bg-zinc-900">{bestThirds}</div>
          </div>
        </div>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={includeThird} onChange={(e) => setIncludeThird(e.target.checked)} />
          Uključi meč za 3. mesto
        </label>
        {!validPowerOf2 && <p className="text-xs text-red-600">Ukupno mora biti 2, 4, 8 ili 16.</p>}
        {!enoughTeams && <p className="text-xs text-red-600">Imaš samo {teams.length} timova.</p>}
        {groups.length === 0 && <p className="text-xs text-amber-700">Prvo pokreni žreb grupa.</p>}
        <button onClick={onGenerate} disabled={!validPowerOf2 || !enoughTeams || groups.length === 0} className="btn-primary">
          {matches.length > 0 ? "Generiši ponovo" : "Generiši nokaut"}
        </button>
      </div>

      {wildcardReport && (
        <WildcardPanel report={wildcardReport} savedTotal={savedTotalAdvancing} />
      )}

      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-medium">Grupna faza</h2>
          <div className="flex items-center gap-2">
            {state?.group_stage_locked ? (
              <>
                <span className="badge-finished"><Lock className="w-3 h-3 inline mr-1" />Zaključana</span>
                <button onClick={onResolveNow} className="btn-secondary !py-1 !px-2 text-xs">Osveži slotove</button>
                <button onClick={onUnlock} className="btn-secondary !py-1 !px-2 text-xs">Otključaj</button>
              </>
            ) : (
              <>
                <span className="badge-scheduled"><Unlock className="w-3 h-3 inline mr-1" />Aktivna</span>
                <button onClick={() => onLock(false)} className="btn-primary !py-1 !px-2 text-xs">Zaključaj</button>
                <button onClick={() => onLock(true)} className="btn-secondary !py-1 !px-2 text-xs">Force lock</button>
              </>
            )}
          </div>
        </div>
      </div>

      {matches.length > 0 && (
        <BracketTree rounds={rounds} matches={matches} teams={teams} onSlotClick={(match_id, slot, current) => setEditingSlot({ match_id, slot, current })} />
      )}

      {editingSlot && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditingSlot(null)}>
          <div className="bg-zinc-900 rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Postavi tim u slot</h3>
            <select
              className="input mb-3"
              value={editingSlot.current ?? ""}
              onChange={(e) => onAssignSlot(e.target.value || null)}
            >
              <option value="">— bez tima —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={onClearOverride} className="btn-secondary">Vrati na placeholder</button>
              <button onClick={() => setEditingSlot(null)} className="btn-secondary">Zatvori</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WildcardPanel({ report, savedTotal }: { report: WildcardReport; savedTotal: number }) {
  const selected = report.candidates.filter((c) => c.selected);
  const overflow = report.candidates.length < report.needed;

  return (
    <div className="card space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="font-medium">
          Najbolji {report.rankLabel}
          <span className="ml-2 text-xs font-normal text-zinc-400">
            izabrano {selected.length} / {report.needed}
            {savedTotal > 0 && ` · plasira se u nokaut od ${savedTotal}`}
          </span>
        </h2>
      </div>

      {overflow && (
        <div className="flex items-start gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Treba {report.needed} timova ali samo {report.candidates.length} grupa ima{" "}
            {report.rankLabel.replace("ih", "og")} igrača.
            {report.missingGroups.length > 0 && (
              <> Grupe bez te pozicije: {report.missingGroups.join(", ")}.</>
            )}
          </div>
        </div>
      )}

      {report.contestedTies.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Izjednačenje ne razrešava ni bodovima, ni gol-razlikom, ni datim/primljenim golovima.
            Sistem bira deterministički — ako ne odgovara, ručno postavi slot ili odluči baražom.
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-zinc-500 uppercase tracking-wider">
            <tr>
              <th className="text-left py-1.5 pr-2 font-medium">#</th>
              <th className="text-left py-1.5 pr-2 font-medium">Tim</th>
              <th className="text-left py-1.5 pr-2 font-medium">Grupa</th>
              <th className="text-right py-1.5 px-2 font-medium">O</th>
              <th className="text-right py-1.5 px-2 font-medium">Bod</th>
              <th className="text-right py-1.5 px-2 font-medium">GR</th>
              <th className="text-right py-1.5 px-2 font-medium">DG</th>
              <th className="text-right py-1.5 px-2 font-medium">PG</th>
              <th className="text-right py-1.5 pl-2 font-medium">PPG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {report.candidates.map((c, i) => {
              const cutoff = i === report.needed - 1;
              return (
                <tr
                  key={c.team_id}
                  className={
                    c.selected
                      ? "text-zinc-100" + (cutoff ? " border-b-2 border-gold-500/40" : "")
                      : "text-zinc-500"
                  }
                >
                  <td className="py-1.5 pr-2 tabular-nums">{i + 1}</td>
                  <td className="py-1.5 pr-2">
                    {c.selected && <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold-500 mr-1.5 align-middle" />}
                    {c.team_name}
                  </td>
                  <td className="py-1.5 pr-2">{c.group_letter}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{c.played}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{c.points}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{c.goal_diff > 0 ? `+${c.goal_diff}` : c.goal_diff}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{c.goals_for}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{c.goals_against}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{c.ppg.toFixed(2)}</td>
                </tr>
              );
            })}
            {report.candidates.length === 0 && (
              <tr><td colSpan={9} className="py-3 text-center text-zinc-500 italic">Nema kandidata — proveri da grupe imaju dovoljno timova.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
