"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TeamCrest } from "@/components/TeamCrest";
import { useToast } from "@/components/ui/Toast";
import { createNews, deleteNews } from "../actions";

export type NewsRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export type CaptainTeam = {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  captain_name: string | null;
  captain_phone: string | null;
  plays_today: boolean;
};

type Mode = "all" | "today" | "manual";

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  // Strip everything but digits and +
  let s = raw.trim().replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+381" + s.slice(1); // Serbian default
  if (!s.startsWith("+")) s = "+" + s;
  return s;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    timeZone: "Europe/Belgrade",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function NewsAdmin({ news, teams }: { news: NewsRow[]; teams: CaptainTeam[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendToCaptains, setSendToCaptains] = useState(false);
  const [mode, setMode] = useState<Mode>("all");
  const [manualSelection, setManualSelection] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  const captainsAll = teams.filter((t) => t.captain_phone && normalizePhone(t.captain_phone));
  const captainsToday = captainsAll.filter((t) => t.plays_today);
  const captainsManual = captainsAll.filter((t) => manualSelection.has(t.id));

  const selectedCaptains = useMemo(() => {
    if (!sendToCaptains) return [] as CaptainTeam[];
    if (mode === "all") return captainsAll;
    if (mode === "today") return captainsToday;
    return captainsManual;
  }, [sendToCaptains, mode, captainsAll, captainsToday, captainsManual]);

  function toggleManual(id: string) {
    setManualSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setPending(true);
    const res = await createNews({ title: title.trim(), body: body.trim() });
    setPending(false);
    if (!res.ok) {
      push(res.error, "error");
      return;
    }
    push("Vest objavljena", "success");
    if (sendToCaptains && selectedCaptains.length > 0 && res.data) {
      const teamIds = selectedCaptains.map((c) => c.id).join(",");
      router.push(`/admin/news/${res.data.id}/send?teams=${encodeURIComponent(teamIds)}`);
      return;
    }
    setTitle("");
    setBody("");
    setSendToCaptains(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Vesti</h1>
        <p className="text-sm text-zinc-500">
          Najnovija vest se prikazuje na početnoj stranici. Možeš odmah poslati vest kapitenima
          na WhatsApp ili Viber jednim klikom.
        </p>
      </div>

      {/* New post form */}
      <form onSubmit={submit} className="card space-y-3">
        <h2 className="font-medium">Nova vest</h2>
        <label className="block">
          <span className="text-xs text-zinc-600">Naslov</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="npr. Otkazane utakmice za danas"
            maxLength={120}
            className="input"
            required
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-600">Tekst vesti</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Sve utakmice planirane za danas se prebacuju za sutra zbog kiše. Termini ostaju isti, samo u petak umesto u četvrtak."
            maxLength={2000}
            rows={5}
            className="input resize-y"
            required
          />
          <span className="text-[10px] text-zinc-400">{body.length} / 2000</span>
        </label>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={sendToCaptains}
            onChange={(e) => setSendToCaptains(e.target.checked)}
            className="mt-0.5"
          />
          <div className="flex-1">
            <div className="font-medium">📱 Pošalji vest kapitenima na WhatsApp / Viber</div>
            <div className="text-xs text-zinc-500">
              Posle objave otvara se ekran sa dugmićima — po jedan klik po kapitenu.
            </div>
          </div>
        </label>

        {sendToCaptains && (
          <div className="border-l-2 border-blue-300 pl-3 space-y-2">
            <div className="text-xs text-zinc-600">Kome poslati?</div>
            <div className="grid grid-cols-1 gap-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} />
                <span>Svim ekipama ({captainsAll.length} kapitena sa telefonom)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={mode === "today"} onChange={() => setMode("today")} />
                <span>Samo ekipama koje igraju danas ({captainsToday.length} kapitena)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={mode === "manual"} onChange={() => setMode("manual")} />
                <span>Izaberi ekipe ručno</span>
              </label>
            </div>

            {mode === "manual" && (
              <div className="border border-zinc-200 rounded-md bg-zinc-50 p-2 max-h-64 overflow-y-auto">
                {teams.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">Nema ekipa.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {teams.map((t) => {
                      const hasPhone = !!normalizePhone(t.captain_phone ?? "");
                      return (
                        <li key={t.id}>
                          <label
                            className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${hasPhone ? "hover:bg-white cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                          >
                            <input
                              type="checkbox"
                              disabled={!hasPhone}
                              checked={manualSelection.has(t.id)}
                              onChange={() => toggleManual(t.id)}
                            />
                            <TeamCrest
                              name={t.name}
                              shortName={t.short_name}
                              primaryColor={t.primary_color}
                              secondaryColor={t.secondary_color}
                              size={20}
                            />
                            <span className="flex-1 truncate">{t.name}</span>
                            {hasPhone ? (
                              <span className="text-[10px] text-zinc-500">{t.captain_name ?? "kapiten"}</span>
                            ) : (
                              <span className="text-[10px] text-amber-700 italic">bez telefona</span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {selectedCaptains.length === 0 ? (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1.5">
                ⚠ Nijedan kapiten nije izabran (ili nemaju upisan telefon). Otvori
                <Link href="/admin/teams" className="text-blue-700 hover:underline ml-1">stranicu Timovi</Link>
                {" "}da dodaš telefone.
              </div>
            ) : (
              <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
                Posle objave biće prikazano <b>{selectedCaptains.length}</b> dugmadi za slanje.
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !title.trim() || !body.trim()}
          className="btn-primary w-full !py-2.5 text-base"
        >
          {pending ? "Snimam…" : sendToCaptains && selectedCaptains.length > 0 ? "Objavi i otvori slanje →" : "Objavi vest"}
        </button>
      </form>

      {/* Existing news */}
      <div className="card">
        <h2 className="font-medium mb-2">Sve vesti</h2>
        {news.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">Još nema vesti.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {news.map((n) => (
              <li key={n.id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-sm">{n.title}</h3>
                  <span className="text-[10px] text-zinc-500 shrink-0">{formatRelativeDate(n.created_at)}</span>
                </div>
                <p className="text-sm text-zinc-700 mt-1 whitespace-pre-wrap">{n.body}</p>
                <button
                  onClick={async () => {
                    if (!confirm("Obrisati ovu vest?")) return;
                    const res = await deleteNews({ id: n.id });
                    if (!res.ok) {
                      push(res.error, "error");
                      return;
                    }
                    push("Obrisano", "success");
                    router.refresh();
                  }}
                  className="text-xs text-red-600 hover:underline mt-1"
                >
                  Obriši
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
