import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { catalogArtworkUrl } from "./catalog-artwork.mjs";
import { readCatalogFamily, writeCatalogFamily } from "./catalog-lanes.mjs";
import { withPackageActivationGuidance } from "./catalog-package-guidance.mjs";
import {
  assertPortableFilenameComponent,
  assertPortableRelativePath,
  packageArtifactName,
  resolveContainedPortablePath,
} from "./catalog-path-safety.mjs";
import { writeEnglishPackageLocale } from "./package-locales.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = join(repoRoot, "artifacts");
const packagesDir = join(repoRoot, "packages");
const MIN_ENGINE_VERSION = "2.3.0";
const ARTIFACT_MTIME = new Date("2000-01-01T00:00:00.000Z");
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
  .map((entry) => assertPortableFilenameComponent(entry.name, "Package directory id"))
  .filter((id) => !nonDownloadableCoreFeatures.has(id))
  .sort();
const sourcePackageIds = new Set(packageDirectories);
const requestedPackageIds = new Set(
  process.argv.slice(2).map((id) => assertPortableFilenameComponent(id, "Requested package id")),
);
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
  const sourceDir = await resolveContainedPortablePath(packagesDir, id, `Package directory for ${id}`);
  let manifestPath;
  try {
    manifestPath = await resolveContainedPortablePath(sourceDir, "manifest.json", `Manifest for ${id}`);
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) continue;
    throw error;
  }
  // Feature packages own their build in build-feature-packages.mjs.
  if (!manifest.kind?.includes("agent") || manifest.entrypoints?.server) continue;
  const manifestId = assertPortableFilenameComponent(manifest.id, `Package id in ${id}/manifest.json`);
  if (manifestId !== id) throw new Error(`Package directory ${id} contains manifest id ${manifestId}`);
  const artifactName = packageArtifactName(manifestId, manifest.version);
  const agentsPath = assertPortableRelativePath(
    manifest.entrypoints?.agents,
    `Agent entrypoint for ${manifestId}`,
  );
  const agentsSourcePath = await resolveContainedPortablePath(
    sourceDir,
    agentsPath,
    `Agent entrypoint for ${manifestId}`,
  );
  await resolveContainedPortablePath(
    sourceDir,
    "locales/en.json",
    `English locale output for ${manifestId}`,
    { allowMissing: true },
  );
  const agentDefinitions = JSON.parse(await readFile(agentsSourcePath, "utf8"));
  for (const definition of agentDefinitions) {
    if (definition.id === id) {
      definition.description = withPackageActivationGuidance(id, definition.description);
    }
  }
  const agentsBuffer = Buffer.from(`${JSON.stringify(agentDefinitions, null, 2)}\n`);
  await writeFile(agentsSourcePath, agentsBuffer);
  const category = ["writer", "tracker", "misc"].includes(agentDefinitions[0]?.category)
    ? agentDefinitions[0].category
    : "misc";
  manifest = {
    ...manifest,
    description: withPackageActivationGuidance(id, manifest.description),
    engine: { ...manifest.engine, min: manifest.engine?.min ?? MIN_ENGINE_VERSION },
    files: [{ path: agentsPath, sha256: sha256(agentsBuffer), bytes: agentsBuffer.byteLength }],
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeEnglishPackageLocale(sourceDir, manifest, agentDefinitions);

  const temporary = await mkdtemp(join(tmpdir(), `marinara-agent-${id}-`));
  try {
    await writeFile(join(temporary, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    const temporaryAgentsPath = await resolveContainedPortablePath(
      temporary,
      agentsPath,
      `Agent entrypoint for ${manifestId}`,
      { allowMissing: true },
    );
    await mkdir(dirname(temporaryAgentsPath), { recursive: true });
    await writeFile(temporaryAgentsPath, agentsBuffer);
    for (const artifactFile of ["manifest.json", agentsPath]) {
      const artifactSource = await resolveContainedPortablePath(
        temporary,
        artifactFile,
        `Artifact member for ${manifestId}`,
      );
      await chmod(artifactSource, 0o644);
      await utimes(artifactSource, ARTIFACT_MTIME, ARTIFACT_MTIME);
    }
    const artifactPath = await resolveContainedPortablePath(
      artifactsDir,
      artifactName,
      `Artifact for ${manifestId}`,
      { allowMissing: true },
    );
    await rm(artifactPath, { force: true });
    const zipped = spawnSync("zip", ["-X", "-q", artifactPath, "manifest.json", agentsPath], {
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
