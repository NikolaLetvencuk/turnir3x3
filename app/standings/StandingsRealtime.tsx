"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function StandingsRealtime() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("standings-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events" }, () => {
        router.refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [router]);
  return null;
}
