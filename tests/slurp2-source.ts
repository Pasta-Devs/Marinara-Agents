import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Source-reading tests name Slurp2 files by their historical paths. Those paths are logical module
 * keys: when a monolith is split, its key maps to every file that now holds it, so a negative
 * assertion stays module-wide instead of passing vacuously against one fragment.
 *
 * Keys are relative to `packages/slurp2/src/engine/`. Until a file moves, its key maps to itself.
 */
export const SLURP2_SOURCE_MODULES: Record<string, readonly string[]> = {
  "packages/client/src/components/slurp/SlurpHome.tsx": ["packages/client/src/components/slurp/SlurpHome.tsx"],
  "packages/client/src/components/slurp/SlurpMessages.tsx": ["packages/client/src/components/slurp/SlurpMessages.tsx"],
  "packages/client/src/hooks/use-slurp.ts": ["packages/client/src/hooks/use-slurp.ts"],
  "packages/server/src/routes/slurp.routes.ts": ["packages/server/src/routes/slurp.routes.ts"],
  "packages/server/src/services/storage/slurp.storage.ts": ["packages/server/src/services/storage/slurp.storage.ts"],
};

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const engineRoot = join(repoRoot, "packages/slurp2/src/engine");
const ENGINE_PREFIX = "packages/slurp2/src/engine/";

/** Reads a Slurp2 source by logical key; any other path is read directly, exactly as given. */
export function slurp2Source(path: string | URL): string {
  const text = path instanceof URL ? fileURLToPath(path) : path;
  const at = text.replaceAll("\\", "/").lastIndexOf(ENGINE_PREFIX);
  const files = at < 0 ? undefined : SLURP2_SOURCE_MODULES[text.slice(at + ENGINE_PREFIX.length)];
  if (!files) return readFileSync(path, "utf8");
  return files.map((file) => readFileSync(join(engineRoot, file), "utf8")).join("\n");
}
