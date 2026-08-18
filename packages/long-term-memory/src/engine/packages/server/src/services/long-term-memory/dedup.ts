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
