import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import {
  ltmRejectedSuggestionSchema,
  type LtmExtractionDroppedCandidate,
  type LtmExtractionDraft,
  type LtmRejectedSuggestion,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { getLongTermMemoryRoot, ltmRejectedSuggestionsPath } from "./paths.js";
import { nowIso } from "./ltm-utils.js";
import { logger } from "./package-runtime.js";
import { withLtmVaultLock } from "./vault-lock.js";

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

function fingerprint(source: LtmExtractionDraft["source"], candidate: LtmExtractionDroppedCandidate) {
  return createHash("sha256")
    .update(JSON.stringify(normalize({
      sourceNoteId: source.sourceNoteId,
      candidate: { ...candidate, index: undefined },
    })))
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
    (left, right) =>
      right.lastSeenAt.localeCompare(left.lastSeenAt) || right.id.localeCompare(left.id),
  );
}

export async function listRejectedSuggestions(
  filter: { sourceNoteId?: string; chatId?: string } = {},
  root = getLongTermMemoryRoot(),
) {
  return withLtmVaultLock(root, async () => {
    const suggestions = (await readSuggestionsUnlocked(root)).filter(
      (item) =>
        (!filter.sourceNoteId || item.source.sourceNoteId === filter.sourceNoteId) &&
        (!filter.chatId || item.source.chatId === filter.chatId),
    );
    return sortSuggestions(suggestions);
  });
}

export async function readAllRejectedSuggestions(root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, () => readSuggestionsUnlocked(root));
}

export async function addRejectedSuggestions(
  draft: LtmExtractionDraft,
  root = getLongTermMemoryRoot(),
) {
  const candidates = draft.extractionOutcome?.droppedCandidates ?? [];
  if (!candidates.length) return [];
  return withLtmVaultLock(root, async () => {
    const path = ltmRejectedSuggestionsPath(root);
    const existing = await readSuggestionsUnlocked(root);
    const byFingerprint = new Map(existing.map((item) => [item.fingerprint, item]));
    const timestamp = nowIso();
    for (const candidate of candidates) {
      const value = fingerprint(draft.source, candidate);
      const current = byFingerprint.get(value);
      if (current) {
        byFingerprint.set(value, ltmRejectedSuggestionSchema.parse({
          ...current,
          source: draft.source,
          scope: draft.scope,
          modes: draft.modes,
          candidate,
          lastSeenAt: timestamp,
        }));
        continue;
      }
      if (byFingerprint.size >= LTM_REJECTED_SUGGESTIONS_LIMIT)
        throw new Error("Long-term memory rejected-suggestion limit reached.");
      byFingerprint.set(value, ltmRejectedSuggestionSchema.parse({
        id: uuidFromFingerprint(value),
        fingerprint: value,
        source: draft.source,
        scope: draft.scope,
        modes: draft.modes,
        candidate,
        createdAt: timestamp,
        lastSeenAt: timestamp,
      }));
    }
    const next = sortSuggestions([...byFingerprint.values()]);
    await writeJsonAtomic(path, next);
    return next.filter((item) => candidates.some((candidate) => fingerprint(draft.source, candidate) === item.fingerprint));
  });
}

export async function deleteRejectedSuggestion(id: string, root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, async () => {
    const existing = await readSuggestionsUnlocked(root);
    const next = existing.filter((item) => item.id !== id);
    if (next.length === existing.length) return { deleted: false, id };
    await writeJsonAtomic(ltmRejectedSuggestionsPath(root), next);
    return { deleted: true, id };
  });
}

export async function writeRejectedSuggestions(
  suggestions: LtmRejectedSuggestion[],
  root = getLongTermMemoryRoot(),
) {
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

export async function deleteAllRejectedSuggestions(root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, async () => {
    await unlink(ltmRejectedSuggestionsPath(root)).catch(() => {});
  });
}
