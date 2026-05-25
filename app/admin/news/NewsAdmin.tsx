"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Trash2, Send } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
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
  const [postPublish, setPostPublish] = useState<{ title: string; body: string } | null>(null);

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
      setPostPublish({ title: title.trim(), body: body.trim() });
    }
    setTitle("");
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Megaphone}
        title="Vesti"
        hint="Najnovija vest se vidi na početnoj. Po objavi se otvara WhatsApp sa porukom — biraš grupu kapitena i šalješ."
        tone="amber"
      />

      {/* Set-up tip */}
      <div className="card border-blue-200 bg-blue-50">
        <h2 className="font-medium text-blue-900 mb-1">💡 Jednokratni setup</h2>
        <p className="text-sm text-blue-900/90">
          Napravi <b>WhatsApp grupu</b> sa svim kapitenima (otvori WA → Nova
          grupa → dodaj 14 brojeva → daj joj ime &quot;Kapiteni Turnir Kula&quot;). Sve
          buduće vesti šaljemo u tu grupu — jedan klik kod nas, jedan tap u WA.
        </p>
      </div>

      {/* Post-publish action chooser */}
      {postPublish && (
        <PostPublishPanel
          message={buildMessage(postPublish.title, postPublish.body)}
          onClose={() => setPostPublish(null)}
        />
      )}

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
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setPostPublish({ title: n.title, body: n.body })}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2.5 py-1 text-xs font-medium"
                    title="Ponovo pošalji u WhatsApp"
                  >
                    <Send className="w-3.5 h-3.5" /> WA
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
                    className="inline-flex items-center gap-1 rounded-md bg-red-100 hover:bg-red-200 text-red-700 px-2.5 py-1 text-xs font-medium"
                    title="Obriši vest"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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

function PostPublishPanel({ message, onClose }: { message: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const encoded = encodeURIComponent(message);
  // Two universal URLs — wa.me opens the native app on mobile, falls back to
  // WhatsApp Web on desktop. web.whatsapp.com forces the browser variant.
  const waUniversal = `https://wa.me/?text=${encoded}`;
  const waApp = `whatsapp://send?text=${encoded}`;
  const waWeb = `https://web.whatsapp.com/send?text=${encoded}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard might be blocked — ignore */
    }
  }

  return (
    <div className="card border-2 border-emerald-300 bg-emerald-50/60">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h2 className="font-semibold text-emerald-900">✓ Vest objavljena. Sad je pošalji u WA grupu kapitena.</h2>
          <p className="text-xs text-emerald-900/80 mt-1">
            Izaberi kako da otvoriš WhatsApp. WA ne dozvoljava da unapred
            izaberemo grupu — uvek ćeš morati da tapneš grupu sa Share liste.
          </p>
        </div>
        <button onClick={onClose} className="text-emerald-700 hover:text-emerald-900 text-xl leading-none">×</button>
      </div>

      <pre className="whitespace-pre-wrap font-sans text-xs bg-white border border-emerald-200 rounded p-2 mb-3 max-h-40 overflow-y-auto">
        {message}
      </pre>

      <div className="grid sm:grid-cols-3 gap-2">
        <a
          href={waApp}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 text-sm font-medium"
        >
          📱 WhatsApp aplikacija
        </a>
        <a
          href={waWeb}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-2.5 text-sm font-medium"
        >
          🌐 WhatsApp Web
        </a>
        <button
          onClick={copy}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-2.5 text-sm font-medium"
        >
          {copied ? "✓ Kopirano" : "📋 Kopiraj tekst"}
        </button>
      </div>

      <p className="text-[11px] text-emerald-900/70 mt-2">
        Univerzalni link (mobile bira aplikaciju, desktop bira Web):{" "}
        <a href={waUniversal} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
          wa.me/?text=…
        </a>
      </p>
    </div>
  );
}
