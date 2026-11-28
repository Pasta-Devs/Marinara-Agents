import {
  ltmExtractionFingerprintSchema,
  type LtmExtractionFingerprint,
  type LtmMode,
  type LtmNote,
  type LtmScope,
  type LtmSourceProvenance,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { stableJsonHash } from "../recall/chunking.js";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
} from "../../../../../shared/src/features/agents/long-term-memory/scope.js";

function normalizedStrings(values: readonly (string | null | undefined)[]) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  ).sort((left, right) => left.localeCompare(right));
}

function normalizedScope(scope: LtmScope | null | undefined): LtmScope {
  const chatIds = normalizedStrings(getLtmScopeChatIds(scope));
  const groupIds = normalizedStrings(getLtmScopeGroupIds(scope));
  const characterIds = normalizedStrings(scope?.characterIds ?? []);
  const personaIds = normalizedStrings(getLtmScopePersonaIds(scope));
  return {
    ...(chatIds.length ? { chatId: chatIds[0], chatIds } : {}),
    ...(groupIds.length ? { groupId: groupIds[0], groupIds } : {}),
    ...(characterIds.length ? { characterIds } : {}),
    ...(personaIds.length ? { personaId: personaIds[0], personaIds } : {}),
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

/** The text alone, without the note id, title or evidence labels a re-cut changes. */
export function textHashForLtmSourceMaterial(input: { sourceText: string }) {
  return stableJsonHash({ sourceText: input.sourceText.trim() });
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
    version: 3,
    sourceHash: sourceHashForLtmSourceMaterial(input),
    // Only a chat piece's title is a label; elsewhere the title is part of what the model reads.
    ...(input.provenance?.kind === "chat_transcript" ? { textHash: textHashForLtmSourceMaterial(input) } : {}),
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
    scope: options.scope ?? note.destinationScope ?? note.scope,
    modes: options.modes ?? note.modes,
    extractionMode: options.extractionMode,
  });
}

export function extractionFingerprintsEqual(
  left: LtmExtractionFingerprint | null | undefined,
  right: LtmExtractionFingerprint | null | undefined,
) {
  return Boolean(left && right && stableJsonHash(withoutTextHash(left)) === stableJsonHash(withoutTextHash(right)));
}

// The text hash only adds to the source hash, so fingerprints saved before it existed still compare equal.
function withoutTextHash(fingerprint: LtmExtractionFingerprint) {
  const { textHash: _textHash, ...rest } = fingerprint;
  return rest;
}

/**
 * True when the source text and extraction context are unchanged and only the labels behind the source hash moved
 * (title, message range). A fingerprint saved without a text hash never matches, so it keeps today's behaviour.
 */
export function extractionFingerprintsMatchSourceText(
  existing: LtmExtractionFingerprint | null | undefined,
  candidate: LtmExtractionFingerprint,
) {
  return Boolean(
    existing?.textHash &&
    existing.textHash === candidate.textHash &&
    extractionFingerprintsEqual({ ...existing, sourceHash: candidate.sourceHash }, candidate),
  );
}

export function isLtmSourceExtractionFingerprintCurrent(note: LtmNote, fingerprint: LtmExtractionFingerprint) {
  return extractionFingerprintsEqual(
    extractionFingerprintForLtmSourceNote(note, { extractionMode: fingerprint.extractionMode }),
    fingerprint,
  );
}
