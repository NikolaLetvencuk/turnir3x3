"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, LockOpen, X, Search, Plus, Check } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { TeamCrest } from "@/components/TeamCrest";
import { useActionRunner } from "@/components/admin/FormButton";
import { useToast } from "@/components/ui/Toast";
import { saveDraft, setTeamName } from "./actions";
import { BASE_PRICE, type FantasyOverview, type PlayerForPicker } from "@/lib/fantasy-shared";
import { Jersey } from "@/components/fantasy/PitchTeam";

type Draft = {
  name: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
} | null;

type Locked = {
  round_id: string;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
} | null;

function JerseySlot({ player, onRemove }: { player: PlayerForPicker | null; onRemove?: () => void }) {
  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center text-white/70 text-[10px] text-center py-2">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-white/40 inline-flex items-center justify-center text-2xl text-white/60">
          +
        </div>
        <div className="mt-2 italic px-1">Klikni igrača ispod</div>
      </div>
    );
  }
  const lastName = player.name.split(/\s+/).slice(-1)[0] || player.name;
  return (
    <div className="relative flex flex-col items-center text-center">
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 sm:top-0 sm:right-0 w-6 h-6 inline-flex items-center justify-center rounded-full bg-white text-zinc-700 hover:text-red-600 shadow-md border border-zinc-200 z-10"
          aria-label="Ukloni"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <Jersey
        primary={player.team_primary || "#1f2937"}
        secondary={player.team_secondary}
        shortName={player.team_short}
        size={72}
      />
      <div className="mt-1.5 bg-white/95 text-zinc-900 rounded-md px-1.5 sm:px-2 py-0.5 text-[11px] sm:text-xs font-bold max-w-[90px] sm:max-w-[110px] truncate">
        {lastName}
      </div>
      <div className="mt-1 rounded-md bg-blue-600 text-white px-2 py-0.5 text-xs font-black tabular-nums shadow-sm">
        {player.price.toFixed(1)}M
      </div>
    </div>
  );
}

export function TeamEditor({
  overview,
  draft,
  lockedForUpcoming,
  players,
  budget,
  bank,
}: {
  overview: FantasyOverview;
  draft: Draft;
  lockedForUpcoming: Locked;
  players: PlayerForPicker[];
  budget: number;
  bank: number;
}) {
  const run = useActionRunner();
  const { push } = useToast();

  const [slot1, setSlot1] = useState<string>(draft?.player1_id ?? "");
  const [slot2, setSlot2] = useState<string>(draft?.player2_id ?? "");
  const [slot3, setSlot3] = useState<string>(draft?.player3_id ?? "");
  const [pendingName, setPendingName] = useState("");
  const [namePending, setNamePending] = useState(false);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<"price_desc" | "price_asc" | "last_desc" | "total_desc">("price_desc");
  const [detailPlayer, setDetailPlayer] = useState<PlayerForPicker | null>(null);
  const [pending, setPending] = useState(false);

  const teamName = (draft?.name ?? "").trim();
  const hasTeamName = teamName.length > 0;

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const selected = [slot1, slot2, slot3];
  const selectedIds = selected.filter(Boolean);
  const slotPlayers = selected.map((id) => (id ? playerMap.get(id) ?? null : null));
  // All money values at 1-decimal precision (matches stored player prices); strict
  // > comparison so budget never under-runs current team cost.
  const totalCost = Math.round(
    selectedIds.reduce((acc, id) => acc + (playerMap.get(id)?.price ?? BASE_PRICE), 0) * 10,
  ) / 10;
  const remaining = Math.round((budget - totalCost) * 10) / 10;
  const isComplete = selectedIds.length === 3;
  const overBudget = totalCost > budget;
  const canLock = isComplete && !overBudget && !!overview.next_round;

  const teamOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of players) {
      if (p.team_id && p.team_name) map.set(p.team_id, p.team_name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = players.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.team_name?.toLowerCase().includes(q) ?? false)) return false;
      if (teamFilter && p.team_id !== teamFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "price_asc": return a.price - b.price || a.name.localeCompare(b.name);
        case "price_desc": return b.price - a.price || a.name.localeCompare(b.name);
        case "last_desc": return (b.last_round_points ?? 0) - (a.last_round_points ?? 0) || b.price - a.price;
        case "total_desc": return b.total_points - a.total_points || b.price - a.price;
      }
    });
    return list;
  }, [players, search, teamFilter, sortKey]);

  function pickPlayer(p: PlayerForPicker) {
    if (selectedIds.includes(p.id)) {
      // Already selected — remove
      if (slot1 === p.id) setSlot1("");
      else if (slot2 === p.id) setSlot2("");
      else if (slot3 === p.id) setSlot3("");
      return;
    }
    // Fill first empty slot
    if (!slot1) setSlot1(p.id);
    else if (!slot2) setSlot2(p.id);
    else if (!slot3) setSlot3(p.id);
    else push("Tim je popunjen, ukloni nekog igrača", "info");
  }

  async function persistDraft(silent: boolean = false) {
    if (!hasTeamName) {
      if (!silent) push("Prvo postavi ime tima", "error");
      return false;
    }
    if (!isComplete) {
      if (!silent) push("Izaberi 3 igrača pre čuvanja drafta", "error");
      return false;
    }
    if (overBudget) {
      if (!silent) push("Prekoračen budžet", "error");
      return false;
    }
    setPending(true);
    const fd = new FormData();
    fd.set("player1_id", slot1);
    fd.set("player2_id", slot2);
    fd.set("player3_id", slot3);
    const ok = await run(saveDraft as any, fd, { successMessage: silent ? undefined : "Draft sačuvan" });
    setPending(false);
    return ok;
  }

  async function saveTeamName() {
    if (pendingName.trim().length < 2) { push("Ime mora imati bar 2 znaka", "error"); return; }
    setNamePending(true);
    const fd = new FormData();
    fd.set("name", pendingName.trim());
    const ok = await run(setTeamName as any, fd, { successMessage: "Ime tima postavljeno" });
    setNamePending(false);
    if (ok) setPendingName("");
  }

  const lockedIds = lockedForUpcoming
    ? [lockedForUpcoming.player1_id, lockedForUpcoming.player2_id, lockedForUpcoming.player3_id].filter(Boolean) as string[]
    : [];
  const matchesLocked =
    lockedForUpcoming &&
    isComplete &&
    selectedIds.length === lockedIds.length &&
    selectedIds.every((id) => lockedIds.includes(id));

  if (!hasTeamName) {
    return (
      <div className="space-y-4">
        <div className="card bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <h1 className="text-xl font-bold">Dobrodošao u fantasy</h1>
          <p className="text-sm text-blue-50/90 mt-1">Pre nego što napraviš tim, izaberi ime. Ime se postavlja jednom i ne može da se menja.</p>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); saveTeamName(); }}
          className="card space-y-3"
        >
          <label className="block">
            <span className="label">Ime tvog fantasy tima</span>
            <input
              type="text"
              className="input"
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              minLength={2}
              maxLength={60}
              autoFocus
              required
              placeholder="npr. Moj nepobedivi tim"
            />
            <p className="text-xs text-zinc-500 mt-1">2–60 znakova. Ovo ime se ne može menjati.</p>
          </label>
          <button type="submit" disabled={namePending || pendingName.trim().length < 2} className="btn-primary w-full">
            {namePending ? "Čuvam…" : "Postavi ime i nastavi"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero — totals + lock status */}
      <div className="card bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-blue-50/80">Ukupno bodova</div>
            <div className="text-3xl font-bold tabular-nums">{overview.total_points}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-blue-50/80">{overview.last_round_name ?? "Prošlo kolo"}</div>
            <div className="text-2xl font-bold tabular-nums">
              {overview.last_round_points === null ? <span className="text-blue-50/60 text-sm">još nije bilo</span> : overview.last_round_points}
            </div>
          </div>
        </div>
        {overview.overall_rank !== null && (
          <div className="text-xs text-blue-50/80 mt-2">Pozicija ukupno: <b className="text-white">{overview.overall_rank}.</b> od {overview.overall_total}</div>
        )}
      </div>

      {/* Lock status — saved draft auto-locks for the upcoming round and carries
          forward until the user edits again. */}
      {overview.next_round ? (
        <div className={`card flex items-center gap-3 ${matchesLocked ? "border-blue-200 bg-blue-50" : "border-zinc-200"}`}>
          {matchesLocked ? <Lock className="w-5 h-5 text-blue-600 shrink-0" /> : <LockOpen className="w-5 h-5 text-zinc-500 shrink-0" />}
          <div className="flex-1 text-sm">
            <div className="font-medium">{overview.next_round.name}</div>
            <div className="text-xs text-zinc-600">
              {matchesLocked
                ? "Tim spreman ✓ Važiće za sva naredna kola dok ga ne promeniš."
                : "Sačuvaj 3 igrača u okviru budžeta — tim će automatski važiti za naredna kola dok ga ne promeniš."}
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-sm text-zinc-600">Nema predstojećeg kola.</div>
      )}

      {/* Pitch view */}
      <div
        className="relative rounded-2xl overflow-hidden border border-emerald-700/60 shadow-inner"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, #1f7a3a 0%, #14532d 60%, #0d3f22 100%)",
          minHeight: 220,
        }}
      >
        {/* Subtle field lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-white/35" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/30" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-10 sm:w-40 sm:h-14 border-2 border-white/35 border-t-0 rounded-b-md" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-10 sm:w-40 sm:h-14 border-2 border-white/35 border-b-0 rounded-t-md" />
        </div>
        <div className="relative px-2 sm:px-3 py-4 sm:py-6 grid grid-cols-3 gap-1.5 sm:gap-3 items-start">
          {slotPlayers.map((p, idx) => (
            <JerseySlot
              key={idx}
              player={p}
              onRemove={p ? () => {
                if (idx === 0) setSlot1(""); if (idx === 1) setSlot2(""); if (idx === 2) setSlot3("");
              } : undefined}
            />
          ))}
        </div>
      </div>

      {/* Budget + save */}
      <div className="card !p-3 sm:!p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="min-w-0">
            <div className="text-xs text-zinc-600">Ime tima</div>
            <div className="font-semibold truncate text-base">{teamName}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-600">Budžet</div>
            <div className={`font-bold tabular-nums text-lg ${overBudget ? "text-red-600" : remaining < 1 ? "text-amber-600" : "text-zinc-900"}`}>
              {totalCost.toFixed(1)} <span className="text-zinc-400 text-sm">/ {budget.toFixed(1)}M</span>
            </div>
            <div className="text-xs text-zinc-500">
              preostalo <span className="tabular-nums font-medium">{remaining.toFixed(1)}M</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <button
            onClick={() => persistDraft(false)}
            disabled={pending || !isComplete || overBudget}
            className="btn-primary w-full"
          >
            {matchesLocked ? "Tim sačuvan ✓ — sačuvaj ponovo da primeniš izmene" : "Sačuvaj tim"}
          </button>
        </div>
      </div>

      {/* Picker */}
      <div className="card !p-3 sm:!p-4">
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="text"
              className="input"
              placeholder="Pretraži igrače…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="input !py-1.5 text-xs sm:!w-auto">
              <option value="">Svi timovi</option>
              {teamOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} className="input !py-1.5 text-xs sm:!w-auto">
              <option value="price_desc">Cena ↓</option>
              <option value="price_asc">Cena ↑</option>
              <option value="last_desc">Prošlo kolo ↓</option>
              <option value="total_desc">Ukupno bodova ↓</option>
            </select>
            {(search || teamFilter) && (
              <button
                onClick={() => { setSearch(""); setTeamFilter(""); }}
                className="text-xs text-zinc-500 hover:text-zinc-700 inline-flex items-center gap-1 px-2"
              >
                <X className="w-3 h-3" /> Reset filter
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {filteredPlayers.map((p) => {
            const isSel = selectedIds.includes(p.id);
            const wouldExceed = !isSel && Math.round((totalCost + p.price) * 10) / 10 > budget && selectedIds.length < 3;
            return (
              <div
                key={p.id}
                className={`relative rounded-lg border transition ${isSel ? "border-blue-400 bg-blue-50/40" : "border-zinc-200 bg-white"}`}
              >
                <div className="flex items-center gap-2 sm:gap-3 p-2">
                  <button onClick={() => setDetailPlayer(p)} className="shrink-0">
                    <Jersey
                      primary={p.team_primary || "#1f2937"}
                      secondary={p.team_secondary}
                      shortName={p.team_short}
                      size={44}
                    />
                  </button>
                  <button onClick={() => setDetailPlayer(p)} className="flex-1 min-w-0 text-left">
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    <div className="text-[11px] text-zinc-500 truncate">{p.team_name ?? "—"}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 flex flex-wrap gap-x-1.5">
                      <span><b className="text-zinc-700 tabular-nums">{p.total_points}</b> uk.</span>
                      <span className="text-zinc-300">·</span>
                      <span><b className="text-zinc-700 tabular-nums">{p.last_round_points ?? 0}</b> prošlo</span>
                    </div>
                  </button>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="bg-zinc-900 text-white rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                      {p.price.toFixed(1)}M
                    </div>
                    <button
                      onClick={() => pickPlayer(p)}
                      disabled={!isSel && wouldExceed}
                      className={
                        isSel
                          ? "inline-flex items-center gap-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-md px-2 py-1 text-[11px] font-medium"
                          : wouldExceed
                          ? "inline-flex items-center gap-1 bg-zinc-100 text-zinc-400 rounded-md px-2 py-1 text-[11px] font-medium cursor-not-allowed"
                          : "inline-flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 rounded-md px-2 py-1 text-[11px] font-medium"
                      }
                    >
                      {isSel ? <><Check className="w-3 h-3" /><span className="hidden sm:inline">Izabran</span><span className="sm:hidden">✓</span></> : wouldExceed ? "Skupo" : <><Plus className="w-3 h-3" /><span className="hidden sm:inline">Dodaj</span></>}
                    </button>
                  </div>
                </div>
                {p.next_fixtures && p.next_fixtures.length > 0 && (
                  <div className="px-2 pb-1.5 flex items-center gap-1 flex-wrap text-[10px]">
                    <span className="text-zinc-400 uppercase tracking-wider hidden sm:inline">sledeće:</span>
                    {p.next_fixtures.slice(0, 2).map((f) => (
                      <span
                        key={f.match_id}
                        className="inline-flex items-center gap-1 bg-zinc-100 rounded-md px-1 py-0.5"
                        title={f.kickoff_at ?? ""}
                      >
                        <span className="text-zinc-400">{f.is_home ? "vs" : "@"}</span>
                        <TeamCrest
                          name={f.opponent_name}
                          shortName={f.opponent_short_name}
                          primaryColor={f.opponent_primary}
                          secondaryColor={f.opponent_secondary}
                          size={12}
                        />
                        <span className="font-medium text-zinc-700 truncate max-w-[70px]">
                          {f.opponent_short_name || f.opponent_name}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filteredPlayers.length === 0 && <p className="py-4 text-center text-sm text-zinc-500">Nema igrača.</p>}
        </div>
      </div>

      {/* Player detail modal */}
      {detailPlayer && (
        <PlayerDetailModal player={detailPlayer} onClose={() => setDetailPlayer(null)} />
      )}
    </div>
  );
}

function PlayerDetailModal({ player, onClose }: { player: PlayerForPicker; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <PlayerAvatar name={player.name} photoUrl={player.photo_url} teamPrimary={player.team_primary} size={56} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{player.name}</div>
            <div className="text-xs text-zinc-500 truncate">{player.team_name ?? "—"}</div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none" aria-label="Zatvori">×</button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center mb-3">
          <div className="card !p-2"><div className="text-[10px] text-zinc-500">Cena</div><div className="font-bold tabular-nums">{player.price.toFixed(1)}</div></div>
          <div className="card !p-2"><div className="text-[10px] text-zinc-500">Ukupno pt</div><div className="font-bold tabular-nums">{player.total_points}</div></div>
        </div>
        {player.last_round_points !== null && (
          <div className="card !p-2 mb-3 text-sm">
            <div className="text-xs text-zinc-500">Bodovi u prošlom kolu</div>
            <div className="text-xl font-bold tabular-nums">{player.last_round_points}</div>
          </div>
        )}
        <Link href={`/players/${player.id}`} className="btn-secondary w-full text-center text-sm">
          Cela statistika i istorija →
        </Link>
      </div>
    </div>
  );
}
