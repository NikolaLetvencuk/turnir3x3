"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Supabase Realtime on matches + match_events and triggers
 * router.refresh() (light debounce) on any change. Mount this on listing
 * pages so users see goals / live status changes without manual refresh.
 *
 * The `tag` prop just gives the channel a unique name when multiple
 * LiveRefresh instances mount under different routes.
 */
export function LiveRefresh({ tag = "default" }: { tag?: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 300);
    };
    const ch = supabase
      .channel(`live-refresh-${tag}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events" }, schedule)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
  }, [router, tag]);

  return null;
}
