import { z } from "zod";
import { SLURP_GARNISH_PLATFORM, garnishContextForViewer } from "../../../services/slurp/slurp-garnish-context.js";
import { newId } from "../../../utils/id-generator.js";
import {
  unlinkGarnishAdImage,
  resolveGarnishAdImageAbsolutePath,
} from "../../../services/slurp/slurp-garnish-image.js";
import { generateGarnishAdImage } from "../../../services/slurp/slurp-garnish-image.service.js";
import { basename, dirname } from "path";
import { existsSync } from "fs";
import { resolveNoodlerMediaVariant } from "../../../services/slurp/slurp-media.js";
import { syncGarnishAdsWithLorebook } from "../../../services/slurp/slurp-garnish-sync.service.js";
import { createLorebooksStorage } from "../../../services/storage/lorebooks.storage.js";
import { readGarnishLorebookContext } from "../../../services/slurp/slurp-garnish-lorebook.js";
import { generateGarnishAds, retireWeakGarnishAds } from "../../../services/slurp/slurp-garnish-generation.service.js";
import { qualityScores } from "../../../services/garnish-ads/garnish-ads.rating.js";
import type { GarnishAd } from "../../../services/garnish-ads/garnish-ads.types.js";
import {
  exportGarnishAds,
  importGarnishAds,
  GARNISH_EXPORT_VERSION,
} from "../../../services/garnish-ads/garnish-ads.export.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../../base/host/slp-viewer-context.js";

export async function slpAdsRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { ads, characters, noodle, resolveViewerPersona } = deps;
  const garnishAdInputSchema = z.object({
    id: z.string().trim().min(1).max(120).optional(),
    kind: z.enum(["creator", "inline"]).default("inline"),
    brand: z.string().trim().min(1).max(80),
    product: z.string().trim().min(1).max(120),
    copy: z.string().trim().min(1).max(600),
    categories: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
    contextTags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
    imageUrl: z.string().trim().max(2048).nullable().optional(),
    actionLabel: z.string().trim().min(1).max(40).optional(),
    contentRating: z.enum(["tame", "suggestive", "explicit"]).default("tame"),
  });

  app.get("/noodler/viewer/ads", async (req, reply) => {
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
    return { items };
  });

  app.post("/noodler/viewer/ads/:id/hide", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.hide(parsed.data.personaId, (req.params as { id: string }).id);
  });

  app.post("/noodler/viewer/ads/reset", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.reset(parsed.data.personaId);
  });

  app.post("/noodler/viewer/ads/:id/action", async (req, reply) => {
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

  app.post("/noodler/viewer/ads/brand/hide", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), brand: z.string().trim().min(1).max(80) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.hideBrand(parsed.data.personaId, parsed.data.brand);
  });

  app.post("/noodler/viewer/ads/brand/unhide", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), brand: z.string().trim().min(1).max(80) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.unhideBrand(parsed.data.personaId, parsed.data.brand);
  });

  app.get("/noodler/viewer/ads/state", async (req, reply) => {
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
  app.get("/noodler/ads/pool", async () => ({ items: await ads.pool.listAll(SLURP_GARNISH_PLATFORM) }));

  app.post("/noodler/ads/pool", async (req, reply) => {
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

  app.delete("/noodler/ads/pool/:id", async (req) => {
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
    return { ok: true };
  });

  const garnishAdPatchSchema = garnishAdInputSchema
    .omit({ id: true })
    .partial()
    .extend({ retiredAt: z.null().optional() });

  app.patch("/noodler/ads/pool/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = garnishAdPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    // Scoped like the other pool routes: an id from another Garnish platform is not editable here.
    if (!(await ads.pool.listAll(SLURP_GARNISH_PLATFORM)).some((ad) => ad.id === id)) {
      return reply.code(404).send({ error: "Not Found" });
    }
    const updated = await ads.pool.update(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "Not Found" });
    return updated;
  });

  app.post("/noodler/ads/:id/image", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ad = (await ads.pool.listAll(SLURP_GARNISH_PLATFORM)).find((row) => row.id === id);
    if (!ad) return reply.code(404).send({ error: "Not Found" });
    const settings = await noodle.getSettings();
    const outcome = await generateGarnishAdImage(app.db, ads.pool, ad, [
      settings.inlineAdsImageConnectionId,
      settings.imageGenerationConnectionId,
    ]);
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
    const absolute = resolveGarnishAdImageAbsolutePath(id, ad?.imageUrl);
    if (!absolute || basename(absolute) !== fileName || !existsSync(absolute)) {
      return reply.code(404).send({ error: "Not Found" });
    }
    const width = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((req.query as { width?: string }).width);
    const served = await resolveNoodlerMediaVariant(absolute, width.success ? width.data : undefined);
    return reply
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .sendFile(basename(served), dirname(served));
  });

  app.post("/noodler/ads/lorebook/sync", async (req, reply) => {
    const parsed = z.object({ force: z.boolean().optional() }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const outcome = await syncGarnishAdsWithLorebook(app.db, ads.pool, { force: parsed.data.force });
    if (outcome === "failed") return reply.code(502).send({ error: "Could not sync the pool to that lorebook." });
    return { outcome };
  });

  app.get("/noodler/ads/lorebooks", async () => ({
    // Lorebook rows are typed through Record<string, unknown>, so id and name are read rather
    // than accessed off the declared type.
    items: (await createLorebooksStorage(app.db).list())
      .map((book) => book as { id?: unknown; name?: unknown })
      .filter((book): book is { id: string; name: string } => typeof book.id === "string")
      .map((book) => ({ id: book.id, name: typeof book.name === "string" ? book.name : book.id })),
  }));

  app.post("/noodler/ads/generate", async (req, reply) => {
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
        promptBlocks: settings.promptBlocks,
      });
      let images = 0;
      if (settings.inlineAdsImagesEnabled) {
        for (const ad of items) {
          if (
            (await generateGarnishAdImage(app.db, ads.pool, ad, [
              settings.inlineAdsImageConnectionId,
              settings.imageGenerationConnectionId,
            ])) === "generated"
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

  app.get("/noodler/ads/export", async () => exportGarnishAds(ads.pool, SLURP_GARNISH_PLATFORM));

  app.post("/noodler/ads/import", async (req, reply) => {
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
