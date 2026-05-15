"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function BracketRealtime() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("bracket-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [router]);
  return null;
}
