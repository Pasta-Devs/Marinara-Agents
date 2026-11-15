// ──────────────────────────────────────────────
// Otome Hearth: haptic cues (0.34.0), read from a model's reply the same way by both bundles
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles. A cue is device-agnostic: an action and a pattern, at an intensity, for the
// toy it names or for every connected toy that can do it. The server's loop (S/haptics.ts) plays it until the story
// changes it or the player stops it. Haptics play only in an explicit story with the setting on (hapticsOn).
//
// The maintainer's rules (2026-11-15): no cap on strength anywhere (the protocol's whole 0–1 is the model's), every
// pattern loops, and a Stop is always in reach.
import type { HapticCue } from "./api-types";

/** What a cue may ask a toy to do: the Engine's outputs a toy reports (HapticCapability), and stop. */
export const HAPTIC_ACTIONS = ["vibrate", "rotate", "oscillate", "constrict", "inflate", "position", "stop"] as const;
/** The Engine's patterns (HapticFeedbackPattern). */
export const HAPTIC_PATTERNS = ["steady", "tap", "pulse", "wave", "ramp", "impact"] as const;
/** At most this many cues on one line or message: one for each toy, as a rule. */
export const HAPTIC_CUES_MAX = 4;
/** A toy's name in a cue, as the device list gives it. */
const DEVICE_NAME_MAX = 80;
/** An intensity the model leaves out. */
const DEFAULT_INTENSITY = 0.6;

const ALIASES: Record<string, (typeof HAPTIC_ACTIONS)[number]> = {
  vibration: "vibrate",
  vibrating: "vibrate",
  buzz: "vibrate",
  spin: "rotate",
  rotation: "rotate",
  thrust: "position",
  thrusting: "position",
  stroke: "position",
  stroking: "position",
  linear: "position",
  squeeze: "constrict",
  suction: "constrict",
  pump: "inflate",
  off: "stop",
  pause: "stop",
};

const isOne = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

function actionOf(value: unknown): HapticCue["action"] | null {
  const word = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (isOne(HAPTIC_ACTIONS, word)) return word;
  return ALIASES[word] ?? null;
}

/** 0–1 as written; a percentage (1–100) is read as one. Nothing is scaled down: the whole range is the model's. */
function intensityOf(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) return DEFAULT_INTENSITY;
  const unit = number > 1 && number <= 100 ? number / 100 : number;
  return Math.min(1, Math.max(0, unit));
}

/**
 * A reply's `haptic` (one cue or a list) as cues: one with an unknown action is left out, never the line it is on; a
 * pattern the Engine does not know is steady.
 */
export function normalizeHapticCues(value: unknown): HapticCue[] {
  const list = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  const cues: HapticCue[] = [];
  for (const item of list) {
    if (cues.length >= HAPTIC_CUES_MAX) break;
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const action = actionOf(raw.action);
    if (!action) continue;
    const device = typeof raw.device === "string" ? raw.device.trim().slice(0, DEVICE_NAME_MAX) : "";
    if (action === "stop") {
      cues.push({ action, ...(device ? { device } : {}) });
      continue;
    }
    const pattern = typeof raw.pattern === "string" ? raw.pattern.trim().toLowerCase() : "";
    cues.push({
      action,
      pattern: isOne(HAPTIC_PATTERNS, pattern) ? pattern : "steady",
      intensity: intensityOf(raw.intensity),
      ...(device ? { device } : {}),
    });
  }
  return cues;
}

/** Haptics play in this story: its Heat is explicit and its Haptics setting is on. */
export const hapticsOn = (world: { content: { heat: string }; audio: { haptics?: boolean } }): boolean =>
  world.content.heat === "explicit" && world.audio.haptics === true;

/** An Intiface Central address the setting keeps: ws:// or wss://, no spaces, or "" for the Engine's own. */
export const isHapticsUrl = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 300 && /^wss?:\/\/[^\s]+$/iu.test(value);
