// Build the Quartermaster package: concatenate its plain-JS client modules
// into a single self-contained client.js, hash the hand-authored server.mjs
// and agents.json as-is, stamp the manifest, write a reproducible artifact
// zip, and update the catalog family (INCOMPLETE_PACKAGE_IDS keeps it out of
// every published catalog until it's ready).
//
// Quartermaster is an agent package that also ships a client and a server, so
// build-agent-catalog.mjs skips it (client-bearing) and build-feature-packages.mjs
// doesn't apply (not built from a captured Engine source tree) — it owns its
// build here, the way Beholder and Pixelforge do.
//
// agents.json is NOT generated. It's hand-maintained; this script reads it
// as-is and only stamps the description + hashes it into the manifest.
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readCatalogFamily, writeCatalogFamily } from "./catalog-lanes.mjs";
import { withPackageActivationGuidance } from "./catalog-package-guidance.mjs";
import { writeEnglishPackageLocale } from "./package-locales.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { INCOMPLETE_PACKAGE_IDS } from "./catalog-incomplete.mjs";
import { catalogArtworkUrl } from "./catalog-artwork.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repoRoot, "packages/quartermaster");
const artifactsDir = join(repoRoot, "artifacts");

const PACKAGE_ID = "quartermaster";
// Bump the patch version for every build meant for a live install test, so
// Download Agents offers Update instead of only Uninstall (it compares
// version strings; an unchanged version looks identical to it even when the
// content differs). Use a plain patch bump, not a -dev.N prerelease suffix:
// semver ranks a prerelease BELOW its plain release (0.1.0-dev.2 < 0.1.0),
// so once a plain 0.1.0 is installed, no prerelease build can ever look
// newer to Download Agents.
const VERSION = "0.1.1";
// Declared against the exact staging Engine this scaffold was built and tested
// against. Do not lower this to reach stable users — see CONTRIBUTING.md.
const ENGINE_MIN = "2.4.4";
const MAX_ENGINE_EXCLUSIVE = "4.0.0";
const CAPABILITY_API = Object.freeze({ major: 1, minor: 14 });
const BUILT_AGAINST = Object.freeze({
  engineVersion: "2.4.4",
  engineCommit: "5c5a0bc8e7e4a6ef213dee45bf37fc7fba589e33",
});
const BASE_DESCRIPTION =
  "A per-chat RPG character sheet and inventory manager for Roleplay mode: equip slots arranged around your persona's portrait, item locations (bag, stored, equipped), and saved outfits, plus an optional tracker agent that keeps equipped items and inventory in sync with the story as you play.";
// Local/fork dev testing (installing an unpublished build via a self-hosted
// catalog — see CONTRIBUTING.md's MARINARA_CATALOG_INCLUDE_INCOMPLETE note)
// needs the artifact to resolve from wherever it's actually pushed, not the
// official repo. Override only for that; the official URL is always the
// default so a normal build stays correct with no flag set.
const ARTIFACT_BASE_URL =
  process.env.QUARTERMASTER_DEV_ARTIFACT_BASE_URL ||
  "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts";

if (!INCOMPLETE_PACKAGE_IDS.has(PACKAGE_ID)) {
  throw new Error(`${PACKAGE_ID} must stay in INCOMPLETE_PACKAGE_IDS until it is ready for testers`);
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// Windows checkouts with core.autocrlf=true re-materialize committed LF files
// as CRLF on any git-mediated working-tree write (checkout, merge, stash
// pop) — Node's own writes stay LF, but git's don't. A build run right after
// one of those operations would otherwise bake stray CRLF into the
// concatenated bundle, producing a different artifact than the same source
// built fresh. Normalize on read so the build is deterministic regardless of
// how the working tree got here.
const readTextNormalized = async (path) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

// ── Client bundle ────────────────────────────────────────────────────────────
// src/*.js in filename order, wrapped in one strict IIFE. Inlining keeps the
// client a single file with no second request and no third-party host.
const srcDir = join(packageRoot, "src");
const parts = (await readdir(srcDir)).filter((name) => name.endsWith(".js")).sort();
if (parts.length === 0) throw new Error("Quartermaster has no client source modules");

const banner =
  `// Quartermaster ${VERSION} — Marinara Engine roleplay-tracker capability (single-file client bundle)\n` +
  `// Built from packages/quartermaster/src (${parts.length} modules) by scripts/build-quartermaster-package.mjs. Do not edit; edit src/ and rebuild.\n`;
const body = [];
for (const part of parts) {
  body.push(`// ===== ${part} =====\n${await readTextNormalized(join(srcDir, part))}`);
}
const clientBuffer = Buffer.from(`${banner}(() => {\n"use strict";\n${body.join("\n")}\n})();\n`, "utf8");

const syntaxCheckDir = await mkdtemp(join(tmpdir(), "quartermaster-syntax-"));
try {
  const syntaxCheckPath = join(syntaxCheckDir, "client.check.mjs");
  await writeFile(syntaxCheckPath, clientBuffer);
  const checked = spawnSync(process.execPath, ["--check", syntaxCheckPath], { encoding: "utf8" });
  if (checked.status !== 0) {
    throw new Error(checked.stderr || checked.stdout || "Quartermaster client bundle failed the syntax check");
  }
} finally {
  await rm(syntaxCheckDir, { recursive: true, force: true });
}

// ── Server entrypoint: hand-authored, hashed as-is ───────────────────────────
const serverPath = join(packageRoot, "server.mjs");
const serverBuffer = Buffer.from(await readTextNormalized(serverPath), "utf8");
const serverSyntaxCheckDir = await mkdtemp(join(tmpdir(), "quartermaster-server-syntax-"));
try {
  const syntaxCheckPath = join(serverSyntaxCheckDir, "server.check.mjs");
  await writeFile(syntaxCheckPath, serverBuffer);
  const checked = spawnSync(process.execPath, ["--check", syntaxCheckPath], { encoding: "utf8" });
  if (checked.status !== 0) {
    throw new Error(checked.stderr || checked.stdout || "Quartermaster server.mjs failed the syntax check");
  }
} finally {
  await rm(serverSyntaxCheckDir, { recursive: true, force: true });
}

// ── Agent definition: hand-maintained, generated description ────────────────
const description = withPackageActivationGuidance(PACKAGE_ID, BASE_DESCRIPTION);
const agentDefinitions = JSON.parse(await readFile(join(packageRoot, "agents.json"), "utf8"));
for (const agent of agentDefinitions) {
  if (agent.id === PACKAGE_ID) agent.description = BASE_DESCRIPTION;
}
const agentsBuffer = Buffer.from(`${JSON.stringify(agentDefinitions, null, 2)}\n`);
await writeFile(join(packageRoot, "agents.json"), agentsBuffer);

const manifest = {
  schemaVersion: 2,
  capabilityApi: CAPABILITY_API,
  builtAgainst: BUILT_AGAINST,
  id: PACKAGE_ID,
  name: "Quartermaster",
  version: VERSION,
  description,
  engine: { min: ENGINE_MIN, maxExclusive: MAX_ENGINE_EXCLUSIVE },
  kind: ["agent"],
  entrypoints: { agents: "agents.json", client: "client.js", server: "server.mjs" },
  // Chat-scoped, matching Beholder's proven pattern: a compact launcher in the
  // Roleplay toolbar (roleplay-tracker) plus the full sheet in the detached/
  // docked Tracker Panel (tracker-panel). NOT home-browser-tab — that's
  // Home-shell level with no active-chat context (Noodle/Slurp's shape), and
  // Quartermaster is a per-chat sheet, not an app-wide browser destination.
  // Game Mode coverage is UNRESOLVED — see the note in the build log below.
  contributions: {
    slots: ["roleplay-tracker", "tracker-panel"],
  },
  files: [
    { path: "agents.json", sha256: sha256(agentsBuffer), bytes: agentsBuffer.byteLength },
    { path: "client.js", sha256: sha256(clientBuffer), bytes: clientBuffer.byteLength },
    { path: "server.mjs", sha256: sha256(serverBuffer), bytes: serverBuffer.byteLength },
  ],
  // storage: package-owned inventory/outfit/image records via persistence.documents.
  // routes: serves those records (and later, item/portrait images) under /api/quartermaster.
  // chat-read: the sheet needs to know which chat it's showing.
  // chat-write: syncAppearanceMacro (server.mjs) writes chatMeta.macroVariables
  //   via updateChatMetadata, so a user-placed {{getvar::...}} token in the
  //   appearance field resolves to the current outfit/equipped items.
  // ui: the roleplay-tracker/tracker-panel client contribution.
  // agent-runtime: registers "agent-runtime:quartermaster" (server.mjs) so the
  //   "quartermaster" agent's own post_processing output reconciles into our
  //   own store instead of native game-state — required by
  //   assertCapabilityAgentRuntimeServiceRegistration, confirmed against
  //   capability-agent-runtime.service.ts. One agent def, not
  //   two — every other package in this repo ships exactly one; Memory Nag
  //   is the precedent for combining UI/storage identity and a real
  //   post_processing pipeline agent under that same single entry.
  // prompt-context: registerPromptContext (server.mjs) feeds a curated,
  //   location-aware inventory summary to the NARRATOR every generation —
  //   deliberately separate from agent-runtime's prepareContext, which feeds
  //   the TRACKER AGENT its own prior state instead.
  permissions: ["agent-runtime", "chat-read", "chat-write", "prompt-context", "routes", "storage", "ui"],
  // The routes permission forces this: getCapabilityPackageInstallIssue in the
  // Engine's package-manager.service.ts rejects install for any package that
  // declares "routes" but restartRequired: false — privileged routes only
  // activate on (re)start, confirmed live when install failed without this.
  restartRequired: true,
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
  { name: "server.mjs", data: serverBuffer },
]);
await mkdir(artifactsDir, { recursive: true });
const artifactName = `quartermaster-${VERSION}.zip`;
const artifactPath = join(artifactsDir, artifactName);
await writeFile(artifactPath, archive);

// ── Catalog family ───────────────────────────────────────────────────────────
// Still written even though INCOMPLETE_PACKAGE_IDS hides it from every
// published lane — writeCatalogFamily is the single chokepoint that enforces
// that, so this keeps the same shape every other package's build produces.
const { catalog } = await readCatalogFamily(repoRoot);
catalog.packages = catalog.packages.filter((entry) => entry.manifest.id !== PACKAGE_ID);
catalog.packages.push({
  manifest,
  category: "tracker",
  // validate-catalog.mjs hard-rejects a missing documentationUrl and any
  // iconUrl that doesn't exactly equal catalogArtworkUrl(id) for every entry
  // it can see — confirmed by reading the validator. Both are
  // no-ops for now (INCOMPLETE_PACKAGE_IDS keeps this entry out of every
  // catalog the validator actually reads), but wiring them now means there's
  // nothing left to remember at the moment this graduates out of that set.
  // iconUrl points at real cover art that doesn't exist on disk yet — see
  // artwork/agent-covers/ — that 404 is fine until this is actually listed.
  iconUrl: catalogArtworkUrl(PACKAGE_ID),
  documentationUrl: "https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/quartermaster/README.md",
  artifact: {
    url: `${ARTIFACT_BASE_URL}/${basename(artifactPath)}`,
    sha256: sha256(archive),
    bytes: archive.byteLength,
  },
});
catalog.packages.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
await writeCatalogFamily(repoRoot, catalog);

console.log(`built quartermaster ${VERSION}`);
console.log(
  `  client.js ${clientBuffer.byteLength} bytes, server.mjs ${serverBuffer.byteLength} bytes, artifact ${archive.byteLength} bytes`,
);
