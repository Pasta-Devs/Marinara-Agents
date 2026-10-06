/**
 * One exchange of the role-play sign-up: one model call, the next lines and a page patch.
 *
 * The player is present and pressed something, like the stage-profile draft button, so the call is
 * not queued behind the background budget. Nothing is stored here: the draft lives in the client
 * until "Finish registration", and improvised facts never reach the Engine card.
 */
import type { APIProvider } from "@marinara-engine/shared";
import { jsonrepair } from "jsonrepair";
import type { SlpSceneTurnRequest, SlpSceneTurnResponse } from "../../../../../shared/src/slp/slp-scene.js";
import { isDebugAgentsEnabled } from "../../../config/runtime-config.js";
import type { DB } from "../../../db/connection.js";
import { logDebugOverride } from "../../../lib/logger.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import {
  resolveStoredChatOptions,
  resolveStoredMaxTokens,
} from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { withConnectionFallbackProvider } from "../../../services/llm/connection-fallback-provider.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { requireModelAnswer } from "../../base/model/slp-model-answer.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { resolveCreatorCharacterCanon } from "../../data/creators/slp-source-resolve.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slurpDisclosureMode } from "../../modules/creators/slp-disclosure.js";
import {
  buildSlpSceneTurnMessages,
  readSlpSceneTurn,
  slpSceneWritesHost,
} from "../../modules/onboarding/slp-scene-prompt.js";
import { slpCreatorPublicIdentityFor } from "../feed/slp-feed-contract.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

/** The JSON object in an answer (fences and prose around it allowed); jsonrepair for loose quoting. */
function readAnswer(answer: string): unknown {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  const body = start >= 0 && end > start ? answer.slice(start, end + 1) : answer;
  try {
    return JSON.parse(body);
  } catch {
    try {
      return JSON.parse(jsonrepair(body));
    } catch {
      return null;
    }
  }
}

export async function generateSlpSceneTurn(
  db: DB,
  input: { request: SlpSceneTurnRequest; connection: GenerationConnection },
): Promise<SlpSceneTurnResponse> {
  const { request } = input;
  const noodle = createSlurpStorage(db);
  const publicAccount = await noodle.resolveSourceByEntityId(request.sourceAccountId);
  if (!publicAccount) throw new Error("That character is not available for a Creator page.");
  const disclosureMode = slurpDisclosureMode(request.disclosureMode);
  const settings = await noodle.getSettings();
  const allowedTags = settings.discoveryTags.map((entry) => entry.tag);
  const helper = request.helperCreatorId
    ? ((await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === request.helperCreatorId) ?? null)
    : null;
  if (request.preset === "seat" && !helper) throw new Error("The Creator who was helping is gone.");
  const publicIdentity = await slpCreatorPublicIdentityFor(db, publicAccount);
  const messages = buildSlpSceneTurnMessages({
    request: { ...request, disclosureMode },
    newcomerCanon: await resolveCreatorCharacterCanon(db, publicAccount, disclosureMode),
    helper,
    openIdentity:
      disclosureMode === "open" ? { displayName: publicAccount.displayName, handle: publicAccount.handle } : null,
    allowedTags,
  });
  const debugMode = isDebugAgentsEnabled();
  logDebugOverride(debugMode, "[debug/slurp] Sign-up scene turn prepared (%s, %s).", request.preset, request.moment);
  const connections = createConnectionsStorage(db);
  const fallbackConnection = await connections.getFallbackForMain();
  const provider = slpWithProviderRetry(
    withConnectionFallbackProvider({
      primary: createLLMProvider(
        input.connection.provider,
        resolveBaseUrl(input.connection),
        input.connection.apiKey,
        input.connection.maxContext,
        input.connection.openrouterProvider,
        input.connection.maxTokensOverride,
        input.connection.claudeFastMode === "true",
        input.connection.treatAsLocalEndpoint === "true",
        input.connection.defaultParameters,
      ),
      primaryConnectionId: input.connection.id,
      fallbackConnection,
      fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
      category: "main",
    }),
  );
  const ask = async () => {
    const response = await provider.chatComplete(messages, {
      model: input.connection.model,
      maxTokens: clampGenerationMaxOutputTokens({
        provider: input.connection.provider as APIProvider,
        model: input.connection.model,
        maxTokens: resolveStoredMaxTokens(input.connection.defaultParameters, 900),
        maxTokensOverride: input.connection.maxTokensOverride,
      }),
      ...slpSamplingOptions(
        resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
        { temperature: 0.9, topP: 0.95 },
      ),
      stream: false,
      debugMode,
    });
    return readSlpSceneTurn(readAnswer(requireModelAnswer(response.content ?? "", "the next line")), {
      locked: request.locked,
      allowedTags,
      disclosureMode,
      publicIdentity,
      writesHost: slpSceneWritesHost(request.preset, request.action),
    });
  };
  // One more try on an unusable answer before the player sees "The reply got lost".
  const turn = (await ask()) ?? (await ask());
  if (!turn) throw new Error("The reply got lost. Try again.");
  return turn;
}
