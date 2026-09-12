import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { tryBackgroundConnection } from "../generation/connection-admission.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../generation/generation-parameters.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { requireModelAnswer } from "./slurp-model-answer.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { resolveSlurpTextConnection } from "./slurp-connection.js";
import { noodleSamplingOptions } from "./slurp-sampling-options.js";
import { slurpAudienceToneInstruction } from "./slurp-tone.js";
import { mergeSlurpReactionBank, SLURP_REACTION_BANK_TARGET } from "./slurp-reaction-bank.js";
import { SLURP_SHIPPED_REACTIONS } from "./slurp-world-copy.js";

/**
 * Growing the free comment bank.
 *
 * The free tier writes more text than everything else on the platform combined, and it must never
 * call the model to do it — a three-word comment is the worst possible trade for a generation. So
 * it draws from a bank. A fixed bank repeats, and the shipped bodies are the floor rather than the
 * ceiling.
 *
 * This is the one place a model call buys free text: a single call leaves forty new bodies behind,
 * and every free comment from then on draws from them at no cost. Amortised over the thousands of
 * comments the pulse writes, the cost per comment rounds to nothing.
 *
 * It is deliberately rare and deliberately skippable. The bank is a nicety; a run that is refused,
 * fails, or returns nothing usable leaves the shipped bodies doing their job.
 */

/** How many to ask for in one call. Enough to be worth the round trip, short enough to parse. */
const BATCH = 40;

export type SlurpReactionBankOutcome = "idle" | "filled" | "busy" | "unavailable";

/** Ask for one batch of new bodies. Returns what survived normalisation. */
export async function topUpSlurpReactionBank(db: DB): Promise<SlurpReactionBankOutcome> {
  const noodle = createSlurpStorage(db);
  const settings = await noodle.getSettings();
  if (settings.audienceReactionBank.length >= SLURP_REACTION_BANK_TARGET) return "idle";

  const connection = await resolveSlurpTextConnection(createConnectionsStorage(db), settings.generationConnectionId);
  if (!connection) return "unavailable";
  // The bank is the least urgent work Slurp does, so it yields to everything: anything the player
  // started, and any other background run already holding this connection.
  const admission = tryBackgroundConnection(connection.id, new Date());
  if (!admission.acquired) return "busy";

  try {
    const provider = createLLMProvider(
      connection.provider,
      resolveBaseUrl(connection),
      connection.apiKey,
      connection.maxContext,
      connection.openrouterProvider,
      connection.maxTokensOverride,
      connection.claudeFastMode === "true",
      connection.treatAsLocalEndpoint === "true",
      connection.defaultParameters,
    );
    const response = await provider.chatComplete(
      [
        {
          role: "system",
          content: [
            `Write ${BATCH} short throwaway comments a fan leaves under a post they liked.`,
            "These are the noise floor of a comment section: three or four words from somebody who wanted to be seen saying them. Not reviews, not questions, not compliments with reasons.",
            "Lower case. No trailing punctuation and no emoji — those are added separately.",
            "Each one must say nothing specific about the post: they are reused under thousands of different pictures.",
            "Never name a person, a body part, an act, a place, or a price.",
            slurpAudienceToneInstruction(settings.audienceTone),
            `Avoid anything close to these, which are already in the bank: ${[...SLURP_SHIPPED_REACTIONS, ...settings.audienceReactionBank].join(", ")}`,
            'Return JSON only: {"lines": ["...", "..."]}',
          ].join("\n"),
        },
        { role: "user", content: "Write the lines." },
      ],
      {
        model: connection.model,
        ...noodleSamplingOptions(
          resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
          // Hotter than the batched audience run: the whole job is to be unlike what is stored.
          { temperature: 1, topP: 0.98 },
        ),
        maxTokens: clampGenerationMaxOutputTokens({
          provider: connection.provider,
          model: connection.model,
          maxTokens: 1024,
          maxTokensOverride: connection.maxTokensOverride,
        }),
        stream: false,
      },
    );
    // Guarded like every other Slurp parse: an empty provider answer must name its cause and its
    // fix, not surface as "Unexpected end of JSON input" in a log nobody can act on.
    const parsed = parseGameJsonish(requireModelAnswer(response.content ?? "", "free comment lines"));
    const lines = Array.isArray(parsed) ? parsed : ((parsed as { lines?: unknown })?.lines ?? []);
    const merged = mergeSlurpReactionBank(settings.audienceReactionBank, Array.isArray(lines) ? lines : []);
    if (merged.length === settings.audienceReactionBank.length) return "unavailable";
    await noodle.updateSettings({ audienceReactionBank: merged });
    logger.info(
      "[slurp-bank] Added %d free comment lines (bank now %d)",
      merged.length - settings.audienceReactionBank.length,
      merged.length,
    );
    return "filled";
  } finally {
    admission.release();
  }
}
