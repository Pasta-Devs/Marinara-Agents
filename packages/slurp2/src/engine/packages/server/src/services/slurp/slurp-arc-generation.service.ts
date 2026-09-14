/**
 * A model-invented arc for one Creator. One small structured call; the answer is only raw JSON here
 * and is clamped by `slurpGeneratedArcProject` before anything is stored.
 */
import type { APIProvider } from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "../generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { parseGameJsonish } from "../game/jsonish.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { resolveSlurpTextConnection } from "./slurp-connection.js";
import { withConnectionAdmissionProvider, type ConnectionAdmissionMode } from "../generation/connection-admission.js";
import { SLURP_MODIFIER_KINDS } from "./slurp-creator-state.js";
import { modelAnswerForCorrection, requireModelAnswer } from "./slurp-model-answer.js";
import { noodleSamplingOptions } from "./slurp-sampling-options.js";
import { claimSlurpModelBudget, slurpModelWorkerAllows } from "./slurp-model-worker.js";

export function buildSlurpArcGenerationMessages(input: {
  stagePersonality: string;
  gender: string | null;
  tags: readonly string[];
  brief?: string;
  recentPosts: readonly string[];
  libraryNames: readonly string[];
  pastArcTitles: readonly string[];
  /** A crossover's other creators. */
  partners?: readonly { name: string; stagePersonality: string; tags: readonly string[] }[];
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "Invent one life arc for a Slurp creator: something that happens in their own life over days or weeks and that they keep posting about.",
        'Return JSON only: {"title": string, "direction": string, "tone": string, "chapters": [{"label": string, "minDays": number, "maxDays": number}], "durationDays": number}.',
        "title is a short name. direction says what connects the posts and where it goes. tone is one or two words; any tone fits.",
        "chapters are 0 to 12 short beats in order, each lasting minDays to maxDays (0-90). Use an empty list for an open-ended arc, and then set durationDays (1-365).",
        'At most one chapter in the whole arc may add "choice": {"question": string, "options": [{"label": string, "chapters": [{"label": string, "minDays": number, "maxDays": number}]}]}. Fans vote on it at the end of that chapter. Give 2 to 4 distinct options; each option\'s 0 to 4 chapters are inserted after that chapter if it wins. Leave choice out when the arc does not need one.',
        `Any chapter may add "mood": one of ${SLURP_MODIFIER_KINDS.join(", ")} (how the creator feels when it starts), and "effects": {"growth": number, "earnings": number, "loyalty": number} as whole percent changes from -50 to 50 while it runs. Leave both out when a chapter changes nothing.`,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "# Stage personality",
        input.stagePersonality || "Not set.",
        `Gender: ${input.gender ?? "not set"}`,
        `Tags: ${input.tags.join(", ") || "none"}`,
        ...(input.brief?.trim() ? ["", "# Player brief", input.brief.trim().slice(0, 2_000)] : []),
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
                  `- ${partner.name}: ${partner.stagePersonality || "personality not set"} (tags: ${partner.tags.join(", ") || "none"})`,
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
    const partners = [];
    for (const id of partnerIds) {
      const partner = await slurp.getNoodlerAccountById(id, { includeHidden: true });
      if (partner)
        partners.push({
          name: partner.displayName,
          stagePersonality: partner.settings.privacy.stagePersonality ?? "",
          tags: partner.settings.profile.tags,
        });
    }
    const settings = await slurp.getSettings();
    const workerContext = admissionMode.kind === "background" ? "background" : "present";
    if (!slurpModelWorkerAllows(settings.modelBudget, workerContext)) return null;
    if (!(await claimSlurpModelBudget(db, settings.modelBudget, "arc"))) return null;
    const connections = createConnectionsStorage(db);
    const connection = await resolveSlurpTextConnection(connections, settings.generationConnectionId);
    if (!connection) return null;
    const posts = (await slurp.listNoodlerPostsByAccounts([creator.id], 6)).get(creator.id) ?? [];
    const messages = buildSlurpArcGenerationMessages({
      stagePersonality: creator.settings.privacy.stagePersonality ?? "",
      gender: creator.settings.profile.gender,
      tags: creator.settings.profile.tags,
      brief,
      recentPosts: posts.map((post) => `${post.title ? `${post.title} — ` : ""}${post.content}`.slice(0, 200)),
      libraryNames: settings.arcLibrary.filter((type) => !type.hidden).map((type) => type.name),
      pastArcTitles: (await slurp.listProjects(creator.id)).map((project) => project.title),
      partners,
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
      ...noodleSamplingOptions(
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
    } catch {
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
      return parseSlurpGeneratedArc(retry.content ?? "");
    }
  } catch {
    return null;
  }
}
