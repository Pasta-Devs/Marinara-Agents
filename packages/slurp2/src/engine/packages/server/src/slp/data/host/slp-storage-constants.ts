import type { DB } from "../../../db/connection.js";
import { selectUnusedSlurpImprovementRows } from "../../modules/creators/improvement/slp-improvement.js";
import {
  slpAccounts,
  slpAccountSubscriptions,
  slpActivityDigests,
  slpInteractions,
  slpPosts,
  slpPostUnlocks,
  slpRefreshRuns,
  slpCreatorCreatorReplyClaims,
  slpCreatorAutomaticAttempts,
  slpCreatorPreparedPosts,
  slpCreatorReserveState,
  slpCreatorFanActivityState,
  slurpPopulation,
  slurpAudienceTies,
  slurpEvents,
  slurpPendingText,
  slpCreatorFirstPostJobs,
  slurpMessageClaims,
  slurpMessages,
  slurpReplyBubbles,
  slurpThreads,
  slurpCommissions,
  slurpFollowUps,
  slurpPaymentCompensations,
  slurpShootSessions,
  slurpWorldClaims,
  slurpImprovementJobs,
  slurpImprovementProposals,
} from "../../../db/schema/slurp.js";
import { now } from "../../../utils/id-generator.js";
import { SlpCreatorPostSortKey } from "../../modules/feed/slp-post-page.js";
import { slurpCreatorPostingIntervalMs } from "../../modules/feed/slp-posting-interval.js";

/** Newest candidates the image-retry poll inspects per pass. */
export const IMAGE_RETRY_SCAN_LIMIT = 200;

export const SLURP_SETTINGS_KEY = "slurp2.settings";

export const SLURP_CREATOR_STATE_KEY = "slurp2.creator.state";

export const SLP_REFRESH_SCHEDULE_KEY = "slurp2.refresh-schedule";

export const CREATOR_PRICES_KEY = "slurp2.creator-prices";

export const slurpViewerSettingsKey = (personaId: string) => `slurp2.viewer.${personaId}.settings`;

/**
 * Every table a Slurp backup carries, keyed by the archive's logical name rather than the physical
 * `slurp2_*` table name. The archive is deliberately named this way so a backup survives a table
 * rename — which is exactly what happened when the remaster moved off the `slurp_*` names.
 *
 * Order is parents first. Restore clears in reverse and writes forward, so a cascade never removes
 * a row the same restore just wrote.
 */
export const SLURP_BACKUP_TABLES = {
  accounts: slpAccounts,
  posts: slpPosts,
  subscriptions: slpAccountSubscriptions,
  unlocks: slpPostUnlocks,
  interactions: slpInteractions,
  replyClaims: slpCreatorCreatorReplyClaims,
  preparedPosts: slpCreatorPreparedPosts,
  attempts: slpCreatorAutomaticAttempts,
  reserveState: slpCreatorReserveState,
  fanState: slpCreatorFanActivityState,
  digests: slpActivityDigests,
  refreshRuns: slpRefreshRuns,
  firstPostJobs: slpCreatorFirstPostJobs,
  population: slurpPopulation,
  audienceTies: slurpAudienceTies,
  events: slurpEvents,
  threads: slurpThreads,
  messages: slurpMessages,
  messageClaims: slurpMessageClaims,
  replyBubbles: slurpReplyBubbles,
  followUps: slurpFollowUps,
  commissions: slurpCommissions,
  paymentCompensations: slurpPaymentCompensations,
  pendingText: slurpPendingText,
  shootSessions: slurpShootSessions,
  worldClaims: slurpWorldClaims,
  improvementJobs: slurpImprovementJobs,
  improvementProposals: slurpImprovementProposals,
} as const;

export type SlurpBackupTableName = keyof typeof SLURP_BACKUP_TABLES;

export const SLURP_BACKUP_TABLE_ORDER = Object.keys(SLURP_BACKUP_TABLES) as SlurpBackupTableName[];

/** Every owned setting key starts here. The export takes the whole namespace by prefix. */
export const SLURP_SETTINGS_NAMESPACE = "slurp2.";

export const SLP_CREATOR_RESERVE_STATE_ID = "noodler-reserve";

export const slurpSettingsUpdateQueue = { current: Promise.resolve() as Promise<unknown> };

export const ROLLING_DAY_MS = 24 * 60 * 60 * 1000;

export async function planUnusedSlurpData(db: DB) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const [currentPrepared, currentAttempts, currentRuns, improvementJobs, improvementProposals] = await Promise.all([
    db.select().from(slpCreatorPreparedPosts),
    db.select().from(slpCreatorAutomaticAttempts),
    db.select().from(slpRefreshRuns),
    db.select().from(slurpImprovementJobs),
    db.select().from(slurpImprovementProposals),
  ]);
  return {
    ...selectUnusedSlurpImprovementRows(improvementJobs, improvementProposals, cutoff),
    preparedIds: currentPrepared
      .filter((row) => ["published", "discarded"].includes(row.state) && Date.parse(row.updatedAt) < cutoff)
      .map((row) => row.id),
    attemptIds: currentAttempts.filter((row) => Date.parse(row.claimedAt) < cutoff).map((row) => row.id),
    runIds: currentRuns
      .filter((row) => ["completed", "failed", "abandoned"].includes(row.status) && Date.parse(row.updatedAt) < cutoff)
      .map((row) => row.id),
  };
}

/**
 * How long a slot stays publishable after its time.
 *
 * The reserve poll runs every minute, so a slot past this means the server was down or paused.
 * Publishing it now would backdate it, and a long outage would release the whole missed run at
 * once, so an elapsed slot is retired instead.
 *
 * One posting interval, not the fixed hour this used to be. The hour was written when the pace was
 * a few posts a day and it never learned about the setting: at 24 posts a day the grace equalled
 * the spacing, so a slot had a single interval to survive any hiccup, while at 4 posts a day a
 * slot missed by 61 minutes was destroyed even though the next one was five hours out. Bunching is
 * not what this guards — `publishDueNoodlerPreparedPosts` separately refuses to publish within one
 * interval of the creator's last post — so the grace can track the pace it belongs to.
 */
export const elapsedPreparedSlotMs = (postsPerDay: number) => slurpCreatorPostingIntervalMs(postsPerDay);

/** How long published/discarded prepared rows are kept for crash recovery before pruning. */
export const TERMINAL_PREPARED_POST_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type SlpCreatorPostPageCursor = SlpCreatorPostSortKey;
