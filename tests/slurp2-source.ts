import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Source-reading tests name Slurp2 files by their historical paths. Those paths are logical module
 * keys: when a monolith is split, its key maps to every file that now holds it, so a negative
 * assertion stays module-wide instead of passing vacuously against one fragment.
 *
 * Keys are relative to `packages/slurp2/src/engine/`. Until a file moves, its key maps to itself.
 * Unmapped paths under a moved directory are not redirected; add a key for each moved file.
 */
export const SLURP2_SOURCE_MODULES: Record<string, readonly string[]> = {
  "packages/client/src/components/slurp/SlurpHome.tsx": ["packages/client/src/components/slurp/SlurpHome.tsx"],
  "packages/client/src/components/slurp/SlurpMessages.tsx": ["packages/client/src/components/slurp/SlurpMessages.tsx"],
  "packages/client/src/hooks/use-slurp.ts": ["packages/client/src/hooks/use-slurp.ts"],
  "packages/server/src/routes/slurp.routes.ts": ["packages/server/src/routes/slurp.routes.ts"],
  "packages/server/src/services/storage/slurp.storage.ts": ["packages/server/src/services/storage/slurp.storage.ts"],
  "packages/client/src/slurp-package-entry.tsx": ["packages/client/src/slp/slp-client-entry.tsx"],
  "packages/server/src/services/slurp/server-entry.ts": ["packages/server/src/slp/slp-server-entry.ts"],
  "packages/shared/src/slurp-autopurge-time.ts": ["packages/shared/src/slp/slp-autopurge-time.ts"],
  "packages/client/src/localization/locales/en.json": ["packages/client/src/slp/locales/en.json"],
  "packages/client/src/localization/locales/de.json": ["packages/client/src/slp/locales/de.json"],
  "packages/client/src/localization/locales/ko.json": ["packages/client/src/slp/locales/ko.json"],
  "packages/client/src/localization/locales/pl.json": ["packages/client/src/slp/locales/pl.json"],
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
