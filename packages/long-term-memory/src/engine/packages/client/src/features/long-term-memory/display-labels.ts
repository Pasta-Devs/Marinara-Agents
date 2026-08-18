import type { LtmNote } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export type LabelLocalizer = (key: string) => string;

export const labelKeys = {
  noteType: {
    source: "ui.longTermMemory.memoryvault.source",
    timeline_event: "ui.longTermMemory.memoryvault.timelineEvents",
    character: "ui.longTermMemory.memoryvault.character",
    relationship: "ui.longTermMemory.memoryvault.relationships",
    scene: "ui.longTermMemory.memoryvault.scenes",
    thread: "ui.longTermMemory.memoryvault.threads",
    world: "ui.longTermMemory.memoryvault.world",
    tone: "ui.longTermMemory.memoryvault.tone",
  },
  status: {
    active: "ui.longTermMemory.memoryvault.active",
    resolved: "ui.longTermMemory.memoryvault.resolved",
    archived: "ui.longTermMemory.memoryvault.archived",
  },
  mode: {
    conversation: "ui.longTermMemory.sourcesworkspace.conversation",
    roleplay: "ui.longTermMemory.sourcesworkspace.roleplay",
    game: "ui.longTermMemory.sourcesworkspace.game",
  },
  importance: {
    critical: "ui.longTermMemory.memoryvault.critical",
    major: "ui.longTermMemory.memoryvault.major",
    moderate: "ui.longTermMemory.memoryvault.moderate",
    minor: "ui.longTermMemory.memoryvault.minor",
  },
  risk: {
    low: "ui.longTermMemory.reviewqueue.riskLow",
    medium: "ui.longTermMemory.reviewqueue.riskMedium",
    high: "ui.longTermMemory.reviewqueue.riskHigh",
  },
  integrity: {
    not_built: "ui.longTermMemory.longtermmemorydetail.vaultNotBuilt",
    healthy: "ui.longTermMemory.longtermmemorydetail.vaultHealthy",
    degraded: "ui.longTermMemory.longtermmemorydetail.vaultDegraded",
    stale: "ui.longTermMemory.longtermmemorydetail.vaultStale",
    corrupt: "ui.longTermMemory.longtermmemorydetail.vaultCorrupt",
    building: "ui.longTermMemory.longtermmemorydetail.vaultRebuilding",
    failed: "ui.longTermMemory.longtermmemorydetail.rebuildFailed",
    loading: "ui.longTermMemory.memorysettings.loading",
  },
  maintenanceAction: {
    rebuild_indexes: "ui.longTermMemory.memorysettings.reindexRecallData",
    quarantine_malformed_notes: "ui.longTermMemory.memorysettings.quarantineMalformedNotes",
    backfill_imported_source_titles: "ui.longTermMemory.memorysettings.backfillSourceTitles",
  },
  maintenanceResult: {
    rebuilt: "ui.longTermMemory.memorysettings.resultRebuilt",
    backfilled: "ui.longTermMemory.memorysettings.resultBackfilled",
    no_titles_to_backfill: "ui.longTermMemory.memorysettings.resultNoTitlesToBackfill",
    quarantined: "ui.longTermMemory.memorysettings.resultQuarantined",
    no_malformed_notes: "ui.longTermMemory.memorysettings.resultNoMalformedNotes",
  },
  relation: {
    occurred_in: "ui.longTermMemory.memoryvault.relationOccurredIn",
    triggered_by: "ui.longTermMemory.memoryvault.relationTriggeredBy",
    resolved_in: "ui.longTermMemory.memoryvault.relationResolvedIn",
    evidenced_by: "ui.longTermMemory.memoryvault.relationEvidencedBy",
    affects_relationship: "ui.longTermMemory.memoryvault.relationAffectsRelationship",
    affects_character: "ui.longTermMemory.memoryvault.relationAffectsCharacter",
    caused_by: "ui.longTermMemory.memoryvault.relationCausedBy",
    involves: "ui.longTermMemory.memoryvault.relationInvolves",
    blocks: "ui.longTermMemory.memoryvault.relationBlocks",
    planted_in: "ui.longTermMemory.memoryvault.relationPlantedIn",
    paid_off_in: "ui.longTermMemory.memoryvault.relationPaidOffIn",
    extracted_from: "ui.longTermMemory.memoryvault.relationExtractedFrom",
  },
  debugPhase: {
    import: "ui.longTermMemory.activityview.phaseImport",
    source_note: "ui.longTermMemory.activityview.phaseSourceNote",
    extraction: "ui.longTermMemory.activityview.phaseExtraction",
    llm: "ui.longTermMemory.activityview.phaseLlm",
    compiler: "ui.longTermMemory.activityview.phaseCompiler",
    draft: "ui.longTermMemory.activityview.phaseDraft",
    apply: "ui.longTermMemory.activityview.phaseApply",
    injection: "ui.longTermMemory.activityview.phaseInjection",
    retrieval: "ui.longTermMemory.activityview.phaseRetrieval",
    rebuild: "ui.longTermMemory.activityview.phaseRebuild",
    repair: "ui.longTermMemory.activityview.phaseRepair",
    replay: "ui.longTermMemory.activityview.phaseReplay",
    diagnostic: "ui.longTermMemory.activityview.phaseDiagnostic",
  },
  debugStatus: {
    started: "ui.longTermMemory.activityview.running",
    ok: "ui.longTermMemory.activityview.completed",
    skipped: "ui.longTermMemory.activityview.skipped",
    warning: "ui.longTermMemory.activityview.warning",
    error: "ui.longTermMemory.activityview.failed",
  },
  indexHealth: {
    not_built: "ui.longTermMemory.longtermmemorydetail.vaultNotBuilt",
    healthy: "ui.longTermMemory.longtermmemorydetail.vaultHealthy",
    degraded: "ui.longTermMemory.longtermmemorydetail.vaultDegraded",
    stale: "ui.longTermMemory.longtermmemorydetail.vaultStale",
    corrupt: "ui.longTermMemory.longtermmemorydetail.vaultCorrupt",
    building: "ui.longTermMemory.longtermmemorydetail.vaultRebuilding",
    failed: "ui.longTermMemory.longtermmemorydetail.rebuildFailed",
  },
  transferClassification: {
    ready: "ui.longTermMemory.sourcesworkspace.transferReady",
    conflict: "ui.longTermMemory.sourcesworkspace.transferConflict",
    no_op: "ui.longTermMemory.sourcesworkspace.transferNoOp",
  },
} as const;

export function localizedLabel(value: string, localizeUi: LabelLocalizer, keys: Readonly<Record<string, string>>) {
  const key = keys[value];
  return key ? localizeUi(key) : humanizeLabel(value);
}

export function memoryLabel(note: Pick<LtmNote, "title"> | null | undefined, untitledMemory: string) {
  return note?.title?.trim() || untitledMemory;
}

export function noteTypeLabel(type: string, localizeUi?: LabelLocalizer) {
  return localizeUi ? localizedLabel(type, localizeUi, labelKeys.noteType) : humanizeLabel(type);
}

export function humanizeLabel(value: string) {
  const label = value.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function scopeTargetLabel(
  kind: "chat" | "character" | "group" | "persona",
  id: string,
  targets: ReadonlyArray<{ id: string; label: string }>,
  fallbackLabels: Partial<Record<"chat" | "character" | "group" | "persona", string>> = {},
) {
  const target = targets.find((item) => item.id === id || item.id === `${kind}:${id}`);
  if (target?.label && target.label !== id) return target.label;
  return fallbackLabels[kind] ?? humanizeLabel(kind);
}
