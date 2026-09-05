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

// ──────────────────────────────────────────────
// Direct messages
// ──────────────────────────────────────────────

/**
 * One thread per viewer/creator pair.
 *
 * `state` is the gate: a viewer who does not clear the creator's DM policy lands in `request`
 * and stays there until the creator accepts. Only `active` threads generate replies, so the
 * gate is one column rather than a rule spread across every read path.
 */
export const slurpThreads = fileTable(
  "slurp_threads",
  {
    id: text("id").primaryKey(),
    viewerAccountId: text("viewer_account_id").notNull(),
    creatorAccountId: text("creator_account_id").notNull(),
    state: text("state").notNull().default("active"),
    openedBy: text("opened_by").notNull().default("viewer"),
    /** Coins paid to jump a `paid-request` gate, refunded in fiction when the creator accepts. */
    requestFeePaid: text("request_fee_paid").notNull().default("0"),
    lastMessageAt: text("last_message_at").notNull(),
    lastMessagePreview: text("last_message_preview").notNull().default(""),
    viewerUnread: text("viewer_unread").notNull().default("0"),
    creatorUnread: text("creator_unread").notNull().default("0"),
    replyNotBeforeAt: text("reply_not_before_at"),
    /** Cached rapport, recomputed on every send. Kept here so the inbox sorts without a scan. */
    rapport: text("rapport").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  { uniqueBy: [{ keys: ["viewerAccountId", "creatorAccountId"] }] },
);

/**
 * One message. The image columns are copied from `slurp_posts` verbatim so a DM attachment
 * moves through the same claim-token and lease machinery the post pipeline already runs.
 *
 * A thread has exactly one viewer, so `unlockedAt` on the row replaces a join table: a mass
 * message fans out into one row per subscriber thread and every read path stays identical.
 */
export const slurpMessages = fileTable("slurp_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  senderAccountId: text("sender_account_id").notNull(),
  /** "viewer" or "creator". Stored rather than derived so a deleted account still renders. */
  role: text("role").notNull(),
  kind: text("kind").notNull().default("text"),
  content: text("content").notNull().default(""),
  imageUrl: text("image_url"),
  imagePrompt: text("image_prompt"),
  imageClaimToken: text("image_claim_token"),
  imageClaimLeaseUntil: text("image_claim_lease_until"),
  /** Coins: the unlock price of a locked message, or the amount of a tip. */
  price: text("price").notNull().default("0"),
  unlockedAt: text("unlocked_at"),
  readAt: text("read_at"),
  metadata: text("metadata").notNull().default("{}"),
  senderSnapshot: text("sender_snapshot").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

/**
 * Reply claims, mirroring `slurp_creator_reply_claims`. A thread may have at most one reply in
 * flight, so the claim keys on the thread: a scheduler pass and a live send cannot double-reply.
 */
export const slurpMessageClaims = fileTable(
  "slurp_message_claims",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    triggerMessageId: text("trigger_message_id").notNull(),
    creatorAccountId: text("creator_account_id").notNull(),
    replyMessageId: text("reply_message_id"),
    claimedAt: text("claimed_at").notNull(),
  },
  { uniqueBy: [{ keys: ["threadId"] }] },
);

export const slurpCommissions = fileTable("slurp_commissions", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  viewerAccountId: text("viewer_account_id").notNull(),
  creatorAccountId: text("creator_account_id").notNull(),
  state: text("state").notNull().default("brief"),
  brief: text("brief").notNull(),
  price: text("price").notNull().default("0"),
  deliveryMessageId: text("delivery_message_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * One thing that happened, addressed to one persona.
 *
 * Slurp had no notification surface at all — only an unseen-post count and DM unread counts.
 * Nothing reported a subscriber, a tip, an unlock, a milestone, or a loss, so the world could be
 * made as alive as you like and the player would see none of it.
 *
 * `recipientPersonaId` is always a persona. Creator-side events reach the persona that operates
 * the Creator; a character-backed Creator has no operator and so produces none. Fan-side events
 * reach the persona directly.
 *
 * `weight` carries the significance score. The readable-handful rule means a feed is curated, not
 * a firehose, and sorting by weight is what lets small events group and trivial ones stay hidden.
 */
export const slurpEvents = fileTable("slurp_events", {
  id: text("id").primaryKey(),
  recipientPersonaId: text("recipient_persona_id").notNull(),
  kind: text("kind").notNull(),
  /** The Creator the event is about, when there is one. */
  creatorAccountId: text("creator_account_id"),
  /** The post, thread, or commission the event points at, so a notification can navigate. */
  subjectId: text("subject_id"),
  /** Who acted, for display. Stored rather than joined so a departed fan still renders. */
  actorLabel: text("actor_label"),
  /** Coins, follower counts, or a milestone target, depending on kind. */
  amount: text("amount").notNull().default("0"),
  weight: text("weight").notNull().default("0"),
  createdAt: text("created_at").notNull(),
  seenAt: text("seen_at"),
});

/**
 * One member of the audience.
 *
 * Rows are written only once a member acts somewhere the player can see, so a Creator's follower
 * count may read 12,483 while a few hundred rows exist. Everything about a member derives from
 * `seed`, so the row is a record that they were used, not the source of who they are.
 *
 * Nobody here has a profile, a post grid, or an avatar. That is what makes an audience affordable.
 */
export const slurpPopulation = fileTable(
  "slurp_population",
  {
    id: text("id").primaryKey(),
    seed: text("seed").notNull(),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    archetype: text("archetype").notNull(),
    traits: text("traits").notNull().default("[]"),
    spendTier: text("spend_tier").notNull().default("none"),
    activeHour: text("active_hour").notNull().default("12"),
    joinedAt: text("joined_at").notNull(),
    /** Last time this member did anything. Drives churn: the long-silent drift out. */
    lastActiveAt: text("last_active_at").notNull(),
  },
  { uniqueBy: [{ keys: ["handle"] }] },
);

/**
 * What one member is to one Creator.
 *
 * The funnel lives here. A follower count is the number of rows in follower state, not an invented
 * number, and decay is people moving back down rather than a curve applied to a total.
 */
export const slurpAudienceTies = fileTable(
  "slurp_audience_ties",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id").notNull(),
    creatorAccountId: text("creator_account_id").notNull(),
    /** stranger | viewer | liker | follower | subscriber | regular | whale | lapsed */
    stage: text("stage").notNull().default("stranger"),
    /** Coins this member has paid this Creator, ever. */
    spent: text("spent").notNull().default("0"),
    interactions: text("interactions").notNull().default("0"),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  { uniqueBy: [{ keys: ["memberId", "creatorAccountId"] }] },
);
