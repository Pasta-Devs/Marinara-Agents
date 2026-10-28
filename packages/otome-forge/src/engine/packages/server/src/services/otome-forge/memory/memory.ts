// ──────────────────────────────────────────────
// Otome Forge: private story memory (plan M2a "Memory", design: Private memory)
// ──────────────────────────────────────────────
// The kit's createForgeStoryMemory, wired to Otome's documents and generation core:
// - `${R}:memory` holds the kit's store (records, overview, checkpoints, status), revision-checked. A write for a run
//   that no longer exists is refused, and one that lands just after the run's delete is removed again.
// - Sources come from S/memory/sources.ts. A `chat` source (a love interest's route, repair or date chapter, later a
//   phone thread) never reaches the shared overview and is recalled only by that love interest's own reader or by a
//   scene whose cast includes them. Recall always says who is present: a call that names neither `cast` nor
//   `reader` recalls as a scene with nobody in it, so no private source can reach it by omission. Care data is never
//   a source.
// - Summaries run on job `compress` on the background lane. `maintain` queues one job per run on the background
//   queue, which holds the compress connection's background admission slot for the whole job (generateJson with lane
//   "background"); a second call while it waits or runs makes the job go round once more. Every summary prompt ends its
//   system message with the `summary` content contract and SUMMARY_WORDING. The knowledge boundary is left out: the
//   summarizer writes no character's words (plan §1.7).
// - Each reader job's connection (structured, narration, chat) sizes the overview: a tenth of the smallest context.
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
import { SUMMARY_WORDING, otomeContentContract } from "../content-contract.js";
import { generateJson, outputBudget, resolveConnectionId, type OtomeMessage } from "../generation.js";
import { OTOME_FORGE_PACKAGE_ID, memoryId, runDocTarget, worldId } from "../ids.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
import { readMemorySources } from "./sources.js";

// Kept in content-contract.ts so the phone's prompts reach it without importing this file (sources.ts imports them).
export { SUMMARY_WORDING };

/** What a detail summary may write; an overview gets the kit's token budget instead. */
const DETAIL_SUMMARY_TOKENS = 2048;
const SUMMARY_TEMPERATURE = 0.3;
/** Prompt room kept free besides the reply, as the kit's own summary budget keeps. */
const SAFETY_TOKENS = 512;

const SummarySchema = z.object({ summary: z.string().min(1) });

export type MemoryRuntime = Pick<
  CapabilityRuntimeHost,
  "languageModels" | "json" | "logger" | "isDebugAgentsEnabled" | "integrations" | "persistence" | "resolveEmbeddings"
>;

export interface OtomeMemoryDeps {
  runtime: MemoryRuntime;
  store: Pick<OtomeStore, "readDoc" | "listRun">;
  /** The package's background lane; without one the memory makes its own (and disposes it). */
  background?: BackgroundQueue;
  /** Every canonical source of a run; S/memory/sources.ts by default (tests pass their own). */
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

/** A run's compress connection, its model's limits, and the rules each summary prompt ends its system message with. */
interface SummaryJob {
  connectionId: string;
  maxContext: number | null;
  maxOutputTokens: number | null;
  rules: string;
}

const replyTokens = (request: SummaryRequest) =>
  request.kind === "overview" && request.tokenBudget ? request.tokenBudget : DETAIL_SUMMARY_TOKENS;

const withRules = (messages: readonly OtomeMessage[], rules: string): OtomeMessage[] =>
  messages.map((message, index) =>
    index === 0 && message.role === "system" ? { ...message, content: `${message.content}\n\n${rules}` } : message,
  );

export function createOtomeMemory({
  runtime,
  store,
  background,
  readSources = (runId) => readMemorySources(store, runId),
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
    // The kit cuts a source into the largest piece whose prompt and reply fit the compress model; the reply is what
    // generateJson will ask for (outputBudget), so a piece that fits here is never trimmed there.
    async fitsSummary(value) {
      const request = value as SummaryRequest;
      const job = running.get(request.runId) ?? (await summaryJob(request.runId));
      if (!job?.maxContext) return false;
      const prompt = withRules(request.messages, job.rules).reduce(
        (sum, message) => sum + estimateTextTokens(message.content) + 4,
        0,
      );
      return job.maxContext - prompt - SAFETY_TOKENS >= outputBudget(replyTokens(request), job.maxOutputTokens);
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

  return {
    async recall(options) {
      // The caller sends the latest chapter in full (recall marks it `latest`), so it is never ranked as a detail too.
      // ponytail: reads the sources once more for that id; the ceiling is one extra read per prompt, and the upgrade
      // path is the kit leaving the latest chapter out of ranking by itself.
      const sources = await readSources(options.runId).catch((): ForgeMemorySource[] => []);
      const latest = sources.filter((source) => source.kind === "chapter").at(-1);
      return memory.recall({
        ...options,
        ...(options.reader || options.cast ? {} : { cast: [] }),
        excludeChapterIds: [...(options.excludeChapterIds ?? []), ...(latest ? [latest.id] : [])],
      });
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
