import { createHash, randomUUID } from "node:crypto";
import {
  DEFAULT_LTM_GLOBAL_SETTINGS,
  type LtmMode,
  type LtmRecallAttempt,
  type LtmRecallAttemptOutcome,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  resolveLongTermMemoryRecallSettings,
  resolveLtmChatMemories,
} from "../../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import {
  inheritedBranchLtmNoteIds,
  ltmModeForChatMode,
  ltmSourceLastMessageNumber,
  parseLtmChatMetadata,
  resolveChatLtmScope,
  sharedLtmMessageCounts,
} from "../identity/chat-scope.js";
import { readJsonFile, writeJsonAtomic } from "../persistence/atomic-json.js";
import {
  estimateLongTermMemoryPromptOverhead,
  serializeLongTermMemoryPrompt,
  isLongTermMemoryPromptPresent,
  type LtmSerializedPromptArtifact,
} from "./prompt.js";
import { getLongTermMemoryDirectories, safeJoin } from "../persistence/paths.js";
import { retrieveLongTermMemory } from "./retrieval.js";
import { getLtmGlobalSettings } from "../settings.js";
import { uniqueStrings } from "../ltm-utils.js";
import { recordLongTermMemoryAttempt, recordLongTermMemoryInjection, recordLongTermMemoryZeroMatch } from "./usage.js";
import { recordLtmDebugEvent } from "../maintenance/debug-log.js";
import { getPackagePersistence, logger, withKeyedLock } from "../package-runtime.js";
import { hideBranchCopiesOnce, summaries } from "../sources/interop.js";
import { outsideLtmVaultLock } from "../persistence/vault-lock.js";
import { armLtmAutoImport } from "../sources/auto-import-job.js";
import { getLtmExtractionConfig } from "../extraction/extraction-config.js";
import { LongTermMemoryStorage } from "../persistence/storage.js";

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

// Issue #1433: the memories a branch shares with the other branches of its conversation, through
// copied summary entries and through the messages the two chats share from the start. Day, week and
// game-session ids are date or sequence keys that two branches can each write after the split, so only
// rolling summary entries, which Engine copies by id, count by id. Unbranched chats do no extra work.
// A failed lookup (#1442) falls back to the branch's own memories instead of failing the recall,
// unless the request was aborted.
export async function branchInheritedNoteIds(
  root: string,
  chat: { id: string; groupId: string | null; metadata: unknown },
  mode: LtmMode,
  signal?: AbortSignal,
) {
  if (!chat.groupId) return undefined;
  const summaryEntryIds = new Set(
    summaries(parseLtmChatMetadata(chat.metadata), mode)
      .filter((entry) => entry.origin !== "conversation_summary" && entry.origin !== "game_session")
      .map((entry) => entry.id),
  );
  try {
    // ponytail: every reply in a grouped chat lists all chats and reads every note, and lists the
    // messages of the chats whose numbered sources it must place. Upgrade path: an Engine lookup of one
    // group's chats, reusing the cached vault notes snapshot, and caching fork positions per branch.
    const persistence = getPackagePersistence();
    const groupChats = (await persistence.listChats()).filter(
      (other) => other.groupId === chat.groupId && other.id !== chat.id,
    );
    const branchChatIds = groupChats.map((other) => other.id);
    if (!branchChatIds.length) return undefined;
    const notes = await new LongTermMemoryStorage(root).listNotes({ skipInvalid: true });
    const numberedSourceChatIds = notes.flatMap((note) =>
      note.provenance && branchChatIds.includes(note.provenance.sourceId) && ltmSourceLastMessageNumber(note)
        ? [note.provenance.sourceId]
        : [],
    );
    // A failed message lookup still shares the summaries (#1433), with a warning.
    const sharedMessageCounts = numberedSourceChatIds.length
      ? await sharedLtmMessageCounts({
          chatId: chat.id,
          chats: [chat, ...groupChats],
          otherChatIds: numberedSourceChatIds,
          listMessages: (chatId) => persistence.listMessages(chatId),
        }).catch((error) => {
          if (signal?.aborted) throw error;
          logger.warn(error, "[ltm] Shared-message lookup failed for chat %s; sharing summaries only", chat.id);
          return undefined;
        })
      : undefined;
    return inheritedBranchLtmNoteIds({ chatId: chat.id, branchChatIds, summaryEntryIds, notes, sharedMessageCounts });
  } catch (error) {
    if (signal?.aborted) throw error;
    logger.warn(error, "[ltm] Shared-history lookup failed for chat %s; recalling its own memories", chat.id);
    return undefined;
  }
}

// The meaning search embeds the newest messages, not the whole window: the local embedder cuts its input
// at 512 tokens, so a ten-message window would be read as its oldest one to three messages. Whole messages
// are kept, newest first, while the text fits; the newest message is always kept, cut from its end
// backwards when it alone is longer. The result is in chat order.
// ponytail: the budget is a character estimate for a 512-token local model. Upgrade path: ask the
// embedding adapter for its input limit.
const LTM_VECTOR_QUERY_CHAR_BUDGET = 1600;

export function newestMessagesVectorQuery(contents: readonly string[], budget = LTM_VECTOR_QUERY_CHAR_BUDGET) {
  const kept: string[] = [];
  let length = 0;
  for (let index = contents.length - 1; index >= 0; index -= 1) {
    if (!contents[index]!.trim()) continue;
    const next = length + contents[index]!.length + (kept.length ? 1 : 0);
    if (kept.length && next > budget) break;
    kept.unshift(contents[index]!);
    length = next;
  }
  const text = kept.join("\n");
  return { text: text.length > budget ? text.slice(-budget) : text, messages: kept.length };
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
  const recentContents = recent.map((message) => message.content).filter(Boolean);
  const queryText = recentContents.join("\n");
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
  // The serializer adds framing, preamble, labels and escaping on top of chunk text.
  // Reserve that fixed overhead in the retrieval budget so its refill can consider the
  // chunks that still fit. When the overhead alone fills the budget, keep the raw budget
  // so the serializer still reports a prompt-budget skip instead of an empty no-match.
  const budgetTokens = recall.budgetTokens ?? DEFAULT_LTM_GLOBAL_SETTINGS.longTermMemoryBudgetTokens;
  const promptOverheadTokens = estimateLongTermMemoryPromptOverhead(recall.recallPreamble);
  const retrievalBudgetTokens =
    budgetTokens > promptOverheadTokens ? budgetTokens - promptOverheadTokens : budgetTokens;
  const vectorQuery = newestMessagesVectorQuery(recentContents);
  let retrieval;
  try {
    const inheritedNoteIds = await branchInheritedNoteIds(input.root, chat, mode, input.signal);
    retrieval = await retrieveLongTermMemory({
      root: input.root,
      mode,
      queryText,
      vectorQueryText: vectorQuery.text,
      scope,
      characterIds: chat.characterIds,
      exclusiveCharacterIds,
      includeResolved: recall.includeResolved,
      maxTokens: retrievalBudgetTokens,
      promptNormalizedEstimate: true,
      minScore: recall.scoreThreshold,
      semanticWeight: recall.weights.semanticWeight,
      lexicalWeight: recall.weights.lexicalWeight,
      graphWeight: recall.weights.graphWeight,
      keywordWeight: recall.weights.keywordWeight,
      explain: recall.debugEnabled,
      rejectedLimit,
      inheritedNoteIds,
      signal: input.signal,
    });
  } catch (error) {
    await recordAttempt(input.signal?.aborted ? "cancelled" : "failed", { debugEnabled });
    throw error;
  }
  // Hands-off import runs after the reply's recall and never delays or fails it.
  void getLtmExtractionConfig(input.root)
    .then((config) => {
      if (resolveLtmChatMemories(parseLtmChatMetadata(chat.metadata), config).autoImport)
        armLtmAutoImport(input.root, input.chatId, mode);
    })
    .catch((error) => logger.warn(error, "[ltm] Could not schedule background import for chat %s", input.chatId));
  void outsideLtmVaultLock(() => hideBranchCopiesOnce(input.root, chat)).catch((error) =>
    logger.warn(error, "[ltm] Could not hide branch messages from the AI for chat %s", input.chatId),
  );
  const artifact = serializeLongTermMemoryPrompt(retrieval.chunks, {
    preamble: recall.recallPreamble,
    maxTokens: budgetTokens,
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
      uiSummary: retrieval.skippedUnrelated
        ? "No memories selected: none is close enough to the latest messages."
        : `${selected.length} memories selected; ${rejected.length} candidates rejected.`,
      counts: {
        selected: selected.length,
        rejected: rejected.length,
        usedTokens: artifact?.estimatedTokens ?? 0,
      },
      details: {
        chatId: input.chatId,
        embeddingsAvailable: retrieval.embeddingsAvailable,
        semanticOutcome: retrieval.semanticOutcome,
        // Set when the whole recall was skipped as unrelated, so an empty recall is explainable.
        skipReason: retrieval.skippedUnrelated ? "unrelated_to_latest_messages" : undefined,
        // Effective recall parameters: what the chat/host actually asked for, so a
        // missing candidate can be explained by scope or mode rather than left invisible.
        mode,
        includeResolved: recall.includeResolved,
        exclusiveCharacterTargeting: Boolean(exclusiveCharacterIds),
        contextMessages: recall.contextMessages,
        contextMessagesUsed: recent.length,
        // The meaning search reads only the newest of those messages, so say how many.
        vectorQueryMessages: vectorQuery.messages,
        // The recall-time index snapshot, not a later re-read of the index.
        indexLoadOutcome: retrieval.indexSnapshot.loadOutcome,
        indexGeneratedAt: retrieval.indexSnapshot.generatedAt,
        indexedChunks: retrieval.indexSnapshot.indexedChunks,
        eligibleChunks: retrieval.indexSnapshot.eligibleChunks,
        embeddedChunks: retrieval.indexSnapshot.embeddedChunks,
        rejectedLimit,
        maxTokens: recall.budgetTokens,
        scoreThreshold,
        weights: recall.weights,
        selected: selected.map((candidate) => ({
          noteId: candidate.chunk.noteId,
          sectionKey: candidate.chunk.sectionKey,
          score: candidate.relevanceScore,
          fusedScore: candidate.score,
          fusedRank: candidate.fusedRank,
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
          fusedRank: candidate.fusedRank,
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
    // A candidate rejected by the reserved budget is a prompt-budget skip, not a no-match;
    // recording it as a zero-match would overwrite the last injection receipt and tell the
    // user nothing matched when the budget simply left no room.
    if (retrieval.budgetExhausted) {
      await recordAttempt("skipped", { reason: "prompt_budget", debugEnabled });
      return null;
    }
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
