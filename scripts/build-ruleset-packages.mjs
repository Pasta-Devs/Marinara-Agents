// Build every `ruleset` package: re-derive its manifest hashes from the committed
// asset bytes, write a reproducible artifact zip, and update the catalog family.
//
// Rulesets need their own builder because the other builders are agent-shaped:
// build-agent-catalog.mjs derives the artifact and the catalog category from the
// package's agents.json, and a ruleset has none. This one derives everything from
// the declared assets instead. It still writes through writeCatalogFamily, so the
// INCOMPLETE / STAGING_ONLY tiers and the preview overlay are honoured exactly as
// they are for every other package.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogArtworkUrl } from "./catalog-artwork.mjs";
import { readCatalogFamily, writeCatalogFamily } from "./catalog-lanes.mjs";
import { withPackageActivationGuidance } from "./catalog-package-guidance.mjs";
import {
  assertPortableFilenameComponent,
  packageArtifactName,
  resolveContainedPortablePath,
} from "./catalog-path-safety.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { writeEnglishPackageLocale } from "./package-locales.mjs";
import {
  RULESET_ASSET_PATH,
  assertRulesetBattle,
  assertRulesetCatalogs,
  assertRulesetCombat,
  assertRulesetCreatures,
  assertRulesetPackageContract,
  assertRulesetReactions,
  assertRulesetScaled,
  isRulesetCatalogAssetPath,
} from "./ruleset-package-checks.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(repoRoot, "packages");
const artifactsDir = join(repoRoot, "artifacts");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// Rulesets are pure data with no Engine documentation page of their own; the
// Game Mode guide's rules section is where a user learns what choosing one does.
const RULESET_DOCUMENTATION_URL =
  "https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/game/getting-started.md#choosing-rules";

const packageIds = (await readdir(packagesDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => assertPortableFilenameComponent(entry.name, "Package directory id"))
  .sort();

const rebuilt = [];
for (const id of packageIds) {
  const packageRoot = await resolveContainedPortablePath(packagesDir, id, `Package directory for ${id}`);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(packageRoot, "manifest.json"), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
  if (!manifest.kind?.includes("ruleset")) continue;
  if (manifest.id !== id) throw new Error(`Package directory ${id} contains manifest id ${manifest.id}`);

  manifest.description = withPackageActivationGuidance(id, manifest.description);

  // The declared asset paths are the contract; their hashes and sizes are
  // re-derived from the committed bytes so they can never drift from what ships.
  // `catalogs/<id>.json` assets ride the same path, so a catalog is hash-pinned
  // and zipped exactly like the ruleset file beside it.
  const assetPaths = manifest.contributions?.assets?.paths ?? [];
  const payloads = [];
  for (const assetPath of assetPaths) {
    const path = await resolveContainedPortablePath(packageRoot, assetPath, `Ruleset asset for ${id}`);
    payloads.push({ name: assetPath, buffer: await readFile(path) });
  }
  manifest.files = payloads.map(({ name, buffer }) => ({
    path: name,
    sha256: sha256(buffer),
    bytes: buffer.byteLength,
  }));
  // Fail here rather than emitting a catalog entry the validator would reject.
  assertRulesetPackageContract(manifest);
  const rulesetPayload = payloads.find(({ name }) => name === RULESET_ASSET_PATH);
  const rulesetDocument = JSON.parse(rulesetPayload.buffer.toString("utf8"));
  const catalogSources = new Map(
    payloads
      .filter(({ name }) => isRulesetCatalogAssetPath(name))
      .map(({ name, buffer }) => [name, buffer.toString("utf8")]),
  );
  assertRulesetCatalogs(manifest, rulesetDocument, catalogSources);
  assertRulesetBattle(manifest, rulesetDocument);
  // A scaled column is read from the same bytes and gated the same way, so it is checked here too.
  assertRulesetScaled(manifest, rulesetDocument, catalogSources);
  // So are the combat block and the bestiary that is written in its names.
  assertRulesetCombat(manifest, rulesetDocument);
  assertRulesetCreatures(manifest, rulesetDocument, catalogSources);
  // And a reaction that names the moment it waits for, which has its own version too.
  assertRulesetReactions(manifest, rulesetDocument, catalogSources);

  // Written back only when something actually changed, so a no-op rebuild leaves
  // the tree byte-identical and does not show up as a spurious diff in a PR.
  const manifestPath = join(packageRoot, "manifest.json");
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const committedManifest = await readFile(manifestPath).catch(() => null);
  if (!committedManifest || !committedManifest.equals(manifestBuffer)) {
    await writeFile(manifestPath, manifestBuffer);
  }
  // A ruleset has no Agents, so the English catalog carries package metadata only.
  await writeEnglishPackageLocale(packageRoot, manifest, []);

  const archive = createDeterministicZip([
    { name: "manifest.json", data: manifestBuffer },
    ...payloads.map(({ name, buffer }) => ({ name, data: buffer })),
  ]);
  await mkdir(artifactsDir, { recursive: true });
  const artifactName = packageArtifactName(id, manifest.version);
  const artifactPath = await resolveContainedPortablePath(artifactsDir, artifactName, `Artifact for ${id}`, {
    allowMissing: true,
  });
  await writeFile(artifactPath, archive);

  rebuilt.push({
    entry: {
      manifest,
      category: "misc",
      iconUrl: catalogArtworkUrl(id),
      artifact: {
        url: `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/${artifactName}`,
        sha256: sha256(archive),
        bytes: archive.byteLength,
      },
      documentationUrl: RULESET_DOCUMENTATION_URL,
    },
    payloadCount: payloads.length,
    bytes: archive.byteLength,
  });
}

if (rebuilt.length === 0) {
  console.log("No ruleset packages found; nothing to build.");
} else {
  const rebuiltIds = new Set(rebuilt.map(({ entry }) => entry.manifest.id));
  const { catalog } = await readCatalogFamily(repoRoot);
  catalog.packages = [
    ...catalog.packages.filter((entry) => !rebuiltIds.has(entry.manifest.id)),
    ...rebuilt.map(({ entry }) => entry),
  ].sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
  // generatedAt is resolved centrally in writeCatalogFamily (preserved by
  // default; refreshed only when MARINARA_CATALOG_STAMP_GENERATED_AT=1).
  await writeCatalogFamily(repoRoot, catalog);

  for (const { entry, payloadCount, bytes } of rebuilt) {
    console.log(`built ${entry.manifest.id} ${entry.manifest.version}`);
    console.log(`  ${payloadCount} asset file(s), artifact ${bytes} bytes`);
  }
}
