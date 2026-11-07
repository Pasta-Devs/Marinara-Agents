// ──────────────────────────────────────────────
// Otome Hearth: the personality quiz (#2174), played while a chapter is planned
// ──────────────────────────────────────────────
// The player answers statements on a 1–5 scale (strongly disagree to strongly agree) and then sees how each love
// interest answered the same one (SH/quiz.ts counts how alike they are; no model call). The statements are the 100
// starters (S/minigames/quiz-statements.ts) and those refills wrote since; one about sex or kinks (`adult`) is shown,
// scored and written only while the story's Heat is NSFW (SH/content.ts intimacyOpen), and every statement a refill
// writes under NSFW Heat counts as one (the model may leave its tag off), so none of them shows once Heat is SFW.
//
// `${R}:quiz` (kind "quiz", one per story) keeps what changes: the statements refills wrote, each love interest's
// score per statement, and the player's answers (the first is final). It is never read by any other prompt: a love
// interest's answers live here, not in their bible, because the bible rides in prompts (S/prompts.ts bibleBlock).
//
// Model calls, each one background job on the Planning connection, in the maintainer's line format
// "<statement>: <name> <score> | <name> <score> | …" (S/prompts.ts quizScoreMessages, quizRefillMessages), parsed
// leniently (parseQuizLines: numbering, brackets, an [18+] tag, a colon inside the statement, "Kai: 5" or "Kai (5)",
// titles and honorifics on a name; a line or score that cannot be read is skipped, and a reply with too few is sent
// back once by the generation core's repair turn):
// - Scores: when a story's last bible is written (S/setup/forge.ts), whenever a forged story is opened (GET /runs/:run,
//   so a story from before the quiz has its answers by its first chapter-planning wait), and whenever the quiz is read,
//   if a statement the player can see has no score from a current love interest (an older story, a newcomer, Heat
//   raised later), one call answers what is missing, at most QUIZ_SCORE_BATCH statements at a time. Existing scores
//   are never replaced, and once every score exists nothing is queued.
// - Refill: once the player has answered every statement they can see, one call writes QUIZ_REFILL new ones with every
//   current love interest's score, given every statement they can see so none repeats (an 18+ one is never listed
//   under SFW; a repeat of any statement, shown or hidden, is dropped anyway).
// Each kind runs at most once at a time per story (the background queue's key), and one that failed, or a scoring
// call whose reply left some of what it asked unanswered, is left alone for QUIZ_RETRY_MS, so a statement the model
// keeps skipping never costs a call on every read. A story deleted while a job ran keeps no quiz.
// ponytail: the cool-down and the queue live in this process only (as plush's do); a restart forgets them, and the
// next read queues again. The upgrade path is a job document.
import { z } from "zod";
import type { LiId, Unit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { intimacyOpen } from "../../../../../client/src/features/otome-forge/shared/content.js";
import {
  QUIZ_REFILL,
  isQuizScore,
  type QuizScore,
  type QuizStatementView,
  type QuizView,
} from "../../../../../client/src/features/otome-forge/shared/quiz.js";
import type { BackgroundQueue } from "../background-queue.js";
import { generateJson, resolveConnectionId, type GenerationDeps } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { isLiId, quizId, runDocTarget } from "../ids.js";
import { fold, nameCore, nameWords } from "../names.js";
import { quizRefillMessages, quizScoreMessages } from "../prompts.js";
import { isRecord } from "../schemas/common.js";
import { readRun, type RunDocuments as Run } from "../schemas/state.js";
import type { OtomeStore } from "../store.js";
import { QUIZ_STARTERS } from "./quiz-statements.js";

/** Statements one scoring call answers at most; more wait for the next read. */
export const QUIZ_SCORE_BATCH = 120;
/** Statements refills may write in all (40 refills). */
export const QUIZ_WRITTEN_MAX = 2000;
/** How long a quiz job that failed is left alone before the next read queues it again. */
export const QUIZ_RETRY_MS = 10 * 60_000;
/** The longest statement kept, in characters. */
export const QUIZ_TEXT_MAX = 300;
/** A refill whose reply brings fewer new statements than this is sent back once. */
const REFILL_MIN = 10;

/** A statement a refill wrote; `w<n>` in the order written. */
export interface QuizWritten {
  id: string;
  text: string;
  adult: boolean;
}

/** `${R}:quiz` */
export interface QuizDoc {
  version: 1;
  written: QuizWritten[];
  /** By statement id, then love interest. */
  scores: Record<string, Partial<Record<LiId, QuizScore>>>;
  /** The player's own answers, by statement id. */
  answers: Record<string, QuizScore>;
}

const STATEMENT_ID = /^(?:[pilt]\d{2}|w[1-9]\d{0,4})$/;
const quizTarget = (runId: string) => runDocTarget("quiz", quizId(runId));
const scoreKey = (runId: string) => `${quizId(runId)}#scores`;
const refillKey = (runId: string) => `${quizId(runId)}#refill`;

/** The quiz as stored; anything damaged is dropped, entry by entry. */
export function normalizeQuiz(data: unknown): QuizDoc {
  const raw = isRecord(data) ? data : {};
  const written: QuizWritten[] = [];
  for (const entry of Array.isArray(raw.written) ? raw.written : []) {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.text !== "string") continue;
    const text = entry.text.trim();
    if (!/^w[1-9]\d{0,4}$/.test(entry.id) || !text || text.length > QUIZ_TEXT_MAX) continue;
    if (written.some((kept) => kept.id === entry.id)) continue;
    written.push({ id: entry.id, text, adult: entry.adult === true });
    if (written.length >= QUIZ_WRITTEN_MAX) break;
  }
  const scores: QuizDoc["scores"] = {};
  for (const [id, byLi] of Object.entries(isRecord(raw.scores) ? raw.scores : {})) {
    if (!STATEMENT_ID.test(id) || !isRecord(byLi)) continue;
    const kept = Object.fromEntries(Object.entries(byLi).filter(([li, score]) => isLiId(li) && isQuizScore(score)));
    if (Object.keys(kept).length) scores[id] = kept as Partial<Record<LiId, QuizScore>>;
  }
  const answers = Object.fromEntries(
    Object.entries(isRecord(raw.answers) ? raw.answers : {}).filter(
      ([id, score]) => STATEMENT_ID.test(id) && isQuizScore(score),
    ),
  ) as Record<string, QuizScore>;
  return { version: 1, written, scores, answers };
}

export async function readQuiz(store: Pick<OtomeStore, "readDoc">, runId: string): Promise<QuizDoc> {
  return (await store.readDoc(quizId(runId), normalizeQuiz)) ?? normalizeQuiz(undefined);
}

// ── Which statements, and whose answers ──

interface Statement {
  id: string;
  text: string;
  adult: boolean;
}

/** Every statement the player may see now, in the order they are asked: the starters, then what refills wrote. */
function visibleStatements(run: Pick<Run, "world">, doc: QuizDoc): Statement[] {
  const adult = intimacyOpen(run.world.content);
  return [...QUIZ_STARTERS, ...doc.written].filter((statement) => adult || !statement.adult);
}

/** The love interests who answer: in the story now, with a bible. */
function answering(run: Pick<Run, "units" | "state">): Unit[] {
  return run.units.filter((unit) => unit.bible && run.state.lis[unit.id]);
}

/** The visible statements some current love interest has not answered, and who is missing on any of them. */
export function missingScores(run: Pick<Run, "world" | "units" | "state">, doc: QuizDoc) {
  const lis = answering(run);
  const statements = visibleStatements(run, doc).filter((statement) =>
    lis.some((unit) => !doc.scores[statement.id]?.[unit.id]),
  );
  const units = lis.filter((unit) => statements.some((statement) => !doc.scores[statement.id]?.[unit.id]));
  return { statements, units };
}

/** The quiz as the player sees it now. */
export function quizView(
  run: Pick<Run, "world" | "units" | "state">,
  doc: QuizDoc,
  writing: { scoring: boolean; refilling: boolean },
): QuizView {
  const lis = answering(run).map((unit) => unit.id);
  const views = visibleStatements(run, doc).map((statement): QuizStatementView => {
    const scores = Object.fromEntries(
      lis.flatMap((li) => (doc.scores[statement.id]?.[li] ? [[li, doc.scores[statement.id]![li]!]] : [])),
    );
    const answer = doc.answers[statement.id];
    return { id: statement.id, text: statement.text, scores, ...(answer ? { answer } : {}) };
  });
  return {
    open: views.filter((view) => !view.answer),
    answered: views.filter((view) => view.answer),
    ...writing,
  };
}

// ── Reading the line format ──

export interface QuizLine {
  statement: string;
  /** The statement carried an [18+] tag, anywhere before the scores. */
  adult: boolean;
  scores: Array<{ name: string; score: number }>;
}

/** A name and its score: "Kai 5", "Kai: 5", "Kai = 5", "Kai (5)", "Kai 5/5", "**Kai** – 5". */
const SCORE_PART = /^(.*?[^\s:=(–—-])\s*(?:[:=–—-]\s*)?\(?\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:\/\s*5)?\s*\)?\.?$/u;

/** The 18+ tag a statement may carry: bracketed or parenthesized, spaces allowed inside. */
const ADULT_TAG = /[[(]\s*18\s*\+\s*[\])]/u;
const ADULT_TAGS = new RegExp(ADULT_TAG.source, "gu");
/** The tag in its own emphasis ("**[18+]**", "*[18+]*"), which goes with it. */
const WRAPPED_ADULT_TAGS = new RegExp(`(\\*{1,2})\\s*${ADULT_TAG.source}\\s*\\1`, "gu");

/** One line of the reply, or null when it is not "<statement>: <name> <score> | …" (see the header). */
export function parseQuizLine(raw: string): QuizLine | null {
  const line = raw
    .trim()
    .replace(/^(?:[-*•]\s+|\d{1,4}[.)]\s+)/u, "")
    .trim();
  // The scores follow the last colon after which every part reads as a name and a score; the statement may hold a
  // colon of its own, and a name may be followed by one ("Kai: 5").
  for (let at = line.lastIndexOf(":"); at > 0; at = line.lastIndexOf(":", at - 1)) {
    const parts = line
      .slice(at + 1)
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    const scores = parts.map((part) => SCORE_PART.exec(part));
    if (!parts.length || scores.some((match) => !match)) continue;
    const left = line.slice(0, at);
    // An [18+] or (18+) tag wherever it sits ("**[18+]** …", "\"[18+] …\"", "… [18+]", "[18+]: …"), never a bare 18+ in
    // the prose; it goes first, with its own emphasis and a stray leading colon, then a wrapper around the whole line
    // (only one nothing inside reopens, so "**this** and **that**" keeps its emphasis).
    const adult = ADULT_TAG.test(left);
    let statement = left
      .replace(WRAPPED_ADULT_TAGS, "")
      .replace(ADULT_TAGS, "")
      .replace(/^[\s:]+/u, "")
      .trim()
      .replace(/^\*\*\s*((?:(?!\*\*).)*?)\s*\*\*$/u, "$1")
      .replace(/^\*\s*([^*]*?)\s*\*$/u, "$1")
      .replace(/^\[\s*(.*?)\s*\]$/u, "$1")
      .replace(/^["“]\s*(.*?)\s*["”]$/u, "$1")
      .trim();
    // A run of asterisks left unpaired at either end ("**[18+] text" with no closing pair) goes; paired emphasis stays.
    if ((statement.match(/\*+/gu)?.length ?? 0) % 2) statement = statement.replace(/^\*+\s*|\s*\*+$/gu, "").trim();
    if (!statement) return null;
    return {
      statement,
      adult,
      scores: scores.map((match) => ({
        name: match![1]!.replace(/\*+/gu, "").trim(),
        score: Number(match![2]!.replace(",", ".")),
      })),
    };
  }
  return null;
}

/** Every line of the reply that reads; undefined when none does (the generation core's format failure). */
export function parseQuizLines(text: string): { lines: QuizLine[] } | undefined {
  const lines = text.split(/\r?\n/u).flatMap((line) => parseQuizLine(line) ?? []);
  return lines.length ? { lines } : undefined;
}

export const QuizLinesSchema = z.object({
  lines: z.array(
    z.object({
      statement: z.string(),
      adult: z.boolean(),
      scores: z.array(z.object({ name: z.string(), score: z.number() })),
    }),
  ),
});
type QuizLines = z.infer<typeof QuizLinesSchema>;

/**
 * The love interest a written name means: their whole name, else its core words (no title, article or honorific),
 * else its first core word; null when that is no one or two of them (namesakes are never guessed).
 */
export function quizNameOf(written: string, units: ReadonlyArray<Pick<Unit, "id" | "name">>): LiId | null {
  const whole = nameWords(written).join(" ");
  const core = nameCore(written);
  for (const same of [
    (unit: Pick<Unit, "name">) => nameWords(unit.name).join(" ") === whole,
    (unit: Pick<Unit, "name">) => nameCore(unit.name).join(" ") === core.join(" "),
    (unit: Pick<Unit, "name">) => nameCore(unit.name)[0] === core[0],
  ]) {
    const found = units.filter(same);
    if (found.length === 1) return found[0]!.id;
    if (found.length > 1) return null;
  }
  return null;
}

/** A statement folded for comparison: case, accents and punctuation do not count. */
const keyOf = (text: string) =>
  fold(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Each readable score on the line, by love interest (out of range, not whole, or no one's name: skipped). */
function scoresOf(line: QuizLine, units: readonly Unit[]): Partial<Record<LiId, QuizScore>> {
  const scores: Partial<Record<LiId, QuizScore>> = {};
  for (const { name, score } of line.scores) {
    const li = quizNameOf(name, units);
    if (li && isQuizScore(score) && !scores[li]) scores[li] = score;
  }
  return scores;
}

/** The reply's scores for the statements asked, matched by their text (word for word, else nearly so). */
export function matchQuizScores(
  reply: QuizLines,
  asked: readonly Statement[],
  units: readonly Unit[],
): Map<string, Partial<Record<LiId, QuizScore>>> {
  const keys = asked.map((statement) => ({ id: statement.id, key: keyOf(statement.text) }));
  const matched = new Map<string, Partial<Record<LiId, QuizScore>>>();
  for (const line of reply.lines) {
    const key = keyOf(line.statement);
    let id = keys.find((entry) => entry.key === key)?.id;
    if (!id) {
      // A statement the model reworded a little: the one asked that shares most of its words, if only one does.
      const words = new Set(key.split(" "));
      const near = keys
        .map((entry) => {
          const theirs = new Set(entry.key.split(" "));
          const shared = [...words].filter((word) => theirs.has(word)).length;
          return { id: entry.id, likeness: shared / new Set([...words, ...theirs]).size };
        })
        .filter((entry) => entry.likeness >= 0.75)
        .sort((a, b) => b.likeness - a.likeness);
      if (near.length && (near.length === 1 || near[0]!.likeness > near[1]!.likeness)) id = near[0]!.id;
    }
    const scores = scoresOf(line, units);
    if (!id || matched.has(id) || !Object.keys(scores).length) continue;
    matched.set(id, scores);
  }
  return matched;
}

/**
 * The new statements a refill reply holds, with their scores: not one already asked or written twice (by its folded
 * text), not an [18+] one while Heat is SFW, never too long or too short; at most QUIZ_REFILL. While Heat is NSFW
 * every one is 18+, tagged or not (see the header).
 */
export function newQuizStatements(
  reply: QuizLines,
  asked: readonly Pick<Statement, "text">[],
  units: readonly Unit[],
  adultAllowed: boolean,
): Array<{ text: string; adult: boolean; scores: Partial<Record<LiId, QuizScore>> }> {
  const seen = new Set(asked.map((statement) => keyOf(statement.text)));
  const fresh: Array<{ text: string; adult: boolean; scores: Partial<Record<LiId, QuizScore>> }> = [];
  for (const line of reply.lines) {
    const text = line.statement.replace(/\s+/gu, " ").trim();
    const key = keyOf(text);
    if (seen.has(key) || (line.adult && !adultAllowed)) continue;
    if (text.length > QUIZ_TEXT_MAX || (key.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 8) continue;
    seen.add(key);
    fresh.push({ text, adult: line.adult || adultAllowed, scores: scoresOf(line, units) });
    if (fresh.length >= QUIZ_REFILL) break;
  }
  return fresh;
}

/** Tokens a reply of `lines` lines answered by `people` love interests needs. */
const replyTokens = (lines: number, people: number) => 400 + lines * (30 + 8 * people);

// ── The jobs ──

export interface QuizDeps extends GenerationDeps {
  store: Pick<OtomeStore, "readDoc" | "mutateDoc" | "removeDoc">;
  background?: Pick<BackgroundQueue, "ensure" | "has">;
}

/** Quiz jobs that failed, and when (the cool-down). */
const failed = new Map<string, number>();

/** Saves a change to the quiz unless the story is gone; a story deleted meanwhile keeps no quiz. */
async function saveQuiz(deps: QuizDeps, runId: string, change: (current: QuizDoc) => QuizDoc): Promise<QuizDoc | null> {
  if (!(await readRun(deps.store, runId))) return null;
  const saved = await deps.store.mutateDoc(quizTarget(runId), normalizeQuiz, change);
  if (!(await readRun(deps.store, runId))) {
    await deps.store.removeDoc(quizId(runId));
    return null;
  }
  return saved;
}

/**
 * The scoring job: answers what is missing (see the header) in one call and keeps every new score. False when the
 * reply left some of what it asked unanswered (the cool-down then applies).
 */
export async function writeQuizScores(
  deps: QuizDeps,
  runId: string,
  { connectionId, debugMode }: { connectionId: string; debugMode: boolean },
): Promise<boolean> {
  const run = await readRun(deps.store, runId);
  if (!run) return true;
  const missing = missingScores(run, await readQuiz(deps.store, runId));
  const asked = missing.statements.slice(0, QUIZ_SCORE_BATCH);
  const { units } = missing;
  if (!asked.length || !units.length) return true;
  const { value } = await generateJson(deps, {
    runId,
    job: "structured",
    label: "quiz-scores",
    messages: quizScoreMessages({ world: run.world, units, statements: asked.map((statement) => statement.text) }),
    schema: QuizLinesSchema,
    parse: parseQuizLines,
    replyShape: `one line per statement, as "<statement>: <name> <score> | <name> <score> | …"`,
    normalize: (reply) => {
      const matched = matchQuizScores(reply, asked, units).size;
      return matched * 2 >= asked.length
        ? reply
        : `only ${matched} of the ${asked.length} statements came back as "<statement>: <name> <score> | …", word for word, with every love interest's score`;
    },
    maxTokens: replyTokens(asked.length, units.length),
    debugMode,
    lane: "background",
    connectionId,
  });
  const matched = matchQuizScores(value, asked, units);
  await saveQuiz(deps, runId, (current) => {
    const scores = { ...current.scores };
    for (const [id, byLi] of matched) scores[id] = { ...byLi, ...scores[id] };
    return { ...current, scores };
  });
  return asked.every((statement) => units.every((unit) => matched.get(statement.id)?.[unit.id]));
}

/** The refill job: QUIZ_REFILL new statements with every current love interest's score, in one call. */
export async function writeQuizRefill(
  deps: QuizDeps,
  runId: string,
  { connectionId, debugMode }: { connectionId: string; debugMode: boolean },
): Promise<void> {
  const run = await readRun(deps.store, runId);
  if (!run) return;
  const doc = await readQuiz(deps.store, runId);
  const units = answering(run);
  const adultAllowed = intimacyOpen(run.world.content);
  // Asked again when it runs: the player may have left statements open again (Heat raised), or a refill landed.
  if (!units.length || quizView(run, doc, { scoring: false, refilling: false }).open.length) return;
  if (doc.written.length >= QUIZ_WRITTEN_MAX) return;
  // The prompt lists what the player can see (no 18+ statement under SFW); a repeat of any, hidden too, is dropped.
  const asked = [...QUIZ_STARTERS, ...doc.written];
  const { value } = await generateJson(deps, {
    runId,
    job: "structured",
    label: "quiz-refill",
    messages: quizRefillMessages({
      world: run.world,
      units,
      asked: visibleStatements(run, doc).map((statement) => statement.text),
      count: QUIZ_REFILL,
    }),
    schema: QuizLinesSchema,
    parse: parseQuizLines,
    replyShape: `one line per new statement, as "<statement>: <name> <score> | <name> <score> | …"`,
    normalize: (reply) => {
      const fresh = newQuizStatements(reply, asked, units, adultAllowed).length;
      return fresh >= REFILL_MIN
        ? reply
        : `only ${fresh} new statements came back as "<statement>: <name> <score> | …" (none may repeat one already asked); write ${QUIZ_REFILL}`;
    },
    maxTokens: replyTokens(QUIZ_REFILL, units.length),
    debugMode,
    lane: "background",
    connectionId,
  });
  await saveQuiz(deps, runId, (current) => {
    const fresh = newQuizStatements(value, [...QUIZ_STARTERS, ...current.written], units, adultAllowed).slice(
      0,
      QUIZ_WRITTEN_MAX - current.written.length,
    );
    const written = [...current.written];
    const scores = { ...current.scores };
    for (const statement of fresh) {
      const id = `w${written.length + 1}`;
      written.push({ id, text: statement.text, adult: statement.adult });
      if (Object.keys(statement.scores).length) scores[id] = statement.scores;
    }
    return { ...current, written, scores };
  });
}

/**
 * Queues one quiz job on the background lane unless it waits or runs already (the key), the story's world names no
 * connection, or that job failed (or, for scores, came back incomplete) within QUIZ_RETRY_MS.
 */
function queueQuizJob(
  deps: QuizDeps,
  runId: string,
  run: Pick<Run, "world">,
  key: string,
  write: (...args: Parameters<typeof writeQuizScores>) => Promise<boolean | void>,
  debugMode: boolean,
): void {
  const connectionId = resolveConnectionId(run.world, "structured");
  if (!deps.background || !connectionId || Date.now() - (failed.get(key) ?? -Infinity) < QUIZ_RETRY_MS) return;
  deps.background.ensure({
    key,
    connectionId,
    run: async () => {
      try {
        const complete = await write(deps, runId, { connectionId, debugMode });
        if (complete === false) failed.set(key, Date.now());
        else failed.delete(key);
      } catch (error) {
        failed.set(key, Date.now());
        throw error;
      }
    },
  });
}

/**
 * Queues what the quiz is missing on the background lane (see the header) and says what is being written: answers
 * missing for a statement the player can see, and a refill once they answered every one.
 */
export async function ensureQuiz(
  deps: QuizDeps,
  runId: string,
  { debugMode }: { debugMode: boolean },
): Promise<{ scoring: boolean; refilling: boolean }> {
  const { background } = deps;
  const run = await readRun(deps.store, runId);
  if (!background || !run) return { scoring: false, refilling: false };
  const doc = await readQuiz(deps.store, runId);
  if (missingScores(run, doc).statements.length) {
    queueQuizJob(deps, runId, run, scoreKey(runId), writeQuizScores, debugMode);
  }
  const view = quizView(run, doc, { scoring: false, refilling: false });
  if (!view.open.length && answering(run).length && doc.written.length < QUIZ_WRITTEN_MAX) {
    queueQuizJob(deps, runId, run, refillKey(runId), writeQuizRefill, debugMode);
  }
  return { scoring: background.has(scoreKey(runId)), refilling: background.has(refillKey(runId)) };
}

/**
 * On opening a story (GET /runs/:run, with the run it read): queues the love interests' missing answers, so a story from
 * before the quiz, or someone new, has them by the first chapter-planning wait. Only once the story is forged (the
 * forge queues its own when the last bible is written); nothing when every score exists. Never waits for the call.
 */
export async function ensureQuizScores(
  deps: QuizDeps,
  runId: string,
  run: Pick<Run, "world" | "units" | "state">,
  { debugMode }: { debugMode: boolean },
): Promise<void> {
  if (!deps.background || run.world.forge.phase !== "ready") return;
  if (!missingScores(run, await readQuiz(deps.store, runId)).statements.length) return;
  queueQuizJob(deps, runId, run, scoreKey(runId), writeQuizScores, debugMode);
}

const noRun = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");

/** GET /runs/:run/quiz: the quiz, after queueing what it is missing. */
export async function readQuizView(deps: QuizDeps, runId: string, options: { debugMode: boolean }): Promise<QuizView> {
  const run = await readRun(deps.store, runId);
  if (!run) throw noRun();
  const writing = await ensureQuiz(deps, runId, options);
  return quizView(run, await readQuiz(deps.store, runId), writing);
}

/**
 * POST /runs/:run/quiz/answer: keeps the player's answer to a statement they can see (the first is final; answering
 * again changes nothing), then queues a refill when it was the last one open. 404 for a statement they cannot see.
 */
export async function answerQuiz(
  deps: QuizDeps,
  runId: string,
  statementId: string,
  answer: QuizScore,
  options: { debugMode: boolean },
): Promise<QuizView> {
  const run = await readRun(deps.store, runId);
  if (!run) throw noRun();
  const doc = await readQuiz(deps.store, runId);
  if (!visibleStatements(run, doc).some((statement) => statement.id === statementId)) {
    throw new OtomeForgeError(404, "No such quiz statement.", "not-found");
  }
  const saved = await saveQuiz(deps, runId, (current) =>
    current.answers[statementId] ? current : { ...current, answers: { ...current.answers, [statementId]: answer } },
  );
  if (!saved) throw noRun();
  const writing = await ensureQuiz(deps, runId, options);
  return quizView(run, await readQuiz(deps.store, runId), writing);
}
