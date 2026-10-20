import type { APIProvider } from "@marinara-engine/shared";
import { resolveStoredMaxTokens } from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { jsonrepair } from "jsonrepair";
import type { SlpPageStyleSuggestion } from "../../../../../shared/src/slp/slp-social.types.js";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";
import { resolveCreatorCharacterCanon } from "../../data/creators/slp-source-resolve.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { mergeSlurpCreatorStrategy, slurpCreatorStrategy } from "../../modules/creators/slp-creator-strategy.js";
import {
  buildSlpPageStyleMessages,
  SLP_PAGE_STYLE_LIMITS,
  slpPageStyleProposal,
} from "../../modules/creators/slp-page-style-suggestion.js";
import { slurpEffectiveIntentWeights } from "../../modules/feed/slp-content-axes.js";
import {
  NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
  protectBoundedCreatorGeneratedText,
  resolveNoodlerPublicIdentity,
  slpCreatorIdentityInstruction,
} from "../feed/slp-feed-contract.js";

// 422, not 502, for a model that failed: the client shows a server sentence only for a 4xx.
export type SlpPageStyleResult =
  { ok: true; suggestion: SlpPageStyleSuggestion } | { ok: false; status: 404 | 409 | 422; error: string };

/** Less card than this is not enough to tell one character's page from another's. */
const MIN_EVIDENCE = 80;

function parseAnswer(answer: string): unknown {
  // A thinking model's notes and code fences hold braces too; only the answer after them counts.
  const text = answer.replace(/^[\s\S]*<\/think>/iu, " ").replace(/```[a-z]*|```/giu, " ");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(jsonrepair(text.slice(start, end + 1)));
  } catch {
    return null;
  }
}

/**
 * "Suggest page style": one model call on the player's tap, never on a schedule. Reads the card and
 * the current strategy and returns a proposal. Writes nothing; the player applies it through the
 * ordinary strategy save, which refuses a value edited since the suggestion was made.
 */
export async function suggestSlpPageStyle(db: DB, accountId: string): Promise<SlpPageStyleResult> {
  const noodle = createSlurpStorage(db);
  const account = await noodle.getNoodlerAccountById(accountId);
  if (!account) return { ok: false, status: 404, error: "Creator account not found" };
  const source = await noodle.resolveAccountSource(account).catch(() => null);
  if (!source) return { ok: false, status: 409, error: "This Creator has no linked Character card to read." };
  const mode = account.settings.privacy.identityDisclosure ?? "hinted";
  const canon = await resolveCreatorCharacterCanon(db, source, mode);
  const stagePersonality = account.settings.privacy.stagePersonality ?? "";
  if (canon.length + stagePersonality.length < MIN_EVIDENCE)
    return {
      ok: false,
      status: 409,
      error: "This Creator's card has too little to go on. Add to the card, or set the style by hand.",
    };
  const settings = await noodle.getSettings();
  const connection = await resolveSlurpTextConnection(createConnectionsStorage(db), settings.generationConnectionId);
  if (!connection) return { ok: false, status: 409, error: "Select a text generation connection first." };

  const saved = account.settings.strategy ?? {};
  const strategy = slurpCreatorStrategy(account.id, saved);
  const current = {
    style: strategy.production.style,
    textOnlyRate: strategy.textOnlyRate,
    intentWeights: slurpEffectiveIntentWeights(strategy.intentWeights),
    strategyText: strategy.strategyText,
  };
  const identity = await resolveNoodlerPublicIdentity(db, account).catch(() => null);
  const messages = buildSlpPageStyleMessages({
    canon,
    stagePersonality,
    bio: account.bio,
    identityInstruction: slpCreatorIdentityInstruction(mode, identity),
    untrustedInstruction: NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
  });
  let answer: string;
  try {
    const provider = slpWithProviderRetry(
      createLLMProvider(
        connection.provider,
        resolveBaseUrl(connection),
        connection.apiKey,
        connection.maxContext,
        connection.openrouterProvider,
        connection.maxTokensOverride,
        connection.claudeFastMode === "true",
        connection.treatAsLocalEndpoint === "true",
        connection.defaultParameters,
        // Only the player's button calls this: booked as foreground work on the connection.
        connection.id,
      ),
    );
    // Room for a reasoning model's notes, as for the Page (3000 left some answers empty).
    const result = await provider.chatComplete(messages, {
      model: connection.model,
      temperature: 0.7,
      maxTokens: clampGenerationMaxOutputTokens({
        provider: connection.provider as APIProvider,
        model: connection.model,
        maxTokens: Math.max(resolveStoredMaxTokens(connection.defaultParameters, 4000), 4000),
        maxTokensOverride: connection.maxTokensOverride,
      }),
    });
    answer = result.content ?? "";
  } catch (error) {
    logger.warn({ accountId: account.id, error }, "[slurp-page-style] Model call failed");
    return { ok: false, status: 422, error: "The connection failed while reading the card. Try again." };
  }
  if (!answer.trim())
    return {
      ok: false,
      status: 422,
      error: "The connection returned an empty answer. Raise its max output tokens, or pick another model.",
    };
  const proposal = slpPageStyleProposal(parseAnswer(answer), current, saved.textOnlyRate);
  if (!proposal) {
    logger.warn({ accountId: account.id, length: answer.length }, "[slurp-page-style] The answer held no usable style");
    return { ok: false, status: 422, error: "The connection returned no usable suggestion. Try again." };
  }
  // A hinted Creator's other name never reaches the page note or the player's preview.
  const protect = (value: string, max: number) => protectBoundedCreatorGeneratedText(value, mode, identity, max) ?? "";
  const explanation = protect(proposal.explanation, SLP_PAGE_STYLE_LIMITS.explanation);
  if (proposal.patch.strategyText !== undefined) {
    const note = protect(proposal.patch.strategyText, SLP_PAGE_STYLE_LIMITS.note);
    if (note) proposal.patch.strategyText = note;
    else delete proposal.patch.strategyText;
  }
  const effective = (value: typeof strategy) => ({
    style: value.production.style,
    skipRate: value.skipRate,
    textOnlyRate: value.textOnlyRate,
  });
  const applied = slurpCreatorStrategy(account.id, mergeSlurpCreatorStrategy(saved, proposal.patch));
  return {
    ok: true,
    suggestion: {
      explanation,
      current,
      proposal: proposal.patch,
      saved,
      before: effective(strategy),
      after: effective(applied),
    },
  };
}
