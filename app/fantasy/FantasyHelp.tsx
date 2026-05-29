"use client";

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

const SEEN_KEY = "fantasy_help_seen_v1";

export function FantasyHelp() {
  const [open, setOpen] = useState(false);

  // Auto-open the first time a user lands on the fantasy page.
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        setOpen(true);
        localStorage.setItem(SEEN_KEY, "1");
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-200"
      >
        <HelpCircle className="w-4 h-4" /> Kako se igra & pravila
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-2 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-zinc-900 rounded-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-lg">Fantasy — kako se igra</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-300 text-2xl leading-none" aria-label="Zatvori">
                ×
              </button>
            </div>

            <ol className="text-sm space-y-1.5 text-zinc-300 list-decimal list-inside mb-4">
              <li>Postavi <b>ime tima</b> (jednom, ne menja se).</li>
              <li>Svaki dan izabereš <b>3 igrača</b> — bez budžeta, bez cena, bez ograničenih transfera.</li>
              <li>
                U <b>grupnoj fazi</b>: sva 3 igrača iz različitih timova. Od <b>četvrtfinala</b>{" "}
                nadalje: najviše 2 iz istog tima.
              </li>
              <li>Tim se zaključava kad prvi meč tog dana počne — tada nameštaš tim za sledeći dan.</li>
              <li>Ako ne nameštaš tim za neki dan, koristi se tvoj poslednji sastavljen tim.</li>
            </ol>

            <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1">
              Pravila bodovanja
            </div>
            <ul className="text-sm grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-300">
              <li>⚽ Gol — <b>+3</b></li>
              <li>🅰️ Asistencija — <b>+2</b></li>
              <li>✅ Pobeda tima — <b>+1</b></li>
              <li>🧤 Čista mreža — <b>+1</b></li>
              <li>🟨 Žuti karton — <b>−1</b></li>
              <li>🟥 Crveni karton — <b>−2</b></li>
              <li>🥅 Autogol — <b>−1</b></li>
            </ul>

            <button onClick={() => setOpen(false)} className="btn-primary w-full mt-4">
              Razumem
            </button>
          </div>
        </div>
      )}
    </>
  );
}
