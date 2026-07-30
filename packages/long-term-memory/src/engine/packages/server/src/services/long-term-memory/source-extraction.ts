import {
  isLtmSourceLikeNote,
  DEFAULT_LTM_ALLOWED_STREAMS_BY_MODE,
  DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE,
  type LtmExtractionAccounting,
  type LtmDraftMutation,
  type LtmExtractionOutcome,
  type LtmExtractionResponse,
  type LtmExtractionDraft,
  type LtmMode,
  type LtmNote,
  type LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/index.js";
import { logger, type PackageLanguageModel } from "./package-runtime.js";
import {
  compileEvidenceUnitExtraction,
  runLongTermMemoryEvidenceUnitExtraction,
  sourceHashForEvidenceUnitExtraction,
  summarizeCompiledEvidenceUnitExtraction,
  sourceMetadataForEvidenceUnitDraft,
} from "./evidence-unit-extraction.js";
import { getLtmExtractionConfig } from "./extraction-config.js";
import { recordLtmDebugEvent, withLtmDebugOperation } from "./debug-log.js";
import type { LtmExtractionDiagnostic } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { LongTermMemoryDraftStore } from "./draft-store.js";
import { uniqueStrings } from "./ltm-utils.js";
import { retrieveLongTermMemory } from "./retrieval.js";
import { canUpdateLtmScopedTarget, resolveScopedEvidenceUnitTargets, scopedVariantNoteId } from "./scoped-targets.js";
import { LongTermMemoryStorage } from "./storage.js";
import { normalizeStructuredSummaryEvidenceUnits } from "./structured-summary-normalizer.js";
import {
  prepareLtmSubjectIdentityContext,
  subjectsEqual,
  trustedLtmIdentityNotesForSource,
  type TrustedLtmSubjectCatalog,
} from "./subject-identity.js";
import { noteIdForLtmDraftMutation, projectLtmDraftOntoNotes } from "./draft-projector.js";
import { stableJsonHash } from "./chunking.js";
import { extractionFingerprintForLtmSourceNote, isLtmSourceExtractionFingerprintCurrent } from "./source-hash.js";
import { LtmServiceError } from "./service-error.js";
export type ExtractLongTermMemoryFromSourceNoteOptions = {
  noteId: string;
  languageModel: PackageLanguageModel;
  root?: string;
  scope?: LtmScope;
  modes?: LtmMode[];
  mode?: LtmMode;
  instruction?: string;
  signal?: AbortSignal;
  operationId?: string;
  chatId?: string;
  trustedSubjectCatalog?: TrustedLtmSubjectCatalog;
};

export type ExtractLongTermMemoryFromSourceNoteResult = {
  operationId: string;
  chatId?: string;
  sourceNote: LtmNote;
  extractionMode: LtmMode;
  response: LtmExtractionResponse;
  diagnostics: LtmExtractionDiagnostic[];
  outcome: LtmExtractionOutcome;
  accounting: LtmExtractionAccounting;
};

export function isLtmSourceNote(note: LtmNote) {
  return isLtmSourceLikeNote(note);
}

export function getLtmSourceNoteText(note: LtmNote) {
  return (note.sections.source?.text ?? note.sections.summary?.text ?? "").trim();
}

async function bindSourceNoteToExtractionContext(options: {
  storage: LongTermMemoryStorage;
  sourceNote: LtmNote;
  scope: LtmScope;
  modes: LtmMode[];
}) {
  const { sourceNote } = options;
  if (
    stableJsonHash(sourceNote.scope) === stableJsonHash(options.scope) &&
    stableJsonHash(sourceNote.modes) === stableJsonHash(options.modes)
  ) {
    return sourceNote;
  }

  return options.storage.updateNote(
    sourceNote.id,
    { scope: options.scope, modes: options.modes },
    {
      actor: "maintenance_api",
      cause: "source_extraction.context_bound",
      summary: `Bound ${sourceNote.title ?? sourceNote.id} to its extraction context`,
    },
  );
}

function compatibleProjectedCreate(
  existing: LtmNote,
  incoming: Extract<LtmDraftMutation, { kind: "create_note" }>["note"],
) {
  if (existing.type !== incoming.type) return false;
  if (!canUpdateLtmScopedTarget(existing.scope, incoming.scope)) return false;
  if (existing.subjects && incoming.subjects && !subjectsEqual(existing.subjects, incoming.subjects)) return false;
  return true;
}

function remapDraftMutationTargets(mutations: LtmDraftMutation[], remaps: ReadonlyMap<string, string>) {
  if (remaps.size === 0) return mutations;
  return mutations.map((mutation): LtmDraftMutation => {
    if (mutation.kind === "create_note") {
      return {
        ...mutation,
        note: {
          ...mutation.note,
          id: remaps.get(mutation.note.id) ?? mutation.note.id,
          links: mutation.note.links.map((link) => ({
            ...link,
            target: remaps.get(link.target) ?? link.target,
          })),
        },
      };
    }
    const noteId = remaps.get(mutation.noteId) ?? mutation.noteId;
    if (mutation.kind === "add_link") {
      return {
        ...mutation,
        noteId,
        link: {
          ...mutation.link,
          target: remaps.get(mutation.link.target) ?? mutation.link.target,
        },
      };
    }
    return { ...mutation, noteId };
  });
}

async function remapDraftCreatesForProjection(options: {
  response: LtmExtractionResponse;
  storage: LongTermMemoryStorage;
  overlay?: ReadonlyMap<string, LtmNote>;
}) {
  const createMutations = options.response.mutations.filter(
    (mutation): mutation is Extract<LtmDraftMutation, { kind: "create_note" }> => mutation.kind === "create_note",
  );
  if (createMutations.length === 0) return options.response;

  const baseIds = uniqueStrings(createMutations.map((mutation) => mutation.note.id));
  const committed = await options.storage.getNotesByIds(baseIds);
  const visible = new Map(committed);
  for (const noteId of baseIds) {
    const projected = options.overlay?.get(noteId);
    if (projected) visible.set(noteId, projected);
  }

  const remaps = new Map<string, string>();
  const reserved = new Set<string>();
  for (const mutation of createMutations) {
    const existing = visible.get(mutation.note.id);
    if (!existing || compatibleProjectedCreate(existing, mutation.note)) continue;

    let resolvedId: string | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidateId = scopedVariantNoteId(mutation.note.id, mutation.note.scope, attempt);
      if (reserved.has(candidateId)) continue;
      const candidate = options.overlay?.get(candidateId) ?? (await options.storage.getNote(candidateId));
      if (!candidate || compatibleProjectedCreate(candidate, mutation.note)) {
        resolvedId = candidateId;
        if (candidate) visible.set(candidateId, candidate);
        break;
      }
    }
    if (!resolvedId) {
      throw new Error(`Unable to resolve projected long-term memory note id for ${mutation.note.id}`);
    }
    remaps.set(mutation.note.id, resolvedId);
    reserved.add(resolvedId);
  }

  return remaps.size > 0
    ? { ...options.response, mutations: remapDraftMutationTargets(options.response.mutations, remaps) }
    : options.response;
}

export async function finalizeLongTermMemoryExtractionDraft(
  input: {
    sourceNote: LtmNote;
    response: LtmExtractionResponse;
    scope: LtmScope;
    modes: LtmMode[];
    extractionMode?: LtmMode;
    operationId?: string;
    diagnostics?: LtmExtractionDiagnostic[];
    outcome?: LtmExtractionOutcome;
    accounting?: LtmExtractionAccounting;
    chatId?: string;
    reviewRequired?: boolean;
    afterWrite?: (draft: LtmExtractionDraft) => Promise<void>;
  },
  options: { root?: string; overlay?: Map<string, LtmNote> } = {},
) {
  const storage = new LongTermMemoryStorage(options.root);
  const currentSource = await storage.getNote(input.sourceNote.id);
  if (!currentSource || !isLtmSourceNote(currentSource)) {
    throw new LtmServiceError(`Long-term memory source note disappeared before draft finalization: ${input.sourceNote.id}`, 404, "ltm_note_not_found");
  }
  if (sourceHashForEvidenceUnitExtraction(currentSource) !== sourceHashForEvidenceUnitExtraction(input.sourceNote)) {
    throw new LtmServiceError(`Long-term memory source note changed before draft finalization: ${input.sourceNote.id}`, 409, "ltm_source_changed");
  }
  const expectedFingerprint = extractionFingerprintForLtmSourceNote(input.sourceNote, {
    scope: input.scope,
    modes: input.modes,
    extractionMode: input.extractionMode,
  });
  if (!isLtmSourceExtractionFingerprintCurrent(currentSource, expectedFingerprint)) {
    throw new LtmServiceError(
      `Long-term memory source extraction context changed before draft finalization: ${input.sourceNote.id}`,
      409,
      "ltm_source_context_changed",
    );
  }

  const response = input.response.mutations.length
    ? await remapDraftCreatesForProjection({
        response: input.response,
        storage,
        overlay: options.overlay,
      })
    : input.response;
  const sourceMetadata = sourceMetadataForEvidenceUnitDraft(currentSource, {
      scope: input.scope,
      modes: input.modes,
      extractionMode: input.extractionMode,
    });
  const source = {
    ...sourceMetadata,
    ...(!sourceMetadata.chatId && input.chatId ? { chatId: input.chatId } : {}),
  };
  const projected = response.mutations.length
    ? await (async () => {
        const targetNoteIds = uniqueStrings(response.mutations.map(noteIdForLtmDraftMutation));
        const committedNotes = await storage.getNotesByIds(targetNoteIds);
        const baseNotes = new Map(committedNotes);
        for (const noteId of targetNoteIds) {
          const overlaid = options.overlay?.get(noteId);
          if (overlaid) baseNotes.set(noteId, overlaid);
        }
        return projectLtmDraftOntoNotes({
          notes: baseNotes,
          mutations: response.mutations,
          context: { source, scope: input.scope, modes: input.modes },
          timestamp: new Date().toISOString(),
        });
      })()
    : null;
  const draft = await new LongTermMemoryDraftStore(options.root).createDraft({
    scope: input.scope,
    modes: input.modes,
    source,
    response,
    operationId: input.operationId,
    diagnostics: input.diagnostics,
    outcome: input.outcome,
    accounting: input.accounting,
    reviewRequired: input.reviewRequired,
    afterWrite: input.afterWrite,
  });
  if (options.overlay && projected) {
    for (const projection of projected.projections) options.overlay.set(projection.noteId, projection.after);
  }
  return draft;
}

async function getExistingTypedNotes(options: {
  storage: LongTermMemoryStorage;
  root?: string;
  sourceText: string;
  sourceTitle?: string;
  scope: LtmScope;
  mode?: LtmMode;
  maxChunks: number;
  maxTokens: number;
  trustedSubjectCatalog?: TrustedLtmSubjectCatalog;
}) {
  const retrieval = await retrieveLongTermMemory({
    root: options.root,
    queryText: options.sourceText,
    scope: options.scope,
    mode: options.mode,
    characterIds: options.scope.characterIds,
    maxChunks: options.maxChunks,
    maxTokens: options.maxTokens,
  });
  const identityNotes = options.trustedSubjectCatalog
    ? trustedLtmIdentityNotesForSource({
        sourceText: options.sourceText,
        sourceTitle: options.sourceTitle,
        catalog: options.trustedSubjectCatalog,
      })
    : [];
  const noteIds = Array.from(new Set([
    ...identityNotes.map((note) => note.id),
    ...retrieval.chunks.map((chunk) => chunk.chunk.noteId),
  ]));
  const notesById = await options.storage.getNotesByIds(noteIds);
  const notes = noteIds
    .map((noteId) => notesById.get(noteId))
    .filter((note): note is LtmNote => {
      if (!note) return false;
      if (isLtmSourceNote(note)) return false;
      if (!canUpdateLtmScopedTarget(note.scope, options.scope)) return false;
      return true;
    });
  const identityIds = new Set(identityNotes.map((note) => note.id));
  return notes.sort(
    (left, right) => Number(identityIds.has(right.id)) - Number(identityIds.has(left.id)) || left.id.localeCompare(right.id),
  );
}

export async function extractLongTermMemoryFromSourceNote(
  options: ExtractLongTermMemoryFromSourceNoteOptions,
): Promise<ExtractLongTermMemoryFromSourceNoteResult> {
  return withLtmDebugOperation(
    {
      operationId: options.operationId,
      root: options.root,
      phase: "extraction",
      action: "extract_source_note",
      sourceNoteId: options.noteId,
      model: options.languageModel.model,
      message: "Extract memory streams from source note",
    },
    async (operationId) => extractLongTermMemoryFromSourceNoteInner({ ...options, operationId }),
  );
}

async function extractLongTermMemoryFromSourceNoteInner(
  options: ExtractLongTermMemoryFromSourceNoteOptions & { operationId: string },
): Promise<ExtractLongTermMemoryFromSourceNoteResult> {
  const storage = new LongTermMemoryStorage(options.root);
  let sourceNote = await storage.getNote(options.noteId);
  if (!sourceNote) {
    logger.warn("[ltm] Source note not found: %s", options.noteId);
    throw new LtmServiceError(`Long-term memory note not found: ${options.noteId}`, 404, "ltm_note_not_found");
  }
  if (!isLtmSourceNote(sourceNote)) {
    logger.warn("[ltm] Note %s is not a source note", options.noteId);
    throw new LtmServiceError(`Long-term memory note is not a source note: ${options.noteId}`, 400, "ltm_source_invalid");
  }

  const requestedScope = options.scope ?? sourceNote.scope;
  const requestedModes = options.modes?.length ? options.modes : sourceNote.modes;
  const resolvedMode = options.mode ?? requestedModes[0] ?? "roleplay";
  if (!requestedModes.includes(resolvedMode)) {
    throw new LtmServiceError(`Long-term memory extraction mode is not enabled for source note: ${resolvedMode}`, 400, "ltm_mode_not_enabled");
  }
  sourceNote = await bindSourceNoteToExtractionContext({
    storage,
    sourceNote,
    scope: requestedScope,
    modes: requestedModes,
  });
  const sourceText = getLtmSourceNoteText(sourceNote);
  if (!sourceText) {
    logger.warn("[ltm] Source note %s has no source text", options.noteId);
    throw new LtmServiceError(`Long-term memory source note has no source text: ${options.noteId}`, 400, "ltm_source_empty");
  }

  const scope = sourceNote.scope;
  const modes = sourceNote.modes;
  const allowedBuckets = [...DEFAULT_LTM_ALLOWED_STREAMS_BY_MODE[resolvedMode]];
  const extractionConfig = await getLtmExtractionConfig(options.root, resolvedMode);
  const estimatedSourceTokens = Math.max(1, Math.ceil(sourceText.length / 4));
  const sourceExceedsTokenLimit = estimatedSourceTokens > extractionConfig.maxSourceTokens;
  if (sourceExceedsTokenLimit) {
    throw new LtmServiceError(`source_too_large: source requires about ${estimatedSourceTokens} tokens; maximum is ${extractionConfig.maxSourceTokens}`, 400, "ltm_source_too_large");
  }
  const extractionText = sourceText;
  await recordLtmDebugEvent({
    operationId: options.operationId,
    root: options.root,
    phase: "source_note",
    action: "source_note_loaded",
    status: "ok",
    sourceNoteId: sourceNote.id,
    counts: {
      sourceChars: sourceText.length,
      sections: Object.keys(sourceNote.sections).length,
      modes: modes.length,
    },
    details: {
      scope,
      tags: sourceNote.tags,
      mode: resolvedMode,
      extractionSettings: {
        reasoningEffort: extractionConfig.reasoningEffort,
        verbosity: extractionConfig.verbosity,
        maxOutputTokens: extractionConfig.maxOutputTokens,
        temperature: extractionConfig.temperature,
        sourceTextPolicy: "full",
        maxSourceTokens: extractionConfig.maxSourceTokens,
        maxExistingNoteTokens: extractionConfig.maxExistingNoteTokens,
        existingNoteCandidateChunks: extractionConfig.existingNoteMaxChunks,
        existingNoteMaxTokens: extractionConfig.existingNoteMaxTokens,
        activePromptTemplateId: extractionConfig.activePromptTemplateId,
        usesPromptTemplate: Boolean(extractionConfig.activePromptTemplateId),
        hasPromptOverride: extractionConfig.systemPrompt !== DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE[resolvedMode],
        aiKeywordExtraction: extractionConfig.aiKeywordExtraction,
      },
    },
  });
  const existingNotes = await getExistingTypedNotes({
    storage,
    root: options.root,
    sourceText: extractionText,
    sourceTitle: sourceNote.title,
    scope,
    mode: resolvedMode,
    maxChunks: extractionConfig.existingNoteMaxChunks,
    maxTokens: extractionConfig.existingNoteMaxTokens,
    trustedSubjectCatalog: options.trustedSubjectCatalog,
  });
  await recordLtmDebugEvent({
    operationId: options.operationId,
    root: options.root,
    phase: "retrieval",
    action: "existing_notes_loaded",
    status: "ok",
    sourceNoteId: sourceNote.id,
    counts: {
      existingNotes: existingNotes.length,
    },
    details: {
      noteIds: existingNotes.map((note) => note.id).slice(0, 80),
    },
  });
  const sourceHash = sourceHashForEvidenceUnitExtraction(sourceNote);
  await recordLtmDebugEvent({
    operationId: options.operationId,
    root: options.root,
    phase: "extraction",
    action: "source_hash_ready",
    status: "ok",
    sourceNoteId: sourceNote.id,
    details: { sourceHash },
  });

  const baseExtractionOptions = {
    sourceNote,
    sourceText: extractionText,
    existingNotes,
    languageModel: options.languageModel,
    root: options.root,
    scope,
    modes,
    sourceHash,
    instruction: options.instruction,
    systemPrompt: extractionConfig.systemPrompt,
    reasoningEffort: extractionConfig.reasoningEffort,
    verbosity: extractionConfig.verbosity,
    maxOutputTokens: extractionConfig.maxOutputTokens,
    temperature: extractionConfig.temperature,
    maxExistingNoteTokens: extractionConfig.maxExistingNoteTokens,
    signal: options.signal,
    operationId: options.operationId,
    allowedBuckets,
    mode: resolvedMode,
    aiKeywordExtraction: extractionConfig.aiKeywordExtraction,
    resolveSubjectNames: true,
    trustedSubjectCatalog: options.trustedSubjectCatalog,
  };

  const extractionPayload = await runLongTermMemoryEvidenceUnitExtraction(baseExtractionOptions);
  const identityContext = prepareLtmSubjectIdentityContext({
    units: extractionPayload.response.units,
    catalog: options.trustedSubjectCatalog ?? { entries: [], notes: [] },
    sourceBackedNpcSourceText: sourceText,
    sourceBackedNpcSourceTitle: sourceNote.title,
  });
  const normalizedExtraction = normalizeStructuredSummaryEvidenceUnits({
    units: extractionPayload.response.units,
    sourceText,
    sourceNote,
    sourceHash,
    existingNotes,
    allowedBuckets,
    mode: resolvedMode,
    modes,
    relationshipIdentityKey: identityContext.identityKeyForUnit,
  });
  const unitResponse = {
    ...extractionPayload.response,
    units: normalizedExtraction.units,
  };
  const identityResolution = identityContext.resolve({
    units: unitResponse.units,
    existingNotes,
    enforceTrustedSubjects: Boolean(options.trustedSubjectCatalog),
  });
  const targetResolution = await resolveScopedEvidenceUnitTargets({
    storage,
    existingNotes: identityResolution.existingNotes,
    units: identityResolution.units,
    scope,
  });
  const compilerExistingNotes = targetResolution.existingNotes;
  if (compilerExistingNotes.length !== existingNotes.length || targetResolution.remaps.size > 0) {
    await recordLtmDebugEvent({
      operationId: options.operationId,
      root: options.root,
      phase: "retrieval",
      action: "existing_target_notes_loaded",
      status: targetResolution.remaps.size > 0 ? "warning" : "ok",
      sourceNoteId: sourceNote.id,
      counts: {
        existingNotes: compilerExistingNotes.length,
        addedTargetNotes: compilerExistingNotes.length - existingNotes.length,
        scopedTargetRemaps: targetResolution.remaps.size,
      },
      details: {
        noteIds: compilerExistingNotes.map((note) => note.id).slice(0, 80),
        scopedTargetRemaps: Object.fromEntries(targetResolution.remaps),
      },
    });
  }
  const compiled = compileEvidenceUnitExtraction({
    unitResponse: {
      ...unitResponse,
      units: targetResolution.units,
    },
    providerCandidates: extractionPayload.totalCandidates,
    parserRejectionCount: extractionPayload.parserRejections,
    normalizedAdditions: normalizedExtraction.addedUnits,
    parserDroppedCandidates: extractionPayload.droppedCandidates,
    preValidationDroppedCandidates: identityResolution.droppedCandidates,
    sourceText,
    sourceNote,
    existingNotes: compilerExistingNotes,
    scope,
    modes: [resolvedMode],
    mode: resolvedMode,
    sourceHash,
    allowedBuckets,
    skipStructuredBackfill: true,
  });
  compiled.diagnostics.push(...identityResolution.diagnostics, ...targetResolution.diagnostics);
  const compiledSummary = summarizeCompiledEvidenceUnitExtraction(compiled);
  await recordLtmDebugEvent({
    operationId: options.operationId,
    root: options.root,
    phase: "compiler",
    action: "evidence_units_compiled",
    status: compiledSummary.counts.candidateRejectionDiagnostics > 0 ? "warning" : "ok",
    sourceNoteId: sourceNote.id,
    counts: compiledSummary.counts,
    diagnostics: compiled.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    details: {
      mutationKinds: compiledSummary.mutationKinds,
      targetNoteIds: compiledSummary.targetNoteIds,
      summary: compiled.compiledResponse.summary,
    },
  });

  await recordLtmDebugEvent({
    operationId: options.operationId,
    root: options.root,
    phase: "draft",
    action: "draft_deferred",
    status: "ok",
    sourceNoteId: sourceNote.id,
    draftId: undefined,
    counts: {
      mutations: compiled.compiledResponse.mutations.length,
      diagnostics: compiled.diagnostics.length,
      droppedUnits: compiled.outcome.droppedUnits,
    },
    diagnostics: compiled.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    details: {
      reason: "deferred_for_commit",
      extractionOutcome: compiled.outcome,
    },
  });
  return {
    operationId: options.operationId,
    ...(options.chatId ? { chatId: options.chatId } : {}),
    sourceNote,
    extractionMode: resolvedMode,
    response: compiled.compiledResponse,
    diagnostics: compiled.diagnostics,
    outcome: compiled.outcome,
    accounting: compiled.accounting,
  };
}
