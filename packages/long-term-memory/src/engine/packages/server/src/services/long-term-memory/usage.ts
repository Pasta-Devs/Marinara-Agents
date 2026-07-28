import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { ltmUsageSchema, type LtmUsage } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import type { LtmBudgetedChunk } from "./budget.js";
import { isEnoent } from "./ltm-utils.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
import { withKeyedLock } from "./package-runtime.js";
import { withLtmVaultLock } from "./vault-lock.js";
type Usage = LtmUsage;
const empty = (): Usage => ({ version: 2, chats: {} });
function parseUsage(value: unknown): Usage { return ltmUsageSchema.parse(value); }
export const longTermMemoryUsagePath = (root = getLongTermMemoryRoot()) => safeJoin(getLongTermMemoryDirectories(root).indexes, "usage.json");
export const longTermMemoryInjectionReceiptPath = (chatId: string, root = getLongTermMemoryRoot()) => safeJoin(getLongTermMemoryDirectories(root).receipts, `${createHash("sha256").update(chatId).digest("hex")}.json`);
export function parseLongTermMemoryInjectionReceipt(value: unknown) { const v = value as any; if (!v || v.version !== 1 || typeof v.chatId !== "string" || !v.chatId || typeof v.dispatchedAt !== "string" || !Number.isFinite(Date.parse(v.dispatchedAt)) || !Number.isInteger(v.serializedTokenCount) || !Array.isArray(v.chunks)) throw new Error("Malformed long-term memory injection receipt."); return v; }
export async function readLongTermMemoryUsage(root = getLongTermMemoryRoot()) { return parseUsage(await readJsonFile(longTermMemoryUsagePath(root), empty())); }
export async function validateLongTermMemoryUsage(root = getLongTermMemoryRoot()) { return readLongTermMemoryUsage(root); }
export async function validateLongTermMemoryInjectionReceipts(root = getLongTermMemoryRoot()) { const dir = getLongTermMemoryDirectories(root).receipts; const entries = await readdir(dir, { withFileTypes: true }).catch((e) => { if (isEnoent(e)) return []; throw e; }); for (const entry of entries) if (entry.isFile() && entry.name.endsWith(".json")) { const receipt = parseLongTermMemoryInjectionReceipt(JSON.parse(await readFile(safeJoin(dir, entry.name), "utf8"))); if (basename(longTermMemoryInjectionReceiptPath(receipt.chatId, root)) !== entry.name) throw new Error(`Long-term memory receipt filename does not match chat ${receipt.chatId}.`); } }
export async function readLongTermMemoryInjectionReceipt(chatId:string,root=getLongTermMemoryRoot()){return readJsonFile(longTermMemoryInjectionReceiptPath(chatId,root),null).then((value)=>value?parseLongTermMemoryInjectionReceipt(value):null);}

const usageLocks = new Map<string, Promise<void>>();

export async function recordLongTermMemoryInjection(
  input: { chatId: string; chunks: LtmBudgetedChunk[]; serializedTokenCount: number; accountingId?: string },
  root = getLongTermMemoryRoot(),
) {
  const chatId = input.chatId.trim();
  const chunks = Array.from(new Map(input.chunks.map((item) => [item.chunk.id, item])).values());
  if (!chatId || chunks.length === 0) return null;
  return withLtmVaultLock(root, () => withKeyedLock(usageLocks, longTermMemoryUsagePath(root), async () => {
    const usage = await readLongTermMemoryUsage(root);
    if (input.accountingId && usage.acceptedReceipts?.[input.accountingId]) return null;
    const chat = usage.chats[chatId] ?? { chunks: {} };
    const now = new Date().toISOString();
    for (const item of chunks) {
      const previous = chat.chunks[item.chunk.id];
      chat.chunks[item.chunk.id] = {
        chunkId: item.chunk.id,
        noteId: item.chunk.noteId,
        sectionKey: item.chunk.sectionKey,
        lastRetrievedAt: now,
        lastInjectedAt: now,
        retrievalCount: (previous?.retrievalCount ?? 0) + 1,
        injectionCount: (previous?.injectionCount ?? 0) + 1,
        totalInjectedTokens: (previous?.totalInjectedTokens ?? 0) + Math.max(0, Math.floor(item.estimatedTokens)),
      };
    }
    usage.chats[chatId] = chat;
    if (input.accountingId) {
      usage.acceptedReceipts = { ...(usage.acceptedReceipts ?? {}), [input.accountingId]: now };
    }
    await writeJsonAtomic(longTermMemoryUsagePath(root), usage);
    const receipt = {
      version: 1,
      chatId,
      dispatchedAt: now,
      serializedTokenCount: Math.max(0, Math.floor(input.serializedTokenCount)),
      chunks: chunks.map((item) => ({ chunkId: item.chunk.id, noteId: item.chunk.noteId, sectionKey: item.chunk.sectionKey, tokenCount: item.estimatedTokens })),
    };
    await writeJsonAtomic(longTermMemoryInjectionReceiptPath(chatId, root), receipt);
    return receipt;
  }));
}
