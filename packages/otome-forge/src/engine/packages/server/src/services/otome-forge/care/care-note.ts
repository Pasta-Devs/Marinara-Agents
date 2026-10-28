// ──────────────────────────────────────────────
// Otome Forge: the Caring message (plan M6 "Server", §1.9 privacy invariants)
// ──────────────────────────────────────────────
// POST .../care-note answers a Caring message press with one note from a love interest. It carries the client's single
// care line to the model only when careLineAllowed holds: no debug condition is on anywhere on the way to the provider
// (the request's debugMode, DEBUG_AGENTS, or a logger writing the debug level, any of which makes the Engine's providers
// log full request bodies). Otherwise, with no line ("Keep it off the model"), with no bible yet, or when P27 fails, the
// note is one of his pre-written comfort lines (unit.lines.fixed.comfort, written for every love interest as generic
// rough-day comfort), or null when those do not exist yet, so the client shows a catalog comfort line.
//
// Nothing about a care note is written: no document, memory, ledger or note history, and no background job (a missing
// comfort pool is not queued from here, since that would write his unit). The line is redacted from Otome's own prompt
// log, the note is never logged, and Otome logs nothing about a care request at all, not even a failure (a line naming
// it would date a cycle day); its route silences the Engine's request lines too (S/routes/care.ts, with the one limit
// it names). A pool line that sounds medical is never used. Two presses at once each get a note of their own; nothing
// is written, so there is nothing to race (the client joins a press already in flight).
import { randomInt } from "node:crypto";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { LiId, Player, Unit, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { sentenceCount, wordCount } from "../../../../../client/src/features/otome-forge/shared/home.js";
import { generateJson, runForeground, type GenerationDeps } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { QUESTION_MARK, mentionsAbsence } from "../home/prompts.js";
import { field } from "../schemas/common.js";
import { readRun } from "../schemas/state.js";
import type { OtomeStore } from "../store.js";
import {
  CARE_NOTE_SENTENCES_MAX,
  CARE_NOTE_WORDS_MAX,
  CareNoteReplySchema,
  allowedCareLines,
  careNoteMessages,
  soundsMedical,
  type CareNoteReply,
} from "./prompts.js";

export const CARE_NOTE_TEMPERATURE = 0.8;
/** What the reply itself needs: forty words. */
export const CARE_NOTE_MAX_TOKENS = 300;

/** POST /runs/:run/care-note → this. `note` null: his comfort lines are not written yet; show a catalog one. */
export interface CareNoteResult {
  note: string | null;
  source: "model" | "pool";
}

/** Where the request's debugMode is read: the body (POST) and, so a query flag cannot slip past, the query too. */
export interface CareRequest {
  body?: unknown;
  query?: unknown;
}

/**
 * True only when nothing could log the care line: debugMode absent or false in the body and the query (anything else
 * counts as on), DEBUG_AGENTS off (the host's check and the environment the kit's logger reads), and the logger
 * reporting the debug level off. A logger without isLevelEnabled, or any check that throws, counts as debug on.
 */
export function careLineAllowed(
  runtime: Pick<CapabilityRuntimeHost, "isDebugAgentsEnabled" | "logger">,
  request: CareRequest,
): boolean {
  const off = (source: unknown) => {
    const value = field(source, "debugMode");
    return value === undefined || value === false;
  };
  try {
    return (
      off(request.body) &&
      off(request.query) &&
      runtime.isDebugAgentsEnabled() === false &&
      !/^(1|true)$/iu.test(process.env.DEBUG_AGENTS ?? "") &&
      runtime.logger.isLevelEnabled?.("debug") === false
    );
  } catch {
    return false;
  }
}

const clean = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“”'‘’「『]+|["“”'‘’」』]+$/gu, "")
    .trim();

/** P27's checks: the word and sentence limits, no question, nothing about absence, nothing medical. */
export function checkCareNote(reply: CareNoteReply): CareNoteReply | string {
  const note = clean(reply.note);
  if (!note) return "note is empty";
  if (wordCount(note) > CARE_NOTE_WORDS_MAX) return `note must be ${CARE_NOTE_WORDS_MAX} words or fewer`;
  if (sentenceCount(note) > CARE_NOTE_SENTENCES_MAX) {
    return `note must be at most ${CARE_NOTE_SENTENCES_MAX} sentences`;
  }
  if (QUESTION_MARK.test(note)) return "the note must not ask a question";
  if (mentionsAbsence(note)) return "the note must never mention the protagonist being away";
  if (soundsMedical(note)) {
    return "the note must comfort only: no medical advice, medication, or guesses about the body";
  }
  return { note };
}

/**
 * A random one of his comfort lines, or null while his fixed lines are not written (or none of them keeps the comfort
 * rule: P15's prompt asks for that, and a line that prescribes or diagnoses is never sent as care).
 */
export function poolNote(unit: Pick<Unit, "lines">): string | null {
  const pool = (unit.lines?.fixed?.comfort ?? []).filter((line) => line.trim() && !soundsMedical(line));
  return pool.length ? pool[randomInt(pool.length)]! : null;
}

export interface CareNoteInput {
  runId: string;
  world: Pick<World, "content" | "images" | "language" | "setting" | "premise">;
  player: Pick<Player, "name" | "pronouns">;
  unit: Pick<Unit, "name" | "pronouns" | "bible">;
  careLine: string;
  /** careLineAllowed, asked again before each provider call (the repair turn's too); false throws a 503. */
  mayCall?: () => boolean;
}

/**
 * P27 on the run's chat connection. Callers run it only when careLineAllowed holds, and pass it as `mayCall`, so the
 * prompt log stays silent; should a log level change between the checks and the call, the logged prompt shows
 * `[cycle state redacted]` instead of the line. Throws generateJson's 503, 422 and 502.
 */
export async function writeCareNote(deps: GenerationDeps, input: CareNoteInput): Promise<string> {
  const { value } = await generateJson(deps, {
    runId: input.runId,
    job: "chat",
    label: "care-note",
    messages: careNoteMessages(input),
    schema: CareNoteReplySchema,
    normalize: checkCareNote,
    temperature: CARE_NOTE_TEMPERATURE,
    maxTokens: CARE_NOTE_MAX_TOKENS,
    debugMode: false,
    lane: "foreground",
    redact: [input.careLine],
    ...(input.mayCall ? { mayCall: input.mayCall } : {}),
  });
  return value.note;
}

export interface CareNoteDeps extends GenerationDeps {
  store: Pick<OtomeStore, "readDoc" | "listRun">;
}

const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");

/**
 * The Caring message from `li`. A `careLine` that is not exactly one of the protagonist's templates is a 400 whatever
 * the debug state; an unknown run or love interest is a 404. `allowed` is checked on arrival, once the run's queue
 * reaches the request, and before each provider call, so a debug switch turned on while it waited keeps the line back.
 */
export async function serveCareNote(
  deps: CareNoteDeps,
  runId: string,
  li: LiId,
  { careLine, allowed }: { careLine?: string; allowed: () => boolean },
): Promise<CareNoteResult> {
  const run = await readRun(deps.store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
  const unit = run.units.find((entry) => entry.id === li);
  if (!unit || !run.state.lis[li]) throw liNotFound();
  if (careLine !== undefined && !allowedCareLines(run.player).has(careLine)) {
    throw new OtomeForgeError(400, "Invalid request: careLine is not one of the care line templates.", "bad-request");
  }
  const pool = (): CareNoteResult => ({ note: poolNote(unit), source: "pool" });
  if (careLine === undefined || !unit.bible || !allowed()) return pool();
  const line = careLine;
  return runForeground(runId, async () => {
    if (!allowed()) return pool();
    try {
      const note = await writeCareNote(deps, {
        runId,
        world: run.world,
        player: run.player,
        unit,
        careLine: line,
        mayCall: allowed,
      });
      return { note, source: "model" };
    } catch {
      // Silent on purpose: the button shows only on a day the tracker marks, so a timestamped log line would date one
      // (and a provider's error may quote what it was sent). The answer's `source: "pool"` already says what happened.
      return pool();
    }
  });
}
