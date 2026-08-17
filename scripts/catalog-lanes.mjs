import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { INCOMPLETE_PACKAGE_IDS, STAGING_ONLY_PACKAGE_IDS } from "./catalog-incomplete.mjs";

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
    if (compareEngineVersions(maximumExclusive, laneMinimum) > 0 && compareEngineVersions(minimum, laneMaximum) < 0) {
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

// Staging-only packages live here instead of the published lanes: an overlay
// that stable Engines never request. See catalog-incomplete.mjs.
export const PREVIEW_CATALOG_DIRECTORY = "preview";

function previewCatalogDirectory(repoRoot) {
  return join(repoRoot, "catalog", PREVIEW_CATALOG_DIRECTORY);
}

function previewVersionedCatalogPath(repoRoot, major) {
  return join(previewCatalogDirectory(repoRoot), `v${major}/catalog.json`);
}

// One lane family = a legacy alias plus its v<major> lanes. The published
// family lives in catalog/, the preview overlay in catalog/preview/; the
// preview directory is not itself a v<major> directory, so scanning catalog/
// never picks it up.
async function readLaneFamily(directory) {
  const candidates = [join(directory, "catalog.json")];
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && VERSIONED_CATALOG_DIRECTORY_PATTERN.test(entry.name)) {
        candidates.push(join(directory, entry.name, "catalog.json"));
      }
    }
  } catch {
    // The first catalog build may create the directory.
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
    if (path === join(directory, "catalog.json")) {
      legacyCatalog = catalog;
      continue;
    }
    const laneDirectory = basename(dirname(path));
    const match = VERSIONED_CATALOG_DIRECTORY_PATTERN.exec(laneDirectory);
    if (match) catalogsByMajor.set(Number(match[1]), catalog);
  }
  return { packagesById, catalogsByMajor, legacyCatalog, generatedAt };
}

export async function readCatalogFamily(repoRoot) {
  const published = await readLaneFamily(join(repoRoot, "catalog"));
  // The overlay is read back into the unified list so a builder that rewrites
  // only its own package cannot drop another package's staging-only entry.
  const preview = await readLaneFamily(previewCatalogDirectory(repoRoot));

  if (!published.legacyCatalog && published.catalogsByMajor.size === 0) {
    return {
      catalog: { schemaVersion: 1, generatedAt: new Date().toISOString(), packages: [] },
      catalogsByMajor: published.catalogsByMajor,
      legacyCatalog: published.legacyCatalog,
      previewCatalogsByMajor: preview.catalogsByMajor,
      previewLegacyCatalog: preview.legacyCatalog,
    };
  }
  const packagesById = new Map([...published.packagesById, ...preview.packagesById]);
  return {
    catalog: {
      schemaVersion: 1,
      generatedAt: published.generatedAt ?? new Date().toISOString(),
      packages: [...packagesById.values()].sort((left, right) => left.manifest.name.localeCompare(right.manifest.name)),
    },
    catalogsByMajor: published.catalogsByMajor,
    legacyCatalog: published.legacyCatalog,
    previewCatalogsByMajor: preview.catalogsByMajor,
    previewLegacyCatalog: preview.legacyCatalog,
  };
}

const GENERATED_AT_EPOCH = "1970-01-01T00:00:00.000Z";

// Strict enough to match what the builders emit (toISOString) and what the
// Engine catalog schema accepts (z.string().datetime()): a canonical UTC
// ISO-8601 datetime. Date.parse alone is too lenient — it accepts date-only
// strings and silently normalizes impossible calendar dates — so a malformed
// committed value would be preserved and then rejected by the Engine. The
// round-trip rejects anything that is not already canonical, restoring the
// self-heal to the epoch fallback.
function isCanonicalIsoDatetime(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
}

async function readCommittedGeneratedAt(catalogDirectory) {
  try {
    const committed = JSON.parse(await readFile(join(catalogDirectory, "catalog.json"), "utf8"));
    if (isCanonicalIsoDatetime(committed.generatedAt)) {
      return committed.generatedAt;
    }
  } catch {
    // No committed catalog yet (first build) or unreadable — fall through.
  }
  return null;
}

// `generatedAt` is deliberately NOT refreshed on every build. A per-build
// wall-clock stamp churns all three catalog files on no-op rebuilds and
// produces a guaranteed one-line merge conflict between any two concurrently
// regenerated catalogs, forcing every other open PR to rebase and re-run CI.
// Preserve the committed value so rebuilds stay byte-deterministic; a publish
// step opts into a fresh stamp with MARINARA_CATALOG_STAMP_GENERATED_AT=1. The
// Engine catalog schema only requires a valid ISO-8601 datetime, which both the
// preserved value and a fresh stamp satisfy.
export async function resolveCatalogGeneratedAt(catalogDirectory) {
  if (process.env.MARINARA_CATALOG_STAMP_GENERATED_AT === "1") {
    return new Date().toISOString();
  }
  return (await readCommittedGeneratedAt(catalogDirectory)) ?? GENERATED_AT_EPOCH;
}

// The preview overlay carries staging-only packages. It is written on every
// branch (promotion copies it to `main` untouched) and is simply never
// requested by a stable Engine, so its presence there is inert. With no
// staging-only packages the directory is removed rather than left empty.
async function writePreviewOverlay(repoRoot, previewCatalog) {
  const directory = previewCatalogDirectory(repoRoot);
  if (previewCatalog.packages.length === 0) {
    await rm(directory, { recursive: true, force: true });
    return new Map();
  }
  const lanes = createCatalogLanes(previewCatalog);
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory, { withFileTypes: true });
  const expectedDirectories = new Set([...lanes.keys()].map((major) => `v${major}`));
  for (const entry of entries) {
    if (
      entry.isDirectory() &&
      VERSIONED_CATALOG_DIRECTORY_PATTERN.test(entry.name) &&
      !expectedDirectories.has(entry.name)
    ) {
      await rm(join(directory, entry.name), { recursive: true, force: true });
    }
  }
  for (const [major, lane] of lanes) {
    const path = previewVersionedCatalogPath(repoRoot, major);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(lane, null, 2)}\n`);
  }
  const legacyLane = lanes.get(LEGACY_CATALOG_MAJOR);
  if (!legacyLane) throw new Error(`Missing legacy v${LEGACY_CATALOG_MAJOR} preview lane`);
  await writeFile(join(directory, "catalog.json"), `${JSON.stringify(legacyLane, null, 2)}\n`);
  return lanes;
}

export async function writeCatalogFamily(repoRoot, catalog) {
  const catalogDirectory = join(repoRoot, "catalog");
  catalog.generatedAt = await resolveCatalogGeneratedAt(catalogDirectory);
  // Marked packages (see catalog-incomplete.mjs) keep their files and artifacts
  // in the tree but are held out of the published lanes: incomplete ones vanish
  // entirely, staging-only ones move to the preview overlay that stable Engines
  // never request. This is the single chokepoint every builder writes through,
  // so a stale committed entry for a newly-marked id is also relocated or
  // dropped on the next rebuild. Never a silent drop: every move is logged.
  const devIncludesEverything = process.env.MARINARA_CATALOG_INCLUDE_INCOMPLETE === "1";
  const publishedPackages = [];
  const previewPackages = [];
  for (const entry of catalog.packages) {
    const id = entry.manifest.id;
    if (devIncludesEverything) {
      if (INCOMPLETE_PACKAGE_IDS.has(id) || STAGING_ONLY_PACKAGE_IDS.has(id)) {
        console.log(`catalog: INCLUDING held-back package ${id} in the published lanes (dev build — do not commit)`);
      }
      publishedPackages.push(entry);
      continue;
    }
    if (INCOMPLETE_PACKAGE_IDS.has(id)) {
      console.log(`catalog: excluding incomplete package ${id} ${entry.manifest.version} from every catalog`);
      continue;
    }
    if (STAGING_ONLY_PACKAGE_IDS.has(id)) {
      console.log(`catalog: routing staging-only package ${id} ${entry.manifest.version} to the preview overlay`);
      previewPackages.push(entry);
      continue;
    }
    publishedPackages.push(entry);
  }
  const published = { ...catalog, packages: publishedPackages };
  const catalogsByMajor = createCatalogLanes(published);
  await mkdir(catalogDirectory, { recursive: true });
  await writePreviewOverlay(repoRoot, { ...catalog, packages: previewPackages });

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
