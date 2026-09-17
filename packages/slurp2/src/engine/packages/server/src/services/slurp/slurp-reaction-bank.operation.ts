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
import {
  mergeSlurpReactionBankBatch,
  SLURP_REACTION_BANK_TARGET,
  slurpReactionBodiesForType,
} from "./slurp-reaction-bank.js";
import { slurpFanVoiceForPrompt } from "./slurp-fan-types.js";
import { claimSlurpModelBudget, slurpModelWorkerAllows, type SlurpModelWorkerContext } from "./slurp-model-worker.js";
import { SLURP_SHIPPED_REACTIONS, SLURP_SHIPPED_TYPE_REACTIONS } from "./slurp-world-copy.js";
import { composeSlurpPromptBlocks } from "./slurp-prompt-blocks.js";

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

/** How many to ask for per bank in one call. Enough to be worth the round trip, short to parse. */
const PER_BANK = 20;

/** Never ask about more banks than this in one call, however many types the player defined. */
const MAX_BANKS = 9;

export type SlurpReactionBankOutcome = "idle" | "filled" | "busy" | "unavailable";

/**
 * Ask for one batch of new bodies, for every bank that is under target.
 *
 * One call, not one per Fan Type: eight types under target would otherwise be eight generations
 * for text nobody pays attention to, which is the trade this whole bank exists to avoid. Each bank
 * gets its own key in the answer, described by its type's name, voice and tone so a Troll does not
 * come back sounding like a Superfan.
 */
export async function topUpSlurpReactionBank(
  db: DB,
  context: SlurpModelWorkerContext = "background",
): Promise<SlurpReactionBankOutcome> {
  const noodle = createSlurpStorage(db);
  const settings = await noodle.getSettings();
  if (!slurpModelWorkerAllows(settings.modelBudget, context)) return "idle";
  const banks = settings.audienceReactionBank;
  const targets: Record<string, number> = {};
  if (banks.shared.length < SLURP_REACTION_BANK_TARGET) targets.shared = SLURP_REACTION_BANK_TARGET;
  const types = settings.fanTypes
    .filter((type) => type.enabled && type.bank.targetSize > 0)
    .filter((type) => (banks.byType[type.id] ?? []).length < type.bank.targetSize)
    .slice(0, MAX_BANKS);
  for (const type of types) targets[type.id] = type.bank.targetSize;
  if (Object.keys(targets).length === 0) return "idle";

  const connection = await resolveSlurpTextConnection(
    createConnectionsStorage(db),
    settings.modelBudget.connectionId ?? settings.generationConnectionId,
  );
  if (!connection) return "unavailable";
  // The bank is the least urgent work Slurp does, so it yields to everything: anything the player
  // started, and any other background run already holding this connection.
  const admission = tryBackgroundConnection(connection.id, new Date());
  if (!admission.acquired) return "busy";

  try {
    if (!(await claimSlurpModelBudget(db, settings.modelBudget, "bank_grow"))) return "busy";
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
    const briefs = [
      ...(targets.shared === undefined
        ? []
        : [`"shared": comments anybody could leave. Avoid: ${SLURP_SHIPPED_REACTIONS.slice(0, 12).join(", ")}`]),
      ...types.map((type) => {
        const sample = slurpReactionBodiesForType(
          { shared: [], byType: banks.byType },
          type.id,
          SLURP_SHIPPED_TYPE_REACTIONS[type.id] ?? [],
        ).slice(0, 6);
        return [
          `"${type.id}": ${type.name}.`,
          slurpFanVoiceForPrompt(type.voice) ? `Voice: ${slurpFanVoiceForPrompt(type.voice)}` : "",
          type.tone ? `Tone: ${type.tone}.` : "",
          sample.length > 0 ? `They already say: ${sample.join(", ")}. Write different ones.` : "",
        ]
          .filter(Boolean)
          .join(" ");
      }),
    ];
    const response = await provider.chatComplete(
      [
        {
          role: "system",
          content: composeSlurpPromptBlocks(
            "reactionBank",
            [
              {
                id: "task",
                kind: "editable",
                text: `Write ${PER_BANK} short throwaway comments for each group below, as that group would leave them under a post they liked.`,
              },
              {
                id: "style",
                kind: "editable",
                text: [
                  "These are the noise floor of a comment section: three or four words from somebody who wanted to be seen saying them. Not reviews, not questions, not compliments with reasons.",
                  "Lower case. No trailing punctuation and no emoji — those are added separately.",
                  "Each one must say nothing specific about the post: they are reused under thousands of different pictures.",
                  "Never name a person, a body part, an act, a place, or a price.",
                ].join("\n"),
              },
              {
                id: "tone",
                kind: "context",
                text: slurpAudienceToneInstruction(settings.audienceTone, settings.simulationTuning.prompts.tones),
              },
              { id: "groups", kind: "context", text: ["Groups:", ...briefs].join("\n") },
              {
                id: "output",
                kind: "required",
                text: `Return JSON only, one key per group: {${Object.keys(targets)
                  .map((id) => `"${id}": ["...", "..."]`)
                  .join(", ")}}`,
              },
            ],
            settings.promptBlocks,
          ),
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
          maxTokens: 512 + 256 * Object.keys(targets).length,
          maxTokensOverride: connection.maxTokensOverride,
        }),
        stream: false,
      },
    );
    // Guarded like every other Slurp parse: an empty provider answer must name its cause and its
    // fix, not surface as "Unexpected end of JSON input" in a log nobody can act on.
    // A refused or malformed run is a no-op, never a failed tick: the shipped bodies keep working.
    let parsed: unknown;
    try {
      parsed = parseGameJsonish(requireModelAnswer(response.content ?? "", "free comment lines"));
    } catch (error) {
      logger.warn(error, "[slurp-bank] Could not read the comment bank answer");
      return "unavailable";
    }
    const merged = mergeSlurpReactionBankBatch(banks, parsed, targets);
    if (merged === banks) return "unavailable";
    await noodle.updateSettings({ audienceReactionBank: merged });
    logger.info(
      "[slurp-bank] Grew %d comment banks (shared now %d)",
      Object.keys(targets).length,
      merged.shared.length,
    );
    return "filled";
  } finally {
    admission.release();
  }
}
