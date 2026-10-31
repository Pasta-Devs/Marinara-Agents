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
const vaultRow = readFileSync(ltmSourcePaths.vaultRow, "utf8");
const bulkAvailability = readFileSync(ltmSourcePaths.bulkAvailability, "utf8");
const availabilityTabRail = readFileSync(ltmSourcePaths.availabilityTabRail, "utf8");
const sourceScopeCombobox = readFileSync(ltmSourcePaths.sourceScopeCombobox, "utf8");
const targetPicker = readFileSync(ltmSourcePaths.targetPicker, "utf8");
const reviewQueue = readFileSync(ltmSourcePaths.reviewQueue, "utf8");
const displayLabels = readFileSync(join(dirname(ltmSourcePaths.reviewQueue), "../display-labels.ts"), "utf8");
const reviewQueueScreen = readScreen(ltmSourcePaths.reviewQueue);
const api = readFileSync(ltmSourcePaths.api, "utf8");
const workspaceLayout = readFileSync(ltmSourcePaths.workspaceLayout, "utf8");
const sharedControls = readFileSync(ltmSourcePaths.sharedControls, "utf8");
const types = readFileSync(ltmSourcePaths.types, "utf8");
const locale = JSON.parse(readFileSync(ltmSourcePaths.locale));
const routes = readFileSync(ltmSourcePaths.routes, "utf8");
const maintenance = readFileSync(ltmSourcePaths.maintenance, "utf8");

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
assert.match(
  navigation,
  /className=\{item\.id === "sources" && activeSourceTask \? "animate-spin motion-reduce:animate-none"/u,
);
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
// #1588: the destination panel follows the page, with no window-height cap; its place list caps itself.
assert.match(
  workspaceScreen,
  /<div\s+id="ltm-destination-scope-control"\s+role="group"\s+aria-labelledby=\{labelId\}\s+className="mari-editor-panel flex min-h-0 flex-col gap-3 p-3"\s*>/u,
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
// Slurp's switch is offered only after the global PUT succeeded and only when sharing went from off to on.
const globalSave = settings.slice(settings.indexOf("const saveSettings"), settings.indexOf("const discard"));
assert.match(globalSave, /const sharingWasOff = savedGlobal\?\.longTermMemoryShareWithPackages === false/u);
assert.match(globalSave, /sharingTurnedOn = sharingWasOff && saved\.longTermMemoryShareWithPackages/u);
assert.ok(
  globalSave.indexOf('"PUT"') < globalSave.indexOf("if (sharingTurnedOn)") &&
    globalSave.indexOf("if (sharingTurnedOn)") < globalSave.indexOf("offerSlurpMemories("),
  "the Slurp offer must follow the global PUT and run only when sharing turned on",
);
assert.equal(globalSave.match(/offerSlurpMemories\(/gu)?.length, 1);
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
assert.match(vault, /data-ltm-bulk-edit/u);
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
assert.match(
  availabilityTabRail,
  /<div ref=\{listRef\} data-ltm-availability-list className="max-h-52 overflow-y-auto">/u,
);
assert.doesNotMatch(availabilityTabRail, /border-t border-\[var\(--marinara-editor-divider\)\]/u);
assert.match(availabilityTabRail, /nextTabIndex\(event\.key/u);
assert.doesNotMatch(availabilityTabRail, /aria-expanded/u);
assert.doesNotMatch(availabilityTabRail, /group-open:rotate-90/u);
assert.doesNotMatch([vault, workspaceScreen].join("\n"), /currentIds=/u);
assert.match(vault, /useQuery\(scopeTargetsQueryOptions\(props\.chatId\)\)/u);
assert.doesNotMatch(workspace, /id: `branch:\$\{chat\.id\}`/u);
assert.match(workspace, /destinationScopeLimitReached/u);
assert.match(workspace, /hasDestinationScopeCapacity\(target\.destinationScope\)/u);
assert.match(availabilityTabRail, /data-ltm-availability-target/u);
assert.match(sourceScopeCombobox, /data-ltm-scope-picker-popup/u);
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
assert.match(vaultScreen, /bulkAvailabilitySelectedOne/u);
assert.match(vaultScreen, /bulkAvailabilitySelectedOther/u);
assert.equal(locale["ui.longTermMemory.memoryvault.bulkAvailabilitySelectedOne"], "{{count}} memory selected");
assert.equal(locale["ui.longTermMemory.memoryvault.bulkAvailabilitySelectedOther"], "{{count}} memories selected");
// #1636: the Edit selected sheet says what Apply will do, and why it is off, beside both Apply buttons.
assert.equal(
  locale["ui.longTermMemory.memoryvault.bulkOutcomeSummary"],
  "{{ready}} ready · {{unchanged}} unchanged · {{blocked}} blocked",
);
assert.match(bulkAvailability, /role="status"[^>]*data-ltm-bulk-outcome-summary/u);
assert.match(bulkAvailability, /aria-disabled=\{canApply \? undefined : true\}/u);
assert.doesNotMatch(bulkAvailability, /\sdisabled=\{/u);
assert.match(bulkAvailability, /renderApply\("top"\)[\s\S]*renderApply\("bottom"\)/u);
assert.match(bulkAvailability, /if \(canApply\) onApply\(\)/u);
assert.match(bulkAvailability, /removedTargets\.length > 0 && remainingPlaces\.length === 0 && changes/u);
assert.match(bulkAvailability, /pressedMark/u);
assert.match(vault, /pending=\{Boolean\(busy\)\}/u);
assert.match(vault, /if \(busy \|\| batchPendingRef\.current\) return;\s*setAvailabilityOpen\(null\);/u);
assert.match(vaultScreen, /chat:all/u);
assert.doesNotMatch(vaultScreen, /branch:all|"branch"/u);
assert.doesNotMatch(vault, /chooseOneAvailabilityPlace/u);
assert.match(vaultRow, /line-clamp-2 break-words text-xs leading-5/u);
assert.doesNotMatch(vaultScreen, /line-clamp-2 block/u);
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
assert.match(vault, /localizeUi\("ui\.longTermMemory\.memoryvault\.keywordsAndLinks"\)/u);
assert.doesNotMatch(vault, /memoryvault\.(memoryOptions|memoryInfo|showMemoryInfo|hideMemoryInfo)/u);
assert.match(
  vault,
  /<Button\s+onClick=\{\(\) => \{\s+const next = !detailsOpen;[\s\S]*?aria-pressed=\{detailsOpen\}[\s\S]*?data-ltm-details-toggle[\s\S]*?memoryvault\.memoryDetails"\)\}\s+<\/Button>/u,
);
assert.match(vault, /label: localizeUi\("ui\.longTermMemory\.memoryvault\.memoryDetails"\)/u);
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
assert.equal(locale["ui.longTermMemory.memoryvault.editSelected"], "Edit selected…");
assert.equal(locale["ui.longTermMemory.memoryvault.refine"], "Refine");
assert.equal(locale["ui.longTermMemory.memoryvault.changeAvailability"], undefined);
assert.match(
  vault,
  /<details\s+data-ltm-refine[\s\S]*?data-ltm-memory-scope-secondary[\s\S]*?data-ltm-mode-filter[\s\S]*?<\/details>/u,
);
assert.match(vault, /useEffect\(\(\) => \{\s*if \(refineActive\) setRefineOpen\(true\);/u);
assert.equal(locale["ui.longTermMemory.memoryvault.bulkChangeGroup"], undefined);

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
// #1673: the panel's width decides these, so a narrow panel on a wide window keeps the compact layout.
assert.doesNotMatch(settings, /sm:grid-cols-4/u);
assert.match(settings, /\[data-ltm-settings-tab-rail\] \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/u);
assert.equal((settings.match(/<div\s+data-ltm-recall-grid\s+className="grid gap-2"\s*>/gu) ?? []).length, 2);
assert.match(settings, /\[data-ltm-recall-grid\] \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u);
assert.doesNotMatch(detail, /sm:min-h-9|sm:min-w-0|hidden sm:inline|md:flex/u);
assert.match(detail, /\[data-ltm-add-label\] \{\s*display: inline;/u);
assert.match(detail, /\[data-ltm-surface="vault-health-pill"\] \{\s*display: flex;/u);
assert.match(detail, /\[data-ltm-health-detail\] \{\s*display: inline;/u);
assert.doesNotMatch(activity, /sm:grid-cols-2/u);
assert.match(activity, /<dl data-ltm-debug-settings-grid className=/u);
assert.match(activity, /<div data-ltm-debug-facts-grid className=/u);
assert.match(
  activity,
  /@container ltm-memory-settings \(min-width: 40rem\) \{\s*\[data-ltm-debug-settings-grid\],\s*\[data-ltm-debug-facts-grid\] \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u,
);
const onboarding = readFileSync(join(dirname(ltmSourcePaths.detail), "Onboarding.tsx"), "utf8");
assert.match(onboarding, /@container ltm-onboarding \(min-width: 48rem\)/u);
assert.doesNotMatch(onboarding, /@media \(min-width: 768px\)/u);
// The scrollers fit a short or zoomed viewport: no 20rem floor, and dvh so mobile chrome cannot inflate the cap.
// A vh line above it covers browsers without dvh; a 10rem floor stops a very short window collapsing the list.
const dvhCap = /max-height: calc\(100vh - 12rem\);\s*max-height: max\(10rem, calc\(100dvh - 12rem\)\);/u;
assert.match(vault, dvhCap);
assert.doesNotMatch(vault, /max\(20rem, calc\(100vh/u);
assert.match(activity, new RegExp(`\\[data-ltm-debug-list\\] \\{\\s*${dvhCap.source}`, "u"));
assert.doesNotMatch(activity, /maxHeight: "calc\(/u);
// The last two window breakpoints in the settings and setup guide follow their containers too.
assert.doesNotMatch(onboarding, /sm:p-6/u);
assert.match(
  onboarding,
  /@container ltm-onboarding \(min-width: 40rem\) \{\s*\[data-ltm-onboarding-body\] \{\s*padding: 1\.5rem;/u,
);
const promptTemplates = readFileSync(
  join(dirname(ltmSourcePaths.detail), "settings", "ExtractionPromptTemplates.tsx"),
  "utf8",
);
assert.doesNotMatch(promptTemplates, /sm:grid-cols-3/u);
assert.match(promptTemplates, /<div\s+data-ltm-active-template-grid\s+className="grid gap-2"\s*>/u);
assert.match(settings, /\[data-ltm-active-template-grid\] \{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/u);
// #1673: the last raw text-style buttons meet the 2.75rem floor instead of a ~20px target.
assert.match(
  maintenance,
  /<button\s+type="button"\s+className="inline-flex min-h-11 items-center underline"\s+onClick=\{\(\) => void integrity\.refetch\(\)\}/u,
);
assert.match(
  settings,
  /className="inline-flex min-h-11 items-center underline"\s+onClick=\{\(\) => void connections\.refetch\(\)\}/u,
);
assert.match(
  settings,
  /className="inline-flex min-h-11 items-center underline"\s+onClick=\{\(\) => \{\s*void global\.refetch\(\);/u,
);
assert.match(
  settingsScreen,
  /className="inline-flex min-h-11 items-center text-\[0\.6875rem\] underline"\s+onClick=\{\(\) => setActive\(mode, null\)\}/u,
);
assert.doesNotMatch(settingsScreen, /className="(?:text-\[0\.6875rem\] )?underline"/u);
assert.match(detail, /health !== "healthy" && !needsHealthAttention/u);
assert.match(detail, /howToRepairVaultHealth[\s\S]*compact/u);
assert.match(detail, /tone=\{healthNeedsDangerTone \? "danger" : "warning"\}/u);
assert.match(vault, /data-ltm-detail-conflict/u);
assert.equal(locale["ui.longTermMemory.memoryvault.memoryDetails"], "Memory info");
assert.equal(locale["ui.longTermMemory.memoryvault.keywordsAndLinks"], "Keywords and links");
for (const key of ["memoryInfo", "memoryOptions", "showMemoryInfo", "hideMemoryInfo"]) {
  assert.equal(`ui.longTermMemory.memoryvault.${key}` in locale, false, `${key} is replaced by one pane name`);
}
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
// #1588: wide-panel row actions show by the workspace container query (LtmWorkspace), not a viewport class.
assert.match(vaultRow, /data-ltm-note-actions-desktop\s+data-ltm-row-actions="inline"/u);
assert.doesNotMatch(vaultRow, /data-ltm-note-actions-desktop[\s\S]*opacity-0/u);
assert.doesNotMatch(vaultRow, /data-ltm-note-actions-desktop[\s\S]*pointer-events-none/u);
assert.match(vaultRow, /data-ltm-note-actions-open/u);
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
assert.match(vaultScreen, /memoryvault\.chatModes[\s\S]*min-h-11/u);
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
assert.match(detail, /navigationBusyProps = lockedActionProps\(navigationSaveInFlight\)/u);
// Detail locks go through the shared helper; no hand-built aria-disabled literal is left.
assert.match(detail, /<Button \{\.\.\.lockedActionProps\(repairPending\)\}/u);
assert.doesNotMatch(detail, /"aria-disabled": true/u);
assert.match(detail, /\{\.\.\.navigationBusyProps\}/u);
assert.match(detail, /finishNavigationPrompt\("save"\)/u);
assert.match(detail, /aria-modal="true"/u);
assert.match(detail, /event\.key !== "Tab"/u);

// Pending controls keep keyboard focus: aria-disabled plus a ref guard, with native `disabled`
// kept only for permanent unavailability.
const chatSettings = readFileSync(join(dirname(ltmSourcePaths.detail), "ChatSettings.tsx"), "utf8");
assert.match(detail, /activationBusyRef\.current\) return;/u);
assert.match(detail, /repairBusyRef\.current\) return;/u);
assert.match(
  detail,
  /disabled=\{!props\.onEnabledForChatChange\}\s+aria-disabled=\{activationPending \|\| undefined\}/u,
);
assert.doesNotMatch(detail, /(?<!aria-)disabled=\{activationPending/u);
assert.doesNotMatch(detail, /(?<!aria-)disabled=\{repairPending/u);
assert.match(detail, /\[data-ltm-control="activation"\]\[aria-disabled="true"\]/u);
assert.match(chatSettings, /pendingRef\.current\) return;/u);
assert.match(chatSettings, /disabled=\{readOnly\}\s+aria-disabled=\{pending \|\| undefined\}/u);
assert.equal(chatSettings.match(/busy=\{pending\}/gu)?.length, 2);
assert.doesNotMatch(chatSettings, /(?<!aria-)disabled=\{pending/u);
assert.match(sharedControls, /aria-disabled=\{busy \|\| undefined\}\s+readOnly=\{busy\}/u);

// #1617: the Detail dialog names its destination, the shared MemoryVault wording is untouched, and Chat Settings
// no longer invents values or names a label that does not exist.
assert.match(locale["ui.longTermMemory.longtermmemorydetail.unsavedNavigationDescription"], /\{\{action\}\}/u);
assert.match(detail, /longtermmemorydetail\.unsavedNavigationDescription", \{\s*action: navigationPrompt/u);
assert.doesNotMatch(detail, /memoryvault\.unsavedNavigationDescription/u);
assert.match(locale["ui.longTermMemory.longtermmemorydetail.unsavedChangesLostBeforeOpening"], /\{\{destination\}\}/u);
assert.match(detail, /unsavedChangesLostBeforeOpening[\s\S]*memoryvault\.discardAndContinue/u);
assert.equal("ui.longTermMemory.chatsettings.lastInjectionSummaryGuidance" in locale, false);
assert.equal("ui.longTermMemory.chatsettings.openLongTermMemorySettings" in locale, false);
assert.deepEqual(
  Object.entries(locale).filter(
    ([key, value]) => key.includes(".chatsettings.") && /Last Injection Summary/u.test(value),
  ),
  [],
);
assert.match(chatSettings, /recallStyles\.map\(\(style\)/u);
assert.match(chatSettings, /chatsettings\.openLongTermMemory"/u);
assert.match(chatSettings, /defaults \? \(defaults\.longTermMemoryBudgetTokens \?\? 4096\) : null/u);
assert.match(chatSettings, /placeholder=\{effectiveBudget === null \? unknownValueLabel : undefined\}/u);
assert.match(chatSettings, /placeholder=\{effectiveMaxChunks === null \? unknownValueLabel : undefined\}/u);
assert.match(sharedControls, /value: number \| null/u);

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
// #1673: every underlined text button anywhere in the package meets the 2.75rem floor, whatever its markup.
// The floor is `min-h-11` or an inline `minHeight: 44` on the same element. LastInjectionSummary keeps a
// 1.75rem target in its compact strip only, the host drawer's own action floor (#1714).
const underlinedBelowFloor = sourceFiles.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/gu)]
    .map((match) => ({ classes: match[1] ?? match[2], after: text.slice(match.index, match.index + 240) }))
    .filter(({ classes }) => /(?:^|\s)underline(?:\s|$)/u.test(classes))
    .filter(({ classes, after }) => !/(?:^|\s)min-h-11(?:\s|$)/u.test(classes) && !/minHeight: 44/u.test(after))
    .filter(
      ({ classes }) =>
        !(basename(file) === "LastInjectionSummary.tsx" && /compact \? "min-h-7" : "min-h-11"/u.test(classes)),
    )
    .map(({ classes }) => `${basename(file)}: ${classes}`);
});
assert.deepEqual(underlinedBelowFloor, []);
// #1714: the container, not the window, picks the setup-guide sprite and the detail header sizes.
const onboardingSource = readFileSync(join(ltmClientRoot, "Onboarding.tsx"), "utf8");
assert.doesNotMatch(onboardingSource, /<picture|<source/u);
assert.match(
  onboardingSource,
  /@container ltm-onboarding \(min-width: 48rem\) \{[\s\S]*?\[data-ltm-onboarding-sprite-wide\] \{\s*display: block/u,
);
assert.doesNotMatch(detail, /max-md:/u);
assert.match(
  detail,
  /@container ltm-detail \(max-width: 47\.99rem\) \{\s*\[data-ltm-surface="detail"\] \[data-ltm-detail-icon\]/u,
);
const vaultLocaleValues = Object.entries(locale)
  .filter(([key]) => key.startsWith("ui.longTermMemory.memoryvault."))
  .map(([, value]) => value)
  .join(" ");
assert.doesNotMatch(vaultLocaleValues, /\b(?:Metadata|Scope|Derived memories|Connections)\b/u);
assert.match(workspaceScreen, /function SourceOperationWorkbench/u);
assert.match(workspaceScreen, /!previewed \|\| busy \|\| result/u);
assert.match(workspaceScreen, /disabled=\{\s*Boolean\(result\) \|\|/u);
assert.match(workspace, /confirmAction=\{props\.confirmAction\}/u);
assert.match(workspace, /key=\{`\$\{sourceOperation\.id\}:\$\{sourceOperation\.operation/u);
assert.match(workspaceScreen, /data-ltm-linked-memory-selection/u);
assert.match(workspaceScreen, /derivedNoteIds: selectedLinkedIds/u);
assert.match(workspaceScreen, /archive: "notes_only"/u);
assert.match(workspaceScreen, /excludedNoteIds: excludedMemories/u);
assert.match(workspaceScreen, /data-ltm-source-operation-preview/u);
assert.match(workspaceScreen, /data-ltm-source-operation-excluded/u);
assert.match(workspaceScreen, /data-ltm-source-operation-result/u);
// The result's hidden status copy is always mounted (LiveResult), and only the visible list waits for a result.
assert.match(
  workspaceScreen,
  /<div\s+data-ltm-source-operation-result=\{result \? operation : undefined\}[^>]*>\s*<LiveResult/u,
);
assert.doesNotMatch(workspaceScreen, /\{result \? \(\s*<div data-ltm-source-operation-result/u);
assert.match(workspace, /data-ltm-source-mode/u);
assert.match(workspaceScreen, /const sourceCheckboxClass = "h-4 w-4 shrink-0 accent-/u);
assert.match(workspaceScreen, /linked\.isError[\s\S]*linkedMemoriesCouldNotLoad/u);
assert.match(workspaceScreen, /!linked\.data \|\| linked\.isError \|\| !previewed/u);
assert.match(workspace, /tone === "danger"[\s\S]*var\(--destructive\)/u);
assert.match(workspace, /className="items-start gap-1" data-ltm-row-actions="inline"/u);
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
// Re-extract locks on any running source task, stays focusable and points at the lock reason.
assert.match(workspace, /const reextractLocked = importRunning \|\| !availabilityReady;/u);
assert.match(workspace, /const reextractActionProps = lockedActionProps\(reextractLocked, reextractReasonId\);/u);
// While availability settings load, Re-extract points at the existing loading message instead of staying silent.
assert.match(
  workspace,
  /const reextractReasonId = importRunning \? importLockId : !availabilityReady \? availabilityWaitId : undefined;/u,
);
assert.match(workspace, /id=\{availabilityWaitId\}/u);
assert.equal(workspace.match(/\{\.\.\.reextractActionProps\}/gu)?.length, 3);
assert.doesNotMatch(workspace, /(?<!aria-)disabled=\{reextractDisabled\}/u);
assert.equal(workspace.match(/disabled=\{reextractLocked\}/gu)?.length, 2);
assert.equal(workspace.match(/lockReasonId=\{reextractReasonId\}/gu)?.length, 2);
assert.match(
  workspace,
  /const availabilityReady = settingsQuery\.isSuccess && effectiveAvailabilityModes\.length > 0/u,
);
assert.match(workspace, /availabilitySavingRef\.current/u);
assert.match(workspace, /availabilityDisabled=\{availabilitySaving \|\| !availabilityReady\}/u);
assert.match(
  workspace,
  /const importActionProps = lockedActionProps\(importDisabled, importRunning \? importLockId : undefined\)/u,
);
assert.match(workspace, /id=\{importLockId\}/u);
// The lock note is empty unless a run is active, so only a run may reference it: not loading or saving, and
// Re-import locks on any running task (`importRunning`), not on an availability save.
assert.match(workspace, /"aria-describedby": importRunning \? `\$\{importLockId\} \$\{reasonId\}` : reasonId/u);
assert.match(workspace, /\$\{importRunning \? ` \$\{importLockId\}` : ""\}/u);
assert.doesNotMatch(workspace, /importDisabled \? `[^`]*importLockId/u);
assert.equal((workspace.match(/disabled=\{importDisabled\}/gu) ?? []).length, 0);
assert.doesNotMatch(workspace, /disabled=\{importing\}/u);
assert.match(workspace, /disabled=\{selectedBookImportIds\.length === 0\}/u);
assert.match(workspace, /disabled=\{selectedBookRefreshIds\.length === 0\}/u);
assert.match(workspace, /\.\.\.importActionProps/u);
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
assert.match(reviewQueueScreen, /textExceedsLimit/u);
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
assert.match(
  reviewQueue,
  /const acceptDisabled = !eligibleIds\.has\(row\.mutation\.id\) \|\| !valid \|\| preflightBlocked/u,
);
assert.match(reviewQueue, /aria-disabled=\{acceptDisabled \|\| runBusy \|\| undefined\}/u);
assert.match(reviewQueue, /if \(!runBusy && !acceptDisabled\) void runBatch\("accept", \[row\]\)/u);
assert.match(reviewQueue, /const batchAcceptDisabled =/u);
assert.match(reviewQueue, /aria-disabled=\{batchAcceptDisabled \|\| runBusy \|\| undefined\}/u);
assert.match(reviewQueue, /if \(!runBusy && !batchAcceptDisabled\) void runBatch\("accept"\)/u);
assert.doesNotMatch(reviewQueue, /disabled=\{!eligibleIds\.has\(row\.mutation\.id\)/u);
assert.doesNotMatch(reviewQueue, /disabled=\{!eligibleSelectedRows\.length \|\| invalidSelectedEdits/u);
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
assert.equal(locale["ui.longTermMemory.reviewqueue.reviewChangeForTitle"], "Check change for {{title}}");
assert.equal(locale["ui.longTermMemory.reviewqueue.applyChangeForTitle"], "Apply change for {{title}}");
// #1654: one Check/Apply verb pair, "changes" not "mutations", and a plain sentence for the engine's codes.
assert.match(reviewQueue, /data-ltm-review-action-text/u);
assert.match(reviewQueue, /data-ltm-review-state-chip/u);
assert.match(reviewQueue, /reviewCodeText\(blocker\.code/u);
assert.equal(locale["ui.longTermMemory.reviewqueue.missingSourceTitle"], "Deleted source");
assert.equal(locale["ui.longTermMemory.reviewqueue.preflightReady"], "Checked, ready to apply");
assert.equal(locale["ui.longTermMemory.reviewqueue.mutationActions"], "Change actions");
assert.equal(locale["ui.longTermMemory.reviewqueue.rowCheck"], "Check");
assert.equal(locale["ui.longTermMemory.reviewqueue.rowApply"], "Apply");
assert.equal(locale["ui.longTermMemory.reviewqueue.codeSourceMissing"], "The source note was deleted.");
// The two stale codes name their remedy, and a catch-all code keeps the engine's own reason.
assert.match(locale["ui.longTermMemory.reviewqueue.codeSourceStale"], /Extract the source again/u);
assert.match(locale["ui.longTermMemory.reviewqueue.codeSourceContextUnbound"], /Extract the source again/u);
assert.match(displayLabels, /catchAllReviewCodes[\s\S]*preflight_blocked[\s\S]*projection_failed/u);
// Rows follow the run's own mutation ids, a missing source is only claimed once the notes context is ready, and
// a failed request stays a danger beside ready rows.
assert.match(reviewQueue, /runMutationIds\.has\(row\.mutation\.id\)/u);
assert.match(reviewQueue, /reviewContextReady\s*\?[^;]*missingSourceTitle/u);
assert.match(reviewQueue, /result\.failed \|\| result\.indexRebuildFailures\.length[\s\S]{0,80}danger/u);
assert.match(reviewQueue, /humanizeText\(diagnostic\.message\)/u);
for (const key of Object.keys(locale).filter((name) => name.startsWith("ui.longTermMemory.reviewqueue."))) {
  assert.doesNotMatch(
    locale[key].replace(/\{\{\w+\}\}/gu, ""),
    /\bmutations?\b|\bpreflight\b/iu,
    `${key} still uses engine wording`,
  );
}
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

// Scope loading stays separate from local-character discovery (formerly long-term-memory-loading).
assert.match(api, /export const ltmScopeTargetsKey = \(chatId: string \| null \| undefined\)/u);
assert.match(
  api,
  /export const scopeTargetsQueryOptions = \(chatId: string \| null \| undefined\) => \(\{\s+queryKey: ltmScopeTargetsKey\(chatId\),\s+staleTime: 30_000,/u,
);
assert.match(workspace, /useQuery\(scopeTargetsQueryOptions\(props\.chatId\)\)/u);
const previewBlock = workspace.slice(workspace.indexOf("const previewEnabled ="), workspace.indexOf("const rows ="));
assert.match(
  previewBlock,
  /const previewEnabled = sourceContextMatchesProps && sourceTargetResolved && source !== "lorebooks"/u,
);
assert.match(
  previewBlock,
  /const lorebookPreviewEnabled = sourceContextMatchesProps && sourceTargetResolved && source === "lorebooks"/u,
);
assert.match(previewBlock, /const preview = useInfiniteQuery\(\{[\s\S]*?enabled: previewEnabled,/u);
assert.match(previewBlock, /const lorebookPreview = useInfiniteQuery\(\{[\s\S]*?enabled: lorebookPreviewEnabled,/u);
const sourceDetailsBlock = workspace.slice(
  workspace.indexOf("const sourceDetails = useQuery({"),
  workspace.indexOf("const previewData ="),
);
assert.match(sourceDetailsBlock, /scopeTargets\.isSuccess/u);
assert.match(sourceDetailsBlock, /sourceContextMatchesProps/u);
assert.match(sourceDetailsBlock, /focusedFlatSourceId !== null/u);
assert.match(workspace, /const sourceContextMatchesProps = sourceContextKey === \(props\.chatId \?\? "all"\)/u);
assert.match(workspace, /const sourceTargetResolved = Boolean\(sourceTarget && scopeTargets\.isSuccess\)/u);
assert.match(
  workspace,
  /const previewData = sourceContextMatchesProps && sourceTargetResolved \? mergedPreview : undefined/u,
);
assert.match(
  workspace,
  /const lorebookPreviewData = sourceContextMatchesProps && sourceTargetResolved \? mergedLorebookPreview : undefined/u,
);
assert.match(
  workspace,
  /const sourceDetailsData = sourceContextMatchesProps && sourceTargetResolved \? sourceDetails\.data : undefined/u,
);
assert.match(workspace, /setSourceTargetId\(props\.chatId \? `chat:\$\{props\.chatId\}` : "all"\)/u);
assert.match(workspace, /scopeTargetOptions\.find\(\(target\) => target\.id === sourceTargetId\)/u);
assert.match(workspace, /setSourceTargetId\(next\)/u);
assert.match(workspace, /if \(scopeTargets\.isError\) \{/u);
assert.match(workspace, /scopeTargets\.refetch\(\)/u);
const scopeTargetsRoute = routes.slice(
  routes.indexOf('app.get<{ Querystring: unknown }>("/scope-targets"'),
  routes.indexOf('app.get<{ Querystring: unknown }>("/local-characters"'),
);
assert.doesNotMatch(scopeTargetsRoute, /loadTrustedLtmSubjectCatalog/u);
assert.match(vault, /localCharacters\.isLoading && !localCharacters\.data/u);
assert.match(vault, /localCharacters\.isError && !localCharacters\.data/u);
assert.match(vault, /localCharacters\.refetch\(\)/u);
assert.equal((maintenance.match(/queryKeys\.localCharactersRoot/g) ?? []).length, 2);
// One lock helper serves every run-time lock; `Button` and `IconButton` dim on `aria-disabled` themselves, so a
// caller no longer passes `opacity-50`. Running work (`busy`, `pending`) never feeds a native `disabled`,
// which would drop keyboard focus; only input validity does.
assert.match(sharedControls, /export function lockedActionProps\(locked: boolean, reasonId\?: string\)/u);
assert.equal((sharedControls.match(/props\["aria-disabled"\] \? "opacity-50"/gu) ?? []).length, 2);
assert.match(maintenance, /const lock = lockedActionProps\(busy\)/u);
// A native `disabled={…}` expression is read to its matching brace: a pattern that stops at the first `}` lets a
// nested object, arrow body or template literal hide the running-work flag from the scan.
const nativeDisabledMentioning = (source, pattern) => {
  const found = [];
  for (const match of source.matchAll(/(?<!aria-)\bdisabled=\{/gu)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    for (; end < source.length && depth > 0; end += 1) {
      if (source[end] === "{") depth += 1;
      else if (source[end] === "}") depth -= 1;
    }
    const expression = source.slice(start, end - 1);
    if (pattern.test(expression)) found.push(expression);
  }
  return found;
};
const runningWork = /\b(?:busy|pending)\b/u;
assert.deepEqual(nativeDisabledMentioning("<Button disabled={!ready || busy} />", runningWork), ["!ready || busy"]);
assert.deepEqual(nativeDisabledMentioning("<Button disabled={busy} />", runningWork), ["busy"]);
assert.deepEqual(
  nativeDisabledMentioning("<Button disabled={Boolean(find({ id })) || busy} />", runningWork),
  ["Boolean(find({ id })) || busy"],
  "an expression with a nested object is read whole",
);
assert.doesNotMatch(
  "<Button disabled={Boolean(find({ id })) || busy} />",
  /disabled=\{[^}]*\b(?:busy|pending)\b/u,
  "the first-brace pattern misses that expression",
);
assert.deepEqual(nativeDisabledMentioning("<Button aria-disabled={busy} />", runningWork), []);
assert.deepEqual(nativeDisabledMentioning(maintenance, runningWork), []);
assert.doesNotMatch(vault, /className: "opacity-50"/u);
assert.doesNotMatch(readFileSync(ltmSourcePaths.settings, "utf8"), /className: "opacity-50"/u);
// Vault and Review locks: unsaved identity edits and running saves never feed a native `disabled`; the source
// list names one reason node, and a stale or blocked row says why on the row itself.
const availabilityWorkbench = readFileSync(
  join(dirname(ltmSourcePaths.vault), "MemoryAvailabilityWorkbench.tsx"),
  "utf8",
);
const subjectIdentityReview = readFileSync(
  join(dirname(ltmSourcePaths.reviewQueue), "SubjectIdentityReview.tsx"),
  "utf8",
);
assert.deepEqual(nativeDisabledMentioning(reviewQueue, /identityDirtyIds/u), []);
assert.deepEqual(
  nativeDisabledMentioning(
    reviewQueue,
    /\b(?:dismissingId|clearingSourceId|extractingSourceId|isFetching|running !== null)\b/u,
  ),
  [],
);
assert.equal(
  (reviewQueue.match(/lockedActionProps\(identityLocked, identityLockReasonId\)/gu) ?? []).length,
  2,
  "the source select and the rejected-count button share the identity lock reason",
);
assert.match(reviewQueue, /id=\{identityLockReasonId\}/u);
assert.ok((reviewQueue.match(/if \(identityLocked\) return;/gu) ?? []).length >= 2);
assert.match(reviewQueue, /const acceptReason = !valid[\s\S]*?acceptRowNotEligible/u);
assert.doesNotMatch(availabilityWorkbench, /(?<!aria-)disabled=\{busy\}/u);
assert.match(availabilityWorkbench, /\{\.\.\.lockedActionProps\(busy\)\}/u);
assert.doesNotMatch(subjectIdentityReview, /(?<!aria-)disabled=\{busy/u);
assert.match(subjectIdentityReview, /aria-disabled=\{busy \|\| undefined\}/u);
assert.doesNotMatch(vault, /(?<!aria-)disabled=\{Boolean\(busy\)/u);
assert.ok(locale["ui.longTermMemory.reviewqueue.identityLockReason"]);
assert.ok(locale["ui.longTermMemory.reviewqueue.acceptRowNotEligible"]);
// #1636: Save keeps its label and tone, stays focusable while off and reports Saving and Saved in a polite region
// beside it; a save that waits on a recall rebuild is a warning, not an error.
assert.match(vault, /aria-disabled=\{!dirty \|\| busy === "save" \? true : undefined\}/u);
assert.doesNotMatch(vault, /primary\s+disabled=/u);
assert.match(vault, /role="status"\s+data-ltm-save-status/u);
// A save asked for during a save (the unsaved-changes dialog, the host shortcut) awaits that run's result, never a
// synthetic `false` that `confirm()` reads as "did not save" and the host reads as "save failed".
assert.match(vault, /if \(savePromiseRef\.current\) return savePromiseRef\.current;/u);
assert.doesNotMatch(vault, /savePendingRef/u);
// One save speaks once: the inline status announces Saving, and its Saved text is hidden from assistive technology
// because the banner's "Memory saved" notice announces it.
assert.match(vault, /saveState === "saved" \? <span aria-hidden="true">\{saveStatus\}<\/span> : saveStatus/u);
// A save clears the standing notice first: a second save writes the identical "Memory saved" text, which a polite
// region does not announce twice, so without this the later save would start aloud and finish silently.
// An archive Undo keeps its own caption in ArchiveUndoState, so the save clears the notice unconditionally.
assert.match(vault, /setSaveState\("saving"\);\s+setError\(""\);\s+(?:\/\/[^\n]*\n\s*)*setNotice\(""\);/u);
assert.doesNotMatch(vault, /if \(!archiveUndo\) setNotice/u);
assert.match(vault, /caption: string;/u);
assert.match(vault, /<span data-ltm-archive-undo-caption/u);
// A memory that is already global is blocked under its own reason, not under a last place it never had.
assert.match(vaultScreen, /alreadyEverywhere: removesLastPlace && !removesLastMode && places\.length === 0/u);
assert.match(locale["ui.longTermMemory.memoryvault.applyReasonNothingToChange"], /would be skipped/u);
assert.doesNotMatch(locale["ui.longTermMemory.memoryvault.applyReasonNothingToChange"], /last place/u);
assert.ok(locale["ui.longTermMemory.memoryvault.alreadyAvailableEverywhere"]);
assert.match(vault, /const setWarning = useCallback/u);
assert.match(vault, /tone=\{noticeState\.warning \? "warning" : "success"\}/u);
assert.doesNotMatch(vault, /setError\(\s*localizeUi\("ui\.longTermMemory\.memoryvault\.savedButRecallIsStale"/u);
assert.equal(
  locale["ui.longTermMemory.memoryvault.savedButRecallIsStale"],
  "Saved. Recall will catch up once the index rebuild succeeds: {{error}}",
);
// An empty rebuild error picks the no-error key at both call sites, so the warning never ends in a bare colon.
assert.equal(
  locale["ui.longTermMemory.memoryvault.savedButRecallIsStaleNoError"],
  "Saved. Recall will catch up once the index rebuild succeeds.",
);
assert.doesNotMatch(locale["ui.longTermMemory.memoryvault.savedButRecallIsStaleNoError"], /\{\{|:\s*$/u);
assert.doesNotMatch(vault, /error: (?:response|result)\.rebuild\.error \?\? ""/u);
assert.equal(
  vault.match(
    /\.rebuild\.error\s*\?\s*localizeUi\("ui\.longTermMemory\.memoryvault\.savedButRecallIsStale", \{ error: /gu,
  )?.length,
  2,
);
assert.equal(vault.match(/"ui\.longTermMemory\.memoryvault\.savedButRecallIsStaleNoError"/gu)?.length, 2);
// #1636: the open row uses the documented primary wash plus a start-edge bar and aria-current, not an accent tint.
assert.match(vaultRow, /selected \? "bg-\[var\(--primary\)\]\/10" : ""/u);
assert.doesNotMatch(vaultRow, /bg-\[var\(--accent\)\]\/50/u);
assert.match(vaultRow, /\{selected \? \(\s*<span\s+aria-hidden="true"\s+data-ltm-note-open-bar/u);
assert.match(vaultRow, /aria-current=\{selected \? "true" : undefined\}/u);
// #1659: the source write and the list reload no longer share a name. The write says what it overwrites, and its
// description joins the destination reason instead of replacing it.
assert.equal(locale["ui.longTermMemory.sourcesworkspace.reimportFromSource"], "Re-import from source");
assert.equal(locale["ui.longTermMemory.sourcesworkspace.reloadList"], "Reload list");
assert.match(
  locale["ui.longTermMemory.sourcesworkspace.reimportFromSourceDescription"],
  /Overwrites the imported text/u,
);
assert.match(workspace, /data-ltm-source-action="refresh"[\s\S]{0,200}sourcesworkspace\.reimportFromSource"/u);
assert.equal((workspace.match(/data-ltm-source-action="refresh-preview"/gu) ?? []).length, 2);
assert.match(workspace, /<p id=\{reimportDescriptionId\}/u);
assert.equal((workspace.match(/sourcesworkspace\.reloadList"/gu) ?? []).length, 2);
assert.match(workspace, /`\$\{reimportDescriptionId\} \$\{importReasonId\}`/u);
// #1659: lorebook counts are whole sentences with their own plural forms, and the pane tab is a plain word.
assert.equal(locale["ui.longTermMemory.sourcesworkspace.entries"], undefined);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.entriesTab"], "Entries");
assert.equal(locale["ui.longTermMemory.sourcesworkspace.lorebookEntryCountOne"], "{{count}} entry");
assert.equal(locale["ui.longTermMemory.sourcesworkspace.lorebookEntryCountOther"], "{{count}} entries");
assert.doesNotMatch(workspace, /sourcesworkspace\.entries"/u);
assert.equal((workspace.match(/entryCountLabel\(/gu) ?? []).length, 2);
assert.match(workspace, /label: localizeUi\("ui\.longTermMemory\.sourcesworkspace\.entriesTab"\)/u);
// #1659: the blocking reason ends with a route to the destination, and the panel's own hint stays screen-reader only.
assert.equal(locale["ui.longTermMemory.sourcesworkspace.chooseDestinationAction"], "Choose destination");
assert.match(workspaceScreen, /<span role="status" className="sr-only" data-ltm-destination-hint>/u);
// #1659: controls locked by a running import stay focusable (aria-disabled plus an early return) and a status line says why.
assert.equal(locale["ui.longTermMemory.sourcesworkspace.lockedWhileImportRuns"], "Locked while an import runs");
assert.equal(locale["ui.longTermMemory.sourcesworkspace.lockedWhileReextractRuns"], "Locked while a re-extract runs");
// A running source task never feeds a native `disabled` on Sources controls; each carries the lock reason.
// Only the scope combobox still takes the prop on a button; it renders aria-disabled itself.
assert.equal(workspace.match(/(?<!aria-)disabled=\{activeSourceTask !== null\}/gu)?.length, 1);
assert.match(workspace, /\{\.\.\.lockedActionProps\(importRunning, importLockId\)\}[\s\S]{0,60}retry-re-extract/u);
assert.match(workspace, /lockReasonId=\{importLockId\}/u);
// Each locked Re-extract and Retry handler guards itself: Enter still fires onClick on an aria-disabled button.
assert.equal(workspace.match(/if \(reextractLocked\) return;/gu)?.length, 2);
assert.match(workspace, /if \(!reextractLocked\) void reextract\(item\.note\.id\)/u);
assert.match(workspace, /if \(!importRunning\)\s+void reextract\(\s*retryableReextract/u);
assert.match(workspace, /describedBy=\{importLockId\}/u);
assert.match(sourceScopeCombobox, /aria-describedby=\{disabled \? describedBy : undefined\}/u);
const sourceOperationWorkbench = readFileSync(
  join(dirname(ltmSourcePaths.sourcesWorkspace), "SourceOperationWorkbench.tsx"),
  "utf8",
);
assert.doesNotMatch(sourceOperationWorkbench, /(?<!aria-)disabled=\{\s*(?:disabled|busy)\b/u);
assert.equal(
  sourceOperationWorkbench.match(
    /\{\.\.\.lockedActionProps\(disabled \|\| busy !== null, disabled \? lockReasonId : undefined\)\}/gu,
  )?.length,
  2,
);
const importedSourceInspector = readFileSync(
  join(dirname(ltmSourcePaths.sourcesWorkspace), "ImportedSourceInspector.tsx"),
  "utf8",
);
assert.doesNotMatch(importedSourceInspector, /className=\{disabled \? "opacity-50" : ""\}/u);
assert.equal(importedSourceInspector.match(/lockedActionProps\(disabled, lockReasonId\)/gu)?.length, 2);
assert.doesNotMatch(availabilityTabRail, /\bdisabled=\{disabled\}/u);
assert.doesNotMatch(sourceScopeCombobox, /\bdisabled=\{disabled\}/u);
assert.match(availabilityTabRail, /aria-disabled=\{disabled \|\| undefined\}/u);
assert.match(sourceScopeCombobox, /aria-disabled=\{disabled \|\| undefined\}/u);
assert.match(sourceScopeCombobox, /const choose = \(id: string\) => \{\s+if \(disabled\) return;/u);
assert.match(workspaceScreen, /disabled=\{isLastSelected\}/u);
assert.match(workspaceScreen, /aria-disabled=\{availabilityDisabled \|\| disabled \|\| undefined\}/u);
assert.match(workspaceScreen, /aria-describedby=\{disabled \? `\$\{labelId\}-lock` : undefined\}/u);
assert.match(workspaceScreen, /if \(availabilityDisabled \|\| disabled\) return;/u);
assert.doesNotMatch(workspaceScreen, /disabled=\{availabilityDisabled \|\| isLastSelected\}/u);

// Results are read out from regions that stay mounted, so a result that mounts with its text is not missed.
assert.match(sharedControls, /export function LiveResult[\s\S]*<p role="status" className="sr-only">\s*\{text\}/u);
assert.match(
  sharedControls,
  /<StatusSurface tone=\{tone\} \{\.\.\.props\} role=\{undefined\} aria-live=\{undefined\}>/u,
);
assert.match(activity, /<LiveResult text=\{actionState\.text\} tone=\{actionState\.tone\} \/>/u);
assert.doesNotMatch(activity, /\{actionState\.text \? <StatusSurface/u);
assert.match(maintenance, /<LiveResult\s+text=\{messageState\.area === area \? messageState\.text : ""\}/u);
assert.doesNotMatch(maintenance, /messageState\.text && messageState\.area === area \?/u);
assert.match(
  sourceOperationWorkbench,
  /<p role="status" data-ltm-source-operation-preview-summary className=\{previewed \? "text-xs" : "sr-only"\}>/u,
);
assert.doesNotMatch(sourceOperationWorkbench, /<div data-ltm-source-operation-preview[^>]*>\s*<p role="status">/u);
// Counts use the package's One/Other pattern and the list join follows the locale; no hand-built plurals.
assert.doesNotMatch(maintenance, /\? "" : "s"/u);
assert.doesNotMatch(maintenance, /\.join\(" and "\)/u);
assert.doesNotMatch(maintenance, /replaceAll\("_", " "\)/u);
assert.match(maintenance, /new Intl\.ListFormat\(locale/u);
assert.match(maintenance, /labelKeys\.identityMatchBasis/u);
for (const key of [
  "applyIdentityRepairsActionOne",
  "applyIdentityRepairsActionOther",
  "selectedIdentityRepairsOne",
  "selectedIdentityRepairsOther",
  "includedDuplicateNotesOne",
  "includedDuplicateNotesOther",
  "basisBoundSubjects",
  "basisExactName",
  "basisUniqueAlias",
  "basisQualifiedAlias",
  "basisSpellingVariation",
  "basisUnorderedPair",
]) {
  assert.ok(locale[`ui.longTermMemory.memorysettings.${key}`], `${key} is in the catalog`);
}
assert.equal(locale["ui.longTermMemory.memorysettings.applyIdentityRepairsAction"], undefined);
assert.doesNotMatch(locale["ui.longTermMemory.memorysettings.applyIdentityRepairsDescription"], /Suffix/u);
// Add section says why a name was refused, on the field, and keeps focus there.
assert.match(
  vault,
  /const refuse = \(messageKey: string\) => \{[\s\S]*requestAnimationFrame\(\(\) => sectionInputRef\.current\?\.focus\(\)\)/u,
);
assert.match(vault, /refuse\("ui\.longTermMemory\.memoryvault\.detailNameNoLetters"\)/u);
assert.match(vault, /refuse\("ui\.longTermMemory\.memoryvault\.detailNameAlreadyExists"\)/u);
assert.match(
  vault,
  /aria-describedby=\{\s*sectionError \? "ltm-new-section-error ltm-new-section-key" : "ltm-new-section-key"/u,
);
assert.match(vault, /<span id="ltm-new-section-error"/u);

assert.doesNotMatch(detail, /#000\b/u);
assert.match(
  detail,
  /\[data-ltm-activation-knob\] \{[^}]*box-shadow: 0 1px 2px var\(--marinara-editor-border-strong\);/u,
);
assert.match(detail, /Measured on the status panel[^\n]*at least 10\.0:1 light, 9\.1:1 dark/u);

// Every spinner and pulsing placeholder in the feature stops under reduced motion; the workspace rule only shortens
// the loop, so one outside it (navigation, detail header, loading rows) would still move without its own class.
const spinnerFiles = readdirSync(ltmClientRoot, { recursive: true }).filter((name) => /\.tsx$/u.test(String(name)));
assert.ok(spinnerFiles.length > 10, "spinner scan found the feature sources");
for (const name of spinnerFiles) {
  const lines = readFileSync(join(ltmClientRoot, String(name)), "utf8").split("\n");
  lines.forEach((line, index) => {
    if (/animate-(?:spin|pulse)/u.test(line)) {
      assert.match(
        line,
        /motion-reduce:animate-none/u,
        `${name}:${index + 1} spinner or placeholder needs motion-reduce:animate-none`,
      );
    }
  });
}

// Debug search filters up to 1,000 events, so typing must not block on the filter.
assert.match(activity, /const deferredSearch = useDeferredValue\(search\);/u);
assert.match(activity, /const query = deferredSearch\.trim\(\)/u);

// The Korean catalog mirrors English: same keys, same {{placeholders}}, no blank text, and it is registered.
const koLocale = JSON.parse(readFileSync(ltmSourcePaths.localeKo));
const catalogKeys = (catalog) => Object.keys(catalog).filter((key) => key !== "_meta");
const placeholders = (text) => [...text.matchAll(/\{\{[A-Za-z0-9_]+\}\}/gu)].map((match) => match[0]).sort();
assert.equal(koLocale._meta?.locale, "ko");
assert.deepEqual(catalogKeys(koLocale), catalogKeys(locale), "ko.json keys must equal en.json keys, in order");
for (const key of catalogKeys(locale)) {
  assert.equal(typeof koLocale[key], "string", `${key} needs Korean text`);
  assert.ok(koLocale[key].trim(), `${key} Korean text is blank`);
  assert.deepEqual(placeholders(koLocale[key]), placeholders(locale[key]), `${key} placeholders differ from en`);
}
// The add-detail placeholder must be a name the A-Z/digit key rule accepts, and discard is never labeled delete.
for (const name of koLocale["ui.longTermMemory.memoryvault.detailNameExample"].replace(/^[^:]*:/u, "").split(",")) {
  assert.ok(/[a-z0-9]/iu.test(name), `detailNameExample name "${name.trim()}" has no A-Z or digit for the stored key`);
}
assert.ok(
  !koLocale["ui.longTermMemory.memoryvault.discardAndContinue"].includes("삭제"),
  "discardAndContinue must not read as delete",
);
const localization = readFileSync(ltmSourcePaths.localization, "utf8");
assert.match(localization, /import koreanCatalog from "\.\/locales\/ko\.json"/u);
assert.match(localization, /ko: stringEntries\(koreanCatalog\)/u);

process.stdout.write(
  "Long-Term Memory feedback clarity UI regression: labels, outcomes, usage, warnings, defaults, and scope loading ok\n",
);
