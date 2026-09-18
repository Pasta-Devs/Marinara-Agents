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
  "packages/server/src/routes/slurp.routes.ts": [
    "packages/server/src/slp/base/host/slp-request-schemas.ts",
    "packages/server/src/slp/base/host/slp-multipart.ts",
    "packages/server/src/slp/base/host/slp-route-host.ts",
    "packages/server/src/slp/base/settings/slp-settings-routes.ts",
    "packages/server/src/slp/features/audience/slp-audience-routes.ts",
    "packages/server/src/slp/features/maintenance/slp-maintenance-routes.ts",
    "packages/server/src/slp/features/projects/slp-projects-routes.ts",
    "packages/server/src/slp/features/discovery/slp-discovery-routes.ts",
    "packages/server/src/slp/features/creators/slp-creators-routes.ts",
    "packages/server/src/slp/features/creators/improvement/slp-improvement-jobs.ts",
    "packages/server/src/slp/features/creators/improvement/slp-improvement-routes.ts",
    "packages/server/src/slp/features/maintenance/slp-backup-jobs.ts",
    "packages/server/src/slp/features/maintenance/slp-backup-routes.ts",
    "packages/server/src/slp/features/economy/slp-wallet-routes.ts",
    "packages/server/src/slp/base/media/slp-media-routes.ts",
    "packages/server/src/slp/base/host/slp-viewer-context.ts",
    "packages/server/src/slp/features/notifications/slp-notifications-routes.ts",
    "packages/server/src/slp/features/notifications/slp-notification-read-model.ts",
    "packages/server/src/slp/workflows/slp-world-tick-workflow.ts",
    "packages/server/src/slp/features/economy/slp-studio-routes.ts",
    "packages/server/src/slp/features/feed/slp-feed-viewer-routes.ts",
    "packages/server/src/slp/features/ads/slp-ads-routes.ts",
    "packages/server/src/slp/features/feed/slp-feed-post-routes.ts",
    "packages/server/src/slp/features/onboarding/slp-onboarding-routes.ts",
    "packages/server/src/slp/features/feed/slp-feed-publishing-routes.ts",
  ],
  "packages/server/src/routes/slurp-messages.routes.ts": [
    "packages/server/src/slp/features/messages/slp-messages-schemas.ts",
    "packages/server/src/slp/features/messages/slp-messages-context.ts",
    "packages/server/src/slp/features/messages/slp-messages-thread-routes.ts",
    "packages/server/src/slp/features/messages/slp-messages-send-routes.ts",
    "packages/server/src/slp/features/messages/slp-messages-creator-routes.ts",
    "packages/server/src/slp/features/messages/commissions/slp-commissions-routes.ts",
    "packages/server/src/slp/features/messages/slp-messages-media-routes.ts",
    "packages/server/src/slp/features/messages/slp-messages-routes.ts",
  ],
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
