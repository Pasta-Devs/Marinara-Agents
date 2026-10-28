// ──────────────────────────────────────────────
// Otome Forge: Read Him (plan M5 "Read Him", P25; design: Mini-games). The user-facing title reads "Read {{name}}".
// ──────────────────────────────────────────────
// A set is `${R}:readhim:${setId}`: five rounds P25 writes in one call, each a small moment, what he says, the face he
// wears, three or four readings of what he really feels, and (hidden) the true reading, his thought and the mask tell
// that gave him away. The readings are shuffled before they are saved, so the true one has no favourite place.
// - Start: his unfinished set at his current stage is played on (a second tap, a reload or a lost answer never writes
//   another, and a hard set cannot be rerolled); otherwise P25 writes a new one in the run's foreground queue
//   (readOrGenerate reads again inside the queue, so requests that arrive together make one call and one set).
// - The client sees a round's true reading, thought and tell only once that round is answered, and the first pick is
//   the answer: answering again returns it unchanged.
// - Finish needs every round answered and pays once whatever the score (failure still pays): Read Him's Starlight
//   and affection within the day's activity caps (S/state/rewards.ts grant), the tells read right into `tellsLearned`
//   (every later scene card carries them), and the first Read Him on his Love Timeline. All of it lands in one
//   revision-checked write of `${R}:state`, whose once-only mark is the set's id in `readHim.paid` (as a Claw round's
//   is its id in `claw.rounds`); the set is marked finished after it. A finish sent again, or retried after either
//   write failed, applies it exactly once and returns what was paid.
// - A finished set is private memory (readHimMemorySources): a `chat` source with `audience: [li]`, recalled only by
//   his own readers and scenes he is in, and titled private as a phone session is. An unfinished one is never a source.
// P25 writes his words, so it carries the knowledge boundary and the writing rules, on the `home` contract (SFW wording
// plus Lines and Veils, whatever the Heat). It sees his scene card (never an unrevealed secret's truth), his mask tells
// by index, what stands between them, one thing he may know from his own recall, and the moments of his last sets so
// none repeats. The state reaches it as his own reader may know it (story/prompts.ts ownView, M3's rule): no grievance,
// disclosure or ledger line another love interest's own chapter left behind. Prompts are English and never localized;
// the set is written in the world's language.
import { randomInt } from "node:crypto";
import { sliceTextToTokenBudget } from "@forge-kit/shared-token-estimator.mjs";
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import type { ForgeMemorySource } from "@forge-kit/story-memory.mjs";
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
import { wordCount } from "../../../../../client/src/features/otome-forge/shared/home.js";
import {
  READINGS_MAX,
  READINGS_MIN,
  READ_HIM_PAID_KEPT,
  READ_HIM_ROUNDS,
  type ReadHimAnswer,
  type ReadHimFinishResult,
  type ReadHimPaid,
  type ReadHimSetView,
} from "../../../../../client/src/features/otome-forge/shared/read-him.js";
import { otomeContentContract, otomeContractReminder } from "../content-contract.js";
import { generateJson, readOrGenerate, type GenerationDeps, type OtomeMessage } from "../generation.js";
import { NO_ABSENCE_RULE } from "../home/prompts.js";
import { OtomeForgeError } from "../http.js";
import { runDocTarget, stateId, unitId, worldId } from "../ids.js";
import type { OtomeMemory } from "../memory/memory.js";
import { otomeSceneCard } from "../scene-card.js";
import { STATE_LIMITS, clipText, keepNewest, normalizeState, readRun } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeWorld } from "../schemas/world.js";
import { grant } from "../state/rewards.js";
import type { OtomeStore } from "../store.js";
import { betweenYou, ownView } from "../story/prompts.js";
import { otomeWritingRules } from "../writing-rules.js";

export const READ_HIM_TEMPERATURE = 0.9;
export const READ_HIM_MAX_TOKENS = 2400;
/** Word limits a round's fields keep (P25); a reply over them gets the repair turn. */
export const READ_HIM_WORDS = { context: 60, line: 40, reading: 16, thought: 60 } as const;
/** His earlier sets whose moments P25 sees, so a new set never repeats them. */
const RECENT_SETS = 2;
/** One recalled line: about this many tokens of his top memory. */
const RECALLED_TOKENS = 160;
/** The `firsts` key and the Love Timeline kind of his first finished Read Him. */
export const FIRST_READ_HIM = "read-him";
export const FIRST_READ_HIM_TIMELINE = "first-read-him";
const TEXT_MAX = 1200;

// ── The set document ──

export interface ReadHimRound {
  context: string;
  line: string;
  face: Face | "";
  readings: string[];
  trueIndex: number;
  thought: string;
  /** The index of the mask tell that gave him away, or null. */
  tell: number | null;
}

/** `${R}:readhim:${setId}` (hidden: only toSetView and answerOf reach the client, each round once answered). */
export interface ReadHimSet {
  version: 1;
  setId: string;
  li: LiId;
  /** His stage when it was written: only a set at his current stage is played on. */
  stage: number;
  /** His name and the protagonist's when it was written, for the memory it becomes. */
  names: { li: string; player: string };
  /** His mask tells when it was written: a tell is learned only while his bible still has it at that index. */
  tells: string[];
  rounds: ReadHimRound[];
  /** The first pick for each round, or null while it is unanswered. */
  picks: Array<number | null>;
  /** Set once its pay is in the state, with what it paid (for a finish sent again and for his memory). */
  finished: { at: string; grants: ActivityGrant[] } | null;
  createdAt: string;
  connectionId: string;
  model: string;
}

export const readHimId = (runId: string, setId: string) => `${runId}:readhim:${setId}`;
/** The `{id, kind, name}` a set is saved with ("readhim" is one of RUN_DOC_KINDS, so deleting a run sweeps its sets). */
export const readHimTarget = (runId: string, setId: string) => runDocTarget("readhim", readHimId(runId, setId));

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/** `rh-<Date.now base36>-<6 [a-z0-9]>` (SH/read-him.ts READ_HIM_SET_ID). */
export function newReadHimSetId(now = Date.now()): string {
  let token = "";
  for (let index = 0; index < 6; index += 1) token += ALPHABET[randomInt(ALPHABET.length)];
  return `rh-${Math.max(0, Math.trunc(now)).toString(36)}-${token}`;
}

const text = (max = TEXT_MAX) => z.string().max(max);
const GrantSchema: ZodType<ActivityGrant> = z.object({
  source: z.literal("read-him"),
  starlight: z.number().int().min(0).optional(),
  li: z.string().optional(),
  affection: z.number().int().min(0).optional(),
});
const RoundSchema = z.object({
  context: text(),
  line: text(),
  face: z.string().max(40),
  readings: z.array(text(400)).min(READINGS_MIN).max(READINGS_MAX),
  trueIndex: z
    .number()
    .int()
    .min(0)
    .max(READINGS_MAX - 1),
  thought: text(),
  tell: z.number().int().min(0).nullable(),
});
const SetSchema = z.object({
  setId: z.string().min(1).max(40),
  li: z.string().min(1).max(80),
  stage: z.number().int().min(1),
  names: z.object({ li: text(400), player: text(400) }),
  tells: z.array(text(600)).max(12),
  rounds: z.array(RoundSchema).min(1).max(12),
  picks: z.array(
    z
      .number()
      .int()
      .min(0)
      .max(READINGS_MAX - 1)
      .nullable(),
  ),
  finished: z.object({ at: z.string(), grants: z.array(GrantSchema) }).nullable(),
  createdAt: z.string(),
  connectionId: z.string(),
  model: z.string(),
});

/** A stored set, or null for none (missing or damaged: a damaged set is never played on, paid or recalled). */
export function normalizeSet(data: unknown): ReadHimSet | null {
  const parsed = SetSchema.safeParse(data);
  if (!parsed.success) return null;
  const set = parsed.data;
  if (set.rounds.some((round) => round.trueIndex >= round.readings.length)) return null;
  const rounds = set.rounds.map((round) => ({ ...round, face: isFace(round.face) ? round.face : ("" as const) }));
  const picks = rounds.map((round, index) => {
    const pick = set.picks[index];
    return typeof pick === "number" && pick < round.readings.length ? pick : null;
  });
  return { version: 1, ...set, rounds, picks };
}

/** What the client may see of a set: each round's readings, and its answer once it was given. */
export function toSetView(set: ReadHimSet): ReadHimSetView {
  return {
    setId: set.setId,
    li: set.li,
    rounds: set.rounds.map((round, index) => {
      const answer = answerOf(set, index);
      return {
        context: round.context,
        line: round.line,
        face: round.face,
        readings: round.readings,
        ...(answer ? { answer } : {}),
      };
    }),
    grants: set.finished ? set.finished.grants : null,
  };
}

/** Round `index`'s answer, or null while it is unanswered. Only an answered round names its truth. */
export function answerOf(set: ReadHimSet, index: number): ReadHimAnswer | null {
  const round = set.rounds[index];
  const pick = set.picks[index];
  if (!round || pick === null || pick === undefined) return null;
  const correct = pick === round.trueIndex;
  const tell = correct && round.tell !== null ? set.tells[round.tell] : undefined;
  return {
    pick,
    correct,
    trueIndex: round.trueIndex,
    thought: round.thought,
    ...(tell ? { tellLearned: tell } : {}),
  };
}

/** The mask tells read right in `set` that his bible still has at the same index (`current`), each once. */
export function learnedTells(set: ReadHimSet, current: readonly string[]): number[] {
  const learned = set.rounds
    .filter((round, index) => round.tell !== null && set.picks[index] === round.trueIndex)
    .map((round) => round.tell as number)
    .filter((tell) => current[tell] !== undefined && current[tell] === set.tells[tell]);
  return [...new Set(learned)];
}

// ── P25: read-him-set (structured, 0.9, home contract, foreground lane) ──

export interface ReadHimReplyRound {
  context: string;
  line: string;
  face?: string | null;
  readings: string[];
  trueIndex: number;
  thought: string;
  tell?: number | null;
}
export interface ReadHimReply {
  rounds: ReadHimReplyRound[];
}

export const ReadHimReplySchema: ZodType<ReadHimReply> = z.object({
  rounds: z
    .array(
      z.object({
        context: z.string().min(1).max(TEXT_MAX),
        line: z.string().min(1).max(TEXT_MAX),
        face: z.string().max(40).nullable().optional(),
        readings: z.array(z.string().max(400)).min(READINGS_MIN).max(READINGS_MAX),
        trueIndex: z
          .number()
          .int()
          .min(0)
          .max(READINGS_MAX - 1),
        thought: z.string().min(1).max(TEXT_MAX),
        tell: z.number().int().nullable().optional(),
      }),
    )
    .min(READ_HIM_ROUNDS)
    .max(READ_HIM_ROUNDS + 3),
});

const clean = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“”'‘’「『]+|["“”'‘’」』]+$/gu, "")
    .trim();

/**
 * P25's checks: exactly five rounds (extra ones are dropped), each with three or four different readings, a true index
 * that names one of them, and every field within its word limit. A face that is not one of the five is a plain look;
 * a tell that names no mask tell is none.
 */
export function checkReadHimReply(tellCount: number) {
  return (reply: ReadHimReply): ReadHimReply | string => {
    const rounds: ReadHimReplyRound[] = [];
    for (const [index, raw] of reply.rounds.slice(0, READ_HIM_ROUNDS).entries()) {
      const at = `rounds[${index}]`;
      const context = clean(raw.context);
      const line = clean(raw.line);
      const thought = clean(raw.thought);
      const readings = raw.readings.map(clean);
      if (!context || !line || !thought) return `${at}: context, line and thought must not be empty`;
      if (readings.some((reading) => !reading)) return `${at}.readings: a reading is empty`;
      if (new Set(readings.map((reading) => reading.toLocaleLowerCase())).size !== readings.length) {
        return `${at}.readings must all be different`;
      }
      if (raw.trueIndex >= readings.length) return `${at}.trueIndex must be the index of one of its readings`;
      const long = (
        [
          ["context", [context], READ_HIM_WORDS.context],
          ["line", [line], READ_HIM_WORDS.line],
          ["thought", [thought], READ_HIM_WORDS.thought],
          ["readings", readings, READ_HIM_WORDS.reading],
        ] as const
      ).find(([, values, max]) => values.some((value) => wordCount(value) > max));
      if (long) return `${at}.${long[0]} must be ${long[2]} words or fewer`;
      const tell = raw.tell;
      rounds.push({
        context,
        line,
        face: isFace(raw.face) ? raw.face : "",
        readings,
        trueIndex: raw.trueIndex,
        thought,
        tell: typeof tell === "number" && Number.isInteger(tell) && tell >= 0 && tell < tellCount ? tell : null,
      });
    }
    return { rounds };
  };
}

/** The round with its readings in a random order and the true index moved with them. */
export function shuffleRound(round: ReadHimReplyRound, random: (below: number) => number = randomInt): ReadHimRound {
  const order = round.readings.map((_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const other = random(index + 1);
    [order[index], order[other]] = [order[other]!, order[index]!];
  }
  return {
    context: round.context,
    line: round.line,
    face: isFace(round.face) ? round.face : "",
    readings: order.map((from) => round.readings[from]!),
    trueIndex: order.indexOf(round.trueIndex),
    thought: round.thought,
    tell: round.tell ?? null,
  };
}

export interface ReadHimPromptInput {
  world: Pick<World, "content" | "images" | "language" | "setting" | "premise">;
  player: Pick<Player, "name" | "pronouns">;
  unit: Pick<Unit, "name" | "pronouns" | "bible">;
  /** His state as his own reader may know it (ownView). */
  liState: LiState;
  /** One thing he may know, from his own recall (reader: him), or "". */
  recalled: string;
  /** His newest relationship and off-screen ledger lines among those he may know (ownView). */
  lately: string[];
  /** The moments of his last sets, newest first, so none repeats. */
  recent: readonly string[];
}

const pronounText = (pronouns: Unit["pronouns"]) => `${pronouns.subject}/${pronouns.object}/${pronouns.possessive}`;

/** P25: the five rounds of one Read Him set, as `messages` in the plan's order (§1.7). */
export function readHimMessages({
  world,
  player,
  unit,
  liState,
  recalled,
  lately,
  recent,
}: ReadHimPromptInput): OtomeMessage[] {
  const name = unit.name;
  const tells = unit.bible?.mask.tells ?? [];
  const system = [
    `You write one set of "Read ${name}", a mini-game in an otome visual novel. Each round is a small moment with ${name}: what ${name} says and the face ${name} wears saying it. The player picks which of three or four readings is what ${name} really feels; then ${name}'s private thought is revealed.`,
    "Reply with ONLY a JSON object of this shape:",
    `{"rounds": [{"context": "...", "line": "...", "face": "${FACES.join("|")}|", "readings": ["...", "...", "..."], "trueIndex": 0, "thought": "...", "tell": 0}]}`,
    "FIELDS",
    `- rounds: exactly ${READ_HIM_ROUNDS} rounds, each a different small moment.`,
    `- context: the moment in one or two sentences, to "you" (the protagonist), present tense, at most ${READ_HIM_WORDS.context} words. When the round has a tell, the context shows it plainly in your own words, without calling it a tell.`,
    `- line: what ${name} says to the protagonist, at most ${READ_HIM_WORDS.line} words, in ${name}'s own voice.`,
    `- face: the face ${name} wears saying it, one of ${FACES.join(", ")}, or "" for a plain look. It may contradict the line.`,
    `- readings: ${READINGS_MIN} or ${READINGS_MAX} short readings of what ${name} really feels, each at most ${READ_HIM_WORDS.reading} words, all different. Exactly one is true; the others are plausible decoys: what the words, the face or the mask would make someone believe.`,
    "- trueIndex: the index, from 0, of the true reading in readings.",
    `- thought: ${name}'s private thought in that moment, in the first person and ${name}'s own register, at most ${READ_HIM_WORDS.thought} words. It shows the true reading without quoting it.`,
    "- tell: the index of the mask tell (from the MASK TELLS list) that gives the true feeling away in this round, or null. Use at least two different tells across the set.",
    "RULES",
    "- The decoys are believable: a player who reads the moment closely can find the truth, and one who skims cannot.",
    "- Vary the truths: in at least one round the plain meaning of the words is the true one, and in another the face is what lies.",
    `- Fit stage ${liState.stage}: only what ${name} lets show at this stage, and only feelings ${name} would have.`,
    "- No spoilers: a thought never states a hidden secret or anything the protagonist has not learned; a hidden secret may show only as a tell.",
    "- Small moments only: nothing in a round changes the story, and no new event happens because of it.",
    `- ${NO_ABSENCE_RULE}`,
    `- Write every field in ${world.language}.`,
    "",
    otomeWritingRules({ story: true }),
    "",
    otomeContentContract({ world, lis: [{ name }], kind: "home" }),
  ].join("\n");
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    "",
    "PROTAGONIST",
    `${player.name || "The protagonist"} (${pronounText(player.pronouns)}), addressed as "you". Never assume a gender the pronouns do not state.`,
    "",
    "LOVE INTEREST",
    otomeSceneCard(unit, liState),
    betweenYou(unit, liState),
    "",
    "MASK TELLS (by index)",
    ...tells.map((tell, index) => `${index}: ${tell}`),
    lately.length ? `\nLately: ${lately.join(" ")}` : "",
    recalled.trim()
      ? `\nWhat ${name} may know of the story (${name} remembers only what ${name} was there for or was told):\n${recalled.trim()}`
      : "",
    recent.length
      ? `\nRECENT MOMENTS (from earlier sets; do not repeat)\n${recent.map((moment) => `- ${moment}`).join("\n")}`
      : "",
    "",
    `Write the ${READ_HIM_ROUNDS} rounds of Read ${name} now.`,
    otomeContractReminder("home"),
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

// ── Start, answer, finish ──

export interface ReadHimDeps extends GenerationDeps {
  store: OtomeStore;
  memory?: Pick<OtomeMemory, "recall" | "maintain">;
}

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");
const setNotFound = () => new OtomeForgeError(404, "No such Read Him set.", "not-found");

/** Every readable set of the run, newest first. */
async function listSets(store: Pick<OtomeStore, "listRun">, runId: string): Promise<ReadHimSet[]> {
  return (await store.listRun("readhim", runId))
    .map((record) => normalizeSet(record.data))
    .filter((set): set is ReadHimSet => !!set)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** One thing he may know, from his own recall; "" when memory has nothing ready or fails. */
async function recalledLine(
  memory: ReadHimDeps["memory"],
  runId: string,
  unit: Pick<Unit, "id" | "name">,
  cues: string[],
  debugMode: boolean,
): Promise<string> {
  if (!memory) return "";
  try {
    const result = await memory.recall({
      runId,
      job: "structured",
      reader: unit.id,
      query: { cues, speakers: [unit.name] },
    });
    if (result.lagging) void Promise.resolve(memory.maintain({ runId, debugMode })).catch(() => undefined);
    const top = result.status.phase === "ready" ? (result.details[0]?.content ?? "").trim() : "";
    return top ? sliceTextToTokenBudget(top, RECALLED_TOKENS) : "";
  } catch {
    return "";
  }
}

/**
 * POST /runs/:run/read-him {li}: his unfinished set at his current stage, or a new one P25 writes (once, whoever asks
 * first). 404 for an unknown run or love interest; 409 `conflict` while his bible is still being written; generateJson's
 * 503, 422 and 502 otherwise (nothing is saved).
 */
export async function startReadHim(
  deps: ReadHimDeps,
  runId: string,
  li: LiId,
  { debugMode, random = randomInt }: { debugMode: boolean; random?: (below: number) => number },
): Promise<ReadHimSetView> {
  const read = async () => {
    const [sets, state] = await Promise.all([
      listSets(deps.store, runId),
      deps.store.readDoc(stateId(runId), normalizeState),
    ]);
    const stage = state?.lis[li]?.stage;
    return sets.find((set) => set.li === li && !set.finished && set.stage === stage) ?? null;
  };
  const set = await readOrGenerate(runId, read, async () => {
    const run = await readRun(deps.store, runId);
    if (!run) throw runNotFound();
    const unit = run.units.find((entry) => entry.id === li);
    if (!unit || !run.state.lis[li]) throw liNotFound();
    if (!unit.bible) throw new OtomeForgeError(409, `${unit.name}'s bible is not written yet.`, "conflict");
    const { liState, relationship, offscreen } = ownView(run.state, li);
    const lately = [relationship, offscreen].filter((line) => !!line.trim());
    const [recalled, sets] = await Promise.all([
      recalledLine(deps.memory, runId, unit, lately, debugMode),
      listSets(deps.store, runId),
    ]);
    const recent = sets
      .filter((entry) => entry.li === li)
      .slice(0, RECENT_SETS)
      .flatMap((entry) => entry.rounds.map((round) => round.context));
    const tells = unit.bible.mask.tells;
    const { value, connectionId, model } = await generateJson(deps, {
      runId,
      job: "structured",
      label: `read-him/${li}`,
      messages: readHimMessages({
        world: run.world,
        player: run.player,
        unit,
        liState,
        recalled,
        lately,
        recent,
      }),
      schema: ReadHimReplySchema,
      normalize: checkReadHimReply(tells.length),
      temperature: READ_HIM_TEMPERATURE,
      maxTokens: READ_HIM_MAX_TOKENS,
      debugMode,
      lane: "foreground",
    });
    const fresh: ReadHimSet = {
      version: 1,
      setId: newReadHimSetId(),
      li,
      stage: liState.stage,
      names: { li: unit.name, player: run.player.name },
      tells: [...tells],
      rounds: value.rounds.map((round) => shuffleRound(round, random)),
      picks: value.rounds.map(() => null),
      finished: null,
      createdAt: new Date().toISOString(),
      connectionId,
      model,
    };
    const target = readHimTarget(runId, fresh.setId);
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
 * POST .../read-him/:set/answer {round, pick}: round `round`'s answer. The first pick is the answer; another pick for
 * the same round returns the first unchanged. 400 for a round or reading the set does not have.
 */
export async function answerReadHim(
  deps: Pick<ReadHimDeps, "store">,
  runId: string,
  setId: string,
  round: number,
  pick: number,
): Promise<ReadHimAnswer> {
  const saved = await deps.store.updateDoc(readHimTarget(runId, setId), normalizeSet, (current) => {
    if (!current) throw setNotFound();
    const shown = current.rounds[round];
    if (!shown || pick >= shown.readings.length) {
      throw new OtomeForgeError(400, "Invalid request: no such round or reading", "bad-request");
    }
    if (current.picks[round] !== null) return current;
    const picks = [...current.picks];
    picks[round] = pick;
    return { ...current, picks };
  });
  const answer = saved && answerOf(saved, round);
  if (!answer) throw setNotFound();
  return answer;
}

/**
 * The state after `set` is finished, pure: Read Him's Starlight and his affection within the day's caps, the tells read
 * right (that `currentTells`, his bible's now, still has at the same index) into his `tellsLearned`, and his first Read
 * Him on the Love Timeline. A love interest the run no longer has earns nothing.
 */
export function applyReadHim(
  state: RunState,
  set: ReadHimSet,
  currentTells: readonly string[],
  { at, dayKey = forgeDayKey(Date.now()) }: { at: string; dayKey?: string },
): { state: RunState; grants: ActivityGrant[] } {
  if (!state.lis[set.li]) return { state, grants: [] };
  const grants: ActivityGrant[] = [];
  const paid = grant(state, { source: "read-him", starlight: STARLIGHT_EARNINGS.readHim }, dayKey);
  if (paid.granted.starlight) grants.push({ source: "read-him", starlight: paid.granted.starlight });
  const loved = grant(paid.state, { source: "read-him", li: set.li, affection: AFFECTION_EARNINGS.readHim }, dayKey);
  if (loved.granted.affection) grants.push({ source: "read-him", li: set.li, affection: loved.granted.affection });
  const next = loved.state;
  const liState = next.lis[set.li]!;
  const first = !liState.firsts[FIRST_READ_HIM];
  // His thought from the first round read right (else the first round), for the Love Timeline.
  const shown = set.rounds.find((round, index) => set.picks[index] === round.trueIndex) ?? set.rounds[0];
  return {
    grants,
    state: {
      ...next,
      lis: {
        ...next.lis,
        [set.li]: {
          ...liState,
          // In the order they were learned (the state keeps them so).
          tellsLearned: [
            ...liState.tellsLearned,
            ...learnedTells(set, currentTells).filter((tell) => !liState.tellsLearned.includes(tell)),
          ],
          firsts: first ? { ...liState.firsts, [FIRST_READ_HIM]: at } : liState.firsts,
        },
      },
      timeline: first
        ? keepNewest(
            [
              ...next.timeline,
              {
                at,
                li: set.li,
                kind: FIRST_READ_HIM_TIMELINE,
                text: clipText(shown?.thought ?? "", STATE_LIMITS.text),
                ref: set.setId,
              },
            ],
            STATE_LIMITS.timeline,
          )
        : next.timeline,
    },
  };
}

/** What a paid set's mark says it paid, as grants. */
function grantsOf(paid: ReadHimPaid): ActivityGrant[] {
  const grants: ActivityGrant[] = [];
  if (paid.starlight) grants.push({ source: "read-him", starlight: paid.starlight });
  if (paid.affection) grants.push({ source: "read-him", li: paid.li, affection: paid.affection });
  return grants;
}

/**
 * POST .../read-him/:set/finish: pays the set once, whatever its score (see the header). 409 `conflict` while a round
 * is unanswered; a set already paid returns what it paid then.
 * ponytail: the state keeps the newest READ_HIM_PAID_KEPT paid ids; a set whose state write landed but whose own
 * finished mark never did, and that is only finished again after that many newer sets, would pay twice (within the
 * day's caps). The upgrade path is a store write that saves the set and the state together.
 */
export async function finishReadHim(
  deps: ReadHimDeps,
  runId: string,
  setId: string,
  { debugMode = false }: { debugMode?: boolean } = {},
): Promise<ReadHimFinishResult> {
  const target = readHimTarget(runId, setId);
  const set = await deps.store.readDoc(target.id, normalizeSet);
  if (!set) throw setNotFound();
  if (set.finished) {
    const state = await deps.store.readDoc(stateId(runId), normalizeState);
    return { grants: set.finished.grants, starlight: state?.wallet.starlight ?? 0 };
  }
  // A pick, once made, never changes: every round answered now stays answered for the write below.
  if (set.picks.some((pick) => pick === null)) {
    throw new OtomeForgeError(409, "Answer every round before finishing.", "conflict");
  }
  const unit = await deps.store.readDoc(unitId(runId, set.li), normalizeUnit);
  const currentTells = unit?.bible?.mask.tells ?? [];
  const at = new Date().toISOString();
  // Set by the write that was saved (updateDoc applies the change again after a stale revision).
  let paid = null as ReadHimPaid | null;
  let finishedNow = false as boolean;
  const state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    paid = current.readHim.paid.find((entry) => entry.setId === setId) ?? null;
    if (paid) return current;
    const outcome = applyReadHim(current, set, currentTells, { at });
    const amount = (key: "starlight" | "affection") =>
      outcome.grants.reduce((sum, entry) => sum + (entry[key] ?? 0), 0);
    paid = { setId, li: set.li, starlight: amount("starlight"), affection: amount("affection") };
    return {
      ...outcome.state,
      readHim: { paid: keepNewest([...outcome.state.readHim.paid, paid], READ_HIM_PAID_KEPT) },
    };
  });
  if (!state || !paid) throw runNotFound();
  const grants = grantsOf(paid);
  // Then the set: finished, with what it paid (his memory, and a finish sent again). A failure here is retried by the
  // next finish, which the state's mark keeps from paying again.
  await deps.store.updateDoc(target, normalizeSet, (current) => {
    if (!current) throw setNotFound();
    finishedNow = !current.finished;
    return current.finished ? current : { ...current, finished: { at, grants } };
  });
  // A finished set is new canon for his memory.
  if (finishedNow) void Promise.resolve(deps.memory?.maintain({ runId, debugMode })).catch(() => undefined);
  return { grants, starlight: state.wallet.starlight };
}

// ── Private memory ──

/**
 * Where a finished set sits in story order: after the main chapters completed before it, among the side stories by
 * time (S/phone/memory.ts orders a closed phone session the same way).
 */
function orderOf(state: RunState, finishedAt: string): number {
  const mainDone = Object.entries(state.chapters).filter(
    ([key, progress]) => key.startsWith("main-") && progress.completed && progress.completed < finishedAt,
  ).length;
  return mainDone * 10000 + 5000 + (Date.parse(finishedAt) || 0) / 1e13;
}

/** What he remembers of a finished set: each moment, how it was read, and what was really felt. English prompt text. */
export function readHimMemoryText(set: ReadHimSet): string {
  const name = set.names.li || "The love interest";
  const player = set.names.player || "The protagonist";
  const right = set.rounds.filter((round, index) => set.picks[index] === round.trueIndex).length;
  const lines = set.rounds.map((round, index) => {
    const pick = set.picks[index];
    const read = pick === null || pick === undefined ? "" : (round.readings[pick] ?? "");
    const truth = round.readings[round.trueIndex] ?? "";
    const reading =
      pick === round.trueIndex
        ? `${player} read it right: ${truth}.`
        : `${player} read it as "${read}"; underneath, ${name} felt: ${truth}.`;
    return `- ${round.context} ${name}: "${round.line}" ${reading} ${name} thought: "${round.thought}"`;
  });
  return [
    `${player} tried to read ${name} in ${set.rounds.length} small moments and read ${right} right.`,
    ...lines,
  ].join("\n");
}

/**
 * Every finished Read Him set of the run as a `chat` memory source with `audience: [li]` (S/memory/sources.ts adds
 * these to the run's sources): only his own readers and scenes he is in recall it, and it never reaches the shared
 * overview. Sets of love interests the run no longer has, and unfinished sets, are not sources.
 */
export async function readHimMemorySources(
  store: Pick<OtomeStore, "listRun">,
  runId: string,
  state: RunState,
): Promise<ForgeMemorySource[]> {
  return (await listSets(store, runId))
    .filter((set) => set.finished && state.lis[set.li])
    .map((set) => ({
      id: `readhim-${set.setId}`,
      kind: "chat" as const,
      // Private, as S/phone/memory.ts titles a phone session: a scene with others in it recalls it as theirs alone.
      title: `${set.names.player || "The protagonist"} reads ${set.names.li || "a love interest"} (private: only ${set.names.li || "that love interest"} and the protagonist know how it went)`,
      content: readHimMemoryText(set),
      order: orderOf(state, set.finished!.at),
      audience: [set.li],
    }));
}
