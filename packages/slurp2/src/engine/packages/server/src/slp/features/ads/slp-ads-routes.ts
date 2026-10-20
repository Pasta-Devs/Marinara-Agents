import { z } from "zod";
import { SLURP_GARNISH_PLATFORM, garnishContextForViewer } from "./slp-garnish-context.js";
import { newId } from "../../../utils/id-generator.js";
import { unlinkGarnishAdImage, resolveGarnishAdImageAbsolutePath } from "./slp-garnish-image.js";
import { generateGarnishAdImage } from "./slp-garnish-image-service.js";
import { basename } from "path";
import { existsSync } from "fs";
import { resolveCreatorMediaVariant, sendSlurpImageFile } from "../../base/media/slp-media.js";
import { syncGarnishAdsWithLorebook } from "./slp-garnish-sync-service.js";
import { createLorebooksStorage } from "../../../services/storage/lorebooks.storage.js";
import { readGarnishLorebookContext } from "./slp-garnish-lorebook.js";
import { generateGarnishAds, retireWeakGarnishAds } from "./slp-garnish-generation-service.js";
import { qualityScores } from "../../../services/garnish-ads/garnish-ads.rating.js";
import { garnishAdBrandId, type GarnishAd } from "../../../services/garnish-ads/garnish-ads.types.js";
import {
  exportGarnishAds,
  importGarnishAds,
  GARNISH_EXPORT_VERSION,
} from "../../../services/garnish-ads/garnish-ads.export.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { slurpPromptContext } from "../../base/prompting/slp-prompt-blocks.js";

export async function slpAdsRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { ads, characters, noodle, resolveViewerPersona } = deps;
  const garnishAdInputSchema = z.object({
    id: z.string().trim().min(1).max(120).optional(),
    kind: z.enum(["creator", "inline"]).default("inline"),
    brand: z.string().trim().min(1).max(80),
    product: z.string().trim().min(1).max(120),
    copy: z.string().trim().min(1).max(600),
    priceFeel: z.enum(["budget", "everyday", "premium"]).optional(),
    look: z.string().trim().max(400).optional(),
    categories: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
    contextTags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
    imageUrl: z.string().trim().max(2048).nullable().optional(),
    wideImageUrl: z.string().trim().max(2048).nullable().optional(),
    actionLabel: z.string().trim().min(1).max(40).optional(),
    contentRating: z.enum(["tame", "suggestive", "explicit"]).default("tame"),
  });

  app.get("/slurp/viewer/ads", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        creatorId: z.string().trim().min(1).optional(),
        contextTags: z.string().optional(),
      })
      .safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const settings = await noodle.getSettings();
    if (!settings.inlineAdsEnabled) return { items: [] };
    const persona = await characters.getPersona(parsed.data.personaId);
    const creator = parsed.data.creatorId ? await noodle.getNoodlerAccountById(parsed.data.creatorId) : null;
    const items = await ads.listInline(
      parsed.data.personaId,
      SLURP_GARNISH_PLATFORM,
      garnishContextForViewer({
        persona,
        creator,
        contextTags: parsed.data.contextTags?.split(",") ?? [],
        preferredTags: settings.inlineAdsPreferredTags,
        steering: settings.inlineAdsSteering,
        contentCeiling: settings.inlineAdsContentCeiling,
      }),
    );
    // Rotation is only real if what was served is written down.
    await ads.markRecent(
      parsed.data.personaId,
      items.map((item) => item.id),
    );
    for (const item of items) await ads.record(parsed.data.personaId, item.id, "impression");
    // The brand's logo is the ad's avatar (R); a brand without one shows its initials.
    const logos = new Map(
      (await ads.pool.listBrands(SLURP_GARNISH_PLATFORM)).map((brand) => [brand.id, brand.logoUrl ?? null]),
    );
    return { items: items.map((item) => ({ ...item, brandLogoUrl: logos.get(garnishAdBrandId(item)) ?? null })) };
  });

  app.post("/slurp/viewer/ads/:id/hide", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.hide(parsed.data.personaId, (req.params as { id: string }).id);
  });

  app.post("/slurp/viewer/ads/reset", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.reset(parsed.data.personaId);
  });

  app.post("/slurp/viewer/ads/:id/action", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const adId = (req.params as { id: string }).id;
    if (!(await ads.canAct(parsed.data.personaId, SLURP_GARNISH_PLATFORM, adId))) {
      return reply.code(404).send({ error: "Slurp ad not found" });
    }
    await ads.record(parsed.data.personaId, adId, "action");
    // Acting on an ad pays, capped per day. The wallet applies the cap, so a capped-out day
    // quietly pays nothing rather than failing the click.
    const wallet = await noodle.earnCoins(parsed.data.personaId, "ad", adId);
    return { ok: true, coins: wallet.coins };
  });

  app.post("/slurp/viewer/ads/brand/hide", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), brand: z.string().trim().min(1).max(80) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.hideBrand(parsed.data.personaId, parsed.data.brand);
  });

  app.post("/slurp/viewer/ads/brand/unhide", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), brand: z.string().trim().min(1).max(80) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.unhideBrand(parsed.data.personaId, parsed.data.brand);
  });

  app.get("/slurp/viewer/ads/state", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const [state, all] = await Promise.all([
      ads.state(parsed.data.personaId),
      ads.pool.listAll(SLURP_GARNISH_PLATFORM),
    ]);
    const byId = new Map(all.map((ad) => [ad.id, ad]));
    return {
      hiddenBrands: state.hiddenBrands,
      hidden: state.hiddenAdIds.map((id) => byId.get(id) ?? null).filter(Boolean),
      seen: state.recentAdIds.map((id) => byId.get(id) ?? null).filter(Boolean),
    };
  });

  // ── Ad pool authoring ─────────────────────────────────────────────
  app.get("/slurp/ads/pool", async () => ({ items: await ads.pool.listAll(SLURP_GARNISH_PLATFORM) }));

  app.post("/slurp/ads/pool", async (req, reply) => {
    const parsed = garnishAdInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const input = parsed.data;
    return ads.pool.add({
      ...input,
      id: input.id ?? `user-${newId()}`,
      platform: SLURP_GARNISH_PLATFORM,
      origin: "user",
      createdAt: new Date().toISOString(),
    });
  });

  app.delete("/slurp/ads/pool/:id", async (req) => {
    const { id } = req.params as { id: string };
    // Scoped to Slurp: the pool is shared with other Garnish platforms, whose ads this route owns no
    // part of.
    const existing = (await ads.pool.listAll(SLURP_GARNISH_PLATFORM)).find((ad) => ad.id === id);
    if (!existing) return { ok: true };
    // Otherwise every deleted ad leaves its artwork behind on disk forever. Builtins are only
    // hidden, but artwork generated for an edited builtin is still ours to clean up.
    const generatedImageUrl = await ads.pool.releaseGeneratedImage(id);
    await ads.pool.remove(id);
    if (existing.origin !== "builtin") unlinkGarnishAdImage(id, existing.imageUrl);
    else if (generatedImageUrl) unlinkGarnishAdImage(id, generatedImageUrl);
    // A builtin ships no banner, so a wide picture is always one Slurp drew.
    unlinkGarnishAdImage(id, existing.wideImageUrl);
    return { ok: true };
  });

  const garnishAdPatchSchema = garnishAdInputSchema
    .omit({ id: true })
    .partial()
    .extend({ retiredAt: z.null().optional() });

  app.patch("/slurp/ads/pool/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = garnishAdPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    // Scoped like the other pool routes: an id from another Garnish platform is not editable here.
    const existing = (await ads.pool.listAll(SLURP_GARNISH_PLATFORM)).find((ad) => ad.id === id);
    if (!existing) return reply.code(404).send({ error: "Not Found" });
    // A new feed picture makes the old banner a picture of something else: wide slots crop the new one.
    const replacesPicture =
      parsed.data.imageUrl !== undefined &&
      parsed.data.imageUrl !== existing.imageUrl &&
      parsed.data.wideImageUrl === undefined;
    const updated = await ads.pool.update(id, replacesPicture ? { ...parsed.data, wideImageUrl: null } : parsed.data);
    if (updated && replacesPicture) unlinkGarnishAdImage(id, existing.wideImageUrl);
    if (!updated) return reply.code(404).send({ error: "Not Found" });
    return updated;
  });

  app.post("/slurp/ads/:id/image", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ad = (await ads.pool.listAll(SLURP_GARNISH_PLATFORM)).find((row) => row.id === id);
    if (!ad) return reply.code(404).send({ error: "Not Found" });
    const settings = await noodle.getSettings();
    const outcome = await generateGarnishAdImage(app.db, ads.pool, ad, [settings.inlineAdsImageConnectionId]);
    if (outcome === "unavailable") {
      return reply.code(400).send({ error: "Select an image generation connection first." });
    }
    if (outcome === "failed") return reply.code(502).send({ error: "Could not generate that image." });
    const updated = (await ads.pool.listAll(SLURP_GARNISH_PLATFORM)).find((row) => row.id === id);
    return { ad: updated ?? ad };
  });

  app.get("/noodler/ads/:id/image/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const ad = (await ads.pool.listAll()).find((row) => row.id === id);
    // A brand's logo lives under the same route, keyed by the brand id (R).
    const brand = ad ? null : (await ads.pool.listBrands()).find((row) => row.id === id);
    // The feed picture or the wide banner, whichever this file name is.
    const absolute = [ad?.imageUrl, ad?.wideImageUrl, brand?.logoUrl]
      .map((url) => resolveGarnishAdImageAbsolutePath(id, url))
      .find((path) => path && basename(path) === fileName);
    if (!absolute || !existsSync(absolute)) {
      return reply.code(404).send({ error: "Not Found" });
    }
    const width = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((req.query as { width?: string }).width);
    const served = await resolveCreatorMediaVariant(absolute, width.success ? width.data : undefined);
    return sendSlurpImageFile(reply.header("Cache-Control", "private, max-age=31536000, immutable"), served);
  });

  app.post("/slurp/ads/lorebook/sync", async (req, reply) => {
    const parsed = z.object({ force: z.boolean().optional() }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const outcome = await syncGarnishAdsWithLorebook(app.db, ads.pool, { force: parsed.data.force });
    if (outcome === "failed") return reply.code(502).send({ error: "Could not sync the pool to that lorebook." });
    return { outcome };
  });

  app.get("/slurp/ads/lorebooks", async () => ({
    // Lorebook rows are typed through Record<string, unknown>, so id and name are read rather
    // than accessed off the declared type.
    items: (await createLorebooksStorage(app.db).list())
      .map((book) => book as { id?: unknown; name?: unknown })
      .filter((book): book is { id: string; name: string } => typeof book.id === "string")
      .map((book) => ({ id: book.id, name: typeof book.name === "string" ? book.name : book.id })),
  }));

  app.post("/slurp/ads/generate", async (req, reply) => {
    const parsed = z
      .object({ connectionId: z.string().trim().min(1).optional(), count: z.number().int().min(1).max(10).optional() })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const settings = await noodle.getSettings();
    try {
      // A selected lorebook is the setting the ads live in, so it leads the world context.
      const lorebook = settings.inlineAdsLorebookId
        ? await readGarnishLorebookContext(app.db, settings.inlineAdsLorebookId)
        : null;
      const items = await generateGarnishAds(app.db, ads.pool, {
        // Ads generate through the same connection as the rest of Slurp; only the main
        // connection was consulted before, so a Slurp-only setup could never generate.
        connectionId: parsed.data.connectionId ?? settings.generationConnectionId ?? undefined,
        count: parsed.data.count,
        tone: settings.inlineAdsTone,
        era: settings.inlineAdsEra,
        contentCeiling: settings.inlineAdsContentCeiling,
        worldContext: [lorebook?.text, settings.inlineAdsWorldContext].filter((part) => part?.trim()).join("\n\n"),
        promptBlocks: slurpPromptContext(settings).blocks,
      });
      let images = 0;
      if (settings.inlineAdsImagesEnabled) {
        for (const ad of items) {
          if (
            (await generateGarnishAdImage(app.db, ads.pool, ad, [settings.inlineAdsImageConnectionId])) === "generated"
          )
            images += 1;
        }
      }
      if (lorebook) await noodle.updateSettings({ inlineAdsLorebookRevision: lorebook.revision });
      // Pruning runs after generation so the pool cannot grow without also
      // shedding what the audience keeps dismissing.
      const retired = await retireWeakGarnishAds(ads.pool, qualityScores(await ads.pool.listEvents()));
      // Re-read: the pool now carries the generated image URLs.
      const stored = await ads.pool.listAll(SLURP_GARNISH_PLATFORM);
      const byId = new Map(stored.map((ad): [string, GarnishAd] => [ad.id, ad]));
      return { items: items.map((ad) => byId.get(ad.id) ?? ad), retired, images };
    } catch (error) {
      return reply.code(502).send({ error: (error as Error).message });
    }
  });

  app.get("/slurp/ads/export", async () => exportGarnishAds(ads.pool, SLURP_GARNISH_PLATFORM));

  app.post("/slurp/ads/import", async (req, reply) => {
    const parsed = z
      .object({ mode: z.enum(["merge", "replace"]).default("merge"), payload: z.unknown() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return await importGarnishAds(ads.pool, parsed.data.payload, parsed.data.mode);
    } catch (error) {
      return reply.code(400).send({
        error: `Not a garnish-ads export (version ${GARNISH_EXPORT_VERSION}): ${(error as Error).message}`,
      });
    }
  });
}
