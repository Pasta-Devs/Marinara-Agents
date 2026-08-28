import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
const reviewQueue = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/ReviewQueue.tsx",
    import.meta.url,
  ),
  "utf8",
);
const api = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/api.ts",
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
assert.equal(
  locale["ui.longTermMemory.longtermmemorydetail.savedButNotSearchable"],
  "Saved with lexical recall only: semantic embeddings are unavailable.",
);
assert.match(vault, /function MemoryAvailabilityWorkbench/u);
assert.match(vault, /data-ltm-availability-workbench/u);
assert.ok(vault.lastIndexOf("data-ltm-availability-summary") < vault.lastIndexOf("data-ltm-details"));
assert.ok(vault.lastIndexOf("data-ltm-availability-summary") < vault.lastIndexOf("data-ltm-note-layout"));
assert.match(vault, /availabilityStaged/u);
assert.match(vault, /lastPlaceRequired/u);
assert.match(vault, /lastModeRequired/u);
assert.match(vault, /function BulkAvailabilityWorkbench/u);
assert.match(vault, /data-ltm-bulk-availability/u);
assert.match(vault, /onActionChange=/u);
assert.match(vault, /data-ltm-availability-picker/u);
assert.match(vault, /data-ltm-availability-chevron/u);
assert.match(vault, /details\[open\] > summary \[data-ltm-availability-chevron\]/u);
assert.match(vault, /memoryvault\.addMemoryTo/u);
assert.match(vault, /<details\s+data-ltm-availability-picker\s+className="group"/u);
assert.match(vault, /<summary className="mari-editor-action inline-flex/u);
assert.match(vault, /data-ltm-availability-pills[\s\S]*?data-ltm-availability-picker/u);
assert.doesNotMatch(vault, /<details\s+data-ltm-availability-picker[^>]*\bopen\b/u);
assert.doesNotMatch(vault, /selectScopeTarget|scopeSelectionIds|removeScopeGroup/u);
assert.match(targetPicker, /groupLabels\?/u);
assert.equal(locale["ui.longTermMemory.memoryvault.chooseWhereUsed"], "Choose where used");
assert.equal(locale["ui.longTermMemory.memoryvault.saveAvailability"], "Save availability");
assert.equal(locale["ui.longTermMemory.memoryvault.addMemoryTo"], "Add this memory to:");
assert.match(vault, /data-ltm-select-mode/u);
assert.match(
  vault,
  /const scopeTargetResolved = Boolean\(\s*target && targetContextKey\.current === contextKey &&\s*scopeTargets\.isSuccess &&\s*targetScopeResolved,?\s*\)/u,
);
assert.match(vault, /scopeTargets\.isLoading/u);
assert.match(vault, /scopeTargets\.isError/u);
assert.match(vault, /scopeTargets\.refetch\(\)/u);
assert.ok(vault.indexOf("scopeTargets.isError") < vault.indexOf("noMemoriesFound"));
assert.match(
  vault,
  /scopeTargetResolved\s*&&\s*!scopeTargets\.isError\s*&&\s*!notes\.isLoading\s*&&\s*!notes\.isError\s*&&\s*notes\.isSuccess\s*&&\s*!visible\.length/u,
);
const notesQueryStart = vault.indexOf("const notes = useQuery");
const notesQueryEnd = vault.indexOf("const settings = useQuery", notesQueryStart);
assert.ok(notesQueryStart >= 0 && notesQueryEnd > notesQueryStart);
assert.match(vault.slice(notesQueryStart, notesQueryEnd), /enabled:\s*scopeTargetResolved/u);
assert.match(vault, /loadingMemoryScope/u);
assert.match(vault, /memoryScopeCouldNotLoad/u);
assert.match(vault, /retryMemoryScope/u);
const vaultFeedbackIndex = vault.indexOf("data-ltm-vault-feedback");
const workspaceIndex = vault.indexOf("<LtmWorkspace", vault.indexOf("</style>"));
const navigatorContentStart = vault.indexOf("content: (", workspaceIndex);
const navigatorContentEnd = vault.indexOf("workbench={{", navigatorContentStart);
assert.ok(vaultFeedbackIndex >= 0 && vaultFeedbackIndex < workspaceIndex);
assert.ok(navigatorContentStart >= 0 && navigatorContentEnd > navigatorContentStart);
assert.doesNotMatch(vault.slice(navigatorContentStart, navigatorContentEnd), /data-ltm-vault-feedback/u);
assert.match(vault, /sourceFilter/u);
assert.doesNotMatch(vault, /availableEverywhereFilter|setAvailableEverywhereFilter/u);
assert.match(vault, /data-ltm-source-readonly/u);
assert.match(vault, /data-ltm-memory-options/u);
assert.match(vault, /data-ltm-memory-scope/u);
assert.match(vault, /currentlyViewingMemoriesIn/u);
assert.match(vault, /mari-editor-panel mari-editor-panel--soft group col-span-2 rounded-md/u);
assert.match(vault, /text-\[var\(--marinara-editor-muted\)\].*focus-visible:outline/u);
assert.match(vault, /mari-editor-action flex min-h-11/u);
assert.match(vault, /data-ltm-memory-scope-chevron/u);
assert.match(vault, /details\[open\] > summary \[data-ltm-memory-scope-chevron\]/u);
assert.match(vault, /ScopeTargetPicker/u);
assert.match(vault, /data-ltm-memory-scope-picker/u);
assert.match(vault, /max-h-40 overflow-y-auto border-y border-\[var\(--marinara-editor-divider\)\]/u);
assert.doesNotMatch(vault, /max-h-40 overflow-y-auto rounded-md border/u);
assert.match(vault, /scopeModes/u);
assert.match(vault, /scopeChats/u);
assert.match(vault, /toggleScopeMode/u);
assert.match(vault, /chatModes/u);
assert.match(vault, /scopeModes\.includes\(mode\)/u);
assert.doesNotMatch(vault, /kind="mode"/u);
assert.match(vault, /kind="status"/u);
assert.match(vault, /kind="sort"/u);
assert.match(vault, /showMemories/u);
assert.match(vault, /sortBy/u);
assert.match(targetPicker, /AvailabilityTabRail/u);
assert.match(targetPicker, /displayedTargets/u);
assert.match(targetPicker, /const displayedTargetsFor/u);
assert.match(targetPicker, /displayedTargetsFor\(activeKind, activeTargets, activeCopy\.allLabel\)/u);
assert.match(targetPicker, /displayedTargetsFor\(kind, targets, copy\.allLabel\)/u);
assert.match(targetPicker, /role="tablist"/u);
assert.match(targetPicker, /role="tab"/u);
assert.match(targetPicker, /aria-selected=\{active\}/u);
assert.match(targetPicker, /data-ltm-availability-count/u);
assert.match(targetPicker, /data-ltm-availability-search=\{activeKind\}/u);
assert.match(targetPicker, /border-bottom: 1px solid var\(--marinara-editor-divider\)/u);
assert.match(targetPicker, /data-ltm-availability-count\][\s\S]*flex: 0 0 auto/u);
assert.match(targetPicker, /className="overflow-hidden border-y border-\[var\(--marinara-editor-divider\)\]/u);
assert.match(targetPicker, /containerType: "inline-size"/u);
assert.match(targetPicker, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
assert.match(targetPicker, /@container \(min-width: 34rem\)/u);
assert.match(targetPicker, /border-radius: 0/u);
assert.match(targetPicker, /data-ltm-availability-panel=\{activeKind\}[\s\S]*className="space-y-3 p-3"/u);
assert.match(targetPicker, /<div className="max-h-52 overflow-y-auto">/u);
assert.doesNotMatch(targetPicker, /border-t border-\[var\(--marinara-editor-divider\)\]/u);
assert.match(targetPicker, /ArrowRight/u);
assert.match(targetPicker, /ArrowLeft/u);
assert.doesNotMatch(targetPicker, /aria-expanded/u);
assert.doesNotMatch(targetPicker, /group-open:rotate-90/u);
assert.match(vault, /sectionCopy=\{\{[\s\S]*character:[\s\S]*persona:[\s\S]*chat:[\s\S]*branch:/u);
assert.match(vault, /fieldset className="space-y-2 border-b[\s\S]*chatModes/u);
assert.doesNotMatch(vault, /groupLabels=\{\{[\s\S]*group:/u);
assert.match(vault, /searchCharacters/u);
assert.match(vault, /searchPersonas/u);
assert.match(vault, /searchChats/u);
assert.match(vault, /searchBranches/u);
assert.match(vault, /scope-targets\?includeAllChats=true/u);
assert.doesNotMatch(vault, /matchesFilters/u);
assert.match(vault, /data-ltm-memory-scope-target/u);
assert.match(vault, /characterScopeTargets/u);
assert.match(vault, /conversationScopeTargets/u);
assert.match(vault, /branchScopeTargets/u);
assert.match(vault, /data-ltm-memory-scope-picker=\{kind\}[\s\S]*className="group"/u);
assert.match(vault, /data-ltm-memory-scope-target[\s\S]*mari-editor-action--compact/u);
assert.match(vault, /selectedTargets/u);
assert.match(vault, /bulkAvailabilityScope/u);
assert.match(vault, /chooseAvailabilityPlaces/u);
assert.match(vault, /chat:all/u);
assert.match(vault, /branch:all/u);
assert.doesNotMatch(vault, /chooseOneAvailabilityPlace/u);
assert.match(vault, /line-clamp-2 break-words text-xs leading-5/u);
assert.doesNotMatch(vault, /line-clamp-2 block/u);
assert.doesNotMatch(vault, /typeFilter/u);
assert.doesNotMatch(vault, /filterByType/u);
assert.doesNotMatch(vault, /characterWithName/u);
assert.match(vault, /data-ltm-keyword-editor/u);
assert.match(vault, /getLtmKeywordIntent/u);
assert.match(vault, /removeLtmKeyword/u);
assert.match(vault, /setLtmManualKeywords/u);
assert.match(vault, /data-ltm-keyword-input/u);
assert.match(vault, /data-ltm-keyword-add/u);
assert.match(vault, /ui\.longTermMemory\.memoryvault\.addKeyword/u);
assert.match(vault, /event\.key !== "Enter"/u);
assert.match(vault, /event\.nativeEvent\.isComposing/u);
assert.match(vault, /manualKeywordTooLong/u);
assert.match(vault, /manualKeywordLimit/u);
assert.match(vault, /renameDetails/u);
assert.match(vault, /renameDialogRef/u);
assert.match(vault, /place-items-center bg-black\/50/u);
assert.match(vault, /mari-editor-panel w-full max-w-72 space-y-3 p-3 shadow-xl/u);
assert.match(vault, /details\[open\] > summary \[data-ltm-memory-scope-chevron\]/u);
assert.match(vault, /ChevronRight aria-hidden="true" size="0\.875rem"/u);
assert.match(vault, /localizeUi\("ui\.longTermMemory\.memoryvault\.memoryOptions"\)/u);
assert.doesNotMatch(vault, /<Braces aria-hidden="true" size="1rem" className="shrink-0" \/>/u);
assert.doesNotMatch(vault, /<Check aria-hidden="true" size="1rem" className="shrink-0" \/>\n\s*\{saveState/u);
assert.match(vault, /beginRename/u);
assert.match(vault, /rename-preview/u);
assert.match(vault, /renamePreview/u);
assert.match(vault, /addingSection/u);
assert.match(vault, /createNewMemoryDetail/u);
assert.match(vault, /changeNewMemoryType/u);
assert.doesNotMatch(vault, /typeAndSubjects/u);
assert.equal(locale["ui.longTermMemory.memoryvault.nameThisDetail"], "Name the detail");
assert.equal(locale["ui.longTermMemory.memoryvault.createNewMemoryDetail"], "Create new memory detail");
assert.equal(locale["ui.longTermMemory.memoryvault.memoryTypeValue"], "Memory type: {{type}}");
assert.equal(locale["ui.longTermMemory.memoryvault.currentlyViewingMemoriesIn"], "Currently viewing memories in:");
assert.equal(locale["ui.longTermMemory.memoryvault.searchCharacters"], "Search characters");
assert.equal(locale["ui.longTermMemory.memoryvault.searchChats"], "Search chats");
assert.equal(locale["ui.longTermMemory.memoryvault.searchBranches"], "Search branches");
assert.equal(locale["ui.longTermMemory.memoryvault.showMemories"], "Show");
assert.equal(locale["ui.longTermMemory.memoryvault.sortBy"], "Sort by");
assert.equal(locale["ui.longTermMemory.memoryvault.changeAvailability"], "Change availability");

assert.match(detail, /TriangleAlert/u);
assert.match(detail, /!text-\[var\(--marinara-editor-warning\)\]/u);
assert.doesNotMatch(detail, /CircleAlert/u);
assert.match(detail, /health !== "healthy" && !needsHealthAttention/u);
assert.match(detail, /howToRepairVaultHealth[\s\S]*compact/u);
assert.match(detail, /tone=\{healthNeedsDangerTone \? "danger" : "warning"\}/u);
assert.match(vault, /data-ltm-detail-conflict/u);
assert.equal(locale["ui.longTermMemory.memoryvault.memoryInfo"], "Memory info");
assert.equal(locale["ui.longTermMemory.memoryvault.memoryOptions"], "Memory options");
assert.equal(locale["ui.longTermMemory.memoryvault.renameDetails"], "Rename details");
assert.equal(locale["ui.longTermMemory.memoryvault.previewRename"], "Preview rename");
assert.equal(locale["ui.longTermMemory.memoryvault.viewAllActivity"], "View all activity");
assert.equal(locale["ui.longTermMemory.memoryvault.groups"], "Chats");
assert.equal(locale["ui.longTermMemory.memoryvault.unsavedNavigationTitle"], "Unsaved changes");
assert.match(locale["ui.longTermMemory.memoryvault.unsavedNavigationDescription"], /before leaving this memory/u);
assert.equal(locale["ui.longTermMemory.memoryvault.keepEditing"], "Keep editing");
assert.equal(locale["ui.longTermMemory.memoryvault.discardAndContinue"], "Discard and continue");
assert.equal(locale["ui.longTermMemory.memoryvault.saveAndContinue"], "Save and continue");
assert.match(vault, /extractionImportance/u);
assert.match(vault, /extractionConfidence/u);
assert.match(vault, /data-ltm-validation-summary/u);
assert.match(vault, /data-ltm-vault-feedback/u);
assert.match(vault, /data-ltm-note-actions-desktop[\s\S]*md:flex/u);
assert.doesNotMatch(vault, /data-ltm-note-actions-desktop[\s\S]*opacity-0/u);
assert.doesNotMatch(vault, /data-ltm-note-actions-desktop[\s\S]*pointer-events-none/u);
assert.match(vault, /data-ltm-note-actions-open/u);
assert.match(vault, /type ArchiveUndoState/u);
assert.match(vault, /const \[archiveUndo, setArchiveUndo\]/u);
assert.match(vault, /async function undoArchive/u);
assert.match(vault, /previousArchiveStatuses/u);
assert.match(vault, /setArchiveUndo\(\{ notes: archiveUndoNotes \}\)/u);
assert.match(vault, /archiveUndoFailed/u);
assert.match(vault, /Promise\.allSettled/u);
assert.match(vault, /successfulRestores[\s\S]*status: "archived"/u);
assert.match(
  vault,
  /const archiveCompleted\s*=\s*[\s\S]*result\.status === "complete"[\s\S]*ids\.every\(\(id\) => updatedNoteIds\.has\(id\)\)/u,
);
assert.match(vault, /if \(archiveCompleted && archiveUndoNotes\.length === ids\.length\) setArchiveUndo/u);
assert.match(
  vault,
  /const allRestored\s*=\s*results\.every[\s\S]*result\.value\.status === "complete"[\s\S]*result\.value\.skippedNoteIds\.length === 0[\s\S]*result\.value\.failedNoteIds\.length === 0[\s\S]*actualIds\.length === expectedIds\.size[\s\S]*new Set\(actualIds\)\.size === expectedIds\.size[\s\S]*actualIds\.every\(\(id\) => expectedIds\.has\(id\)\)[\s\S]*if \(!allRestored\)/u,
);
assert.match(vault, /if \(!allRestored\)[\s\S]*Promise\.allSettled[\s\S]*await invalidate\(\);[\s\S]*throw new Error/u);
assert.equal(locale["ui.longTermMemory.memoryvault.undo"], "Undo");
assert.equal(locale["ui.longTermMemory.memoryvault.archiveSuccessOne"], "{{count}} memory archived.");
assert.equal(locale["ui.longTermMemory.memoryvault.archiveSuccessOther"], "{{count}} memories archived.");
assert.equal(locale["ui.longTermMemory.memoryvault.archiveUndoFailed"], "Could not undo the archive.");
const clearFiltersMatch = vault.match(/const clearNavigatorFilters = \(\) => \{\n([\s\S]*?)\n\s+\};/u);
assert.ok(clearFiltersMatch, "clearNavigatorFilters handler must exist");
const clearFiltersBody = clearFiltersMatch?.[1] ?? "";
assert.match(clearFiltersBody, /setSearch\(""\);/u);
assert.match(clearFiltersBody, /setStatusFilter\("all"\);/u);
assert.match(clearFiltersBody, /setSourceFilter\(false\);/u);
assert.match(clearFiltersBody, /setSort\("updated"\);/u);
assert.doesNotMatch(clearFiltersBody, /setTarget/u);
assert.match(
  vault,
  /const hasFilterableNotes = allNotes\.length > 0 && \(sourceFilter \|\| allNotes\.some\(\(note\) => note\.type !== "source"\)\);/u,
);
const emptyStateStart = vault.indexOf("{hasFilterableNotes ? (");
const emptyStateEnd = vault.indexOf("\n                  </div>", emptyStateStart);
assert.ok(emptyStateStart >= 0 && emptyStateEnd > emptyStateStart, "complete empty-state conditional must exist");
assert.match(
  vault.slice(emptyStateStart, emptyStateEnd),
  /hasFilterableNotes \? \([\s\S]*filteredEmptyDescription[\s\S]*filteredEmptyFilters[\s\S]*onClick=\{clearNavigatorFilters\}[\s\S]*\)\s*:\s*\([\s\S]*noMemoriesFound[\s\S]*\)/u,
);
assert.match(vault, /filteredEmptyFilters[\s\S]*activeFilterLabels\.join\(", "\)/u);
assert.match(vault, /filteredEmptySourcesOnly/u);
assert.match(vault, /onClick=\{clearNavigatorFilters\}/u);
assert.match(vault, /value1: target\?\.label \?\? localizeUi\("ui\.longTermMemory\.memoryvault\.allMemories"\)/u);
assert.ok(
  vault.indexOf("data-ltm-vault-feedback") < vault.indexOf("<LtmWorkspace\n"),
  "shared Vault feedback must stay visible above the pane-switching workspace",
);
assert.match(sharedControls, /HTMLAttributes<HTMLDivElement>/u);
assert.match(sharedControls, /<div\s+role=\{tone === "danger" \? "alert" : "status"\}/u);
assert.doesNotMatch(vault, /<div role="alert"><StatusSurface tone="danger">/u);
assert.match(vault, /data-ltm-memory-group=\{type\}[\s\S]*min-h-11[\s\S]*focus-visible:outline/u);
assert.match(vault, /min-h-11 w-full[\s\S]*focus-visible:outline[\s\S]*moreLinkTypes/u);
assert.match(vault, /inline-flex min-h-11 max-w-full[\s\S]*h-11 w-11/u);
assert.match(vault, /clearMemorySearch[\s\S]*h-11 w-11/u);
assert.match(vault, /scopeModes[\s\S]*min-h-11/u);
assert.match(vault, /bulkModes[\s\S]*min-h-11/u);
assert.match(vault, /detailsRef[\s\S]*summaryRef[\s\S]*requestAnimationFrame/u);
assert.match(vault, /details\.open = false/u);
assert.match(vault, /data-ltm-note-inspector/u);
assert.match(vault, /mari-editor-panel min-w-0 space-y-4 p-3/u);
assert.match(vault, /copyDiagnostics/u);
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
assert.doesNotMatch(targetPicker, /className="mari-editor-tab-rail grid w-full grid-cols-4"/u);
assert.match(targetPicker, /id=\{listId\}\s+role="list"/u);
assert.match(targetPicker, /<div key=\{`\$\{target\.kind\}:\$\{target\.id\}`\} role="listitem">/u);
assert.match(sharedControls, /Escape[\s\S]*closeRef\.current\(true\)/u);
assert.match(sharedControls, /focus\(\{ preventScroll: true \}\)/u);
assert.match(workspaceLayout, /minmax\(17rem, 20rem\)/u);
assert.match(workspaceLayout, /minmax\(16rem, 22rem\)/u);
assert.match(workspaceLayout, /prefers-reduced-motion/u);
assert.match(types, /onSaveRequest\?: \(save:/u);
assert.match(detail, /onSaveRequest=\{\(save\) =>/u);
assert.match(detail, /navigationPrompt/u);
assert.match(detail, /navigationResolveRef\.current\?\.\(false\)/u);
assert.match(detail, /navigationSaveInFlightRef/u);
assert.match(detail, /disabled=\{navigationSaveInFlight\}/u);
assert.match(detail, /finishNavigationPrompt\("save"\)/u);
assert.match(detail, /aria-modal="true"/u);
assert.match(detail, /event\.key !== "Tab"/u);

const localeRoot = fileURLToPath(
  new URL("../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/", import.meta.url),
);
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
assert.match(workspace, /!previewed \|\| busy \|\| result/u);
assert.match(workspace, /disabled=\{\s*Boolean\(result\)/u);
assert.match(workspace, /confirmAction=\{props\.confirmAction\}/u);
assert.match(workspace, /key=\{sourceOperation\.id\}/u);
assert.match(workspace, /data-ltm-linked-memory-selection/u);
assert.match(workspace, /derivedNoteIds: selectedLinkedIds/u);
assert.match(workspace, /archive: "notes_only"/u);
assert.match(workspace, /excludedNoteIds: excludedMemories/u);
assert.match(workspace, /data-ltm-source-operation-preview/u);
assert.match(workspace, /data-ltm-source-operation-excluded/u);
assert.match(workspace, /data-ltm-source-operation-result/u);
assert.match(workspace, /data-ltm-source-import-mode/u);
assert.match(workspace, /const sourceCheckboxClass = "size-6 shrink-0 accent-/u);
assert.match(workspace, /linked\.isError[\s\S]*linkedMemoriesCouldNotLoad/u);
assert.match(workspace, /!linked\.data \|\| linked\.isError \|\| !previewed/u);
assert.match(workspace, /tone === "danger"[\s\S]*var\(--destructive\)/u);
assert.match(workspace, /className="hidden items-start gap-1 md:flex"/u);
assert.doesNotMatch(workspace, /group-hover:pointer-events-auto|transition-opacity/u);
assert.match(workspace, /className="space-y-2 border-t border-\[var\(--border\)\] py-3 first:border-t-0"/u);
assert.match(workspace, /\[changeSource, onRequestedSourceHandled, requestedSource\]/u);
assert.match(workspace, /importsAsMode/u);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.importsAsMode"], "Imports as {{mode}}");
assert.equal(locale["ui.longTermMemory.sourceoperation.clearAll"], "Clear all");
assert.match(locale["ui.longTermMemory.sourceoperation.linkedMemoriesCouldNotLoad"], /could not be loaded/u);
assert.equal(
  locale["ui.longTermMemory.sourceoperation.confirmArchive"],
  "Archive the source and {{count}} selected linked memories?",
);
assert.equal(
  locale["ui.longTermMemory.sourceoperation.confirmDelete"],
  "Permanently delete the source and {{count}} selected linked memories?",
);
assert.match(types, /onOpenSources\?: \(source\?: SourceTab\) => boolean \| Promise<boolean>/u);
assert.match(api, /export async function requestNotesByIds/u);
assert.match(api, /if \(!requestedIds\.length\) return \[\] as T\[\]/u);
assert.match(api, /new URLSearchParams/u);
assert.match(api, /undefined, signal/u);
assert.match(api, /const missingIds = requestedIds\.filter/u);
assert.doesNotMatch(reviewQueue, /requestAllNotes/u);
assert.match(reviewQueue, /requestNotesByIds<LtmNote>\(contextNoteIds, signal\)/u);
assert.match(reviewQueue, /"review-context", contextNoteIds/u);
assert.match(reviewQueue, /row\.disposition !== "new"/u);
assert.match(reviewQueue, /reviewContextReady/u);
assert.match(reviewQueue, /reviewContextFailed/u);
assert.match(reviewQueue, /memoryContextUnavailable/u);
assert.match(reviewQueue, /data-ltm-review-rejected-count/);
assert.match(reviewQueue, /onSaveRequest/);
assert.match(reviewQueue, /buildPersistedReviewState/);
assert.match(reviewQueue, /window\.setTimeout/);
assert.match(reviewQueue, /pagehide/);
assert.match(reviewQueue, /onBlur=\{\(\) => queueMicrotask/);
assert.match(reviewQueue, /item\.draft\.status === "pending"/u);
assert.match(reviewQueue, /skippableSelectedRows/u);
assert.match(reviewQueue, /REVIEW_STATE_STORAGE_KEY/u);
assert.match(reviewQueue, /draftReviewFingerprint/u);
assert.match(reviewQueue, /savedReviewStateDiscarded/u);
assert.match(reviewQueue, /failedMutationIds/u);
assert.match(reviewQueue, /retryFailed/u);
assert.match(reviewQueue, /review\.refetch\(\)/u);
assert.match(reviewQueue, /pendingMutationIds/u);
assert.match(reviewQueue, /mutationFingerprints/u);
assert.match(reviewQueue, /contextFingerprint/u);
assert.match(reviewQueue, /appliedMutationIds/u);
assert.match(reviewQueue, /setResult\(null\)/u);
assert.match(reviewQueue, /reviewFailed/u);
assert.match(reviewQueue, /reviewProgress/u);
assert.match(reviewQueue, /MAX_APPEND_TEXT_LENGTH = 20_000/u);
assert.match(reviewQueue, /MAX_SECTION_TEXT_LENGTH = 24_000/u);
assert.match(reviewQueue, /charactersRemaining(?:One|Other)/u);
assert.match(reviewQueue, /textExceedsLimit/u);
assert.match(reviewQueue, /preflight/u);
assert.match(reviewQueue, /data-ltm-review-preflight/u);
assert.match(reviewQueue, /data-ltm-review-conflicts/u);
assert.match(reviewQueue, /moreConflictsOne/u);
assert.match(reviewQueue, /moreConflictsOther/u);
assert.match(reviewQueue, /preflightMissing/u);
assert.doesNotMatch(reviewQueue, /label\.replace\("\{\{value\}\}"/u);
assert.match(reviewQueue, /preflightBlocked/u);
assert.match(reviewQueue, /preflightSummary/u);
assert.match(reviewQueue, /applyPreflighted/u);
assert.match(reviewQueue, /data-ltm-review-action/u);
assert.match(reviewQueue, /reviewChangeForTitle/u);
assert.match(reviewQueue, /applyChangeForTitle/u);
assert.match(reviewQueue, /noteById\.get\(mutation\.link\.target\)\?\.title/u);
assert.match(reviewQueue, /data-ltm-review-summary/u);
assert.match(reviewQueue, /data-ltm-review-evidence-summary/u);
assert.match(reviewQueue, /confirmDiscard/u);
assert.match(reviewQueue, /discardDependentWarning/u);
assert.match(reviewQueue, /reviewQueueEmpty/u);
assert.match(reviewQueue, /className=\{workspaceUnavailable \|\| reviewDataUnavailable \? "hidden" : ""\}/u);
assert.equal(locale["ui.longTermMemory.reviewqueue.retryFailed"], "Retry failed review actions");
assert.equal(locale["ui.longTermMemory.reviewqueue.reviewChangeForTitle"], "Review change for {{title}}");
assert.equal(locale["ui.longTermMemory.reviewqueue.applyChangeForTitle"], "Apply change for {{title}}");
assert.equal(locale["ui.longTermMemory.reviewqueue.discard"], "Discard");
assert.equal(locale["ui.longTermMemory.reviewqueue.sourcesPane"], "Sources");
assert.equal(locale["ui.longTermMemory.reviewqueue.reviewPane"], "Review");
assert.equal(locale["ui.longTermMemory.reviewqueue.loadingMemoryContext"], "Loading memory context.");
assert.equal(locale["ui.longTermMemory.reviewqueue.memoryContextUnavailable"], "Memory context unavailable");
assert.equal(locale["ui.longTermMemory.reviewqueue.reviewFailed"], "Review failed drafts");
assert.equal(locale["ui.longTermMemory.reviewqueue.charactersRemainingOne"], "{{count}} character remaining");
assert.equal(locale["ui.longTermMemory.reviewqueue.charactersRemainingOther"], "{{count}} characters remaining");
assert.match(locale["ui.longTermMemory.sourceoperation.deleteDetachment"], /detached/u);

process.stdout.write(
  "Long-Term Memory feedback clarity UI regression: labels, outcomes, usage, warnings, and defaults ok\n",
);
