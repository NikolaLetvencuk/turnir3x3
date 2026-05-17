"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TeamCrest } from "@/components/TeamCrest";
import { DrawAnimation } from "@/components/admin/DrawAnimation";
import { useToast } from "@/components/ui/Toast";
import { composeDraw, computeDraw, type DrawResult, type DrawTeam } from "@/lib/draw";
import { commitDraw } from "../actions";

type Phase = "config" | "animating" | "preview" | "saving";
type Mode = "auto" | "manual";

const ALPHABET = "ABCDEFGH";

export function DrawClient({ teams, hasExisting }: { teams: DrawTeam[]; hasExisting: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [mode, setMode] = useState<Mode>("auto");
  const [groupCount, setGroupCount] = useState(Math.max(2, Math.min(8, Math.floor(teams.length / 3) || 2)));
  const [phase, setPhase] = useState<Phase>("config");
  const [result, setResult] = useState<DrawResult | null>(null);
  // Manual mode: assignment of team_id -> group_index (0..groupCount-1), or null if unassigned
  const [assignment, setAssignment] = useState<Record<string, number | null>>({});

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

  function tryCompute(): DrawResult | null {
    try {
      return computeDraw(teams, groupCount);
    } catch (e: any) {
      push(e?.message ?? "Greška u žrebu", "error");
      return null;
    }
  }

  function tryComposeManual(): DrawResult | null {
    if (!manualValid) {
      push(unassignedCount > 0 ? `${unassignedCount} timova nije raspoređeno` : "Svaka grupa mora imati bar 2 tima", "error");
      return null;
    }
    try {
      return composeDraw(manualBuckets);
    } catch (e: any) {
      push(e?.message ?? "Greška u žrebu", "error");
      return null;
    }
  }

  function startDraw() {
    if (hasExisting) {
      if (!confirm("Postojeća kola, grupe i mečevi će biti obrisani. Nastaviti?")) return;
    }
    if (mode === "auto") {
      const r = tryCompute();
      if (!r) return;
      setResult(r);
      setPhase("animating");
    } else {
      const r = tryComposeManual();
      if (!r) return;
      setResult(r);
      setPhase("preview"); // No animation for manual — admin already sees the groups
    }
  }

  function reroll() {
    const r = mode === "auto" ? tryCompute() : tryComposeManual();
    if (!r) return;
    setResult(r);
    setPhase(mode === "auto" ? "animating" : "preview");
  }

  async function commit() {
    if (!result) return;
    setPhase("saving");
    const payload = {
      groups: result.groups.map((g) => ({ name: g.name, team_ids: g.teams.map((t) => t.id) })),
      rounds: result.rounds.map((r) => ({
        name: r.name,
        matches: r.matches.map((m) => ({ group_index: m.group_index, home_team_id: m.home.id, away_team_id: m.away.id })),
      })),
    };
    const res = await commitDraw(payload);
    if (!res.ok) { push(res.error, "error"); setPhase("preview"); return; }
    push("Žreb sačuvan", "success");
    router.push("/admin/schedule");
    router.refresh();
  }

  function setTeamGroup(team_id: string, gi: number | null) {
    setAssignment((s) => ({ ...s, [team_id]: gi }));
  }

  function autoFillManual() {
    // Quick helper: distribute unassigned teams across groups
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

  function clearManual() {
    setAssignment({});
  }

  if (phase === "animating" && result) {
    return (
      <DrawAnimation
        result={result}
        onSkip={() => setPhase("preview")}
        onDone={() => setPhase("preview")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Žreb grupa</h1>

      {phase === "config" && (
        <>
          <div className="card !p-0 overflow-hidden">
            <div className="flex border-b border-zinc-200">
              {(["auto", "manual"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setMode(k)}
                  className={`flex-1 py-2 px-3 text-sm font-medium transition ${mode === k ? "bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600" : "text-zinc-600 hover:bg-zinc-50"}`}
                >
                  {k === "auto" ? "Automatski žreb" : "Ručno raspoređivanje"}
                </button>
              ))}
            </div>
            <div className="p-3 space-y-3">
              <div>
                <label className="label">Broj grupa (2–8)</label>
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={groupCount}
                  onChange={(e) => {
                    const nv = Math.max(2, Math.min(8, Number(e.target.value) || 2));
                    setGroupCount(nv);
                    // Drop assignments that now point to non-existent groups
                    setAssignment((s) => {
                      const next: Record<string, number | null> = {};
                      for (const [k, v] of Object.entries(s)) next[k] = v != null && v < nv ? v : null;
                      return next;
                    });
                  }}
                  className="input w-24"
                />
              </div>
              {mode === "auto" ? (
                <p className="text-sm text-zinc-600">
                  Prijavljeno timova: <b>{teams.length}</b>. Sistem će nasumično rasporediti timove
                  ({Math.floor(teams.length / groupCount)}–{Math.ceil(teams.length / groupCount)} po grupi).
                </p>
              ) : (
                <p className="text-sm text-zinc-600">
                  Sam dodeljuješ timove grupama. Sistem onda generiše kola i mečeve.
                </p>
              )}
              {hasExisting && (
                <p className="text-sm text-amber-700">
                  Postojeća kola i mečevi će biti obrisani pre novog žreba (timovi i igrači ostaju).
                </p>
              )}
              {mode === "auto" ? (
                <button onClick={startDraw} disabled={teams.length < groupCount * 2} className="btn-primary">
                  Pokreni žreb
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button onClick={startDraw} disabled={!manualValid} className="btn-primary">Generiši kola</button>
                  <button onClick={autoFillManual} className="btn-secondary">Popuni automatski</button>
                  <button onClick={clearManual} className="btn-secondary">Očisti</button>
                </div>
              )}
            </div>
          </div>

          {mode === "auto" && (
            <div className="card">
              <h2 className="font-medium mb-2">Timovi u žrebu</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {teams.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm min-w-0">
                    <TeamCrest name={t.name} shortName={t.short_name} primaryColor={t.primary_color} secondaryColor={t.secondary_color} size={28} />
                    <span className="truncate">{t.name}</span>
                  </div>
                ))}
                {teams.length === 0 && <p className="text-sm text-zinc-500 col-span-full">Dodaj prvo timove u sekciji „Timovi“.</p>}
              </div>
            </div>
          )}

          {mode === "manual" && (
            <>
              <div className="card">
                <h2 className="font-medium mb-2">Dodeli timove grupama</h2>
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
                  {teams.length === 0 && <p className="text-sm text-zinc-500">Nema timova.</p>}
                </div>
                <div className="mt-3 text-xs text-zinc-500">
                  {unassignedCount > 0 ? (
                    <span className="text-amber-700">{unassignedCount} {unassignedCount === 1 ? "tim nije raspoređen" : "timova nije raspoređeno"}</span>
                  ) : (
                    <span className="text-emerald-700">Svi timovi raspoređeni ✓</span>
                  )}
                </div>
              </div>

              <div className="card">
                <h2 className="font-medium mb-2">Pregled grupa</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {manualBuckets.map((b, i) => (
                    <div key={i} className={`border rounded-md p-2 ${b.length >= 2 ? "border-zinc-200" : "border-amber-300 bg-amber-50"}`}>
                      <div className="font-semibold text-sm mb-1">Grupa {ALPHABET[i]} <span className="text-zinc-400 font-normal">({b.length})</span></div>
                      <ul className="space-y-1 text-sm">
                        {b.map((t) => (
                          <li key={t.id} className="flex items-center gap-1.5">
                            <TeamCrest name={t.name} shortName={t.short_name} primaryColor={t.primary_color} secondaryColor={t.secondary_color} size={18} />
                            <span className="truncate">{t.name}</span>
                          </li>
                        ))}
                        {b.length === 0 && <li className="text-zinc-400 italic">prazno</li>}
                        {b.length === 1 && <li className="text-amber-700 text-xs">⚠ potrebno još bar 1</li>}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {(phase === "preview" || phase === "saving") && result && (
        <>
          <div className="card">
            <h2 className="font-medium mb-2">Rezultat</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {result.groups.map((g) => (
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

          <div className="card">
            <h2 className="font-medium mb-2">Mečevi po kolu</h2>
            <div className="space-y-3">
              {result.rounds.map((r) => (
                <div key={r.name}>
                  <div className="font-medium text-sm text-zinc-600 mb-1">{r.name}</div>
                  <ul className="space-y-1 text-sm">
                    {r.matches.map((m, i) => (
                      <li key={i} className="flex items-center gap-2 min-w-0">
                        <TeamCrest name={m.home.name} shortName={m.home.short_name} primaryColor={m.home.primary_color} secondaryColor={m.home.secondary_color} size={20} />
                        <span className="truncate">{m.home.name}</span>
                        <span className="text-zinc-400 shrink-0">vs</span>
                        <TeamCrest name={m.away.name} shortName={m.away.short_name} primaryColor={m.away.primary_color} secondaryColor={m.away.secondary_color} size={20} />
                        <span className="truncate">{m.away.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={commit} disabled={phase === "saving"} className="btn-primary">{phase === "saving" ? "Čuvam…" : "Potvrdi"}</button>
            {mode === "auto" && (
              <button onClick={reroll} disabled={phase === "saving"} className="btn-secondary">Ponovi žreb</button>
            )}
            <button onClick={() => setPhase("config")} disabled={phase === "saving"} className="btn-secondary">Nazad na konfiguraciju</button>
          </div>
        </>
      )}
    </div>
  );
}
