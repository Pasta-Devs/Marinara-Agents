import {
  noodleGeneratedFanActivitySchema,
  type NoodleAccount,
  type NoodleGeneratedFanRefresh,
  type NoodleInteraction,
  type NoodlerFanArchetypeWeights,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../generation/generation-parameters.js";
import { noodleSamplingOptions } from "./slurp-sampling-options.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { requireModelAnswer } from "./slurp-model-answer.js";
import { noodleImageContext } from "./slurp-image-prompt.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { resolveSlurpTextConnection } from "./slurp-connection.js";
import { createSlurpStorage, type SlurpSettings } from "../storage/slurp.storage.js";
import { slurpAudienceToneInstruction } from "./slurp-tone.js";
import { slurpArcDescription, type SlurpArc } from "./slurp-arc.js";
import {
  NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR,
  NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN,
  type NoodleFanActivityToStore,
} from "./slurp-fan-activity-day-plan.js";
import {
  syntheticNoodlerFanIdentityProvider,
  type NoodlerFanIdentity,
  type NoodlerFanIdentityProvider,
} from "./slurp-fan-identity-provider.js";
import { noodleResponseFormat } from "./slurp-response-format.js";
import { normalizeSlurpFanActivityRows } from "./slurp-fan-activity-response.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export const MAX_FAN_POSTS_PER_CREATOR = 4;

export interface ResolvedNoodlerFanActivityPolicy {
  enabled: boolean;
  archetypeWeights: NoodlerFanArchetypeWeights;
}

export function resolveNoodlerFanActivityPolicy(
  settings: Pick<SlurpSettings, "fanArchetypeWeights" | "fanActivityEnabled">,
  creator: NoodleAccount,
): ResolvedNoodlerFanActivityPolicy {
  const override = creator.settings.scheduler.fanActivity;
  const archetypeWeights = { ...settings.fanArchetypeWeights, ...override?.archetypeWeights };
  return {
    enabled: override?.enabled ?? settings.fanActivityEnabled,
    archetypeWeights,
  };
}

export interface NoodlerFanCreatorCandidate {
  creator: NoodleAccount;
  policy: ResolvedNoodlerFanActivityPolicy;
  posts: Array<{
    id: string;
    creatorAccountId: string;
    title: string | null;
    content: string;
    /** What the attached image shows, so a reply can react to the picture instead of ignoring it. */
    image?: string | null;
    access: "public" | "locked";
  }>;
  identities: NoodlerFanIdentity[];
}

function weightedIdentitySequence(identities: NoodlerFanIdentity[], weights: NoodlerFanArchetypeWeights) {
  return identities
    .map((identity) => ({ identity, weight: Math.max(0, weights[identity.archetype]) }))
    .filter(({ weight }) => weight > 0);
}

export function selectNoodlerFanActivities(input: {
  activities: NoodleGeneratedFanRefresh["activities"];
  creators: readonly NoodlerFanCreatorCandidate[];
  existingInteractions: readonly Pick<NoodleInteraction, "postId" | "actorAccountId" | "type" | "content">[];
  quotas: { like: number; reply: number; repost: number };
}): NoodleFanActivityToStore[] {
  const creatorById = new Map(input.creators.map((candidate) => [candidate.creator.id, candidate]));
  const postOwnerById = new Map(
    input.creators.flatMap((candidate) => candidate.posts.map((post) => [post.id, candidate.creator.id])),
  );
  const identityByHandle = new Map(
    input.creators.flatMap((candidate) =>
      candidate.identities.map((identity) => [identity.snapshot.handle.toLowerCase(), identity]),
    ),
  );
  const seen = new Set(
    input.existingInteractions.map(
      (interaction) => `${interaction.postId}:${interaction.actorAccountId}:${interaction.type}`,
    ),
  );
  const quotas = { ...input.quotas };
  const creatorCounts = new Map<string, number>();
  const creatorSlotSeen = new Set<string>();
  const selected: NoodleFanActivityToStore[] = [];
  for (const activity of input.activities) {
    if (quotas[activity.type] <= 0) continue;
    const creator = creatorById.get(activity.creatorAccountId);
    if (!creator || postOwnerById.get(activity.targetPostId) !== creator.creator.id) continue;
    if ((creatorCounts.get(creator.creator.id) ?? 0) >= NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR) continue;
    const identity = identityByHandle.get(activity.actorHandle.toLowerCase());
    if (!identity || !creator.identities.some((candidate) => candidate.id === identity.id)) continue;
    const content = activity.type === "reply" ? activity.content?.trim() || null : null;
    if (activity.type === "reply" && !content) continue;
    const key = `${activity.targetPostId}:${identity.id}:${activity.type}`;
    if (seen.has(key)) continue;
    const creatorSlotKey = `${creator.creator.id}:${identity.id}:${activity.type}`;
    if (activity.type !== "like" && creatorSlotSeen.has(creatorSlotKey)) continue;
    seen.add(key);
    if (activity.type !== "like") creatorSlotSeen.add(creatorSlotKey);
    quotas[activity.type] -= 1;
    creatorCounts.set(creator.creator.id, (creatorCounts.get(creator.creator.id) ?? 0) + 1);
    selected.push({
      creatorId: creator.creator.id,
      actorId: identity.id,
      type: activity.type,
      targetPostId: activity.targetPostId,
      content,
      snapshot: identity.snapshot,
    });
  }
  return selected;
}

/**
 * One line describing what this person is to this Creator.
 *
 * Kept to a sentence. The prompt already carries the posts, the creator card, and every other
 * actor; a paragraph per fan would crowd out the thing they are reacting to.
 */
function describeFanRelationship(persona: {
  spendTier: string;
  stage?: string;
  spent?: number;
  knownForDays?: number;
  arc?: string;
}): string {
  const parts: string[] = [];
  if (persona.stage && persona.stage !== "stranger") parts.push(persona.stage);
  const arc = persona.arc ? slurpArcDescription(persona.arc as SlurpArc) : null;
  if (arc) parts.push(arc);
  if (persona.knownForDays !== undefined) {
    parts.push(
      persona.knownForDays < 14
        ? "new here"
        : persona.knownForDays < 90
          ? `around for ${Math.round(persona.knownForDays / 7)} weeks`
          : `around for ${Math.round(persona.knownForDays / 30)} months`,
    );
  }
  if (persona.spent) parts.push(`has spent ${persona.spent} coins here`);
  else if (persona.spendTier === "none") parts.push("has never paid for anything");
  return parts.length > 0 ? parts.join(", ") : "no history with this creator yet";
}

function buildFanActivityMessages(input: {
  creators: NoodlerFanCreatorCandidate[];
  settings: Pick<
    SlurpSettings,
    "fanLikesPerRefresh" | "fanRepliesPerRefresh" | "fanRepostsPerRefresh" | "audienceTone"
  >;
}): ChatMessage[] {
  const system = [
    "Propose quiet synthetic audience activity for the supplied Slurp posts.",
    "A post's image field describes its attached picture. Treat it as something the actor can see, and never ask to be shown an image that is already described.",
    "Posts marked locked are paid posts. Only subscribers see them, so react to the title and the fact it is paid; never invent or state its hidden contents.",
    "Use only supplied creator IDs, actor handles, and post IDs. Never invent identifiers.",
    "Likes and reposts have null content. Replies are one short sentence, normally under 180 characters, natural, relevant, and not repetitive.",
    "Return JSON only with an activities array.",
    "Each actor handle has a weight; prefer higher-weight actors more often, proportionally.",
    slurpAudienceToneInstruction(input.settings.audienceTone),
    "Actors carry traits and a relationship to the creator. Write each reply as that specific person: a long-standing paying regular does not sound like somebody who arrived yesterday, and somebody whose trait is 'emoji only' does not write a paragraph.",
    `At most ${input.settings.fanLikesPerRefresh} likes, ${input.settings.fanRepliesPerRefresh} replies, and ${input.settings.fanRepostsPerRefresh} reposts total.`,
    `At most ${NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR} activities for any creator.`,
  ].join("\n");
  const creators = input.creators.map((candidate) => ({
    creatorAccountId: candidate.creator.id,
    creator: {
      displayName: candidate.creator.displayName,
      handle: candidate.creator.handle,
      bio: candidate.creator.bio,
    },
    // Each actor arrives as a person, not a name. A comment from "a regular who has spent 240
    // coins here over four months and only shows up at night" is a different comment from one by
    // an anonymous handle, and all of this was already stored and thrown away.
    actorHandles: weightedIdentitySequence(candidate.identities, candidate.policy.archetypeWeights).map(
      ({ identity, weight }) => ({
        handle: identity.snapshot.handle,
        weight,
        ...(identity.persona
          ? {
              traits: identity.persona.traits,
              relationship: describeFanRelationship(identity.persona),
            }
          : {}),
      }),
    ),
    // Locked bodies stay out, but the image line stays in: a teaser's picture is public.
    posts: candidate.posts.map(({ id, title, content, image, access }) =>
      access === "locked"
        ? { id, title, access, ...(image && { image }) }
        : { id, title, content, access, ...(image && { image }) },
    ),
  }));
  return [
    { role: "system", content: system },
    { role: "user", content: `# Slurp audience data\n${JSON.stringify({ creators }, null, 2)}` },
  ];
}

async function generateFanActivity(input: {
  connection: GenerationConnection;
  settings: Pick<SlurpSettings, "fanLikesPerRefresh" | "fanRepliesPerRefresh" | "fanRepostsPerRefresh">;
  creators: NoodlerFanCreatorCandidate[];
  debugMode: boolean;
}): Promise<NoodleGeneratedFanRefresh> {
  const provider = createLLMProvider(
    input.connection.provider,
    resolveBaseUrl(input.connection),
    input.connection.apiKey,
    input.connection.maxContext,
    input.connection.openrouterProvider,
    input.connection.maxTokensOverride,
    input.connection.claudeFastMode === "true",
    input.connection.treatAsLocalEndpoint === "true",
    input.connection.defaultParameters,
  );
  const messages = buildFanActivityMessages(input);
  logDebugOverride(
    input.debugMode,
    "[debug/noodler-fan] Prompt prepared with %d messages; audience content is redacted.",
    messages.length,
  );
  const response = await provider.chatComplete(messages, {
    model: input.connection.model,
    ...noodleSamplingOptions(
      resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
      { temperature: 0.8, topP: 0.95 },
    ),
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider,
      model: input.connection.model,
      maxTokens: 1024,
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    stream: false,
    debugMode: input.debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "noodler_fan_activity"),
  });
  const content = response.content ?? "";
  logDebugOverride(
    input.debugMode,
    "[debug/noodler-fan] Model response received (%d characters); content is redacted.",
    content.length,
  );
  const creatorAccountIdByPostId = new Map(
    input.creators.flatMap((candidate) => candidate.posts.map((post) => [post.id, candidate.creator.id] as const)),
  );
  const parsed = parseGeneratedFanActivityResponse(
    parseGameJsonish(requireModelAnswer(content, "fan activity")),
    creatorAccountIdByPostId,
  );
  if (parsed.rejected > 0) {
    logger.warn("Ignored %d malformed generated NoodleR fan activities", parsed.rejected);
  }
  return parsed.value;
}

export function parseGeneratedFanActivityResponse(
  value: unknown,
  creatorAccountIdByPostId: ReadonlyMap<string, string> = new Map(),
): {
  value: NoodleGeneratedFanRefresh;
  rejected: number;
} {
  const normalized = normalizeSlurpFanActivityRows(value, creatorAccountIdByPostId);
  const accepted = normalized.rows.flatMap((row) => {
    const parsed = noodleGeneratedFanActivitySchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
  return {
    value: { activities: accepted },
    rejected: normalized.rejected + normalized.rows.length - accepted.length,
  };
}

export async function prepareNoodlerFanCreatorCandidates(input: {
  db: DB;
  settings: Pick<SlurpSettings, "fanActivityEnabled" | "fanArchetypeWeights">;
  creatorIds: string[];
  identityProvider?: NoodlerFanIdentityProvider;
}): Promise<NoodlerFanCreatorCandidate[]> {
  const noodle = createSlurpStorage(input.db);
  const creators = (
    await Promise.all(
      input.creatorIds.slice(0, NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN).map((id) => noodle.getNoodlerAccountById(id)),
    )
  ).filter((creator): creator is NoodleAccount => creator !== null);
  const postsByCreator = await noodle.listNoodlerPostsByAccounts(
    creators.map((creator) => creator.id),
    MAX_FAN_POSTS_PER_CREATOR,
  );
  const provider = input.identityProvider ?? syntheticNoodlerFanIdentityProvider;
  return creators.flatMap((creator) => {
    const policy = resolveNoodlerFanActivityPolicy(input.settings, creator);
    if (!policy.enabled) return [];
    const posts = (postsByCreator.get(creator.id) ?? []).slice(0, MAX_FAN_POSTS_PER_CREATOR).map((post) => ({
      id: post.id,
      creatorAccountId: creator.id,
      title: post.title,
      content: post.content,
      image: noodleImageContext(post),
      access: post.access,
    }));
    const identities = provider.resolve(policy.archetypeWeights);
    return posts.length > 0 && identities.length > 0 ? [{ creator, policy, posts, identities }] : [];
  });
}

export async function generateNoodlerFanActivityBatch(input: {
  db: DB;
  settings: Pick<
    SlurpSettings,
    "fanLikesPerRefresh" | "fanRepliesPerRefresh" | "fanRepostsPerRefresh" | "audienceTone"
  >;
  connection: GenerationConnection;
  creators: NoodlerFanCreatorCandidate[];
  debugMode?: boolean;
}): Promise<NoodleFanActivityToStore[]> {
  if (input.creators.length === 0) return [];
  if (
    input.settings.fanLikesPerRefresh + input.settings.fanRepliesPerRefresh + input.settings.fanRepostsPerRefresh ===
    0
  ) {
    return [];
  }
  const generated = await generateFanActivity({ ...input, debugMode: input.debugMode === true });
  const postIds = input.creators.flatMap((creator) => creator.posts.map((post) => post.id));
  const existing = await createSlurpStorage(input.db).listNoodlerInteractions(postIds);
  return selectNoodlerFanActivities({
    activities: generated.activities,
    creators: input.creators,
    existingInteractions: existing,
    quotas: {
      like: input.settings.fanLikesPerRefresh,
      reply: input.settings.fanRepliesPerRefresh,
      repost: input.settings.fanRepostsPerRefresh,
    },
  });
}

export async function resolveNoodlerFanConnection(db: DB, settings: Pick<SlurpSettings, "generationConnectionId">) {
  return resolveSlurpTextConnection(createConnectionsStorage(db), settings.generationConnectionId);
}
