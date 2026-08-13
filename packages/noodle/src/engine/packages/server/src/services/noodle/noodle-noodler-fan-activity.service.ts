import {
  noodleGeneratedFanActivitySchema,
  type NoodleAccount,
  type NoodleGeneratedFanRefresh,
  type NoodleInteraction,
  type NoodlerFanArchetypeWeights,
  type NoodleSettings,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../generation/generation-parameters.js";
import { noodleSamplingOptions } from "./noodle-sampling-options.js";
import { parseGameJsonish } from "../game/jsonish.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import {
  NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR,
  NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN,
  type NoodleFanActivityToStore,
} from "./noodle-fan-activity-day-plan.js";
import {
  syntheticNoodlerFanIdentityProvider,
  type NoodlerFanIdentity,
  type NoodlerFanIdentityProvider,
} from "./noodle-fan-identity-provider.js";
import { noodleResponseFormat } from "./noodle-response-format.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export const MAX_FAN_POSTS_PER_CREATOR = 4;

export interface ResolvedNoodlerFanActivityPolicy {
  enabled: boolean;
  archetypeWeights: NoodlerFanArchetypeWeights;
}

export function resolveNoodlerFanActivityPolicy(
  settings: NoodleSettings,
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

function buildFanActivityMessages(input: {
  creators: NoodlerFanCreatorCandidate[];
  settings: NoodleSettings;
}): ChatMessage[] {
  const system = [
    "Propose quiet synthetic audience activity for the supplied NoodleR posts.",
    "Posts marked locked are paid posts. Only subscribers see them, so react to the title and the fact it is paid; never invent or state its hidden contents.",
    "Use only supplied creator IDs, actor handles, and post IDs. Never invent identifiers.",
    "Likes and reposts have null content. Replies are one short sentence, normally under 180 characters, natural, relevant, and not repetitive.",
    "Return JSON only with an activities array.",
    "Each actor handle has a weight; prefer higher-weight actors more often, proportionally.",
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
    actorHandles: weightedIdentitySequence(candidate.identities, candidate.policy.archetypeWeights).map(
      ({ identity, weight }) => ({ handle: identity.snapshot.handle, weight }),
    ),
    // Locked bodies stay out of the prompt: a fan reply must not restate paid content.
    posts: candidate.posts.map(({ id, title, content, access }) =>
      access === "locked" ? { id, title, access } : { id, title, content, access },
    ),
  }));
  return [
    { role: "system", content: system },
    { role: "user", content: `# NoodleR audience data\n${JSON.stringify({ creators }, null, 2)}` },
  ];
}

async function generateFanActivity(input: {
  connection: GenerationConnection;
  settings: NoodleSettings;
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
      resolveStoredChatOptions(
        input.connection.defaultParameters,
        input.connection.provider,
        input.connection.model,
      ),
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
  const parsed = parseGeneratedFanActivityResponse(parseGameJsonish(content));
  if (parsed.rejected > 0) {
    logger.warn("Ignored %d malformed generated NoodleR fan activities", parsed.rejected);
  }
  return parsed.value;
}

export function parseGeneratedFanActivityResponse(value: unknown): {
  value: NoodleGeneratedFanRefresh;
  rejected: number;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { value: { activities: [] }, rejected: 0 };
  }
  const activities = (value as { activities?: unknown }).activities;
  if (!Array.isArray(activities)) return { value: { activities: [] }, rejected: 0 };
  const accepted = activities.flatMap((activity) => {
    if (!activity || typeof activity !== "object" || Array.isArray(activity)) return [];
    const row = activity as Record<string, unknown>;
    const parsed = noodleGeneratedFanActivitySchema.safeParse({
      ...row,
      creatorAccountId: row.creatorAccountId ?? row.creatorId,
      targetPostId: row.targetPostId ?? row.postId,
    });
    return parsed.success ? [parsed.data] : [];
  });
  return { value: { activities: accepted }, rejected: activities.length - accepted.length };
}

export async function prepareNoodlerFanCreatorCandidates(input: {
  db: DB;
  settings: NoodleSettings;
  creatorIds: string[];
  identityProvider?: NoodlerFanIdentityProvider;
}): Promise<NoodlerFanCreatorCandidate[]> {
  const noodle = createNoodleStorage(input.db);
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
    const posts = (postsByCreator.get(creator.id) ?? [])
      .slice(0, MAX_FAN_POSTS_PER_CREATOR)
      .map((post) => ({
        id: post.id,
        creatorAccountId: creator.id,
        title: post.title,
        content: post.content,
        access: post.access,
      }));
    const identities = provider.resolve(policy.archetypeWeights);
    return posts.length > 0 && identities.length > 0 ? [{ creator, policy, posts, identities }] : [];
  });
}

export async function generateNoodlerFanActivityBatch(input: {
  db: DB;
  settings: NoodleSettings;
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
  const existing = await createNoodleStorage(input.db).listNoodlerInteractions(postIds);
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

export async function resolveNoodlerFanConnection(db: DB, settings: NoodleSettings) {
  if (!settings.generationConnectionId) return null;
  return createConnectionsStorage(db).getWithKey(settings.generationConnectionId);
}
