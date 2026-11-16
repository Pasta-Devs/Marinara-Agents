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
/** A message piece whose import failed is tried again on the first reply after this, so a passing provider error heals. */
export const LTM_AUTO_IMPORT_RETRY_MS = 10 * 60_000;
/** The import request's own limit. */
const BATCH = 100;
/**
 * One source per chat, never both: a summary describes the same beats as the message pieces it summarises, so reading
 * both saved each event twice. The chat's "Read from" choice picks closed message pieces (the default) or finished
 * summaries.
 */
const SOURCES = ["messages", "chats"] as const;
type Source = (typeof SOURCES)[number];

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
 * Per chat, source and message piece, the reading that last failed, came back incomplete or waits in Review. The same
 * piece is not read again on every reply, and a newly closed piece does not drag it along; a changed piece or
 * connection, Retry in Chat Settings or LTM_AUTO_IMPORT_RETRY_MS moves it on.
 * ponytail: in-process only, so a restart retries once. Persist it if a failing model costs too much. An entry is
 * deleted only when its piece is read again and finishes, so one for a piece that became current another way (a manual
 * import, an accepted draft) stays until Retry or a restart; prune entries whose piece is no longer pending if that grows.
 */
const blocked = new Map<string, { signature: string; at: number }>();
const block = (pieceKey: string, signature: string) => blocked.set(pieceKey, { signature, at: Date.now() });

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

/**
 * A summary that stays as it is: one with a fixed message range, a Game previous-session summary, or a Conversation day
 * or week summary whose period has ended. The legacy single summary, "last N messages" and an agent summary are
 * rewritten as the chat grows, so reading one would extract it again on every rewrite; they stay a manual import.
 */
export function isFinishedSummary(sample: LtmInteropPreviewResponse["samples"][number]) {
  if (sample.messageRange || sample.sourceId.includes(":game-session-")) return true;
  const period = sample.sourceId.match(/:(day|week):(\d{2})\.(\d{2})\.(\d{4})$/u);
  if (!period) return false;
  const [, kind, day, month, year] = period;
  return new Date(Number(year), Number(month) - 1, Number(day) + (kind === "week" ? 7 : 1)).getTime() <= Date.now();
}

/**
 * This chat's source rows that are new or changed since their import. Message pieces leave out the piece still being
 * written and one that ends within the chat's newest `leave` messages; summaries keep only the finished ones.
 */
async function pendingSources({ root, chatId, mode }: Job, sourceScope: LtmScope, source: Source, leave: number) {
  const samples: LtmInteropPreviewResponse["samples"] = [];
  let cursor: string | null | undefined;
  do {
    const page = await previewPackageInterop(
      {
        source,
        limit: BATCH,
        sourceScope,
        mode,
        branchChatId: chatId,
        ...(cursor ? { cursor } : {}),
      },
      root,
    );
    samples.push(...page.samples);
    cursor = page.nextCursor;
  } while (cursor);
  const unread = (sample: (typeof samples)[number]) =>
    sample.status === "pending" ||
    sample.freshness === "source_updated" ||
    sample.freshness === "extraction_incomplete";
  // The group scope also lists the summaries of this chat's sibling branches; a branch reads only its own, as it does
  // for message pieces. A summary's source id is `<chat id>:<entry id>`.
  if (source === "chats")
    return samples.filter(
      (sample) => sample.sourceId.startsWith(`${chatId}:`) && isFinishedSummary(sample) && unread(sample),
    );
  // The open piece grows with every reply. A shared piece can sort under a sibling chat's id, so the open one is the
  // piece that starts latest, not the last row.
  const open = samples.reduce<(typeof samples)[number] | undefined>(
    (latest, sample) => ((sample.messageRange?.first ?? -1) > (latest?.messageRange?.first ?? -1) ? sample : latest),
    undefined,
  );
  // ponytail: one import's limit per source and run; the next reply imports the rest. Each run previews the whole
  // vault even when nothing is pending; upgrade to a per-chat "last imported" marker if that shows up in profiles.
  // The open piece ends at the chat's newest readable message.
  const newest = open?.messageRange?.last ?? 0;
  return samples.filter(
    (sample) => sample !== open && (sample.messageRange?.last ?? 0) <= newest - leave && unread(sample),
  );
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
  const source: Source = memories.readFrom === "summaries" ? "chats" : "messages";
  signal.throwIfAborted();
  const blockPrefix = `${key}\u0000${source}\u0000`;
  // Not freshness: a failed import writes its source note, which turns "new" into "extraction_incomplete". The
  // connection is part of it so choosing one after "needs an extraction connection" retries.
  // ponytail: an edit past the snippet that keeps the summary and range stays blocked until Retry, a manual import or
  // LTM_AUTO_IMPORT_RETRY_MS; a content hash on preview samples would close that.
  const signatureOf = (sample: LtmInteropPreviewResponse["samples"][number]) =>
    JSON.stringify([config.connectionId, sample.snippet, sample.summary, sample.messageRange?.last]);
  const selected = (await pendingSources(job, sourceScope, source, config.autoImportLeaveMessages))
    .filter((sample) => {
      const previous = blocked.get(blockPrefix + sample.sourceId);
      return !(previous?.signature === signatureOf(sample) && Date.now() - previous.at < LTM_AUTO_IMPORT_RETRY_MS);
    })
    .slice(0, BATCH);
  if (!selected.length) return;
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
      },
      root,
      signal,
      // A reply must not replace memories still waiting in Review with a second reading of the same text.
      { keepPendingDrafts: true },
    );
    // Deactivation returns the batch as cancelled instead of throwing; that is neither a failure nor a block.
    signal.throwIfAborted();
    // A piece that was not read (its draft waits in Review), failed or was not marked current rests; one that
    // finished is forgotten. A piece the import did not report keeps whatever it had.
    const writeFailed = new Set(result.writeFailures.map((failure) => failure.sourceId));
    const results = new Map(result.imported.map((item) => [item.sourceId, item]));
    for (const sample of selected) {
      const item = results.get(sample.sourceId);
      if (writeFailed.has(sample.sourceId) || (item && (item.extractionStatus !== "succeeded" || !item.markedCurrent)))
        block(blockPrefix + sample.sourceId, signatureOf(sample));
      else if (item) blocked.delete(blockPrefix + sample.sourceId);
    }
    // An extraction that stopped early, failed or kept nothing does not save the source's fingerprint: a new source
    // stays pending and an edited one keeps its old fingerprint, so both still show in the preview. A source whose
    // draft still waits in Review is not extracted again (not_started) and is not a failure.
    const failed =
      result.writeFailures.length +
      result.imported.filter(
        (item) =>
          item.extractionStatus !== "not_started" && (item.extractionStatus !== "succeeded" || !item.markedCurrent),
      ).length;
    const noun = source === "chats" ? ["summary", "summaries"] : ["message piece", "message pieces"];
    // Sources whose draft still waits in Review were written but not read.
    const written = result.imported.filter((item) => item.extractionStatus !== "not_started").length;
    const waiting = result.imported.length - written;
    // Only sources waiting in Review: they rest until they change, Retry or LTM_AUTO_IMPORT_RETRY_MS instead of
    // being written again on every reply. The ok event replaces an earlier error in Chat Settings.
    if (!failed && !written && waiting) {
      await recordLtmDebugEvent({
        root,
        phase: "import",
        action: "auto_import",
        status: "ok",
        chatId,
        source,
        uiSummary: `Background import left ${waiting} ${noun[waiting === 1 ? 0 : 1]} alone: their memories wait in Review.`,
        counts: { imported: 0, waiting },
      });
      return;
    }
    const complete = failed === 0;
    // The first failed piece's reason, so Chat Settings can say why reading stopped.
    const reason = result.imported.find((item) => item.extractionStatus === "failed")?.error;
    await recordLtmDebugEvent({
      root,
      phase: "import",
      action: "auto_import",
      status: complete ? "ok" : "error",
      chatId,
      source,
      uiSummary: complete
        ? `Imported ${written} ${noun[written === 1 ? 0 : 1]} in the background.`
        : `Background import of ${failed} ${noun[failed === 1 ? 0 : 1]} did not finish; it is tried again on Retry or after ten minutes.`,
      counts: {
        imported: written,
        failed,
        applied: result.imported.reduce((sum, item) => sum + item.appliedMutationIds.length, 0),
        skipped: result.imported.reduce((sum, item) => sum + item.skippedMutationIds.length, 0),
      },
      ...(reason ? { error: Object.assign(new Error(reason.message), { code: reason.code }) } : {}),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    for (const sample of selected) block(blockPrefix + sample.sourceId, signatureOf(sample));
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

/**
 * Retry in Chat Settings: forget this chat's failed pieces (of both sources, so a chat switched meanwhile retries too)
 * and import again after the quiet period.
 */
export function retryLtmAutoImport(root: string, chatId: string, mode: LtmMode) {
  const key = jobKey(root, chatId);
  for (const source of SOURCES) {
    const prefix = `${key}\u0000${source}\u0000`;
    for (const pieceKey of blocked.keys()) if (pieceKey.startsWith(prefix)) blocked.delete(pieceKey);
  }
  armLtmAutoImport(root, chatId, mode);
}

/** A background read of this chat's messages or summaries is running or queued (waiting out its quiet period). */
export function isLtmAutoImportReading(root: string, chatId: string) {
  return jobs.has(jobKey(root, chatId));
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
