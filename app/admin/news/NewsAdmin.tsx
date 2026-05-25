"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { createNews, deleteNews } from "../actions";

export type NewsRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

function buildMessage(title: string, body: string): string {
  return `📢 *${title}*\n\n${body}\n\n— Turnir Kula\nhttps://turnir3x3.vercel.app`;
}

function formatRelativeDate(iso: string): string {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    timeZone: "Europe/Belgrade",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function NewsAdmin({ news }: { news: NewsRow[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendToWaGroup, setSendToWaGroup] = useState(true);
  const [pending, setPending] = useState(false);

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

    if (sendToWaGroup) {
      const message = buildMessage(title.trim(), body.trim());
      // whatsapp://send?text=... opens WhatsApp's "Share with..." dialog with
      // the message pre-filled. Admin picks the captains' group, taps Send.
      const waUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
      window.location.href = waUrl;
      // Fallback if the OS doesn't have the WA app installed — try wa.me as
      // web-based universal link after a short delay.
      setTimeout(() => {
        if (document.hasFocus()) {
          window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
        }
      }, 1500);
    }
    setTitle("");
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Vesti</h1>
        <p className="text-sm text-zinc-500">
          Najnovija vest se prikazuje na početnoj stranici sajta. Pri objavi
          opciono otvara se WhatsApp sa već pripremljenom porukom — odabereš
          grupu kapitena, klikneš Send.
        </p>
      </div>

      {/* Set-up tip */}
      <div className="card border-blue-200 bg-blue-50">
        <h2 className="font-medium text-blue-900 mb-1">💡 Jednokratni setup</h2>
        <p className="text-sm text-blue-900/90">
          Napravi <b>WhatsApp grupu</b> sa svim kapitenima (otvori WA → Nova
          grupa → dodaj 14 brojeva → daj joj ime &quot;Kapiteni Turnir Kula&quot;). Sve
          buduće vesti šaljemo u tu grupu — jedan klik kod nas, jedan tap u WA.
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

        <label className="flex items-start gap-2 text-sm cursor-pointer p-2 -mx-1 rounded hover:bg-zinc-50">
          <input
            type="checkbox"
            checked={sendToWaGroup}
            onChange={(e) => setSendToWaGroup(e.target.checked)}
            className="mt-0.5"
          />
          <div className="flex-1">
            <div className="font-medium">📱 Pošalji u WhatsApp grupu kapitena</div>
            <div className="text-xs text-zinc-500">
              Posle objave otvara se WhatsApp sa pripremljenom porukom — biraš
              grupu i klikneš Send.
            </div>
          </div>
        </label>

        <button
          type="submit"
          disabled={pending || !title.trim() || !body.trim()}
          className="btn-primary w-full !py-2.5 text-base"
        >
          {pending ? "Snimam…" : sendToWaGroup ? "Objavi i otvori WhatsApp →" : "Objavi vest"}
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
                <div className="flex gap-3 mt-1.5">
                  <button
                    onClick={() => {
                      const url = `whatsapp://send?text=${encodeURIComponent(buildMessage(n.title, n.body))}`;
                      window.location.href = url;
                    }}
                    className="text-xs text-emerald-700 hover:underline"
                  >
                    💬 Ponovo pošalji u WA
                  </button>
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
                    className="text-xs text-red-600 hover:underline"
                  >
                    Obriši
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
