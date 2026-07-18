import { createHash, randomUUID } from "node:crypto";
import type { LtmMode } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { resolveChatLtmScope, ltmModeForChatMode } from "./chat-scope.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { serializeLongTermMemoryPrompt, isLongTermMemoryPromptPresent, type LtmSerializedPromptArtifact } from "./prompt.js";
import { getLongTermMemoryDirectories, safeJoin } from "./paths.js";
import { retrieveLongTermMemory } from "./retrieval.js";
import { getLtmGlobalSettings } from "./settings.js";
import { recordLongTermMemoryInjection } from "./usage.js";
import { withKeyedLock } from "./package-runtime.js";

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

export async function prepareGenerationLongTermMemory(input: {
  root: string;
  chatId: string;
  chatMode: string;
  characterIds: string[];
  messages: Array<{ role: string; content: string }>;
  signal?: AbortSignal;
}) {
  const settings = await getLtmGlobalSettings(input.root);
  if (!settings.enableLongTermMemory || input.signal?.aborted) return null;
  const recent = input.messages.slice(-settings.longTermMemoryRecallContextMessages);
  const queryText = recent.map((message) => message.content).filter(Boolean).join("\n");
  if (!queryText.trim()) return null;
  const scope = resolveChatLtmScope({ id: input.chatId, characterIds: input.characterIds });
  const retrieval = await retrieveLongTermMemory({
    root: input.root,
    mode: ltmModeForChatMode(input.chatMode) as LtmMode,
    queryText,
    scope,
    characterIds: input.characterIds,
    includeResolved: settings.longTermMemoryIncludeResolved,
    maxChunks: settings.longTermMemoryMaxChunks,
    maxTokens: settings.longTermMemoryBudgetTokens,
    minScore: settings.longTermMemoryScoreThreshold,
    semanticWeight: settings.longTermMemorySemanticWeight,
    lexicalWeight: settings.longTermMemoryLexicalWeight,
    graphWeight: settings.longTermMemoryGraphWeight,
    keywordWeight: settings.longTermMemoryKeywordWeight,
    signal: input.signal,
  });
  const artifact = serializeLongTermMemoryPrompt(retrieval.chunks, {
    preamble: settings.longTermMemoryRecallPreamble,
    maxTokens: retrieval.maxTokens,
  });
  if (!artifact) return null;
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
