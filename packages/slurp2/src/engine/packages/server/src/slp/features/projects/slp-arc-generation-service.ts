/**
 * A model-invented arc for one Creator. One small structured call; the answer is only raw JSON here
 * and is clamped by `slurpGeneratedArcProject` before anything is stored.
 */
import { slurpCollabPartners } from "../../modules/projects/slp-project.js";
import type { APIProvider } from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../../config/runtime-config.js";
import type { DB } from "../../../db/connection.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import {
  resolveStoredChatOptions,
  resolveStoredMaxTokens,
} from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { parseGameJsonish } from "../../../services/game/jsonish.js";
import type { ChatMessage } from "../../../services/llm/base-provider.js";
import { withConnectionFallbackProvider } from "../../../services/llm/connection-fallback-provider.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import {
  withConnectionAdmissionProvider,
  type ConnectionAdmissionMode,
} from "../../../services/generation/connection-admission.js";
import { SLURP_MODIFIER_KINDS } from "../../modules/creators/slp-creator-state.js";
import { modelAnswerForCorrection, requireModelAnswer } from "../../base/model/slp-model-answer.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { claimSlurpModelBudget, slurpModelWorkerAllows } from "../../base/model/slp-model-worker.js";
import { composeSlurpPromptBlocks, type SlurpPromptBlockOverrides } from "../../base/prompting/slp-prompt-blocks.js";
import { slurpPromptContext } from "../../base/prompting/slp-prompt-blocks.js";

export class SlurpArcGenerationFailure extends Error {
  constructor(
    message: string,
    readonly rawResponse: string,
  ) {
    super(message);
    this.name = "SlurpArcGenerationFailure";
  }
}

export function buildSlurpArcGenerationMessages(input: {
  stagePersonality: string;
  gender: string | null;
  tags: readonly string[];
  brief?: string;
  /** Open story hooks from occasions: tags to lean toward and facts to stay consistent with. */
  storyHooks?: readonly string[];
  recentPosts: readonly string[];
  libraryNames: readonly string[];
  pastArcTitles: readonly string[];
  /** A crossover's other creators. */
  partners?: readonly { name: string; stagePersonality: string; tags: readonly string[]; collab?: string }[];
  promptBlocks?: SlurpPromptBlockOverrides;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: composeSlurpPromptBlocks(
        "arc",
        [
          {
            id: "task",
            kind: "editable",
            text: "Invent one life arc for a Slurp creator: something that happens in their own life over days or weeks and that they keep posting about.",
          },
          {
            id: "arcRules",
            kind: "editable",
            text: [
              'Return JSON only: {"title": string, "direction": string, "tone": string, "chapters": [{"label": string, "minDays": number, "maxDays": number}], "durationDays": number}.',
              "title is a short name. direction says what connects the posts and where it goes. tone is one or two words; any tone fits.",
              "chapters are 0 to 12 short beats in order, each lasting minDays to maxDays (0-90). Use an empty list for an open-ended arc, and then set durationDays (1-365).",
              'At most one chapter in the whole arc may add "choice": {"question": string, "options": [{"label": string, "chapters": [{"label": string, "minDays": number, "maxDays": number}]}]}. Fans vote on it at the end of that chapter. Give 2 to 4 distinct options; each option\'s 0 to 4 chapters are inserted after that chapter if it wins. Leave choice out when the arc does not need one.',
              `Any chapter may add "mood": one of ${SLURP_MODIFIER_KINDS.join(", ")} (how the creator feels when it starts), and "effects": {"growth": number, "earnings": number, "loyalty": number} as whole percent changes from -50 to 50 while it runs. Leave both out when a chapter changes nothing.`,
            ].join("\n"),
          },
          {
            id: "output",
            kind: "required",
            text: 'Return JSON only: {"title": string, "direction": string, "tone": string, "chapters": [{"label": string, "minDays": number, "maxDays": number}], "durationDays": number}.',
          },
          {
            id: "creator",
            kind: "context",
            text: [
              "# Stage personality",
              input.stagePersonality || "Not set.",
              `Gender: ${input.gender ?? "not set"}`,
              `Tags: ${input.tags.join(", ") || "none"}`,
            ].join("\n"),
          },
          {
            id: "history",
            kind: "context",
            text: [
              `# Recent posts`,
              ...(input.recentPosts.length ? input.recentPosts.map((post) => `- ${post}`) : ["None yet."]),
              `# Example arc types (for scale, do not copy): ${input.libraryNames.join(", ")}`,
              `# Arcs this creator already had (do not repeat): ${input.pastArcTitles.join(", ") || "none"}`,
            ].join("\n"),
          },
          ...(input.brief?.trim()
            ? [{ id: "brief", kind: "context" as const, text: `# Player brief\n${input.brief.trim().slice(0, 2_000)}` }]
            : []),
        ],
        input.promptBlocks,
      ),
    },
    {
      role: "user",
      content: [
        "# Stage personality",
        input.stagePersonality || "Not set.",
        `Gender: ${input.gender ?? "not set"}`,
        `Tags: ${input.tags.join(", ") || "none"}`,
        ...(input.brief?.trim() ? ["", "# Player brief", input.brief.trim().slice(0, 2_000)] : []),
        ...(input.storyHooks?.length
          ? ["", "# Story hooks from recent world events (lean toward these when they fit)", ...input.storyHooks]
          : []),
        "",
        "# Recent posts",
        ...(input.recentPosts.length ? input.recentPosts.map((post) => `- ${post}`) : ["None yet."]),
        "",
        `# Example arc types (for scale, do not copy): ${input.libraryNames.join(", ")}`,
        `# Arcs this creator already had (do not repeat): ${input.pastArcTitles.join(", ") || "none"}`,
        ...(input.partners?.length
          ? [
              "",
              "# Crossover: this arc is one shared story with these other creators, who post their own side of it",
              ...input.partners.map(
                (partner) =>
                  `- ${partner.name}: ${partner.stagePersonality || "personality not set"} (tags: ${partner.tags.join(", ") || "none"})${partner.collab?.trim() ? `. What the two of them make together: ${partner.collab.trim()}` : ""}`,
              ),
            ]
          : []),
      ].join("\n"),
    },
  ];
}

/** Parse the answer, or throw so the caller can retry once. */
export function parseSlurpGeneratedArc(content: string): Record<string, unknown> {
  const parsed = parseGameJsonish(requireModelAnswer(content, "an arc"));
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    typeof (parsed as { title?: unknown }).title !== "string"
  )
    throw new Error("Not an arc object.");
  return parsed as Record<string, unknown>;
}

/** The raw arc JSON, or null on any failure. No fallback text: a failed call means no arc. */
export async function generateSlurpArc(
  db: DB,
  creatorAccountId: string,
  partnerIds: readonly string[] = [],
  brief = "",
  admissionMode: ConnectionAdmissionMode = { kind: "foreground" },
): Promise<Record<string, unknown> | null> {
  try {
    const slurp = createSlurpStorage(db);
    const creator = await slurp.getNoodlerAccountById(creatorAccountId, { includeHidden: true });
    if (!creator) return null;
    const settings = await slurp.getSettings();
    const collabs = settings.creatorCollabs;
    const partners = [];
    for (const id of partnerIds) {
      const partner = await slurp.getNoodlerAccountById(id, { includeHidden: true });
      if (partner)
        partners.push({
          name: partner.displayName,
          stagePersonality: partner.settings.privacy.stagePersonality ?? "",
          tags: partner.settings.profile.tags,
          collab: slurpCollabPartners(collabs, creatorAccountId).find((entry) => entry.partnerId === id)?.content,
        });
    }
    const workerContext = admissionMode.kind === "background" ? "background" : "present";
    if (!slurpModelWorkerAllows(settings.modelBudget, workerContext)) return null;
    if (!(await claimSlurpModelBudget(db, settings.modelBudget, "arc"))) return null;
    const connections = createConnectionsStorage(db);
    const connection = await resolveSlurpTextConnection(
      connections,
      settings.modelBudget.connectionId ?? settings.generationConnectionId,
    );
    if (!connection) return null;
    const posts = (await slurp.listNoodlerPostsByAccounts([creator.id], 6)).get(creator.id) ?? [];
    const messages = buildSlurpArcGenerationMessages({
      stagePersonality: creator.settings.privacy.stagePersonality ?? "",
      gender: creator.settings.profile.gender,
      tags: creator.settings.profile.tags,
      brief,
      // Occasions leave arc opportunities and facts behind; arc generation never saw them.
      storyHooks: [
        ...(await slurp.listArcOpportunities().catch(() => []))
          .filter(
            (item) => item.creatorId === creator.id && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()),
          )
          .map((item) => `- Themes: ${item.storyTags.join(", ")}`),
        ...(await slurp.listStoryFacts().catch(() => []))
          .filter(
            (fact) => fact.creatorId === creator.id && (!fact.expiresAt || Date.parse(fact.expiresAt) > Date.now()),
          )
          .map((fact) => `- Fact: ${fact.label}`),
      ].slice(0, 10),
      recentPosts: posts.map((post) => `${post.title ? `${post.title} — ` : ""}${post.content}`.slice(0, 200)),
      libraryNames: settings.arcLibrary.filter((type) => !type.hidden).map((type) => type.name),
      pastArcTitles: (await slurp.listProjects(creator.id)).map((project) => project.title),
      partners,
      promptBlocks: slurpPromptContext(settings).blocks,
    });
    const fallbackConnection = await connections.getFallbackForMain();
    const fallbackProvider = withConnectionFallbackProvider({
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
      fallbackConnection,
      fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
      category: "main",
    });
    const provider = withConnectionAdmissionProvider(fallbackProvider, connection.id, admissionMode);
    const options = {
      model: connection.model,
      maxTokens: clampGenerationMaxOutputTokens({
        provider: connection.provider as APIProvider,
        model: connection.model,
        maxTokens: resolveStoredMaxTokens(connection.defaultParameters, 800),
        maxTokensOverride: connection.maxTokensOverride,
      }),
      ...slpSamplingOptions(
        resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
        { temperature: 0.9, topP: 0.95 },
      ),
      stream: false,
      debugMode: isDebugAgentsEnabled(),
      responseFormat: { type: "json_object" },
    } as const;
    const response = await provider.chatComplete(messages, options);
    try {
      return parseSlurpGeneratedArc(response.content ?? "");
    } catch (firstError) {
      // One retry with the shape spelled out, same as the stage profile draft.
      const answer = modelAnswerForCorrection(response.content);
      if (!(await claimSlurpModelBudget(db, settings.modelBudget, "arc"))) return null;
      const retry = await provider.chatComplete(
        [
          ...messages,
          ...(answer ? [{ role: "assistant" as const, content: answer }] : []),
          {
            role: "user",
            content:
              "That was not a valid arc object. Return exactly one JSON object with title, direction, tone, chapters (array of {label, minDays, maxDays}), and durationDays. No prose.",
          },
        ],
        options,
      );
      try {
        return parseSlurpGeneratedArc(retry.content ?? "");
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new SlurpArcGenerationFailure(
          `The model returned an unusable arc after two attempts. ${reason} First attempt: ${
            firstError instanceof Error ? firstError.message : String(firstError)
          }`,
          (retry.content ?? response.content ?? "").slice(0, 8_000),
        );
      }
    }
  } catch (error) {
    if (error instanceof SlurpArcGenerationFailure) throw error;
    return null;
  }
}
