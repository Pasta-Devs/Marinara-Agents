import {
  ltmExtractionFingerprintSchema,
  type LtmExtractionFingerprint,
  type LtmMode,
  type LtmNote,
  type LtmScope,
  type LtmSourceProvenance,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { stableJsonHash } from "./chunking.js";

function normalizedStrings(values: readonly (string | null | undefined)[]) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  ).sort((left, right) => left.localeCompare(right));
}

function normalizedScope(scope: LtmScope | null | undefined): LtmScope {
  const chatIds = normalizedStrings([scope?.chatId, ...(scope?.chatIds ?? [])]);
  const characterIds = normalizedStrings(scope?.characterIds ?? []);
  return {
    ...(chatIds.length ? { chatId: chatIds[0], chatIds } : {}),
    ...(scope?.groupId?.trim() ? { groupId: scope.groupId.trim() } : {}),
    ...(characterIds.length ? { characterIds } : {}),
  };
}

function sourceSection(note: Pick<LtmNote, "sections">) {
  return note.sections.source ?? note.sections.summary;
}

export function sourceHashForLtmSourceMaterial(input: {
  noteId: string;
  sourceTitle?: string;
  sourceText: string;
  evidence?: readonly string[];
}) {
  return stableJsonHash({
    noteId: input.noteId,
    sourceTitle: input.sourceTitle?.trim() ?? "",
    sourceText: input.sourceText.trim(),
    evidence: normalizedStrings(input.evidence ?? []),
  });
}

export function sourceHashForLtmSourceNote(note: LtmNote) {
  const section = sourceSection(note);
  return sourceHashForLtmSourceMaterial({
    noteId: note.id,
    sourceTitle: note.title,
    sourceText: section?.text ?? "",
    evidence: section?.evidence,
  });
}

export function extractionFingerprintForLtmSourceMaterial(input: {
  noteId: string;
  sourceTitle?: string;
  sourceText: string;
  evidence?: readonly string[];
  provenance?: LtmSourceProvenance | null;
  scope?: LtmScope | null;
  modes: readonly LtmMode[];
  extractionMode?: LtmMode;
}): LtmExtractionFingerprint {
  const modes = normalizedStrings(input.modes) as LtmMode[];
  const extractionMode = input.extractionMode ?? modes[0] ?? "roleplay";
  return ltmExtractionFingerprintSchema.parse({
    version: 2,
    sourceHash: sourceHashForLtmSourceMaterial(input),
    provenance: input.provenance ?? null,
    scope: normalizedScope(input.scope),
    modes,
    extractionMode,
  });
}

export function extractionFingerprintForLtmSourceNote(
  note: LtmNote,
  options: {
    scope?: LtmScope | null;
    modes?: readonly LtmMode[];
    extractionMode?: LtmMode;
    provenance?: LtmSourceProvenance | null;
  } = {},
) {
  const section = sourceSection(note);
  return extractionFingerprintForLtmSourceMaterial({
    noteId: note.id,
    sourceTitle: note.title,
    sourceText: section?.text ?? "",
    evidence: section?.evidence,
    provenance: options.provenance ?? note.provenance ?? null,
    scope: options.scope ?? note.scope,
    modes: options.modes ?? note.modes,
    extractionMode: options.extractionMode,
  });
}

export function extractionFingerprintsEqual(
  left: LtmExtractionFingerprint | null | undefined,
  right: LtmExtractionFingerprint | null | undefined,
) {
  return Boolean(left && right && stableJsonHash(left) === stableJsonHash(right));
}

export function isLtmSourceExtractionFingerprintCurrent(note: LtmNote, fingerprint: LtmExtractionFingerprint) {
  if (!note.modes.includes(fingerprint.extractionMode)) return false;
  return extractionFingerprintsEqual(
    extractionFingerprintForLtmSourceNote(note, { extractionMode: fingerprint.extractionMode }),
    fingerprint,
  );
}
