import {
  slpGeneratedDigestSchema,
  slpGeneratedFollowSchema,
  slpGeneratedInteractionSchema,
  slpGeneratedPostSchema,
  slpGeneratedRefreshSchema,
  type SlpGeneratedRefresh,
} from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import { parseGameJsonishSequence } from "../../../services/game/jsonish.js";
import { normalizeSlpHandle } from "../../base/identity/slp-handle.js";

type RefreshCollection = keyof SlpGeneratedRefresh;

export type RejectedSlpGeneratedRefreshItem = {
  collection: RefreshCollection;
  index: number;
  issueCount: number;
};

/**
 * Require a refresh to contain usable activity attributed to the exact cast
 * selected for this run. The persona may be a follow target, but generations
 * must never author posts or interactions on the user's behalf.
 */
export function validateSlpGeneratedRefresh(
  refresh: SlpGeneratedRefresh,
  allowedActorHandles: ReadonlySet<string>,
  knownHandles: ReadonlySet<string>,
): string | null {
  const hasActivity =
    refresh.posts.length + refresh.interactions.length + refresh.follows.length + refresh.digests.length > 0;
  if (!hasActivity) return "the response contained no timeline activity";

  const hasUsableAttribution =
    refresh.posts.some((post) => allowedActorHandles.has(normalizeSlpHandle(post.authorHandle))) ||
    refresh.interactions.some((interaction) => allowedActorHandles.has(normalizeSlpHandle(interaction.actorHandle))) ||
    refresh.follows.some(
      (follow) =>
        allowedActorHandles.has(normalizeSlpHandle(follow.actorHandle)) &&
        knownHandles.has(normalizeSlpHandle(follow.targetHandle)),
    );
  return hasUsableAttribution ? null : "the response used no selected participant handle";
}

function normalizedGeneratedContentKey(handle: string, content: string): string {
  const normalizedContent = content.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
  return `${normalizeSlpHandle(handle)}\u0000${normalizedContent}`;
}

/**
 * Keep the first generated post or reply for each account and discard later
 * copies. Posts take precedence because the response groups posts before
 * interactions. Filtering before media preparation ensures a copy never
 * reaches image generation or persistence.
 */
export function deduplicateGeneratedSlpContent(generated: SlpGeneratedRefresh): {
  generated: SlpGeneratedRefresh;
  removedCount: number;
} {
  const seenContent = new Set<string>();
  const retainedPosts = new Map<string, { index: number; tempId: string | undefined }>();
  const tempIdAliases = new Map<string, string>();
  let removedCount = 0;
  const keepFirst = (key: string): boolean => {
    if (seenContent.has(key)) {
      removedCount += 1;
      return false;
    }
    seenContent.add(key);
    return true;
  };

  const posts: SlpGeneratedRefresh["posts"] = [];
  for (const post of generated.posts) {
    const key = normalizedGeneratedContentKey(post.authorHandle, post.content);
    if (keepFirst(key)) {
      retainedPosts.set(key, { index: posts.length, tempId: post.tempId });
      posts.push(post);
      continue;
    }
    if (!post.tempId) continue;

    const retained = retainedPosts.get(key);
    if (!retained) continue;
    if (!retained.tempId) {
      const retainedPost = posts[retained.index];
      if (!retainedPost) continue;
      retained.tempId = post.tempId;
      posts[retained.index] = { ...retainedPost, tempId: retained.tempId };
    }
    tempIdAliases.set(post.tempId, retained.tempId);
  }

  const interactions = generated.interactions
    .filter((interaction) => {
      if (interaction.type !== "reply" || !interaction.content?.trim()) return true;
      return keepFirst(normalizedGeneratedContentKey(interaction.actorHandle, interaction.content));
    })
    .map((interaction) => {
      const targetTempId = interaction.targetTempId && tempIdAliases.get(interaction.targetTempId);
      return targetTempId ? { ...interaction, targetTempId } : interaction;
    });

  return {
    generated: { ...generated, posts, interactions },
    removedCount,
  };
}

const collectionSchemas = {
  posts: slpGeneratedPostSchema,
  interactions: slpGeneratedInteractionSchema,
  follows: slpGeneratedFollowSchema,
  digests: slpGeneratedDigestSchema,
} as const;

/**
 * Validate generated timeline rows independently. LLM output is untrusted and a
 * single malformed interaction must not discard otherwise valid activity.
 */
export function parseSlpGeneratedRefresh(value: unknown): {
  refresh: SlpGeneratedRefresh;
  rejected: RejectedSlpGeneratedRefreshItem[];
} {
  if (Array.isArray(value)) {
    const refresh: SlpGeneratedRefresh = { posts: [], interactions: [], follows: [], digests: [] };
    const rejected: RejectedSlpGeneratedRefreshItem[] = [];
    value.forEach((row, index) => {
      let parsedRow = false;
      for (const collection of Object.keys(collectionSchemas) as RefreshCollection[]) {
        const parsed = collectionSchemas[collection].safeParse(row);
        if (parsed.success) {
          (refresh[collection] as Array<typeof parsed.data>).push(parsed.data);
          parsedRow = true;
          break;
        }
      }
      if (!parsedRow) rejected.push({ collection: "posts", index, issueCount: 1 });
    });
    return { refresh, rejected };
  }

  const record =
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  if (!record) {
    slpGeneratedRefreshSchema.parse(value);
    return { refresh: { posts: [], interactions: [], follows: [], digests: [] }, rejected: [] };
  }

  const refresh: SlpGeneratedRefresh = { posts: [], interactions: [], follows: [], digests: [] };
  const rejected: RejectedSlpGeneratedRefreshItem[] = [];

  for (const collection of Object.keys(collectionSchemas) as RefreshCollection[]) {
    const rows = record[collection];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) {
      rejected.push({ collection, index: -1, issueCount: 1 });
      continue;
    }
    rows.forEach((row, index) => {
      const parsed = collectionSchemas[collection].safeParse(row);
      if (parsed.success) {
        // Each schema is tied to its collection; the indexed assignment keeps
        // that relationship while avoiding four duplicate parsing loops.
        (refresh[collection] as Array<typeof parsed.data>).push(parsed.data);
      } else {
        rejected.push({ collection, index, issueCount: parsed.error.issues.length });
      }
    });
  }

  return { refresh, rejected };
}

/**
 * Recover a complete refresh from adjacent JSON objects. Local models
 * sometimes emit one object per collection (posts, interactions, follows,
 * digests) even though the prompt requests a single enclosing object.
 */
export function parseSlpGeneratedRefreshResponse(raw: string): {
  refresh: SlpGeneratedRefresh;
  rejected: RejectedSlpGeneratedRefreshItem[];
} {
  const parsedValues = parseGameJsonishSequence(raw);
  if (parsedValues.length === 1) {
    const value = parsedValues[0];
    if (
      Array.isArray(value) &&
      value.length === 1 &&
      value[0] &&
      typeof value[0] === "object" &&
      !Array.isArray(value[0]) &&
      Object.keys(collectionSchemas).some((collection) => collection in value[0])
    ) {
      return parseSlpGeneratedRefresh(value[0]);
    }
    return parseSlpGeneratedRefresh(value);
  }

  const refresh: SlpGeneratedRefresh = { posts: [], interactions: [], follows: [], digests: [] };
  const rejected: RejectedSlpGeneratedRefreshItem[] = [];
  const sourceOffsets: Record<RefreshCollection, number> = { posts: 0, interactions: 0, follows: 0, digests: 0 };

  for (const value of parsedValues) {
    const parsed = parseSlpGeneratedRefresh(value);
    for (const collection of Object.keys(collectionSchemas) as RefreshCollection[]) {
      (refresh[collection] as unknown[]).push(...parsed.refresh[collection]);
      const collectionRejected = parsed.rejected.filter((item) => item.collection === collection);
      rejected.push(
        ...collectionRejected.map((item) => ({
          ...item,
          index: item.index < 0 ? item.index : item.index + sourceOffsets[collection],
        })),
      );
      sourceOffsets[collection] +=
        parsed.refresh[collection].length + collectionRejected.filter((item) => item.index >= 0).length;
    }
  }

  return { refresh, rejected };
}
