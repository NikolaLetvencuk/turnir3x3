"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TeamCrest } from "@/components/TeamCrest";
import type { DrawResult, DrawTeam } from "@/lib/draw";

type Stage = "shuffle" | "pick" | "done";

const SHUFFLE_MS = 5000; // 5s of opening shuffle for everyone to notice
const DEFAULT_PER_PICK_MS = 5000; // ~5s per team reveal — slow enough to follow

/**
 * Animates a pre-computed draw. When `startedAtMs` is provided (Date.now() based),
 * the reveal schedule is deterministic across all clients — they all show the same
 * state at the same wall-clock instant.
 */
export function DrawAnimation({
  result,
  onSkip,
  onDone,
  perPickMs = DEFAULT_PER_PICK_MS,
  startedAtMs,
  allowSkip = true,
}: {
  result: DrawResult;
  onSkip?: () => void;
  onDone?: () => void;
  perPickMs?: number;
  startedAtMs?: number; // wall-clock ms when the animation should have started
  allowSkip?: boolean;
}) {
  const allPicks: Array<{ groupIdx: number; team: DrawTeam }> = [];
  result.groups.forEach((g, gi) => g.teams.forEach((t) => allPicks.push({ groupIdx: gi, team: t })));

  const [now, setNow] = useState<number>(() => Date.now());
  const baseStart = startedAtMs ?? now; // if not provided, this client starts now
  const elapsed = Math.max(0, now - baseStart);
  const stage: Stage = elapsed < SHUFFLE_MS
    ? "shuffle"
    : elapsed < SHUFFLE_MS + allPicks.length * perPickMs
    ? "pick"
    : "done";
  const pickElapsed = Math.max(0, elapsed - SHUFFLE_MS);
  const revealedCount = Math.min(allPicks.length, Math.floor(pickElapsed / perPickMs));

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (stage === "done" && onDone) {
      const t = setTimeout(() => onDone(), 800);
      return () => clearTimeout(t);
    }
  }, [stage, onDone]);

  function skipNow() {
    onSkip?.();
  }

  const remainingMs = Math.max(0, SHUFFLE_MS + allPicks.length * perPickMs - elapsed);
  const remainingS = Math.ceil(remainingMs / 1000);

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/95 text-white p-4 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="text-xl font-bold">
            {stage === "done" ? "Žreb završen" : "Žreb u toku…"}
          </h2>
          <div className="flex items-center gap-2">
            {stage !== "done" && (
              <span className="text-xs text-white/70 tabular-nums">{remainingS}s</span>
            )}
            {allowSkip && stage !== "done" && (
              <button onClick={skipNow} className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1.5 text-sm">Preskoči</button>
            )}
          </div>
        </div>

        {stage === "shuffle" && (
          <div className="flex flex-wrap gap-3 justify-center py-12">
            {allPicks.map((p, i) => (
              <motion.div
                key={p.team.id}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  x: [0, Math.random() * 60 - 30, 0],
                  y: [0, Math.random() * 60 - 30, 0],
                  rotate: [0, Math.random() * 30 - 15, 0],
                }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.04 }}
              >
                <TeamCrest name={p.team.name} shortName={p.team.short_name} primaryColor={p.team.primary_color} secondaryColor={p.team.secondary_color} size={64} />
              </motion.div>
            ))}
          </div>
        )}

        {(stage === "pick" || stage === "done") && (
          <div className="grid sm:grid-cols-2 gap-3">
            {result.groups.map((g, gi) => {
              const picksHere = allPicks
                .slice(0, revealedCount)
                .filter((r) => r.groupIdx === gi);
              return (
                <div key={gi} className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="font-semibold mb-2">{g.name}</div>
                  <ul className="space-y-1">
                    <AnimatePresence initial={false}>
                      {picksHere.map((r) => (
                        <motion.li
                          key={r.team.id}
                          initial={{ opacity: 0, scale: 0.6, y: -20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="flex items-center gap-2 text-sm"
                        >
                          <TeamCrest name={r.team.name} shortName={r.team.short_name} primaryColor={r.team.primary_color} secondaryColor={r.team.secondary_color} size={32} />
                          <span className="font-medium">{r.team.name}</span>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {stage === "pick" && (
          <div className="text-center mt-6">
            <div className="text-xs text-white/60 uppercase tracking-wider">Sledeći tim u žrebu…</div>
            <div className="text-3xl font-bold mt-1 tabular-nums">
              {revealedCount} / {allPicks.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
