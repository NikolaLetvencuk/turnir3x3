"use client";

import { useState } from "react";
import { TeamCrest } from "@/components/TeamCrest";

export type SendTarget = {
  team_id: string;
  team_name: string;
  team_short: string | null;
  team_primary: string | null;
  team_secondary: string | null;
  captain_name: string | null;
  captain_phone: string | null;
};

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+381" + s.slice(1);
  if (!s.startsWith("+")) s = "+" + s;
  return s;
}

function buildMessage(title: string, body: string): string {
  return `📢 *${title}*\n\n${body}\n\n— Turnir Kula`;
}

export function SendNewsClient({
  title,
  body,
  targets,
}: {
  title: string;
  body: string;
  targets: SendTarget[];
}) {
  const message = buildMessage(title, body);
  const encoded = encodeURIComponent(message);
  const [sent, setSent] = useState<Set<string>>(new Set());

  function markSent(teamId: string) {
    setSent((prev) => {
      const next = new Set(prev);
      next.add(teamId);
      return next;
    });
  }

  const remaining = targets.length - sent.size;

  return (
    <div className="space-y-4">
      <div className="card bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <h1 className="font-semibold text-lg">📱 Slanje vesti kapitenima</h1>
        <p className="text-sm text-blue-50/90 mt-1">
          Klikni na <b>WhatsApp</b> ili <b>Viber</b> pored kapitena — otvoriće se aplikacija sa
          pripremljenom porukom. Samo treba da klikneš <b>Pošalji</b> u aplikaciji.
        </p>
        <div className="text-xs text-blue-50/80 mt-2">
          Ostalo: <b className="text-white">{remaining}</b> od {targets.length}
        </div>
      </div>

      {/* Message preview */}
      <div className="card">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Tekst poruke</div>
        <pre className="whitespace-pre-wrap font-sans text-sm bg-zinc-50 border border-zinc-200 rounded-md p-3">
          {message}
        </pre>
        <button
          onClick={() => navigator.clipboard.writeText(message)}
          className="text-xs text-blue-700 hover:underline mt-2"
        >
          Kopiraj tekst u clipboard
        </button>
      </div>

      {/* Targets */}
      <div className="space-y-2">
        {targets.length === 0 ? (
          <div className="card text-center text-sm text-zinc-500">
            Nijedan kapiten u izabranoj selekciji nema upisan telefon. Vrati se i dodaj telefone
            kapitenima u sekciji <b>Timovi</b>.
          </div>
        ) : (
          targets.map((t) => {
            const phone = normalizePhone(t.captain_phone ?? "");
            if (!phone) return null;
            const waUrl = `https://wa.me/${phone.replace("+", "")}?text=${encoded}`;
            const viberUrl = `viber://chat?number=${encodeURIComponent(phone)}&text=${encoded}`;
            const isSent = sent.has(t.team_id);
            return (
              <div
                key={t.team_id}
                className={`card transition ${isSent ? "border-emerald-300 bg-emerald-50/40" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <TeamCrest
                    name={t.team_name}
                    shortName={t.team_short}
                    primaryColor={t.team_primary}
                    secondaryColor={t.team_secondary}
                    size={40}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.team_name}</div>
                    <div className="text-xs text-zinc-500 truncate">
                      {t.captain_name ?? "Kapiten"} · <span className="font-mono">{phone}</span>
                    </div>
                  </div>
                  {isSent && (
                    <span className="text-xs text-emerald-700 font-semibold">✓ poslato</span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markSent(t.team_id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 text-sm font-medium"
                  >
                    💬 WhatsApp
                  </a>
                  <a
                    href={viberUrl}
                    onClick={() => markSent(t.team_id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 text-sm font-medium"
                  >
                    📞 Viber
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      {sent.size === targets.length && targets.length > 0 && (
        <div className="card bg-emerald-50 border-emerald-300 text-emerald-900 text-center">
          ✓ Sve poruke su poslate. Možeš da se vratiš na <b>Vesti</b>.
        </div>
      )}
    </div>
  );
}
