import { createHash, randomUUID } from "node:crypto";
import type { LtmMode } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { resolveLongTermMemoryRecallSettings } from "../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import { resolveChatLtmScope, ltmModeForChatMode } from "./chat-scope.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { serializeLongTermMemoryPrompt, isLongTermMemoryPromptPresent, type LtmSerializedPromptArtifact } from "./prompt.js";
import { getLongTermMemoryDirectories, safeJoin } from "./paths.js";
import { retrieveLongTermMemory } from "./retrieval.js";
import { getLtmGlobalSettings } from "./settings.js";
import { recordLongTermMemoryInjection } from "./usage.js";
import { recordLtmDebugEvent } from "./debug-log.js";
import { getPackagePersistence, withKeyedLock } from "./package-runtime.js";

export type LongTermMemoryRecallReceipt = {
  version: 1;
  id: string;
  chatId: string;
  artifact: LtmSerializedPromptArtifact;
};

function pendingPath(root: string, chatId: string) {
  return safeJoin(getLongTermMemoryDirectories(root).events, `runtime-receipts/pending-${createHash("sha256").update(chatId).digest("hex")}.json`);
}

const accountingLocks = new Map<string, Promise<void>>();

function parseReceipt(value: unknown): LongTermMemoryRecallReceipt | null {
  const receipt = value as LongTermMemoryRecallReceipt;
  return receipt?.version === 1 && typeof receipt.id === "string" && typeof receipt.chatId === "string" && typeof receipt.artifact?.content === "string"
    ? receipt
    : null;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function prepareGenerationLongTermMemory(input: {
  root: string;
  chatId: string;
  chatMode: string;
  characterIds: string[];
  messages: Array<{ role: string; content: string }>;
  signal?: AbortSignal;
  debugMode?: boolean;
}) {
  const chat = await getPackagePersistence().getChat(input.chatId);
  if (!chat || input.signal?.aborted) return null;
  const settings = await getLtmGlobalSettings(input.root);
  const recall = resolveLongTermMemoryRecallSettings({
    chatMode: input.chatMode,
    chatMetadata: metadataRecord(chat.metadata),
    globalSettings: settings,
    requestDebug: input.debugMode,
  });
  const recent = input.messages.slice(-recall.contextMessages);
  const queryText = recent.map((message) => message.content).filter(Boolean).join("\n");
  if (!queryText.trim()) return null;
  const scope = resolveChatLtmScope(chat);
  const retrieval = await retrieveLongTermMemory({
    root: input.root,
    mode: ltmModeForChatMode(chat.mode) as LtmMode,
    queryText,
    scope,
    characterIds: chat.characterIds,
    includeResolved: recall.includeResolved,
    maxChunks: recall.maxChunks,
    maxTokens: recall.budgetTokens,
    minScore: recall.scoreThreshold,
    semanticWeight: recall.weights.semanticWeight,
    lexicalWeight: recall.weights.lexicalWeight,
    graphWeight: recall.weights.graphWeight,
    keywordWeight: recall.weights.keywordWeight,
    explain: recall.debugEnabled,
    rejectedLimit: 20,
    signal: input.signal,
  });
  const artifact = serializeLongTermMemoryPrompt(retrieval.chunks, {
    preamble: recall.recallPreamble,
    maxTokens: retrieval.maxTokens,
  });
  if (!artifact) return null;
  if (recall.debugEnabled) {
    await recordLtmDebugEvent({
      root: input.root,
      phase: "retrieval",
      action: "recall_explanation",
      status: "ok",
      uiSummary: `${retrieval.chunks.length} memories selected; ${retrieval.rejected.length} candidates rejected.`,
      counts: {
        selected: retrieval.chunks.length,
        rejected: retrieval.rejected.length,
        usedTokens: retrieval.usedTokens,
      },
      details: {
        chatId: input.chatId,
        embeddingsAvailable: retrieval.embeddingsAvailable,
        maxChunks: recall.maxChunks,
        maxTokens: recall.budgetTokens,
        scoreThreshold: recall.scoreThreshold,
        weights: recall.weights,
        selected: retrieval.chunks.map((candidate) => ({
          noteId: candidate.chunk.noteId,
          sectionKey: candidate.chunk.sectionKey,
          score: candidate.relevanceScore,
          lanes: candidate.lanes,
          reasons: candidate.reasons,
          estimatedTokens: candidate.estimatedTokens,
        })),
        rejected: retrieval.rejected.map((candidate) => ({
          noteId: candidate.noteId,
          sectionKey: candidate.sectionKey,
          score: candidate.relevanceScore,
          lanes: candidate.lanes,
          reasons: candidate.reasons,
          rejectionReason: candidate.rejectionReason,
        })),
      },
    });
  }
  const receipt: LongTermMemoryRecallReceipt = { version: 1, id: randomUUID(), chatId: input.chatId, artifact };
  await writeJsonAtomic(pendingPath(input.root, input.chatId), receipt);
  return { text: artifact.content, receipt };
}

export async function recordGenerationLongTermMemoryDispatch(input: {
  root: string;
  chatId: string;
  receipt: unknown;
  messages: Array<{ content: string }>;
}) {
  let receipt = parseReceipt(input.receipt);
  if (!receipt) receipt = parseReceipt(await readJsonFile(pendingPath(input.root, input.chatId), null));
  if (!receipt || receipt.chatId !== input.chatId || !isLongTermMemoryPromptPresent(input.messages, receipt.artifact.content)) return false;
  return withKeyedLock(accountingLocks, receipt.id, async () => {
    const recorded = await recordLongTermMemoryInjection({
      chatId: input.chatId,
      chunks: receipt!.artifact.chunks,
      serializedTokenCount: receipt!.artifact.estimatedTokens,
      accountingId: receipt!.id,
    }, input.root);
    return recorded !== null;
  });
}
