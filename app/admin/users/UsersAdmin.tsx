"use client";

import { useMemo, useState } from "react";
import { Crown, Search, Trophy } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";

type Row = {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  team_name: string | null;
  players: string[];
  total_points: number;
  rounds_played: number;
  has_team: boolean;
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    timeZone: "Europe/Belgrade",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

type Tab = "league" | "all";

export function UsersAdmin({ rows }: { rows: Row[] }) {
  const [tab, setTab] = useState<Tab>("league");
  const [query, setQuery] = useState("");

  const leagueRows = useMemo(
    () =>
      rows
        .filter((r) => r.has_team)
        .sort((a, b) => b.total_points - a.total_points || a.email.localeCompare(b.email)),
    [rows],
  );

  const filteredAll = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        (r.team_name ?? "").toLowerCase().includes(q) ||
        r.players.some((p) => p.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const totalUsers = rows.length;
  const fantasyUsers = leagueRows.length;
  const totalPoints = leagueRows.reduce((acc, r) => acc + r.total_points, 0);
  const avgPoints = fantasyUsers > 0 ? Math.round(totalPoints / fantasyUsers) : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Crown}
        title="Korisnici"
        hint="Svi registrovani + overall fantasy liga. Lista se osvežava automatski kad se obračunaju kola."
        tone="amber"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Ukupno" value={totalUsers} />
        <Stat label="Fantasy igrača" value={fantasyUsers} />
        <Stat label="Bodova ukupno" value={totalPoints} />
        <Stat label="Prosek po igraču" value={avgPoints} />
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="flex border-b border-zinc-800">
          {(["league", "all"] as Tab[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-2.5 text-sm font-medium transition ${
                tab === k ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50"
              }`}
            >
              {k === "league" ? "🏆 Overall liga" : "📋 Svi korisnici"}
            </button>
          ))}
        </div>

        {tab === "league" ? (
          <LeagueTable rows={leagueRows} />
        ) : (
          <AllUsersTable
            rows={filteredAll}
            query={query}
            onQueryChange={setQuery}
          />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card !p-3 text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function LeagueTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-zinc-500 italic">
        Niko još nema sastavljen fantasy tim.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] text-zinc-500 uppercase tracking-wider">
          <tr>
            <th className="text-left py-2 px-3 font-medium">#</th>
            <th className="text-left py-2 px-2 font-medium">Igrač</th>
            <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Sastav</th>
            <th className="text-right py-2 px-2 font-medium">Kola</th>
            <th className="text-right py-2 px-3 font-medium">Bodovi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((r, i) => {
            const rank = i + 1;
            const rankBg =
              rank === 1
                ? "bg-amber-400/20 text-amber-300"
                : rank === 2
                ? "bg-zinc-400/20 text-zinc-200"
                : rank === 3
                ? "bg-orange-700/30 text-orange-300"
                : "text-zinc-400";
            return (
              <tr key={r.user_id} className={rank <= 3 ? "bg-amber-500/[0.03]" : ""}>
                <td className="py-2 px-3">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold tabular-nums ${rankBg}`}>
                    {rank}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <div className="font-medium truncate max-w-[200px]">{r.team_name ?? r.email.split("@")[0]}</div>
                  <div className="text-[10px] text-zinc-500 truncate max-w-[200px]">{r.email}</div>
                </td>
                <td className="py-2 px-2 hidden sm:table-cell">
                  {r.players.length === 0 ? (
                    <span className="text-zinc-500 italic text-xs">—</span>
                  ) : (
                    <div className="text-xs text-zinc-400 truncate max-w-[300px]">{r.players.join(" · ")}</div>
                  )}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-zinc-400">{r.rounds_played}</td>
                <td className="py-2 px-3 text-right tabular-nums font-bold text-amber-300">{r.total_points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AllUsersTable({
  rows,
  query,
  onQueryChange,
}: {
  rows: Row[];
  query: string;
  onQueryChange: (q: string) => void;
}) {
  return (
    <div>
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Pretraži po email-u, timu, igraču…"
            className="input !pl-9"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] text-zinc-500 uppercase tracking-wider">
            <tr>
              <th className="text-left py-2 px-3 font-medium">Email</th>
              <th className="text-left py-2 px-2 font-medium">Tim</th>
              <th className="text-left py-2 px-2 font-medium hidden md:table-cell">Sastav</th>
              <th className="text-right py-2 px-2 font-medium">Bodovi</th>
              <th className="text-right py-2 px-3 font-medium hidden sm:table-cell">Registrovan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((r) => (
              <tr key={r.user_id}>
                <td className="py-2 px-3">
                  <div className="truncate max-w-[200px]">{r.email}</div>
                  {r.role === "admin" && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 mt-0.5">
                      <Crown className="w-3 h-3" /> admin
                    </span>
                  )}
                </td>
                <td className="py-2 px-2">
                  {r.has_team ? (
                    <div className="text-xs">
                      <Trophy className="w-3 h-3 inline mr-1 text-emerald-400" />
                      {r.team_name ?? "(bez imena)"}
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-600 italic">nema fantazi</span>
                  )}
                </td>
                <td className="py-2 px-2 hidden md:table-cell">
                  {r.players.length === 0 ? (
                    <span className="text-zinc-600 italic text-xs">—</span>
                  ) : (
                    <div className="text-xs text-zinc-400 truncate max-w-[260px]">{r.players.join(" · ")}</div>
                  )}
                </td>
                <td className="py-2 px-2 text-right tabular-nums font-medium">{r.total_points}</td>
                <td className="py-2 px-3 text-right tabular-nums text-xs text-zinc-500 hidden sm:table-cell">
                  {formatDate(r.created_at)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-zinc-500 italic">
                  Nema rezultata.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
