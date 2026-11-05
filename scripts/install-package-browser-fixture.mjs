import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { INCOMPLETE_PACKAGE_IDS } from "./catalog-incomplete.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeArchivePath(value) {
  if (!value || value.includes("\\") || value.startsWith("/") || value.includes("\0")) {
    throw new Error(`Unsafe package path: ${JSON.stringify(value)}`);
  }
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes(":"))) {
    throw new Error(`Unsafe package path: ${JSON.stringify(value)}`);
  }
  return parts.join("/");
}

function inside(root, candidate) {
  const base = resolve(root);
  const target = resolve(candidate);
  if (target !== base && !target.startsWith(`${base}${sep}`)) {
    throw new Error(`Package path escapes its installation root: ${candidate}`);
  }
  return target;
}

function isSymlink(entry) {
  return ((entry.attr >>> 16) & 0o170000) === 0o120000;
}

const LIVE_CATALOG_ROOT = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/staging/catalog";
const ENGINE_RELEASE_VERSION = /^v?(\d+)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

/**
 * The live catalog's version of each package, by id, as the runner's Engines see it. They run with
 * MARINARA_GIT_BRANCH=staging, so they read the staging lane for their major (`v<major>/catalog.json` for a release
 * version, else `catalog.json`; resolveCapabilityCatalogUrl) and its preview overlay (resolvePreviewCatalogUrl), where
 * a published entry wins. Empty when the caller set MARINARA_AGENT_CATALOG_URL: the Engine then offers that catalog's
 * updates as usual. A document the runner cannot read is skipped with a warning, so its updates may still be offered.
 */
export async function readLiveCatalogVersions({ engineRoot, env = process.env, fetchDocument = fetch }) {
  const versions = new Map();
  if (env.MARINARA_AGENT_CATALOG_URL?.trim()) return versions;
  const { version } = JSON.parse(await readFile(join(engineRoot, "package.json"), "utf8"));
  const major = ENGINE_RELEASE_VERSION.exec(String(version).trim())?.[1];
  const lane = major ? `v${Number(major)}/catalog.json` : "catalog.json";
  // The overlay first, so the published lane read after it overwrites any entry both list (a published entry wins).
  const documents = [
    { url: `${LIVE_CATALOG_ROOT}/preview/${lane}`, optional: true },
    { url: `${LIVE_CATALOG_ROOT}/${lane}`, optional: false },
  ];
  for (const { url, optional } of documents) {
    try {
      const response = await fetchDocument(url, { signal: AbortSignal.timeout(15_000) });
      // The overlay is absent whenever no package is staging-only; a missing published lane is worth a warning.
      if (response.status === 404 && optional) continue;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      for (const { manifest } of (await response.json()).packages) versions.set(manifest.id, manifest.version);
    } catch (error) {
      console.warn(`Could not read ${url}; its updates may still be offered: ${error?.message ?? error}`);
    }
  }
  return versions;
}

/**
 * The Engine's update-decisions-v1.json declining each installed package's live version that differs from the
 * installed one, so a branch behind the live catalog does not open "Agent updates available" over the suite.
 * ponytail: declines only the versions live when the run starts, so one published mid-run can still prompt. The Engine
 * fetches catalogs and artifacts only over https and never from loopback; once it accepts an explicitly configured
 * loopback catalog for both, the runner can serve this checkout's catalog/, artifacts/ and artwork/ to it instead.
 */
export function declineLiveUpdates(packages, liveVersions, declinedAt = new Date().toISOString()) {
  const declined = {};
  for (const { id, version } of packages) {
    const live = liveVersions.get(id);
    if (live && live !== version) declined[id] = { version: live, declinedAt };
  }
  return { schemaVersion: 1, declined };
}

/**
 * Installs `packageId`, or every id in `packageIds`, from this checkout's catalog and artifacts into one fresh
 * `capability-packages` folder with a single installed.json, and declines the updates `liveVersions` (from
 * readLiveCatalogVersions) would offer.
 */
export async function installPackageBrowserFixture({
  agentsRoot,
  engineRoot,
  dataDir,
  packageId,
  packageIds,
  liveVersions = new Map(),
}) {
  const installRoot = join(dataDir, "capability-packages");
  await rm(installRoot, { recursive: true, force: true });
  const packages = [];
  for (const id of [...new Set(packageIds ?? [packageId])]) {
    packages.push(await installOne({ agentsRoot, engineRoot, installRoot, packageId: id }));
  }
  await writeFile(join(installRoot, "installed.json"), `${JSON.stringify({ schemaVersion: 1, packages }, null, 2)}\n`, {
    mode: 0o600,
  });
  const decisions = declineLiveUpdates(packages, liveVersions);
  await writeFile(join(installRoot, "update-decisions-v1.json"), `${JSON.stringify(decisions, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function installOne({ agentsRoot, engineRoot, installRoot, packageId }) {
  const packageRoot = join(agentsRoot, "packages", packageId);
  const manifest = JSON.parse(await readFile(join(packageRoot, "manifest.json"), "utf8"));
  if (manifest.id !== packageId) throw new Error(`Package manifest ID does not match ${packageId}`);

  const catalog = JSON.parse(await readFile(join(agentsRoot, "catalog", "catalog.json"), "utf8"));
  const previewCatalogPath = join(agentsRoot, "catalog", "preview", "catalog.json");
  if (process.env.MARINARA_CATALOG_INCLUDE_INCOMPLETE === "1" && existsSync(previewCatalogPath)) {
    const preview = JSON.parse(await readFile(previewCatalogPath, "utf8"));
    catalog.packages = [...catalog.packages, ...preview.packages];
  }
  const artifactPath = join(agentsRoot, "artifacts", `${packageId}-${manifest.version}.zip`);
  const archive = await readFile(artifactPath);
  // A package still in development is in no catalog lane, so its own artifact stands in for the catalog's integrity
  // metadata; every payload is still checked against its manifest below.
  const catalogEntry =
    catalog.packages.find((entry) => entry.manifest?.id === packageId) ??
    (INCOMPLETE_PACKAGE_IDS.has(packageId)
      ? { manifest, artifact: { bytes: archive.byteLength, sha256: sha256(archive) } }
      : null);
  if (!catalogEntry) throw new Error(`${packageId} is missing from catalog/catalog.json`);
  if (JSON.stringify(catalogEntry.manifest) !== JSON.stringify(manifest)) {
    throw new Error(`${packageId} manifest does not match its catalog entry`);
  }

  if (archive.byteLength !== catalogEntry.artifact.bytes || sha256(archive) !== catalogEntry.artifact.sha256) {
    throw new Error(`${packageId} artifact does not match its catalog integrity metadata`);
  }

  const requireFromEngine = createRequire(join(engineRoot, "package.json"));
  const AdmZip = requireFromEngine("adm-zip");
  const zip = new AdmZip(archive);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
  const names = new Set();
  const declared = new Map(manifest.files.map((file) => [normalizeArchivePath(file.path), file]));
  const manifestEntry = entries.find((entry) => entry.entryName === "manifest.json");
  if (!manifestEntry) throw new Error(`${packageId} artifact has no manifest.json`);
  const archivedManifest = JSON.parse(manifestEntry.getData().toString("utf8"));
  if (JSON.stringify(archivedManifest) !== JSON.stringify(manifest)) {
    throw new Error(`${packageId} artifact manifest differs from the package manifest`);
  }

  const versionRoot = join(installRoot, "versions", packageId, manifest.version);
  await mkdir(versionRoot, { recursive: true });

  for (const entry of entries) {
    const name = normalizeArchivePath(entry.entryName);
    if (names.has(name)) throw new Error(`${packageId} artifact contains duplicate path ${name}`);
    names.add(name);
    if (isSymlink(entry)) throw new Error(`${packageId} artifact contains a symbolic link`);
    if (name === "manifest.json") {
      await writeFile(join(versionRoot, name), entry.getData(), {
        mode: 0o600,
      });
      continue;
    }
    const declaration = declared.get(name);
    if (!declaration) throw new Error(`${packageId} artifact contains undeclared file ${name}`);
    const data = entry.getData();
    if (data.byteLength !== declaration.bytes || sha256(data) !== declaration.sha256) {
      throw new Error(`${packageId} artifact payload does not match ${name}`);
    }
    const destination = inside(versionRoot, join(versionRoot, name));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, data, { mode: 0o600 });
  }

  if (entries.length !== declared.size + 1) {
    throw new Error(`${packageId} artifact contains missing or extra payload files`);
  }

  return {
    id: packageId,
    version: manifest.version,
    manifest,
    installedAt: new Date().toISOString(),
    status: "active",
    error: null,
    readiness: manifest.entrypoints.server ? "pending" : "ready",
    readinessError: null,
    legacy: false,
  };
}
