// ──────────────────────────────────────────────
// Otome Forge: angst as state (design "Angst as state", plan M2a "State rules")
// ──────────────────────────────────────────────
// Trust (−3..+3) and tension (0..3) move only through the effects of a first-play choice, at most ±1 within a beat and
// ±2 within a chapter on each axis, and are never shown. Grievances run both ways: one never closes in the beat that
// opened it, and closes only on a node whose plan lists it in `resolves`. A grievance of severity `rupture` opens a
// rupture, which shuts his gates until a scene forgives or addresses it; while another rupture-severity grievance is
// still owed, the rupture moves to it instead of closing. Nothing unlocked is ever taken back: nothing here touches
// points, levels or stages.
//
// Every function is pure. The choose route applies a pick inside one revision-checked write of `${R}:state`, and the
// pick's `${i}/${choiceId}` in `chapters[key].applied` makes a replay, or a request that lost a race, change nothing.
import { z, type ZodType } from "zod";
import type {
  ChapterProgress,
  Effect,
  Grievance,
  LiId,
  LiState,
  RunState,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  BEAT_SHIFT_MAX,
  CHAPTER_SHIFT_MAX,
  TENSION_MAX,
  TENSION_MIN,
  TRUST_MAX,
  TRUST_MIN,
} from "../../../../../client/src/features/otome-forge/shared/economy.js";

/** The stored text limit of a grievance or a disclosure (S/schemas/state.ts reads longer ones as invalid). */
const TEXT_MAX = 600;
/** Grievances kept per love interest: every unresolved one, then the newest closed ones up to this many in all. */
const GRIEVANCES_MAX = 60;
const DISCLOSURES_MAX = 40;

/**
 * `chapterDelta` with the beat it last moved in, for the per-beat cap. `beat` is optional so a state saved before it
 * existed still reads; S/schemas/state.ts must read the field through ChapterDeltaSchema, or the cap resets per pick.
 */
export type ChapterDelta = LiState["chapterDelta"] & { beat?: { i: number; trust: number; tension: number } };

export const ChapterDeltaSchema: ZodType<ChapterDelta> = z.object({
  key: z.string().max(120),
  trust: z.number().int(),
  tension: z.number().int(),
  beat: z.object({ i: z.number().int().min(0), trust: z.number().int(), tension: z.number().int() }).optional(),
});

/** A grievance still owed: open, or left to fester. */
const isUnresolved = (grievance: Grievance) => grievance.status === "open" || grievance.status === "festering";

/** Where a pick happened, and what its node's plan allows. */
export interface ChoiceContext {
  /** The chapter key. */
  key: string;
  /** The beat's index in the chapter: grievances open at `${key}/${i}`. */
  i: number;
  /** The kit's `choice-<n>` id. */
  choice: string;
  /** The node's plan `resolves`: the only grievance ids a resolve here may close. */
  resolves?: readonly string[];
  /** ISO time of the pick. */
  at: string;
}

export interface ChoiceOutcome {
  state: RunState;
  /**
   * True when the pick changed something between them: trust or tension moved, a grievance opened or closed, or the
   * protagonist told him something. The reader then shows "{name} will remember that." (or "They'll remember that.").
   */
  remembered: boolean;
  /** The love interests that pick changed something with, in the order of its effects (the toast names a lone one). */
  rememberedBy: LiId[];
  /** True when this pick was applied before: the state is returned unchanged. */
  replay: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function clip(text: string): string {
  const characters = [...text.replace(/\s+/g, " ").trim()];
  return characters.length > TEXT_MAX ? `${characters.slice(0, TEXT_MAX - 1).join("")}…` : characters.join("");
}

/**
 * How far one axis actually moves for a wanted shift: within the beat's ±1, then the chapter's ±2, then the axis's own
 * range. The counters count what moved, so a shift lost at the range's end never uses up the beat or the chapter.
 */
function shift(want: number, value: number, chapterSoFar: number, beatSoFar: number, min: number, max: number): number {
  if (!want) return 0;
  const beat = clamp(beatSoFar + Math.sign(want), -BEAT_SHIFT_MAX, BEAT_SHIFT_MAX) - beatSoFar;
  const chapter = clamp(chapterSoFar + beat, -CHAPTER_SHIFT_MAX, CHAPTER_SHIFT_MAX) - chapterSoFar;
  return clamp(value + chapter, min, max) - value;
}

/** His delta counters for this chapter and beat: a new chapter or a new beat starts from 0. */
function deltaFor(li: LiState, key: string, i: number): Required<ChapterDelta> {
  const stored = li.chapterDelta as ChapterDelta;
  const chapter = stored.key === key ? stored : { key, trust: 0, tension: 0 };
  const beat = stored.key === key && stored.beat?.i === i ? stored.beat : { i, trust: 0, tension: 0 };
  return { key, trust: chapter.trust, tension: chapter.tension, beat: { ...beat } };
}

/** Every unresolved grievance, then the newest closed ones, in their order, GRIEVANCES_MAX in all at most. */
function boundGrievances(grievances: Grievance[]): Grievance[] {
  if (grievances.length <= GRIEVANCES_MAX) return grievances;
  let closed = Math.max(0, GRIEVANCES_MAX - grievances.filter(isUnresolved).length);
  const kept = new Set<Grievance>();
  for (let index = grievances.length - 1; index >= 0; index -= 1) {
    const grievance = grievances[index]!;
    if (isUnresolved(grievance)) kept.add(grievance);
    else if (closed > 0) {
      kept.add(grievance);
      closed -= 1;
    }
  }
  return grievances.filter((grievance) => kept.has(grievance));
}

/**
 * Applies the effects of a first-play pick, clamped, in one pure step, and records the pick in `chapters[key].applied`.
 * Effects for a love interest the state does not have are skipped. A pick already in `applied` changes nothing.
 * Points, levels and stages are never touched (nothing unlocked is taken back).
 */
export function applyChoiceEffects(state: RunState, effects: readonly Effect[], context: ChoiceContext): ChoiceOutcome {
  const { key, i, choice, at } = context;
  const pick = `${i}/${choice}`;
  const progress: ChapterProgress = state.chapters[key] ?? { beatsRead: 0, completed: null, applied: [] };
  if (progress.applied.includes(pick)) return { state, remembered: false, rememberedBy: [], replay: true };

  const here = `${key}/${i}`;
  const resolvable = new Set(context.resolves ?? []);
  const lis: Record<LiId, LiState> = { ...state.lis };
  let opened = Object.values(lis).reduce(
    (count, li) => count + li.grievances.filter((grievance) => grievance.opened === here).length,
    0,
  );
  const rememberedBy = new Set<LiId>();

  for (const effect of effects) {
    const current = lis[effect.li];
    if (!current) continue;
    const delta = deltaFor(current, key, i);
    const li: LiState = { ...current, grievances: [...current.grievances], disclosures: [...current.disclosures] };

    const trust = shift(effect.trust ?? 0, li.trust, delta.trust, delta.beat.trust, TRUST_MIN, TRUST_MAX);
    const tension = shift(effect.tension ?? 0, li.tension, delta.tension, delta.beat.tension, TENSION_MIN, TENSION_MAX);
    li.trust += trust;
    li.tension += tension;
    delta.trust += trust;
    delta.tension += tension;
    delta.beat.trust += trust;
    delta.beat.tension += tension;
    li.chapterDelta = delta;
    if (trust || tension) rememberedBy.add(effect.li);

    if (effect.grievance && effect.grievance.text.trim()) {
      const grievance: Grievance = {
        id: `g-${key}-${i}-${opened}`,
        li: effect.li,
        by: effect.grievance.by,
        text: clip(effect.grievance.text),
        severity: effect.grievance.severity,
        opened: here,
        status: "open",
      };
      opened += 1;
      li.grievances.push(grievance);
      if (grievance.severity === "rupture" && !li.rupture) li.rupture = { grievanceId: grievance.id, since: at };
      rememberedBy.add(effect.li);
    }

    if (effect.disclose?.trim()) {
      li.disclosures = [...li.disclosures, { text: clip(effect.disclose), at, ref: here }].slice(-DISCLOSURES_MAX);
      rememberedBy.add(effect.li);
    }

    const resolve = effect.resolve;
    const target = resolve && resolvable.has(resolve.id) ? li.grievances.find((item) => item.id === resolve.id) : null;
    // Never in the beat that opened it, and only once (a closed grievance stays closed).
    if (resolve && target && isUnresolved(target) && target.opened !== here && target.status !== resolve.status) {
      li.grievances = li.grievances.map((item) => (item === target ? { ...item, status: resolve.status } : item));
      if (resolve.status !== "festering" && li.rupture?.grievanceId === target.id) {
        // Another rupture still owed keeps his gates shut (grievances carry no time, so it stands from this pick).
        const next = li.grievances.find((item) => item.severity === "rupture" && isUnresolved(item));
        li.rupture = next ? { grievanceId: next.id, since: at } : null;
      }
      rememberedBy.add(effect.li);
    }

    li.grievances = boundGrievances(li.grievances);
    lis[effect.li] = li;
  }

  return {
    state: {
      ...state,
      lis,
      chapters: { ...state.chapters, [key]: { ...progress, applied: [...progress.applied, pick] } },
    },
    remembered: rememberedBy.size > 0,
    rememberedBy: [...rememberedBy],
    replay: false,
  };
}
