// ──────────────────────────────────────────────
// Otome Forge: dates (plan M5 "Date Night", design: Mini-games; #2303, won from Wish). A date's place and premise,
// whoever the player takes, her look, scenes of scored choices, an outcome that always pays its first-timers, and a
// keepsake painted only when asked for
// ──────────────────────────────────────────────
// - Start (POST /dates/pulled, #2303): a date won on Wish's Dates banner (an owned date5 or date4 item), taken with
//   one love interest or several. P26 plans it from the item's premise, place and scenes as a chapter `date-<n>` of kind
//   "date" with the item's number of beat nodes, everyone in each, and the date's own plan (`chapter.date`: the item,
//   its cast, its newcomers, goesWrong, the keepsake brief; a 5★'s `grand` and its key image node, keyImageScene). A
//   date is written once per love interest: a company with nobody new to it is refused (409 `conflict`: it replays
//   from the Album), one with the same company still open is returned (a double tap, a retry, a reopened screen), and
//   the check runs again inside the run's foreground queue, so two requests never plan two dates. A pulled date is
//   never Make it right.
// - Date Night is no longer started. Its evenings already saved (`date-<n>` with no item) are listed, read, finished
//   and kept as before: one planned as Make it right stays one only while its rupture stands (SH/dates.ts
//   stillToMend), and its scenes and finish follow that, as do a double date's (#2283 `second`) and an evening to
//   clear the air (#2156 `clearAir`).
// - P26 and the date's scenes see the state as the date's love interest may know it (S/prompts.ts ownView, M3's
//   rule): no grievance, disclosure or ledger line another love interest's own chapter left behind reaches them. Both
//   carry that love interest's own notebook beside their bible or card (knowsAboutYou, Read Me #1945), so the evening
//   can turn on what they have come to know about the protagonist.
// - The scenes are written and read through the story routes (S/story/beats.ts): each date beat has one choice whose
//   options carry hidden scores, and the client never sees them before the date ends. A date's beats pay nothing on
//   their own; its chapter still counts as read once its last scene is.
// - A gift (#2128): the protagonist may bring one gift bought in the Shop (SH/shop.ts) that she still owns, the
//   aphrodisiac only under NSFW Heat. It is refused before anything is worn or planned (checkPulledDate: 409
//   `conflict` with none left, 409 `locked` for the aphrodisiac under SFW), so a refusal costs nothing, and spent by the same write
//   that registers the new date (giveGift): a resumed date spends nothing, and a refusal there removes the plan just
//   saved. The plan keeps it (`chapter.date.gift`): P26 gives one scene (SH/dates.ts GIFT_BEAT) the giving, the
//   scenes' tasks say it is given now or was given earlier tonight (S/prompts.ts dateFramingText). Memory keeps it as
//   the date's played text does (a date is its love interest's own memory source); it writes no ledger line, which as
//   their newest one would reach surfaces kept SFW (the Home note, Read Him, Read Me).
// - Finish (POST /dates/:key/finish): once the last scene is read, the total over the first-play picks gives the
//   outcome (SH/dates.ts dateOutcome). One revision-checked write of `${R}:state` counts it exactly once: 120 Starlight
//   and 100 affection within the day's activity caps, whatever the outcome (failure pays; caps limit rewards, never
//   play), the affection split evenly among those it pays (SH/dates.ts datePayees: a pulled date's first-timers,
//   Date Night's love interest or two), a gift's own affection (SH/shop.ts GIFT_AFFECTION) beside it, split among
//   everyone on the date and never capped as it was paid for in Starlight (its own `gift` grant), the "first date"
//   timeline entry for each it pays, and on a Make it right date whose rupture still
//   stands, whose every scene had its choice made and whose outcome is good or great, the rupture's grievance addressed
//   (whether it mends is the player's choices: a scene eased off before its choice decides nothing). The rupture then
//   clears, or stands on the next rupture-severity grievance still owed, as a scene's resolve moves it, and the date
//   mended it only when none is left. The once-only mark is the finish's own entry in `chapters[key].applied`
//   (`${nodes}/finish`, applied through applyChoiceEffects); a Make it right finish leaves what it found beside it
//   (`${nodes}/make-it-right-mended` or `-standing`). A replay answers with the same outcome, the same mend and no
//   grants.
// - #2156: while his grievance with her stands (SH/dates.ts heldAgainst) every date with him waits: the Dates hub opens
//   none, and starting (or resuming) a date with him in it and finishing one, starting, answering or finishing Read
//   Them, Read Me or Tarot night, finishing a Claw round or a Kitty Cards game, and the Photo Shoot are a 409 `locked`
//   before anything is worn, spent, planned, painted, saved or paid (assertFreeToDate, checkPulledDate, or
//   assertNotHeld inside the write that pays). Nothing is lost: an open one goes on once his repair has cleared it.
//   #2303: accepting his invitation to clear the air opens a scene of its own (S/phone/upset.ts), no longer a date.
// - Privacy: a completed date is a `character-story` memory source with `audience: [li]` (S/story/canon.ts
//   readStorySources), and (#2303) everyone else taken on it too, as GF's bond chapter: summarized and folded into the
//   shared overview, titled private, while only their own readers and scenes they are in recall it in detail. It is
//   never an Engine Scene.
// - Keepsake (POST /art/keepsake): painted only on the player's tap, through the M1 image client, once the date is
//   finished; the client asks first when Ask before painting is on, and shows the prompt when the Engine reviews image
//   prompts. Its record follows the paid-work rules (art/paint.ts): pending before the paid call, a failure saved and
//   never repainted without another tap, a pending record with no live paint here read as stopped, and a ready one
//   never painted again.
import type { ForgeMemoryJob } from "@forge-kit/story-memory.mjs";
import { z, type ZodType } from "zod";
import type {
  ActivityGrant,
  Beat,
  Chapter,
  ChapterNode,
  LiId,
  LiState,
  Paint,
  RunState,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  LIMIT_IDS,
  type ContentSettings,
  type LimitId,
} from "../../../../../client/src/features/otome-forge/shared/content.js";
import {
  BASE_LOOK,
  DATE_BEATS,
  PULLED_PLACE,
  dateCast,
  dateOutcome,
  datePayees,
  heldAgainst,
  keyImageScene,
  newcomersOf,
  stillToMend,
  type DateEntry,
  type DateFinishResult,
  type DateOutcome,
  type DatePick,
  type DatePlan,
  type DatesView,
  type PulledDate,
  type PulledDateInput,
} from "../../../../../client/src/features/otome-forge/shared/dates.js";
import { isDateKind, type Item } from "../../../../../client/src/features/otome-forge/shared/wish.js";
import {
  AFFECTION_EARNINGS,
  STARLIGHT_EARNINGS,
  splitEvenly,
} from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { sameName } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { GIFT_AFFECTION, giftsFor, type GiftId } from "../../../../../client/src/features/otome-forge/shared/shop.js";
import { cgReferences, cgSubjects, outfitCutouts } from "../art/cg.js";
import { galleryRef, worldStyle, type ImageClient } from "../art/image-client.js";
import { imagesOf, updateIfChanged, type ArtDeps } from "../art/paint.js";
import { placeKey } from "../art/places.js";
import {
  type ImagePrompt,
  type KeepsakePerson,
  SCENE_SIZE,
  datePlanMessages,
  keepsakePrompt,
  wornOutfitLine,
} from "../prompts.js";
import { generateJson, runForeground } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { chapterId, runDocTarget, stateId, worldId } from "../ids.js";
import { PLACES_MAX, normalizeWorld } from "../schemas/world.js";
import { defaultLiState, keepTimeline, normalizeState, readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import { withPersonaImageAppearance } from "../setup/cast.js";
import { applyChoiceEffects } from "../state/relationship.js";
import { grant } from "../state/rewards.js";
import type { OtomeStore } from "../store.js";
import { canonPicks, type BeatDeps } from "../story/beats.js";
import { itemView, readItem } from "../items/open.js";
import { canonicalSegments, readBeat, readChapter, recallText } from "../story/canon.js";
import { ANGST_TYPES, CHAPTER_TAGS } from "../story/replies.js";
import { withPersonaStoryAbout } from "../setup/cast.js";

export type DateDeps = BeatDeps & {
  runtime: ArtDeps["runtime"];
  /** The loopback image client by default; tests pass a fake. */
  images?: ImageClient;
};

/** The finish's entry in `chapters[key].applied`, after the beats' own `${i}/choice-<n>` picks. */
const FINISH_CHOICE = "finish";
/** Beside it, what a Make it right finish found: it mended the rupture, or a rupture still stands with them. */
const MEND_MARKS = { mended: "make-it-right-mended", standing: "make-it-right-standing" } as const;
/**
 * Finished dates GET /dates lists of each kind, won dates' playthroughs and Date Night's evenings (each reads its beats
 * for its outcome). Apart, so won dates finished later never push the earlier evenings out of the Album (#2303).
 */
const DATES_LISTED = 24;
const DATE_KEY = /^date-([1-9]\d{0,5})$/;
const TEXT_MAX = 4000;

const runNotFound = () => new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
const dateNotFound = () => new OtomeForgeError(404, "No such date.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");
const conflict = (message: string) => new OtomeForgeError(409, message, "conflict");
const badRequest = (message: string) => new OtomeForgeError(400, message, "bad-request");

const clean = (value: unknown, max = TEXT_MAX) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** #2156: 409 `locked` while his grievance with her stands: every date with him waits until his repair clears it. */
export function assertNotHeld(state: Pick<RunState, "lis">, li: LiId): void {
  if (heldAgainst(state.lis[li])) {
    throw new OtomeForgeError(409, "They need space: your dates wait until you make it right in Routes.", "locked");
  }
}

/** #2156: assertNotHeld on the run's state as it is now, the first thing a date route does (nothing else is read). */
export async function assertFreeToDate(store: Pick<OtomeStore, "readDoc">, runId: string, li: LiId): Promise<void> {
  const state = await store.readDoc(stateId(runId), normalizeState);
  if (state) assertNotHeld(state, li);
}

export const isDateKey = (value: unknown): value is string => typeof value === "string" && DATE_KEY.test(value);

/** The mark the date's finish leaves in `chapters[key].applied`. */
const finishMark = (chapter: Pick<Chapter, "nodes">) => `${chapter.nodes.length}/${FINISH_CHOICE}`;

const isFinished = (state: RunState, chapter: Chapter) =>
  !!state.chapters[chapter.key]?.applied.includes(finishMark(chapter));

const mendMark = (chapter: Pick<Chapter, "nodes">, found: keyof typeof MEND_MARKS) =>
  `${chapter.nodes.length}/${MEND_MARKS[found]}`;

/** What a finished date's Make it right found when it was counted: "mended", "standing", or null (not one then). */
function mendFound(state: RunState, chapter: Chapter): keyof typeof MEND_MARKS | null {
  const applied = state.chapters[chapter.key]?.applied ?? [];
  if (applied.includes(mendMark(chapter, "mended"))) return "mended";
  return applied.includes(mendMark(chapter, "standing")) ? "standing" : null;
}

// ── P26 date-plan (structured, 0.9, planner contract) ──

export interface DatePlanReply {
  title: string;
  place: string;
  tags?: string[] | null;
  goesWrong: boolean;
  seed?: { type: string; text: string } | null;
  beats: Array<{ guide: string }>;
  keepsake: { brief: string };
}

const text = (max: number) => z.string().max(max);

export const DatePlanReplySchema: ZodType<DatePlanReply> = z.object({
  title: text(200).min(1),
  place: text(120).min(1),
  tags: z.array(text(40)).max(12).nullable().optional(),
  goesWrong: z.boolean(),
  seed: z
    .object({ type: text(80), text: text(600) })
    .nullable()
    .optional(),
  beats: z
    .array(z.object({ guide: text(TEXT_MAX).min(1) }))
    .min(1)
    .max(6),
  keepsake: z.object({ brief: text(1200).min(1) }),
});

export interface PlannedDate {
  title: string;
  placeName: string;
  tags: string[];
  goesWrong: boolean;
  seed: { type: string; text: string } | null;
  guides: string[];
  brief: string;
}

/** The reply as a date, or the first rule it breaks (the repair turn names it). A seed that cannot apply is dropped. */
export function normalizeDatePlanReply(
  reply: DatePlanReply,
  context: {
    world: Pick<World, "content">;
    liState: Pick<LiState, "angst">;
    /** A story place's own name, which the date keeps whatever the reply calls it. */
    placeName?: string;
    /** #2303: how many beats the date has (a pulled date's item's scenes); Date Night's three by default. */
    beats?: number;
  },
): PlannedDate | string {
  const count = context.beats ?? DATE_BEATS;
  const guides = reply.beats.map((beat) => clean(beat.guide)).filter(Boolean);
  if (guides.length !== count || reply.beats.length !== count) {
    return `the date needs exactly ${count} beats, each with a guide`;
  }
  const tags = [
    ...new Set((reply.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter((tag) => CHAPTER_TAGS.includes(tag))),
  ];
  const lines = tags.filter(
    (tag): tag is LimitId =>
      (LIMIT_IDS as readonly string[]).includes(tag) && context.world.content.limits[tag as LimitId] === "line",
  );
  if (lines.length) return `the date reaches for a Line (${lines.join(", ")}); plan around it instead`;
  const type = clean(reply.seed?.type, 80).toLowerCase();
  const seedText = clean(reply.seed?.text, 600);
  const seed =
    reply.goesWrong &&
    seedText &&
    (ANGST_TYPES as readonly string[]).includes(type) &&
    !context.liState.angst.slice(-2).includes(type)
      ? { type, text: seedText }
      : null;
  return {
    title: clean(reply.title, 200),
    placeName: context.placeName || clean(reply.place, 120),
    tags,
    goesWrong: reply.goesWrong,
    seed,
    guides,
    brief: clean(reply.keepsake.brief, 1200),
  };
}

// ── Reading the run's dates ──

/** A love interest the run has, with a bible (a date needs one), or a 404. */
function partnerOf(run: RunDocuments, li: LiId): Unit {
  const unit = run.units.find((item) => item.id === li);
  if (!run.state.lis[li] || !unit?.bible) throw liNotFound();
  return unit;
}

/** Every date of the run (a chapter of kind "date" with its plan), newest first. */
async function dateChapters(store: Pick<OtomeStore, "listRun">, runId: string): Promise<Chapter[]> {
  const number = (chapter: Chapter) => Number(DATE_KEY.exec(chapter.key)?.[1] ?? 0);
  return (await store.listRun("chapter", runId))
    .map((record) => normalizeChapter(record.data))
    .filter((chapter): chapter is Chapter => !!chapter && chapter.kind === "date" && !!chapter.date)
    .sort((a, b) => number(b) - number(a));
}

// ponytail: one process's set of keepsakes being painted (as art/paint.ts keeps for looks); the upgrade path is M2b's
// PaintOwner claims in art/paint.ts, which take any owner.
const painting = new Set<string>();
const paintKey = (runId: string, key: string) => `${runId}|keepsake:${key}`;

/** The keepsake's record as the client should see it: pending with no live paint here reads as stopped. */
function keepsakeView(runId: string, key: string, art: Paint | undefined): Paint | null {
  if (!art) return null;
  return art.state === "pending" && !painting.has(paintKey(runId, key)) ? { ...art, state: "stopped" } : art;
}

/** The first-play picks of the date's beats and how each landed; a beat eased off before its pick has none. */
export function datePicks(beats: ReadonlyArray<Beat | null>): DatePick[] {
  return beats.flatMap((beat) =>
    beat
      ? canonPicks(beat).map(([choice, option]) => ({
          text: beat.choices.find((item) => item.id === choice)?.options.find((item) => item.id === option)?.text ?? "",
          score: beat.scores?.[choice]?.[option] ?? 0,
        }))
      : [],
  );
}

/** A date's outcome by its picks, against the number of its scenes. */
const outcomeOf = (chapter: Pick<Chapter, "nodes">, picks: readonly DatePick[]): DateOutcome =>
  dateOutcome(
    picks.reduce((total, pick) => total + pick.score, 0),
    chapter.nodes.length,
  );

/** Every scene of the date had its first-play choice made (a scene eased off before its choice has none). */
const everyChoiceMade = (chapter: Pick<Chapter, "nodes">, beats: ReadonlyArray<Beat | null>) =>
  beats.length === chapter.nodes.length && beats.every((beat) => !!beat && canonPicks(beat).length > 0);

const readBeats = (store: Pick<OtomeStore, "readDoc">, runId: string, chapter: Chapter) =>
  Promise.all(chapter.nodes.map((node: ChapterNode) => readBeat(store, runId, chapter.key, node.i)));

/** One date as the client sees it. `outcome` is given for a finished date. */
function entryOf(runId: string, chapter: Chapter, state: RunState, outcome: DateOutcome | null): DateEntry {
  const date = chapter.date!;
  const progress = state.chapters[chapter.key];
  const finished = isFinished(state, chapter);
  return {
    key: chapter.key,
    li: date.li,
    ...(date.second ? { second: date.second } : {}),
    ...(date.item ? { item: date.item, cast: dateCast(date) } : {}),
    title: chapter.title,
    place: date.place,
    placeName: date.placeName,
    makeItRight: finished ? !!mendFound(state, chapter) : !!stillToMend(date, state.lis),
    state: finished ? "finished" : progress?.completed ? "done" : "reading",
    outcome: finished ? outcome : null,
    plannedAt: chapter.plannedAt,
    completedAt: progress?.completed ?? null,
    keepsake: keepsakeView(runId, chapter.key, date.keepsake.art),
    ...(date.gift ? { gift: date.gift } : {}),
  };
}

/**
 * GET /runs/:run/dates: each love interest (a rupture, an open date), the finished dates and (#2303) the open ones,
 * newest first, and each date won from Wish with its playthroughs.
 */
export async function datesView(deps: Pick<DateDeps, "store">, runId: string): Promise<DatesView> {
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  const chapters = await dateChapters(deps.store, runId);
  const owned = new Set(run.state.owned.items);
  // Won dates, newest banner first (owned ids are kept in the order they were won).
  const items = (
    await Promise.all([...run.state.owned.items].reverse().map((id) => readItem(deps.store, runId, id)))
  ).filter((item): item is Item => !!item && isDateKind(item.kind));
  const done = chapters.filter((chapter) => isFinished(run.state, chapter));
  const won = done.filter((chapter) => chapter.date!.item).slice(0, DATES_LISTED);
  const evenings = done.filter((chapter) => !chapter.date!.item).slice(0, DATES_LISTED);
  const finished = done.filter((chapter) => won.includes(chapter) || evenings.includes(chapter));
  // ponytail: reads each listed date's beats for its outcome; the ceiling is 2 × DATES_LISTED dates of up to 6 scenes
  // per visit, and the upgrade path is the outcome kept on the chapter when the date is finished.
  const dates = await Promise.all(
    finished.map(async (chapter) =>
      entryOf(runId, chapter, run.state, outcomeOf(chapter, datePicks(await readBeats(deps.store, runId, chapter)))),
    ),
  );
  const pulled = items.map((item): PulledDate => {
    const plays = chapters.filter((chapter) => chapter.date!.item === item.id);
    return {
      item: itemView(runId, item, owned.has(item.id)),
      plays: plays.map((chapter) => entryOf(runId, chapter, run.state, null)),
      playedBy: [...new Set(plays.flatMap((chapter) => dateCast(chapter.date!)))],
      ...(run.state.owned.unseen.includes(item.id) ? { new: true as const } : {}),
    };
  });
  return {
    dates,
    open: chapters
      .filter((chapter) => !isFinished(run.state, chapter))
      .map((chapter) => entryOf(runId, chapter, run.state, null)),
    pulled,
  };
}

// ── Start ──

/**
 * `state` with one `gift` given (#2128), or the refusal: 409 `locked` for one the story's Heat does not offer (the
 * aphrodisiac under SFW), 409 `conflict` for one she has none of. Pure, so a revision-checked write may run it again; a
 * count left at 0 is dropped when the state is read. A birthday's gift is given the same way (#2153, S/home/birthday.ts).
 */
export function giveGift(state: RunState, content: Pick<ContentSettings, "heat">, gift: GiftId): RunState {
  if (!giftsFor(content).includes(gift)) {
    throw new OtomeForgeError(409, "That gift is given only under NSFW Heat.", "locked");
  }
  const owned = state.owned.gifts[gift] ?? 0;
  if (owned < 1) throw conflict("The protagonist has none of that gift left.");
  return { ...state, owned: { ...state.owned, gifts: { ...state.owned.gifts, [gift]: owned - 1 } } };
}

/** The next free `date-<n>`. */
const nextDateKey = (chapters: readonly Chapter[]) =>
  `date-${chapters.reduce((max, chapter) => Math.max(max, Number(DATE_KEY.exec(chapter.key)?.[1] ?? 0)), 0) + 1}`;

/** #2303: what a pulled date is, as the run has it now: its item, whom it is taken with, and what that makes it. */
interface PulledCheck {
  item: Item;
  units: Unit[];
  /** The playthrough of this date with exactly this company that is not counted yet, to go on with; or null. */
  open: Chapter | null;
  /** Those on it for the first time: a new playthrough is planned for them (none: the date only replays). */
  newcomers: LiId[];
}

/**
 * #2303: checks a pulled date before anything is worn, given or planned, and again inside the run's queue: a company of
 * love interests the story has (404), each once (400), none holding a grievance of their own with her (409 `locked`,
 * first, as every date route), and a date she has won (404). With an open playthrough of this company it goes on;
 * otherwise someone in it must be new to the date (409 `conflict`: it only replays for them), and a gift must be hers
 * to give (giveGift).
 */
async function checkPulled(deps: Pick<DateDeps, "store">, run: RunDocuments, runId: string, input: PulledDateInput) {
  if (!input.cast.length || new Set(input.cast).size !== input.cast.length) {
    throw badRequest("Take one love interest or more, each once.");
  }
  const units = input.cast.map((li) => partnerOf(run, li));
  for (const li of input.cast) assertNotHeld(run.state, li);
  const item = await readItem(deps.store, runId, input.item);
  if (!item || !isDateKind(item.kind) || !run.state.owned.items.includes(item.id)) throw dateNotFound();
  const plays = (await dateChapters(deps.store, runId)).filter((chapter) => chapter.date!.item === item.id);
  const same = (chapter: Chapter) => {
    const cast = dateCast(chapter.date!);
    return cast.length === input.cast.length && cast.every((li) => input.cast.includes(li));
  };
  const open = plays.find((chapter) => same(chapter) && !isFinished(run.state, chapter)) ?? null;
  const newcomers = newcomersOf(
    input.cast,
    plays.flatMap((chapter) => dateCast(chapter.date!)),
  );
  if (!open && !newcomers.length) {
    throw conflict("Everyone you chose has been on this date: read it again from the Album.");
  }
  if (!open && input.gift) giveGift(run.state, run.world.content, input.gift);
  return { item, units, open, newcomers } satisfies PulledCheck;
}

/** POST /dates/pulled's first check (#2303): a refusal before the route wears her look or anything is planned. */
export async function checkPulledDate(
  deps: Pick<DateDeps, "store">,
  runId: string,
  input: PulledDateInput,
): Promise<void> {
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  await checkPulled(deps, run, runId, input);
}

/**
 * POST /runs/:run/dates/pulled (#2303): plans a date won from Wish with whoever the player takes (P26, from the item's
 * premise, place and scenes) and saves it as chapter `date-<n>`, or returns the open playthrough with the same company
 * (`resumed`). The route wears her picked look first; the love interests come as they are dressed now. A 5★ date's
 * scene keyImageScene paints its key image (its node's `cg`). The gift is spent by the write that registers the date.
 */
export async function startPulledDate(
  deps: DateDeps,
  runId: string,
  input: PulledDateInput,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<{ chapter: Chapter; date: DateEntry; resumed: boolean }> {
  const first = await readRun(deps.store, runId);
  if (!first) throw runNotFound();
  if (first.world.forge.phase !== "ready") throw conflict("The world is still being forged.");
  const resume = async (chapter: Chapter) => {
    const state = (await deps.store.readDoc(stateId(runId), normalizeState)) ?? normalizeState(undefined);
    return { chapter, date: entryOf(runId, chapter, state, null), resumed: true };
  };
  const checked = await checkPulled(deps, first, runId, input);
  if (checked.open) return resume(checked.open);
  return runForeground(runId, async () => {
    signal?.throwIfAborted();
    // Read again inside the queue: a request queued behind the one that planned it goes on with that date.
    const run = await readRun(deps.store, runId);
    if (!run) throw runNotFound();
    const { item, units, open, newcomers } = await checkPulled(deps, run, runId, input);
    if (open) return resume(open);
    const [lead] = units as [Unit, ...Unit[]];
    const gift = input.gift;
    const liState = run.state.lis[lead.id] ?? defaultLiState();
    const scenes = item.scenes ?? 1;
    const grand = item.kind === "date5";
    const placeName = clean(item.place?.name ?? "", 120);
    const key = nextDateKey(await dateChapters(deps.store, runId));
    const job: ForgeMemoryJob = "narration";
    const names = units.map((unit) => unit.name);
    const memory = await recallText(deps, runId, {
      job,
      cast: input.cast,
      query: {
        cues: [item.premise ?? "", ...units.map((unit) => unit.bible?.want ?? "")].filter(Boolean),
        plan: [item.title, item.premise ?? ""].filter(Boolean).join(" "),
        speakers: [run.player.name, ...names].filter(Boolean),
      },
      signal,
      debugMode,
    });
    const context = { world: run.world, liState, beats: scenes, ...(placeName ? { placeName } : {}) };
    const { value, connectionId } = await generateJson(deps, {
      runId,
      job,
      label: `date-plan/${key}`,
      messages: datePlanMessages({
        world: run.world,
        player: await withPersonaStoryAbout(deps.runtime, run.player),
        unit: lead,
        others: units.slice(1),
        state: run.state,
        place: PULLED_PLACE,
        pulled: {
          title: item.title,
          premise: item.premise ?? "",
          placeName,
          placeTags: item.place?.tags ?? "",
          scenes,
          ...(grand ? { keyImage: keyImageScene(scenes) } : {}),
        },
        makeItRight: null,
        memory: memory.text,
        gift: gift ?? null,
      }),
      memory,
      schema: DatePlanReplySchema,
      normalize: (reply) => {
        const plan = normalizeDatePlanReply(reply, context);
        return typeof plan === "string" ? plan : reply;
      },
      maxTokens: 2000 + 500 * Math.max(0, scenes - DATE_BEATS),
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const plan = normalizeDatePlanReply(value, context) as PlannedDate;
    const date: DatePlan = {
      li: lead.id,
      place: PULLED_PLACE,
      placeName: plan.placeName,
      herLook: input.herLook,
      hisLook: BASE_LOOK,
      goesWrong: plan.goesWrong,
      makeItRight: null,
      keepsake: { brief: plan.brief },
      ...(gift ? { gift } : {}),
      item: item.id,
      cast: input.cast,
      newcomers,
      ...(grand ? { grand: true as const } : {}),
    };
    const chapter: Chapter = {
      key,
      kind: "date",
      li: lead.id,
      lead: lead.id,
      // The date's own name, whatever the plan calls it.
      title: item.title || plan.title,
      tags: plan.tags,
      summary: "",
      nodes: plan.guides.map((guide, i) => ({
        i,
        kind: "beat",
        guide,
        // Everyone the protagonist took is in every scene.
        cast: input.cast,
        ...(i === 0 && plan.placeName ? { place: plan.placeName } : {}),
        // A 5★ date's key image (#2303), painted as a chapter's key moment is.
        ...(grand && i === keyImageScene(scenes) ? { cg: true } : {}),
      })),
      // A stumble's seed is planted for the date's first love interest when its last scene is read.
      ledger: {
        relationship: [],
        conflict: plan.seed ? [{ id: `c-${key}-1`, li: lead.id, type: plan.seed.type, action: "plant" }] : [],
        offscreen: [],
      },
      plannedAt: new Date().toISOString(),
      connectionId,
      date,
    };
    const saved = await deps.store.mutateDoc(
      runDocTarget("chapter", chapterId(runId, key)),
      normalizeChapter,
      (current) => current ?? chapter,
    );
    // The gift is spent by the write that registers the date, so a date is never saved without it, nor it given twice.
    let state: RunState | null;
    try {
      state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) =>
        current.chapters[key]
          ? current
          : {
              ...(gift ? giveGift(current, run.world.content, gift) : current),
              chapters: { ...current.chapters, [key]: { beatsRead: 0, completed: null, applied: [] } },
            },
      );
    } catch (error) {
      // The gift was given elsewhere while the date was planned: the plan goes, as it would with the run.
      if (gift) await deps.store.removeDoc(chapterId(runId, key));
      throw error;
    }
    if (!state) {
      // The run was deleted while the date was planned: its plan goes too, rather than outlive the run.
      await deps.store.removeDoc(chapterId(runId, key));
      throw runNotFound();
    }
    await keepDatePlace(deps, runId, item);
    const planned = saved ?? chapter;
    return { chapter: planned, date: entryOf(runId, planned, state, null), resumed: false };
  });
}

/**
 * #2303: a 5★ date's picture is its place with nobody in it (the Dates banner's art), so the story takes it as that
 * place's picture once the date is planned: the date's first scene opens on it and pays nothing more. A place the story
 * has a ready picture for already keeps its own. Never thrown: the date is saved, and a failure only paints the place.
 * The gallery image stays while the place holds it, even after a banner or item repaint (the Engine keeps an image a
 * document refers to).
 */
async function keepDatePlace(deps: DateDeps, runId: string, item: Item): Promise<void> {
  const place = item.place;
  const art = item.art;
  if (!place || art?.state !== "ready" || !art.url) return;
  await updateIfChanged(deps.store, runDocTarget("world", worldId(runId)), normalizeWorld, (world) => {
    const key = placeKey(place.name);
    const current = world.places[key];
    if (current?.art?.state === "ready") return undefined;
    if (!current && Object.keys(world.places).length >= PLACES_MAX) return undefined;
    const record = current
      ? { ...current, tags: current.tags.trim() ? current.tags : place.tags }
      : { name: place.name, tags: place.tags };
    return { ...world, places: { ...world.places, [key]: { ...record, art } } };
  }).catch((error: unknown) => {
    deps.runtime.logger.warn(
      "[otome-forge] keeping date %s's place failed: %s",
      item.id,
      error instanceof Error ? error.message : String(error),
    );
  });
}

// ── Finish ──

/** The date love interest's last spoken line of the evening (never a thought), or "". */
function lastLine(beats: ReadonlyArray<Beat | null>, unit: Pick<Unit, "name">, protagonist: string): string {
  for (const beat of [...beats].reverse()) {
    const segments = beat ? (canonicalSegments(beat, protagonist) ?? []) : [];
    const line = [...segments].reverse().find((segment) => !segment.thought && sameName(segment.speaker, unit.name));
    if (line) return line.text;
  }
  return "";
}

/** `state` with `mark` added to the date's `chapters[key].applied`, beside its finish. */
function withMark(state: RunState, key: string, mark: string): RunState {
  const progress = state.chapters[key]!;
  return { ...state, chapters: { ...state.chapters, [key]: { ...progress, applied: [...progress.applied, mark] } } };
}

/** The "first date" entry on the Love Timeline and in his dated firsts, the first time only. */
function withFirstDate(state: RunState, li: LiId, chapter: Chapter, at: string): RunState {
  const current = state.lis[li];
  if (!current || current.firsts.date) return state;
  return {
    ...state,
    lis: { ...state.lis, [li]: { ...current, firsts: { ...current.firsts, date: at } } },
    timeline: keepTimeline([
      ...state.timeline,
      { at, li, kind: "first-date", text: chapter.title.slice(0, 600), ref: chapter.key },
    ]),
  };
}

/**
 * `state` with the affection of the date's gift (#2128) added to its love interest, uncapped (paid for in Starlight,
 * so the day's activity cap never eats it, as a story's earnings are never capped), and pushed onto `grants`.
 */
function withGiftAffection(state: RunState, plan: DatePlan, grants: ActivityGrant[]): RunState {
  if (!plan.gift) return state;
  // #2283: a double date's gift is part of the evening's affection, so it is shared with the invited love interest;
  // #2303: a pulled date's with everyone on it.
  const payees = dateCast(plan).filter((li) => state.lis[li]);
  if (!payees.length) return state;
  const shares = splitEvenly(GIFT_AFFECTION[plan.gift], payees.length);
  const lis = { ...state.lis };
  payees.forEach((li, index) => {
    const affection = shares[index] ?? 0;
    lis[li] = { ...lis[li]!, points: lis[li]!.points + affection };
    if (affection) grants.push({ source: "gift", li, affection });
  });
  return { ...state, lis };
}

/** POST /runs/:run/dates/:key/finish: the outcome, counted exactly once (see the header). */
export async function finishDate(deps: DateDeps, runId: string, key: string): Promise<DateFinishResult> {
  const [run, chapter] = await Promise.all([readRun(deps.store, runId), readChapter(deps.store, runId, key)]);
  if (!run) throw runNotFound();
  if (!chapter || chapter.kind !== "date" || !chapter.date) throw dateNotFound();
  const plan = chapter.date;
  const unit = partnerOf(run, plan.li);
  if (!run.state.chapters[key]?.completed) throw conflict("The date's last scene is not read yet.");
  // The canon is settled: a completed chapter's beats never change again.
  const beats = await readBeats(deps.store, runId, chapter);
  const picks = datePicks(beats);
  const outcome = outcomeOf(chapter, picks);
  // The player's whole evening, well spent: what mends a rupture that still stands when the date is counted.
  const earned = !!plan.makeItRight && everyChoiceMade(chapter, beats) && outcome !== "awkward";
  const at = new Date().toISOString();
  // Set by the write that was saved (updateDoc applies the change again after a stale revision).
  let grants: ActivityGrant[] = [];
  let counted = false;
  let repaired = false;
  const state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    grants = [];
    counted = false;
    repaired = false;
    if (!current.chapters[key]?.completed) throw conflict("The date's last scene is not read yet.");
    // Null for an ordinary date, and for one whose rupture was mended (or moved on) elsewhere since it was planned.
    const standing = stillToMend(plan, current.lis);
    const mend = standing && earned ? standing.id : null;
    const applied = applyChoiceEffects(
      current,
      mend ? [{ li: plan.li, resolve: { id: mend, status: "addressed" } }] : [],
      { key, i: chapter.nodes.length, choice: FINISH_CHOICE, resolves: mend ? [mend] : [], at },
    );
    // A date already counted is returned as it stands, whatever came between (#2156): only a first counting waits
    // out a grievance that stands, of anyone on it.
    if (applied.replay) return current;
    for (const li of dateCast(plan)) assertNotHeld(current, li);
    const after = mend ? applied.state.lis[plan.li] : undefined;
    // Mended as M2b's repair reports it (S/state/stages.ts healRupture): only when no rupture is left with them.
    repaired = !!after && !after.rupture && after.grievances.find((item) => item.id === mend)?.status === "addressed";
    const next = standing
      ? withMark(applied.state, key, mendMark(chapter, repaired ? "mended" : "standing"))
      : applied.state;
    // #2283: a double date's affection is split evenly between the two love interests, each paid on its own so the
    // day's cap applies to each; Starlight is the evening's, paid once. #2303: a pulled date's goes to those on it for
    // the first time (its newcomers).
    const payees = datePayees(plan);
    const shares = splitEvenly(AFFECTION_EARNINGS.date, payees.length);
    let paying: RunState = next;
    let starlightPaid = 0;
    payees.forEach((li, index) => {
      const paid = grant(paying, {
        source: "date",
        starlight: index === 0 ? STARLIGHT_EARNINGS.date : 0,
        li,
        affection: shares[index] ?? 0,
      });
      paying = paid.state;
      if (paid.granted.starlight) starlightPaid += paid.granted.starlight;
      if (paid.granted.affection) grants.push({ source: "date", li, affection: paid.granted.affection });
    });
    if (starlightPaid) grants.unshift({ source: "date", starlight: starlightPaid });
    counted = true;
    const withFirsts = payees.reduce((state, li) => withFirstDate(state, li, chapter, at), paying);
    return withGiftAffection(withFirsts, plan, grants);
  });
  if (!state) throw runNotFound();
  return {
    date: entryOf(runId, chapter, state, outcome),
    outcome,
    picks,
    line: lastLine(beats, unit, run.player.name),
    grants,
    starlight: state.wallet.starlight,
    counted,
    repaired,
    mends: mendFound(state, chapter) === "mended",
    keepsake: { offer: !!run.world.images.connectionId && !!plan.keepsake.brief.trim() },
  };
}

// ── The keepsake ──

/** The finished date's plan, its world, and the two of them as the keepsake draws them. */
async function keepsakeSubject(deps: DateDeps, runId: string, key: string) {
  const [run, chapter] = await Promise.all([readRun(deps.store, runId), readChapter(deps.store, runId, key)]);
  if (!run) throw runNotFound();
  run.player = await withPersonaImageAppearance(deps.runtime, run.player);
  if (!chapter || chapter.kind !== "date" || !chapter.date) throw dateNotFound();
  if (!isFinished(run.state, chapter)) throw conflict("A keepsake is painted once the date is over.");
  const unit = partnerOf(run, chapter.date.li);
  // #2303: on a won date with several, the first two of them with her (a picture holds three people at most). An
  // earlier Date Night double date's brief was written for two, so it keeps drawing its first love interest with her.
  const company = [
    unit,
    ...(chapter.date.cast ?? [])
      .slice(1, 2)
      .flatMap((li) => run.units.filter((candidate) => candidate.id === li && candidate.bible)),
  ];
  const people: KeepsakePerson[] = [
    ...company.map((member) => ({
      name: member.name,
      identityLine: member.identityLine || member.bible!.look.identityLine,
      outfitLine: wornOutfitLine(member) || member.outfitLine || member.bible!.look.outfitLine,
      presentation: member.bible!.look.presentation,
    })),
    {
      name: run.player.name || "Protagonist",
      identityLine: run.player.look.identityLine,
      outfitLine: wornOutfitLine(run.player) || run.player.look.outfitLine,
      presentation: run.player.look.presentation,
    },
  ];
  // Each of them, one reference each in that order, as a story CG sends them: with only his two pictures, the model
  // drew him twice or gave her his body (the maintainer's report, 2026-11-03). By id and role, so a namesake or a
  // protagonist without a name is still each of them.
  // 0.36.5: each person's outfit goes cut out first (free, art/cg.ts), for the paint and its prompt review alike.
  const subjects = await outfitCutouts(
    deps,
    runId,
    cgSubjects([...company.map((member) => member.id), "protagonist"], company, run.player),
  );
  const { units, labels } = cgReferences(subjects);
  return {
    run,
    chapter,
    plan: chapter.date,
    unit,
    // The subjects are the people in the same order; whoever's reference is their outfit is dressed by it (cgPrompt).
    people: people.map((person, index) =>
      subjects[index]?.person.outfitPictured ? { ...person, outfitPictured: true } : person,
    ),
    units,
    references: labels,
  };
}

/** POST /runs/:run/art/keepsake/prompt: the prompt the paint would send (the review dialog shows it). */
export async function keepsakePromptFor(
  deps: DateDeps,
  runId: string,
  key: string,
  edited: Partial<ImagePrompt> = {},
): Promise<ImagePrompt> {
  const { run, plan, people, references } = await keepsakeSubject(deps, runId, key);
  const style = await worldStyle(imagesOf(deps), run.world.images);
  return keepsakePrompt({ brief: plan.keepsake.brief, people, world: run.world, style, references }, edited);
}

/** Saves the keepsake's record on the date's chapter; null when the chapter is gone (the run was deleted). */
async function saveKeepsake(deps: DateDeps, runId: string, key: string, art: Paint): Promise<Chapter | null> {
  return deps.store.updateDoc(runDocTarget("chapter", chapterId(runId, key)), normalizeChapter, (current) => {
    if (!current?.date) throw dateNotFound();
    return { ...current, date: { ...current.date, keepsake: { ...current.date.keepsake, art } } };
  });
}

/**
 * POST /runs/:run/art/keepsake: paints the finished date's keepsake once, on the player's tap. A ready keepsake is
 * returned as it is, a paint already running is a 409 `busy`, and a failed or stopped one is painted again.
 */
export async function paintKeepsake(
  deps: DateDeps,
  runId: string,
  key: string,
  { prompt, negativePrompt, debugMode }: Partial<ImagePrompt> & { debugMode: boolean },
): Promise<Paint> {
  const { run, plan, unit, people, units, references } = await keepsakeSubject(deps, runId, key);
  if (plan.keepsake.art?.state === "ready") return plan.keepsake.art;
  const connectionId = run.world.images.connectionId;
  if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
  const claim = paintKey(runId, key);
  if (painting.has(claim)) throw new OtomeForgeError(409, "This keepsake is already being painted.", "busy");
  painting.add(claim);
  try {
    // Another tap may have finished it between the read above and the claim.
    const latest = (await readChapter(deps.store, runId, key))?.date?.keepsake.art;
    if (latest?.state === "ready") return latest;
    const images = imagesOf(deps);
    const style = await worldStyle(images, run.world.images);
    const built = keepsakePrompt(
      { brief: plan.keepsake.brief, people, world: run.world, style, references },
      { prompt, negativePrompt },
    );
    if (!(await saveKeepsake(deps, runId, key, { state: "pending", at: new Date().toISOString() })))
      throw runNotFound();
    let painted: { url: string; id?: string };
    try {
      painted = await images.generateBannerArt({
        connectionId,
        // The Engine matches the override as `avatar:<slug of the first person's first name>`.
        name: unit.name.split(/\s+/)[0] || "Keepsake",
        units,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        ...SCENE_SIZE,
        debugMode,
      });
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
      deps.runtime.logger.warn("[otome-forge] painting the keepsake of %s failed: %s", key, message);
      const failed: Paint = { state: "failed", at: new Date().toISOString(), error: message };
      await saveKeepsake(deps, runId, key, failed);
      return failed;
    }
    const ref = painted.id ? galleryRef(painted.id) : undefined;
    const ready: Paint = { state: "ready", at: new Date().toISOString(), url: painted.url, ...(ref ? { ref } : {}) };
    let saved: Chapter | null = null;
    try {
      saved = await saveKeepsake(deps, runId, key, ready);
    } finally {
      // Nothing refers to the new image (the run or the date is gone): remove it rather than leave it in the gallery.
      if (!saved && painted.id) await images.deleteGalleryImage(painted.id);
    }
    if (!saved) throw runNotFound();
    return ready;
  } finally {
    painting.delete(claim);
  }
}
