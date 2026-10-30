// ──────────────────────────────────────────────
// Otome Forge: the Claw Machine. Six drops, taking turns with the love interest you picked: steer the claw (it swings
// on its cable), drop it before the timer runs out, and cheer on their turns until they cheat in their own way. Every
// plush won lines the shelf. A round makes no model call and paints no image: the plushies are drawn (a love
// interest's own drawn once in the background, #1954), and the lines are the love interest's own pack written ahead,
// or the catalog's until it exists. Both come with GET /play, never from GET .../lis/:li/lines, which queues a missing
// pack's write (a model call).
// ──────────────────────────────────────────────
// The rules are C/lib/claw-physics.ts (pure, seeded per round). This screen runs them: one requestAnimationFrame loop
// steps the claw and plays each drop's animation by writing CSS custom properties straight onto the glass, and React
// renders only what changes between moments (the prizes, the turn, the meter, a line). Reduced motion resolves every
// drop at once and keeps the claw from swinging. Keyboard: hold ←/→ (or press them for a step), Space or Enter drops
// on your turn and cheers on theirs (hold it to keep cheering), ↓ drops too and C cheers. Sounds go through the
// Engine's audio player (Capability API 1.381) at Settings → Audio's sound-effect volume, silent while Mute everything
// is on; this screen's Sound turns them off too, as it can the buzz on phones that have one.
//
// POST /runs/:run/claw/finish {li, round, first, caught, cheered} pays the round once: the round id is made when the
// round starts, so Try again after a lost answer sends the same round and is never paid twice.
// His lines are voiced as Home's tap lines are (M2b's audio, with the kit's voice picking), while this screen's Sound is
// on; during a rupture they are Home's own cold lines, voiced under Home's ref so one clip serves both screens. Their
// plush is the animal drawn for them (GET /play's `animal`), else their look, cut out once Home has made the cut-out
// (GET /play's `plush`).
// ponytail: his reactions show his base look (or initials); the ceiling is one face for every line, and the upgrade
// path is M2b's painted faces (a win tender, a miss flustered).
// ponytail: this screen's Sound and Vibration toggles last for this screen only (the world's audio settings still apply
// beneath them); the upgrade path is a saved preference beside Settings → Audio.
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { host } from "marinara:host";
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Hand,
  Heart,
  PartyPopper,
  RotateCcw,
  Ruler,
  Snowflake,
  Sparkles,
  Star,
  Ticket,
  Vibrate,
  VibrateOff,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { PlushArt, PlushShelf, usePlushName, withPlush, type PlushPictures } from "../../components/PlushShelf";
import { useOtomeAudio } from "../../hooks/use-otome-audio";
import { runPath, useReducedMotion } from "../../hooks/use-reader";
import { patchRun, runQueryKey } from "../../hooks/use-run";
import { accentOf } from "../../lib/accent";
import { tapLineRef } from "../../lib/audio";
import {
  GEOMETRY,
  cheer as cheerRound,
  clawStyleOf,
  createRound,
  currentPlayer,
  isBonusTurn,
  landDrop,
  landingX,
  nudgeBody,
  planPartnerTurn,
  restingBody,
  retargetPlan,
  steerBody,
  stepBody,
  targetAt,
  type ClawRoundState,
  type ClawStyle,
  type DropOutcome,
  type PartnerPlan,
  type Prize,
} from "../../lib/claw-physics";
import { fallbackTapKeys, pickLine } from "../../lib/tap-mood";
import type { ClawCheat, LinesView, RunLiView } from "../../shared/api-types";
import {
  CHEER_GOAL,
  CLAW_MOVE_SECONDS,
  FREEZE_BONUS_SECONDS,
  liPlushId,
  type ClawFinishInput,
  type ClawFinishResult,
  type ClawPlayer,
  type PlayView,
} from "../../shared/claw";
import { AFFECTION_EARNINGS, STARLIGHT_EARNINGS } from "../../shared/economy";
import type { ClawLineKind } from "../../shared/home";
import { useLineVoice } from "../home/NoteCard";
import { playQueryKey, usePlay, type ActivityScreenProps } from "./DatesHub";

// ── Sound and buzz ──

type Cue = "latch" | "cloth" | "coin" | "cancel";
const SFX: Record<Cue, string> = {
  latch: "sfx:ui:latch",
  cloth: "sfx:ui:inventory-cloth",
  coin: "sfx:ui:coin-pickup",
  cancel: "sfx:ui:menu-cancel",
};
const BUZZ: Record<Cue | "cheer", number | number[]> = {
  latch: 14,
  cloth: 24,
  coin: [30, 50, 60],
  cancel: 40,
  cheer: 8,
};

interface HostAudioPlayer {
  playSfx(tag: string, assets?: unknown): void;
  setVolumes?(volumes: { music: number; sfx: number }): void;
  unlock(): void;
  dispose(): void;
}
interface HostAudio {
  createPlayer(): HostAudioPlayer;
  getAssetManifest?: () => Promise<{ assets?: unknown }>;
}

/** The Engine's audio service, when this Engine has it (Capability API 1.381). */
function hostAudio(): HostAudio | null {
  const services = (host as { services?: { audio?: Partial<HostAudio> } }).services;
  const audio = services?.audio;
  return audio && typeof audio.createPlayer === "function" ? (audio as HostAudio) : null;
}

interface Feedback {
  cue: (cue: Cue) => void;
  buzz: (kind: Cue | "cheer") => void;
}

/**
 * This screen's own player (disposed with it), the asset manifest it plays from, and the optional buzz. A cue plays at
 * the world's sound-effect volume and never while Settings → Audio mutes everything (read as it plays, so a change
 * there applies at once); the Engine's new player would otherwise play at its own default.
 */
function useFeedback(sound: boolean, vibrate: boolean): Feedback {
  const audio = useOtomeAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const player = useRef<HostAudioPlayer | null>(null);
  const assets = useRef<unknown>(null);
  useEffect(() => {
    const audio = hostAudio();
    if (!audio) return;
    let live = true;
    try {
      player.current = audio.createPlayer();
    } catch {
      player.current = null;
    }
    void audio
      .getAssetManifest?.()
      .then((manifest) => {
        if (live) assets.current = manifest?.assets ?? null;
      })
      .catch(() => undefined);
    return () => {
      live = false;
      player.current?.dispose();
      player.current = null;
    };
  }, []);
  const soundRef = useRef(sound);
  const vibrateRef = useRef(vibrate);
  soundRef.current = sound;
  vibrateRef.current = vibrate;
  return useMemo(
    () => ({
      cue: (cue) => {
        const settings = audioRef.current?.audioSettings;
        if (!soundRef.current || settings?.muted || (settings && settings.sfxVolume <= 0)) return;
        try {
          if (settings) player.current?.setVolumes?.({ music: 0, sfx: settings.sfxVolume });
          player.current?.unlock();
          player.current?.playSfx(SFX[cue], assets.current);
        } catch {
          // Sound is optional.
        }
      },
      buzz: (kind) => {
        if (!vibrateRef.current) return;
        try {
          navigator.vibrate?.(BUZZ[kind]);
        } catch {
          // So is the buzz.
        }
      },
    }),
    [],
  );
}

const canVibrate = () => {
  try {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  } catch {
    return false;
  }
};

// ── His lines ──

// The catalog's lines until his own pack exists, as many as a pack holds (SH/home.ts LINE_COUNTS.claw). Written for
// anyone: no pronouns, no question that waits for an answer. Literal keys, so the locale validator sees them.
const FALLBACK_LINES: Record<Exclude<ClawLineKind, "cheat">, readonly string[]> = {
  cheer: [
    "ui.otomeForge.fallback.clawCheer1",
    "ui.otomeForge.fallback.clawCheer2",
    "ui.otomeForge.fallback.clawCheer3",
    "ui.otomeForge.fallback.clawCheer4",
  ],
  win: ["ui.otomeForge.fallback.clawWin1", "ui.otomeForge.fallback.clawWin2", "ui.otomeForge.fallback.clawWin3"],
  miss: ["ui.otomeForge.fallback.clawMiss1", "ui.otomeForge.fallback.clawMiss2", "ui.otomeForge.fallback.clawMiss3"],
  plush: [
    "ui.otomeForge.fallback.clawPlush1",
    "ui.otomeForge.fallback.clawPlush2",
    "ui.otomeForge.fallback.clawPlush3",
  ],
};
const FALLBACK_CHEAT_LINES: Record<ClawCheat, readonly string[]> = {
  steady: ["ui.otomeForge.fallback.clawCheatSteady1", "ui.otomeForge.fallback.clawCheatSteady2"],
  nudge: ["ui.otomeForge.fallback.clawCheatNudge1", "ui.otomeForge.fallback.clawCheatNudge2"],
  extra: ["ui.otomeForge.fallback.clawCheatExtra1", "ui.otomeForge.fallback.clawCheatExtra2"],
  freeze: ["ui.otomeForge.fallback.clawCheatFreeze1", "ui.otomeForge.fallback.clawCheatFreeze2"],
  calculate: ["ui.otomeForge.fallback.clawCheatCalculate1", "ui.otomeForge.fallback.clawCheatCalculate2"],
};

/** What the cheat does, said for the player (not his line). */
const CHEAT_COPY: Record<ClawCheat, { title: string; hint: string; Icon: LucideIcon }> = {
  steady: { title: "ui.otomeForge.claw.cheatSteady", hint: "ui.otomeForge.claw.cheatSteadyHint", Icon: Hand },
  nudge: { title: "ui.otomeForge.claw.cheatNudge", hint: "ui.otomeForge.claw.cheatNudgeHint", Icon: Sparkles },
  extra: { title: "ui.otomeForge.claw.cheatExtra", hint: "ui.otomeForge.claw.cheatExtraHint", Icon: Ticket },
  freeze: { title: "ui.otomeForge.claw.cheatFreeze", hint: "ui.otomeForge.claw.cheatFreezeHint", Icon: Snowflake },
  calculate: { title: "ui.otomeForge.claw.cheatCalculate", hint: "ui.otomeForge.claw.cheatCalculateHint", Icon: Ruler },
};

const FAIL_KEYS: Record<NonNullable<DropOutcome["fail"]>, string> = {
  air: "ui.otomeForge.claw.announceAir",
  graze: "ui.otomeForge.claw.announceGraze",
  slip: "ui.otomeForge.claw.announceSlip",
  rim: "ui.otomeForge.claw.announceRim",
};

const usable = (pool: readonly string[] | undefined) => (pool ?? []).filter((line) => line.trim());

/** His claw and cold lines (GET /play's `lines`). */
type ClawLinePacks = Pick<LinesView, "claw" | "cold">;

/** His pool for `kind`: during a rupture only his cold lines (Home's); his own pack, else the catalog's. */
function linePool(
  t: (key: string) => string,
  lines: ClawLinePacks | null,
  kind: ClawLineKind,
  cheat: ClawCheat,
  rupture: boolean,
): string[] {
  if (rupture) {
    const cold = usable(lines?.cold);
    return cold.length ? cold : fallbackTapKeys("head", "cold").map((key) => t(key));
  }
  const own = usable(lines?.claw?.[kind]);
  if (own.length) return own;
  const keys = kind === "cheat" ? FALLBACK_CHEAT_LINES[cheat] : FALLBACK_LINES[kind];
  return keys.map((key) => t(key));
}

// ── A drop's animation ──

/** The glass is this wide for its height, so a sway in glass widths can be drawn as the cable's angle. */
const GLASS_ASPECT = 0.95;
/** In glass heights: the cable at rest and how much further it runs down, and the claw head's height. */
const CABLE = { rest: 0.1, travel: 0.6, head: 0.13 };
/** A prize's bottom above the floor, in glass heights, at the back (0) and the front (1) of the pile. */
const PRIZE_BASE: Record<0 | 1, number> = { 0: 0.1, 1: 0.035 };
/** How far down the claw goes for a prize at the back of the pile. */
const BACK_DEPTH = 0.89;
const T = { descend: 760, close: 260, lift: 760, carry: 820, release: 360, settle: 200 };
const TIME = {
  banner: 950,
  bannerReduced: 650,
  /** The least a partner's turn lasts, so there is always a fair window to cheer. */
  partnerMin: 3400,
  partnerReduced: 3000,
  cheerEvery: 160,
};

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

interface DropAnim {
  start: number;
  /** Where the claw's tip was when the drop began. */
  from: number;
  outcome: DropOutcome;
  after: ClawRoundState;
  played: Set<string>;
}

interface Pose {
  x: number;
  cable: number;
  open: number;
  /** The prize being held or falling: where it is and how it tilts. */
  prize: { x: number; y: number; rot: number; gone: boolean } | null;
  cues: Array<{ at: number; cue: Cue }>;
  end: number;
}

/** Where everything is `t` ms into a drop. Every drop descends, closes, lifts, and comes home over the chute. */
export function dropPose(anim: Pick<DropAnim, "from" | "outcome">, t: number): Pose {
  const { outcome } = anim;
  const target = outcome.target;
  const depth = target?.row === 0 ? BACK_DEPTH : 1;
  const tClose = T.descend;
  const tLift = tClose + T.close;
  const tCarry = tLift + T.lift;
  const tRelease = tCarry + T.carry;
  const at = (moment: number, from: number, duration: number) => clamp01((moment - from) / duration);
  const lift = (moment: number) => ease(at(moment, tLift, T.lift));
  const carryX = (moment: number) => lerp(outcome.x, GEOMETRY.home, ease(at(moment, tCarry, T.carry)));
  const cable = t < tClose ? ease(at(t, 0, T.descend)) * depth : depth * (1 - lift(t));
  const x = t < tClose ? lerp(anim.from, outcome.x, ease(at(t, 0, T.descend))) : carryX(t);
  const caught = outcome.caught;
  const open =
    t < tClose
      ? 1
      : t < tLift
        ? 1 - at(t, tClose, T.close)
        : caught && t >= tRelease
          ? at(t, tRelease, T.release / 2)
          : 0;
  const cues: Pose["cues"] = [{ at: tClose, cue: "latch" }];
  let end = tCarry + T.carry + T.settle;
  let prize: Pose["prize"] = null;
  if (target) {
    const base = PRIZE_BASE[target.row];
    // The prize hangs a little off-centre in the claw, as far as the claw landed from its middle.
    const held = (moment: number) => ({
      x: carryX(moment) + (target.x - outcome.x) * 0.25,
      y: base + depth * lift(moment) * CABLE.travel,
      rot: Math.sin(moment / 90) * 7,
      gone: false,
    });
    const fall = (start: number, to: number, duration: number) => {
      const from = held(start);
      const q = at(t, start, duration);
      // A drop with a small bounce at the bottom.
      const height = q < 0.75 ? 1 - (q / 0.75) ** 2 : Math.sin(((q - 0.75) / 0.25) * Math.PI) * 0.12;
      return { x: lerp(from.x, to, q), y: base + (from.y - base) * height, rot: (1 - q) * 18, gone: false };
    };
    if (caught) {
      end = tRelease + T.release + T.settle;
      cues.push({ at: tRelease + T.release / 2, cue: "cloth" }, { at: end - 40, cue: "coin" });
      if (t >= tLift && t < tRelease) prize = held(t);
      else if (t >= tRelease) {
        const from = held(tRelease);
        const q = at(t, tRelease, T.release);
        prize = { x: from.x, y: lerp(from.y, -0.32, q * q), rot: q * 40, gone: q >= 1 };
      }
    } else if (outcome.fail === "slip") {
      const tSlip = tLift + T.lift * 0.45;
      cues.push({ at: tSlip, cue: "cancel" });
      if (t >= tLift) prize = t < tSlip ? held(t) : fall(tSlip, outcome.movedTo ?? target.x, 420);
    } else if (outcome.fail === "rim") {
      const tRim = tCarry + T.carry * 0.7;
      cues.push({ at: tRim, cue: "cancel" });
      if (t >= tLift) prize = t < tRim ? held(t) : fall(tRim, outcome.movedTo ?? target.x, 460);
    } else {
      // A graze pushes the prize aside as the claw closes beside it.
      cues.push({ at: tLift, cue: "cancel" });
      if (t >= tClose) {
        const q = ease(at(t, tClose, T.close + 200));
        prize = {
          x: lerp(target.x, outcome.movedTo ?? target.x, q),
          y: base,
          rot: Math.sin(q * Math.PI * 3) * 9,
          gone: false,
        };
      }
    }
  } else {
    cues.push({ at: tLift, cue: "cancel" });
  }
  return { x, cable, open, prize, cues, end };
}

// ── The cabinet (drawn; live in the game, still on the intro) ──

interface CabinetProps {
  title: string;
  /** The still picture on the intro, a little smaller so the choice below it stays in view. */
  preview?: boolean;
  prizes: readonly Prize[];
  leaving?: readonly Prize[];
  /** With the picture their plush wears (withPlush). */
  li: RunLiView & PlushPictures;
  accent: string;
  label: string;
  glassRef?: (element: HTMLDivElement | null) => void;
  prizeRef?: (id: string, element: HTMLElement | null) => void;
  guide?: boolean;
  frost?: boolean;
  shake?: boolean;
  steady?: boolean;
  children?: ReactNode;
  glassHandlers?: {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  };
}

/** The claw's two prongs, each hooking in at its tip. */
const PRONGS = { left: "M19 13 C9 19 7 29 12 39 L18 36", right: "M29 13 C39 19 41 29 36 39 L30 36" } as const;

const placePrize = (prize: Prize) =>
  ({
    "--px": prize.x,
    "--py": PRIZE_BASE[prize.row],
    "--tilt": `${prize.tilt}deg`,
    zIndex: 2 + prize.row,
  }) as CSSProperties;

function Cabinet({
  title,
  preview,
  prizes,
  leaving = [],
  li,
  accent,
  label,
  glassRef,
  prizeRef,
  guide,
  frost,
  shake,
  steady,
  children,
  glassHandlers,
}: CabinetProps) {
  const owner = (prize: Prize) => (prize.id === liPlushId(li.id) ? li : null);
  return (
    <div
      className={preview ? "of-claw-cabinet of-claw-cabinet--preview" : "of-claw-cabinet"}
      data-shake={shake || undefined}
      style={{ "--of-li-accent": accent } as CSSProperties}
    >
      <div className="of-claw-marquee" aria-hidden="true">
        <span className="of-claw-bulbs" />
        <span className="of-claw-marquee-title">{title}</span>
        <span className="of-claw-bulbs" />
      </div>
      <div
        ref={glassRef}
        className="of-claw-glass"
        role="img"
        aria-label={label}
        data-frost={frost || undefined}
        data-steady={steady || undefined}
        style={{ "--cx": GEOMETRY.home, "--cc": 0, "--co": 1, "--ca": "0deg", "--gx": GEOMETRY.home } as CSSProperties}
        {...glassHandlers}
      >
        <div className="of-claw-wall" />
        {guide ? <div className="of-claw-guide" /> : null}
        {prizes.map((prize) => (
          <span
            key={prize.id}
            ref={prizeRef ? (element) => prizeRef(prize.id, element) : undefined}
            className="of-claw-prize"
            style={placePrize(prize)}
          >
            <PlushArt prize={prize.id} li={owner(prize)} />
          </span>
        ))}
        {leaving.map((prize) => (
          <span key={`leaving-${prize.id}`} className="of-claw-prize" data-leaving="" style={placePrize(prize)}>
            <PlushArt prize={prize.id} li={owner(prize)} />
          </span>
        ))}
        <div className="of-claw-chute">
          <Heart size={14} strokeWidth={0} fill="currentColor" aria-hidden="true" />
        </div>
        <div className="of-claw-rail" />
        <div className="of-claw-rig">
          <span className="of-claw-carriage" />
          <span className="of-claw-arm">
            <span className="of-claw-cable" />
            <span className="of-claw-head">
              <svg viewBox="0 0 48 44" className="of-claw-svg" focusable="false" aria-hidden="true">
                {(["left", "right"] as const).map((side) => (
                  <g key={side} className={`of-claw-prong of-claw-prong--${side}`}>
                    <path className="of-claw-prong-edge" d={PRONGS[side]} />
                    <path className="of-claw-prong-face" d={PRONGS[side]} />
                  </g>
                ))}
                <rect x={17} y={12} width={14} height={5.5} rx={2} className="of-claw-collar" />
                <rect x={13} y={1} width={22} height={14} rx={6} className="of-claw-hub" />
                <circle cx={24} cy={7.5} r={2.8} className="of-claw-light" />
              </svg>
            </span>
          </span>
        </div>
        <div className="of-claw-shine" />
        {children}
      </div>
    </div>
  );
}

// ── The round ──

type Stage = "banner" | "aim" | "partner" | "drop" | "over";

interface Ui {
  round: ClawRoundState;
  stage: Stage;
  /** Whole seconds left on the player's timer, or the partner's countdown under reduced motion. */
  seconds: number | null;
  /** Each finished drop: caught or not (the pips). */
  results: boolean[];
  bubble: { id: number; text: string } | null;
  cheat: { id: number; cheat: ClawCheat } | null;
  result: { id: number; outcome: DropOutcome } | null;
  leaving: Prize[];
  shake: boolean;
}

interface Game {
  round: ClawRoundState;
  stage: Stage;
  stageAt: number;
  deadline: number;
  body: ReturnType<typeof restingBody>;
  hold: -1 | 0 | 1;
  holdAt: number;
  plan: PartnerPlan | null;
  script: "think" | "out" | "back" | "settle";
  settleAt: number;
  anim: DropAnim | null;
  lastSecond: number;
  aimed: string | null;
  lastCheer: number;
  lastLine: string | null;
  herTurns: number;
  /** He cheers her on once her claw is hers to move (said then, so his reaction to the drop before stays in view). */
  cheerOnAim: boolean;
  dragging: number | null;
}

interface ClawGameProps {
  /** With the picture their plush wears (withPlush). */
  li: RunLiView & PlushPictures;
  accent: string;
  seed: number;
  first: ClawPlayer;
  cheat: ClawCheat;
  style: ClawStyle;
  lines: ClawLinePacks | null;
  rupture: boolean;
  feedback: Feedback;
  reduced: boolean;
  sound: boolean;
  vibrate: boolean;
  onSound: (on: boolean) => void;
  onVibrate: (on: boolean) => void;
  onDone: (round: ClawRoundState) => void;
}

function ClawGame({
  li,
  accent,
  seed,
  first,
  cheat,
  style,
  lines,
  rupture,
  feedback,
  reduced,
  sound,
  vibrate,
  onSound,
  onVibrate,
  onDone,
}: ClawGameProps) {
  const { t } = useTranslation();
  const plushName = usePlushName();
  const hintId = useId();
  const [ui, setUi] = useState<Ui>(() => ({
    round: createRound({ seed, first, li: li.id, cheat, style }),
    stage: "banner",
    seconds: null,
    results: [],
    bubble: null,
    cheat: null,
    result: null,
    leaving: [],
    shake: false,
  }));
  const [announce, setAnnounce] = useState("");

  // The loop's own copy of the round: it reads it every frame without waiting for a render.
  const game = useRef<Game>({
    round: ui.round,
    stage: "banner",
    stageAt: performance.now(),
    deadline: 0,
    body: restingBody(),
    hold: 0,
    holdAt: 0,
    plan: null,
    script: "think",
    settleAt: 0,
    anim: null,
    lastSecond: -1,
    aimed: null,
    lastCheer: 0,
    lastLine: null,
    herTurns: 0,
    cheerOnAim: false,
    dragging: null,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const glass = useRef<HTMLDivElement | null>(null);
  const prizeEls = useRef(new Map<string, HTMLElement>());
  const actionRef = useRef<HTMLButtonElement>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cheerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineId = useRef(0);
  /** The stage the action button's current pointer press began in. */
  const pressStage = useRef<Stage | null>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tRef = useRef(t);
  tRef.current = t;
  const nameRef = useRef((id: string) => plushName(id, [li]));
  nameRef.current = (id: string) => plushName(id, [li]);
  // His lines in his voice while Sound is on; the next line cuts one short, and leaving the round stops it.
  const voice = useLineVoice();
  const voiceRef = useRef({ voice, sound });
  voiceRef.current = { voice, sound };
  useEffect(() => {
    if (!sound) voiceRef.current.voice.stop();
  }, [sound]);

  // Cosmetic picks only (which line he says): never the round's own stream.
  const rng = useMemo(() => {
    let state = (seed ^ 0x5bd1e995) >>> 0;
    return () => {
      state = (Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
      return state / 4294967296;
    };
  }, [seed]);

  /**
   * His line of `kind`, shown in his bubble. Returns it as the live region says it ("" with none): each moment sets
   * one announcement (a drop's result, his reaction and whose turn it is, together), since a second one set in the same
   * tick would replace the first before it is ever heard.
   */
  const say = useCallback(
    (kind: ClawLineKind): string => {
      const line = pickLine(linePool(t, lines, kind, cheat, rupture), game.current.lastLine, rng);
      if (!line) return "";
      game.current.lastLine = line;
      lineId.current += 1;
      const id = lineId.current;
      setUi((current) => ({ ...current, bubble: { id, text: line } }));
      const spoken = { speaker: li.name, text: line };
      const { voice: lineVoice, sound: audible } = voiceRef.current;
      // A cold line is Home's own (linePool), so it shares Home's clip; a claw line has the claw's.
      if (audible && lineVoice.can(spoken)) lineVoice.play(tapLineRef(li.id, line, rupture ? "tap" : "claw"), spoken);
      return t("ui.otomeForge.claw.said", { name: li.name, line });
    },
    [cheat, li.id, li.name, lines, rng, rupture, t],
  );
  const sayRef = useRef(say);
  sayRef.current = say;

  const setStage = useCallback((stage: Stage, now = performance.now()) => {
    game.current.stage = stage;
    game.current.stageAt = now;
    setUi((current) => ({ ...current, stage }));
  }, []);

  /** The next drop's turn: its banner, then the player's timer or the partner's plan. `before` leads its announcement. */
  const startTurn = useCallback(
    (round: ClawRoundState, before = "") => {
      const player = currentPlayer(round);
      const g = game.current;
      g.anim = null;
      g.aimed = null;
      g.hold = 0;
      g.cheerOnAim = false;
      if (!player) {
        g.round = round;
        g.stage = "over";
        setUi((current) => ({ ...current, round, stage: "over", seconds: null }));
        onDone(round);
        return;
      }
      let next = round;
      if (player === "partner") {
        const planned = planPartnerTurn(round);
        next = planned.round;
        g.plan = planned.plan;
        g.script = "think";
      } else {
        g.plan = null;
        g.herTurns += 1;
      }
      g.round = next;
      g.body = { ...g.body, target: g.body.x };
      g.stage = "banner";
      g.stageAt = performance.now();
      setUi((current) => ({ ...current, round: next, stage: "banner", seconds: null }));
      const turn =
        player === "me"
          ? t(
              isBonusTurn(next, next.turn)
                ? "ui.otomeForge.claw.announceBonusTurn"
                : "ui.otomeForge.claw.announceYourTurn",
              { seconds: CLAW_MOVE_SECONDS + (next.effects.slowed ? FREEZE_BONUS_SECONDS : 0) },
            )
          : t("ui.otomeForge.claw.announceTheirTurn", { name: li.name });
      setAnnounce([before, turn].filter(Boolean).join(" "));
      // He cheers her on now and then: on her first turn, then about every other one.
      if (player === "me") g.cheerOnAim = g.herTurns === 1 || rng() < 0.5;
    },
    [li.name, onDone, rng, t],
  );

  const finishDrop = useCallback(() => {
    const g = game.current;
    const anim = g.anim;
    if (!anim) return;
    g.anim = null;
    const { outcome, after } = anim;
    if (reducedRef.current) {
      // Nothing moved, so the drop's sounds play at once, its result last.
      feedback.cue("latch");
      feedback.cue(outcome.caught ? "coin" : "cancel");
    }
    feedback.buzz(outcome.caught ? "coin" : "cancel");
    g.body = restingBody(GEOMETRY.home);
    const element = outcome.target ? prizeEls.current.get(outcome.target.id) : undefined;
    if (element) {
      // Where the prize now lies, before React says so, so it never flashes back to where it was.
      if (outcome.movedTo !== null) element.style.setProperty("--px", String(outcome.movedTo));
      element.removeAttribute("data-anim");
    }
    const prize = outcome.target ? nameRef.current(outcome.target.id) : "";
    const result = outcome.caught
      ? outcome.player === "me"
        ? t("ui.otomeForge.claw.announceCaught", { prize })
        : t("ui.otomeForge.claw.announceTheyCaught", { name: li.name, prize })
      : t(FAIL_KEYS[outcome.fail ?? "air"], { prize });
    setUi((current) => ({
      ...current,
      results: [...current.results, outcome.caught],
      result: { id: (current.result?.id ?? 0) + 1, outcome },
    }));
    const his = outcome.caught && outcome.target?.id === liPlushId(li.id);
    const reaction = say(outcome.caught ? (his ? "plush" : "win") : "miss");
    // One announcement for the moment: how the drop went, what he says to it, and whose turn it is now.
    startTurn(after, [result, reaction].filter(Boolean).join(" "));
  }, [feedback, li, say, startTurn, t]);
  const finishRef = useRef(finishDrop);
  finishRef.current = finishDrop;

  /** The drop, landing at `x`: decided now (the round's own stream), then animated unless motion is reduced. */
  const drop = useCallback(
    (x: number) => {
      const g = game.current;
      if (g.stage !== "aim" && g.stage !== "partner") return;
      const { round, outcome } = landDrop(g.round, x);
      g.anim = { start: performance.now(), from: landingX(g.body), outcome, after: round, played: new Set() };
      g.hold = 0;
      setStage("drop");
      setUi((current) => ({ ...current, seconds: null }));
      if (reducedRef.current) finishRef.current();
    },
    [setStage],
  );
  const dropRef = useRef(drop);
  dropRef.current = drop;

  const stopCheering = useCallback(() => {
    if (cheerTimer.current) clearInterval(cheerTimer.current);
    cheerTimer.current = null;
  }, []);

  const doCheer = useCallback(() => {
    const g = game.current;
    if (g.stage !== "partner") return;
    const now = performance.now();
    if (now - g.lastCheer < TIME.cheerEvery * 0.6) return;
    g.lastCheer = now;
    const { round, fired, nudged } = cheerRound(g.round);
    if (round === g.round) return;
    g.round = round;
    feedback.buzz("cheer");
    if (!fired) {
      setUi((current) => ({ ...current, round }));
      if (round.cheers === CHEER_GOAL / 2) setAnnounce(t("ui.otomeForge.claw.announceCheerHalf", { name: li.name }));
      return;
    }
    stopCheering();
    feedback.cue("latch");
    lineId.current += 1;
    const id = lineId.current;
    const motionOn = !reducedRef.current;
    setUi((current) => ({
      ...current,
      round,
      cheat: { id, cheat: fired },
      shake: fired === "nudge" && motionOn,
      leaving: nudged && motionOn ? [...current.leaving, nudged] : current.leaving,
    }));
    const line = say("cheat");
    // After his line, so a screen reader hears what the cheat does last.
    setAnnounce(
      [line, t(CHEAT_COPY[fired].title, { name: li.name }), t(CHEAT_COPY[fired].hint)].filter(Boolean).join(" "),
    );
    if (nudged) {
      // The prize his plan aimed at is in the chute now: his claw goes to the one nearest it instead.
      const retargeted = g.plan ? retargetPlan(g.plan, nudged, round.prizes) : null;
      if (retargeted && retargeted !== g.plan) {
        g.plan = retargeted;
        if (reducedRef.current) {
          g.body = restingBody(retargeted.aimX);
        } else if (g.script === "back" || g.script === "settle") {
          g.script = "back";
          g.body = { ...g.body, target: retargeted.aimX };
        }
      }
      feedback.cue("cloth");
      setTimeout(() => {
        setUi((current) => ({
          ...current,
          shake: false,
          leaving: current.leaving.filter((prize) => prize.id !== nudged.id),
        }));
      }, 900);
    }
  }, [feedback, li.name, say, stopCheering, t]);

  // The first turn, once.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startTurn(game.current.round);
  }, [startTurn]);

  // The loop: steps the claw, runs the partner's hand and the drop's animation, and draws them onto the glass.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const g = game.current;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const still = reducedRef.current;
      const elapsed = now - g.stageAt;
      const player = currentPlayer(g.round);
      const slowed = player === "me" && g.round.effects.slowed;
      const seconds = CLAW_MOVE_SECONDS + (slowed ? FREEZE_BONUS_SECONDS : 0);

      if (g.stage === "banner" && elapsed >= (still ? TIME.bannerReduced : TIME.banner)) {
        g.lastSecond = -1;
        if (player === "me") {
          g.deadline = now + seconds * 1000;
          setStage("aim", now);
          if (g.cheerOnAim) {
            g.cheerOnAim = false;
            const cheered = sayRef.current("cheer");
            if (cheered) setAnnounce(cheered);
          }
        } else if (player === "partner") {
          if (still && g.plan) g.body = restingBody(g.plan.aimX);
          setStage("partner", now);
        }
      } else if (g.stage === "aim") {
        g.body = steerBody(g.body, g.hold, dt, { slowed });
        const left = Math.max(0, g.deadline - now);
        const second = Math.ceil(left / 1000);
        if (second !== g.lastSecond) {
          g.lastSecond = second;
          setUi((current) => ({ ...current, seconds: second }));
          if (second === 3) setAnnounce(tRef.current("ui.otomeForge.claw.announceSeconds", { count: 3 }));
        }
        rootRef.current?.style.setProperty("--tl", (left / (seconds * 1000)).toFixed(4));
        // What the claw is over, for a screen reader, once it has stayed there a moment.
        const over = targetAt(g.round.prizes, still ? g.body.x : landingX(g.body))?.id ?? "";
        if (over !== g.aimed) {
          g.aimed = over;
          if (announceTimer.current) clearTimeout(announceTimer.current);
          announceTimer.current = setTimeout(() => {
            if (game.current.stage !== "aim" || game.current.aimed !== over) return;
            setAnnounce(
              over
                ? tRef.current("ui.otomeForge.claw.announceOver", { prize: nameRef.current(over) })
                : tRef.current("ui.otomeForge.claw.announceOverNothing"),
            );
          }, 450);
        }
        if (left <= 0) dropRef.current(still ? g.body.x : landingX(g.body));
      } else if (g.stage === "partner" && g.plan) {
        const plan = g.plan;
        const minimum = still ? TIME.partnerReduced : TIME.partnerMin;
        if (still) {
          // Reduced motion: his claw waits over his pick, counting down, while she cheers.
          const left = Math.max(0, minimum - elapsed);
          const second = Math.ceil(left / 1000);
          if (second !== g.lastSecond) {
            g.lastSecond = second;
            setUi((current) => ({ ...current, seconds: second }));
          }
          if (left <= 0) dropRef.current(plan.aimX);
        } else if (g.script === "think" && elapsed >= plan.thinkMs + 500) {
          g.script = plan.overshoot ? "out" : "back";
          g.body = { ...g.body, target: plan.aimX + plan.overshoot };
        } else if (g.script === "out" && Math.abs(g.body.x - g.body.target) < 0.008) {
          g.script = "back";
          g.body = { ...g.body, target: plan.aimX };
        } else if (g.script === "back" && Math.abs(g.body.x - plan.aimX) < 0.004 && Math.abs(g.body.v) < 0.03) {
          g.script = "settle";
          g.settleAt = now;
        } else if (g.script === "settle" && now - g.settleAt >= plan.settleMs && elapsed >= minimum) {
          dropRef.current(plan.aimX);
        }
      }

      if (g.stage !== "drop") g.body = stepBody(g.body, dt, { slowed, still, pace: g.plan?.pace });

      const el = glass.current;
      if (el) {
        let x = g.body.x;
        let sway = still ? 0 : g.body.sway;
        let cable = 0;
        let open = 1;
        const anim = g.anim;
        if (anim) {
          const moment = now - anim.start;
          const pose = dropPose(anim, moment);
          x = pose.x;
          sway = 0;
          cable = pose.cable;
          open = pose.open;
          for (const { at, cue } of pose.cues) {
            const key = `${cue}@${at}`;
            if (moment >= at && !anim.played.has(key)) {
              anim.played.add(key);
              feedback.cue(cue);
              if (cue === "latch") feedback.buzz("latch");
            }
          }
          const target = anim.outcome.target;
          const prizeEl = target ? prizeEls.current.get(target.id) : undefined;
          if (prizeEl && pose.prize) {
            prizeEl.setAttribute("data-anim", "");
            prizeEl.style.setProperty("--ax", pose.prize.x.toFixed(4));
            prizeEl.style.setProperty("--ay", pose.prize.y.toFixed(4));
            prizeEl.style.setProperty("--ar", `${pose.prize.rot.toFixed(1)}deg`);
            prizeEl.style.setProperty("--ao", pose.prize.gone ? "0" : "1");
          }
          if (moment >= pose.end) finishRef.current();
        }
        const length = CABLE.rest + cable * CABLE.travel;
        el.style.setProperty("--cx", x.toFixed(4));
        el.style.setProperty("--cc", cable.toFixed(4));
        el.style.setProperty("--co", open.toFixed(3));
        // The tip swings out by `sway` glass widths: the arm turns about the carriage by that angle.
        el.style.setProperty(
          "--ca",
          `${((-Math.atan2(sway * GLASS_ASPECT, length + CABLE.head) * 180) / Math.PI).toFixed(2)}deg`,
        );
        el.style.setProperty("--gx", (still ? g.body.x : landingX(g.body)).toFixed(4));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // One loop for the round: it reads everything that changes through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A hold ends when the page loses focus (no keyup or pointerup would come), and cheering stops with his turn.
  useEffect(() => {
    const release = () => {
      game.current.hold = 0;
      stopCheering();
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
      if (announceTimer.current) clearTimeout(announceTimer.current);
      stopCheering();
    };
  }, [stopCheering]);
  useEffect(() => {
    if (ui.stage !== "partner") stopCheering();
  }, [stopCheering, ui.stage]);

  // His line and the cheat's banner fade on their own.
  useEffect(() => {
    if (!ui.bubble) return;
    const id = ui.bubble.id;
    const timer = setTimeout(
      () => setUi((current) => (current.bubble?.id === id ? { ...current, bubble: null } : current)),
      3400,
    );
    return () => clearTimeout(timer);
  }, [ui.bubble]);
  useEffect(() => {
    if (!ui.cheat) return;
    const id = ui.cheat.id;
    const timer = setTimeout(
      () => setUi((current) => (current.cheat?.id === id ? { ...current, cheat: null } : current)),
      2600,
    );
    return () => clearTimeout(timer);
  }, [ui.cheat]);

  // Focus starts on the one action button, which turns from Drop to Cheer and back, so it never has to move.
  useEffect(() => {
    actionRef.current?.focus({ preventScroll: true });
  }, []);

  // ── Controls ──

  const { round, stage } = ui;
  const player = currentPlayer(round);
  const mine = player === "me";
  const aiming = stage === "aim";
  const cheering = stage === "partner" && !round.cheated;

  const startHold = (direction: -1 | 1) => {
    const g = game.current;
    if (g.stage !== "aim") return;
    g.hold = direction;
    g.holdAt = performance.now();
  };
  const endHold = () => {
    const g = game.current;
    if (!g.hold) return;
    const direction = g.hold;
    g.hold = 0;
    // A tap moves a whole step, however short it was.
    if (performance.now() - g.holdAt < 160 && g.stage === "aim") g.body = nudgeBody(g.body, direction);
  };
  const dropNow = () => {
    const g = game.current;
    if (g.stage === "aim") dropRef.current(reducedRef.current ? g.body.x : landingX(g.body));
  };

  // A letter key in either case (Shift, Caps Lock); the named keys keep their names.
  const keyOf = (event: ReactKeyboardEvent<HTMLDivElement>) =>
    event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Ctrl, Cmd and Alt chords belong to the browser (save, copy, back), not to the claw.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = keyOf(event);
    if (key === "ArrowLeft" || key === "ArrowRight" || key === "a" || key === "d") {
      if (game.current.stage !== "aim") return;
      event.preventDefault();
      if (!event.repeat) startHold(key === "ArrowLeft" || key === "a" ? -1 : 1);
    } else if (key === "ArrowDown" || key === "s") {
      event.preventDefault();
      if (!event.repeat) dropNow();
    } else if (key === "c") {
      event.preventDefault();
      doCheer();
    }
  };
  // No modifier check here: a move key let go while Ctrl, Cmd or Alt is down must still end its hold.
  const onKeyUp = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = keyOf(event);
    if (key === "ArrowLeft" || key === "ArrowRight" || key === "a" || key === "d") endHold();
  };

  const onActionPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    pressStage.current = game.current.stage;
    if (game.current.stage !== "partner") return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    doCheer();
    stopCheering();
    cheerTimer.current = setInterval(doCheer, TIME.cheerEvery);
  };
  const onActionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    const stageNow = game.current.stage;
    // Held down on his turn it keeps cheering, one cheer per key repeat. A key still held from his turn (or pressed
    // between turns) never drops her claw: only a fresh press on her turn does.
    if (stageNow === "partner") {
      event.preventDefault();
      doCheer();
    } else if (stageNow !== "aim" || event.repeat) {
      event.preventDefault();
    }
  };
  const onAction = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const pressed = pressStage.current;
    pressStage.current = null;
    const pointerless = event.detail === 0;
    // A pointer press drops only when it began on her turn: a Cheer held through the end of his turn and let go once
    // hers has begun never drops her claw (as a key held from his turn never does). A click with no pointer behind it
    // (the keyboard, a screen reader) drops at once.
    if (game.current.stage === "aim") {
      if (pointerless || pressed === "aim") dropNow();
    }
    // A pointer cheers on pointerdown; a click with no pointer behind it cheers here.
    else if (game.current.stage === "partner" && pointerless) doCheer();
  };

  const toFraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return box.width ? (event.clientX - box.left) / box.width : null;
  };
  const glassHandlers = {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      const g = game.current;
      const x = toFraction(event);
      if (g.stage !== "aim" || x === null) return;
      g.dragging = event.pointerId;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      g.body = { ...g.body, target: x };
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      const g = game.current;
      const x = toFraction(event);
      if (g.dragging !== event.pointerId || g.stage !== "aim" || x === null) return;
      g.body = { ...g.body, target: x };
    },
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (game.current.dragging === event.pointerId) game.current.dragging = null;
    },
  };

  const moveButton = (direction: -1 | 1) => ({
    type: "button" as const,
    className: "of-claw-move of-glass",
    "aria-label": t(direction < 0 ? "ui.otomeForge.claw.moveLeft" : "ui.otomeForge.claw.moveRight"),
    "aria-disabled": !aiming,
    "aria-describedby": hintId,
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      startHold(direction);
    },
    onPointerUp: endHold,
    onPointerCancel: endHold,
    onLostPointerCapture: endHold,
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      // Keyboard and screen readers click without a pointer: a step each time.
      if (event.detail === 0 && game.current.stage === "aim")
        game.current.body = nudgeBody(game.current.body, direction);
    },
  });

  const fired = ui.cheat ? CHEAT_COPY[ui.cheat.cheat] : null;
  // The button shows a word; its name says the rest (and starts with that word, so voice control finds it).
  const actionText = aiming
    ? t("ui.otomeForge.claw.drop")
    : stage === "partner"
      ? round.cheated
        ? t("ui.otomeForge.claw.cheatUsed")
        : t("ui.otomeForge.claw.cheer")
      : t("ui.otomeForge.claw.wait");
  const actionLabel = aiming
    ? t("ui.otomeForge.claw.drop")
    : stage === "partner"
      ? round.cheated
        ? t("ui.otomeForge.claw.cheerSpent", { name: li.name })
        : t("ui.otomeForge.claw.cheerLabel", { name: li.name, cheers: round.cheers, goal: CHEER_GOAL })
      : t("ui.otomeForge.claw.wait");
  const statusText =
    stage === "over"
      ? t("ui.otomeForge.claw.roundOver")
      : mine
        ? t(isBonusTurn(round, round.turn) ? "ui.otomeForge.claw.bonusTurn" : "ui.otomeForge.claw.yourTurn")
        : t("ui.otomeForge.claw.theirTurn", { name: li.name });
  const pipKeys = {
    caught: "ui.otomeForge.claw.pipCaught",
    missed: "ui.otomeForge.claw.pipMissed",
    current: "ui.otomeForge.claw.pipCurrent",
    next: "ui.otomeForge.claw.pipNext",
  } as const;

  return (
    <div
      ref={rootRef}
      className="of-claw-game"
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      data-stage={stage}
      data-player={player ?? ""}
    >
      <div className="of-claw-hud">
        <ol className="of-claw-pips" aria-label={t("ui.otomeForge.claw.dropsLabel", { count: round.turns.length })}>
          {round.turns.map((who, index) => {
            const state =
              index < ui.results.length
                ? ui.results[index]
                  ? "caught"
                  : "missed"
                : index === round.turn && stage !== "over"
                  ? "current"
                  : "next";
            return (
              <li
                key={index}
                className="of-claw-pip"
                data-who={who}
                data-state={state}
                data-bonus={isBonusTurn(round, index) || undefined}
                style={who === "partner" ? ({ "--of-li-accent": accent } as CSSProperties) : undefined}
              >
                <span aria-hidden="true">
                  {state === "caught" ? (
                    <Heart size={11} strokeWidth={0} fill="currentColor" />
                  ) : who === "me" ? (
                    t("ui.otomeForge.claw.pipMe")
                  ) : (
                    (Array.from(li.name)[0] ?? "").toLocaleUpperCase()
                  )}
                </span>
                <span className="of-visually-hidden">
                  {t(pipKeys[state], { name: who === "me" ? t("ui.otomeForge.claw.you") : li.name, number: index + 1 })}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="of-claw-toggles">
          <button
            type="button"
            className="of-icon-button of-glass"
            aria-pressed={sound}
            aria-label={t("ui.otomeForge.claw.sound")}
            title={t("ui.otomeForge.claw.sound")}
            onClick={() => onSound(!sound)}
          >
            {sound ? (
              <Volume2 size={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <VolumeX size={16} strokeWidth={2} aria-hidden="true" />
            )}
          </button>
          {canVibrate() ? (
            <button
              type="button"
              className="of-icon-button of-glass"
              aria-pressed={vibrate}
              aria-label={t("ui.otomeForge.claw.vibrate")}
              title={t("ui.otomeForge.claw.vibrate")}
              onClick={() => onVibrate(!vibrate)}
            >
              {vibrate ? (
                <Vibrate size={16} strokeWidth={2} aria-hidden="true" />
              ) : (
                <VibrateOff size={16} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      <div className="of-claw-partner" style={{ "--of-li-accent": accent } as CSSProperties}>
        <Avatar name={li.name} url={li.portrait} accent={accent} size={40} />
        <AnimatePresence mode="wait" initial={false}>
          {ui.bubble ? (
            <motion.p
              key={`line-${ui.bubble.id}`}
              className="of-claw-bubble of-glass of-glass--strong"
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              aria-hidden="true"
            >
              {ui.bubble.text}
            </motion.p>
          ) : (
            <motion.p
              key="status"
              className="of-claw-status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-hidden="true"
            >
              {statusText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <Cabinet
        title={t("ui.otomeForge.claw.marquee")}
        prizes={round.prizes}
        leaving={ui.leaving}
        li={li}
        accent={accent}
        label={t("ui.otomeForge.claw.glassLabel", { count: round.prizes.length })}
        glassRef={(element) => {
          glass.current = element;
        }}
        prizeRef={(id, element) => {
          if (element) prizeEls.current.set(id, element);
          else prizeEls.current.delete(id);
        }}
        guide={aiming && round.effects.guide}
        frost={mine && round.effects.slowed && stage !== "drop"}
        steady={stage === "partner" && round.effects.guaranteed}
        shake={ui.shake}
        glassHandlers={glassHandlers}
      >
        <AnimatePresence>
          {stage === "banner" && player ? (
            <motion.div
              key={`banner-${round.turn}`}
              className="of-claw-banner"
              data-who={player}
              initial={{ opacity: 0, scale: 0.6, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: -3 }}
              exit={{ opacity: 0, scale: 1.15 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
            >
              {statusText}
            </motion.div>
          ) : null}
          {fired && ui.cheat ? (
            <motion.div
              key={`cheat-${ui.cheat.id}`}
              className="of-claw-cheat"
              initial={{ opacity: 0, y: 14, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 360, damping: 20 }}
            >
              <fired.Icon size={18} strokeWidth={2} aria-hidden="true" />
              <span>
                <strong>{t(fired.title, { name: li.name })}</strong>
                <small>{t(fired.hint)}</small>
              </span>
            </motion.div>
          ) : null}
          {ui.result && stage !== "drop" ? (
            <motion.div
              key={`result-${ui.result.id}`}
              className="of-claw-pop"
              data-caught={ui.result.outcome.caught}
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.12, 1, 0.96], y: [10, 0, 0, -16] }}
              transition={{ duration: 1.5, times: [0, 0.18, 0.75, 1] }}
            >
              {ui.result.outcome.caught ? (
                <>
                  <PartyPopper size={16} strokeWidth={2} aria-hidden="true" />
                  {t("ui.otomeForge.claw.popCaught")}
                </>
              ) : (
                t(ui.result.outcome.fail === "air" ? "ui.otomeForge.claw.popAir" : "ui.otomeForge.claw.popClose")
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
        {stage === "partner" && reduced && ui.seconds !== null ? (
          <div className="of-claw-countdown">
            {t("ui.otomeForge.claw.countdown", { name: li.name, count: ui.seconds })}
          </div>
        ) : null}
      </Cabinet>

      <div className="of-claw-meter" data-full={round.cheated || undefined} data-live={cheering || undefined}>
        <span className="of-claw-meter-label" aria-hidden="true">
          {round.cheated
            ? t("ui.otomeForge.claw.meterSpent", { name: li.name })
            : t("ui.otomeForge.claw.meterLabel", { name: li.name })}
        </span>
        <span
          className="of-claw-hearts"
          role="progressbar"
          aria-label={t("ui.otomeForge.claw.meterLabel", { name: li.name })}
          aria-valuemin={0}
          aria-valuemax={CHEER_GOAL}
          aria-valuenow={round.cheers}
        >
          {Array.from({ length: CHEER_GOAL }, (_, index) => (
            <Heart
              key={index}
              size={15}
              strokeWidth={2}
              data-on={index < round.cheers}
              fill={index < round.cheers ? "currentColor" : "none"}
              aria-hidden="true"
            />
          ))}
        </span>
      </div>

      <div className="of-claw-controls">
        <button {...moveButton(-1)}>
          <ChevronLeft size={26} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          ref={actionRef}
          type="button"
          className="of-claw-action"
          data-mode={aiming ? "drop" : cheering ? "cheer" : "wait"}
          aria-disabled={!aiming && !cheering}
          aria-label={actionLabel}
          aria-describedby={hintId}
          onPointerDown={onActionPointerDown}
          onPointerUp={stopCheering}
          onPointerCancel={stopCheering}
          onPointerLeave={stopCheering}
          onKeyDown={onActionKeyDown}
          onClick={onAction}
        >
          {aiming ? (
            <ArrowDownToLine size={22} strokeWidth={2.4} aria-hidden="true" />
          ) : (
            <Heart size={20} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />
          )}
          <span className="of-claw-action-text">{actionText}</span>
          {aiming && ui.seconds !== null ? (
            <span className="of-claw-timer" aria-hidden="true">
              {ui.seconds}
            </span>
          ) : null}
        </button>
        <button {...moveButton(1)}>
          <ChevronRight size={26} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
      <p id={hintId} className="of-hint of-claw-keys">
        {t("ui.otomeForge.claw.keys", { name: li.name })}
      </p>
      <p className="of-visually-hidden" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

// ── The screen ──

type Phase =
  | { kind: "intro" }
  | { kind: "play"; seed: number; round: string; first: ClawPlayer }
  | { kind: "result"; round: ClawRoundState; id: string; first: ClawPlayer };

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** `c-<time base36>-<6 [a-z0-9]>` (SH/claw.ts CLAW_ROUND_ID). */
function newRoundId(): string {
  const bytes = new Uint8Array(6);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  return `c-${Date.now().toString(36)}-${Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("")}`;
}

function newSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  } catch {
    return Math.floor(Math.random() * 4294967296);
  }
}

/** One finish request per round on this page: coming back to a round that is being saved never sends it twice. */
const finishes = new Map<string, Promise<ClawFinishResult>>();

export function ClawMachine({ runKey, view, li, onExit }: ActivityScreenProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  const play = usePlay(runKey);
  const plushName = usePlushName();
  const accent = accentOf(li);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [sound, setSound] = useState(true);
  const [vibrate, setVibrate] = useState(true);
  const feedback = useFeedback(sound, vibrate);
  const [finish, setFinish] = useState<{ id: string; result?: ClawFinishResult; error?: unknown } | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const focusResult = useRef(false);

  const info = play.data?.lis[li.id] ?? null;
  // His plush wears the picture GET /play names (his look, cut out once Home has made it).
  const plushOwner = withPlush(li, play.data);
  const cheat: ClawCheat = info?.cheat ?? "steady";
  const style = clawStyleOf(info?.style ?? "");
  const rupture = !!info?.rupture;
  const styleText = info?.style.trim() ?? "";
  // A still picture of a fresh machine for the intro.
  const preview = useMemo(
    () => createRound({ seed: 7, first: "me", li: li.id, cheat: "steady", style: "careful" }).prizes,
    [li.id],
  );

  const send = useCallback(
    (round: ClawRoundState, id: string, first: ClawPlayer) => {
      const body: ClawFinishInput = { li: li.id, round: id, first, caught: round.caught, cheered: round.cheated };
      setFinish({ id });
      let request = finishes.get(id);
      if (!request) {
        request = otome.post<ClawFinishResult>(`${runPath(runKey)}/claw/finish`, { ...body });
        finishes.set(id, request);
        // A failure may be sent again with the same round; an answer stays.
        request.catch(() => finishes.delete(id));
      }
      request.then(
        (result) => {
          setFinish((current) => (current?.id === id ? { id, result } : current));
          patchRun(queryClient, runKey, (current) => ({ ...current, starlight: result.starlight }));
          queryClient.setQueryData<PlayView>(playQueryKey(runKey), (current) =>
            current ? { ...current, plush: result.plush } : current,
          );
          void queryClient.invalidateQueries({ queryKey: playQueryKey(runKey) });
          void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
          if (result.grants.length && !result.replay) feedback.cue("coin");
        },
        (error: unknown) => setFinish((current) => (current?.id === id ? { id, error } : current)),
      );
    },
    [feedback, li.id, otome, queryClient, runKey],
  );

  const start = (first: ClawPlayer) => {
    setFinish(null);
    setPhase({ kind: "play", seed: newSeed(), round: newRoundId(), first });
  };

  const onDone = useCallback(
    (round: ClawRoundState) => {
      const current = phaseRef.current;
      if (current.kind !== "play") return;
      send(round, current.round, current.first);
      focusResult.current = true;
      setPhase({ kind: "result", round, id: current.round, first: current.first });
    },
    [send],
  );

  // His own line for his first plush on the shelf, or the catalog's (none during a rupture), voiced once as it shows.
  const settledResult = phase.kind === "result" && finish?.id === phase.id ? finish.result : undefined;
  const plushLine = settledResult?.firstPlush
    ? (settledResult.line ?? (rupture ? null : t("ui.otomeForge.fallback.clawFirstPlush")))
    : null;
  const voice = useLineVoice();
  useEffect(() => {
    const spoken = plushLine ? { speaker: li.name, text: plushLine } : null;
    if (spoken && sound && voice.can(spoken)) voice.play(tapLineRef(li.id, spoken.text, "claw"), spoken);
    // Once per line, as it shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plushLine]);

  // The round's end moves focus to its result, which also announces it.
  useEffect(() => {
    if (phase.kind !== "result" || !focusResult.current) return;
    focusResult.current = false;
    resultHeading.current?.focus({ preventScroll: true });
  }, [phase]);

  const head = (
    <div className="of-page-head of-claw-title">
      <h1 className="of-title of-title--page" tabIndex={-1}>
        {t("ui.otomeForge.claw.title")}
      </h1>
      <p className="of-subtitle">{t("ui.otomeForge.claw.with", { name: li.name })}</p>
    </div>
  );
  const page = (children: ReactNode) => (
    <MotionConfig reducedMotion="user">
      <div className="of-page of-claw" style={{ "--of-li-accent": accent } as CSSProperties}>
        {head}
        {children}
      </div>
    </MotionConfig>
  );

  if (phase.kind === "play") {
    return page(
      <ClawGame
        key={phase.round}
        li={plushOwner}
        accent={accent}
        seed={phase.seed}
        first={phase.first}
        cheat={cheat}
        style={style}
        lines={info?.lines ?? null}
        rupture={rupture}
        feedback={feedback}
        reduced={reduced}
        sound={sound}
        vibrate={vibrate}
        onSound={setSound}
        onVibrate={setVibrate}
        onDone={onDone}
      />,
    );
  }

  if (phase.kind === "result") {
    const { round } = phase;
    const mine = finish?.id === phase.id ? finish : null;
    const result = mine?.result;
    const failed = mine?.error;
    const starlight = result?.grants.reduce((sum, grant) => sum + (grant.starlight ?? 0), 0) ?? 0;
    const affection = result?.grants.reduce((sum, grant) => sum + (grant.affection ?? 0), 0) ?? 0;
    const shelf = { ...(play.data?.plush ?? {}), ...(result?.plush ?? {}) };
    const settled = !!result || failed !== undefined;
    return page(
      <>
        <section className="of-section of-glass of-claw-result" aria-labelledby="of-claw-result-title">
          <h2 id="of-claw-result-title" ref={resultHeading} className="of-section-title" tabIndex={-1}>
            {round.caught.length
              ? t("ui.otomeForge.claw.resultTitle", { count: round.caught.length })
              : t("ui.otomeForge.claw.resultNone")}
          </h2>
          {round.caught.length ? (
            <ul className="of-claw-haul">
              {round.caught.map((entry, index) => (
                <motion.li
                  key={entry.prize}
                  className="of-claw-haul-item"
                  initial={{ opacity: 0, y: -24, rotate: -10 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.12 * index }}
                >
                  <PlushArt prize={entry.prize} li={entry.prize === liPlushId(li.id) ? plushOwner : null} />
                  <span className="of-claw-haul-name">{plushName(entry.prize, [li])}</span>
                  <span className="of-claw-haul-by">
                    {entry.by === "me"
                      ? t("ui.otomeForge.claw.byYou")
                      : t("ui.otomeForge.claw.byThem", { name: li.name })}
                  </span>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="of-body">{t("ui.otomeForge.claw.resultNoneText", { name: li.name })}</p>
          )}
          {round.cheated ? <p className="of-hint">{t("ui.otomeForge.claw.resultCheated", { name: li.name })}</p> : null}
          {plushLine ? (
            <blockquote className="of-claw-quote" style={{ "--of-li-accent": accent } as CSSProperties}>
              <Avatar name={li.name} url={li.portrait} accent={accent} size={34} />
              <p>
                <span className="of-visually-hidden">{t("ui.otomeForge.claw.saidPrefix", { name: li.name })}</span>
                {plushLine}
              </p>
            </blockquote>
          ) : null}
          <div className="of-claw-pay" role="status">
            {result ? (
              <>
                {starlight || affection ? (
                  <p className="of-claw-pay-line">
                    <Star size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                    {[
                      starlight ? t("ui.otomeForge.claw.paidStarlight", { starlight }) : "",
                      affection ? t("ui.otomeForge.claw.paidAffection", { affection, name: li.name }) : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {result.capped ? <p className="of-hint">{t("ui.otomeForge.claw.capped")}</p> : null}
              </>
            ) : failed === undefined ? (
              <p className="of-hint">{t("ui.otomeForge.claw.saving")}</p>
            ) : null}
          </div>
          {failed !== undefined ? (
            <div className="of-notice of-notice--error" role="alert">
              <span>{otome.errorMessage(failed, "ui.otomeForge.claw.saveFailed")}</span>
              <button
                type="button"
                className="of-button of-button--quiet of-glass of-button--small"
                onClick={() => send(round, phase.id, phase.first)}
              >
                <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.common.retry")}
              </button>
            </div>
          ) : null}
          <div className="of-actions">
            <button
              type="button"
              className="of-button of-button--primary"
              aria-disabled={!settled}
              onClick={() => {
                if (settled) start(phase.first);
              }}
            >
              <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.claw.again")}
            </button>
            <button type="button" className="of-button of-button--quiet of-glass" onClick={onExit}>
              {t("ui.otomeForge.claw.backToDates")}
            </button>
          </div>
        </section>
        <section className="of-section of-glass" aria-labelledby="of-claw-shelf-title">
          <h2 id="of-claw-shelf-title" className="of-section-title">
            {t("ui.otomeForge.claw.shelfTitle")}
          </h2>
          <PlushShelf
            plush={shelf}
            lis={view.lis.map((entry) => withPlush(entry, play.data))}
            fresh={result?.newPlush ?? []}
            labelledBy="of-claw-shelf-title"
          />
        </section>
      </>,
    );
  }

  // The intro: how they play, who goes first, and what it pays.
  const ready = !!play.data;
  return page(
    <>
      <Cabinet
        preview
        title={t("ui.otomeForge.claw.marquee")}
        prizes={preview}
        li={plushOwner}
        accent={accent}
        label={t("ui.otomeForge.claw.glassLabel", { count: preview.length })}
      />
      <section className="of-section of-glass of-claw-intro" aria-labelledby="of-claw-first">
        {styleText ? (
          <p className="of-claw-style">
            <span className="of-eyebrow">{t("ui.otomeForge.claw.styleTitle", { name: li.name })}</span>
            <span className="of-claw-style-text">{styleText}</span>
          </p>
        ) : null}
        <h2 id="of-claw-first" className="of-section-title">
          {t("ui.otomeForge.claw.firstTitle")}
        </h2>
        {play.isError && !play.data ? (
          <div className="of-inline-actions" role="alert">
            <p className="of-hint">{otome.errorMessage(play.error, "ui.otomeForge.dates.loadFailed")}</p>
            <button
              type="button"
              className="of-button of-button--quiet of-glass of-button--small"
              onClick={() => void play.refetch()}
            >
              <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : (
          <div className="of-claw-first">
            <button
              type="button"
              className="of-button of-button--primary"
              aria-disabled={!ready}
              onClick={() => {
                if (ready) start("me");
              }}
            >
              {t("ui.otomeForge.claw.meFirst")}
            </button>
            <button
              type="button"
              className="of-button of-button--quiet of-glass"
              aria-disabled={!ready}
              onClick={() => {
                if (ready) start("partner");
              }}
            >
              {t("ui.otomeForge.claw.themFirst", { name: li.name })}
            </button>
          </div>
        )}
        <ul className="of-claw-rules">
          <li>{t("ui.otomeForge.claw.ruleTurns", { name: li.name })}</li>
          <li>{t("ui.otomeForge.claw.ruleSwing")}</li>
          <li>{t("ui.otomeForge.claw.ruleCheer", { name: li.name, goal: CHEER_GOAL })}</li>
        </ul>
        <p className="of-activity-reward">
          <Star size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" />
          <span>
            {t("ui.otomeForge.claw.payRule", {
              starlight: STARLIGHT_EARNINGS.clawRound,
              plush: STARLIGHT_EARNINGS.clawPlush,
              affection: AFFECTION_EARNINGS.clawRound,
            })}
          </span>
        </p>
        <p className="of-cost">
          <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
          <span>{t("ui.otomeForge.dates.clawCost")}</span>
        </p>
      </section>
    </>,
  );
}
