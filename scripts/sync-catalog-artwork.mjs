import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  catalogArtworkRelativePath,
  catalogArtworkUrl,
} from "./catalog-artwork.mjs";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const catalogPath = join(repoRoot, "catalog/catalog.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

for (const entry of catalog.packages) {
  const packageId = entry.manifest.id;
  await access(join(repoRoot, catalogArtworkRelativePath(packageId)));
  entry.iconUrl = catalogArtworkUrl(packageId);
}

catalog.generatedAt = new Date().toISOString();
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Catalog artwork synced: ${catalog.packages.length} packages.`);
