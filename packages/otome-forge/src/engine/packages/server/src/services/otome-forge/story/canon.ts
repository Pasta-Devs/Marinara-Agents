// ──────────────────────────────────────────────
// Otome Forge: first-play canon. What a beat says once its choices are made, the chapter so far, the story reader that
// hands completed chapters to the kit's memory (S/memory/sources.ts), and the story before a prompt (recallText)
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
//   main                        → kind "chapter", shared (the overview, the recent canon, recalled details)
//   route, repair, story, date  → kind "chat", audience [their love interest's id]
// A love interest's own chapter is the kit's `chat`, the one kind it keeps private everywhere: never in the overview
// or the recent canon, and a recalled detail only for that love interest's own reader or a scene they are in. Its title
// names whose it is and that it is private (titleOf), so a scene with others in it knows who else does not know it.
// Audience entries are plain LI ids, so recall's `cast` and `reader` are LI ids too. Care data is never a source.
//
// recallText gives every story prompt (P5, P6, and M2b's P10, P11, P12) and M3's chat reply (P17, as its love
// interest's own reader, on a smaller CanonBudget) the story before it whatever state the memory is in, so first play
// stays canon:
// - memory ready: the kit's overview and recalled details, the summaries it does not cover yet, the latest completed
//   chapter in full, and the private chapters the prompt may know in full, newest first, as the canonical history
//   sends them (the kit hears they are listed, so it ranks only older ones); the newest always goes in, its end when
//   a small budget cannot hold it whole (on both paths, when it is the newest canon before the latest chapter);
// - no memory, memory not ready (stale, pending, a failed summary, an unknown context) or a recall that fails: the
//   canonical history instead, GF's legacy history: the latest completed chapter in full and the canon before it, the
//   oldest left out first. Stale or pending memory catches up in the background; a failed one waits for Retry;
// - always: the irrevocable decisions, every big choice of a completed chapter (GF's continuity block), so a summary
//   that drops one never undoes it.
// The knowledge boundary (mayKnow, and the kit's `chat` audience): on both paths a love interest's route, repair, story
// or date chapter, its summary and its decisions reach only a prompt for their own reader or a scene they are in, never
// another love interest's scene, plan, note or chat reply. Main chapters stay shared.
// ponytail: a private chapter is never summarized (the kit keeps a `chat` as written); the ceiling is that only the
// newest fit in full and an older one is recalled whole or not at all. The upgrade path (R3) is a kit audience on
// `character-story` that the overview and the recent canon honour, so private chapters get summaries too.
import { forgeCanonicalSegments } from "@forge-kit/player-choices-server.mjs";
import { estimateTextTokens, sliceTextToTokenBudget } from "@forge-kit/shared-token-estimator.mjs";
import type { ForgeMemorySource, ForgeRecallOptions } from "@forge-kit/story-memory.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type {
  Beat,
  Chapter,
  RunState,
  Segment,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { STANCES } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
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

/** A Confrontation's canon: what was played, then its ending; null until it ends (unless it was eased off). */
function confrontationCanon(beat: Beat, protagonist: string): Segment[] | null {
  const confrontation = beat.confrontation!;
  const cut = beat.easedOff && !confrontation.ending ? beat.easedOff.at : undefined;
  const opening = cut !== undefined && !confrontation.picks.length ? beat.segments.slice(0, cut + 1) : beat.segments;
  const segments: Segment[] = [...opening];
  for (const [k, stance] of confrontation.picks.entries()) {
    const round = confrontation.rounds[k];
    const option = round?.options[stance];
    if (!round || !option || !STANCES.includes(stance)) break;
    segments.push(...round.his);
    segments.push({
      speaker: "",
      text: `[Canonical player stance${protagonist ? ` by ${protagonist}` : ""}, round ${k + 1} of the confrontation: ${stance}: ${option.label}]`,
    });
    segments.push({ speaker: option.selection.kind === "dialogue" ? protagonist : "", text: option.selection.text });
    segments.push(...option.segments);
  }
  if (confrontation.ending) return [...segments, ...confrontation.endings[confrontation.ending]];
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

/**
 * Every completed chapter of the run in story order: a main chapter at its number, any other kind just after the main
 * chapters completed before it.
 */
async function completedChapters(
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
    if (!chapter) continue;
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
 * The chapters as memory sources (their whole canon), in the order given; one not settled yet is left out. A private
 * chapter is a `chat` with its audience (see the header).
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
      kind: audience ? "chat" : "chapter",
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
 * Whether canon with this audience may reach the prompt. Shared canon (no audience) always may; private canon only for
 * its own love interest's reader, or a scene they are in. Naming neither is a scene with nobody in it, as
 * S/memory/memory.ts recalls. The kit's recall of a `chat` source follows the same rule.
 */
function mayKnow({ reader, cast }: Knowing, audience: readonly string[] | undefined): boolean {
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

/**
 * Every big choice of the completed chapters the prompt may know, in story order, with what the protagonist said or did;
 * "" when there are none. A big choice only ever ends a chapter (the kit's `terminal`), so each chapter's last beat is
 * the only one read; one eased off before its choice has none.
 * ponytail: a block of its own beside the recalled text; the upgrade path is the kit's forgeMemoryContext `fate` slot,
 * which keeps it whole while fitForgeMemoryPrompt trims the rest.
 */
async function decisionsText(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  chapters: readonly Completed[],
  knowing: Knowing,
): Promise<string> {
  const lines: string[] = [];
  for (const completed of chapters) {
    const { chapter } = completed;
    if (!chapter.nodes.length || !mayKnow(knowing, audienceOf(chapter))) continue;
    const beat = await readBeat(store, runId, chapter.key, chapter.nodes.length - 1);
    if (!beat) continue;
    const cut = beat.easedOff?.at ?? Infinity;
    for (const choice of beat.choices) {
      if (choice.kind !== "big" || choice.at > cut) continue;
      const option = choice.options.find((item) => item.id === beat.choiceCanon[choice.id]);
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
 * The latest completed chapter goes in whole, as the kit expects of its caller: nine nodes at the narrator's word cap
 * fit; a longer one keeps its end.
 */
const LATEST_CHAPTER_TOKENS = 12000;
/** The canon before the latest chapter that the canonical history sends, newest first: the oldest is left out first. */
const EARLIER_CANON_TOKENS = 12000;

/**
 * How much canon a prompt reads in full: the latest chapter's end, and the canon before it when memory cannot answer.
 * The story prompts read the defaults; a smaller prompt (P17's chat reply) passes less. Recalled memory and the
 * decisions are never cut by it: the kit sizes recall to the connection's context.
 */
export interface CanonBudget {
  latest: number;
  earlier: number;
}

const STORY_BUDGET: CanonBudget = { latest: LATEST_CHAPTER_TOKENS, earlier: EARLIER_CANON_TOKENS };

const latestBlock = (title: string, content: string, tokens: number) =>
  `# Latest chapter: ${title}\n${sliceTextToTokenBudget(content, tokens, true)}`;

/** A source as shown: in full, or (the newest private chapter on a small budget) its end. */
const canonBlock = (source: ForgeMemorySource, content: string) =>
  `# ${content === source.content ? "Canon in full" : "The end of"}: ${source.title}\n${content}`;

/**
 * The newest of these sources that fit `budget.earlier` together, so the oldest is left out first, each with the text
 * shown. The newest goes in even when it does not fit, if it is a private chapter: its end within `budget.latest`, as
 * the latest chapter's, so a small budget (P17's) still reads the scene its love interest just played.
 */
function newestWithin(sources: readonly ForgeMemorySource[], budget: CanonBudget): Map<ForgeMemorySource, string> {
  const kept = new Map<ForgeMemorySource, string>();
  let used = 0;
  for (const source of [...sources].reverse()) {
    used += estimateTextTokens(source.content);
    if (used > budget.earlier) {
      if (!kept.size && source.kind === "chat") {
        kept.set(source, sliceTextToTokenBudget(source.content, budget.latest, true));
      }
      break;
    }
    kept.set(source, source.content);
  }
  return kept;
}

/**
 * The canonical history, for a memory that cannot answer: the canon the prompt may know in story order, the latest
 * completed chapter in full and the canon before it within `budget.earlier`, newest first (GF's legacy history).
 * ponytail: fixed budgets, then model.fitContext; the upgrade path is fitForgeMemoryPrompt with the connection's
 * context, which drops the oldest chapters only while the reply would otherwise get less than its floor.
 */
async function canonicalHistory(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  chapters: readonly Completed[],
  protagonist: string,
  knowing: Knowing,
  budget: CanonBudget,
): Promise<string> {
  const known = chapters.filter(({ chapter }) => mayKnow(knowing, audienceOf(chapter)));
  const sources = await sourcesOf(store, runId, known, protagonist);
  const latest = sources.filter((source) => source.kind === "chapter").at(-1);
  const kept = newestWithin(
    sources.filter((source) => source !== latest),
    budget,
  );
  return sources
    .filter((source) => source === latest || kept.has(source))
    .map((source) =>
      source === latest
        ? latestBlock(source.title, source.content, budget.latest)
        : canonBlock(source, kept.get(source)!),
    )
    .join("\n\n");
}

/**
 * The story before a prompt, as text (see the header): recalled memory when it is ready, else the canonical history,
 * then the irrevocable decisions. "" when nothing is completed yet; a failure is logged and never holds the story up.
 * ponytail: plain text fitted by model.fitContext; the upgrade path is the kit's forgeMemoryContext with
 * fitForgeMemoryPrompt in the generation core, which drops recalled details before trimming anything else.
 */
export async function recallText(
  deps: {
    store: Pick<OtomeStore, "readDoc">;
    memory?: StoryMemory;
    runtime?: Pick<CapabilityRuntimeHost, "logger">;
  },
  runId: string,
  options: Omit<ForgeRecallOptions, "runId"> & { debugMode?: boolean; budget?: CanonBudget },
): Promise<string> {
  const { debugMode, budget = STORY_BUDGET, ...recall } = options;
  const warn = (what: string, error: unknown) =>
    deps.runtime?.logger.warn("[otome-forge] %s: %s", what, error instanceof Error ? error.message : String(error));
  let story: Promise<{ chapters: Completed[]; protagonist: string }> | undefined;
  const readStory = () =>
    (story ??= (async () => {
      const [state, player] = await Promise.all([
        deps.store.readDoc(stateId(runId), normalizeState),
        deps.store.readDoc(playerId(runId), normalizePlayer),
      ]);
      return {
        chapters: state ? await completedChapters(deps.store, runId, state) : [],
        protagonist: player?.name ?? "",
      };
    })());

  const recalled = async (memory: StoryMemory): Promise<string | null> => {
    const { chapters, protagonist } = await readStory();
    // The private chapters this prompt may know go in full, newest first, as the canonical history sends them. The kit
    // hears they are listed, so it ranks only older ones, and never another love interest's (they are its `chat`).
    const own = await sourcesOf(
      deps.store,
      runId,
      chapters.filter(({ chapter }) => chapter.kind !== "main" && mayKnow(recall, audienceOf(chapter))),
      protagonist,
    );
    const shown = newestWithin(own, budget);
    const result = await memory.recall({
      ...recall,
      runId,
      listed: [...(recall.listed ?? []), ...[...shown.keys()].map((source) => source.id)],
    });
    const phase = result.status?.phase;
    // Memory that fell behind catches up in the background; a failed summary or an unknown context waits for Retry.
    const lagging = phase === "ready" ? result.lagging : phase === "stale" || phase === "pending";
    if (lagging) void Promise.resolve(memory.maintain({ runId, debugMode })).catch(() => undefined);
    if (phase !== "ready") return null;
    // In story order: the recent canon the kit requires (the latest chapter among it), and the private chapters shown.
    const orders = new Map(chapters.map(({ chapter, order }) => [chapter.key, order]));
    const parts = own
      .filter((source) => shown.has(source))
      .map((source) => ({ order: source.order, text: canonBlock(source, shown.get(source)!) }));
    let order = -Infinity;
    for (const entry of result.recent ?? []) {
      order = orders.get(entry.id) ?? order;
      if (entry.latest) {
        const chapter = await readChapter(deps.store, runId, entry.id);
        const content = chapter && (await chapterCanon(deps.store, runId, chapter, protagonist));
        if (content) parts.push({ order, text: latestBlock(entry.title, content, budget.latest) });
      } else if (entry.content) {
        parts.push({ order, text: `# Recent canon: ${entry.title}\n${entry.content}` });
      }
    }
    parts.sort((a, b) => a.order - b.order);
    return [result.text, ...parts.map((part) => part.text)].filter((part) => part?.trim()).join("\n\n");
  };

  let memory: string | null = null;
  if (deps.memory) {
    memory = await recalled(deps.memory).catch((error: unknown) => {
      warn("Story memory unavailable; using the canonical history", error);
      return null;
    });
  }
  memory ??= await readStory()
    .then(({ chapters, protagonist }) => canonicalHistory(deps.store, runId, chapters, protagonist, recall, budget))
    .catch((error: unknown) => {
      warn("The canonical history could not be read", error);
      return "";
    });
  const decisions = await readStory()
    .then(({ chapters }) => decisionsText(deps.store, runId, chapters, recall))
    .catch((error: unknown) => {
      warn("The saved decisions could not be read", error);
      return "";
    });
  return [memory, decisions].filter((part) => part.trim()).join("\n\n");
}
