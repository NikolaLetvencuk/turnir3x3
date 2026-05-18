"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TeamCrest } from "@/components/TeamCrest";
import { useToast } from "@/components/ui/Toast";
import { composeDraw, type DrawResult, type DrawTeam } from "@/lib/draw";
import {
  commitDraw,
  scheduleDraw,
  cancelScheduledDraw,
  updateScheduledGroupCount,
} from "../actions";
import { belgradeLocalToUTCISO, formatKickoff } from "@/lib/utils";

type Mode = "auto" | "manual";

type DrawStateLite = {
  state: "idle" | "scheduled" | "running" | "committed";
  scheduled_at: string | null;
  group_count: number | null;
  result: any | null;
};

const ALPHABET = "ABCDEFGH";

export function DrawClient({
  teams,
  hasExisting,
  drawState,
}: {
  teams: DrawTeam[];
  hasExisting: boolean;
  drawState: DrawStateLite | null;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [mode, setMode] = useState<Mode>("auto");
  const [groupCount, setGroupCount] = useState(Math.max(2, Math.min(8, Math.floor(teams.length / 3) || 2)));
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [pending, setPending] = useState(false);

  // Manual mode state
  const [assignment, setAssignment] = useState<Record<string, number | null>>({});
  const [manualPhase, setManualPhase] = useState<"config" | "preview" | "saving">("config");
  const [manualResult, setManualResult] = useState<DrawResult | null>(null);
  const manualBuckets = useMemo(() => {
    const buckets: DrawTeam[][] = Array.from({ length: groupCount }, () => []);
    for (const t of teams) {
      const gi = assignment[t.id];
      if (gi != null && gi >= 0 && gi < groupCount) buckets[gi].push(t);
    }
    return buckets;
  }, [teams, assignment, groupCount]);
  const unassignedCount = teams.length - Object.values(assignment).filter((v) => v != null).length;
  const groupSizes = manualBuckets.map((b) => b.length);
  const minGroupSize = groupSizes.length ? Math.min(...groupSizes) : 0;
  const manualValid = unassignedCount === 0 && minGroupSize >= 2;

  const hasScheduled = drawState && drawState.state === "scheduled";

  async function onSchedule(when: "now" | "later") {
    if (when === "later" && !scheduleAt.trim()) { push("Izaberi datum/vreme", "error"); return; }
    if (teams.length < groupCount * 2) {
      push(`Potrebno najmanje ${groupCount * 2} timova za ${groupCount} grupa`, "error");
      return;
    }
    if (hasExisting) {
      if (!confirm("Postojeća kola, grupe i mečevi će biti obrisani kad se žreb potvrdi. Nastaviti?")) return;
    }
    const iso = when === "now" ? new Date().toISOString() : belgradeLocalToUTCISO(scheduleAt.trim());
    if (!iso) { push("Neispravan datum/vreme", "error"); return; }
    setPending(true);
    const res = await scheduleDraw({ scheduled_at: iso, group_count: groupCount, per_pick_ms: 5000 });
    setPending(false);
    if (!res.ok) { push(res.error, "error"); return; }
    push(when === "now" ? "Žreb je pokrenut!" : "Žreb zakazan", "success");
    router.push("/draw");
    router.refresh();
  }

  async function onChangeScheduledGroupCount(newGc: number) {
    setPending(true);
    const res = await updateScheduledGroupCount({ group_count: newGc });
    setPending(false);
    if (!res.ok) { push(res.error, "error"); return; }
    push("Broj grupa promenjen", "success");
    router.refresh();
  }

  async function onCancelScheduled() {
    if (!confirm("Otkazati zakazani žreb?")) return;
    const res = await cancelScheduledDraw();
    if (!res.ok) { push(res.error, "error"); return; }
    push("Otkazano", "success");
    router.refresh();
  }

  function setTeamGroup(team_id: string, gi: number | null) {
    setAssignment((s) => ({ ...s, [team_id]: gi }));
  }
  function autoFillManual() {
    const next: Record<string, number | null> = { ...assignment };
    const counts = manualBuckets.map((b) => b.length);
    for (const t of teams) {
      if (next[t.id] != null) continue;
      let minIdx = 0;
      for (let i = 1; i < counts.length; i++) if (counts[i] < counts[minIdx]) minIdx = i;
      next[t.id] = minIdx;
      counts[minIdx]++;
    }
    setAssignment(next);
  }
  function clearManual() { setAssignment({}); }

  function buildManualResult() {
    try {
      const r = composeDraw(manualBuckets);
      setManualResult(r);
      setManualPhase("preview");
    } catch (e: any) {
      push(e?.message ?? "Greška u žrebu", "error");
    }
  }

  async function commitManual() {
    if (!manualResult) return;
    if (hasExisting) {
      if (!confirm("Postojeća kola i mečevi će biti obrisani. Nastaviti?")) return;
    }
    setManualPhase("saving");
    const payload = {
      groups: manualResult.groups.map((g) => ({ name: g.name, team_ids: g.teams.map((t) => t.id) })),
      rounds: manualResult.rounds.map((r) => ({
        name: r.name,
        matches: r.matches.map((m) => ({ group_index: m.group_index, home_team_id: m.home.id, away_team_id: m.away.id })),
      })),
    };
    const res = await commitDraw(payload);
    if (!res.ok) { push(res.error, "error"); setManualPhase("preview"); return; }
    push("Žreb sačuvan", "success");
    router.push("/admin/schedule");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Žreb grupa</h1>

      {hasScheduled && (
        <ScheduledDrawStatus
          ds={drawState!}
          onChangeGc={onChangeScheduledGroupCount}
          onCancel={onCancelScheduled}
          pending={pending}
        />
      )}

      {!hasScheduled && (
        <div className="card !p-0 overflow-hidden">
          <div className="flex border-b border-zinc-200">
            {(["auto", "manual"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`flex-1 py-2 px-3 text-sm font-medium transition ${mode === k ? "bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600" : "text-zinc-600 hover:bg-zinc-50"}`}
              >
                {k === "auto" ? "Live žreb (sa tajmerom)" : "Ručno raspoređivanje"}
              </button>
            ))}
          </div>
          <div className="p-3 space-y-3">
            {mode === "auto" ? (
              <>
                <p className="text-sm text-zinc-600">
                  Postavi broj grupa i termin. <b>Rezultat se povlači tek u trenutku žreba</b> — timovi se mogu dodavati do tada.
                  Svi sa otvorenom stranicom <a href="/draw" className="underline">/draw</a> vide odbrojavanje, pa žreb uživo.
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <label className="block text-sm">
                    <span className="label">Broj grupa (2–8)</span>
                    <input
                      type="number"
                      min={2}
                      max={8}
                      value={groupCount}
                      onChange={(e) => setGroupCount(Math.max(2, Math.min(8, Number(e.target.value) || 2)))}
                      className="input"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="label">Zakaži za (opciono)</span>
                    <input type="datetime-local" className="input" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                  </label>
                </div>
                <p className="text-xs text-zinc-500">Trenutno prijavljeno timova: <b>{teams.length}</b>. Treba ti bar {groupCount * 2}.</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => onSchedule("now")} disabled={pending || teams.length < groupCount * 2} className="btn-primary">Pokreni odmah</button>
                  <button onClick={() => onSchedule("later")} disabled={pending || !scheduleAt || teams.length < groupCount * 2} className="btn bg-emerald-700 text-white hover:bg-emerald-800">Zakaži</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-600">Sam dodeljuješ timove grupama; snima se odmah bez animacije.</p>
                <label className="block text-sm">
                  <span className="label">Broj grupa (2–8)</span>
                  <input
                    type="number"
                    min={2}
                    max={8}
                    value={groupCount}
                    onChange={(e) => setGroupCount(Math.max(2, Math.min(8, Number(e.target.value) || 2)))}
                    className="input w-24"
                  />
                </label>
                <div className="space-y-1">
                  {teams.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-sm">
                      <TeamCrest name={t.name} shortName={t.short_name} primaryColor={t.primary_color} secondaryColor={t.secondary_color} size={24} />
                      <span className="truncate flex-1 min-w-0">{t.name}</span>
                      <select
                        className="input !py-1 !w-auto"
                        value={assignment[t.id] ?? ""}
                        onChange={(e) => setTeamGroup(t.id, e.target.value === "" ? null : Number(e.target.value))}
                      >
                        <option value="">—</option>
                        {Array.from({ length: groupCount }, (_, i) => (
                          <option key={i} value={i}>Grupa {ALPHABET[i]}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="text-xs">
                  {unassignedCount > 0
                    ? <span className="text-amber-700">{unassignedCount} timova nije raspoređeno</span>
                    : <span className="text-emerald-700">Svi raspoređeni ✓</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={buildManualResult} disabled={!manualValid} className="btn-primary">Generiši i pregledaj</button>
                  <button onClick={autoFillManual} className="btn-secondary">Popuni automatski</button>
                  <button onClick={clearManual} className="btn-secondary">Očisti</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!hasScheduled && manualPhase === "preview" && manualResult && (
        <div className="space-y-3">
          <div className="card">
            <h2 className="font-medium mb-2">Pregled grupa</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {manualResult.groups.map((g) => (
                <div key={g.name} className="border border-zinc-200 rounded-md p-3">
                  <div className="font-semibold mb-1">{g.name}</div>
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
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={commitManual} className="btn-primary">Potvrdi i sačuvaj</button>
            <button onClick={() => setManualPhase("config")} className="btn-secondary">Nazad</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduledDrawStatus({
  ds, onChangeGc, onCancel, pending,
}: {
  ds: DrawStateLite;
  onChangeGc: (gc: number) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const scheduledMs = ds.scheduled_at ? new Date(ds.scheduled_at).getTime() : null;
  const timeToStart = scheduledMs ? scheduledMs - now : 0;
  const isPending = timeToStart > 0;
  const alreadyDrawn = !!ds.result;
  const [gcInput, setGcInput] = useState<number>(ds.group_count ?? 2);

  return (
    <div className="card border-emerald-300 bg-emerald-50 space-y-3">
      <div>
        <h2 className="font-semibold text-emerald-900">Aktivan žreb</h2>
        <p className="text-sm text-emerald-800">
          Zakazano za <b>{ds.scheduled_at ? formatKickoff(ds.scheduled_at) : "—"}</b>.
        </p>
        {isPending && <p className="text-xs text-emerald-700">Tajmer ističe za {Math.ceil(timeToStart / 1000)}s.</p>}
        {!isPending && !alreadyDrawn && <p className="text-xs text-amber-700">Tajmer je istekao. Čeka se da klijent pokrene povlačenje.</p>}
        {alreadyDrawn && <p className="text-xs text-emerald-700">Žreb je povučen, animacija je u toku ili završena.</p>}
      </div>

      {isPending && !alreadyDrawn && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-sm">
            <span className="label">Broj grupa (može da se menja dok tajmer ne istekne)</span>
            <input
              type="number"
              min={2}
              max={8}
              value={gcInput}
              onChange={(e) => setGcInput(Math.max(2, Math.min(8, Number(e.target.value) || 2)))}
              className="input w-24"
            />
          </label>
          <button onClick={() => onChangeGc(gcInput)} disabled={pending || gcInput === ds.group_count} className="btn-secondary !py-1.5">Promeni</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Link href="/draw" className="btn-primary">Otvori /draw →</Link>
        <button onClick={onCancel} disabled={pending} className="btn-danger">Otkaži žreb</button>
      </div>
    </div>
  );
}
