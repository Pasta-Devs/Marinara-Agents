import { createHash, randomUUID } from "node:crypto";
import type {
  LtmMode,
  LtmRecallAttempt,
  LtmRecallAttemptOutcome,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { resolveLongTermMemoryRecallSettings } from "../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import { resolveChatLtmScope, ltmModeForChatMode } from "./chat-scope.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import {
  serializeLongTermMemoryPrompt,
  isLongTermMemoryPromptPresent,
  type LtmSerializedPromptArtifact,
} from "./prompt.js";
import { getLongTermMemoryDirectories, safeJoin } from "./paths.js";
import { retrieveLongTermMemory } from "./retrieval.js";
import { getLtmGlobalSettings } from "./settings.js";
import { uniqueStrings } from "./ltm-utils.js";
import { recordLongTermMemoryAttempt, recordLongTermMemoryInjection, recordLongTermMemoryZeroMatch } from "./usage.js";
import { recordLtmDebugEvent } from "./debug-log.js";
import { getPackagePersistence, logger, withKeyedLock } from "./package-runtime.js";

export type LongTermMemoryRecallReceipt = {
  version: 1;
  id: string;
  chatId: string;
  artifact: LtmSerializedPromptArtifact;
};

function pendingPath(root: string, chatId: string) {
  return safeJoin(
    getLongTermMemoryDirectories(root).events,
    `runtime-receipts/pending-${createHash("sha256").update(chatId).digest("hex")}.json`,
  );
}

const accountingLocks = new Map<string, Promise<void>>();

function parseReceipt(value: unknown): LongTermMemoryRecallReceipt | null {
  const receipt = value as LongTermMemoryRecallReceipt;
  return receipt?.version === 1 &&
    typeof receipt.id === "string" &&
    typeof receipt.chatId === "string" &&
    typeof receipt.artifact?.content === "string"
    ? receipt
    : null;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// Invocation-order timestamps, strictly increasing per chat, so two recalls
// started in the same millisecond still order by start rather than completion.
// ponytail: in-process map only, one entry per recalled chat for the process lifetime;
// a restart falls back to wall clock. Persist a sequence if cross-process order matters.
const lastAttemptAt = new Map<string, number>();
function nextRecallAttemptTimestamp(chatId: string) {
  const next = Math.max(Date.now(), (lastAttemptAt.get(chatId) ?? 0) + 1);
  lastAttemptAt.set(chatId, next);
  return new Date(next).toISOString();
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
  const attemptId = randomUUID();
  // Capture the invocation order at entry so overlapping recalls are ordered by when
  // they started, not when a slower one happened to finish.
  const startedAt = nextRecallAttemptTimestamp(input.chatId);
  const recordAttempt = (
    outcome: LtmRecallAttemptOutcome,
    options: { reason?: string; receiptId?: string; debugEnabled?: boolean } = {},
  ) =>
    recordLongTermMemoryAttempt(
      {
        version: 1,
        chatId: input.chatId,
        attemptId,
        at: startedAt,
        outcome,
        ...(options.reason ? { reason: options.reason } : {}),
        ...(options.receiptId ? { receiptId: options.receiptId } : {}),
        debugEnabled: options.debugEnabled ?? false,
      } satisfies LtmRecallAttempt,
      input.root,
    ).catch((error) => logger.warn(error, "[ltm] Failed to record recall attempt for chat %s", input.chatId));

  let chat;
  try {
    chat = await getPackagePersistence().getChat(input.chatId);
  } catch (error) {
    await recordAttempt("failed");
    throw error;
  }
  if (!chat) {
    await recordAttempt("skipped", { reason: "chat_not_found" });
    return null;
  }
  if (input.signal?.aborted) {
    await recordAttempt("cancelled");
    return null;
  }
  let recall;
  try {
    const settings = await getLtmGlobalSettings(input.root);
    recall = resolveLongTermMemoryRecallSettings({
      chatMode: input.chatMode,
      chatMetadata: metadataRecord(chat.metadata),
      globalSettings: settings,
      requestDebug: input.debugMode,
    });
  } catch (error) {
    await recordAttempt("failed");
    throw error;
  }
  const debugEnabled = recall.debugEnabled;
  const recent = input.messages.slice(-recall.contextMessages);
  const queryText = recent
    .map((message) => message.content)
    .filter(Boolean)
    .join("\n");
  if (!queryText.trim()) {
    await recordAttempt("skipped", { reason: "empty_query", debugEnabled });
    return null;
  }
  const scope = resolveChatLtmScope(chat);
  // The Engine targets one responder by sending a strict subset of a multi-character chat's ids.
  // Any other handoff keeps the chat-wide scope, including global and shared notes.
  const chatCharacterIds = uniqueStrings(scope.characterIds ?? []);
  const targetCharacterIds = uniqueStrings(input.characterIds);
  const exclusiveCharacterIds =
    chatCharacterIds.length > 1 &&
    targetCharacterIds.length > 0 &&
    targetCharacterIds.length < chatCharacterIds.length &&
    targetCharacterIds.every((id) => chatCharacterIds.includes(id))
      ? targetCharacterIds
      : undefined;
  const rejectedLimit = 20;
  const mode = ltmModeForChatMode(chat.mode) as LtmMode;
  let retrieval;
  try {
    retrieval = await retrieveLongTermMemory({
      root: input.root,
      mode,
      queryText,
      scope,
      characterIds: chat.characterIds,
      exclusiveCharacterIds,
      includeResolved: recall.includeResolved,
      maxChunks: recall.maxChunks,
      maxTokens: recall.budgetTokens,
      minScore: recall.scoreThreshold,
      semanticWeight: recall.weights.semanticWeight,
      lexicalWeight: recall.weights.lexicalWeight,
      graphWeight: recall.weights.graphWeight,
      keywordWeight: recall.weights.keywordWeight,
      explain: recall.debugEnabled,
      rejectedLimit,
      signal: input.signal,
    });
  } catch (error) {
    await recordAttempt(input.signal?.aborted ? "cancelled" : "failed", { debugEnabled });
    throw error;
  }
  const artifact = serializeLongTermMemoryPrompt(retrieval.chunks, {
    preamble: recall.recallPreamble,
    maxTokens: retrieval.maxTokens,
  });
  if (debugEnabled) {
    const selected = artifact?.chunks ?? [];
    const promptBudgetRejected = retrieval.chunks
      .filter((candidate) => !selected.includes(candidate))
      .map((candidate) => ({
        ...candidate,
        noteId: candidate.chunk.noteId,
        sectionKey: candidate.chunk.sectionKey,
        rejectionReason: "prompt_budget",
      }));
    // A full retrieval rejection list must not hide that the prompt budget,
    // rather than ranking, dropped chunks, so keep one bounded slot for it.
    const reservedPromptBudgetSlot = promptBudgetRejected.length > 0 ? 1 : 0;
    const rejected = [
      ...retrieval.rejected.slice(0, Math.max(0, rejectedLimit - reservedPromptBudgetSlot)),
      ...promptBudgetRejected,
    ].slice(0, rejectedLimit);
    const scoreThreshold = recall.scoreThreshold ?? 0;
    await recordLtmDebugEvent({
      root: input.root,
      operationId: attemptId,
      phase: "retrieval",
      action: "recall_explanation",
      status: "ok",
      uiSummary: `${selected.length} memories selected; ${rejected.length} candidates rejected.`,
      counts: {
        selected: selected.length,
        rejected: rejected.length,
        usedTokens: artifact?.estimatedTokens ?? 0,
      },
      details: {
        chatId: input.chatId,
        embeddingsAvailable: retrieval.embeddingsAvailable,
        semanticOutcome: retrieval.semanticOutcome,
        // Effective recall parameters: what the chat/host actually asked for, so a
        // missing candidate can be explained by scope or mode rather than left invisible.
        mode,
        includeResolved: recall.includeResolved,
        exclusiveCharacterTargeting: Boolean(exclusiveCharacterIds),
        contextMessages: recall.contextMessages,
        contextMessagesUsed: recent.length,
        // The recall-time index snapshot, not a later re-read of the index.
        indexLoadOutcome: retrieval.indexSnapshot.loadOutcome,
        indexGeneratedAt: retrieval.indexSnapshot.generatedAt,
        indexedChunks: retrieval.indexSnapshot.indexedChunks,
        eligibleChunks: retrieval.indexSnapshot.eligibleChunks,
        embeddedChunks: retrieval.indexSnapshot.embeddedChunks,
        rejectedLimit,
        maxChunks: recall.maxChunks,
        maxTokens: recall.budgetTokens,
        scoreThreshold,
        weights: recall.weights,
        selected: selected.map((candidate) => ({
          noteId: candidate.chunk.noteId,
          sectionKey: candidate.chunk.sectionKey,
          score: candidate.relevanceScore,
          fusedScore: candidate.score,
          relevanceScore: candidate.relevanceScore,
          thresholdPassed: candidate.relevanceScore >= scoreThreshold,
          lanes: candidate.lanes,
          reasons: candidate.reasons,
          estimatedTokens: candidate.estimatedTokens,
        })),
        rejected: rejected.map((candidate) => ({
          noteId: candidate.noteId,
          sectionKey: candidate.sectionKey,
          score: candidate.relevanceScore,
          fusedScore: candidate.score,
          relevanceScore: candidate.relevanceScore,
          thresholdPassed: candidate.relevanceScore >= scoreThreshold,
          lanes: candidate.lanes,
          reasons: candidate.reasons,
          rejectionReason: candidate.rejectionReason,
        })),
      },
    });
  }
  if (retrieval.chunks.length === 0) {
    await recordAttempt("completed", { reason: "no_matches", debugEnabled });
    await recordLongTermMemoryZeroMatch(input.chatId, input.root).catch((error) =>
      logger.warn(error, "[ltm] Failed to record zero-match recall for chat %s", input.chatId),
    );
    return null;
  }
  if (!artifact) {
    await recordAttempt("skipped", { reason: "prompt_budget", debugEnabled });
    return null;
  }
  if (input.signal?.aborted) {
    await recordAttempt("cancelled", { debugEnabled });
    input.signal.throwIfAborted();
  }
  const receipt: LongTermMemoryRecallReceipt = { version: 1, id: attemptId, chatId: input.chatId, artifact };
  await writeJsonAtomic(pendingPath(input.root, input.chatId), receipt);
  await recordAttempt("completed", { reason: "ready", receiptId: attemptId, debugEnabled });
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
  if (
    !receipt ||
    receipt.chatId !== input.chatId ||
    !isLongTermMemoryPromptPresent(input.messages, receipt.artifact.content)
  )
    return false;
  return withKeyedLock(accountingLocks, receipt.id, async () => {
    const recorded = await recordLongTermMemoryInjection(
      {
        chatId: input.chatId,
        chunks: receipt!.artifact.chunks,
        serializedTokenCount: receipt!.artifact.estimatedTokens,
        accountingId: receipt!.id,
      },
      input.root,
    );
    return recorded !== null;
  });
}
