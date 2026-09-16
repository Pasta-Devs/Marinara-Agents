/**
 * Write the public or locked post guidance with the model, so the player does not have to invent
 * the wording for a prompt they never see.
 *
 * Plain prose in, plain prose out. The stage profile draft returns JSON because a profile has
 * fields; guidance is one paragraph, and asking a small local model for JSON around one string is
 * a second way for the call to fail.
 */
import type { APIProvider, NoodleIdentityDisclosure } from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "../generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { noodlerPublicIdentityFor, protectBoundedNoodlerGeneratedText } from "./slurp-generation.service.js";
import { requireModelAnswer } from "./slurp-model-answer.js";
import {
  cleanSlurpPostGuidanceDraft,
  SLURP_POST_GUIDANCE_MAX_LENGTH,
  type SlurpPostAccess,
} from "./slurp-post-guidance.js";
import { noodleSamplingOptions } from "./slurp-sampling-options.js";
import { resolveNoodlerCharacterCanon } from "./slurp-source-resolve.js";
import { composeSlurpPromptBlocks, type SlurpPromptBlockOverrides } from "./slurp-prompt-blocks.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

const ACCESS_BRIEF: Record<SlurpPostAccess, string> = {
  public:
    "Public posts may be a reader's first impression. They must be complete and worthwhile on their own, express something specific about the creator, and create honest curiosity without becoming repetitive subscription pitches or withholding the post's basic meaning.",
  locked:
    "Locked posts are the premium continuation for someone who already paid. They must deliver greater intimacy, candor, access, detail, or exclusivity without another sales pitch or artificial withholding. Premium need not mean sexual, but it must be a satisfying payoff rather than another preview.",
};

export function buildSlurpPostGuidanceDraftMessages(input: {
  access: SlurpPostAccess;
  /** The Creator's source card, when the guidance is being written for one Creator. */
  characterContext: string;
  /** What the player typed into the field before pressing generate, if anything. */
  currentDraft: string;
  /** Free-text steer from the player. */
  guidance: string;
  promptBlocks?: SlurpPromptBlockOverrides;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: composeSlurpPromptBlocks(
        "postGuidance",
        [
          {
            id: "task",
            kind: "editable",
            text: "You write one short instruction block for another AI. That AI writes posts for a creator page on Slurp, an adult subscription platform in Marinara Engine.",
          },
          {
            id: "accessRules",
            kind: "context",
            text: [
              `Write the direction for ${input.access === "public" ? "PUBLIC" : "LOCKED"} posts only.`,
              ACCESS_BRIEF[input.access],
            ].join("\n"),
          },
          {
            id: "style",
            kind: "editable",
            text: [
              'Address the post-writing AI as the creator, in the second person: "you". State what this kind of post is for, what it should do to the reader, and what it must not do.',
              "Write 2 to 5 sentences of plain prose. No headings, no lists, no preamble, no quotes around the answer, no commentary about the task.",
              "Never name a specific post, product, price, or platform feature that may not exist. Write direction, not an example post.",
              "Return the direction text and nothing else.",
            ].join("\n"),
          },
          { id: "output", kind: "required", text: "Return the direction text and nothing else." },
        ],
        input.promptBlocks,
      ),
    },
    {
      role: "user",
      content: [
        ...(input.characterContext ? ["# Source character", input.characterContext, ""] : []),
        ...(input.currentDraft.trim() ? ["# Current direction to improve", input.currentDraft.trim(), ""] : []),
        "# What the player asked for",
        input.guidance.trim() || "No extra instructions. Write the strongest general direction for this access type.",
      ].join("\n"),
    },
  ];
}

export async function generateSlurpPostGuidanceDraft(
  db: DB,
  input: {
    access: SlurpPostAccess;
    /** Null for the global field; a Creator id when drafting that Creator's override. */
    creatorId: string | null;
    currentDraft: string;
    guidance: string;
    connection: GenerationConnection;
    promptBlocks?: SlurpPromptBlockOverrides;
  },
): Promise<{ guidance: string }> {
  const noodle = createSlurpStorage(db);
  const account = input.creatorId ? await noodle.getNoodlerAccountById(input.creatorId) : null;
  if (input.creatorId && !account) throw new Error("Slurp stage profile not found.");
  const disclosureMode: NoodleIdentityDisclosure = account?.settings.privacy.identityDisclosure ?? "open";
  const publicAccount = account ? await noodle.resolveAccountSource(account) : null;
  // Concealed Creators get the same seed the stage profile draft uses; what may be *said* about
  // them is limited by the protection pass below, not by hiding the card from the writer.
  const characterContext = account ? await resolveNoodlerCharacterCanon(db, publicAccount, disclosureMode) : "";
  const publicIdentity = await noodlerPublicIdentityFor(db, publicAccount);
  const messages = buildSlurpPostGuidanceDraftMessages({
    access: input.access,
    characterContext,
    currentDraft: input.currentDraft,
    guidance: input.guidance,
    promptBlocks: input.promptBlocks,
  });
  const debugMode = isDebugAgentsEnabled();
  logDebugOverride(
    debugMode,
    "[debug/slurp] Post guidance draft prompt prepared with %d messages; private source content is redacted.",
    messages.length,
  );
  const connections = createConnectionsStorage(db);
  const fallbackConnection = await connections.getFallbackForMain();
  const provider = withConnectionFallbackProvider({
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
  });
  const response = await provider.chatComplete(messages, {
    model: input.connection.model,
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      maxTokens: resolveStoredMaxTokens(input.connection.defaultParameters, 600),
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    ...noodleSamplingOptions(
      resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
      { temperature: 0.8, topP: 0.9 },
    ),
    stream: false,
    debugMode,
  });
  // Empty answers have their own advice (raise max output tokens), so let this throw for them.
  const guidance = cleanSlurpPostGuidanceDraft(requireModelAnswer(response.content ?? "", "post guidance"));
  // This text is stored, shown, and later spliced into the post prompt. A hinted Creator's source
  // name must not reach it by any of those routes.
  const protectedGuidance = protectBoundedNoodlerGeneratedText(
    guidance,
    disclosureMode,
    publicIdentity,
    SLURP_POST_GUIDANCE_MAX_LENGTH,
  );
  if (!protectedGuidance) throw new Error("The model did not return usable post guidance. Try again.");
  return { guidance: protectedGuidance };
}
