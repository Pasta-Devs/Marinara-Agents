import type { APIProvider } from "@marinara-engine/shared";
import { resolveStoredMaxTokens } from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import type { DB } from "../../../db/connection.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import {
  buildSlpFanVoiceDraftMessages,
  cleanSlpFanVoiceDraft,
  type SlpFanVoiceDraftInput,
} from "../../modules/audience/slp-fan-voice-draft.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";

export type SlpFanVoiceDraftResult =
  { ok: true; voice: string } | { ok: false; status: 409 | 429 | 502; error: string };

/**
 * One model call for the fan type editor's "Draft voice". The player pressed it, so it uses the AI
 * budget's connection but never its mode or caps (0.3.6).
 */
// ponytail: plain prompt, not a Prompt Studio recipe; add a recipe if players want to edit it.
export async function draftSlpFanTypeVoice(db: DB, input: SlpFanVoiceDraftInput): Promise<SlpFanVoiceDraftResult> {
  const settings = await createSlurpStorage(db).getSettings();
  const connection = await resolveSlurpTextConnection(
    createConnectionsStorage(db),
    settings.modelBudget.connectionId ?? settings.generationConnectionId,
  );
  if (!connection) return { ok: false, status: 409, error: "Select a text generation connection first." };
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
      // The player pressed it: booked as foreground work on the connection, like their chats.
      connection.id,
    ),
  );
  const result = await provider.chatComplete(buildSlpFanVoiceDraftMessages(input), {
    model: connection.model,
    temperature: 0.9,
    maxTokens: clampGenerationMaxOutputTokens({
      provider: connection.provider as APIProvider,
      model: connection.model,
      maxTokens: Math.max(resolveStoredMaxTokens(connection.defaultParameters, 400), 400),
      maxTokensOverride: connection.maxTokensOverride,
    }),
  });
  const voice = cleanSlpFanVoiceDraft(result.content);
  return voice
    ? { ok: true, voice }
    : { ok: false, status: 502, error: "The connection returned no voice. Try again." };
}
