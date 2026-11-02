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
//   main, route, repair      → kind "chapter": the story's own storylines, recalled in the chapter lane
//   date, story              → kind "character-story": a love interest's date, or a Memory's Character Story or
//                              Moment (GF's bond chapter), recalled as a side memory
//   an extra story (#2025)   → none: it is imagined together for fun, never canon
// The kit summarizes each one and folds every one into the shared overview, so every prompt knows the whole timeline,
// as GF's overview holds its Character Stories (0.6.17; before it a love interest's own chapter was a `chat`, kept as
// written and out of the overview, so long routes lost their history). Every chapter but a main one has audience [its
// love interest's id]: its summary as a recalled detail, as recent canon and in full reaches only a prompt for his own
// reader or a scene he is in (S/memory/memory.ts lists the others out of the kit's ranking, mayKnow here), and so do
// its decisions. Another love interest knows it only through the overview, where its title (titleOf) names whose it
// is and that it is private, and the knowledge boundary keeps him from claiming he was there. Audience entries are
// plain LI ids, so recall's `cast` and `reader` are LI ids too. Care data is never a source.
//
// recallText gives every story prompt (P5, P6, P10, P11, P12, the date, Character Story, extra story and banner plans)
// and the chat reply (P17, as its love interest's own reader) the story before it, whatever state the memory is in, as
// the kit's memory context (forgeMemoryContext), which the generation core fits to the connection (S/generation.ts):
// - the previous chapter in full (GF's "# Previous chapter in full"): the last completed chapter of the storyline the
//   prompt continues (`continues`): the main story's for its plans and its scenes; a love interest's own route and
//   repair chapters for his plans and their scenes (the main story's while he has none); and otherwise the newest
//   main, route or repair chapter the prompt may know. Only what was played: each first-play pick with its branch,
//   never an option not taken (forgeCanonicalSegments, confrontationCanon);
// - memory ready: the kit's overview and recalled details (up to 3 chapters and 3 side memories, Read Me among them),
//   and around the previous chapter, in story order, the canon the overview does not cover yet as its summary (a date
//   or Character Story as written while it has none). The details give way first when the prompt does not fit; then,
//   only while the reply would get less than its floor, the older storyline chapter summaries, oldest first. As in
//   GF, the newest chapter summary and every date and Character Story always stay;
// - no memory, memory not ready (stale, pending, a failed summary, an unknown context) or a recall that fails: the
//   canonical history instead, GF's legacy history: the previous chapter in full and the other chapters the prompt may
//   know, newest first within EARLIER_CANON_TOKENS, each whole (the newest one however long). The previous chapter and
//   everything after it always stay; the canon before it gives way at the reply floor, its storyline chapters first,
//   then dates and Character Stories, each oldest first. Stale or pending memory catches up in the background; a
//   failed one waits for Retry;
// - always: the irrevocable decisions, every big choice of a completed chapter the prompt may know (GF's locked
//   decisions, the context's `fate`), and every side-with pick (#2046: whom the protagonist backed, over whom), so a
//   summary that drops one never undoes it.
import { forgeCanonicalSegments } from "@forge-kit/player-choices-server.mjs";
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";
import { forgeMemoryContext, type ForgeMemoryContext } from "@forge-kit/story-memory-fit.mjs";
import {
  forgeStoryMemoryText,
  type ForgeMemorySource,
  type ForgeRecallOptions,
  type ForgeRecallResult,
} from "@forge-kit/story-memory.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type {
  Beat,
  Chapter,
  ForgeChoice,
  LiId,
  RunState,
  Segment,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { CLIMAX_MOVES, climaxOf } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { beatId, chapterId, playerId, stateId, unitId } from "../ids.js";
import type { OtomeMemory } from "../memory/memory.js";
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
 * The chapter's canon before node `before`, rendered; null when an earlier beat is missing or waits for a big choice
 * (nothing may be written on top of an unsettled past).
 */
export async function chapterSoFar(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  key: string,
  before: number,
  protagonist: string,
): Promise<string | null> {
  const parts: string[] = [];
  for (let i = 0; i < before; i += 1) {
    const beat = await readBeat(store, runId, key, i);
    const segments = beat && canonicalSegments(beat, protagonist);
    if (!segments) return null;
    parts.push(renderSegments(segments));
  }
  return parts.join("\n\n");
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
}

/** Who may know a chapter: anyone for a main chapter, only its own love interest for any other kind. */
const audienceOf = (chapter: Chapter): string[] | undefined =>
  chapter.kind === "main" ? undefined : [chapter.li ?? chapter.lead];

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
  const chapters: Completed[] = [];
  for (const { key, completed } of done) {
    const chapter = await readChapter(store, runId, key);
    // The prologue is no memory source: no love interest was there, and chapter 1's first scene is given it directly.
    // An extra story (#2025) is none either: it is imagined together for fun, and never canon.
    if (!chapter || chapter.kind === "prologue" || chapter.prestige) continue;
    const audience = audienceOf(chapter);
    chapters.push({
      chapter,
      order:
        chapter.kind === "main" && chapter.number
          ? chapter.number * 10000
          : mainDone(completed) * 10000 + 5000 + (Date.parse(completed) || 0) / 1e13,
      ...(audience ? { owner: (await nameOf(audience[0]!)) || "a love interest" } : {}),
    });
  }
  return chapters.sort((a, b) => a.order - b.order || a.chapter.key.localeCompare(b.chapter.key));
}

/**
 * A chapter's title as the story names it: a love interest's own chapter says whose it is and that it is private, on
 * every path (in full, the kit's recalled detail, the decisions), so a scene with others in it keeps the knowledge
 * boundary: nobody else knows what happened there.
 */
function titleOf({ chapter, owner }: Completed): string {
  const title = chapter.title || chapter.key;
  return owner === undefined
    ? title
    : `${owner}'s own ${chapter.kind} chapter "${title}" (private: only the people in its scenes know what happened in it)`;
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
    const { chapter, order } = completed;
    const content = await chapterCanon(store, runId, chapter, protagonist);
    if (!content?.trim()) continue;
    const audience = audienceOf(chapter);
    sources.push({
      id: chapter.key,
      kind: kindOf(chapter),
      title: titleOf(completed),
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

/** Heads the decisions block in every story prompt (GF's continuity wording). */
export const DECISIONS_HEADING =
  "# Irrevocable player decisions (saved canon; preserve these even when a summary omits them)";

const chapterName = (completed: Completed) =>
  completed.chapter.kind === "main"
    ? `Chapter ${completed.chapter.number ?? ""} "${completed.chapter.title}"`
    : titleOf(completed);

/** The option first play picked for `choice`, while it is in the beat's canon (at or before an Ease off cut). */
const pickedIn = (beat: Beat, choice: ForgeChoice) =>
  choice.at > (beat.easedOff?.at ?? Infinity)
    ? undefined
    : choice.options.find((item) => item.id === beat.choiceCanon[choice.id]);

/** "Sol", "Sol and Mireille", "Sol, Mireille and Ash". */
const andList = (names: readonly string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");

/**
 * Every big choice of the completed chapters the prompt may know, in story order, with what the protagonist said or did;
 * "" when there are none. A big choice only ever ends a chapter (the kit's `terminal`), so each chapter's last beat is
 * the only one read; one eased off before its choice has none. #2046: a side-with pick is a small choice, so it is read
 * from its own node's beat, and named with whom it backed over whom. The memory context's `fate`: it always stays whole.
 */
async function decisionsText(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  chapters: readonly Completed[],
  knowing: Knowing,
): Promise<string> {
  const lines: string[] = [];
  const nameOf = async (li: LiId) => (await store.readDoc(unitId(runId, li), normalizeUnit))?.name || li;
  for (const completed of chapters) {
    const { chapter } = completed;
    if (!chapter.nodes.length || !mayKnow(knowing, audienceOf(chapter))) continue;
    const sideNode = chapter.nodes.find((node) => node.sideWith);
    const side = sideNode ? await readBeat(store, runId, chapter.key, sideNode.i) : null;
    const sideChoice = side?.choices.find((choice) => choice.id === side.sideWith?.choice);
    const sided = side && sideChoice ? pickedIn(side, sideChoice) : undefined;
    const backed = sided && side?.sideWith?.backs[sided.id];
    if (side && sided && backed) {
      const over = Object.values(side.sideWith!.backs).filter((li) => li !== backed);
      lines.push(
        `- ${chapterName(completed)}, node ${side.i + 1}: sided with ${await nameOf(backed)} over ${andList(await Promise.all(over.map(nameOf)))}: ${sided.text} (${sided.selection.kind}: ${sided.selection.text})`,
      );
    }
    const beat = await readBeat(store, runId, chapter.key, chapter.nodes.length - 1);
    if (!beat) continue;
    for (const choice of beat.choices) {
      if (choice.kind !== "big") continue;
      const option = pickedIn(beat, choice);
      if (option) {
        lines.push(
          `- ${chapterName(completed)}, node ${beat.i + 1}: ${option.text} (${option.selection.kind}: ${option.selection.text})`,
        );
      }
    }
  }
  return lines.length ? `${DECISIONS_HEADING}\n${lines.join("\n")}` : "";
}

/**
 * The other canon the canonical history sends besides the previous chapter, newest first, each chapter whole: the
 * bound of a memory that cannot answer (rule 7), as GF's legacy history.
 * ponytail: a fixed bound, whatever the model's window; the fitter still leaves out what came before the previous
 * chapter at the reply floor.
 * The upgrade path is sizing it to the connection's context, as recall's own budget is.
 */
const EARLIER_CANON_TOKENS = 12000;

/** Who a prompt is written for, and the storyline it continues (see the header). */
export type RecallTextOptions = Omit<ForgeRecallOptions, "runId"> & {
  debugMode?: boolean;
  /** "main" for the main story's plans and scenes, a love interest's id for his route and repair plans and scenes. */
  continues?: "main" | LiId;
};

/** A block of the memory context's prefix, in story order. */
interface Block {
  order: number;
  text: string;
  /** A storyline chapter's (main, route, repair), not a date's or Character Story's. */
  chapter?: boolean;
}

const byOrder = (a: Block, b: Block) => a.order - b.order;

/** The kit's text with every block trimmed, so the prompt's `memory.trim()` is the context's text exactly. */
const renderMemory = (memory: Parameters<typeof forgeStoryMemoryText>[0]) => forgeStoryMemoryText(memory).trim();

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
    const his = chapters.filter(({ chapter }) => chapter.kind !== "main" && audienceOf(chapter)?.[0] === continues);
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
  fate: string,
): ForgeMemoryContext {
  const prefix = [...blocks]
    .sort(byOrder)
    .map((entry) => entry.text)
    .join("\n\n");
  return forgeMemoryContext(result, { prefix, fate, optional: optional.map((entry) => entry.text), renderMemory });
}

/**
 * The canonical history, for a memory that cannot answer (GF's legacy history): besides the previous chapter in full,
 * the other chapters the prompt may know, newest first within EARLIER_CANON_TOKENS, each whole; the newest of them
 * however long, as it is the one a prompt most needs.
 */
async function canonicalHistory(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  known: readonly Completed[],
  previousKey: string | undefined,
  protagonist: string,
): Promise<Block[]> {
  const kept: Block[] = [];
  let used = 0;
  for (const completed of [...known].reverse()) {
    if (completed.chapter.key === previousKey) continue;
    const content = await chapterCanon(store, runId, completed.chapter, protagonist);
    if (!content?.trim()) continue;
    const text = block("Canon in full", titleOf(completed), content);
    used += estimateTextTokens(text);
    if (used > EARLIER_CANON_TOKENS && kept.length) break;
    kept.push({ order: completed.order, text, chapter: storyline(completed.chapter) });
  }
  return kept;
}

/**
 * The story before a prompt, as the kit's memory context (see the header): the generation core fits it to the
 * connection (pass it as generateJson's `memory`, and its `text` to the prompt builder). Its text is "" when nothing is
 * completed yet; a failure is logged and never holds the story up.
 */
export async function recallText(
  deps: {
    store: Pick<OtomeStore, "readDoc">;
    memory?: StoryMemory;
    runtime?: Pick<CapabilityRuntimeHost, "logger">;
  },
  runId: string,
  options: RecallTextOptions,
): Promise<ForgeMemoryContext> {
  const { debugMode, continues, ...recall } = options;
  const warn = (what: string, error: unknown) =>
    deps.runtime?.logger.warn("[otome-forge] %s: %s", what, error instanceof Error ? error.message : String(error));
  const story = await (async () => {
    const [state, player] = await Promise.all([
      deps.store.readDoc(stateId(runId), normalizeState),
      deps.store.readDoc(playerId(runId), normalizePlayer),
    ]);
    return {
      chapters: state ? await completedChapters(deps.store, runId, state) : [],
      protagonist: player?.name ?? "",
    };
  })().catch((error: unknown) => {
    warn("The canonical history could not be read", error);
    return { chapters: [] as Completed[], protagonist: "" };
  });
  const { chapters, protagonist } = story;
  const known = chapters.filter(({ chapter }) => mayKnow(recall, audienceOf(chapter)));
  const last = previousOf(known, continues);
  const lastContent = last && (await chapterCanon(deps.store, runId, last.chapter, protagonist).catch(() => null));
  const previous: Block | null =
    last && lastContent?.trim()
      ? { order: last.order, text: block("Previous chapter in full", titleOf(last), lastContent) }
      : null;
  const previousKey = previous ? last!.chapter.key : undefined;
  const fate = await decisionsText(deps.store, runId, chapters, recall).catch((error: unknown) => {
    warn("The saved decisions could not be read", error);
    return "";
  });

  const recalled = async (memory: StoryMemory): Promise<ForgeMemoryContext | null> => {
    const result = await memory.recall({
      ...recall,
      runId,
      excludeChapterIds: [...(recall.excludeChapterIds ?? []), ...(previousKey ? [previousKey] : [])],
    });
    const phase = result.status?.phase;
    // Memory that fell behind catches up in the background; a failed summary or an unknown context waits for Retry.
    const lagging = phase === "ready" ? result.lagging : phase === "stale" || phase === "pending";
    if (lagging) void Promise.resolve(memory.maintain({ runId, debugMode })).catch(() => undefined);
    if (phase !== "ready") return null;
    // The canon the overview does not cover yet (S/memory/memory.ts keeps only what this prompt may know), around the
    // previous chapter in story order: its summary, or as written while it has none.
    const orders = new Map(chapters.map(({ chapter, order }) => [chapter.key, order]));
    const others: Block[] = [];
    // GF: of these, only the older storyline chapter summaries may give way, oldest first; the newest stays, and so
    // does every date and Character Story.
    const summaries: Block[] = [];
    let order = -Infinity;
    for (const entry of result.recent ?? []) {
      order = orders.get(entry.id) ?? order;
      if (entry.id === previousKey || !entry.content?.trim()) continue;
      const item = {
        order,
        text: block(entry.summary ? "Recent canon summary" : "Recent canon in full", entry.title, entry.content),
      };
      others.push(item);
      if (entry.summary && entry.kind === "chapter") summaries.push(item);
    }
    summaries.sort(byOrder);
    return contextOf(result, [...(previous ? [previous] : []), ...others], summaries.slice(0, -1), fate);
  };

  if (deps.memory) {
    const memory = deps.memory;
    const context = await recalled(memory).catch((error: unknown) => {
      warn("Story memory unavailable; using the canonical history", error);
      return null;
    });
    if (context) return context;
  }
  const history = await canonicalHistory(deps.store, runId, known, previousKey, protagonist).catch((error: unknown) => {
    warn("The canonical history could not be read", error);
    return [] as Block[];
  });
  // GF's legacy history: the previous chapter and everything after it stay; the canon before it may give way, its
  // storyline chapters first, then dates and Character Stories, each oldest first. With no previous chapter all stays.
  const before = previous
    ? history
        .filter((entry) => entry.order < previous.order)
        .sort((a, b) => Number(!a.chapter) - Number(!b.chapter) || byOrder(a, b))
    : [];
  return contextOf(
    { overview: "", details: [], maxContext: null },
    [...(previous ? [previous] : []), ...history],
    before,
    fate,
  );
}
