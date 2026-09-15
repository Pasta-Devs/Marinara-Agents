import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Packages bundle Engine UI components but own their locale catalog, so a component pulled in from
// a shared folder can ship with no strings and render raw key names. Compare the keys the built
// bundle actually references against the catalog that ships beside it.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesRoot = join(repoRoot, "packages");
const catalogPath = "src/engine/packages/client/src/localization/locales/en.json";
// i18next resolves a plural key through its suffixed variants, so a bare reference is satisfied by
// any of them.
const pluralSuffixes = ["", "_zero", "_one", "_two", "_few", "_many", "_other"];

async function readOptionalJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

const failures = [];
for (const entry of await readdir(packagesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const catalog = await readOptionalJson(join(packagesRoot, entry.name, catalogPath));
  if (!catalog) continue;
  let bundle;
  try {
    bundle = await readFile(join(packagesRoot, entry.name, "client.js"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  const referenced = new Set([...bundle.matchAll(/"(ui\.[a-zA-Z0-9_.]+)"/gu)].map((match) => match[1]));
  const missing = [...referenced]
    .filter((key) => !pluralSuffixes.some((suffix) => `${key}${suffix}` in catalog))
    .sort();
  if (missing.length > 0) failures.push({ id: entry.name, missing });
}

if (failures.length > 0) {
  for (const { id, missing } of failures) {
    console.error(`${id}: ${missing.length} bundled localization key(s) missing from en.json`);
    for (const key of missing) console.error(`  ${key}`);
  }
  process.exitCode = 1;
} else {
  console.log("Package localization keys validated");
}
