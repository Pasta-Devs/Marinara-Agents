// ──────────────────────────────────────────────
// Otome Forge: private story memory (plan M2a "Memory", design: Private memory)
// ──────────────────────────────────────────────
// The kit's createForgeStoryMemory, wired to Otome's documents and generation core:
// - `${R}:memory` holds the kit's store (records, overview, checkpoints, status), revision-checked. A write for a run
//   that no longer exists is refused, and one that lands just after the run's delete is removed again.
// - Sources come from S/memory/sources.ts. Every chapter is summarized and folded into the shared overview
//   (S/story/canon.ts: main, route and repair chapters are the kit's `chapter`, dates and Character Stories its
//   `character-story`). A love interest's own source (audience [li]) reaches a prompt beyond the overview, as a recall
//   or recent canon, only for that love interest's own reader or a scene whose cast includes them. A `chat` (a phone
//   session, a Snapshot, a Read Him set, a Claw round) stays out of the overview. Recall always says who is present: a
//   call that names neither `cast` nor `reader` recalls as a scene with nobody in it, so no private source can reach it
//   by omission. Care data is never a source.
// - Recent canon (what the overview does not cover yet) is GF's: the newest chapter stands for the caller's previous
//   chapter in full, or, when that is another one, comes as its summary until the overview covers it; a date or
//   Character Story goes in as written only while it is the one newest without a summary, else recall answers
//   "not ready" and the caller sends the bounded canonical history (S/story/canon.ts).
// - Read Me (S/minigames/read-me.ts) is never a source: what the notebook holds beyond knowsAboutYou's newest entries
//   joins the recall pool live on each recall (S/prompts.ts notebookMemories), so a deleted entry never comes back.
// - Summaries run on job `compress` on the background lane. `maintain` queues one job per run on the background
//   queue, which holds the compress connection's background admission slot for the whole job (generateJson with lane
//   "background"); a second call while it waits or runs makes the job go round once more. Every summary prompt ends its
//   system message with the `summary` content contract and SUMMARY_WORDING, an overview fold's with OVERVIEW_WORDING
//   too: the overview is the story's timeline told as a recollection, which "What happened so far…" shows as written
//   (0.6.19). An overview saved before that is read as none, so the next maintenance folds it again (OVERVIEW_STYLE).
//   The knowledge boundary is left out: the summarizer writes no character's words (plan §1.7).
// - #2066, the timeline: the kit's overview is the story's timeline (S/memory/timeline.ts). Each chapter's summary
//   (the kit's detail record, written once, at most 500 words by its prompt) is appended to it as it is folded in,
//   with no model call; only once the timeline crosses 10k tokens is everything but the newest entry condensed into
//   at most 3000 words (one call), and appending goes on. Its size never follows the model's context: the kit is
//   given a fixed context (MEMORY_CONTEXT), so its own budget only bounds a timeline that keeps failing to condense.
// - #2066, the recall pool: recall sends no ranked chapter details. Beside the timeline go the newest small memories
//   this prompt may know (phone sessions, Snapshots, Read Him sets, Claw rounds, Read Me notebook sets, and each date,
//   Character Story and Moment by its summary), newest first within RECALL_TOKENS, the oldest left out. A date,
//   Character Story or Moment (the kit's `character-story`) never joins the timeline: it is its love interest's own,
//   and until it has a summary it goes in as recent canon (S/story/canon.ts). No embeddings are made, so none are paid
//   for.
// - Every summary and condensing call gets at least 10240 tokens of reply room for thinking models (the connection's
//   own cap when it is lower); a chapter too long for one call is summarized in pieces (fitsSummary).
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";
import {
  createForgeStoryMemory,
  type ForgeMemorySource,
  type ForgeMemoryStatus,
  type ForgeRecallOptions,
  type ForgeRecallResult,
} from "@forge-kit/story-memory.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { z } from "zod";
import { createBackgroundQueue, type BackgroundQueue } from "../background-queue.js";
import {
  SUMMARY_WORDING,
  notebookMemories,
  otomeContentContract,
  timelineFoldMessages,
  withRules,
} from "../prompts.js";
import { OUTPUT_FLOOR, generateJson, promptRoom, resolveConnectionId, type OtomeMessage } from "../generation.js";
import { OTOME_FORGE_PACKAGE_ID, memoryId, runDocTarget, stateId, unitId, worldId } from "../ids.js";
import { normalizeState, readCastUnits } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
import { mayKnow } from "../story/canon.js";
import { readMemorySources } from "./sources.js";
import {
  cleanSummary,
  crossedCeiling,
  foldedPart,
  parseTimeline,
  renderTimeline,
  serializeTimeline,
} from "./timeline.js";

/**
 * The reply room of every summary and condensing call (the maintainer's rule): thinking models reason before they
 * write, so this is never sized from the summary's word limit, which the prompt states.
 */
const SUMMARY_OUTPUT_TOKENS = 10240;
const SUMMARY_TEMPERATURE = 0.3;
/** #2066: the small memories that go beside the timeline, at most this many estimated tokens, newest first. */
export const RECALL_TOKENS = 5000;
/**
 * The context the kit is told every reader has (#2066). The kit sizes its overview at a tenth of it, so the timeline's
 * size never follows the model; the timeline's own ceiling keeps it near 10k, and this only bounds one that keeps
 * failing to condense.
 * ponytail: a fixed stand-in for the kit's context-sized budget. The upgrade path is a kit option for a fixed budget,
 * which needs a Gacha Forge re-sync.
 */
const MEMORY_CONTEXT = 400_000;

const SummarySchema = z.object({ summary: z.string().min(1) });

/**
 * The overview's form, kept on the memory document: 3 is #2066's timeline (S/memory/timeline.ts; 2 was 0.6.19's prose
 * timeline, rewritten whole with every chapter). A document without it
 * is read with no overview, so the kit's next maintenance folds a new one from the saved records, one at a time; with
 * no overview every source is owed, so recall reports the memory lagging and queues that (S/story/canon.ts recallText).
 * Records, detail summaries and status are read as saved. Every overview the kit writes after that was folded over the
 * empty one, so its write stamps the form, and the reads after it use the overview again: one rebuild, never a second.
 * Until then the earlier overview is kept beside it as `legacyOverview` (the kit carries fields it does not know), so
 * What happened so far… can still show it when a fold fails before the first new one lands; the stamp drops it.
 */
const OVERVIEW_STYLE = 3;

type SavedForm = { overview?: unknown; overviewStyle?: unknown; legacyOverview?: unknown } | null | undefined;

/** The saved memory as the kit reads it: an overview of an earlier form counts as none, and is kept aside. */
const currentForm = (data: unknown) => {
  const saved = data as SavedForm;
  return saved?.overview && saved.overviewStyle !== OVERVIEW_STYLE
    ? { ...saved, overview: null, legacyOverview: saved.overview }
    : (data ?? null);
};

/** The memory as the kit writes it: one with an overview carries its form, and the earlier one is let go. */
const stampedForm = (data: unknown) => {
  if (!(data as SavedForm)?.overview) return data;
  const { legacyOverview: _earlier, ...rest } = data as Record<string, unknown>;
  return { ...rest, overviewStyle: OVERVIEW_STYLE };
};

export type MemoryRuntime = Pick<
  CapabilityRuntimeHost,
  "languageModels" | "json" | "logger" | "isDebugAgentsEnabled" | "integrations" | "persistence" | "resolveEmbeddings"
>;

export interface OtomeMemoryDeps {
  runtime: MemoryRuntime;
  store: Pick<OtomeStore, "readDoc" | "listRun" | "version">;
  /** The package's background lane; without one the memory makes its own (and disposes it). */
  background?: BackgroundQueue;
  /** Every canonical source of a run; S/memory/sources.ts by default, kept until the store writes (tests pass their own). */
  readSources?: (runId: string) => Promise<ForgeMemorySource[]>;
}

export interface OtomeMemory {
  /** The kit's recall. Without `reader` or `cast`, recall as a scene with no love interest present. */
  recall(options: ForgeRecallOptions): Promise<OtomeRecallResult>;
  /**
   * Queues maintenance (summaries, overview, recall vectors) on the background lane. False when the run has no world
   * or no connection to summarize with; true once queued, or folded into the job already waiting or running.
   */
  maintain(options: { runId: string; debugMode?: boolean }): Promise<boolean>;
  /** The kit's status, `pending` while a maintenance job is queued or running. */
  status(runId: string): Promise<ForgeMemoryStatus>;
  /** Stops the run's maintenance and drops what it was doing (a deleted run). */
  invalidate(runId: string): void;
  dispose(): void;
}

/** What the kit passes to summarize and fitsSummary. */
export interface SummaryRequest {
  runId: string;
  kind: string;
  messages: OtomeMessage[];
  tokenBudget?: number;
  debugMode?: boolean;
  signal?: AbortSignal;
}

/** What recall reads of the kit's saved store (version 1). */
interface SavedMemory {
  records?: Array<{ key?: unknown; content?: unknown } | null>;
  overview?: { content?: unknown; sources?: Array<[string, string] | null> } | null;
}

/** A run's compress connection, its model's limits, and the rules each summary prompt ends its system message with. */
export interface SummaryJob {
  connectionId: string;
  maxContext: number | null;
  maxOutputTokens: number | null;
  rules: string;
}

/**
 * The reply room a summary needs: SUMMARY_OUTPUT_TOKENS, the connection's output cap when that is lower, and never under
 * OUTPUT_FLOOR, even when the cap is lower still. generateJson itself would send such a call with only the cap as its
 * floor, so on a connection capped below 8192 summary pieces are just cut smaller than strictly needed.
 */
const summaryReserve = (maxOutputTokens: number | null) =>
  Math.max(OUTPUT_FLOOR, Math.min(SUMMARY_OUTPUT_TOKENS, maxOutputTokens || Number.POSITIVE_INFINITY));

/** One small memory beside the timeline (#2066's recall pool), in story order. */
export interface RecallItem {
  id: string;
  title: string;
  content: string;
  order: number;
}

/** The kit's recall, and the small memories that go beside the timeline. */
export type OtomeRecallResult = ForgeRecallResult & { recalls?: RecallItem[] };

/** Where a moment sits in story order: after the main chapters completed before it, then by time (S/phone/memory.ts). */
function storyOrderAt(chapters: Record<string, { completed?: string | null }>, at: string): number {
  const mainDone = Object.entries(chapters).filter(
    ([key, progress]) => key.startsWith("main-") && progress.completed && progress.completed < at,
  ).length;
  return mainDone * 10000 + 5000 + (Date.parse(at) || 0) / 1e13;
}

/**
 * readMemorySources, kept per run until the store writes anything. The kit reads every source before each paid summary
 * piece and twice per recall; on a 20-chapter world one read is ~300 documents and 2.5 MB, and a first summary pass
 * made ~300 of them (M7 probe). Sources come only from documents the store writes, so while its version has not moved
 * since a read began, that read is still current.
 * ponytail: any write drops every run's sources, and a change made around the store (a profile restore) shows after
 * the next write. A source that already has a record keeps that first record (the kit's keepFirstCanon); only canon
 * with no record yet is read again and summarized. Upgrade path: a version per run.
 */
export function keptSources(store: Pick<OtomeStore, "readDoc" | "listRun" | "version">) {
  let kept = { version: -1, runs: new Map<string, Promise<ForgeMemorySource[]>>() };
  return (runId: string): Promise<ForgeMemorySource[]> => {
    const version = store.version();
    if (kept.version !== version) kept = { version, runs: new Map() };
    const { runs } = kept;
    const stored = runs.get(runId);
    if (stored) return stored;
    const sources = readMemorySources(store, runId);
    runs.set(runId, sources);
    sources.catch(() => runs.get(runId) === sources && runs.delete(runId));
    return sources;
  };
}

export function createOtomeMemory({
  runtime,
  store,
  background,
  readSources = keptSources(store),
}: OtomeMemoryDeps): OtomeMemory {
  const documents = runtime.persistence.documents;
  const queue = background ?? createBackgroundQueue(runtime);
  /** The summary job of each run whose maintenance is running, so its summaries resolve the connection once. */
  const running = new Map<string, SummaryJob>();
  const maintainKey = (runId: string) => `${memoryId(runId)}#maintain`;
  /** Runs whose maintenance was asked for again while their job waited or ran, with whether one asked in debug mode. */
  const again = new Map<string, boolean>();
  let disposed = false;

  const runExists = async (runId: string) => !!(await documents.getById(OTOME_FORGE_PACKAGE_ID, worldId(runId)));

  async function summaryJob(runId: string): Promise<SummaryJob | null> {
    const world = await store.readDoc(worldId(runId), normalizeWorld);
    const connectionId = resolveConnectionId(world, "compress");
    if (!world || !connectionId) return null;
    const model = await runtime.languageModels.resolveForRequest({ connectionId }).catch(() => null);
    const lis = (await readCastUnits(store, runId)).map((unit) => ({ name: unit.name }));
    return {
      connectionId,
      maxContext: model?.maxContext ?? null,
      maxOutputTokens: model?.maxOutputTokens ?? null,
      rules: `${otomeContentContract({ world, lis, kind: "summary" })}\n${SUMMARY_WORDING}`,
    };
  }

  const memory = createForgeStoryMemory({
    async readMemory(runId) {
      const document = await documents.getById(OTOME_FORGE_PACKAGE_ID, memoryId(runId));
      return { data: currentForm(document?.data), revision: document?.revision ?? null };
    },
    async updateMemory(runId, { expectedRevision, data: written }) {
      if (!(await runExists(runId))) return false;
      const data = stampedForm(written);
      const { id, kind, name } = runDocTarget("memory", memoryId(runId));
      const at = new Date().toISOString();
      let saved: boolean;
      try {
        saved =
          expectedRevision !== null
            ? !!(await documents.update({
                id,
                packageId: OTOME_FORGE_PACKAGE_ID,
                expectedRevision,
                name,
                description: "",
                data,
                updatedAt: at,
              }))
            : !!(await documents.create({
                id,
                packageId: OTOME_FORGE_PACKAGE_ID,
                kind,
                name,
                description: "",
                data,
                createdAt: at,
                updatedAt: at,
              }));
      } catch {
        // A create that lost its race: the kit reads the newer document and applies its change again.
        return false;
      }
      // Deleting a run removes its world before it sweeps the documents; a write that lands after the sweep goes too.
      if (saved && !(await runExists(runId))) {
        const stale = await documents.getById(OTOME_FORGE_PACKAGE_ID, id);
        if (stale) await documents.remove(OTOME_FORGE_PACKAGE_ID, id, stale.revision).catch(() => false);
        return false;
      }
      return saved;
    },
    readSources: (runId) => readSources(runId),
    // #2066: every reader is told the same fixed context (MEMORY_CONTEXT), so the timeline's size never follows the
    // model. A run with no connection for the job still has no memory, as before.
    async resolveContext(runId, { job, connectionId }) {
      const world = connectionId ? null : await store.readDoc(worldId(runId), normalizeWorld);
      const id = connectionId || resolveConnectionId(world, job ?? "structured");
      return { maxContext: id ? MEMORY_CONTEXT : null };
    },
    // The kit cuts a chapter into the largest piece whose prompt leaves the summary its reserve, measured as
    // generateJson fits it (promptRoom), so a piece that fits here is sent whole there with at least that reply room.
    // Adding a summary to the timeline (an overview fold) sends nothing, so it always fits.
    async fitsSummary(value) {
      const request = value as SummaryRequest;
      if (request.kind === "overview") return true;
      const job = running.get(request.runId) ?? (await summaryJob(request.runId));
      if (!job?.maxContext) return false;
      return promptRoom(job.maxContext, withRules(request, job)) >= summaryReserve(job.maxOutputTokens);
    },
    async summarize(value) {
      const request = value as SummaryRequest;
      const job = running.get(request.runId) ?? (await summaryJob(request.runId));
      if (!job) throw new Error("memory-unavailable");
      const ask = async (kind: string, messages: OtomeMessage[]) => {
        const { value: reply } = await generateJson(
          { runtime, store },
          {
            runId: request.runId,
            job: "compress",
            label: `memory-${kind}`,
            messages,
            schema: SummarySchema,
            temperature: SUMMARY_TEMPERATURE,
            maxTokens: SUMMARY_OUTPUT_TOKENS,
            debugMode: request.debugMode === true,
            lane: "background",
            connectionId: job.connectionId,
            signal: request.signal,
          },
        );
        return reply.summary.trim();
      };
      if (request.kind !== "overview") return ask(request.kind, withRules(request, job));
      // The kit folds one record into the overview: here that is appending its summary to the timeline, then, once
      // the timeline crossed its ceiling, condensing all but that newest entry (#2066).
      const { previousOverview, records } = JSON.parse(request.messages.at(-1)?.content ?? "{}") as {
        previousOverview?: string;
        records?: Array<{ id: string; kind: string; title?: string; content?: string }>;
      };
      const timeline = parseTimeline(previousOverview);
      for (const record of records ?? []) {
        // A date, Character Story or Moment is a recall, never the timeline's (see the header).
        if (record.kind === "character-story") continue;
        const key = JSON.stringify([record.kind, record.id]);
        const text = cleanSummary(record.content ?? "");
        const at = timeline.entries.findIndex((entry) => entry.key === key);
        // A long chapter comes in pieces: each piece joins its own entry.
        if (at >= 0)
          timeline.entries[at] = { ...timeline.entries[at]!, text: `${timeline.entries[at]!.text}\n\n${text}` };
        else timeline.entries.push({ key, title: record.title ?? "", text });
      }
      if (!crossedCeiling(timeline)) return serializeTimeline(timeline);
      const folded = foldedPart(timeline);
      const head = await ask(
        "timeline",
        withRules({ ...request, kind: "timeline", messages: timelineFoldMessages(renderTimeline(folded)) }, job),
      );
      return serializeTimeline({ head: cleanSummary(head), entries: timeline.entries.slice(-1) });
    },
    estimateTokens: estimateTextTokens,
    // #2066: recall ranks nothing by meaning any more, so no record is embedded and no query either.
    resolveEmbeddings: async () => null,
    log: (error) =>
      runtime.logger.warn("[otome-forge] Story memory: %s", error instanceof Error ? error.message : String(error)),
  });

  /**
   * #2066's recall pool: the newest small memories this prompt may know, newest first within RECALL_TOKENS, returned in
   * story order. They are the `chat` sources (a phone session, a Snapshot, a Read Him set, a Claw round), each private
   * to its love interest; `told`, the dates, Character Stories and Moments by their summaries; and the Read Me notebook
   * sets of the love interests this recall is for (S/prompts.ts notebookMemories; live, never stored, so a deleted
   * entry never comes back).
   */
  async function recallPool(
    options: ForgeRecallOptions,
    sources: readonly ForgeMemorySource[],
    knowing: Pick<ForgeRecallOptions, "reader" | "cast">,
    told: readonly RecallItem[],
  ): Promise<RecallItem[]> {
    const items: RecallItem[] = sources
      .filter((source) => source.kind === "chat" && mayKnow(knowing, source.audience) && source.content.trim())
      .map(({ id, title, content, order }) => ({ id, title, content: content.trim(), order: order ?? 0 }));
    items.push(...told);
    const lis = options.reader ? [options.reader] : (options.cast ?? []);
    const state = lis.length ? await store.readDoc(stateId(options.runId), normalizeState) : null;
    for (const li of new Set(lis)) {
      const liState = state?.lis[li];
      const unit = liState?.known?.length ? await store.readDoc(unitId(options.runId, li), normalizeUnit) : null;
      if (!state || !liState || !unit) continue;
      const orderAt = (at: string) => storyOrderAt(state.chapters, at);
      for (const { id, title, content, order } of notebookMemories({ id: li, name: unit.name }, liState, orderAt)) {
        items.push({ id, title, content, order });
      }
    }
    const kept: RecallItem[] = [];
    let used = 0;
    // Newest first; items of the same moment keep the order they were listed in once turned back.
    const newestFirst = items.map((item, index) => ({ item, index }));
    newestFirst.sort((a, b) => b.item.order - a.item.order || b.index - a.index);
    for (const { item } of newestFirst) {
      used += estimateTextTokens(`# ${item.title}\n${item.content}`);
      if (used > RECALL_TOKENS) break;
      kept.push(item);
    }
    return kept.reverse();
  }

  return {
    async recall(options) {
      // A failed read rejects: without the sources nothing here can tell what this prompt may not know, so the caller
      // falls back to its bounded canonical history instead of a recall with the private-canon filters off.
      const sources = await readSources(options.runId);
      const knowing = options.reader || options.cast ? options : { cast: [] };
      // The caller sends a chapter in full; the newest of all (recall marks it `latest`) it sends as recent canon when
      // this prompt may know it, so it is never ranked as a detail too.
      const latest = sources.filter((source) => source.kind === "chapter").at(-1);
      // #2066: the kit's ranked details are not sent any more, so every source is listed and none is ranked, which
      // also leaves the kit no query to embed.
      const result = await memory.recall({
        ...options,
        ...(options.reader || options.cast ? {} : { cast: [] }),
        listed: [...(options.listed ?? []), ...sources.map((source) => source.id)],
        excludeChapterIds: [...(options.excludeChapterIds ?? []), ...(latest ? [latest.id] : [])],
      });
      if (result.status.phase !== "ready") return result;
      // Recent canon this prompt may know, in story order: the timeline does not cover it yet.
      const bySource = new Map(sources.map((source) => [JSON.stringify([source.kind, source.id]), source]));
      let saved: Promise<SavedMemory | undefined> | undefined;
      const readSaved = () =>
        (saved ??= documents
          .getById(OTOME_FORGE_PACKAGE_ID, memoryId(options.runId))
          .then((document) => document?.data as SavedMemory | undefined));
      const recent: NonNullable<ForgeRecallResult["recent"]> = [];
      for (const entry of result.recent ?? []) {
        const key = JSON.stringify([entry.kind, entry.id]);
        const source = bySource.get(key);
        if (!source || !mayKnow(knowing, source.audience)) continue;
        // The kit's `latest` stands for the previous chapter in full, as in GF: kept so (no content) when the caller
        // sends it. When the caller's previous chapter is another one (main after a route chapter, his route after a
        // main one), this one is recent canon like any other: nothing beyond the overview once that covers it, else
        // its saved summary, or as written until it has one.
        // ponytail: reads the kit's v1 store (key JSON [kind, id], the overview's covered keys, a source's first record
        // standing for it, as keepFirstCanon does); the upgrade path is the kit returning these with `latest`.
        const canon = entry.latest && !options.excludeChapterIds?.includes(entry.id);
        const data = canon ? await readSaved() : undefined;
        const covered =
          !!result.overview &&
          data?.overview?.content === result.overview &&
          !!data.overview.sources?.some((stamp) => stamp?.[0] === key);
        if (!canon || covered) {
          recent.push(entry);
          continue;
        }
        const summary = (Array.isArray(data?.records) ? data.records : [])
          .map((item) => (item?.key === key && typeof item.content === "string" ? item.content.trim() : ""))
          .find(Boolean);
        recent.push(summary ? { ...entry, content: summary, summary: true } : { ...entry, content: source.content });
      }
      // GF's rule for an earlier chapter with neither a summary nor the overview, kept for dates and Character Stories
      // past the newest: the canonical history instead, bounded, until the background job catches up (a story saved by
      // 0.6.16 stored them word for word), so they never all go into a prompt as written. Work is owed, so a kit
      // result that is not lagging means a failed summary, which waits for Retry as the kit's own fallback does.
      if (recent.filter((entry) => entry.kind === "character-story" && !entry.summary).length > 1) {
        const phase = result.lagging ? "stale" : "error";
        return { ...result, status: { ...result.status, phase }, overview: "", details: [], text: "" };
      }
      // Each date, Character Story and Moment this prompt may know that recent canon no longer carries, by its summary.
      const inRecent = new Set(recent.map((entry) => JSON.stringify([entry.kind, entry.id])));
      const sideStories = sources.filter(
        (source) =>
          source.kind === "character-story" &&
          !inRecent.has(JSON.stringify([source.kind, source.id])) &&
          mayKnow(knowing, source.audience),
      );
      const records = sideStories.length ? ((await readSaved())?.records ?? []) : [];
      const told = sideStories.flatMap((source): RecallItem[] => {
        const key = JSON.stringify([source.kind, source.id]);
        const summary = (Array.isArray(records) ? records : [])
          .map((item) => (item?.key === key && typeof item.content === "string" ? item.content.trim() : ""))
          .find(Boolean);
        return summary ? [{ id: source.id, title: source.title, content: summary, order: source.order ?? 0 }] : [];
      });
      // A recall pool that fails only loses its memories; the prompt still goes out with everything else.
      const recalls = await recallPool(options, sources, knowing, told).catch((error): RecallItem[] => {
        runtime.logger.warn("[otome-forge] Recall pool: %s", error instanceof Error ? error.message : String(error));
        return [];
      });
      return { ...result, recent, details: [], text: "", recalls };
    },

    async maintain({ runId, debugMode = false }) {
      if (disposed) return false;
      const job = await summaryJob(runId);
      if (!job || disposed) return false;
      const fresh = queue.ensure({
        key: maintainKey(runId),
        connectionId: job.connectionId,
        run: async () => {
          running.set(runId, job);
          try {
            // New canon that arrives while the job runs makes it go round again, so none waits for the next request;
            // a round logs its prompts in debug mode when any request folded into it asked for that.
            // ponytail: a call in the moment between the last round and the queue releasing the key is folded into
            // nothing (its `again` entry only sets debug mode for the next job). Status then shows the kit's real
            // phase, so a failed summary offers Retry and memory that lags is queued again by the next recall
            // (S/story/canon.ts recallText). The upgrade path is a queue callback fired when it releases the key.
            let debug: boolean | undefined = debugMode;
            while (debug !== undefined && !disposed) {
              const wanted = debug || again.get(runId) === true;
              again.delete(runId);
              await memory.maintain({ runId, debugMode: wanted });
              debug = again.get(runId);
            }
          } finally {
            running.delete(runId);
          }
        },
      });
      if (!fresh) again.set(runId, again.get(runId) === true || debugMode);
      return true;
    },

    async status(runId) {
      const status = await memory.status(runId);
      // The queue's own key: pending while a job waits, runs or backs off after an admission refusal. A job that failed
      // before starting for any other reason, or a call in the queue's release gap, shows the kit's real phase.
      return queue.has(maintainKey(runId)) ? { ...status, phase: "pending", retryable: false } : status;
    },

    invalidate(runId) {
      again.delete(runId);
      memory.invalidate(runId);
    },

    dispose() {
      disposed = true;
      if (!background) queue.dispose();
      again.clear();
    },
  };
}
