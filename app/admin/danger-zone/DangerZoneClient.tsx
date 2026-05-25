"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Sparkles, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { adminResetProgress, adminResetFull, adminSeedDemo } from "./actions";
import { useToast } from "@/components/ui/Toast";

type ResetVariant = "progress" | "full";

export function DangerZoneClient() {
  const router = useRouter();
  const { push } = useToast();
  const [resetOpen, setResetOpen] = useState<ResetVariant | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const confirmWord = resetOpen === "progress" ? "RESETUJ" : "IZBRISI SVE";
  const confirmReady = text.trim() === confirmWord;

  function closeResetModal() {
    setResetOpen(null);
    setText("");
  }

  async function onConfirmReset() {
    if (!resetOpen || !confirmReady) return;
    setBusy(true);
    const res = resetOpen === "progress" ? await adminResetProgress() : await adminResetFull();
    setBusy(false);
    if (!res.ok) { push(res.error, "error"); return; }
    push(resetOpen === "progress" ? "Turnir resetovan" : "Sve obrisano", "success");
    closeResetModal();
    router.push("/admin");
    router.refresh();
  }

  async function onSeedDemo(force: boolean) {
    setBusy(true);
    const res = await adminSeedDemo(force);
    setBusy(false);
    if (!res.ok) { push(res.error, "error"); return; }
    push("Demo podaci učitani", "success");
    setDemoOpen(false);
    router.push("/admin/teams");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={AlertTriangle}
        title="Opasna zona"
        hint="Resetovanje turnira ili učitavanje demo podataka. Pažljivo — promene se ne mogu vratiti."
        tone="red"
      />

      <div className="card border-amber-200 bg-amber-50">
        <h2 className="font-semibold text-amber-800 flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Resetuj turnir (zadrži timove i igrače)
        </h2>
        <p className="text-sm text-amber-700 mt-1">
          Briše mečeve, događaje, žreb, grupnu fazu i fantasy podatke. <b>Timovi, igrači i njihove
          slike ostaju.</b> Korisno za ponovno testiranje.
        </p>
        <button onClick={() => setResetOpen("progress")} className="btn bg-amber-600 text-white hover:bg-amber-700 mt-3">Resetuj turnir</button>
      </div>

      <div className="card border-red-200 bg-red-50">
        <h2 className="font-semibold text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Potpuni reset
        </h2>
        <p className="text-sm text-red-700 mt-1">
          Briše <b>SVE</b> — timove, igrače, slike, sve. Koristiti samo ako je baza u
          nekonzistentnom stanju.
        </p>
        <button onClick={() => setResetOpen("full")} className="btn-danger mt-3">Potpuni reset</button>
      </div>

      <div className="card border-sky-200 bg-sky-50">
        <h2 className="font-semibold text-sky-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Učitaj demo podatke
        </h2>
        <p className="text-sm text-sky-700 mt-1">
          Učitava 4 demo tima sa igračima (Njukasl, Juventus, La Familia, Jasike). Ako podaci već
          postoje, slike igrača se restauriraju po imenu.
        </p>
        <button onClick={() => setDemoOpen(true)} className="btn bg-sky-600 text-white hover:bg-sky-700 mt-3">Učitaj demo</button>
      </div>

      {resetOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && closeResetModal()}>
          <div className="bg-white rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">
              {resetOpen === "progress" ? "Potvrdi reset turnira" : "Potvrdi potpuni reset"}
            </h3>
            <p className="text-sm text-zinc-600 mb-3">
              {resetOpen === "progress"
                ? <>Briše mečeve i fantasy, ali zadržava timove i igrače. Otkucaj <b className="font-mono">RESETUJ</b>:</>
                : <>Briše <b>SVE</b>. Otkucaj <b className="font-mono">IZBRISI SVE</b>:</>}
            </p>
            <input
              autoFocus
              className="input mb-3 font-mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={confirmWord}
              disabled={busy}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={closeResetModal} disabled={busy} className="btn-secondary">Otkaži</button>
              <button onClick={onConfirmReset} disabled={!confirmReady || busy} className={resetOpen === "progress" ? "btn bg-amber-600 text-white hover:bg-amber-700" : "btn-danger"}>
                {busy ? "Brišem…" : resetOpen === "progress" ? "Resetuj turnir" : "Obriši sve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {demoOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && setDemoOpen(false)}>
          <div className="bg-white rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Učitaj demo podatke</h3>
            <p className="text-sm text-zinc-600 mb-3">
              Izaberi opciju:
            </p>
            <div className="space-y-2">
              <button onClick={() => onSeedDemo(false)} disabled={busy} className="btn-secondary w-full">Učitaj na praznu bazu</button>
              <button onClick={() => onSeedDemo(true)} disabled={busy} className="btn bg-sky-600 text-white hover:bg-sky-700 w-full">Resetuj pa učitaj (slike se zadržavaju po imenu)</button>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => setDemoOpen(false)} disabled={busy} className="btn-secondary">Zatvori</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
