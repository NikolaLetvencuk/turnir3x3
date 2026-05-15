"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { adminResetAll } from "./actions";
import { useToast } from "@/components/ui/Toast";

export function DangerZoneClient() {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmReady = text.trim() === "RESETUJ";

  async function onConfirm() {
    if (!confirmReady) return;
    setBusy(true);
    const res = await adminResetAll();
    setBusy(false);
    if (!res.ok) { push(res.error, "error"); return; }
    push("Sve resetovano", "success");
    setOpen(false);
    setText("");
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-600" /> Opasna zona
      </h1>
      <div className="card border-red-200 bg-red-50">
        <h2 className="font-semibold text-red-800">Resetuj sve podatke turnira</h2>
        <p className="text-sm text-red-700 mt-1">
          Briše sve timove, igrače, mečeve, događaje, fantasy timove, lige, bodove, snapshote i
          sve korisnike osim admin naloga. Admin nalog ostaje aktivan. <b>Nije moguće poništiti.</b>
        </p>
        <button onClick={() => setOpen(true)} className="btn-danger mt-3">Resetuj sve</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="bg-white rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Potvrdi reset</h3>
            <p className="text-sm text-zinc-600 mb-3">
              Da bi nastavio, otkucaj <b className="font-mono">RESETUJ</b>:
            </p>
            <input
              autoFocus
              className="input mb-3 font-mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="RESETUJ"
              disabled={busy}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setText(""); setOpen(false); }} disabled={busy} className="btn-secondary">Otkaži</button>
              <button onClick={onConfirm} disabled={!confirmReady || busy} className="btn-danger">{busy ? "Brišem…" : "Resetuj sve"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
