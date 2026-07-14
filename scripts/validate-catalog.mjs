import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const catalog = JSON.parse(await readFile(join(repoRoot, "catalog/catalog.json"), "utf8"));
if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.packages)) throw new Error("Invalid catalog envelope");

const forbiddenAboutMeKeeperPaths = [
  "packages/about-me-keeper/manifest.json",
  "packages/about-me-keeper/agents.json",
  "artifacts/about-me-keeper-1.0.0.zip",
  "sources/engine/packages/shared/dist/features/agents/about-me-keeper/manifest.js",
];
for (const relativePath of forbiddenAboutMeKeeperPaths) {
  if (existsSync(join(repoRoot, relativePath))) {
    throw new Error(`About Me is a core Conversation feature and must not ship as an agent package: ${relativePath}`);
  }
}
const snapshotAgentRegistry = await readFile(
  join(repoRoot, "sources/engine/packages/shared/dist/features/agents/agent-registry.generated.js"),
  "utf8",
);
if (snapshotAgentRegistry.includes("about-me-keeper") || snapshotAgentRegistry.includes("aboutMeKeeper")) {
  throw new Error("The packaged agent registry must not reference the built-in About Me feature");
}

const aboutMeKeeperMarkers = ["about-me-keeper", "About Me Keeper", "aboutMeKeeper"];
const textExtensions = new Set([".js", ".json", ".md", ".mjs", ".ts", ".tsx"]);
async function assertNoAboutMeKeeperReferences(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      await assertNoAboutMeKeeperReferences(entryPath);
      continue;
    }
    if (!textExtensions.has(extname(entry.name))) continue;
    const contents = await readFile(entryPath, "utf8");
    if (aboutMeKeeperMarkers.some((marker) => contents.includes(marker))) {
      throw new Error(`About Me is a core Conversation feature and must not be bundled as an agent: ${entryPath}`);
    }
  }
}
for (const relativePath of ["packages", "sources/engine", "catalog"]) {
  await assertNoAboutMeKeeperReferences(join(repoRoot, relativePath));
}
const readme = await readFile(join(repoRoot, "README.md"), "utf8");
if (aboutMeKeeperMarkers.some((marker) => readme.includes(marker))) {
  throw new Error("README.md must not describe About Me as an agent package");
}

const ids = new Set();
for (const entry of catalog.packages) {
  const { manifest, category, artifact, documentationUrl } = entry;
  if (!manifest?.id || ids.has(manifest.id)) throw new Error(`Duplicate or missing package id: ${manifest?.id}`);
  if (manifest.id === "about-me-keeper") {
    throw new Error("About Me is a core Conversation feature and must not appear in the agent catalog");
  }
  ids.add(manifest.id);
  if (!["writer", "tracker", "misc"].includes(category)) {
    throw new Error(`Missing or invalid category for ${manifest.id}`);
  }
  if (!documentationUrl) throw new Error(`Missing documentation URL for ${manifest.id}`);
  const artifactPath = join(repoRoot, "artifacts", basename(new URL(artifact.url).pathname));
  const archive = await readFile(artifactPath);
  if (archive.byteLength !== artifact.bytes) throw new Error(`Artifact size mismatch for ${manifest.id}`);
  if (createHash("sha256").update(archive).digest("hex") !== artifact.sha256) {
    throw new Error(`Artifact checksum mismatch for ${manifest.id}`);
  }
  const listed = spawnSync("unzip", ["-Z1", artifactPath], { encoding: "utf8" });
  if (listed.status !== 0) throw new Error(listed.stderr || `Could not inspect ${manifest.id}`);
  const actualFiles = listed.stdout.trim().split("\n").filter(Boolean).sort();
  const declaredFiles = ["manifest.json", ...manifest.files.map((file) => file.path)].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(declaredFiles)) {
    throw new Error(`Artifact file list mismatch for ${manifest.id}`);
  }
}

const agentOnly = catalog.packages.filter((entry) => !entry.manifest.entrypoints.server).length;
const features = catalog.packages.length - agentOnly;
if (catalog.packages.length !== 29 || agentOnly !== 21 || features !== 8) {
  throw new Error(`Expected 21 agents and 8 features, found ${agentOnly} and ${features}`);
}
console.log(`Catalog valid: ${catalog.packages.length} packages (${agentOnly} agents, ${features} features).`);
