import type {
  LtmEvidenceUnit,
  LtmExtractionDiagnostic,
  LtmNote,
  LtmScope,
  LtmSubject,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { normalizeLtmScope } from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { jaccardSimilarity, tokenize } from "../../../../shared/src/features/agents/long-term-memory/utils.js";
import { noteIdForEvidenceUnit } from "./evidence-unit-validation.js";

type ExistingSectionCandidate = {
  noteId: string;
  sectionKey: string;
  text: string;
  tokens: string[];
  scope: LtmScope;
};

const MAX_COMPARISON_TOKENS = 500;

export function deduplicateUnits(units: LtmEvidenceUnit[], existingNotes: LtmNote[], scope: LtmScope = {}) {
  const lexicalThreshold = 0.85;
  const diagnostics: LtmExtractionDiagnostic[] = [];
  const deduplicated: LtmEvidenceUnit[] = [];
  const seenInBatch = new Map<string, ExistingSectionCandidate[]>();
  const seenBySubjects = new Map<string, ExistingSectionCandidate[]>();
  const existingCandidates = existingSectionCandidates(existingNotes);
  const existingById = new Map(existingNotes.map((note) => [note.id, note]));

  for (const [candidateIndex, unit] of units.entries()) {
    const noteId = noteIdForEvidenceUnit(unit);
    const unitText = normalizeText(unit.text);
    const unitTokens = tokenize(unit.text);
    const key = `${noteId}\u0000${unit.sectionKey}`;
    const subjectKey = subjectKeyFor(unit.subjects);
    const subjectSectionKey = subjectKey ? `${subjectKey}\u0000${unit.sectionKey}` : null;
    // Subject candidates bridge a legacy target id, but only within the target's own scope. Notes that merely
    // overlap the extraction scope are separate targets, so their identical text must not suppress this write.
    const targetScope = existingById.get(noteId)?.scope ?? scope;
    const targetScopeKey = scopeIdentityKey(targetScope);
    const subjectCandidates = subjectSectionKey
      ? [
          ...(seenBySubjects.get(subjectSectionKey) ?? []),
          ...(existingCandidates.bySubjects.get(subjectSectionKey) ?? []),
        ].filter((candidate) => scopeIdentityKey(candidate.scope) === targetScopeKey)
      : [];
    const candidates = [
      ...(seenInBatch.get(key) ?? []),
      ...(existingCandidates.byNote.get(key) ?? []),
      ...subjectCandidates,
    ];
    const duplicate = candidates.find((candidate) => {
      if (normalizeText(candidate.text) === unitText) return true;
      if (!candidate.tokens.length || !unitTokens.size) return false;
      return hasLexicalDuplicate(candidate.tokens, unitTokens, lexicalThreshold);
    });

    if (duplicate) {
      diagnostics.push({
        severity: "warning",
        code: "deduplicated_evidence_unit",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: `Dropped duplicate LTM evidence unit; matched ${duplicate.noteId}.${duplicate.sectionKey}.`,
      });
      continue;
    }

    deduplicated.push(unit);
    const bucket = seenInBatch.get(key) ?? [];
    const candidate = {
      noteId,
      sectionKey: unit.sectionKey,
      text: unit.text,
      tokens: allTokens(unit.text),
      scope: targetScope,
    };
    bucket.push(candidate);
    seenInBatch.set(key, bucket);
    if (subjectSectionKey) {
      const subjectBucket = seenBySubjects.get(subjectSectionKey) ?? [];
      subjectBucket.push(candidate);
      seenBySubjects.set(subjectSectionKey, subjectBucket);
    }
  }

  return { deduplicated, diagnostics };
}

function existingSectionCandidates(notes: LtmNote[]) {
  const byNote = new Map<string, ExistingSectionCandidate[]>();
  const bySubjects = new Map<string, ExistingSectionCandidate[]>();
  for (const note of notes) {
    for (const [sectionKey, section] of Object.entries(note.sections)) {
      const text = section.text.trim();
      if (!text) continue;
      const key = `${note.id}\u0000${sectionKey}`;
      const candidate = { noteId: note.id, sectionKey, text, tokens: allTokens(text), scope: note.scope };
      const noteBucket = byNote.get(key) ?? [];
      noteBucket.push(candidate);
      byNote.set(key, noteBucket);
      const subjectKey = subjectKeyFor(note.subjects);
      if (subjectKey) {
        const subjectBucket = bySubjects.get(`${subjectKey}\u0000${sectionKey}`) ?? [];
        subjectBucket.push(candidate);
        bySubjects.set(`${subjectKey}\u0000${sectionKey}`, subjectBucket);
      }
    }
  }
  return { byNote, bySubjects };
}

function subjectKeyFor(subjects: readonly LtmSubject[] | undefined) {
  if (!subjects?.length) return null;
  return subjects.map((subject) => subject.key).join("\u0000");
}

function scopeIdentityKey(scope: LtmScope | undefined) {
  if (!scope) return null;
  const normalized = normalizeLtmScope(scope);
  return JSON.stringify([
    [...(normalized.chatIds ?? [])].sort(),
    [...(normalized.groupIds ?? [])].sort(),
    [...(normalized.characterIds ?? [])].sort(),
    [...(normalized.personaIds ?? [])].sort(),
  ]);
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function allTokens(text: string) {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length >= 4) ?? []
  );
}

function hasLexicalDuplicate(tokens: string[], unitTokens: Set<string>, threshold: number) {
  if (tokens.length <= MAX_COMPARISON_TOKENS) {
    return jaccardSimilarity(unitTokens, new Set(tokens)) >= threshold;
  }

  const size = Math.min(Math.max(unitTokens.size, 1), MAX_COMPARISON_TOKENS);
  const counts = new Map<string, number>();
  let shared = 0;

  const add = (token: string) => {
    const count = counts.get(token) ?? 0;
    counts.set(token, count + 1);
    if (count === 0 && unitTokens.has(token)) shared++;
  };
  const remove = (token: string) => {
    const count = counts.get(token)!;
    if (count === 1) {
      counts.delete(token);
      if (unitTokens.has(token)) shared--;
    } else counts.set(token, count - 1);
  };

  tokens.slice(0, size).forEach(add);
  for (let start = 0; start <= tokens.length - size; start++) {
    const similarity = shared / (unitTokens.size + counts.size - shared);
    if (shared > 0 && similarity >= threshold) return true;
    if (start < tokens.length - size) {
      remove(tokens[start]!);
      add(tokens[start + size]!);
    }
  }
  return false;
}
