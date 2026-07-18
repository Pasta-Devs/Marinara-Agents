import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPackagePrivateImportBoundary } from "./hierarchical-maps-boundary.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const longTermMemorySourceRoot = resolve(
  repoRoot,
  "packages/long-term-memory/src/engine",
);
export const longTermMemoryBoundaryPath = resolve(
  repoRoot,
  "packages/long-term-memory/engine-boundary.json",
);

export function assertLongTermMemoryPrivateImportBoundary() {
  return assertPackagePrivateImportBoundary({
    sourceRoot: longTermMemorySourceRoot,
    boundaryPath: longTermMemoryBoundaryPath,
    displayName: "Long-Term Memory",
    capabilityApi: { major: 1, minor: 4 },
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await assertLongTermMemoryPrivateImportBoundary();
  process.stdout.write("Long-Term Memory private import boundary: ok\n");
}
