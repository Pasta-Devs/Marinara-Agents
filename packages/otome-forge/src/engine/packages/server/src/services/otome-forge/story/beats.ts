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
//   lookahead itself when it was saved just after the cut). A Confrontation eased off after its ending keeps its canon
//   whole, so its lookahead stays.
// - A date's beat (M5, chapter kind "date") has exactly one small choice whose options each carry a hidden `score`
//   (−1/0/1, how the date's love interest takes it; at least one scores 1), read by index like the effects and saved
//   as `beat.scores`. A date never ends on a big choice, and an option opens a grievance only on a date planned to go
//   wrong, and then at most a minor one. S/minigames/date-night.ts totals the scores of the first-play picks.
// M2b:
// - A confrontation node with a love interest in it is written by P12 as a stance game (S/story/confrontation.ts):
//   the beat's segments are its opening. Each stance is saved on the beat once (chooseStance) and its effects reach
//   the state in one revision-checked write, exactly once; the next node is written only after the ending, since the
//   canon waits for it. The beat is read to its end once the ending is reached (or it was eased off).
// - Route chapters: the gate's read moves his stage, in the same state write that counts it (S/state/stages.ts
//   passGate); a repair chapter's resolving node closes the rupture the same way (healRupture). While a rupture
//   stands, none of his route chapters opens a beat (409 `locked`) and his gate is not counted read (stages.ts
//   gateShut); a beat already on screen can still be finished, and what was read still replays. A stage-5 gate must
//   end on one big choice.
// - The art (RouteDeps.art, S/art/expressions.ts createOtomeArt): each beat served queues its speakers' faces; each
//   beat written queues its places and CG (which wait for a tap under Ask before painting, or while the player
//   reviews image prompts); a beat replaced by a rewrite, or removed after it, releases its CG. All of it in the
//   background: the art never holds up or breaks the story.
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
  StanceResult,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { stageRow, type ClimaxMove } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import type { DateScore } from "../../../../../client/src/features/otome-forge/shared/dates.js";
import { LIMIT_IDS, type LimitId } from "../../../../../client/src/features/otome-forge/shared/content.js";
import {
  FACES,
  MUSIC_MOODS,
  sameName,
  type MusicMood,
} from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { generateJson, readOrGenerate, runForeground } from "../generation.js";
import type { OtomeArt } from "../art/expressions.js";
import { explicitCgAllowed } from "../content-contract.js";
import { OtomeForgeError } from "../http.js";
import { PROLOGUE_KEY, beatId, mainChapterKey, runDocTarget, stateId, unitId, worldId } from "../ids.js";
import { normalizeState, readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeBeat } from "../schemas/story.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeWorld } from "../schemas/world.js";
import { withPersonaStoryAbout } from "../setup/prompts.js";
import { applyChoiceEffects } from "../state/relationship.js";
import { readBeatToEnd } from "../state/rewards.js";
import { countedNow, gateShut, healRupture, passGate } from "../state/stages.js";
import type { ChapterDeps } from "./chapters.js";
import { chapterSoFar, readBeat, readChapter, recallText } from "./canon.js";
import { prologueEnding, prologueProblem } from "./prologue.js";
import {
  afterRound,
  applyConfrontation,
  confrontationLines,
  confrontationMainline,
  confrontationOpponent,
  endingOf,
  climaxSpec,
  normalizeConfrontationReply,
  toConfrontationView,
  type SegmentLists,
} from "./confrontation.js";
import {
  BEAT_PLACES_MAX,
  BEAT_SEGMENTS_MAX,
  BeatReplySchema,
  ConfrontationReplySchema,
  beatMessages,
  closerMessages,
  confrontationMessages,
  type BeatReply,
} from "./prompts.js";

export interface BeatDeps extends ChapterDeps {
  /** The run-scoped Cancel (forge-kit story-cancel-server); without one, writes simply run. */
  cancellation?: ForgeStoryCancellation;
  /** The story's art (S/art, M2b); without it nothing is painted. */
  art?: OtomeArt;
}

/** How a request paints: its debug mode, and whether the player reviews image prompts first (an automatic paint waits). */
export interface PaintMode {
  debugMode: boolean;
  review?: boolean;
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
const locked = (message: string) => new OtomeForgeError(409, message, "locked");
const ROUTE_LOCKED = "A rupture stands between you: this route chapter waits until it is repaired.";

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const nameKey = (value: unknown) => str(value, NAME_MAX).normalize("NFKC").toLowerCase().replace(/\s+/g, " ");

// ── The narrator's reply ──

/** What normalizing a reply needs to know about the node and its cast. */
export interface BeatContext {
  node: ChapterNode;
  /** The world allowed an explicit key image as the beat was written (content-contract.ts explicitCgAllowed). */
  cgExplicit?: boolean;
  /** Every love interest, so a speaker's name can be matched to his stage. */
  units: ReadonlyArray<Pick<Unit, "id" | "name">>;
  /** Existing backgrounds a raw reply may explicitly reuse; never inferred from numbered names or tags. */
  places?: World["places"];
  state: RunState;
  last: boolean;
  /** The beat must end on one big choice (a stage-5 route chapter's gate). */
  mustChoose?: boolean;
  /** A date's beat (M5): one scored choice, no big choice, and a grievance only when the date was planned to go wrong. */
  date?: { goesWrong: boolean };
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

/** Validate raw reuse references, then normalize them away instead of saving another identity field. */
function declaredPlaces(raw: unknown, known: World["places"] = {}) {
  const declared = new Map<string, { name: string; tags: string }>();
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!entry || typeof entry !== "object") continue;
    const place = entry as Record<string, unknown>;
    const name = str(place.name, NAME_MAX);
    const reuse = typeof place.reuse === "string" ? place.reuse.trim() : place.reuse;
    const hasReuse = Object.hasOwn(place, "reuse") && reuse !== undefined && reuse !== null && reuse !== "";
    let target = { name, tags: str(place.tags, 600) };
    if (hasReuse) {
      if (typeof reuse !== "string" || !Object.hasOwn(known, reuse))
        return "place reuse must name an existing saved place key from SAVED BACKGROUNDS";
      if (!name) return "a reused place needs its scene name";
      const existing = known[reuse]!;
      target = { name: existing.name, tags: existing.tags.trim() ? existing.tags : target.tags };
    }
    const key = nameKey(name);
    const previous = declared.get(key);
    if (previous && previous.name !== target.name) return "the same place name has conflicting reuse references";
    if (name && !previous) {
      declared.set(key, target);
      // Choice branches inherit the canonical mainline place rather than the raw alias.
      if (hasReuse && !declared.has(nameKey(target.name))) declared.set(nameKey(target.name), target);
    }
  }
  return declared;
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
  const declared = declaredPlaces(reply.places, options.context.places);
  if (typeof declared === "string") return null;
  const used = new Map<string, { name: string; tags: string }>();
  const resolve = (value: unknown) => {
    const key = nameKey(value);
    if (!key) return "";
    const place = declared.get(key) ?? { name: str(value, NAME_MAX), tags: "" };
    const canonical = nameKey(place.name);
    const known = used.get(canonical);
    if (known) return known.name;
    if (used.size >= BEAT_PLACES_MAX) return "";
    used.set(canonical, place);
    return place.name;
  };
  // The place it opens in counts only once a line falls back to it: a scene that names its own place first never lists
  // (or pays to paint) the planned one.
  let place = "";
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
    place = resolve(source.place) || place || (options.start ? resolve(options.start) : "");
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
        ...(options.context.cgExplicit && cg.explicit === true ? { explicit: true as const } : {}),
      };
    }
  }
  return body;
}

type NormalizedBeat = BeatBody & { choices: ForgeChoice[] };

/** The reply as a beat body with its choices, or the reason it is refused (the repair turn names it). */
export function normalizeBeatReply(reply: BeatReply, context: BeatContext): NormalizedBeat | string {
  const places = declaredPlaces(reply.places, context.places);
  if (typeof places === "string") return places;
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
    { enabled: true, terminal: context.last && !context.date, label: forgeChoiceLabel },
  );
  if (!beat) {
    return "the segments or choices did not follow the format (check the PLAYER CHOICES rules: 2-4 options, a selection each, branches of 1-8 segments, distinct `at` indexes)";
  }
  const choices = (beat.choices ?? []) as ForgeChoice[];
  if (context.mustChoose && !choices.some((choice) => choice.kind === "big")) {
    return "this node must end on ONE big choice (see the PLAYER CHOICES rules for a big choice)";
  }
  const dateProblem = context.date ? dateChoiceProblem(reply, choices) : "";
  return dateProblem || { ...beat, choices };
}

/** P6's segment rules, lent to P12 (S/story/confrontation.ts normalizes each of its lists with them). */
export function segmentLists(context: BeatContext): SegmentLists {
  return {
    placesProblem: (raw) => {
      const places = declaredPlaces(raw, context.places);
      return typeof places === "string" ? places : "";
    },
    list: (raw, start) => normalizeBeatBody(raw, { start, context }),
    thoughts: (raw, counts) => thoughtProblem(context, raw, counts),
  };
}

/** A score as stored: 1, 0 or −1; anything else (missing, a word, 2) is null. */
function readScore(value: unknown): DateScore | null {
  const number = typeof value === "string" && value.trim() ? Number(value) : value;
  return number === 1 || number === 0 || number === -1 ? number : null;
}

/** The raw options of the reply's choice `choice-<c+1>`, by index. */
function rawOptionsOf(reply: BeatReply, c: number): unknown[] {
  const raw = Array.isArray(reply.choices) ? reply.choices[c] : undefined;
  const options = (raw as { options?: unknown } | undefined)?.options;
  return Array.isArray(options) ? options : [];
}

/** Why a date beat's choices break the date's rules (exactly one small choice, every option scored, one scoring 1). */
function dateChoiceProblem(reply: BeatReply, choices: readonly ForgeChoice[]): string {
  if (choices.length !== 1 || choices[0]!.kind !== "small") {
    return "a date's beat needs exactly ONE small choice (2 to 4 options), never more and never a big one";
  }
  const scores = rawOptionsOf(reply, 0).map((option) => readScore((option as { score?: unknown } | null)?.score));
  if (scores.length !== choices[0]!.options.length || scores.some((score) => score === null)) {
    return 'every option of the date\'s choice needs a "score" of 1, 0 or -1';
  }
  if (!scores.includes(1)) return "at least one option of the date's choice must score 1 (something they would love)";
  return "";
}

/** A date beat's hidden scores, read from the raw reply at the indexes the kit numbered the choices and options by. */
export function scoresOf(reply: BeatReply, choices: readonly ForgeChoice[]): NonNullable<Beat["scores"]> {
  const scores: NonNullable<Beat["scores"]> = {};
  for (const [c, choice] of choices.entries()) {
    if (choice.id !== `choice-${c + 1}`) continue;
    const raw = rawOptionsOf(reply, c);
    const own: Record<string, DateScore> = {};
    for (const option of choice.options) {
      const index = Number(/^option-(\d+)$/.exec(option.id)?.[1] ?? 0) - 1;
      own[option.id] = readScore((raw[index] as { score?: unknown } | undefined)?.score) ?? 0;
    }
    scores[choice.id] = own;
  }
  return scores;
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
        // A date opens a grievance only when it was planned to go wrong, and never more than a minor one.
        const mayOpen = !context.date || context.date.goesWrong;
        if (mayOpen && grievanceText && (grievance?.by === "li" || grievance?.by === "protagonist")) {
          const severity =
            !context.date && ["minor", "major", "rupture"].includes(grievance.severity as string)
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
  return { run: { ...run, player: await withPersonaStoryAbout(deps.runtime, run.player) }, chapter };
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

/** True once the beat holds a first-play pick: a choice, or a stance of its Confrontation. */
const hasCanon = (beat: Beat) => Object.keys(beat.choiceCanon).length > 0 || !!beat.confrontation?.picks.length;

/**
 * True when the beat's Ease off cut its canon. A Confrontation eased off after its ending keeps its canon whole
 * (canon.ts confrontationCanon), so what was written after it still follows it.
 */
const cutShort = (beat: Beat) => !!beat.easedOff && !beat.confrontation?.ending;

/** True while the stored beat is still the one a rewrite was checked against: no pick, read or Ease off since. */
const untouched = (stored: Beat, checked: Beat) =>
  stored.written.at === checked.written.at &&
  !stored.easedOff &&
  !hasCanon(stored) &&
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
  { debugMode, review, signal, replacing }: PaintMode & { signal?: AbortSignal; replacing?: Beat },
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
    !basis || (!!current && current.written.at === basis.written.at && cutShort(current) === cutShort(basis));
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
  const last = i === chapter.nodes.length - 1;
  const mustChoose =
    chapter.kind === "route" && !!node.gate && !!chapter.stage && stageRow(chapter.stage).gate === "confrontation";
  const cgExplicit = explicitCgAllowed(run.world);
  const context: BeatContext = {
    node,
    units,
    places: run.world.places,
    state: run.state,
    last,
    mustChoose,
    cgExplicit,
    ...(chapter.kind === "date" ? { date: { goesWrong: chapter.date?.goesWrong ?? false } } : {}),
  };
  const opponent = confrontationOpponent(chapter, node, units);
  // Chapter 1 opens where the prologue ended, with the choices taken in it.
  const prologue =
    key === mainChapterKey(1) && i === 0
      ? prologueEnding(
          await readBeat(deps.store, runId, PROLOGUE_KEY, 0),
          await chapterSoFar(deps.store, runId, PROLOGUE_KEY, 1, run.player.name),
        )
      : "";
  const input = {
    world: run.world,
    player: run.player,
    units,
    state: run.state,
    chapter,
    node,
    storySoFar,
    memory,
    prologue,
  };
  let body: Omit<Beat, "key" | "i" | "kind" | "choiceCanon" | "applied" | "readThrough" | "written" | "rewrites">;
  let written: { connectionId: string; model: string };
  if (opponent) {
    // P12 (a Closer's P12c): the whole game in one call; its opening is the beat's segments.
    const climax = node.kind === "closer" ? "closer" : "confrontation";
    const lists = segmentLists(context);
    const intimateRoom = run.world.content.heat === "explicit";
    const shape = { li: opponent, node, cgOpen: !!node.cg, cgExplicit, climax, intimateRoom } as const;
    const { value, connectionId, model } = await generateJson(deps, {
      runId,
      job: "narration",
      label: `${climax}/${key}/${i}`,
      messages: (climax === "closer" ? closerMessages : confrontationMessages)({ ...input, li: opponent }),
      schema: ConfrontationReplySchema,
      normalize: (reply) => {
        const game = normalizeConfrontationReply(reply, shape, lists);
        return typeof game === "string" ? game : reply;
      },
      temperature: 0.9,
      maxTokens: 7000,
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const game = normalizeConfrontationReply(value, shape, lists) as Exclude<
      ReturnType<typeof normalizeConfrontationReply>,
      string
    >;
    body = {
      places: game.places,
      segments: game.segments,
      choices: [],
      effects: {},
      musicMood: game.musicMood,
      ...(game.cg ? { cg: game.cg } : {}),
      confrontation: game.confrontation,
    };
    written = { connectionId, model };
  } else {
    const { value, connectionId, model } = await generateJson(deps, {
      runId,
      job: "narration",
      label: `beat/${key}/${i}`,
      messages: beatMessages(input),
      schema: BeatReplySchema,
      normalize: (reply) => {
        const beat = normalizeBeatReply(reply, context);
        if (typeof beat === "string") return beat;
        return (chapter.kind === "prologue" && prologueProblem(beat, units)) || reply;
      },
      temperature: 0.9,
      maxTokens: 6000,
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const scene = normalizeBeatReply(value, context) as NormalizedBeat;
    body = {
      places: scene.places,
      segments: scene.segments,
      choices: scene.choices,
      effects: effectsOf(value, scene.choices, context),
      ...(context.date ? { scores: scoresOf(value, scene.choices) } : {}),
      musicMood: scene.musicMood,
      ...(scene.cg ? { cg: scene.cg } : {}),
    };
    written = { connectionId, model };
  }
  const beat: Beat = {
    key,
    i,
    kind: node.kind,
    ...body,
    choiceCanon: {},
    applied: {},
    readThrough: 0,
    written: { at: new Date().toISOString(), ...written },
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
  // The beat a rewrite replaced, as it was when replaced (its CG may have been painted while this was written).
  let replaced = null as Beat | null;
  // A first write keeps whatever another request saved first; a rewrite replaces only the beat it was checked against.
  const saved = await deps.store.mutateDoc(target, normalizeBeat, (stored) => {
    if (!replacing) return stored ?? beat;
    if (!stored || !untouched(stored, replacing)) throw conflict(REWRITE_STALE);
    replaced = stored;
    return beat;
  });
  // Ease off saves its cut before it removes the beats after it, so one that landed between the check above and this
  // save either removed this beat or shows here: then this beat followed the uncut scene, and it is removed again.
  if (saved?.written.at === beat.written.at && !sameBasis(await readBeat(deps.store, runId, key, i - 1))) {
    await deps.store.removeDoc(beatId(runId, key, i));
    throw basisChanged();
  }
  // Only the write that was saved paints: a request that lost the race to another write hands nothing on. The beat a
  // rewrite replaced lets its CG go.
  if (saved?.written.at === beat.written.at) {
    paintScene(deps, runId, saved, { debugMode, review });
    if (replaced) releaseArt(deps, runId, replaced);
  }
  return saved ?? beat;
}

const artFailed = (deps: BeatDeps, beat: Pick<Beat, "key" | "i">, what: string) => (error: unknown) =>
  deps.runtime.logger.warn(
    "[otome-forge] Art for %s/%d (%s) not queued: %s",
    beat.key,
    beat.i,
    what,
    error instanceof Error ? error.message : String(error),
  );

/** Runs one art call in the background: a throw or a rejection is logged, and the story goes on. */
function inBackground(deps: BeatDeps, beat: Pick<Beat, "key" | "i">, what: string, call: () => unknown): void {
  try {
    void Promise.resolve(call()).catch(artFailed(deps, beat, what));
  } catch (error) {
    artFailed(deps, beat, what)(error);
  }
}

/** A written beat's places and CG (S/art/cg.ts queueScenePaints): painted now, or left waiting for the tap. */
function paintScene(deps: BeatDeps, runId: string, beat: Beat, mode: PaintMode): void {
  const art = deps.art;
  if (art) inBackground(deps, beat, "scene", () => art.queueScenePaints(runId, beat, mode));
}

/** The faces of the love interests who speak in a beat served (a stance game's every line counts). */
function queueFaces(deps: BeatDeps, runId: string, beat: Beat, debugMode: boolean): void {
  const art = deps.art;
  if (!art) return;
  const lines = beat.confrontation ? { segments: confrontationLines(beat), choices: [] } : beat;
  inBackground(deps, beat, "expressions", () => art.queueExpressions(runId, lines, { debugMode }));
}

/** A beat that is replaced or removed lets its CG's gallery image go (unless the album keeps it). */
function releaseArt(deps: BeatDeps, runId: string, beat: Beat): void {
  const art = deps.art;
  if (art && beat.cg?.art) inBackground(deps, beat, "release", () => art.releaseBeatArt(runId, beat));
}

/** Whether the player may have beat `i` written now: it is the one being read, or the next one (the lookahead). */
function writable(run: RunDocuments, chapter: Chapter, i: number): boolean {
  const progress = run.state.chapters[chapter.key];
  return i < chapter.nodes.length && !progress?.completed && i <= (progress?.beatsRead ?? 0) + 1;
}

/**
 * Queues the node after `beat` in the background of the run's queue, unless the beat ends on a big choice or is a
 * Confrontation that has not ended (the stance that ends it queues it).
 */
function queueLookahead(deps: BeatDeps, runId: string, chapter: Chapter, beat: Beat, mode: PaintMode): void {
  const next = beat.i + 1;
  if (next >= chapter.nodes.length || beat.choices.some((choice) => choice.kind === "big")) return;
  if (beat.confrontation && !beat.confrontation.ending) return;
  void (async () => {
    if (await readBeat(deps.store, runId, chapter.key, next)) return;
    await cancellable(deps, runId, (signal) =>
      readOrGenerate(
        runId,
        () => readBeat(deps.store, runId, chapter.key, next),
        async () => {
          // The beat it follows may have been rewritten or eased off while this waited in the queue.
          const current = await readBeat(deps.store, runId, chapter.key, beat.i);
          if (!current || current.written.at !== beat.written.at || cutShort(current)) return null;
          // A route chapter waits while a rupture stands (no beat of it opens), so nothing is paid for meanwhile.
          if (await routeLocked(deps, runId, chapter)) return null;
          return generateBeat(deps, runId, chapter.key, next, { ...mode, signal });
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

/** True while a rupture with the love interest of this route chapter stands (his route chapters stay locked). */
async function routeLocked(deps: BeatDeps, runId: string, chapter: Chapter, state?: RunState): Promise<boolean> {
  if (chapter.kind !== "route" || !chapter.li) return false;
  const current = state ?? (await deps.store.readDoc(stateId(runId), normalizeState));
  return !!current?.lis[chapter.li]?.rupture;
}

/**
 * True while a rupture keeps beat `i` (`beat`: as stored, or null) of his route chapter from the reader: it is served,
 * read or eased off only once it has been on screen (never one the lookahead wrote meanwhile), and his gate only when
 * the rupture opened in it (stages.ts gateShut). Nothing is taken back: a finished chapter and the beats already read
 * replay.
 */
async function ruptureHolds(
  deps: BeatDeps,
  runId: string,
  chapter: Chapter,
  state: RunState,
  i: number,
  beat: Beat | null,
): Promise<boolean> {
  const progress = state.chapters[chapter.key];
  if (progress?.completed || i < (progress?.beatsRead ?? 0)) return false;
  if (!(await routeLocked(deps, runId, chapter, state))) return false;
  return !beat?.shown || gateShut(state, chapter, i);
}

/**
 * Removes the chapter's beats after `i` that nobody has read (they followed a beat that changed). Each lets go of the CG
 * of the revision actually removed, so one painted just before the removal is not left in the gallery.
 */
async function dropBeatsAfter(deps: BeatDeps, runId: string, chapter: Chapter, i: number): Promise<void> {
  for (let next = i + 1; next < chapter.nodes.length; next += 1) {
    const dropped = await deps.store.takeDoc(beatId(runId, chapter.key, next), normalizeBeat);
    if (dropped) releaseArt(deps, runId, dropped);
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
  { rewrite = false, debugMode, review }: PaintMode & { rewrite?: boolean },
): Promise<Beat> {
  const { run, chapter } = await load(deps, runId, key);
  if (run.world.forge.phase !== "ready") throw conflict("The world is still being forged.");
  if (!chapter.nodes[i]) throw beatNotFound();
  const stored = rewrite ? null : await readBeat(deps.store, runId, key, i);
  if (await ruptureHolds(deps, runId, chapter, run.state, i, stored)) throw locked(ROUTE_LOCKED);
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
        if (progress?.completed || (progress?.beatsRead ?? 0) > i || hasCanon(current)) {
          throw conflict("Only the beat being read can be rewritten, before any of its choices is made.");
        }
        await dropBeatsAfter(deps, runId, chapter, i);
        return generateBeat(deps, runId, key, i, { debugMode, review, signal, replacing: current });
      }),
    );
  } else {
    beat = stored;
    if (!beat) {
      if (!writable(run, chapter, i)) throw conflict("This beat cannot be written yet.");
      beat = await cancellable(deps, runId, (signal) =>
        readOrGenerate(
          runId,
          () => readBeat(deps.store, runId, key, i),
          () => generateBeat(deps, runId, key, i, { debugMode, review, signal }),
        ),
      );
    }
  }
  if (!beat.shown && chapter.kind === "route") {
    // On screen from now on (ruptureHolds): a beat the lookahead wrote is not, until it is served.
    beat =
      (await deps.store.updateDoc(runDocTarget("beat", beatId(runId, key, i)), normalizeBeat, (current) =>
        current && !current.shown ? { ...current, shown: true as const } : current,
      )) ?? beat;
  }
  if (!run.state.chapters[key]?.completed && i >= (run.state.chapters[key]?.beatsRead ?? 0)) {
    // generateBeat may itself run inside the foreground queue. Await its place registration only after that lock
    // has been released; the reader's first art response must distinguish pending from no image/description.
    await deps.art?.prepareScenePlaces?.(runId, beat, { debugMode, review });
  }
  queueFaces(deps, runId, beat, debugMode);
  if (!run.state.chapters[key]?.completed) queueLookahead(deps, runId, chapter, beat, { debugMode, review });
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

// ── The Confrontation's stances ──

/** Applies the beat's saved stances' effects to the state once (applyConfrontation; a replay is a no-op). */
async function applyStances(deps: BeatDeps, runId: string, chapter: Chapter, beat: Beat): Promise<Remembered> {
  let outcome = NOTHING_REMEMBERED;
  const at = new Date().toISOString();
  const state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    const { state: next, remembered, rememberedBy } = applyConfrontation(current, chapter, beat, at);
    outcome = { remembered, rememberedBy };
    return next;
  });
  if (!state) throw runNotFound();
  return outcome;
}

/** The `applied` entries the saved moves earn: each Reveal's (Mirror's), and the ending's once reached. */
const stanceEffectKeys = (beat: Beat) => {
  const game = beat.confrontation;
  if (!game) return [];
  const spec = climaxSpec(game);
  return [
    ...game.picks.flatMap((stance, k) => (stance === spec.discloses ? [`${beat.i}/stance-${k + 1}`] : [])),
    ...(game.ending ? [`${beat.i}/${spec.noun}`] : []),
  ];
};

/** The stance result for round `round` of the saved game. */
function stanceResult(beat: Beat, round: number, outcome: Remembered): StanceResult {
  return { ...afterRound(beat.confrontation!, round), confrontation: toConfrontationView(beat)!, ...outcome };
}

/**
 * POST .../beats/:i/stance {round, stance}: the first-play move of round `round` (1–3) on the climax game being read
 * (a Confrontation's stance, a Closer's answer). It is saved on the beat once (the third with the ending its picks
 * reach), then its effects reach the state once. The same move again returns what it did; another move for a round
 * already played is a 409 `locked`; a move of the other game is a 400 that saves nothing. The ending queues the next
 * node.
 */
export async function chooseStance(
  deps: BeatDeps,
  runId: string,
  key: string,
  i: number,
  round: number,
  stance: ClimaxMove,
  mode: PaintMode,
): Promise<StanceResult> {
  const { run, chapter } = await load(deps, runId, key);
  const beat = await readBeat(deps.store, runId, key, i);
  const confrontation = beat?.confrontation;
  if (!beat || !confrontation) throw new OtomeForgeError(404, "No such confrontation.", "not-found");
  // Before anything is saved: a move of the other game would make the stored game unreadable.
  if (!climaxSpec(confrontation).moves.includes(stance)) {
    throw new OtomeForgeError(
      400,
      `"${stance}" is not a move of this ${climaxSpec(confrontation).noun}.`,
      "bad-request",
    );
  }
  const taken = confrontation.picks[round - 1];
  if (taken) {
    if (taken !== stance) throw locked("That round is played.");
    // Saved by a request that stopped before its effects: they land now (exactly once by `applied`).
    const applied = run.state.chapters[key]?.applied ?? [];
    const pending = stanceEffectKeys(beat).some((entry) => !applied.includes(entry));
    const outcome = pending ? await applyStances(deps, runId, chapter, beat) : NOTHING_REMEMBERED;
    return stanceResult(beat, round, outcome);
  }
  const progress = run.state.chapters[key];
  if (beat.easedOff) throw conflict("This scene was eased off.");
  if (progress?.completed || (progress?.beatsRead ?? 0) > i) throw locked("That confrontation is over.");
  if ((progress?.beatsRead ?? 0) !== i) throw conflict("Stances are taken in the confrontation being read.");
  if (round !== confrontation.picks.length + 1) throw conflict("An earlier round comes first.");
  const saved = await deps.store.updateDoc(runDocTarget("beat", beatId(runId, key, i)), normalizeBeat, (current) => {
    const game = current?.confrontation;
    if (!current || !game) throw beatNotFound();
    // A rewrite saved since this beat was read is another argument: the stance was taken in one that is gone.
    if (current.written.at !== beat.written.at) throw conflict("This scene changed. Open it again.");
    if (current.easedOff) throw conflict("This scene was eased off.");
    // Another request took this round first: keep its stance.
    if (game.picks.length >= round) return current;
    if (game.picks.length !== round - 1) throw conflict("An earlier round comes first.");
    const picks = [...game.picks, stance];
    const ending = picks.length === game.rounds.length ? endingOf(game, picks) : undefined;
    return { ...current, confrontation: { ...game, picks, ...(ending ? { ending } : {}) } };
  });
  if (!saved?.confrontation) throw beatNotFound();
  if (saved.confrontation.picks[round - 1] !== stance) throw locked("That round is played.");
  const outcome = await applyStances(deps, runId, chapter, saved);
  if (saved.confrontation.ending) queueLookahead(deps, runId, chapter, saved, mode);
  return stanceResult(saved, round, outcome);
}

// ── Reading, and the end of a chapter ──

/** The first-play picks a beat's canon holds: each choice picked, up to its Ease off cut. */
export const canonPicks = (
  beat: Pick<Beat, "choices" | "choiceCanon" | "easedOff">,
): Array<[choice: string, option: string]> => {
  const cut = beat.easedOff?.at ?? Infinity;
  return beat.choices.flatMap((choice) => {
    const option = beat.choiceCanon[choice.id];
    return choice.at <= cut && option ? [[choice.id, option] as [string, string]] : [];
  });
};

const readUnit = (deps: BeatDeps, runId: string, li: LiId) => deps.store.readDoc(unitId(runId, li), normalizeUnit);

/**
 * Counts `beat` as read to its end, once and in order (S/state/rewards.ts readBeatToEnd: its Starlight, and on the
 * chapter's last node the chapter's Starlight, Lead and Foil affection, ledgers and lastLead), with what a route
 * chapter's gate or a repair's resolving node does (S/state/stages.ts), all in one write. Starts memory upkeep in the
 * background when the chapter completes.
 */
async function finishBeat(
  deps: BeatDeps,
  runId: string,
  chapter: Chapter,
  beat: Beat,
  debugMode: boolean,
): Promise<ReadResult> {
  let outcome: Omit<ReturnType<typeof readBeatToEnd>, "state"> = { grants: [], chapterDone: false };
  let stageUp: ReadResult["stageUp"];
  let repaired: ReadResult["repaired"];
  let completedNow = false;
  const at = new Date().toISOString();
  // His secrets, for the gate (the stage it opens reveals each secret due by then). Bibles are not edited mid-read.
  const owner = chapter.kind === "route" && chapter.li ? await readUnit(deps, runId, chapter.li) : null;
  const state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    // A pick saved on the beat whose effects never reached the state (its request stopped between the two writes, and
    // a reload shows it as made) lands in this same write, so no beat counts as read with a canon pick unapplied.
    // The pick's `applied` entry makes this a no-op for every other pick; the same goes for a Confrontation's stances.
    const picked = canonPicks(beat).reduce(
      (state, [choice, option]) => applyPickTo(state, chapter, beat, choice, option, at).state,
      current,
    );
    const caughtUp = applyConfrontation(picked, chapter, beat, at).state;
    // A rupture shuts his gate: it is not counted (no stage, no chapter grants) until a repair, whichever way it was
    // reached (a lookahead written before the rupture, an Ease off), unless the rupture opened in this very scene.
    if (gateShut(caughtUp, chapter, beat.i)) throw locked(ROUTE_LOCKED);
    const { state: read, ...rest } = readBeatToEnd(caughtUp, chapter, beat.i);
    outcome = rest;
    let next = read;
    stageUp = undefined;
    repaired = undefined;
    if (countedNow(caughtUp, read, chapter.key, beat.i)) {
      const gate = passGate(next, chapter, beat.i, { secrets: owner?.bible?.secrets ?? [], at });
      const picks = canonPicks(beat).flatMap(([choice, option]) => beat.effects[choice]?.[option] ?? []);
      const heal = healRupture(gate.state, chapter, beat.i, at, picks);
      next = heal.state;
      if (gate.stageUp) stageUp = gate.stageUp;
      if (heal.repaired) repaired = heal.repaired;
    }
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
  return {
    grants: outcome.grants,
    starlight: state.wallet.starlight,
    chapterDone: outcome.chapterDone,
    ...(stageUp ? { stageUp } : {}),
    ...(repaired ? { repaired } : {}),
  };
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
  if (await ruptureHolds(deps, runId, chapter, run.state, i, beat)) throw locked(ROUTE_LOCKED);
  // A Confrontation's position indexes its mainline (the opening, the shown rounds' lines, the ending).
  const end = beat.easedOff?.at ?? confrontationMainline(beat) - 1;
  const reached = Math.max(0, Math.min(end, Math.trunc(segment)));
  if (reached > beat.readThrough) {
    await deps.store.updateDoc(runDocTarget("beat", beatId(runId, key, i)), normalizeBeat, (current) =>
      current ? { ...current, readThrough: Math.max(current.readThrough, reached) } : current,
    );
  }
  // A Confrontation is read to its end once its ending is reached (the client reads the opening, then the rounds).
  const unsettled = beat.confrontation ? !beat.confrontation.ending : !settledThrough(beat, end);
  if (reached < end || (!beat.easedOff && unsettled)) {
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
  // A beat on screen can be eased off. One never written or never shown cannot be skipped past a rupture's lock, nor
  // his gate counted while it stands: refused here before anything is cut (and again in finishBeat's write).
  if (await ruptureHolds(deps, runId, chapter, run.state, i, current)) throw locked(ROUTE_LOCKED);
  const at = Math.max(0, Math.min((current ? confrontationMainline(current) : 0) - 1, Math.trunc(segment)));
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
  // after it can hold a pick (chooseOption needs it read), so nothing canon is lost. A Confrontation past its ending
  // keeps its canon, and with it the lookahead its ending queued.
  if (!progress?.completed && (progress?.beatsRead ?? 0) <= i && cutShort(beat)) {
    await dropBeatsAfter(deps, runId, chapter, i);
  }
  const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
  const veilSuggestions = chapter.tags.filter(
    (tag): tag is LimitId =>
      (LIMIT_IDS as readonly string[]).includes(tag) && world?.content.limits[tag as LimitId] === "allow",
  );
  const read = await finishBeat(deps, runId, chapter, beat, debugMode);
  return { beat, veilSuggestions, ...read };
}
