import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspaceSource = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/SpatialMapWorkspace.tsx",
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
const builtClient = readFileSync(new URL("../packages/hierarchical-maps/client.js", import.meta.url), "utf8");

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
assert.doesNotMatch(packageBuilderSource, /spatialTransitionReviewMessages\[data\.code\]/u);
assert.doesNotMatch(
  packageBuilderSource,
  /spatial\.currentLocationId === pending\.transition\.destinationId/u,
);
assert.doesNotMatch(runtimeBarSource, /data\.currentLocationId === pending\.transition\.destinationId/u);
assert.match(
  mapJsonSource,
  /const trimmed = raw\.trimStart\(\);[\s\S]*?!trimmed\.startsWith\("\{"\)/u,
  "Map truncation detection must only inspect responses that begin with a JSON object.",
);
const templateRouteStart = routeSource.indexOf('app.post("/spatial-context/templates/generate"');
const templateRouteEnd = routeSource.indexOf('app.post<{ Params: ChatSpatialParams }>("/:chatId/spatial-context/generate"');
assert.ok(templateRouteStart >= 0, "Template route marker is missing.");
assert.ok(templateRouteEnd > templateRouteStart, "Chat route marker must follow the template route.");
const templateGenerateSource = routeSource.slice(
  templateRouteStart,
  templateRouteEnd,
);
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

console.log(
  "World Maps UI contract regression passed: linked-lore/export ownership, portable-lore choices, normalized refresh, and JSON repair parity.",
);
