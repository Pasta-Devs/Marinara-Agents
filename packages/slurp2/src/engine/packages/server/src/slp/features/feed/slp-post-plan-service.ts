import type { DB } from "../../../db/connection.js";
import { listSlurpContinuityFor, recordSlurpContinuityEvent } from "../../data/continuity/slp-continuity-storage.js";
import { slurpContinuityInstruction } from "../../modules/continuity/slp-continuity-prompt.js";
import { slurpContinuityIdentityOf } from "../../modules/continuity/slp-continuity-rules.js";
import type { SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpPostAxes } from "../../modules/feed/slp-content-axes.js";
import type { SlurpContentOpportunity } from "../../data/feed/slp-opportunity-storage.js";
import { logger } from "../../../lib/logger.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlpCreatorGenerationRequest } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import { slurpOnlyIntent, slurpPostAxes, slurpReuseDelivery } from "../../modules/feed/slp-content-axes.js";
import type { SlurpCreatorStrategy } from "../../modules/creators/slp-creator-strategy.js";
import { findReusableSlurpShoot } from "../../data/feed/slp-shoot-storage.js";
import {
  claimSlurpPromise,
  completeSlurpOpportunity,
  findDueSlurpPromise,
  planSlurpOpportunity,
} from "../../data/feed/slp-opportunity-storage.js";
import { topSlurpDemandTrend } from "../../data/feed/slp-demand-storage.js";
import { eq } from "../../../db/file-query.js";
import { slurpContinuityEvents } from "../../../db/schema/slurp.js";
import { findSlurpReuse, loadSlurpReuse } from "../media/slp-media-contract.js";
import { slurpCampaignStageIntent, slurpNextCampaignStage } from "../../modules/feed/slp-campaign.js";
import {
  completeSlurpCampaignStageFor,
  listOpenSlurpCampaignStages,
  moveSlurpCampaignStage,
  openSlurpCampaign,
} from "../../data/feed/slp-campaign-storage.js";

/**
 * Everything decided about a post before a word of it is written.
 *
 * What it is for and how it goes out, which shoot it continues, which real earlier picture it
 * reuses, and the stored plan that records all of it. Kept apart from the generator so the
 * decision and the writing cannot drift into each other: the model writes the Creator's voice,
 * this decides what the system does.
 */
export async function planSlurpPost(
  db: DB,
  ctx: {
    account: Pick<SlpAccount, "id">;
    request: Pick<SlpCreatorGenerationRequest, "contentIntent" | "contentDelivery" | "access"> & {
      generateImage?: boolean;
    };
    strategy: SlurpCreatorStrategy;
    sequence: number;
    directed: boolean;
    storyVariation: boolean;
    isTeaser: boolean;
    imagesEnabled: boolean;
    previewOnly?: boolean;
    slotId?: string | null;
    at: Date;
    dueAt?: Date | null;
  },
) {
  const {
    account,
    request,
    strategy,
    sequence,
    directed,
    storyVariation,
    isTeaser,
    imagesEnabled,
    previewOnly,
    slotId,
    at,
    dueAt,
  } = ctx;
  // A purpose picked in the composer outranks the strategy for this post only, even on a directed
  // post: the direction says what it is about, the purpose says what it is for. It never touches
  // the saved strategy. An image the player asked for is honoured rather than redrawn as text.
  const chosen = request.contentIntent;
  // A promise the Creator made in a thread comes first among automatic reasons to post: it was
  // made to a person. It still never outranks the player's own direction or purpose.
  const promise =
    !directed && !chosen && !previewOnly
      ? await findDueSlurpPromise(db, account.id, { at, access: request.access ?? "public" }).catch(
          (error: unknown) => {
            logger.warn(error, "[slurp] Could not read promises; this post is planned on its own");
            return null;
          },
        )
      : null;
  // A due campaign stage takes an undirected slot the same way a chosen purpose would. It never
  // outranks the player: a directed or purpose-picked post leaves the campaign waiting.
  const stages =
    !directed && !chosen && !promise && !previewOnly
      ? await listOpenSlurpCampaignStages(db, account.id, at).catch((error: unknown) => {
          logger.warn(error, "[slurp] Could not read campaigns; this post is planned on its own");
          return [];
        })
      : [];
  const stage = slurpNextCampaignStage(stages, { at, access: request.access ?? "public" });
  const forced =
    chosen ??
    (promise?.intent === "request" || promise?.intent === "teaser" ? promise.intent : undefined) ??
    (stage ? slurpCampaignStageIntent(stage.kind) : undefined);
  const drawn =
    !directed || forced
      ? slurpPostAxes(account.id, sequence, {
          story: storyVariation,
          teaser: forced ? forced === "teaser" : isTeaser,
          images: imagesEnabled,
          intentWeights: forced ? slurpOnlyIntent(forced) : strategy.intentWeights,
          textOnlyRate: strategy.textOnlyRate,
        })
      : null;
  const drawnAxes =
    drawn && chosen && request.generateImage === true && imagesEnabled && drawn.delivery === "text_only"
      ? { ...drawn, delivery: "new_capture" as const }
      : drawn;
  const requestedAxes =
    drawnAxes && request.contentDelivery ? { ...drawnAxes, delivery: request.contentDelivery } : drawnAxes;
  // A callback continues something already shot. Drawing from a real earlier shoot is what lets a
  // caption say "one more from yesterday" and have the picture actually match, instead of putting
  // the Creator back in yesterday's room with no explanation.
  const shoot = requestedAxes?.intent === "callback" ? await findReusableSlurpShoot(db, account.id, at) : null;
  // Whether a real earlier picture goes up instead of a new one. Decided from pictures that exist,
  // so the plan never promises a reuse that cannot happen; if the chosen file turns out to be
  // unreadable the post falls back to a new picture. A preview reads no files.
  const reuse =
    requestedAxes &&
    ["new_capture", "existing_media", "cropped_preview"].includes(requestedAxes.delivery) &&
    imagesEnabled &&
    !previewOnly
      ? await findSlurpReuse(db, {
          creatorAccountId: account.id,
          access: request.access ?? "public",
          at: at,
          sequence,
          shootId: shoot?.id ?? null,
          previewPostId: stage
            ? (stages.find((other) => other.campaignId === stage.campaignId && other.kind === "set")?.postId ?? null)
            : null,
        }).catch((error: unknown) => {
          logger.warn(error, "[slurp] Could not look for a picture to reuse; a new one is drawn instead");
          return null;
        })
      : null;
  const reusedAxes =
    // A campaign teaser shows its set whenever a preview can be cut; that is what the stage is for.
    requestedAxes && reuse && stage?.kind === "teaser" && reuse.preview && requestedAxes.delivery === "new_capture"
      ? { ...requestedAxes, delivery: "cropped_preview" as const }
      : requestedAxes && reuse && requestedAxes.delivery === "new_capture"
        ? slurpReuseDelivery(
            requestedAxes,
            { shoot: Boolean(reuse.shoot), archive: Boolean(reuse.archive), preview: Boolean(reuse.preview) },
            account.id,
            sequence,
          )
        : requestedAxes;
  const reuseKind =
    reusedAxes?.delivery === "cropped_preview"
      ? ("preview" as const)
      : reusedAxes?.delivery === "existing_media"
        ? reusedAxes.intent === "callback"
          ? ("shoot" as const)
          : ("archive" as const)
        : null;
  const reusedSource = reuseKind ? (reuse?.[reuseKind] ?? null) : null;
  const reusedMedia = reuseKind && reusedSource ? await loadSlurpReuse(reusedSource, reuseKind) : null;
  if (request.contentDelivery === "existing_media" && !reuse?.archive && !reuse?.shoot) {
    throw new Error("No reusable image is available for this Creator.");
  }
  if (request.contentDelivery === "cropped_preview" && !reuse?.preview) {
    throw new Error("No set image is available to crop as a preview.");
  }
  const axes = reuseKind && !reusedMedia ? requestedAxes : reusedAxes;
  // The decision is durable before the model is called, so a run that dies between the two does
  // not lose it and a retry repeats it instead of drawing again. A preview decides nothing.
  const workflow = axes?.delivery === "text_only" ? "text_only" : reusedMedia ? "reuse_media" : "publish";
  const opportunity =
    axes && !previewOnly && promise
      ? // The promise row is the plan: claiming it keeps the promise and the post it produced as one
        // record, so a kept promise can be traced back to the request it answered.
        await claimSlurpPromise(db, promise.id, {
          slotId: slotId ?? null,
          workflow,
          delivery: axes.delivery,
          access: request.access ?? "",
        }).catch((error: unknown) => {
          logger.warn(error, "[slurp] Could not claim a promise; it stays open for a later slot");
          return null;
        })
      : axes && !previewOnly
        ? await planSlurpOpportunity(db, {
            creatorAccountId: account.id,
            slotId: slotId ?? null,
            sequence,
            workflow,
            intent: axes.intent,
            delivery: axes.delivery,
            access: request.access ?? "",
            at: at,
            dueAt: dueAt ?? null,
          }).catch((error: unknown) => {
            // A post must never fail over planner bookkeeping.
            logger.warn(error, "[slurp] Could not record a content plan; the post stands on its own");
            return null;
          })
        : null;
  // Campaign bookkeeping, never allowed to cost the post. A stage this plan runs is claimed by it; a
  // set planned outside a campaign opens one, with itself as the first, already claimed stage.
  let campaignId = stage?.campaignId ?? null;
  if (opportunity) {
    try {
      if (stage) await moveSlurpCampaignStage(db, stage, "claimed", { at, opportunityId: opportunity.id });
      else if (axes?.intent === "set") {
        campaignId = await openSlurpCampaign(db, {
          creatorAccountId: account.id,
          opportunityId: opportunity.id,
          at,
          dueAt,
        });
      }
    } catch (error) {
      logger.warn(error, "[slurp] Could not update a campaign; the post stands on its own");
    }
  }
  // Anonymous demand: when this post answers "somebody asked", the most-asked topic can say what.
  // A promised post never gets it: its request is private to one thread.
  const demand =
    axes?.intent === "request" && !promise && !previewOnly
      ? await topSlurpDemandTrend(db, account.id, at).catch(() => null)
      : null;
  // What this Creator may use about themselves in this post: their own public and private notes,
  // and what they have been doing. A fan's thread never reaches a post; `slurpContinuityReadable`
  // decides that, not this call site.
  const continuityInstruction = await listSlurpContinuityFor(
    db,
    account.id,
    request.access === "locked" ? "locked_post" : "public_post",
    { at, limit: 20 },
  )
    .then((ledger) => slurpContinuityInstruction(ledger))
    .catch((error: unknown) => {
      logger.warn(error, "[slurp] Could not read continuity for a post; it is written without it");
      return "";
    });
  return {
    axes,
    shoot,
    reusedMedia,
    reusedSource,
    opportunity,
    demandTopic: demand?.topic ?? null,
    continuityInstruction,
    campaignId,
  };
}

/**
 * A promise was kept: record it in the thread it was made in, once. Called wherever a plan
 * completes, so a promise kept by a scheduled post is recorded as surely as a direct one.
 */
export async function recordSlurpPromiseKept(
  db: DB,
  opportunity: Pick<SlurpContentOpportunity, "id" | "sourceEventId">,
  input: { postId?: string | null; at: Date },
): Promise<void> {
  if (!opportunity.sourceEventId) return;
  const [source] = await db
    .select()
    .from(slurpContinuityEvents)
    .where(eq(slurpContinuityEvents.id, opportunity.sourceEventId));
  if (!source?.threadId) return;
  await recordSlurpContinuityEvent(db, {
    sourceKind: String(source.sourceKind),
    sourceEntityId: String(source.sourceEntityId),
    creatorAccountId: String(source.creatorAccountId),
    eventType: "promise_kept",
    source: "slurp_post",
    realityScope: "slurp",
    audienceScope: "thread_private",
    threadId: String(source.threadId),
    payload: { requestId: opportunity.sourceEventId, ...(input.postId ? { postId: input.postId } : {}) },
    relatedIds: [opportunity.sourceEventId, opportunity.id, ...(input.postId ? [input.postId] : [])],
    fingerprint: `kept:${opportunity.id}`,
    contribution: "system",
    occurredAt: input.at,
  });
}

/**
 * Everything that follows a post landing: its plan closes with the post it produced, its campaign
 * stage advances, and the ledger records that it was published. Each step is best effort, because
 * a post that already exists must never be lost over bookkeeping about it.
 */
export async function recordSlurpPostOutcome(
  db: DB,
  input: {
    account: Parameters<typeof slurpContinuityIdentityOf>[0];
    post: Pick<SlpCreatorManagedPost, "id" | "access">;
    axes: SlurpPostAxes | null;
    shootId: string | null;
    opportunity: SlurpContentOpportunity | null;
    at: Date;
    previewOnly?: boolean;
  },
): Promise<void> {
  const { post, axes, shootId, opportunity, at } = input;
  const identity = slurpContinuityIdentityOf(input.account);
  if (identity && !input.previewOnly) {
    // A published post is history. Recorded once per post id.
    await recordSlurpContinuityEvent(db, {
      ...identity,
      eventType: "post_published",
      source: "slurp_post",
      realityScope: "slurp",
      audienceScope: "creator_public",
      payload: {
        access: post.access,
        ...(axes ? { intent: axes.intent, delivery: axes.delivery } : {}),
        ...(shootId ? { shootId } : {}),
      },
      relatedIds: [post.id, ...(shootId ? [shootId] : [])],
      fingerprint: `post:${post.id}`,
      contribution: "system",
      occurredAt: at,
    }).catch((error: unknown) => {
      logger.warn(error, "[slurp] Could not record a published post in continuity");
    });
  }
  if (opportunity) {
    await Promise.all([
      completeSlurpOpportunity(db, opportunity.id, { postId: post.id, at }),
      completeSlurpCampaignStageFor(db, opportunity.id, { postId: post.id, at }),
      recordSlurpPromiseKept(db, opportunity, { postId: post.id, at }),
    ]).catch((error: unknown) => {
      logger.warn(error, "[slurp] Could not close a content plan; the post stands on its own");
    });
  }
}
