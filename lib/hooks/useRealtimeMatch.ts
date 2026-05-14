"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"];
type MatchEvent = Database["public"]["Tables"]["match_events"]["Row"];

export function useRealtimeMatch(matchId: string, initialMatch: Match, initialEvents: MatchEvent[]) {
  const [match, setMatch] = useState<Match>(initialMatch);
  const [events, setEvents] = useState<MatchEvent[]>(initialEvents);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        (payload) => setMatch(payload.new as Match),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        (payload) => setEvents((prev) => [...prev, payload.new as MatchEvent]),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        (payload) => setEvents((prev) => prev.filter((e) => e.id !== (payload.old as MatchEvent).id)),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        (payload) => setEvents((prev) => prev.map((e) => (e.id === (payload.new as MatchEvent).id ? (payload.new as MatchEvent) : e))),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [matchId]);

  return { match, events };
}
