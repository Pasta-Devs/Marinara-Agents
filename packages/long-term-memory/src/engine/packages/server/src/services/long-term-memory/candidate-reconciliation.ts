import {
  isLtmSourceLikeNote,
  ltmNoteIdSchema,
  type LtmEvidenceUnit,
  type LtmExtractionDiagnostic,
  type LtmMode,
  type LtmNote,
  type LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { jaccardSimilarity, tokenize } from "../../../../shared/src/features/agents/long-term-memory/utils.js";
import { noteIdForEvidenceUnit, targetNoteTypeForUnit } from "./evidence-unit-validation.js";
import { uniqueStrings } from "./ltm-utils.js";
import { retrieveLongTermMemory } from "./retrieval.js";
import type { LtmRecallIndex } from "./rebuild.js";
import {
  canUpdateLtmScopedTarget,
  isRemappableEvidenceUnitTarget,
  remapEvidenceUnitTargets,
} from "./scoped-targets.js";

// Issue #1085: bounded post-extraction reconciliation. A unit reconciles against roughly
// 3-10 candidate notes. Zero means a likely create; dozens means the matcher is too loose.
const DEFAULT_MAX_CANDIDATES_PER_UNIT = 8;
const DEFAULT_MAX_CANDIDATE_TOKENS = 2_048;
const CONTENT_MATCH_THRESHOLD = 0.85;

type ReconciliationStorage = {
  getNotesByIds(ids: string[]): Promise<Map<string, LtmNote>>;
};

export type CandidateReconciliationMatch = {
  derivedNoteId: string;
  noteId: string;
};

export type CandidateReconciliationResult = {
  units: LtmEvidenceUnit[];
  diagnostics: LtmExtractionDiagnostic[];
  remaps: Map<string, string>;
  matches: CandidateReconciliationMatch[];
};

/**
 * Resolves extracted non-character candidates to existing in-scope notes in code.
 *
 * Character and relationship candidates are already owned by `subject-identity.ts`
 * and `scoped-targets.ts`; this pass leaves them untouched. Every other stream derives
 * its target from the model-chosen `subjectId`, so a code-side match keeps canonical
 * identity out of the provider prompt. Exactly one compatible target reuses that note;
 * no target permits a create; several plausible targets stay unattached and warn.
 */
export async function reconcileEvidenceUnitCandidates(options: {
  units: LtmEvidenceUnit[];
  root?: string;
  scope: LtmScope;
  mode?: LtmMode;
  storage: ReconciliationStorage;
  index: LtmRecallIndex;
  maxCandidatesPerUnit?: number;
  maxCandidateTokens?: number;
}): Promise<CandidateReconciliationResult> {
  const maxCandidates = options.maxCandidatesPerUnit ?? DEFAULT_MAX_CANDIDATES_PER_UNIT;
  const maxCandidateTokens = options.maxCandidateTokens ?? DEFAULT_MAX_CANDIDATE_TOKENS;
  const targetIndexes = new Map<string, number>();
  const groups = new Map<string, LtmEvidenceUnit[]>();
  for (const [candidateIndex, unit] of options.units.entries()) {
    const noteType = targetNoteTypeForUnit(unit);
    if (noteType === "character" || noteType === "relationship") continue;
    const noteId = noteIdForEvidenceUnit(unit);
    if (!ltmNoteIdSchema.safeParse(noteId).success) continue;
    if (!groups.has(noteId)) targetIndexes.set(noteId, candidateIndex);
    const bucket = groups.get(noteId) ?? [];
    bucket.push(unit);
    groups.set(noteId, bucket);
  }

  const remaps = new Map<string, string>();
  const diagnostics: LtmExtractionDiagnostic[] = [];
  const matches: CandidateReconciliationMatch[] = [];
  for (const [derivedNoteId, groupUnits] of groups) {
    const candidateIndex = targetIndexes.get(derivedNoteId)!;
    const noteType = targetNoteTypeForUnit(groupUnits[0]!);
    // The exact derived id is owned downstream by `resolveScopedEvidenceUnitTargets`, so only
    // notes under a different id are matched here; that pass still validates scope and subjects.
    // ponytail: one bounded retrieval per candidate keeps identity code-owned. Hoist the allowed-chunk
    // set into a shared index query if per-candidate lane cost shows up in extraction latency.
    const retrieval = await retrieveLongTermMemory({
      root: options.root,
      index: options.index,
      queryText: reconciliationQueryText(groupUnits),
      scope: options.scope,
      mode: options.mode,
      noteTypes: [noteType],
      maxChunks: maxCandidates,
      maxTokens: maxCandidateTokens,
      semanticWeight: 0,
      // Two same-text notes are a genuine ambiguity, so keep both chunks instead of collapsing them.
      dedupeExactText: false,
    });
    const candidateNoteIds = uniqueStrings(retrieval.chunks.map((chunk) => chunk.chunk.noteId)).filter(
      (noteId) => noteId !== derivedNoteId,
    );
    if (candidateNoteIds.length === 0) continue;
    const notesById = await options.storage.getNotesByIds(candidateNoteIds);
    const candidates = candidateNoteIds
      .map((noteId) => notesById.get(noteId))
      .filter((note): note is LtmNote => Boolean(note))
      .filter((note) => isCompatibleCandidateNote(note, noteType, options.scope, options.mode))
      // Skip ids this unit cannot target, so a match never compiles against a different new note.
      .filter((note) => isRemappableEvidenceUnitTarget(groupUnits[0]!, note.id));

    const identityMatches = candidates.filter((note) => identityMatchesGroup(groupUnits, note));
    const plausible = identityMatches.length
      ? identityMatches
      : candidates.filter((note) => contentMatchesGroup(groupUnits, note));

    if (plausible.length === 1) {
      const resolvedNoteId = plausible[0]!.id;
      remaps.set(derivedNoteId, resolvedNoteId);
      matches.push({ derivedNoteId, noteId: resolvedNoteId });
      continue;
    }
    if (plausible.length > 1) {
      diagnostics.push({
        severity: "warning",
        code: "candidate_reconciliation_ambiguous",
        candidateIndex,
        mutationId: groupUnits[0]!.id,
        noteId: derivedNoteId,
        message: `Candidate target ${derivedNoteId} matches ${plausible.length} existing notes; leaving it unattached for review.`,
        details: {
          matchKind: identityMatches.length ? "identity" : "content",
          candidateTargetNoteIds: plausible
            .map((note) => note.id)
            .slice(0, maxCandidates)
            .sort((left, right) => left.localeCompare(right)),
        },
      });
    }
    // Zero plausible targets is a likely create: no remap and no diagnostic.
  }

  return {
    units: remapEvidenceUnitTargets(options.units, remaps),
    diagnostics,
    remaps,
    matches,
  };
}

function isCompatibleCandidateNote(note: LtmNote, noteType: LtmNote["type"], scope: LtmScope, mode?: LtmMode) {
  if (isLtmSourceLikeNote(note) || note.type === "scene") return false;
  if (note.type !== noteType) return false;
  if (!canUpdateLtmScopedTarget(note.scope, scope)) return false;
  if (mode && !note.modes.includes(mode)) return false;
  return true;
}

function reconciliationQueryText(units: LtmEvidenceUnit[]) {
  const parts = units.flatMap((unit) => [
    unit.title,
    unit.subjectId.replace(/_/g, " "),
    ...(unit.subjectNames ?? []),
    ...(unit.subjectKeys ?? []),
    unit.text,
    ...unit.keywords,
  ]);
  return uniqueStrings(parts.filter((part): part is string => Boolean(part?.trim())))
    .join(" ")
    .slice(0, 4_000);
}

function identityMatchesGroup(units: LtmEvidenceUnit[], note: LtmNote) {
  const noteKey = normalizeIdentity(note.title ?? "");
  if (!noteKey) return false;
  return units.some((unit) => identityKeysForUnit(unit).includes(noteKey));
}

function identityKeysForUnit(unit: LtmEvidenceUnit) {
  return uniqueStrings(
    [unit.title, unit.subjectId.replace(/_/g, " "), ...(unit.subjectNames ?? []), ...(unit.subjectKeys ?? [])]
      .map((value) => normalizeIdentity(value ?? ""))
      .filter(Boolean),
  );
}

function contentMatchesGroup(units: LtmEvidenceUnit[], note: LtmNote) {
  const sectionTexts = Object.values(note.sections)
    .map((section) => section.text.trim())
    .filter(Boolean);
  if (sectionTexts.length === 0) return false;
  return units.some((unit) => {
    const unitText = normalizeIdentity(unit.text);
    if (!unitText) return false;
    const unitTokens = tokenize(unit.text);
    if (unitTokens.size === 0) return false;
    return sectionTexts.some((sectionText) => {
      if (normalizeIdentity(sectionText) === unitText) return true;
      const sectionTokens = tokenize(sectionText);
      if (sectionTokens.size === 0) return false;
      return jaccardSimilarity(unitTokens, sectionTokens) >= CONTENT_MATCH_THRESHOLD;
    });
  });
}

function normalizeIdentity(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
