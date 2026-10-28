import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogArtworkRelativePath, catalogArtworkUrl } from "./catalog-artwork.mjs";
import { resolveCatalogGeneratedAt } from "./catalog-lanes.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = join(repoRoot, "catalog/catalog.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

for (const entry of catalog.packages) {
  const packageId = entry.manifest.id;
  await access(join(repoRoot, catalogArtworkRelativePath(packageId)));
  entry.iconUrl = catalogArtworkUrl(packageId);
}

catalog.generatedAt = await resolveCatalogGeneratedAt(join(repoRoot, "catalog"));
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Catalog artwork synced: ${catalog.packages.length} packages.`);
