import type { LtmMode, LtmNote, LtmScope } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { rebuildLongTermMemoryIndexes } from "./rebuild.js";
import { applyLongTermMemoryDraft } from "./reconciliation.js";
import { extractLongTermMemoryFromSourceNote } from "./source-extraction.js";
import { LongTermMemoryStorage } from "./storage.js";
import { loadTrustedLtmSubjectCatalog } from "./subject-identity.js";
import type { LongTermMemoryExtractionModel } from "./model.js";

export async function processLongTermMemorySource(options: {
  sourceNote: LtmNote;
  provider: LongTermMemoryExtractionModel;
  model: string;
  scope?: LtmScope;
  modes?: LtmMode[];
  mode?: LtmMode;
  instruction?: string;
  operationId: string;
  applyLowRisk?: boolean;
  root?: string;
  chatId?: string;
}) {
  if (options.sourceNote.tags.includes("imported_game_journal")) {
    throw new Error("Game journal extraction is not supported by this package route");
  }
  const scope = options.scope ?? options.sourceNote.scope;
  const prepared = await extractLongTermMemoryFromSourceNote({
    noteId: options.sourceNote.id,
    provider: options.provider,
    model: options.model,
    scope,
    modes: options.modes ?? options.sourceNote.modes,
    mode: options.mode,
    instruction: options.instruction,
    operationId: options.operationId,
    root: options.root,
    chatId: options.chatId,
    trustedSubjectCatalog: await loadTrustedLtmSubjectCatalog(scope, options.root),
  });
  const applyResult = options.applyLowRisk && prepared.draft?.mutations.length
    ? await applyLongTermMemoryDraft(prepared.draft.id, {
        root: options.root,
        actor: "maintenance_api",
        autoApplyLowRiskOnly: true,
        rebuildIndexes: false,
        operationId: options.operationId,
      })
    : null;
  const draft = applyResult?.draft ?? prepared.draft;
  const canMarkCurrent = prepared.response.mutations.length > 0 || (
    prepared.outcome.state === "no_suggestions_created" &&
    prepared.outcome.droppedUnits === 0 &&
    prepared.diagnostics.length === 0
  );
  if (canMarkCurrent && draft?.source.extractionFingerprint) {
    await new LongTermMemoryStorage(options.root).updateNote(options.sourceNote.id, {
      extractionFingerprint: draft.source.extractionFingerprint,
    });
  }
  await rebuildLongTermMemoryIndexes({
    root: options.root,
    scope: applyResult?.appliedMutationIds.length ? "all" : "source",
  });
  return {
    operationId: options.operationId,
    draft,
    diagnostics: prepared.diagnostics,
    outcome: prepared.outcome,
    accounting: prepared.accounting,
    response: prepared.response,
    appliedMutationIds: applyResult?.appliedMutationIds ?? [],
    skippedMutationIds: applyResult?.skippedMutationIds ?? [],
  };
}
