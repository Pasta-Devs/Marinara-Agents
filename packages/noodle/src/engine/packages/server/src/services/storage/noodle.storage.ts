import { and, desc, eq, gt, inArray } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { noodleAccounts, noodleActivityDigests, noodleInteractions, noodlePosts, noodleRefreshRuns } from "../../db/schema/noodle.js";
import { newId, now } from "../../utils/id-generator.js";

export function parseNoodleAvatarCrop(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function record(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function createNoodleStorage(db: DB) {
  const account = (row: typeof noodleAccounts.$inferSelect) => ({ ...row, settings: record(row.settings) });
  const post = (row: typeof noodlePosts.$inferSelect) => ({
    ...row,
    metadata: record(row.metadata),
    authorSnapshot: record(row.authorSnapshot),
  });
  const interaction = (row: typeof noodleInteractions.$inferSelect) => ({
    ...row,
    actorSnapshot: record(row.actorSnapshot),
  });
  const digest = (row: typeof noodleActivityDigests.$inferSelect) => ({
    ...row,
    accountIds: JSON.parse(row.accountIds || "[]"),
  });
  const settingsKey = "noodle.settings";

  return {
    async getSettings() {
      const rows = await db.select().from(noodleAccounts).where(eq(noodleAccounts.id, settingsKey));
      return rows[0] ? record(rows[0].settings) : {};
    },
    async updateSettings(input: Record<string, unknown>) {
      return input;
    },
    async listAccounts() {
      return (await db.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "noodle"))).map(account);
    },
    async getAccountById(id: string) {
      const rows = await db.select().from(noodleAccounts).where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "noodle")));
      return rows[0] ? account(rows[0]) : null;
    },
    async getAccountByEntity(kind: string, entityId: string) {
      const rows = await db.select().from(noodleAccounts).where(and(eq(noodleAccounts.kind, kind), eq(noodleAccounts.entityId, entityId), eq(noodleAccounts.platform, "noodle")));
      return rows[0] ? account(rows[0]) : null;
    },
    async getAccountsByEntities(kind: string, entityIds: string[]) {
      if (!entityIds.length) return [];
      return (await db.select().from(noodleAccounts).where(and(eq(noodleAccounts.kind, kind), inArray(noodleAccounts.entityId, entityIds), eq(noodleAccounts.platform, "noodle")))).map(account);
    },
    async updateAccountFollow(id: string, targetAccountId: string, input: { following?: boolean }) {
      const viewer = await this.getAccountById(id);
      const target = await this.getAccountById(targetAccountId);
      if (!viewer || !target) return null;
      const settings = { ...viewer.settings, social: { ...(viewer.settings.social || {}) } };
      const following = new Set(settings.social.followingAccountIds || []);
      if (input.following) following.add(targetAccountId); else following.delete(targetAccountId);
      settings.social.followingAccountIds = [...following];
      await db.update(noodleAccounts).set({ settings: JSON.stringify(settings), updatedAt: now() }).where(eq(noodleAccounts.id, id));
      return this.getAccountById(id);
    },
    async listPosts(options: { limit?: number; since?: string } = {}) {
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.access, "public")).orderBy(desc(noodlePosts.createdAt));
      return rows.filter((row) => !options.since || row.createdAt > options.since).slice(0, Math.max(1, Math.min(200, options.limit ?? 50))).map(post);
    },
    async getPostById(id: string) {
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, id));
      return rows[0] && rows[0].access === "public" ? post(rows[0]) : null;
    },
    async createPost(input: Record<string, unknown>) {
      const timestamp = now();
      const row = {
        id: newId(), authorAccountId: String(input.authorAccountId), title: null,
        content: String(input.content ?? ""), imageUrl: input.imageUrl ? String(input.imageUrl) : null,
        imagePrompt: input.imagePrompt ? String(input.imagePrompt) : null,
        imageClaimToken: null, imageClaimLeaseUntil: null, parentPostId: input.parentPostId ? String(input.parentPostId) : null,
        quotePostId: input.quotePostId ? String(input.quotePostId) : null, source: "manual", access: "public",
        metadata: JSON.stringify(input.metadata ?? {}), authorSnapshot: "{}", createdAt: timestamp, updatedAt: timestamp,
      };
      if (!(await this.getAccountById(row.authorAccountId))) return null;
      await db.insert(noodlePosts).values(row);
      return post(row);
    },
    async updatePostMedia(id: string, input: { imageUrl?: string | null; imagePrompt?: string | null; metadata?: Record<string, unknown> }) {
      const existing = await this.getPostById(id);
      if (!existing) return null;
      await db.update(noodlePosts).set({
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
        ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
        ...(input.metadata && { metadata: JSON.stringify({ ...existing.metadata, ...input.metadata }) }),
        updatedAt: now(),
      }).where(eq(noodlePosts.id, id));
      return this.getPostById(id);
    },
    async updatePost(id: string, input: Record<string, unknown>) {
      const existing = await this.getPostById(id);
      if (!existing) return null;
      await db.update(noodlePosts).set({
        ...(input.content !== undefined && { content: String(input.content) }),
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl ? String(input.imageUrl) : null }),
        updatedAt: now(),
      }).where(eq(noodlePosts.id, id));
      return this.getPostById(id);
    },
    async deletePost(id: string) {
      const existing = await this.getPostById(id);
      if (!existing) return null;
      await db.transaction(async (tx) => {
        await tx.delete(noodleInteractions).where(eq(noodleInteractions.postId, id));
        await tx.delete(noodleActivityDigests).where(eq(noodleActivityDigests.sourcePostId, id));
        await tx.delete(noodlePosts).where(eq(noodlePosts.id, id));
      });
      return existing;
    },
    async createInteraction(postId: string, input: Record<string, unknown>) {
      if (!(await this.getPostById(postId)) || !(await this.getAccountById(String(input.actorAccountId)))) return null;
      const row = { id: newId(), postId, parentInteractionId: input.parentInteractionId ? String(input.parentInteractionId) : null, actorAccountId: String(input.actorAccountId), type: String(input.type), content: input.content ? String(input.content) : null, imageUrl: input.imageUrl ? String(input.imageUrl) : null, actorSnapshot: "{}", createdAt: now() };
      await db.insert(noodleInteractions).values(row);
      return interaction(row);
    },
    async getInteractionById(id: string) {
      const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.id, id));
      return rows[0] ? interaction(rows[0]) : null;
    },
    async updateInteraction(id: string, input: { content?: string | null; imageUrl?: string | null }) {
      if (!(await this.getInteractionById(id))) return null;
      await db.update(noodleInteractions).set(input).where(eq(noodleInteractions.id, id));
      return this.getInteractionById(id);
    },
    async deleteInteraction(postId: string, input: Record<string, unknown>) {
      const rows = await db.select().from(noodleInteractions).where(and(eq(noodleInteractions.postId, postId), eq(noodleInteractions.actorAccountId, String(input.actorAccountId)), eq(noodleInteractions.type, String(input.type))));
      if (!rows[0]) return null;
      await db.delete(noodleInteractions).where(eq(noodleInteractions.id, rows[0].id));
      return interaction(rows[0]);
    },
    async listInteractions(postIds: string[] = []) {
      if (!postIds.length) return [];
      return (await db.select().from(noodleInteractions).where(inArray(noodleInteractions.postId, postIds)).orderBy(noodleInteractions.createdAt)).map(interaction);
    },
    async createDigest(input: { accountIds: string[]; content: string; sourcePostId?: string; sourceInteractionId?: string; sourceRunId?: string }) {
      const row = { id: newId(), accountIds: JSON.stringify([...new Set(input.accountIds)]), content: input.content, sourceRunId: input.sourceRunId ?? null, sourcePostId: input.sourcePostId ?? null, sourceInteractionId: input.sourceInteractionId ?? null, createdAt: now() };
      await db.insert(noodleActivityDigests).values(row);
      return digest(row);
    },
    async listDigests(options: { limit?: number; since?: string } = {}) {
      const rows = await db.select().from(noodleActivityDigests).orderBy(desc(noodleActivityDigests.createdAt));
      return rows.filter((row) => !options.since || row.createdAt > options.since).slice(0, options.limit ?? 80).map(digest);
    },
    async createRefreshRun(input: { activeAccountIds: string[]; prompt: string }) {
      const timestamp = now();
      const row = { id: newId(), status: "running", activeAccountIds: JSON.stringify(input.activeAccountIds), prompt: input.prompt, result: null, error: null, attempts: "[]", createdAt: timestamp, updatedAt: timestamp };
      await db.insert(noodleRefreshRuns).values(row);
      return row;
    },
    async listRefreshRuns(options: { limit?: number; status?: string } = {}) {
      const rows = await db.select().from(noodleRefreshRuns).orderBy(desc(noodleRefreshRuns.createdAt));
      return rows.filter((row) => !options.status || row.status === options.status).slice(0, options.limit ?? 5);
    },
    async recordRefreshAttempt(id: string, attempt: unknown) {
      const rows = await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id));
      if (!rows[0]) return null;
      const attempts = JSON.parse(rows[0].attempts || "[]");
      await db.update(noodleRefreshRuns).set({ attempts: JSON.stringify([...attempts, attempt]), updatedAt: now() }).where(eq(noodleRefreshRuns.id, id));
      return (await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id)))[0] ?? null;
    },
    async finishRefreshRun(id: string, patch: { status: string; result?: string | null; error?: string | null }) {
      await db.update(noodleRefreshRuns).set({ status: patch.status, result: patch.result ?? null, error: patch.error ?? null, updatedAt: now() }).where(eq(noodleRefreshRuns.id, id));
      return (await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id)))[0] ?? null;
    },
    async bootstrap() {
      const posts = await this.listPosts({ limit: 160 });
      return { accounts: await this.listAccounts(), posts, interactions: await this.listInteractions(posts.map((item) => item.id)), digests: await this.listDigests(), settings: await this.getSettings() };
    },
  };
}
