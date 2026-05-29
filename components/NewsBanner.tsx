"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type News = { id: string; title: string; body: string; created_at: string };

const DISMISS_KEY = "dismissed_news_id";

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("sr-Latn-RS", {
      timeZone: "Europe/Belgrade",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function NewsBanner({ initial }: { initial: News | null }) {
  const [news, setNews] = useState<News | null>(initial);
  // Once the user closes a news item, remember its id so it stays hidden on
  // the home screen until a *newer* news item is published.
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissedId(localStorage.getItem(DISMISS_KEY));
    } catch {
      /* localStorage blocked — banner just always shows */
    }
  }, []);

  useEffect(() => {
    setNews(initial);
  }, [initial]);

  function dismiss() {
    if (!news) return;
    try {
      localStorage.setItem(DISMISS_KEY, news.id);
    } catch {
      /* ignore */
    }
    setDismissedId(news.id);
  }

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("news-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "news" }, (payload) => {
        if (payload.eventType === "DELETE") {
          // If the displayed news got deleted, the SSR re-render via realtime
          // won't fire here — we'll just clear it until next refresh.
          setNews((prev) => (prev && payload.old && (payload.old as any).id === prev.id ? null : prev));
          return;
        }
        const row = payload.new as News | undefined;
        if (!row) return;
        setNews((prev) => {
          if (!prev) return row;
          // Show whichever is newer.
          return new Date(row.created_at).getTime() > new Date(prev.created_at).getTime() ? row : prev;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  if (!news) return null;
  if (dismissedId === news.id) return null;

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <Megaphone className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-semibold text-amber-900 truncate">{news.title}</h3>
            <span className="text-[10px] text-amber-700 shrink-0">{formatDateTime(news.created_at)}</span>
          </div>
          <p className="text-sm text-amber-900/90 mt-1 whitespace-pre-wrap">{news.body}</p>
          <Link
            href="/vesti"
            className="text-xs text-amber-800 hover:text-amber-900 mt-2 inline-block underline"
          >
            Vidi sve vesti →
          </Link>
        </div>
        <button
          onClick={dismiss}
          aria-label="Zatvori"
          className="shrink-0 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-md p-1 -mr-1 -mt-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
