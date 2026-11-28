// Rebuild documentation sidecars through the shared catalog writer.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCatalogFamily, writeCatalogFamily } from "./catalog-lanes.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { catalog } = await readCatalogFamily(repoRoot);
await writeCatalogFamily(repoRoot, catalog);
console.log("Documentation sidecars built.");
