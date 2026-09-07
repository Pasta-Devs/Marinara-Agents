// Build the Pixelforge package: concatenate its plain-JS client modules into a
// single self-contained client.js, regenerate its deterministic Tier-1 art,
// stamp manifest/agents/locales, write a reproducible artifact zip, and update
// the catalog family. Pixelforge is client-only (no server entrypoint), so it
// is built here rather than by build-agent-catalog.mjs (agents-only packages)
// or build-feature-packages.mjs (server-bearing features).
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildArt } from "../packages/pixelforge/build/build-art.mjs";
import { catalogArtworkUrl } from "./catalog-artwork.mjs";
import { readCatalogFamily, writeCatalogFamily } from "./catalog-lanes.mjs";
import { withPackageActivationGuidance } from "./catalog-package-guidance.mjs";
import { readPackageEngineBoundary } from "./package-engine-boundary.mjs";
import { writeEnglishPackageLocale } from "./package-locales.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repoRoot, "packages/pixelforge");
const artifactsDir = join(repoRoot, "artifacts");

const VERSION = "0.16.0";
const CAPABILITY_API = Object.freeze({ major: 1, minor: 10 });
const ENGINE_MIN = "2.4.3"; // first Engine release with contributions.assets (capability API 1.10)
const MAX_ENGINE_EXCLUSIVE = "4.0.0";
const BASE_DESCRIPTION =
  "A walkable pixel-art RPG Experience for Game Mode: your setup preferences generate the world — a cozy village or a sci-fi colony — then explore it, talk to NPCs to drive the story, and let the GM narrate, with World Maps integration and the engine's own combat.";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const boundary = await readPackageEngineBoundary({
  boundaryPath: join(packageRoot, "engine-boundary.json"),
  displayName: "Pixelforge",
  capabilityApi: CAPABILITY_API,
});

// ── Client bundle: src/*.js in filename order, wrapped in one strict IIFE ────
const srcDir = join(packageRoot, "src");
const parts = (await readdir(srcDir)).filter((name) => name.endsWith(".js")).sort();
if (parts.length === 0) throw new Error("Pixelforge has no client source modules");
const banner =
  `// Pixelforge ${VERSION} — Marinara Engine game-surface Experience (single-file client bundle)\n` +
  `// Built from packages/pixelforge/src (${parts.length} modules) by scripts/build-pixelforge-package.mjs. Do not edit; edit src/ and rebuild.\n`;
const body = [];
for (const part of parts) {
  body.push(`// ===== ${part} =====\n${await readFile(join(srcDir, part), "utf8")}`);
}
const clientBuffer = Buffer.from(`${banner}(() => {\n"use strict";\n${body.join("\n")}\n})();\n`, "utf8");

const syntaxCheckDir = await mkdtemp(join(tmpdir(), "pixelforge-syntax-"));
try {
  const syntaxCheckPath = join(syntaxCheckDir, "client.check.mjs");
  await writeFile(syntaxCheckPath, clientBuffer);
  const checked = spawnSync(process.execPath, ["--check", syntaxCheckPath], { encoding: "utf8" });
  if (checked.status !== 0) {
    throw new Error(checked.stderr || checked.stdout || "Pixelforge client bundle failed the syntax check");
  }
} finally {
  await rm(syntaxCheckDir, { recursive: true, force: true });
}

// ── Tier-1 art: deterministic PNG/JSON assets copied to the package root ─────
const art = buildArt();
for (const assetPath of art.files) {
  if (assetPath.includes("..") || assetPath.startsWith("/")) {
    throw new Error(`Unsafe Pixelforge asset path: ${assetPath}`);
  }
  const destination = join(packageRoot, assetPath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(art.dir, assetPath), destination);
}

// ── Agent definition stub: satisfies the catalog loader; runtime-inert ───────
const description = withPackageActivationGuidance("pixelforge", BASE_DESCRIPTION);
const agentDefinition = {
  id: "pixelforge",
  name: "Pixelforge",
  description,
  author: "Pasta Devs",
  phase: "pre_generation",
  enabledByDefault: false,
  category: "misc",
  runtimeDisabled: true,
  libraryHidden: true,
  modeAllowlist: ["game"],
  defaultTools: [],
  defaultSettings: {},
  defaultPromptTemplate: "",
  execution: "feature",
};
const agentsBuffer = Buffer.from(`${JSON.stringify([agentDefinition], null, 2)}\n`);

// ── Declared assets, second source: the GM verb table ────────────────────────
// The first non-art asset the package ships. `gm-verbs.json` is the closed list
// of Game Master verbs the Engine may act on for Pixelforge (capability API
// 1.16, Engine #5798): the Engine reads it off the installed package BY THIS
// EXACT FILENAME, so the name is the Engine's to choose and not ours, and the
// literal is pinned here rather than derived from a glob.
//
// It is hand-authored and checked in at the package root, so unlike every asset
// above it, nothing generates it — which is the whole reason the asset list
// stops being `art.files` and becomes two sources joined. Both sources then
// flow through one payload loop, so the manifest, the zip and the pairing lint
// below cannot learn about an asset one at a time.
//
// Parsed, not schema-checked. A table that is not JSON degrades at the Engine
// to a warn and an empty verb list — silent to the player and the packager
// both — and catching that here costs one parse. The SHAPE is validated against
// the Engine's own `gmVerbTableSchema`, which lives in the Engine repo; a
// second copy of those rules maintained here would be a copy free to drift.
const GM_VERB_TABLE_PATH = "gm-verbs.json";
try {
  JSON.parse(await readFile(join(packageRoot, GM_VERB_TABLE_PATH), "utf8"));
} catch (error) {
  throw new Error(`Pixelforge ${GM_VERB_TABLE_PATH} is not valid JSON: ${error.message}`);
}
const declaredAssetPaths = [...art.files, GM_VERB_TABLE_PATH];

const assetPayloads = [];
for (const assetPath of declaredAssetPaths) {
  assetPayloads.push({ path: assetPath, buffer: await readFile(join(packageRoot, assetPath)) });
}

const manifest = {
  schemaVersion: 2,
  capabilityApi: boundary.capabilityApi,
  builtAgainst: boundary.builtAgainst,
  id: "pixelforge",
  name: "Pixelforge",
  version: VERSION,
  description,
  engine: { min: ENGINE_MIN, maxExclusive: MAX_ENGINE_EXCLUSIVE },
  kind: ["agent"],
  entrypoints: { agents: "agents.json", client: "client.js" },
  contributions: {
    slots: ["game-surface"],
    gameSurface: { surfaceClass: "pixelforge-surface" },
    assets: { paths: declaredAssetPaths },
  },
  files: [
    { path: "agents.json", sha256: sha256(agentsBuffer), bytes: agentsBuffer.byteLength },
    { path: "client.js", sha256: sha256(clientBuffer), bytes: clientBuffer.byteLength },
    ...assetPayloads.map((asset) => ({
      path: asset.path,
      sha256: sha256(asset.buffer),
      bytes: asset.buffer.byteLength,
    })),
  ],
  // Pixelforge reads chat context and persists its world state through the
  // Engine's same-origin chat APIs. These permissions disclose that existing
  // access to users; package behavior is unchanged.
  permissions: ["chat-read", "chat-write", "ui"],
  restartRequired: false,
};

// ── Pairing lint: declared assets and hash-pinned files stay in step ─────────
// Read off the GENERATED manifest rather than off the lists above, because the
// manifest is the thing that ships and there is no manifest line for a reviewer
// to eyeball — every path in it was computed a few lines ago.
//
// Both directions are checked, because the Engine only checks one. Its manifest
// schema refuses a declared asset that `files[]` does not pin; a file pinned in
// `files[]` and MISSING from `contributions.assets.paths` is silent at install,
// at catalog build and at runtime. That silent half is exactly how a verb table
// ships dead: `gm-verbs.json` hash-verified, present in the zip, on disk in the
// install — and resolving zero verbs forever, with no diagnostic anywhere to
// say why. The failure is loud here because it can be loud nowhere else.
//
// Entrypoints are the one legitimate asymmetry: `agents.json` and `client.js`
// are pinned but are not assets. They are subtracted by reading the manifest's
// own `entrypoints`, so declaring a new one does not red this lint by surprise.
const entrypointPaths = new Set(Object.values(manifest.entrypoints));
const pinnedPaths = new Set(manifest.files.map((file) => file.path));
const declaredPaths = new Set(manifest.contributions.assets.paths);
const unpinnedAssets = [...declaredPaths].filter((path) => !pinnedPaths.has(path));
const undeclaredFiles = [...pinnedPaths].filter((path) => !declaredPaths.has(path) && !entrypointPaths.has(path));
if (unpinnedAssets.length > 0 || undeclaredFiles.length > 0) {
  throw new Error(
    [
      "Pixelforge manifest asset pairing is broken:",
      ...unpinnedAssets.map((path) => `  declared in contributions.assets.paths but not hash-pinned in files[]: ${path}`),
      ...undeclaredFiles.map((path) => `  hash-pinned in files[] but not declared in contributions.assets.paths: ${path}`),
    ].join("\n"),
  );
}

await writeFile(join(packageRoot, "client.js"), clientBuffer);
await writeFile(join(packageRoot, "agents.json"), agentsBuffer);
await writeFile(join(packageRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeEnglishPackageLocale(packageRoot, manifest, [agentDefinition]);

// ── Reproducible artifact ────────────────────────────────────────────────────
const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
const archive = createDeterministicZip([
  { name: "manifest.json", data: manifestBuffer },
  { name: "agents.json", data: agentsBuffer },
  { name: "client.js", data: clientBuffer },
  ...assetPayloads.map((asset) => ({ name: asset.path, data: asset.buffer })),
]);
await mkdir(artifactsDir, { recursive: true });
const artifactName = `pixelforge-${VERSION}.zip`;
const artifactPath = join(artifactsDir, artifactName);
await writeFile(artifactPath, archive);

// ── Catalog family ───────────────────────────────────────────────────────────
const { catalog } = await readCatalogFamily(repoRoot);
catalog.packages = catalog.packages.filter((entry) => entry.manifest.id !== "pixelforge");
catalog.packages.push({
  manifest,
  category: "misc",
  iconUrl: catalogArtworkUrl("pixelforge"),
  artifact: {
    url: `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/${basename(artifactPath)}`,
    sha256: sha256(archive),
    bytes: archive.byteLength,
  },
  documentationUrl: "https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/pixelforge/README.md",
});
catalog.packages.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
// generatedAt is resolved centrally in writeCatalogFamily (preserved by
// default; refreshed only when MARINARA_CATALOG_STAMP_GENERATED_AT=1).
await writeCatalogFamily(repoRoot, catalog);

if (!existsSync(join(repoRoot, "artwork/agent-covers/pixelforge.png"))) {
  console.warn("Missing artwork/agent-covers/pixelforge.png — run node packages/pixelforge/build/cover.mjs");
}
console.log(`built pixelforge ${VERSION}`);
console.log(
  `  client.js ${clientBuffer.byteLength} bytes, ${assetPayloads.length} assets, artifact ${archive.byteLength} bytes`,
);
console.log(
  `  builtAgainst ${boundary.builtAgainst.engineVersion} @ ${boundary.builtAgainst.engineCommit.slice(0, 9)}`,
);
