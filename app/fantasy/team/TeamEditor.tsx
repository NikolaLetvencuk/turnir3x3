"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, LockOpen, X, Search, Plus, Check } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { TeamCrest } from "@/components/TeamCrest";
import { useActionRunner } from "@/components/admin/FormButton";
import { useToast } from "@/components/ui/Toast";
import { saveDraft, lockTeamForUpcomingRound, setTeamName } from "./actions";
import { BASE_PRICE, type FantasyOverview, type PlayerForPicker } from "@/lib/fantasy-shared";

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

function PlayerCard({ player, onRemove }: { player: PlayerForPicker | null; onRemove?: () => void }) {
  if (!player) {
    return (
      <div className="relative rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50/50 aspect-[3/4] flex items-center justify-center text-zinc-400 text-xs text-center p-2">
        Klikni igrača da popuniš slot
      </div>
    );
  }
  return (
    <div className="relative rounded-xl bg-gradient-to-b from-white to-zinc-50 border-2 border-emerald-300 shadow-md aspect-[3/4] p-2 flex flex-col items-center justify-between text-center">
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 w-6 h-6 inline-flex items-center justify-center rounded-full bg-white/90 border border-zinc-200 text-zinc-500 hover:text-red-600 hover:border-red-300 z-10"
          aria-label="Ukloni"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <div className="absolute top-1 left-1 text-[10px] bg-emerald-600 text-white rounded px-1.5 py-0.5 font-bold tabular-nums z-10">
        {player.price.toFixed(1)}
      </div>
      <div className="w-full flex-1 flex items-center justify-center min-h-0 mt-3">
        {player.photo_url ? (
          <img
            src={player.photo_url}
            alt={player.name}
            className="w-full aspect-square object-cover rounded-md bg-zinc-100"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full aspect-square rounded-md inline-flex items-center justify-center font-bold select-none text-2xl"
            style={{
              background: player.team_primary ?? "#52525b",
              color: "#ffffff",
            }}
          >
            {player.name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?"}
          </div>
        )}
      </div>
      <div className="w-full mt-1">
        <div className="text-xs font-semibold leading-tight line-clamp-2">{player.name}</div>
        <div className="text-[10px] text-zinc-500 truncate mt-0.5">{player.team_name ?? "—"}</div>
        <div className="text-[10px] text-zinc-400 mt-0.5 flex justify-center gap-2">
          {player.last_round_points !== null && (
            <span><b className="text-zinc-700 tabular-nums">{player.last_round_points}</b> pt</span>
          )}
          <span><b className="text-zinc-700 tabular-nums">{player.total_points}</b> ukupno</span>
        </div>
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
  const [sortKey, setSortKey] = useState<"price_desc" | "price_asc" | "last_desc" | "total_desc" | "own_desc">("price_desc");
  const [detailPlayer, setDetailPlayer] = useState<PlayerForPicker | null>(null);
  const [pending, setPending] = useState(false);

  const teamName = (draft?.name ?? "").trim();
  const hasTeamName = teamName.length > 0;

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const selected = [slot1, slot2, slot3];
  const selectedIds = selected.filter(Boolean);
  const slotPlayers = selected.map((id) => (id ? playerMap.get(id) ?? null : null));
  const totalCost = selectedIds.reduce((acc, id) => acc + (playerMap.get(id)?.price ?? BASE_PRICE), 0);
  const remaining = Math.round((budget - totalCost) * 100) / 100;
  const isComplete = selectedIds.length === 3;
  // 0.05 tolerance matches 1-decimal display so 9.9 in bank covers a 9.9 player.
  const overBudget = totalCost > budget + 0.05;
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
        case "own_desc": return b.ownership_pct - a.ownership_pct || b.price - a.price;
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

  async function onLock() {
    const ok = await persistDraft(true);
    if (!ok) return;
    setPending(true);
    const res = await lockTeamForUpcomingRound();
    setPending(false);
    if (!res.ok) { push(res.error, "error"); return; }
    push(`Tim zaključan za ${res.data?.round_name ?? "naredno kolo"}`, "success");
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
        <div className="card bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
          <h1 className="text-xl font-bold">Dobrodošao u fantasy</h1>
          <p className="text-sm text-emerald-50/90 mt-1">Pre nego što napraviš tim, izaberi ime. Ime se postavlja jednom i ne može da se menja.</p>
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
      <div className="card bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-emerald-50/80">Ukupno bodova</div>
            <div className="text-3xl font-bold tabular-nums">{overview.total_points}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-emerald-50/80">{overview.last_round_name ?? "Prošlo kolo"}</div>
            <div className="text-2xl font-bold tabular-nums">
              {overview.last_round_points === null ? <span className="text-emerald-50/60 text-sm">još nije bilo</span> : overview.last_round_points}
            </div>
          </div>
        </div>
        {overview.overall_rank !== null && (
          <div className="text-xs text-emerald-50/80 mt-2">Pozicija ukupno: <b className="text-white">{overview.overall_rank}.</b> od {overview.overall_total}</div>
        )}
      </div>

      {/* Lock status */}
      {overview.next_round ? (
        <div className={`card flex items-center gap-3 ${matchesLocked ? "border-emerald-200 bg-emerald-50" : lockedForUpcoming ? "border-amber-200 bg-amber-50" : "border-zinc-200"}`}>
          {matchesLocked ? <Lock className="w-5 h-5 text-emerald-600 shrink-0" /> : <LockOpen className="w-5 h-5 text-zinc-500 shrink-0" />}
          <div className="flex-1 text-sm">
            <div className="font-medium">{overview.next_round.name}</div>
            <div className="text-xs text-zinc-600">
              {matchesLocked ? "Tim zaključan ✓" : lockedForUpcoming ? "Postoji lock ali ne odgovara trenutnom draftu — re-lock da bi se sačuvao" : "Tim NIJE zaključan — pri startu kola koristi se prošli tim (ili 0 ako je prvo kolo)"}
            </div>
          </div>
          <button
            onClick={onLock}
            disabled={!canLock || pending}
            className={matchesLocked ? "btn-secondary !py-1.5 !px-3 text-sm" : "btn-primary !py-1.5 !px-3 text-sm"}
          >
            {matchesLocked ? "Re-lock" : "Lock"}
          </button>
        </div>
      ) : (
        <div className="card text-sm text-zinc-600">Nema predstojećeg kola za zaključavanje.</div>
      )}

      {/* Pitch view */}
      <div className="card relative bg-gradient-to-b from-emerald-100 via-emerald-50 to-white border-emerald-200">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-emerald-300/40" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-emerald-300/40" />
        <div className="relative grid grid-cols-3 gap-2 sm:gap-3">
          {slotPlayers.map((p, idx) => (
            <PlayerCard
              key={idx}
              player={p}
              onRemove={p ? () => {
                if (idx === 0) setSlot1(""); if (idx === 1) setSlot2(""); if (idx === 2) setSlot3("");
              } : undefined}
            />
          ))}
        </div>
        <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
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
              {bank > 0 && <span className="text-zinc-400"> · ranija banka {bank.toFixed(1)}M</span>}
            </div>
          </div>
        </div>
        <div className="relative mt-3 flex gap-2">
          <button onClick={() => persistDraft(false)} disabled={pending || !isComplete || overBudget} className="btn-secondary flex-1">Sačuvaj draft</button>
          <button onClick={onLock} disabled={pending || !canLock} className="btn-primary flex-1">
            {matchesLocked ? "Tim već zaključan" : "Lock za naredno kolo"}
          </button>
        </div>
      </div>

      {/* Picker */}
      <div className="card">
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
          <div className="flex flex-wrap gap-2">
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="input !py-1 !w-auto text-xs">
              <option value="">Svi timovi</option>
              {teamOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} className="input !py-1 !w-auto text-xs">
              <option value="price_desc">Cena ↓</option>
              <option value="price_asc">Cena ↑</option>
              <option value="last_desc">Prošlo kolo ↓</option>
              <option value="total_desc">Ukupno bodova ↓</option>
              <option value="own_desc">Vlasništvo % ↓</option>
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
            const wouldExceed = !isSel && totalCost + p.price > budget + 0.05 && selectedIds.length < 3;
            return (
              <div
                key={p.id}
                className={`relative rounded-lg border transition ${isSel ? "border-emerald-400 bg-emerald-50/40" : "border-zinc-200 bg-white"}`}
              >
                <div className="flex items-center gap-3 p-2.5">
                  <button onClick={() => setDetailPlayer(p)} className="shrink-0">
                    <PlayerAvatar name={p.name} photoUrl={p.photo_url} teamPrimary={p.team_primary} size={44} />
                  </button>
                  <button onClick={() => setDetailPlayer(p)} className="flex-1 min-w-0 text-left">
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    <div className="text-xs text-zinc-500 truncate inline-flex items-center gap-1">
                      {p.team_id && (
                        <TeamCrest
                          name={p.team_name ?? ""}
                          shortName={null}
                          primaryColor={p.team_primary}
                          secondaryColor={null}
                          size={14}
                        />
                      )}
                      <span className="truncate">{p.team_name ?? "—"}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0">
                      <span><b className="text-zinc-700 tabular-nums">{p.total_points}</b> ukupno</span>
                      <span className="text-zinc-300">·</span>
                      <span><b className="text-zinc-700 tabular-nums">{p.last_round_points ?? 0}</b> prošlo</span>
                      <span className="text-zinc-300">·</span>
                      <span><b className="text-zinc-700 tabular-nums">{p.ownership_pct}%</b> timova</span>
                    </div>
                  </button>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="bg-zinc-900 text-white rounded-md px-2 py-1 text-xs font-bold tabular-nums">
                      {p.price.toFixed(1)}M
                    </div>
                    <button
                      onClick={() => pickPlayer(p)}
                      disabled={!isSel && wouldExceed}
                      className={
                        isSel
                          ? "inline-flex items-center gap-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-md px-2 py-1 text-xs font-medium"
                          : wouldExceed
                          ? "inline-flex items-center gap-1 bg-zinc-100 text-zinc-400 rounded-md px-2 py-1 text-xs font-medium cursor-not-allowed"
                          : "inline-flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded-md px-2 py-1 text-xs font-medium"
                      }
                    >
                      {isSel ? <><Check className="w-3 h-3" />Izabran</> : wouldExceed ? "Skupo" : <><Plus className="w-3 h-3" />Dodaj</>}
                    </button>
                  </div>
                </div>
                {p.next_fixtures && p.next_fixtures.length > 0 && (
                  <div className="px-2.5 pb-2 flex items-center gap-1.5 flex-wrap text-[10px]">
                    <span className="text-zinc-400 uppercase tracking-wider">sledeće:</span>
                    {p.next_fixtures.slice(0, 3).map((f) => (
                      <span
                        key={f.match_id}
                        className="inline-flex items-center gap-1 bg-zinc-100 rounded-md px-1.5 py-0.5"
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
                        <span className="font-medium text-zinc-700 truncate max-w-[80px]">
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
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="card !p-2"><div className="text-[10px] text-zinc-500">Cena</div><div className="font-bold tabular-nums">{player.price.toFixed(1)}</div></div>
          <div className="card !p-2"><div className="text-[10px] text-zinc-500">Ukupno pt</div><div className="font-bold tabular-nums">{player.total_points}</div></div>
          <div className="card !p-2"><div className="text-[10px] text-zinc-500">Vlasništvo</div><div className="font-bold tabular-nums">{player.ownership_pct}%</div></div>
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
