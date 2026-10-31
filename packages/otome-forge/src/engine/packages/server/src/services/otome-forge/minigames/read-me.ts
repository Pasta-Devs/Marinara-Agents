// ──────────────────────────────────────────────
// Otome Hearth: Read Me (#1945; design: Mini-games). Read Him the other way round, and the notebook it fills.
// ──────────────────────────────────────────────
// A set is `${R}:readme:${setId}`: READ_ME_GUESSES guesses one model call writes about the protagonist, each in a
// notebook category, with where the love interest sits down to study them, what they say, the face they wear, the
// guess as one short fact about the protagonist and (hidden) their reaction to each verdict: right, close or wrong.
// - Start: their unfinished set is played on at any stage (a stage-up never strands answers the notebook is waiting
//   for, and a second tap, a reload or a lost answer never writes another); otherwise one call writes a new one in the
//   run's foreground queue (readOrGenerate reads again inside the queue: requests together make one call and one set).
// - The client sees a guess's reaction only once it is answered, and the first answer is final: answering again returns
//   it unchanged. The player's own words are cleaned and capped; words that sound medical are refused, nothing saved.
// - Finish needs every guess answered and pays once: Read Me's Starlight, and a base affection plus a little for each
//   guess they got right or nearly right, within the day's activity caps (S/state/rewards.ts grant); one notebook
//   entry per guess into their `known` (SH/read-me.ts); the first Read Me on their Love Timeline. All of it lands in
//   one revision-checked write of `${R}:state`, whose once-only mark is the set's id in `readMe.paid`, so a finish sent
//   again, or retried after either write failed, adds no entry twice and never brings back one the player deleted.
//   The set is marked finished after it.
// - The notebook is the player's: they read it, rewrite or clear the words they gave, and delete an entry; the set's
//   copy of those words follows, so a delete leaves none behind. Unlike Read Him, a set is never a story-memory source
//   (S/memory/sources.ts): the notebook is the only copy a prompt sees, so a delete is final.
// The prompt writes the love interest's words on the `chat` contract for them alone (it follows the story's Heat), with
// the knowledge boundary and the writing rules. It sees the protagonist as the story knows them (their card and
// persona), the love interest's own scene card, what stands between them, one thing they may know from their own
// recall and their own notebook, so no guess repeats one already known; the state reaches it as their own reader may
// know it (story/prompts.ts ownView): nothing another love interest's own chapter or notebook holds. Its one narrow
// rule: no guess about health, illness or medication, or anyone's period or cycle; nothing from the period tracker
// ever reaches the server. Prompts are English and never localized; the set is written in the world's language.
import { randomInt } from "node:crypto";
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import { z, type ZodType } from "zod";
import type {
  ActivityGrant,
  LiId,
  LiState,
  Player,
  RunState,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  AFFECTION_EARNINGS,
  STARLIGHT_EARNINGS,
} from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { FACES, isFace, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { soundsMedical, wordCount } from "../../../../../client/src/features/otome-forge/shared/home.js";
import {
  NOTEBOOK_CATEGORIES,
  NOTEBOOK_MAX,
  READ_ME_GUESSES,
  READ_ME_PAID_KEPT,
  READ_ME_VERDICTS,
  READ_ME_WORDS_MAX,
  type NotebookCategory,
  type NotebookEntry,
  type NotebookView,
  type ReadMeAnswer,
  type ReadMeFinishResult,
  type ReadMePaid,
  type ReadMeSetView,
  type ReadMeVerdict,
} from "../../../../../client/src/features/otome-forge/shared/read-me.js";
import { updateIfChanged } from "../art/paint.js";
import { otomeContentContract, otomeContractReminder } from "../content-contract.js";
import { generateJson, readOrGenerate, type GenerationDeps, type OtomeMessage } from "../generation.js";
import { NO_ABSENCE_RULE } from "../home/prompts.js";
import { OtomeForgeError } from "../http.js";
import { runDocTarget, stateId, worldId } from "../ids.js";
import type { OtomeMemory } from "../memory/memory.js";
import { otomeSceneCard } from "../scene-card.js";
import { STATE_LIMITS, clipText, keepNewest, keepTimeline, normalizeState, readRun } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import { grant } from "../state/rewards.js";
import type { OtomeStore } from "../store.js";
import { betweenYou, knowsAboutYou, ownView, protagonistBlock } from "../story/prompts.js";
import { otomeWritingRules } from "../writing-rules.js";
import { clean, recalledLine } from "./read-him.js";

export const READ_ME_TEMPERATURE = 0.9;
export const READ_ME_MAX_TOKENS = 2400;
/** Word limits a set's fields keep; a reply over them gets the repair turn. */
export const READ_ME_WORDS = { context: 60, line: 40, fact: 25, reaction: 40 } as const;
/** The `firsts` key and the Love Timeline kind of their first finished Read Me. */
export const FIRST_READ_ME = "read-me";
export const FIRST_READ_ME_TIMELINE = "first-read-me";
const TEXT_MAX = 1200;
/** A notebook entry's text, in UTF-16 units (S/schemas/state.ts NotebookEntrySchema keeps no longer one). */
const NOTEBOOK_TEXT_MAX = 300;

// ── The set document ──

export interface ReadMeReaction {
  line: string;
  face: Face | "";
}

export interface ReadMeGuess {
  category: NotebookCategory;
  /** The guess, said to the protagonist. */
  line: string;
  face: Face | "";
  /** What the guess claims, as one short third-person sentence about the protagonist: the notebook entry's text. */
  fact: string;
  /** Their reaction to each verdict (hidden: only the chosen one reaches the client, once answered). */
  reactions: Record<ReadMeVerdict, ReadMeReaction>;
}

/** The player's answer to one guess: the first is final. */
export interface ReadMeAnswerRecord {
  verdict: ReadMeVerdict;
  /** The truth in the player's own words, cleaned and capped; dropped when they delete or clear it in the notebook. */
  words?: string;
  at: string;
}

/** `${R}:readme:${setId}` (hidden: only toSetView and answerOf reach the client, each guess once answered). */
export interface ReadMeSet {
  version: 1;
  setId: string;
  li: LiId;
  /** Their name and the protagonist's when it was written (the Love Timeline's fallback text). */
  names: { li: string; player: string };
  /** Where and how they sit down to study the protagonist (narration). */
  context: string;
  guesses: ReadMeGuess[];
  /** The first answer to each guess, or null while it is unanswered. */
  answers: Array<ReadMeAnswerRecord | null>;
  /** Set once its pay is in the state, with what it paid (for a finish sent again). */
  finished: { at: string; grants: ActivityGrant[] } | null;
  createdAt: string;
  connectionId: string;
  model: string;
}

export const readMeId = (runId: string, setId: string) => `${runId}:readme:${setId}`;
/** The `{id, kind, name}` a set is saved with ("readme" is one of RUN_DOC_KINDS, so deleting a run sweeps its sets). */
export const readMeTarget = (runId: string, setId: string) => runDocTarget("readme", readMeId(runId, setId));

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/** `rm-<Date.now base36>-<6 [a-z0-9]>` (SH/read-me.ts READ_ME_SET_ID). */
export function newReadMeSetId(now = Date.now()): string {
  let token = "";
  for (let index = 0; index < 6; index += 1) token += ALPHABET[randomInt(ALPHABET.length)];
  return `rm-${Math.max(0, Math.trunc(now)).toString(36)}-${token}`;
}

/** A notebook entry's id: `${setId}/${guess index}`. */
export const notebookEntryId = (setId: string, index: number) => `${setId}/${index}`;
const ENTRY_ID = /^(rm-[0-9a-z]{1,12}-[0-9a-z]{6})\/(\d{1,2})$/;

const text = (max = TEXT_MAX) => z.string().max(max);
const GrantSchema: ZodType<ActivityGrant> = z.object({
  source: z.literal("read-me"),
  starlight: z.number().int().min(0).optional(),
  li: z.string().optional(),
  affection: z.number().int().min(0).optional(),
});
const ReactionSchema = z.object({ line: text(), face: z.string().max(40) });
const GuessSchema = z.object({
  category: z.enum(NOTEBOOK_CATEGORIES),
  line: text(),
  face: z.string().max(40),
  fact: text(),
  reactions: z.object({ right: ReactionSchema, close: ReactionSchema, wrong: ReactionSchema }),
});
const AnswerSchema = z.object({
  verdict: z.enum(READ_ME_VERDICTS),
  words: text(READ_ME_WORDS_MAX).optional(),
  at: z.string(),
});
const SetSchema = z.object({
  setId: z.string().min(1).max(40),
  li: z.string().min(1).max(80),
  names: z.object({ li: text(400), player: text(400) }),
  context: text(),
  guesses: z.array(GuessSchema).min(1).max(12),
  answers: z.array(AnswerSchema.nullable()),
  finished: z.object({ at: z.string(), grants: z.array(GrantSchema) }).nullable(),
  createdAt: z.string(),
  connectionId: z.string(),
  model: z.string(),
});

const faceOf = (value: unknown): Face | "" => (isFace(value) ? value : "");
const reactionOf = (raw: { line: string; face?: string | null }): ReadMeReaction => ({
  line: clean(raw.line),
  face: faceOf(raw.face),
});

/** A stored set, or null for none (missing or damaged: a damaged set is never played on or paid). */
export function normalizeSet(data: unknown): ReadMeSet | null {
  const parsed = SetSchema.safeParse(data);
  if (!parsed.success) return null;
  const set = parsed.data;
  const guesses = set.guesses.map((guess) => ({
    ...guess,
    face: faceOf(guess.face),
    reactions: {
      right: reactionOf(guess.reactions.right),
      close: reactionOf(guess.reactions.close),
      wrong: reactionOf(guess.reactions.wrong),
    },
  }));
  const answers = guesses.map((_, index) => set.answers[index] ?? null);
  return { version: 1, ...set, guesses, answers };
}

/** What the client may see of a set: each guess as said, and its answer once it was given. */
export function toSetView(set: ReadMeSet): ReadMeSetView {
  return {
    setId: set.setId,
    li: set.li,
    context: set.context,
    guesses: set.guesses.map((guess, index) => {
      const answer = answerOf(set, index);
      return { category: guess.category, line: guess.line, face: guess.face, ...(answer ? { answer } : {}) };
    }),
    grants: set.finished ? set.finished.grants : null,
  };
}

/** Guess `index`'s answer, or null while it is unanswered. Only an answered guess shows a reaction, and only its own. */
export function answerOf(set: ReadMeSet, index: number): ReadMeAnswer | null {
  const guess = set.guesses[index];
  const answer = set.answers[index];
  if (!guess || !answer) return null;
  const reaction = guess.reactions[answer.verdict];
  return {
    verdict: answer.verdict,
    reaction: reaction.line,
    face: reaction.face,
    ...(answer.words ? { words: answer.words } : {}),
  };
}

// ── The Read Me prompt (structured, 0.9, chat contract, foreground lane) ──

export interface ReadMeReplyReaction {
  line: string;
  face?: string | null;
}
export interface ReadMeReplyGuess {
  category: string;
  line: string;
  face?: string | null;
  fact: string;
  reactions: Record<ReadMeVerdict, ReadMeReplyReaction>;
}
export interface ReadMeReply {
  context: string;
  guesses: ReadMeReplyGuess[];
}

const ReplyReactionSchema = z.object({
  line: z.string().max(TEXT_MAX),
  face: z.string().max(40).nullable().optional(),
});
export const ReadMeReplySchema: ZodType<ReadMeReply> = z.object({
  context: z.string().max(TEXT_MAX),
  guesses: z
    .array(
      z.object({
        category: z.string().max(40),
        line: z.string().max(TEXT_MAX),
        face: z.string().max(40).nullable().optional(),
        fact: z.string().max(TEXT_MAX),
        reactions: z.object({ right: ReplyReactionSchema, close: ReplyReactionSchema, wrong: ReplyReactionSchema }),
      }),
    )
    .min(READ_ME_GUESSES)
    .max(READ_ME_GUESSES + 2),
});

/** The notebook category a reply names ("Likes " reads as likes), or undefined for one the notebook has not. */
const categoryOf = (value: string): NotebookCategory | undefined =>
  NOTEBOOK_CATEGORIES.find((category) => category === value.trim().toLowerCase());

/** A reply's guess as the set keeps it: every field cleaned, an unknown face a plain look. */
function guessOf(raw: ReadMeReplyGuess): ReadMeGuess {
  return {
    category: categoryOf(raw.category) ?? "other",
    line: clean(raw.line),
    face: faceOf(raw.face),
    fact: clean(raw.fact),
    reactions: {
      right: reactionOf(raw.reactions.right),
      close: reactionOf(raw.reactions.close),
      wrong: reactionOf(raw.reactions.wrong),
    },
  };
}

/**
 * The reply's checks: READ_ME_GUESSES guesses (extra ones are dropped), each in a notebook category, about something
 * different, with no empty field and every field within its word limit, and no guess or fact that sounds medical (the
 * care privacy rule). A face that is not one of the five is a plain look.
 */
export function checkReadMeReply(reply: ReadMeReply): ReadMeReply | string {
  const context = clean(reply.context);
  if (!context) return "context must not be empty";
  if (wordCount(context) > READ_ME_WORDS.context) return `context must be ${READ_ME_WORDS.context} words or fewer`;
  const guesses: ReadMeGuess[] = [];
  for (const [index, raw] of reply.guesses.slice(0, READ_ME_GUESSES).entries()) {
    const at = `guesses[${index}]`;
    if (!categoryOf(raw.category)) return `${at}.category must be one of ${NOTEBOOK_CATEGORIES.join(", ")}`;
    const guess = guessOf(raw);
    if (!guess.line || !guess.fact) return `${at}: line and fact must not be empty`;
    const blank = READ_ME_VERDICTS.find((verdict) => !guess.reactions[verdict].line);
    if (blank) return `${at}.reactions.${blank}.line must not be empty`;
    const long = (
      [
        ["line", [guess.line], READ_ME_WORDS.line],
        ["fact", [guess.fact], READ_ME_WORDS.fact],
        ["reactions", READ_ME_VERDICTS.map((verdict) => guess.reactions[verdict].line), READ_ME_WORDS.reaction],
      ] as const
    ).find(([, values, max]) => values.some((value) => wordCount(value) > max));
    if (long) return `${at}.${long[0]} must be ${long[2]} words or fewer`;
    if (soundsMedical(guess.line) || soundsMedical(guess.fact)) {
      return `${at} is about health or medicine: guess about something else`;
    }
    guesses.push(guess);
  }
  if (new Set(guesses.map((guess) => guess.fact.toLocaleLowerCase())).size !== guesses.length) {
    return "every guess must be about something different";
  }
  return { context, guesses };
}

export interface ReadMePromptInput {
  world: Pick<World, "content" | "images" | "language" | "setting" | "premise" | "writingStyle" | "bannedPhrases">;
  player: Player;
  unit: Pick<Unit, "name" | "pronouns" | "bible">;
  /** Their state as their own reader may know it (ownView), their own notebook with it. */
  liState: LiState;
  /** One thing they may know, from their own recall (reader: them), or "". */
  recalled: string;
  /** Their newest relationship and off-screen ledger lines among those they may know (ownView). */
  lately: string[];
}

/** The Read Me prompt: the READ_ME_GUESSES guesses of one set, as `messages` in the plan's order (§1.7). */
export function readMeMessages({ world, player, unit, liState, recalled, lately }: ReadMePromptInput): OtomeMessage[] {
  const name = unit.name;
  const them = player.name || "the protagonist";
  const voice = `${name}'s own voice, said to the protagonist ("you")`;
  const reaction = `{"line": "...", "face": "${FACES.join("|")}|"}`;
  // ponytail: knowsAboutYou carries only the newest entries within its token budget, so a guess an older entry holds may
  // come again; the upgrade path is a compact list of every entry's text for this prompt alone.
  const known = knowsAboutYou(unit, liState);
  const system = [
    `You write one set of "Read Me", a mini-game in an otome visual novel: ${name} studies the protagonist and makes ${READ_ME_GUESSES} guesses about them, out loud. The player answers each guess (right, close or wrong), then ${name} reacts to the answer.`,
    "Reply with ONLY a JSON object of this shape:",
    `{"context": "...", "guesses": [{"category": "${NOTEBOOK_CATEGORIES.join("|")}", "line": "...", "face": "${FACES.join("|")}|", "fact": "...", "reactions": {"right": ${reaction}, "close": ${reaction}, "wrong": ${reaction}}}]}`,
    "FIELDS",
    `- context: where and how ${name} sits down to study the protagonist, in one or two sentences of narration to "you", present tense, at most ${READ_ME_WORDS.context} words.`,
    `- guesses: exactly ${READ_ME_GUESSES} guesses, each about something different.`,
    `- category: what the guess is about, exactly one of ${NOTEBOOK_CATEGORIES.join(", ")} (always in English).`,
    `- line: the guess in one or two sentences, at most ${READ_ME_WORDS.line} words, in ${voice}.`,
    `- face: the face ${name} wears making the guess, one of ${FACES.join(", ")}, or "" for a plain look.`,
    `- fact: what the guess claims, as one short sentence in the third person about ${them} by name, at most ${READ_ME_WORDS.fact} words (for example "${them} takes ${player.pronouns.possessive} tea bitter.").`,
    `- reactions: ${name}'s reaction to each answer: right (the guess was right), close (nearly right) and wrong (not at all). Each line at most ${READ_ME_WORDS.reaction} words, in ${voice}; each face as above.`,
    "RULES",
    `- Read the protagonist the way ${name} reads people: each guess comes from their persona, from what ${name} has been told and has seen, and from ${name}'s own way of reading people. A guess may be bold, never baseless.`,
    "- Vary the guesses: different categories where you can, some safe and some daring.",
    ...(known ? [`- Never guess again what ${name} already knows (ALREADY KNOWN); a new guess may build on it.`] : []),
    `- Fit stage ${liState.stage}: only what ${name} would say to the protagonist at this stage.`,
    "- Small moments only: nothing in the set changes the story, and no new event happens because of it.",
    "- Never guess about the protagonist's health, illness or medication, or about anyone's period or cycle.",
    `- ${NO_ABSENCE_RULE}`,
    `- Write every field but category in ${world.language}.`,
    "",
    otomeWritingRules({ story: true, style: world.writingStyle, banned: world.bannedPhrases }),
    "",
    otomeContentContract({ world, lis: [{ name }], kind: "chat" }),
  ].join("\n");
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    "",
    'PROTAGONIST (addressed as "you")',
    protagonistBlock(player),
    "",
    "LOVE INTEREST",
    otomeSceneCard(unit, liState),
    betweenYou(unit, liState),
    lately.length ? `\nLately: ${lately.join(" ")}` : "",
    recalled.trim()
      ? `\nWhat ${name} may know of the story (${name} remembers only what ${name} was there for or was told):\n${recalled.trim()}`
      : "",
    known ? `\nALREADY KNOWN (never guess these again)\n${known}` : "",
    "",
    `Write ${name}'s ${READ_ME_GUESSES} guesses of Read Me now.`,
    otomeContractReminder("chat"),
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

// ── Start, answer, finish ──

export interface ReadMeDeps extends GenerationDeps {
  store: OtomeStore;
  memory?: Pick<OtomeMemory, "recall" | "maintain">;
}

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");
const setNotFound = () => new OtomeForgeError(404, "No such Read Me set.", "not-found");
const entryNotFound = () => new OtomeForgeError(404, "No such notebook entry.", "not-found");
const medical = () =>
  new OtomeForgeError(400, "Invalid request: the notebook keeps nothing about health or medicine.", "bad-request");

/** Every readable set of the run, newest first. */
async function listSets(store: Pick<OtomeStore, "listRun">, runId: string): Promise<ReadMeSet[]> {
  return (await store.listRun("readme", runId))
    .map((record) => normalizeSet(record.data))
    .filter((set): set is ReadMeSet => !!set)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The player's own words as the set and the notebook keep them: whitespace collapsed, wrapping quotes stripped, cut to
 * READ_ME_WORDS_MAX; "" for none. Words that sound medical are refused (400) before anything is saved.
 */
export function playerWords(value: string | undefined): string {
  const words = clean(value ?? "");
  if (words && soundsMedical(words)) throw medical();
  return clipText(words, READ_ME_WORDS_MAX).trim();
}

/** `item` with `words` set, or without any for "". */
function withWords<T extends { words?: string }>(item: T, words: string): T {
  const { words: _old, ...rest } = item;
  return (words ? { ...rest, words } : rest) as T;
}

/**
 * POST /runs/:run/read-me {li}: their unfinished set (at any stage), or a new one written in one call (once, whoever
 * asks first). 404 for an unknown run or love interest; 409 `conflict` while their bible is still being written;
 * generateJson's 503, 422 and 502 otherwise (nothing is saved).
 */
export async function startReadMe(
  deps: ReadMeDeps,
  runId: string,
  li: LiId,
  { debugMode }: { debugMode: boolean },
): Promise<ReadMeSetView> {
  const read = async () => (await listSets(deps.store, runId)).find((set) => set.li === li && !set.finished) ?? null;
  const set = await readOrGenerate(runId, read, async () => {
    const run = await readRun(deps.store, runId);
    if (!run) throw runNotFound();
    const unit = run.units.find((entry) => entry.id === li);
    if (!unit || !run.state.lis[li]) throw liNotFound();
    if (!unit.bible) throw new OtomeForgeError(409, `${unit.name}'s bible is not written yet.`, "conflict");
    const { liState, relationship, offscreen } = ownView(run.state, li);
    const lately = [relationship, offscreen].filter((line) => !!line.trim());
    const recalled = await recalledLine(deps.memory, runId, unit, lately, debugMode);
    const { value, connectionId, model } = await generateJson(deps, {
      runId,
      job: "structured",
      label: `read-me/${li}`,
      messages: readMeMessages({ world: run.world, player: run.player, unit, liState, recalled, lately }),
      schema: ReadMeReplySchema,
      normalize: checkReadMeReply,
      temperature: READ_ME_TEMPERATURE,
      maxTokens: READ_ME_MAX_TOKENS,
      debugMode,
      lane: "foreground",
    });
    const guesses = value.guesses.slice(0, READ_ME_GUESSES).map(guessOf);
    const fresh: ReadMeSet = {
      version: 1,
      setId: newReadMeSetId(),
      li,
      names: { li: unit.name, player: run.player.name },
      context: clean(value.context),
      guesses,
      answers: guesses.map(() => null),
      finished: null,
      createdAt: new Date().toISOString(),
      connectionId,
      model,
    };
    const target = readMeTarget(runId, fresh.setId);
    const saved = await deps.store.mutateDoc(target, normalizeSet, (current) => current ?? fresh);
    // The run's delete sweeps its documents after it removes the world; a set saved after the sweep goes too.
    if (!(await deps.store.readDoc(worldId(runId), normalizeWorld))) {
      await deps.store.removeDoc(target.id).catch(() => false);
      throw runNotFound();
    }
    return saved ?? fresh;
  });
  return toSetView(set);
}

/**
 * POST .../read-me/:set/answer {guess, verdict, words?}: guess `guess`'s answer. The first answer is final; another
 * for the same guess returns the first unchanged. 400 for a guess the set does not have, or words that sound medical
 * (nothing is saved then).
 */
export async function answerReadMe(
  deps: Pick<ReadMeDeps, "store">,
  runId: string,
  setId: string,
  { guess, verdict, words }: { guess: number; verdict: ReadMeVerdict; words?: string },
): Promise<ReadMeAnswer> {
  const own = playerWords(words);
  const at = new Date().toISOString();
  const saved = await deps.store.updateDoc(readMeTarget(runId, setId), normalizeSet, (current) => {
    if (!current) throw setNotFound();
    if (!current.guesses[guess]) throw new OtomeForgeError(400, "Invalid request: no such guess", "bad-request");
    if (current.answers[guess]) return current;
    const answers = [...current.answers];
    answers[guess] = { verdict, ...(own ? { words: own } : {}), at };
    return { ...current, answers };
  });
  const answer = saved && answerOf(saved, guess);
  if (!answer) throw setNotFound();
  return answer;
}

/** One notebook entry per answered guess of `set`: the fact, as guessed, with the verdict and the player's words. */
export function notebookEntries(set: ReadMeSet, at: string): NotebookEntry[] {
  return set.guesses.flatMap((guess, index) => {
    const answer = set.answers[index];
    if (!answer) return [];
    const entry: NotebookEntry = {
      id: notebookEntryId(set.setId, index),
      category: guess.category,
      text: clipText(guess.fact, NOTEBOOK_TEXT_MAX),
      verdict: answer.verdict,
      at,
    };
    return [withWords(entry, answer.words ?? "")];
  });
}

/** The affection a finished set earns before the day's cap: the base, plus a little per right and per close guess. */
export function readMeAffection(set: ReadMeSet): number {
  const count = (verdict: ReadMeVerdict) => set.answers.filter((answer) => answer?.verdict === verdict).length;
  return (
    AFFECTION_EARNINGS.readMe +
    count("right") * AFFECTION_EARNINGS.readMeRight +
    count("close") * AFFECTION_EARNINGS.readMeClose
  );
}

/**
 * The state after `set` is finished, pure: Read Me's Starlight and their affection within the day's caps, one
 * notebook entry per guess (an id the notebook already has is never added again), and their first Read Me on the
 * Love Timeline. A love interest the run no longer has earns nothing and learns nothing.
 */
export function applyReadMe(
  state: RunState,
  set: ReadMeSet,
  { at, dayKey = forgeDayKey(Date.now()) }: { at: string; dayKey?: string },
): { state: RunState; grants: ActivityGrant[] } {
  if (!state.lis[set.li]) return { state, grants: [] };
  const grants: ActivityGrant[] = [];
  const paid = grant(state, { source: "read-me", starlight: STARLIGHT_EARNINGS.readMe }, dayKey);
  if (paid.granted.starlight) grants.push({ source: "read-me", starlight: paid.granted.starlight });
  const loved = grant(paid.state, { source: "read-me", li: set.li, affection: readMeAffection(set) }, dayKey);
  if (loved.granted.affection) grants.push({ source: "read-me", li: set.li, affection: loved.granted.affection });
  const next = loved.state;
  const liState = next.lis[set.li]!;
  const first = !liState.firsts[FIRST_READ_ME];
  const fresh = notebookEntries(set, at).filter((entry) => !liState.known.some((known) => known.id === entry.id));
  return {
    grants,
    state: {
      ...next,
      lis: {
        ...next.lis,
        [set.li]: {
          ...liState,
          known: keepNewest([...liState.known, ...fresh], NOTEBOOK_MAX),
          firsts: first ? { ...liState.firsts, [FIRST_READ_ME]: at } : liState.firsts,
        },
      },
      timeline: first
        ? keepTimeline([
            ...next.timeline,
            {
              at,
              li: set.li,
              kind: FIRST_READ_ME_TIMELINE,
              text: clipText(set.context || set.names.li, STATE_LIMITS.text),
              ref: set.setId,
            },
          ])
        : next.timeline,
    },
  };
}

/** What a paid set's mark says it paid, as grants. */
function grantsOf(paid: ReadMePaid): ActivityGrant[] {
  const grants: ActivityGrant[] = [];
  if (paid.starlight) grants.push({ source: "read-me", starlight: paid.starlight });
  if (paid.affection) grants.push({ source: "read-me", li: paid.li, affection: paid.affection });
  return grants;
}

/**
 * POST .../read-me/:set/finish: pays the set and fills the notebook once (see the header). 409 `conflict` while a
 * guess is unanswered; a set already paid returns what it paid then, with the notebook as it is now.
 * ponytail: the state keeps the newest READ_ME_PAID_KEPT paid ids; a set whose state write landed but whose own
 * finished mark never did, and that is only finished again after that many newer sets, would pay twice (within the
 * day's caps) and bring its deleted entries back. The upgrade path is a store write that saves the set and the state
 * together.
 */
export async function finishReadMe(
  deps: Pick<ReadMeDeps, "store">,
  runId: string,
  setId: string,
): Promise<ReadMeFinishResult> {
  const target = readMeTarget(runId, setId);
  const set = await deps.store.readDoc(target.id, normalizeSet);
  if (!set) throw setNotFound();
  if (set.finished) {
    const state = await deps.store.readDoc(stateId(runId), normalizeState);
    return {
      grants: set.finished.grants,
      starlight: state?.wallet.starlight ?? 0,
      known: state?.lis[set.li]?.known ?? [],
    };
  }
  // An answer, once given, never changes: every guess answered now stays answered for the write below.
  if (set.answers.some((answer) => answer === null)) {
    throw new OtomeForgeError(409, "Answer every guess before finishing.", "conflict");
  }
  const at = new Date().toISOString();
  // Set by the write that was saved (updateDoc applies the change again after a stale revision).
  let paid = null as ReadMePaid | null;
  const state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    paid = current.readMe.paid.find((entry) => entry.setId === setId) ?? null;
    if (paid) return current;
    const outcome = applyReadMe(current, set, { at });
    const amount = (key: "starlight" | "affection") =>
      outcome.grants.reduce((sum, entry) => sum + (entry[key] ?? 0), 0);
    paid = { setId, li: set.li, starlight: amount("starlight"), affection: amount("affection") };
    return {
      ...outcome.state,
      readMe: { paid: keepNewest([...outcome.state.readMe.paid, paid], READ_ME_PAID_KEPT) },
    };
  });
  if (!state || !paid) throw runNotFound();
  const grants = grantsOf(paid);
  // Then the set: finished, with what it paid. A failure here is retried by the next finish, which the state's mark
  // keeps from paying or writing the notebook again.
  await deps.store.updateDoc(target, normalizeSet, (current) => {
    if (!current) throw setNotFound();
    return current.finished ? current : { ...current, finished: { at, grants } };
  });
  return { grants, starlight: state.wallet.starlight, known: state.lis[set.li]?.known ?? [] };
}

// ── The notebook ──

/** GET /runs/:run/lis/:li/notebook: what they know about the protagonist, newest last. 404 for an unknown run or LI. */
export async function readNotebook(store: Pick<OtomeStore, "readDoc">, runId: string, li: LiId): Promise<NotebookView> {
  const state = await store.readDoc(stateId(runId), normalizeState);
  if (!state) throw runNotFound();
  const liState = state.lis[li];
  if (!liState) throw liNotFound();
  return { li, entries: liState.known };
}

export type NotebookChange = { action: "edit"; id: string; words: string } | { action: "delete"; id: string };

/**
 * POST /runs/:run/lis/:li/notebook: the player sets or clears ("") the words of an entry, or deletes it. One
 * revision-checked write of the state that touches only their notebook (none when nothing changes); then the set's
 * copy of the words follows, best effort, so a deleted or cleared answer keeps none. 404 for an unknown run, love
 * interest or entry; 400 for words that sound medical (nothing is saved).
 */
export async function changeNotebook(
  store: Pick<OtomeStore, "updateDoc">,
  runId: string,
  li: LiId,
  change: NotebookChange,
): Promise<NotebookView> {
  const words = change.action === "edit" ? playerWords(change.words) : "";
  const saved = await updateIfChanged(store, runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    const liState = current.lis[li];
    if (!liState) throw liNotFound();
    const entry = liState.known.find((item) => item.id === change.id);
    if (!entry) throw entryNotFound();
    if (change.action === "edit" && (entry.words ?? "") === words) return undefined;
    const known =
      change.action === "delete"
        ? liState.known.filter((item) => item.id !== change.id)
        : liState.known.map((item) => (item.id === change.id ? withWords(item, words) : item));
    return { ...current, lis: { ...current.lis, [li]: { ...liState, known } } };
  });
  if (!saved) throw runNotFound();
  await setWords(store, runId, change.id, words).catch(() => null);
  return { li, entries: saved.value.lis[li]?.known ?? [] };
}

/** The set's copy of an entry's words, made `words` ("" drops them); nothing for an id that names no Read Me guess. */
async function setWords(store: Pick<OtomeStore, "updateDoc">, runId: string, id: string, words: string) {
  const [, setId, index] = ENTRY_ID.exec(id) ?? [];
  if (!setId || index === undefined) return null;
  return updateIfChanged(store, readMeTarget(runId, setId), normalizeSet, (current) => {
    const answer = current?.answers[Number(index)];
    if (!current || !answer || (answer.words ?? "") === words) return undefined;
    const answers = [...current.answers];
    answers[Number(index)] = withWords(answer, words);
    return { ...current, answers };
  });
}
