// ──────────────────────────────────────────────
// Schema: Noodle Fake Social Media
// ──────────────────────────────────────────────
import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const noodleAccounts = sqliteTable("noodle_accounts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  entityId: text("entity_id").notNull(),
  handle: text("handle").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  avatarUrl: text("avatar_url"),
  invited: text("invited").notNull().default("false"),
  settings: text("settings").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const noodlePosts = sqliteTable("noodle_posts", {
  id: text("id").primaryKey(),
  authorAccountId: text("author_account_id").notNull(),
  content: text("content").notNull().default(""),
  imageUrl: text("image_url"),
  imagePrompt: text("image_prompt"),
  parentPostId: text("parent_post_id"),
  quotePostId: text("quote_post_id"),
  source: text("source").notNull().default("manual"),
  metadata: text("metadata").notNull().default("{}"),
  authorSnapshot: text("author_snapshot").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const noodleInteractions = sqliteTable(
  "noodle_interactions",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    parentInteractionId: text("parent_interaction_id"),
    actorAccountId: text("actor_account_id").notNull(),
    type: text("type").notNull(),
    content: text("content"),
    imageUrl: text("image_url"),
    actorSnapshot: text("actor_snapshot").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    noodleRootToggleInteractionUnique: uniqueIndex("uniq_noodle_root_toggle_interactions")
      .on(table.postId, table.actorAccountId, table.type)
      .where(sql`type IN ('like', 'repost') AND parent_interaction_id IS NULL`),
    noodleReplyLikeUnique: uniqueIndex("uniq_noodle_reply_like")
      .on(table.postId, table.actorAccountId, table.type, table.parentInteractionId)
      .where(sql`type = 'like' AND parent_interaction_id IS NOT NULL`),
  }),
);

export const noodleActivityDigests = sqliteTable("noodle_activity_digests", {
  id: text("id").primaryKey(),
  accountIds: text("account_ids").notNull().default("[]"),
  content: text("content").notNull().default(""),
  sourceRunId: text("source_run_id"),
  sourcePostId: text("source_post_id"),
  sourceInteractionId: text("source_interaction_id"),
  createdAt: text("created_at").notNull(),
});

export const noodleRefreshRuns = sqliteTable("noodle_refresh_runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  activeAccountIds: text("active_account_ids").notNull().default("[]"),
  prompt: text("prompt").notNull().default(""),
  result: text("result"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
