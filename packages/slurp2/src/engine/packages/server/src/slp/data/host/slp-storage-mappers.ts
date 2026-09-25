import { normalizeAvatarCrop } from "@marinara-engine/shared";
import { createSlpPoll, readSlpPollFromMetadata } from "../../../../../shared/src/slp/slp-polls.js";
import { SlpPollInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import {
  SlpAccount,
  SlpAccountSettings,
  SlpAccountSubscription,
  SlpAuthorSnapshot,
  SlpCreatorManagedPost,
  SlpDigestEntry,
  SlpInteraction,
  SlpInteractionType,
  SlpPost,
  SlpPostUnlock,
  SlpRefreshRun,
} from "../../../../../shared/src/slp/slp-social.types.js";
import {
  parseRecord,
  emptySlpAccountSettings,
  normalizeSlpAccountSettings,
  parseRefreshAttempts,
  parseStringArray,
  parseAuthorSnapshot,
  normalizeBool,
  normalizeHandle,
  normalizeAccountKind,
} from "../../modules/records/slp-storage-model.js";
import type {
  SlurpSourceKind,
  SlurpAccount,
  AccountRow,
  PostRow,
  InteractionRow,
  DigestRow,
  RefreshRunRow,
  SubscriptionRow,
  PostUnlockRow,
} from "../../modules/records/slp-storage-model.js";
export function mapAccount(row: AccountRow): SlurpAccount {
  const settings = normalizeSlpAccountSettings(row.settings);
  return {
    id: row.id,
    kind: normalizeAccountKind(row.kind),
    entityId: row.entityId,
    handle: row.handle,
    displayName: row.displayName,
    bio: row.bio ?? "",
    avatarUrl: row.avatarUrl ?? null,
    avatarCrop: settings.profile.avatarCrop ?? null,
    invited: normalizeBool(row.invited),
    settings,
    platform: "slurp",
    slurpSourceAccountId: null,
    sourceKind: normalizeAccountKind(row.sourceKind ?? row.kind) as SlurpSourceKind,
    sourceEntityId: row.sourceEntityId ?? row.entityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapViewer(
  personaId: string,
  settings: SlpAccountSettings,
  persona: {
    name: string;
    convoDisplayName?: string | null;
    avatarPath?: string | null;
    avatarCrop?: unknown;
    createdAt?: string;
    updatedAt?: string;
  },
): SlpAccount {
  return {
    id: personaId,
    kind: "persona",
    entityId: personaId,
    handle: normalizeHandle(persona.convoDisplayName || persona.name, personaId),
    displayName: persona.convoDisplayName || persona.name || "User",
    bio: "",
    avatarUrl: persona.avatarPath ?? null,
    avatarCrop: normalizeAvatarCrop(persona.avatarCrop),
    invited: true,
    settings,
    platform: "slurp",
    slurpSourceAccountId: null,
    createdAt: persona.createdAt ?? "",
    updatedAt: persona.updatedAt ?? persona.createdAt ?? "",
  };
}

export function sourceAccountFromEntity(
  kind: SlurpSourceKind,
  sourceEntityId: string,
  source: Record<string, unknown>,
): SlpAccount {
  const data = kind === "character" ? parseRecord(source.data) : source;
  const displayName = String(
    kind === "persona" ? source.convoDisplayName || source.name || "User" : data.name || "Character",
  );
  return {
    id: sourceEntityId,
    kind,
    entityId: sourceEntityId,
    handle: normalizeHandle(displayName, sourceEntityId),
    displayName,
    bio: String(kind === "persona" ? source.aboutMe || source.description || "" : data.description || ""),
    avatarUrl: typeof source.avatarPath === "string" ? source.avatarPath : null,
    avatarCrop: normalizeAvatarCrop(kind === "persona" ? source.avatarCrop : parseRecord(data.extensions).avatarCrop),
    invited: true,
    settings: emptySlpAccountSettings(),
    platform: "noodle",
    slurpSourceAccountId: null,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : "",
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
  };
}

/**
 * The author snapshot recorded for an account.
 *
 * Exported because `createNoodlerFanInteraction` refuses any activity whose planned snapshot is not
 * byte-identical to this, so a caller that plans activity for an account-backed audience member has
 * to build the snapshot from here rather than assembling its own and hoping the fields match.
 */
export function snapshotForAccount(account: SlpAccount): SlpAuthorSnapshot {
  return {
    id: account.id,
    kind: account.kind,
    entityId: account.entityId,
    handle: account.handle,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    avatarCrop: account.avatarCrop,
  };
}

export function mapPost(row: PostRow): SlpPost {
  const metadata = parseRecord(row.metadata);
  const secondary = Array.isArray(metadata.postMedia)
    ? metadata.postMedia.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const media = item as Record<string, unknown>;
        return typeof media.id === "string" && typeof media.position === "number" && typeof media.imageUrl === "string"
          ? [
              {
                id: media.id,
                position: media.position,
                imageUrl: media.imageUrl,
                imagePrompt: typeof media.imagePrompt === "string" ? media.imagePrompt : null,
              },
            ]
          : [];
      })
    : [];
  const images = row.imageUrl
    ? [
        {
          id: `${row.id}:primary`,
          position: 0,
          imageUrl: row.imageUrl,
          // The prompt this picture was drawn from; `row.imagePrompt` stays the post's draft.
          imagePrompt:
            (typeof metadata.imageProviderPrompt === "string" && metadata.imageProviderPrompt) ||
            (row.imagePrompt ?? null),
        },
        ...secondary,
      ]
    : secondary;
  return {
    id: row.id,
    authorAccountId: row.authorAccountId,
    content: row.content ?? "",
    imageUrl: row.imageUrl ?? null,
    imagePrompt: row.imagePrompt ?? null,
    images: images.sort((left, right) => left.position - right.position),
    parentPostId: row.parentPostId ?? null,
    quotePostId: row.quotePostId ?? null,
    source: row.source === "generated" ? "generated" : "manual",
    access: row.access === "public" ? "public" : "locked",
    metadata,
    authorSnapshot: parseAuthorSnapshot(row.authorSnapshot),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapManagedPost(row: PostRow): SlpCreatorManagedPost {
  return {
    ...mapPost(row),
    title: row.title?.trim() || null,
  };
}

export function updatePollMetadata(
  metadata: Record<string, unknown>,
  pollUpdate: SlpPollInput | null | undefined,
): Record<string, unknown> {
  if (pollUpdate === undefined) return { ...metadata };
  const currentPoll = readSlpPollFromMetadata(metadata);
  const generatedPoll = pollUpdate ? createSlpPoll(pollUpdate) : null;
  const historicalOptionIds = Array.isArray(metadata.pollOptionIds)
    ? metadata.pollOptionIds.filter((id): id is string => typeof id === "string")
    : [];
  const usedOptionIds = new Set([...historicalOptionIds, ...(currentPoll?.options.map((option) => option.id) ?? [])]);
  const currentOptions = currentPoll?.options ?? [];
  const matchedCurrentOptionIds = new Set<string>();
  const normalizeOptionLabel = (label: string) => label.trim().toLocaleLowerCase();
  const retainedOptionIds =
    generatedPoll?.options.map((option) => {
      const matched = currentOptions.find(
        (current) =>
          !matchedCurrentOptionIds.has(current.id) &&
          normalizeOptionLabel(current.label) === normalizeOptionLabel(option.label),
      );
      if (!matched) return null;
      matchedCurrentOptionIds.add(matched.id);
      return matched.id;
    }) ?? [];
  for (let index = 0; index < retainedOptionIds.length; index += 1) {
    if (retainedOptionIds[index]) continue;
    const samePosition = currentOptions[index];
    const matched =
      samePosition && !matchedCurrentOptionIds.has(samePosition.id)
        ? samePosition
        : currentOptions.find((current) => !matchedCurrentOptionIds.has(current.id));
    if (!matched) continue;
    matchedCurrentOptionIds.add(matched.id);
    retainedOptionIds[index] = matched.id;
  }
  let nextOptionNumber = 1;
  const nextPoll = generatedPoll
    ? {
        ...generatedPoll,
        options: generatedPoll.options.map((option, index) => {
          const retainedOptionId = retainedOptionIds[index];
          if (retainedOptionId) return { ...option, id: retainedOptionId };
          while (usedOptionIds.has(`option-${nextOptionNumber}`)) nextOptionNumber += 1;
          const id = `option-${nextOptionNumber}`;
          usedOptionIds.add(id);
          nextOptionNumber += 1;
          return { ...option, id };
        }),
      }
    : null;
  const nextMetadata = { ...metadata };
  if (nextPoll) nextMetadata.poll = nextPoll;
  else delete nextMetadata.poll;
  nextMetadata.pollOptionIds = [...usedOptionIds];
  return nextMetadata;
}

export function mapSubscription(row: SubscriptionRow): SlpAccountSubscription {
  return {
    id: row.id,
    viewerAccountId: row.viewerAccountId,
    creatorAccountId: row.creatorAccountId,
    createdAt: row.createdAt,
  };
}

export function mapPostUnlock(row: PostUnlockRow): SlpPostUnlock {
  return { id: row.id, viewerAccountId: row.viewerAccountId, postId: row.postId, createdAt: row.createdAt };
}

export function imageClaimIsAvailable(row: PostRow, at: string) {
  return (
    Boolean(row.imagePrompt) &&
    !row.imageUrl &&
    (!row.imageClaimToken || !row.imageClaimLeaseUntil || row.imageClaimLeaseUntil <= at)
  );
}

export function mapInteraction(row: InteractionRow): SlpInteraction {
  return {
    id: row.id,
    postId: row.postId,
    parentInteractionId: row.parentInteractionId ?? null,
    actorAccountId: row.actorAccountId,
    type:
      row.type === "repost" || row.type === "reply" || row.type === "like" || row.type === "vote"
        ? (row.type as SlpInteractionType)
        : "like",
    content: row.content ?? null,
    imageUrl: row.imageUrl ?? null,
    actorSnapshot: parseAuthorSnapshot(row.actorSnapshot),
    createdAt: row.createdAt,
  };
}

export function mapDigest(row: DigestRow): SlpDigestEntry {
  return {
    id: row.id,
    accountIds: parseStringArray(row.accountIds),
    content: row.content ?? "",
    sourceRunId: row.sourceRunId ?? null,
    sourcePostId: row.sourcePostId ?? null,
    sourceInteractionId: row.sourceInteractionId ?? null,
    createdAt: row.createdAt,
  };
}

export function mapRefreshRun(row: RefreshRunRow): SlpRefreshRun {
  return {
    id: row.id,
    status: row.status === "completed" || row.status === "failed" ? row.status : "running",
    activeAccountIds: parseStringArray(row.activeAccountIds),
    prompt: row.prompt ?? "",
    result: row.result ?? null,
    error: row.error ?? null,
    attempts: parseRefreshAttempts(row.attempts),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
