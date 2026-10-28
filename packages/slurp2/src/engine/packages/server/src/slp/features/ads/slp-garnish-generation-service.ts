/**
 * Generates in-world ads for the Slurp pool.
 *
 * This lives on the Slurp side on purpose. garnish-ads holds the pool, the
 * gate, and the ranking; it does not know how to talk to a model, and it does
 * not know what a persona is. Slurp generates neutral GarnishAd rows and pushes
 * them in, which is the same direction every other host integration runs.
 */
import type { APIProvider } from "@marinara-engine/shared";
import { z } from "zod";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { parseGameJsonish } from "../../../services/game/jsonish.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { resolveStoredChatOptions } from "../../../services/generation/generation-parameters.js";
import type { ChatMessage } from "../../../services/llm/base-provider.js";
import { withConnectionFallbackProvider } from "../../../services/llm/connection-fallback-provider.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import type { GarnishAdsStorage } from "../../../services/garnish-ads/garnish-ads.storage.js";
import {
  garnishBrandId,
  garnishRatingAllowed,
  type GarnishAd,
  type GarnishBrand,
  type GarnishContentRating,
} from "../../../services/garnish-ads/garnish-ads.types.js";
import { requireModelAnswer } from "../../base/model/slp-model-answer.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { SLURP_GARNISH_PLATFORM } from "./slp-garnish-context.js";
import { NOODLER_UNTRUSTED_CONTENT_INSTRUCTION } from "../feed/slp-feed-contract.js";
import { composeSlurpPromptBlocks, type SlurpPromptBlockOverrides } from "../../base/prompting/slp-prompt-blocks.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";

export type GarnishTone = "corporate" | "scammy" | "local" | "luxury" | "unhinged";
export type GarnishEra = "present" | "nineties" | "cyberpunk" | "retrofuture";

/** One product of a generated brand (R decision: "Write new ads" writes whole brands). */
const generatedAdSchema = z.object({
  product: z.string().trim().min(1).max(120),
  copy: z.string().trim().min(1).max(400),
  categories: z.array(z.string().trim().min(1).max(32)).max(6).default([]),
  contextTags: z.array(z.string().trim().min(1).max(32)).max(6).default([]),
  actionLabel: z.string().trim().min(1).max(40).optional(),
  // Models occasionally invent their own label (e.g. "general") instead of the three asked
  // for. Falling back to the strictest rating keeps one hallucinated word from failing the
  // whole batch — the gate below still filters it against the requested ceiling.
  contentRating: z.enum(["tame", "suggestive", "explicit"]).catch("tame"),
  priceFeel: z.enum(["budget", "everyday", "premium"]).catch("everyday"),
  look: z.string().trim().max(300).optional().catch(undefined),
});

const generatedBrandSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  category: z.string().trim().max(40).catch(""),
  tone: z.string().trim().max(200).catch(""),
  logoPrompt: z.string().trim().max(300).catch(""),
  products: z.array(generatedAdSchema).min(1),
});

const OUTPUT_SHAPE =
  "Return a JSON array of brand objects: brand, category, tone (how the brand talks, one line), logoPrompt (what its logo looks like), products (2 or 3 objects with product, copy, priceFeel (budget, everyday or premium), look (what the product looks like), categories, contextTags, actionLabel, contentRating).";

const TONE_DIRECTION: Record<GarnishTone, string> = {
  corporate: "Polished national-brand voice. Confident, focus-grouped, faintly hollow.",
  scammy: "Obvious low-rent scam energy. Overpromises, fake urgency, too good to be true.",
  local: "A small local business that bought one ad slot. Plain, warm, slightly amateur.",
  luxury: "Expensive and restrained. Says very little and assumes you already know.",
  unhinged: "Baffling and surreal. The brand is real but the pitch makes no sense.",
};

const ERA_DIRECTION: Record<GarnishEra, string> = {
  present: "Present day.",
  nineties: "1990s. No smartphones, no social media, catalogues and phone numbers.",
  cyberpunk: "Near-future cyberpunk. Implants, megacorps, rented body parts.",
  retrofuture: "Mid-century retro-future. Atomic optimism, chrome, jetpacks.",
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 60);

export type GarnishGenerationRequest = {
  connectionId?: string;
  count?: number;
  tone: GarnishTone;
  era: GarnishEra;
  contentCeiling: GarnishContentRating;
  /** World or persona flavour the ads should fit. */
  worldContext?: string;
  promptBlocks?: SlurpPromptBlockOverrides;
};

export async function generateGarnishAds(
  db: DB,
  pool: GarnishAdsStorage,
  request: GarnishGenerationRequest,
): Promise<GarnishAd[]> {
  // Fall back rather than failing when the chosen connection was deleted.
  const connections = createConnectionsStorage(db);
  const connection =
    (request.connectionId ? await resolveSlurpTextConnection(connections, request.connectionId) : null) ??
    (await resolveSlurpTextConnection(connections));
  if (!connection) throw new Error("No usable connection for garnish ad generation.");

  // `count` stays the number of products; they come as whole brands of 2–3 products each.
  const count = Math.min(Math.max(request.count ?? 4, 1), 10);
  const brandCount = Math.max(1, Math.round(count / 2.5));
  const existing = await pool.listAll(SLURP_GARNISH_PLATFORM);
  // Naming the existing brands is the cheapest way to stop the pool filling
  // with near-duplicates of whatever it already holds.
  const knownBrands = await pool.listBrands(SLURP_GARNISH_PLATFORM);
  const existingBrands = [
    ...new Set([...knownBrands.map((brand) => brand.name), ...existing.map((ad) => ad.brand)]),
  ].slice(0, 40);

  const fallback = await connections.getFallbackForMain();
  const provider = slpWithProviderRetry(
    withConnectionFallbackProvider({
      primary: createLLMProvider(
        connection.provider,
        resolveBaseUrl(connection),
        connection.apiKey,
        connection.maxContext,
        connection.openrouterProvider,
        connection.maxTokensOverride,
        connection.claudeFastMode === "true",
        connection.treatAsLocalEndpoint === "true",
        connection.defaultParameters,
      ),
      primaryConnectionId: connection.id,
      fallbackConnection: fallback,
      fallbackBaseUrl: fallback ? resolveBaseUrl(fallback) : "",
      category: "main",
    }),
  );

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: composeSlurpPromptBlocks(
        "garnishAds",
        [
          {
            id: "task",
            kind: "editable",
            text: `Invent exactly ${brandCount} fictional brands for an in-world social feed, each with 2 or 3 products that are advertised.`,
          },
          {
            id: "style",
            kind: "context",
            text: [
              "These are fictional brands in a fictional world. Never use a real company, product, or trademark.",
              `Tone: ${TONE_DIRECTION[request.tone]}`,
              `Setting: ${ERA_DIRECTION[request.era]}`,
              `Do not exceed a "${request.contentCeiling}" content rating, and label each product honestly with its own rating.`,
              "A brand's products belong together (one maker, one voice) and differ in price or use.",
              "Keep copy under 200 characters. It should read like an ad, not like a description of an ad.",
              "Give each product 1-4 lowercase single-word categories and 1-4 lowercase context tags.",
              NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
              OUTPUT_SHAPE,
              "Return JSON only.",
            ].join("\n"),
          },
          { id: "safety", kind: "required", text: NOODLER_UNTRUSTED_CONTENT_INSTRUCTION },
          {
            id: "output",
            kind: "required",
            text: `${OUTPUT_SHAPE} Return JSON only.`,
          },
          ...(request.worldContext?.trim()
            ? [
                {
                  id: "world",
                  kind: "context" as const,
                  optional: true,
                  text: `World and audience:\n${JSON.stringify(request.worldContext.trim())}`,
                },
              ]
            : []),
          ...(existingBrands.length
            ? [
                {
                  id: "existingBrands",
                  kind: "context" as const,
                  optional: true,
                  text: `Brands that already exist, do not repeat them: ${existingBrands.join(", ")}`,
                },
              ]
            : []),
        ],
        request.promptBlocks,
      ),
    },
    {
      role: "user",
      content: [
        ...(request.worldContext?.trim() &&
        request.promptBlocks?.garnishAds?.find((block) => block.id === "world")?.enabled !== false
          ? [`World and audience:\n${JSON.stringify(request.worldContext.trim())}`]
          : []),
        ...(existingBrands.length &&
        request.promptBlocks?.garnishAds?.find((block) => block.id === "existingBrands")?.enabled !== false
          ? [`Brands that already exist, do not repeat them: ${existingBrands.join(", ")}`]
          : []),
      ].join("\n"),
    },
  ];

  const options = {
    model: connection.model,
    ...slpSamplingOptions(
      resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
      { temperature: 1, topP: 0.95 },
    ),
    maxTokens: clampGenerationMaxOutputTokens({
      provider: connection.provider as APIProvider,
      model: connection.model,
      maxTokens: 3072,
      maxTokensOverride: connection.maxTokensOverride,
    }),
    stream: false,
  } as const;

  const parse = (raw: string) => {
    const value = parseGameJsonish(requireModelAnswer(raw, "generated ads"));
    return z
      .array(generatedBrandSchema)
      .min(1)
      .parse(Array.isArray(value) ? value : [value]);
  };

  let generated;
  const first = (await provider.chatComplete(messages, options)).content ?? "";
  try {
    generated = parse(first);
  } catch (error) {
    logger.warn(error, "[slurp] Correcting invalid garnish ad response");
    const retry = await provider.chatComplete(
      [
        ...messages,
        ...(first.trim() ? [{ role: "assistant" as const, content: first }] : []),
        { role: "user" as const, content: "Return only a valid JSON array of brand objects." },
      ],
      options,
    );
    generated = parse(retry.content ?? "");
  }

  const now = new Date().toISOString();
  const taken = new Set(existing.map((ad) => ad.id));
  const brandIds = new Set(knownBrands.map((brand) => brand.id));
  const created: GarnishAd[] = [];

  for (const entry of generated.slice(0, brandCount)) {
    // The model labels its own rating, so re-check it here rather than trusting
    // the label. A mislabelled ad would otherwise walk straight past the gate.
    const products = entry.products.slice(0, 3);
    if (!products.some((item) => garnishRatingAllowed(item.contentRating, request.contentCeiling))) continue;
    // A new brand never takes over an existing one that has the same name.
    let brandId = garnishBrandId(entry.brand);
    while (brandIds.has(brandId)) brandId = `${brandId}-2`;
    brandIds.add(brandId);
    const brand: GarnishBrand = {
      id: brandId,
      platform: SLURP_GARNISH_PLATFORM,
      name: entry.brand,
      category: entry.category,
      tone: entry.tone,
      logoPrompt: entry.logoPrompt,
      logoUrl: null,
      origin: "generated",
      createdAt: now,
    };
    await pool.saveBrand(brand);
    for (const item of products) {
      if (!garnishRatingAllowed(item.contentRating, request.contentCeiling)) continue;
      let id = `gen-${slug(entry.brand)}-${slug(item.product)}`;
      while (taken.has(id)) id = `${id}-2`;
      taken.add(id);
      const ad: GarnishAd = {
        id,
        platform: SLURP_GARNISH_PLATFORM,
        kind: "inline",
        brand: entry.brand,
        brandId,
        product: item.product,
        copy: item.copy,
        priceFeel: item.priceFeel,
        ...(item.look ? { look: item.look } : {}),
        categories: item.categories,
        contextTags: item.contextTags,
        actionLabel: item.actionLabel,
        contentRating: item.contentRating,
        origin: "generated",
        createdAt: now,
      };
      await pool.add(ad);
      created.push(ad);
    }
  }

  return created;
}

/**
 * Retire generated ads the audience keeps dismissing. User-authored and
 * built-in ads are never touched: the system may prune its own output, never
 * somebody else's work.
 */
export async function retireWeakGarnishAds(
  pool: GarnishAdsStorage,
  quality: Map<string, number>,
  threshold = -15,
): Promise<string[]> {
  const retired: string[] = [];
  for (const ad of await pool.listAll()) {
    if (ad.origin !== "generated" || ad.retiredAt) continue;
    const score = quality.get(ad.id);
    if (score === undefined || score > threshold) continue;
    await pool.retire(ad.id);
    retired.push(ad.id);
  }
  return retired;
}
