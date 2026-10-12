import { createHash } from "node:crypto";
import {
  ltmRecallAttemptSchema,
  ltmUsageSchema,
  type LtmRecallAttempt,
  type LtmUsage,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import type { LtmBudgetedChunk } from "./budget.js";
import { quarantineLtmIndexArtifact } from "./index-quarantine.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
import { logger, withKeyedLock } from "./package-runtime.js";
import { withLtmVaultLock } from "./vault-lock.js";
type Usage = LtmUsage;
const empty = (): Usage => ({ version: 2, chats: {} });
function parseUsage(value: unknown): Usage {
  return ltmUsageSchema.parse(value);
}
export const longTermMemoryUsagePath = (root = getLongTermMemoryRoot()) =>
  safeJoin(getLongTermMemoryDirectories(root).indexes, "usage.json");
export const longTermMemoryInjectionReceiptPath = (chatId: string, root = getLongTermMemoryRoot()) =>
  safeJoin(getLongTermMemoryDirectories(root).receipts, `${createHash("sha256").update(chatId).digest("hex")}.json`);
export function parseLongTermMemoryInjectionReceipt(value: unknown) {
  const v = value as any;
  if (
    !v ||
    v.version !== 1 ||
    typeof v.chatId !== "string" ||
    !v.chatId ||
    (v.attemptId !== undefined && typeof v.attemptId !== "string") ||
    typeof v.dispatchedAt !== "string" ||
    !Number.isFinite(Date.parse(v.dispatchedAt)) ||
    !Number.isInteger(v.serializedTokenCount) ||
    !Array.isArray(v.chunks)
  )
    throw new Error("Malformed long-term memory injection receipt.");
  return v;
}
export async function readLongTermMemoryUsage(root = getLongTermMemoryRoot()) {
  const path = longTermMemoryUsagePath(root);
  try {
    return parseUsage(await readJsonFile(path, empty()));
  } catch (error) {
    // The file only holds per-chat injection stats and the receipt de-duplication list, so
    // malformed content is set aside and restarted rather than failing recall and activation.
    // An I/O failure is rethrown: the file may be intact.
    if (!(error instanceof SyntaxError || (error as { name?: string } | null)?.name === "ZodError")) throw error;
    logger.warn(error, "[ltm] Quarantined malformed usage.json; usage statistics restart from empty");
    // Setting the file aside keeps the original recoverable. If that fails, surface it rather than
    // return empty statistics that the next write would use to replace the only copy.
    await quarantineLtmIndexArtifact(root, path);
    return empty();
  }
}
export async function readLongTermMemoryInjectionReceipt(chatId: string, root = getLongTermMemoryRoot()) {
  return readJsonFile(longTermMemoryInjectionReceiptPath(chatId, root), null).then((value) =>
    value ? parseLongTermMemoryInjectionReceipt(value) : null,
  );
}
export const longTermMemoryAttemptPath = (chatId: string, root = getLongTermMemoryRoot()) =>
  safeJoin(
    getLongTermMemoryDirectories(root).events,
    `runtime-receipts/attempt-${createHash("sha256").update(chatId).digest("hex")}.json`,
  );
export async function readLongTermMemoryAttempt(chatId: string, root = getLongTermMemoryRoot()) {
  const value = await readJsonFile(longTermMemoryAttemptPath(chatId, root), null);
  if (!value) return null;
  const parsed = ltmRecallAttemptSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
const attemptLocks = new Map<string, Promise<void>>();
export async function recordLongTermMemoryAttempt(attempt: LtmRecallAttempt, root = getLongTermMemoryRoot()) {
  const chatId = attempt.chatId.trim();
  if (!chatId) return null;
  return withKeyedLock(attemptLocks, longTermMemoryAttemptPath(chatId, root), async () => {
    const existing = await readLongTermMemoryAttempt(chatId, root);
    // A slow older recall must not overwrite a newer attempt's observed outcome.
    if (existing && Date.parse(existing.at) > Date.parse(attempt.at)) return existing;
    const value = ltmRecallAttemptSchema.parse({ ...attempt, chatId });
    await writeJsonAtomic(longTermMemoryAttemptPath(chatId, root), value);
    return value;
  });
}

/**
 * Record a timestamped negative-recall receipt so the client can distinguish
 * "recall ran and found nothing" from "recall never ran". The usage accounting
 * path above skips empty injections, so a zero-match recall must write its own
 * receipt directly.
 */
export async function recordLongTermMemoryZeroMatch(chatId: string, root = getLongTermMemoryRoot()) {
  const trimmed = chatId.trim();
  if (!trimmed) return null;
  const receipt = {
    version: 1,
    chatId: trimmed,
    dispatchedAt: new Date().toISOString(),
    serializedTokenCount: 0,
    chunks: [],
  };
  await writeJsonAtomic(longTermMemoryInjectionReceiptPath(trimmed, root), receipt);
  return receipt;
}

const usageLocks = new Map<string, Promise<void>>();

export async function recordLongTermMemoryInjection(
  input: { chatId: string; chunks: LtmBudgetedChunk[]; serializedTokenCount: number; accountingId?: string },
  root = getLongTermMemoryRoot(),
) {
  const chatId = input.chatId.trim();
  const chunks = Array.from(new Map(input.chunks.map((item) => [item.chunk.id, item])).values());
  if (!chatId || chunks.length === 0) return null;
  return withLtmVaultLock(root, () =>
    withKeyedLock(usageLocks, longTermMemoryUsagePath(root), async () => {
      const usage = await readLongTermMemoryUsage(root);
      const acceptedReceipts = new Map(Object.entries(usage.acceptedReceipts ?? {}));
      if (input.accountingId && acceptedReceipts.has(input.accountingId)) return null;
      const chats = new Map(Object.entries(usage.chats));
      const chat = chats.get(chatId) ?? { chunks: {} };
      const chatChunks = new Map(Object.entries(chat.chunks));
      const now = new Date().toISOString();
      for (const item of chunks) {
        const previous = chatChunks.get(item.chunk.id);
        chatChunks.set(item.chunk.id, {
          chunkId: item.chunk.id,
          noteId: item.chunk.noteId,
          sectionKey: item.chunk.sectionKey,
          lastRetrievedAt: now,
          lastInjectedAt: now,
          retrievalCount: (previous?.retrievalCount ?? 0) + 1,
          injectionCount: (previous?.injectionCount ?? 0) + 1,
          totalInjectedTokens: (previous?.totalInjectedTokens ?? 0) + Math.max(0, Math.floor(item.estimatedTokens)),
        });
      }
      chat.chunks = Object.fromEntries(chatChunks);
      chats.set(chatId, chat);
      usage.chats = Object.fromEntries(chats);
      if (input.accountingId) {
        acceptedReceipts.set(input.accountingId, now);
        usage.acceptedReceipts = Object.fromEntries(acceptedReceipts);
      }
      await writeJsonAtomic(longTermMemoryUsagePath(root), usage);
      const receipt = {
        version: 1,
        chatId,
        ...(input.accountingId ? { attemptId: input.accountingId } : {}),
        dispatchedAt: now,
        serializedTokenCount: Math.max(0, Math.floor(input.serializedTokenCount)),
        chunks: chunks.map((item) => ({
          chunkId: item.chunk.id,
          noteId: item.chunk.noteId,
          sectionKey: item.chunk.sectionKey,
          tokenCount: item.estimatedTokens,
        })),
      };
      await writeJsonAtomic(longTermMemoryInjectionReceiptPath(chatId, root), receipt);
      return receipt;
    }),
  );
}
