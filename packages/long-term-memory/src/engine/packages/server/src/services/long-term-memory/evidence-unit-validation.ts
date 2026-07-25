import type {
  LtmEvidenceUnit,
  LtmExtractionDropReason,
  LtmExtractionDroppedCandidate,
  LtmExtractionRecoveryHint,
  LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { RELATIONSHIP_DIMENSIONS } from "../../../../shared/src/features/agents/long-term-memory/constants.js";
import {
  isLtmSourceLikeNote,
  ltmNoteIdSchema,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { tokenize } from "../../../../shared/src/features/agents/long-term-memory/utils.js";
import type { LtmExtractionDiagnostic } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { safeSnippet } from "./ltm-utils.js";

const DIALOGUE_BUCKETS = new Set<LtmEvidenceUnit["bucket"]>(["tone"]);
const PLACEHOLDER_UUID = "550e8400-e29b-41d4-a716-446655440000";
const CHARACTER_FACT_EVENT_SECTION_KEYS = new Set(["facts", "core", "profile"]);
const CHARACTER_FACT_DURABLE_SECTION_KEYS = new Set(["developments", "abilities", "items", "voice"]);
const EVENT_SHAPED_CHARACTER_FACT_PATTERN =
  /\b(?:arrived|departed|entered|left|went|came|returned|walked|ran|fled|attacked|fought|killed|died|met|spoke|told|asked|answered|promised|decided|agreed|refused|accepted|rejected|gave|took|found|discovered|revealed|learned|opened|closed|escaped|rescued|betrayed|confronted|warned|saved|stopped)\b/i;
const THREAD_RESOLUTION_PATTERN =
  /\b(?:resolve|resolved|resolver|resolution|would resolve|will resolve|until|when|if|requires|needs|awaits|pending|unresolved|open question|pay off|payoff|future|follow-?up|goal|must|should|tomorrow|next (?:day|class|session)|cool(?:s|ed|ing)?|confess(?:ion|es|ed|ing)?|confront(?:s|ed|ing)?|dy(?:e|ing) down|explain(?:s|ed|ing|ation)?|updates?)\b/i;
const SCENE_ONLY_TONE_PATTERN =
  /\b(?:this scene|single scene|momentarily|for the scene|scene tone|currently|right now)\b/i;
const RELATIONSHIP_DIMENSION_KEYS = new Set<string>(RELATIONSHIP_DIMENSIONS);
const SUSPICIOUS_RELATIONSHIP_DELTA_THRESHOLD = 30;
const MAJOR_RELATIONSHIP_CAUSE_PATTERN =
  /\b(?:betray(?:al|ed|s|ing)?|breakdown|breakthrough|confess(?:ed|es|ion|ing)?|crisis|danger|life[- ]threatening|public commitment|reconcil(?:e|ed|es|iation|ing)|rescu(?:e|ed|es|ing)|saved|saves|saving)\b/i;

function relationshipDescribesChange(unit: LtmEvidenceUnit): boolean {
  return unit.claimKind === "change" || Object.keys(unit.dimensionChanges ?? {}).length > 0;
}

function lexicalOverlap(sourceText: string, proposedText: string) {
  const sourceTokens = tokenize(sourceText);
  const proposedTokens = tokenize(proposedText);
  if (sourceTokens.size === 0 || proposedTokens.size === 0) return 0;
  let shared = 0;
  for (const token of proposedTokens) {
    if (sourceTokens.has(token)) shared++;
  }
  return shared / proposedTokens.size;
}

function quotedStrings(text: string) {
  return Array.from(text.matchAll(/"([^"]{1,240})"/g), (match) => match[1]!.trim()).filter(Boolean);
}

function hasRelationshipSupport(unit: LtmEvidenceUnit, units: LtmEvidenceUnit[], existingNotes: LtmNote[]) {
  if (unit.bucket !== "relationship_state") return true;
  if (!relationshipDescribesChange(unit)) return true;
  const currentTimelineNoteIds = new Set(
    units
      .filter((candidate) => candidate.bucket === "timeline_event")
      .map((candidate) => noteIdForEvidenceUnit(candidate)),
  );
  const existingTimelineNoteIds = new Set(
    existingNotes.filter((note) => note.type === "timeline_event").map((note) => note.id),
  );
  if (
    unit.links.some(
      (link) =>
        link.relation === "caused_by" &&
        (currentTimelineNoteIds.has(link.target) || existingTimelineNoteIds.has(link.target)),
    )
  ) {
    return true;
  }
  return false;
}

function isSourceNote(note: LtmNote) {
  return isLtmSourceLikeNote(note);
}

export function riskForEvidenceUnit(unit: LtmEvidenceUnit): "low" | "medium" | "high" {
  if (unit.bucket === "relationship_state") return "medium";
  return "low";
}

export type LtmEvidenceUnitValidationResult = {
  keptUnits: LtmEvidenceUnit[];
  diagnostics: LtmExtractionDiagnostic[];
  droppedCandidates: LtmExtractionDroppedCandidate[];
};

type DroppedCandidateInput = {
  candidateIndex: number;
  reason: LtmExtractionDropReason;
  message: string;
  code?: string;
  unit?: LtmEvidenceUnit;
  snippet?: string;
  details?: Record<string, unknown>;
};

export function validateLtmEvidenceUnits({
  units,
  sourceText,
  sourceNote,
  existingNotes,
  expectedSourceHash,
  allowedBuckets,
}: {
  units: LtmEvidenceUnit[];
  sourceText: string;
  sourceNote?: LtmNote;
  existingNotes: LtmNote[];
  expectedSourceHash?: string;
  allowedBuckets?: readonly LtmEvidenceUnit["bucket"][];
}): LtmEvidenceUnitValidationResult {
  const diagnostics: LtmExtractionDiagnostic[] = [];
  const droppedCandidates: LtmExtractionDroppedCandidate[] = [];
  const keptUnits: LtmEvidenceUnit[] = [];
  const keptCandidateIndexes = new Map<LtmEvidenceUnit, number>();
  const sourceEvidence = sourceNote ? `source_note:${sourceNote.id}` : null;
  const allowedBucketSet = allowedBuckets ? new Set(allowedBuckets) : null;
  const validLinkTargets = new Set<string>([
    ...(sourceNote ? [sourceNote.id] : []),
    ...existingNotes.map((note) => note.id),
    ...units.flatMap((unit) => {
      const noteId = noteIdForEvidenceUnit(unit);
      return isValidNoteId(noteId) ? [noteId] : [];
    }),
  ]);

  if (sourceNote && !isSourceNote(sourceNote)) {
    diagnostics.push({
      severity: "error",
      code: "invalid_source_note",
      noteId: sourceNote.id,
      message: "Evidence unit extraction requires a source note.",
    });
  }

  for (const [candidateIndex, unit] of units.entries()) {
    const noteId = noteIdForEvidenceUnit(unit);
    const unitDiagnostics: LtmExtractionDiagnostic[] = [];
    const drop = (input: DroppedCandidateInput) => {
      const dropped = droppedCandidate({
        ...input,
        unit,
      });
      droppedCandidates.push(dropped);
      diagnostics.push({
        severity: "error",
        code: dropReasonDiagnosticCode(dropped.reason),
        candidateIndex,
        mutationId: unit.id,
        ...(isValidNoteId(noteId) ? { noteId } : {}),
        message: dropped.message,
        ...(input.code ? { details: { validatorCode: input.code, validationStage: "initial", ...input.details } } : {}),
      });
    };

    unitDiagnostics.push(...placeholderDiagnostics(unit, noteId, candidateIndex));

    if (allowedBucketSet && !allowedBucketSet.has(unit.bucket)) {
      unitDiagnostics.push({
        severity: "error",
        code: "unsupported_mode_bucket",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: `Memory stream '${unit.bucket}' is not enabled for this extraction mode.`,
      });
    }

    if (unit.bucket === "character_fact" && unit.sectionKey === "current_state") {
      unitDiagnostics.push({
        severity: "error",
        code: "transient_character_state",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Character facts cannot store the removed transient current_state section.",
      });
    }

    if (unit.bucket === "timeline_event" && unit.sectionKey !== "event") {
      unitDiagnostics.push({
        severity: "error",
        code: "invalid_timeline_section",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Timeline events must use the event section.",
      });
    }

    if (unit.evidence.length === 0) {
      unitDiagnostics.push({
        severity: "error",
        code: "missing_evidence",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Evidence unit has no evidence reference.",
      });
    }

    if (sourceEvidence && !unit.evidence.includes(sourceEvidence)) {
      unitDiagnostics.push({
        severity: "error",
        code: "missing_source_note_evidence",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Evidence unit must reference the source note evidence.",
      });
    }

    if (expectedSourceHash && unit.sourceHash !== expectedSourceHash) {
      unitDiagnostics.push({
        severity: "error",
        code: "source_hash_mismatch",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Evidence unit sourceHash does not match the source note hash.",
      });
    }

    if (unit.text.length > 2_000) {
      unitDiagnostics.push({
        severity: "error",
        code: "overlong_evidence_unit",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Evidence unit text exceeds the maximum memory stream length.",
      });
    }

    if (!isValidNoteId(noteId)) {
      unitDiagnostics.push({
        severity: "error",
        code: "overlong_target_note_id",
        candidateIndex,
        mutationId: unit.id,
        message: `Generated target note id '${noteId}' exceeds the long-term memory storage contract.`,
      });
    }

    if (isSourceSummaryPayload(unit.text)) {
      unitDiagnostics.push({
        severity: "error",
        code: "source_summary_payload",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Evidence unit copies source-summary/transcript structure instead of a memory stream.",
      });
    }

    if (isEventShapedCharacterFact(unit)) {
      unitDiagnostics.push({
        severity: "error",
        code: "event_shaped_character_fact",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Character fact candidates must not capture ordinary scene actions or timeline beats.",
      });
    }

    if (isVagueThread(unit)) {
      unitDiagnostics.push({
        severity: "error",
        code: "vague_thread",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Thread candidates must describe an unresolved condition and what would resolve it.",
      });
    }

    if (isSceneOnlyToneOrAnchor(unit)) {
      unitDiagnostics.push({
        severity: "error",
        code: "scene_only_tone_or_anchor",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Tone and anchor candidates must describe durable atmosphere, motifs, or callbacks.",
      });
    }

    unitDiagnostics.push(...relationshipDimensionDiagnostics(unit, candidateIndex, noteId));
    if (unit.claimKind === "static" && Object.keys(unit.dimensionChanges ?? {}).length > 0) {
      unitDiagnostics.push({
        severity: "error",
        code: "static_relationship_dimension_change",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Relationship dimension changes must be classified as change claims.",
      });
    }
    unitDiagnostics.push(...relationshipCausedByDiagnostics(unit, candidateIndex, noteId, validLinkTargets));
    unitDiagnostics.push(...linkTargetDiagnostics(unit, candidateIndex, noteId, validLinkTargets));
    unitDiagnostics.push(...relationshipDeltaMagnitudeDiagnostics(unit, candidateIndex, noteId, units, existingNotes));

    for (const quote of DIALOGUE_BUCKETS.has(unit.bucket) ? quotedStrings(unit.text) : []) {
      if (!sourceText.includes(quote)) {
        unitDiagnostics.push({
          severity: "error",
          code: "unsupported_dialogue_quote",
          candidateIndex,
          mutationId: unit.id,
          noteId,
          message: "Voice/tone quote is not present in the source text.",
        });
      }
    }

    if (lexicalOverlap(sourceText, unit.text) < 0.08) {
      diagnostics.push({
        severity: "warning",
        code: "low_lexical_evidence",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Evidence unit has low lexical overlap with the source note.",
      });
    }

    const dropDiagnostic = unitDiagnostics.find((diagnostic) => diagnostic.severity === "error");
    if (dropDiagnostic) {
      const reason = diagnosticToDropReason(dropDiagnostic.code);
      if (reason) {
        drop({
          candidateIndex,
          reason,
          message: userFacingDropMessageForDiagnostic(dropDiagnostic, reason),
          code: dropDiagnostic.code,
          details: dropDiagnostic.details,
        });
      } else {
        diagnostics.push(...unitDiagnostics);
      }
      continue;
    }

    diagnostics.push(...unitDiagnostics);
    keptUnits.push(unit);
    keptCandidateIndexes.set(unit, candidateIndex);
  }

  const dropKeptUnit = (
    unit: LtmEvidenceUnit,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) => {
    const candidateIndex = keptCandidateIndexes.get(unit) ?? 0;
    const noteId = noteIdForEvidenceUnit(unit);
    const dropped = droppedCandidate({
      candidateIndex,
      reason: "unsupported_bucket",
      message,
      unit,
    });
    droppedCandidates.push(dropped);
    diagnostics.push({
      severity: "error",
      code: dropReasonDiagnosticCode(dropped.reason),
      candidateIndex,
      mutationId: unit.id,
      noteId,
      message: dropped.message,
      details: { validatorCode: code, validationStage: "closure", ...details },
    });
  };

  let finalKeptUnits = [...keptUnits];
  let changed = true;
  while (changed) {
    changed = false;
    const relationshipSupported = finalKeptUnits.filter((unit) => {
      if (hasRelationshipSupport(unit, finalKeptUnits, existingNotes)) return true;
      const causedByTargets = unit.links.filter((link) => link.relation === "caused_by").map((link) => link.target);
      dropKeptUnit(
        unit,
        "relationship_state_missing_caused_by",
        causedByTargets.length > 0
          ? `Dropped a relationship_state change whose caused_by target '${causedByTargets.join("', '")}' was removed during validation.`
          : userFacingDropMessageForCode("relationship_state_missing_caused_by", "unsupported_bucket"),
        {
          causedByTargets,
          invalidCausedByTargets: causedByTargets,
        },
      );
      changed = true;
      return false;
    });
    const closedTargets = new Set<string>([
      ...(sourceNote ? [sourceNote.id] : []),
      ...existingNotes.map((note) => note.id),
      ...relationshipSupported.map((unit) => noteIdForEvidenceUnit(unit)),
    ]);
    finalKeptUnits = relationshipSupported.filter((unit) => {
      const missingLink = unit.links.find((link) => !closedTargets.has(link.target));
      if (!missingLink) return true;
      dropKeptUnit(
        unit,
        "unknown_link_target",
        `Dropped a candidate whose link target '${missingLink.target}' was removed during validation.`,
        { linkTarget: missingLink.target, linkRelation: missingLink.relation },
      );
      changed = true;
      return false;
    });
  }

  for (const unit of finalKeptUnits) {
    if (unit.bucket !== "thread" || unit.status !== "resolved") continue;
    const threadSubjects = new Set<string>([unit.subjectId]);
    for (const link of unit.links) {
      if (link.target !== unit.subjectId) {
        threadSubjects.add(link.target);
      }
    }
    const hasFanOut = finalKeptUnits.some(
      (other) => other !== unit && other.bucket === "timeline_event" && threadSubjects.has(other.subjectId),
    );
    if (!hasFanOut) {
      diagnostics.push({
        severity: "warning",
        code: "resolved_thread_missing_fanout",
        mutationId: unit.id,
        noteId: noteIdForEvidenceUnit(unit),
        message: `Resolved thread '${unit.subjectId}' has no parallel timeline_event capturing the resolution as history.`,
      });
    }
  }

  return { keptUnits: finalKeptUnits, diagnostics, droppedCandidates };
}

function placeholderDiagnostics(
  unit: LtmEvidenceUnit,
  noteId: string,
  candidateIndex: number,
): LtmExtractionDiagnostic[] {
  const diagnostics: LtmExtractionDiagnostic[] = [];
  const hasPlaceholderIdentifier = (value: string) => value.toLowerCase().includes("lowercase_snake_case");

  if (unit.id.toLowerCase() === PLACEHOLDER_UUID) {
    diagnostics.push({
      severity: "error",
      code: "placeholder_evidence_unit_id",
      candidateIndex,
      mutationId: unit.id,
      noteId,
      message: "Evidence unit uses a copied placeholder UUID.",
    });
  }

  if (hasPlaceholderIdentifier(unit.subjectId)) {
    diagnostics.push({
      severity: "error",
      code: "placeholder_subject_id",
      candidateIndex,
      mutationId: unit.id,
      noteId,
      message: "Evidence unit subjectId uses a copied placeholder identifier.",
    });
  }

  if (hasPlaceholderIdentifier(unit.sectionKey)) {
    diagnostics.push({
      severity: "error",
      code: "placeholder_section_key",
      candidateIndex,
      mutationId: unit.id,
      noteId,
      message: "Evidence unit sectionKey uses a copied placeholder identifier.",
    });
  }

  for (const link of unit.links) {
    if (link.target === "target_note_id") {
      diagnostics.push({
        severity: "error",
        code: "placeholder_link_target",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: "Evidence unit link target uses a copied placeholder note id.",
      });
    }
  }

  return diagnostics;
}

function isEventShapedCharacterFact(unit: LtmEvidenceUnit) {
  if (unit.bucket !== "character_fact") return false;
  if (CHARACTER_FACT_DURABLE_SECTION_KEYS.has(unit.sectionKey)) return false;
  if (!CHARACTER_FACT_EVENT_SECTION_KEYS.has(unit.sectionKey)) return false;
  return EVENT_SHAPED_CHARACTER_FACT_PATTERN.test(unit.text);
}

function isVagueThread(unit: LtmEvidenceUnit) {
  if (unit.bucket !== "thread") return false;
  return !THREAD_RESOLUTION_PATTERN.test(unit.text);
}

function isSceneOnlyToneOrAnchor(unit: LtmEvidenceUnit) {
  if (unit.bucket !== "tone" && unit.bucket !== "anchor") return false;
  return SCENE_ONLY_TONE_PATTERN.test(unit.text);
}

function relationshipDimensionDiagnostics(
  unit: LtmEvidenceUnit,
  candidateIndex: number,
  noteId: string,
): LtmExtractionDiagnostic[] {
  if (unit.bucket !== "relationship_state") return [];
  const diagnostics: LtmExtractionDiagnostic[] = [];
  for (const key of Object.keys(unit.dimensions ?? {})) {
    if (!RELATIONSHIP_DIMENSION_KEYS.has(key)) {
      diagnostics.push({
        severity: "error",
        code: "invalid_relationship_dimension",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: `Relationship dimension '${key}' is not supported.`,
      });
    }
  }
  for (const key of Object.keys(unit.dimensionChanges ?? {})) {
    if (!RELATIONSHIP_DIMENSION_KEYS.has(key)) {
      diagnostics.push({
        severity: "error",
        code: "invalid_relationship_dimension_change",
        candidateIndex,
        mutationId: unit.id,
        noteId,
        message: `Relationship dimension change '${key}' is not supported.`,
      });
    }
  }
  return diagnostics;
}

function relationshipCausedByDiagnostics(
  unit: LtmEvidenceUnit,
  candidateIndex: number,
  noteId: string,
  validLinkTargets: Set<string>,
): LtmExtractionDiagnostic[] {
  if (unit.bucket !== "relationship_state") return [];
  const describesChange = relationshipDescribesChange(unit);
  if (!describesChange) return [];
  const causedByTargets = unit.links.filter((link) => link.relation === "caused_by").map((link) => link.target);
  const invalidCausedByTargets = causedByTargets.filter((target) => !validLinkTargets.has(target));
  const hasCausedBy = causedByTargets.some((target) => validLinkTargets.has(target));
  if (hasCausedBy) return [];
  const invalidTargetMessage = invalidCausedByTargets.length
    ? `Dropped a relationship_state change whose caused_by target '${invalidCausedByTargets.join("', '")}' does not exist in the extraction batch or existing notes.`
    : "Dropped a relationship_state change missing a caused_by link to a timeline event or existing note.";
  return [
    {
      severity: "error",
      code: "relationship_state_missing_caused_by",
      candidateIndex,
      mutationId: unit.id,
      noteId,
      message: invalidTargetMessage,
      details: { causedByTargets, invalidCausedByTargets },
    },
  ];
}

function linkTargetDiagnostics(
  unit: LtmEvidenceUnit,
  candidateIndex: number,
  noteId: string,
  validLinkTargets: Set<string>,
): LtmExtractionDiagnostic[] {
  return unit.links.flatMap((link) =>
    validLinkTargets.has(link.target)
      ? []
      : [
          {
            severity: "error" as const,
            code: "unknown_link_target",
            candidateIndex,
            mutationId: unit.id,
            noteId,
            message: `Link target '${link.target}' does not exist in the extraction batch or existing notes.`,
            details: { linkTarget: link.target, linkRelation: link.relation },
          },
        ],
  );
}

function relationshipDeltaMagnitudeDiagnostics(
  unit: LtmEvidenceUnit,
  candidateIndex: number,
  noteId: string,
  units: LtmEvidenceUnit[],
  existingNotes: LtmNote[],
): LtmExtractionDiagnostic[] {
  if (unit.bucket !== "relationship_state") return [];
  const largeChanges = Object.fromEntries(
    Object.entries(unit.dimensionChanges ?? {}).filter(
      ([, value]) => Math.abs(value) >= SUSPICIOUS_RELATIONSHIP_DELTA_THRESHOLD,
    ),
  );
  if (Object.keys(largeChanges).length === 0) return [];
  const causeText = relationshipCauseSupportText(unit, units, existingNotes);
  if (MAJOR_RELATIONSHIP_CAUSE_PATTERN.test(`${unit.text} ${causeText}`)) return [];
  return [
    {
      severity: "warning",
      code: "suspicious_relationship_delta",
      candidateIndex,
      mutationId: unit.id,
      noteId,
      message: "Relationship dimension changes look large for the available causal support.",
      details: {
        threshold: SUSPICIOUS_RELATIONSHIP_DELTA_THRESHOLD,
        dimensionChanges: largeChanges,
        causedByTargets: unit.links.filter((link) => link.relation === "caused_by").map((link) => link.target),
      },
    },
  ];
}

function relationshipCauseSupportText(unit: LtmEvidenceUnit, units: LtmEvidenceUnit[], existingNotes: LtmNote[]) {
  const causedByTargets = new Set(
    unit.links.filter((link) => link.relation === "caused_by").map((link) => link.target),
  );
  if (causedByTargets.size === 0) return "";
  const currentTexts = units.flatMap((candidate) => {
    if (!causedByTargets.has(noteIdForEvidenceUnit(candidate))) return [];
    return [candidate.text];
  });
  const existingTexts = existingNotes.flatMap((note) => {
    if (!causedByTargets.has(note.id)) return [];
    return Object.values(note.sections).map((section) => section.text);
  });
  return [...currentTexts, ...existingTexts].join(" ");
}

export function noteIdForEvidenceUnit(unit: Pick<LtmEvidenceUnit, "bucket" | "subjectId" | "sectionKey">) {
  if (unit.bucket === "timeline_event") return prefixed("timeline", unit.subjectId);
  if (unit.bucket === "thread") return prefixed("thread", unit.subjectId);
  if (unit.bucket === "world_fact") return prefixed("world", unit.subjectId);
  if (unit.bucket === "tone") return prefixed("tone", unit.subjectId);
  if (unit.bucket.startsWith("relationship_")) return prefixed("rel", unit.subjectId);
  if (unit.bucket === "anchor") return noteIdForAnchor(unit.subjectId, unit.sectionKey);
  return prefixed("char", unit.subjectId);
}

function prefixed(prefix: string, subjectId: string) {
  return subjectId.startsWith(`${prefix}_`) ? subjectId : `${prefix}_${subjectId}`;
}

function noteIdForAnchor(subjectId: string, sectionKey: string) {
  if (sectionKey.startsWith("tone")) return prefixed("tone", subjectId);
  return prefixed("world", subjectId);
}

function isSourceSummaryPayload(text: string) {
  return /\b(?:source note|chat summary|transcript|events?:|timeline:|scene summary:)\b/i.test(text);
}

function droppedCandidate(
  input: Required<Pick<DroppedCandidateInput, "candidateIndex" | "reason" | "message" | "unit">> & {
    snippet?: string;
  },
): LtmExtractionDroppedCandidate {
  const recovery = recoveryHintForUnit(input.unit);
  return {
    index: input.candidateIndex,
    reason: input.reason,
    message: input.message,
    ...(safeSnippet(input.snippet ?? input.unit.text)
      ? { snippet: safeSnippet(input.snippet ?? input.unit.text)! }
      : {}),
    ...(recovery ? { recovery } : {}),
  };
}

function recoveryHintForUnit(unit: LtmEvidenceUnit): LtmExtractionRecoveryHint {
  const noteId = noteIdForEvidenceUnit(unit);
  return {
    noteType: targetNoteTypeForUnit(unit),
    ...(isValidNoteId(noteId) ? { noteId } : {}),
    sectionKey: noteIdSectionKeyForUnit(unit),
    status: targetStatusForUnit(unit),
  };
}

function isValidNoteId(noteId: string) {
  return ltmNoteIdSchema.safeParse(noteId).success;
}

function targetNoteTypeForUnit(unit: LtmEvidenceUnit): LtmNote["type"] {
  if (unit.bucket.startsWith("relationship_")) return "relationship";
  if (unit.bucket === "timeline_event") return "timeline_event";
  if (unit.bucket === "thread") return "thread";
  if (unit.bucket === "world_fact") return "world";
  if (unit.bucket === "tone") return "tone";
  if (unit.bucket === "anchor") return noteIdForEvidenceUnit(unit).startsWith("tone_") ? "tone" : "world";
  return "character";
}

function noteIdSectionKeyForUnit(unit: LtmEvidenceUnit) {
  if (unit.bucket === "timeline_event") return unit.sectionKey || "event";
  if (unit.bucket === "relationship_state") return "state";
  if (unit.bucket === "character_fact") return unit.sectionKey || "facts";
  if (unit.bucket === "tone") return "observations";
  if (unit.bucket === "thread" && unit.status === "resolved") return "summary";
  return unit.sectionKey;
}

function targetStatusForUnit(unit: LtmEvidenceUnit): LtmNote["status"] {
  if (unit.status === "archived") return "archived";
  if (unit.bucket === "thread" && unit.status === "resolved") return "archived";
  return "active";
}

function diagnosticToDropReason(code: string): LtmExtractionDropReason | null {
  if (
    code === "placeholder_evidence_unit_id" ||
    code === "placeholder_subject_id" ||
    code === "placeholder_section_key" ||
    code === "placeholder_link_target"
  ) {
    return "placeholder_output";
  }
  if (code === "unsupported_dialogue_quote") return "quote_not_found_in_source";
  if (code === "missing_source_note_evidence" || code === "missing_evidence") return "missing_source_evidence";
  if (code === "source_summary_payload") return "source_summary_payload";
  if (
    code === "unsupported_source_extraction_bucket" ||
    code === "unsupported_mode_bucket" ||
    code === "transient_character_state" ||
    code === "invalid_timeline_section" ||
    code === "relationship_state_without_history" ||
    code === "relationship_state_missing_caused_by" ||
    code === "invalid_relationship_dimension" ||
    code === "invalid_relationship_dimension_change" ||
    code === "static_relationship_dimension_change" ||
    code === "unknown_link_target" ||
    code === "event_shaped_character_fact" ||
    code === "vague_thread" ||
    code === "scene_only_tone_or_anchor"
  ) {
    return "unsupported_bucket";
  }
  if (code === "overlong_evidence_unit" || code === "overlong_target_note_id")
    return "too_long_to_keep_safely";
  return null;
}

function dropReasonDiagnosticCode(reason: LtmExtractionDropReason) {
  switch (reason) {
    case "placeholder_output":
      return "candidate_dropped_placeholder_output";
    case "quote_not_found_in_source":
      return "candidate_dropped_quote_not_found_in_source";
    case "missing_source_evidence":
      return "candidate_dropped_missing_source_evidence";
    case "source_summary_payload":
      return "candidate_dropped_source_summary_payload";
    case "unsupported_bucket":
      return "candidate_dropped_unsupported_bucket";
    case "target_note_outside_scope":
      return "candidate_dropped_target_note_outside_scope";
    case "ambiguous_subject":
      return "candidate_dropped_ambiguous_subject";
    case "untrusted_subject":
      return "candidate_dropped_untrusted_subject";
    case "invalid_subject_cardinality":
      return "candidate_dropped_invalid_subject_cardinality";
    case "too_long_to_keep_safely":
      return "candidate_dropped_too_long_to_keep_safely";
    case "invalid_format":
      return "candidate_dropped_invalid_format";
  }
}

function userFacingDropMessageForCode(code: string, reason: LtmExtractionDropReason): string {
  if (code === "relationship_state_missing_caused_by") {
    return "Dropped a relationship_state change missing a caused_by link to a timeline event or existing note.";
  }
  if (code === "vague_thread") {
    return "Dropped a thread that did not state what future event or condition would resolve it.";
  }
  return userFacingDropMessage(reason);
}

function userFacingDropMessageForDiagnostic(diagnostic: LtmExtractionDiagnostic, reason: LtmExtractionDropReason) {
  if (diagnostic.code === "unknown_link_target" || diagnostic.code === "relationship_state_missing_caused_by") {
    return diagnostic.message;
  }
  return userFacingDropMessageForCode(diagnostic.code, reason);
}

function userFacingDropMessage(reason: LtmExtractionDropReason) {
  switch (reason) {
    case "placeholder_output":
      return "Dropped copied placeholder output.";
    case "quote_not_found_in_source":
      return "Dropped a quote that was not present in the source.";
    case "missing_source_evidence":
      return "Dropped a candidate that did not include usable source evidence.";
    case "source_summary_payload":
      return "Dropped a candidate that looked like a source-summary transcript instead of a memory stream.";
    case "unsupported_bucket":
      return "Dropped a candidate that used the wrong memory stream for source-summary extraction.";
    case "target_note_outside_scope":
      return "Dropped a candidate that targeted a memory outside this source's scope.";
    case "ambiguous_subject":
      return "Dropped a candidate whose subject matched more than one trusted identity.";
    case "untrusted_subject":
      return "Dropped a candidate whose subject was not in the trusted roster.";
    case "invalid_subject_cardinality":
      return "Dropped a candidate with the wrong number of subjects for its memory type.";
    case "too_long_to_keep_safely":
      return "Dropped a candidate that was too long to keep safely.";
    case "invalid_format":
      return "Dropped a malformed candidate.";
  }
}
