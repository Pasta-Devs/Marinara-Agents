import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export const LEGACY_CATALOG_MAJOR = 2;

const ENGINE_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/u;
const VERSIONED_CATALOG_DIRECTORY_PATTERN = /^v(\d+)$/u;

function parseEngineVersion(value) {
  const match = ENGINE_VERSION_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid Engine compatibility version: ${value}`);
  return match.slice(1).map(Number);
}

export function compareEngineVersions(left, right) {
  const leftParts = parseEngineVersion(left);
  const rightParts = parseEngineVersion(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

export function catalogMajorsForRange(minimum, maximumExclusive) {
  if (compareEngineVersions(maximumExclusive, minimum) <= 0) {
    throw new Error(`Engine compatibility range must be increasing: ${minimum} to ${maximumExclusive}`);
  }
  const [minimumMajor] = parseEngineVersion(minimum);
  const [maximumMajor] = parseEngineVersion(maximumExclusive);
  if (maximumMajor - minimumMajor > 20) {
    throw new Error(`Engine compatibility range spans too many catalog lanes: ${minimum} to ${maximumExclusive}`);
  }

  const majors = [];
  for (let major = minimumMajor; major <= maximumMajor; major += 1) {
    const laneMinimum = `${major}.0.0`;
    const laneMaximum = `${major + 1}.0.0`;
    if (
      compareEngineVersions(maximumExclusive, laneMinimum) > 0 &&
      compareEngineVersions(minimum, laneMaximum) < 0
    ) {
      majors.push(major);
    }
  }
  return majors;
}

export function catalogMajorsForManifest(manifest) {
  if (!manifest?.engine?.min || !manifest?.engine?.maxExclusive) {
    throw new Error(`${manifest?.id || "Package"} must declare an Engine compatibility range`);
  }
  return catalogMajorsForRange(manifest.engine.min, manifest.engine.maxExclusive);
}

export function assertManifestBuildProvenance(manifest) {
  if (manifest.schemaVersion !== 2) return;
  const builtAgainstEngineVersion = manifest.builtAgainst?.engineVersion;
  if (!builtAgainstEngineVersion) throw new Error(`${manifest.id} must declare its exact builtAgainst Engine version`);
  if (
    compareEngineVersions(builtAgainstEngineVersion, manifest.engine.min) < 0 ||
    compareEngineVersions(builtAgainstEngineVersion, manifest.engine.maxExclusive) >= 0
  ) {
    throw new Error(
      `${manifest.id} was built against Engine ${builtAgainstEngineVersion}, outside its declared compatibility range`,
    );
  }
}

export function createCatalogLanes(catalog) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.packages)) {
    throw new Error("Invalid catalog envelope");
  }
  const packagesByMajor = new Map([[LEGACY_CATALOG_MAJOR, []]]);
  for (const entry of catalog.packages) {
    for (const major of catalogMajorsForManifest(entry.manifest)) {
      const packages = packagesByMajor.get(major) ?? [];
      packages.push(entry);
      packagesByMajor.set(major, packages);
    }
  }
  return new Map(
    [...packagesByMajor.entries()]
      .sort(([left], [right]) => left - right)
      .map(([major, packages]) => [
        major,
        {
          schemaVersion: 1,
          generatedAt: catalog.generatedAt,
          packages: packages.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name)),
        },
      ]),
  );
}

function versionedCatalogPath(repoRoot, major) {
  return join(repoRoot, `catalog/v${major}/catalog.json`);
}

export async function readCatalogFamily(repoRoot) {
  const catalogDirectory = join(repoRoot, "catalog");
  const candidates = [join(catalogDirectory, "catalog.json")];
  try {
    const entries = await readdir(catalogDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && VERSIONED_CATALOG_DIRECTORY_PATTERN.test(entry.name)) {
        candidates.push(join(catalogDirectory, entry.name, "catalog.json"));
      }
    }
  } catch {
    // The first catalog build may create the catalog directory.
  }

  const packagesById = new Map();
  const catalogsByMajor = new Map();
  let legacyCatalog = null;
  let generatedAt = null;
  for (const path of candidates.sort()) {
    let catalog;
    try {
      catalog = JSON.parse(await readFile(path, "utf8"));
    } catch {
      continue;
    }
    if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.packages)) {
      throw new Error(`Invalid catalog envelope: ${path}`);
    }
    generatedAt ??= catalog.generatedAt;
    for (const entry of catalog.packages) packagesById.set(entry.manifest.id, entry);
    if (path === join(catalogDirectory, "catalog.json")) {
      legacyCatalog = catalog;
      continue;
    }
    const directory = basename(dirname(path));
    const match = VERSIONED_CATALOG_DIRECTORY_PATTERN.exec(directory);
    if (match) catalogsByMajor.set(Number(match[1]), catalog);
  }
  if (!legacyCatalog && catalogsByMajor.size === 0) {
    return {
      catalog: { schemaVersion: 1, generatedAt: new Date().toISOString(), packages: [] },
      catalogsByMajor,
      legacyCatalog,
    };
  }
  return {
    catalog: {
      schemaVersion: 1,
      generatedAt: generatedAt ?? new Date().toISOString(),
      packages: [...packagesById.values()].sort((left, right) => left.manifest.name.localeCompare(right.manifest.name)),
    },
    catalogsByMajor,
    legacyCatalog,
  };
}

export async function writeCatalogFamily(repoRoot, catalog) {
  const catalogDirectory = join(repoRoot, "catalog");
  const catalogsByMajor = createCatalogLanes(catalog);
  await mkdir(catalogDirectory, { recursive: true });

  const entries = await readdir(catalogDirectory, { withFileTypes: true });
  const expectedDirectories = new Set([...catalogsByMajor.keys()].map((major) => `v${major}`));
  for (const entry of entries) {
    if (
      entry.isDirectory() &&
      VERSIONED_CATALOG_DIRECTORY_PATTERN.test(entry.name) &&
      !expectedDirectories.has(entry.name)
    ) {
      await rm(join(catalogDirectory, entry.name), { recursive: true, force: true });
    }
  }

  for (const [major, lane] of catalogsByMajor) {
    const path = versionedCatalogPath(repoRoot, major);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(lane, null, 2)}\n`);
  }
  const legacyCatalog = catalogsByMajor.get(LEGACY_CATALOG_MAJOR);
  if (!legacyCatalog) throw new Error(`Missing legacy v${LEGACY_CATALOG_MAJOR} catalog lane`);
  await writeFile(join(catalogDirectory, "catalog.json"), `${JSON.stringify(legacyCatalog, null, 2)}\n`);
  return catalogsByMajor;
}
