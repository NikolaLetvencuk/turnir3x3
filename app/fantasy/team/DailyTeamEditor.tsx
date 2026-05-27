"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Info, Lock, Search, X } from "lucide-react";
import { Jersey } from "@/components/fantasy/PitchTeam";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { TeamCrest } from "@/components/TeamCrest";
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

export type PlayerStats = {
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
  wins: number;
  draws: number;
  losses: number;
  clean_sheets: number;
};

function shiftDayUTC(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const SR_MONTHS = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];
const SR_MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
function formatSrDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d}. ${SR_MONTHS[m - 1] ?? m}. ${y}.`;
}
function formatSrDateShort(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d}. ${SR_MONTHS_SHORT[m - 1] ?? m}.`;
}

export function DailyTeamEditor({
  day,
  today,
  editableDay,
  teamName,
  players,
  isLockedForToday,
  isKnockoutPlus,
  playingTeamIds,
  initialPicks,
  isCurrentDayPick,
  fallbackDay,
  savedDays,
  matchCount,
  stats,
}: {
  day: string;
  today: string;
  editableDay: string;
  teamName: string | null;
  players: PlayerForPicker[];
  isLockedForToday: boolean;
  isKnockoutPlus: boolean;
  playingTeamIds: string[];
  initialPicks: { player1_id: string; player2_id: string; player3_id: string } | null;
  isCurrentDayPick: boolean;
  fallbackDay: string | null;
  savedDays: string[];
  matchCount: number;
  stats: Record<string, PlayerStats>;
}) {
  const router = useRouter();
  const { push } = useToast();

  const isViewOnly = day !== editableDay;
  const canEdit = !isViewOnly;

  const [p1, setP1] = useState(initialPicks?.player1_id ?? "");
  const [p2, setP2] = useState(initialPicks?.player2_id ?? "");
  const [p3, setP3] = useState(initialPicks?.player3_id ?? "");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [openPlayerId, setOpenPlayerId] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  const playingSet = useMemo(() => new Set(playingTeamIds), [playingTeamIds]);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const allTeams = useMemo(() => {
    const map = new Map<string, PlayerForPicker["team"]>();
    for (const p of players) if (p.team) map.set(p.team.id, p.team);
    return Array.from(map.values())
      .filter((t): t is NonNullable<PlayerForPicker["team"]> => !!t)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  const picks = [p1, p2, p3];
  const pickedPlayers = picks.map((id) => playerById.get(id)).filter(Boolean) as PlayerForPicker[];
  const allPicked = !!p1 && !!p2 && !!p3;

  const teamIds = pickedPlayers.map((p) => p.team_id).filter((id): id is string => !!id);
  const distinctTeams = new Set(teamIds).size;
  const teamRuleOk = !allPicked ? true : isKnockoutPlus ? distinctTeams >= 2 : distinctTeams >= 3;
  const teamRuleHint = isKnockoutPlus
    ? "Eliminacioni dan — najviše 2 igrača iz istog tima."
    : "Grupna faza — sva 3 igrača moraju biti iz različitih timova.";

  const notPlayingToday = matchCount > 0
    ? pickedPlayers.filter((p) => p.team_id && !playingSet.has(p.team_id))
    : [];

  const canSave = canEdit && allPicked && teamRuleOk && !busy;

  function pickPlayer(playerId: string) {
    if (!canEdit) return;
    if (p1 === playerId) return setP1("");
    if (p2 === playerId) return setP2("");
    if (p3 === playerId) return setP3("");
    if (!p1) return setP1(playerId);
    if (!p2) return setP2(playerId);
    if (!p3) return setP3(playerId);
    push("Tim je pun — ukloni nekog igrača prvo.", "error");
  }
  function removeSlot(idx: number) {
    if (!canEdit) return;
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

  // Past day navigation: prev jumps to the most recent saved past day < current
  // (or just day−1). Next is clamped at editableDay.
  const prevDayKey = useMemo(() => {
    const cand = savedDays.find((d) => d < day);
    if (cand) return cand;
    return shiftDayUTC(day, -1);
  }, [savedDays, day]);
  const nextDayKey = useMemo(() => {
    const target = shiftDayUTC(day, 1);
    return target <= editableDay ? target : null;
  }, [day, editableDay]);

  const openPlayer = openPlayerId ? playerById.get(openPlayerId) ?? null : null;

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
          <div className="text-right text-xs">
            {isKnockoutPlus ? (
              <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Eliminacioni dan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-blue-300 font-medium">Grupna faza</span>
            )}
          </div>
        </div>

        {/* Day navigator */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/fantasy/team?day=${prevDayKey}`}
            className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prethodni dan
          </a>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-800 text-sm">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <span className="font-semibold">{formatSrDate(day)}</span>
            {day === today && <span className="text-[10px] uppercase tracking-wider text-emerald-300">danas</span>}
            {day === editableDay && day !== today && (
              <span className="text-[10px] uppercase tracking-wider text-emerald-300">aktivan</span>
            )}
          </div>
          {nextDayKey ? (
            <a
              href={`/fantasy/team?day=${nextDayKey}`}
              className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
            >
              Sledeći dan <ChevronRight className="w-3.5 h-3.5" />
            </a>
          ) : (
            <span className="text-xs text-zinc-500 italic ml-1">Aktivni dan je {formatSrDateShort(editableDay)}</span>
          )}
        </div>

        {canEdit && <div className="text-xs text-zinc-400">{teamRuleHint}</div>}
      </div>

      {/* Banners */}
      {isViewOnly && (
        <div className="card border-zinc-700 bg-zinc-900/60 flex items-start gap-2 text-sm">
          <Lock className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Pregled — tim za {formatSrDate(day)} se ne može menjati.</div>
            <div className="text-xs text-zinc-400">
              Aktivni dan koji se nameštaš je <b className="text-emerald-300">{formatSrDateShort(editableDay)}</b>
              {editableDay === today ? " (danas)" : " (sutra)"}.
            </div>
          </div>
        </div>
      )}
      {canEdit && isLockedForToday && (
        <div className="card border-amber-500/40 bg-amber-500/[0.06] flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Današnji mečevi su počeli — nameštaš tim za sutra.</div>
            <div className="text-xs text-zinc-400">Tvoj poslednji tim važi za današnji dan.</div>
          </div>
        </div>
      )}
      {canEdit && !isCurrentDayPick && fallbackDay && (
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
      {canEdit && matchCount === 0 && (
        <div className="card text-sm text-zinc-400">
          Nema mečeva zakazanih za {formatSrDate(day)}. Možeš da sačuvaš tim — bodovi će biti 0 dok ne bude utakmica.
        </div>
      )}
      {canEdit && allPicked && !teamRuleOk && (
        <div className="card border-red-500/40 bg-red-500/[0.06] flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{teamRuleHint}</div>
            <div className="text-xs text-zinc-400">Trenutno različitih timova: {distinctTeams}.</div>
          </div>
        </div>
      )}
      {canEdit && notPlayingToday.length > 0 && (
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

      {/* Pitch */}
      <div
        className="relative rounded-2xl overflow-hidden border border-emerald-700/60 shadow-inner"
        style={{
          background: "radial-gradient(120% 80% at 50% 0%, #1f7a3a 0%, #14532d 60%, #0d3f22 100%)",
          minHeight: 240,
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-white/35" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/30" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-10 sm:w-40 sm:h-14 border-2 border-white/35 border-t-0 rounded-b-md" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-10 sm:w-40 sm:h-14 border-2 border-white/35 border-b-0 rounded-t-md" />
        </div>
        <div className="relative px-2 sm:px-3 py-5 sm:py-7 grid grid-cols-3 gap-1.5 sm:gap-3 items-start">
          {[0, 1, 2].map((idx) => {
            const id = picks[idx];
            const player = id ? playerById.get(id) : null;
            const isPlaying = player?.team_id ? playingSet.has(player.team_id) : false;
            return (
              <JerseySlot
                key={idx}
                player={player ?? null}
                onRemove={canEdit && player ? () => removeSlot(idx) : null}
                onOpen={player ? () => setOpenPlayerId(player.id) : null}
                isPlaying={isPlaying}
                showPlayBadge={matchCount > 0}
              />
            );
          })}
        </div>
      </div>

      {/* Save (only when editable) */}
      {canEdit && (
        <div className="card !p-3">
          <button onClick={onSave} disabled={!canSave} className="btn-primary w-full !py-3 text-base">
            {busy
              ? "..."
              : !allPicked
              ? "Izaberi 3 igrača"
              : !teamRuleOk
              ? "Pravilo tima nije ispunjeno"
              : `Sačuvaj tim za ${formatSrDate(day)}`}
          </button>
        </div>
      )}

      {/* Picker (only when editable) */}
      {canEdit && (
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
                <div
                  key={p.id}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm border ${
                    picked
                      ? "bg-emerald-500/10 border-emerald-500/40"
                      : "bg-zinc-900 border-zinc-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => pickPlayer(p.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
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
                          isPlaying ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {isPlaying ? "Igra" : "Ne igra"}
                      </span>
                    )}
                    {picked && <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenPlayerId(p.id)}
                    className="shrink-0 text-zinc-400 hover:text-blue-300 p-1.5 rounded-md hover:bg-zinc-800"
                    title="Detalji"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {filteredPlayers.length === 0 && (
              <div className="text-center text-xs text-zinc-500 italic py-4">Nema igrača za filter.</div>
            )}
          </div>
        </div>
      )}

      {/* Saved past days quick links — only on view-only screens */}
      {isViewOnly && savedDays.length > 0 && (
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Prethodno sastavljeni timovi</div>
          <div className="flex flex-wrap gap-1.5">
            {savedDays.slice(0, 12).map((d) => (
              <Link
                key={d}
                href={`/fantasy/team?day=${d}`}
                className="text-xs px-2.5 py-1 rounded-full border border-zinc-800 hover:border-blue-300 bg-zinc-900"
              >
                {formatSrDateShort(d)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Player detail modal */}
      {openPlayer && (
        <PlayerDetailModal
          player={openPlayer}
          stats={stats[openPlayer.id] ?? null}
          isPlayingToday={openPlayer.team_id ? playingSet.has(openPlayer.team_id) : false}
          dayLabel={matchCount > 0 ? formatSrDate(day) : null}
          onClose={() => setOpenPlayerId(null)}
        />
      )}
    </div>
  );
}

function JerseySlot({
  player,
  onRemove,
  onOpen,
  isPlaying,
  showPlayBadge,
}: {
  player: PlayerForPicker | null;
  onRemove: (() => void) | null;
  onOpen: (() => void) | null;
  isPlaying: boolean;
  showPlayBadge: boolean;
}) {
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
    <div className="flex flex-col items-center text-center">
      <div className="relative w-[88px] h-[88px]">
        <button
          type="button"
          onClick={onOpen ?? undefined}
          disabled={!onOpen}
          className="block w-full h-full"
          title="Detalji"
        >
          <Jersey
            primary={player.team?.primary_color || "#1f2937"}
            shortName={player.team?.short_name}
            size={88}
          />
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 w-6 h-6 inline-flex items-center justify-center rounded-full bg-zinc-900 text-zinc-300 hover:text-red-500 hover:bg-zinc-800 shadow-md border border-zinc-700 z-10"
            aria-label="Ukloni"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="mt-1.5 bg-white/95 text-zinc-900 rounded-md px-2 py-0.5 text-xs font-bold max-w-[110px] truncate">
        {lastName}
      </div>
      {showPlayBadge && (
        <div
          className={`mt-1 rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold shadow-sm ${
            isPlaying ? "bg-emerald-500/20 text-emerald-100 border border-emerald-400/50" : "bg-zinc-800 text-zinc-300"
          }`}
        >
          {isPlaying ? "Igra" : "Ne igra"}
        </div>
      )}
    </div>
  );
}

function PlayerDetailModal({
  player,
  stats,
  isPlayingToday,
  dayLabel,
  onClose,
}: {
  player: PlayerForPicker;
  stats: PlayerStats | null;
  isPlayingToday: boolean;
  dayLabel: string | null;
  onClose: () => void;
}) {
  const s = stats ?? {
    goals: 0,
    assists: 0,
    yellow_cards: 0,
    red_cards: 0,
    own_goals: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    clean_sheets: 0,
  };
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <PlayerAvatar
            name={player.name}
            photoUrl={player.photo_url}
            teamPrimary={player.team?.primary_color}
            size={56}
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{player.name}</div>
            <div className="text-xs text-zinc-500 truncate flex items-center gap-1">
              {player.team && (
                <TeamCrest
                  name={player.team.name}
                  shortName={player.team.short_name}
                  primaryColor={player.team.primary_color}
                  secondaryColor={player.team.secondary_color}
                  logoUrl={player.team.logo_url}
                  size={12}
                />
              )}
              <span className="truncate">{player.team?.name ?? "Bez tima"}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-300 text-2xl leading-none" aria-label="Zatvori">
            ×
          </button>
        </div>

        {dayLabel && (
          <div className={`card !p-3 mb-3 ${isPlayingToday ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-zinc-800"}`}>
            <div className="text-xs text-zinc-400">{dayLabel}</div>
            <div className="text-sm font-semibold">
              {isPlayingToday ? "Tim ima meč na ovaj dan." : "Tim nema meč na ovaj dan."}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
          <Stat label="Golovi" value={s.goals} />
          <Stat label="Asist." value={s.assists} />
          <Stat label="Č. mr." value={s.clean_sheets} />
          <Stat label="🟨" value={s.yellow_cards} />
          <Stat label="🟥" value={s.red_cards} />
          <Stat label="Autogol" value={s.own_goals} />
          <Stat label="Pobede" value={s.wins} />
          <Stat label="Nereš." value={s.draws} />
          <Stat label="Porazi" value={s.losses} />
        </div>

        <Link
          href={`/players/${player.id}`}
          className="btn-secondary w-full text-center text-sm mt-1 inline-block"
        >
          Ceo profil i istorija →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card !p-2">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}
