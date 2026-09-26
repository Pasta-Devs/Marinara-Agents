// Build the Quartermaster package: concatenate its plain-JS client modules
// into a single self-contained client.js, hash the hand-authored server.mjs
// and agents.json as-is, stamp the manifest, write a reproducible artifact
// zip, and update the catalog family. Shared catalog routing determines
// whether the package is hidden, staging-only, or published.
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
import { basename, dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readCatalogFamily, writeCatalogFamily } from "./catalog-lanes.mjs";
import { withPackageActivationGuidance } from "./catalog-package-guidance.mjs";
import { writeEnglishPackageLocale } from "./package-locales.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { catalogArtworkUrl } from "./catalog-artwork.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repoRoot, "packages/quartermaster");
const artifactsDir = join(repoRoot, "artifacts");

const PACKAGE_ID = "quartermaster";
// Only bump this the moment a confirmed-working batch is actually pushed to
// origin/Quartermaster, paired with a real ### X.Y.Z entry in this package's
// own README Changelog (see the plan doc's branch-protocol section) — NOT on
// every local test build. Most local testing doesn't even need a bump:
// Download Agents' "Update" button only compares version strings
// (`compareCapabilityPackageVersions`, no content/hash check at all), but an
// uninstall→reinstall works at any version since a fresh install never
// compares against anything. When a bump IS due, use a plain patch bump, not
// a -dev.N prerelease suffix: semver ranks a prerelease BELOW its plain
// release (0.1.0-dev.2 < 0.1.0), so once a plain 0.1.0 is installed, no
// prerelease build can ever look newer to Download Agents. Never reset the
// version back down afterward, even across a long dev-iteration stretch.
const VERSION = "0.1.22";
// Declared against the exact staging Engine this scaffold was built and tested
// against. Do not lower this to reach stable users — see CONTRIBUTING.md.
const ENGINE_MIN = "2.4.6";
const MAX_ENGINE_EXCLUSIVE = "4.0.0";
const CAPABILITY_API = Object.freeze({ major: 1, minor: 14 });
const BUILT_AGAINST = Object.freeze({
  engineVersion: "2.4.6",
  engineCommit: "f66abf7eddb7db6312ff5ba8a080145644191775",
});
const BASE_DESCRIPTION =
  "A per-chat RPG character sheet and inventory manager for Roleplay mode: equip slots arranged around your persona's portrait, a full inventory with saved outfits, AI-generated item and outfit art, and a tracker agent that keeps everything in sync with the story on its own.";
// Local/fork dev testing (installing an unpublished build via a self-hosted
// catalog — see CONTRIBUTING.md's MARINARA_CATALOG_INCLUDE_INCOMPLETE note)
// needs the artifact to resolve from wherever it's actually pushed, not the
// official repo. Override only for that; the official URL is always the
// default so a normal build stays correct with no flag set.
const ARTIFACT_BASE_URL =
  process.env.QUARTERMASTER_DEV_ARTIFACT_BASE_URL ||
  "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts";

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
const readableClientSource = `${banner}(() => {\n"use strict";\n${body.join("\n")}\n})();\n`;

const syntaxCheckDir = await mkdtemp(join(tmpdir(), "quartermaster-syntax-"));
try {
  const syntaxCheckPath = join(syntaxCheckDir, "client.check.mjs");
  await writeFile(syntaxCheckPath, readableClientSource);
  const checked = spawnSync(process.execPath, ["--check", syntaxCheckPath], { encoding: "utf8" });
  if (checked.status !== 0) {
    throw new Error(checked.stderr || checked.stdout || "Quartermaster client bundle failed the syntax check");
  }
} finally {
  await rm(syntaxCheckDir, { recursive: true, force: true });
}

// Plain concatenation, not minified. A previous revision of this script ran
// the bundle through esbuild.transform(minify) after a live reinstall threw
// "Outbound response exceeded 199790 bytes" for a 206,956-byte artifact —
// but that theory doesn't survive a check against other real, currently-
// catalogued packages: Slurp and Noodle both ship multi-megabyte artifacts
// (5.3MB / 5.1MB, both well over 25x that supposed cap) through the exact
// same install-fetch mechanism, and "199790" appears nowhere in the checked-
// out Engine source itself (only in this file's own now-removed comment) —
// the real capability-package-install code isn't part of this repo's
// checked-out Engine source, so that number was never actually read from
// source, just inferred from one incident. The error was very likely real
// (it's an exact match for the Engine's own readCappedResponse error
// format), but probably wasn't caused by this package's own artifact size —
// something else in that specific reinstall attempt is the more likely
// explanation, matching how the earlier icon-caching investigation this
// same session also turned out to have multiple independent causes rather
// than one. Reverted to plain concatenation (dropping the esbuild
// dependency entirely) specifically to test that theory empirically against
// a live reinstall, rather than carrying a minification step (and its
// dependency) to guard against a cap that may not really apply here.
const clientBuffer = Buffer.from(readableClientSource, "utf8");

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

// ── Bundled slot icons: hand-picked binary assets, hashed as-is ─────────────
// Generic equip-slot artwork (see server.mjs's SLOT_ICON_DIR comment) —
// pre-generated WebP images committed under packages/quartermaster/icons/,
// not built from source the way client.js is. Every file in that directory
// is declared individually (assertArtifactMatchesManifest requires the
// archive's file set to equal the manifest's declared set exactly, no
// directory-level shortcut) and archived byte-identical to what's on disk.
const iconsDir = join(packageRoot, "icons");
const iconFileNames = (await readdir(iconsDir)).filter((name) => name.endsWith(".webp")).sort();
if (iconFileNames.length === 0) throw new Error("Quartermaster has no bundled slot icons");
const iconFiles = [];
for (const name of iconFileNames) {
  const data = await readFile(join(iconsDir, name));
  iconFiles.push({ path: `icons/${name}`, data });
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
    ...iconFiles.map((file) => ({ path: file.path, sha256: sha256(file.data), bytes: file.data.byteLength })),
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
  // network: server.mjs's engineApiFetch/generateImageViaEngine loopback to the
  //   Engine's OWN internal REST API (GET /api/connections, POST
  //   /api/characters/avatar-generation) via 127.0.0.1, for the Generate
  //   Image feature — there is no api.runtime.images method (confirmed: the
  //   full CapabilityRuntimeHost surface is only persistence/resources/
  //   languageModels/json/logger/isDebugAgentsEnabled, checked against every
  //   package's own package-runtime.ts). This is the same real, shipped
  //   mechanism packages/gacha-forge/server.mjs uses for its own AI image
  //   generation — that package declares this same permission for the same
  //   reason.
  // prompt-context: registerPromptContext (server.mjs) feeds a curated,
  //   location-aware inventory summary to the NARRATOR every generation —
  //   deliberately separate from agent-runtime's prepareContext, which feeds
  //   the TRACKER AGENT its own prior state instead.
  permissions: ["agent-runtime", "chat-read", "chat-write", "network", "prompt-context", "routes", "storage", "ui"],
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
  ...iconFiles.map((file) => ({ name: file.path, data: file.data })),
]);
await mkdir(artifactsDir, { recursive: true });
const artifactName = `quartermaster-${VERSION}.zip`;
const artifactPath = join(artifactsDir, artifactName);

// Guards against a real incident: a rebuild once ran while VERSION still
// matched an already-released, already-committed version (testing
// post-release code changes before remembering to bump VERSION first),
// silently overwriting that released artifact's bytes under the same
// filename -- see _planning/quartermaster-release-process.md's own §3.
// Silent/harmless in every legitimate case: a brand-new version (nothing
// committed at this exact path yet) or a genuine no-op rebuild of the same
// in-progress content both pass through untouched. Only fires the moment a
// PLAIN build (the only kind that ever runs on `Quartermaster` itself,
// per §2's own "never plain-rebuild mid-loop" rule -- see below) would
// actually replace committed bytes with different ones.
//
// Deliberately exempts dev builds (QUARTERMASTER_DEV_ARTIFACT_BASE_URL set,
// or MARINARA_CATALOG_INCLUDE_INCOMPLETE=1): those only ever run on
// `quartermaster-dev-catalog`, whose own stated discipline is "push freely,
// every iteration" under the SAME unbumped VERSION -- repeatedly overwriting
// that branch's own last dev-build commit is the NORMAL, expected shape of
// that loop, not a mistake. Without this exemption the guard would block
// the dev loop's own ordinary iteration, not just the real incident.
function assertArtifactNotOverwritingReleasedContent(path, newContent) {
  if (process.env.ALLOW_ARTIFACT_OVERWRITE === "1") return;
  if (process.env.QUARTERMASTER_DEV_ARTIFACT_BASE_URL || process.env.MARINARA_CATALOG_INCLUDE_INCOMPLETE === "1")
    return;
  const gitPath = relative(repoRoot, path).split("\\").join("/");
  const committed = spawnSync("git", ["show", `HEAD:${gitPath}`], { cwd: repoRoot });
  if (committed.status !== 0 || !committed.stdout || committed.stdout.length === 0) return; // not tracked at HEAD yet
  if (!committed.stdout.equals(newContent)) {
    throw new Error(
      `${gitPath} is already committed at HEAD with different content than this build would write. ` +
        "This almost always means VERSION wasn't bumped before a PLAIN rebuild (never run one mid-loop on " +
        "Quartermaster -- see _planning/quartermaster-release-process.md §2). Bump VERSION first, or set " +
        "ALLOW_ARTIFACT_OVERWRITE=1 if this is genuinely intentional.",
    );
  }
}
assertArtifactNotOverwritingReleasedContent(artifactPath, archive);
await writeFile(artifactPath, archive);

// ── Catalog family ───────────────────────────────────────────────────────────
// writeCatalogFamily applies the shared publication tier and Engine lanes.
const { catalog } = await readCatalogFamily(repoRoot);
catalog.packages = catalog.packages.filter((entry) => entry.manifest.id !== PACKAGE_ID);
catalog.packages.push({
  manifest,
  category: "tracker",
  iconUrl: catalogArtworkUrl(PACKAGE_ID),
  documentationUrl: "https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/quartermaster/README.md",
  artifact: {
    url: `${ARTIFACT_BASE_URL}/${basename(artifactPath)}`,
    sha256: sha256(archive),
    bytes: archive.byteLength,
  },
});
catalog.packages.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
await writeCatalogFamily(repoRoot, catalog);

const iconsTotalBytes = iconFiles.reduce((sum, file) => sum + file.data.byteLength, 0);
console.log(`built quartermaster ${VERSION}`);
console.log(
  `  client.js ${clientBuffer.byteLength} bytes, server.mjs ${serverBuffer.byteLength} bytes, ` +
    `icons ${iconFiles.length} files/${iconsTotalBytes} bytes, artifact ${archive.byteLength} bytes`,
);
