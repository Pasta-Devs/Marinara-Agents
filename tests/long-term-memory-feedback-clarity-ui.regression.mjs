import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const workspace = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/SourcesWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const detail = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/LongTermMemoryDetail.tsx",
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
const workspaceLayout = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/LtmWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const sharedControls = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/shared-controls.tsx",
    import.meta.url,
  ),
  "utf8",
);
const types = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/types.ts",
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
assert.match(vault, /setLtmManualKeywords|removeLtmKeyword/u);
assert.match(vault, /renameDetails/u);
assert.match(vault, /beginRename/u);
assert.match(vault, /data-ltm-detail-conflict/u);
assert.equal(locale["ui.longTermMemory.memoryvault.memoryInfo"], "Memory info");
assert.equal(locale["ui.longTermMemory.memoryvault.memoryOptions"], "Memory options");
assert.equal(locale["ui.longTermMemory.memoryvault.renameDetails"], "Rename details");
assert.equal(locale["ui.longTermMemory.memoryvault.groups"], "Groups");
assert.equal(locale["ui.longTermMemory.memoryvault.unsavedNavigationTitle"], "Unsaved changes");
assert.match(locale["ui.longTermMemory.memoryvault.unsavedNavigationDescription"], /save first/u);
assert.equal(locale["ui.longTermMemory.memoryvault.stay"], "Stay");
assert.equal(locale["ui.longTermMemory.memoryvault.discardAndContinue"], "Discard and continue");
assert.equal(locale["ui.longTermMemory.memoryvault.saveAndContinue"], "Save and continue");
assert.match(vault, /extractionImportance/u);
assert.match(vault, /extractionConfidence/u);
assert.match(vault, /data-ltm-validation-summary/u);
assert.match(vault, /navigatorStates/u);
assert.match(vault, /scrollTop/u);
assert.match(vault, /overflowY: "auto"/u);
assert.match(vault, /data-ltm-unsaved-stay/u);
assert.match(vault, /finishUnsavedDecision\("save"\)/u);
assert.match(vault, /aria-invalid=\{!draft\.title\?\.trim\(\)\}/u);
assert.match(vault, /maxHeight: "16rem"/u);
assert.match(vault, /onInput=\{\(event\) =>/u);
assert.match(sharedControls, /aria-live="polite"/u);
assert.match(targetPicker, /<button[\s\S]*type="button"/u);
assert.doesNotMatch(targetPicker, /role="listbox"|role="option"|aria-activedescendant|ArrowDown|ArrowUp/u);
assert.match(sharedControls, /Escape[\s\S]*closeRef\.current\(true\)/u);
assert.match(sharedControls, /focus\(\{ preventScroll: true \}\)/u);
assert.match(workspaceLayout, /minmax\(17rem, 20rem\)/u);
assert.match(workspaceLayout, /minmax\(16rem, 22rem\)/u);
assert.match(workspaceLayout, /prefers-reduced-motion/u);
assert.match(types, /onSaveRequest\?: \(save:/u);
assert.match(detail, /onSaveRequest=\{\(save\) =>/u);
assert.match(detail, /navigationPrompt/u);
assert.match(detail, /finishNavigationPrompt\("save"\)/u);
assert.match(detail, /aria-modal="true"/u);
assert.match(detail, /event\.key !== "Tab"/u);

const localeRoot = new URL(
  "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/",
  import.meta.url,
).pathname;
const sourceFiles = [];
const usedKeys = new Set();
function collectSourceFiles(directory) {
  for (const name of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, name.name);
    if (name.isDirectory()) collectSourceFiles(file);
    else if (/\.(ts|tsx)$/u.test(name.name)) sourceFiles.push(file);
  }
}
collectSourceFiles(localeRoot);
for (const file of sourceFiles) {
  for (const match of readFileSync(file, "utf8").matchAll(/["'`](ui\.longTermMemory\.[A-Za-z0-9_.]+)["'`]/gu)) {
    usedKeys.add(match[1]);
  }
}
assert.deepEqual([...usedKeys].filter((key) => !(key in locale)).sort(), []);
const vaultLocaleValues = Object.entries(locale)
  .filter(([key]) => key.startsWith("ui.longTermMemory.memoryvault."))
  .map(([, value]) => value)
  .join(" ");
assert.doesNotMatch(vaultLocaleValues, /\b(?:Metadata|Scope|Derived memories|Connections)\b/u);
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
