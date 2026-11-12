// ──────────────────────────────────────────────
// Otome Hearth: Tarot night (#2151), a sixth Dates activity: three cards of the Major Arcana, as Past, Present and
// Future, read with one love interest
// ──────────────────────────────────────────────
// A reading is `${R}:tarot:<id>` (TAROT_READING_ID). The player picks three of 22 face-down cards; the server shuffles
// the Arcana (crypto) and takes the cards at the picked places, each upright or reversed by an even chance (drawCards).
// One model call (the story connection, foreground lane) writes the whole reading in the world's language:
// - "reads-you": the love interest reads the protagonist's cards, answering their question (a chip or their own words,
//   optional); each card is their reading of it, and the closing answers the question.
// - "you-read": the love interest asks the cards a question of their own, and as each card turns says something; the
//   protagonist picks one of TAROT_READINGS readings for it (tender, teasing, unflinching, never labelled), voiced in
//   the persona's voice, and the love interest reacts. A reaction reaches the client only once its card is answered,
//   and the first answer is final (answering again returns it unchanged).
// - Start: their unfinished reading is returned as it is, whatever was asked for (a second tap, a reload, a lost answer;
//   the client opens straight at it); otherwise one call writes a new one in the run's foreground queue
//   (readOrGenerate reads again inside the queue: requests together make one call and one reading). A run deleted
//   while it was written keeps no reading (re-read after the save, as Read Me). Then the drawn cards are claimed for
//   the deck's paint (S/art/tarot-deck.ts claimDeckCards); a failure there never fails the reading.
// - Finish pays once (every reading pays, however it went): Tarot night's Starlight and affection within the day's
//   activity caps (S/state/rewards.ts grant), and the first Tarot night on their Love Timeline, its text the reading's
//   context; all in one revision-checked write of `${R}:state` whose once-only mark is the reading's id in
//   `tarot.paid`. Then the reading is marked finished and memory upkeep is queued (it is new canon). In "you-read"
//   every card must be answered first (409). Nothing in a reading moves trust, tension or a grievance.
// - Memory: a finished reading is a `chat` source with audience [li] (tarotMemorySources): only their own readers and
//   scenes they are in recall it, titled private, never the shared overview. Written by code in English.
// The prompt (S/prompts.ts tarotMessages) sees the protagonist as stored (refreshed when the story is opened), the love
// interest's scene card, their notebook and what stands between them as their own reader may know it (ownView), the
// story memory as their own reader may know it (recallText, reader: them), and THE ROAD AHEAD for the Future card
// (roadAhead, the only Tarot code that reads arcs).
import { randomInt } from "node:crypto";
import type { ForgeMemorySource } from "@forge-kit/story-memory.mjs";
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import { z, type ZodType } from "zod";
import type {
  ActivityGrant,
  LiId,
  LiState,
  RunState,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { LAST_STAGE } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import {
  AFFECTION_EARNINGS,
  STARLIGHT_EARNINGS,
} from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { isFace, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { wordCount } from "../../../../../client/src/features/otome-forge/shared/home.js";
import {
  ARCANA,
  TAROT_CARDS,
  TAROT_MODES,
  TAROT_PAID_KEPT,
  TAROT_POSITIONS,
  TAROT_QUESTIONS,
  TAROT_QUESTION_MAX,
  TAROT_READINGS,
  type Arcana,
  type TarotAnswer,
  type TarotFinishResult,
  type TarotLine,
  type TarotMode,
  type TarotPaid,
  type TarotQuestion,
  type TarotReadingView,
  type TarotView,
} from "../../../../../client/src/features/otome-forge/shared/tarot.js";
import { updateIfChanged } from "../art/paint.js";
import { claimDeckCards, readDeck, deckView } from "../art/tarot-deck.js";
import type { ItemArtDeps } from "../art/outfits.js";
import { generateJson, readOrGenerate } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { mainChapterNumber, runDocTarget, stateId, worldId } from "../ids.js";
import type { OtomeMemory } from "../memory/memory.js";
import {
  STATE_LIMITS,
  clipText,
  keepNewest,
  keepTimeline,
  normalizeState,
  readRun,
  type RunDocuments,
} from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import { grant } from "../state/rewards.js";
import { assertFreeToDate, assertNotHeld } from "./date-night.js";
import { recallText } from "../story/canon.js";
import { listArcs, arcCovering } from "../story/arc.js";
import type { OtomeStore } from "../store.js";
import {
  TAROT_POSITION_NAMES,
  TAROT_WORDS,
  arcanaLabel,
  ownView,
  stageGoal,
  tarotMessages,
  tarotQuestionText,
} from "../prompts.js";
import { clean, orderOf } from "./read-him.js";

/** A reading is about a date plan's size: it carries the story memory. */
export const TAROT_MAX_TOKENS = 3000;
/** The `firsts` key and the Love Timeline kind of their first finished Tarot night. */
export const FIRST_TAROT = "tarot";
export const FIRST_TAROT_TIMELINE = "first-tarot";
const TEXT_MAX = 1200;

// ── The reading document ──

export interface TarotReadingChoice {
  /** The protagonist's reading of the card, in their voice. */
  text: string;
  /** The love interest's reaction to it (hidden until it is picked). */
  reaction: string;
  face: Face | "";
}

export interface TarotCard {
  card: Arcana;
  reversed: boolean;
  line: string;
  face: Face | "";
  /** "you-read" only: TAROT_READINGS readings to pick from. */
  readings?: TarotReadingChoice[];
}

/** `${R}:tarot:<id>` (hidden: only toReadingView and answerOf reach the client, each reaction once answered). */
export interface TarotReading {
  version: 1;
  id: string;
  li: LiId;
  mode: TarotMode;
  question: TarotQuestion | null;
  /** Their name and the protagonist's when it was written (memory and the Love Timeline's fallback text). */
  names: { li: string; player: string };
  /** Where and how the cards are laid out (narration): the reading opens with it, and it is its timeline text. */
  context: string;
  opening: TarotLine;
  cards: TarotCard[];
  /** "you-read": the first answer to each card, or null while it is unanswered. */
  answers: Array<{ pick: number; at: string } | null>;
  closing: TarotLine;
  finished: { at: string; grants: ActivityGrant[] } | null;
  createdAt: string;
  connectionId: string;
  model: string;
}

export const tarotReadingId = (runId: string, id: string) => `${runId}:tarot:${id}`;
/** The `{id, kind, name}` a reading is saved with ("tarot" is one of RUN_DOC_KINDS, so deleting a run sweeps it). */
export const tarotTarget = (runId: string, id: string) => runDocTarget("tarot", tarotReadingId(runId, id));

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/** `tr-<Date.now base36>-<6 [a-z0-9]>` (SH/tarot.ts TAROT_READING_ID). */
export function newTarotReadingId(now = Date.now()): string {
  let token = "";
  for (let index = 0; index < 6; index += 1) token += ALPHABET[randomInt(ALPHABET.length)];
  return `tr-${Math.max(0, Math.trunc(now)).toString(36)}-${token}`;
}

const text = (max = TEXT_MAX) => z.string().max(max);
const faceOf = (value: unknown): Face | "" => (isFace(value) ? value : "");
const LineSchema = z.object({ line: text(), face: z.string().max(40) });
const QuestionSchema: ZodType<TarotQuestion> = z.union([
  z.object({ chip: z.enum(TAROT_QUESTIONS) }),
  z.object({ own: text(TAROT_QUESTION_MAX).min(1) }),
]);
const GrantSchema: ZodType<ActivityGrant> = z.object({
  source: z.literal("tarot"),
  starlight: z.number().int().min(0).optional(),
  li: z.string().optional(),
  affection: z.number().int().min(0).optional(),
});
const ReadingSchema = z.object({
  id: z.string().min(1).max(40),
  li: z.string().min(1).max(80),
  mode: z.enum(TAROT_MODES),
  question: QuestionSchema.nullable(),
  names: z.object({ li: text(400), player: text(400) }),
  context: text(),
  opening: LineSchema,
  cards: z
    .array(
      z.object({
        card: z.enum(ARCANA),
        reversed: z.boolean(),
        line: text(),
        face: z.string().max(40),
        readings: z
          .array(z.object({ text: text(), reaction: text(), face: z.string().max(40) }))
          .max(TAROT_READINGS)
          .optional(),
      }),
    )
    .length(TAROT_CARDS),
  answers: z.array(
    z
      .object({
        pick: z
          .number()
          .int()
          .min(0)
          .max(TAROT_READINGS - 1),
        at: z.string(),
      })
      .nullable(),
  ),
  closing: LineSchema,
  finished: z.object({ at: z.string(), grants: z.array(GrantSchema) }).nullable(),
  createdAt: z.string(),
  connectionId: z.string(),
  model: z.string(),
});

/** A stored reading, or null for none (missing or damaged: a damaged reading is never played on or paid). */
export function normalizeReading(data: unknown): TarotReading | null {
  const parsed = ReadingSchema.safeParse(data);
  if (!parsed.success) return null;
  const reading = parsed.data;
  const line = (value: { line: string; face: string }): TarotLine => ({ line: value.line, face: faceOf(value.face) });
  const cards = reading.cards.map(({ readings, ...card }): TarotCard => ({
    ...card,
    face: faceOf(card.face),
    ...(readings ? { readings: readings.map((choice) => ({ ...choice, face: faceOf(choice.face) })) } : {}),
  }));
  return {
    version: 1,
    ...reading,
    opening: line(reading.opening),
    closing: line(reading.closing),
    cards,
    answers: cards.map((_, index) => reading.answers[index] ?? null),
  };
}

/** Card `index`'s answer, or null while it is unanswered: only an answered card shows a reaction, and only its own. */
export function answerOf(reading: TarotReading, index: number): TarotAnswer | null {
  const answer = reading.answers[index];
  const choice = answer ? reading.cards[index]?.readings?.[answer.pick] : undefined;
  if (!answer || !choice) return null;
  return { pick: answer.pick, reading: choice.text, reaction: choice.reaction, face: choice.face };
}

/** What the client may see of a reading: every card as said, its readings' text, and a reaction once answered. */
export function toReadingView(reading: TarotReading): TarotReadingView {
  return {
    id: reading.id,
    li: reading.li,
    mode: reading.mode,
    question: reading.question,
    context: reading.context,
    opening: reading.opening,
    cards: reading.cards.map((card, index) => {
      const answer = answerOf(reading, index);
      return {
        card: card.card,
        reversed: card.reversed,
        line: card.line,
        face: card.face,
        ...(card.readings ? { readings: card.readings.map((choice) => choice.text) } : {}),
        ...(answer ? { answer } : {}),
      };
    }),
    closing: reading.closing,
    grants: reading.finished ? reading.finished.grants : null,
  };
}

// ── The draw ──

/**
 * The cards at the places the player picked, from a fresh shuffle of the 22 (Fisher–Yates with `random(max)`, an int
 * in [0, max): the crypto RNG unless a test seeds one), each reversed by an even chance. Picks are checked by the route.
 */
export function drawCards(
  picks: readonly number[],
  random: (max: number) => number = randomInt,
): Array<{ card: Arcana; reversed: boolean }> {
  const deck = [...ARCANA];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const other = random(index + 1);
    [deck[index], deck[other]] = [deck[other]!, deck[index]!];
  }
  return picks.map((pick) => ({ card: deck[pick]!, reversed: random(2) === 1 }));
}

// ── The reply ──

export interface TarotReplyLine {
  line: string;
  face?: string | null;
}
export interface TarotReplyCard extends TarotReplyLine {
  readings?: Array<{ text: string; reaction: string; face?: string | null }>;
}
export interface TarotReply {
  context: string;
  opening: TarotReplyLine;
  cards: TarotReplyCard[];
  closing: TarotReplyLine;
}

const ReplyLineSchema = z.object({ line: text(), face: z.string().max(40).nullable().optional() });
export const TarotReplySchema: ZodType<TarotReply> = z.object({
  context: text(),
  opening: ReplyLineSchema,
  cards: z
    .array(
      ReplyLineSchema.extend({
        readings: z
          .array(z.object({ text: text(), reaction: text(), face: z.string().max(40).nullable().optional() }))
          .max(TAROT_READINGS + 3)
          .optional(),
      }),
    )
    .min(TAROT_CARDS)
    .max(TAROT_CARDS + 2),
  closing: ReplyLineSchema,
});

const lineOf = (raw: TarotReplyLine): TarotLine => ({ line: clean(raw.line), face: faceOf(raw.face) });

/**
 * The reply's checks: TAROT_CARDS cards (extra ones are dropped), no empty field and every field within its word limit
 * (S/prompts.ts TAROT_WORDS), and in "you-read" TAROT_READINGS different readings for each card (extra ones dropped).
 * A face that is not one of the five is a plain look. Returns the reply cleaned, or what is wrong with it.
 */
export function checkTarotReply(reply: TarotReply, mode: TarotMode): TarotReply | string {
  const context = clean(reply.context);
  const opening = lineOf(reply.opening);
  const closing = lineOf(reply.closing);
  const long = (value: string, max: number) => wordCount(value) > max;
  if (!context || !opening.line || !closing.line) return "context, opening.line and closing.line must not be empty";
  if (long(context, TAROT_WORDS.context)) return `context must be ${TAROT_WORDS.context} words or fewer`;
  if (long(opening.line, TAROT_WORDS.opening)) return `opening.line must be ${TAROT_WORDS.opening} words or fewer`;
  if (long(closing.line, TAROT_WORDS.closing)) return `closing.line must be ${TAROT_WORDS.closing} words or fewer`;
  const cards: TarotReplyCard[] = [];
  for (const [index, raw] of reply.cards.slice(0, TAROT_CARDS).entries()) {
    const at = `cards[${index}]`;
    const card = lineOf(raw);
    if (!card.line) return `${at}.line must not be empty`;
    if (long(card.line, TAROT_WORDS.line)) return `${at}.line must be ${TAROT_WORDS.line} words or fewer`;
    if (mode === "reads-you") {
      cards.push(card);
      continue;
    }
    const readings = (raw.readings ?? []).slice(0, TAROT_READINGS).map((choice) => ({
      text: clean(choice.text),
      reaction: clean(choice.reaction),
      face: faceOf(choice.face),
    }));
    if (readings.length < TAROT_READINGS) return `${at}.readings must hold exactly ${TAROT_READINGS} readings`;
    for (const [option, choice] of readings.entries()) {
      if (!choice.text || !choice.reaction) return `${at}.readings[${option}]: text and reaction must not be empty`;
      if (long(choice.text, TAROT_WORDS.reading)) {
        return `${at}.readings[${option}].text must be ${TAROT_WORDS.reading} words or fewer`;
      }
      if (long(choice.reaction, TAROT_WORDS.reaction)) {
        return `${at}.readings[${option}].reaction must be ${TAROT_WORDS.reaction} words or fewer`;
      }
    }
    if (new Set(readings.map((choice) => choice.text.toLocaleLowerCase())).size !== readings.length) {
      return `${at}: every reading must be different`;
    }
    cards.push({ ...card, readings });
  }
  return { context, opening, cards, closing };
}

// ── What the Future card may hint at ──

/** The latest main chapter completed (0 for none): the next one is the story's next step. */
function latestMain(state: RunState): number {
  let latest = 0;
  for (const [key, progress] of Object.entries(state.chapters)) {
    const number = progress.completed ? mainChapterNumber(key) : null;
    if (number && number > latest) latest = number;
  }
  return latest;
}

/**
 * THE ROAD AHEAD, for the Future card only, and the only Tarot code that reads the story's arcs (whose documents keep
 * the hidden story, S/schemas/story-arc.ts): the goal of the arc covering the next main chapter, the purposes of the
 * next two main chapters, the love interest's next route step, and the world's open question. Never an arc's reveals,
 * its ending, its antagonist, its judgment or a newcomer. [] when there is no step to hint at (no arc covers the next
 * chapter and they are at their last stage): the Future then reads only what stands between them.
 */
export async function roadAhead(
  store: Pick<OtomeStore, "listRun">,
  runId: string,
  { state, world }: { state: RunState; world: Pick<World, "mystery"> },
  unit: Pick<Unit, "name">,
  liState: Pick<LiState, "stage">,
): Promise<string[]> {
  const arcs = await listArcs(store, runId).catch(() => []);
  const next = latestMain(state) + 1;
  const arc = arcCovering(arcs, next);
  const purposes = [next, next + 1].flatMap((number) => {
    const purpose = arcCovering(arcs, number)
      ?.plan.find((entry) => entry.n === number)
      ?.purpose.trim();
    return purpose ? [`- What comes next in the story: ${purpose}`] : [];
  });
  const lines = [
    ...(arc?.goal.trim() ? [`- Where the story is heading: ${arc.goal.trim()}`] : []),
    ...purposes,
    ...(liState.stage < LAST_STAGE ? [`- ${unit.name}'s next step: ${stageGoal(liState.stage + 1, unit.name)}`] : []),
  ];
  if (!lines.length) return [];
  const question = world.mystery.question.trim();
  return question ? [...lines, `- The open question of this world: ${question}`] : lines;
}

// ── Start, answer, finish ──

export interface TarotDeps extends ItemArtDeps {
  memory?: Pick<OtomeMemory, "recall" | "maintain">;
}

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");
const readingNotFound = () => new OtomeForgeError(404, "No such Tarot reading.", "not-found");
const badRequest = (what: string) => new OtomeForgeError(400, `Invalid request: ${what}`, "bad-request");

/**
 * The love interest a reading is with: the one check on them for the view and the start (404 for one the run does not
 * have, 409 while their bible is unwritten). A date lock while a grievance stands (#2156) belongs here.
 */
export function tarotPartner(run: RunDocuments, li: LiId): Unit {
  const unit = run.units.find((entry) => entry.id === li);
  if (!unit || !run.state.lis[li]) throw liNotFound();
  if (!unit.bible) throw new OtomeForgeError(409, `${unit.name}'s bible is not written yet.`, "conflict");
  return unit;
}

/** Every readable reading of the run, newest first. */
async function listReadings(store: Pick<OtomeStore, "listRun">, runId: string): Promise<TarotReading[]> {
  return (await store.listRun("tarot", runId))
    .map((record) => normalizeReading(record.data))
    .filter((reading): reading is TarotReading => !!reading)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const openReading = async (store: Pick<OtomeStore, "listRun">, runId: string, li: LiId) =>
  (await listReadings(store, runId)).find((reading) => reading.li === li && !reading.finished) ?? null;

/** The picks a start may send: TAROT_CARDS different places among the 22 face-down cards; a 400 otherwise. */
export function checkPicks(picks: readonly number[]): number[] {
  const valid =
    picks.length === TAROT_CARDS &&
    picks.every((pick) => Number.isInteger(pick) && pick >= 0 && pick < ARCANA.length) &&
    new Set(picks).size === picks.length;
  if (!valid) throw badRequest(`pick ${TAROT_CARDS} different cards`);
  return [...picks];
}

export interface TarotStart {
  mode: TarotMode;
  question?: TarotQuestion | null;
  picks: readonly number[];
}

/**
 * POST /runs/:run/tarot: their unfinished reading as it is, or a new one written in one call (once, whoever asks first),
 * whose drawn cards are then claimed for the deck. 400 for bad picks, 404 for an unknown run or love interest, 409
 * while their bible is unwritten; generateJson's 503, 422 and 502 otherwise (nothing is saved or claimed).
 */
export async function startTarot(
  deps: TarotDeps,
  runId: string,
  li: LiId,
  start: TarotStart,
  { debugMode, review }: { debugMode: boolean; review?: boolean },
): Promise<TarotReadingView> {
  const picks = checkPicks(start.picks);
  const own = start.question && "own" in start.question ? clean(start.question.own) : "";
  const question: TarotQuestion | null =
    start.mode !== "reads-you" || !start.question
      ? null
      : "chip" in start.question
        ? { chip: start.question.chip }
        : own
          ? { own: clipText(own, TAROT_QUESTION_MAX) }
          : null;
  const reading = await readOrGenerate(
    runId,
    () => openReading(deps.store, runId, li),
    async () => {
      const run = await readRun(deps.store, runId);
      if (!run) throw runNotFound();
      const unit = tarotPartner(run, li);
      const cards = drawCards(picks);
      const { liState, relationship, offscreen, bondPlayed } = ownView(run.state, li);
      const lately = [relationship, offscreen].filter((line) => !!line.trim());
      const memory = await recallText(deps, runId, {
        job: "narration",
        reader: li,
        // The recalls (cued by the question) come apart from the rest, which stays the same between readings with
        // them, so the prompt sends them after it. With `reader` this leaves out nothing they may know.
        cached: { li },
        query: {
          cues: [tarotQuestionText(question), relationship, unit.bible?.want ?? ""].filter((cue) => !!cue.trim()),
          speakers: [run.player.name, unit.name].filter(Boolean),
        },
        debugMode,
      });
      const road = await roadAhead(deps.store, runId, run, unit, liState);
      const { value, connectionId, model } = await generateJson(deps, {
        runId,
        job: "narration",
        label: `tarot/${li}`,
        messages: tarotMessages({
          world: run.world,
          player: run.player,
          unit,
          liState,
          bondPlayed,
          lately,
          road,
          memory: memory.text,
          recalls: memory.recalls?.text ?? "",
          mode: start.mode,
          question,
          cards,
        }),
        memory,
        schema: TarotReplySchema,
        normalize: (reply) => checkTarotReply(reply, start.mode),
        maxTokens: TAROT_MAX_TOKENS,
        debugMode,
        lane: "foreground",
      });
      // Already checked and cleaned (generateJson returns what `normalize` gave).
      const reply = value;
      const fresh: TarotReading = {
        version: 1,
        id: newTarotReadingId(),
        li,
        mode: start.mode,
        question,
        names: { li: unit.name, player: run.player.name },
        context: reply.context,
        opening: lineOf(reply.opening),
        cards: cards.map((drawn, index) => {
          const raw = reply.cards[index]!;
          return {
            ...drawn,
            ...lineOf(raw),
            ...(start.mode === "you-read"
              ? {
                  readings: (raw.readings ?? []).map((choice) => ({
                    text: choice.text,
                    reaction: choice.reaction,
                    face: faceOf(choice.face),
                  })),
                }
              : {}),
          };
        }),
        answers: cards.map(() => null),
        closing: lineOf(reply.closing),
        finished: null,
        createdAt: new Date().toISOString(),
        connectionId,
        model,
      };
      const target = tarotTarget(runId, fresh.id);
      const saved = await deps.store.mutateDoc(target, normalizeReading, (current) => current ?? fresh);
      // The run's delete sweeps its documents after it removes the world; a reading saved after the sweep goes too.
      if (!(await deps.store.readDoc(worldId(runId), normalizeWorld))) {
        await deps.store.removeDoc(target.id).catch(() => false);
        throw runNotFound();
      }
      try {
        await claimDeckCards(
          deps,
          runId,
          li,
          cards.map((drawn) => drawn.card),
          { debugMode, review },
        );
      } catch (error) {
        // The reading stands: a card left unclaimed is claimed the next time it is drawn.
        deps.runtime.logger.warn(
          "[otome-forge] The Tarot cards of %s were not set to paint: %s",
          li,
          error instanceof Error ? error.message : String(error),
        );
      }
      return saved ?? fresh;
    },
  );
  return toReadingView(reading);
}

/**
 * POST .../tarot/:reading/answer {card, pick}: the protagonist's reading of card `card` ("you-read" only, 400
 * otherwise). The first answer is final; another for the same card returns the first unchanged.
 */
export async function answerTarot(
  deps: Pick<TarotDeps, "store">,
  runId: string,
  id: string,
  { card, pick }: { card: number; pick: number },
): Promise<TarotAnswer> {
  const at = new Date().toISOString();
  const target = tarotTarget(runId, id);
  // #2156: an open reading waits too while their grievance with her stands (S/minigames/date-night.ts assertFreeToDate).
  const open = await deps.store.readDoc(target.id, normalizeReading);
  if (open) await assertFreeToDate(deps.store, runId, open.li);
  // An answer given before writes nothing.
  const saved = await updateIfChanged(deps.store, target, normalizeReading, (current) => {
    if (!current) throw readingNotFound();
    if (current.mode !== "you-read") throw badRequest("only a reading of their cards is answered");
    if (!current.cards[card]?.readings?.[pick]) throw badRequest("no such card or reading");
    if (current.answers[card]) return undefined;
    const answers = [...current.answers];
    answers[card] = { pick, at };
    return { ...current, answers };
  });
  const answer = saved?.value && answerOf(saved.value, card);
  if (!answer) throw readingNotFound();
  return answer;
}

/**
 * The state after `reading` is finished, pure: Tarot night's Starlight and their affection within the day's caps, and
 * their first Tarot night on the Love Timeline. A love interest the run no longer has earns nothing.
 */
export function applyTarot(
  state: RunState,
  reading: TarotReading,
  { at, dayKey = forgeDayKey(Date.now()) }: { at: string; dayKey?: string },
): { state: RunState; grants: ActivityGrant[] } {
  if (!state.lis[reading.li]) return { state, grants: [] };
  const grants: ActivityGrant[] = [];
  const paid = grant(state, { source: "tarot", starlight: STARLIGHT_EARNINGS.tarot }, dayKey);
  if (paid.granted.starlight) grants.push({ source: "tarot", starlight: paid.granted.starlight });
  const loved = grant(paid.state, { source: "tarot", li: reading.li, affection: AFFECTION_EARNINGS.tarot }, dayKey);
  if (loved.granted.affection) grants.push({ source: "tarot", li: reading.li, affection: loved.granted.affection });
  const next = loved.state;
  const liState = next.lis[reading.li]!;
  if (liState.firsts[FIRST_TAROT]) return { state: next, grants };
  return {
    grants,
    state: {
      ...next,
      lis: { ...next.lis, [reading.li]: { ...liState, firsts: { ...liState.firsts, [FIRST_TAROT]: at } } },
      timeline: keepTimeline([
        ...next.timeline,
        {
          at,
          li: reading.li,
          kind: FIRST_TAROT_TIMELINE,
          text: clipText(reading.context || reading.names.li, STATE_LIMITS.text),
          ref: reading.id,
        },
      ]),
    },
  };
}

function grantsOf(paid: TarotPaid): ActivityGrant[] {
  const grants: ActivityGrant[] = [];
  if (paid.starlight) grants.push({ source: "tarot", starlight: paid.starlight });
  if (paid.affection) grants.push({ source: "tarot", li: paid.li, affection: paid.affection });
  return grants;
}

/**
 * POST .../tarot/:reading/finish: pays the reading once (see the header). 409 `conflict` in "you-read" while a card is
 * unanswered; a reading already paid returns what it paid then.
 * ponytail: the state keeps the newest TAROT_PAID_KEPT paid ids; a reading whose state write landed but whose own
 * finished mark never did, and that is finished again only after that many newer readings, would pay twice (within the
 * day's caps). The upgrade path is a store write that saves the reading and the state together.
 */
export async function finishTarot(
  deps: Pick<TarotDeps, "store" | "memory">,
  runId: string,
  id: string,
  { debugMode }: { debugMode: boolean },
): Promise<TarotFinishResult> {
  const target = tarotTarget(runId, id);
  const reading = await deps.store.readDoc(target.id, normalizeReading);
  if (!reading) throw readingNotFound();
  if (reading.finished) {
    const state = await deps.store.readDoc(stateId(runId), normalizeState);
    return { grants: reading.finished.grants, starlight: state?.wallet.starlight ?? 0 };
  }
  // An answer, once given, never changes: every card answered now stays answered for the write below.
  if (reading.mode === "you-read" && reading.answers.some((answer) => answer === null)) {
    throw new OtomeForgeError(409, "Read every card before finishing.", "conflict");
  }
  const at = new Date().toISOString();
  // Set by the write that was saved (updateDoc applies the change again after a stale revision). What was done
  // before writes nothing.
  let paid = null as TarotPaid | null;
  let finishedNow = false as boolean;
  const saved = await updateIfChanged(deps.store, runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    paid = current.tarot.paid.find((entry) => entry.id === id) ?? null;
    if (paid) return undefined;
    // #2156: a reading waits, unpaid and open, while their grievance with her stands.
    assertNotHeld(current, reading.li);
    const outcome = applyTarot(current, reading, { at });
    const amount = (key: "starlight" | "affection") =>
      outcome.grants.reduce((sum, entry) => sum + (entry[key] ?? 0), 0);
    paid = { id, li: reading.li, starlight: amount("starlight"), affection: amount("affection") };
    return { ...outcome.state, tarot: { paid: keepNewest([...outcome.state.tarot.paid, paid], TAROT_PAID_KEPT) } };
  });
  if (!saved || !paid) throw runNotFound();
  const grants = grantsOf(paid);
  // Then the reading: finished, with what it paid. A failure here is retried by the next finish, which the state's
  // mark keeps from paying again.
  await updateIfChanged(deps.store, target, normalizeReading, (current) => {
    if (!current) throw readingNotFound();
    finishedNow = !current.finished;
    return current.finished ? undefined : { ...current, finished: { at, grants } };
  });
  // A finished reading is new canon for their memory.
  if (finishedNow) void Promise.resolve(deps.memory?.maintain({ runId, debugMode })).catch(() => undefined);
  return { grants, starlight: saved.value.wallet.starlight };
}

/**
 * GET /runs/:run/lis/:li/tarot: their unfinished reading (or null), and the deck's cards their readings show, each
 * with its paint as the client sees it (a card that paints after a reading has finished shows here too). No model call.
 */
export async function readTarot(deps: Pick<TarotDeps, "store">, runId: string, li: LiId): Promise<TarotView> {
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  tarotPartner(run, li);
  const [open, deck] = await Promise.all([openReading(deps.store, runId, li), readDeck(deps.store, runId)]);
  return { open: open ? toReadingView(open) : null, deck: deckView(runId, deck, li) };
}

// ── Private memory ──

/** What they remember of a finished reading: who read whose cards, the question, each card and the closing. English. */
export function tarotMemoryText(reading: TarotReading): string {
  const name = reading.names.li || "The love interest";
  const player = reading.names.player || "The protagonist";
  const question = tarotQuestionText(reading.question);
  const lines =
    reading.mode === "reads-you"
      ? [
          `${name} read ${player}'s tarot cards.${question ? ` ${player} asked: "${question}"` : ""}`,
          `${name}: "${reading.opening.line}"`,
        ]
      : [`${player} read ${name}'s tarot cards. ${name} asked the cards: "${reading.opening.line}"`];
  reading.cards.forEach((card, index) => {
    const position = TAROT_POSITION_NAMES[TAROT_POSITIONS[index] ?? "future"];
    const answer = answerOf(reading, index);
    lines.push(
      `- ${position}: ${arcanaLabel(card.card, card.reversed)}. ${name}: "${card.line}"${
        answer ? ` ${player} read it: "${answer.reading}" ${name}: "${answer.reaction}"` : ""
      }`,
    );
  });
  lines.push(`${name} closed: "${reading.closing.line}"`);
  return lines.join("\n");
}

/**
 * Every finished reading of the run as a `chat` memory source with `audience: [li]` (S/memory/sources.ts adds these):
 * only their own readers and scenes they are in recall it, and it never reaches the shared overview. Readings of love
 * interests the run no longer has, and unfinished ones, are not sources.
 */
export async function tarotMemorySources(
  store: Pick<OtomeStore, "listRun">,
  runId: string,
  state: RunState,
): Promise<ForgeMemorySource[]> {
  return (await listReadings(store, runId))
    .filter((reading) => reading.finished && state.lis[reading.li])
    .map((reading) => {
      const name = reading.names.li || "a love interest";
      return {
        id: `tarot-${reading.id}`,
        kind: "chat" as const,
        // Private, as S/phone/memory.ts titles a phone session: a scene with others in it recalls it as theirs alone.
        title: `Tarot night with ${name} (private: only ${reading.names.li || "that love interest"} and the protagonist know how it went)`,
        content: tarotMemoryText(reading),
        order: orderOf(state, reading.finished!.at),
        audience: [reading.li],
      };
    });
}
