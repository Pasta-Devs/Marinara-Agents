import type {
  LtmNote,
  LtmNoteTransferApplyResponse,
  LtmNoteTransferApplyRequest,
  LtmNoteTransferConflict,
  LtmNoteTransferMode,
  LtmNoteTransferPreviewItem,
  LtmNoteTransferPreviewRequest,
  LtmNoteTransferPreviewResponse,
  LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  isGlobalLtmScope,
  matchesLtmScope,
  withMergedLtmScopeLinks,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { resolveChatLtmScope } from "./chat-scope.js";
import { uniqueStrings } from "./ltm-utils.js";
import { logger } from "./package-runtime.js";
import { LongTermMemoryStorage } from "./storage.js";
import { withLtmVaultLock } from "./vault-lock.js";
import { LtmServiceError } from "./service-error.js";

type TransferChat = {
  id: string;
  groupId?: string | null;
  characterIds?: unknown;
};

type TransferPlan = {
  destinationScope: LtmScope;
  requestedNoteIds: string[];
  availableDerivedNoteIds: string[];
  derivedNoteIds: string[];
  items: LtmNoteTransferPreviewItem[];
  buckets: LtmNoteTransferPreviewResponse["buckets"];
};

type TransferServiceOptions = {
  root?: string;
  storage?: LongTermMemoryStorage;
};

type ApplyTransferOptions<TRebuild = unknown> = TransferServiceOptions & {
  rebuild?: () => Promise<TRebuild>;
};

const CONFLICT_LIMIT = 3;
const LEXICAL_SIMILARITY_THRESHOLD = 0.72;
const SOFT_CONFLICT_SHARED_TOKEN_MIN = 4;
const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "along",
  "also",
  "always",
  "another",
  "before",
  "being",
  "between",
  "could",
  "first",
  "from",
  "have",
  "into",
  "just",
  "more",
  "over",
  "same",
  "some",
  "such",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "very",
  "were",
  "with",
  "would",
]);

export class LtmNoteTransferError extends LtmServiceError {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message, statusCode, "ltm_transfer_failed");
  }
}

function transferStorage(options: TransferServiceOptions) {
  return options.storage ?? new LongTermMemoryStorage(options.root);
}

function notePreviewText(note: LtmNote, limit = 320) {
  const text =
    note.sections.summary?.text.trim() ||
    note.sections.core?.text.trim() ||
    note.sections.source?.text.trim() ||
    Object.values(note.sections)[0]?.text.trim() ||
    "";
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > limit
    ? `${compact.slice(0, limit - 1).trim()}...`
    : compact;
}

function noteDisplayTitle(note: LtmNote) {
  return note.title?.trim() || notePreviewText(note, 80) || note.id;
}

function normalizedPreviewText(note: LtmNote) {
  return notePreviewText(note, 600)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function noteSourceNoteId(note: Pick<LtmNote, "links">) {
  return note.links.find((link) => link.relation === "extracted_from")?.target;
}

function normalizedScopeForComparison(scope: LtmScope | null | undefined) {
  const chatIds = uniqueStrings(getLtmScopeChatIds(scope)).sort();
  const characterIds = uniqueStrings(scope?.characterIds ?? []).sort();
  return {
    ...(chatIds.length ? { chatIds, chatId: chatIds[0] } : {}),
    ...(scope?.groupId ? { groupId: scope.groupId } : {}),
    ...(characterIds.length ? { characterIds } : {}),
  } satisfies LtmScope;
}

function scopesEqual(
  left: LtmScope | null | undefined,
  right: LtmScope | null | undefined,
) {
  return (
    JSON.stringify(normalizedScopeForComparison(left)) ===
    JSON.stringify(normalizedScopeForComparison(right))
  );
}

function scopeForCopy(note: LtmNote, destinationScope: LtmScope) {
  if (
    note.scope.personaId &&
    note.scope.personaId !== destinationScope.personaId
  )
    throw new LtmNoteTransferError(
      "Persona-scoped memories cannot be copied to a different persona.",
      409,
    );
  return withMergedLtmScopeLinks(note.scope, {
    chatIds: getLtmScopeChatIds(destinationScope),
    characterIds: destinationScope.characterIds,
    personaId: destinationScope.personaId,
  });
}

function extractedChildrenForNoteIds(notes: LtmNote[], noteIds: string[]) {
  const selected = new Set(noteIds);
  const descendants = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const note of notes) {
      const sourceNoteId = noteSourceNoteId(note);
      if (
        !sourceNoteId ||
        (!selected.has(sourceNoteId) && !descendants.has(sourceNoteId))
      )
        continue;
      if (selected.has(note.id) || descendants.has(note.id)) continue;
      descendants.add(note.id);
      changed = true;
    }
  }

  return [...descendants];
}

function tokenizeForSimilarity(note: LtmNote) {
  const text = normalizedPreviewText(note);
  return new Set(
    text
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );
}

function lexicalSimilarity(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return { score: 0, sharedCount: 0 };
  let sharedCount = 0;
  for (const token of left) {
    if (right.has(token)) sharedCount += 1;
  }
  if (sharedCount === 0) return { score: 0, sharedCount: 0 };
  const overlap = sharedCount / Math.min(left.size, right.size);
  const jaccard = sharedCount / (left.size + right.size - sharedCount);
  return { score: Math.max(overlap, (overlap + jaccard) / 2), sharedCount };
}

function compareConflicts(
  left: LtmNoteTransferConflict,
  right: LtmNoteTransferConflict,
) {
  const severityWeight = (value: LtmNoteTransferConflict["severity"]) =>
    value === "hard" ? 2 : 1;
  return (
    severityWeight(right.severity) - severityWeight(left.severity) ||
    (right.score ?? 0) - (left.score ?? 0) ||
    left.targetTitle.localeCompare(right.targetTitle)
  );
}

function conflictReasonSummary(conflicts: LtmNoteTransferConflict[]) {
  const top = conflicts[0];
  if (!top) return undefined;
  if (top.severity === "hard")
    return "Destination already has a matching memory.";
  return "Destination already has a similar memory.";
}

function previewItemReasonForNoOp(
  mode: LtmNoteTransferMode,
  note: LtmNote,
  destinationScope: LtmScope,
) {
  if (mode === "copy") {
    if (isGlobalLtmScope(note.scope)) return "Already available everywhere.";
    if (matchesLtmScope(note, { scope: destinationScope }))
      return "Already visible in the destination branch.";
    return "No scope change needed.";
  }
  return "Already scoped to the destination branch.";
}

function targetConflictForNotes(
  note: LtmNote,
  target: LtmNote,
  noteNormalizedText: string,
  targetNormalizedText: string,
  noteTokens: Set<string>,
  targetTokens: Set<string>,
): LtmNoteTransferConflict | null {
  const sourceNoteId = noteSourceNoteId(note);
  const targetSourceNoteId = noteSourceNoteId(target);
  const sharedSourceType =
    sourceNoteId &&
    targetSourceNoteId &&
    sourceNoteId === targetSourceNoteId &&
    note.type === target.type;

  if (noteNormalizedText && noteNormalizedText === targetNormalizedText) {
    return {
      noteId: note.id,
      targetNoteId: target.id,
      targetTitle: noteDisplayTitle(target),
      targetType: target.type,
      targetPreview: notePreviewText(target),
      severity: "hard",
      reason: "exact_text",
      score: 1,
    };
  }

  if (sharedSourceType) {
    return {
      noteId: note.id,
      targetNoteId: target.id,
      targetTitle: noteDisplayTitle(target),
      targetType: target.type,
      targetPreview: notePreviewText(target),
      severity: "hard",
      reason: "same_source_type",
      score: 0.99,
    };
  }

  const similarity = lexicalSimilarity(noteTokens, targetTokens);
  if (
    similarity.sharedCount < SOFT_CONFLICT_SHARED_TOKEN_MIN ||
    similarity.score < LEXICAL_SIMILARITY_THRESHOLD
  ) {
    return null;
  }

  return {
    noteId: note.id,
    targetNoteId: target.id,
    targetTitle: noteDisplayTitle(target),
    targetType: target.type,
    targetPreview: notePreviewText(target),
    severity: "soft",
    reason: "lexical_overlap",
    score: Number(similarity.score.toFixed(3)),
  };
}

async function buildTransferPlan(
  request: LtmNoteTransferPreviewRequest & { derivedNoteIds?: string[] },
  destinationChat: TransferChat,
  options: TransferServiceOptions,
): Promise<TransferPlan> {
  const storage = transferStorage(options);
  const notes = await storage.listNotes();
  const noteLookup = new Map(notes.map((note) => [note.id, note]));
  const requestedNoteIds = uniqueStrings(request.noteIds);
  if (requestedNoteIds.length !== request.noteIds.length)
    throw new LtmNoteTransferError("Transfer note IDs must be unique.", 400);
  const missingNoteIds = requestedNoteIds.filter(
    (noteId) => !noteLookup.has(noteId),
  );
  if (missingNoteIds.length > 0) {
    logger.warn(
      missingNoteIds,
      `[ltm] Transfer requested non-existent notes: ${missingNoteIds.join(", ")}`,
    );
    throw new LtmNoteTransferError(
      `Long-term memory note not found: ${missingNoteIds.join(", ")}`,
      404,
    );
  }

  const availableDerivedIds = extractedChildrenForNoteIds(
    notes,
    requestedNoteIds,
  );
  const derivedNoteIds = request.derivedNoteIds
    ? uniqueStrings(request.derivedNoteIds)
    : request.includeDerived === false
      ? []
      : availableDerivedIds;
  if (derivedNoteIds.some((id) => !availableDerivedIds.includes(id)))
    throw new LtmNoteTransferError("Transfer includes an invalid derived note.", 400);
  const transferNoteIds = uniqueStrings([
    ...requestedNoteIds,
    ...derivedNoteIds,
  ]);
  const selectedSet = new Set(transferNoteIds);
  const destinationScope = resolveChatLtmScope(destinationChat);
  const destinationCandidates = notes.filter(
    (note) =>
      !selectedSet.has(note.id) &&
      matchesLtmScope(note, { scope: destinationScope }),
  );
  const destinationNormalizedText = new Map(
    destinationCandidates.map((note) => [note.id, normalizedPreviewText(note)]),
  );
  const destinationTokens = new Map(
    destinationCandidates.map((note) => [note.id, tokenizeForSimilarity(note)]),
  );

  const items = transferNoteIds
    .map((noteId): LtmNoteTransferPreviewItem => {
      const note = noteLookup.get(noteId)!;
      const derived = !requestedNoteIds.includes(noteId);
      const nextScope =
        request.mode === "copy"
          ? scopeForCopy(note, destinationScope)
          : destinationScope;
      const noOp =
        request.mode === "copy"
          ? isGlobalLtmScope(note.scope) ||
            matchesLtmScope(note, { scope: destinationScope })
          : scopesEqual(note.scope, destinationScope);

      if (noOp) {
        return {
          noteId: note.id,
          title: noteDisplayTitle(note),
          type: note.type,
          previewText: notePreviewText(note),
          scope: note.scope,
          nextScope,
          derived,
          ...(noteSourceNoteId(note)
            ? { sourceNoteId: noteSourceNoteId(note) }
            : {}),
          classification: "no_op",
          defaultIncluded: false,
          reason: previewItemReasonForNoOp(
            request.mode,
            note,
            destinationScope,
          ),
          conflicts: [],
        };
      }

      const noteNormalizedText = normalizedPreviewText(note);
      const noteTokens = tokenizeForSimilarity(note);
      const conflicts = destinationCandidates
        .map((target) =>
          targetConflictForNotes(
            note,
            target,
            noteNormalizedText,
            destinationNormalizedText.get(target.id) ?? "",
            noteTokens,
            destinationTokens.get(target.id) ?? new Set<string>(),
          ),
        )
        .filter((entry): entry is LtmNoteTransferConflict => Boolean(entry))
        .sort(compareConflicts)
        .slice(0, CONFLICT_LIMIT);

      return {
        noteId: note.id,
        title: noteDisplayTitle(note),
        type: note.type,
        previewText: notePreviewText(note),
        scope: note.scope,
        nextScope,
        derived,
        ...(noteSourceNoteId(note)
          ? { sourceNoteId: noteSourceNoteId(note) }
          : {}),
        classification: conflicts.length > 0 ? "conflict" : "ready",
        defaultIncluded: conflicts.length === 0,
        ...(conflicts.length > 0
          ? { reason: conflictReasonSummary(conflicts) }
          : {}),
        conflicts,
      };
    })
    .filter(Boolean);

  const buckets = {
    ready: items
      .filter((item) => item.classification === "ready")
      .map((item) => item.noteId),
    noOp: items
      .filter((item) => item.classification === "no_op")
      .map((item) => item.noteId),
    conflict: items
      .filter((item) => item.classification === "conflict")
      .map((item) => item.noteId),
  } satisfies LtmNoteTransferPreviewResponse["buckets"];

  return {
    destinationScope,
    requestedNoteIds,
    availableDerivedNoteIds: availableDerivedIds,
    derivedNoteIds,
    items,
    buckets,
  };
}

export async function previewLtmNoteTransfer(
  request: LtmNoteTransferPreviewRequest,
  destinationChat: TransferChat,
  options: TransferServiceOptions = {},
): Promise<LtmNoteTransferPreviewResponse> {
  const plan = await buildTransferPlan(request, destinationChat, options);
  return {
    mode: request.mode,
    destinationChatId: destinationChat.id,
    selection: {
      requestedNoteCount: plan.requestedNoteIds.length,
      totalNoteCount: plan.items.length,
      requestedNoteIds: plan.requestedNoteIds,
      availableDerivedCount: plan.availableDerivedNoteIds.length,
      includedDerivedCount:
        request.includeDerived === false ? 0 : plan.derivedNoteIds.length,
      derivedNoteIds: plan.derivedNoteIds,
      includeDerived: request.includeDerived !== false,
    },
    buckets: plan.buckets,
    items: plan.items,
  };
}

export async function applyLtmNoteTransfer<TRebuild = unknown>(
  request: LtmNoteTransferApplyRequest,
  destinationChat: TransferChat,
  options: ApplyTransferOptions<TRebuild> = {},
): Promise<
  Omit<LtmNoteTransferApplyResponse, "rebuild"> & { rebuild: TRebuild | null }
> {
  const storage = transferStorage(options);
  return withLtmVaultLock(storage.root, async () => {
    const plan = await buildTransferPlan({
      noteIds: request.requestedNoteIds,
      mode: request.mode,
      destinationChatId: request.destinationChatId,
      includeDerived: false,
      derivedNoteIds: request.derivedNoteIds,
    }, destinationChat, options);
    const updatedNoteIds: string[] = [];
    const skippedNoteIds: string[] = [];
    const derivedNoteIdsTouched: string[] = [];
    const applyIds = new Set(request.applyNoteIds);
    const planIds = new Set(plan.items.map((item) => item.noteId));
    const missingNoteIds = request.applyNoteIds.filter((id) => !planIds.has(id));
    if (missingNoteIds.length > 0) {
      throw new LtmNoteTransferError(
        `The transfer preview is stale because ${missingNoteIds.length === 1 ? "a memory is no longer available" : "memories are no longer available"}. Refresh the preview before applying.`,
        409,
      );
    }
    const conflictingNoteIds = plan.items
      .filter((item) => applyIds.has(item.noteId))
      .filter((item) => item.classification === "conflict")
      .map((item) => item.noteId);
    if (conflictingNoteIds.length > 0) {
      throw new LtmNoteTransferError(
        `The transfer preview is stale because ${conflictingNoteIds.length === 1 ? "a memory now conflicts" : "memories now conflict"} in the destination. Refresh the preview before applying.`,
        409,
      );
    }

    for (const item of plan.items.filter((candidate) => applyIds.has(candidate.noteId))) {
      // Apply only items that remain ready after the preview was recomputed.
      if (item.classification !== "ready") {
        skippedNoteIds.push(item.noteId);
        continue;
      }

      const nextScope =
        request.mode === "copy" ? item.nextScope : plan.destinationScope;
      if (scopesEqual(item.scope, nextScope)) {
        skippedNoteIds.push(item.noteId);
        continue;
      }

      const note = await storage.updateNote(item.noteId, { scope: nextScope });
      updatedNoteIds.push(note.id);
      if (item.derived) derivedNoteIdsTouched.push(note.id);
    }

    const rebuild =
      updatedNoteIds.length > 0 ? ((await options.rebuild?.()) ?? null) : null;

    return {
      mode: request.mode,
      destinationChatId: destinationChat.id,
      updatedNoteIds,
      skippedNoteIds: uniqueStrings(skippedNoteIds),
      derivedNoteIdsTouched,
      rebuild,
    };
  });
}
