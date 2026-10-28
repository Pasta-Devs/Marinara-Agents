/**
 * Keeps the ad pool in step with the lorebook it was generated from.
 *
 * Generation is expensive, so this only fires when the book's content fingerprint actually
 * changed. A book that is edited twice between polls costs one regeneration, not two.
 */
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import type { GarnishAdsStorage } from "../../../services/garnish-ads/garnish-ads.storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { generateGarnishAds } from "./slp-garnish-generation-service.js";
import { generateGarnishAdImage } from "./slp-garnish-image-service.js";
import { readGarnishLorebookContext } from "./slp-garnish-lorebook.js";

export type GarnishLorebookSyncOutcome = "disabled" | "unchanged" | "missing" | "synced" | "failed";

/** Regenerate the pool when the selected lorebook has changed since the last sync. */

/** Back-off per lorebook after a failed sync. ponytail: in memory; a restart retries once. */
const failedSyncs = new Map<string, { revision: string; tries: number; retryAt: number }>();
export async function syncGarnishAdsWithLorebook(
  db: DB,
  pool: GarnishAdsStorage,
  options: { force?: boolean } = {},
): Promise<GarnishLorebookSyncOutcome> {
  const slurp = createSlurpStorage(db);
  const settings = await slurp.getSettings();
  if (!settings.inlineAdsLorebookId) return "disabled";

  const context = await readGarnishLorebookContext(db, settings.inlineAdsLorebookId);
  if (!context) {
    // The book was deleted or emptied. Drop the link so the pool stops claiming to follow it.
    await slurp.updateSettings({ inlineAdsLorebookId: null, inlineAdsLorebookRevision: null });
    return "missing";
  }
  if (!options.force && context.revision === settings.inlineAdsLorebookRevision) return "unchanged";
  // A failed run waits before it tries the same revision again: each try is two model calls, and the
  // scheduler polls every minute (R1-094). A new revision or a forced run goes at once.
  const failed = failedSyncs.get(settings.inlineAdsLorebookId);
  if (!options.force && failed?.revision === context.revision && Date.now() < failed.retryAt) return "failed";

  try {
    const items = await generateGarnishAds(db, pool, {
      connectionId: settings.generationConnectionId ?? undefined,
      tone: settings.inlineAdsTone,
      era: settings.inlineAdsEra,
      contentCeiling: settings.inlineAdsContentCeiling,
      worldContext: [context.text, settings.inlineAdsWorldContext].filter((part) => part.trim()).join("\n\n"),
    });
    if (settings.inlineAdsImagesEnabled) {
      for (const ad of items) {
        await generateGarnishAdImage(db, pool, ad, [settings.inlineAdsImageConnectionId]);
      }
    }
    // Recorded only after the ads land, so a failed run retries on the next poll.
    await slurp.updateSettings({ inlineAdsLorebookRevision: context.revision });
    logger.info("[garnish-ads] Synced %d ad(s) to the updated lorebook", items.length);
    return "synced";
  } catch (error) {
    logger.warn(error, "[garnish-ads] Could not sync the ad pool to its lorebook");
    const tries = failed?.revision === context.revision ? failed.tries + 1 : 1;
    failedSyncs.set(settings.inlineAdsLorebookId, {
      revision: context.revision,
      tries,
      // 10 minutes, doubling, at most a day.
      retryAt: Date.now() + Math.min(24 * 60, 10 * 2 ** (tries - 1)) * 60_000,
    });
    return "failed";
  }
}
