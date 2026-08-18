// ──────────────────────────────────────────────
// Schema: Slurp creator social media
// ──────────────────────────────────────────────
import { fileTable, text } from "../file-schema.js";

export const noodleAccounts = fileTable(
  "slurp_accounts",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url"),
    invited: text("invited").notNull().default("false"),
    settings: text("settings").notNull().default("{}"),
    platform: text("platform").notNull().default("slurp"),
    sourceKind: text("source_kind"),
    sourceEntityId: text("source_entity_id"),
    slurpSourceAccountId: text("slurp_source_account_id"),
    // Rollback-only mirrors of platform/slurpSourceAccountId. Nothing reads these; they exist so a
    // build from before the rename can still tell a NoodleR profile from a Noodle account. Without
    // them an older build falls back to the column default and puts NoodleR content on the public
    // timeline. Safe to drop once no supported version reads `visibility`.
    visibility: text("visibility").notNull().default("public"),
    publicAccountId: text("slurp_public_account_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  {
    uniqueBy: [
      {
        keys: ["sourceKind", "sourceEntityId"],
        when: (row) => row.platform === "slurp" && row.sourceKind != null && row.sourceEntityId != null,
      },
      { keys: ["handle"], when: (row) => row.platform === "slurp" },
    ],
  },
);

export const noodlePosts = fileTable("slurp_posts", {
  id: text("id").primaryKey(),
  authorAccountId: text("author_account_id").notNull(),
  title: text("title"),
  content: text("content").notNull().default(""),
  imageUrl: text("image_url"),
  imagePrompt: text("image_prompt"),
  imageClaimToken: text("image_claim_token"),
  imageClaimLeaseUntil: text("image_claim_lease_until"),
  parentPostId: text("parent_post_id"),
  quotePostId: text("quote_post_id"),
  source: text("source").notNull().default("manual"),
  access: text("access").notNull().default("public"),
  metadata: text("metadata").notNull().default("{}"),
  authorSnapshot: text("author_snapshot").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const noodleAccountSubscriptions = fileTable(
  "slurp_account_subscriptions",
  {
    id: text("id").primaryKey(),
    viewerAccountId: text("viewer_account_id").notNull(),
    creatorAccountId: text("creator_account_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  { uniqueBy: [{ keys: ["viewerAccountId", "creatorAccountId"] }] },
);

export const noodlePostUnlocks = fileTable(
  "slurp_post_unlocks",
  {
    id: text("id").primaryKey(),
    viewerAccountId: text("viewer_account_id").notNull(),
    postId: text("post_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  { uniqueBy: [{ keys: ["viewerAccountId", "postId"] }] },
);

export const noodleInteractions = fileTable(
  "slurp_interactions",
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
  {
    uniqueBy: [
      {
        keys: ["postId", "actorAccountId", "type", "parentInteractionId"],
        when: (row) => row.type === "like" || row.type === "repost" || row.type === "vote",
      },
    ],
  },
);

export const noodlerCreatorReplyClaims = fileTable(
  "slurp_creator_reply_claims",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    parentInteractionId: text("parent_interaction_id").notNull(),
    creatorAccountId: text("creator_account_id").notNull(),
    replyInteractionId: text("reply_interaction_id"),
    claimedAt: text("claimed_at").notNull(),
  },
  { uniqueBy: [{ keys: ["parentInteractionId", "creatorAccountId"] }] },
);

export const noodlerPreparedPosts = fileTable(
  "slurp_prepared_posts",
  {
    id: text("id").primaryKey(),
    creatorAccountId: text("creator_account_id").notNull(),
    generatedAt: text("generated_at").notNull(),
    publishAt: text("publish_at").notNull(),
    payload: text("payload").notNull(),
    policyFingerprint: text("policy_fingerprint").notNull(),
    state: text("state").notNull().default("prepared"),
    publishedPostId: text("published_post_id"),
    imageState: text("image_state").notNull().default("none"),
    imageClaimToken: text("image_claim_token"),
    imageClaimLeaseUntil: text("image_claim_lease_until"),
    updatedAt: text("updated_at").notNull(),
  },
  { uniqueBy: [{ keys: ["publishedPostId"], when: (row) => row.publishedPostId != null }] },
);

export const noodlerAutomaticAttempts = fileTable("slurp_automatic_attempts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  claimedAt: text("claimed_at").notNull(),
  outcome: text("outcome").notNull().default("claimed"),
});

export const noodlerReserveState = fileTable("slurp_reserve_state", {
  id: text("id").primaryKey(),
  lastObservedBudgetTime: text("last_observed_budget_time").notNull(),
  preparationNotBefore: text("preparation_not_before").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const noodlerFanActivityState = fileTable("slurp_fan_activity_state", {
  id: text("id").primaryKey(),
  plan: text("plan").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const noodleActivityDigests = fileTable("slurp_activity_digests", {
  id: text("id").primaryKey(),
  accountIds: text("account_ids").notNull().default("[]"),
  content: text("content").notNull().default(""),
  sourceRunId: text("source_run_id"),
  sourcePostId: text("source_post_id"),
  sourceInteractionId: text("source_interaction_id"),
  createdAt: text("created_at").notNull(),
});

export const noodleRefreshRuns = fileTable("slurp_refresh_runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  activeAccountIds: text("active_account_ids").notNull().default("[]"),
  prompt: text("prompt").notNull().default(""),
  result: text("result"),
  error: text("error"),
  attempts: text("attempts").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
