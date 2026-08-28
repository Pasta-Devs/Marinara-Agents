// Build the Beholder package: concatenate its plain-JS client modules into a
// single self-contained client.js, stamp the manifest, write a reproducible
// artifact zip, and update the catalog family.
//
// Beholder is an agent package that also ships a client, so build-agent-catalog.mjs
// skips it (it drops client-bearing packages to avoid stripping client.js from
// files[]) and it owns its build here, the way Pixelforge does.
//
// agents.json is NOT generated. It carries the extraction prompt templates the
// model was trained against, maintained by hand and verified against the training
// corpus; this script reads it as-is and only hashes it into the manifest.
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { catalogArtworkUrl } from "./catalog-artwork.mjs";
import { readCatalogFamily, writeCatalogFamily } from "./catalog-lanes.mjs";
import { withPackageActivationGuidance } from "./catalog-package-guidance.mjs";
import { writeEnglishPackageLocale } from "./package-locales.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repoRoot, "packages/beholder");
const artifactsDir = join(repoRoot, "artifacts");

const VERSION = "1.3.6";
const ENGINE_MIN = "2.4.4";
const MAX_ENGINE_EXCLUSIVE = "4.0.0";
const BASE_DESCRIPTION =
  "Tracks each roleplay character's clothing by body slot, held items, wounds, missing parts, bare slots, and species, then keeps that physical state available to the next response, and shows it on a paper doll you can open from the roleplay toolbar. Pick the prompt template for your model: one prompt for a SOTA model (GPT-5.5+, Opus 4.8+, Kimi K3+), or five passes for the local Beholder model (GetBeholder/Beholder-GGUF) — free, offline, and private.";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// ── Client bundle ────────────────────────────────────────────────────────────
// src/*.js in filename order, wrapped in one strict IIFE, preceded by the
// stylesheets and interface strings inlined as constants. Inlining keeps the
// client a single file with no second request and no third-party host.
const srcDir = join(packageRoot, "src");
const parts = (await readdir(srcDir)).filter((name) => name.endsWith(".js")).sort();
if (parts.length === 0) throw new Error("Beholder has no client source modules");

const styleCss = await readFile(join(srcDir, "style.css"), "utf8");
const faCss = await readFile(join(srcDir, "fa-embed.css"), "utf8");
const localeDir = join(srcDir, "locales");
const locales = {};
for (const name of (await readdir(localeDir)).filter((file) => file.endsWith(".json")).sort()) {
  const catalog = JSON.parse(await readFile(join(localeDir, name), "utf8"));
  locales[basename(name, ".json").toLowerCase()] = Object.fromEntries(
    Object.entries(catalog).filter(([key, value]) => key !== "_meta" && typeof value === "string"),
  );
}

const constants =
  `const BH_STYLE_CSS = ${JSON.stringify(styleCss)};\n` +
  `const BH_FA_CSS = ${JSON.stringify(faCss)};\n` +
  `const BH_LOCALES = ${JSON.stringify(locales)};\n`;

const banner =
  `// Beholder ${VERSION} — Marinara Engine roleplay-toolbar capability (single-file client bundle)\n` +
  `// Built from packages/beholder/src (${parts.length} modules) by scripts/build-beholder-package.mjs. Do not edit; edit src/ and rebuild.\n`;
const body = [];
for (const part of parts) {
  body.push(`// ===== ${part} =====\n${await readFile(join(srcDir, part), "utf8")}`);
}
const clientBuffer = Buffer.from(`${banner}(() => {\n"use strict";\n${constants}\n${body.join("\n")}\n})();\n`, "utf8");

const syntaxCheckDir = await mkdtemp(join(tmpdir(), "beholder-syntax-"));
try {
  const syntaxCheckPath = join(syntaxCheckDir, "client.check.mjs");
  await writeFile(syntaxCheckPath, clientBuffer);
  const checked = spawnSync(process.execPath, ["--check", syntaxCheckPath], { encoding: "utf8" });
  if (checked.status !== 0) {
    throw new Error(checked.stderr || checked.stdout || "Beholder client bundle failed the syntax check");
  }
} finally {
  await rm(syntaxCheckDir, { recursive: true, force: true });
}

// ── Agent definitions: hand-maintained prompts, generated description ────────
// Everything here is authored by hand except the description, which the catalog
// requires to match the manifest's. Stamping it from the one constant above keeps
// the two from drifting; the prompt templates are never touched.
const description = withPackageActivationGuidance("beholder", BASE_DESCRIPTION);
const agentDefinitions = JSON.parse(await readFile(join(packageRoot, "agents.json"), "utf8"));
for (const agent of agentDefinitions) {
  if (agent.id === "beholder") agent.description = BASE_DESCRIPTION;
}
const agentsBuffer = Buffer.from(`${JSON.stringify(agentDefinitions, null, 2)}\n`);
await writeFile(join(packageRoot, "agents.json"), agentsBuffer);
const manifest = {
  schemaVersion: 1,
  id: "beholder",
  name: "Beholder",
  version: VERSION,
  description,
  engine: { min: ENGINE_MIN, maxExclusive: MAX_ENGINE_EXCLUSIVE },
  kind: ["agent"],
  entrypoints: { agents: "agents.json", client: "client.js" },
  // The same package-owned panel opens from both the roleplay toolbar and the
  // Tracker Panel. The host renders either launcher only when Beholder is active.
  contributions: { slots: ["roleplay-tracker", "tracker-panel"] },
  files: [
    { path: "agents.json", sha256: sha256(agentsBuffer), bytes: agentsBuffer.byteLength },
    { path: "client.js", sha256: sha256(clientBuffer), bytes: clientBuffer.byteLength },
  ],
  // The client reads the chat's tracked state through the Engine's own
  // same-origin agent route and draws it; "ui" covers the toolbar contribution.
  permissions: ["agent-runtime", "chat-read", "prompt-context", "storage", "ui"],
  restartRequired: false,
};

await writeFile(join(packageRoot, "client.js"), clientBuffer);
await writeFile(join(packageRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeEnglishPackageLocale(packageRoot, manifest, agentDefinitions);

// ── Reproducible artifact ────────────────────────────────────────────────────
const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
const archive = createDeterministicZip([
  { name: "manifest.json", data: manifestBuffer },
  { name: "agents.json", data: agentsBuffer },
  { name: "client.js", data: clientBuffer },
]);
await mkdir(artifactsDir, { recursive: true });
const artifactName = `beholder-${VERSION}.zip`;
const artifactPath = join(artifactsDir, artifactName);
await writeFile(artifactPath, archive);

// ── Catalog family ───────────────────────────────────────────────────────────
const { catalog } = await readCatalogFamily(repoRoot);
catalog.packages = catalog.packages.filter((entry) => entry.manifest.id !== "beholder");
catalog.packages.push({
  manifest,
  category: "tracker",
  iconUrl: catalogArtworkUrl("beholder"),
  artifact: {
    url: `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/${basename(artifactPath)}`,
    sha256: sha256(archive),
    bytes: archive.byteLength,
  },
  documentationUrl:
    "https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/agents/built-in-agents.md#beholder",
});
catalog.packages.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
// generatedAt is resolved centrally in writeCatalogFamily (preserved by
// default; refreshed only when MARINARA_CATALOG_STAMP_GENERATED_AT=1).
await writeCatalogFamily(repoRoot, catalog);

console.log(`built beholder ${VERSION}`);
console.log(`  client.js ${clientBuffer.byteLength} bytes, artifact ${archive.byteLength} bytes`);
