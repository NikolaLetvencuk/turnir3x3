"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, MeshTransmissionMaterial, Text } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { DrawResult, DrawTeam } from "@/lib/draw";

const INTRO_MS = 3500;
const SETUP_MS = 2500;
const FINALE_MS = 5000;
const DEFAULT_PER_PICK_MS = 5000;

const PICK_LIFT_MS = 1200;
const PICK_REVEAL_MS = 1200;
const PICK_FLY_MS = 1600;

type Pick = { groupIdx: number; positionInGroup: number; team: DrawTeam; pickIdx: number };

/* ============================ ENTRY ============================ */

export default function DrawAnimation3D({
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
  startedAtMs?: number;
  allowSkip?: boolean;
}) {
  // Ordered pick: A0, B0, C0, A1, B1, ... matches the 2D version.
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
    const id = setInterval(() => setNow(Date.now()), 30);
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

  useEffect(() => {
    if (phase === "done" && onDone) {
      const t = setTimeout(() => onDone(), 400);
      return () => clearTimeout(t);
    }
  }, [phase, onDone]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Background gradient behind canvas */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-blue-950 to-zinc-950" />

      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 pointer-events-none">
        <div className="flex items-center gap-2 text-white/90">
          <span className="text-xs uppercase tracking-[0.3em] font-semibold">UŽIVO: Žreb Turnir Kula</span>
        </div>
        {allowSkip && phase !== "done" && (
          <button
            onClick={onSkip}
            className="pointer-events-auto bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full px-3 py-1.5 text-xs font-medium border border-white/10"
          >
            Preskoči
          </button>
        )}
      </div>

      {/* Phase overlay text (intro/setup) */}
      {phase === "intro" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-blue-300 text-xs uppercase tracking-[0.5em] mb-3 animate-pulse">Turnir Kula</div>
            <div
              className="text-white text-7xl sm:text-9xl font-black tracking-tighter"
              style={{ textShadow: "0 0 80px rgba(37,99,235,0.8), 0 0 160px rgba(37,99,235,0.4)" }}
            >
              ŽREB
            </div>
          </div>
        </div>
      )}
      {phase === "setup" && (
        <div className="absolute inset-x-0 top-1/4 z-20 text-center pointer-events-none">
          <div className="text-white text-3xl font-bold tracking-tight">Pripremamo žreb…</div>
          <div className="text-white/60 text-sm mt-1">Timovi se ubacuju u centralnu posudu</div>
        </div>
      )}
      {phase === "picks" && (
        <div className="absolute bottom-6 inset-x-0 z-20 text-center pointer-events-none">
          <div className="text-blue-300 text-xs uppercase tracking-[0.3em]">Sledeći izvučeni klub…</div>
        </div>
      )}
      {(phase === "finale" || phase === "done") && (
        <div className="absolute top-16 inset-x-0 z-20 text-center pointer-events-none">
          <div className="text-blue-300 text-xs uppercase tracking-[0.4em] mb-1">Žreb završen</div>
          <div
            className="text-white text-4xl sm:text-5xl font-black tracking-tight"
            style={{ textShadow: "0 0 40px rgba(37,99,235,0.7)" }}
          >
            Grupe su izvučene
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 3.5, 10], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Scene
          allPicks={allPicks}
          groups={result.groups}
          phase={phase}
          currentPickIdx={currentPickIdx}
          subPhase={subPhase}
          pickSub={pickSub}
        />
      </Canvas>
    </div>
  );
}

/* ============================ SCENE ============================ */

function Scene({
  allPicks,
  groups,
  phase,
  currentPickIdx,
  subPhase,
  pickSub,
}: {
  allPicks: Pick[];
  groups: DrawResult["groups"];
  phase: "intro" | "setup" | "picks" | "finale" | "done";
  currentPickIdx: number;
  subPhase: "lift" | "reveal" | "fly" | "settle";
  pickSub: number;
}) {
  // Pot positions in an arc around camera target
  const N = groups.length;
  const potPositions = useMemo(() => arcPositions(N, 4.6, 1.6, -Math.PI * 0.42, Math.PI * 0.42), [N]);

  // For each pot, list of picks settled into it so far
  const settledByPot = useMemo(() => {
    const map: Pick[][] = groups.map(() => []);
    if (phase === "picks") {
      // settled includes everything before currentPickIdx + (current if in settle subphase)
      const cutoff = currentPickIdx + (subPhase === "settle" ? 1 : 0);
      allPicks.slice(0, cutoff).forEach((p) => map[p.groupIdx].push(p));
    } else if (phase === "finale" || phase === "done") {
      allPicks.forEach((p) => map[p.groupIdx].push(p));
    }
    return map;
  }, [allPicks, currentPickIdx, subPhase, phase, groups]);

  // Crests still floating inside central ball (not yet drawn)
  const pendingPicks = useMemo(() => {
    if (phase === "picks") {
      return allPicks.slice(currentPickIdx + (subPhase === "settle" ? 1 : 0));
    }
    if (phase === "intro" || phase === "setup") return allPicks;
    return [];
  }, [allPicks, currentPickIdx, subPhase, phase]);

  const currentPick = phase === "picks" ? allPicks[currentPickIdx] : null;

  return (
    <>
      <color attach="background" args={["#050714"]} />
      <fog attach="fog" args={["#050714", 12, 28]} />

      {/* Lighting */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} castShadow color={"#9bc8ff"} />
      <directionalLight position={[-6, 8, -3]} intensity={0.6} color={"#ff6b9b"} />
      <pointLight position={[0, 6, 3]} intensity={2} color={"#3b82f6"} distance={20} />

      <Environment preset="night" />

      {/* Floor with neon ring */}
      <Floor />

      {/* Hex glass pots in arc */}
      {potPositions.map((pos, gi) => (
        <HexPot
          key={gi}
          position={pos}
          label={groups[gi]?.name ?? ""}
          settledTeams={settledByPot[gi] ?? []}
          highlight={currentPick?.groupIdx === gi && (subPhase === "fly" || subPhase === "settle")}
        />
      ))}

      {/* Central glass ball with floating crests */}
      <CentralBall
        pendingPicks={pendingPicks}
        currentPick={currentPick}
        subPhase={subPhase}
        pickSub={pickSub}
      />

      {/* Flying crest from ball to its pot */}
      {currentPick && subPhase === "fly" && (
        <FlyingCrest
          pick={currentPick}
          targetPos={potPositions[currentPick.groupIdx]}
          flyProgress={(pickSub - PICK_LIFT_MS - PICK_REVEAL_MS) / PICK_FLY_MS}
        />
      )}

      <EffectComposer>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.2} luminanceSmoothing={0.4} />
      </EffectComposer>
    </>
  );
}

/* ============================ FLOOR ============================ */

function Floor() {
  return (
    <group>
      {/* Large dark floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0f1f" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Center neon ring (bloom-friendly emissive) */}
      <NeonRing radius={2.4} thickness={0.06} color="#3b82f6" />
      <NeonRing radius={2.9} thickness={0.04} color="#ef4444" />
      <NeonRing radius={3.5} thickness={0.03} color="#3b82f6" />
    </group>
  );
}

function NeonRing({ radius, thickness, color }: { radius: number; thickness: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <ringGeometry args={[radius, radius + thickness, 96]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

/* ============================ HEX POT ============================ */

function HexPot({
  position,
  label,
  settledTeams,
  highlight,
}: {
  position: [number, number, number];
  label: string;
  settledTeams: Pick[];
  highlight: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // Subtle hover bob + slow rotation
    groupRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.6 + position[0]) * 0.08;
    groupRef.current.rotation.y += 0.003;
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Hex glass cylinder (6 segments = hexagonal) */}
      <mesh castShadow>
        <cylinderGeometry args={[0.9, 0.9, 1.4, 6, 1, false]} />
        <MeshTransmissionMaterial
          backside
          samples={6}
          resolution={256}
          transmission={0.95}
          roughness={0.05}
          thickness={0.35}
          ior={1.3}
          chromaticAberration={0.04}
          anisotropy={0.3}
          distortion={0.1}
          distortionScale={0.4}
          temporalDistortion={0.1}
          color={highlight ? "#7dd3fc" : "#cfe6ff"}
          attenuationColor="#a5c8ff"
          attenuationDistance={2}
        />
      </mesh>

      {/* Glow base when receiving */}
      {highlight && (
        <mesh position={[0, -0.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 1.1, 32]} />
          <meshBasicMaterial color="#60a5fa" toneMapped={false} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Label above pot */}
      <Text
        position={[0, 1.05, 0]}
        fontSize={0.22}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#000"
      >
        {label.toUpperCase()}
      </Text>

      {/* Settled crests inside pot (vertical stack) */}
      {settledTeams.map((p, i) => {
        const y = -0.5 + i * 0.18;
        return (
          <CrestPlane
            key={p.team.id}
            team={p.team}
            position={[0, y, 0.4]}
            size={0.32}
            rotation={[0, 0, 0]}
          />
        );
      })}
    </group>
  );
}

/* ============================ CENTRAL BALL ============================ */

function CentralBall({
  pendingPicks,
  currentPick,
  subPhase,
  pickSub,
}: {
  pendingPicks: Pick[];
  currentPick: Pick | null;
  subPhase: "lift" | "reveal" | "fly" | "settle";
  pickSub: number;
}) {
  const ballRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ballRef.current) return;
    ballRef.current.rotation.y = clock.elapsedTime * 0.15;
  });

  const ballPos: [number, number, number] = [0, 1.6, 0];

  // While "lift" sub-phase, the current pick crest rises out of the top of the ball.
  // While "reveal", it hovers above the ball, large and rotating. While "fly", we hand
  // it off to FlyingCrest (rendered by Scene). Pending crests inside the ball keep
  // floating until their turn comes.

  return (
    <group position={ballPos}>
      {/* Outer ball — glass */}
      <mesh>
        <sphereGeometry args={[1.1, 64, 64]} />
        <MeshTransmissionMaterial
          backside
          samples={8}
          resolution={512}
          transmission={1}
          roughness={0.0}
          thickness={0.5}
          ior={1.4}
          chromaticAberration={0.06}
          anisotropy={0.3}
          color="#e0f2fe"
          attenuationColor="#bfdbfe"
          attenuationDistance={1}
        />
      </mesh>

      {/* Inner soft glow */}
      <pointLight position={[0, 0, 0]} intensity={2} color="#60a5fa" distance={3} />

      {/* Floating crests inside the ball */}
      <group ref={ballRef}>
        {pendingPicks.slice(0, 18).map((p, i) => (
          <FloatingCrest key={p.team.id} team={p.team} index={i} total={Math.min(pendingPicks.length, 18)} />
        ))}
      </group>

      {/* Rising / hovering current pick (lift + reveal) */}
      {currentPick && (subPhase === "lift" || subPhase === "reveal") && (
        <RisingCrest pick={currentPick} subPhase={subPhase} pickSub={pickSub} />
      )}
    </group>
  );
}

function FloatingCrest({ team, index, total }: { team: DrawTeam; index: number; total: number }) {
  // Place each crest at a random-ish point inside the ball (deterministic per index)
  const seed = useMemo(() => hashStr(team.id), [team.id]);
  const angle = (index / total) * Math.PI * 2 + seed * 0.13;
  const radius = 0.4 + (seed % 30) / 80;
  const y = ((seed % 70) - 35) / 60;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.3}>
      <CrestPlane team={team} position={[x, y, z]} size={0.32} />
    </Float>
  );
}

function RisingCrest({ pick, subPhase, pickSub }: { pick: Pick; subPhase: "lift" | "reveal"; pickSub: number }) {
  // Lift: rises from inside ball to just above it.
  // Reveal: hovers, rotating slowly, scaled larger.
  const liftT = subPhase === "lift" ? Math.min(1, pickSub / PICK_LIFT_MS) : 1;
  const eased = easeOutCubic(liftT);

  const y = THREE.MathUtils.lerp(0, 1.6, eased);
  const scale = THREE.MathUtils.lerp(0.6, 1.2, eased);

  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += dt * 1.4;
  });

  return (
    <group ref={groupRef} position={[0, y, 0]} scale={scale}>
      <CrestPlane team={pick.team} position={[0, 0, 0]} size={0.6} />
      <pointLight position={[0, 0, 0.5]} intensity={1.5} color="#a5b4fc" distance={2} />
    </group>
  );
}

/* ============================ FLYING CREST ============================ */

function FlyingCrest({
  pick,
  targetPos,
  flyProgress,
}: {
  pick: Pick;
  targetPos: [number, number, number];
  flyProgress: number;
}) {
  const t = Math.max(0, Math.min(1, flyProgress));
  const eased = easeInOutCubic(t);

  // Cubic Bezier-ish arc: lift up then down
  const start: [number, number, number] = [0, 3.2, 0]; // top of ball
  const peakY = Math.max(start[1], targetPos[1] + 1.8) + 1.2;
  const x = THREE.MathUtils.lerp(start[0], targetPos[0], eased);
  const z = THREE.MathUtils.lerp(start[2], targetPos[2], eased);
  // Parabolic Y
  const y = THREE.MathUtils.lerp(start[1], targetPos[1] + 0.1, eased) + Math.sin(eased * Math.PI) * (peakY - start[1]) * 0.4;

  const scale = THREE.MathUtils.lerp(1.2, 0.5, eased);

  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += dt * 4;
  });

  return (
    <group ref={groupRef} position={[x, y, z]} scale={scale}>
      <CrestPlane team={pick.team} position={[0, 0, 0]} size={0.55} />
      <pointLight position={[0, 0, 0.5]} intensity={1} color="#fbbf24" distance={2} />
    </group>
  );
}

/* ============================ CREST PLANE ============================ */

function CrestPlane({
  team,
  position,
  rotation,
  size = 0.4,
}: {
  team: DrawTeam;
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: number;
}) {
  const texture = useMemo(() => makeCrestTexture(team), [team.id, team.name, team.short_name, team.primary_color, team.secondary_color]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        map={texture}
        transparent
        emissive="#ffffff"
        emissiveMap={texture}
        emissiveIntensity={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ============================ HELPERS ============================ */

function arcPositions(n: number, radius: number, height: number, startAngle: number, endAngle: number): [number, number, number][] {
  if (n <= 0) return [];
  if (n === 1) {
    const a = (startAngle + endAngle) / 2;
    return [[Math.sin(a) * radius, height, -Math.cos(a) * radius]];
  }
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = THREE.MathUtils.lerp(startAngle, endAngle, t);
    out.push([Math.sin(a) * radius, height, -Math.cos(a) * radius * 0.6 - 0.5]);
  }
  return out;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initialsFor(name: string, shortName?: string | null) {
  if (shortName && shortName.trim()) return shortName.trim().slice(0, 3).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function makeCrestTexture(team: DrawTeam): THREE.Texture {
  const size = 256;
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!canvas) return new THREE.Texture();
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const primary = team.primary_color || "#1f2937";
  const secondary = team.secondary_color || "#f3f4f6";
  const initials = initialsFor(team.name, team.short_name);

  // Clear with transparent
  ctx.clearRect(0, 0, size, size);

  // Shield path (mirrors TeamCrest SVG viewBox 0 0 64 64)
  const k = size / 64;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(8 * k, 6 * k);
  ctx.lineTo(56 * k, 6 * k);
  ctx.lineTo(56 * k, 36 * k);
  ctx.quadraticCurveTo(56 * k, 50 * k, 32 * k, 60 * k);
  ctx.quadraticCurveTo(8 * k, 50 * k, 8 * k, 36 * k);
  ctx.closePath();
  ctx.clip();

  // Fill primary
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, size, size);

  // Secondary diagonal triangle (top-right to bottom-right to bottom-left)
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(size, size);
  ctx.lineTo(0, size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Border
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.moveTo(8 * k, 6 * k);
  ctx.lineTo(56 * k, 6 * k);
  ctx.lineTo(56 * k, 36 * k);
  ctx.quadraticCurveTo(56 * k, 50 * k, 32 * k, 60 * k);
  ctx.quadraticCurveTo(8 * k, 50 * k, 8 * k, 36 * k);
  ctx.closePath();
  ctx.stroke();

  // Initials text
  const textColor = contrastText(primary);
  ctx.fillStyle = textColor;
  ctx.font = `700 ${initials.length >= 3 ? 76 : 96}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 3;
  ctx.strokeText(initials, size / 2, size / 2 + 8);
  ctx.fillText(initials, size / 2, size / 2 + 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function contrastText(hex: string): string {
  return luminance(hex) > 0.6 ? "#1f2937" : "#ffffff";
}
