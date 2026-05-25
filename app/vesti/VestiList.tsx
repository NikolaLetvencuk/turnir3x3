"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type News = { id: string; title: string; body: string; created_at: string };

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    timeZone: "Europe/Belgrade",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function VestiList({ initial }: { initial: News[] }) {
  const [items, setItems] = useState<News[]>(initial);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("vesti-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "news" }, (payload) => {
        setItems((prev) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string } | undefined)?.id;
            return oldId ? prev.filter((n) => n.id !== oldId) : prev;
          }
          const row = payload.new as News | undefined;
          if (!row) return prev;
          const idx = prev.findIndex((n) => n.id === row.id);
          if (idx === -1) {
            return [row, ...prev];
          }
          const next = prev.slice();
          next[idx] = row;
          return next;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="w-6 h-6" />
          Vesti
        </h1>
        <p className="text-blue-50 mt-1 text-sm">Sva obaveštenja sa turnira na jednom mestu.</p>
      </div>

      {items.length === 0 ? (
        <div className="card text-center text-sm text-zinc-500 italic">
          Još nema vesti. Pratite ovu stranicu za sva obaveštenja sa turnira.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4"
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <h2 className="font-semibold text-amber-900 text-lg">{n.title}</h2>
                <time className="text-xs text-amber-700 shrink-0 tabular-nums">
                  {formatDateTime(n.created_at)}
                </time>
              </div>
              <p className="text-sm text-amber-900/90 whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
