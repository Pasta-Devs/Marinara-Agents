import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localCanvas = await readFile(
  resolve(
    repoRoot,
    "packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/components/LocalMapCanvas.tsx",
  ),
  "utf8",
);
const runtimeCanvas = await readFile(
  resolve(repoRoot, "packages/hierarchical-maps/src/engine/packages/client/src/components/game/GameWorldMap.tsx"),
  "utf8",
);
const packageBuilder = await readFile(resolve(repoRoot, "scripts/build-feature-packages.mjs"), "utf8");

assert.match(localCanvas, /aspect-\[16\/9\] w-full/u, "Editor canvas must keep the canonical 16:9 projection");
assert.match(runtimeCanvas, /aspect-\[16\/9\] w-full/u, "Runtime canvas must keep the canonical 16:9 projection");
assert.match(localCanvas, /h-full w-full object-cover/u, "Editor background must use the shared cover projection");
assert.match(runtimeCanvas, /h-full w-full object-cover/u, "Runtime background must use the shared cover projection");
assert.doesNotMatch(localCanvas, /min-h-\[22rem\]/u, "Editor height must not change the saved coordinate projection");
assert.doesNotMatch(runtimeCanvas, /function displayCoordinate/u, "Runtime must not apply a private safe-area clamp");
assert.doesNotMatch(
  runtimeCanvas,
  /compact \? "h-56" : "h-52"/u,
  "Runtime must not use a different fixed canvas shape",
);
assert.match(
  packageBuilder,
  /\[data-marinara-maps-world-canvas\] \{\s*aspect-ratio: 16 \/ 9;\s*height: auto;\s*width: 100%;\s*\}/u,
  "Generated package CSS must preserve the runtime canvas aspect ratio",
);
assert.match(
  packageBuilder,
  /\[data-marinara-maps-workspace-overlay\] \[data-marinara-maps-editor-canvas\] \{\s*aspect-ratio: 16 \/ 9;\s*height: auto;\s*width: 100%;\s*\}/u,
  "Generated package CSS must preserve the editor canvas aspect ratio",
);

console.info("World Maps editor and runtime share one canonical 16:9 coordinate projection.");
