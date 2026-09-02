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
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { resolveStoredChatOptions } from "../generation/generation-parameters.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import type { GarnishAdsStorage } from "../garnish-ads/garnish-ads.storage.js";
import { garnishRatingAllowed, type GarnishAd, type GarnishContentRating } from "../garnish-ads/garnish-ads.types.js";
import { requireModelAnswer } from "./slurp-model-answer.js";
import { noodleSamplingOptions } from "./slurp-sampling-options.js";
import { SLURP_GARNISH_PLATFORM } from "./slurp-garnish-context.js";
import { NOODLER_UNTRUSTED_CONTENT_INSTRUCTION } from "./slurp-generation.service.js";

export type GarnishTone = "corporate" | "scammy" | "local" | "luxury" | "unhinged";
export type GarnishEra = "present" | "nineties" | "cyberpunk" | "retrofuture";

const generatedAdSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  product: z.string().trim().min(1).max(120),
  copy: z.string().trim().min(1).max(400),
  categories: z.array(z.string().trim().min(1).max(32)).max(6).default([]),
  contextTags: z.array(z.string().trim().min(1).max(32)).max(6).default([]),
  actionLabel: z.string().trim().min(1).max(40).optional(),
  contentRating: z.enum(["tame", "suggestive", "explicit"]).default("tame"),
});

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
};

export async function generateGarnishAds(
  db: DB,
  pool: GarnishAdsStorage,
  request: GarnishGenerationRequest,
): Promise<GarnishAd[]> {
  const connections = createConnectionsStorage(db);
  const connection = request.connectionId
    ? await connections.getWithKey(request.connectionId)
    : await connections.getMainWithKey();
  if (!connection) throw new Error("No usable connection for garnish ad generation.");

  const count = Math.min(Math.max(request.count ?? 4, 1), 10);
  const existing = await pool.listAll(SLURP_GARNISH_PLATFORM);
  // Naming the existing brands is the cheapest way to stop the pool filling
  // with near-duplicates of whatever it already holds.
  const existingBrands = [...new Set(existing.map((ad) => ad.brand))].slice(0, 40);

  const fallback = await connections.getFallbackForMain();
  const provider = withConnectionFallbackProvider({
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
  });

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        `Invent exactly ${count} fictional advertisements for an in-world social feed.`,
        "These are fictional brands in a fictional world. Never use a real company, product, or trademark.",
        `Tone: ${TONE_DIRECTION[request.tone]}`,
        `Setting: ${ERA_DIRECTION[request.era]}`,
        `Do not exceed a "${request.contentCeiling}" content rating, and label each ad honestly with its own rating.`,
        "Keep copy under 200 characters. It should read like an ad, not like a description of an ad.",
        "Give each ad 1-4 lowercase single-word categories and 1-4 lowercase context tags.",
        NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
        "Return a JSON array of objects with brand, product, copy, categories, contextTags, actionLabel, contentRating.",
        "Return JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        ...(request.worldContext?.trim()
          ? [`World and audience:\n${JSON.stringify(request.worldContext.trim())}`]
          : []),
        ...(existingBrands.length
          ? [`Brands that already exist, do not repeat them: ${existingBrands.join(", ")}`]
          : []),
      ].join("\n"),
    },
  ];

  const options = {
    model: connection.model,
    ...noodleSamplingOptions(
      resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
      { temperature: 1, topP: 0.95 },
    ),
    maxTokens: clampGenerationMaxOutputTokens({
      provider: connection.provider as APIProvider,
      model: connection.model,
      maxTokens: 1536,
      maxTokensOverride: connection.maxTokensOverride,
    }),
    stream: false,
  } as const;

  const parse = (raw: string) => {
    const value = parseGameJsonish(requireModelAnswer(raw, "generated ads"));
    return z
      .array(generatedAdSchema)
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
        { role: "user" as const, content: "Return only a valid JSON array of ad objects." },
      ],
      options,
    );
    generated = parse(retry.content ?? "");
  }

  const now = new Date().toISOString();
  const taken = new Set(existing.map((ad) => ad.id));
  const created: GarnishAd[] = [];

  for (const item of generated.slice(0, count)) {
    // The model labels its own rating, so re-check it here rather than trusting
    // the label. A mislabelled ad would otherwise walk straight past the gate.
    if (!garnishRatingAllowed(item.contentRating, request.contentCeiling)) continue;
    let id = `gen-${slug(item.brand)}-${slug(item.product)}`;
    while (taken.has(id)) id = `${id}-2`;
    taken.add(id);
    const ad: GarnishAd = {
      id,
      platform: SLURP_GARNISH_PLATFORM,
      kind: "inline",
      brand: item.brand,
      product: item.product,
      copy: item.copy,
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
