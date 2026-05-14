"use client";

import { useState } from "react";

type RoundLite = { id: string; name: string };
type Cell = { round_id: string; points: number | null };
type Row = { user_id: string; email: string; cells: Cell[]; total: number };
type Breakdown = Record<string, {
  snap: { player1_id: string | null; player2_id: string | null; player3_id: string | null; transfers_used: number; transfer_penalty: number } | null;
  rp: { player1_points: number; player2_points: number; player3_points: number; transfer_penalty: number; total_points: number } | null;
  names: { p1: string | null; p2: string | null; p3: string | null } | null;
  playerPoints: { p1: any; p2: any; p3: any } | null;
}>;

export function LeagueGrid({ rounds, rows, breakdown }: { rounds: RoundLite[]; rows: Row[]; breakdown: Breakdown }) {
  const [open, setOpen] = useState<{ user_id: string; round: RoundLite; email: string } | null>(null);

  const detail = open ? breakdown[`${open.user_id}_${open.round.id}`] : null;

  return (
    <>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500">
              <th className="text-left py-2 sticky left-0 bg-white">Igrač</th>
              {rounds.map((r) => <th key={r.id} className="text-right px-2 whitespace-nowrap">{r.name}</th>)}
              <th className="text-right px-2">∑</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.user_id} className="border-t border-zinc-100">
                <td className="py-2 font-medium sticky left-0 bg-white">{i + 1}. {row.email.split("@")[0]}</td>
                {row.cells.map((c) => {
                  const r = rounds.find((x) => x.id === c.round_id)!;
                  return (
                    <td key={c.round_id} className="text-right px-2 tabular-nums">
                      {c.points == null ? "—" : (
                        <button onClick={() => setOpen({ user_id: row.user_id, round: r, email: row.email })} className="hover:underline">
                          {c.points}
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="text-right px-2 font-bold tabular-nums">{row.total}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={rounds.length + 2} className="py-4 text-center text-zinc-500">Nema članova.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2" onClick={() => setOpen(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{open.email.split("@")[0]} — {open.round.name}</h3>
              <button onClick={() => setOpen(null)} className="text-zinc-500">✕</button>
            </div>
            {detail.snap ? (
              <div className="space-y-2 text-sm">
                {([
                  ["p1", detail.snap.player1_id, detail.rp?.player1_points ?? 0],
                  ["p2", detail.snap.player2_id, detail.rp?.player2_points ?? 0],
                  ["p3", detail.snap.player3_id, detail.rp?.player3_points ?? 0],
                ] as const).map(([k, pid, pts]) => {
                  const name = detail.names?.[k] ?? "—";
                  const pp = detail.playerPoints?.[k];
                  return (
                    <div key={k} className="flex items-center justify-between gap-2">
                      <span>{name}</span>
                      <span className="text-xs text-zinc-500 flex-1 text-right">{pp ? `${pp.goals}G ${pp.assists}A ${pp.yellow_cards}🟨 ${pp.red_cards}🟥` : "—"}</span>
                      <span className="font-bold w-8 text-right">{pts}</span>
                    </div>
                  );
                })}
                {detail.snap.transfer_penalty > 0 && (
                  <div className="flex items-center justify-between text-amber-700">
                    <span>Penal transferi ({detail.snap.transfers_used})</span>
                    <span>−{detail.snap.transfer_penalty}</span>
                  </div>
                )}
                <div className="flex items-center justify-between font-bold text-base border-t pt-2">
                  <span>Ukupno</span>
                  <span>{detail.rp?.total_points ?? 0}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Nema snapshot-a za ovo kolo.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
