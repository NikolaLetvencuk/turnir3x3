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
  const [sequentialIdx, setSequentialIdx] = useState<number | null>(null);

  const targetsWithPhone = targets
    .map((t) => ({ ...t, normalizedPhone: normalizePhone(t.captain_phone ?? "") }))
    .filter((t) => t.normalizedPhone) as Array<SendTarget & { normalizedPhone: string }>;

  function markSent(teamId: string) {
    setSent((prev) => {
      const next = new Set(prev);
      next.add(teamId);
      return next;
    });
  }

  const remaining = targetsWithPhone.length - sent.size;

  // SMS bulk: native Messages app handles comma-separated recipients +
  // pre-filled body. Single tap "Send" reaches everyone at once.
  const smsRecipients = targetsWithPhone.map((t) => t.normalizedPhone).join(",");
  // iOS uses `sms:`, Android uses `smsto:` — `sms:` works on both modern OSes.
  const smsUrl = smsRecipients ? `sms:${smsRecipients}?body=${encoded}` : null;
  // Some Android versions prefer `&` delimiter; alternative attempt below.
  const smsUrlAndroid = smsRecipients ? `smsto:${smsRecipients}?body=${encoded}` : null;

  function startSequential() {
    if (targetsWithPhone.length === 0) return;
    // Find first unsent
    const idx = targetsWithPhone.findIndex((t) => !sent.has(t.team_id));
    setSequentialIdx(idx === -1 ? 0 : idx);
  }

  function nextInSequence() {
    if (sequentialIdx === null) return;
    const current = targetsWithPhone[sequentialIdx];
    if (current) markSent(current.team_id);
    // advance
    const nextIdx = sequentialIdx + 1;
    if (nextIdx >= targetsWithPhone.length) {
      setSequentialIdx(null);
    } else {
      setSequentialIdx(nextIdx);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <h1 className="font-semibold text-lg">📱 Slanje vesti kapitenima</h1>
        <p className="text-sm text-blue-50/90 mt-1">
          Najlakše: <b>SMS svim kapitenima odjednom</b> (jedan tap). Alternativa:{" "}
          <b>WhatsApp jedan po jedan</b>.
        </p>
        <div className="text-xs text-blue-50/80 mt-2">
          Ukupno kapitena sa telefonom: <b className="text-white">{targetsWithPhone.length}</b>
          {sent.size > 0 && (
            <> · poslato u WA: <b className="text-white">{sent.size}</b> · ostalo: <b className="text-white">{remaining}</b></>
          )}
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

      {targetsWithPhone.length === 0 ? (
        <div className="card text-center text-sm text-zinc-500">
          Nijedan kapiten u izabranoj selekciji nema upisan telefon. Vrati se i dodaj telefone
          kapitenima u sekciji <b>Timovi</b>.
        </div>
      ) : (
        <>
          {/* Primary action: SMS bulk */}
          {smsUrl && (
            <div className="card border-emerald-300 bg-emerald-50">
              <div className="flex items-start gap-3">
                <div className="text-3xl shrink-0">📨</div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-emerald-900">Pošalji SMS svim kapitenima odjednom</h2>
                  <p className="text-xs text-emerald-900/80 mt-1">
                    Otvara nativnu Messages aplikaciju sa <b>{targetsWithPhone.length} broja</b>{" "}
                    i tekstom već popunjenim. Samo treba da klikneš <b>Send</b> u poruci.
                  </p>
                  <p className="text-[10px] text-emerald-900/60 mt-1">
                    Napomena: SMS naplata zavisi od tvog tarifnog paketa. Većina paketa
                    danas ima neograničene SMS-ove.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={smsUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-sm font-medium"
                >
                  📨 Otvori SMS svima
                </a>
                {smsUrlAndroid && (
                  <a
                    href={smsUrlAndroid}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-4 py-2.5 text-sm font-medium border border-emerald-300"
                  >
                    📨 Android SMS varijanta
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Secondary: WhatsApp sequential */}
          {sequentialIdx === null ? (
            <div className="card">
              <div className="flex items-start gap-3">
                <div className="text-3xl shrink-0">💬</div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold">Ili: pošalji WhatsApp jedan po jedan</h2>
                  <p className="text-xs text-zinc-600 mt-1">
                    Otvori WhatsApp za kapitena 1, pošalji, vrati se i app će sama pokazati
                    sledećeg kapitena. Klikneš ~{targetsWithPhone.length - sent.size}{" "}
                    puta ukupno (po 2-3 sekunde po kapitenu).
                  </p>
                </div>
              </div>
              <button
                onClick={startSequential}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-medium"
              >
                💬 Pokreni redosled WhatsApp slanja →
              </button>
            </div>
          ) : (
            <SequentialSender
              target={targetsWithPhone[sequentialIdx]}
              encoded={encoded}
              currentIdx={sequentialIdx}
              total={targetsWithPhone.length}
              onSent={nextInSequence}
              onCancel={() => setSequentialIdx(null)}
              alreadySent={sent.has(targetsWithPhone[sequentialIdx]?.team_id ?? "")}
            />
          )}

          {/* Targets list (for status overview + individual click) */}
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
              Lista kapitena
            </div>
            {targetsWithPhone.map((t) => {
              const isSent = sent.has(t.team_id);
              const waUrl = `https://wa.me/${t.normalizedPhone.replace("+", "")}?text=${encoded}`;
              const viberUrl = `viber://chat?number=${encodeURIComponent(t.normalizedPhone)}&text=${encoded}`;
              return (
                <div
                  key={t.team_id}
                  className={`card !p-3 transition ${isSent ? "border-emerald-300 bg-emerald-50/40" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <TeamCrest
                      name={t.team_name}
                      shortName={t.team_short}
                      primaryColor={t.team_primary}
                      secondaryColor={t.team_secondary}
                      size={36}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{t.team_name}</div>
                      <div className="text-xs text-zinc-500 truncate">
                        {t.captain_name ?? "Kapiten"} · <span className="font-mono">{t.normalizedPhone}</span>
                      </div>
                    </div>
                    {isSent ? (
                      <span className="text-xs text-emerald-700 font-semibold">✓ poslato (WA)</span>
                    ) : (
                      <div className="flex gap-1">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => markSent(t.team_id)}
                          className="text-xs rounded-md bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 font-medium"
                          title="WhatsApp"
                        >
                          💬 WA
                        </a>
                        <a
                          href={viberUrl}
                          onClick={() => markSent(t.team_id)}
                          className="text-xs rounded-md bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 font-medium"
                          title="Viber"
                        >
                          📞 V
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {sent.size === targetsWithPhone.length && (
            <div className="card bg-emerald-50 border-emerald-300 text-emerald-900 text-center">
              ✓ Sve WhatsApp poruke su poslate. Možeš da se vratiš na <b>Vesti</b>.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SequentialSender({
  target,
  encoded,
  currentIdx,
  total,
  onSent,
  onCancel,
  alreadySent,
}: {
  target: SendTarget & { normalizedPhone: string };
  encoded: string;
  currentIdx: number;
  total: number;
  onSent: () => void;
  onCancel: () => void;
  alreadySent: boolean;
}) {
  const waUrl = `https://wa.me/${target.normalizedPhone.replace("+", "")}?text=${encoded}`;
  return (
    <div className="card border-blue-400 bg-blue-50">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-blue-900 font-semibold uppercase tracking-wider">
          WhatsApp · {currentIdx + 1} od {total}
        </div>
        <button onClick={onCancel} className="text-xs text-blue-700 hover:underline">
          Otkaži
        </button>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <TeamCrest
          name={target.team_name}
          shortName={target.team_short}
          primaryColor={target.team_primary}
          secondaryColor={target.team_secondary}
          size={56}
        />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg truncate">{target.team_name}</div>
          <div className="text-sm text-zinc-700">
            {target.captain_name ?? "Kapiten"} · <span className="font-mono">{target.normalizedPhone}</span>
          </div>
        </div>
      </div>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          // Mark sent and advance after a brief delay so the WA tab opens first.
          setTimeout(onSent, 400);
        }}
        className="inline-flex items-center justify-center gap-2 w-full rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 text-base font-medium"
      >
        {alreadySent ? "💬 Pošalji ponovo (već poslato)" : "💬 Otvori WhatsApp i pošalji →"}
      </a>
      <p className="text-[11px] text-zinc-600 mt-2 text-center">
        Klikni dugme · pošalji u WhatsApp-u · vrati se na ovaj tab — app prelazi na sledećeg kapitena automatski.
      </p>
    </div>
  );
}
