import { resolve } from "node:path";
import type {
  LtmInteropPreviewResponse,
  LtmMode,
  LtmScope,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { resolveLtmChatMemories } from "../../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import { parseLtmChatMetadata, resolveChatLtmScope } from "../identity/chat-scope.js";
import { getLtmExtractionConfig } from "../extraction/extraction-config.js";
import { recordLtmDebugEvent } from "../maintenance/debug-log.js";
import { getPackagePersistence, logger } from "../package-runtime.js";
import { outsideLtmVaultLock } from "../persistence/vault-lock.js";
import { LtmServiceError } from "../service-error.js";
import { importPackageInterop, previewPackageInterop } from "./interop.js";

/** A background import waits this long after the last reply in its chat... */
export const LTM_AUTO_IMPORT_QUIET_MS = 2_000;
/** ...but never longer than this after the first waiting reply, so a busy chat still imports. */
export const LTM_AUTO_IMPORT_MAX_WAIT_MS = 10_000;
/** The import request's own limit. */
const BATCH = 100;
const SOURCES = ["chats", "messages"] as const;

type Job = {
  root: string;
  chatId: string;
  mode: LtmMode;
  /** A reply arrived during a run: arm the timer again when it ends. */
  again: boolean;
  firstRequestAt?: number;
  timer?: ReturnType<typeof setTimeout>;
  running?: Promise<void>;
  controller?: AbortController;
};
const jobs = new Map<string, Job>();
/** Roots whose package was deactivated: nothing schedules there until it is activated again. */
const stopped = new Set<string>();
/**
 * Per chat and source, the selection whose last import failed or came back incomplete. The same selection is not
 * retried on every reply; a new or changed source, or a manual import, moves it on.
 * ponytail: in-process only, so a restart retries once. Persist it if a failing model costs too much.
 */
const blocked = new Map<string, string>();

const jobKey = (root: string, chatId: string) => `${resolve(root)}\u0000${chatId}`;

function arm(key: string, job: Job) {
  const now = Date.now();
  job.firstRequestAt ??= now;
  clearTimeout(job.timer);
  const delay = Math.max(0, Math.min(LTM_AUTO_IMPORT_QUIET_MS, job.firstRequestAt + LTM_AUTO_IMPORT_MAX_WAIT_MS - now));
  job.timer = outsideLtmVaultLock(() => setTimeout(() => void start(key, job), delay));
  // A pending import must not keep the process alive: the next reply after a restart arms it again.
  job.timer.unref?.();
}

function start(key: string, job: Job) {
  clearTimeout(job.timer);
  job.timer = undefined;
  job.firstRequestAt = undefined;
  const controller = new AbortController();
  job.controller = controller;
  job.running = outsideLtmVaultLock(() => runLtmAutoImport(job, key, controller.signal))
    .catch((error) => {
      if (!controller.signal.aborted) logger.warn(error, "[ltm] Background import failed for chat %s", job.chatId);
    })
    .finally(() => {
      job.running = undefined;
      job.controller = undefined;
      if (jobs.get(key) !== job) return;
      if (!job.again) return void jobs.delete(key);
      job.again = false;
      arm(key, job);
    });
  return job.running;
}

/** This chat's sources that are new or changed since their import, without the messages piece still being written. */
async function pendingSources({ root, chatId, mode }: Job, sourceScope: LtmScope, source: (typeof SOURCES)[number]) {
  const samples: LtmInteropPreviewResponse["samples"] = [];
  let cursor: string | null | undefined;
  do {
    const page = await previewPackageInterop(
      {
        source,
        limit: BATCH,
        sourceScope,
        mode,
        ...(source === "messages" ? { branchChatId: chatId } : { advancedMemoryBlocksOnly: true }),
        ...(cursor ? { cursor } : {}),
      },
      root,
    );
    samples.push(...page.samples);
    cursor = page.nextCursor;
  } while (cursor);
  // The open piece grows with every reply. A shared piece can sort under a sibling chat's id, so the open one is the
  // piece that starts latest, not the last row.
  const open =
    source === "messages"
      ? samples.reduce<(typeof samples)[number] | undefined>(
          (latest, sample) =>
            (sample.messageRange?.first ?? -1) > (latest?.messageRange?.first ?? -1) ? sample : latest,
          undefined,
        )
      : undefined;
  // ponytail: one import's limit per source and run; the next reply imports the rest. Each run previews the whole
  // vault even when nothing is pending; upgrade to a per-chat "last imported" marker if that shows up in profiles.
  return samples
    .filter(
      (sample) =>
        sample !== open &&
        // A branch's scope lists its siblings' summaries too; only the replying chat's own are imported here.
        (source !== "chats" || sample.sourceId.startsWith(`${chatId}:`)) &&
        (sample.status === "pending" ||
          sample.freshness === "source_updated" ||
          sample.freshness === "extraction_incomplete"),
    )
    .slice(0, BATCH);
}

async function runLtmAutoImport(job: Job, key: string, signal: AbortSignal) {
  const { root, chatId, mode } = job;
  // The choice, global or this chat's, can change during the quiet period or a queued re-run.
  const config = await getLtmExtractionConfig(root);
  const chat = await getPackagePersistence().getChat(chatId);
  if (!chat) return;
  const memories = resolveLtmChatMemories(parseLtmChatMetadata(chat.metadata), config);
  if (!memories.autoImport) return;
  // The sources "Current chat" lists in Import; with chatId the import writes to the chat's own destination.
  const sourceScope = resolveChatLtmScope(chat);
  for (const source of SOURCES) {
    signal.throwIfAborted();
    const selected = await pendingSources(job, sourceScope, source);
    if (!selected.length) continue;
    const blockKey = `${key}\u0000${source}`;
    // Not freshness: a failed import writes its source note, which turns "new" into "extraction_incomplete". The
    // connection is part of it so choosing one after "needs an extraction connection" retries.
    // ponytail: an edit past the snippet that keeps the summary and range stays blocked until a source changes or a
    // manual import; a content hash on preview samples would close that.
    const signature = JSON.stringify([
      config.connectionId,
      selected.map((sample) => [sample.sourceId, sample.snippet, sample.summary, sample.messageRange?.last]),
    ]);
    if (blocked.get(blockKey) === signature) continue;
    // ponytail: nothing excludes a manual import of the same sources running alongside; the deterministic source note
    // id keeps one note, and the loser reports a retryable write failure, as with two manual imports.
    try {
      const result = await importPackageInterop(
        {
          source,
          sourceIds: selected.map((sample) => sample.sourceId),
          sourceScope,
          chatId,
          mode,
          extract: true,
          // This chat's choice decides whether safe changes are saved or wait for review.
          applyLowRisk: memories.autoAccept,
          limit: BATCH,
          // Advanced Memory scenes without a block need a model call; only the Import panel's Backfill reads them.
          ...(source === "chats" ? { advancedMemoryBlocksOnly: true } : {}),
        },
        root,
        signal,
      );
      // Deactivation returns the batch as cancelled instead of throwing; that is neither a failure nor a block.
      signal.throwIfAborted();
      // An extraction that dropped units or logged an error does not save the source's fingerprint: a new source stays
      // pending and an edited one keeps its old fingerprint, so both still show in the preview.
      const failed =
        result.writeFailures.length +
        result.imported.filter((item) => item.extractionStatus !== "succeeded" || !item.markedCurrent).length;
      const complete = failed === 0;
      if (complete) blocked.delete(blockKey);
      else blocked.set(blockKey, signature);
      const written = result.counts.sourceNotesWritten;
      const noun = source === "chats" ? ["summary", "summaries"] : ["message piece", "message pieces"];
      await recordLtmDebugEvent({
        root,
        phase: "import",
        action: "auto_import",
        status: complete ? "ok" : "error",
        chatId,
        source,
        uiSummary: complete
          ? `Imported ${written} ${noun[written === 1 ? 0 : 1]} in the background.`
          : `Background import of ${failed} ${noun[failed === 1 ? 0 : 1]} did not finish; it retries when this chat's sources change.`,
        counts: {
          imported: written,
          failed,
          applied: result.imported.reduce((sum, item) => sum + item.appliedMutationIds.length, 0),
          skipped: result.imported.reduce((sum, item) => sum + item.skippedMutationIds.length, 0),
        },
      });
    } catch (error) {
      if (signal.aborted) throw error;
      blocked.set(blockKey, signature);
      logger.warn(error, "[ltm] Background import of %s failed for chat %s", source, chatId);
      await recordLtmDebugEvent({
        root,
        phase: "import",
        action: "auto_import",
        status: "error",
        chatId,
        source,
        uiSummary:
          error instanceof LtmServiceError && error.code === "ltm_model_configuration"
            ? "Background import needs an extraction connection."
            : "Background import failed.",
        error,
      });
    }
  }
}

/** A reply in this chat: start or extend its quiet period, or run once more after the current run. */
export function armLtmAutoImport(root: string, chatId: string, mode: LtmMode) {
  if (stopped.has(resolve(root))) return;
  const key = jobKey(root, chatId);
  const job = jobs.get(key) ?? { root, chatId, mode, again: false };
  jobs.set(key, job);
  job.mode = mode;
  if (job.running) job.again = true;
  else arm(key, job);
}

/** Test hook: a run is waiting or running for this chat. */
export function isLtmAutoImportArmed(root: string, chatId: string) {
  return jobs.has(jobKey(root, chatId));
}

/** Package deactivation: drop pending imports, abort running ones, and schedule nothing more for the root. */
export async function stopLtmAutoImport(root: string) {
  const prefix = `${resolve(root)}\u0000`;
  stopped.add(resolve(root));
  const running: Array<Promise<void> | undefined> = [];
  for (const [key, job] of jobs) {
    if (!key.startsWith(prefix)) continue;
    jobs.delete(key);
    clearTimeout(job.timer);
    job.controller?.abort();
    running.push(job.running);
  }
  await Promise.all(running);
}

/** Package activation: background imports may run for the root again. */
export function resumeLtmAutoImport(root: string) {
  stopped.delete(resolve(root));
}
