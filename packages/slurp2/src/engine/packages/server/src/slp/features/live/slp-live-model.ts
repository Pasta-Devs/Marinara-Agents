import type { DB } from "../../../db/connection.js";
import { slurpLiveParseLines } from "../../modules/live/slp-live.js";
import { logger } from "../../../lib/logger.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../../../services/generation/generation-parameters.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { requireModelAnswer } from "../../base/model/slp-model-answer.js";
import { parseGameJsonish } from "../../../services/game/jsonish.js";
import { claimSlurpModelBudget } from "../../base/model/slp-model-worker.js";
import { tryBackgroundConnection } from "../../../services/generation/connection-admission.js";
import { resolveCreatorFanConnection } from "../audience/slp-audience-contract.js";

/** One live model call: a segment script, a missed-show summary, her chat reply or a crowd batch. */
export async function runLiveModel(
  db: DB,
  settings: any,
  creatorName: string,
  phase: string,
  minutes: number,
  prompt: string,
  kind: "segment" | "missed" | "reply" | "crowd",
  onParsed?: (parsed: unknown) => void,
) {
  try {
    // Her live replies and the crowd use the fast live connection when one is set; a deleted one falls back like the others.
    const connection = await resolveCreatorFanConnection(
      db,
      (kind === "reply" || kind === "crowd") && settings.liveConnectionId
        ? { ...settings, modelBudget: { ...settings.modelBudget, connectionId: settings.liveConnectionId } }
        : settings,
    );
    if (!connection || !(await claimSlurpModelBudget(db, settings.modelBudget, "thread"))) return [];
    const admission = tryBackgroundConnection(connection.id);
    if (!admission.acquired) return [];
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
        ),
      );
      const response = await provider.chatComplete(
        [
          { role: "system", content: `Live ${kind} for ${creatorName}, ${phase}, ${minutes} minutes.` },
          { role: "user", content: prompt },
        ],
        {
          model: connection.model,
          ...slpSamplingOptions(
            resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
            { temperature: 0.8, topP: 0.95 },
          ),
          maxTokens: clampGenerationMaxOutputTokens({
            provider: connection.provider,
            model: connection.model,
            maxTokens: kind === "reply" ? 300 : 2048,
            maxTokensOverride: connection.maxTokensOverride,
          }),
          stream: false,
        },
      );
      const raw = requireModelAnswer(response.content ?? "", `live ${kind}`);
      const parsed = kind === "reply" ? raw : parseGameJsonish(raw);
      if (kind === "missed") {
        const rows = Array.isArray(parsed) ? parsed : typeof parsed === "string" ? parsed.split("\n") : [];
        return rows
          .filter((line): line is string => typeof line === "string" && !!line.trim())
          .slice(0, 3)
          .map((text, index) => ({ at: index, kind: "reaction" as const, text: text.slice(0, 300) }));
      }
      if (kind === "reply") {
        const text =
          typeof parsed === "string"
            ? parsed
            : typeof parsed === "object" && parsed !== null && "lines" in parsed
              ? (slurpLiveParseLines(parsed)[0]?.text ?? "")
              : "";
        return text ? [{ at: Date.now(), kind: "reaction", text: text.slice(0, 1000) }] : [];
      }
      onParsed?.(parsed);
      return slurpLiveParseLines(parsed);
    } finally {
      admission.release();
    }
  } catch (error) {
    logger.warn(error, "[slurp-live] Model output rejected");
    return [];
  }
}
