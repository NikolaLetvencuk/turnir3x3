"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TeamCrest } from "@/components/TeamCrest";
import type { DrawResult, DrawTeam } from "@/lib/draw";

type Stage = "shuffle" | "pick" | "done";

export function DrawAnimation({ result, onSkip, onDone }: {
  result: DrawResult;
  onSkip: () => void;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<Stage>("shuffle");
  const [revealed, setRevealed] = useState<Array<{ groupIdx: number; team: DrawTeam }>>([]);

  const allPicks: Array<{ groupIdx: number; team: DrawTeam }> = [];
  result.groups.forEach((g, gi) => g.teams.forEach((t) => allPicks.push({ groupIdx: gi, team: t })));

  useEffect(() => {
    const shuffleMs = 2500;
    const t1 = setTimeout(() => setStage("pick"), shuffleMs);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (stage !== "pick") return;
    let i = 0;
    const interval = setInterval(() => {
      if (i >= allPicks.length) {
        clearInterval(interval);
        setStage("done");
        setTimeout(onDone, 800);
        return;
      }
      setRevealed((r) => [...r, allPicks[i]]);
      i++;
    }, 700);
    return () => clearInterval(interval);
  }, [stage]);

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/95 text-white p-4 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Žreb u toku…</h2>
          <button onClick={onSkip} className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1.5 text-sm">Preskoči</button>
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
                  x: [0, Math.random() * 40 - 20, 0],
                  y: [0, Math.random() * 40 - 20, 0],
                  rotate: [0, Math.random() * 30 - 15, 0],
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.02 }}
              >
                <TeamCrest name={p.team.name} shortName={p.team.short_name} primaryColor={p.team.primary_color} secondaryColor={p.team.secondary_color} size={56} />
              </motion.div>
            ))}
          </div>
        )}

        {(stage === "pick" || stage === "done") && (
          <div className="grid sm:grid-cols-2 gap-3">
            {result.groups.map((g, gi) => (
              <div key={gi} className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="font-semibold mb-2">{g.name}</div>
                <ul className="space-y-1">
                  <AnimatePresence initial={false}>
                    {revealed.filter((r) => r.groupIdx === gi).map((r) => (
                      <motion.li
                        key={r.team.id}
                        initial={{ opacity: 0, scale: 0.6, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="flex items-center gap-2 text-sm"
                      >
                        <TeamCrest name={r.team.name} shortName={r.team.short_name} primaryColor={r.team.primary_color} secondaryColor={r.team.secondary_color} size={28} />
                        <span>{r.team.name}</span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
