import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEnglishPackageLocale,
  readPackageAgentDefinitions,
  readPackageManifest,
  serializePackageLocale,
  writeEnglishPackageLocale,
} from "./package-locales.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesRoot = join(repoRoot, "packages");
const checkOnly = process.argv.includes("--check");
const requestedIds = new Set(process.argv.slice(2).filter((argument) => argument !== "--check"));
const packageIds = (await readdir(packagesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((id) => requestedIds.size === 0 || requestedIds.has(id))
  .sort();

if (requestedIds.size > 0 && packageIds.length !== requestedIds.size) {
  const knownIds = new Set(packageIds);
  const unknownIds = [...requestedIds].filter((id) => !knownIds.has(id));
  throw new Error(`Unknown package${unknownIds.length === 1 ? "" : "s"}: ${unknownIds.join(", ")}`);
}

const drifted = [];
for (const id of packageIds) {
  const packageRoot = join(packagesRoot, id);
  const manifest = await readPackageManifest(packageRoot);
  if (!manifest) continue;
  if (!manifest.entrypoints?.agents) continue;
  const agentDefinitions = await readPackageAgentDefinitions(packageRoot, manifest);
  const expected = serializePackageLocale(buildEnglishPackageLocale(manifest, agentDefinitions));

  if (checkOnly) {
    const localePath = join(packageRoot, "locales", "en.json");
    const actual = await readFile(localePath, "utf8").catch(() => "");
    if (actual !== expected) drifted.push(id);
    continue;
  }

  await writeEnglishPackageLocale(packageRoot, manifest, agentDefinitions);
}

if (drifted.length > 0) {
  throw new Error(
    `English package localization catalogs are stale for: ${drifted.join(", ")}. Run node scripts/sync-package-locales.mjs.`,
  );
}

console.log(
  checkOnly
    ? `Package localization catalogs are synchronized (${packageIds.length} checked).`
    : `Package localization catalogs synchronized (${packageIds.length} written).`,
);
