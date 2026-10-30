import { z } from "zod";
import {
  ltmGlobalSettingsSchema,
  type LtmResolvedGlobalSettings,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { getLtmExtractionConfig, updateLtmExtractionConfig } from "../extraction/extraction-config.js";
import { getLtmGlobalSettings, ltmGeneratedStopWords, updateLtmGlobalSettings } from "../settings.js";
import { buildStopWordSet } from "../recall/keyword-extract.js";
import { withLtmVaultLock } from "../persistence/vault-lock.js";
import { resetLongTermMemorySettings } from "../persistence/backup-restore.js";
import { listLtmPackageReaders } from "../services/storage-read.js";
import { ltmSetMessagesHiddenFromAI, showLtmHiddenMessages } from "../persistence/hidden-messages.js";
import { hideImportedChatMessages } from "../sources/interop.js";
import { logger } from "../package-runtime.js";
import type { FastifyInstance } from "fastify";
import {
  MAINTENANCE_BODY_LIMIT_BYTES,
  EXTRACTION_SETTINGS_BODY_LIMIT_BYTES,
  rebuildAfterMutation,
  type LtmRouteRuntime,
} from "./shared.js";

export function registerSettingsRoutes(app: FastifyInstance, runtime: LtmRouteRuntime) {
  const { root } = runtime;
  // The recall index fingerprints the effective generated stop-word set, so only a
  // change to that normalized set (or the filter flag that gates it) needs a rebuild.
  // Comparing the normalized set keeps equivalent spellings from rebuilding needlessly.
  const effectiveIndexStopWords = (settings: LtmResolvedGlobalSettings) =>
    JSON.stringify([...buildStopWordSet(ltmGeneratedStopWords(settings))].sort());
  // The page disables "Hide imported messages from the AI" on an Engine that cannot hide messages for a package.
  const withHideAvailability = <T extends object>(settings: T) => ({
    ...settings,
    hideImportedMessagesAvailable: ltmSetMessagesHiddenFromAI() !== null,
  });
  // Turning it on hides imported pieces now. While it is off, a save shows whatever it hid, so a failed show can
  // be retried by saving again. The setting is saved either way, so a failure is logged and the save goes on to its
  // index rebuild; a failed hide leaves the rest visible until each chat's next import.
  const applyHideImportedMessages = async (wasOn: boolean, settings: LtmResolvedGlobalSettings) => {
    const on = settings.longTermMemoryHideImportedMessages;
    if (on && wasOn) return;
    await (on ? hideImportedChatMessages(root) : showLtmHiddenMessages(root)).catch((error) =>
      logger.warn(
        error,
        on
          ? "[ltm] Could not hide imported chat messages from the AI"
          : "[ltm] Could not show hidden messages to the AI",
      ),
    );
  };
  app.get("/settings", async () => withHideAvailability(await getLtmGlobalSettings(root)));
  app.get("/settings/package-readers", async () => ({ readers: await listLtmPackageReaders(root) }));
  // Settings that change the recall index persist first, then rebuild under the
  // reentrant vault lock so a concurrent recall never sees the new settings beside a
  // stale index. A failed rebuild is reported as deferred without rolling the save back.
  app.post("/settings/reset", async () =>
    withLtmVaultLock(root, async () => {
      const before = effectiveIndexStopWords(await getLtmGlobalSettings(root));
      const result = await resetLongTermMemorySettings(root);
      const reset = await getLtmGlobalSettings(root);
      await applyHideImportedMessages(true, reset);
      const after = effectiveIndexStopWords(reset);
      return { ...result, rebuild: before === after ? null : await rebuildAfterMutation(root) };
    }),
  );
  app.put<{ Body: unknown }>("/settings", { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES }, async (request) =>
    withLtmVaultLock(root, async () => {
      const parsed = ltmGlobalSettingsSchema.parse(request.body ?? {});
      const current = await getLtmGlobalSettings(root);
      const before = effectiveIndexStopWords(current);
      const saved = await updateLtmGlobalSettings(parsed, root);
      await applyHideImportedMessages(current.longTermMemoryHideImportedMessages, saved);
      const after = effectiveIndexStopWords(saved);
      return { ...saved, rebuild: before === after ? null : await rebuildAfterMutation(root) };
    }),
  );
  app.get("/extraction-settings", async () => getLtmExtractionConfig(root));
  app.put<{ Body: unknown }>(
    "/extraction-settings",
    { bodyLimit: EXTRACTION_SETTINGS_BODY_LIMIT_BYTES },
    async (request, reply) => {
      try {
        return await updateLtmExtractionConfig(request.body ?? {}, root);
      } catch (error) {
        if (error instanceof z.ZodError) return reply.status(400).send({ error: error.message });
        throw error;
      }
    },
  );
}
