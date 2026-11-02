// ──────────────────────────────────────────────
// Otome Forge: private story memory (plan M2a "Memory", design: Private memory)
// ──────────────────────────────────────────────
// The kit's createForgeStoryMemory, wired to Otome's documents and generation core:
// - `${R}:memory` holds the kit's store (records, overview, checkpoints, status), revision-checked. A write for a run
//   that no longer exists is refused, and one that lands just after the run's delete is removed again.
// - Sources come from S/memory/sources.ts. Every chapter is summarized and folded into the shared overview
//   (S/story/canon.ts: main, route and repair chapters are the kit's `chapter`, dates and Character Stories its
//   `character-story`). A love interest's own source (audience [li]) reaches a prompt beyond the overview, as a
//   recalled detail or recent canon, only for that love interest's own reader or a scene whose cast includes them:
//   recall lists every other one out of the kit's ranking (the kit itself holds back only a `chat` and a reader's
//   Character Story) and keeps it out of the recent canon. A `chat` (a phone session, a Snapshot, a Read Him set, a
//   Claw round) stays out of the overview. Recall always says who is present: a call that names neither `cast` nor
//   `reader` recalls as a scene with nobody in it, so no private source can reach it by omission. Care data is never
//   a source.
// - Recent canon (what the overview does not cover yet) is GF's: the newest chapter stands for the caller's previous
//   chapter in full, or, when that is another one, comes as its summary until the overview covers it; a date or
//   Character Story goes in as written only while it is the one newest without a summary, else recall answers
//   "not ready" and the caller sends the bounded canonical history (S/story/canon.ts).
// - Read Me (S/minigames/read-me.ts) is never a source: what the notebook holds beyond knowsAboutYou's newest entries
//   is ranked live on each recall, in the side slots the kit leaves free (S/story/prompts.ts notebookMemories), so a
//   deleted entry never comes back.
// - Summaries run on job `compress` on the background lane. `maintain` queues one job per run on the background
//   queue, which holds the compress connection's background admission slot for the whole job (generateJson with lane
//   "background"); a second call while it waits or runs makes the job go round once more. Every summary prompt ends its
//   system message with the `summary` content contract and SUMMARY_WORDING. The knowledge boundary is left out: the
//   summarizer writes no character's words (plan §1.7).
// - Each reader job's connection (structured, narration, chat) sizes the overview: a tenth of the smallest context.
// - Every summary keeps GF's output reserve for thinking models: at least 10240 tokens (the connection's own cap when
//   it is lower, never under the 8192 floor); a source too long for that is summarized in pieces (fitsSummary).
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";
import {
  createForgeStoryMemory,
  forgeStoryMemoryText,
  rankForgeStoryMemories,
  type ForgeMemorySource,
  type ForgeMemoryStatus,
  type ForgeRecallOptions,
  type ForgeRecallResult,
} from "@forge-kit/story-memory.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { z } from "zod";
import { createBackgroundQueue, type BackgroundQueue } from "../background-queue.js";
import { SUMMARY_WORDING, otomeContentContract } from "../content-contract.js";
import { OUTPUT_FLOOR, generateJson, promptRoom, resolveConnectionId, type OtomeMessage } from "../generation.js";
import { OTOME_FORGE_PACKAGE_ID, memoryId, runDocTarget, stateId, unitId, worldId } from "../ids.js";
import { normalizeState } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
import { mayKnow } from "../story/canon.js";
import { notebookMemories, type NotebookMemory } from "../story/prompts.js";
import { readMemorySources } from "./sources.js";

// Kept in content-contract.ts so the phone's prompts reach it without importing this file (sources.ts imports them).
export { SUMMARY_WORDING };

/** What a detail summary may write; an overview gets the kit's token budget instead. generateJson sends more. */
const DETAIL_SUMMARY_TOKENS = 2048;
/** GF's summary reserve (story-memory-integration.mjs summaryBudget): thinking models reason before they write. */
const SUMMARY_OUTPUT_TOKENS = 10240;
const SUMMARY_TEMPERATURE = 0.3;
/** The side memories recall gives at most (the kit's cap), Read Me's among them. */
const SIDE_RECALLS = 3;

const SummarySchema = z.object({ summary: z.string().min(1) });

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
  recall(options: ForgeRecallOptions): Promise<ForgeRecallResult>;
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
interface SummaryRequest {
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
interface SummaryJob {
  connectionId: string;
  maxContext: number | null;
  maxOutputTokens: number | null;
  rules: string;
}

const replyTokens = (request: SummaryRequest) =>
  request.kind === "overview" && request.tokenBudget ? request.tokenBudget : DETAIL_SUMMARY_TOKENS;

/**
 * The reply room a summary needs, GF's summaryBudget reserve: at least SUMMARY_OUTPUT_TOKENS (an overview's own budget
 * when larger), the connection's output cap when that is lower, and never under OUTPUT_FLOOR, even when the cap is
 * lower still (the maintainer's rule for thinking models). generateJson itself would send such a call with only the
 * cap as its floor, so on a connection capped below 8192 summary pieces are just cut smaller than strictly needed.
 */
const summaryReserve = (request: SummaryRequest, maxOutputTokens: number | null) =>
  Math.max(
    OUTPUT_FLOOR,
    Math.min(Math.max(SUMMARY_OUTPUT_TOKENS, request.tokenBudget ?? 0), maxOutputTokens || Number.POSITIVE_INFINITY),
  );

const withRules = (messages: readonly OtomeMessage[], rules: string): OtomeMessage[] =>
  messages.map((message, index) =>
    index === 0 && message.role === "system" ? { ...message, content: `${message.content}\n\n${rules}` } : message,
  );

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
    const lis = (await store.listRun("unit", runId)).map((record) => ({ name: normalizeUnit(record.data).name }));
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
      return { data: document?.data ?? null, revision: document?.revision ?? null };
    },
    async updateMemory(runId, { expectedRevision, data }) {
      if (!(await runExists(runId))) return false;
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
    async resolveContext(runId, { job, connectionId }) {
      const world = connectionId ? null : await store.readDoc(worldId(runId), normalizeWorld);
      const id = connectionId || resolveConnectionId(world, job ?? "structured");
      if (!id) return { maxContext: null };
      try {
        return { maxContext: (await runtime.languageModels.resolveForRequest({ connectionId: id })).maxContext };
      } catch {
        return { maxContext: null };
      }
    },
    // The kit cuts a source into the largest piece whose prompt leaves the summary its reserve, measured as
    // generateJson fits it (promptRoom), so a piece that fits here is sent whole there with at least that reply room.
    async fitsSummary(value) {
      const request = value as SummaryRequest;
      const job = running.get(request.runId) ?? (await summaryJob(request.runId));
      if (!job?.maxContext) return false;
      return (
        promptRoom(job.maxContext, withRules(request.messages, job.rules)) >=
        summaryReserve(request, job.maxOutputTokens)
      );
    },
    async summarize(value) {
      const request = value as SummaryRequest;
      const job = running.get(request.runId) ?? (await summaryJob(request.runId));
      if (!job) throw new Error("memory-unavailable");
      const { value: reply } = await generateJson(
        { runtime, store },
        {
          runId: request.runId,
          job: "compress",
          label: `memory-${request.kind}`,
          messages: withRules(request.messages, job.rules),
          schema: SummarySchema,
          temperature: SUMMARY_TEMPERATURE,
          maxTokens: replyTokens(request),
          debugMode: request.debugMode === true,
          lane: "background",
          connectionId: job.connectionId,
          signal: request.signal,
        },
      );
      return reply.summary.trim();
    },
    estimateTokens: estimateTextTokens,
    resolveEmbeddings: async () => runtime.resolveEmbeddings(),
    log: (error) =>
      runtime.logger.warn("[otome-forge] Story memory: %s", error instanceof Error ? error.message : String(error)),
  });

  /**
   * Read Me's older notebook entries for the love interests this recall is for, ranked into the side slots the kit left
   * free within what is left of its budget (S/story/prompts.ts notebookMemories); live, never stored.
   * ponytail: ranked apart from the kit's pool, so a notebook entry never outranks a saved side memory. The upgrade
   * path is a kit source that is ranked but never saved, which would need a Gacha Forge re-sync.
   */
  async function notebookRecalls(
    options: ForgeRecallOptions,
    result: ForgeRecallResult,
    recent: NonNullable<ForgeRecallResult["recent"]>,
  ): Promise<ForgeRecallResult["details"]> {
    const free = SIDE_RECALLS - result.details.filter((detail) => detail.kind !== "chapter").length;
    const lis = options.reader ? [options.reader] : (options.cast ?? []);
    if (free <= 0 || !lis.length || !result.budget) return [];
    // What the prompt sends beside the overview, as the kit counts it; a chapter the caller sends in full (the kit's
    // `latest`, no content) costs nothing here.
    const budget =
      result.budget +
      2000 -
      estimateTextTokens(result.text) -
      recent.reduce(
        (sum, entry) =>
          entry.content ? sum + estimateTextTokens(`# Recent canon: ${entry.title}\n${entry.content}`) : sum,
        0,
      );
    if (budget <= 64) return [];
    const state = await store.readDoc(stateId(options.runId), normalizeState);
    if (!state) return [];
    const candidates: NotebookMemory[] = [];
    for (const li of new Set(lis)) {
      const liState = state.lis[li];
      const unit = liState?.known?.length ? await store.readDoc(unitId(options.runId, li), normalizeUnit) : null;
      if (liState && unit) candidates.push(...notebookMemories({ id: li, name: unit.name }, liState));
    }
    if (!candidates.length) return [];
    return rankForgeStoryMemories(candidates, options.query, {
      maxRecalls: 0,
      maxSideRecalls: free,
      budgetTokens: budget,
      estimateTokens: estimateTextTokens,
    }).map(({ id, kind, title, content }) => ({ id, kind, title, content }));
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
      // The kit ranks a chapter for anyone and a Character Story for any cast: one this prompt may not know is listed,
      // so it is never ranked (the kit holds back a `chat` itself).
      const unknown = sources
        .filter((source) => source.kind !== "chat" && !mayKnow(knowing, source.audience))
        .map((source) => source.id);
      const result = await memory.recall({
        ...options,
        ...(options.reader || options.cast ? {} : { cast: [] }),
        listed: [...(options.listed ?? []), ...unknown],
        excludeChapterIds: [...(options.excludeChapterIds ?? []), ...(latest ? [latest.id] : [])],
      });
      if (result.status.phase !== "ready") return result;
      // Recent canon this prompt may know, in story order.
      // ponytail: the kit sizes its recalled details after all the recent canon it returns, so another love interest's
      // route or repair summary dropped here (only while the overview has not folded it in yet) still takes room from
      // them. The upgrade path is a kit recall that leaves out what the caller may not know before it budgets, which
      // needs a Gacha Forge re-sync.
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
      // A Read Me recall that fails only loses its side slots; the prompt still goes out with everything else.
      const notebook = await notebookRecalls(options, result, recent).catch((error): ForgeRecallResult["details"] => {
        runtime.logger.warn("[otome-forge] Read Me recall: %s", error instanceof Error ? error.message : String(error));
        return [];
      });
      const details = [...result.details, ...notebook];
      return {
        ...result,
        recent,
        details,
        text: notebook.length ? forgeStoryMemoryText({ overview: result.overview, details }) : result.text,
      };
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
