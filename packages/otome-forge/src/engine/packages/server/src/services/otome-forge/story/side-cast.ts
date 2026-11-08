// ──────────────────────────────────────────────
// Otome Hearth: side characters who come back (0.20.0): who spoke, who qualifies, their look, and when their sprite is
// painted
// ──────────────────────────────────────────────
// A side character is a named speaker who is neither a love interest nor the protagonist: the reader shows their line as
// "other" (C/lib/reader-state.ts voiceOf), and here a name that names a love interest or the protagonist in any way
// S/names.ts knows (a title, an honorific, a first name) is left out too, as is a speaker that is several people or no
// name at all. Settings → Images "Side character sprites" (world.images.sideSprites, off by default) gives each
// recurring one a full-body sprite (S/art/side-sprites.ts) that the reader shows while they speak.
// - Recording (no model call): when a beat is read to its end (S/story/beats.ts finishBeat), its named side speakers
//   are added to `${R}:sides` (S/schemas/side-cast.ts) with the chapter, in one revision-checked write that writes
//   nothing when they are there already. Opening a story (GET /runs/:run) records the scenes read before this existed,
//   once per story (`backfilled`), one pass per story at a time in this process. Recording runs with the toggle off too.
// - Qualifying: spoken in 2 different chapters, or at once when an Engine character card matches: a unique match of the
//   name's core words (titles, articles and honorifics dropped, S/names.ts nameKey) among the player's cards that are
//   not a love interest's. Two cards that match are namesakes, and neither is guessed. Cards are read only while the
//   toggle is on, for someone with nothing written or painted yet, once per person in this process.
// - Their look (not for a card): one structured call on the Planning connection, on the background lane (one job per
//   person, the queue's key), once they qualify: English visual-only tags (identityLine, outfitLine, presentation) from
//   the setting and the scenes they spoke in (bounded, SIDE_SCENES_MAX), with canon for a canon character of an
//   existing world (S/prompts.ts sideLookMessages). It is kept once written; one that failed waits SIDE_LOOK_RETRY_MS
//   before the next tend queues it again. Then their sprite is claimed (S/art/side-sprites.ts queueSideSprite).
// Nothing here calls a model, reads a card or paints while the toggle is off or the world has no image connection.
// ponytail: the card checks and the look's cool-down live in this process only (as the quiz's do); a restart checks
// cards once more and may try a failed look again. The upgrade path is a job document.
import { z } from "zod";
import type {
  Beat,
  Player,
  Presentation,
  SideSpriteView,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { sameName } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import {
  queueSideCutouts,
  queueSideSprite,
  sideSpriteView,
  type SideSpriteDeps,
  type SideSpriteMode,
} from "../art/side-sprites.js";
import { updateIfChanged } from "../art/paint.js";
import type { BackgroundQueue } from "../background-queue.js";
import { generateJson, resolveConnectionId } from "../generation.js";
import { runDocTarget, sideCastId, worldId } from "../ids.js";
import { nameCore, nameKey } from "../names.js";
import { sideLookMessages } from "../prompts.js";
import {
  SIDE_CHAPTERS_MAX,
  SIDE_NAME_MAX,
  normalizeSideCast,
  qualifies,
  type SideCast,
  type SidePerson,
} from "../schemas/side-cast.js";
import { readRun } from "../schemas/state.js";
import { normalizeBeat } from "../schemas/story.js";
import { normalizeWorld } from "../schemas/world.js";
import { listCardNames } from "../setup/cast.js";

export interface SideCastDeps extends SideSpriteDeps {
  /** The package's background lane; without it no look is written. */
  background?: Pick<BackgroundQueue, "ensure">;
}

/** How long a look call that failed is left alone before the next tend queues it again. */
export const SIDE_LOOK_RETRY_MS = 10 * 60_000;
/** The most text of their scenes the look call reads, in characters. */
export const SIDE_SCENES_MAX = 12_000;
const LOOK_LINE_MAX = 600;

/** The love interests and the protagonist: never side characters. */
interface Cast {
  player: Pick<Player, "name">;
  units: ReadonlyArray<Pick<Unit, "name">>;
}

const sidesTarget = (runId: string) => runDocTarget("sides", sideCastId(runId));
/** Side character sprites is on, and there is an image connection to paint them with. */
const spritesOn = (world: Pick<World, "images"> | null) => !!world?.images.sideSprites && !!world.images.connectionId;
/** Several people in one speaker ("Kai & Sol", "Guards, both"), or no letter at all ("???"). */
const NOT_ONE_NAME = /[&/+,]|^\P{L}*$/u;

/** True when `speaker` names `name` as the reader does, or by its core words, or by its first core word alone. */
function namesPerson(speaker: string, name: string): boolean {
  if (sameName(speaker, name)) return true;
  const key = nameKey(speaker);
  const theirs = nameCore(name);
  return !!key && (key === theirs.join(" ") || key === theirs[0]);
}

/** The record key of a side character speaking as `speaker`, or null for narration, the cast or no single name. */
export function sideKeyOf(speaker: string, cast: Cast): string | null {
  const name = speaker.trim();
  if (!name || name.length > SIDE_NAME_MAX || NOT_ONE_NAME.test(name)) return null;
  if (namesPerson(name, cast.player.name) || cast.units.some((unit) => namesPerson(name, unit.name))) return null;
  return nameKey(name) || null;
}

export interface SideSpeaker {
  key: string;
  name: string;
  voice?: "male" | "female";
}

type ReadBeat = Pick<Beat, "segments" | "choices" | "choiceCanon" | "easedOff">;

/** The beat's lines as it was read: its lines up to an Ease off's cut, then each picked option's branch. */
function readLines(beat: ReadBeat): Beat["segments"] {
  const end = beat.easedOff ? beat.easedOff.at : Infinity;
  return [
    ...beat.segments.slice(0, end + 1),
    ...beat.choices
      .filter((choice) => choice.at <= end)
      .flatMap((choice) => choice.options.find((option) => option.id === beat.choiceCanon[choice.id])?.segments ?? []),
  ];
}

/** The story and its beats already read (all of a completed chapter's, else those below its beatsRead), or null. */
async function readBeats(deps: Pick<SideCastDeps, "store">, runId: string) {
  const run = await readRun(deps.store, runId);
  if (!run) return null;
  const read = (beat: Beat) => {
    const progress = run.state.chapters[beat.key];
    return !!progress && (!!progress.completed || beat.i < progress.beatsRead);
  };
  const beats = (await deps.store.listRun("beat", runId))
    .flatMap((document) => normalizeBeat(document.data) ?? [])
    .filter(read);
  return { run, beats };
}

/** The beat's named side speakers as it was read (readLines). */
export function sideSpeakers(beat: ReadBeat, cast: Cast): SideSpeaker[] {
  const found = new Map<string, SideSpeaker>();
  for (const line of readLines(beat)) {
    const key = line.thought ? null : sideKeyOf(line.speaker, cast);
    if (!key) continue;
    const voice = line.gender === "male" || line.gender === "female" ? line.gender : found.get(key)?.voice;
    found.set(key, { key, name: line.speaker.trim(), ...(voice ? { voice } : {}) });
  }
  return [...found.values()];
}

/** `people` with each speaker heard in `chapter`; null when nothing changes. */
function heard(
  people: SideCast["people"],
  speakers: readonly SideSpeaker[],
  chapter: string,
  at: string,
): SideCast["people"] | null {
  const next: SideCast["people"] = { ...people };
  let changed = false;
  for (const { key, name, voice } of speakers) {
    const person: SidePerson | undefined = next[key];
    const known = !!person?.chapters.includes(chapter);
    if (person && known && person.name === name && (!voice || person.voice === voice)) continue;
    const chapters = person && known ? person.chapters : [...(person?.chapters ?? []), chapter];
    next[key] = { ...person, key, name, chapters: chapters.slice(-SIDE_CHAPTERS_MAX), ...(voice ? { voice } : {}), at };
    changed = true;
  }
  return changed ? next : null;
}

/** True while the story's world exists. */
const storyExists = async (deps: Pick<SideCastDeps, "store">, runId: string) =>
  (await deps.store.readDoc(worldId(runId), (data) => data)) !== null;

/**
 * Applies `change` to `${R}:sides`, writing nothing when it returns undefined (a story nobody spoke in has no record).
 * The document is created only while the story exists, and taken away again when the story was deleted meanwhile, so
 * a late write never brings one back.
 */
async function changeSides(
  deps: Pick<SideCastDeps, "store">,
  runId: string,
  change: (current: SideCast) => SideCast | undefined,
): Promise<SideCast | null> {
  const updated = await updateIfChanged(deps.store, sidesTarget(runId), normalizeSideCast, change);
  if (updated) return updated.value;
  if (!change(normalizeSideCast(undefined)) || !(await storyExists(deps, runId))) return null;
  const created = await deps.store.mutateDoc(
    sidesTarget(runId),
    normalizeSideCast,
    (current) => change(current) ?? current,
  );
  if (!(await storyExists(deps, runId))) {
    await deps.store.removeDoc(sideCastId(runId));
    return null;
  }
  return created;
}

/** Records the beat's named side speakers in `chapter` (see the header). No model call. */
export async function recordSideSpeakers(
  deps: Pick<SideCastDeps, "store">,
  runId: string,
  chapter: string,
  beat: Pick<Beat, "segments" | "choices" | "choiceCanon" | "easedOff">,
  cast: Cast,
): Promise<SideCast | null> {
  const speakers = sideSpeakers(beat, cast);
  if (!speakers.length) return null;
  const at = new Date().toISOString();
  return changeSides(deps, runId, (current) => {
    const people = heard(current.people, speakers, chapter, at);
    return people ? { ...current, people } : undefined;
  });
}

/** Each story's backfill running in this process (one at a time per story), and the stories it has finished. */
const backfills = new Map<string, Promise<void>>();
const backfilled = new Set<string>();

/**
 * On opening a story: records the side speakers of every scene already read, once per story (`backfilled`; a story
 * with none keeps no record, and is passed over for the rest of the process), one pass per story at a time (a second
 * open while it runs gets the same pass). No model call; it never rejects.
 */
export function backfillSideCast(deps: SideCastDeps, runId: string): Promise<void> {
  const running = backfills.get(runId);
  if (running) return running;
  if (backfilled.has(runId)) return Promise.resolve();
  const pass = (async () => {
    if ((await deps.store.readDoc(sideCastId(runId), normalizeSideCast))?.backfilled) {
      backfilled.add(runId);
      return;
    }
    const found = await readBeats(deps, runId);
    if (!found) return;
    const { run } = found;
    const beats = found.beats.sort((a, b) => a.written.at.localeCompare(b.written.at) || a.i - b.i);
    const at = new Date().toISOString();
    await changeSides(deps, runId, (current) => {
      if (current.backfilled) return undefined;
      let people = current.people;
      for (const beat of beats) people = heard(people, sideSpeakers(beat, run), beat.key, at) ?? people;
      return Object.keys(people).length ? { ...current, backfilled: at, people } : undefined;
    });
    backfilled.add(runId);
  })()
    .catch((error: unknown) =>
      deps.runtime.logger.warn(
        "[otome-forge] Side characters were not recorded: %s",
        error instanceof Error ? error.message : String(error),
      ),
    )
    .finally(() => backfills.delete(runId));
  backfills.set(runId, pass);
  return pass;
}

// ── Engine cards ──

/** The one card whose name's core words are `key`, or null for none or namesakes (see the header). */
export function matchCard(key: string, cards: ReadonlyArray<{ id: string; name: string }>): string | null {
  const found = cards.filter((card) => nameKey(card.name) === key);
  return found.length === 1 ? found[0]!.id : null;
}

/** People already checked against the cards in this process, `${runId}|${key}`. */
const checked = new Set<string>();

// ── Their look ──

const LookReplySchema = z.object({
  identityLine: z.string(),
  outfitLine: z.string(),
  presentation: z.string(),
});
type LookReply = z.infer<typeof LookReplySchema>;

const clipLine = (line: string) => line.replace(/\s+/gu, " ").trim().slice(0, LOOK_LINE_MAX).trim();
const PRESENTATIONS: Record<string, Presentation> = { man: "man", male: "man", woman: "woman", female: "woman" };

/** The reply as a look, or what is wrong with it (the generation core's one repair turn). */
function normalizeLook(reply: LookReply): LookReply | string {
  const identityLine = clipLine(reply.identityLine);
  if (!identityLine) return "identityLine must not be empty";
  const presentation = PRESENTATIONS[reply.presentation.trim().toLowerCase()] ?? "person";
  return { identityLine, outfitLine: clipLine(reply.outfitLine), presentation };
}

/**
 * The text of the read scenes they spoke in (readBeats, readLines: never a scene written ahead or cut by Ease off), in
 * the order first heard, each around their lines, at most SIDE_SCENES_MAX.
 */
async function sideScenes(deps: Pick<SideCastDeps, "store">, runId: string, person: SidePerson): Promise<string> {
  const beats = ((await readBeats(deps, runId))?.beats ?? [])
    .filter((beat) => person.chapters.includes(beat.key))
    .sort((a, b) => person.chapters.indexOf(a.key) - person.chapters.indexOf(b.key) || a.i - b.i);
  const parts: string[] = [];
  let left = SIDE_SCENES_MAX;
  for (const beat of beats) {
    const segments = readLines(beat);
    const theirs = segments.flatMap((line, index) =>
      !line.thought && nameKey(line.speaker) === person.key ? [index] : [],
    );
    if (!theirs.length) continue;
    // From a little before their first line (who they are, as the narration brings them in) to just after their last.
    const text = segments
      .slice(Math.max(0, theirs[0]! - 3), theirs.at(-1)! + 2)
      .map((line) => (line.speaker.trim() ? `${line.speaker.trim()}: ${line.text}` : line.text))
      .join("\n");
    parts.push(text.slice(0, left));
    left -= text.length;
    if (left <= 0) break;
  }
  return parts.join("\n\n");
}

/**
 * The look job: one call that writes a qualifying person's look, kept only while they still have none (see the
 * header). Returns at once when there is nothing to write (the toggle turned off, a card, a look written meanwhile).
 */
export async function writeSideLook(
  deps: SideCastDeps,
  runId: string,
  key: string,
  { connectionId, debugMode }: { connectionId: string; debugMode: boolean },
): Promise<void> {
  const [world, sides] = await Promise.all([
    deps.store.readDoc(worldId(runId), normalizeWorld),
    deps.store.readDoc(sideCastId(runId), normalizeSideCast),
  ]);
  const person = sides?.people[key];
  if (!world || !spritesOn(world) || !person || person.look || person.cardId || !qualifies(person)) return;
  const { value } = await generateJson(deps, {
    runId,
    job: "structured",
    label: "side-look",
    messages: sideLookMessages({ world, name: person.name, scenes: await sideScenes(deps, runId, person) }),
    schema: LookReplySchema,
    normalize: normalizeLook,
    maxTokens: 600,
    debugMode,
    lane: "background",
    connectionId,
  });
  const at = new Date().toISOString();
  await updateIfChanged(deps.store, sidesTarget(runId), normalizeSideCast, (current) => {
    const now = current.people[key];
    if (!now || now.look || now.cardId) return undefined;
    const look = { ...value, presentation: value.presentation as Presentation, at };
    return { ...current, people: { ...current.people, [key]: { ...now, look } } };
  });
}

/** Look jobs that failed, and when (the cool-down). */
const lookFailed = new Map<string, number>();

/** Queues their look on the background lane, then claims their sprite once it is written. */
function queueSideLook(deps: SideCastDeps, runId: string, key: string, connectionId: string, mode: SideSpriteMode) {
  const job = `${sideCastId(runId)}#look:${key}`;
  if (!deps.background || Date.now() - (lookFailed.get(job) ?? -Infinity) < SIDE_LOOK_RETRY_MS) return;
  deps.background.ensure({
    key: job,
    connectionId,
    run: async () => {
      try {
        await writeSideLook(deps, runId, key, { connectionId, debugMode: mode.debugMode });
        lookFailed.delete(job);
      } catch (error) {
        lookFailed.set(job, Date.now());
        throw error;
      }
      await queueSideSprite(deps, runId, key, mode);
    },
  });
}

/**
 * What the story's side characters are owed while Side character sprites is on (see the header): their Engine cards
 * looked up, a look call queued for each qualifying person with none, each qualifying person's sprite claimed once
 * their look is ready (or at once for a card), and each painted sprite's free cut-out. Nothing while the toggle is off
 * or the world has no image connection. Never waits for a call or a paint; failures are logged.
 */
export async function tendSideCast(deps: SideCastDeps, runId: string, mode: SideSpriteMode): Promise<void> {
  try {
    const run = await readRun(deps.store, runId);
    if (!run || !spritesOn(run.world)) return;
    let sides = await deps.store.readDoc(sideCastId(runId), normalizeSideCast);
    if (!sides) return;
    // Someone who has since joined the cast (a newcomer) is never a side character again.
    const people = () => Object.values(sides!.people).filter((person) => sideKeyOf(person.name, run) === person.key);
    const unchecked = people().filter(
      (person) => !person.cardId && !person.look && !person.art && !checked.has(`${runId}|${person.key}`),
    );
    if (unchecked.length) {
      const linked = new Set(run.units.flatMap((unit) => unit.cardId ?? []));
      const cards = (await listCardNames(deps.runtime)).filter((card) => !linked.has(card.id));
      for (const person of unchecked) checked.add(`${runId}|${person.key}`);
      const found = new Map(
        unchecked.flatMap((person) => {
          const card = matchCard(person.key, cards);
          return card ? [[person.key, card] as const] : [];
        }),
      );
      if (found.size) {
        sides =
          (
            await updateIfChanged(deps.store, sidesTarget(runId), normalizeSideCast, (current) => {
              const matched = [...found].filter(([key]) => {
                const person = current.people[key];
                return person && !person.cardId && !person.look && !person.art;
              });
              if (!matched.length) return undefined;
              const next = { ...current.people };
              for (const [key, cardId] of matched) next[key] = { ...next[key]!, cardId };
              return { ...current, people: next };
            })
          )?.value ?? sides;
      }
    }
    const connectionId = resolveConnectionId(run.world, "structured");
    for (const person of people()) {
      if (!qualifies(person) || person.art) continue;
      if (person.cardId || person.look) await queueSideSprite(deps, runId, person.key, mode);
      else if (connectionId) queueSideLook(deps, runId, person.key, connectionId, mode);
    }
    await queueSideCutouts(deps, runId, people());
  } catch (error) {
    deps.runtime.logger.warn(
      "[otome-forge] Side characters were not tended: %s",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * A beat read to its end (S/story/beats.ts finishBeat): records its side speakers, then tends the story's side
 * characters in the background. Never rejects; the read never waits for a look or a paint.
 */
export async function noteSideSpeakers(
  deps: SideCastDeps,
  runId: string,
  chapter: string,
  beat: Beat,
  mode: SideSpriteMode,
): Promise<void> {
  try {
    const run = await readRun(deps.store, runId);
    if (!run || !(await recordSideSpeakers(deps, runId, chapter, beat, run))) return;
    if (spritesOn(run.world)) void tendSideCast(deps, runId, mode);
  } catch (error) {
    deps.runtime.logger.warn(
      "[otome-forge] The side characters of %s were not recorded: %s",
      chapter,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * GET .../art/scene: the beat's qualifying side speakers with their sprites, by the speaker name as the beat writes it
 * (every line and every option's branch, which the reader may show), while the toggle is on; undefined with none.
 */
export async function sceneSides(
  deps: SideCastDeps,
  runId: string,
  run: Cast & { world: { images: { sideSprites?: boolean } } },
  beat: Pick<Beat, "segments" | "choices">,
): Promise<Record<string, SideSpriteView> | undefined> {
  if (!run.world.images.sideSprites) return undefined;
  const sides = await deps.store.readDoc(sideCastId(runId), normalizeSideCast);
  if (!sides) return undefined;
  const speaking = new Map<string, SidePerson>();
  for (const line of [
    ...beat.segments,
    ...beat.choices.flatMap((choice) => choice.options.flatMap((o) => o.segments)),
  ]) {
    const key = line.thought ? null : sideKeyOf(line.speaker, run);
    const person = key ? sides.people[key] : undefined;
    if (person && qualifies(person)) speaking.set(line.speaker.trim(), person);
  }
  if (!speaking.size) return undefined;
  const shown = new Map(
    (await queueSideCutouts(deps, runId, [...new Set(speaking.values())])).map((person) => [person.key, person]),
  );
  return Object.fromEntries(
    [...speaking].map(([name, person]) => [name, sideSpriteView(runId, shown.get(person.key) ?? person)]),
  );
}
