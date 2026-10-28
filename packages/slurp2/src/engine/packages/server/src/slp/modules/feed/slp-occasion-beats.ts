/**
 * Occasion moments: what a running pack event, a Creator's birthday week or their first thousand
 * subscribers brings to their posts (Backstage › Packs). Pure and deterministic, like the life
 * moments it sits beside. See `world/events/slp-content-pack-library.ts` for the moments.
 *
 * ## The rules
 *
 * - **Only where it fits, never watered down.** An occasion that does not fit a Creator is skipped
 *   for them: exam week needs a student, a toy moment needs a Creator whose level reaches it and
 *   whose hard noes allow it, a card sentence that says they never or hate the thing rules it out,
 *   and so does a topic the player asked to leave out. The event's own line still colours the
 *   platform for everybody ("where it fits the Creator").
 * - **In order, on time.** An occasion's moments are spread over its days and go out in order: the
 *   booth before the afterparty, "in two days" before "today". A moment whose time has passed while
 *   the next one is already due is skipped, never posted late. Each one goes out once per Creator.
 * - **With the people in their life.** A moment written for a couple uses the couple partner, one
 *   written for a collab uses someone they collab with; without one the plain line is used.
 * - **Purposes as usual.** A moment that can tease may land on a free teaser slot, which opens the
 *   usual tease → drop; the rest go on ordinary slots. No extra AI call: the post call writes it.
 */
import type { SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";
import {
  SLP_EXPLICIT_LEVELS,
  type SlpExplicitLevelName,
  type SlpTaste,
} from "../../../../../shared/src/slp/slp-spice.js";
import {
  SLURP_BIRTHDAY_BEATS,
  SLURP_FIRST_THOUSAND_SUBS_BEAT,
  type SlurpPackBeat,
  type SlurpPackFit,
} from "../world/events/slp-content-pack-library.js";
import {
  slurpContentPacksOn,
  slurpPackDateBeatsFor,
  slurpPackEventFor,
  type SlurpContentPackToggles,
} from "../world/events/slp-content-packs.js";
import type { SlpOccasion } from "../../../../../shared/src/slp/slp-storyline.js";
import { SLURP_BEAT_TYPES, slurpBeatIntents, type SlurpBeat, type SlurpBeatHistory } from "./slp-post-beat.js";
import { slurpLifeFits, slurpNeverSentences } from "./slp-life-moments.js";
import { SLURP_SHARED_IDEA_DAILY_CAP } from "./slp-shared-preseed.js";
import { slurpWeightedPick } from "./slp-weighted.js";
import { slurpTasteWeight } from "../creators/slp-spice.js";

/** An imported occasion's beats and fit, by its content id; a beat type the planner does not know is dropped. */
function slurpImportedMoments(contentId: string, imported: readonly SlpOccasion[]) {
  const occasion = imported.find((entry) => (entry.contentId ?? entry.id) === contentId);
  if (!occasion) return null;
  const beats = occasion.beats.filter((beat): beat is typeof beat & { type: SlurpPackBeat["type"] } =>
    (SLURP_BEAT_TYPES as readonly string[]).includes(beat.type),
  );
  return { fit: occasion.fit ?? {}, beats: beats as SlurpPackBeat[] };
}

/** One occasion running for this Creator now, with when each of its moments is due. */
export type SlurpOccasion = {
  /** Stable per occasion and year, e.g. `slurpcon:2026-08-14`; moments are stored as `occasion:<key>:<n>`. */
  key: string;
  name: string;
  fit: SlurpPackFit;
  beats: readonly SlurpPackBeat[];
  /** Epoch ms per moment, same length as `beats`. */
  dueAt: readonly number[];
  /** Nothing is posted about it after this. */
  endsAt: number;
};

/** Who the Creator is for fit, and the people a moment may name. */
export type SlurpOccasionCreator = {
  text: string;
  level: SlpExplicitLevelName;
  hardNoes: readonly string[];
  avoid: readonly string[];
  partner: string | null;
  collab: string | null;
};

const DAY_MS = 86_400_000;
const wordsOf = (value: string) => value.toLocaleLowerCase().match(/\p{L}{3,}/gu) ?? [];
const sameWord = (a: string, b: string) =>
  a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

// ponytail: unbounded cache, one entry per distinct word list (built-ins plus imported packs); add an LRU if packs get edited a lot.
const fitPatterns = new Map<string, RegExp>();
/** A fit's word list as one pattern: a word matches whole, `word*` matches a word's start; pack words stay plain text. */
export function slurpFitPattern(words: readonly string[] | undefined): RegExp | undefined {
  if (!words?.length) return undefined;
  const key = words.join("\n");
  let pattern = fitPatterns.get(key);
  if (!pattern) {
    const parts = words.map((word) => {
      const stem = word.endsWith("*") ? word.slice(0, -1) : word;
      const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return word.endsWith("*") ? `${escaped}[\\p{L}\\p{N}]*` : `${escaped}(?![\\p{L}\\p{N}])`;
    });
    pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join("|")})`, "iu");
    fitPatterns.set(key, pattern);
  }
  return pattern;
}

/** Whether an occasion, a pack storyline or one moment fits this Creator. */
export function slurpPackFits(
  fit: SlurpPackFit,
  creator: Pick<SlurpOccasionCreator, "text" | "level" | "hardNoes"> & { avoid?: readonly string[] },
): boolean {
  if (fit.level && SLP_EXPLICIT_LEVELS.indexOf(creator.level) < SLP_EXPLICIT_LEVELS.indexOf(fit.level)) return false;
  if (
    fit.hardNo?.some((word) =>
      creator.hardNoes.some((no) => wordsOf(no).some((part) => wordsOf(word).some((w) => sameWord(part, w)))),
    )
  )
    return false;
  const needs = slurpFitPattern(fit.needs);
  const topic = slurpFitPattern(fit.topic);
  if (topic && (creator.avoid ?? []).some((entry) => topic.test(entry))) return false;
  return slurpLifeFits({ needs, topic }, { text: creator.text, never: slurpNeverSentences(creator.text) });
}

/**
 * Whether a pack topic the player switched off (`contentPacks["<pack>:<topic>"] === false`) rules out
 * this entry of that pack: the same as the topic on the "never" list, but for this pack only.
 * ponytail: checks the entry's own fit (an occasion, a storyline); stage and beat fits inside a pack
 * storyline still run, add the topic to `creator.avoid` per pack in the drama runtime if that matters.
 */
export function slurpPackTopicOff(
  packId: string,
  fit: Pick<SlurpPackFit, "topic" | "needs"> | undefined,
  toggles: Readonly<Record<string, boolean>>,
): boolean {
  const pattern = slurpFitPattern([...(fit?.topic ?? []), ...(fit?.needs ?? [])]);
  if (!pattern) return false;
  const prefix = `${packId}:`;
  return Object.entries(toggles).some(
    ([key, on]) => on === false && key.startsWith(prefix) && pattern.test(key.slice(prefix.length)),
  );
}

/**
 * The moment's words for this Creator: the couple or collab line when they have that person. The
 * moment is always their own post (U: a collab is announced work with a tag and a split, a couple is
 * life), so a named person is in it without a collab tag.
 */
function lineFor(beat: SlurpPackBeat, creator: SlurpOccasionCreator): { line: string; cast: string[] } {
  if (beat.withPartner && creator.partner)
    return {
      line: `${beat.withPartner.replace("{partner}", creator.partner)} This is your own post about your life, not a collab: ${creator.partner} can be in it, but no collab tag.`,
      cast: [creator.partner],
    };
  if (beat.withCollab && creator.collab)
    return {
      line: `${beat.withCollab.replace("{collab}", creator.collab)} This is your own post, not your collab with ${creator.collab}: they can be in it, but no collab tag and no split.`,
      cast: [creator.collab],
    };
  return { line: beat.line, cast: [] };
}

/** The moment of this occasion that is up now for this Creator, or null. */
function dueMoment(occasion: SlurpOccasion, creator: SlurpOccasionCreator, used: ReadonlySet<string>, at: number) {
  if (at >= occasion.endsAt) return null;
  const done = occasion.beats.map((_, index) => used.has(`occasion:${occasion.key}:${index}`));
  const last = done.lastIndexOf(true);
  // The newest moment that is due and comes after the last one posted: an older one is stale.
  for (let index = occasion.beats.length - 1; index > last; index -= 1) {
    const beat = occasion.beats[index]!;
    if (occasion.dueAt[index]! > at) continue;
    if (beat.level && SLP_EXPLICIT_LEVELS.indexOf(creator.level) < SLP_EXPLICIT_LEVELS.indexOf(beat.level)) continue;
    return { beat, index };
  }
  return null;
}

/**
 * Whether this slot is an occasion moment, and which. When a moment is up it takes about two slots
 * in three (it only lasts a few days); a moment that cannot tease never takes a teaser slot.
 */
export function slurpOccasionBeat(input: {
  creatorAccountId: string;
  sequence: number;
  at: Date;
  creator: SlurpOccasionCreator;
  occasions: readonly SlurpOccasion[];
  /** This Creator's stored `occasion:` keys (from their recent plans). */
  used: readonly string[];
  history: Pick<SlurpBeatHistory, "sharedToday">;
  intents: readonly SlurpContentIntent[];
  /** The player's tastes: a moment whose fit shares their words comes up more often. */
  tastes?: readonly SlpTaste[];
}): SlurpBeat | null {
  const used = new Set(input.used);
  const now = input.at.getTime();
  const candidates = input.occasions.flatMap((occasion) => {
    if (!slurpPackFits(occasion.fit, input.creator)) return [];
    const due = dueMoment(occasion, input.creator, used, now);
    if (!due) return [];
    const sharedId = `occasion:${occasion.key}:${due.index}`;
    if ((input.history.sharedToday?.[sharedId] ?? 0) >= SLURP_SHARED_IDEA_DAILY_CAP) return [];
    if (!slurpBeatIntents(due.beat.type).some((intent) => input.intents.includes(intent))) return [];
    return [{ occasion, ...due, sharedId }];
  });
  if (!candidates.length) return null;
  if (
    !slurpWeightedPick("occasion", input.creatorAccountId, input.sequence, [
      { value: true, weight: 2 },
      { value: false, weight: 1 },
    ])
  )
    return null;
  const picked = slurpWeightedPick(
    "occasionPick",
    input.creatorAccountId,
    input.sequence,
    candidates.map((entry) => ({ value: entry, weight: slurpTasteWeight(entry.occasion.fit, input.tastes) })),
  );
  const { line, cast } = lineFor(picked.beat, input.creator);
  return {
    type: picked.beat.type,
    // Like a life moment: something that happens, no lasting change to their life.
    anchorKind: "life",
    anchor: picked.occasion.name,
    line,
    cast,
    place: null,
    sharedId: picked.sharedId,
  };
}

/** The moments of a dated occasion, spread evenly from its start to a little before its end. */
export function slurpSpreadDueAt(startsAt: number, endsAt: number, count: number): number[] {
  const span = Math.max(0, endsAt - startsAt);
  return Array.from({ length: count }, (_, index) => startsAt + Math.floor((span * index) / Math.max(1, count)));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

/**
 * The Creator's birthday as month and day: what the card says ("birthday: March 3", "born on 3rd
 * of March", "Geburtstag am 3. März" in part), else a steady day of their own from their id.
 * ponytail: a few English date shapes and German month names; add formats if cards miss.
 */
export function slurpBirthdayOf(creatorAccountId: string, text: string): { month: number; day: number } {
  const month = (name: string) =>
    MONTHS.indexOf(
      name
        .toLocaleLowerCase()
        .replace(/^mär/u, "mar")
        .replace(/^mai/u, "may")
        .replace(/^okt/u, "oct")
        .replace(/^dez/u, "dec")
        .slice(0, 3) as (typeof MONTHS)[number],
    ) + 1;
  const MONTH =
    "(jan\\w*|feb\\w*|m[aä]r\\w*|apr\\w*|ma[iy]|jun\\w*|jul\\w*|aug\\w*|sep\\w*|o[ck]t\\w*|nov\\w*|de[cz]\\w*)";
  const near = "(?:birthday|born|b-day|bday|geburtstag|geboren)[^.\\n]{0,24}?";
  const dayFirst = new RegExp(`${near}(\\d{1,2})(?:st|nd|rd|th|\\.)?\\s+(?:of\\s+)?${MONTH}`, "iu").exec(text);
  const monthFirst = new RegExp(`${near}${MONTH}\\s+(\\d{1,2})`, "iu").exec(text);
  const found = dayFirst
    ? { month: month(dayFirst[2]!), day: Number(dayFirst[1]) }
    : monthFirst
      ? { month: month(monthFirst[1]!), day: Number(monthFirst[2]) }
      : null;
  if (found && found.month >= 1 && found.day >= 1 && found.day <= 31) return found;
  let hash = 0;
  for (const char of `birthday:${creatorAccountId}`) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  const dayOfYear = Math.abs(hash) % 365;
  const date = new Date(Date.UTC(2025, 0, 1) + dayOfYear * DAY_MS);
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** The birthday occasion when `at` is in the birthday week (two days before to two days after). */
export function slurpBirthdayOccasion(
  birthday: { month: number; day: number },
  beats: readonly SlurpPackBeat[],
  at: Date,
): SlurpOccasion | null {
  for (const year of [at.getUTCFullYear() - 1, at.getUTCFullYear(), at.getUTCFullYear() + 1]) {
    const day = Date.UTC(year, birthday.month - 1, birthday.day);
    const startsAt = day - 2 * DAY_MS;
    const endsAt = day + 2 * DAY_MS;
    if (at.getTime() < startsAt || at.getTime() >= endsAt) continue;
    return {
      key: `birthday:${new Date(day).toISOString().slice(0, 10)}`,
      name: "Birthday",
      // A card that hates birthdays, or a player who wants them left out, skips the week.
      fit: { topic: ["birthday", "birthdays", "geburtstag*"] },
      beats,
      dueAt: [startsAt, day, day + DAY_MS].slice(0, beats.length),
      endsAt,
    };
  }
  return null;
}

/** Just passed a thousand subscribers (and not long ago): the celebration, once. */
export function slurpFirstThousandSubsOccasion(
  subscribers: number,
  beat: SlurpPackBeat,
  at: Date,
): SlurpOccasion | null {
  if (subscribers < 1000 || subscribers >= 1150) return null;
  return {
    key: "first-1k-subs",
    name: "1,000 subscribers",
    fit: {},
    beats: [beat],
    dueAt: [0],
    endsAt: at.getTime() + DAY_MS,
  };
}

/**
 * Every occasion running for one Creator now: the pack events and pack dates in their windows
 * (`slurpRunningPlatformEventWindows`), their birthday week and their first thousand subscribers,
 * each only while its pack is on.
 */
export function slurpPackOccasions(input: {
  /** `dateAt`: the event's own day (an annual event started late still has Halloween night on Oct 31). */
  windows: readonly { contentId: string; name: string; startsAt: number; endsAt: number; dateAt?: number }[];
  toggles: SlurpContentPackToggles;
  /** Occasions of imported packs that are on (docs/STORYLINES.md, PR 5b). */
  imported?: readonly SlpOccasion[];
  creatorAccountId: string;
  creatorText: string;
  subscribers: number;
  at: Date;
}): SlurpOccasion[] {
  const packs = slurpContentPacksOn(input.toggles);
  if (!packs.length && !input.imported?.length) return [];
  const dated = input.windows.flatMap((window) => {
    const moments =
      slurpPackEventFor(window.contentId, input.toggles) ??
      slurpPackDateBeatsFor(window.contentId, input.toggles) ??
      slurpImportedMoments(window.contentId, input.imported ?? []);
    if (!moments?.beats.length) return [];
    const spread = slurpSpreadDueAt(window.startsAt, window.endsAt, moments.beats.length);
    return [
      {
        key: `${window.contentId}:${new Date(window.dateAt ?? window.startsAt).toISOString().slice(0, 10)}`,
        name: window.name,
        fit: moments.fit,
        beats: moments.beats,
        dueAt: moments.beats.map((beat, index) =>
          beat.atDay === undefined ? spread[index]! : (window.dateAt ?? window.startsAt) + beat.atDay * DAY_MS,
        ),
        endsAt: window.endsAt,
      },
    ];
  });
  const birthday = packs.some((pack) => pack.birthday)
    ? slurpBirthdayOccasion(slurpBirthdayOf(input.creatorAccountId, input.creatorText), SLURP_BIRTHDAY_BEATS, input.at)
    : null;
  const subs = packs.some((pack) => pack.firstThousandSubs)
    ? slurpFirstThousandSubsOccasion(input.subscribers, SLURP_FIRST_THOUSAND_SUBS_BEAT, input.at)
    : null;
  return [...dated, ...(birthday ? [birthday] : []), ...(subs ? [subs] : [])];
}
