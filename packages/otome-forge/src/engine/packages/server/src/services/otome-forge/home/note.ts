// ──────────────────────────────────────────────
// Otome Forge: the message of the day (plan M3 "Notes", P16)
// ──────────────────────────────────────────────
// `${R}:note:${dayKey}:${li}` holds one love interest's handwritten note for one local day: the request's time zone
// names the day (forgeDayKey), so it turns over at the player's own midnight. The day's first request writes it and
// every later one reads it back. A rupture makes the note curt, and the note records whether it was (`curt`): one
// written before a rupture opened, or before it was repaired, is stale, so Home shows none and the next request writes
// the day's note again. Writes go through the run's foreground queue (readOrGenerate), which reads again inside the
// queue, so requests that arrive together make one model call and one document: one note per love interest, local
// day and rupture state. A note written for a run deleted meanwhile is removed again.
//
// P16 sees the weekday and the time of day, his birthday or the story's anniversary (all for the instant the request
// named its day), his stage and what stands between them, one thing he may know from his own recall (reader: him, so
// a phone thread, a date, a route or a repair chapter of another love interest never reaches it; shared canon is
// framed as news unless he was there), his latest off-screen line, and his last RECENT_NOTES notes so he does not
// repeat himself. The ledger lines and his grievances and disclosures are the ones his own reader may know
// (story/prompts.ts ownView, M2b's rule): none from another love interest's own chapter. Care data is never part of
// a note.
import { sliceTextToTokenBudget } from "@forge-kit/shared-token-estimator.mjs";
import { forgeDayKey, forgeWallDate, forgeWeekday } from "@forge-kit/time-zone-server.mjs";
import { z } from "zod";
import type {
  LiId,
  LiState,
  Note,
  NoteView,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { isFace } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import {
  MOOD_REASON_WORDS_MAX,
  NOTE_CURT_WORDS_MAX,
  NOTE_TEXT_MAX,
  NOTE_WORDS_MAX,
  RECENT_NOTES,
  sentenceCount,
  wordCount,
} from "../../../../../client/src/features/otome-forge/shared/home.js";
import { generateJson, readOrGenerate, type GenerationDeps } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { isDayKey, noteId, runDocTarget, stateId, worldId } from "../ids.js";
import type { OtomeMemory } from "../memory/memory.js";
import { normalizeState, readRun } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
import { ownView } from "../story/prompts.js";
import {
  NoteReplySchema,
  QUESTION_MARK,
  mentionsAbsence,
  noteMessages,
  type NoteDay,
  type NoteReply,
} from "./prompts.js";

export const NOTE_TEMPERATURE = 0.9;
export const NOTE_MAX_TOKENS = 400;
/** One recalled line: about this many tokens of his top memory. */
const RECALLED_TOKENS = 120;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const NoteSchema = z.object({
  li: z.string(),
  dayKey: z.string(),
  text: z.string().min(1).max(NOTE_TEXT_MAX),
  face: z.string(),
  mood: z.object({ word: z.string().max(60), reason: z.string().max(120) }),
  curt: z.boolean().optional(),
  at: z.string(),
  connectionId: z.string(),
  model: z.string(),
});

/** A stored note, or null for none (a missing or damaged document). */
export function normalizeNote(data: unknown): Note | null {
  const parsed = NoteSchema.safeParse(data);
  if (!parsed.success || !isDayKey(parsed.data.dayKey)) return null;
  const face = parsed.data.face;
  return { ...parsed.data, face: isFace(face) ? face : "", curt: parsed.data.curt === true };
}

/** Whether a stored note still fits: curt exactly while a rupture stands between them. */
export const noteFits = (note: Pick<Note, "curt">, liState: Pick<LiState, "rupture"> | undefined) =>
  note.curt === (liState?.rupture != null);

export function toNoteView({ connectionId: _connection, model: _model, ...note }: Note): NoteView {
  return note;
}

/** Today in the request's time zone. */
export const todayKey = () => forgeDayKey(Date.now());

export const readNote = (store: Pick<OtomeStore, "readDoc">, runId: string, dayKey: string, li: LiId) =>
  store.readDoc(noteId(runId, dayKey, li), normalizeNote);

/** His notes before `dayKey`, newest first, at most RECENT_NOTES. */
export async function recentNotes(
  store: Pick<OtomeStore, "listRun">,
  runId: string,
  li: LiId,
  dayKey: string,
): Promise<string[]> {
  return (await store.listRun("note", runId))
    .map((record) => normalizeNote(record.data))
    .filter((note): note is Note => !!note && note.li === li && note.dayKey < dayKey)
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
    .slice(0, RECENT_NOTES)
    .map((note) => note.text);
}

/** The weekday, the local hour and the special days, in the request's time zone. */
export function noteDay(
  unit: Pick<Unit, "name" | "bible">,
  world: Pick<World, "createdAt">,
  now = Date.now(),
): NoteDay {
  const wall = forgeWallDate(now);
  const today = forgeDayKey(now);
  const special: string[] = [];
  if (unit.bible?.birthday === today.slice(5)) special.push(`Today is ${unit.name}'s birthday.`);
  const began = Date.parse(world.createdAt);
  if (Number.isFinite(began)) {
    const start = forgeDayKey(began);
    const years = Number(today.slice(0, 4)) - Number(start.slice(0, 4));
    if (years > 0 && start.slice(5) === today.slice(5)) {
      special.push(`Today is ${years === 1 ? "one year" : `${years} years`} since the story began.`);
    }
  }
  return { weekday: WEEKDAYS[forgeWeekday(now)] ?? "Monday", hour: wall.getUTCHours(), special };
}

const clean = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“”'‘’「『]+|["“”'‘’」』]+$/gu, "")
    .trim();

const firstWords = (text: string, count: number) => clean(text).split(" ").slice(0, count).join(" ");

/**
 * P16's checks: the word and sentence limits (stricter when curt), no question, no word about the protagonist being
 * away, nothing a recent note already said. A mood word or reason that runs long is cut rather than sent back.
 */
export function checkNote(curt: boolean, recent: readonly string[]) {
  return (reply: NoteReply): NoteReply | string => {
    const text = clean(reply.text);
    const max = curt ? NOTE_CURT_WORDS_MAX : NOTE_WORDS_MAX;
    if (!text) return "text is empty";
    if (wordCount(text) > max) return `text must be ${max} words or fewer`;
    if (sentenceCount(text) > (curt ? 1 : 2))
      return curt ? "text must be one sentence" : "text must be one or two sentences";
    if (QUESTION_MARK.test(text)) return "the note must not ask a question";
    if (mentionsAbsence(text)) return "the note must never mention the protagonist being away";
    const same = text.toLocaleLowerCase();
    if (recent.some((other) => clean(other).toLocaleLowerCase() === same)) return "the note repeats a recent note";
    const word = firstWords(reply.mood.word, 1);
    if (!word) return "mood.word is empty";
    return {
      text,
      face: isFace(reply.face) ? reply.face : "",
      mood: { word, reason: firstWords(reply.mood.reason, MOOD_REASON_WORDS_MAX) },
    };
  };
}

/** One thing he may know, from his own recall; "" when memory has nothing ready or fails. */
async function recalledLine(
  memory: Pick<OtomeMemory, "recall" | "maintain"> | undefined,
  runId: string,
  unit: Pick<Unit, "id" | "name">,
  cues: string[],
  debugMode: boolean,
): Promise<string> {
  if (!memory) return "";
  try {
    const result = await memory.recall({
      runId,
      job: "chat",
      reader: unit.id,
      query: { cues, speakers: [unit.name] },
    });
    if (result.lagging) void Promise.resolve(memory.maintain({ runId, debugMode })).catch(() => undefined);
    const top = result.status.phase === "ready" ? (result.details[0]?.content ?? "") : "";
    return top.trim() ? sliceTextToTokenBudget(top.trim(), RECALLED_TOKENS) : "";
  } catch {
    return "";
  }
}

export interface NoteDeps extends GenerationDeps {
  store: OtomeStore;
  memory?: Pick<OtomeMemory, "recall" | "maintain">;
}

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");

/**
 * Today's note from `li`: the stored one while it fits his rupture state, or P16 writes it (once, whoever asks first).
 * The day and everything P16 is told about it come from one instant, `now`, taken before the request waits in the
 * queue. 404 for an unknown run or love interest; 409 `conflict` while his bible is still being written; generateJson's
 * 503, 422 and 502 otherwise.
 */
export async function serveNote(
  deps: NoteDeps,
  runId: string,
  li: LiId,
  { debugMode, now = Date.now(), dayKey = forgeDayKey(now) }: { debugMode: boolean; now?: number; dayKey?: string },
): Promise<Note> {
  const id = noteId(runId, dayKey, li);
  const read = async () => {
    const [note, state] = await Promise.all([
      deps.store.readDoc(id, normalizeNote),
      deps.store.readDoc(stateId(runId), normalizeState),
    ]);
    return note && noteFits(note, state?.lis[li]) ? note : null;
  };
  return readOrGenerate(runId, read, async () => {
    const run = await readRun(deps.store, runId);
    if (!run) throw runNotFound();
    const unit = run.units.find((entry) => entry.id === li);
    if (!unit || !run.state.lis[li]) throw new OtomeForgeError(404, "No such love interest.", "not-found");
    if (!unit.bible) throw new OtomeForgeError(409, `${unit.name}'s bible is not written yet.`, "conflict");
    const { liState, relationship, offscreen } = ownView(run.state, li);
    const [recalled, recent] = await Promise.all([
      recalledLine(deps.memory, runId, unit, [relationship, offscreen].filter(Boolean), debugMode),
      recentNotes(deps.store, runId, li, dayKey),
    ]);
    const curt = liState.rupture !== null;
    const { value, connectionId, model } = await generateJson(deps, {
      runId,
      job: "chat",
      label: "note",
      messages: noteMessages({
        world: run.world,
        player: run.player,
        unit,
        liState,
        today: noteDay(unit, run.world, now),
        recalled,
        offscreen,
        recent,
        curt,
      }),
      schema: NoteReplySchema,
      normalize: checkNote(curt, recent),
      temperature: NOTE_TEMPERATURE,
      maxTokens: NOTE_MAX_TOKENS,
      debugMode,
      lane: "foreground",
    });
    const note: Note = {
      li,
      dayKey,
      text: value.text,
      face: isFace(value.face) ? value.face : "",
      mood: value.mood,
      curt,
      at: new Date().toISOString(),
      connectionId,
      model,
    };
    // Once per rupture state: a note already there in the same state (another process's) is kept and returned; one
    // written on the other side of a rupture opening or being repaired is replaced.
    const saved = await deps.store.mutateDoc(runDocTarget("note", id), normalizeNote, (current) =>
      current?.curt === curt ? current : note,
    );
    // The run's delete sweeps its documents after it removes the world; a note saved after the sweep goes too.
    if (!(await deps.store.readDoc(worldId(runId), normalizeWorld))) {
      await deps.store.removeDoc(id).catch(() => false);
      throw runNotFound();
    }
    return saved ?? note;
  });
}
