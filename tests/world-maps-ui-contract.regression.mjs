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
const browserRegressionSource = readFileSync(new URL("./spatial-context.e2e.ts", import.meta.url), "utf8");
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
assert.match(builtClient, /zIndex:105/u, "The built World Maps client must include the export overlay z-index.");
assert.match(
  builtClient,
  /Open the linked lorebook and discard them\?/u,
  "The built World Maps client must include guarded linked-lore navigation.",
);

console.log("World Maps UI contract regression passed: linked-lore navigation and export overlay ownership.");
