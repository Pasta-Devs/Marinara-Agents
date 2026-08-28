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

const VERSION = "0.12.0";
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

const assetPayloads = [];
for (const assetPath of art.files) {
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
    assets: { paths: art.files },
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
