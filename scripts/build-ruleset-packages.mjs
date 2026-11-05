// Build every `ruleset` package: re-derive its manifest hashes from the committed
// asset bytes, write a reproducible ruleset file (`<id>-<version>.ruleset.json`, never a zip), and update
// the catalog family.
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
import { assertPortableFilenameComponent, resolveContainedPortablePath } from "./catalog-path-safety.mjs";
import {
  assertRulesetFileCapability,
  packageFileBuffer,
  RULESET_FILE_FORMAT,
  rulesetArtifactName,
} from "./package-file.mjs";
import { writeEnglishPackageLocale } from "./package-locales.mjs";
import {
  RULESET_ASSET_PATH,
  assertRulesetBattle,
  assertRulesetSheetMigrations,
  assertRulesetPoses,
  assertRulesetStartingGear,
  assertRulesetSellerHonesty,
  assertRulesetSheetHooks,
  assertRulesetApplies,
  assertRulesetCatalogs,
  assertRulesetCombat,
  assertRulesetCreatures,
  assertRulesetItems,
  assertRulesetPackageContract,
  assertRulesetCoverlessSaves,
  assertRulesetReactions,
  assertRulesetScaled,
  assertRulesetLanguagePacks,
  assertRulesetLocales,
  isRulesetCatalogAssetPath,
  meetsRulesetLanguagePacks,
  rulesetLanguagePackName,
  isRulesetTranslationDocument,
  rulesetLocaleOfAssetPath,
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
  // and packed exactly like the ruleset file beside it.
  // Its translations (Capability API 1.806): every locales/<language>.json with a `ruleset` section is
  // shipped beside the catalogs, in name order; the package's own English listing (locales/en.json) is not.
  const localeNames = (await readdir(join(packageRoot, "locales"), { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isFile() && rulesetLocaleOfAssetPath(`locales/${entry.name}`))
    .map((entry) => `locales/${entry.name}`)
    .sort();
  const translations = [];
  for (const name of localeNames) {
    const path = await resolveContainedPortablePath(packageRoot, name, `Ruleset translation for ${id}`);
    if (isRulesetTranslationDocument(JSON.parse(await readFile(path, "utf8")))) translations.push(name);
  }
  // From Capability API 1.811 each one is a language pack of its own instead, beside the ruleset file,
  // and the Engine fetches only the language it is set to.
  const asPacks = meetsRulesetLanguagePacks(manifest);
  manifest.contributions.assets.paths = [
    ...(manifest.contributions?.assets?.paths ?? []).filter((path) => rulesetLocaleOfAssetPath(path) === null),
    ...(asPacks ? [] : translations),
  ];
  const packs = new Map();
  if (asPacks) {
    for (const name of translations) {
      const path = await resolveContainedPortablePath(packageRoot, name, `Ruleset translation for ${id}`);
      packs.set(rulesetLocaleOfAssetPath(name), await readFile(path));
    }
  }
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
  assertRulesetLocales(
    manifest,
    new Map(
      payloads
        .filter(({ name }) => rulesetLocaleOfAssetPath(name) !== null)
        .map(({ name, buffer }) => [name, buffer.toString("utf8")]),
    ),
  );
  assertRulesetLanguagePacks(
    manifest,
    new Map([...packs].map(([locale, buffer]) => [locale, buffer.toString("utf8")])),
  );
  assertRulesetBattle(manifest, rulesetDocument);
  assertRulesetSheetMigrations(manifest, rulesetDocument);
  assertRulesetPoses(manifest, rulesetDocument);
  assertRulesetStartingGear(manifest, rulesetDocument, catalogSources);
  assertRulesetSellerHonesty(manifest, rulesetDocument, catalogSources);
  assertRulesetSheetHooks(manifest, rulesetDocument, catalogSources);
  // A scaled column is read from the same bytes and gated the same way, so it is checked here too.
  assertRulesetScaled(manifest, rulesetDocument, catalogSources);
  // So are the combat block and the bestiary that is written in its names.
  assertRulesetCombat(manifest, rulesetDocument);
  assertRulesetCreatures(manifest, rulesetDocument, catalogSources);
  assertRulesetItems(manifest, rulesetDocument, catalogSources);
  // And a reaction that names the moment it waits for, which has its own version too.
  assertRulesetReactions(manifest, rulesetDocument, catalogSources);
  assertRulesetCoverlessSaves(manifest, rulesetDocument, catalogSources);
  // And how the conditions an entry applies come off, which has its own version too.
  assertRulesetApplies(manifest, rulesetDocument, catalogSources);

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

  // A ruleset ships as one ruleset file, never a package zip: the Engine refuses a catalog ruleset zip.
  assertRulesetFileCapability(manifest);
  const archive = packageFileBuffer(
    RULESET_FILE_FORMAT,
    manifest,
    payloads.map(({ name, buffer }) => ({ path: name, data: buffer })),
  );
  await mkdir(artifactsDir, { recursive: true });
  const artifactName = rulesetArtifactName(id, manifest.version);
  const artifactPath = await resolveContainedPortablePath(artifactsDir, artifactName, `Artifact for ${id}`, {
    allowMissing: true,
  });
  await writeFile(artifactPath, archive);
  // Each language pack as it is committed, and its store card text, which stays in the catalog.
  const locales = {};
  for (const [locale, buffer] of packs) {
    const packName = rulesetLanguagePackName(id, manifest.version, locale);
    const packPath = await resolveContainedPortablePath(artifactsDir, packName, `Language pack for ${id}`, {
      allowMissing: true,
    });
    await writeFile(packPath, buffer);
    const listing = JSON.parse(buffer.toString("utf8")).package ?? {};
    locales[locale] = {
      url: `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/${packName}`,
      sha256: sha256(buffer),
      bytes: buffer.byteLength,
      ...(typeof listing.name === "string" ? { name: listing.name } : {}),
      ...(typeof listing.description === "string" ? { description: listing.description } : {}),
    };
  }

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
      ...(packs.size ? { locales } : {}),
      documentationUrl: RULESET_DOCUMENTATION_URL,
    },
    payloadCount: payloads.length,
    bytes: archive.byteLength,
    packCount: packs.size,
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

  for (const { entry, payloadCount, bytes, packCount } of rebuilt) {
    console.log(`built ${entry.manifest.id} ${entry.manifest.version}`);
    console.log(
      `  ${payloadCount} asset file(s), artifact ${bytes} bytes${packCount ? `, ${packCount} language pack(s)` : ""}`,
    );
  }
}
