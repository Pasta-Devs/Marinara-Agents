import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/SourcesWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const activity = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/ActivityView.tsx",
    import.meta.url,
  ),
  "utf8",
);
const settings = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/MemorySettings.tsx",
    import.meta.url,
  ),
  "utf8",
);
const vault = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/MemoryVault.tsx",
    import.meta.url,
  ),
  "utf8",
);
const targetPicker = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/TargetPicker.tsx",
    import.meta.url,
  ),
  "utf8",
);
const locale = JSON.parse(
  readFileSync(
    new URL(
      "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/locales/en.json",
      import.meta.url,
    ),
  ),
);

assert.match(workspace, /const effectiveAction = retryContract\?\.action \?\? action/u);
assert.match(workspace, /extract: contract\.action !== "refresh"/u);
assert.match(workspace, /retryContract\?\.action/u);
assert.match(workspace, /refreshSelectedSources/u);
assert.match(workspace, /sourceRefreshCompletedWithFailures/u);
assert.match(
  workspace,
  /contract\.action === "refresh"[\s\S]*!result\.counts\.missing[\s\S]*!result\.counts\.sourceWriteFailed/u,
);
assert.match(workspace, /sourceRefreshedExtractionNotRun/u);
assert.match(workspace, /retry-cancelled/u);
assert.match(workspace, /cancelledImport\.sourceIds[\s\S]*"import"[\s\S]*cancelledImport/u);
assert.match(workspace, /retry-failed/u);
assert.match(workspace, /retryableIds[\s\S]*"import"[\s\S]*importResultContract/u);
assert.match(workspace, /readyForReviewWithRejectedSuggestions/u);
assert.match(workspace, /extractionDidNotFinish/u);
assert.match(activity, /completionReasoningTokens/u);
assert.match(activity, /data-ltm-activity-warnings/u);
assert.match(settings, /reasoningEffort: resolved\.reasoningEffort \?\? "low"/u);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.syncSelected_8c57bdb"], undefined);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.refreshSelectedSources"], "Refresh selected sources");
assert.equal(locale["ui.longTermMemory.activityview.totalTokens"], "Total: {{count}} tokens");
assert.match(vault, /function MemoryAvailabilityWorkbench/u);
assert.match(vault, /data-ltm-availability-workbench/u);
assert.match(vault, /availabilityStaged/u);
assert.match(vault, /lastPlaceRequired/u);
assert.match(vault, /lastModeRequired/u);
assert.match(vault, /function BulkAvailabilityWorkbench/u);
assert.match(vault, /previewBulkAvailability/u);
assert.doesNotMatch(vault, /selectScopeTarget|scopeSelectionIds|removeScopeGroup/u);
assert.match(targetPicker, /groupLabels\?/u);
assert.equal(locale["ui.longTermMemory.memoryvault.chooseWhereUsed"], "Choose where used");
assert.equal(locale["ui.longTermMemory.memoryvault.saveAvailability"], "Save availability");
assert.match(vault, /data-ltm-select-mode/u);
assert.match(vault, /sourceFilter/u);
assert.match(vault, /data-ltm-source-readonly/u);
assert.match(vault, /data-ltm-memory-options/u);
assert.match(vault, /data-ltm-keyword-editor/u);
assert.match(vault, /getLtmKeywordIntent/u);
assert.match(vault, /renameDetails/u);
assert.match(vault, /beginRename/u);
assert.match(vault, /data-ltm-detail-conflict/u);
assert.equal(locale["ui.longTermMemory.memoryvault.memoryInfo"], "Memory info");
assert.equal(locale["ui.longTermMemory.memoryvault.memoryOptions"], "Memory options");
assert.equal(locale["ui.longTermMemory.memoryvault.renameDetails"], "Rename details");
assert.match(vault, /extractionImportance/u);
assert.match(vault, /extractionConfidence/u);
assert.match(vault, /data-ltm-validation-summary/u);
assert.match(workspace, /function SourceOperationWorkbench/u);
assert.match(workspace, /data-ltm-linked-memory-selection/u);
assert.match(workspace, /derivedNoteIds: selectedLinkedIds/u);
assert.match(workspace, /archive: "notes_only"/u);
assert.match(workspace, /excludedNoteIds: excludedMemories/u);
assert.match(workspace, /data-ltm-source-operation-preview/u);
assert.match(workspace, /data-ltm-source-operation-excluded/u);
assert.match(workspace, /data-ltm-source-operation-result/u);
assert.equal(locale["ui.longTermMemory.sourceoperation.clearAll"], "Clear all");
assert.match(locale["ui.longTermMemory.sourceoperation.deleteDetachment"], /detached/u);

process.stdout.write("Long-Term Memory feedback clarity UI regression: labels, outcomes, usage, warnings, and defaults ok\n");
