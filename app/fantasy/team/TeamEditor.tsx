"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, LockOpen, X, Search } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useActionRunner } from "@/components/admin/FormButton";
import { useToast } from "@/components/ui/Toast";
import { saveDraft, lockTeamForUpcomingRound, setTeamName } from "./actions";
import { FANTASY_BUDGET, BASE_PRICE, type FantasyOverview, type PlayerForPicker } from "@/lib/fantasy-shared";

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
          className="absolute top-1 right-1 w-6 h-6 inline-flex items-center justify-center rounded-full bg-white/90 border border-zinc-200 text-zinc-500 hover:text-red-600 hover:border-red-300"
          aria-label="Ukloni"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <div className="absolute top-1 left-1 text-[10px] bg-emerald-600 text-white rounded px-1.5 py-0.5 font-bold tabular-nums">
        {player.price.toFixed(1)}
      </div>
      <div className="flex-1 flex items-center">
        <PlayerAvatar name={player.name} photoUrl={player.photo_url} teamPrimary={player.team_primary} size={64} />
      </div>
      <div className="w-full">
        <div className="text-xs font-semibold leading-tight line-clamp-2">{player.name}</div>
        <div className="text-[10px] text-zinc-500 truncate mt-0.5">{player.team_name ?? "—"}</div>
        {player.last_round_points !== null && (
          <div className="text-[10px] text-zinc-400 mt-0.5">
            <span className="tabular-nums font-medium">{player.last_round_points}</span> pt
          </div>
        )}
      </div>
    </div>
  );
}

export function TeamEditor({
  overview,
  draft,
  lockedForUpcoming,
  players,
}: {
  overview: FantasyOverview;
  draft: Draft;
  lockedForUpcoming: Locked;
  players: PlayerForPicker[];
}) {
  const run = useActionRunner();
  const { push } = useToast();

  const [slot1, setSlot1] = useState<string>(draft?.player1_id ?? "");
  const [slot2, setSlot2] = useState<string>(draft?.player2_id ?? "");
  const [slot3, setSlot3] = useState<string>(draft?.player3_id ?? "");
  const [pendingName, setPendingName] = useState("");
  const [namePending, setNamePending] = useState(false);
  const [search, setSearch] = useState("");
  const [detailPlayer, setDetailPlayer] = useState<PlayerForPicker | null>(null);
  const [pending, setPending] = useState(false);

  const teamName = (draft?.name ?? "").trim();
  const hasTeamName = teamName.length > 0;

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const selected = [slot1, slot2, slot3];
  const selectedIds = selected.filter(Boolean);
  const slotPlayers = selected.map((id) => (id ? playerMap.get(id) ?? null : null));
  const totalCost = selectedIds.reduce((acc, id) => acc + (playerMap.get(id)?.price ?? BASE_PRICE), 0);
  const remaining = FANTASY_BUDGET - totalCost;
  const isComplete = selectedIds.length === 3;
  const overBudget = totalCost > FANTASY_BUDGET + 0.001;
  const canLock = isComplete && !overBudget && !!overview.next_round;

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.team_name?.toLowerCase().includes(q) ?? false));
  }, [players, search]);

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
              {totalCost.toFixed(1)} <span className="text-zinc-400 text-sm">/ {FANTASY_BUDGET.toFixed(1)}</span>
            </div>
            <div className="text-xs text-zinc-500">preostalo {remaining.toFixed(1)}</div>
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
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-zinc-500" />
          <input
            type="text"
            className="input"
            placeholder="Pretraži igrače…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ul className="divide-y divide-zinc-100">
          {filteredPlayers.map((p) => {
            const isSel = selectedIds.includes(p.id);
            const wouldExceed = !isSel && totalCost + p.price > FANTASY_BUDGET + 0.001 && selectedIds.length < 3;
            return (
              <li key={p.id} className="py-2 flex items-center gap-2">
                <button onClick={() => setDetailPlayer(p)} className="shrink-0">
                  <PlayerAvatar name={p.name} photoUrl={p.photo_url} teamPrimary={p.team_primary} size={36} />
                </button>
                <button onClick={() => setDetailPlayer(p)} className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-zinc-500 truncate">{p.team_name ?? "—"}</div>
                </button>
                <div className="text-right text-xs text-zinc-500 hidden xs:block sm:block">
                  <div className="tabular-nums">{p.last_round_points ?? "—"} pt</div>
                  <div className="text-[10px]">{p.ownership_pct}% timova</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="tabular-nums font-semibold">{p.price.toFixed(1)}</div>
                  <button
                    onClick={() => pickPlayer(p)}
                    disabled={!isSel && wouldExceed}
                    className={`text-xs mt-0.5 ${isSel ? "text-red-600 hover:underline" : "text-emerald-700 hover:underline disabled:text-zinc-400 disabled:no-underline"}`}
                  >
                    {isSel ? "Ukloni" : wouldExceed ? "Skupo" : "Dodaj"}
                  </button>
                </div>
              </li>
            );
          })}
          {filteredPlayers.length === 0 && <li className="py-4 text-center text-sm text-zinc-500">Nema igrača.</li>}
        </ul>
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
