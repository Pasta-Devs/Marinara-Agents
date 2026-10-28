import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slpStoryPollTally } from "../../../../../shared/src/slp/slp-post-purpose.js";
import { readSlpPollFromMetadata } from "../../../../../shared/src/slp/slp-polls.js";
import type { SlpCreatorSteering } from "../../../../../shared/src/slp/slp-creator-steering.js";
import {
  listSlurpPollVotes,
  listSlurpPurposeComments,
  listSlurpPurposePosts,
  markSlurpPollAnswered,
  type SlurpPurposeRow,
} from "../../data/feed/slp-purpose-storage.js";
import { openSlurpCampaign, type SlurpCampaignStage } from "../../data/feed/slp-campaign-storage.js";
import { SLURP_TEASE_CAMPAIGN_TEMPLATE, slurpHeldDropTime } from "../../modules/feed/slp-campaign.js";
import { slurpCreatorPostingIntervalMs, slurpPacedPostsPerDay } from "../../modules/feed/slp-posting-interval.js";
import { readSlurpCreatorPaceFactor } from "../../data/creators/slp-steering-storage.js";
import { slpCreatorReserveFingerprintFor } from "../../data/creators/slp-source-resolve.js";
import type { SlurpCanonAnchors } from "../../modules/feed/slp-post-beat.js";
import {
  SLURP_TEASE_DROP_DELAY_MS,
  slurpPollAnswerDue,
  slurpPollWinner,
  slurpStoryCandidates,
  slurpStoryPoll,
  slurpStoryPurpose,
  type SlurpStoryPurposePlan,
} from "../../modules/feed/slp-post-purpose.js";

/**
 * The read side of post purposes (3b) for the planner. Every function is best effort: a purpose
 * that cannot be read is an ordinary post, never a failed one.
 */

/** The teased drops still to come: a tease campaign whose tease is out and whose drop is planned. */
export function slurpPendingDrops(stages: readonly SlurpCampaignStage[]): { campaignId: string; dropAt: string }[] {
  return stages
    .filter((stage) => stage.kind === "set" && stage.status === "planned")
    .filter((stage) =>
      stages.some(
        (other) =>
          other.campaignId === stage.campaignId &&
          other.kind === "teaser" &&
          other.position < stage.position &&
          other.status === "completed",
      ),
    )
    .map((stage) => ({ campaignId: stage.campaignId, dropAt: stage.dueAt }));
}

/**
 * The tease this slot's campaign stage belongs to (a tease stage, or a drop that was teased): the
 * campaign, when its drop is due, and the tease or drop post once it is up.
 */
export async function slurpCampaignPurposeFacts(
  db: DB,
  creatorAccountId: string,
  stage: SlurpCampaignStage,
  stages: readonly SlurpCampaignStage[],
): Promise<{
  tease?: { campaignId: string; dropAt?: string | null; postId?: string | null };
  drop?: { teasePostId: string | null; title: string | null };
  spiceKind?: string | null;
}> {
  const posts = await listSlurpPurposePosts(db, creatorAccountId).catch(() => [] as SlurpPurposeRow[]);
  const inCampaign = posts.filter((post) => post.purpose?.campaignId === stage.campaignId);
  if (stage.kind === "teaser") {
    const set = stages.find((other) => other.campaignId === stage.campaignId && other.kind === "set");
    const drop = inCampaign.find((post) => post.purpose?.kind === "drop");
    return {
      tease: {
        campaignId: stage.campaignId,
        dropAt: set?.status === "planned" && set.position > stage.position ? set.dueAt : null,
        postId: set?.postId ?? drop?.id ?? null,
      },
    };
  }
  if (stage.kind !== "set") return {};
  const tease = inCampaign.find((post) => post.purpose?.kind === "tease");
  const spice = tease?.metadata.slurpSpice;
  return {
    drop: { teasePostId: tease?.id ?? null, title: tease ? tease.title || tease.content.slice(0, 80) : null },
    spiceKind:
      spice && typeof spice === "object" && typeof (spice as { kind?: unknown }).kind === "string"
        ? (spice as { kind: string }).kind
        : null,
  };
}

/**
 * A free tease promises a drop: it joins a tease whose drop is still to come, or opens a campaign of
 * its own with the drop as the next locked post a few hours after the tease goes up.
 */
export async function openSlurpTease(
  db: DB,
  input: {
    creatorAccountId: string;
    opportunityId: string;
    stages: readonly SlurpCampaignStage[];
    at: Date;
    dueAt?: Date | null;
  },
): Promise<{ campaignId: string; dropAt: string; held: boolean } | null> {
  const waiting = input.stages.find((stage) => stage.kind === "set" && stage.status === "planned");
  if (waiting) return { campaignId: waiting.campaignId, dropAt: waiting.dueAt, held: false };
  try {
    const teaseAt = input.dueAt ?? input.at;
    // Slice I: the drop gets an exact hour and a slot of its own, so the tease can name the time.
    // Without a held slot it is the next locked post after the usual delay (3b).
    const heldAt = await holdSlurpDropSlot(db, input.creatorAccountId, teaseAt, input.at).catch((error: unknown) => {
      logger.warn(error, "[slurp] Could not hold a slot for a drop; it comes with the next locked post");
      return null;
    });
    const delay = heldAt ? heldAt.getTime() - teaseAt.getTime() : SLURP_TEASE_CAMPAIGN_TEMPLATE[1]!.delayMs;
    const campaignId = await openSlurpCampaign(db, {
      creatorAccountId: input.creatorAccountId,
      opportunityId: input.opportunityId,
      at: input.at,
      dueAt: input.dueAt,
      template: SLURP_TEASE_CAMPAIGN_TEMPLATE.map((stage, index) =>
        index === 0
          ? stage
          : { ...stage, delayMs: delay + (stage.delayMs - SLURP_TEASE_CAMPAIGN_TEMPLATE[1]!.delayMs) },
      ),
    });
    return { campaignId, dropAt: new Date(teaseAt.getTime() + delay).toISOString(), held: Boolean(heldAt) };
  } catch (error) {
    logger.warn(error, "[slurp] Could not open a tease campaign; the tease stands on its own");
    return null;
  }
}

/**
 * Book the drop's slot for this Creator at an exact hour (slice I). The reserve fills it like any
 * slot; the planner gives it the drop and the reserve makes it locked (`slurpHeldDropStage`).
 * Null when automatic posting is off or the slot could not be booked.
 */
async function holdSlurpDropSlot(db: DB, creatorAccountId: string, teaseAt: Date, at: Date): Promise<Date | null> {
  const times = await readSlurpSlotTimes(db, creatorAccountId, at, [teaseAt.getTime()]);
  if (!times) return null;
  const dropAt = slurpHeldDropTime({ teaseAt, minGapMs: SLURP_TEASE_DROP_DELAY_MS, ...times });
  return (await bookSlurpHeldSlot(db, creatorAccountId, dropAt, at)) ? dropAt : null;
}

/**
 * What holding a slot has to stay clear of: this Creator's scheduled, prepared and recent posts
 * (epoch ms, plus `extra`) and their own spacing. Null when automatic posting is off (no reserve
 * would fill a held slot).
 */
export async function readSlurpSlotTimes(
  db: DB,
  creatorAccountId: string,
  at: Date,
  extra: readonly number[] = [],
): Promise<{ busy: number[]; spacingMs: number } | null> {
  const storage = createSlurpStorage(db);
  const settings = await storage.getPostingSettings(at);
  if (!settings.autoPostingScheduleEnabled || settings.postsPerDay <= 0) return null;
  const spacingMs = slurpCreatorPostingIntervalMs(
    slurpPacedPostsPerDay(settings.postsPerDay, await readSlurpCreatorPaceFactor(db, creatorAccountId)),
  );
  const busy = [
    ...extra,
    ...(await storage.listNoodlerPreparedPosts())
      .filter(
        (item: { creatorAccountId: string; state: string }) =>
          item.creatorAccountId === creatorAccountId && (item.state === "scheduled" || item.state === "prepared"),
      )
      .map((item: { publishAt: string }) => Date.parse(item.publishAt)),
    ...(await storage.listNoodlerPostsByAccount(creatorAccountId, 8)).map((post: { createdAt: string }) =>
      Date.parse(post.createdAt),
    ),
  ];
  return { busy, spacingMs };
}

/** Book one slot for this Creator at exactly `dropAt` (a teased drop, slice I; a collab drop, V). */
export async function bookSlurpHeldSlot(db: DB, creatorAccountId: string, dropAt: Date, at: Date): Promise<boolean> {
  const storage = createSlurpStorage(db);
  const settings = await storage.getPostingSettings(at);
  const account = await storage.getNoodlerAccountById(creatorAccountId);
  if (!account || !settings.autoPostingScheduleEnabled || settings.postsPerDay <= 0) return false;
  const slotId = await storage.createNoodlerScheduledPost({
    creatorAccountId,
    publishAt: dropAt.toISOString(),
    policyFingerprint: await slpCreatorReserveFingerprintFor(
      db,
      account,
      settings,
      await storage.resolveAccountSource(account),
    ),
    createdAt: at.toISOString(),
  });
  return Boolean(slotId);
}

/**
 * The oldest Story poll whose answer is ready, with the option that won (real votes plus the small
 * seeded crowd the viewer shows). Claimed at once unless this is a preview, so two prepared posts
 * never answer the same poll; a retried slot finds it again through its stored beat.
 */
export async function takeSlurpPollAnswer(
  db: DB,
  creatorAccountId: string,
  input: { at: Date; previewOnly?: boolean },
): Promise<{ pollPostId: string; answer: string } | null> {
  try {
    const posts = await listSlurpPurposePosts(db, creatorAccountId);
    const due = posts
      .filter(
        (post) => post.purpose && slurpPollAnswerDue({ createdAt: post.createdAt, purpose: post.purpose }, input.at),
      )
      .at(-1);
    const poll = due ? readSlpPollFromMetadata(due.metadata) : null;
    if (!due || !poll) return null;
    const tally = slpStoryPollTally(
      { postId: due.id, createdAt: due.createdAt, optionCount: poll.options.length },
      await listSlurpPollVotes(db, due),
      input.at,
    );
    const answer = slurpPollWinner(
      poll.options.map((option) => option.label),
      tally,
      due.id,
    );
    if (!answer) return null;
    if (!input.previewOnly) await markSlurpPollAnswered(db, due, input.at);
    return { pollPostId: due.id, answer };
  } catch (error) {
    logger.warn(error, "[slurp] Could not read Story polls; this post is planned on its own");
    return null;
  }
}

/** The job for an automatic Story, from what is really going on for this Creator right now. */
export async function planSlurpStoryPurpose(
  db: DB,
  input: {
    creatorAccountId: string;
    sequence: number;
    stages: readonly SlurpCampaignStage[];
    anchors: SlurpCanonAnchors | null;
    steering: Pick<SlpCreatorSteering, "push" | "avoid"> | null;
    at: Date;
  },
): Promise<SlurpStoryPurposePlan | null> {
  try {
    const posts = await listSlurpPurposePosts(db, input.creatorAccountId);
    const recentFeed = posts.filter((post) => !post.story).slice(0, 6);
    const comments = await listSlurpPurposeComments(
      db,
      input.creatorAccountId,
      recentFeed.map((post) => post.id),
    );
    const candidates = slurpStoryCandidates({
      posts,
      comments,
      drops: slurpPendingDrops(input.stages),
      poll: slurpStoryPoll(input.creatorAccountId, input.sequence, input.anchors, input.steering),
      at: input.at,
    });
    const { storyJobs } = await createSlurpStorage(db).getSettings();
    return slurpStoryPurpose(input.creatorAccountId, input.sequence, candidates, input.at, storyJobs);
  } catch (error) {
    logger.warn(error, "[slurp] Could not plan a Story's purpose; it goes up as a moment");
    return null;
  }
}
