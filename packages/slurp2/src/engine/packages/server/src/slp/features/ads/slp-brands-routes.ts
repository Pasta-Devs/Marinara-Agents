/**
 * Brands and their products in Backstage (R). A brand holds products; each product is an ad in the
 * garnish pool (its pitch, price feel, spice fit and look), so the feed, Discover and brand deals
 * read them with no second list. Pictures come as a data URL: an upload or a picture the assist drew.
 */
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { newId } from "../../../utils/id-generator.js";
import {
  garnishAdBrandId,
  garnishBrandId,
  type GarnishAd,
  type GarnishBrand,
} from "../../../services/garnish-ads/garnish-ads.types.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { SLURP_GARNISH_PLATFORM } from "./slp-garnish-context.js";
import { unlinkGarnishAdImage } from "./slp-garnish-image.js";
import { storeGarnishPicture } from "./slp-garnish-image-service.js";

const picture = z
  .string()
  .max(16_000_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,/u);

const brandInput = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(40).default(""),
  tone: z.string().trim().max(300).default(""),
  logoPrompt: z.string().trim().max(400).default(""),
});

const productInput = z.object({
  product: z.string().trim().min(1).max(120),
  copy: z.string().trim().min(1).max(600),
  priceFeel: z.enum(["budget", "everyday", "premium"]).default("everyday"),
  contentRating: z.enum(["tame", "suggestive", "explicit"]).default("tame"),
  look: z.string().trim().max(400).default(""),
  categories: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
  actionLabel: z.string().trim().min(1).max(40).optional(),
});

/** Every brand with its products, for Backstage and the Stir lever. */
export async function listSlurpBrands(pool: SlpRouteDeps["ads"]["pool"]) {
  const [brands, ads] = await Promise.all([
    pool.listBrands(SLURP_GARNISH_PLATFORM),
    pool.listAll(SLURP_GARNISH_PLATFORM),
  ]);
  return brands.map((brand) => ({
    ...brand,
    products: ads.filter((ad) => ad.kind === "inline" && garnishAdBrandId(ad) === brand.id),
  }));
}

export async function slpBrandsRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { pool } = deps.ads;
  const findBrand = async (id: string) =>
    (await pool.listBrands(SLURP_GARNISH_PLATFORM)).find((brand) => brand.id === id) ?? null;

  app.get("/slurp/ads/brands", async () => ({ items: await listSlurpBrands(pool) }));

  app.post("/slurp/ads/brands", async (req, reply) => {
    const parsed = brandInput.extend({ logo: picture.optional() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { logo, ...input } = parsed.data;
    // The name's own id when it is free, so ads written with that brand name later join it.
    const id = (await findBrand(garnishBrandId(input.name))) ? `brand-user-${newId()}` : garnishBrandId(input.name);
    const brand: GarnishBrand = {
      ...input,
      id,
      platform: SLURP_GARNISH_PLATFORM,
      origin: "user",
      createdAt: new Date().toISOString(),
      logoUrl: logo ? storeGarnishPicture(id, logo) : null,
    };
    return pool.saveBrand(brand);
  });

  app.patch("/slurp/ads/brands/:id", async (req, reply) => {
    const parsed = brandInput
      .partial()
      .extend({ enabled: z.boolean().optional(), logo: picture.nullable().optional() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const brand = await findBrand((req.params as { id: string }).id);
    if (!brand) return reply.code(404).send({ error: "Not Found" });
    const { enabled, logo, ...patch } = parsed.data;
    const next: GarnishBrand = {
      ...brand,
      ...patch,
      ...(enabled === undefined ? {} : { disabledAt: enabled ? null : (brand.disabledAt ?? new Date().toISOString()) }),
      ...(logo === undefined ? {} : { logoUrl: logo ? storeGarnishPicture(brand.id, logo) : null }),
    };
    const saved = await pool.saveBrand(next);
    if (logo !== undefined) unlinkGarnishAdImage(brand.id, brand.logoUrl);
    return saved;
  });

  app.delete("/slurp/ads/brands/:id", async (req) => {
    const brand = await findBrand((req.params as { id: string }).id);
    if (!brand) return { ok: true };
    const removed = await pool.removeBrand(brand.id);
    for (const ad of removed) {
      unlinkGarnishAdImage(ad.id, ad.imageUrl);
      unlinkGarnishAdImage(ad.id, ad.wideImageUrl);
    }
    // A shipped brand is only switched off, so it keeps its logo.
    if (brand.origin !== "builtin") unlinkGarnishAdImage(brand.id, brand.logoUrl);
    return { ok: true, disabled: brand.origin === "builtin" };
  });

  app.post("/slurp/ads/brands/:id/products", async (req, reply) => {
    const parsed = productInput.extend({ image: picture.optional() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const brand = await findBrand((req.params as { id: string }).id);
    if (!brand) return reply.code(404).send({ error: "Not Found" });
    const { image, categories, look, ...input } = parsed.data;
    const id = `user-${newId()}`;
    const ad: GarnishAd = {
      ...input,
      id,
      platform: SLURP_GARNISH_PLATFORM,
      kind: "inline",
      brand: brand.name,
      brandId: brand.id,
      categories: categories ?? (brand.category ? [brand.category.toLowerCase()] : []),
      contextTags: [],
      ...(look ? { look } : {}),
      origin: "user",
      createdAt: new Date().toISOString(),
      imageUrl: image ? storeGarnishPicture(id, image) : null,
    };
    return pool.add(ad);
  });

  /**
   * A product picture from an upload or the assist (null takes it away: Undo of a first picture). The
   * old banner goes: wide slots crop the new one.
   */
  app.post("/slurp/ads/pool/:id/picture", async (req, reply) => {
    const parsed = z.object({ image: picture.nullable() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const ad = (await pool.listAll(SLURP_GARNISH_PLATFORM)).find((row) => row.id === id);
    if (!ad) return reply.code(404).send({ error: "Not Found" });
    const url = parsed.data.image ? storeGarnishPicture(id, parsed.data.image) : null;
    const updated = await pool.update(id, { imageUrl: url, wideImageUrl: null });
    // Only files Slurp stored resolve here (shipped ads carry no picture), so this never deletes a link.
    unlinkGarnishAdImage(id, ad.imageUrl);
    unlinkGarnishAdImage(id, ad.wideImageUrl);
    return updated;
  });
}
