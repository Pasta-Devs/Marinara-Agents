// ──────────────────────────────────────────────
// Otome Forge: Date Night (plan M5 "Date Night", design: Mini-games). A place, two looks, three scenes of scored
// choices, an outcome that always pays, Make it right during a rupture, and a keepsake painted only when asked for
// ──────────────────────────────────────────────
// - Start (POST /dates): P26 plans the date as a chapter `date-<n>` of kind "date" with three beat nodes and the
//   date's own plan (`chapter.date`: place, looks, goesWrong, Make it right, the keepsake brief). One open date per
//   love interest: asking again while it is unfinished returns it (a double tap, a retry, a reopened screen), and the
//   check runs again inside the run's foreground queue, so two requests never plan two dates. While a rupture stands
//   between them the date is "Make it right": the plan targets the rupture's grievance, and P26 and the scenes are told
//   who holds it (the love interest's hurt, or the protagonist's). One already open when a rupture starts stays an
//   ordinary date (it was planned as one), and the Dates hub labels Date Night by the open date (makeItRightView), so
//   the next one is Make it right. A Make it right date stays one only while its rupture stands (SH/dates.ts
//   stillToMend): mended or moved on elsewhere meanwhile, its later scenes, the hub and its finish are an ordinary
//   date's. The place is one of the picker's, the love interest's own pick, or one the story has painted (M2b's
//   world.places): the date then goes there under the name the story gave it, so its scenes open on that place's art.
// - P26 and the date's scenes see the state as the date's love interest may know it (story/prompts.ts ownView, M3's
//   rule): no grievance, disclosure or ledger line another love interest's own chapter left behind reaches them.
// - The scenes are written and read through the story routes (S/story/beats.ts): each date beat has one choice whose
//   options carry hidden scores, and the client never sees them before the date ends. A date's beats pay nothing on
//   their own; its chapter still counts as read once its last scene is.
// - Finish (POST /dates/:key/finish): once the last scene is read, the total over the first-play picks gives the
//   outcome (SH/dates.ts dateOutcome). One revision-checked write of `${R}:state` counts it exactly once: 120 Starlight
//   and 100 affection within the day's activity caps, whatever the outcome (failure pays; caps limit rewards, never
//   play), the "first date" timeline entry, and on a Make it right date whose rupture still stands, whose every scene
//   had its choice made and whose outcome is good or great, the rupture's grievance addressed (whether it mends is the
//   player's choices: a scene eased off before its choice decides nothing). The rupture then clears, or stands on the
//   next rupture-severity grievance still owed, as a scene's resolve moves it, and the date mended it only when none is
//   left. The once-only mark is the finish's own entry in `chapters[key].applied` (`${nodes}/finish`, applied through
//   applyChoiceEffects); a Make it right finish leaves what it found beside it (`${nodes}/make-it-right-mended` or
//   `-standing`). A replay answers with the same outcome, the same mend and no grants.
// - Privacy: a completed date is a `chat` memory source with `audience: [li]` (S/story/canon.ts readStorySources), so
//   only that love interest's own readers and scenes he is in recall it, and it never reaches the shared overview. It
//   is never an Engine Scene.
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
  Grievance,
  LiId,
  LiState,
  Paint,
  PlaceArt,
  Player,
  RunState,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { LIMIT_IDS, type LimitId } from "../../../../../client/src/features/otome-forge/shared/content.js";
import {
  BASE_LOOK,
  DATE_BEATS,
  PARTNER_CHOICE,
  STORY_PLACE,
  dateOutcome,
  standingRupture,
  stillToMend,
  type DateEntry,
  type DateFinishResult,
  type DateOutcome,
  type DatePick,
  type DatePlace,
  type DatePlan,
  type DateStartInput,
  type DatesView,
} from "../../../../../client/src/features/otome-forge/shared/dates.js";
import {
  AFFECTION_EARNINGS,
  STARLIGHT_EARNINGS,
} from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { sameName } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { galleryRef, type ImageClient, type ImageSubject } from "../art/image-client.js";
import { imagesOf, type ArtDeps } from "../art/paint.js";
import { SCENE_SIZE, keepsakePrompt, type ImagePrompt, type KeepsakePerson } from "../art/prompts.js";
import { otomeContentContract, otomeContractReminder } from "../content-contract.js";
import { generateJson, runForeground, type OtomeMessage } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { chapterId, runDocTarget, stateId } from "../ids.js";
import {
  STATE_LIMITS,
  defaultLiState,
  keepNewest,
  normalizeState,
  readRun,
  type RunDocuments,
} from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import { applyChoiceEffects } from "../state/relationship.js";
import { grant } from "../state/rewards.js";
import type { OtomeStore } from "../store.js";
import { canonPicks, type BeatDeps } from "../story/beats.js";
import { canonicalSegments, readBeat, readChapter, recallText } from "../story/canon.js";
import { ANGST_TYPES, CHAPTER_TAGS, bibleBlock, ownView, protagonistBlock } from "../story/prompts.js";
import { otomeWritingRules } from "../writing-rules.js";

export type DateDeps = BeatDeps & {
  runtime: ArtDeps["runtime"];
  /** The loopback image client by default; tests pass a fake. */
  images?: ImageClient;
};

/** The finish's entry in `chapters[key].applied`, after the beats' own `${i}/choice-<n>` picks. */
const FINISH_CHOICE = "finish";
/** Beside it, what a Make it right finish found: it mended the rupture, or a rupture still stands with them. */
const MEND_MARKS = { mended: "make-it-right-mended", standing: "make-it-right-standing" } as const;
/** Finished dates GET /dates lists (each reads its beats for its outcome). */
const DATES_LISTED = 24;
const DATE_KEY = /^date-([1-9]\d{0,5})$/;
const TEXT_MAX = 4000;

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const dateNotFound = () => new OtomeForgeError(404, "No such date.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");
const conflict = (message: string) => new OtomeForgeError(409, message, "conflict");

const clean = (value: unknown, max = TEXT_MAX) => (typeof value === "string" ? value.trim().slice(0, max) : "");

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

/** What each place is, for the planner; it adapts the place to the world and names it in the world's language. */
const PLACE_SPIRIT: Record<Exclude<DatePlace, typeof PARTNER_CHOICE | typeof STORY_PLACE>, string> = {
  aquarium: "a night aquarium after closing: blue light through the tanks, jellyfish drifting, footsteps echoing",
  rooftop: "a rooftop garden above the lights of the city: strung lanterns, potted lemon trees, the wind",
  bookshop: "an old bookshop after hours: narrow aisles, a hidden reading nook, the smell of paper",
  "night-market": "a night market: lanterns, food stalls, a crowd to get lost in together",
  observatory: "an observatory on a hill: a great telescope, a dome opened to the stars",
  seaside: "the seaside at dusk: a long shore, cold water at their feet, the last of the light",
  cafe: "a small café on a rainy evening: fogged windows, a corner table, something warm to drink",
  fairground: "a fairground at night: a Ferris wheel, games of chance, sugar in the air",
};

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

export interface DatePlanInput {
  world: World;
  player: Player;
  unit: Unit;
  /** The run's state; the planner sees it as the date's love interest may know it (ownView). */
  state: RunState;
  place: DatePlace;
  /** With place "story": the painted place the date goes to. */
  storyPlace?: Pick<PlaceArt, "name" | "tags"> | null;
  /** The rupture's grievance this date tries to mend, or null. */
  makeItRight: Grievance | null;
  /** Recalled memory (the kit's text), or "". */
  memory: string;
}

/** P26: the date's plan. Messages in the plan's order (§1.7); the planner gets the full bible. */
export function datePlanMessages({
  world,
  player,
  unit,
  state,
  place,
  storyPlace = null,
  makeItRight,
  memory,
}: DatePlanInput): OtomeMessage[] {
  const name = unit.name;
  const { liState } = ownView(state, unit.id);
  const recent = liState.angst.slice(-2);
  // The rupture is always named (it is how they are now), with who holds it; its grievance only when it came from what
  // they may know.
  const mendText = makeItRight ? liState.grievances.find((item) => item.id === makeItRight.id)?.text : undefined;
  const system = [
    `You plan one DATE in an otome visual novel, a character-driven romance: an evening the protagonist and ${name} spend together. A narrator writes it later as ${DATE_BEATS} scenes the player reads, each with one choice the player makes.`,
    "Reply with ONLY a JSON object of this shape:",
    '{"title": "...", "place": "...", "tags": ["..."], "goesWrong": false, "seed": {"type": "...", "text": "..."}, "beats": [{"guide": "..."}, {"guide": "..."}, {"guide": "..."}], "keepsake": {"brief": "..."}}',
    "FIELDS",
    `- title: the date's name, 2 to 6 words; it never gives away how the evening turns.`,
    storyPlace
      ? "- place: the name of the place given below, exactly as written there."
      : "- place: where the date happens, named as this world would name it.",
    `- beats: exactly ${DATE_BEATS} guides in play order, 2 to 4 sentences each, for the narrator: what happens, what ${name} wants in that scene besides the protagonist, the moment where what the protagonist does matters to ${name} (the scene's one choice goes there), and where it leaves things. The evening builds: arriving, the heart of it, how it ends.`,
    `- goesWrong: true when the evening should stumble somewhere real (an old wound brushed, a jealousy, an interruption, a misread), when the story so far gives it a reason; false for an evening that goes as hoped.`,
    `- seed: only when goesWrong: the conflict the stumble plants. type from: ${ANGST_TYPES.join(", ")}${recent.length ? `, never one of ${name}'s last kinds of angst (${recent.join(", ")})` : ""}; text: one line on it. Omit it otherwise.`,
    `- keepsake.brief: one or two plain English sentences on the picture that would remember this date: where and how it is shot (place, light, framing, what the two of them are doing), never anyone's looks.`,
    `- tags: content tags a reader should see before it starts, from: ${CHAPTER_TAGS.join(", ")}. [] when none apply.`,
    "RULES",
    `- The date is the protagonist and ${name}; anyone else stays at the edges of it.`,
    `- It does not move ${name}'s stage, never reveals a secret before its stage, and never solves the story's mystery.`,
    "- A stumble is small: at most a minor hurt, never a break-up and never a rupture.",
    ...(makeItRight
      ? [
          makeItRight.by === "protagonist"
            ? `- This is a MAKE IT RIGHT date: a rupture stands between them, and it is the protagonist who was hurt. Plan the evening as ${name}'s attempt to earn back the protagonist's trust: each scene gives ${name} a real chance to make amends in their own way, and the protagonist's hurt is honest. Whether it mends is decided by the player's choices, never by the guides: no guide resolves it.`
            : `- This is a MAKE IT RIGHT date: a rupture stands between them. Plan the evening as the protagonist's attempt to mend it: each scene gives them a real chance to make amends in their own way, and ${name}'s hurt is honest. Whether it mends is decided by the player's choices, never by the guides: no guide resolves it.`,
        ]
      : []),
    `- Write the title, the place and every guide in ${world.language}; the keepsake brief in English.`,
    "- Omit an optional field rather than writing null.",
    "",
    otomeWritingRules({ story: true }),
    "",
    otomeContentContract({ world, lis: [{ name }], kind: "planner" }),
  ].join("\n");
  const wear = (who: string, line: string) => (line.trim() ? `- ${who}: ${line.trim()}` : "");
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    world.mystery.question ? `The mystery: ${world.mystery.question}` : "",
    "",
    "PROTAGONIST",
    protagonistBlock(player),
    "",
    `THE DATE'S LOVE INTEREST (full bible; this date does not move the stage)`,
    bibleBlock(unit, state, [unit.id]),
    "",
    "THE PLACE",
    place === PARTNER_CHOICE
      ? `${name} chooses where to take the protagonist: somewhere that says something true about ${name} (from their likes, their past or their world).`
      : place === STORY_PLACE
        ? `"${storyPlace?.name ?? ""}", a place in this world${storyPlace?.tags.trim() ? ` (${storyPlace.tags.trim()})` : ""}. The date goes there: keep that name for it.`
        : `${PLACE_SPIRIT[place]}. Adapt it to this world's setting and era, keeping its spirit.`,
    "",
    "WHAT THEY WEAR (image tags; describe them in words if at all)",
    wear(name, unit.outfitLine || unit.bible?.look.outfitLine || ""),
    wear(player.name || "The protagonist", player.look.outfitLine),
    makeItRight ? `\nMAKE IT RIGHT\nThe rupture (${makeItRight.id})${mendText ? `: ${mendText}` : ""}` : "",
    "",
    memory.trim() ? `STORY MEMORY\n${memory.trim()}` : "",
    "",
    `Plan the date with ${name} (id ${unit.id}) now.`,
    otomeContractReminder("planner"),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

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
  },
): PlannedDate | string {
  const guides = reply.beats.map((beat) => clean(beat.guide)).filter(Boolean);
  if (guides.length !== DATE_BEATS || reply.beats.length !== DATE_BEATS) {
    return `the date needs exactly ${DATE_BEATS} beats, each with a guide`;
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

/** The love interests a date can be with, in cast order. */
const castOf = (run: RunDocuments) =>
  Object.keys(run.state.lis).filter((li) => run.units.some((unit) => unit.id === li && unit.bible));

/** Every date of the run (a chapter of kind "date" with its plan), newest first. */
async function dateChapters(store: Pick<OtomeStore, "listRun">, runId: string): Promise<Chapter[]> {
  const number = (chapter: Chapter) => Number(DATE_KEY.exec(chapter.key)?.[1] ?? 0);
  return (await store.listRun("chapter", runId))
    .map((record) => normalizeChapter(record.data))
    .filter((chapter): chapter is Chapter => !!chapter && chapter.kind === "date" && !!chapter.date)
    .sort((a, b) => number(b) - number(a));
}

/** The newest unfinished date with `li` and the state it was read with, or null. */
async function openDateWith(
  store: OtomeStore,
  runId: string,
  li: LiId,
): Promise<{ chapter: Chapter; state: RunState } | null> {
  const [chapters, stored] = await Promise.all([
    dateChapters(store, runId),
    store.readDoc(stateId(runId), normalizeState),
  ]);
  const state = stored ?? normalizeState(undefined);
  const chapter = chapters.find((item) => item.date!.li === li && !isFinished(state, item));
  return chapter ? { chapter, state } : null;
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

const outcomeOf = (picks: readonly DatePick[]): DateOutcome =>
  dateOutcome(picks.reduce((total, pick) => total + pick.score, 0));

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
    title: chapter.title,
    place: date.place,
    placeName: date.placeName,
    makeItRight: finished ? !!mendFound(state, chapter) : !!stillToMend(date, state.lis),
    state: finished ? "finished" : progress?.completed ? "done" : "reading",
    outcome: finished ? outcome : null,
    plannedAt: chapter.plannedAt,
    completedAt: progress?.completed ?? null,
    keepsake: keepsakeView(runId, chapter.key, date.keepsake.art),
  };
}

/** GET /runs/:run/dates: each love interest (a rupture, an open date), and the finished dates, newest first. */
export async function datesView(deps: Pick<DateDeps, "store">, runId: string): Promise<DatesView> {
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  const chapters = await dateChapters(deps.store, runId);
  const finished = chapters.filter((chapter) => isFinished(run.state, chapter)).slice(0, DATES_LISTED);
  // ponytail: reads each listed date's beats for its outcome; the ceiling is DATES_LISTED × 3 reads per visit, and
  // the upgrade path is the outcome kept on the chapter when the date is finished.
  const dates = await Promise.all(
    finished.map(async (chapter) =>
      entryOf(runId, chapter, run.state, outcomeOf(datePicks(await readBeats(deps.store, runId, chapter)))),
    ),
  );
  const open = (li: LiId) => {
    const chapter = chapters.find((item) => item.date!.li === li && !isFinished(run.state, item));
    return chapter ? entryOf(runId, chapter, run.state, null) : null;
  };
  return {
    lis: castOf(run).map((li) => ({ li, rupture: !!run.state.lis[li]?.rupture, open: open(li) })),
    dates,
  };
}

/**
 * Whether Date Night with each love interest is Make it right now (GET /play, the Dates hub's label): the open date's
 * own plan while its rupture stands (stillToMend) when one is open, else whether a rupture stands that a new date
 * would try to mend.
 */
export async function makeItRightView(
  store: Pick<OtomeStore, "listRun">,
  runId: string,
  state: RunState,
): Promise<Record<LiId, boolean>> {
  const chapters = await dateChapters(store, runId);
  const view: Record<LiId, boolean> = {};
  for (const [li, liState] of Object.entries(state.lis)) {
    const open = chapters.find((item) => item.date!.li === li && !isFinished(state, item));
    view[li] = !!(open ? stillToMend(open.date!, state.lis) : standingRupture(liState));
  }
  return view;
}

// ── Start ──

/** The painted place a "story" date goes to, or null for any other place; 400 for a place the story does not have. */
function storyPlaceOf(world: Pick<World, "places">, input: Pick<DateStartInput, "place" | "storyPlace">) {
  if (input.place !== STORY_PLACE) return null;
  const key = input.storyPlace;
  const place = key && Object.hasOwn(world.places, key) ? world.places[key] : undefined;
  if (!place?.name.trim()) throw new OtomeForgeError(400, "No such place in this story.", "bad-request");
  return place;
}

/** The next free `date-<n>`. */
const nextDateKey = (chapters: readonly Chapter[]) =>
  `date-${chapters.reduce((max, chapter) => Math.max(max, Number(DATE_KEY.exec(chapter.key)?.[1] ?? 0)), 0) + 1}`;

/**
 * POST /runs/:run/dates: plans a date (P26) and saves it as chapter `date-<n>`, or returns the date with that love
 * interest that is still open (`resumed`). Looks are the base looks until M4's Wardrobe.
 */
export async function startDate(
  deps: DateDeps,
  runId: string,
  input: DateStartInput,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<{ chapter: Chapter; date: DateEntry; resumed: boolean }> {
  const first = await readRun(deps.store, runId);
  if (!first) throw runNotFound();
  if (first.world.forge.phase !== "ready") throw conflict("The world is still being forged.");
  partnerOf(first, input.li);
  storyPlaceOf(first.world, input);
  // ponytail: the base look is the only one until M4 lists owned looks; a look id is then checked against them.
  if (input.herLook !== BASE_LOOK || input.hisLook !== BASE_LOOK) {
    throw new OtomeForgeError(400, "Only the base looks can be worn on a date yet.", "bad-request");
  }
  const resume = (open: { chapter: Chapter; state: RunState }) => ({
    chapter: open.chapter,
    date: entryOf(runId, open.chapter, open.state, null),
    resumed: true,
  });
  const open = await openDateWith(deps.store, runId, input.li);
  if (open) return resume(open);
  return runForeground(runId, async () => {
    signal?.throwIfAborted();
    // Read again inside the queue: a request queued behind the one that planned it returns that date.
    const again = await openDateWith(deps.store, runId, input.li);
    if (again) return resume(again);
    const run = await readRun(deps.store, runId);
    if (!run) throw runNotFound();
    const unit = partnerOf(run, input.li);
    const storyPlace = storyPlaceOf(run.world, input);
    const liState = run.state.lis[input.li] ?? defaultLiState();
    const makeItRight = standingRupture(liState);
    const key = nextDateKey(await dateChapters(deps.store, runId));
    const job: ForgeMemoryJob = "structured";
    const memory = await recallText(deps, runId, {
      job,
      cast: [input.li],
      query: {
        cues: [makeItRight?.text ?? "", unit.bible?.want ?? ""].filter(Boolean),
        plan: unit.bible?.want ?? "",
        speakers: [run.player.name, unit.name].filter(Boolean),
      },
      signal,
      debugMode,
    });
    const context = { world: run.world, liState, ...(storyPlace ? { placeName: clean(storyPlace.name, 120) } : {}) };
    const { value, connectionId } = await generateJson(deps, {
      runId,
      job,
      label: `date-plan/${key}`,
      messages: datePlanMessages({
        world: run.world,
        player: run.player,
        unit,
        state: run.state,
        place: input.place,
        storyPlace,
        makeItRight,
        memory,
      }),
      schema: DatePlanReplySchema,
      normalize: (reply) => {
        const plan = normalizeDatePlanReply(reply, context);
        return typeof plan === "string" ? plan : reply;
      },
      temperature: 0.9,
      maxTokens: 2000,
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const plan = normalizeDatePlanReply(value, context) as PlannedDate;
    const date: DatePlan = {
      li: input.li,
      place: input.place,
      placeName: plan.placeName,
      herLook: input.herLook,
      hisLook: input.hisLook,
      goesWrong: plan.goesWrong,
      makeItRight: makeItRight?.id ?? null,
      keepsake: { brief: plan.brief },
    };
    const chapter: Chapter = {
      key,
      kind: "date",
      li: input.li,
      lead: input.li,
      title: plan.title,
      tags: plan.tags,
      summary: "",
      nodes: plan.guides.map((guide, i) => ({
        i,
        kind: "beat",
        guide,
        cast: [input.li],
        ...(i === 0 && plan.placeName ? { place: plan.placeName } : {}),
      })),
      // A stumble's seed is planted for him when the date's last scene is read (S/state/rewards.ts saveLedger).
      ledger: {
        relationship: [],
        conflict: plan.seed ? [{ id: `c-${key}-1`, li: input.li, type: plan.seed.type, action: "plant" }] : [],
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
    const state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) =>
      current.chapters[key]
        ? current
        : { ...current, chapters: { ...current.chapters, [key]: { beatsRead: 0, completed: null, applied: [] } } },
    );
    if (!state) {
      // The run was deleted while the date was planned: its plan goes too, rather than outlive the run.
      await deps.store.removeDoc(chapterId(runId, key));
      throw runNotFound();
    }
    const planned = saved ?? chapter;
    return { chapter: planned, date: entryOf(runId, planned, state, null), resumed: false };
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
    timeline: keepNewest(
      [...state.timeline, { at, li, kind: "first-date", text: chapter.title.slice(0, 600), ref: chapter.key }],
      STATE_LIMITS.timeline,
    ),
  };
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
  const outcome = outcomeOf(picks);
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
    if (applied.replay) return current;
    const after = mend ? applied.state.lis[plan.li] : undefined;
    // Mended as M2b's repair reports it (S/state/stages.ts healRupture): only when no rupture is left with them.
    repaired = !!after && !after.rupture && after.grievances.find((item) => item.id === mend)?.status === "addressed";
    const next = standing
      ? withMark(applied.state, key, mendMark(chapter, repaired ? "mended" : "standing"))
      : applied.state;
    const paid = grant(next, {
      source: "date",
      starlight: STARLIGHT_EARNINGS.date,
      li: plan.li,
      affection: AFFECTION_EARNINGS.date,
    });
    if (paid.granted.starlight) grants.push({ source: "date", starlight: paid.granted.starlight });
    if (paid.granted.affection) grants.push({ source: "date", li: plan.li, affection: paid.granted.affection });
    counted = true;
    return withFirstDate(paid.state, plan.li, chapter, at);
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
  if (!chapter || chapter.kind !== "date" || !chapter.date) throw dateNotFound();
  if (!isFinished(run.state, chapter)) throw conflict("A keepsake is painted once the date is over.");
  const unit = partnerOf(run, chapter.date.li);
  const people: KeepsakePerson[] = [
    {
      name: unit.name,
      identityLine: unit.identityLine || unit.bible!.look.identityLine,
      outfitLine: unit.outfitLine || unit.bible!.look.outfitLine,
      presentation: unit.bible!.look.presentation,
    },
    {
      name: run.player.name || "Protagonist",
      identityLine: run.player.look.identityLine,
      outfitLine: run.player.look.outfitLine,
      presentation: "person",
    },
  ];
  // ponytail: his card or portrait is the one reference (the M1 client's generatePortrait takes one subject); the
  // upgrade path is M2b's two-subject CG painter, which sends hers too.
  const image: ImageSubject = {
    kind: "character",
    ...(unit.cardId ? { cardId: unit.cardId } : {}),
    ...(unit.portrait ? { portrait: unit.portrait } : {}),
    outfits: unit.outfits,
  };
  return { run, chapter, plan: chapter.date, unit, people, image };
}

/** POST /runs/:run/art/keepsake/prompt: the prompt the paint would send (the review dialog shows it). */
export async function keepsakePromptFor(
  deps: DateDeps,
  runId: string,
  key: string,
  edited: Partial<ImagePrompt> = {},
): Promise<ImagePrompt> {
  const { run, plan, people } = await keepsakeSubject(deps, runId, key);
  const style = await imagesOf(deps).styleProfile(run.world.images.styleProfileId);
  return keepsakePrompt({ brief: plan.keepsake.brief, people, world: run.world, style }, edited);
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
  const { run, plan, unit, people, image } = await keepsakeSubject(deps, runId, key);
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
    const style = await images.styleProfile(run.world.images.styleProfileId);
    const built = keepsakePrompt(
      { brief: plan.keepsake.brief, people, world: run.world, style },
      { prompt, negativePrompt },
    );
    if (!(await saveKeepsake(deps, runId, key, { state: "pending", at: new Date().toISOString() })))
      throw runNotFound();
    let painted: { url: string; id?: string };
    try {
      painted = await images.generatePortrait({
        connectionId,
        name: unit.name,
        unit: image,
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
