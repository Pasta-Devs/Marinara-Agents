import type {
  LtmEvidenceUnit,
  LtmExtractionDiagnostic,
  LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { jaccardSimilarity, tokenize } from "../../../../shared/src/features/agents/long-term-memory/utils.js";
import { noteIdForEvidenceUnit } from "./evidence-unit-validation.js";

type ExistingSectionCandidate = {
  noteId: string;
  sectionKey: string;
  text: string;
  tokens: Set<string>;
};

export function deduplicateUnits(units: LtmEvidenceUnit[], existingNotes: LtmNote[]) {
  const lexicalThreshold = 0.85;
  const diagnostics: LtmExtractionDiagnostic[] = [];
  const deduplicated: LtmEvidenceUnit[] = [];
  const seenInBatch = new Map<string, ExistingSectionCandidate[]>();
  const existingCandidates = existingSectionCandidates(existingNotes);

  for (const [candidateIndex, unit] of units.entries()) {
    const noteId = noteIdForEvidenceUnit(unit);
    const unitText = normalizeText(unit.text);
    const unitTokens = tokenize(unit.text);
    const key = `${noteId}\u0000${unit.sectionKey}`;
    const candidates = [...(seenInBatch.get(key) ?? []), ...(existingCandidates.get(key) ?? [])];
    const duplicate = candidates.find((candidate) => {
      if (normalizeText(candidate.text) === unitText) return true;
      if (candidate.tokens.size === 0 || unitTokens.size === 0) return false;
      if (!hasTokenIntersection(unitTokens, candidate.tokens)) return false;
      return jaccardSimilarity(unitTokens, candidate.tokens) >= lexicalThreshold;
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
    bucket.push({
      noteId,
      sectionKey: unit.sectionKey,
      text: unit.text,
      tokens: unitTokens,
    });
    seenInBatch.set(key, bucket);
  }

  return { deduplicated, diagnostics };
}

function existingSectionCandidates(notes: LtmNote[]): Map<string, ExistingSectionCandidate[]> {
  const candidates = new Map<string, ExistingSectionCandidate[]>();
  for (const note of notes) {
    for (const [sectionKey, section] of Object.entries(note.sections)) {
      const text = section.text.trim();
      if (!text) continue;
      const key = `${note.id}\u0000${sectionKey}`;
      const bucket = candidates.get(key) ?? [];
      bucket.push({ noteId: note.id, sectionKey, text, tokens: tokenize(text) });
      candidates.set(key, bucket);
    }
  }
  return candidates;
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasTokenIntersection(left: Set<string>, right: Set<string>) {
  for (const token of left) {
    if (right.has(token)) return true;
  }
  return false;
}
