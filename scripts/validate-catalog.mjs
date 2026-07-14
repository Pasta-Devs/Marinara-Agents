import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const catalog = JSON.parse(await readFile(join(repoRoot, "catalog/catalog.json"), "utf8"));
if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.packages)) throw new Error("Invalid catalog envelope");

const ids = new Set();
for (const entry of catalog.packages) {
  const { manifest, category, artifact, documentationUrl } = entry;
  if (!manifest?.id || ids.has(manifest.id)) throw new Error(`Duplicate or missing package id: ${manifest?.id}`);
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
if (catalog.packages.length !== 30 || agentOnly !== 22 || features !== 8) {
  throw new Error(`Expected 22 agents and 8 features, found ${agentOnly} and ${features}`);
}
console.log(`Catalog valid: ${catalog.packages.length} packages (${agentOnly} agents, ${features} features).`);
