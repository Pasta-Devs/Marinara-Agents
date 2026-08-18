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
  tokens: string[];
};

const MAX_COMPARISON_TOKENS = 500;
const MAX_COMPARISON_WINDOWS = 64;

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
      if (!candidate.tokens.length || !unitTokens.size) return false;
      return comparisonTokenWindows(candidate.tokens, unitTokens.size).some((window) => {
        if (!hasTokenIntersection(unitTokens, window)) return false;
        return jaccardSimilarity(unitTokens, window) >= lexicalThreshold;
      });
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
      tokens: allTokens(unit.text),
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
      bucket.push({ noteId: note.id, sectionKey, text, tokens: allTokens(text) });
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

function allTokens(text: string) {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length >= 4) ?? []
  );
}

function comparisonTokenWindows(tokens: string[], requestedSize: number) {
  const size = Math.min(Math.max(requestedSize, 1), MAX_COMPARISON_TOKENS);
  if (tokens.length <= size) return [new Set(tokens)];

  // ponytail: sample 64 distributed windows; raise the ceiling only if long sections still miss duplicates.
  const maxStart = tokens.length - size;
  const windowCount = Math.min(MAX_COMPARISON_WINDOWS, maxStart + 1);
  const starts = Array.from({ length: windowCount }, (_, index) =>
    Math.round((index * maxStart) / Math.max(windowCount - 1, 1)),
  );
  return [...new Set(starts)].map((start) => new Set(tokens.slice(start, start + size)));
}
