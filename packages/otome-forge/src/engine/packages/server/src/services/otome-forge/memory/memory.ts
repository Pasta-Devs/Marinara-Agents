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
// - Recall hands no recent canon to a story prompt: every story prompt reads the saved timeline and summaries itself
//   (S/memory/timeline.ts savedStory), in every phase, and sends each chapter the timeline does not cover by its
//   summary, or in full while it has none (S/story/canon.ts recallText). From recall it takes the recall pool, the
//   phase and whether the memory lags, which queues the upkeep.
// - No context-size gate (the maintainer's, 2026-11-04): whenever a connection can run the memory job, memory runs and
//   sends each request as it is, the summary prompt and the chapter. A model whose context is too small fails at its
//   provider: that is a failed summary, status `error` with the provider's own `message`, and it waits for Retry. A
//   model that reports a context too small for even the smallest piece of a summary (or of a condensing) fails the
//   same way with no call, its `message` saying so and its reason `context-too-small` (tooSmall), so the client shows
//   those words as Otome's own, not the connection's, and the player switches the connection. Only a run with no
//   connection for the job at all waits, which status reports (`noConnection`), with how many chapters have no
//   summary yet (`unsummarized`). A status the earlier gate saved reads as if no gate had been: `context-unknown` as
//   stale, so the next recall queues the upkeep, and a ready one without the readers it knew no context for.
// - Read Me (S/minigames/read-me.ts) is never a source: what the notebook holds beyond knowsAboutYou's newest entries
//   joins the recall pool live on each recall (S/prompts.ts notebookMemories), so a deleted entry never comes back.
// - Summaries run on job `compress` on the background lane. `maintain` queues one job per run on the background
//   queue, which holds the compress connection's background admission slot for the whole job (generateJson with lane
//   "background"); a second call while it waits or runs makes the job go round once more. Every summary prompt ends its
//   system message with the `summary` content contract and SUMMARY_WORDING, an overview fold's with OVERVIEW_WORDING
//   too: the overview is the story's timeline told as a recollection, which "What happened so far…" shows as written
//   (0.6.19). An overview saved before that is read as none, so the next maintenance folds it again (OVERVIEW_STYLE).
//   The knowledge boundary is left out: the summarizer writes no character's words (plan §1.7).
// - The player's Retry (maintain's `retry`) is their own request, so its job runs under foreground admission
//   (S/background-queue.ts): it runs at once even while they read, and status gives its outcome, done or failed again.
//   Under background admission it waited for a connection idle for 30 s, which while the player reads may be never,
//   and status stayed `pending` all that time. Upkeep queued by itself after a failed summary (a chapter's end, a
//   recall) still waits for that admission, so while it only waits status keeps the failure, with its Retry, which
//   then runs that job at once.
// - #2066, the timeline: the kit's overview is the story's timeline (S/memory/timeline.ts). Each chapter's summary
//   (the kit's detail record, written once, at most 1000 words by its prompt) is appended to it as it is folded in,
//   with no model call; only once the timeline passes 13k tokens and 1k of leeway (14k) is everything before the
//   newest main chapter's entry condensed into about 5000 words (half that), and appending goes on: that entry and the
//   ones after it stay apart, so a prompt that sends that chapter in full leaves its summary out (#2091; the cases
//   where it cannot are S/memory/timeline.ts's ponytail). The condensing goes in as few calls as the memory model's
//   own context allows when it reports one (a small one gets the oldest entries a few at a time), else in one call:
//   the timeline it condenses is bounded by its ceiling. Its size never follows the model's context: the kit is given
//   a fixed context (MEMORY_CONTEXT) for every job a connection can run, so its budget only bounds a timeline that
//   keeps failing to condense.
// - #2066, the recall pool: recall sends no ranked chapter details. Beside the timeline go the newest small memories
//   this prompt may know (phone sessions, Snapshots, Read Him sets, Claw rounds, Read Me notebook sets, and each date
//   by its summary), newest first within RECALL_TOKENS and 1k of leeway, the oldest left out, and none the prompt
//   already lists in full (`listed`, P17's newest conversations). A date (the kit's `character-story`) never joins the
//   timeline's text: it is its love interest's own, and until its summary is folded (the timeline covers it) it goes
//   in as recent canon, by its summary or in full while it has none (S/story/canon.ts). The pool is the same in every
//   phase. No embeddings are made, so none are paid for.
// - A Character Story, Moment or first-wear beat (also the kit's `character-story`, a `story-<itemId>` chapter) joins
//   the timeline in story order, as a route chapter does, titled and summarized as private to its love interest (the
//   maintainer's, 2026-11-03: love interests must know what happened in them; as recalls they were often left out).
//   The Home note, Read Him and Read Me carry no timeline, so they ask for them as recalls too (`ownStories`).
//   ponytail: a run whose memory waits for Retry (a failed summary) when it moves to a new overview form sends its
//   summaries as recent canon, the oldest giving way, until Retry rebuilds it: the kit holds every failure for
//   Retry. The upgrade path is a form change that queues its rebuild whatever the saved status.
// - Every summary and condensing call gets at least 10240 tokens of reply room for thinking models (the connection's
//   own cap when it is lower); a chapter too long for the context the memory model reports is summarized in pieces
//   (fitsSummary), and one for a model that reports none goes whole.
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
import { OTOME_FORGE_PACKAGE_ID, isItemStoryKey, memoryId, runDocTarget, stateId, unitId, worldId } from "../ids.js";
import { normalizeState, readCastUnits } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
import { mayKnow } from "../story/canon.js";
import { readMemorySources } from "./sources.js";
import {
  HEADROOM_TOKENS,
  OVERVIEW_STYLE,
  cleanSummary,
  crossedCeiling,
  foldedPart,
  keptPart,
  parseTimeline,
  renderTimeline,
  savedStory,
  serializeTimeline,
  type Timeline,
} from "./timeline.js";

/**
 * The reply room of every summary and condensing call (the maintainer's rule): thinking models reason before they
 * write, so this is never sized from the summary's word limit, which the prompt states.
 */
const SUMMARY_OUTPUT_TOKENS = 10240;
/**
 * The reply room of the timeline-condensing call. It writes about TIMELINE_FOLD_WORDS (5000) words of JSON, five times
 * a chapter summary, and a thinking model (Claude Opus 5.5) spends its thinking from the same room: with only
 * SUMMARY_OUTPUT_TOKENS it was cut off every time ("the reply was cut"). A model whose context is smaller still gets
 * what its context leaves (generation.ts fitPrompt), as before.
 */
const TIMELINE_OUTPUT_TOKENS = 24576;
/**
 * #2066: the small memories that go beside the timeline, newest first, at most this many estimated tokens and
 * HEADROOM_TOKENS of leeway (S/memory/timeline.ts).
 */
export const RECALL_TOKENS = 5000;
/**
 * The context the kit is told every reader has (#2066). The kit sizes its overview at a tenth of it, so the timeline's
 * size never follows the model; the timeline's own ceiling keeps it within 14k, and this only bounds one that keeps
 * failing to condense.
 * ponytail: a fixed stand-in for the kit's context-sized budget. The upgrade path is a kit option for a fixed budget,
 * which needs a Gacha Forge re-sync.
 */
const MEMORY_CONTEXT = 400_000;

const SummarySchema = z.object({ summary: z.string().min(1) });

/** The longest failed summary's message kept on the status: a proxy's error page can be long. */
const FAILURE_CHARACTERS = 2000;

/**
 * A failed summary's reason and message when the memory model's context holds not even the smallest request of `task`
 * (see the header): Otome's own words, which the client shows without "The connection said".
 */
const tooSmall = (maxContext: number, task: "write a summary" | "condense the story's timeline") => ({
  reason: "context-too-small",
  message: `The Memory connection's model (${maxContext.toLocaleString("en-US")} tokens of context) is too small to ${task}. Choose a connection with a larger context.`,
});

/** How many characters of its source a detail request carries (the kit's `range`); a piece of one is the smallest. */
const pieceLength = (request: SummaryRequest) => {
  const { source } = JSON.parse(request.messages.at(-1)?.content ?? "{}") as {
    source?: { range?: { from: number; to: number } };
  };
  return source?.range ? source.range.to - source.range.from : Number.POSITIVE_INFINITY;
};

type SavedForm =
  | {
      overview?: unknown;
      overviewStyle?: unknown;
      legacyOverview?: unknown;
      status?: { phase?: unknown; unknownReaders?: unknown };
    }
  | null
  | undefined;

/**
 * The saved memory as the kit reads it: an overview of an earlier form (S/memory/timeline.ts OVERVIEW_STYLE) counts as
 * none, and is kept aside. A status the earlier context gate saved (see the header) reads as memory behind; a ready
 * one loses the readers that gate knew no context for, which the kit would read as waiting for setup with no upkeep
 * owed to clear it.
 */
const currentForm = (data: unknown) => {
  const saved = data as SavedForm;
  const form: SavedForm =
    saved?.overview && saved.overviewStyle !== OVERVIEW_STYLE
      ? { ...saved, overview: null, legacyOverview: saved.overview }
      : saved;
  const status = form?.status;
  if (status?.phase === "context-unknown")
    return { ...form, status: { phase: "stale", retryable: true, reason: "not-prepared" } };
  if (status && "unknownReaders" in status) {
    const { unknownReaders: _gate, ...rest } = status;
    return { ...form, status: rest };
  }
  return form ?? null;
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
   * or no connection to summarize with; true once queued, or folded into the job already waiting or running. `retry`:
   * the player's Retry, which never waits for an idle connection (see the header).
   */
  maintain(options: { runId: string; debugMode?: boolean; retry?: boolean }): Promise<boolean>;
  /**
   * The kit's status, `pending` while a maintenance job is queued or running (see OtomeMemoryStatus), except a failure
   * whose upkeep only waits for background admission, which stays the failure (see the header).
   */
  status(runId: string): Promise<OtomeMemoryStatus>;
  /** Stops the run's maintenance and drops what it was doing (a deleted run). */
  invalidate(runId: string): void;
  dispose(): void;
}

/**
 * The kit's status (phase `error` is a failed summary, which waits for Retry), with what the client shows beside it
 * (see the header): the failed call's own `message` (or tooSmall's, with no call, and its reason `context-too-small`),
 * whether no connection can write summaries, and how many chapters (the story's own and its side stories) have no
 * summary yet, when the run's sources can be read.
 */
export type OtomeMemoryStatus = ForgeMemoryStatus & {
  message?: string;
  noConnection: boolean;
  unsummarized?: number;
};

/** What the kit passes to summarize and fitsSummary. */
export interface SummaryRequest {
  runId: string;
  kind: string;
  messages: OtomeMessage[];
  tokenBudget?: number;
  debugMode?: boolean;
  signal?: AbortSignal;
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

/**
 * The kit's recall without its recent canon (a story prompt reads the saved story itself, see the header), and the
 * small memories that go beside the timeline.
 */
export type OtomeRecallResult = Omit<ForgeRecallResult, "recent"> & { recalls?: RecallItem[] };

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
  /** Why each run's summary failed this round (the call's own message, or tooSmall), for the kit's next error status. */
  const failures = new Map<string, { message: string; reason?: string }>();
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

  /** The memory as the kit writes it, with a failed summary's message (and tooSmall's reason) on its error status. */
  const withFailure = (runId: string, data: unknown) => {
    const status = (data as { status?: { phase?: unknown } } | null)?.status;
    const failure = failures.get(runId);
    return status?.phase === "error" && failure ? { ...(data as object), status: { ...status, ...failure } } : data;
  };

  const memory = createForgeStoryMemory({
    async readMemory(runId) {
      const document = await documents.getById(OTOME_FORGE_PACKAGE_ID, memoryId(runId));
      return { data: currentForm(document?.data), revision: document?.revision ?? null };
    },
    async updateMemory(runId, { expectedRevision, data: written }) {
      if (!(await runExists(runId))) return false;
      const data = stampedForm(withFailure(runId, written));
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
    // #2066: every job a connection can run is told the same fixed context (MEMORY_CONTEXT), whatever its model reports
    // or leaves unknown, so the timeline's size never follows the model and memory never waits for a context size (see
    // the header). Only a job with no connection at all has none: the kit waits for configuration.
    async resolveContext(runId, { job, connectionId }) {
      const world = connectionId ? null : await store.readDoc(worldId(runId), normalizeWorld);
      return { maxContext: connectionId || resolveConnectionId(world, job ?? "structured") ? MEMORY_CONTEXT : null };
    },
    // The kit cuts a chapter into the largest piece whose prompt leaves the summary its reserve, measured as
    // generateJson fits it (promptRoom), so a piece that fits here is sent whole there with at least that reply room. A
    // model that reports no context size is sent the chapter whole: its provider says when it is too long. Adding a
    // summary to the timeline (an overview fold) sends nothing, so it always fits. The kit's smallest piece is one
    // character: a model that holds not even that fails the job with no call, so the status says why (tooSmall).
    async fitsSummary(value) {
      const request = value as SummaryRequest;
      if (request.kind === "overview") return true;
      const job = running.get(request.runId) ?? (await summaryJob(request.runId));
      if (!job) return false;
      if (!job.maxContext) return true;
      if (promptRoom(job.maxContext, withRules(request, job)) >= summaryReserve(job.maxOutputTokens)) return true;
      if (pieceLength(request) <= 1) failures.set(request.runId, tooSmall(job.maxContext, "write a summary"));
      return false;
    },
    async summarize(value) {
      const request = value as SummaryRequest;
      const job = running.get(request.runId) ?? (await summaryJob(request.runId));
      if (!job) throw new Error("memory-unavailable");
      const ask = async (kind: string, messages: OtomeMessage[], maxTokens = SUMMARY_OUTPUT_TOKENS) => {
        const { value: reply } = await generateJson(
          { runtime, store },
          {
            runId: request.runId,
            job: "compress",
            label: `memory-${kind}`,
            messages,
            schema: SummarySchema,
            maxTokens,
            debugMode: request.debugMode === true,
            lane: "background",
            connectionId: job.connectionId,
            signal: request.signal,
          },
        ).catch((error: unknown) => {
          // The provider's own words (a context-length error, a refusal), for the error status (see the header).
          failures.set(request.runId, {
            message: (error instanceof Error ? error.message : String(error)).slice(0, FAILURE_CHARACTERS),
          });
          throw error;
        });
        return reply.summary.trim();
      };
      if (request.kind !== "overview") return ask(request.kind, withRules(request, job));
      // The kit folds one record into the overview: here that is appending its summary to the timeline, then, once
      // the timeline crossed its ceiling, condensing everything before the newest main chapter's entry (#2066, #2091;
      // S/memory/timeline.ts).
      const { previousOverview, records } = JSON.parse(request.messages.at(-1)?.content ?? "{}") as {
        previousOverview?: string;
        records?: Array<{ id: string; kind: string; title?: string; content?: string }>;
      };
      const timeline = parseTimeline(previousOverview);
      let added = false;
      for (const record of records ?? []) {
        // A date is a recall, never the timeline's; a Character Story joins it (see the header).
        if (record.kind === "character-story" && !isItemStoryKey(record.id)) continue;
        added = true;
        const key = JSON.stringify([record.kind, record.id]);
        const text = cleanSummary(record.content ?? "");
        const at = timeline.entries.findIndex((entry) => entry.key === key);
        // A long chapter comes in pieces: each piece joins its own entry.
        if (at >= 0)
          timeline.entries[at] = { ...timeline.entries[at]!, text: `${timeline.entries[at]!.text}\n\n${text}` };
        else timeline.entries.push({ key, title: record.title ?? "", text });
      }
      // Only a fold that added a summary condenses: one that added nothing (a date's) leaves the timeline as it was.
      if (!added || !crossedCeiling(timeline)) return serializeTimeline(timeline);
      const condense = (part: Timeline) =>
        withRules({ ...request, kind: "timeline", messages: timelineFoldMessages(renderTimeline(part)) }, job);
      // A model that reports no context size is sent the whole part in one call (see the header).
      const fits = (part: Timeline) =>
        !job.maxContext || promptRoom(job.maxContext, condense(part)) >= summaryReserve(job.maxOutputTokens);
      // As few calls as the memory model's context allows: each folds the head with the most of the oldest entries
      // that fit beside it. Not even one fitting is a model too small for the story's memory, which the status says.
      let { head, entries: pending } = foldedPart(timeline);
      while (pending.length) {
        let take = pending.length;
        while (take > 0 && !fits({ head, entries: pending.slice(0, take) })) take -= 1;
        if (!take) {
          failures.set(request.runId, tooSmall(job.maxContext ?? 0, "condense the story's timeline"));
          throw new Error("summary-context-too-small");
        }
        head = cleanSummary(
          await ask("timeline", condense({ head, entries: pending.slice(0, take) }), TIMELINE_OUTPUT_TOKENS),
        );
        pending = pending.slice(take);
      }
      return serializeTimeline({ head, entries: keptPart(timeline) });
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
   * to its love interest; `told`, the dates by their summaries; and the Read Me notebook
   * sets of the love interests this recall is for (S/prompts.ts notebookMemories; live, never stored, so a deleted
   * entry never comes back). What the caller lists in full (`listed`) is left out. Each is counted as the prompt shows
   * it (S/story/canon.ts renderMemory); one that alone could never fit is passed over, and the first other that does
   * not fit ends the pool, so only the oldest are left out.
   */
  async function recallPool(
    options: ForgeRecallOptions,
    sources: readonly ForgeMemorySource[],
    knowing: Pick<ForgeRecallOptions, "reader" | "cast">,
    told: readonly RecallItem[],
  ): Promise<RecallItem[]> {
    const listed = new Set(options.listed ?? []);
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
    const limit = RECALL_TOKENS + HEADROOM_TOKENS;
    let used = 0;
    // Newest first; items of the same moment keep the order they were listed in once turned back.
    const newestFirst = items.filter((item) => !listed.has(item.id)).map((item, index) => ({ item, index }));
    newestFirst.sort((a, b) => b.item.order - a.item.order || b.index - a.index);
    for (const { item } of newestFirst) {
      const cost = estimateTextTokens(`\n\n# Recalled memory: ${item.title}\n${item.content}`);
      if (cost > limit) continue;
      if (used + cost > limit) break;
      used += cost;
      kept.push(item);
    }
    return kept.reverse();
  }

  return {
    async recall(options) {
      // A failed read rejects: without the sources nothing here can tell what this prompt may not know, so the caller
      // goes on without the recall pool instead of a recall with the private-canon filters off.
      const sources = await readSources(options.runId);
      const knowing = options.reader || options.cast ? options : { cast: [] };
      // The caller sends the story's chapters itself (S/story/canon.ts), so the newest of all (the kit's `latest`) is
      // never ranked as a detail.
      const latest = sources.filter((source) => source.kind === "chapter").at(-1);
      // #2066: the kit's ranked details are not sent any more, so every source is listed and none is ranked, which
      // also leaves the kit no query to embed.
      const result = await memory.recall({
        ...options,
        ...(options.reader || options.cast ? {} : { cast: [] }),
        listed: [...(options.listed ?? []), ...sources.map((source) => source.id)],
        excludeChapterIds: [...(options.excludeChapterIds ?? []), ...(latest ? [latest.id] : [])],
      });
      // Each date this prompt may know whose summary the timeline covers, by that summary; one not covered yet is
      // recent canon (S/story/canon.ts). A Character Story is the timeline's, so only a prompt with no timeline
      // (`ownStories`) takes it here too. The same in every phase: what is saved is what counts (see the header).
      const sideStories = sources.filter(
        (source) =>
          source.kind === "character-story" &&
          (options.ownStories || !isItemStoryKey(source.id)) &&
          mayKnow(knowing, source.audience),
      );
      const saved = sideStories.length
        ? savedStory((await documents.getById(OTOME_FORGE_PACKAGE_ID, memoryId(options.runId)))?.data)
        : null;
      const told = sideStories.flatMap((source): RecallItem[] => {
        const key = JSON.stringify([source.kind, source.id]);
        const summary = saved?.covered.has(key) ? saved.summaries.get(key) : undefined;
        return summary ? [{ id: source.id, title: source.title, content: summary, order: source.order ?? 0 }] : [];
      });
      // A recall pool that fails only loses its memories; the prompt still goes out with everything else.
      const recalls = await recallPool(options, sources, knowing, told).catch((error): RecallItem[] => {
        runtime.logger.warn("[otome-forge] Recall pool: %s", error instanceof Error ? error.message : String(error));
        return [];
      });
      const { recent: _recent, ...rest } = result;
      return { ...rest, details: [], text: "", recalls };
    },

    async maintain({ runId, debugMode = false, retry = false }) {
      if (disposed) return false;
      const job = await summaryJob(runId);
      if (!job || disposed) return false;
      const fresh = queue.ensure({
        key: maintainKey(runId),
        connectionId: job.connectionId,
        foreground: retry,
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
              failures.delete(runId);
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
      const [status, world, sources, document] = await Promise.all([
        memory.status(runId),
        store.readDoc(worldId(runId), normalizeWorld),
        readSources(runId).catch(() => null),
        documents.getById(OTOME_FORGE_PACKAGE_ID, memoryId(runId)),
      ]);
      const noConnection = !resolveConnectionId(world, "compress");
      const { summaries } = savedStory(document?.data);
      const unsummarized = sources?.filter(
        (source) => source.kind !== "chat" && !summaries.has(JSON.stringify([source.kind, source.id])),
      ).length;
      const counts = { noConnection, ...(unsummarized === undefined ? {} : { unsummarized }) };
      // The queue's own key: pending while a job waits, runs or backs off after an admission refusal, with no earlier
      // failure's message. A job that failed before starting for any other reason, or a call in the queue's release
      // gap, shows the kit's real phase; so does a failure whose upkeep is background work not admitted yet, so its
      // Retry stays offered (the banner would go with no summary written, and Settings hides Retry while pending).
      const key = maintainKey(runId);
      if (!queue.has(key) || (status.phase === "error" && queue.waiting(key))) return { ...status, ...counts };
      const { message: _earlier, ...rest } = status as OtomeMemoryStatus;
      return { ...rest, phase: "pending", retryable: false, ...counts };
    },

    invalidate(runId) {
      again.delete(runId);
      failures.delete(runId);
      memory.invalidate(runId);
    },

    dispose() {
      disposed = true;
      if (!background) queue.dispose();
      again.clear();
      failures.clear();
    },
  };
}
