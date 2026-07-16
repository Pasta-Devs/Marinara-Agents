import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { catalogArtworkUrl } from "./catalog-artwork.mjs";
import { readCatalogFamily, writeCatalogFamily } from "./catalog-lanes.mjs";
import { withPackageActivationGuidance } from "./catalog-package-guidance.mjs";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const artifactsDir = join(repoRoot, "artifacts");
const packagesDir = join(repoRoot, "packages");
const MIN_ENGINE_VERSION = "2.3.0";
const nonDownloadableCoreFeatures = new Set(["about-me-keeper"]);
await mkdir(artifactsDir, { recursive: true });

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const documentationAnchors = {
  continuity: "continuity-checker",
  director: "narrative-director",
  expression: "expression-engine",
  quest: "quest-tracker",
  html: "immersive-html",
  spotify: "music-dj",
  haptic: "haptic-feedback",
  cyoa: "cyoa-choices",
};

const { catalog } = await readCatalogFamily(repoRoot);

const packageDirectories = (await readdir(packagesDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((id) => !nonDownloadableCoreFeatures.has(id))
  .sort();
const sourcePackageIds = new Set(packageDirectories);
const requestedPackageIds = new Set(process.argv.slice(2));
const selectedPackageDirectories = requestedPackageIds.size > 0
  ? packageDirectories.filter((id) => requestedPackageIds.has(id))
  : packageDirectories;
if (selectedPackageDirectories.length !== requestedPackageIds.size && requestedPackageIds.size > 0) {
  const unknownIds = [...requestedPackageIds].filter((id) => !sourcePackageIds.has(id));
  throw new Error(`Unknown agent package${unknownIds.length === 1 ? "" : "s"}: ${unknownIds.join(", ")}`);
}
const rebuiltIds = new Set();
const rebuiltPackages = [];

for (const id of selectedPackageDirectories) {
  const sourceDir = join(packagesDir, id);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(sourceDir, "manifest.json"), "utf8"));
  } catch {
    continue;
  }
  // Feature packages own their build in build-feature-packages.mjs.
  if (!manifest.kind?.includes("agent") || manifest.entrypoints?.server) continue;
  const agentDefinitions = JSON.parse(await readFile(join(sourceDir, manifest.entrypoints.agents), "utf8"));
  for (const definition of agentDefinitions) {
    if (definition.id === id) {
      definition.description = withPackageActivationGuidance(id, definition.description);
    }
  }
  const agentsBuffer = Buffer.from(`${JSON.stringify(agentDefinitions, null, 2)}\n`);
  await writeFile(join(sourceDir, manifest.entrypoints.agents), agentsBuffer);
  const category = ["writer", "tracker", "misc"].includes(agentDefinitions[0]?.category)
    ? agentDefinitions[0].category
    : "misc";
  manifest = {
    ...manifest,
    description: withPackageActivationGuidance(id, manifest.description),
    engine: { ...manifest.engine, min: manifest.engine?.min ?? MIN_ENGINE_VERSION },
    files: [{ path: manifest.entrypoints.agents, sha256: sha256(agentsBuffer), bytes: agentsBuffer.byteLength }],
  };
  await writeFile(join(sourceDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const temporary = await mkdtemp(join(tmpdir(), `marinara-agent-${id}-`));
  try {
    await writeFile(join(temporary, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(join(temporary, manifest.entrypoints.agents), agentsBuffer);
    const artifactName = `${id}-${manifest.version}.zip`;
    const artifactPath = join(artifactsDir, artifactName);
    await rm(artifactPath, { force: true });
    const zipped = spawnSync("zip", ["-X", "-q", artifactPath, "manifest.json", manifest.entrypoints.agents], {
      cwd: temporary,
      stdio: "inherit",
    });
    if (zipped.status !== 0) throw new Error(`zip failed for ${id}`);
    const artifact = await readFile(artifactPath);
    rebuiltPackages.push({
      manifest,
      category,
      iconUrl: catalogArtworkUrl(id),
      artifact: {
        url: `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/${basename(artifactPath)}`,
        sha256: sha256(artifact),
        bytes: artifact.byteLength,
      },
      documentationUrl: `https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/agents/built-in-agents.md#${documentationAnchors[id] || id}`,
    });
    rebuiltIds.add(id);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

catalog.packages = [
  ...catalog.packages.filter(
    (entry) => sourcePackageIds.has(entry.manifest.id) && !rebuiltIds.has(entry.manifest.id),
  ),
  ...rebuiltPackages,
].sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
catalog.generatedAt = new Date().toISOString();
await writeCatalogFamily(repoRoot, catalog);
