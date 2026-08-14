import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const files = [
  "packages/slurp/src/engine/packages/server/src/db/schema/slurp.ts",
  "packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts",
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts",
  "packages/slurp/src/engine/packages/server/src/services/slurp/server-entry.ts",
];
const source = files.map((file) => readFileSync(join(root, file), "utf8")).join("\n");
for (const marker of ["noodle_", "noodler_", "noodle.settings", "/api/noodle", "createNoodleStorage"]) {
  if (source.includes(marker)) throw new Error(`Slurp boundary contains legacy marker: ${marker}`);
}
