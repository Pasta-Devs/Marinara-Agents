// ──────────────────────────────────────────────
// Otome Forge: beats. The narrator's reply checked and saved, the one-beat lookahead, Rewrite, the first-play pick,
// reading to the end, and Ease off
// ──────────────────────────────────────────────
// - A beat is written once (readOrGenerate inside the run's foreground queue): a request that lands behind the
//   lookahead returns the stored beat. After any beat is served, the next node is queued too, unless this beat ends on
//   a big choice. Every write runs inside the run's cancellation scope, so Cancel stops it before anything is saved.
// - The reply goes through the kit's forgeNormalizeChoiceBeat around Otome's own normalizeBeatBody (segments, five
//   faces, thoughts, places, music, a CG brief); each option's `effects` are read from the raw reply by the indexes the
//   kit numbers choices and options with (`choice-<c+1>`, `option-<o+1>`), because its normalizer drops unknown fields.
// - Rewrite: only the beat being read, before any of its choices is canon; the beats after it are removed (they
//   followed the old one). It costs a call, and the client says so. The new beat replaces the old one only if that is
//   still as the rewrite found it: a pick, a read to its end or an Ease off made while it was written keeps it (409).
// - The first canonical pick is saved on the beat once; its effects reach the state in one revision-checked write of
//   `${R}:state` (S/state/relationship.ts applyChoiceEffects), whose `applied` entry makes it exactly once. A replay
//   changes nothing, and a big choice never changes. A pick whose effects never landed (its request stopped between
//   the two writes) is applied when the beat is counted as read, in that same write.
// - Reading a beat to its end for the first time grants its Starlight; reading the chapter's last node completes it
//   (Starlight, Lead and Foil affection, ledgers, lastLead), then starts memory upkeep in the background.
// - Ease off: no model call. The beat's canon is cut at the segment on screen and closed with EASE_OFF_MARKER, the
//   beat counts as read, and the lookahead written from the uncut scene is removed (again on a retry, and by the
//   lookahead itself when it was saved just after the cut).
import { forgeChoiceLabel } from "@forge-kit/player-choice-text.mjs";
import { forgeNormalizeChoiceBeat, forgePendingChoice } from "@forge-kit/player-choices-server.mjs";
import type { ForgeStoryCancellation } from "@forge-kit/story-cancel-server.mjs";
import { normalizeForgeStoryExpression } from "@forge-kit/story-expressions.mjs";
import type {
  Beat,
  Chapter,
  ChapterNode,
  Effect,
  ForgeChoice,
  LiId,
  ReadResult,
  RunState,
  Segment,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { LIMIT_IDS, type LimitId } from "../../../../../client/src/features/otome-forge/shared/content.js";
import {
  FACES,
  MUSIC_MOODS,
  sameName,
  type MusicMood,
} from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { generateJson, readOrGenerate, runForeground } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { beatId, runDocTarget, stateId, worldId } from "../ids.js";
import { normalizeState, readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeBeat } from "../schemas/story.js";
import { normalizeWorld } from "../schemas/world.js";
import { applyChoiceEffects } from "../state/relationship.js";
import { readBeatToEnd } from "../state/rewards.js";
import type { ChapterDeps } from "./chapters.js";
import { chapterSoFar, readBeat, readChapter, recallText } from "./canon.js";
import { BEAT_PLACES_MAX, BEAT_SEGMENTS_MAX, BeatReplySchema, beatMessages, type BeatReply } from "./prompts.js";

export interface BeatDeps extends ChapterDeps {
  /** The run-scoped Cancel (forge-kit story-cancel-server); without one, writes simply run. */
  cancellation?: ForgeStoryCancellation;
}

const SEGMENT_TEXT_MAX = 4000;
const NAME_MAX = 120;
const CG_BRIEF_MAX = 1200;
const CG_CAST_MAX = 3;
const EFFECT_TEXT_MAX = 300;

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const chapterNotFound = () => new OtomeForgeError(404, "No such chapter.", "not-found");
const beatNotFound = () => new OtomeForgeError(404, "No such beat.", "not-found");
const conflict = (message: string) => new OtomeForgeError(409, message, "conflict");

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const nameKey = (value: unknown) => str(value, NAME_MAX).normalize("NFKC").toLowerCase().replace(/\s+/g, " ");

// ── The narrator's reply ──

/** What normalizing a reply needs to know about the node and its cast. */
export interface BeatContext {
  node: ChapterNode;
  /** Every love interest, so a speaker's name can be matched to his stage. */
  units: ReadonlyArray<Pick<Unit, "id" | "name">>;
  state: RunState;
  last: boolean;
}

interface NormalizeOptions {
  start?: string;
  cgOpen?: boolean;
  context: BeatContext;
}

interface BeatBody {
  segments: Segment[];
  places: Array<{ name: string; tags: string }>;
  musicMood: MusicMood;
  cg?: Beat["cg"];
}

/**
 * The love interest a speaker name belongs to, or undefined (the protagonist, a minor character, narration): his whole
 * name or his first name, as the reader matches it (SH/faces.ts sameName).
 */
function speakerLi(context: BeatContext, speaker: string) {
  return context.units.find((unit) => sameName(speaker, unit.name));
}

/**
 * Why the reply's thoughts break the rules (a love interest's thought before stage 2, or two in one scene), or "".
 * `counts` holds each love interest's thoughts read on the way to these segments, and gets theirs added.
 */
function thoughtProblem(context: BeatContext, segments: unknown[], counts = new Map<string, number>()): string {
  for (const raw of segments) {
    if (!raw || typeof raw !== "object") continue;
    const segment = raw as Record<string, unknown>;
    if (segment.thought !== true && segment.thought !== "true") continue;
    const li = speakerLi(context, str(segment.speaker, NAME_MAX));
    if (!li) continue;
    if ((context.state.lis[li.id]?.stage ?? 1) < 2)
      return `${li.name} is still behind their mask: no thought lines yet`;
    counts.set(li.id, (counts.get(li.id) ?? 0) + 1);
    if (counts.get(li.id)! > 1) return `${li.name} may have at most one thought line in this scene`;
  }
  return "";
}

/**
 * One segment list (the mainline, or a choice's branch) in its saved shape, GF's normalizer reduced to Otome's needs:
 * text required, faces only on a speaker's line, places resolved and carried over (at most four in a beat), and the
 * music cue and CG brief on the mainline. Null when nothing usable is left.
 */
export function normalizeBeatBody(raw: unknown, options: NormalizeOptions): BeatBody | null {
  if (!raw || typeof raw !== "object") return null;
  const reply = raw as Record<string, unknown>;
  if (!Array.isArray(reply.segments) || !reply.segments.length) return null;
  const declared = new Map<string, { name: string; tags: string }>();
  for (const place of Array.isArray(reply.places) ? reply.places : []) {
    const name = str((place as Record<string, unknown> | null)?.name, NAME_MAX);
    if (name && !declared.has(nameKey(name))) {
      declared.set(nameKey(name), { name, tags: str((place as Record<string, unknown>).tags, 600) });
    }
  }
  const used = new Map<string, { name: string; tags: string }>();
  const resolve = (value: unknown) => {
    const key = nameKey(value);
    if (!key) return "";
    const known = used.get(key);
    if (known) return known.name;
    if (used.size >= BEAT_PLACES_MAX) return "";
    const place = declared.get(key) ?? { name: str(value, NAME_MAX), tags: "" };
    used.set(key, place);
    return place.name;
  };
  let place = options.start ? resolve(options.start) : "";
  const segments: Segment[] = [];
  // An empty segment is skipped, as GF's normalizer does; with choices the kit then refuses the beat, since every `at`
  // counts the reply's own segments.
  for (const entry of reply.segments) {
    if (!entry || typeof entry !== "object") continue;
    const source = entry as Record<string, unknown>;
    const text = str(source.text, SEGMENT_TEXT_MAX);
    if (!text) continue;
    const segment: Segment = { speaker: str(source.speaker, NAME_MAX), text };
    if (source.thought === true || source.thought === "true") segment.thought = true;
    const expression = segment.speaker ? normalizeForgeStoryExpression(source.expression, FACES) : "";
    if (expression) segment.expression = expression as Segment["expression"];
    place = resolve(source.place) || place;
    if (place) segment.place = place;
    segments.push(segment);
  }
  if (!segments.length || segments.length > BEAT_SEGMENTS_MAX * 2) return null;
  const mood = (MUSIC_MOODS as readonly unknown[]).includes(reply.musicMood)
    ? (reply.musicMood as MusicMood)
    : options.context.node.kind === "confrontation"
      ? "tense"
      : "tender";
  const body: BeatBody = { segments, places: [...used.values()], musicMood: mood };
  const cg = reply.cg as Record<string, unknown> | undefined;
  if (options.cgOpen && cg && typeof cg === "object") {
    const brief = str(cg.brief, CG_BRIEF_MAX);
    const at = Number(cg.at);
    if (brief) {
      body.cg = {
        at: Number.isInteger(at) ? Math.max(0, Math.min(segments.length - 1, at)) : 0,
        brief,
        cast: (Array.isArray(cg.cast) ? cg.cast : [])
          .map((name) => str(name, NAME_MAX))
          .filter(Boolean)
          .slice(0, CG_CAST_MAX),
      };
    }
  }
  return body;
}

type NormalizedBeat = BeatBody & { choices: ForgeChoice[] };

/** The reply as a beat body with its choices, or the reason it is refused (the repair turn names it). */
export function normalizeBeatReply(reply: BeatReply, context: BeatContext): NormalizedBeat | string {
  // One thought per love interest on the path with the most of them: the mainline, then in each choice (every one
  // is played) the option that holds the most.
  let counts = new Map<string, number>();
  const thoughts = thoughtProblem(context, reply.segments, counts);
  if (thoughts) return thoughts;
  for (const choice of Array.isArray(reply.choices) ? reply.choices : []) {
    const most = new Map(counts);
    for (const option of Array.isArray((choice as { options?: unknown })?.options)
      ? (choice as { options: unknown[] }).options
      : []) {
      const segments = (option as { segments?: unknown })?.segments;
      const own = new Map(counts);
      const problem = Array.isArray(segments) ? thoughtProblem(context, segments, own) : "";
      if (problem) return problem;
      for (const [li, count] of own) most.set(li, Math.max(most.get(li) ?? 0, count));
    }
    counts = most;
  }
  const beat = forgeNormalizeChoiceBeat(
    reply,
    { start: context.node.place, cgOpen: !!context.node.cg, context } as NormalizeOptions,
    normalizeBeatBody,
    { enabled: true, terminal: context.last, label: forgeChoiceLabel },
  );
  if (!beat) {
    return "the segments or choices did not follow the format (check the PLAYER CHOICES rules: 2-4 options, a selection each, branches of 1-8 segments, distinct `at` indexes)";
  }
  return { ...beat, choices: (beat.choices ?? []) as ForgeChoice[] };
}

const unitSign = (value: unknown): -1 | 0 | 1 => {
  const number = Number(value);
  return number > 0 ? 1 : number < 0 ? -1 : 0;
};

/**
 * Each option's effects, read from the raw reply at the indexes the kit numbered the choices and options by. Only love
 * interests present in the node, trust and tension as −1/0/1, a grievance with text, a disclosure, and a resolve only
 * for a grievance the node may resolve; an option with nothing left has no entry.
 */
export function effectsOf(reply: BeatReply, choices: readonly ForgeChoice[], context: BeatContext): Beat["effects"] {
  const present = context.units.filter((unit) => context.node.cast.includes(unit.id));
  const li = (value: unknown): LiId | undefined => {
    const key = str(value, NAME_MAX);
    return (present.find((unit) => unit.id === key) ?? present.find((unit) => sameName(key, unit.name)))?.id;
  };
  const resolvable = new Set(context.node.resolves ?? []);
  const result: Beat["effects"] = {};
  const rawChoices = Array.isArray(reply.choices) ? reply.choices : [];
  for (const [c, rawChoice] of rawChoices.entries()) {
    const choice = choices.find((entry) => entry.id === `choice-${c + 1}`);
    const rawOptions = (rawChoice as { options?: unknown })?.options;
    if (!choice || !Array.isArray(rawOptions)) continue;
    for (const [o, rawOption] of rawOptions.entries()) {
      const optionId = `option-${o + 1}`;
      const rawEffects = (rawOption as { effects?: unknown })?.effects;
      if (!choice.options.some((option) => option.id === optionId) || !Array.isArray(rawEffects)) continue;
      const effects: Effect[] = [];
      for (const raw of rawEffects.slice(0, 6)) {
        if (!raw || typeof raw !== "object") continue;
        const source = raw as Record<string, unknown>;
        const target = li(source.li);
        if (!target) continue;
        const effect: Effect = { li: target };
        const trust = unitSign(source.trust);
        const tension = unitSign(source.tension);
        if (trust) effect.trust = trust;
        if (tension) effect.tension = tension;
        const grievance = source.grievance as Record<string, unknown> | undefined;
        const grievanceText = str(grievance?.text, EFFECT_TEXT_MAX);
        if (grievanceText && (grievance?.by === "li" || grievance?.by === "protagonist")) {
          const severity = ["minor", "major", "rupture"].includes(grievance.severity as string)
            ? (grievance.severity as "minor" | "major" | "rupture")
            : "minor";
          effect.grievance = { by: grievance.by, text: grievanceText, severity };
        }
        const disclose = str(source.disclose, EFFECT_TEXT_MAX);
        if (disclose) effect.disclose = disclose;
        const resolve = source.resolve as Record<string, unknown> | undefined;
        const resolveId = str(resolve?.id, 80);
        if (
          resolveId &&
          resolvable.has(resolveId) &&
          ["addressed", "forgiven", "festering"].includes(resolve?.status as string)
        ) {
          effect.resolve = { id: resolveId, status: resolve!.status as "addressed" | "forgiven" | "festering" };
        }
        if (Object.keys(effect).length > 1) effects.push(effect);
      }
      if (effects.length) (result[choice.id] ??= {})[optionId] = effects;
    }
  }
  return result;
}

// ── Writing a beat ──

interface Loaded {
  run: RunDocuments;
  chapter: Chapter;
}

async function load(deps: BeatDeps, runId: string, key: string): Promise<Loaded> {
  const [run, chapter] = await Promise.all([readRun(deps.store, runId), readChapter(deps.store, runId, key)]);
  if (!run) throw runNotFound();
  if (!chapter) throw chapterNotFound();
  return { run, chapter };
}

const castUnits = (run: RunDocuments) =>
  Object.keys(run.state.lis).flatMap((li) => run.units.filter((unit) => unit.id === li));

/** Runs `operation` in the run's Cancel scope; a Cancel while it runs is a 409. */
export async function cancellable<T>(
  deps: BeatDeps,
  runId: string,
  operation: (signal?: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!deps.cancellation) return operation();
  const result = await deps.cancellation.run(runId, (signal) => operation(signal));
  if (result && typeof result === "object" && (result as { ok?: unknown }).ok === false) {
    throw conflict("The story was cancelled.");
  }
  return result as T;
}

const REWRITE_STALE = "This scene changed while it was being rewritten.";

/** True while the stored beat is still the one a rewrite was checked against: no pick, read or Ease off since. */
const untouched = (stored: Beat, checked: Beat) =>
  stored.written.at === checked.written.at &&
  !stored.easedOff &&
  !Object.keys(stored.choiceCanon).length &&
  stored.readThrough === checked.readThrough;

/**
 * Writes beat `i` of the chapter from its node and the canon before it, and saves it. A rewrite (`replacing`, the beat
 * it was checked against) replaces it only while that beat is untouched and still the one being read.
 */
async function generateBeat(
  deps: BeatDeps,
  runId: string,
  key: string,
  i: number,
  { debugMode, signal, replacing }: { debugMode: boolean; signal?: AbortSignal; replacing?: Beat },
): Promise<Beat> {
  signal?.throwIfAborted();
  const { run, chapter } = await load(deps, runId, key);
  const node = chapter.nodes[i];
  if (!node) throw beatNotFound();
  // The beat this one follows, as it was written from: a rewrite or an Ease off of it while this one is written
  // makes this one stale, and it is not saved. Read before the story so far, so a cut that lands between the two
  // reads shows as a change.
  const basis = i > 0 ? await readBeat(deps.store, runId, key, i - 1) : null;
  const sameBasis = (current: Beat | null) =>
    !basis || (!!current && current.written.at === basis.written.at && !!current.easedOff === !!basis.easedOff);
  const storySoFar = await chapterSoFar(deps.store, runId, key, i, run.player.name);
  if (storySoFar === null) throw conflict("An earlier beat of this chapter is not settled yet.");
  const units = castUnits(run);
  const present = units.filter((unit) => node.cast.includes(unit.id));
  const memory = await recallText(deps, runId, {
    job: "narration",
    cast: node.cast,
    query: {
      cues: [storySoFar.slice(-2000), node.guide].filter(Boolean),
      plan: node.guide,
      speakers: [run.player.name, ...present.map((unit) => unit.name)].filter(Boolean),
    },
    signal,
    debugMode,
  });
  const context: BeatContext = { node, units, state: run.state, last: i === chapter.nodes.length - 1 };
  const { value, connectionId, model } = await generateJson(deps, {
    runId,
    job: "narration",
    label: `beat/${key}/${i}`,
    messages: beatMessages({
      world: run.world,
      player: run.player,
      units,
      state: run.state,
      chapter,
      node,
      storySoFar,
      memory,
    }),
    schema: BeatReplySchema,
    normalize: (reply) => {
      const beat = normalizeBeatReply(reply, context);
      return typeof beat === "string" ? beat : reply;
    },
    temperature: 0.9,
    maxTokens: 6000,
    debugMode,
    lane: "foreground",
    signal,
  });
  signal?.throwIfAborted();
  const body = normalizeBeatReply(value, context) as NormalizedBeat;
  const beat: Beat = {
    key,
    i,
    kind: node.kind,
    places: body.places,
    segments: body.segments,
    choices: body.choices,
    choiceCanon: {},
    effects: effectsOf(value, body.choices, context),
    applied: {},
    musicMood: body.musicMood,
    ...(body.cg ? { cg: body.cg } : {}),
    readThrough: 0,
    written: { at: new Date().toISOString(), connectionId, model },
    rewrites: replacing ? replacing.rewrites + 1 : 0,
  };
  const basisChanged = () => conflict("The scene before this one changed while it was being written.");
  if (!sameBasis(await readBeat(deps.store, runId, key, i - 1))) throw basisChanged();
  if (replacing) {
    // A pick, a read to the end or an Ease off may land while the rewrite is written (a reader reopened meanwhile, or
    // another tab): the beat the player read stays canon. The state shows a finished read; the stored beat, below,
    // shows the rest, and a finish still on its way by the readThrough its read wrote first.
    const progress = (await deps.store.readDoc(stateId(runId), normalizeState))?.chapters[key];
    if (progress?.completed || (progress?.beatsRead ?? 0) > i) throw conflict(REWRITE_STALE);
  }
  const target = runDocTarget("beat", beatId(runId, key, i));
  // A first write keeps whatever another request saved first; a rewrite replaces only the beat it was checked against.
  const saved = await deps.store.mutateDoc(target, normalizeBeat, (stored) => {
    if (!replacing) return stored ?? beat;
    if (!stored || !untouched(stored, replacing)) throw conflict(REWRITE_STALE);
    return beat;
  });
  // Ease off saves its cut before it removes the beats after it, so one that landed between the check above and this
  // save either removed this beat or shows here: then this beat followed the uncut scene, and it is removed again.
  if (saved?.written.at === beat.written.at && !sameBasis(await readBeat(deps.store, runId, key, i - 1))) {
    await deps.store.removeDoc(beatId(runId, key, i));
    throw basisChanged();
  }
  return saved ?? beat;
}

/** Whether the player may have beat `i` written now: it is the one being read, or the next one (the lookahead). */
function writable(run: RunDocuments, chapter: Chapter, i: number): boolean {
  const progress = run.state.chapters[chapter.key];
  return i < chapter.nodes.length && !progress?.completed && i <= (progress?.beatsRead ?? 0) + 1;
}

/** Queues the node after `beat` in the background of the run's queue, unless the beat ends on a big choice. */
function queueLookahead(deps: BeatDeps, runId: string, chapter: Chapter, beat: Beat, debugMode: boolean): void {
  const next = beat.i + 1;
  if (next >= chapter.nodes.length || beat.choices.some((choice) => choice.kind === "big")) return;
  void (async () => {
    if (await readBeat(deps.store, runId, chapter.key, next)) return;
    await cancellable(deps, runId, (signal) =>
      readOrGenerate(
        runId,
        () => readBeat(deps.store, runId, chapter.key, next),
        async () => {
          // The beat it follows may have been rewritten or eased off while this waited in the queue.
          const current = await readBeat(deps.store, runId, chapter.key, beat.i);
          if (!current || current.written.at !== beat.written.at || current.easedOff) return null;
          return generateBeat(deps, runId, chapter.key, next, { debugMode, signal });
        },
      ),
    );
  })().catch((error: unknown) => {
    deps.runtime.logger.warn(
      "[otome-forge] Lookahead for %s/%d stopped: %s",
      chapter.key,
      next,
      error instanceof Error ? error.message : String(error),
    );
  });
}

/** Removes the chapter's beats after `i` that nobody has read (they followed a beat that changed). */
async function dropBeatsAfter(deps: BeatDeps, runId: string, chapter: Chapter, i: number): Promise<void> {
  for (let next = i + 1; next < chapter.nodes.length; next += 1) {
    await deps.store.removeDoc(beatId(runId, chapter.key, next));
  }
}

/**
 * POST .../beats/:i {rewrite?}: the stored beat, or a newly written one, then the lookahead. A rewrite is allowed only
 * on the beat being read while none of its choices is canon.
 */
export async function serveBeat(
  deps: BeatDeps,
  runId: string,
  key: string,
  i: number,
  { rewrite = false, debugMode }: { rewrite?: boolean; debugMode: boolean },
): Promise<Beat> {
  const { run, chapter } = await load(deps, runId, key);
  if (run.world.forge.phase !== "ready") throw conflict("The world is still being forged.");
  if (!chapter.nodes[i]) throw beatNotFound();
  let beat: Beat | null;
  if (rewrite) {
    beat = await cancellable(deps, runId, (signal) =>
      runForeground(runId, async () => {
        // A Cancel while this waited in the queue: nothing is dropped and nothing is written.
        signal?.throwIfAborted();
        const [current, state] = await Promise.all([
          readBeat(deps.store, runId, key, i),
          deps.store.readDoc(stateId(runId), normalizeState),
        ]);
        const progress = state?.chapters[key];
        if (!current) throw beatNotFound();
        if (progress?.completed || (progress?.beatsRead ?? 0) > i || Object.keys(current.choiceCanon).length) {
          throw conflict("Only the beat being read can be rewritten, before any of its choices is made.");
        }
        await dropBeatsAfter(deps, runId, chapter, i);
        return generateBeat(deps, runId, key, i, { debugMode, signal, replacing: current });
      }),
    );
  } else {
    beat = await readBeat(deps.store, runId, key, i);
    if (!beat) {
      if (!writable(run, chapter, i)) throw conflict("This beat cannot be written yet.");
      beat = await cancellable(deps, runId, (signal) =>
        readOrGenerate(
          runId,
          () => readBeat(deps.store, runId, key, i),
          () => generateBeat(deps, runId, key, i, { debugMode, signal }),
        ),
      );
    }
  }
  if (!run.state.chapters[key]?.completed) queueLookahead(deps, runId, chapter, beat, debugMode);
  return beat;
}

// ── The first-play pick ──

/** What a pick changed between them: `remembered` per the rules, and with which love interests. */
interface Remembered {
  remembered: boolean;
  rememberedBy: LiId[];
}

const NOTHING_REMEMBERED: Remembered = { remembered: false, rememberedBy: [] };

/** A pick's effects on the state, in its chapter and beat (applyChoiceEffects; a pick already applied is a no-op). */
const applyPickTo = (state: RunState, chapter: Chapter, beat: Beat, choice: string, option: string, at: string) =>
  applyChoiceEffects(state, beat.effects[choice]?.[option] ?? [], {
    key: chapter.key,
    i: beat.i,
    choice,
    resolves: chapter.nodes[beat.i]?.resolves ?? [],
    at,
  });

/** Applies a canonical pick's effects to the state once (the pick's `applied` entry). */
async function applyPick(
  deps: BeatDeps,
  runId: string,
  chapter: Chapter,
  beat: Beat,
  choiceId: string,
  optionId: string,
): Promise<Remembered> {
  let outcome = NOTHING_REMEMBERED;
  const at = new Date().toISOString();
  const state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    const { state: next, remembered, rememberedBy } = applyPickTo(current, chapter, beat, choiceId, optionId, at);
    outcome = { remembered, rememberedBy };
    return next;
  });
  if (!state) throw runNotFound();
  if (!beat.applied[choiceId]) {
    await deps.store.updateDoc(runDocTarget("beat", beatId(runId, chapter.key, beat.i)), normalizeBeat, (current) =>
      current ? { ...current, applied: { ...current.applied, [choiceId]: true as const } } : current,
    );
  }
  return outcome;
}

/**
 * POST .../beats/:i/choose {choice, option}. The first pick of the first pending choice on the beat being read is
 * canon; its effects reach the state once. A replay of a small choice changes nothing; a big choice never changes.
 */
export async function chooseOption(
  deps: BeatDeps,
  runId: string,
  key: string,
  i: number,
  choiceId: string,
  optionId: string,
): Promise<{ beat: Beat } & Remembered> {
  const { run, chapter } = await load(deps, runId, key);
  let beat = await readBeat(deps.store, runId, key, i);
  if (!beat) throw beatNotFound();
  const choice = beat.choices.find((entry) => entry.id === choiceId);
  if (!choice || !choice.options.some((option) => option.id === optionId)) {
    throw new OtomeForgeError(404, "No such choice.", "not-found");
  }
  const progress = run.state.chapters[key];
  const canon = beat.choiceCanon[choiceId];
  if (canon) {
    if (choice.kind === "big" && canon !== optionId) throw new OtomeForgeError(409, "That choice is made.", "locked");
    // A pick saved by a request that stopped before its effects: apply them now (exactly once by `applied`).
    const pending = !progress?.applied.includes(`${i}/${choiceId}`);
    const outcome = pending ? await applyPick(deps, runId, chapter, beat, choiceId, canon) : NOTHING_REMEMBERED;
    return { beat: (await readBeat(deps.store, runId, key, i)) ?? beat, ...outcome };
  }
  // A choice past an Ease off cut is never canon, even while the cut beat is not counted as read yet.
  const pastCut = (stored: Beat) => !!stored.easedOff && choice.at > stored.easedOff.at;
  const closed = !!progress?.completed || (progress?.beatsRead ?? 0) > i || pastCut(beat);
  if (closed) {
    if (choice.kind === "big") throw new OtomeForgeError(409, "That choice is made.", "locked");
    return { beat, ...NOTHING_REMEMBERED };
  }
  if ((progress?.beatsRead ?? 0) !== i) throw conflict("Choices are made on the beat being read.");
  if (forgePendingChoice(beat)?.id !== choiceId) throw conflict("An earlier choice in this beat comes first.");
  const checked = beat;
  beat =
    (await deps.store.updateDoc(runDocTarget("beat", beatId(runId, key, i)), normalizeBeat, (current) => {
      if (!current) throw beatNotFound();
      // A rewrite saved since this beat was read has other choices: the pick was made on a scene that is gone.
      if (current.written.at !== checked.written.at) throw conflict("This scene changed. Open it again.");
      return current.choiceCanon[choiceId] || pastCut(current)
        ? current
        : { ...current, choiceCanon: { ...current.choiceCanon, [choiceId]: optionId } };
    })) ?? beat;
  const picked = beat.choiceCanon[choiceId];
  // No pick saved: an Ease off cut the scene before this choice meanwhile, and the choice is closed as above.
  if (!picked || (picked !== optionId && choice.kind === "big")) {
    if (choice.kind === "big") throw new OtomeForgeError(409, "That choice is made.", "locked");
    return { beat, ...NOTHING_REMEMBERED };
  }
  const outcome = await applyPick(deps, runId, chapter, beat, choiceId, picked);
  return { beat: (await readBeat(deps.store, runId, key, i)) ?? beat, ...outcome };
}

// ── Reading, and the end of a chapter ──

/** The first-play picks a beat's canon holds: each choice picked, up to its Ease off cut. */
const canonPicks = (beat: Beat): Array<[choice: string, option: string]> => {
  const cut = beat.easedOff?.at ?? Infinity;
  return beat.choices.flatMap((choice) => {
    const option = beat.choiceCanon[choice.id];
    return choice.at <= cut && option ? [[choice.id, option] as [string, string]] : [];
  });
};

/**
 * Counts `beat` as read to its end, once and in order (S/state/rewards.ts readBeatToEnd: its Starlight, and on the
 * chapter's last node the chapter's Starlight, Lead and Foil affection, ledgers and lastLead, in one write). Starts
 * memory upkeep in the background when the chapter completes.
 */
async function finishBeat(
  deps: BeatDeps,
  runId: string,
  chapter: Chapter,
  beat: Beat,
  debugMode: boolean,
): Promise<ReadResult> {
  let outcome: Omit<ReturnType<typeof readBeatToEnd>, "state"> = { grants: [], chapterDone: false };
  let completedNow = false;
  const at = new Date().toISOString();
  const state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    // A pick saved on the beat whose effects never reached the state (its request stopped between the two writes, and
    // a reload shows it as made) lands in this same write, so no beat counts as read with a canon pick unapplied.
    // The pick's `applied` entry makes this a no-op for every other pick.
    const caughtUp = canonPicks(beat).reduce(
      (state, [choice, option]) => applyPickTo(state, chapter, beat, choice, option, at).state,
      current,
    );
    const { state: next, ...rest } = readBeatToEnd(caughtUp, chapter, beat.i);
    outcome = rest;
    completedNow = !current.chapters[chapter.key]?.completed && !!next.chapters[chapter.key]?.completed;
    return next;
  });
  if (!state) throw runNotFound();
  if (completedNow && deps.memory) {
    void Promise.resolve(deps.memory.maintain({ runId, debugMode })).catch((error: unknown) =>
      deps.runtime.logger.warn(
        "[otome-forge] Memory upkeep after %s stopped: %s",
        chapter.key,
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
  return { grants: outcome.grants, starlight: state.wallet.starlight, chapterDone: outcome.chapterDone };
}

/** True once every choice in the beat up to `through` has its first-play pick. */
const settledThrough = (beat: Beat, through: number) =>
  beat.choices.every((choice) => choice.at > through || !!beat.choiceCanon[choice.id]);

/**
 * POST .../beats/:i/read {segment}: the furthest segment read (skip-read starts there). Reaching the last segment with
 * every choice made, or the cut of an eased-off beat, finishes the beat (finishBeat).
 */
export async function readTo(
  deps: BeatDeps,
  runId: string,
  key: string,
  i: number,
  segment: number,
  { debugMode }: { debugMode: boolean },
): Promise<ReadResult> {
  const { run, chapter } = await load(deps, runId, key);
  const beat = await readBeat(deps.store, runId, key, i);
  if (!beat) throw beatNotFound();
  const end = beat.easedOff?.at ?? beat.segments.length - 1;
  const reached = Math.max(0, Math.min(end, Math.trunc(segment)));
  if (reached > beat.readThrough) {
    await deps.store.updateDoc(runDocTarget("beat", beatId(runId, key, i)), normalizeBeat, (current) =>
      current ? { ...current, readThrough: Math.max(current.readThrough, reached) } : current,
    );
  }
  if (reached < end || (!beat.easedOff && !settledThrough(beat, end))) {
    return { grants: [], starlight: run.state.wallet.starlight, chapterDone: false };
  }
  return finishBeat(deps, runId, chapter, beat, debugMode);
}

/** A node eased off before anything was written (its scene was declined): no lines, cut at the start. */
function unwrittenBeat(key: string, node: ChapterNode): Beat {
  return {
    key,
    i: node.i,
    kind: node.kind,
    places: [],
    segments: [],
    choices: [],
    choiceCanon: {},
    effects: {},
    applied: {},
    musicMood: node.kind === "confrontation" ? "tense" : "tender",
    readThrough: 0,
    easedOff: { at: 0 },
    written: { at: new Date().toISOString(), connectionId: "", model: "" },
    rewrites: 0,
  };
}

/**
 * POST .../beats/:i/ease-off {segment}: ends the scene at that segment, or at the last choice already picked, with no
 * model call. Its canon is cut there and closed with the marker, the beat counts as read, and the lookahead written
 * from the uncut scene is removed. The declined panel eases off a node that was never written the same way. The
 * suggestions are the chapter's content tags that are still allowed, to offer "Veil this from now on".
 */
export async function easeOff(
  deps: BeatDeps,
  runId: string,
  key: string,
  i: number,
  segment: number,
  { debugMode }: { debugMode: boolean },
): Promise<{ beat: Beat; veilSuggestions: LimitId[] } & ReadResult> {
  const { run, chapter } = await load(deps, runId, key);
  const node = chapter.nodes[i];
  if (!node) throw beatNotFound();
  const progress = run.state.chapters[key];
  const current = await readBeat(deps.store, runId, key, i);
  if (!current?.easedOff && (progress?.completed || (progress?.beatsRead ?? 0) !== i)) {
    throw conflict("Only the beat being read can be eased off.");
  }
  const at = Math.max(0, Math.min((current?.segments.length ?? 0) - 1, Math.trunc(segment)));
  // At once, never behind the queue: a lookahead still being written from the uncut scene is not saved (generateBeat
  // checks the beat it follows before saving), and one already saved is removed here. A node the model declined has
  // no beat: it is saved as cut before its first line, so the story goes on from its aftermath without it (a write of
  // it still running keeps this one, since a first write never replaces a stored beat).
  const beat = await deps.store.mutateDoc(runDocTarget("beat", beatId(runId, key, i)), normalizeBeat, (stored) => {
    if (!stored) return unwrittenBeat(key, node);
    if (stored.easedOff) return stored;
    // Never before a pick already saved (a stale tab can ask for that): its effects are in the state, so its choice
    // stays in the canon. chooseOption saves no pick past a cut, so every pick is canon either way.
    const picked = stored.choices.filter((choice) => stored.choiceCanon[choice.id]).map((choice) => choice.at);
    const cut = Math.max(at, ...picked);
    return { ...stored, easedOff: { at: cut }, readThrough: Math.max(stored.readThrough, cut) };
  });
  if (!beat) throw beatNotFound();
  // By where the reading stands, not by whether the beat was cut before: a retry of an Ease off that stopped after
  // saving its cut still removes the lookahead written from the uncut scene. Until the beat counts as read, no beat
  // after it can hold a pick (chooseOption needs it read), so nothing canon is lost.
  if (!progress?.completed && (progress?.beatsRead ?? 0) <= i) await dropBeatsAfter(deps, runId, chapter, i);
  const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
  const veilSuggestions = chapter.tags.filter(
    (tag): tag is LimitId =>
      (LIMIT_IDS as readonly string[]).includes(tag) && world?.content.limits[tag as LimitId] === "allow",
  );
  const read = await finishBeat(deps, runId, chapter, beat, debugMode);
  return { beat, veilSuggestions, ...read };
}
