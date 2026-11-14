import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
const picker = readFileSync(ltmSourcePaths.picker, "utf8");
const reviewQueue = readFileSync(ltmSourcePaths.reviewQueue, "utf8");
const displayLabels = readFileSync(join(dirname(ltmSourcePaths.reviewQueue), "../display-labels.ts"), "utf8");
const reviewQueueScreen = readScreen(ltmSourcePaths.reviewQueue);
const api = readFileSync(ltmSourcePaths.api, "utf8");
const workspaceLayout = readFileSync(ltmSourcePaths.workspaceLayout, "utf8");
const sharedControls = readFileSync(ltmSourcePaths.sharedControls, "utf8");
const types = readFileSync(ltmSourcePaths.types, "utf8");
const locale = JSON.parse(readFileSync(ltmSourcePaths.locale));
const routes = readFileSync(ltmSourcePaths.routes, "utf8");
const maintenance = readFileSync(ltmSourcePaths.troubleshooting, "utf8");
const fixBar = readFileSync(ltmSourcePaths.fixBar, "utf8");
const identityRepair = readFileSync(ltmSourcePaths.identityRepairItem, "utf8");

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
assert.match(navigation, /item\.id === "sources" && activeSourceTask \? \(\s*<Spinner /u);
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
// soup/shell-phone: a phone also gets the visible status line above the bar.
assert.match(
  navigation,
  /sourceTaskLabel && mobile \? \([\s\S]*data-ltm-source-task-status-visual[\s\S]*aria-hidden="true"/u,
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
  /<div\s+id="ltm-destination-scope-control"\s+role="group"\s+aria-labelledby=\{labelId\}\s+data-ltm-import-bar\s+className="z-10 flex min-h-0 flex-col gap-2 border-t border-\[var\(--border\)\] bg-\[var\(--card\)\] p-3"\s*>/u,
);
// #1420: the destination place list is the shared availability rail.
assert.match(workspaceScreen, /<AvailabilityTabRail[\s\S]*disabled=\{disabled\}[\s\S]*onToggle=\{toggleRail\}/u);
assert.doesNotMatch(workspaceScreen, /ltm-bulk-destination-list|data-ltm-availability-action/u);
assert.match(workspaceScreen, /<details\s+data-ltm-destination-scope[^>]*className="group min-h-0 gap-3"[^>]*>/u);
assert.match(workspaceScreen, /data-ltm-destination-scope-summary/u);
assert.doesNotMatch(
  workspace,
  /<StatusSurface busy>\s*<Loader2 aria-hidden="true" size="0\.875rem" className="animate-spin" \/>/u,
);
assert.doesNotMatch(navigation, /sourceTaskCount/u);
assert.doesNotMatch(workspace, /savingAndExtracting/u);
assert.equal(
  (workspace.match(/data-ltm-source-task-count/gu) ?? []).length,
  1,
  "the one column's progress panel owns the single source count",
);
// soup/sources-navigator: both source lists use the one navigator bar; its controls and "Load more" exist once.
assert.equal((workspace.match(/<SourceNavigatorBar\b/gu) ?? []).length, 2, "the lorebook and flat lists share one bar");
assert.equal((workspaceScreen.match(/data-ltm-source-search/gu) ?? []).length, 1, "one search input, in the bar");
assert.equal((workspaceScreen.match(/data-ltm-source-status-filter=/gu) ?? []).length, 1, "one status tab set");
assert.equal((workspaceScreen.match(/data-ltm-source-action="load-more"/gu) ?? []).length, 1, "one Load more");
assert.equal((workspace.match(/<SourceLoadMore\b/gu) ?? []).length, 2, "Load more sits under each list");
assert.doesNotMatch(workspace, /data-ltm-source-action="cancel-import"|data-ltm-lorebook-action="cancel-import"/u);
// soup/sources-result: the outcome leads, Open Review is the primary action and the diagnostics collapse.
assert.match(workspace, /data-ltm-import-result-outcome/u);
assert.match(
  workspace,
  /primary=\{!retryableIds\.length\}\s+onClick=\{\(\) => onOpenReview\?\.\(\)\}\s+data-ltm-source-action="review-imported-drafts"/u,
);
assert.match(
  workspace,
  /<details\s+data-ltm-import-result-details\s+open=\{!importCleanlyWaitingInReview \|\| undefined\}/u,
);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.reviewProposedMemories"], undefined);
assert.equal(locale["ui.longTermMemory.longtermmemorydetail.openReviewQueue"], "Open Review");
assert.match(workspace, /importResult\.batchStatus === "success"/u, "an incomplete extraction is not a clean import");
assert.equal(
  locale["ui.longTermMemory.sourcesworkspace.importDoneInReviewOther"],
  "Done: {{count}} memories are waiting in Review.",
);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.sourceCountOther"], "{{count}} sources");
assert.doesNotMatch(
  workspace,
  /latestSourceTask\.sourceCount\} · /u,
  "Last import shows a counted noun, not a bare number",
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
// Slurp's switches are asked about when the Sharing switch turns on, and a yes is applied only after the global PUT
// succeeded and only when Slurp's row still has that switch on.
const globalSave = settings.slice(settings.indexOf("const saveSettings"), settings.indexOf("const discard"));
assert.doesNotMatch(globalSave, /askSlurpMemories\(|confirm\(/u, "Save never asks about Slurp");
assert.match(globalSave, /slurpAfter = saved\.longTermMemoryPackageAccess\.slurp2/u);
assert.ok(
  globalSave.indexOf('"PUT"') < globalSave.indexOf("slurpAfter = saved.longTermMemoryPackageAccess") &&
    globalSave.indexOf("slurpAfter = saved.longTermMemoryPackageAccess") <
      globalSave.indexOf("slurpAccepted.current.delete(setting)") &&
    globalSave.indexOf("slurpAccepted.current.delete(setting)") < globalSave.indexOf('"PATCH"'),
  "a remembered Slurp yes must follow the global PUT",
);
assert.match(globalSave, /setting === "flavourFromAgents" \? slurpAfter\?\.read : slurpAfter\?\.add/u);
assert.equal(settings.match(/askSlurpMemories\(/gu)?.length, 1);
assert.match(settings, /if \(event\.target\.checked\) void askSlurp\("flavourFromAgents"\)/u);
assert.match(settings, /if \(event\.target\.checked\) void askSlurp\("shareWithMemory"\)/u);
const discardBody = settings.slice(settings.indexOf("const discard"), settings.indexOf("const resetSettings"));
assert.match(discardBody, /forgetSlurp\(\)/u, "Discard drops a remembered Slurp yes");
assert.match(
  settings,
  /slurpEpoch\.current\[setting\] === epoch\) slurpAccepted\.current\.add\(setting\)/u,
  "an answer to an older question is not remembered",
);
assert.match(settings, /memorySettingsSavedIndexRebuilt/u);
assert.match(settings, /memorySettingsSavedIndexRebuildFailed/u);
assert.match(settingsScreen, /memorySettingsResetIndexRebuildFailed/u);
assert.match(settings, /rebuild\?\.status === "deferred"/u);
// The Debug tab is gone, so every save shows in the one shared surface.
assert.doesNotMatch(settings, /messageState\.surface|surface: "shared" \| "debug"/u);
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
  "Memory settings saved, but the reindex failed: {{error}}",
);
assert.equal(
  locale["ui.longTermMemory.memorysettings.memorySettingsResetIndexRebuildFailed"],
  "Memory settings reset to defaults, but the reindex failed: {{error}}",
);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.syncSelected_8c57bdb"], undefined);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.refreshSelectedSources"], "Refresh selected sources");
assert.equal(locale["ui.longTermMemory.activityview.totalTokens"], "Total: {{count}} tokens");
// #1210 / item 9: the switch gates recall explanations only (extraction/apply logging is separate), lives on the
// Activity page, saves on its own, and says it applies from the next reply.
assert.equal(locale["ui.longTermMemory.activityview.recordRecallExplanations"], "Record recall explanations");
assert.match(locale["ui.longTermMemory.activityview.recordRecallExplanationsHint"], /from the next reply/u);
assert.equal(locale["ui.longTermMemory.memorysettings.recordDebugActivity"], undefined);
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
assert.match(sharedControls, /lastModeRequired/u);
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
assert.equal(locale["ui.longTermMemory.memoryvault.chooseWhereUsed"], "Choose where available");
assert.equal(locale["ui.longTermMemory.memoryvault.saveAvailability"], "Save availability");
assert.equal(locale["ui.longTermMemory.memoryvault.addMemoryTo"], "Add this memory to:");
assert.equal(locale["ui.longTermMemory.memoryvault.availableIn"], "Available in");
assert.equal(
  locale["ui.longTermMemory.memoryvault.modesEligibilityHelp"],
  "Chat types allowed to recall these memories; the places below narrow it further.",
);
assert.equal(locale["ui.longTermMemory.memoryvault.bulkAddMemoriesTo"], "Add selected memories to:");
assert.match(locale["ui.longTermMemory.memoryvault.bulkAvailabilityHelp"], /keeps its chat scope/u);
// soup/: a consequence is a visible one-line hint at its control; the popover keeps one background sentence.
assert.equal(locale["ui.longTermMemory.sourcesworkspace.importDetailDetailedHint"], "About twice as many AI calls.");
for (const [key, text] of Object.entries(locale)) {
  if (key.startsWith("ui.longTermMemory.") && /Help$/u.test(key) && typeof text === "string") {
    assert.ok(text.length <= 190, `${key} is a short help (${text.length} characters)`);
  }
}
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
assert.ok(vault.indexOf("scopeTargets.isError") < vault.indexOf("noMemoriesYet"));
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
assert.match(vault, /placeHidesMemories/u);
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
assert.match(vault, /<ModeCheckboxes[\s\S]*data-ltm-mode-filter/u);
assert.doesNotMatch(vault, /toggleFilterMode/u);
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
assert.doesNotMatch(picker, /AvailabilityTabRail/u);
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
assert.match(workspaceScreen, /nextTabIndex\(event\.key/u);
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
assert.equal(locale["ui.longTermMemory.memoryvault.nameThisDetail"], "Name the section");
assert.equal(locale["ui.longTermMemory.memoryvault.createNewMemoryDetail"], "Add new memory section");
assert.equal(locale["ui.longTermMemory.memoryvault.memoryTypeValue"], "Memory type: {{type}}");
assert.equal(locale["ui.longTermMemory.memoryvault.currentlyViewingMemoriesIn"], "Currently viewing memories in:");
assert.equal(locale["ui.longTermMemory.memoryvault.combineWithPlace"], "Also in:");
assert.equal(locale["ui.longTermMemory.memoryvault.noSecondPlace"], "No second place");
assert.equal(locale["ui.longTermMemory.memoryvault.combinedScope"], "{{first}} AND {{second}}");
assert.equal(
  locale["ui.longTermMemory.memoryvault.placeHidesMemories"],
  "Nothing is available in {{value1}}, but you have {{value2}} saved elsewhere.",
);
assert.equal(locale["ui.longTermMemory.memoryvault.noMemoriesInCombinedScope"], undefined);
assert.equal(locale["ui.longTermMemory.memoryvault.noMemoriesFound"], undefined);
assert.equal(locale["ui.longTermMemory.memoryvault.searchCharacters"], "Search characters");
assert.equal(locale["ui.longTermMemory.memoryvault.searchChats"], "Search chats");
assert.equal(locale["ui.longTermMemory.memoryvault.searchBranches"], undefined);
assert.equal(locale["ui.longTermMemory.memoryvault.showMemories"], "Show");
assert.equal(locale["ui.longTermMemory.memoryvault.sortBy"], "Sort by");
assert.equal(locale["ui.longTermMemory.memoryvault.editSelected"], "Edit selected…");
assert.equal(locale["ui.longTermMemory.memoryvault.refine"], "Filters");
assert.equal(locale["ui.longTermMemory.memoryvault.changeAvailability"], undefined);
// The Filters toggle is a button (so the Select and Sources chips can share its line); its panel holds the status and
// sort selects, then the second place and the chat-type filter.
assert.match(
  vault,
  /<button\s+type="button"\s+data-ltm-refine\s+data-ltm-tab-focus\s+aria-expanded=\{refineOpen\}\s+aria-controls=\{refineOpen \? "ltm-vault-filters" : undefined\}/u,
);
assert.match(
  vault,
  /<div id="ltm-vault-filters" data-ltm-refine-panel[\s\S]*?memoryvault\.showMemories[\s\S]*?memoryvault\.sortBy[\s\S]*?data-ltm-memory-scope-secondary[\s\S]*?data-ltm-mode-filter/u,
);
assert.doesNotMatch(vault, /<details\s+data-ltm-refine/u);
// Back up and Restore sit behind the header's "⋯" toggle, not in the controls section.
assert.match(vault, /data-ltm-vault-more\b/u);
assert.match(vault, /id="ltm-vault-more-menu" data-ltm-vault-more-menu/u);
assert.doesNotMatch(vault, /<div className="col-span-2 flex flex-wrap items-center gap-2">\{backup\.buttons\}<\/div>/u);
assert.equal(locale["ui.longTermMemory.memoryvault.moreVaultActions"], "More vault actions");
assert.match(vault, /useEffect\(\(\) => \{\s*if \(refineActive\) setRefineOpen\(true\);/u);
// The closed Filters summary names a non-default status or sort, but only a second place or mode filter opens it.
assert.match(vault, /const refineActive = Boolean\(secondaryTarget\) \|\| filterModes\.length < modes\.length;/u);
assert.match(vault, /statusFilter !== "all" \? statusLabel\(statusFilter\)/u);
assert.match(vault, /sort !== "updated"\s*\?\s*localizeUi\("ui\.longTermMemory\.memoryvault\.refineActiveSort"/u);
assert.equal(locale["ui.longTermMemory.memoryvault.refineActiveSort"], "Sort: {{value1}}");
// Rows: no chip for the place being viewed (every place when viewing all), a preview label only for a search match,
// bullet markers stripped, and no "About …" line when the title names every subject as whole words.
assert.match(vault, /\[target\?\.id, secondaryTarget\?\.id\]\.filter\(\(id\) => id && id !== "all"\)/u);
assert.match(vault, /label: query \? formatNoteTypeLabel\(key, localizeUi\) : undefined/u);
assert.match(vault, /function plainPreviewText\(text: string\)/u);
assert.match(vault, /Whole words only[\s\S]{0,200}\[\^\\\\p\{L\}\\\\p\{N\}\]/u);
assert.doesNotMatch(vaultRow, /formatNoteTypeLabel/u);
assert.equal(locale["ui.longTermMemory.memoryvault.bulkChangeGroup"], undefined);

assert.match(detail, /TriangleAlert/u);
assert.doesNotMatch(detail, /CircleAlert/u);
assert.match(
  detail,
  /\[data-ltm-tab-focus\]:focus-visible \{\s*outline: 2px solid var\(--marinara-editor-focus-ring\);/u,
);
for (const rail of [navigation, settings, availabilityTabRail]) assert.match(rail, /data-ltm-tab-focus/u);
// The Vault and Sources place-picker rails were cut into their own files; read each one alone so
// the shared picker or another sibling cannot satisfy the match.
assert.match(sourceScopeCombobox, /function SourceScopeCombobox[\s\S]*data-ltm-tab-focus/u);
assert.match(detail, /paddingBottom: "var\(--mari-safe-area-inset-bottom, env\(safe-area-inset-bottom\)\)"/u);
// The prompt-template editor lost its separate select, so it no longer needs a 12rem label column.
assert.doesNotMatch(settings, /\[data-ltm-prompt-template-grid\] \{\s*grid-template-columns: 12rem/u);
// #1673: the panel's width decides these, so a narrow panel on a wide window keeps the compact layout.
assert.doesNotMatch(settings, /sm:grid-cols-4/u);
assert.match(settings, /\[data-ltm-settings-tab-rail\] \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u);
assert.equal((settings.match(/<div data-ltm-recall-grid>/gu) ?? []).length, 4);
assert.match(settings, /\[data-ltm-recall-grid\] \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u);
assert.doesNotMatch(detail, /sm:min-h-9|sm:min-w-0|hidden sm:inline|md:flex/u);
assert.match(detail, /\[data-ltm-add-label\],\s*\[data-ltm-no-chat-label\] \{\s*display: inline;/u);
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
// Setup is a fixed-size dialog with a 1x sprite, so it needs no window or container breakpoint.
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
const promptTemplates = readFileSync(
  join(dirname(ltmSourcePaths.detail), "settings", "ExtractionPromptTemplates.tsx"),
  "utf8",
);
assert.doesNotMatch(promptTemplates, /sm:grid-cols-3/u);
assert.match(promptTemplates, /<div\s+data-ltm-active-template-grid\s+className="grid gap-3"\s*>/u);
assert.match(settings, /\[data-ltm-active-template-grid\] \{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/u);
// #1673: the last raw text-style buttons meet the 2.75rem floor instead of a ~20px target.
assert.match(
  fixBar,
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
// The per-mode "Reset to default" text buttons are gone: the template dropdown lists the default.
assert.doesNotMatch(settingsScreen, /setActive\(mode, null\)/u);
assert.doesNotMatch(settingsScreen, /className="(?:text-\[0\.6875rem\] )?underline"/u);
// soup/shell-health: an empty, unbuilt vault shows no health pill.
assert.match(detail, /health !== "healthy" && !emptyUnbuiltVault && !needsHealthAttention/u);
assert.match(detail, /howToRepairVaultHealth[\s\S]*compact/u);
assert.match(detail, /tone=\{healthNeedsDangerTone \? "danger" : "warning"\}/u);
assert.match(vault, /data-ltm-detail-conflict/u);
assert.equal(locale["ui.longTermMemory.memoryvault.memoryDetails"], "Memory info");
assert.equal(locale["ui.longTermMemory.memoryvault.keywordsAndLinks"], "Keywords and links");
for (const key of ["memoryInfo", "memoryOptions", "showMemoryInfo", "hideMemoryInfo"]) {
  assert.equal(`ui.longTermMemory.memoryvault.${key}` in locale, false, `${key} is replaced by one pane name`);
}
assert.equal(locale["ui.longTermMemory.memoryvault.renameDetails"], "Rename sections");
assert.equal(locale["ui.longTermMemory.memoryvault.previewRename"], "Preview rename");
assert.equal(locale["ui.longTermMemory.memoryvault.openDebugLog"], "View activity");
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
assert.match(vault, /confirm\(props, confirmationTitle, confirmationMessage, confirmationLabel, true\)/u);
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
  /hasFilterableNotes \? \([\s\S]*filteredEmptyDescription[\s\S]*filteredEmptyFilters[\s\S]*onClick=\{clearNavigatorFilters\}[\s\S]*\)\s*:\s*\([\s\S]*noMemoriesYet[\s\S]*showAllMemories[\s\S]*\)/u,
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
assert.match(vault, /<Chip data-ltm-accent-border>/u);
// One Chip, RemovableChip and DefaultChip serve every chip; no screen keeps its own copy of their classes (Whole UI PR 13).
assert.match(sharedControls, /export function Chip\(/u);
assert.match(sharedControls, /export function RemovableChip\(/u);
assert.match(sharedControls, /export function DefaultChip\(/u);
assert.equal(existsSync(join(ltmClientRoot, "vault/Pill.tsx")), false, "the Pill copy is gone");
for (const [name, source] of Object.entries({ reviewQueue, vault, vaultRow, workspace, activity })) {
  assert.doesNotMatch(source, /rounded-full border[^"`]*px-(1\.5|2) py-(0\.5|1)/u, `${name} draws chips with Chip`);
  assert.doesNotMatch(
    source,
    /rounded border border-\[var\(--border\)\][^"`]*px-1\.5 py-0\.5/u,
    `${name} draws chips with Chip`,
  );
}
assert.doesNotMatch(
  readFileSync(join(ltmClientRoot, "ChatSettings.tsx"), "utf8"),
  /rounded border[^"`]*px-1\.5 py-0\.5/u,
);
assert.match(reviewQueue, /<Chip data-ltm-review-type=/u);
assert.match(sharedControls, /inline-flex min-h-11 max-w-full[\s\S]*h-11 w-11/u);
assert.match(vault, /clearMemorySearch[\s\S]*h-11 w-11/u);
assert.match(sharedControls, /function ModeCheckboxes[\s\S]*min-h-11/u);
assert.match(vaultScreen, /memoryvault\.chatModes[\s\S]*min-h-11/u);
assert.match(vault, /data-ltm-note-inspector/u);
assert.match(vault, /mari-editor-panel min-w-0 space-y-4 p-3/u);
assert.match(vault, /copyDiagnostics/u);
assert.match(vault, /navigatorStates/u);
assert.match(vault, /scrollTop/u);
assert.match(vault, /overflowY: "auto"/u);
assert.match(vault, /<UnsavedChangesDialog[\s\S]*onDecision=\{finishUnsavedDecision\}/u);
assert.match(vault, /aria-invalid=\{!draft\.title\?\.trim\(\)\}/u);
assert.match(vault, /maxHeight: "16rem"/u);
assert.match(vault, /onInput=\{\(event\) =>/u);
assert.match(sharedControls, /aria-live="polite"/u);
assert.match(picker, /<button[\s\S]*type="button"/u);
assert.match(sourceScopeCombobox, /aria-controls=\{listId\}/u);
// One picker row and one set of keys serve every picker (#soup shared picker).
assert.match(picker, /role="combobox"[\s\S]*aria-activedescendant/u);
assert.match(picker, /ArrowDown[\s\S]*ArrowUp[\s\S]*Enter[\s\S]*Escape/u);
assert.match(sourceScopeCombobox, /pickerRowClass/u);
assert.match(availabilityTabRail, /pickerRowClass/u);
assert.match(vault, /<SearchPicker[\s\S]*testId="subject"/u);
assert.match(vault, /<SearchPicker[\s\S]*testId="link"/u);
assert.doesNotMatch(vault, /<datalist|TargetPicker/u);
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
assert.match(detail, /busy=\{navigationSaveInFlight\}/u);
assert.match(sharedControls, /lockedActionProps\(busy\)/u);
// Detail locks go through the shared helper; no hand-built aria-disabled literal is left.
assert.match(detail, /<Button \{\.\.\.lockedActionProps\(repairPending\)\}/u);
assert.doesNotMatch(detail, /"aria-disabled": true/u);
assert.match(detail, /finishNavigationPrompt\(decision\)/u);
assert.match(sharedControls, /aria-modal="true"/u);
assert.match(sharedControls, /event\.key !== "Tab"/u);

// Pending controls keep keyboard focus: aria-disabled plus a ref guard, with native `disabled`
// kept only for permanent unavailability.
const chatSettings = readFileSync(join(dirname(ltmSourcePaths.detail), "ChatSettings.tsx"), "utf8");
const activityCard = readFileSync(join(dirname(ltmSourcePaths.detail), "ActivityCard.tsx"), "utf8");
assert.match(detail, /activationBusyRef\.current\) return false;/u);
assert.match(detail, /repairBusyRef\.current\) return;/u);
assert.doesNotMatch(detail, /data-ltm-control="activation"/u, "the Engine header switch is the one per-chat on/off");
assert.doesNotMatch(detail, /(?<!aria-)disabled=\{activationPending/u);
assert.doesNotMatch(detail, /(?<!aria-)disabled=\{repairPending/u);
assert.match(chatSettings, /pendingRef\.current\) return;/u);
assert.match(chatSettings, /disabled=\{readOnly\}\s+aria-disabled=\{pending \|\| undefined\}/u);
assert.equal(chatSettings.match(/busy=\{pending\}/gu)?.length, 1);
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
assert.equal("ui.longTermMemory.chatsettings.openLongTermMemory" in locale, false);
assert.doesNotMatch(chatSettings, /chatsettings\.openLongTermMemory"/u);
// Item 2 of the activity card: it is the first thing in the drawer's section, and Open reaches the Vault.
assert.match(chatSettings, /className="space-y-1\.5">\s*\{\/\* D27[\s\S]*?<ActivityCardView/u);
// The card and its Open button are one component shared with the Agent activity panel.
assert.match(activityCard, /onOpenVault=/u);
// The inherited budget is unknown until the global defaults arrive, then falls back to the schema default.
assert.match(chatSettings, /settings\.longTermMemoryBudgetTokens == null && !defaults\s+\? null/u);
assert.match(
  chatSettings,
  /defaults\?\.longTermMemoryBudgetTokens \?\? DEFAULT_LTM_GLOBAL_SETTINGS\.longTermMemoryBudgetTokens/u,
);
assert.match(chatSettings, /placeholder=\{effectiveBudget === null \? unknownValueLabel : undefined\}/u);
assert.doesNotMatch(chatSettings, /effectiveMaxChunks|maxChunksField|maxChunksInherited/u, "the count field is gone");
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
// "What model to use?" sits in the extraction connection field, under its select, and opens the shared modal (Esc,
// focus trap, focus return); each score's number is its spoken text, the stars are hidden from screen readers.
const whatModel = readFileSync(join(ltmClientRoot, "settings/WhatModelDialog.tsx"), "utf8");
assert.match(
  settings,
  /<Field[^>]*data-ltm-connection-field[\s\S]*?label=\{localizeUi\("ui\.longTermMemory\.memorysettings\.extractionConnection"\)\}[\s\S]*?<\/select>\s*<div className="flex flex-wrap items-center gap-2">\s*<WhatModelButton \/>/u,
);
assert.match(whatModel, /<ModalDialog[\s\S]*initialFocus="\[data-ltm-what-model-close\]"/u);
assert.match(whatModel, /<span aria-hidden="true"[^>]*>\s*\{scoreStars\(score\)\}/u);
// Hosted and self-hosted models sit on two tabs (arrow keys move between them); self-hosted cards score quality only,
// because their speed and cost depend on the person's setup.
for (const role of ["tablist", "tab", "tabpanel"]) assert.match(whatModel, new RegExp(`role="${role}"`, "u"));
assert.match(whatModel, /nextTabIndex\(event\.key, index, TABS\.length\)/u);
assert.doesNotMatch(
  whatModel.slice(whatModel.indexOf("const SELF_HOST:"), whatModel.indexOf("const SELF_HOST_OTHERS")),
  /speed:|price:/u,
);
assert.match(
  whatModel,
  /className="sr-only">\{localizeUi\("ui\.longTermMemory\.memorysettings\.whatModelScore", \{ score \}\)\}/u,
);
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
// #1714: the container, not the window, sizes the detail header; setup draws one 1x sprite with no window swap.
const onboardingSource = readFileSync(join(ltmClientRoot, "Onboarding.tsx"), "utf8");
assert.doesNotMatch(onboardingSource, /<picture|<source/u);
assert.match(onboardingSource, /<SetupSprite\b/u);
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
// The apply summary is an Engine toast (a warning when any memory failed); only the per-memory list waits for a result.
assert.match(workspaceScreen, /import \{ toast \} from "sonner";/u);
assert.match(
  workspaceScreen,
  /if \(applied\.failed\.length\) toast\.warning\(summary, \{ duration: 12_000 \}\);\s+else toast\.success\(summary\);/u,
);
assert.match(
  workspaceScreen,
  /toast\.error\(errorMessage\(error, localizeUi\("ui\.longTermMemory\.sourceoperation\.couldNotApply"\)\)\)/u,
);
assert.match(workspaceScreen, /\{result \? \(\s*<div data-ltm-source-operation-result=\{operation\}/u);
assert.doesNotMatch(workspaceScreen, /<LiveResult/u);
assert.match(workspaceScreen, /data-ltm-source-mode/u);
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
assert.match(
  workspace,
  /"aria-describedby": importRunning \? `\$\{importLockId\} \$\{destinationReasonId\}` : destinationReasonId/u,
);
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
assert.match(reviewQueue, /editChangeForTitle/u);
assert.match(reviewQueue, /data-ltm-review-edit/u);
assert.match(reviewQueue, /applyChangeForTitle/u);
assert.match(reviewQueueScreen, /noteById\.get\(mutation\.link\.target\)\?\.title/u);
assert.match(reviewQueue, /data-ltm-review-summary/u);
assert.match(reviewQueue, /data-ltm-review-evidence-summary/u);
assert.match(reviewQueue, /confirmDiscard/u);
assert.match(reviewQueue, /discardDependentWarning/u);
assert.match(reviewQueue, /reviewQueueEmpty/u);
assert.match(reviewQueue, /className=\{workspaceUnavailable \|\| reviewDataUnavailable \? "hidden" : ""\}/u);
assert.equal(locale["ui.longTermMemory.reviewqueue.retryFailed"], "Retry failed actions");
assert.equal(locale["ui.longTermMemory.reviewqueue.editChangeForTitle"], "Edit {{title}}");
assert.equal(locale["ui.longTermMemory.reviewqueue.applyChangeForTitle"], "Add {{title}} to memory");
// #1654 / soup: one "Add to memory" press (no Check step), "changes" not "mutations", and a plain sentence for the engine's codes.
assert.match(reviewQueue, /data-ltm-review-action-text/u);
assert.doesNotMatch(reviewQueue, /data-ltm-review-state-chip/u);
assert.match(reviewQueue, /data-ltm-review-add-effect/u);
assert.match(reviewQueue, /reviewCodeText\(blocker\.code/u);
assert.equal(locale["ui.longTermMemory.reviewqueue.missingSourceTitle"], "Deleted source");
assert.equal(locale["ui.longTermMemory.reviewqueue.preflightReady"], "Ready to add");
assert.equal(locale["ui.longTermMemory.reviewqueue.mutationActions"], "Change actions");
assert.equal(locale["ui.longTermMemory.reviewqueue.rowEdit"], "Edit");
assert.equal(locale["ui.longTermMemory.reviewqueue.rowApply"], "Add to memory");
assert.equal(locale["ui.longTermMemory.reviewqueue.acceptEligibleValue1"], "Add selected ({{value1}})");
assert.equal(locale["ui.longTermMemory.reviewqueue.rowCheck"], undefined);
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
// Deleting a chat source with kept memories says that branches stop sharing them.
assert.match(
  locale["ui.longTermMemory.sourceoperation.deleteBranchSharing"],
  /^Kept memories stay, but branches of this chat may no longer share them\.$/u,
);
assert.match(
  workspaceScreen,
  /operation === "delete" && sharedWithBranches && excludedMemories\.length \?[\s\S]*?sourceoperation\.deleteBranchSharing/u,
);
assert.match(workspace, /sharedWithBranches=\{groupChats\.length > 1\}/u);

// #1212: the Long-Term Memory card surfaces package-observed recall outcomes (a newer unconfirmed/failed/skipped
// attempt must override an older confirmed receipt rather than present the stale injection as the latest result) and
// the recall workflow marks whether that attempt was confirmed.
assert.match(lastInjectionSummary, /export function attemptOverrides/u);
assert.match(
  lastInjectionSummary,
  /attempt\.outcome === "cancelled" \|\| attempt\.outcome === "failed" \|\| attempt\.outcome === "skipped"/u,
);
assert.match(lastInjectionSummary, /attemptOverrides\(data\?\.attempt \?\? null\)/u);
assert.match(lastInjectionSummary, /const memories = !notUsed && data \? data\.memories : \[\];/u);
// Part 1 says one of three plain things; the retired summary pieces stay gone.
for (const key of ["usedOne", "usedOther", "noneUsed", "noneUsedAvailable", "notUsedThisReply"]) {
  assert.match(lastInjectionSummary, new RegExp(`lastinjectionsummary\\.${key}"`, "u"));
  assert.equal(typeof locale[`ui.longTermMemory.lastinjectionsummary.${key}`], "string");
}
assert.match(locale["ui.longTermMemory.lastinjectionsummary.usedOther"], /^Used \{\{count\}\} memories$/u);
assert.equal(locale["ui.longTermMemory.lastinjectionsummary.notUsedThisReply"], "Memory wasn't used this reply");
assert.doesNotMatch(lastInjectionSummary, /tokenCount|recalledAt|detailsTurnOn|<details/u);
// Part 2 is one problem line with its one button; the two old warning boxes no longer live in ChatSettings.
assert.match(lastInjectionSummary, /pickCardProblem\(/u);
for (const attr of ["data-ltm-card-problem", "data-ltm-connection-warning", "data-ltm-auto-import-failed"])
  assert.match(lastInjectionSummary, new RegExp(attr, "u"));
assert.doesNotMatch(chatSettings, /<StatusSurface[^>]*data-ltm-(connection-warning|auto-import-failed)/u);
assert.match(chatSettings, /onRaiseLimit=\{readOnly \? undefined : raiseLimit\}/u);
assert.match(chatSettings, /ref=\{budgetField\}/u);
assert.match(chatSettings, /ltmRecallBudgetMemories\(effectiveBudget, status\.data\?\.indexes\.averageMemoryTokens\)/u);
for (const [key, text] of [
  ["saveFailed", "Couldn't save new memories"],
  ["saveFailedCause", "Couldn't save new memories ({{cause}})"],
  ["notSaving", "Not saving new memories"],
  ["leftOutOther", "{{count}} more left out to fit the limit"],
  ["raiseLimit", "Raise limit"],
])
  assert.equal(locale[`ui.longTermMemory.lastinjectionsummary.${key}`], text);
// Part 3 says what was saved, each line only when true; the drawer keeps only the manual line.
for (const [key, text] of [
  ["toReviewOne", "{{count}} memory to review"],
  ["toReviewOther", "{{count}} memories to review"],
  ["savedNewOne", "Saved {{count}} new memory"],
  ["savedNewOther", "Saved {{count}} new memories"],
  ["savedNewView", "View"],
  ["hiddenRange", "Messages {{from}}–{{to}} saved as memories and hidden"],
  ["hiddenOne", "Message {{from}} saved as a memory and hidden"],
  ["reading", "Reading new messages…"],
])
  assert.equal(locale[`ui.longTermMemory.lastinjectionsummary.${key}`], text);
for (const attr of ["review", "new", "hidden", "reading"])
  assert.match(lastInjectionSummary, new RegExp(`data-ltm-card-saved="${attr}"`, "u"));
// The poll lives with the card state both places share, not in the drawer.
assert.match(activityCard, /refetchInterval: \(\) => \(importOnRef\.current \? refreshMs : false\)/u);
assert.match(activityCard, /refreshMs: CARD_REFRESH_MS/u);
// The icon's signal adds no poll: the surface mount passes refreshMs false and reads the toast's 10 s poll.
assert.match(activityCard, /useActivityCore\(props, \{ refreshMs: false, watchReads: true \}\)/u);
assert.doesNotMatch(chatSettings, /CARD_REFRESH_MS/u);
assert.doesNotMatch(chatSettings, /mode=\{effectiveChatMemories\}/u, "the live counts left the drawer for the card");
for (const key of [
  "autoImportSavedTodayOne",
  "autoImportSavedTodayOther",
  "autoImportWaitingOne",
  "autoImportWaitingOther",
  "autoImportEmpty",
])
  assert.equal(locale[`ui.longTermMemory.chatsettings.${key}`], undefined, `${key} is retired`);
for (const key of ["autoImportNeedsConnection", "autoImportChooseConnection", "autoImportFailed"])
  assert.equal(locale[`ui.longTermMemory.chatsettings.${key}`], undefined, `${key} is retired`);
// PR 2 (#1259): the separate latest-recall panel, its correlation, and its
// injection-confirmation line were replaced by the selected recall operation's
// details pane; those ActivityView keys and the `data-ltm-recall-confirmation`
// contract no longer exist.

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
assert.equal(locale["ui.longTermMemory.activityview.settingSemanticMatching"], "Meaning match");
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
assert.equal(locale["ui.longTermMemory.activityview.settingEmbeddedChunks"], "Embedded memory text");
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
assert.equal((identityRepair.match(/queryKeys\.localCharactersRoot/g) ?? []).length, 1);
// One lock helper serves every run-time lock; `Button` and `IconButton` dim on `aria-disabled` themselves, so a
// caller no longer passes `opacity-50`. Running work (`busy`, `pending`) never feeds a native `disabled`,
// which would drop keyboard focus; only input validity does.
assert.match(sharedControls, /export function lockedActionProps\(locked: boolean, reasonId\?: string\)/u);
assert.equal((sharedControls.match(/props\["aria-disabled"\] \? "opacity-50"/gu) ?? []).length, 3);
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
// because the Engine toast's "Memory saved" announces it.
assert.match(vault, /saveState === "saved" \? <span aria-hidden="true">\{saveStatus\}<\/span> : saveStatus/u);
// A save clears the standing notice first, so a stale recovered-suggestion notice never outlives the save.
assert.match(vault, /setSaveState\("saving"\);\s+setError\(""\);\s+(?:\/\/[^\n]*\n\s*)*setNotice\(""\);/u);
assert.doesNotMatch(vault, /if \(!archiveUndo\) setNotice/u);
// An archive is an Engine toast with an Undo action that stays up long enough to use; the old inline caption is gone.
assert.match(vault, /import \{ toast \} from "sonner";/u);
assert.match(
  vault,
  /toast\.success\(message, \{\s+action: \{\s+label: localizeUi\("ui\.longTermMemory\.memoryvault\.undo"\),\s+onClick: \(event\) => \{[^}]*if \(undoLocked\(\)\) event\.preventDefault\(\);\s+else void undoArchive\(archiveUndoNotes\);\s+\},\s+\},\s+duration: 10_000,\s+\}\)/u,
);
assert.doesNotMatch(vault, /data-ltm-archive-undo-caption|\barchiveUndo\b/u);
assert.doesNotMatch(vault, /<LiveResult/u);
// A memory that is already global is blocked under its own reason, not under a last place it never had.
assert.match(vaultScreen, /alreadyEverywhere: removesLastPlace && !removesLastMode && places\.length === 0/u);
assert.match(locale["ui.longTermMemory.memoryvault.applyReasonNothingToChange"], /would be skipped/u);
assert.doesNotMatch(locale["ui.longTermMemory.memoryvault.applyReasonNothingToChange"], /last place/u);
assert.ok(locale["ui.longTermMemory.memoryvault.alreadyAvailableEverywhere"]);
assert.match(vault, /function warnRecallStale\(/u);
assert.match(vault, /toast\.warning\(\s+error\s+\? localizeUi\([\s\S]*?\{ duration: 12_000 \},?\s+\);/u);
assert.doesNotMatch(vault, /const setWarning = useCallback|noticeState\.warning/u);
assert.doesNotMatch(vault, /setError\(\s*localizeUi\("ui\.longTermMemory\.memoryvault\.savedButRecallIsStale"/u);
assert.equal(
  locale["ui.longTermMemory.memoryvault.savedButRecallIsStale"],
  "Saved. Recall will catch up once the reindex succeeds: {{error}}",
);
// An empty rebuild error picks the no-error key at both call sites, so the warning never ends in a bare colon.
assert.equal(
  locale["ui.longTermMemory.memoryvault.savedButRecallIsStaleNoError"],
  "Saved. Recall will catch up once the reindex succeeds.",
);
assert.doesNotMatch(locale["ui.longTermMemory.memoryvault.savedButRecallIsStaleNoError"], /\{\{|:\s*$/u);
assert.doesNotMatch(vault, /error: (?:response|result)\.rebuild\.error \?\? ""/u);
// One helper picks the key, so both call sites (save and detail edit) share the no-bare-colon rule.
assert.equal(vault.match(/"ui\.longTermMemory\.memoryvault\.savedButRecallIsStale", \{ error \}/gu)?.length, 1);
assert.equal(vault.match(/"ui\.longTermMemory\.memoryvault\.savedButRecallIsStaleNoError"/gu)?.length, 1);
assert.equal(vault.match(/warnRecallStale\(localizeUi, (?:response|result)\.rebuild\.error\)/gu)?.length, 2);
// #1636: the open row uses the documented primary wash plus a start-edge bar and aria-current, not an accent tint.
assert.match(vaultRow, /selected \? "bg-\[var\(--primary\)\]\/10" : ""/u);
assert.doesNotMatch(vaultRow, /bg-\[var\(--accent\)\]\/50/u);
assert.match(vaultRow, /\{selected \? \(\s*<span\s+aria-hidden="true"\s+data-ltm-note-open-bar/u);
assert.match(vaultRow, /aria-current=\{selected \? "true" : undefined\}/u);
// #1659: the source write and the list reload no longer share a name. The write says what it overwrites, and its
// description joins the destination reason instead of replacing it.
assert.equal(locale["ui.longTermMemory.sourcesworkspace.reimportFromSource"], "Refresh from source");
assert.equal(locale["ui.longTermMemory.sourcesworkspace.reloadList"], "Reload list");
assert.match(locale["ui.longTermMemory.sourcesworkspace.reimportFromSourceDescription"], /Replaces the imported text/u);
assert.match(workspace, /data-ltm-source-action="refresh"[\s\S]{0,200}sourcesworkspace\.reimportFromSource"/u);
assert.equal(
  (workspaceScreen.match(/data-ltm-source-action="refresh-preview"/gu) ?? []).length,
  1,
  "one Reload, in the bar",
);
assert.match(workspace, /<p id=\{reimportDescriptionId\}/u);
assert.equal((workspaceScreen.match(/sourcesworkspace\.reloadList"/gu) ?? []).length, 1);
assert.match(workspace, /`\$\{reimportDescriptionId\} \$\{destinationReasonId\}`/u);
// #1659: lorebook counts are whole sentences with their own plural forms; Sources has no pane tabs any more.
assert.equal(locale["ui.longTermMemory.sourcesworkspace.entries"], undefined);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.entriesTab"], undefined);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.lorebookEntryCountOne"], "{{count}} entry");
assert.equal(locale["ui.longTermMemory.sourcesworkspace.lorebookEntryCountOther"], "{{count}} entries");
assert.doesNotMatch(workspace, /sourcesworkspace\.entries"/u);
assert.equal((workspace.match(/entryCountLabel\(/gu) ?? []).length, 2);
assert.doesNotMatch(workspace, /sourcesworkspace\.entriesTab/u);
// soup/sources-review: one bar holds Import, the destination chip and one hint; the reason waiting buttons point at is the
// bar's screen-reader-only status, with no warning sentence and no second link.
assert.equal(locale["ui.longTermMemory.sourcesworkspace.chooseDestinationAction"], undefined);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.thisChat"], "This chat");
assert.equal(locale["ui.longTermMemory.sourcesworkspace.chooseDestinationShort"], "Choose");
assert.match(workspaceScreen, /<span id=\{reasonId\} role="status" className="sr-only" data-ltm-destination-hint>/u);
assert.doesNotMatch(workspace, /data-ltm-choose-destination|data-ltm-import-reason/u);
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
assert.match(sourceScopeCombobox, /aria-describedby=\{\[hintId, disabled \? describedBy : undefined\]/u);
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
// The destination panel's chat-mode group is the shared ModeCheckboxes (#soup shared picker).
assert.match(sharedControls, /disabled=\{isLast\}/u);
assert.match(sharedControls, /aria-disabled=\{disabled \|\| undefined\}/u);
assert.match(sharedControls, /onChange=\{\(\) => \{\s+if \(disabled\) return;/u);
assert.match(workspaceScreen, /<ModeCheckboxes[\s\S]*disabled=\{availabilityDisabled \|\| disabled\}/u);
assert.match(workspaceScreen, /describedBy=\{disabled \? `\$\{labelId\}-lock` : undefined\}/u);
assert.doesNotMatch(workspaceScreen, /disabled=\{availabilityDisabled \|\| isLastSelected\}/u);

// Finished actions and their retryable failures are Engine toasts (the host's one Toaster announces and dismisses
// them), not result banners that stay on screen; the package mounts no Toaster of its own.
assert.doesNotMatch(sharedControls, /LiveResult/u);
for (const [name, source] of Object.entries({ activity, maintenance, settings, vault, reviewQueue, workspaceScreen })) {
  assert.match(source, /import \{ toast \} from "sonner";/u, `${name} must raise its results as Engine toasts`);
  assert.doesNotMatch(source, /<LiveResult/u, `${name} must not render the removed LiveResult mirror`);
}
assert.doesNotMatch(activity, /\{actionState\.text \? <StatusSurface/u);
assert.doesNotMatch(maintenance, /messageState\.text && messageState\.area === area \?/u);
for (const [name, source] of Object.entries({ vault, maintenance, settings, activity })) {
  assert.doesNotMatch(source, /<Toaster|data-sonner-toaster/u, `${name} must not mount or style a Toaster`);
}
assert.match(
  sourceOperationWorkbench,
  /<p role="status" data-ltm-source-operation-preview-summary className=\{previewed \? "text-xs" : "sr-only"\}>/u,
);
assert.doesNotMatch(sourceOperationWorkbench, /<div data-ltm-source-operation-preview[^>]*>\s*<p role="status">/u);
// Counts use the package's One/Other pattern and the list join follows the locale; no hand-built plurals.
assert.doesNotMatch(identityRepair, /\? "" : "s"/u);
assert.doesNotMatch(identityRepair, /\.join\(" and "\)/u);
assert.doesNotMatch(identityRepair, /replaceAll\("_", " "\)/u);
assert.match(identityRepair, /new Intl\.ListFormat\(locale/u);
assert.match(identityRepair, /labelKeys\.identityMatchBasis/u);
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
assert.doesNotMatch(detail, /data-ltm-activation-(?:knob|track)/u, "the activation switch is a chip now");
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

// NumberField rounds before it shows or reports a value (a typed 3.4 at size 3 must not leave "3.4" in the field).
assert.match(sharedControls, /integer\?: boolean;/u);
const clampSource = sharedControls.match(/const clamped = (.+);/u)?.[1] ?? "";
assert.match(
  clampSource,
  /integer \? Math\.round\(next\) : next/u,
  "NumberField rounds before it stores and shows the value",
);
const commitBody = sharedControls.slice(
  sharedControls.indexOf("const clamped ="),
  sharedControls.indexOf("useEffect(() => {\n    setText(valueText)"),
);
assert.ok(
  commitBody.indexOf("setText(String(clamped))") > 0 && commitBody.includes("onChange(clamped)"),
  "NumberField shows and reports the same clamped value",
);
const clampOf = (next, size, integer) => {
  const clamped = new Function("min", "max", "next", "integer", `return ${clampSource};`)(1, 100, next, integer);
  return { shown: String(clamped), changed: String(clamped) !== String(size), clamped };
};
const stay = clampOf(3.4, 3, true);
assert.equal(stay.shown, "3", "typing 3.4 at size 3 shows 3");
assert.equal(stay.changed, false, "no state change is needed for the field to read 3");
const halfUp = clampOf(2.5, 10, true);
assert.equal(halfUp.shown, "3", "typing 2.5 from 10 shows 3");
assert.ok(Number.isInteger(halfUp.clamped), "the request limit is a whole number");
assert.equal(clampOf(2.5, 10, false).shown, "2.5", "other NumberFields keep decimals");

// Issue #1974: the settings schema's `.int()` fields must round a typed decimal like the batch size does;
// the score threshold, the four recall weights and the temperature stay decimal.
const numberFieldOf = (source, value) =>
  source.match(
    new RegExp(`<NumberField(?:(?!<NumberField)[\\s\\S])*?value=\\{${value.replace(".", "\\.")}\\}[\\s\\S]*?/>`, "u"),
  )?.[0] ?? "";
for (const [source, values] of [
  [
    settings,
    [
      "globalForm.longTermMemoryBudgetTokens",
      "globalForm.longTermMemoryRecallContextMessages",
      "extractionFormState.maxOutputTokens",
      "extractionFormState.maxSourceTokens",
    ],
  ],
  [chatSettings, ["effectiveBudget"]],
]) {
  for (const value of values) {
    assert.match(numberFieldOf(source, value), /^\s*integer$/mu, `${value} rounds a typed decimal`);
  }
}
// The score threshold and the four recall weights are sliders (decimal steps), the temperature a number field.
const sliderFieldOf = (source, value) =>
  source.match(
    new RegExp(`<SliderField(?:(?!<SliderField)[\\s\\S])*?value=\\{${value.replace(".", "\\.")}\\}[\\s\\S]*?/>`, "u"),
  )?.[0] ?? "";
for (const value of [
  "globalForm.longTermMemoryScoreThreshold",
  "globalForm.longTermMemorySemanticWeight",
  "globalForm.longTermMemoryLexicalWeight",
  "globalForm.longTermMemoryGraphWeight",
  "globalForm.longTermMemoryKeywordWeight",
]) {
  const field = sliderFieldOf(settings, value);
  assert.ok(field.includes(`value={${value}}`), `${value} field found`);
  assert.doesNotMatch(field, /^\s*integer$/mu, `${value} keeps decimals`);
}
{
  const field = numberFieldOf(settings, "extractionFormState.temperature");
  assert.ok(field.includes("value={extractionFormState.temperature}"), "temperature field found");
  assert.doesNotMatch(field, /^\s*integer$/mu, "temperature keeps decimals");
}

// A memory another package or Advanced Memory added says so in the Vault list and editor header.
assert.match(vaultRow, /originLabel\?: string/u, "VaultRow takes a plain origin label");
assert.match(vaultRow, /originLabel \? <Chip>\{originLabel\}<\/Chip>/u, "VaultRow renders the origin chip");
assert.match(vault, /function originLabelKey\(/u, "the vault derives the origin from the note");
assert.match(
  vault,
  /function originLabelKey\([\s\S]*?link\.relation === "extracted_from"[\s\S]*?source\?\.type === "source"/u,
  "a memory takes its origin from its extracted_from source note",
);
assert.match(vault, /package_record: "ui\.longTermMemory\.memoryvault\.originSlurp"/u, "Slurp provenance has a label");
assert.match(
  vault,
  /advanced_memory: "ui\.longTermMemory\.memoryvault\.originAdvancedMemory"/u,
  "Advanced Memory provenance has a label",
);
assert.match(
  vault,
  /originLabel=\{originKey \? localizeUi\(originKey\) : undefined\}/u,
  "rows get the localized label as a string",
);
assert.equal(
  (vault.match(/data-ltm-origin-chip/gu) ?? []).length,
  2,
  "the source and regular editor headers show the chip",
);
assert.equal(locale["ui.longTermMemory.memoryvault.originSlurp"], "Slurp");
assert.equal(locale["ui.longTermMemory.memoryvault.originAdvancedMemory"], "Advanced Memory");

// soup/confirm: one confirm and one unsaved-changes dialog live in shared-controls; no caller keeps its own copy.
const settingsShared = readFileSync(join(dirname(ltmSourcePaths.settings), "settings-shared.tsx"), "utf8");
assert.match(sharedControls, /export async function confirm\(/u);
assert.match(sharedControls, /export function UnsavedChangesDialog\(/u);
assert.match(sharedControls, /onCancel=\{\(event\) => \{\s*event\.preventDefault\(\);\s*onCancel\(\);/u);
assert.match(sharedControls, /opener\.focus\(/u);
assert.doesNotMatch(settingsShared, /confirm/u);
const clientRoot = join(dirname(ltmSourcePaths.reviewQueue), "..");
const clientSources = (folder) =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? clientSources(join(folder, entry.name))
      : /\.tsx?$/u.test(entry.name)
        ? [join(folder, entry.name)]
        : [],
  );
for (const file of clientSources(clientRoot)) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /window\.confirm/u, `${file} asks through the shared confirm`);
  assert.doesNotMatch(source, /ltm-(?:destination-)?unsaved-title/u, `${file} has no private unsaved-changes dialog`);
}

process.stdout.write(
  "Long-Term Memory feedback clarity UI regression: labels, outcomes, usage, warnings, defaults, and scope loading ok\n",
);
