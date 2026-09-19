import {
  createNoodlePoll,
  normalizeAvatarCrop,
  readNoodlePollFromMetadata,
  NoodleAccount,
  NoodleAccountSettings,
  NoodleAccountSubscription,
  NoodleAuthorSnapshot,
  NoodleDigestEntry,
  NoodleInteraction,
  NoodleInteractionType,
  NoodlePost,
  NoodlePollInput,
  NoodlePostUnlock,
  NoodlerManagedPost,
  NoodleRefreshRun,
} from "@marinara-engine/shared";
import {
  parseRecord,
  emptyNoodleAccountSettings,
  normalizeNoodleAccountSettings,
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
  const settings = normalizeNoodleAccountSettings(row.settings);
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
  settings: NoodleAccountSettings,
  persona: {
    name: string;
    convoDisplayName?: string | null;
    avatarPath?: string | null;
    avatarCrop?: unknown;
    createdAt?: string;
    updatedAt?: string;
  },
): NoodleAccount {
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
): NoodleAccount {
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
    settings: emptyNoodleAccountSettings(),
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
export function snapshotForAccount(account: NoodleAccount): NoodleAuthorSnapshot {
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

export function mapPost(row: PostRow): NoodlePost {
  return {
    id: row.id,
    authorAccountId: row.authorAccountId,
    content: row.content ?? "",
    imageUrl: row.imageUrl ?? null,
    imagePrompt: row.imagePrompt ?? null,
    parentPostId: row.parentPostId ?? null,
    quotePostId: row.quotePostId ?? null,
    source: row.source === "generated" ? "generated" : "manual",
    access: row.access === "public" ? "public" : "locked",
    metadata: parseRecord(row.metadata),
    authorSnapshot: parseAuthorSnapshot(row.authorSnapshot),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapManagedPost(row: PostRow): NoodlerManagedPost {
  return {
    ...mapPost(row),
    title: row.title?.trim() || null,
  };
}

export function updatePollMetadata(
  metadata: Record<string, unknown>,
  pollUpdate: NoodlePollInput | null | undefined,
): Record<string, unknown> {
  if (pollUpdate === undefined) return { ...metadata };
  const currentPoll = readNoodlePollFromMetadata(metadata);
  const generatedPoll = pollUpdate ? createNoodlePoll(pollUpdate) : null;
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

export function mapSubscription(row: SubscriptionRow): NoodleAccountSubscription {
  return {
    id: row.id,
    viewerAccountId: row.viewerAccountId,
    creatorAccountId: row.creatorAccountId,
    createdAt: row.createdAt,
  };
}

export function mapPostUnlock(row: PostUnlockRow): NoodlePostUnlock {
  return { id: row.id, viewerAccountId: row.viewerAccountId, postId: row.postId, createdAt: row.createdAt };
}

export function imageClaimIsAvailable(row: PostRow, at: string) {
  return (
    Boolean(row.imagePrompt) &&
    !row.imageUrl &&
    (!row.imageClaimToken || !row.imageClaimLeaseUntil || row.imageClaimLeaseUntil <= at)
  );
}

export function mapInteraction(row: InteractionRow): NoodleInteraction {
  return {
    id: row.id,
    postId: row.postId,
    parentInteractionId: row.parentInteractionId ?? null,
    actorAccountId: row.actorAccountId,
    type:
      row.type === "repost" || row.type === "reply" || row.type === "like" || row.type === "vote"
        ? (row.type as NoodleInteractionType)
        : "like",
    content: row.content ?? null,
    imageUrl: row.imageUrl ?? null,
    actorSnapshot: parseAuthorSnapshot(row.actorSnapshot),
    createdAt: row.createdAt,
  };
}

export function mapDigest(row: DigestRow): NoodleDigestEntry {
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

export function mapRefreshRun(row: RefreshRunRow): NoodleRefreshRun {
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
