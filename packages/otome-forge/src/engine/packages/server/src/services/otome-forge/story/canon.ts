// ──────────────────────────────────────────────
// Otome Forge: first-play canon. What a beat says once its choices are made, the chapter so far, the story reader that
// hands completed chapters to the kit's memory (S/memory/sources.ts), and the story before a prompt (recallText)
// ──────────────────────────────────────────────
// A beat's canon is the kit's forgeCanonicalSegments: the mainline with each first-play pick's marker, selection and
// branch spliced in, and nothing while a big choice waits. A beat the player eased off is cut at that segment and ends
// on EASE_OFF_MARKER, so every later prompt continues from the aftermath without depicting it. Replays never change
// canon: picks are written once (S/story/beats.ts).
//
// Memory sources are completed chapters only (the kit's "completed, first-canon snapshots"):
//   main                  → kind "chapter" (the shared overview)
//   route, repair, story  → kind "character-story", audience [his id]
//   date                  → kind "chat", audience [his id] (only his own readers and scenes he is in recall it)
// Audience entries are plain LI ids, so recall's `cast` and `reader` are LI ids too. Care data is never a source.
//
// recallText gives P5 and P6 the story before them whatever state the memory is in, so first play stays canon:
// - memory ready: the kit's overview and recalled details, the summaries it does not cover yet, and the latest
//   completed chapter in full;
// - no memory, memory not ready (stale, pending, a failed summary, an unknown context) or a recall that fails: the
//   canonical history instead, GF's legacy history: the latest completed chapter in full and the canon before it, the
//   oldest left out first. Stale or pending memory catches up in the background; a failed one waits for Retry;
// - always: the irrevocable decisions, every big choice of a completed chapter (GF's continuity block), so a summary
//   that drops one never undoes it.
// Both paths keep the knowledge boundary: a chapter with an audience reaches only its own love interest's reader, or
// a scene he is in.
import { forgeCanonicalSegments } from "@forge-kit/player-choices-server.mjs";
import { estimateTextTokens, sliceTextToTokenBudget } from "@forge-kit/shared-token-estimator.mjs";
import type { ForgeMemorySource, ForgeRecallOptions } from "@forge-kit/story-memory.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type {
  Beat,
  Chapter,
  ChapterKind,
  RunState,
  Segment,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { beatId, chapterId, playerId, stateId } from "../ids.js";
import type { OtomeMemory } from "../memory/memory.js";
import { normalizePlayer } from "../schemas/player.js";
import { normalizeState } from "../schemas/state.js";
import { normalizeBeat, normalizeChapter } from "../schemas/story.js";
import type { OtomeStore } from "../store.js";

/** Closes an eased-off beat's canon (plan M2a: Ease off). The reader shows its own aftermath line instead. */
export const EASE_OFF_MARKER =
  "[The scene was cut short by the player. Continue from its aftermath without depicting it.]";

/** A beat's first-play canon, or null while a big choice waits for its pick. */
export function canonicalSegments(beat: Beat, protagonist: string): Segment[] | null {
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

const MEMORY_KIND: Record<ChapterKind, ForgeMemorySource["kind"]> = {
  main: "chapter",
  route: "character-story",
  repair: "character-story",
  story: "character-story",
  date: "chat",
};

/** The chapter's whole canon, or null while any beat is missing or unsettled. */
async function chapterCanon(store: Pick<OtomeStore, "readDoc">, runId: string, chapter: Chapter, protagonist: string) {
  return chapterSoFar(store, runId, chapter.key, chapter.nodes.length, protagonist);
}

/** A completed chapter and its place in the story. */
interface Completed {
  chapter: Chapter;
  order: number;
}

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
  const chapters: Completed[] = [];
  for (const { key, completed } of done) {
    const chapter = await readChapter(store, runId, key);
    if (!chapter) continue;
    chapters.push({
      chapter,
      order:
        chapter.kind === "main" && chapter.number
          ? chapter.number * 10000
          : mainDone(completed) * 10000 + 5000 + (Date.parse(completed) || 0) / 1e13,
    });
  }
  return chapters.sort((a, b) => a.order - b.order || a.chapter.key.localeCompare(b.chapter.key));
}

/** Who may know a chapter: anyone for a main chapter, only its own love interest for any other kind. */
const audienceOf = (chapter: Chapter): string[] | undefined =>
  chapter.kind === "main" ? undefined : [chapter.li ?? chapter.lead];

/** The chapters as memory sources (their whole canon), in the order given; one not settled yet is left out. */
async function sourcesOf(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  chapters: readonly Completed[],
  protagonist: string,
): Promise<ForgeMemorySource[]> {
  const sources: ForgeMemorySource[] = [];
  for (const { chapter, order } of chapters) {
    const content = await chapterCanon(store, runId, chapter, protagonist);
    if (!content?.trim()) continue;
    const audience = audienceOf(chapter);
    sources.push({
      id: chapter.key,
      kind: MEMORY_KIND[chapter.kind],
      title: chapter.title || chapter.key,
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
 * its own love interest's reader, or a scene he is in. Naming neither is a scene with nobody in it, as S/memory/memory.ts
 * recalls. At least as strict as the kit's recall, which also shares a Character Story through the overview.
 */
function mayKnow({ reader, cast }: Knowing, audience: readonly string[] | undefined): boolean {
  if (!audience) return true;
  return reader ? audience.includes(reader) : audience.some((id) => (cast ?? []).includes(id));
}

/** Heads the decisions block in every story prompt (GF's continuity wording). */
export const DECISIONS_HEADING =
  "# Irrevocable player decisions (saved canon; preserve these even when a summary omits them)";

const chapterName = (chapter: Chapter) =>
  chapter.kind === "main"
    ? `Chapter ${chapter.number ?? ""} "${chapter.title}"`
    : `${chapter.kind[0]!.toUpperCase()}${chapter.kind.slice(1)} chapter "${chapter.title}"`;

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
  for (const { chapter } of chapters) {
    if (!chapter.nodes.length || !mayKnow(knowing, audienceOf(chapter))) continue;
    const beat = await readBeat(store, runId, chapter.key, chapter.nodes.length - 1);
    if (!beat) continue;
    const cut = beat.easedOff?.at ?? Infinity;
    for (const choice of beat.choices) {
      if (choice.kind !== "big" || choice.at > cut) continue;
      const option = choice.options.find((item) => item.id === beat.choiceCanon[choice.id]);
      if (option) {
        lines.push(
          `- ${chapterName(chapter)}, node ${beat.i + 1}: ${option.text} (${option.selection.kind}: ${option.selection.text})`,
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

const latestBlock = (title: string, content: string) =>
  `# Latest chapter: ${title}\n${sliceTextToTokenBudget(content, LATEST_CHAPTER_TOKENS, true)}`;

/**
 * The canonical history, for a memory that cannot answer: the canon the prompt may know in story order, the latest
 * completed chapter in full and the canon before it within EARLIER_CANON_TOKENS, newest first (GF's legacy history).
 * ponytail: fixed budgets, then model.fitContext; the upgrade path is fitForgeMemoryPrompt with the connection's
 * context, which drops the oldest chapters only while the reply would otherwise get less than its floor.
 */
async function canonicalHistory(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  chapters: readonly Completed[],
  protagonist: string,
  knowing: Knowing,
): Promise<string> {
  const known = chapters.filter(({ chapter }) => mayKnow(knowing, audienceOf(chapter)));
  const sources = await sourcesOf(store, runId, known, protagonist);
  const latest = sources.filter((source) => source.kind === "chapter").at(-1);
  const kept = new Set(latest ? [latest] : []);
  let used = 0;
  for (const source of [...sources].reverse()) {
    if (source === latest) continue;
    used += estimateTextTokens(source.content);
    if (used > EARLIER_CANON_TOKENS) break;
    kept.add(source);
  }
  return sources
    .filter((source) => kept.has(source))
    .map((source) =>
      source === latest
        ? latestBlock(source.title, source.content)
        : `# Canon in full: ${source.title}\n${source.content}`,
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
  options: Omit<ForgeRecallOptions, "runId"> & { debugMode?: boolean },
): Promise<string> {
  const { debugMode, ...recall } = options;
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
    const result = await memory.recall({ ...recall, runId });
    const phase = result.status?.phase;
    // Memory that fell behind catches up in the background; a failed summary or an unknown context waits for Retry.
    const lagging = phase === "ready" ? result.lagging : phase === "stale" || phase === "pending";
    if (lagging) void Promise.resolve(memory.maintain({ runId, debugMode })).catch(() => undefined);
    if (phase !== "ready") return null;
    const { protagonist } = await readStory();
    const parts: string[] = [];
    for (const entry of result.recent ?? []) {
      if (entry.latest) {
        const chapter = await readChapter(deps.store, runId, entry.id);
        const content = chapter && (await chapterCanon(deps.store, runId, chapter, protagonist));
        if (content) parts.push(latestBlock(entry.title, content));
      } else if (entry.content) {
        parts.push(`# Recent canon: ${entry.title}\n${entry.content}`);
      }
    }
    return [result.text, ...parts].filter((part) => part?.trim()).join("\n\n");
  };

  let memory: string | null = null;
  if (deps.memory) {
    memory = await recalled(deps.memory).catch((error: unknown) => {
      warn("Story memory unavailable; using the canonical history", error);
      return null;
    });
  }
  memory ??= await readStory()
    .then(({ chapters, protagonist }) => canonicalHistory(deps.store, runId, chapters, protagonist, recall))
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
