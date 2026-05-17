"use client";

import { useState } from "react";
import { Eye, Copy } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { MemberHistory } from "./MemberHistory";

export type MemberRow = {
  user_id: string;
  team_name: string;
  total: number;
  last_round: number | null;
};

export function LeagueDetail({
  leagueName,
  inviteCode,
  members,
  currentUserId,
  lastRoundName,
}: {
  leagueName: string;
  inviteCode: string;
  members: MemberRow[];
  currentUserId: string;
  lastRoundName: string | null;
}) {
  const { push } = useToast();
  const [viewing, setViewing] = useState<MemberRow | null>(null);

  function copyCode() {
    if (typeof navigator === "undefined") return;
    navigator.clipboard?.writeText(inviteCode).then(
      () => push("Kod kopiran", "success"),
      () => push("Kopiranje nije uspelo", "error"),
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-semibold">{leagueName}</h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-zinc-600 flex-wrap">
          <span>Kod:</span>
          <button onClick={copyCode} className="font-mono text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1">
            {inviteCode} <Copy className="w-3.5 h-3.5" />
          </button>
          <span className="text-zinc-400">·</span>
          <span>{members.length} {members.length === 1 ? "član" : "članova"}</span>
        </div>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500">
              <th className="text-left py-2 px-3 w-6">#</th>
              <th className="text-left">Tim</th>
              <th className="text-right px-2 whitespace-nowrap">{lastRoundName ?? "Prošlo kolo"}</th>
              <th className="text-right px-3">Ukupno</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const isMe = m.user_id === currentUserId;
              return (
                <tr key={m.user_id} className={`border-t border-zinc-100 ${isMe ? "bg-emerald-50/40" : ""}`}>
                  <td className="py-2 px-3 text-zinc-500">{i + 1}.</td>
                  <td className="py-2">
                    <button onClick={() => setViewing(m)} className="inline-flex items-center gap-1.5 font-medium hover:text-emerald-700 max-w-full">
                      <span className="truncate max-w-[200px]">{m.team_name}</span>
                      {isMe && <span className="text-[10px] text-emerald-700 font-semibold shrink-0">(ti)</span>}
                      <Eye className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    </button>
                  </td>
                  <td className="text-right px-2 tabular-nums">
                    {m.last_round == null ? <span className="text-zinc-300">—</span> : m.last_round}
                  </td>
                  <td className="text-right px-3 font-bold tabular-nums">{m.total}</td>
                </tr>
              );
            })}
            {members.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-zinc-500">Nema članova.</td></tr>}
          </tbody>
        </table>
      </div>

      {viewing && (
        <MemberHistory
          userId={viewing.user_id}
          displayName={viewing.team_name}
          isMe={viewing.user_id === currentUserId}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
