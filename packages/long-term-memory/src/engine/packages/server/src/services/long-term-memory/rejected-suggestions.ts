import { createHash } from "node:crypto";
import {
  ltmExtractionDroppedCandidateSchema,
  ltmRejectedSuggestionSchema,
  ltmExtractionDraftSchema,
  type LtmExtractionDroppedCandidate,
  type LtmExtractionDraft,
  type LtmRejectedSuggestion,
  type LtmSavedSubjectIdentityChoice,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { getLongTermMemoryRoot, ltmRejectedSuggestionsPath } from "./paths.js";
import { nowIso, normalizeSubjectName } from "./ltm-utils.js";
import { logger } from "./package-runtime.js";
import { withLtmVaultLock } from "./vault-lock.js";
import { ltmScopeFamilyId } from "./chat-scope.js";
import { draftPathForId } from "./draft-store.js";
import { commitLtmMutation } from "./mutation-transaction.js";

export const LTM_REJECTED_SUGGESTIONS_LIMIT = 10_000;

function normalize(value: unknown): unknown {
  if (typeof value === "string") return value.trim().replace(/\s+/g, " ");
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  return value;
}

function fingerprint(
  source: LtmExtractionDraft["source"],
  candidate: LtmExtractionDroppedCandidate,
  includeRecoveryCandidate = true,
) {
  const {
    validatorCode: _validatorCode,
    recoveryCandidate: _recoveryCandidate,
    identityReview: _identityReview,
    ...legacyCandidate
  } = candidate;
  const fingerprintCandidate = includeRecoveryCandidate
    ? { ...legacyCandidate, ...(candidate.recoveryCandidate ? { recoveryCandidate: candidate.recoveryCandidate } : {}) }
    : legacyCandidate;
  return createHash("sha256")
    .update(
      JSON.stringify(
        normalize({
          sourceNoteId: source.sourceNoteId,
          candidate: { ...fingerprintCandidate, index: undefined },
        }),
      ),
    )
    .digest("hex");
}

function uuidFromFingerprint(value: string) {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-${((Number.parseInt(value[16]!, 16) & 3) | 8).toString(16)}${value.slice(17, 20)}-${value.slice(20, 32)}`;
}

async function readSuggestionsUnlocked(root: string) {
  let raw: unknown;
  try {
    raw = await readJsonFile<unknown>(ltmRejectedSuggestionsPath(root), []);
  } catch (error) {
    logger.error(error, "[ltm] Rejected-suggestion ledger could not be read");
    throw error;
  }
  if (!Array.isArray(raw)) {
    const error = new Error("Long-term memory rejected-suggestion ledger is not an array.");
    logger.error(error, "[ltm] Rejected-suggestion ledger is malformed");
    throw error;
  }
  if (raw.length > LTM_REJECTED_SUGGESTIONS_LIMIT) {
    const error = new Error("Long-term memory rejected-suggestion limit exceeded.");
    logger.error(error, "[ltm] Rejected-suggestion ledger exceeds its limit");
    throw error;
  }
  try {
    return raw.map((item) => ltmRejectedSuggestionSchema.parse(item));
  } catch (error) {
    logger.error(error, "[ltm] Rejected-suggestion ledger contains malformed records");
    throw error;
  }
}

function sortSuggestions(suggestions: LtmRejectedSuggestion[]) {
  return suggestions.sort(
    (left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt) || right.id.localeCompare(left.id),
  );
}

export async function listRejectedSuggestions(
  filter: { sourceNoteId?: string; chatId?: string; includeResolved?: boolean } = {},
  root = getLongTermMemoryRoot(),
) {
  return withLtmVaultLock(root, async () => {
    const records = await readSuggestionsUnlocked(root);
    const savedByFamily = new Map<string, Map<string, LtmSavedSubjectIdentityChoice>>();
    for (const record of records
      .filter((item) => item.identityResolution)
      .sort(
        (left, right) =>
          left.identityResolution!.resolvedAt.localeCompare(right.identityResolution!.resolvedAt) ||
          left.id.localeCompare(right.id),
      )) {
      const familyId = ltmScopeFamilyId(record.scope);
      if (!familyId) continue;
      const choices = savedByFamily.get(familyId) ?? new Map<string, LtmSavedSubjectIdentityChoice>();
      for (const choice of record.identityResolution!.choices) choices.set(normalizeSubjectName(choice.name), choice);
      savedByFamily.set(familyId, choices);
    }
    const suggestions = records.filter(
      (item) =>
        (filter.includeResolved || !item.identityResolution) &&
        (!filter.sourceNoteId || item.source.sourceNoteId === filter.sourceNoteId) &&
        (!filter.chatId || item.source.chatId === filter.chatId),
    );
    return sortSuggestions(
      suggestions.flatMap((item) => {
        // Resolved records are only listed on explicit request so the pending view stays
        // focused; return them untouched for the saved-choice management surface.
        if (item.identityResolution) return [item];
        const choices = savedByFamily.get(ltmScopeFamilyId(item.scope) ?? "");
        if (
          item.candidate.recoveryCandidate?.subjectNames?.some(
            (name) => choices?.get(normalizeSubjectName(name))?.action === "skip",
          )
        )
          return [];
        const identityReview = item.candidate.identityReview?.map((participant) => {
          const choice = choices?.get(normalizeSubjectName(participant.name));
          if (!choice || choice.action === "skip") return participant;
          return {
            ...participant,
            matchedSubjectKey: choice.subject.key,
            candidates: participant.candidates.some((candidate) => candidate.subject.key === choice.subject.key)
              ? participant.candidates
              : [...participant.candidates.slice(0, 9), { name: choice.name, subject: choice.subject }],
          };
        });
        return [{ ...item, candidate: { ...item.candidate, ...(identityReview ? { identityReview } : {}) } }];
      }),
    );
  });
}

export async function readAllRejectedSuggestions(root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, () => readSuggestionsUnlocked(root));
}

export async function readSavedLtmSubjectIdentityChoices(
  scope: LtmRejectedSuggestion["scope"],
  root = getLongTermMemoryRoot(),
) {
  const familyId = ltmScopeFamilyId(scope);
  if (!familyId) return [];
  return (await readAllRejectedSuggestions(root))
    .filter((item) => item.identityResolution && ltmScopeFamilyId(item.scope) === familyId)
    .sort(
      (left, right) =>
        left.identityResolution!.resolvedAt.localeCompare(right.identityResolution!.resolvedAt) ||
        left.id.localeCompare(right.id),
    )
    .flatMap((item) => item.identityResolution!.choices.map((choice) => ({ ...choice, familyId })));
}

// A resolved rejection remains the owner of its remembered decisions. Publish the decision
// and its independent review draft in one existing mutation journal; do not supersede other
// pending proposals from the same source or lose either half on an interrupted write.
export async function resolveRejectedSuggestionIdentity(
  id: string,
  resolution: NonNullable<LtmRejectedSuggestion["identityResolution"]>,
  draft: LtmExtractionDraft | null,
  root = getLongTermMemoryRoot(),
) {
  return withLtmVaultLock(root, async () => {
    const existing = await readSuggestionsUnlocked(root);
    const current = existing.find((item) => item.id === id);
    if (!current || current.identityResolution) throw new Error("Rejected suggestion is no longer pending.");
    const next = existing.map((item) =>
      item.id === id ? ltmRejectedSuggestionSchema.parse({ ...item, identityResolution: resolution }) : item,
    );
    await commitLtmMutation(root, {
      files: [
        { path: ltmRejectedSuggestionsPath(root), before: existing, after: next },
        ...(draft
          ? [{ path: draftPathForId(draft.id, root), before: null, after: ltmExtractionDraftSchema.parse(draft) }]
          : []),
      ],
    });
  });
}

export async function addRejectedSuggestions(draft: LtmExtractionDraft, root = getLongTermMemoryRoot()) {
  const candidates = draft.extractionOutcome?.droppedCandidates ?? [];
  if (!candidates.length) return [];
  return withLtmVaultLock(root, async () => {
    const path = ltmRejectedSuggestionsPath(root);
    const existing = await readSuggestionsUnlocked(root);
    const byFingerprint = new Map(existing.map((item) => [item.fingerprint, item]));
    const timestamp = nowIso();
    for (const rawCandidate of candidates) {
      const candidate = ltmExtractionDroppedCandidateSchema.parse(rawCandidate);
      const value = fingerprint(draft.source, candidate);
      const legacyValue = fingerprint(draft.source, candidate, false);
      const current =
        byFingerprint.get(value) ??
        [...byFingerprint.values()].find((item) => fingerprint(item.source, item.candidate, false) === legacyValue);
      if (current) {
        const mergedCandidate =
          current.candidate.recoveryCandidate && !candidate.recoveryCandidate
            ? { ...candidate, recoveryCandidate: current.candidate.recoveryCandidate }
            : candidate;
        const updated = ltmRejectedSuggestionSchema.parse({
          ...current,
          source: draft.source,
          scope: draft.scope,
          modes: draft.modes,
          candidate: mergedCandidate,
          lastSeenAt: timestamp,
        });
        for (const [key, item] of byFingerprint) if (item.id === current.id) byFingerprint.delete(key);
        byFingerprint.set(updated.fingerprint, updated);
        continue;
      }
      if (byFingerprint.size >= LTM_REJECTED_SUGGESTIONS_LIMIT)
        throw new Error("Long-term memory rejected-suggestion limit reached.");
      byFingerprint.set(
        value,
        ltmRejectedSuggestionSchema.parse({
          id: uuidFromFingerprint(value),
          fingerprint: value,
          source: draft.source,
          scope: draft.scope,
          modes: draft.modes,
          candidate,
          createdAt: timestamp,
          lastSeenAt: timestamp,
        }),
      );
    }
    const next = sortSuggestions([...byFingerprint.values()]);
    await writeJsonAtomic(path, next);
    return next.filter((item) =>
      candidates.some((candidate) => {
        const value = fingerprint(draft.source, candidate);
        const legacyValue = fingerprint(draft.source, candidate, false);
        return value === item.fingerprint || fingerprint(item.source, item.candidate, false) === legacyValue;
      }),
    );
  });
}

export async function deleteRejectedSuggestion(id: string, root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, async () => {
    const existing = await readSuggestionsUnlocked(root);
    const current = existing.find((item) => item.id === id);
    if (!current) return { deleted: false, id };
    const next = existing.filter((item) => item.id !== id);
    // Deleting a saved identity choice undoes it: the next extraction asks again. Its
    // recovery draft goes in the same journal only while still pending; accepted is history.
    const draftId = current.identityResolution?.draftId;
    const draft = draftId ? await readJsonFile<LtmExtractionDraft | null>(draftPathForId(draftId, root), null) : null;
    if (draft?.status !== "pending") {
      await writeJsonAtomic(ltmRejectedSuggestionsPath(root), next);
      return { deleted: true, id };
    }
    await commitLtmMutation(root, {
      files: [
        { path: ltmRejectedSuggestionsPath(root), before: existing, after: next },
        { path: draftPathForId(draftId!, root), before: draft, after: null },
      ],
    });
    return { deleted: true, id };
  });
}

export async function writeRejectedSuggestions(suggestions: LtmRejectedSuggestion[], root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, async () => {
    const byId = new Map<string, LtmRejectedSuggestion>();
    const byFingerprint = new Map<string, LtmRejectedSuggestion>();
    for (const item of suggestions) {
      const parsed = ltmRejectedSuggestionSchema.parse(item);
      const existingId = byId.get(parsed.id);
      const existingFingerprint = byFingerprint.get(parsed.fingerprint);
      if (
        (existingId && existingId.fingerprint !== parsed.fingerprint) ||
        (existingFingerprint && existingFingerprint.id !== parsed.id)
      )
        throw new Error("Backup contains conflicting rejected-suggestion IDs or fingerprints.");
      if (existingId || existingFingerprint) continue;
      byId.set(parsed.id, parsed);
      byFingerprint.set(parsed.fingerprint, parsed);
    }
    const parsed = [...byId.values()];
    if (parsed.length > LTM_REJECTED_SUGGESTIONS_LIMIT)
      throw new Error("Long-term memory rejected-suggestion limit reached.");
    return writeJsonAtomic(ltmRejectedSuggestionsPath(root), parsed);
  });
}

export async function deleteRejectedSuggestionsForSource(sourceNoteId: string, root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, async () => {
    const existing = await readSuggestionsUnlocked(root);
    const next = existing.filter((item) => item.source.sourceNoteId !== sourceNoteId || item.identityResolution);
    const deletedCount = existing.length - next.length;
    if (deletedCount) await writeJsonAtomic(ltmRejectedSuggestionsPath(root), next);
    return { deletedCount, sourceNoteId };
  });
}
