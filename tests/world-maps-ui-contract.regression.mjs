import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspaceSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/SpatialMapWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const librarySource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/SpatialMapLibrary.tsx",
    import.meta.url,
  ),
  "utf8",
);
const inspectorSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/components/LocationInspector.tsx",
    import.meta.url,
  ),
  "utf8",
);
const editorStateSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/editor-state.ts",
    import.meta.url,
  ),
  "utf8",
);
const portableLoreDialogSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/components/PortableLoreImportDialog.tsx",
    import.meta.url,
  ),
  "utf8",
);
const portableLoreSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/portable-lore.ts",
    import.meta.url,
  ),
  "utf8",
);
const mapJsonSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/server/src/services/spatial-context/map-json-response.ts",
    import.meta.url,
  ),
  "utf8",
);
const routeSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/server/src/routes/spatial-context.routes.ts",
    import.meta.url,
  ),
  "utf8",
);
const browserRegressionSource = readFileSync(new URL("./spatial-context.e2e.ts", import.meta.url), "utf8");
const packageBuilderSource = readFileSync(new URL("../scripts/build-feature-packages.mjs", import.meta.url), "utf8");
const runtimeBarSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/components/SpatialContextRuntimeBar.tsx",
    import.meta.url,
  ),
  "utf8",
);
const aiBuilderSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/components/SpatialMapAiBuilder.tsx",
    import.meta.url,
  ),
  "utf8",
);
const connectionSelectorSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/components/SpatialConnectionOverrideSelect.tsx",
    import.meta.url,
  ),
  "utf8",
);
const mapsLocalizationSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/localization.tsx",
    import.meta.url,
  ),
  "utf8",
);
const mapsEnglishCatalog = JSON.parse(
  readFileSync(
    new URL(
      "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/locales/en.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const aiDraftSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/server/src/services/spatial-context/ai-draft.ts",
    import.meta.url,
  ),
  "utf8",
);
const builtClient = readFileSync(new URL("../packages/hierarchical-maps/client.js", import.meta.url), "utf8");
const builtServer = readFileSync(new URL("../packages/hierarchical-maps/server.mjs", import.meta.url), "utf8");

assert.match(runtimeBarSource, /travelMode/u, "Runtime location controls must persist the selected travel mode.");
assert.match(runtimeBarSource, /Step by step/u, "Runtime location controls must expose step-by-step travel.");
assert.match(runtimeBarSource, /Travel now/u, "Runtime location controls must expose immediate travel.");
assert.match(
  runtimeBarSource,
  /pendingRoute\?\.steps\[0\]\?\.locationName/u,
  "Step-by-step status must derive the next stop from the current route.",
);
assert.match(
  runtimeBarSource,
  /ui\.worldMaps\.runtime\.nextStop[\s\S]*?nextStopName/u,
  "Step-by-step status must render the next stop beneath the route mode.",
);
assert.equal(mapsEnglishCatalog["ui.worldMaps.runtime.nextStop"], "Next stop");
assert.match(
  runtimeBarSource,
  /\{enabled && mapAvailable && \(\s*<div data-marinara-maps-runtime-mobile\b[^>]*>/u,
  "The mobile story-map trigger must remain available while a step-by-step move is pending.",
);
assert.doesNotMatch(
  runtimeBarSource,
  /\{!pending && enabled && mapAvailable && \(\s*<div data-marinara-maps-runtime-mobile\b[^>]*>/u,
  "A queued move must not suppress the mobile story-map trigger.",
);
assert.doesNotMatch(
  runtimeBarSource,
  /Set destination/u,
  "Runtime location controls must replace the legacy destination-only action.",
);
assert.match(builtClient, /Step by step/u, "The built client must include the travel-mode control.");
assert.match(builtClient, /Travel now/u, "The built client must include the immediate-travel control.");
assert.match(builtClient, /Next stop/u, "The built client must include the step-by-step next-stop label.");
assert.match(
  aiBuilderSource,
  /aria-pressed=\{targetLocationCount === option\.targetLocationCount\}[\s\S]*?Custom place target/u,
  "Every AI map-size screen must expose the editable custom place target alongside the presets.",
);
assert.match(
  aiBuilderSource,
  /targetLocationCount,\s*instructions/u,
  "The custom place target must be carried in every AI builder request.",
);
assert.match(
  aiDraftSource,
  /resolveSpatialDraftSizeSpec/u,
  "The server must resolve custom targets through the existing size tiers.",
);
assert.match(
  aiDraftSource,
  /SPATIAL_CUSTOM_TARGET_LOCATION_LIMIT/u,
  "Custom targets must retain a bounded one-call generation ceiling.",
);
assert.match(builtClient, /Custom place target/u, "The built client must include the editable expansion target.");
assert.match(builtServer, /targetLocationCount/u, "The built server must accept and apply the expansion target.");
assert.match(
  aiBuilderSource,
  /useUpdateSpatialAgentConfiguration[\s\S]*?connectionId: nextConnectionId \|\| null/u,
  "The in-editor selector must save through the existing World Maps connection override.",
);
assert.match(
  aiBuilderSource,
  /generationPending \|\| updateAgentConfiguration\.isPending \|\| requestInvalid/u,
  "Generation must wait for an in-editor connection change to finish saving.",
);
assert.match(
  connectionSelectorSource,
  /provider !== "image_generation" && connection\.provider !== "video_generation"/u,
  "The shared selector must list only text-generation connections.",
);
assert.match(
  connectionSelectorSource,
  /ui\.worldMaps\.connection\.savedUnavailable/u,
  "Unavailable saved connections must remain visible through localized UI copy.",
);
assert.match(
  mapsLocalizationSource,
  /englishCatalog[\s\S]*?SpatialMapLocalizationProvider/u,
  "World Maps editor copy must use its package-local localization provider.",
);
assert.match(builtClient, /AI connection/u, "The built client must include the in-editor connection selector.");
assert.match(
  browserRegressionSource,
  /World Maps editor changes the AI connection without losing the draft[\s\S]*?combobox", \{ name: "AI map connection" \}[\s\S]*?toHaveValue\(unavailableConnectionId\)[\s\S]*?selectOption\(editorConnection\.id\)[\s\S]*?toHaveValue\("Keep the harbor districts compact\."\)[\s\S]*?homeConnectionOverride\)\.toHaveValue\(editorConnection\.id\)/u,
  "The browser regression must verify unavailable, persisted, draft-preserving, and home-synchronized editor connection states.",
);
assert.match(
  workspaceSource,
  /onOpenTemplates\(\{ startOver: true \}\)/u,
  "Replace/start over must carry replacement intent into the map library.",
);
assert.match(
  workspaceSource,
  /setReplaceMapOpen\(false\);\s*pendingStartOverImportRef\.current\s*=\s*true;\s*importInputRef\.current\?\.click\(\)/u,
  "Replace/start over imports must carry replacement intent into the file-import flow.",
);
assert.match(
  workspaceSource,
  /setMobileActionsOpen\(false\);\s*pendingStartOverImportRef\.current\s*=\s*false;\s*setStartOverPending\(false\);\s*importInputRef\.current\?\.click\(\)/u,
  "Ordinary map imports must clear any stale replacement intent.",
);
assert.match(
  librarySource,
  /startOverReplacement[\s\S]*?useStartOverSpatialContext/u,
  "The map library must retain replacement intent and use the history-breaking save contract.",
);
assert.match(
  librarySource,
  /if \(startOverReplacement\) \{[\s\S]*?breakHistoryContinuity: true/u,
  "Template and independent shared-world replacement must explicitly break history continuity.",
);

assert.match(
  workspaceSource,
  /const handleOpenLorebook = useCallback\([\s\S]*?onClose\(\);\s*onOpenLorebook\(lorebookId\);/u,
  "Opening linked lore must explicitly close the Maps workspace before handing navigation to the host.",
);
assert.match(
  inspectorSource,
  /onClick=\{\(\) => onOpenLorebook\(lorebook\.id\)\}[\s\S]*?>\s*Open\s*<\/button>/u,
  "The linked-lore action must retain its host navigation callback.",
);
assert.match(
  editorStateSource,
  /export function canonicalizeSpatialDirectLinks\([\s\S]*?oneWaySources\.size > 1/u,
  "Direct Links must canonicalize duplicate and reciprocal records by unordered endpoint pair.",
);
assert.match(
  editorStateSource,
  /export function setSpatialDirectLinkDirection\([\s\S]*?direction === "incoming"[\s\S]*?direction === "outgoing"[\s\S]*?direction === "both"/u,
  "Direction changes must rewrite one canonical relationship relative to the selected endpoint.",
);
assert.match(
  editorStateSource,
  /export function removeSpatialDirectLink\([\s\S]*?spatialDirectLinkPairKey\(location\.id, link\.targetId\) !== pairKey/u,
  "Removing a Direct Link must delete every persisted record for the endpoint pair.",
);
assert.match(
  inspectorSource,
  /canonicalizeSpatialDirectLinks\(definition\)[\s\S]*?const editable = direction !== "incoming"[\s\S]*?Incoming one-way[\s\S]*?View source/u,
  "Two-way links must remain editable from either endpoint while one-way targets expose source navigation.",
);
assert.match(
  inspectorSource,
  /aria-label=\{`Direction for \$\{relatedName\}`\}[\s\S]*?<option value="outgoing">Outgoing<\/option>[\s\S]*?<option value="both">Both ways<\/option>[\s\S]*?<option value="incoming">Incoming<\/option>/u,
  "Editable Direct Links must expose all three endpoint-relative directions.",
);
assert.match(
  inspectorSource,
  /const linkedLocationIds = useMemo\([\s\S]*?directLinkRows\.flatMap[\s\S]*?!linkedLocationIds\.has\(candidate\.id\)/u,
  "The Direct Link picker must exclude relationships already represented from either endpoint.",
);
assert.match(
  workspaceSource,
  /onUpdateDirectLink=\{[\s\S]*?updateSpatialDirectLink\(draft[\s\S]*?onSetDirectLinkDirection=\{[\s\S]*?setSpatialDirectLinkDirection\(draft[\s\S]*?onRemoveDirectLink=\{[\s\S]*?removeSpatialDirectLink\(draft/u,
  "The workspace must apply each pair-level Direct Link mutation as one draft update.",
);
assert.match(
  workspaceSource,
  /const canonicalDraft = canonicalizeSpatialDirectLinks\(draft\)[\s\S]*?definition: canonicalDraft[\s\S]*?const definitionToSave = completingFirstMap/u,
  "Export and save paths must persist canonical Direct Link relationships.",
);
assert.match(
  workspaceSource,
  /aria-label="Export portable world map"[\s\S]*?style=\{\{ zIndex: 105 \}\}/u,
  "The portable export overlay must carry an inline z-index that does not depend on host Tailwind scanning.",
);
assert.match(
  browserRegressionSource,
  /await expect\(workspace\)\.toHaveCount\(0\);[\s\S]*?name: lorebookName/u,
  "The browser suite must prove clean linked-lore navigation leaves the Maps workspace.",
);
assert.match(
  browserRegressionSource,
  /toHaveCSS\("z-index", "105"\)[\s\S]*?document\.elementFromPoint/u,
  "The browser suite must prove portable export owns the interaction layer.",
);
assert.match(
  portableLoreDialogSource,
  /\.filter\(\(entry\) => Boolean\(selections\[entry\.entryKey\]\)\)[\s\S]*?role="status"/u,
  "Portable-lore previews must omit unchosen ambiguity rows and announce recalculated outcomes.",
);
assert.match(
  portableLoreSource,
  /const nameStem = `[\s\S]*?fitNameSuffix\(nameStem, `\$\{worldMapSuffix\}\$\{copySuffix\}`\)/u,
  "Collision-safe lorebook names must preserve the World Map marker before the copy suffix.",
);
assert.match(
  portableLoreSource,
  /options\.ambiguousSelections\?\.has\(entry\.entryKey\)[\s\S]*?options\.ambiguousSelections\.get\(entry\.entryKey\) \?\? null/u,
  "Explicit import-a-new-copy choices must survive from preview through execution.",
);
assert.match(
  workspaceSource,
  /const serverHierarchyProfile = normalizeHierarchyProfile\(spatial\.data\.hierarchyProfile, nextDraft\);[\s\S]*?serverHierarchyProfile,[\s\S]*?setDraftHierarchyProfile\(serverHierarchyProfile\);/u,
  "Workspace refresh must compare and store one normalized server hierarchy profile.",
);
assert.match(packageBuilderSource, /spatialTransitionReviewMessages\.get\(data\.code\)/u);
assert.match(
  packageBuilderSource,
  /findSpatialRoute\(spatial\.definition, currentLocationId, targetLocationId\)[\s\S]*?remainingLocationIds: remainingRoute\.locationIds\.slice\(1\)/u,
  "A command-ID recovery event must rebase stepwise travel from authoritative spatial state.",
);
assert.match(
  routeSource,
  /"\/:chatId\/spatial-context\/turn\/:commandId"[\s\S]*?spatialSnapshots\.getByCommand/u,
  "Ambiguous failures must be recoverable by exact transition command ID.",
);
assert.doesNotMatch(packageBuilderSource, /spatialTransitionReviewMessages\[data\.code\]/u);
assert.doesNotMatch(packageBuilderSource, /spatial\.currentLocationId === pending\.transition\.destinationId/u);
assert.doesNotMatch(runtimeBarSource, /data\.currentLocationId === pending\.transition\.destinationId/u);
assert.match(
  mapJsonSource,
  /const trimmed = raw\.trimStart\(\);[\s\S]*?!trimmed\.startsWith\("\{"\)/u,
  "Map truncation detection must only inspect responses that begin with a JSON object.",
);
const templateRouteStart = routeSource.indexOf('app.post("/spatial-context/templates/generate"');
const templateRouteEnd = routeSource.indexOf(
  'app.post<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/generate"',
);
assert.ok(templateRouteStart >= 0, "Template route marker is missing.");
assert.ok(templateRouteEnd > templateRouteStart, "Chat route marker must follow the template route.");
const templateGenerateSource = routeSource.slice(templateRouteStart, templateRouteEnd);
assert.match(
  templateGenerateSource,
  /parseSpatialMapJsonWithRepair\([\s\S]*?repair: spatialMapJsonRepairRequest\([\s\S]*?spatialMapJsonErrorPayload/u,
  "Template generation must use the same repair-aware JSON parsing and diagnostics as chat map generation.",
);
assert.match(
  routeSource,
  /function spatialMapJsonRepairRequest\([\s\S]*?buildSpatialMapJsonRepairMessages\(malformedRaw\)[\s\S]*?temperature: 0/u,
  "Map-generation routes must share one bounded formatting-repair callback.",
);
assert.match(builtClient, /zIndex:105/u, "The built World Maps client must include the export overlay z-index.");
assert.match(
  builtClient,
  /Open the linked lorebook and discard them\?/u,
  "The built World Maps client must include guarded linked-lore navigation.",
);
assert.match(builtClient, /Incoming one-way/u, "The built World Maps client must expose incoming Direct Links.");
assert.match(
  browserRegressionSource,
  /reciprocal and incoming Direct Links stay visible from either endpoint/u,
  "The browser suite must cover reciprocal editing, unlinking, and incoming source navigation.",
);

console.log(
  "World Maps UI contract regression passed: Direct Link endpoint parity, linked-lore/export ownership, portable-lore choices, normalized refresh, and JSON repair parity.",
);
