// ──────────────────────────────────────────────
// Otome Forge: first-play canon. What a beat says once its choices are made, the chapter so far, the story reader that
// hands completed chapters to the kit's memory (S/memory/sources.ts) and to Who said what? (#2041,
// S/minigames/who-said-what.ts), and the story before a prompt (recallText)
// ──────────────────────────────────────────────
// A beat's canon is the kit's forgeCanonicalSegments: the mainline with each first-play pick's marker, selection and
// branch spliced in, and nothing while a big choice waits. A beat the player eased off is cut at that segment and ends
// on EASE_OFF_MARKER, so every later prompt continues from the aftermath without depicting it. Replays never change
// canon: picks are written once (S/story/beats.ts).
// A Confrontation's canon (M2b) is its opening, then each round played: his lines, the stance taken with what she said
// or did, and his answer; then the ending. It is unsettled (null) until the ending, as a beat is while its big choice
// waits, so nothing is written after it before it ends. Eased off, it keeps what was played and closes on the marker.
//
// Memory sources are completed chapters only (the kit's "completed, first-canon snapshots"):
//   main, route, repair      → kind "chapter": the story's own storylines, each summarized into the story's timeline
//   date, story              → kind "character-story": a love interest's date, or a Memory's Character Story or
//                              Moment (GF's bond chapter): summarized, and recalled by its summary as a small memory
//                              of his (#2066, S/memory/memory.ts), never in the timeline
//   an extra story (#2025)   → none: it is imagined together for fun, never canon
// Every chapter but a main one has audience [its love interest's id]: as recent canon, as a recall and in full it
// reaches only a prompt for his own reader or a scene he is in (mayKnow). Another love interest knows his route or
// repair chapter only through the timeline (0.6.17: before it such a chapter was a `chat`, out of the overview, so long
// routes lost their history), where its summary opens by saying whose it is and that it is private (titleOf,
// S/prompts.ts CHAPTER_SUMMARY_WORDING), and the knowledge boundary keeps him from claiming he was there. Audience entries are plain LI ids, so recall's `cast` and `reader` are LI ids too. Care data is
// never a source.
//
// recallText gives every story prompt (P5, P6, P10, P11, P12, P12c, the date, Character Story, extra story and banner
// plans) and the chat reply (P17, as its love interest's own reader) the story before it, built from what exists and
// the same whatever state the memory is in (ready, pending, stale, a failed summary, never written, a recall that
// fails), as the kit's memory context (forgeMemoryContext), which the generation core fits to the connection
// (S/generation.ts):
// - the previous chapter in full (GF's "# Previous chapter in full"): the last completed chapter of the storyline the
//   prompt continues (`continues`): the main story's for its plans and its scenes; a love interest's own route and
//   repair chapters for his plans and their scenes (the main story's while he has none); and otherwise the newest
//   main, route or repair chapter the prompt may know. Only what was played: each first-play pick with its branch,
//   never an option not taken (forgeCanonicalSegments, confrontationCanon);
// - the story's timeline as saved (#2066, S/memory/timeline.ts savedStory: the summaries of the chapters folded so far,
//   a condensed head and the newest after it, in story order), without the previous chapter's own entry, which goes in
//   full;
// - around the previous chapter, in story order, every other chapter the prompt may know that the timeline does not
//   cover: by its saved summary when it has one ("# Recent canon summary"), and in full only while it has none, being
//   summarized, its summary failed or never written ("# Canon in full"). A chapter that has a summary never goes in
//   full;
// - the recall pool (S/memory/memory.ts: the newest small memories this prompt may know, within 5k tokens, each date the
//   timeline covers by its summary among them), after the timeline or, when `cached`, as a context of its own that the
//   prompt sends after its cached part. A recall that fails is the same story context without it.
// When the prompt does not fit, the recalls give way first; then, only while the reply would get less than its floor,
// the older storyline chapter summaries, oldest first, then the chapters in full, oldest first, then the previous
// chapter's earliest scenes. As in GF, the timeline, the previous chapter's last scene, the newest chapter summary and
// every date's and Character Story's summary always stay. Memory that lags (stale or pending) is queued to catch up in
// the background; a failed summary waits until Retry, or the upkeep that new canon (a finished chapter, phone session
// or Read Him set) queues, succeeds (after a connection change, say). The kit summarizes in story order and stops at
// the first failure, and folds nothing into the timeline until every chapter has its summary, so meanwhile that
// chapter and every chapter completed after it go in full (one summarized before it in that round goes by its summary).
// No decisions list goes beside it any more (#2066): every chapter's summary names each choice the protagonist made,
// and a chapter in full is what was played.
// A prompt that caches its story context (`cached`: P5, P6, P12, P12c, #2091) is given only what every call of its
// chapter may know, so the context is the same whatever the call's cast: the timeline, the previous chapter in full
// (the same for every node: a main chapter's is the main story's, and a love interest is in every node of his own
// chapter), and the chapters not covered yet that are shared, or the chapter's own love interest's. What only some may
// know (another love interest's own chapters not covered yet, by summary or in full) goes with the recalls, for the
// call's own cast, which the prompt sends after its cached part. The rules that decide what gives way are worked out
// within each part, so neither follows the other: each part keeps its own newest summary. The fitter is given the
// recalls' part first (S/generation.ts), so its optional blocks give way before the cached part's.
// ponytail: the canon only some may know is told after the cached part, so it no longer sits in story order among the
// rest; its titles say whose it is, and its blocks keep their own order. The upgrade path is naming each block's place
// in the story (after which chapter it happened).
import { forgeCanonicalSegments } from "@forge-kit/player-choices-server.mjs";
import { forgeMemoryContext, type ForgeMemoryContext } from "@forge-kit/story-memory-fit.mjs";
import type { ForgeMemorySource, ForgeRecallOptions, ForgeRecallResult } from "@forge-kit/story-memory.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type {
  Beat,
  Chapter,
  LiId,
  RunState,
  Segment,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { CLIMAX_MOVES, climaxOf } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { beatId, chapterId, memoryId, playerId, stateId, unitId } from "../ids.js";
import type { OtomeMemory } from "../memory/memory.js";
import { parseTimeline, renderTimeline, savedStory } from "../memory/timeline.js";
import { normalizePlayer } from "../schemas/player.js";
import { normalizeState } from "../schemas/state.js";
import { normalizeBeat, normalizeChapter } from "../schemas/story.js";
import { normalizeUnit } from "../schemas/unit.js";
import type { OtomeStore } from "../store.js";

/** Closes an eased-off beat's canon (plan M2a: Ease off). The reader shows its own aftermath line instead. */
export const EASE_OFF_MARKER =
  "[The scene was cut short by the player. Continue from its aftermath without depicting it.]";

/**
 * A climax game's canon (a Confrontation's or a Closer's): what was played, then its ending; null until it ends (unless
 * it was eased off).
 */
function confrontationCanon(beat: Beat, protagonist: string): Segment[] | null {
  const confrontation = beat.confrontation!;
  const climax = climaxOf(confrontation);
  const move = climax === "closer" ? "answer" : "stance";
  const cut = beat.easedOff && !confrontation.ending ? beat.easedOff.at : undefined;
  const opening = cut !== undefined && !confrontation.picks.length ? beat.segments.slice(0, cut + 1) : beat.segments;
  const segments: Segment[] = [...opening];
  for (const [k, stance] of confrontation.picks.entries()) {
    const round = confrontation.rounds[k];
    const option = round?.options[stance];
    if (!round || !option || !CLIMAX_MOVES[climax].includes(stance)) break;
    segments.push(...round.his);
    segments.push({
      speaker: "",
      text: `[Canonical player ${move}${protagonist ? ` by ${protagonist}` : ""}, round ${k + 1} of the ${climax}: ${stance}: ${option.label}]`,
    });
    segments.push({ speaker: option.selection.kind === "dialogue" ? protagonist : "", text: option.selection.text });
    segments.push(...option.segments);
  }
  if (confrontation.ending) return [...segments, ...(confrontation.endings[confrontation.ending] ?? [])];
  return cut !== undefined ? [...segments, { speaker: "", text: EASE_OFF_MARKER }] : null;
}

/** A beat's first-play canon, or null while a big choice (or a Confrontation's ending) waits. */
export function canonicalSegments(beat: Beat, protagonist: string): Segment[] | null {
  if (beat.confrontation) return confrontationCanon(beat, protagonist);
  const cut = beat.easedOff?.at;
  if (cut === undefined) {
    return forgeCanonicalSegments({ ...beat, choiceProtagonist: protagonist }) as Segment[] | null;
  }
  // Up to the segment on screen when the player eased off, with only the picks already made before it.
  const segments = beat.segments.slice(0, cut + 1);
  const choices = beat.choices.filter((choice) => choice.at <= cut && beat.choiceCanon[choice.id]);
  const kept = forgeCanonicalSegments({
    segments,
    choices,
    choiceCanon: beat.choiceCanon,
    choiceProtagonist: protagonist,
  });
  return [...((kept as Segment[] | null) ?? segments), { speaker: "", text: EASE_OFF_MARKER }];
}

/** Segments as prompt text, GF's renderer: a `[Place]` line when the place changes, `Name: line`, `Name (thought):`. */
export function renderSegments(segments: readonly Segment[]): string {
  const lines: string[] = [];
  let place = "";
  for (const segment of segments) {
    const where = segment.place?.trim() ?? "";
    if (where && where !== place) {
      place = where;
      lines.push(`[${where}]`);
    }
    if (segment.speaker) {
      lines.push(
        segment.thought ? `${segment.speaker} (thought): ${segment.text}` : `${segment.speaker}: ${segment.text}`,
      );
    } else {
      lines.push(segment.thought ? `(thought) ${segment.text}` : segment.text);
    }
  }
  return lines.join("\n");
}

export const readChapter = (store: Pick<OtomeStore, "readDoc">, runId: string, key: string) =>
  store.readDoc(chapterId(runId, key), normalizeChapter);

export const readBeat = (store: Pick<OtomeStore, "readDoc">, runId: string, key: string, i: number) =>
  store.readDoc(beatId(runId, key, i), normalizeBeat);

/**
 * The chapter's canon before node `before`, one rendered scene per node; null when an earlier beat is missing or waits
 * for a big choice (nothing may be written on top of an unsettled past).
 */
export async function chapterScenes(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  key: string,
  before: number,
  protagonist: string,
): Promise<string[] | null> {
  const scenes: string[] = [];
  for (let i = 0; i < before; i += 1) {
    const beat = await readBeat(store, runId, key, i);
    const segments = beat && canonicalSegments(beat, protagonist);
    if (!segments) return null;
    scenes.push(renderSegments(segments));
  }
  return scenes;
}

/** chapterScenes as one text. */
export async function chapterSoFar(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  key: string,
  before: number,
  protagonist: string,
): Promise<string | null> {
  return (await chapterScenes(store, runId, key, before, protagonist))?.join("\n\n") ?? null;
}

/** The chapter's whole canon, or null while any beat is missing or unsettled. */
async function chapterCanon(store: Pick<OtomeStore, "readDoc">, runId: string, chapter: Chapter, protagonist: string) {
  return chapterSoFar(store, runId, chapter.key, chapter.nodes.length, protagonist);
}

/** A completed chapter, its place in the story, and (a love interest's own chapter) that love interest's name. */
interface Completed {
  chapter: Chapter;
  order: number;
  owner?: string;
  /** Who may know it (see audienceOf); undefined for a main chapter. */
  audience?: string[];
  /** The other love interests who appear in a Character Story, by name (cameosOf). */
  guests?: string[];
}

/** Who may know a chapter: anyone for a main chapter, only its own love interest for any other kind. */
const audienceOf = (chapter: Chapter): string[] | undefined =>
  chapter.kind === "main" ? undefined : [chapter.li ?? chapter.lead];

/**
 * A Character Story (kind "story") is also known to every other love interest who speaks in it (a cameo): its summary
 * says who was there, so a prompt for him knows what he saw. Matched by his name on a line of the played text.
 * ponytail: only a love interest who speaks counts, not one who is only described; upgrade by having the writer name
 * the cast of each scene.
 */
async function cameosOf(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  chapter: Chapter,
  others: ReadonlyMap<string, string>,
): Promise<string[]> {
  if (chapter.kind !== "story" || !others.size) return [];
  const speakers = new Set<string>();
  for (let i = 0; i < chapter.nodes.length; i += 1) {
    const beat = await readBeat(store, runId, chapter.key, i);
    for (const segment of beat?.segments ?? []) if (segment.speaker) speakers.add(segment.speaker.trim());
  }
  return [...others].filter(([, name]) => speakers.has(name)).map(([li]) => li);
}

/** The kit's kind of a chapter (see the header): a storyline's chapter, or a side story (GF's bond chapter). */
const kindOf = (chapter: Chapter): ForgeMemorySource["kind"] =>
  chapter.kind === "date" || chapter.kind === "story" ? "character-story" : "chapter";

/** A storyline's chapter (main, route, repair): what the previous chapter in full may be. */
const storyline = (chapter: Chapter) => kindOf(chapter) === "chapter";

/**
 * Every completed chapter of the run in story order: a main chapter at its number, any other kind just after the main
 * chapters completed before it.
 */
export async function completedChapters(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  state: RunState,
): Promise<Completed[]> {
  const done = Object.entries(state.chapters)
    .filter(([, progress]) => progress.completed)
    .map(([key, progress]) => ({ key, completed: progress.completed! }));
  const mainDone = (before: string) =>
    done.filter((entry) => entry.key.startsWith("main-") && entry.completed < before).length;
  const names = new Map<string, Promise<string | undefined>>();
  const nameOf = (li: string) => {
    const name = names.get(li) ?? store.readDoc(unitId(runId, li), normalizeUnit).then((unit) => unit?.name);
    names.set(li, name);
    return name;
  };
  const cast = new Map<string, string>();
  for (const li of Object.keys(state.lis ?? {})) {
    const name = (await nameOf(li))?.trim();
    if (name) cast.set(li, name);
  }
  const chapters: Completed[] = [];
  for (const { key, completed } of done) {
    const chapter = await readChapter(store, runId, key);
    // The prologue is no memory source: no love interest was there, and chapter 1's first scene is given it directly.
    // An extra story (#2025) is none either: it is imagined together for fun, and never canon.
    if (!chapter || chapter.kind === "prologue" || chapter.prestige) continue;
    const own = audienceOf(chapter);
    const others = new Map([...cast].filter(([li]) => !own?.includes(li)));
    const cameos = own ? await cameosOf(store, runId, chapter, others) : [];
    const audience = own ? [...own, ...cameos] : undefined;
    const guests = cameos.map((li) => cast.get(li)!);
    chapters.push({
      chapter,
      order:
        chapter.kind === "main" && chapter.number
          ? chapter.number * 10000
          : mainDone(completed) * 10000 + 5000 + (Date.parse(completed) || 0) / 1e13,
      ...(audience ? { owner: (await nameOf(audience[0]!)) || "a love interest", audience } : {}),
      ...(guests.length ? { guests } : {}),
    });
  }
  return chapters.sort((a, b) => a.order - b.order || a.chapter.key.localeCompare(b.chapter.key));
}

/**
 * A chapter's title as the story names it: a love interest's own chapter says whose it is and that it is private, on
 * every path (in full, its summary, the timeline), so a scene with others in it keeps the knowledge boundary: nobody
 * else knows what happened there.
 */
function titleOf({ chapter, owner, guests }: Completed & { guests?: string[] }): string {
  const title = chapter.title || chapter.key;
  if (owner === undefined) return title;
  const also = guests?.length ? `; ${guests.join(" and ")} also appear${guests.length === 1 ? "s" : ""} in it` : "";
  return `${owner}'s own ${chapter.kind} chapter "${title}" (private: only the people in its scenes know what happened in it${also})`;
}

/**
 * The chapters as memory sources (their whole canon), in the order given; one not settled yet is left out. A love
 * interest's own chapter carries its audience (see the header).
 */
async function sourcesOf(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  chapters: readonly Completed[],
  protagonist: string,
): Promise<ForgeMemorySource[]> {
  const sources: ForgeMemorySource[] = [];
  for (const completed of chapters) {
    const { chapter, order, audience } = completed;
    const content = await chapterCanon(store, runId, chapter, protagonist);
    if (!content?.trim()) continue;
    const guests = completed.guests;
    sources.push({
      id: chapter.key,
      kind: kindOf(chapter),
      title: titleOf({ ...completed, guests }),
      content,
      order,
      ...(audience ? { audience } : {}),
    });
  }
  return sources;
}

/** Every completed chapter of the run as a memory source, in story order. */
export async function readStorySources(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  state: RunState,
  protagonist: string,
): Promise<ForgeMemorySource[]> {
  return sourcesOf(store, runId, await completedChapters(store, runId, state), protagonist);
}

// ── The story before a prompt ──

/** The story memory the prompts read (S/memory/memory.ts builds it on the kit's createForgeStoryMemory). */
export type StoryMemory = Pick<OtomeMemory, "recall" | "maintain">;

/** Who a prompt is written for: one love interest's own reader, or the love interests present. */
type Knowing = Pick<ForgeRecallOptions, "reader" | "cast">;

/**
 * Whether canon with this audience may reach the prompt beyond the overview. Shared canon (no audience) always may;
 * private canon only for its own love interest's reader, or a scene they are in. Naming neither is a scene with nobody
 * in it, as S/memory/memory.ts recalls. The kit's recall of a `chat` source follows the same rule.
 */
export function mayKnow({ reader, cast }: Knowing, audience: readonly string[] | undefined): boolean {
  if (!audience) return true;
  return reader ? audience.includes(reader) : audience.some((id) => (cast ?? []).includes(id));
}

/** Who a prompt is written for, and the storyline it continues (see the header). */
export type RecallTextOptions = Omit<ForgeRecallOptions, "runId"> & {
  debugMode?: boolean;
  /** "main" for the main story's plans and scenes, a love interest's id for his route and repair plans and scenes. */
  continues?: "main" | LiId;
  /**
   * For a prompt that caches its story context (see the header): only what every call of its chapter may know, with
   * `li` (his route, repair, date or story chapter) the chapter's own love interest's canon too; the rest, and the
   * recalls, as a context of their own (`recalls`) that the prompt sends after its cached part. Otherwise the recalls
   * follow the timeline.
   */
  cached?: { li?: LiId };
};

/** The story before a prompt: its memory context, and when `cached` the recalls' own (pass both to generateJson). */
export type StoryContext = ForgeMemoryContext & { recalls?: ForgeMemoryContext };

/** A block of the memory context's prefix, in story order. */
interface Block {
  order: number;
  text: string;
  /** What only some calls of a `cached` prompt's chapter may know: it goes with the recalls (see the header). */
  own?: boolean;
}

const byOrder = (a: Block, b: Block) => a.order - b.order;

/**
 * The timeline (the kit's overview, already rendered) and the recalls, newest first as the fitter drops them from the
 * end, told oldest first. Every block is trimmed, so the prompt's `memory.trim()` is the context's text exactly.
 */
const renderMemory = ({
  overview,
  details,
}: {
  overview: string;
  details: Array<{ title: string; content: string }>;
}) =>
  [
    overview.trim() ? `# Canon to date\n${overview.trim()}` : "",
    ...[...details].reverse().map((item) => `# Recalled memory: ${item.title}\n${item.content.trim()}`),
  ]
    .filter(Boolean)
    .join("\n\n");

const block = (heading: string, title: string, content: string) => `# ${heading}: ${title}\n${content.trim()}`;

/**
 * The previous chapter in full (see the header): the last completed chapter of the storyline the prompt continues, of
 * those it may know.
 */
function previousOf(known: readonly Completed[], continues: RecallTextOptions["continues"]): Completed | undefined {
  const chapters = known.filter(({ chapter }) => storyline(chapter));
  const main = () => chapters.filter(({ chapter }) => chapter.kind === "main").at(-1);
  if (continues === "main") return main();
  if (continues) {
    const his = chapters.filter(({ chapter, audience }) => chapter.kind !== "main" && audience?.[0] === continues);
    return his.at(-1) ?? main();
  }
  return chapters.at(-1);
}

/**
 * The memory context of these blocks in story order. Only `optional` (some of them, in the order they go) may be left
 * out by the fitter, and only while the reply would otherwise get less than its floor; every other block stays.
 */
function contextOf(
  result: Pick<ForgeRecallResult, "overview" | "details" | "maxContext">,
  blocks: Block[],
  optional: Block[],
): ForgeMemoryContext {
  const prefix = [...blocks]
    .sort(byOrder)
    .map((entry) => entry.text)
    .join("\n\n");
  return forgeMemoryContext(result, { prefix, optional: optional.map((entry) => entry.text), renderMemory });
}

/**
 * The story before a prompt, as the kit's memory context (see the header): the generation core fits it to the
 * connection (pass it as generateJson's `memory`, and its `text` to the prompt builder). Its text is "" when nothing is
 * completed yet; a failure is logged and never holds the story up: what could not be read is left out (a memory that
 * cannot be read counts as one with nothing saved).
 */
export async function recallText(
  deps: {
    store: Pick<OtomeStore, "readDoc">;
    memory?: StoryMemory;
    runtime?: Pick<CapabilityRuntimeHost, "logger">;
  },
  runId: string,
  options: RecallTextOptions,
): Promise<StoryContext> {
  const { debugMode, continues, cached, ...recall } = options;
  const warn = (what: string, error: unknown) =>
    deps.runtime?.logger.warn("[otome-forge] %s: %s", what, error instanceof Error ? error.message : String(error));
  const [story, saved] = await Promise.all([
    (async () => {
      const [state, player] = await Promise.all([
        deps.store.readDoc(stateId(runId), normalizeState),
        deps.store.readDoc(playerId(runId), normalizePlayer),
      ]);
      return {
        chapters: state ? await completedChapters(deps.store, runId, state) : [],
        protagonist: player?.name ?? "",
      };
    })().catch((error: unknown) => {
      warn("The story could not be read", error);
      return { chapters: [] as Completed[], protagonist: "" };
    }),
    // What the memory has saved, read as it is whatever the memory's phase (see the header).
    deps.store.readDoc(memoryId(runId), savedStory).catch((error: unknown) => {
      warn("The saved story memory could not be read", error);
      return null;
    }),
  ]);
  const { chapters, protagonist } = story;
  const known = chapters.filter(({ audience }) => mayKnow(recall, audience));
  // A `cached` prompt's own canon (see the header): a love interest's own chapter, unless it is the chapter's.
  const audiences = new Map(chapters.map(({ chapter, audience }) => [chapter, audience]));
  const own = (chapter: Chapter) => !!cached && !!audiences.get(chapter) && audiences.get(chapter)![0] !== cached.li;
  // The memory context of these blocks (contextOf); when `cached`, the own blocks go with the recalls, a context of
  // their own, and each part keeps its own newest summary (`summaries`, oldest first, may give way but for it).
  const storyContext = (
    result: Pick<ForgeRecallResult, "overview" | "details" | "maxContext">,
    blocks: Block[],
    optional: Block[],
    summaries: Block[] = [],
  ): StoryContext => {
    if (!cached) return contextOf(result, blocks, [...summaries.slice(0, -1), ...optional]);
    const mine = (entry: Block) => !!entry.own;
    const older = (list: Block[]) => list.slice(0, -1);
    const context = contextOf(
      { ...result, details: [] },
      blocks.filter((entry) => !mine(entry)),
      [...older(summaries.filter((entry) => !mine(entry))), ...optional.filter((entry) => !mine(entry))],
    );
    const recalls = contextOf(
      { overview: "", details: result.details, maxContext: result.maxContext },
      blocks.filter(mine),
      [...older(summaries.filter(mine)), ...optional.filter(mine)],
    );
    return recalls.text ? { ...context, recalls } : context;
  };
  const last = previousOf(known, continues);
  const lastScenes =
    (last &&
      (await chapterScenes(deps.store, runId, last.chapter.key, last.chapter.nodes.length, protagonist).catch(
        () => null,
      ))) ||
    [];
  // The previous chapter in full, a scene per block: its earliest scenes are the last of the memory to give way.
  const scenes = lastScenes.map((scene) => scene.trim()).filter(Boolean);
  const previous: Block[] =
    last && scenes.length
      ? [
          { order: last.order, text: `# Previous chapter in full: ${titleOf(last)}` },
          ...scenes.map((text) => ({ order: last.order, text })),
        ]
      : [];
  const previousKey = previous.length ? last!.chapter.key : undefined;
  const earliestScenes = previous.slice(1, -1);

  // The recall pool. Memory that fell behind catches up in the background; a failed summary waits for Retry.
  const memory = deps.memory;
  const result = memory
    ? await memory
        .recall({
          ...recall,
          runId,
          excludeChapterIds: [...(recall.excludeChapterIds ?? []), ...(previousKey ? [previousKey] : [])],
        })
        .then((recalled) => {
          const phase = recalled.status?.phase;
          const lagging = phase === "ready" ? recalled.lagging : phase === "stale" || phase === "pending";
          if (lagging) void Promise.resolve(memory.maintain({ runId, debugMode })).catch(() => undefined);
          return recalled;
        })
        .catch((error: unknown) => {
          warn("Story memory could not recall; the story goes on without its recalls", error);
          return null;
        })
    : null;
  // Every other chapter the prompt may know that the timeline does not cover, around the previous chapter in story
  // order: by its summary, or in full while it has none. Of these, the older storyline chapter summaries may give way,
  // then the chapters in full, each oldest first; the newest chapter summary stays, and so does every date's and
  // Character Story's (GF).
  const others: Block[] = [];
  const summaries: Block[] = [];
  const full: Block[] = [];
  for (const completed of known) {
    const { chapter, order } = completed;
    const key = JSON.stringify([kindOf(chapter), chapter.key]);
    if (chapter.key === previousKey || saved?.covered.has(key)) continue;
    const summary = saved?.summaries.get(key);
    const content = summary ?? (await chapterCanon(deps.store, runId, chapter, protagonist).catch(() => null))?.trim();
    if (!content) continue;
    const item: Block = {
      order,
      text: block(summary ? "Recent canon summary" : "Canon in full", titleOf(completed), content),
      ...(own(chapter) ? { own: true } : {}),
    };
    others.push(item);
    if (!summary) full.push(item);
    else if (storyline(chapter)) summaries.push(item);
  }
  // The timeline without the previous chapter's own entry: that chapter goes in full.
  const overview = renderTimeline(
    parseTimeline(saved?.timeline),
    previousKey ? JSON.stringify(["chapter", previousKey]) : undefined,
  );
  const recalls = (result?.recalls ?? [])
    .map(({ id, title, content }) => ({ id, kind: "recall", title, content }))
    .reverse();
  return storyContext(
    { overview, details: recalls, maxContext: result?.maxContext ?? null },
    [...previous, ...others],
    [...full, ...earliestScenes],
    summaries,
  );
}
