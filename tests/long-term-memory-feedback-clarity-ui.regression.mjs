import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ltmClientRoot, ltmSourcePaths } from "./long-term-memory-source-paths.mjs";

// A screen folder holds the screen plus the components cut out of it. `workspace` is the screen
// file alone; `workspaceScreen` adds its siblings, so a match there may span two files. A pattern
// that ties two places in one component reads that component's own file instead.
const readScreen = (main) => {
  const folder = dirname(main);
  const siblings = readdirSync(folder)
    .filter((name) => /\.tsx?$/u.test(name) && name !== basename(main))
    .sort();
  return [main, ...siblings.map((name) => join(folder, name))].map((path) => readFileSync(path, "utf8")).join("\n");
};

const workspace = readFileSync(ltmSourcePaths.sourcesWorkspace, "utf8");
const workspaceScreen = readScreen(ltmSourcePaths.sourcesWorkspace);
const navigation = readFileSync(ltmSourcePaths.navigation, "utf8");
const interop = readFileSync(ltmSourcePaths.interop, "utf8");
const detail = readFileSync(ltmSourcePaths.detail, "utf8");
const activity = readFileSync(ltmSourcePaths.activity, "utf8");
const lastInjectionSummary = readFileSync(ltmSourcePaths.lastInjectionSummary, "utf8");
const settings = readFileSync(ltmSourcePaths.settings, "utf8");
const settingsScreen = readScreen(ltmSourcePaths.settings);
const vault = readFileSync(ltmSourcePaths.vault, "utf8");
const vaultScreen = readScreen(ltmSourcePaths.vault);
const bulkAvailability = readFileSync(ltmSourcePaths.bulkAvailability, "utf8");
const availabilityTabRail = readFileSync(ltmSourcePaths.availabilityTabRail, "utf8");
const sourceScopeCombobox = readFileSync(ltmSourcePaths.sourceScopeCombobox, "utf8");
const targetPicker = readFileSync(ltmSourcePaths.targetPicker, "utf8");
const reviewQueue = readFileSync(ltmSourcePaths.reviewQueue, "utf8");
const reviewQueueScreen = readScreen(ltmSourcePaths.reviewQueue);
const api = readFileSync(ltmSourcePaths.api, "utf8");
const workspaceLayout = readFileSync(ltmSourcePaths.workspaceLayout, "utf8");
const sharedControls = readFileSync(ltmSourcePaths.sharedControls, "utf8");
const types = readFileSync(ltmSourcePaths.types, "utf8");
const locale = JSON.parse(readFileSync(ltmSourcePaths.locale));

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
assert.match(navigation, /latestSourceTask\.status === "cancelled"[\s\S]*\? 0/u);
assert.match(navigation, /sourceTaskCancelled/u);
assert.match(navigation, /selectLtmPluralForm\(locale, failureCount\)/u);
assert.match(navigation, /sourceTaskFailedCountOne[\s\S]*sourceTaskFailedCountOther/u);
assert.match(navigation, /className=\{item\.id === "sources" && activeSourceTask \? "animate-spin"/u);
assert.match(navigation, /const label = localizeUi\(mobile \? item\.shortLabelKey : item\.labelKey\)/u);
assert.doesNotMatch(navigation, /const label =\s*item\.id === "sources" && sourceTaskLabel\s*\?\s*sourceTaskLabel/u);
// Accessible name stays Sources; live status is outside the button.
assert.match(navigation, /aria-label=\{item\.id === "sources" \? label : undefined\}/u);
assert.match(
  navigation,
  /sourceTaskLabel \? \([\s\S]*data-ltm-source-task-status[\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*className="sr-only"[\s\S]*\{sourceTaskLabel\}/u,
);
assert.match(navigation, /<\/nav>[\s\S]*data-ltm-source-task-status[\s>]/u);
assert.doesNotMatch(navigation, /<button[\s\S]*data-ltm-source-task-status[\s>][\s\S]*<\/button>/u);
// Desktop may keep a decorative visible indicator inside the button (aria-hidden).
assert.match(
  navigation,
  /item\.id === "sources" && sourceTaskLabel && !mobile \? \([\s\S]*data-ltm-source-task-status-visual[\s\S]*aria-hidden="true"/u,
);
assert.doesNotMatch(navigation, /mobile \? "max-w-full truncate text-\[0\.5625rem\] leading-tight"/u);
assert.doesNotMatch(navigation, /mobile \? "sr-only" : "min-w-0 max-w-\[9rem\]/u);
assert.match(navigation, /sourceTaskImporting[\s\S]*sourceTaskRefreshing[\s\S]*sourceTaskReExtracting/u);
assert.doesNotMatch(navigation, /sourcesworkspace\.importingSources|sourcesworkspace\.refreshingSources/u);
assert.equal((workspace.match(/importingSourceIds/gu) ?? []).length, 0, "row spinners defer to the task surface");
assert.doesNotMatch(workspace, /\[&>svg\]:animate-spin/u);
assert.equal(
  (workspace.match(/retryableSourceIds\((?:importResult|result|restoredImportResult)\)/gu) ?? []).length,
  3,
  "live and restored results derive one retry set",
);
assert.match(workspace, /restoredImportResult\.writeFailures\?\.map\(\(failure\) =>/u);
assert.match(
  workspaceScreen,
  /<div\s+id="ltm-destination-scope-control"[^>]*className="mari-editor-panel flex min-h-0 flex-col gap-3 p-3"[^>]*style=\{\{ maxHeight: "calc\(100vh - 12rem\)" \}\}[^>]*>/u,
);
// #1420: the destination place list is the shared availability rail.
assert.match(workspaceScreen, /<AvailabilityTabRail[\s\S]*disabled=\{disabled\}[\s\S]*onToggle=\{toggleRail\}/u);
assert.doesNotMatch(workspaceScreen, /ltm-bulk-destination-list|data-ltm-availability-action/u);
assert.match(
  workspaceScreen,
  /<details\s+data-ltm-destination-scope[^>]*className="group flex min-h-0 flex-col gap-3"[^>]*>/u,
);
assert.match(workspaceScreen, /data-ltm-destination-scope-summary/u);
assert.doesNotMatch(
  workspace,
  /<StatusSurface busy>\s*<Loader2 aria-hidden="true" size="0\.875rem" className="animate-spin" \/>/u,
);
assert.doesNotMatch(navigation, /sourceTaskCount/u);
assert.doesNotMatch(workspace, /savingAndExtracting/u);
assert.equal(
  (workspace.match(/data-ltm-source-task-count/gu) ?? []).length,
  2,
  "the two task workbenches own the single source count",
);
assert.match(interop, /content: row\.sourceText\.slice\(0, 500_000\)/u);
assert.match(workspace, /readyForReviewWithRejectedSuggestions/u);
assert.match(workspace, /extractionDidNotFinish/u);
assert.match(activity, /completionReasoningTokens/u);
assert.match(activity, /data-ltm-activity-warnings/u);
// #1275 repair: a failed/corrupt index cannot also report semantic search as available.
assert.match(activity, /embeddingsAvailable && !indexUnusable/u);
assert.equal(locale["ui.longTermMemory.activityview.result"], "Result");
assert.equal(locale["ui.longTermMemory.activityview.notKept"], "Not kept");
assert.equal(locale["ui.longTermMemory.activityview.notAdded"], "Not added");
assert.equal(locale["ui.longTermMemory.activityview.settingMinimumRelevance"], "Minimum relevance");
assert.match(settings, /reasoningEffort: resolved\.reasoningEffort \?\? "low"/u);
assert.match(settings, /memorySettingsSavedIndexRebuilt/u);
assert.match(settings, /memorySettingsSavedIndexRebuildFailed/u);
assert.match(settingsScreen, /memorySettingsResetIndexRebuildFailed/u);
assert.match(settings, /rebuild\?\.status === "deferred"/u);
// #1275 repair: the Debug panel's save surface shows only save feedback started on the
// Debug tab; saves started on the other tabs stay in the shared surface.
assert.match(settings, /messageState\.surface === "debug"/u);
assert.match(settings, /surface: "shared" \| "debug" = "shared"/u);
// #1193 repair: extraction edits made while the awaited global rebuild is in flight must
// survive, mirroring the submitted-snapshot guard used for global settings.
assert.match(
  settings,
  /setExtractionFormState\(\(current\) => \(current && same\(current, submitted\) \? saved : current\)\)/u,
);
assert.equal(
  locale["ui.longTermMemory.memorysettings.memorySettingsSavedIndexRebuilt"],
  "Memory settings saved and the recall index was rebuilt.",
);
assert.equal(
  locale["ui.longTermMemory.memorysettings.memorySettingsSavedIndexRebuildFailed"],
  "Memory settings saved, but the recall index rebuild failed: {{error}}",
);
assert.equal(
  locale["ui.longTermMemory.memorysettings.memorySettingsResetIndexRebuildFailed"],
  "Memory settings reset to defaults, but the recall index rebuild failed: {{error}}",
);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.syncSelected_8c57bdb"], undefined);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.refreshSelectedSources"], "Refresh selected sources");
assert.equal(locale["ui.longTermMemory.activityview.totalTokens"], "Total: {{count}} tokens");
// #1210: the debug toggle gates recall explanations, not all debug activity; extraction/apply
// logging is separate and the setting only applies once settings are saved.
assert.equal(locale["ui.longTermMemory.memorysettings.recordDebugActivity"], "Record recall explanations");
assert.match(
  locale["ui.longTermMemory.memorysettings.recordsLongTermMemoryOperationsForTroubleshootingActivityMay"],
  /A chat override or host debug mode can also turn them on/u,
);
assert.match(
  locale["ui.longTermMemory.memorysettings.recordsLongTermMemoryOperationsForTroubleshootingActivityMay"],
  /Extraction, draft, and apply activity is always recorded/u,
);
assert.match(
  locale["ui.longTermMemory.memorysettings.recordsLongTermMemoryOperationsForTroubleshootingActivityMay"],
  /takes effect after you save settings/u,
);
assert.equal(
  locale["ui.longTermMemory.longtermmemorydetail.savedButNotSearchable"],
  "Saved with lexical recall only: semantic embeddings are unavailable.",
);
assert.match(vaultScreen, /function MemoryAvailabilityWorkbench/u);
assert.match(vaultScreen, /data-ltm-availability-workbench/u);
assert.ok(vault.lastIndexOf("data-ltm-availability-summary") < vault.lastIndexOf("data-ltm-details"));
assert.ok(vault.lastIndexOf("data-ltm-availability-summary") < vault.lastIndexOf("data-ltm-note-layout"));
assert.match(vault, /availabilityStaged/u);
assert.match(vaultScreen, /lastPlaceRequired/u);
assert.match(vaultScreen, /lastModeRequired/u);
assert.match(vaultScreen, /function BulkAvailabilityWorkbench/u);
assert.match(vault, /data-ltm-bulk-availability/u);
assert.match(vaultScreen, /data-ltm-bulk-availability-action/u);
assert.match(vault, /onActionChange=/u);
assert.match(vaultScreen, /data-ltm-availability-picker/u);
assert.match(vault, /data-ltm-availability-chevron/u);
assert.match(vault, /details\[open\] > summary \[data-ltm-availability-chevron\]/u);
assert.match(vaultScreen, /memoryvault\.addMemoryTo/u);
assert.match(vaultScreen, /memoryvault\.bulkAddMemoriesTo/u);
assert.match(vaultScreen, /memoryvault\.bulkRemoveMemoriesFrom/u);
assert.match(vaultScreen, /memoryvault\.modesEligibilityHelp/u);
assert.match(vaultScreen, /memoryvault\.availabilityScopeHelp/u);
assert.match(vaultScreen, /memoryvault\.bulkImplicitAllPlaces/u);
assert.match(vaultScreen, /memoryvault\.availableIn/u);
assert.match(
  bulkAvailability,
  /function BulkAvailabilityWorkbench[\s\S]*?<details\s+data-ltm-availability-picker\s+className="group"/u,
);
assert.match(vaultScreen, /<details\s+data-ltm-availability-picker\s+className="group"/u);
assert.match(vaultScreen, /<summary\s+data-ltm-tab-focus\s+className="mari-editor-action inline-flex/u);
assert.match(vaultScreen, /data-ltm-availability-pills[\s\S]*?data-ltm-availability-picker/u);
assert.doesNotMatch(vaultScreen, /<details\s+data-ltm-availability-picker[^>]*\bopen\b/u);
assert.doesNotMatch(vault, /selectScopeTarget|scopeSelectionIds|removeScopeGroup/u);
assert.match(targetPicker, /groupLabels\?/u);
assert.equal(locale["ui.longTermMemory.memoryvault.chooseWhereUsed"], "Choose where used");
assert.equal(locale["ui.longTermMemory.memoryvault.saveAvailability"], "Save availability");
assert.equal(locale["ui.longTermMemory.memoryvault.addMemoryTo"], "Add this memory to:");
assert.equal(locale["ui.longTermMemory.memoryvault.availableIn"], "Available in");
assert.equal(
  locale["ui.longTermMemory.memoryvault.modesEligibilityHelp"],
  "Select which chat modes may recall these memories. This does not make a memory available in every chat for that mode; places below control scope.",
);
assert.equal(locale["ui.longTermMemory.memoryvault.bulkAddMemoriesTo"], "Add selected memories to:");
assert.match(locale["ui.longTermMemory.memoryvault.bulkAvailabilityHelp"], /existing chat scope/u);
for (const key of [
  "memoryvault.availabilityScopeHelp",
  "memoryvault.bulkAvailabilityHelp",
  "memoryvault.bulkImplicitAllPlaces",
  "sourcesworkspace.searchEveryAvailableCharacterLorebookAndChat",
])
  assert.doesNotMatch(locale[`ui.longTermMemory.${key}`], /branch/iu, key);
assert.doesNotMatch(locale["ui.longTermMemory.memoryvault.bulkAvailabilityHelp"], /All chats or All branches/u);
assert.match(locale["ui.longTermMemory.memoryvault.bulkImplicitAllPlaces"], /scope unchanged/u);
assert.doesNotMatch(locale["ui.longTermMemory.memoryvault.bulkImplicitAllPlaces"], /keeps All chats/u);
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
const workspaceIndex = vault.lastIndexOf("<LtmWorkspace");
const navigatorContentStart = vault.indexOf("content: (", workspaceIndex);
const navigatorContentEnd = vault.indexOf("workbench={{", navigatorContentStart);
assert.ok(vaultFeedbackIndex >= 0 && vaultFeedbackIndex < workspaceIndex);
assert.ok(navigatorContentStart >= 0 && navigatorContentEnd > navigatorContentStart);
assert.doesNotMatch(vault.slice(navigatorContentStart, navigatorContentEnd), /data-ltm-vault-feedback/u);
assert.match(vault, /sourceFilter/u);
assert.doesNotMatch(vault, /availableEverywhereFilter|setAvailableEverywhereFilter/u);
assert.match(vault, /data-ltm-source-readonly/u);
assert.match(
  vault,
  /draft\.tags\.includes\("imported_character"\)[\s\S]*draft\.tags\.includes\("imported_lorebook"\)/u,
);
assert.match(vault, /data-ltm-memory-options/u);
assert.match(vault, /data-ltm-memory-scope/u);
assert.match(vault, /currentlyViewingMemoriesIn/u);
assert.match(vault, /data-ltm-memory-scope-secondary/u);
assert.match(vault, /memoryvault\.combineWithPlace/u);
assert.match(vault, /memoryvault\.noSecondPlace/u);
assert.match(vault, /memoryvault\.combinedScope/u);
assert.match(vault, /selectSecondaryTarget/u);
assert.match(vault, /notesRequestPath/u);
assert.match(vault, /secondaryNotesScope/u);
assert.match(vault, /const secondaryNotesScope = secondaryTarget\?\.scope;/u);
assert.match(vault, /chatOnlyLtmScope/u);
assert.match(vault, /secondaryCurrentConversationScopeTarget/u);
assert.doesNotMatch(vault, /secondaryCurrentBranchScopeTarget/u);
assert.match(vault, /noMemoriesInCombinedScope/u);
// #1420: both Vault filters are the shared single-place combobox.
assert.match(
  vault,
  /<SourceScopeCombobox[\s\S]*testId="vault"[\s\S]*memoryGroups=\{placeMemoryGroups\}[\s\S]*<SourceScopeCombobox[\s\S]*testId="vault-secondary"/u,
);
assert.doesNotMatch(vault, /<details\s+data-ltm-memory-scope/u);
assert.doesNotMatch(vaultScreen, /VaultScopePicker|data-ltm-vault-scope/u);
// #1376: no two components share a name.
assert.doesNotMatch(
  [vaultScreen, workspaceScreen, reviewQueueScreen, settingsScreen].join("\n"),
  /function ScopeTargetPicker\b/u,
);
assert.match(sourceScopeCombobox, /function SourceScopeCombobox\b/u);
assert.match(detail, /<Onboarding\b/u);
assert.match(sourceScopeCombobox, /role="listbox"/u);
assert.match(sourceScopeCombobox, /role="option"/u);
assert.doesNotMatch(vaultScreen, /role="checkbox"/u);
assert.doesNotMatch(vault, /data-ltm-vault-selected-scope/u);
assert.doesNotMatch(vault, /mari-editor-panel min-w-0 max-w-full space-y-3 p-3/u);
assert.match(sourceScopeCombobox, /data-ltm-scope-tablist/u);
assert.match(sourceScopeCombobox, /@container \(min-width: 16rem\)[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/u);
assert.match(
  sourceScopeCombobox,
  /data-ltm-scope-presence="with-memories"[\s\S]*data-ltm-scope-presence="no-memories"/u,
);
// #1420: the dropdown paints a solid layer, so the page behind it no longer shows through.
assert.match(sourceScopeCombobox, /backgroundColor: "var\(--background\)"/u);
assert.doesNotMatch(sourceScopeCombobox, /bg-\[var\(--card\)\] shadow-xl/u);
assert.match(vaultScreen, /border-y border-\[var\(--border\)\]/u);
assert.match(vault, /data-ltm-mode-filter/u);
assert.match(vault, /filterModes/u);
assert.match(vault, /toggleFilterMode/u);
assert.doesNotMatch(vault, /scopeModes/u);
assert.match(vault, /scopeChats/u);
assert.doesNotMatch(vault, /toggleScopeMode/u);
assert.match(vaultScreen, /chatModes/u);
assert.doesNotMatch(vault, /scopeModes\.includes\(mode\)/u);
assert.doesNotMatch(vault, /kind="mode"/u);
assert.match(vault, /statusFilter/u);
assert.match(vault, /sortScopeTargets/u);
assert.match(vault, /showMemories/u);
assert.match(vault, /sortBy/u);
// #1420: the multi-place rail lives at the feature root with All / Chats / Characters / Personas tabs.
assert.doesNotMatch(targetPicker, /AvailabilityTabRail/u);
assert.match(availabilityTabRail, /\["all", \[\.\.\.chatRows, \.\.\.characterRows, \.\.\.personaRows\]\]/u);
assert.match(availabilityTabRail, /useState<SectionKind>\("all"\)/u);
assert.doesNotMatch(availabilityTabRail, /branch/iu);
assert.match(availabilityTabRail, /role="tablist"/u);
assert.match(availabilityTabRail, /role="tab"/u);
assert.match(availabilityTabRail, /aria-selected=\{active\}/u);
assert.match(availabilityTabRail, /data-ltm-availability-count/u);
assert.match(availabilityTabRail, /data-ltm-availability-search=\{activeKind\}/u);
assert.match(availabilityTabRail, /border-bottom: 1px solid var\(--marinara-editor-divider\)/u);
assert.match(availabilityTabRail, /data-ltm-availability-count\][\s\S]*flex: 0 0 auto/u);
assert.match(availabilityTabRail, /className="overflow-hidden border-y border-\[var\(--marinara-editor-divider\)\]/u);
assert.match(availabilityTabRail, /containerType: "inline-size"/u);
assert.match(availabilityTabRail, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
assert.match(availabilityTabRail, /@container \(min-width: 22rem\)[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/u);
assert.doesNotMatch(availabilityTabRail, /grid-template-columns: minmax\(0, 1fr\)/u);
assert.match(availabilityTabRail, /border-radius: 0/u);
assert.match(availabilityTabRail, /data-ltm-availability-panel=\{activeKind\}[\s\S]*className="space-y-3 p-3"/u);
assert.match(availabilityTabRail, /<div data-ltm-availability-list className="max-h-52 overflow-y-auto">/u);
assert.doesNotMatch(availabilityTabRail, /border-t border-\[var\(--marinara-editor-divider\)\]/u);
assert.match(availabilityTabRail, /nextTabIndex\(event\.key/u);
assert.doesNotMatch(availabilityTabRail, /aria-expanded/u);
assert.doesNotMatch(availabilityTabRail, /group-open:rotate-90/u);
assert.doesNotMatch([vault, workspaceScreen].join("\n"), /currentIds=/u);
assert.match(vault, /filterModes/u);
assert.doesNotMatch(vault, /scopeModes/u);
assert.match(vault, /useQuery\(scopeTargetsQueryOptions\(props\.chatId\)\)/u);
assert.doesNotMatch(workspace, /id: `branch:\$\{chat\.id\}`/u);
assert.match(workspace, /destinationScopeLimitReached/u);
assert.match(workspace, /hasDestinationScopeCapacity\(target\.destinationScope\)/u);
assert.match(availabilityTabRail, /data-ltm-availability-target/u);
assert.match(sourceScopeCombobox, /data-ltm-scope-picker-popup/u);
assert.match(sourceScopeCombobox, /data-ltm-scope-tablist/u);
assert.match(sourceScopeCombobox, /data-ltm-scope-tab=\{kind\}/u);
assert.match(sourceScopeCombobox, /data-ltm-scope-tabpanel=\{activeKind\}/u);
assert.match(workspace, /role="tabpanel"/u);
assert.match(sourceScopeCombobox, /aria-controls=\{panelId\}/u);
assert.match(sourceScopeCombobox, /selectKind\(kind, true\)/u);
// #1420: a chat with branches is one Chats entry that keeps the whole-chat scope.
assert.match(
  workspace,
  /label: group\.label,\s*comment: localizeUi\("ui\.longTermMemory\.sourcesworkspace\.allBranches"\),\s*kind: "chat" as const,\s*sourceScope: \{ groupId: group\.id, groupIds: \[group\.id\], chatIds: group\.chatIds \}/u,
);
assert.doesNotMatch(workspace, /kind: "branch"/u);
assert.match(workspace, /nextTabIndex\(event\.key/u);
assert.doesNotMatch(vault, /matchesFilters/u);
assert.match(vault, /characterScopeTargets/u);
assert.match(vault, /conversationScopeTargets/u);
assert.doesNotMatch(vault, /branchScopeTargets|deriveScopeBranches\b/u);
assert.match(vault, /bulkAvailabilityScope/u);
assert.match(vaultScreen, /bulkAvailabilitySelected/u);
assert.match(vaultScreen, /chat:all/u);
assert.doesNotMatch(vaultScreen, /branch:all|"branch"/u);
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
assert.match(vault, /mari-editor-panel w-full max-w-md space-y-3 p-3 shadow-xl/u);
assert.doesNotMatch(vault, /max-w-72/u);
assert.match(vault, /details\[open\] > summary/u);
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
assert.equal(locale["ui.longTermMemory.memoryvault.combineWithPlace"], "Also available in (AND)");
assert.equal(locale["ui.longTermMemory.memoryvault.noSecondPlace"], "No second place");
assert.equal(locale["ui.longTermMemory.memoryvault.combinedScope"], "{{first}} AND {{second}}");
assert.equal(
  locale["ui.longTermMemory.memoryvault.noMemoriesInCombinedScope"],
  "No memories are available in {{value1}}. A memory must be available in both places to appear here.",
);
assert.equal(locale["ui.longTermMemory.memoryvault.searchCharacters"], "Search characters");
assert.equal(locale["ui.longTermMemory.memoryvault.searchChats"], "Search chats");
assert.equal(locale["ui.longTermMemory.memoryvault.searchBranches"], undefined);
assert.equal(locale["ui.longTermMemory.memoryvault.showMemories"], "Show");
assert.equal(locale["ui.longTermMemory.memoryvault.sortBy"], "Sort by");
assert.equal(locale["ui.longTermMemory.memoryvault.changeAvailability"], "Change availability");

assert.match(detail, /TriangleAlert/u);
assert.doesNotMatch(detail, /CircleAlert/u);
assert.match(
  detail,
  /\[data-ltm-tab-focus\]:focus-visible \{\s*outline: 2px solid var\(--marinara-editor-focus-ring\);/u,
);
for (const rail of [navigation, settings, availabilityTabRail]) assert.match(rail, /data-ltm-tab-focus/u);
// The Vault and Sources place-picker rails were cut into their own files; read each one alone so
// TargetPicker or another sibling cannot satisfy the match.
assert.match(sourceScopeCombobox, /function SourceScopeCombobox[\s\S]*data-ltm-tab-focus/u);
assert.match(detail, /paddingBottom: "var\(--mari-safe-area-inset-bottom, env\(safe-area-inset-bottom\)\)"/u);
assert.match(
  settings,
  /@container ltm-memory-settings \(min-width: 40rem\) \{[^}]*\}\s*\[data-ltm-prompt-template-grid\] \{\s*grid-template-columns: 12rem minmax\(0, 1fr\);/u,
);
assert.match(detail, /health !== "healthy" && !needsHealthAttention/u);
assert.match(detail, /howToRepairVaultHealth[\s\S]*compact/u);
assert.match(detail, /tone=\{healthNeedsDangerTone \? "danger" : "warning"\}/u);
assert.match(vault, /data-ltm-detail-conflict/u);
assert.equal(locale["ui.longTermMemory.memoryvault.memoryInfo"], "Memory info");
assert.equal(locale["ui.longTermMemory.memoryvault.memoryOptions"], "Memory options");
assert.equal(locale["ui.longTermMemory.memoryvault.renameDetails"], "Rename details");
assert.equal(locale["ui.longTermMemory.memoryvault.previewRename"], "Preview rename");
assert.equal(locale["ui.longTermMemory.memoryvault.openDebugLog"], "Open debug log");
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
assert.match(vault, /requestNotesByIds<LtmNote>\(ids\)/u);
assert.match(vault, /deleteConfirmationTarget/u);
assert.match(vault, /deleteConfirmationExcerpt/u);
assert.match(vault, /deleteConfirmationScope/u);
assert.match(vault, /deleteConfirmationMemoryId/u);
assert.match(vault, /deleteConfirmationHidden/u);
assert.match(vault, /targetsById\.size !== ids\.length/u);
assert.match(vault, /ids\.some\(\(id\) => !targetsById\.has\(id\)\)/u);
assert.match(vault, /const confirmationTitle = localizeUi\(/u);
assert.match(vault, /confirmLabel: confirmationLabel/u);
assert.match(vault, /deleteSelected\(ids\)/u);
assert.match(vault, /deleteTargetRevision/u);
assert.equal(
  (vault.match(/deleteRevision !== deleteTargetRevision\.current/gu) ?? []).length,
  2,
  "delete target resolution and confirmation must both re-check selection/scope changes",
);
assert.match(
  vault,
  /setBusy\(\(current\) => \(current === "delete" \? "" : current\)\)/u,
  "the delete flow must clear only its own busy token, even after the editor session changes",
);
assert.doesNotMatch(vault, /permanentlyDeleteSelectedMemories/u);
assert.equal(locale["ui.longTermMemory.memoryvault.permanentlyDeleteOne"], "Permanently delete 1 memory?");
assert.equal(locale["ui.longTermMemory.memoryvault.permanentlyDeleteOther"], "Permanently delete {{count}} memories?");
assert.equal(locale["ui.longTermMemory.memoryvault.deletePermanentlyOne"], "Delete 1 memory permanently");
assert.equal(locale["ui.longTermMemory.memoryvault.deletePermanentlyOther"], "Delete {{count}} memories permanently");
assert.equal(locale["ui.longTermMemory.memoryvault.deleteConfirmationExcerpt"], "Excerpt");
assert.equal(locale["ui.longTermMemory.memoryvault.deleteConfirmationMemoryId"], "Memory ID");
assert.match(vault, /data-ltm-note-actions-desktop[\s\S]*md:flex/u);
assert.doesNotMatch(vault, /data-ltm-note-actions-desktop[\s\S]*opacity-0/u);
assert.doesNotMatch(vault, /data-ltm-note-actions-desktop[\s\S]*pointer-events-none/u);
assert.match(vault, /data-ltm-note-actions-open/u);
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
assert.match(vault, /value1: scopeEntryLabel/u);
assert.match(
  vault,
  /scopeEntryLabel = secondaryTarget\s*\?\s*localizeUi\("ui\.longTermMemory\.memoryvault\.combinedScope"[\s\S]*?first: targetDisplayLabel\(target\) \|\| localizeUi\("ui\.longTermMemory\.memoryvault\.allMemories"\)[\s\S]*?second: targetDisplayLabel\(secondaryTarget\)/u,
);
assert.match(
  vault,
  /:\s*targetDisplayLabel\(target\) \|\| localizeUi\("ui\.longTermMemory\.memoryvault\.allMemories"\);/u,
);
assert.ok(
  vault.indexOf("data-ltm-vault-feedback") < vault.indexOf("<LtmWorkspace\n"),
  "shared Vault feedback must stay visible above the pane-switching workspace",
);
assert.match(sharedControls, /HTMLAttributes<HTMLDivElement>/u);
assert.match(sharedControls, /<div\s+role=\{tone === "danger" \? "alert" : "status"\}/u);
assert.doesNotMatch(vault, /<div role="alert"><StatusSurface tone="danger">/u);
assert.match(
  vault,
  /data-ltm-memory-group=\{type\}\s*>\s*<summary\s+style=\{\{ minHeight: "2\.75rem" \}\}\s+data-ltm-tab-focus/u,
);
assert.match(vault, /data-ltm-tab-focus\s+className="flex min-h-11 w-full[\s\S]*moreLinkTypes/u);
assert.match(
  detail,
  /\[data-ltm-accent-border\],\s*\[data-ltm-status="success"\]:not\(\.mari-editor-panel\),\s*\[data-ltm-freshness="fresh"\] \{\s*border-color: color-mix\(in srgb, var\(--marinara-editor-accent\) 30%, transparent\);/u,
);
assert.match(vault, /<span data-ltm-accent-border className="rounded-full border px-2 py-1">/u);
assert.match(vaultScreen, /inline-flex min-h-11 max-w-full[\s\S]*h-11 w-11/u);
assert.match(vault, /clearMemorySearch[\s\S]*h-11 w-11/u);
assert.match(vault, /data-ltm-mode-filter[\s\S]*min-h-11/u);
assert.match(vault, /bulkModes[\s\S]*min-h-11/u);
assert.match(vault, /data-ltm-memory-scope-secondary/u);
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
assert.match(sourceScopeCombobox, /aria-controls=\{listId\}/u);
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

const localeRoot = ltmClientRoot;
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
assert.match(workspaceScreen, /function SourceOperationWorkbench/u);
assert.match(workspaceScreen, /!previewed \|\| busy \|\| result/u);
assert.match(workspaceScreen, /disabled=\{\s*disabled \|\|\s*Boolean\(result\)/u);
assert.match(workspace, /confirmAction=\{props\.confirmAction\}/u);
assert.match(workspace, /key=\{`\$\{sourceOperation\.id\}:\$\{sourceOperation\.operation/u);
assert.match(workspaceScreen, /data-ltm-linked-memory-selection/u);
assert.match(workspaceScreen, /derivedNoteIds: selectedLinkedIds/u);
assert.match(workspaceScreen, /archive: "notes_only"/u);
assert.match(workspaceScreen, /excludedNoteIds: excludedMemories/u);
assert.match(workspaceScreen, /data-ltm-source-operation-preview/u);
assert.match(workspaceScreen, /data-ltm-source-operation-excluded/u);
assert.match(workspaceScreen, /data-ltm-source-operation-result/u);
assert.match(workspace, /data-ltm-source-mode/u);
assert.match(workspaceScreen, /const sourceCheckboxClass = "h-4 w-4 shrink-0 accent-/u);
assert.match(workspaceScreen, /linked\.isError[\s\S]*linkedMemoriesCouldNotLoad/u);
assert.match(workspaceScreen, /!linked\.data \|\| linked\.isError \|\| !previewed/u);
assert.match(workspace, /tone === "danger"[\s\S]*var\(--destructive\)/u);
assert.match(workspace, /className="hidden items-start gap-1 md:flex"/u);
assert.doesNotMatch(workspace, /group-hover:pointer-events-auto|transition-opacity/u);
assert.match(workspace, /className="space-y-2 border-t border-\[var\(--border\)\] py-3"/u);
assert.match(workspace, /\[changeSource, onRequestedSourceHandled, requestedSource\]/u);
assert.match(workspaceScreen, /importsAsMode/u);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.importsAsMode"], "Imports as {{mode}}");
assert.match(workspace, /data-ltm-import-result-mode=\{item\.extractionMode\}/u);
assert.match(workspace, /data-ltm-import-result-modes=/u);
assert.match(workspace, /data-ltm-retry-modes/u);
assert.match(workspace, /\.\.\.\(contract\.modes\?\.length \? \{ modes: contract\.modes \} : \{\}\)/u);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.retryUsesModes"], "Retries with {{modes}}");
assert.match(workspace, /const reextractDisabled = extractingId !== null \|\| !availabilityReady;/u);
assert.equal(workspace.match(/disabled=\{reextractDisabled\}/gu)?.length, 3);
assert.equal(
  workspace.match(/disabled=\{sourceTask\.active\?\.status === "running" \|\| !availabilityReady\}/gu)?.length,
  2,
);
assert.match(
  workspace,
  /const availabilityReady = settingsQuery\.isSuccess && effectiveAvailabilityModes\.length > 0/u,
);
assert.match(workspace, /availabilitySavingRef\.current/u);
assert.match(workspace, /availabilityDisabled=\{availabilitySaving \|\| !availabilityReady\}/u);
assert.match(workspace, /disabled=\{importDisabled\}/u);
assert.match(workspace, /settingsQuery\.refetch\(\)/u);
assert.equal(
  locale["ui.longTermMemory.sourcesworkspace.availabilitySettingsCouldNotLoad"],
  "Availability settings could not load.",
);
assert.equal(
  locale["ui.longTermMemory.sourcesworkspace.loadingAvailabilitySettings"],
  "Loading availability settings...",
);
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
assert.match(types, /onOpenSources\?: \(source\?: SourceTab, sourceNoteId\?: string\) => boolean \| Promise<boolean>/u);
assert.match(api, /export async function requestNotesByIds/u);
assert.match(api, /if \(!requestedIds\.length\) return \[\] as T\[\]/u);
assert.match(api, /new URLSearchParams/u);
assert.match(api, /undefined, signal/u);
assert.match(api, /const missingIds = requestedIds\.filter/u);
assert.doesNotMatch(reviewQueue, /requestAllNotes/u);
assert.match(reviewQueue, /requestNotesByIds<LtmNote>\(contextNoteIds, signal, true\)/u);
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
assert.match(reviewQueueScreen, /REVIEW_STATE_STORAGE_KEY/u);
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
assert.match(reviewQueueScreen, /MAX_APPEND_TEXT_LENGTH = 20_000/u);
assert.match(reviewQueueScreen, /MAX_SECTION_TEXT_LENGTH = 24_000/u);
assert.match(reviewQueueScreen, /charactersRemaining(?:One|Other)/u);
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
assert.match(reviewQueueScreen, /noteById\.get\(mutation\.link\.target\)\?\.title/u);
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

// #1212: the last-injection panel surfaces package-observed recall outcomes and
// the recall workflow marks whether that attempt was confirmed.
assert.match(lastInjectionSummary, /data\?\.attempt/u);
assert.match(lastInjectionSummary, /observedAttempt\.outcome === "cancelled"/u);
assert.match(lastInjectionSummary, /observedAttempt\.outcome === "failed"/u);
assert.match(lastInjectionSummary, /observedAttempt\.outcome === "skipped"/u);
assert.match(lastInjectionSummary, /observedAttempt\.reason === "chat_not_found"/u);
assert.match(lastInjectionSummary, /observedAttempt\.reason === "empty_query"/u);
assert.match(lastInjectionSummary, /observedAttempt\.reason === "prompt_budget"/u);
assert.match(lastInjectionSummary, /recallCompletedNotConfirmed/u);
// A newer unconfirmed/failed/skipped attempt must override an older confirmed
// receipt rather than presenting the stale injection as the latest result.
assert.match(lastInjectionSummary, /const attemptOverridesInjection = observedRecallMessage !== null;/u);
assert.match(lastInjectionSummary, /attemptOverridesInjection\s*\? observedRecallMessage/u);
assert.match(lastInjectionSummary, /!attemptOverridesInjection && data\?\.memories\.length/u);
assert.match(lastInjectionSummary, /attemptOverridesInjection \|\| !data\?\.memories\.length/u);
// PR 2 (#1259): the separate latest-recall panel, its correlation, and its
// injection-confirmation line were replaced by the selected recall operation's
// details pane; those ActivityView keys and the `data-ltm-recall-confirmation`
// contract no longer exist. LastInjectionSummary keeps its own outcome keys.
assert.equal(
  locale["ui.longTermMemory.lastinjectionsummary.recallCompletedNotConfirmed"],
  "Recall completed but no saved memory was confirmed in the latest model context.",
);

// #1211: the recall workflow explains effective parameters, the recall-time
// index snapshot, and the semantic outcome, and it labels the bounded
// rejected-candidate list instead of implying it is exhaustive.
assert.match(activity, /recallWorkflow\.semanticOutcome/u);
assert.match(activity, /recallWorkflow\??\.indexedChunks/u);
assert.match(activity, /recallWorkflow\??\.eligibleChunks/u);
assert.match(activity, /recallWorkflow\.rejectedLimit/u);
assert.match(activity, /settingRecallMode/u);
assert.match(activity, /settingIndex"/u);
assert.match(activity, /settingSemanticMatching/u);
assert.match(activity, /rejectedCandidatesUpTo/u);
assert.equal(
  locale["ui.longTermMemory.activityview.rejectedCandidatesUpTo"],
  "Recorded rejected candidates — up to {{limit}}",
);
assert.equal(locale["ui.longTermMemory.activityview.settingSemanticMatching"], "Semantic matching");
assert.equal(locale["ui.longTermMemory.activityview.settingIndex"], "Index");
// The index counts read as Result numbers over whole labels, not as one fragment.
assert.equal(locale["ui.longTermMemory.activityview.resultIndexed"], "indexed");
assert.equal(locale["ui.longTermMemory.activityview.resultUsable"], "usable in this chat");
// #1211 review repair: the index snapshot must also surface the build time and
// embedded-chunk count, and eligibility/targeting must render an explicit state
// for both true and false rather than disappearing when false.
assert.match(activity, /recallWorkflow\.indexGeneratedAt/u);
assert.match(activity, /recallWorkflow\.embeddedChunks/u);
assert.match(activity, /settingIndexBuilt/u);
assert.match(activity, /settingEmbeddedChunks/u);
assert.match(activity, /typeof recallWorkflow\.includeResolved === "boolean"/u);
assert.match(activity, /typeof recallWorkflow\.exclusiveCharacterTargeting === "boolean"/u);
assert.match(activity, /valueExcluded/u);
assert.match(activity, /valueWholeChat/u);
assert.equal(locale["ui.longTermMemory.activityview.settingIndexBuilt"], "Index built");
assert.equal(locale["ui.longTermMemory.activityview.settingEmbeddedChunks"], "Embedded chunks");
assert.equal(locale["ui.longTermMemory.activityview.settingResolvedMemories"], "Resolved memories");
assert.equal(locale["ui.longTermMemory.activityview.valueExcluded"], "Excluded");
assert.equal(locale["ui.longTermMemory.activityview.settingCharacterTargeting"], "Character targeting");
assert.equal(locale["ui.longTermMemory.activityview.valueWholeChat"], "Whole chat");

process.stdout.write(
  "Long-Term Memory feedback clarity UI regression: labels, outcomes, usage, warnings, and defaults ok\n",
);
