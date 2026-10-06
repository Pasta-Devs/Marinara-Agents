import { randomUUID } from "node:crypto";

import {
  ltmExtractionDraftSchema,
  ltmResolveSubjectIdentityRequestSchema,
  type LtmResolveSubjectIdentityResponse,
  type LtmSavedSubjectIdentityChoice,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { ltmScopeFamilyId, localCharacterSubjectForName } from "./chat-scope.js";
import { LongTermMemoryDraftStore } from "./draft-store.js";
import { compileEvidenceUnitExtraction, sourceHashForEvidenceUnitExtraction } from "./evidence-unit-extraction.js";
import { getLongTermMemoryRoot } from "./paths.js";
import { readAllRejectedSuggestions, resolveRejectedSuggestionIdentity } from "./rejected-suggestions.js";
import { resolveScopedEvidenceUnitTargets } from "./scoped-targets.js";
import { LtmServiceError } from "./service-error.js";
import { getLtmSourceNoteText, isLtmSourceNote } from "./source-extraction.js";
import { extractionFingerprintForLtmSourceNote, extractionFingerprintsEqual } from "./source-hash.js";
import { LongTermMemoryStorage } from "./storage.js";
import { loadTrustedLtmSubjectCatalog, prepareLtmSubjectIdentityContext } from "./subject-identity.js";
import { withLtmVaultLock } from "./vault-lock.js";

export async function resolveLtmSubjectIdentityReview(
  id: string,
  input: unknown,
  root = getLongTermMemoryRoot(),
): Promise<LtmResolveSubjectIdentityResponse> {
  const { choices: decisions } = ltmResolveSubjectIdentityRequestSchema.parse(input);
  return withLtmVaultLock(root, async () => {
    const storage = new LongTermMemoryStorage(root);
    await storage.initializeLtmStore();
    const suggestion = (await readAllRejectedSuggestions(root)).find((item) => item.id === id);
    if (!suggestion)
      throw new LtmServiceError("Rejected suggestion not found.", 404, "ltm_rejected_suggestion_not_found");
    const draftStore = new LongTermMemoryDraftStore(root);
    if (suggestion.identityResolution) {
      const previous = suggestion.identityResolution.choices.map((choice) => ({
        name: choice.name,
        action: choice.action,
        ...(choice.action === "bind" ? { subjectKey: choice.subject.key } : {}),
      }));
      if (JSON.stringify(previous) !== JSON.stringify(decisions))
        throw new LtmServiceError(
          "This suggestion already has a saved identity decision.",
          409,
          "ltm_identity_already_resolved",
        );
      return {
        resolved: true,
        suggestionId: id,
        draft: suggestion.identityResolution.draftId
          ? await draftStore.getDraft(suggestion.identityResolution.draftId)
          : null,
      };
    }

    const unit = suggestion.candidate.recoveryCandidate;
    const familyId = ltmScopeFamilyId(suggestion.scope);
    if (
      !suggestion.candidate.identityReview ||
      !unit?.subjectNames?.length ||
      !familyId ||
      (unit.bucket !== "character_fact" && unit.bucket !== "relationship_state")
    )
      throw new LtmServiceError(
        "This suggestion does not support identity choices.",
        400,
        "ltm_identity_review_unavailable",
      );
    if (
      decisions.length !== unit.subjectNames.length ||
      new Set(decisions.map((choice) => choice.name)).size !== decisions.length ||
      decisions.some((choice, index) => choice.name !== unit.subjectNames![index])
    )
      throw new LtmServiceError(
        "Choose an identity for each named participant.",
        400,
        "ltm_identity_participants_invalid",
      );

    const sourceNote = await storage.getNote(suggestion.source.sourceNoteId);
    if (!sourceNote || !isLtmSourceNote(sourceNote) || sourceNote.status === "archived")
      throw new LtmServiceError(
        "The source is missing or archived; restore it before reviewing this suggestion.",
        409,
        "ltm_source_missing",
      );
    const mode = suggestion.source.extractionFingerprint?.extractionMode ?? suggestion.modes[0]!;
    const fingerprint = extractionFingerprintForLtmSourceNote(sourceNote, { extractionMode: mode });
    if (
      sourceHashForEvidenceUnitExtraction(sourceNote) !== suggestion.source.sourceHash ||
      sourceHashForEvidenceUnitExtraction(sourceNote) !== unit.sourceHash ||
      ltmScopeFamilyId(sourceNote.destinationScope ?? sourceNote.scope) !== familyId ||
      (suggestion.source.extractionFingerprint &&
        !extractionFingerprintsEqual(fingerprint, suggestion.source.extractionFingerprint))
    )
      throw new LtmServiceError(
        "The source or its scope changed; re-extract it before saving identity choices.",
        409,
        "ltm_source_changed",
      );

    const catalog = await loadTrustedLtmSubjectCatalog(suggestion.scope, root);
    const contextOptions = {
      units: [unit],
      catalog,
      scope: suggestion.scope,
      mode,
      sourceBackedNpcSourceText: getLtmSourceNoteText(sourceNote),
      sourceBackedNpcSourceTitle: sourceNote.title,
    };
    const participants = prepareLtmSubjectIdentityContext(contextOptions).reviewForUnit(unit);
    const choices: LtmSavedSubjectIdentityChoice[] = decisions.map((decision, index) => {
      if (decision.action === "skip") return decision;
      if (decision.action === "different") {
        const subject =
          participants[index]?.allowDifferent &&
          mode === "roleplay" &&
          localCharacterSubjectForName(suggestion.scope, decision.name);
        if (!subject)
          throw new LtmServiceError(
            "A separate local character needs a source-backed name and a Roleplay chat or group.",
            400,
            "ltm_local_character_scope_invalid",
          );
        return { name: decision.name, action: "different", subject };
      }
      const subject = participants[index]?.candidates.find(
        (candidate) => candidate.subject.key === decision.subjectKey,
      )?.subject;
      if (!subject)
        throw new LtmServiceError(
          "The selected subject is not a current scoped candidate for this name.",
          400,
          "ltm_subject_choice_untrusted",
        );
      return { name: decision.name, action: "bind", subject };
    });
    const timestamp = new Date().toISOString();
    let draft: LtmResolveSubjectIdentityResponse["draft"] = null;
    if (!choices.some((choice) => choice.action === "skip")) {
      if (
        new Set(choices.map((choice) => (choice.action === "skip" ? "" : choice.subject.key))).size !== choices.length
      )
        throw new LtmServiceError(
          "Relationship participants must remain distinct.",
          400,
          "ltm_identity_participants_invalid",
        );
      catalog.identityChoices = [
        ...(catalog.identityChoices ?? []),
        ...choices.map((choice) => ({ ...choice, familyId })),
      ];
      const existingNotes = await storage.listNotes({ scope: suggestion.scope, includeGlobal: false });
      const identities = prepareLtmSubjectIdentityContext(contextOptions).resolve({ units: [unit], existingNotes });
      if (identities.droppedCandidates.length)
        throw new LtmServiceError(
          "The chosen identity still has a conflict. Correct the memories before recovering this suggestion.",
          409,
          "ltm_identity_conflict",
        );
      const targets = await resolveScopedEvidenceUnitTargets({
        storage,
        units: identities.units,
        existingNotes: identities.existingNotes,
        scope: suggestion.scope,
      });
      const compiled = compileEvidenceUnitExtraction({
        unitResponse: { summary: "Recover reviewed subject identities", units: targets.units },
        sourceNote,
        sourceText: getLtmSourceNoteText(sourceNote),
        sourceHash: unit.sourceHash,
        existingNotes: targets.existingNotes,
        scope: suggestion.scope,
        modes: suggestion.modes,
        mode,
        skipStructuredBackfill: true,
      });
      if (compiled.outcome.droppedUnits)
        throw new LtmServiceError(
          `The recovered content needs correction before it can become a draft. The suggestion has been kept. ${compiled.outcome.droppedCandidates[0]?.message ?? ""}`,
          409,
          "ltm_identity_recovery_invalid",
        );
      if (compiled.compiledResponse.mutations.length) {
        // The draft gets its own id. Reusing the rejected-suggestion id collides with a recovery
        // draft that a newer extraction superseded, or that was already accepted, and permanently
        // blocked re-resolving the same re-extracted candidate.
        const draftId = randomUUID();
        draft = ltmExtractionDraftSchema.parse({
          id: draftId,
          operationId: draftId,
          createdAt: timestamp,
          updatedAt: timestamp,
          reviewRequired: true,
          source: suggestion.source,
          scope: suggestion.scope,
          modes: suggestion.modes,
          ...compiled.compiledResponse,
          diagnostics: [...compiled.diagnostics, ...identities.diagnostics],
          extractionOutcome: compiled.outcome,
          accounting: compiled.accounting,
        });
      }
    }
    await resolveRejectedSuggestionIdentity(
      id,
      { choices, resolvedAt: timestamp, ...(draft ? { draftId: draft.id } : {}) },
      draft,
      root,
    );
    return { resolved: true, suggestionId: id, draft };
  });
}
