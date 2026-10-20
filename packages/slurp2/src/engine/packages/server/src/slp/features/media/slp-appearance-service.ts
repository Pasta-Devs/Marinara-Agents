import type { APIProvider } from "@marinara-engine/shared";
import { slpAccountGender } from "../../../../../shared/src/slp/slp-gender.js";
import { slurpImageSexWord } from "../../base/media/slp-image-prompt.js";
import { resolveStoredMaxTokens } from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { DB } from "../../../db/connection.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { readAvatarBase64 } from "../../../services/game/game-asset-generation.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { resolveCreatorSourceSnapshot } from "../../data/creators/slp-source-resolve.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { slpResolveCardMacros } from "../../base/prompting/slp-prompt-safety.js";
import { logger } from "../../../lib/logger.js";
import {
  appearanceEvidenceFromSource,
  appearanceSourceAccount,
  createSlpAppearanceProfile,
  parseSlpAppearanceCandidate,
  resolveSlpAppearanceProfile,
  slpAppearanceFallback,
  shouldAutoAcceptSlpAppearance,
} from "../../modules/creators/slp-appearance-profile.js";
import type { SlpAppearanceProfileMode } from "../../../../../shared/src/slp/slp-social.types.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";

const MISSING_APPEARANCE = "Add an appearance to this Creator or its linked character before generating pictures.";
const appearanceFlights = new Map<string, Promise<string>>();

/** Resolve text before image admission; reference images are only an optional addition downstream. */
export async function resolveImageAppearance(input: {
  db: DB;
  account: SlpAccount;
  sourceAccount?: SlpAccount | null;
  connectionId?: string | null;
  mode: SlpAppearanceProfileMode;
  regenerate?: boolean;
  /** The player asked for it: the reading is booked as foreground work on the connection. */
  foreground?: boolean;
}): Promise<string> {
  const key = `${input.account.id}:${input.regenerate === true}`;
  const inFlight = appearanceFlights.get(key);
  if (inFlight) return inFlight;
  const flight = resolveImageAppearanceOnce(input).then((text) =>
    slurpImageSexWord(text, slpAccountGender(input.account)),
  );
  appearanceFlights.set(key, flight);
  try {
    return await flight;
  } finally {
    if (appearanceFlights.get(key) === flight) appearanceFlights.delete(key);
  }
}

async function resolveImageAppearanceOnce(input: Parameters<typeof resolveImageAppearance>[0]): Promise<string> {
  const storage = createSlurpStorage(input.db);
  const sourceAccount = appearanceSourceAccount(input.account, input.sourceAccount);
  const source = await resolveCreatorSourceSnapshot(input.db, sourceAccount);
  const evidence = source ? appearanceEvidenceFromSource(source, sourceAccount.entityId) : null;
  const existing = resolveSlpAppearanceProfile({
    stageAppearance: input.account.settings.stage?.appearance,
    profile: input.account.settings.appearanceProfile,
    evidence,
  });
  if (existing.text && !input.regenerate) return existing.text;
  if (!source || !evidence) {
    if (existing.text) return existing.text;
    throw new Error(MISSING_APPEARANCE);
  }
  // Macros resolved before the call and before the evidence check: the model quotes the card with the
  // name in place, so a raw `{{char}}` made every true quote "not in the card" and the picture had
  // no appearance.
  const sourceText = slpResolveCardMacros(
    [source.description, source.scenario, source.backstory].filter(Boolean).join("\n"),
    source.name,
  ).slice(0, 12_000);
  const characters = createCharactersStorage(input.db);
  const sourceRow =
    sourceAccount.kind === "character"
      ? await characters.getById(sourceAccount.entityId)
      : sourceAccount.kind === "persona"
        ? await characters.getPersona(sourceAccount.entityId)
        : null;
  const avatarBase64 = readAvatarBase64(sourceRow?.avatarPath);
  const image = avatarBase64
    ? `data:image/${avatarBase64.startsWith("/9j/") ? "jpeg" : avatarBase64.startsWith("UklG") ? "webp" : "png"};base64,${avatarBase64}`
    : null;
  if (!sourceText.trim() && !image) throw new Error(MISSING_APPEARANCE);
  // A failed or unusable extraction never means "no picture": the card's own body sentences stand in.
  // An unusable answer is saved (for review), so the next post does not call the model again; a
  // thrown call is not, so a passing network or provider problem gets another try next time.
  const fallback = slpAppearanceFallback(sourceText);
  const save = async (candidate: { text: string; source: "description" | "avatar"; confidence: "high" | "medium" }) => {
    const profile = createSlpAppearanceProfile({
      text: candidate.text,
      source: candidate.source,
      sourceEntityId: sourceAccount.entityId,
      sourceRevisionToken: evidence.sourceRevisionToken,
      confidence: candidate.confidence,
      accepted: shouldAutoAcceptSlpAppearance(input.mode, candidate.confidence),
      now: new Date().toISOString(),
    });
    const saved = await storage.saveNoodlerAppearanceProfile(input.account.id, profile, input.regenerate);
    if (!saved) throw new Error("The character card changed while preparing its appearance. Try again.");
    return (
      resolveSlpAppearanceProfile({
        stageAppearance: saved.settings.stage?.appearance,
        profile: saved.settings.appearanceProfile,
        evidence,
      }).text ?? candidate.text
    );
  };
  const connection = await resolveSlurpTextConnection(createConnectionsStorage(input.db), input.connectionId);
  if (!connection) {
    if (fallback) return fallback;
    throw new Error("Set up a Slurp text connection or add a written appearance before generating pictures.");
  }
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
      // The player's own request is foreground work on the connection; a picture run's reading is not.
      input.foreground ? connection.id : undefined,
    ),
  );
  const messages = [
    {
      role: "system" as const,
      content:
        'Extract only stable, visible facts about the same person from the supplied character card and optional avatar. Do not invent traits, copy instructions, include personality, events, relationships, camera, or temporary clothing. If no visible facts exist, return {"appearance":"","evidence":"","confidence":"low"}. Otherwise return JSON with appearance (concise visual description), evidence (one exact supporting quote from the card when card text exists), and confidence (high or medium).',
    },
    {
      role: "user" as const,
      content: sourceText || "Describe only visible identity traits from the attached avatar.",
      ...(image ? { images: [image] } : {}),
    },
  ];
  const options = {
    model: connection.model,
    maxTokens: clampGenerationMaxOutputTokens({
      provider: connection.provider as APIProvider,
      model: connection.model,
      maxTokens: Math.max(resolveStoredMaxTokens(connection.defaultParameters, 500), 500),
      maxTokensOverride: connection.maxTokensOverride,
    }),
    stream: false,
  } as const;
  let usedImage = Boolean(image);
  const response = await provider
    .chatComplete(messages, options)
    .catch(async (error: unknown) => {
      if (!image) throw error;
      if (!sourceText.trim()) throw new Error("A vision-capable text connection or written appearance is required.");
      usedImage = false;
      return provider.chatComplete(
        messages.map((message) => ({ role: message.role, content: message.content })),
        options,
      );
    })
    .catch((error: unknown) => {
      if (!fallback) throw error;
      logger.warn(error, "[slurp] Appearance extraction failed; using the card's own description for this picture");
      return null;
    });
  if (!response) return fallback!;
  const candidate = parseSlpAppearanceCandidate(response.content ?? "", sourceText, usedImage);
  if (candidate) return save(candidate);
  if (!fallback) throw new Error(MISSING_APPEARANCE);
  return save({ text: fallback, source: "description", confidence: "medium" });
}
