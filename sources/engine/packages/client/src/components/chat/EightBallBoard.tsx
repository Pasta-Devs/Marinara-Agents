// ──────────────────────────────────────────────
// EightBallBoard — live, interactive 8-ball pool table (conversation mode)
// ──────────────────────────────────────────────
// A real React component driven by the eightball-game store (fed by
// turn_game_state_patch SSE + an initial fetch). Renders the table as pure
// inline SVG (no image assets, matching ChessBoard/PokerBoard).
//
// v2 (physics rework): the human AIMS AND SHOOTS instead of picking from the
// bot candidate menu. Pointer-drag on the table sets the aim direction from
// the cue ball, a vertical power slider sets shot strength, SHOOT submits
// `{kind:"aimed"}`. Ball-in-hand is placed by hand (`{kind:"place"}`), and
// every shot — yours or the bot's — is animated from the server-simulated
// `lastShot.frames` (the client NEVER simulates; frames are the transport).
// The old shot-menu UI (tier chips, success %, style toggle) is gone for
// humans; it remains a bot-only mechanism.
//
// Table felt/rail/ball colors are hardcoded — they're physical object colors
// (like ChessBoard's square tones and PokerBoard's white card faces), not
// theme surfaces.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  BALL_R,
  CUE_ID,
  EIGHT_ID,
  KITCHEN_SPOT,
  POCKETS,
  STRIPE_IDS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  type EightBallLastShot,
  type EightBallPublicBall,
  type Point,
} from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { useEightBallGameStore } from "../../stores/eightball-game.store";
import { useEightBallMove, useEightBallState, useResignEightBall } from "../../hooks/use-eightball";

interface Props {
  chatId: string;
}

// ── table + ball rendering constants (viewBox units, NOT the physical inches
// the engine reasons in — the physical geometry lives in `balls[].x/y`) ─────
const RAIL = 4;
const VIEW_W = TABLE_WIDTH + RAIL * 2;
const VIEW_H = TABLE_HEIGHT + RAIL * 2;
// The true physical ball radius (1.125" of a 100"-wide table) renders as a
// barely-visible speck at chat-card widths, so the glyph is drawn larger than
// scale for legibility — a deliberate visual-only liberty, not a geometry
// change (aim-line clipping and placement validation still use the real
// BALL_R coordinates the engine will judge the move by).
const BALL_VISUAL_R = 2.1;
const POCKET_VISUAL_R = 2.6;

const FELT_COLOR = "#0b6e3f";
const FELT_SHADOW = "#095c34";
const RAIL_COLOR = "#5a3820";
const POCKET_COLOR = "#111318";

const STRIPE_SET = new Set<number>(STRIPE_IDS);

// Standard bar-table ball colors, id 1-7 solids / 9-15 the same 7 colors striped.
const BALL_COLOR: Record<number, string> = {
  1: "#f2c230",
  2: "#2159c9",
  3: "#d42a2a",
  4: "#6a2e93",
  5: "#e8720c",
  6: "#1f7a3d",
  7: "#7a2323",
  9: "#f2c230",
  10: "#2159c9",
  11: "#d42a2a",
  12: "#6a2e93",
  13: "#e8720c",
  14: "#1f7a3d",
  15: "#7a2323",
};

// ── aiming defaults ─────────────────────────────────────────────────────────
const DEFAULT_POWER_PCT = 55;
/** Length (table units) of the object-ball deflection tick on the aim preview. */
const DEFLECTION_TICK_LEN = 7;
/** Seconds a potted ball takes to shrink+fade after its capture frame. */
const POT_FADE_S = 0.3;

// ── pure display-geometry helpers (NOT simulation — a cheap ray test that
// clips the aim line at the first obstruction, mirroring how physics.ts's
// real CCD would first make contact, purely for preview rendering) ──────────

type SimFrame = EightBallLastShot["frames"][number];

interface AimPreview {
  /** Aim-line endpoint (cue-center position at first contact, or rail clip). */
  end: Point;
  /** Ghost-ball outline center (cue-center at first ball contact); null when
   * the line runs to a rail unobstructed. */
  ghost: Point | null;
  /** Short tick from the contacted ball along the center-line departure direction. */
  tick: { from: Point; to: Point } | null;
}

/** Ray-circle (radius 2·BALL_R, the ghost-ball contact distance) against every
 * on-table object ball + ray-rect against the cushion inset box, take the
 * nearest hit. Display-only geometry in real table coordinates. */
function computeAimPreview(cue: Point, angleDeg: number, others: ReadonlyArray<Point>): AimPreview {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  // Rail clip: how far the cue CENTER can travel before the cushion inset box.
  let tRail = Infinity;
  if (dx > 1e-9) tRail = Math.min(tRail, (TABLE_WIDTH - BALL_R - cue.x) / dx);
  else if (dx < -1e-9) tRail = Math.min(tRail, (BALL_R - cue.x) / dx);
  if (dy > 1e-9) tRail = Math.min(tRail, (TABLE_HEIGHT - BALL_R - cue.y) / dy);
  else if (dy < -1e-9) tRail = Math.min(tRail, (BALL_R - cue.y) / dy);
  if (!Number.isFinite(tRail) || tRail < 0) tRail = 0;

  const contactDist = 2 * BALL_R;
  let tBall = Infinity;
  let hitBall: Point | null = null;
  for (const b of others) {
    const ox = b.x - cue.x;
    const oy = b.y - cue.y;
    const proj = ox * dx + oy * dy; // along-ray distance to closest approach
    if (proj <= 0) continue;
    const discr = contactDist * contactDist - (ox * ox + oy * oy - proj * proj);
    if (discr < 0) continue;
    const t = proj - Math.sqrt(discr);
    if (t > 1e-6 && t < tBall) {
      tBall = t;
      hitBall = b;
    }
  }

  if (hitBall && tBall <= tRail) {
    const ghost = { x: cue.x + dx * tBall, y: cue.y + dy * tBall };
    const ndx = hitBall.x - ghost.x;
    const ndy = hitBall.y - ghost.y;
    const len = Math.hypot(ndx, ndy) || 1;
    return {
      end: ghost,
      ghost,
      tick: {
        from: { x: hitBall.x, y: hitBall.y },
        to: {
          x: hitBall.x + (ndx / len) * DEFLECTION_TICK_LEN,
          y: hitBall.y + (ndy / len) * DEFLECTION_TICK_LEN,
        },
      },
    };
  }
  return { end: { x: cue.x + dx * tRail, y: cue.y + dy * tRail }, ghost: null, tick: null };
}

/** Client-side mirror of the engine's `isValidCuePlacement` (engine.ts) for
 * instant red-tint feedback — the SERVER stays authoritative; an invalid
 * placement that slips through is rejected there with a toast. */
function isValidCuePlacement(
  p: Point,
  onTableBalls: ReadonlyArray<Point>,
  zone: "kitchen" | "anywhere",
): boolean {
  if (p.x < BALL_R || p.x > TABLE_WIDTH - BALL_R || p.y < BALL_R || p.y > TABLE_HEIGHT - BALL_R) return false;
  for (const b of onTableBalls) {
    if (Math.hypot(p.x - b.x, p.y - b.y) < 2 * BALL_R + 0.05) return false;
  }
  for (const pocket of Object.values(POCKETS)) {
    if (Math.hypot(p.x - pocket.pos.x, p.y - pocket.pos.y) < pocket.captureRadius + BALL_R) return false;
  }
  if (zone === "kitchen" && p.x > KITCHEN_SPOT.x) return false;
  return true;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── shot-animation keyframe tracks (built once per shot from lastShot.frames) ─

interface BallTrack {
  t: number[];
  x: number[];
  y: number[];
  potted: boolean;
}

interface AnimatedBall {
  id: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

function buildTracks(frames: readonly SimFrame[], pottedIds: ReadonlySet<number>): Map<number, BallTrack> {
  const tracks = new Map<number, BallTrack>();
  for (const frame of frames) {
    for (const b of frame.balls) {
      let track = tracks.get(b.id);
      if (!track) {
        track = { t: [], x: [], y: [], potted: pottedIds.has(b.id) };
        tracks.set(b.id, track);
      }
      track.t.push(frame.t);
      track.x.push(b.x);
      track.y.push(b.y);
    }
  }
  return tracks;
}

/** Linear interpolation between a ball's keyframes at sim-time `t`. Frames
 * omit balls that haven't moved, so "before the first keyframe" holds at the
 * first keyframe position (for a never-moving ball that IS its rest spot —
 * the final frame always carries every on-table ball). A potted ball past its
 * capture frame shrinks+fades over POT_FADE_S, then disappears. */
function sampleTracks(tracks: ReadonlyMap<number, BallTrack>, t: number): AnimatedBall[] {
  const out: AnimatedBall[] = [];
  for (const [id, track] of tracks) {
    const n = track.t.length;
    const lastT = track.t[n - 1]!;
    if (t >= lastT) {
      if (track.potted) {
        const fade = (t - lastT) / POT_FADE_S;
        if (fade >= 1) continue;
        out.push({ id, x: track.x[n - 1]!, y: track.y[n - 1]!, scale: 1 - fade, opacity: 1 - fade });
      } else {
        out.push({ id, x: track.x[n - 1]!, y: track.y[n - 1]!, scale: 1, opacity: 1 });
      }
      continue;
    }
    if (t <= track.t[0]!) {
      out.push({ id, x: track.x[0]!, y: track.y[0]!, scale: 1, opacity: 1 });
      continue;
    }
    let i = 1;
    while (track.t[i]! < t) i += 1;
    const t0 = track.t[i - 1]!;
    const t1 = track.t[i]!;
    const a = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
    out.push({
      id,
      x: track.x[i - 1]! + (track.x[i]! - track.x[i - 1]!) * a,
      y: track.y[i - 1]! + (track.y[i]! - track.y[i - 1]!) * a,
      scale: 1,
      opacity: 1,
    });
  }
  // Keep the idle-render z-order convention: the 8 draws on top.
  out.sort((a, b) => (a.id === EIGHT_ID ? 1 : b.id === EIGHT_ID ? -1 : a.id - b.id));
  return out;
}

// ── ball glyph (reused at full size on the table and shrunk in the trays) ──

function PoolBall({ id, cx, cy, r = BALL_VISUAL_R }: { id: number; cx: number; cy: number; r?: number }) {
  if (id === CUE_ID) {
    return <circle cx={cx} cy={cy} r={r} fill="#f7f6f0" stroke="#b6b2a6" strokeWidth={r * 0.08} />;
  }
  const color = BALL_COLOR[id] ?? "#161618";
  const stripe = STRIPE_SET.has(id);
  const clipId = `eb-clip-${id}-${cx}-${cy}`;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={stripe ? "#f7f6f0" : color} />
      {stripe && (
        <rect
          x={cx - r}
          y={cy - r * 0.52}
          width={r * 2}
          height={r * 1.04}
          fill={color}
          clipPath={`url(#${clipId})`}
        />
      )}
      <circle cx={cx} cy={cy} r={r * 0.42} fill="#f7f6f0" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={r * 0.62}
        fontWeight={700}
        fill="#161618"
      >
        {id}
      </text>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth={r * 0.06} />
    </g>
  );
}

function TrayBall({ id }: { id: number }) {
  return (
    <svg viewBox="0 0 8 8" className="h-4 w-4 shrink-0" role="img" aria-label={`ball ${id}`}>
      <PoolBall id={id} cx={4} cy={4} r={3.5} />
    </svg>
  );
}

// ── vertical power slider (custom pointer-driven — a rotated <input type=range>
// is unreliable across mobile browsers, and this stays fully theme-styled) ──

function PowerSlider({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const setFromClientY = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return;
    const frac = 1 - (clientY - rect.top) / rect.height;
    onChange(Math.round(Math.max(0, Math.min(1, frac)) * 100));
  };
  return (
    <div className="flex select-none flex-col items-center gap-1">
      <span className="text-[0.6rem] font-semibold tabular-nums text-[var(--muted-foreground)]">{value}%</span>
      <div
        ref={trackRef}
        role="slider"
        aria-label="Shot power"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ArrowUp" || e.key === "ArrowRight") {
            e.preventDefault();
            onChange(Math.min(100, value + 5));
          } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
            e.preventDefault();
            onChange(Math.max(0, value - 5));
          }
        }}
        onPointerDown={(e) => {
          if (disabled) return;
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromClientY(e.clientY);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current && !disabled) setFromClientY(e.clientY);
        }}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        className={`relative w-5 min-h-16 flex-1 touch-none overflow-hidden rounded-full border border-[var(--border)] bg-[var(--muted)]/40 ${
          disabled ? "opacity-40" : "cursor-pointer"
        }`}
      >
        <div className="absolute inset-x-0 bottom-0 bg-[var(--primary)]" style={{ height: `${value}%` }} />
      </div>
      <span className="text-[0.6rem] text-[var(--muted-foreground)]">PWR</span>
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export function EightBallBoard({ chatId }: Props) {
  const current = useEightBallGameStore((s) => s.current);
  const streaming = useChatStore((s) => s.isStreaming);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreaming = streaming && streamingChatId === chatId;
  const move = useEightBallMove(chatId);
  const resign = useResignEightBall(chatId);

  // Hydrate the table on mount / chat switch (no-op if no active game).
  const active = !!current && current.chatId === chatId;
  useEightBallState(active ? null : chatId);

  const view = active ? current : null;
  const disabled = isStreaming || move.isPending || resign.isPending;
  const isMyTurn = !!view && view.status === "active" && view.currentSeatId === view.yourSeatId;

  // ── aiming / placement local state ────────────────────────────────────────
  const [aimAngleDeg, setAimAngleDeg] = useState<number | null>(null);
  const [power, setPower] = useState(DEFAULT_POWER_PCT);
  const [placePos, setPlacePos] = useState<Point | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const aimDragRef = useRef(false);

  useEffect(() => {
    setAimAngleDeg(null);
    setPlacePos(null);
    aimDragRef.current = false;
  }, [chatId, view?.rackNumber, view?.currentSeatId]);

  // ── shot animation (rAF over lastShot.frames, keyed on shotCounter) ──────
  // `lastAnimatedShotCounter` lives in the store (survives board remounts);
  // it's read via getState() inside the effect — subscribing would make the
  // completion-time markShotAnimated() re-trigger this very effect.
  const [animBalls, setAnimBalls] = useState<AnimatedBall[] | null>(null);
  const shotCounter = view?.shotCounter;

  useEffect(() => {
    if (shotCounter === undefined) return;
    const store = useEightBallGameStore.getState();
    const snap = store.current;
    if (!snap || snap.chatId !== chatId || snap.shotCounter !== shotCounter) return;
    if (shotCounter === store.lastAnimatedShotCounter) return;
    const lastShot = snap.lastShot;
    const reducedMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!lastShot || lastShot.frames.length === 0 || document.hidden || reducedMotion) {
      store.markShotAnimated(shotCounter); // instant snap — idle render already shows final positions
      return;
    }
    const pottedIds = new Set<number>(lastShot.potted.map((p) => p.ballId));
    if (lastShot.cueScratched) pottedIds.add(CUE_ID);
    const tracks = buildTracks(lastShot.frames, pottedIds);
    const duration = lastShot.frames[lastShot.frames.length - 1]!.t + (pottedIds.size > 0 ? POT_FADE_S : 0);
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / 1000;
      if (t >= duration) {
        setAnimBalls(null); // snap to the view's real (final) positions
        useEightBallGameStore.getState().markShotAnimated(shotCounter);
        return;
      }
      setAnimBalls(sampleTracks(tracks, t));
      raf = requestAnimationFrame(step);
    };
    setAnimBalls(sampleTracks(tracks, 0));
    raf = requestAnimationFrame(step);
    return () => {
      // A NEW shotCounter arriving mid-animation lands here: cancel, drop the
      // animation overlay (brief snap), and let the effect re-run animate the
      // new shot's frames from the top.
      cancelAnimationFrame(raf);
      setAnimBalls(null);
    };
  }, [chatId, shotCounter]);

  const isAnimating = animBalls !== null;

  if (!view) return null;

  const onTable = view.balls.filter((b) => !b.pocketed);
  const pocketedBalls = view.balls.filter((b) => b.pocketed).sort((a, b) => a.id - b.id);
  const cueBall = onTable.find((b) => b.id === CUE_ID) ?? null;
  const objectBallsOnTable = onTable.filter((b) => b.id !== CUE_ID);

  const you = view.seats.find((s) => s.seatId === view.yourSeatId) ?? null;
  const opponent = view.seats.find((s) => s.seatId !== view.yourSeatId) ?? null;
  const currentSeat = view.seats.find((s) => s.seatId === view.currentSeatId) ?? null;
  const winner = view.winnerSeatId ? view.seats.find((s) => s.seatId === view.winnerSeatId) : null;
  const ballInHandForYou = view.ballInHandFor === view.yourSeatId;
  const ballInHandForOpponent = !!view.ballInHandFor && view.ballInHandFor !== view.yourSeatId;

  const busy = disabled || isAnimating;
  const canAim = isMyTurn && !view.awaitingPlacement && !!cueBall && !busy;
  const canPlace = isMyTurn && view.awaitingPlacement && !busy;
  const placementZone: "kitchen" | "anywhere" = view.placementZone ?? "anywhere";
  const showAimControls = isMyTurn && !view.awaitingPlacement && !!cueBall;
  const placeValid = !!placePos && isValidCuePlacement(placePos, objectBallsOnTable, placementZone);

  const aimPreview =
    canAim && aimAngleDeg !== null && cueBall ? computeAimPreview(cueBall, aimAngleDeg, objectBallsOnTable) : null;

  // ── pointer plumbing (pointer events → touch + mouse both work) ──────────

  const toTablePoint = (e: React.PointerEvent<SVGSVGElement>): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIEW_W - RAIL,
      y: ((e.clientY - rect.top) / rect.height) * VIEW_H - RAIL,
    };
  };

  const updateAimFromPoint = (p: Point | null, cue: EightBallPublicBall) => {
    if (!p) return;
    const dx = p.x - cue.x;
    const dy = p.y - cue.y;
    if (Math.hypot(dx, dy) < 0.5) return; // too close to the cue to define a direction
    setAimAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (canPlace) {
      setPlacePos(toTablePoint(e));
      return;
    }
    if (!canAim || !cueBall) return;
    aimDragRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateAimFromPoint(toTablePoint(e), cueBall);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (canPlace) {
      setPlacePos(toTablePoint(e));
      return;
    }
    if (aimDragRef.current && canAim && cueBall) updateAimFromPoint(toTablePoint(e), cueBall);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    aimDragRef.current = false;
    if (!canPlace) return;
    const p = toTablePoint(e);
    if (p && isValidCuePlacement(p, objectBallsOnTable, placementZone)) {
      move.mutate({ move: { kind: "place", x: round2(p.x), y: round2(p.y) } });
      setPlacePos(null);
    }
  };

  const handlePointerLeave = () => {
    if (canPlace) setPlacePos(null);
  };

  // A cancelled gesture (browser scroll/zoom takeover) must ABORT, never
  // submit — only a deliberate pointer-up places the cue.
  const handlePointerCancel = () => {
    aimDragRef.current = false;
    if (canPlace) setPlacePos(null);
  };

  const shoot = () => {
    if (!canAim || aimAngleDeg === null) return;
    move.mutate({
      move: { kind: "aimed", angleDeg: round2(aimAngleDeg), power: Math.min(1, Math.max(0, round2(power / 100))) },
    });
  };

  const nextRack = () => {
    if (busy) return;
    move.mutate({ move: { kind: "next_rack" } });
  };

  const groupLabel = (g: string | null) => (g === "solids" ? "SOLIDS" : g === "stripes" ? "STRIPES" : "open table");

  const seatChip = (seat: typeof you) =>
    seat && (
      <div
        className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 ${
          seat.isCurrent ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/40" : "ring-1 ring-[var(--border)]"
        }`}
      >
        <div className="leading-tight">
          <div className="flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
            {seat.displayName}
            {seat.seatId === view.yourSeatId && (
              <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]">(you)</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[0.65rem] text-[var(--muted-foreground)]">
            <span>{groupLabel(seat.group)}</span>
            <span>· {seat.racksWon} rack{seat.racksWon === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>
    );

  const interactive = canAim || canPlace;

  return (
    <div className="mx-2 mb-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm">
      {/* Header: seats + rack score + status + resign */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="font-semibold text-[var(--foreground)]">
          8-Ball — Race to {view.raceTo} · Rack {view.rackNumber}
        </span>
        {seatChip(opponent)}
        {seatChip(you)}
        <div className="ml-auto flex items-center gap-2">
          {view.status === "active" && (
            <span className={isMyTurn && !isAnimating ? "font-semibold text-[var(--primary)] animate-pulse" : ""}>
              {isAnimating ? "…" : isMyTurn ? "Your turn" : `${currentSeat?.displayName ?? "…"} is thinking…`}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (view.status === "finished" || window.confirm("End this pool game?")) resign.mutate();
            }}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] active:scale-90"
            title={view.status === "finished" ? "Close" : "End game"}
            aria-label={view.status === "finished" ? "Close game" : "End game"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Finished banner */}
      {view.status === "finished" && (
        <div className="mb-2 rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-center text-sm font-semibold text-[var(--primary)]">
          {winner ? `🏆 ${winner.displayName} wins the match!` : "Game over"}
        </div>
      )}

      {/* Ball-in-hand / on-the-8 banners */}
      {ballInHandForYou && view.status === "active" && (
        <div className="mb-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-center text-xs font-semibold text-amber-600">
          {view.awaitingPlacement
            ? placementZone === "kitchen"
              ? "Ball in hand — tap the table behind the head string to place the cue ball."
              : "Ball in hand — tap anywhere on the table to place the cue ball."
            : "Ball in hand — cue placed, take your shot."}
        </div>
      )}
      {ballInHandForOpponent && view.status === "active" && (
        <div className="mb-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-center text-xs font-semibold text-amber-600">
          {currentSeat?.displayName ?? "Opponent"} has ball in hand.
        </div>
      )}
      {view.onTheEight && view.status === "active" && (
        <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-center text-xs font-semibold text-red-600">
          {isMyTurn ? "You're" : `${currentSeat?.displayName ?? "They're"} is`} on the 8.
        </div>
      )}

      {/* Table + power slider */}
      <div className="mx-auto flex w-full max-w-md items-stretch gap-1.5">
        <div className="min-w-0 flex-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className={`h-auto w-full ${interactive ? "cursor-crosshair touch-none" : ""}`}
            role="img"
            aria-label="8-ball pool table"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerLeave}
          >
            <rect x={0} y={0} width={VIEW_W} height={VIEW_H} rx={2} fill={RAIL_COLOR} />
            <rect x={RAIL} y={RAIL} width={TABLE_WIDTH} height={TABLE_HEIGHT} fill={FELT_COLOR} />
            <rect
              x={RAIL}
              y={RAIL}
              width={TABLE_WIDTH}
              height={TABLE_HEIGHT}
              fill="none"
              stroke={FELT_SHADOW}
              strokeWidth={0.4}
            />
            {Object.values(POCKETS).map((p) => (
              <circle key={p.id} cx={p.pos.x + RAIL} cy={p.pos.y + RAIL} r={POCKET_VISUAL_R} fill={POCKET_COLOR} />
            ))}

            {/* Kitchen overlay while a kitchen-restricted placement is pending */}
            {canPlace && placementZone === "kitchen" && (
              <g pointerEvents="none">
                <rect
                  x={RAIL}
                  y={RAIL}
                  width={KITCHEN_SPOT.x}
                  height={TABLE_HEIGHT}
                  fill="#ffffff"
                  opacity={0.1}
                />
                <line
                  x1={KITCHEN_SPOT.x + RAIL}
                  y1={RAIL}
                  x2={KITCHEN_SPOT.x + RAIL}
                  y2={TABLE_HEIGHT + RAIL}
                  stroke="#ffffff"
                  strokeWidth={0.3}
                  strokeDasharray="1.4,1"
                  opacity={0.55}
                />
              </g>
            )}

            {/* Aim preview: line clipped at first obstruction, ghost ball at the
                predicted contact, deflection tick along the center line */}
            {aimPreview && cueBall && (
              <g pointerEvents="none">
                <line
                  x1={cueBall.x + RAIL}
                  y1={cueBall.y + RAIL}
                  x2={aimPreview.end.x + RAIL}
                  y2={aimPreview.end.y + RAIL}
                  stroke="#ffe066"
                  strokeWidth={0.35}
                  strokeDasharray="1.2,0.8"
                />
                {aimPreview.ghost && (
                  <circle
                    cx={aimPreview.ghost.x + RAIL}
                    cy={aimPreview.ghost.y + RAIL}
                    r={BALL_VISUAL_R}
                    fill="none"
                    stroke="#f7f6f0"
                    strokeWidth={0.25}
                    strokeDasharray="0.9,0.6"
                    opacity={0.9}
                  />
                )}
                {aimPreview.tick && (
                  <line
                    x1={aimPreview.tick.from.x + RAIL}
                    y1={aimPreview.tick.from.y + RAIL}
                    x2={aimPreview.tick.to.x + RAIL}
                    y2={aimPreview.tick.to.y + RAIL}
                    stroke="#ffffff"
                    strokeWidth={0.3}
                    opacity={0.85}
                  />
                )}
              </g>
            )}

            {/* Balls — during a shot animation, render interpolated frame
                positions (potted balls shrink+fade at capture); idle, render
                straight from the view (cue simply absent while ball-in-hand). */}
            {isAnimating
              ? animBalls!.map((b) => (
                  <g key={b.id} opacity={b.opacity}>
                    <PoolBall id={b.id} cx={b.x + RAIL} cy={b.y + RAIL} r={BALL_VISUAL_R * Math.max(0.05, b.scale)} />
                  </g>
                ))
              : [
                  ...onTable.filter((b) => b.id !== EIGHT_ID),
                  ...onTable.filter((b) => b.id === EIGHT_ID),
                ].map((b) => <PoolBall key={b.id} id={b.id} cx={b.x + RAIL} cy={b.y + RAIL} />)}

            {/* Pulsing cue-ball ghost following the pointer during placement */}
            {canPlace && placePos && (
              <circle
                className="animate-pulse"
                pointerEvents="none"
                cx={placePos.x + RAIL}
                cy={placePos.y + RAIL}
                r={BALL_VISUAL_R}
                fill={placeValid ? "rgba(247,246,240,0.55)" : "rgba(224,53,53,0.5)"}
                stroke={placeValid ? "#f7f6f0" : "#e03535"}
                strokeWidth={0.35}
                strokeDasharray="1,0.7"
              />
            )}
          </svg>
        </div>
        {showAimControls && <PowerSlider value={power} onChange={setPower} disabled={busy} />}
      </div>

      {/* Aim hint + SHOOT */}
      {showAimControls && (
        <div className="mx-auto mt-1.5 flex w-full max-w-md items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[0.65rem] text-[var(--muted-foreground)]">
            {aimAngleDeg === null
              ? "Drag on the table to aim."
              : view.phase === "break"
                ? "Break when ready — adjust aim and power."
                : "Adjust aim and power, then shoot."}
          </span>
          <button
            type="button"
            disabled={busy || aimAngleDeg === null}
            onClick={shoot}
            className="rounded-lg bg-[var(--primary)] px-4 py-1.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-40"
          >
            {view.phase === "break" ? "Break" : "Shoot"}
          </button>
        </div>
      )}

      {/* Pocketed-ball trays */}
      {pocketedBalls.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-3">
          {(["solids", "stripes"] as const).map((group) => {
            const balls = pocketedBalls.filter((b) => (group === "solids" ? b.id < 8 : b.id > 8));
            if (balls.length === 0) return null;
            return (
              <div key={group} className="flex items-center gap-1">
                <span className="text-[0.6rem] font-semibold text-[var(--muted-foreground)]">
                  {group === "solids" ? "Solids" : "Stripes"}
                </span>
                <div className="flex gap-0.5">
                  {balls.map((b) => (
                    <TrayBall key={b.id} id={b.id} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rack over — human paces to the next rack */}
      {view.status === "rack_over" && view.currentSeatId === view.yourSeatId && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--muted)]/25 p-2">
          <span className="text-xs text-[var(--muted-foreground)]">{view.lastAction?.summary ?? "Rack over."}</span>
          <button
            type="button"
            disabled={busy}
            onClick={nextRack}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-40"
          >
            Next rack
          </button>
        </div>
      )}

      {/* Last action ticker + recent log */}
      {view.status !== "finished" && (view.lastAction || view.recentLog.length > 0) && (
        <div className="mt-1.5 space-y-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
          {view.lastAction && (
            <div className="truncate">
              {view.seats.find((s) => s.seatId === view.lastAction!.seatId)?.displayName ?? "—"} {view.lastAction.summary}
            </div>
          )}
          {view.recentLog.length > 0 && (
            <ul className="space-y-0.5">
              {view.recentLog.slice(-4).map((entry, i) => (
                <li key={i} className="truncate opacity-70">
                  {entry.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
