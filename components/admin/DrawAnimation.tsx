"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";
import type { DrawResult, DrawTeam } from "@/lib/draw";

const INTRO_MS = 3500;
const SETUP_MS = 2500;
const FINALE_MS = 5000;
const DEFAULT_PER_PICK_MS = 5000;

// Per-pick sub-phase offsets (ms from start of pick)
const PICK_LIFT_MS = 1600;
const PICK_REVEAL_MS = 2200;
const PICK_FLY_MS = 1200;

// Mystery-crest color palettes — cycled deterministically during the lift phase so
// the viewer sees a black crest flicker through colors before the real team is revealed.
const MYSTERY_PALETTES: Array<[string, string]> = [
  ["#dc2626", "#0f172a"],
  ["#2563eb", "#f8fafc"],
  ["#16a34a", "#f8fafc"],
  ["#facc15", "#0f172a"],
  ["#7c3aed", "#f8fafc"],
  ["#ea580c", "#0f172a"],
  ["#0ea5e9", "#0f172a"],
  ["#ec4899", "#f8fafc"],
];

type Pick = { groupIdx: number; positionInGroup: number; team: DrawTeam; pickIdx: number };

export function DrawAnimation({
  result,
  onSkip,
  onDone,
  onExit,
  perPickMs = DEFAULT_PER_PICK_MS,
  startedAtMs,
  allowSkip = true,
}: {
  result: DrawResult;
  onSkip?: () => void;
  onDone?: () => void;
  onExit?: () => void;
  perPickMs?: number;
  startedAtMs?: number;
  allowSkip?: boolean;
}) {
  // Lock body scroll while the full-screen animation is mounted so the page
  // behind it can't rubber-band / scroll on mobile. Restored on unmount.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = (document.body.style as any).overscrollBehavior;
    document.body.style.overflow = "hidden";
    (document.body.style as any).overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      (document.body.style as any).overscrollBehavior = prevOverscroll;
    };
  }, []);
  // Groups fill in order: pick 1 → Group A, pick 2 → B, pick 3 → C, ... wrapping rows.
  // Suspense lives in *which team* is being pulled, handled by the mystery crest below.
  const allPicks: Pick[] = useMemo(() => {
    const out: Pick[] = [];
    const maxLen = Math.max(0, ...result.groups.map((g) => g.teams.length));
    let i = 0;
    for (let pos = 0; pos < maxLen; pos++) {
      result.groups.forEach((g, gi) => {
        if (g.teams[pos]) out.push({ groupIdx: gi, positionInGroup: pos, team: g.teams[pos], pickIdx: i++ });
      });
    }
    return out;
  }, [result]);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const baseStart = startedAtMs ?? now;
  const elapsed = Math.max(0, now - baseStart);

  const picksDuration = allPicks.length * perPickMs;
  const totalDuration = INTRO_MS + SETUP_MS + picksDuration + FINALE_MS;

  let phase: "intro" | "setup" | "picks" | "finale" | "done";
  if (elapsed < INTRO_MS) phase = "intro";
  else if (elapsed < INTRO_MS + SETUP_MS) phase = "setup";
  else if (elapsed < INTRO_MS + SETUP_MS + picksDuration) phase = "picks";
  else if (elapsed < totalDuration) phase = "finale";
  else phase = "done";

  const picksElapsed = Math.max(0, elapsed - INTRO_MS - SETUP_MS);
  const currentPickIdx = Math.min(allPicks.length - 1, Math.floor(picksElapsed / perPickMs));
  const pickStart = currentPickIdx * perPickMs;
  const pickSub = Math.max(0, picksElapsed - pickStart);
  const subPhase: "lift" | "reveal" | "fly" | "settle" =
    pickSub < PICK_LIFT_MS ? "lift"
    : pickSub < PICK_LIFT_MS + PICK_REVEAL_MS ? "reveal"
    : pickSub < PICK_LIFT_MS + PICK_REVEAL_MS + PICK_FLY_MS ? "fly"
    : "settle";

  const settledCount = phase === "picks"
    ? currentPickIdx + (subPhase === "settle" ? 1 : 0)
    : (phase === "finale" || phase === "done") ? allPicks.length : 0;
  const currentPick = phase === "picks" ? allPicks[currentPickIdx] : null;

  useEffect(() => {
    if (phase === "done" && onDone) {
      const t = setTimeout(() => onDone(), 400);
      return () => clearTimeout(t);
    }
  }, [phase, onDone]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden overscroll-none touch-none" style={{ height: "100dvh" }}>
      <Background />

      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {onExit && (
            <button
              onClick={onExit}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full px-3 py-1.5 text-xs font-medium border border-white/10 inline-flex items-center gap-1"
            >
              ← Izađi
            </button>
          )}
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-xs uppercase tracking-[0.2em] font-semibold text-white/90 truncate">Žreb · Petrovski Kula</span>
        </div>
        {allowSkip && phase !== "done" && (
          <button
            onClick={onSkip}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full px-3 py-1.5 text-xs font-medium border border-white/10 shrink-0"
          >
            Preskoči
          </button>
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4 pt-14">
        <AnimatePresence mode="wait">
          {phase === "intro" && <IntroScreen key="intro" />}
          {phase === "setup" && <SetupScreen key="setup" />}
          {phase === "picks" && currentPick && (
            <PicksStage
              key="picks"
              groups={result.groups}
              currentPick={currentPick}
              subPhase={subPhase}
              pickSub={pickSub}
              settledCount={settledCount}
              totalPicks={allPicks.length}
              allPicks={allPicks}
            />
          )}
          {phase === "finale" && <FinaleScreen key="finale" result={result} />}
          {phase === "done" && <FinaleScreen key="done" result={result} stillVisible />}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ============================ BACKGROUND ============================ */

function Background() {
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-blue-950/70 to-zinc-950" />
      <motion.div
        className="absolute -top-32 -left-32 w-[40rem] h-[40rem] rounded-full bg-blue-500/20 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 -right-32 w-[36rem] h-[36rem] rounded-full bg-blue-400/15 blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[2px] h-[2px] bg-zinc-900 rounded-full"
            style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, opacity: 0.6 }}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 3 + (i % 5), repeat: Infinity, delay: (i % 10) * 0.3 }}
          />
        ))}
      </div>
    </>
  );
}

/* ============================ INTRO ============================ */

function IntroScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-blue-400 text-xs uppercase tracking-[0.4em] font-semibold mb-3"
      >
        Petrovski Kula
      </motion.div>
      <motion.h1
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 1.12, 1], opacity: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], times: [0, 0.7, 1] }}
        className="text-[18vw] sm:text-[10rem] font-black tracking-tighter leading-none text-white"
        style={{ textShadow: "0 0 60px rgba(37,99,235,0.6), 0 0 120px rgba(37,99,235,0.3)" }}
      >
        ŽREB
      </motion.h1>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.6 }}
        className="text-white/70 text-sm uppercase tracking-[0.3em] mt-4"
      >
        Sve počinje sada
      </motion.div>
    </motion.div>
  );
}

/* ============================ SETUP ============================ */

function SetupScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="text-center"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-blue-500/30 border-t-blue-400"
      />
      <h2 className="text-white text-2xl font-bold tracking-tight">Pripremamo žreb…</h2>
      <p className="text-white/60 text-sm mt-2">Timovi se ubacuju u šešir</p>
    </motion.div>
  );
}

/* ============================ PICKS STAGE ============================ */

function PicksStage({
  groups,
  currentPick,
  subPhase,
  pickSub,
  settledCount,
  totalPicks,
  allPicks,
}: {
  groups: DrawResult["groups"];
  currentPick: Pick;
  subPhase: "lift" | "reveal" | "fly" | "settle";
  pickSub: number;
  settledCount: number;
  totalPicks: number;
  allPicks: Pick[];
}) {
  const settledPicks = allPicks.slice(0, settledCount);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-4xl"
    >
      <div className="flex justify-center gap-1.5 mb-6 flex-wrap">
        {Array.from({ length: totalPicks }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i < settledCount ? "bg-blue-400 w-6" : i === settledCount ? "bg-blue-400/60 w-3 animate-pulse" : "bg-white/20 w-1.5"
            }`}
          />
        ))}
      </div>

      <div className="relative h-[14rem] sm:h-[18rem] mb-6 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <SpotlightCard key={currentPick.pickIdx} pick={currentPick} subPhase={subPhase} pickSub={pickSub} />
        </AnimatePresence>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 max-h-[40vh] overflow-auto overscroll-contain px-1 pb-2">
        {groups.map((g, gi) => (
          <div
            key={gi}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-3"
          >
            <div className="text-blue-400 text-[10px] uppercase tracking-[0.2em] font-semibold mb-2">
              {g.name}
            </div>
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {settledPicks
                  .filter((p) => p.groupIdx === gi)
                  .map((p) => (
                    <motion.li
                      key={p.team.id}
                      initial={{ opacity: 0, x: -30, scale: 0.8 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-center gap-2 text-sm text-white"
                    >
                      <TeamCrest
                        name={p.team.name}
                        shortName={p.team.short_name}
                        primaryColor={p.team.primary_color}
                        secondaryColor={p.team.secondary_color} logoUrl={p.team.logo_url}
                        size={32}
                      />
                      <span className="font-medium truncate">{p.team.name}</span>
                    </motion.li>
                  ))}
              </AnimatePresence>
            </ul>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function SpotlightCard({
  pick,
  subPhase,
  pickSub,
}: {
  pick: Pick;
  subPhase: "lift" | "reveal" | "fly" | "settle";
  pickSub: number;
}) {
  const groupLabel = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[pick.groupIdx] ?? "?";
  const isLift = subPhase === "lift";
  return (
    <motion.div
      initial={{ scale: 0.4, opacity: 0, y: 20 }}
      animate={
        subPhase === "lift"
          ? { scale: 0.85, opacity: 1, y: 0 }
          : subPhase === "reveal"
          ? { scale: 1, opacity: 1, y: 0 }
          : subPhase === "fly"
          ? { scale: 0.5, opacity: 0.6, y: 80 }
          : { scale: 0.3, opacity: 0, y: 100 }
      }
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col items-center"
    >
      <motion.div
        className="absolute inset-0 -inset-x-12 -inset-y-12 rounded-full bg-blue-500/30 blur-3xl"
        animate={{ scale: [0.8, 1.2, 0.9] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        animate={isLift ? { rotate: [-3, 3, -3] } : undefined}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="relative z-10"
      >
        {isLift ? (
          <MysteryCrest size={120} subElapsedMs={pickSub} />
        ) : (
          <TeamCrest
            name={pick.team.name}
            shortName={pick.team.short_name}
            primaryColor={pick.team.primary_color}
            secondaryColor={pick.team.secondary_color} logoUrl={pick.team.logo_url}
            size={120}
          />
        )}
      </motion.div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={subPhase === "reveal" ? { y: 0, opacity: 1 } : { y: 0, opacity: isLift ? 0 : 0.6 }}
        transition={{ duration: 0.4, delay: subPhase === "reveal" ? 0.2 : 0 }}
        className="relative z-10 mt-4 text-center px-2"
      >
        <div className="text-white text-2xl sm:text-3xl font-black tracking-tight">
          {isLift ? " " : pick.team.name}
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={subPhase === "reveal" || subPhase === "fly" ? { scale: 1 } : { scale: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-2 inline-flex items-center gap-1.5 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 rounded-full px-3 py-1"
        >
          <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Grupa {groupLabel}</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ============================ MYSTERY CREST ============================ */

/**
 * Suspense placeholder shown during the "lift" sub-phase.
 *   0..400 ms        → solid black shield with "?"
 *   400..1300 ms     → rapid color flicker through MYSTERY_PALETTES (every 90 ms)
 *   1300..PICK_LIFT  → flicker decelerates then locks back to black before the reveal
 * The cycle is driven by `subElapsedMs` so it stays in sync across clients.
 */
function MysteryCrest({ size, subElapsedMs }: { size: number; subElapsedMs: number }) {
  const t = subElapsedMs;
  let primary = "#0a0a0a";
  let secondary = "#1f2937";
  let showQuestion = true;
  if (t >= 400 && t < 1300) {
    const step = Math.floor((t - 400) / 90);
    const palette = MYSTERY_PALETTES[step % MYSTERY_PALETTES.length];
    primary = palette[0];
    secondary = palette[1];
    showQuestion = false;
  } else if (t >= 1300 && t < 1500) {
    const step = Math.floor((t - 1300) / 140);
    const palette = MYSTERY_PALETTES[step % MYSTERY_PALETTES.length];
    primary = palette[0];
    secondary = palette[1];
    showQuestion = false;
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${primary} 0%, ${primary} 50%, ${secondary} 50%, ${secondary} 100%)`,
        clipPath: "polygon(50% 0%, 100% 18%, 100% 65%, 50% 100%, 0% 65%, 0% 18%)",
        boxShadow: "0 0 40px rgba(37,99,235,0.45)",
        transition: "background 60ms linear",
      }}
      className="relative flex items-center justify-center"
    >
      {showQuestion && (
        <span
          className="font-black text-white/70 select-none"
          style={{ fontSize: size * 0.5, lineHeight: 1 }}
        >
          ?
        </span>
      )}
    </div>
  );
}

/* ============================ FINALE ============================ */

function FinaleScreen({ result, stillVisible = false }: { result: DrawResult; stillVisible?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={stillVisible ? undefined : { opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center w-full max-w-4xl"
    >
      {!stillVisible && <Confetti />}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-blue-400 text-xs uppercase tracking-[0.4em] font-semibold mb-2"
      >
        Žreb završen
      </motion.div>
      <motion.h2
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.08, 1], opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], times: [0, 0.7, 1] }}
        className="text-4xl sm:text-6xl font-black text-white mb-6 tracking-tight"
        style={{ textShadow: "0 0 60px rgba(37,99,235,0.6)" }}
      >
        Grupe su izvučene
      </motion.h2>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="grid sm:grid-cols-2 gap-3 max-h-[50vh] overflow-auto overscroll-contain"
      >
        {result.groups.map((g, gi) => (
          <motion.div
            key={gi}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 + gi * 0.1 }}
            className="bg-white/5 backdrop-blur-md border border-blue-400/30 rounded-2xl p-3"
          >
            <div className="text-blue-400 text-[10px] uppercase tracking-[0.2em] font-semibold mb-2">{g.name}</div>
            <ul className="space-y-1.5">
              {g.teams.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm text-white">
                  <TeamCrest name={t.name} shortName={t.short_name} primaryColor={t.primary_color} secondaryColor={t.secondary_color} logoUrl={t.logo_url} size={28} />
                  <span className="font-medium truncate">{t.name}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function Confetti() {
  const emojis = ["🎉", "✨", "🎊", "⭐"];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => {
        const left = (i * 23.7) % 100;
        const delay = (i * 0.05) % 2;
        const duration = 3 + (i % 3) * 0.5;
        const emoji = emojis[i % emojis.length];
        return (
          <motion.div
            key={i}
            className="absolute text-2xl"
            style={{ left: `${left}%`, top: "-5%" }}
            initial={{ y: -50, rotate: 0, opacity: 1 }}
            animate={{ y: "110vh", rotate: 360 * (1 + (i % 3)), opacity: [1, 1, 0] }}
            transition={{ duration, delay, ease: "linear" }}
          >
            {emoji}
          </motion.div>
        );
      })}
    </div>
  );
}
