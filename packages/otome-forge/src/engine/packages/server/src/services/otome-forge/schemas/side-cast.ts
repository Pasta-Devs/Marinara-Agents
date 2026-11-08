// ──────────────────────────────────────────────
// Otome Hearth: the `${R}:sides` document (0.20.0), the story's side characters, read back into its full shape
// ──────────────────────────────────────────────
// One record per side character who spoke in a scene read to its end (S/story/side-cast.ts decides who), keyed by
// nameKey(name), the name's core words (S/names.ts), so "Lady Arlecchino" and "Arlecchino" are one person. A record keeps
// the distinct chapters they spoke in, the Engine card their name matches, their look once written (English image tags)
// and their sprite's paint and cut-out (S/art/side-sprites.ts). A damaged record or field is dropped on read; the newest
// SIDE_PEOPLE_MAX speakers and each one's newest SIDE_CHAPTERS_MAX chapters are kept.
import { z, type ZodType } from "zod";
import type { Cutout, Paint, Presentation } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { isChapterKey } from "../ids.js";
import { PaintSchema, isRecord, normalizeCutouts } from "./common.js";

/** The most side characters a story keeps (the newest speakers). */
export const SIDE_PEOPLE_MAX = 200;
/** The most chapters kept per side character (the newest); two different ones are all that qualifying needs. */
export const SIDE_CHAPTERS_MAX = 24;
export const SIDE_NAME_MAX = 120;
const LINE_MAX = 600;

/** Their look, written once by the look call: English, visual-only tags, as a love interest's bible look is. */
export interface SideLook {
  identityLine: string;
  outfitLine: string;
  presentation: Presentation;
  at: string;
}

export interface SidePerson {
  /** nameKey(name): one key per person. */
  key: string;
  /** Their name as they last spoke under it. */
  name: string;
  /** The chapters they spoke in, each once, in the order first heard. */
  chapters: string[];
  /** Their voice as the beat gave it (Segment.gender): a card's sprite is drawn as this presentation. */
  voice?: "male" | "female";
  /** The Engine character card their name matches (S/story/side-cast.ts matchCard). */
  cardId?: string;
  /** Their look (not for a card, whose own Appearance stands in). */
  look?: SideLook;
  /** Their sprite's paint record (S/art/paint.ts rules). */
  art?: Paint;
  /** The sprite's free cut-out, keyed by the painted image's URL (S/art/cutout.ts). */
  cutouts?: Record<string, Cutout>;
  /** When they last spoke in a scene read to its end. */
  at: string;
}

/** `${R}:sides` */
export interface SideCast {
  version: 1;
  /** Set once the scenes read before this record existed were recorded (on opening the story). */
  backfilled?: string;
  people: Record<string, SidePerson>;
}

const LookSchema: ZodType<SideLook> = z.object({
  identityLine: z.string().max(LINE_MAX),
  outfitLine: z.string().max(LINE_MAX),
  presentation: z.enum(["man", "woman", "person"]),
  at: z.string(),
});

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function normalizePerson(key: string, raw: unknown): SidePerson | null {
  if (!isRecord(raw) || !key || key.length > SIDE_NAME_MAX) return null;
  const name = text(raw.name, SIDE_NAME_MAX);
  if (!name) return null;
  const chapters = [
    ...new Set((Array.isArray(raw.chapters) ? raw.chapters : []).filter((chapter) => isChapterKey(chapter))),
  ].slice(-SIDE_CHAPTERS_MAX);
  const look = LookSchema.safeParse(raw.look);
  const art = PaintSchema.safeParse(raw.art);
  const cutouts = normalizeCutouts(raw.cutouts);
  const cardId = text(raw.cardId, 200);
  return {
    key,
    name,
    chapters,
    ...(raw.voice === "male" || raw.voice === "female" ? { voice: raw.voice } : {}),
    ...(cardId ? { cardId } : {}),
    ...(look.success && look.data.identityLine.trim() ? { look: look.data } : {}),
    ...(art.success ? { art: art.data } : {}),
    ...(Object.keys(cutouts).length ? { cutouts } : {}),
    at: typeof raw.at === "string" ? raw.at : "",
  };
}

/** The document as stored; anything damaged is dropped, record by record. */
export function normalizeSideCast(data: unknown): SideCast {
  const raw = isRecord(data) ? data : {};
  const people = Object.entries(isRecord(raw.people) ? raw.people : {})
    .flatMap(([key, person]) => normalizePerson(key, person) ?? [])
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, SIDE_PEOPLE_MAX);
  return {
    version: 1,
    ...(typeof raw.backfilled === "string" ? { backfilled: raw.backfilled } : {}),
    people: Object.fromEntries(people.map((person) => [person.key, person])),
  };
}

/**
 * Due a sprite: spoken in two different chapters, or matched to an Engine card at once. His side's retelling of a scene
 * (`side-<li>-<arc>`) is the same scene again, so it never makes someone recurring.
 */
export const qualifies = (person: Pick<SidePerson, "chapters" | "cardId">) =>
  !!person.cardId || person.chapters.filter((key) => !key.startsWith("side-")).length >= 2;
