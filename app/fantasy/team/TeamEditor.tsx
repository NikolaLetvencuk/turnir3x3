"use client";

import { useMemo, useState } from "react";
import { saveTeam } from "./actions";
import { useToast } from "@/components/ui/Toast";

type Player = { id: string; name: string; team_id: string | null; team_name: string | null; price: number };
type RoundLite = { id: string; name: string; status: string; display_order: number } | null;

type Mine = {
  name: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
} | null;

export function TeamEditor(props: {
  userId: string;
  players: Player[];
  mine: Mine;
  activeRound: RoundLite;
  nextRound: RoundLite;
  transfersThisRound: number;
}) {
  const { push } = useToast();
  const [name, setName] = useState(props.mine?.name ?? "");
  const [slot1, setSlot1] = useState<string>(props.mine?.player1_id ?? "");
  const [slot2, setSlot2] = useState<string>(props.mine?.player2_id ?? "");
  const [slot3, setSlot3] = useState<string>(props.mine?.player3_id ?? "");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);

  const selected = [slot1, slot2, slot3].filter(Boolean);
  const blocked = !!props.activeRound;

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return props.players.filter((p) =>
      !q || p.name.toLowerCase().includes(q) || (p.team_name?.toLowerCase().includes(q) ?? false)
    );
  }, [props.players, search]);

  function pickIntoFirstEmpty(id: string) {
    if (selected.includes(id)) {
      if (slot1 === id) setSlot1("");
      else if (slot2 === id) setSlot2("");
      else if (slot3 === id) setSlot3("");
      return;
    }
    if (!slot1) setSlot1(id);
    else if (!slot2) setSlot2(id);
    else if (!slot3) setSlot3(id);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!slot1 || !slot2 || !slot3) { push("Izaberi 3 igrača", "error"); return; }
    setPending(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("player1_id", slot1);
    fd.set("player2_id", slot2);
    fd.set("player3_id", slot3);
    const res = await saveTeam(fd);
    setPending(false);
    if (!res.ok) { push(res.error, "error"); return; }
    push("Tim sačuvan", "success");
  }

  const playerMap = new Map(props.players.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Moj fantasy tim</h1>

      {blocked && (
        <div className="card bg-amber-50 border-amber-200 text-amber-900 text-sm">
          Aktivno je kolo „{props.activeRound!.name}“ — tim ne možeš menjati dok se ne završi.
        </div>
      )}

      {props.nextRound && !blocked && (
        <div className="card text-sm text-zinc-700">
          Sledeće kolo: <b>{props.nextRound.name}</b>. Iskorišćeno transfera ovog kola: <b>{props.transfersThisRound}</b>.
          {props.transfersThisRound >= 1 && <span className="text-amber-700"> Sledeći transfer će koštati −4 boda.</span>}
        </div>
      )}

      <form onSubmit={onSave} className="card space-y-3">
        <div>
          <label className="label">Ime tima (opciono)</label>
          <input className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} disabled={blocked} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[slot1, slot2, slot3].map((id, idx) => {
            const p = id ? playerMap.get(id) : null;
            return (
              <div key={idx} className="border border-zinc-200 rounded-md p-2 text-center text-sm min-h-[80px]">
                <div className="text-xs text-zinc-500">Slot {idx + 1}</div>
                {p ? (
                  <>
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-zinc-500 truncate">{p.team_name}</div>
                    <div className="text-xs">{p.price.toFixed(2)}</div>
                  </>
                ) : <div className="text-zinc-400 mt-2">prazno</div>}
              </div>
            );
          })}
        </div>
        <button disabled={blocked || pending} className="btn-primary w-full">{pending ? "..." : "Sačuvaj tim"}</button>
      </form>

      <div>
        <input
          className="input"
          placeholder="Pretraži igrače..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500">
              <th className="text-left py-2">Igrač</th>
              <th className="text-left">Tim</th>
              <th className="text-right">Cena</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((p) => {
              const isSel = selected.includes(p.id);
              return (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="text-zinc-500">{p.team_name ?? "—"}</td>
                  <td className="text-right tabular-nums">{p.price.toFixed(2)}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => pickIntoFirstEmpty(p.id)}
                      className={isSel ? "btn-danger !py-1 !px-2" : "btn-secondary !py-1 !px-2"}
                    >
                      {isSel ? "Ukloni" : "Dodaj"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
