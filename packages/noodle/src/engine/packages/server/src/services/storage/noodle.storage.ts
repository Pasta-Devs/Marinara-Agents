import { and, desc, eq, gt, inArray, isNull, lt } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { isFileUniqueConstraintError } from "../../db/file-schema.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleActivityDigests,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  noodleRefreshRuns,
} from "../../db/schema/noodle.js";
import { newId, now } from "../../utils/id-generator.js";
import {
  clearNoodleRefreshFailure,
  noodleRefreshSchedulerStatus,
  reconcileNoodleRefreshSchedule,
  parsePersistedNoodleRefreshSchedule,
  rescheduleNoodleRefreshTime,
  type PersistedNoodleRefreshSchedule,
} from "../noodle/noodle-refresh-schedule.js";
import { pruneNoodleRefreshRuns } from "./noodle-refresh-run-retention.js";
import { createNoodlePoll, readNoodlePollFromMetadata } from "@marinara-engine/shared";
import {
  applyNoodleCleanupIfStillStale,
  staleNoodleAccountIds,
  type NoodleDataDeletionCounts,
} from "../noodle/noodle-data-cleanup.js";
export type { NoodleDataDeletionCounts } from "../noodle/noodle-data-cleanup.js";

const SETTINGS_ID = "noodle.settings";
const DEFAULT_SETTINGS: Record<string, unknown> = {
  refreshesPerDay: 2,
  participantSelectionMode: "random_range",
  participantMin: 2,
  participantMax: 5,
  maxGeneratedPostsPerRefresh: 8,
  maxRepliesPerRefresh: 12,
  maxRepostsPerRefresh: 4,
  maxLikesPerRefresh: 18,
  maxImagesPerRefresh: 3,
  enableImagePrompts: false,
  enableImageInterpretation: true,
  imageGenerationConnectionId: null,
  imageGenerationPrompt:
    "Create either a social-media-ready character image or an in-character meme for the post. For character images, mention build, clothing, visible appearance, pose, expression, setting, lighting, mood, and composition. For memes, mention meme format, visual gag, composition, and short readable caption/text when relevant.",
  imageGenerationUseAvatarReferences: true,
  imageGenerationIncludeDescriptions: true,
  allowGalleryImageAttachments: false,
  imageCaptioningEnabled: false,
  imageCaptioningConnectionId: null,
  imageCaptioningUseConnectionDefault: true,
  enableLorebookContext: false,
  includeCharacterSchedules: false,
  enableEnhancedTimelineWriting: false,
  allowProfessorMari: true,
  allowRandomUsers: false,
  invitedCharacterGroupIds: [],
  carryoverMode: "off",
  carryoverModes: [],
  carryoverHours: 48,
  carryoverMaxItems: 8,
  theme: "system",
  generationConnectionId: null,
  promptPresets: [],
};
const PUBLIC_SETTING_KEYS = new Set([...Object.keys(DEFAULT_SETTINGS), "refreshSchedule"]);
const DEFAULT_ACCOUNT_SETTINGS = { profile: {}, social: {} };

type Row<T> = T extends { $inferSelect: infer S } ? S : never;
type AccountRow = Row<typeof noodleAccounts>;
type PostRow = Row<typeof noodlePosts>;
type InteractionRow = Row<typeof noodleInteractions>;
type DigestRow = Row<typeof noodleActivityDigests>;
type RefreshRunRow = Row<typeof noodleRefreshRuns>;

function record(value: unknown): Record<string, any> {
  if (typeof value !== "string")
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function strings(value: unknown): string[] {
  const parsed = typeof value === "string" ? recordArray(value) : value;
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function recordArray(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function bool(value: unknown): boolean {
  return value === true || value === "true";
}

function sanitizePromptPresets(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(
      (item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item),
    )
    .map((item) => ({
      name: typeof item.name === "string" ? item.name.trim().slice(0, 60) : "",
      key: item.key === "noodle.timelineBase" ? item.key : "",
      template: typeof item.template === "string" ? item.template.trim().slice(0, 20_000) : "",
    }))
    .filter((item) => {
      const normalized = item.name.toLocaleLowerCase();
      if (!item.name || !item.key || !item.template || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 20);
}
function handle(value: string, fallback: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36) || fallback
  ).slice(0, 36);
}
function nextAvailableHandle(value: string, reserved: Set<string>, fallback: string): string {
  const base = handle(value, fallback);
  let candidate = base;
  let suffix = 2;
  while (reserved.has(candidate)) {
    const suffixText = `_${suffix++}`;
    candidate = `${base.slice(0, Math.max(1, 36 - suffixText.length))}${suffixText}`;
  }
  reserved.add(candidate);
  return candidate;
}
function snapshot(account: any) {
  return {
    id: account.id,
    kind: account.kind,
    entityId: account.entityId,
    handle: account.handle,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl ?? null,
    avatarCrop: account.avatarCrop ?? null,
  };
}
function mapAccount(row: AccountRow): any {
  const persistedSettings = record(row.settings);
  const settings = {
    ...DEFAULT_ACCOUNT_SETTINGS,
    ...persistedSettings,
    profile: { ...DEFAULT_ACCOUNT_SETTINGS.profile, ...record(persistedSettings.profile) },
    social: { ...DEFAULT_ACCOUNT_SETTINGS.social, ...record(persistedSettings.social) },
  };
  return {
    ...row,
    kind: row.kind === "character" || row.kind === "random_user" ? row.kind : "persona",
    bio: row.bio ?? "",
    avatarUrl: row.avatarUrl ?? null,
    avatarCrop: record(settings.profile).avatarCrop ?? null,
    invited: bool(row.invited),
    settings,
    platform: "noodle",
  };
}
function mapPost(row: PostRow): any {
  return {
    ...row,
    content: row.content ?? "",
    imageUrl: row.imageUrl ?? null,
    imagePrompt: row.imagePrompt ?? null,
    parentPostId: row.parentPostId ?? null,
    quotePostId: row.quotePostId ?? null,
    source: row.source === "generated" ? "generated" : "manual",
    access: row.access === "locked" ? "locked" : "public",
    metadata: record(row.metadata),
    authorSnapshot: record(row.authorSnapshot),
  };
}
function mapInteraction(row: InteractionRow): any {
  return {
    ...row,
    parentInteractionId: row.parentInteractionId ?? null,
    content: row.content ?? null,
    imageUrl: row.imageUrl ?? null,
    actorSnapshot: record(row.actorSnapshot),
  };
}
function mapDigest(row: DigestRow): any {
  return {
    ...row,
    accountIds: strings(row.accountIds),
    content: row.content ?? "",
    sourceRunId: row.sourceRunId ?? null,
    sourcePostId: row.sourcePostId ?? null,
    sourceInteractionId: row.sourceInteractionId ?? null,
  };
}
function mapRun(row: RefreshRunRow): any {
  return {
    ...row,
    status: row.status === "completed" || row.status === "failed" ? row.status : "running",
    activeAccountIds: strings(row.activeAccountIds),
    attempts: recordArray(row.attempts),
    result: row.result ?? null,
    error: row.error ?? null,
  };
}
function updatePollMetadata(metadata: Record<string, any>, poll: any): Record<string, any> {
  if (poll === undefined) return { ...metadata };
  const next = { ...metadata };
  if (poll === null) delete next.poll;
  else next.poll = createNoodlePoll(poll);
  return next;
}

export function parseNoodleAvatarCrop(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function createNoodleStorage(db: DB) {
  const publicAccounts = async () =>
    (await db.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "noodle"))).filter(
      (row) => row.id !== SETTINGS_ID,
    );
  const publicIds = async () => (await publicAccounts()).map((row) => row.id);
  const getSettingsRaw = async () => {
    const rows = await db.select().from(noodleAccounts).where(eq(noodleAccounts.id, SETTINGS_ID));
    return rows[0]
      ? Object.fromEntries(Object.entries(record(rows[0].settings)).filter(([key]) => PUBLIC_SETTING_KEYS.has(key)))
      : {};
  };
  const saveSettingsRaw = async (value: Record<string, unknown>) => {
    const timestamp = now();
    const rows = await db.select().from(noodleAccounts).where(eq(noodleAccounts.id, SETTINGS_ID));
    if (rows[0])
      await db
        .update(noodleAccounts)
        .set({ settings: JSON.stringify(value), updatedAt: timestamp })
        .where(eq(noodleAccounts.id, SETTINGS_ID));
    else
      await db.insert(noodleAccounts).values({
        id: SETTINGS_ID,
        kind: "settings",
        entityId: SETTINGS_ID,
        handle: SETTINGS_ID,
        displayName: "Noodle Settings",
        bio: "",
        avatarUrl: null,
        invited: "false",
        settings: JSON.stringify(value),
        platform: "noodle",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
  };
  const accountById = async (id: string) => {
    const rows = await db
      .select()
      .from(noodleAccounts)
      .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "noodle")));
    return rows[0] && rows[0].id !== SETTINGS_ID ? mapAccount(rows[0]) : null;
  };
  const publicPost = async (id: string) => {
    const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, id));
    const row = rows[0];
    return row && (await accountById(row.authorAccountId)) ? mapPost(row) : null;
  };
  const upsertVote = async (postId: string, actor: any, optionId: string, imageUrl: string | null) =>
    db.transaction(async (tx) => {
      const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId));
      const row = rows[0];
      const poll = row ? readNoodlePollFromMetadata(record(row.metadata)) : null;
      if (
        !row ||
        !(await accountById(row.authorAccountId)) ||
        !poll?.options.some((option: any) => option.id === optionId)
      )
        return null;
      const votes = await tx
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.postId, postId),
            eq(noodleInteractions.actorAccountId, actor.id),
            eq(noodleInteractions.type, "vote"),
            isNull(noodleInteractions.parentInteractionId),
          ),
        );
      const voteId = votes[0]?.id ?? newId();
      if (votes.length > 1)
        await tx.delete(noodleInteractions).where(
          inArray(
            noodleInteractions.id,
            votes.slice(1).map((vote) => vote.id),
          ),
        );
      if (votes[0])
        await tx
          .update(noodleInteractions)
          .set({ content: optionId, imageUrl, actorSnapshot: JSON.stringify(snapshot(actor)) })
          .where(eq(noodleInteractions.id, voteId));
      else
        await tx.insert(noodleInteractions).values({
          id: voteId,
          postId,
          parentInteractionId: null,
          actorAccountId: actor.id,
          type: "vote",
          content: optionId,
          imageUrl,
          actorSnapshot: JSON.stringify(snapshot(actor)),
          createdAt: now(),
        });
      const updated = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, voteId));
      return updated[0] ? mapInteraction(updated[0]) : null;
    });
  const pruneRuns = async () =>
    db.transaction(async (tx) =>
      pruneNoodleRefreshRuns({
        list: () => tx.select().from(noodleRefreshRuns),
        replace: async (rows) => {
          await tx.delete(noodleRefreshRuns);
          if (rows.length) await tx.insert(noodleRefreshRuns).values(rows);
        },
        touch: async (row) =>
          tx.update(noodleRefreshRuns).set({ updatedAt: row.updatedAt }).where(eq(noodleRefreshRuns.id, row.id)),
        flush: () => tx._fileStore.flush(),
      }),
    );
  const deleteInteractionTree = async (tx: any, id: string) => {
    const root = (await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, id)))[0];
    if (!root) return [];
    const rows = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.postId, root.postId));
    const ids = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of rows)
        if (!ids.has(row.id) && row.parentInteractionId && ids.has(row.parentInteractionId)) {
          ids.add(row.id);
          changed = true;
        }
    }
    const values = [...ids];
    await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourceInteractionId, values));
    await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, values));
    return rows.filter((row: InteractionRow) => ids.has(row.id));
  };

  return {
    async getSettings() {
      return { ...DEFAULT_SETTINGS, ...(await getSettingsRaw()) };
    },
    async updateSettings(input: Record<string, unknown>) {
      const patch = Object.fromEntries(
        Object.entries(input).filter(([key]) => PUBLIC_SETTING_KEYS.has(key) && key !== "refreshSchedule"),
      );
      if ("promptPresets" in patch) patch.promptPresets = sanitizePromptPresets(patch.promptPresets);
      const next = { ...(await this.getSettings()), ...patch };
      await saveSettingsRaw(next);
      const schedule = await this.getRefreshSchedule();
      if (schedule)
        await this.saveRefreshSchedule(
          clearNoodleRefreshFailure(
            reconcileNoodleRefreshSchedule(schedule, Number(next.refreshesPerDay ?? 0), new Date()),
          ),
        );
      return this.getSettings();
    },
    async getRefreshSchedule(): Promise<PersistedNoodleRefreshSchedule | null> {
      const raw = (await getSettingsRaw()).refreshSchedule;
      return parsePersistedNoodleRefreshSchedule(raw);
    },
    async saveRefreshSchedule(schedule: PersistedNoodleRefreshSchedule) {
      await saveSettingsRaw({ ...(await getSettingsRaw()), refreshSchedule: schedule });
    },
    async rescheduleRefreshSchedule(input: { scheduledTime: string; time: string }, at = new Date()) {
      const schedule = await this.getRefreshSchedule();
      if (!schedule) throw new Error("No automatic refresh schedule is available.");
      const updated = rescheduleNoodleRefreshTime(schedule, input.scheduledTime, input.time, at);
      await this.saveRefreshSchedule(updated);
      return noodleRefreshSchedulerStatus(updated, at);
    },
    async ensureRefreshSchedule(at = new Date(), settingsOverride?: Record<string, unknown>) {
      const schedule = reconcileNoodleRefreshSchedule(
        await this.getRefreshSchedule(),
        Number((settingsOverride ?? (await this.getSettings())).refreshesPerDay ?? 0),
        at,
      );
      const current = await this.getRefreshSchedule();
      if (!current || JSON.stringify(current) !== JSON.stringify(schedule)) await this.saveRefreshSchedule(schedule);
      return schedule;
    },
    async listAccounts() {
      return (await publicAccounts()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(mapAccount);
    },
    async getAccountById(id: string) {
      return accountById(id);
    },
    async getAccountByEntity(kind: string, entityId: string) {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(
          and(
            eq(noodleAccounts.kind, kind),
            eq(noodleAccounts.entityId, entityId),
            eq(noodleAccounts.platform, "noodle"),
          ),
        );
      return rows[0] ? mapAccount(rows[0]) : null;
    },
    async getAccountsByEntities(kind: string, entityIds: string[]) {
      if (!entityIds.length) return [];
      return (
        await db
          .select()
          .from(noodleAccounts)
          .where(
            and(
              eq(noodleAccounts.kind, kind),
              inArray(noodleAccounts.entityId, entityIds),
              eq(noodleAccounts.platform, "noodle"),
            ),
          )
      ).map(mapAccount);
    },
    async upsertAccountFromProfile(input: any) {
      const existing = await this.getAccountByEntity(input.kind, input.entityId);
      const timestamp = now();
      if (existing) {
        // Card data only fills blanks: a manual profile edit must survive every bootstrap sync.
        const manual = existing.settings.profile?.profileManuallyEdited === true;
        const sync = input.syncIdentity === true && !manual;
        const settings = {
          ...existing.settings,
          profile: {
            ...(existing.settings.profile ?? {}),
            ...(input.avatarCrop !== undefined && !manual ? { avatarCrop: input.avatarCrop } : {}),
          },
        };
        await db
          .update(noodleAccounts)
          .set({
            ...((sync || !String(existing.displayName ?? "").trim()) && {
              displayName:
                String(input.displayName ?? "")
                  .trim()
                  .slice(0, 120) || existing.displayName,
            }),
            ...(!manual && !String(existing.bio ?? "").trim() && input.bio && { bio: String(input.bio).slice(0, 500) }),
            ...(input.avatarUrl !== undefined && (sync || !existing.avatarUrl) && { avatarUrl: input.avatarUrl }),
            ...(input.invited !== undefined && { invited: String(input.invited) }),
            settings: JSON.stringify(settings),
            updatedAt: timestamp,
          })
          .where(eq(noodleAccounts.id, existing.id));
        return this.getAccountById(existing.id);
      }
      const reserved = new Set((await publicAccounts()).map((row) => row.handle));
      let next = handle(input.handle ?? input.displayName, input.entityId);
      let suffix = 2;
      while (reserved.has(next))
        next = `${handle(input.handle ?? input.displayName, input.entityId).slice(0, 36 - String(suffix).length - 1)}_${suffix++}`;
      const row = {
        id: newId(),
        kind: input.kind,
        entityId: input.entityId,
        handle: next,
        displayName: input.displayName?.trim() || "User",
        bio: input.bio?.trim() ?? "",
        avatarUrl: input.avatarUrl ?? null,
        invited: String(input.invited ?? input.kind === "persona"),
        settings: JSON.stringify({
          profile: input.avatarCrop !== undefined ? { avatarCrop: input.avatarCrop } : {},
          social: {},
        }),
        platform: "noodle",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.insert(noodleAccounts).values(row);
      return mapAccount(row);
    },
    async updateAccountProfile(id: string, input: any) {
      const existing = await accountById(id);
      if (!existing) return null;
      const settings = {
        ...existing.settings,
        profile: { ...(existing.settings.profile ?? {}), ...(input.profile ?? {}) },
      };
      const reserved = new Set((await publicAccounts()).filter((row) => row.id !== id).map((row) => row.handle));
      const nextHandle =
        input.handle === undefined
          ? existing.handle
          : nextAvailableHandle(String(input.handle), reserved, existing.entityId);
      await db
        .update(noodleAccounts)
        .set({
          ...(input.handle !== undefined && { handle: nextHandle }),
          ...(input.displayName !== undefined && { displayName: String(input.displayName).trim().slice(0, 120) }),
          ...(input.bio !== undefined && { bio: String(input.bio).slice(0, 500) }),
          ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl ? String(input.avatarUrl) : null }),
          ...(input.invited !== undefined && { invited: String(Boolean(input.invited)) }),
          settings: JSON.stringify(settings),
          updatedAt: now(),
        })
        .where(eq(noodleAccounts.id, id));
      return accountById(id);
    },
    async patchAccountSettings(id: string, input: any) {
      const existing = await accountById(id);
      if (!existing) return null;
      const next = input.subtree
        ? {
            ...existing.settings,
            [input.subtree]: { ...(existing.settings[input.subtree] ?? {}), ...(input.patch ?? {}) },
          }
        : { ...existing.settings, ...input };
      await db
        .update(noodleAccounts)
        .set({ settings: JSON.stringify(next), updatedAt: now() })
        .where(eq(noodleAccounts.id, id));
      return accountById(id);
    },
    async deleteAccountByEntity(kind: string, entityId: string) {
      const existing = await this.getAccountByEntity(kind, entityId);
      if (!existing) return null;
      const posts = await db.select().from(noodlePosts).where(eq(noodlePosts.authorAccountId, existing.id));
      const postIds = posts.map((row) => row.id);
      await db.transaction(async (tx) => {
        if (postIds.length) {
          await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, postIds));
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.postId, postIds));
          await tx.delete(noodlePosts).where(inArray(noodlePosts.id, postIds));
        }
        await tx.delete(noodleAccounts).where(eq(noodleAccounts.id, existing.id));
      });
      return existing;
    },
    async updateAccountFollow(id: string, targetAccountId: string, input: any, followedAt = now()) {
      const viewer = await accountById(id);
      const target = await accountById(targetAccountId);
      if (!viewer || !target) return null;
      const following = typeof input === "boolean" ? input : Boolean(input?.followed ?? input?.following);
      const social = { ...(viewer.settings.social ?? {}) };
      const ids = new Set(strings(social.followingAccountIds));
      const wasFollowing = ids.has(targetAccountId);
      const timestamps = { ...(social.followingAccountTimestamps ?? {}) };
      if (following) {
        ids.add(targetAccountId);
        timestamps[targetAccountId] ??= followedAt;
      } else {
        ids.delete(targetAccountId);
        delete timestamps[targetAccountId];
      }
      if (wasFollowing === following && (!following || timestamps[targetAccountId]))
        return { account: viewer, changed: false };
      social.followingAccountIds = [...ids];
      social.followingAccountTimestamps = timestamps;
      await db
        .update(noodleAccounts)
        .set({ settings: JSON.stringify({ ...viewer.settings, social }), updatedAt: now() })
        .where(eq(noodleAccounts.id, id));
      return { account: (await accountById(id))!, changed: true };
    },
    async setCharacterInvited(characterId: string, invited: boolean) {
      const account = await this.getAccountByEntity("character", characterId);
      return account ? this.updateAccountProfile(account.id, { invited }) : null;
    },
    async clearCharacterInvites() {
      await db
        .update(noodleAccounts)
        .set({ invited: "false", updatedAt: now() })
        .where(
          and(
            eq(noodleAccounts.kind, "character"),
            eq(noodleAccounts.invited, "true"),
            eq(noodleAccounts.platform, "noodle"),
          ),
        );
    },
    async listPosts(options: any = {}) {
      const ids = await publicIds();
      if (!ids.length) return [];
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(
          options.since
            ? and(inArray(noodlePosts.authorAccountId, ids), gt(noodlePosts.createdAt, options.since))
            : inArray(noodlePosts.authorAccountId, ids),
        )
        .orderBy(desc(noodlePosts.createdAt))
        .limit(Math.max(1, Math.min(300, Math.floor(options.limit ?? 120))));
      return rows.map(mapPost);
    },
    async listPostsBefore(before: string) {
      const ids = await publicIds();
      if (!ids.length) return [];
      return (
        await db
          .select()
          .from(noodlePosts)
          .where(and(inArray(noodlePosts.authorAccountId, ids), lt(noodlePosts.createdAt, before)))
          .orderBy(desc(noodlePosts.createdAt))
      ).map(mapPost);
    },
    async getPostById(id: string) {
      return publicPost(id);
    },
    async createPost(input: any) {
      const account = await accountById(input.authorAccountId);
      if (!account) return null;
      const timestamp = now();
      const id = newId();
      await db.insert(noodlePosts).values({
        id,
        authorAccountId: account.id,
        title: null,
        content: String(input.content ?? ""),
        imageUrl: input.imageUrl ?? null,
        imagePrompt: input.imagePrompt ?? null,
        imageClaimToken: null,
        imageClaimLeaseUntil: null,
        parentPostId: input.parentPostId ?? null,
        quotePostId: input.quotePostId ?? null,
        source: input.source ?? "manual",
        access: "public",
        metadata: JSON.stringify(input.metadata ?? {}),
        authorSnapshot: JSON.stringify(snapshot(account)),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return publicPost(id);
    },
    async updatePostMedia(id: string, input: any) {
      const existing = await publicPost(id);
      if (!existing) return null;
      await db
        .update(noodlePosts)
        .set({
          ...(input.imageUrl !== undefined && {
            imageUrl: input.imageUrl,
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
          }),
          ...(input.imagePrompt !== undefined && {
            imagePrompt: input.imagePrompt,
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
          }),
          ...(input.metadata !== undefined && {
            metadata: JSON.stringify({ ...existing.metadata, ...input.metadata }),
          }),
          updatedAt: now(),
        })
        .where(eq(noodlePosts.id, id));
      return publicPost(id);
    },
    async updatePost(id: string, input: any) {
      const existing = await publicPost(id);
      if (!existing) return null;
      const metadata = updatePollMetadata(existing.metadata, input.poll);
      if (input.imageCrop === null) delete metadata.imageCrop;
      else if (input.imageCrop !== undefined) metadata.imageCrop = input.imageCrop;
      await db
        .update(noodlePosts)
        .set({
          ...(input.content !== undefined && { content: String(input.content).trim().slice(0, 4000) }),
          ...(input.imageUrl !== undefined && {
            imageUrl: input.imageUrl,
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
          }),
          ...(input.imagePrompt !== undefined && {
            imagePrompt: input.imagePrompt,
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
          }),
          ...((input.poll !== undefined || input.imageCrop !== undefined) && { metadata: JSON.stringify(metadata) }),
          updatedAt: now(),
        })
        .where(eq(noodlePosts.id, id));
      return publicPost(id);
    },
    async deletePost(id: string) {
      const existing = await publicPost(id);
      if (!existing) return null;
      const interactions = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, id));
      const ids = new Set(await publicIds());
      if (interactions.some((row) => !ids.has(row.actorAccountId))) return null;
      const digests = await db.select().from(noodleActivityDigests);
      const interactionIds = interactions.map((row) => row.id);
      if (
        digests
          .filter(
            (row) =>
              row.sourcePostId === id || (row.sourceInteractionId && interactionIds.includes(row.sourceInteractionId)),
          )
          .some((row) => !strings(row.accountIds).every((accountId) => ids.has(accountId)))
      )
        return null;
      await db.transaction(async (tx) => {
        await tx.delete(noodlePostUnlocks).where(eq(noodlePostUnlocks.postId, id));
        await tx.delete(noodleInteractions).where(eq(noodleInteractions.postId, id));
        await tx.delete(noodleActivityDigests).where(eq(noodleActivityDigests.sourcePostId, id));
        await tx.delete(noodlePosts).where(eq(noodlePosts.id, id));
      });
      return existing;
    },
    async claimPostImage(id: string, token: string, leaseUntil: string, at = now()) {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        const row = rows[0];
        if (
          !row ||
          !row.imagePrompt ||
          row.imageUrl ||
          (row.imageClaimToken && row.imageClaimLeaseUntil && row.imageClaimLeaseUntil > at)
        )
          return null;
        await tx
          .update(noodlePosts)
          .set({ imageClaimToken: token, imageClaimLeaseUntil: leaseUntil })
          .where(eq(noodlePosts.id, id));
        return mapPost(row);
      });
    },
    async renewPostImageClaim(id: string, token: string, leaseUntil: string, at = now()) {
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, id));
      const row = rows[0];
      if (
        !row ||
        row.imageClaimToken !== token ||
        !row.imageClaimLeaseUntil ||
        row.imageClaimLeaseUntil <= at ||
        !row.imagePrompt ||
        row.imageUrl
      )
        return false;
      await db
        .update(noodlePosts)
        .set({ imageClaimLeaseUntil: leaseUntil })
        .where(and(eq(noodlePosts.id, id), eq(noodlePosts.imageClaimToken, token)));
      return true;
    },
    async releasePostImageClaim(id: string, token: string) {
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, id));
      if (rows[0]?.imageClaimToken !== token) return false;
      await db
        .update(noodlePosts)
        .set({ imageClaimToken: null, imageClaimLeaseUntil: null })
        .where(and(eq(noodlePosts.id, id), eq(noodlePosts.imageClaimToken, token)));
      return true;
    },
    async finalizePostImageClaim(id: string, token: string, input: any, at = now()) {
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, id));
      const row = rows[0];
      if (
        !row ||
        row.imageClaimToken !== token ||
        !row.imageClaimLeaseUntil ||
        row.imageClaimLeaseUntil <= at ||
        !row.imagePrompt ||
        row.imageUrl
      )
        return false;
      const metadata = { ...record(row.metadata), ...(input.metadata ?? {}) };
      delete metadata.imagePendingReview;
      await db
        .update(noodlePosts)
        .set({
          imageUrl: input.imageUrl ?? null,
          ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
          metadata: JSON.stringify(metadata),
          imageClaimToken: null,
          imageClaimLeaseUntil: null,
          updatedAt: now(),
        })
        .where(and(eq(noodlePosts.id, id), eq(noodlePosts.imageClaimToken, token)));
      return true;
    },
    async listInteractions(postIds: string[] = []) {
      if (!postIds.length) return [];
      const publicPostIds = new Set(
        (await Promise.all(postIds.map((id) => publicPost(id)))).filter(Boolean).map((post: any) => post.id),
      );
      if (!publicPostIds.size) return [];
      const ids = new Set(await publicIds());
      return (
        await db
          .select()
          .from(noodleInteractions)
          .where(inArray(noodleInteractions.postId, [...publicPostIds]))
          .orderBy(noodleInteractions.createdAt)
      )
        .filter((row) => ids.has(row.actorAccountId))
        .map(mapInteraction);
    },
    async listRepliesByActorSince(actorAccountId: string, since: string, limit = 100) {
      if (!(await accountById(actorAccountId))) return [];
      const posts = new Set((await this.listPosts()).map((post: any) => post.id));
      return (
        await db
          .select()
          .from(noodleInteractions)
          .where(
            and(
              eq(noodleInteractions.actorAccountId, actorAccountId),
              eq(noodleInteractions.type, "reply"),
              gt(noodleInteractions.createdAt, since),
            ),
          )
          .orderBy(desc(noodleInteractions.createdAt))
          .limit(Math.max(1, Math.min(200, Math.floor(limit))))
      )
        .filter((row) => posts.has(row.postId))
        .map(mapInteraction);
    },
    async getInteractionById(id: string) {
      const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.id, id));
      const row = rows[0];
      return row && (await publicPost(row.postId)) && (await accountById(row.actorAccountId))
        ? mapInteraction(row)
        : null;
    },
    async createInteraction(postId: string, input: any) {
      const post = await publicPost(postId);
      const actor = await accountById(String(input.actorAccountId));
      if (!post || !actor) return null;
      const parentId = input.parentInteractionId ?? null;
      if (input.type === "vote")
        return parentId
          ? null
          : upsertVote(postId, actor, String(input.content ?? "").trim(), input.imageUrl?.trim() || null);
      if (parentId) {
        const parent = await this.getInteractionById(parentId);
        if (!parent || parent.postId !== postId || parent.type !== "reply") return null;
      }
      const toggle = input.type === "like" || input.type === "repost";
      const findExisting = () =>
        toggle
          ? db
              .select()
              .from(noodleInteractions)
              .where(
                and(
                  eq(noodleInteractions.postId, postId),
                  eq(noodleInteractions.actorAccountId, actor.id),
                  eq(noodleInteractions.type, input.type),
                  parentId
                    ? eq(noodleInteractions.parentInteractionId, parentId)
                    : isNull(noodleInteractions.parentInteractionId),
                ),
              )
          : Promise.resolve([] as InteractionRow[]);
      const existing = (await findExisting())[0];
      if (existing) return mapInteraction(existing);
      const row = {
        id: newId(),
        postId,
        parentInteractionId: parentId,
        actorAccountId: actor.id,
        type: input.type,
        content: input.content?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        actorSnapshot: JSON.stringify(snapshot(actor)),
        createdAt: now(),
      };
      try {
        await db.insert(noodleInteractions).values(row);
      } catch (error) {
        if (
          !toggle ||
          !isFileUniqueConstraintError(error, "noodle_interactions", [
            "postId",
            "actorAccountId",
            "type",
            "parentInteractionId",
          ])
        )
          throw error;
      }
      return mapInteraction(
        ((await db.select().from(noodleInteractions).where(eq(noodleInteractions.id, row.id)))[0] ??
          (await findExisting())[0]) as InteractionRow,
      );
    },
    async updateInteraction(id: string, input: any) {
      if (!(await this.getInteractionById(id))) return null;
      await db
        .update(noodleInteractions)
        .set({
          ...(input.content !== undefined && { content: input.content?.trim() || null }),
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl?.trim() || null }),
        })
        .where(eq(noodleInteractions.id, id));
      return this.getInteractionById(id);
    },
    async deleteInteraction(postId: string, input: any) {
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.postId, postId),
            eq(noodleInteractions.actorAccountId, String(input.actorAccountId)),
            eq(noodleInteractions.type, String(input.type)),
            input.parentInteractionId
              ? eq(noodleInteractions.parentInteractionId, input.parentInteractionId)
              : isNull(noodleInteractions.parentInteractionId),
          ),
        );
      const row = rows[0];
      if (!row) return null;
      const ids = new Set(await publicIds());
      const digests = await db
        .select()
        .from(noodleActivityDigests)
        .where(eq(noodleActivityDigests.sourceInteractionId, row.id));
      if (digests.some((digest) => !strings(digest.accountIds).every((id) => ids.has(id)))) return null;
      await db.transaction((tx) => deleteInteractionTree(tx, row.id));
      return mapInteraction(row);
    },
    async deleteInteractionById(id: string) {
      const existing = await this.getInteractionById(id);
      if (!existing) return [];
      const ids = new Set(await publicIds());
      const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, existing.postId));
      const subtree = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of rows)
          if (!subtree.has(row.id) && row.parentInteractionId && subtree.has(row.parentInteractionId)) {
            subtree.add(row.id);
            changed = true;
          }
      }
      if (rows.some((row) => subtree.has(row.id) && !ids.has(row.actorAccountId))) return [];
      const digests = await db
        .select()
        .from(noodleActivityDigests)
        .where(inArray(noodleActivityDigests.sourceInteractionId, [...subtree]));
      if (digests.some((digest) => !strings(digest.accountIds).every((accountId) => ids.has(accountId)))) return [];
      const deleted = rows.filter((row) => subtree.has(row.id));
      await db.transaction(async (tx) => {
        await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourceInteractionId, [...subtree]));
        await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, [...subtree]));
      });
      return deleted.map(mapInteraction);
    },
    async createDigest(input: any) {
      const ids = [...new Set(strings(input.accountIds))];
      const allowed = new Set(await publicIds());
      if (!ids.every((id) => allowed.has(id)))
        throw new Error("Public Noodle digests cannot reference non-public accounts.");
      const row = {
        id: newId(),
        accountIds: JSON.stringify(ids),
        content: String(input.content ?? "")
          .trim()
          .slice(0, 1200),
        sourceRunId: input.sourceRunId ?? null,
        sourcePostId: input.sourcePostId ?? null,
        sourceInteractionId: input.sourceInteractionId ?? null,
        createdAt: now(),
      };
      await db.insert(noodleActivityDigests).values(row);
      return mapDigest(row);
    },
    async updateDigest(id: string, input: any) {
      const rows = await db.select().from(noodleActivityDigests).where(eq(noodleActivityDigests.id, id));
      if (!rows[0]) return null;
      const ids = [...new Set(strings(input.accountIds))];
      const allowed = new Set(await publicIds());
      if (!strings(rows[0].accountIds).every((item) => allowed.has(item)) || !ids.every((item) => allowed.has(item)))
        return null;
      await db
        .update(noodleActivityDigests)
        .set({
          accountIds: JSON.stringify(ids),
          content: String(input.content ?? "")
            .trim()
            .slice(0, 1200),
        })
        .where(eq(noodleActivityDigests.id, id));
      return mapDigest((await db.select().from(noodleActivityDigests).where(eq(noodleActivityDigests.id, id)))[0]);
    },
    async listDigests(options: any = {}) {
      const ids = new Set(await publicIds());
      const rows = await db
        .select()
        .from(noodleActivityDigests)
        .where(options.since ? gt(noodleActivityDigests.createdAt, options.since) : undefined)
        .orderBy(desc(noodleActivityDigests.createdAt))
        .limit(200);
      const posts = new Map((await db.select().from(noodlePosts)).map((row) => [row.id, row]));
      const interactions = new Map((await db.select().from(noodleInteractions)).map((row) => [row.id, row]));
      return rows
        .filter((row) => strings(row.accountIds).every((id) => ids.has(id)))
        .filter(
          (row) =>
            !row.sourcePostId || (posts.get(row.sourcePostId) && ids.has(posts.get(row.sourcePostId)!.authorAccountId)),
        )
        .filter(
          (row) =>
            !row.sourceInteractionId ||
            (interactions.get(row.sourceInteractionId) &&
              ids.has(interactions.get(row.sourceInteractionId)!.actorAccountId)),
        )
        .slice(0, Math.max(1, Math.min(200, Math.floor(options.limit ?? 80))))
        .map(mapDigest);
    },
    async createRefreshRun(input: any) {
      const timestamp = now();
      const row = {
        id: newId(),
        status: "running",
        activeAccountIds: JSON.stringify(input.activeAccountIds),
        prompt: input.prompt,
        result: null,
        error: null,
        attempts: "[]",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.insert(noodleRefreshRuns).values(row);
      return mapRun(row);
    },
    async listRefreshRuns(options: any = {}) {
      const rows = await db
        .select()
        .from(noodleRefreshRuns)
        .where(options.status ? eq(noodleRefreshRuns.status, options.status) : undefined)
        .orderBy(desc(noodleRefreshRuns.createdAt))
        .limit(Math.max(1, Math.min(100, Math.floor(options.limit ?? 5))));
      return rows.map(mapRun);
    },
    async listCompletedRefreshRunAccountIds(limit = 5) {
      const rows = await db
        .select({ activeAccountIds: noodleRefreshRuns.activeAccountIds })
        .from(noodleRefreshRuns)
        .where(eq(noodleRefreshRuns.status, "completed"))
        .orderBy(desc(noodleRefreshRuns.createdAt))
        .limit(Math.max(1, Math.min(100, Math.floor(limit))));
      return rows.map((row) => strings(row.activeAccountIds));
    },
    async recordRefreshAttempt(id: string, attempt: any) {
      const rows = await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id));
      if (!rows[0]) return null;
      await db
        .update(noodleRefreshRuns)
        .set({ attempts: JSON.stringify([...(recordArray(rows[0].attempts) as any[]), attempt]), updatedAt: now() })
        .where(eq(noodleRefreshRuns.id, id));
      return mapRun((await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id)))[0]);
    },
    async finishRefreshRun(id: string, patch: any) {
      await db
        .update(noodleRefreshRuns)
        .set({ status: patch.status, result: patch.result ?? null, error: patch.error ?? null, updatedAt: now() })
        .where(eq(noodleRefreshRuns.id, id));
      const rows = await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id));
      try {
        await pruneRuns();
      } catch (error) {
        console.error("Noodle refresh-run retention cleanup failed", error);
      }
      return rows[0] ? mapRun(rows[0]) : null;
    },
    async subscribe(viewerAccountId: string, creatorAccountId: string) {
      if (
        viewerAccountId === creatorAccountId ||
        !(await accountById(viewerAccountId)) ||
        !(await accountById(creatorAccountId))
      )
        return null;
      const existing = await db
        .select()
        .from(noodleAccountSubscriptions)
        .where(
          and(
            eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
            eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
          ),
        );
      if (existing[0]) return existing[0];
      const row = { id: newId(), viewerAccountId, creatorAccountId, createdAt: now() };
      try {
        await db.insert(noodleAccountSubscriptions).values(row);
      } catch (error) {
        if (
          !isFileUniqueConstraintError(error, "noodle_account_subscriptions", ["viewerAccountId", "creatorAccountId"])
        )
          throw error;
      }
      return (
        (
          await db
            .select()
            .from(noodleAccountSubscriptions)
            .where(
              and(
                eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
                eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
              ),
            )
        )[0] ?? null
      );
    },
    async unsubscribe(viewerAccountId: string, creatorAccountId: string) {
      await db
        .delete(noodleAccountSubscriptions)
        .where(
          and(
            eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
            eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
          ),
        );
    },
    async listSubscriptionsForViewer(viewerAccountId: string) {
      return db
        .select()
        .from(noodleAccountSubscriptions)
        .where(eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId));
    },
    async listSubscriptionsForCreator(creatorAccountId: string) {
      return db
        .select()
        .from(noodleAccountSubscriptions)
        .where(eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId))
        .orderBy(desc(noodleAccountSubscriptions.createdAt));
    },
    async listSubscriptionsForCreatorPage(
      creatorAccountId: string,
      cursor: { createdAt: string; id: string } | null,
      limit: number,
    ) {
      const boundedLimit = Math.max(1, Math.min(20, Math.floor(limit)));
      const rows = await db
        .select()
        .from(noodleAccountSubscriptions)
        .where(
          and(
            eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
            cursor ? (lt(noodleAccountSubscriptions.createdAt, cursor.createdAt) as any) : undefined,
          ),
        )
        .orderBy(desc(noodleAccountSubscriptions.createdAt), desc(noodleAccountSubscriptions.id))
        .limit(boundedLimit + 1);
      const items = rows.slice(0, boundedLimit);
      const last = items.at(-1);
      return {
        items,
        total: db.count(noodleAccountSubscriptions, eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId)),
        nextCursor: rows.length > boundedLimit && last ? { createdAt: last.createdAt, id: last.id } : null,
      };
    },
    async unlockPost(viewerAccountId: string, postId: string) {
      const viewer = await accountById(viewerAccountId);
      const post = await publicPost(postId);
      if (!viewer || viewer.kind !== "persona" || !post || post.access !== "locked") return null;
      const existing = await db
        .select()
        .from(noodlePostUnlocks)
        .where(and(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId), eq(noodlePostUnlocks.postId, postId)));
      if (existing[0]) return existing[0];
      const row = { id: newId(), viewerAccountId, postId, createdAt: now() };
      try {
        await db.insert(noodlePostUnlocks).values(row);
      } catch (error) {
        if (!isFileUniqueConstraintError(error, "noodle_post_unlocks", ["viewerAccountId", "postId"])) throw error;
      }
      return (
        (
          await db
            .select()
            .from(noodlePostUnlocks)
            .where(and(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId), eq(noodlePostUnlocks.postId, postId)))
        )[0] ?? null
      );
    },
    async listPostUnlocksForViewer(viewerAccountId: string) {
      return db.select().from(noodlePostUnlocks).where(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId));
    },
    async resetTimeline() {
      const ids = await publicIds();
      const posts = ids.length
        ? await db.select().from(noodlePosts).where(inArray(noodlePosts.authorAccountId, ids))
        : [];
      const postIds = posts.map((row) => row.id);
      await db.transaction(async (tx) => {
        if (postIds.length) {
          await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, postIds));
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.postId, postIds));
          await tx.delete(noodlePosts).where(inArray(noodlePosts.id, postIds));
        }
        await tx.delete(noodleRefreshRuns);
      });
    },
    async cleanupUnusedData(input: { characterIds: ReadonlySet<string>; personaIds: ReadonlySet<string> }) {
      const accounts = await publicAccounts();
      const staleAccountIds = [...staleNoodleAccountIds(accounts, input.characterIds, input.personaIds)];
      const staleAccountIdSet = new Set(staleAccountIds);
      const liveAccountIdSet = new Set(
        accounts.filter((account) => !staleAccountIdSet.has(account.id)).map((account) => account.id),
      );
      const posts = await db.select().from(noodlePosts);
      const stalePostIds = posts.filter((post) => !liveAccountIdSet.has(post.authorAccountId)).map((post) => post.id);
      const stalePostIdSet = new Set(stalePostIds);
      const interactions = await db.select().from(noodleInteractions);
      const interactionIdSet = new Set(interactions.map((interaction) => interaction.id));
      const staleInteractionIdSet = new Set(
        interactions
          .filter(
            (interaction) =>
              stalePostIdSet.has(interaction.postId) ||
              !posts.some((post) => post.id === interaction.postId) ||
              !liveAccountIdSet.has(interaction.actorAccountId) ||
              (interaction.parentInteractionId && !interactionIdSet.has(interaction.parentInteractionId)),
          )
          .map((interaction) => interaction.id),
      );
      let staleInteractionCount = -1;
      while (staleInteractionIdSet.size !== staleInteractionCount) {
        staleInteractionCount = staleInteractionIdSet.size;
        for (const interaction of interactions) {
          if (interaction.parentInteractionId && staleInteractionIdSet.has(interaction.parentInteractionId)) {
            staleInteractionIdSet.add(interaction.id);
          }
        }
      }
      const staleInteractionIds = [...staleInteractionIdSet];
      const runs = await db.select().from(noodleRefreshRuns);
      const staleRunIds = runs
        .filter((run) => strings(run.activeAccountIds).some((accountId) => !liveAccountIdSet.has(accountId)))
        .map((run) => run.id);
      const runIdSet = new Set(runs.map((run) => run.id));
      const staleRunIdSet = new Set(staleRunIds);
      const digests = await db.select().from(noodleActivityDigests);
      const staleDigestIds = digests
        .filter(
          (digest) =>
            (digest.sourcePostId &&
              (!posts.some((post) => post.id === digest.sourcePostId) || stalePostIdSet.has(digest.sourcePostId))) ||
            (digest.sourceInteractionId &&
              (!interactions.some((interaction) => interaction.id === digest.sourceInteractionId) ||
                staleInteractionIdSet.has(digest.sourceInteractionId))) ||
            (digest.sourceRunId && (!runIdSet.has(digest.sourceRunId) || staleRunIdSet.has(digest.sourceRunId))) ||
            strings(digest.accountIds).some((accountId) => !liveAccountIdSet.has(accountId)),
        )
        .map((digest) => digest.id);
      const subscriptions = await db.select().from(noodleAccountSubscriptions);
      const staleSubscriptionIds = subscriptions
        .filter(
          (subscription) =>
            !liveAccountIdSet.has(subscription.viewerAccountId) || !liveAccountIdSet.has(subscription.creatorAccountId),
        )
        .map((subscription) => subscription.id);
      const unlocks = await db.select().from(noodlePostUnlocks);
      const staleUnlockIds = unlocks
        .filter(
          (unlock) =>
            !liveAccountIdSet.has(unlock.viewerAccountId) ||
            !posts.some((post) => post.id === unlock.postId) ||
            stalePostIdSet.has(unlock.postId),
        )
        .map((unlock) => unlock.id);
      return db.transaction(async (tx) => {
        const currentAccounts = (
          await tx.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "noodle"))
        ).filter((account) => account.id !== SETTINGS_ID);
        return applyNoodleCleanupIfStillStale({
          plannedAccountIds: staleAccountIds,
          currentAccounts,
          characterIds: input.characterIds,
          personaIds: input.personaIds,
          counts: {
            accounts: staleAccountIds.length,
            posts: stalePostIds.length,
            interactions: staleInteractionIds.length,
            digests: staleDigestIds.length,
            refreshRuns: staleRunIds.length,
            subscriptions: staleSubscriptionIds.length,
            unlocks: staleUnlockIds.length,
          },
          apply: async () => {
            if (staleDigestIds.length)
              await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.id, staleDigestIds));
            if (staleInteractionIds.length)
              await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, staleInteractionIds));
            if (staleSubscriptionIds.length)
              await tx
                .delete(noodleAccountSubscriptions)
                .where(inArray(noodleAccountSubscriptions.id, staleSubscriptionIds));
            if (staleUnlockIds.length)
              await tx.delete(noodlePostUnlocks).where(inArray(noodlePostUnlocks.id, staleUnlockIds));
            if (stalePostIds.length) await tx.delete(noodlePosts).where(inArray(noodlePosts.id, stalePostIds));
            if (staleRunIds.length)
              await tx.delete(noodleRefreshRuns).where(inArray(noodleRefreshRuns.id, staleRunIds));
            if (staleAccountIds.length)
              await tx.delete(noodleAccounts).where(inArray(noodleAccounts.id, staleAccountIds));
          },
        });
      });
    },
    async deleteAllData() {
      const counts = {
        accounts: (await publicAccounts()).length,
        posts: (await db.select().from(noodlePosts)).length,
        interactions: (await db.select().from(noodleInteractions)).length,
        digests: (await db.select().from(noodleActivityDigests)).length,
        refreshRuns: (await db.select().from(noodleRefreshRuns)).length,
        subscriptions: (await db.select().from(noodleAccountSubscriptions)).length,
        unlocks: (await db.select().from(noodlePostUnlocks)).length,
      } satisfies NoodleDataDeletionCounts;
      await db.transaction(async (tx) => {
        await tx.delete(noodleActivityDigests);
        await tx.delete(noodleInteractions);
        await tx.delete(noodleAccountSubscriptions);
        await tx.delete(noodlePostUnlocks);
        await tx.delete(noodlePosts);
        await tx.delete(noodleRefreshRuns);
        await tx.delete(noodleAccounts);
      });
      return counts;
    },
    async bootstrap() {
      const settings = await this.getSettings();
      const schedule = await this.ensureRefreshSchedule(new Date(), settings);
      const posts = await this.listPosts({ limit: 160 });
      return {
        settings,
        scheduler: noodleRefreshSchedulerStatus(schedule, new Date()),
        accounts: await this.listAccounts(),
        posts,
        interactions: await this.listInteractions(posts.map((post: any) => post.id)),
        digests: await this.listDigests({ limit: 80 }),
      };
    },
  };
}
