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
  app.get("/settings", async () => getLtmGlobalSettings(root));
  // Settings that change the recall index persist first, then rebuild under the
  // reentrant vault lock so a concurrent recall never sees the new settings beside a
  // stale index. A failed rebuild is reported as deferred without rolling the save back.
  app.post("/settings/reset", async () =>
    withLtmVaultLock(root, async () => {
      const before = effectiveIndexStopWords(await getLtmGlobalSettings(root));
      const result = await resetLongTermMemorySettings(root);
      const after = effectiveIndexStopWords(await getLtmGlobalSettings(root));
      return { ...result, rebuild: before === after ? null : await rebuildAfterMutation(root) };
    }),
  );
  app.put<{ Body: unknown }>("/settings", { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES }, async (request) =>
    withLtmVaultLock(root, async () => {
      const parsed = ltmGlobalSettingsSchema.parse(request.body ?? {});
      const before = effectiveIndexStopWords(await getLtmGlobalSettings(root));
      const saved = await updateLtmGlobalSettings(parsed, root);
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
