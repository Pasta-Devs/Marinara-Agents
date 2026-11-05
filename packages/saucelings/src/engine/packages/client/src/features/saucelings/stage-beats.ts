import type {
  SaucelingMood,
  SaucelingSpeciesId,
  SaucelingUserAction,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import type { MoveAct } from "./move-player.js";

/** Art pixels per side of a sprite frame; the creature itself is narrower, so it may overhang the stage by this much. */
export const FRAME = 52;
const OVERHANG = 6;

export type StageBeat = "wander" | "idle" | "look" | "hop" | "hum" | "nap" | "huff" | "signature";
export type StagePose = "walk" | "hop" | "nap" | "huff" | null;
export type StageCue = { kind: "note" | "question" | "bang" | "nap"; at: number };

export interface StageActor {
  /** Left edge of the sprite frame, in whole art pixels from the stage's left. */
  x: number;
  facing: "left" | "right";
  pose: StagePose;
  cue: StageCue | null;
  /** How long the move to `x` takes; 0 snaps there. */
  moveMs: number;
  /** Whole art pixels the move covers, so the browser steps one art pixel at a time. */
  steps: number;
  /** The face this beat wears; null wears the resting face. */
  face: SaucelingMood | null;
  /** A signature move or the evolution moment playing on the sprite's canvas. */
  act: MoveAct | null;
}

/** Art pixels across and down a built-in background; it covers the stage, so a stage squarer than 16:9 shows less of
 *  its width. */
const SCENE_ART_WIDTH = 176;
const SCENE_ART_HEIGHT = 99;

/** The sprite's whole-number scale for a stage this big (16:9 when no height is given): about the scale the built-in
 *  background is drawn at to cover it, so the sprite's pixels stay about as big as the background's. */
export function stageScale(width: number, height = (width * 9) / 16): 2 | 3 | 4 {
  const scale = Math.round(Math.max(width / SCENE_ART_WIDTH, height / SCENE_ART_HEIGHT));
  return scale >= 4 ? 4 : scale <= 2 ? 2 : 3;
}

/** Species that look around curiously: they ask a `?` when they turn. */
export const CURIOUS: readonly SaucelingSpeciesId[] = ["rigamuffin", "fluttino", "burrowl"];
/** Species that hum more often. */
const HUMMERS: readonly SaucelingSpeciesId[] = ["shellbini", "lentino", "puddlepip"];
/** Species that float a little above the floor instead of standing on it. */
export const HOVERERS: readonly SaucelingSpeciesId[] = ["fluttino", "wickwisp"];

/** How fast a creature walks, in art pixels per second; a grumpy one trudges and a happy one trots. */
const SPEED: Record<SaucelingMood, number> = { grumpy: 6, content: 10, happy: 14 };

export function isNight(hour: number): boolean {
  return hour >= 22 || hour < 7;
}

/** The weights each mood picks its next beat from. Pure, so the table can be checked without a DOM. `signature`
 *  says the sauceling has evolved and so has a signature move: more often when happy, never when grumpy. */
export function beatWeights(
  mood: SaucelingMood,
  species: SaucelingSpeciesId,
  hour: number,
  signature = false,
): Record<StageBeat, number> {
  const curious = CURIOUS.includes(species) ? 2 : 1;
  const hummer = HUMMERS.includes(species) ? 3 : 1;
  if (mood === "grumpy") return { wander: 2, idle: 3, look: 1, hop: 0, hum: 0, nap: 0, huff: 3, signature: 0 };
  if (mood === "happy") {
    return { wander: 4, idle: 3, look: curious, hop: 1, hum: hummer, nap: 0, huff: 0, signature: signature ? 1 : 0 };
  }
  const nap = isNight(hour) ? 4 : 1;
  return { wander: 4, idle: 3, look: curious, hop: 0, hum: hummer, nap, huff: 0, signature: signature ? 0.5 : 0 };
}

/** `roll` is a number in [0, 1), so a test can pick any beat. */
export function nextBeat(
  mood: SaucelingMood,
  species: SaucelingSpeciesId,
  hour: number,
  roll: number,
  signature = false,
): StageBeat {
  const weights = beatWeights(mood, species, hour, signature);
  const beats = (Object.keys(weights) as StageBeat[]).filter((beat) => weights[beat] > 0);
  const total = beats.reduce((sum, beat) => sum + weights[beat], 0);
  let left = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (const beat of beats) {
    left -= weights[beat];
    if (left < 0) return beat;
  }
  return beats[beats.length - 1];
}

/** The face a beat wears, or null for the resting face. Each species' happy face is a cheer (arms up, mouth open),
 *  so it comes in bursts: a hop or a hum cheers, as does a good share of a happy sauceling's idle moments (`roll`
 *  in [0, 1)) and now and then a content one's; a huff scowls, and a grumpy sauceling sometimes calms down. */
export function beatFace(beat: StageBeat, mood: SaucelingMood, roll: number): SaucelingMood | null {
  if (beat === "huff") return "grumpy";
  if (beat === "hop" || beat === "hum" || beat === "signature") return mood === "grumpy" ? null : "happy";
  if (beat !== "idle") return null;
  if (mood === "happy") return roll < 0.6 ? "happy" : null;
  if (mood === "content") return roll < 0.25 ? "happy" : null;
  return roll < 0.3 ? "content" : null;
}

/** The face a sauceling shows: a care reaction's (food, play and a pat cheer it up, a grumpy one only softens, rest
 *  calms it), else its beat's, else its resting face, where a happy one rests on its content face rather than
 *  holding a cheer. */
export function shownFace(
  mood: SaucelingMood,
  action: SaucelingUserAction | null,
  beat: SaucelingMood | null,
): SaucelingMood {
  if (action === "rest") return "content";
  if (action) return mood === "grumpy" ? "content" : "happy";
  return beat ?? (mood === "happy" ? "content" : mood);
}

/** The sprite frame's leftmost and rightmost positions: the creature stays on the stage, its empty margin may not. */
export function walkBounds(stageArtWidth: number): { min: number; max: number } {
  return { min: -OVERHANG, max: Math.max(-OVERHANG, Math.floor(stageArtWidth) - FRAME + OVERHANG) };
}

export function clampTarget(x: number, stageArtWidth: number): number {
  const { min, max } = walkBounds(stageArtWidth);
  return Math.round(Math.min(Math.max(x, min), max));
}

/** The share of the stage's width a caretaker standing at its right takes up; the pet keeps to the rest. */
export const CARETAKER_SHARE = 0.3;

/** The width, in art pixels, the pet walks in: the whole stage, or the part left of a standing caretaker. */
export function walkWidth(stageArtWidth: number, withCaretaker: boolean): number {
  return withCaretaker ? Math.floor(stageArtWidth * (1 - CARETAKER_SHARE)) : stageArtWidth;
}

/** Where a sprite stands to be centred on the stage. */
export function centreX(stageArtWidth: number): number {
  return clampTarget((stageArtWidth - FRAME) / 2, stageArtWidth);
}

export function walkMs(distance: number, mood: SaucelingMood): number {
  return Math.max(200, Math.round((Math.abs(distance) / SPEED[mood]) * 1000));
}

/** How fast a sauceling hurries over to its caretaker for a care, in art pixels per second, and the longest that
 *  takes, so the care never waits long. */
const HURRY_SPEED = 48;
const HURRY_MAX_MS = 1000;

export function hurryMs(distance: number): number {
  return Math.min(HURRY_MAX_MS, Math.max(200, Math.round((Math.abs(distance) / HURRY_SPEED) * 1000)));
}
