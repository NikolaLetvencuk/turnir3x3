"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Lock, Search, X } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useToast } from "@/components/ui/Toast";
import { savePicksForDay, setTeamName } from "./actions";

export type PlayerForPicker = {
  id: string;
  name: string;
  team_id: string | null;
  photo_url: string | null;
  team: {
    id: string;
    name: string;
    short_name: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    logo_url: string | null;
  } | null;
};

function shiftDayUTC(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const SR_MONTHS = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];
function formatSrDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d}. ${SR_MONTHS[m - 1] ?? m}. ${y}.`;
}

export function DailyTeamEditor({
  day,
  today,
  teamName,
  players,
  isLocked,
  isKnockoutPlus,
  playingTeamIds,
  initialPicks,
  isCurrentDayPick,
  fallbackDay,
  tournamentDays,
  matchCount,
}: {
  day: string;
  today: string;
  teamName: string | null;
  players: PlayerForPicker[];
  isLocked: boolean;
  isKnockoutPlus: boolean;
  playingTeamIds: string[];
  initialPicks: { player1_id: string; player2_id: string; player3_id: string } | null;
  isCurrentDayPick: boolean;
  fallbackDay: string | null;
  tournamentDays: string[];
  matchCount: number;
}) {
  const router = useRouter();
  const { push } = useToast();

  const [p1, setP1] = useState(initialPicks?.player1_id ?? "");
  const [p2, setP2] = useState(initialPicks?.player2_id ?? "");
  const [p3, setP3] = useState(initialPicks?.player3_id ?? "");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  const playingSet = useMemo(() => new Set(playingTeamIds), [playingTeamIds]);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const allTeams = useMemo(() => {
    const map = new Map<string, PlayerForPicker["team"]>();
    for (const p of players) if (p.team) map.set(p.team.id, p.team);
    return Array.from(map.values()).filter((t): t is NonNullable<PlayerForPicker["team"]> => !!t)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  const picks = [p1, p2, p3];
  const pickedPlayers = picks.map((id) => playerById.get(id)).filter(Boolean) as PlayerForPicker[];
  const allPicked = !!p1 && !!p2 && !!p3;

  const teamIds = pickedPlayers
    .map((p) => p.team_id)
    .filter((id): id is string => !!id);
  const distinctTeams = new Set(teamIds).size;
  const teamRuleOk = !allPicked
    ? true
    : isKnockoutPlus
    ? distinctTeams >= 2
    : distinctTeams >= 3;
  const teamRuleHint = isKnockoutPlus
    ? "Eliminacioni dan — najviše 2 igrača iz istog tima."
    : "Grupna faza — sva 3 igrača moraju biti iz različitih timova.";

  const notPlayingToday = matchCount > 0
    ? pickedPlayers.filter((p) => p.team_id && !playingSet.has(p.team_id))
    : [];

  const canSave = allPicked && teamRuleOk && !isLocked && !busy;

  function pickPlayer(playerId: string) {
    if (isLocked) return;
    // Already picked — remove
    if (p1 === playerId) return setP1("");
    if (p2 === playerId) return setP2("");
    if (p3 === playerId) return setP3("");
    // Fill the first empty slot
    if (!p1) return setP1(playerId);
    if (!p2) return setP2(playerId);
    if (!p3) return setP3(playerId);
    push("Tim je pun — ukloni nekog igrača prvo.", "error");
  }

  function removeSlot(idx: number) {
    if (idx === 0) setP1("");
    else if (idx === 1) setP2("");
    else setP3("");
  }

  async function onSave() {
    if (!canSave) return;
    setBusy(true);
    const res = await savePicksForDay({ day, player1_id: p1, player2_id: p2, player3_id: p3 });
    setBusy(false);
    if (!res.ok) {
      push(res.error, "error");
      return;
    }
    push(`Tim sačuvan za ${formatSrDate(day)}`, "success");
    router.refresh();
  }

  async function onSetName(e: React.FormEvent) {
    e.preventDefault();
    if (nameInput.trim().length < 2) return;
    setSavingName(true);
    const fd = new FormData();
    fd.set("name", nameInput.trim());
    const res = await setTeamName(fd);
    setSavingName(false);
    if (!res.ok) {
      push(res.error, "error");
      return;
    }
    push("Ime tima sačuvano", "success");
    router.refresh();
  }

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (teamFilter && p.team_id !== teamFilter) return false;
      if (q) {
        const hit = p.name.toLowerCase().includes(q) || (p.team?.name ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [players, search, teamFilter]);

  // Day navigation
  const prevDay = shiftDayUTC(day, -1);
  const nextDay = shiftDayUTC(day, 1);

  if (!teamName) {
    return (
      <div className="space-y-4">
        <div className="card">
          <h1 className="text-xl font-semibold mb-2">Fantasy</h1>
          <p className="text-sm text-zinc-400 mb-3">
            Pre nego što sastaviš tim, izaberi naziv tvog fantasy tima. Ne može da se menja kasnije.
          </p>
          <form onSubmit={onSetName} className="flex gap-2">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Naziv tima"
              maxLength={60}
              minLength={2}
              required
              autoFocus
              className="input flex-1"
            />
            <button disabled={savingName || nameInput.trim().length < 2} className="btn-primary">
              {savingName ? "..." : "Sačuvaj ime"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">Fantasy tim</div>
            <h1 className="text-2xl font-bold leading-tight">{teamName}</h1>
          </div>
          <div className="text-right text-xs text-zinc-400">
            {isKnockoutPlus ? (
              <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Eliminacioni dan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-blue-300 font-medium">
                Grupna faza
              </span>
            )}
          </div>
        </div>

        {/* Day navigator */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/fantasy/team?day=${prevDay}`}
            className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prethodni dan
          </a>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-800 text-sm">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <span className="font-semibold">{formatSrDate(day)}</span>
            {day === today && <span className="text-[10px] uppercase tracking-wider text-emerald-300">danas</span>}
          </div>
          <a
            href={`/fantasy/team?day=${nextDay}`}
            className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
          >
            Sledeći dan <ChevronRight className="w-3.5 h-3.5" />
          </a>
          {tournamentDays.length > 0 && (
            <select
              value={tournamentDays.includes(day) ? day : ""}
              onChange={(e) => {
                if (e.target.value) router.push(`/fantasy/team?day=${e.target.value}`);
              }}
              className="input !py-1.5 !w-auto text-xs"
            >
              <option value="">— skoči na dan —</option>
              {tournamentDays.map((d) => (
                <option key={d} value={d}>
                  {formatSrDate(d)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="text-xs text-zinc-400">{teamRuleHint}</div>
      </div>

      {/* Banners */}
      {isLocked && (
        <div className="card border-amber-500/40 bg-amber-500/[0.06] flex items-start gap-2 text-sm">
          <Lock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Tim za {formatSrDate(day)} je zaključan.</div>
            <div className="text-xs text-zinc-400">Prvi meč ovog dana je već počeo — izmene više nisu moguće.</div>
          </div>
        </div>
      )}
      {!isCurrentDayPick && fallbackDay && !isLocked && (
        <div className="card border-blue-500/40 bg-blue-500/[0.06] flex items-start gap-2 text-sm">
          <Calendar className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Učitan tim od {formatSrDate(fallbackDay)}.</div>
            <div className="text-xs text-zinc-400">
              Promeni i sačuvaj da prilagodiš za {formatSrDate(day)}. Ako ne sačuvaš, ostaje ovaj tim.
            </div>
          </div>
        </div>
      )}
      {matchCount === 0 && (
        <div className="card text-sm text-zinc-400">
          Nema mečeva zakazanih za {formatSrDate(day)}. Možeš da sačuvaš tim ali ne dobijaš poene dok ne bude utakmica.
        </div>
      )}
      {allPicked && !teamRuleOk && (
        <div className="card border-red-500/40 bg-red-500/[0.06] flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{teamRuleHint}</div>
            <div className="text-xs text-zinc-400">Trenutno različitih timova: {distinctTeams}.</div>
          </div>
        </div>
      )}
      {notPlayingToday.length > 0 && (
        <div className="card border-amber-500/40 bg-amber-500/[0.06] flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">
              {notPlayingToday.length === 1 ? "Igrač ne igra " : "Sledeći igrači ne igraju "}
              {formatSrDate(day)}:
            </div>
            <div className="text-xs text-zinc-400">
              {notPlayingToday.map((p) => p.name).join(", ")} — neće osvojiti bodove za ovaj dan.
            </div>
          </div>
        </div>
      )}

      {/* Selected slots */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((idx) => {
          const id = picks[idx];
          const player = id ? playerById.get(id) : null;
          const isPlaying = player?.team_id ? playingSet.has(player.team_id) : false;
          return (
            <div
              key={idx}
              className={`card flex flex-col items-center gap-2 !p-3 text-center ${
                player ? "border-zinc-700" : "border-dashed border-zinc-700"
              }`}
            >
              {player ? (
                <>
                  <PlayerAvatar
                    name={player.name}
                    photoUrl={player.photo_url}
                    teamPrimary={player.team?.primary_color}
                    size={56}
                  />
                  <div className="font-semibold text-sm leading-tight truncate w-full">
                    {player.name.split(" ").slice(-1)[0] ?? player.name}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate w-full">{player.team?.name ?? ""}</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {matchCount > 0 && (
                      <span
                        className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                          isPlaying
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {isPlaying ? "Igra" : "Ne igra"}
                      </span>
                    )}
                    {!isLocked && (
                      <button
                        onClick={() => removeSlot(idx)}
                        className="text-zinc-500 hover:text-red-400 ml-1"
                        title="Ukloni"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-zinc-500 py-6">+ Slot {idx + 1}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save */}
      <div className="card !p-3">
        <button onClick={onSave} disabled={!canSave} className="btn-primary w-full !py-3 text-base">
          {busy
            ? "..."
            : isLocked
            ? "Dan zaključan"
            : !allPicked
            ? "Izaberi 3 igrača"
            : !teamRuleOk
            ? "Pravilo tima nije ispunjeno"
            : `Sačuvaj tim za ${formatSrDate(day)}`}
        </button>
      </div>

      {/* Picker */}
      <div className="card !p-3 space-y-2">
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži igrače…"
              className="input !pl-9"
            />
          </div>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="input sm:w-auto"
          >
            <option value="">Svi timovi ({players.length})</option>
            {allTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {matchCount > 0 && (playingSet.has(t.id) ? " · igra" : " · ne igra")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {filteredPlayers.map((p) => {
            const picked = picks.includes(p.id);
            const isPlaying = p.team_id ? playingSet.has(p.team_id) : false;
            return (
              <button
                key={p.id}
                onClick={() => pickPlayer(p.id)}
                disabled={isLocked}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm border ${
                  picked
                    ? "bg-emerald-500/10 border-emerald-500/40"
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <PlayerAvatar
                  name={p.name}
                  photoUrl={p.photo_url}
                  teamPrimary={p.team?.primary_color}
                  size={28}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                    {p.team && (
                      <TeamCrest
                        name={p.team.name}
                        shortName={p.team.short_name}
                        primaryColor={p.team.primary_color}
                        secondaryColor={p.team.secondary_color}
                        logoUrl={p.team.logo_url}
                        size={12}
                      />
                    )}
                    <span className="truncate">{p.team?.name ?? "Bez tima"}</span>
                  </div>
                </div>
                {matchCount > 0 && (
                  <span
                    className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                      isPlaying
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {isPlaying ? "Igra" : "Ne igra"}
                  </span>
                )}
                {picked && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                )}
              </button>
            );
          })}
          {filteredPlayers.length === 0 && (
            <div className="text-center text-xs text-zinc-500 italic py-4">Nema igrača za filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}
