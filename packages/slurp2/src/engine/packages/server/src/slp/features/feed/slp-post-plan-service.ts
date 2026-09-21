import type { DB } from "../../../db/connection.js";
import { recordSlurpContinuityEvent } from "../../data/continuity/slp-continuity-storage.js";
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
import { completeSlurpOpportunity, planSlurpOpportunity } from "../../data/feed/slp-opportunity-storage.js";
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
    request: Pick<SlpCreatorGenerationRequest, "contentIntent" | "access"> & { generateImage?: boolean };
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
  // A due campaign stage takes an undirected slot the same way a chosen purpose would. It never
  // outranks the player: a directed or purpose-picked post leaves the campaign waiting.
  const stages =
    !directed && !chosen && !previewOnly
      ? await listOpenSlurpCampaignStages(db, account.id, at).catch((error: unknown) => {
          logger.warn(error, "[slurp] Could not read campaigns; this post is planned on its own");
          return [];
        })
      : [];
  const stage = slurpNextCampaignStage(stages, { at, access: request.access ?? "public" });
  const forced = chosen ?? (stage ? slurpCampaignStageIntent(stage.kind) : undefined);
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
  // A callback continues something already shot. Drawing from a real earlier shoot is what lets a
  // caption say "one more from yesterday" and have the picture actually match, instead of putting
  // the Creator back in yesterday's room with no explanation.
  const shoot = drawnAxes?.intent === "callback" ? await findReusableSlurpShoot(db, account.id, at) : null;
  // Whether a real earlier picture goes up instead of a new one. Decided from pictures that exist,
  // so the plan never promises a reuse that cannot happen; if the chosen file turns out to be
  // unreadable the post falls back to a new picture. A preview reads no files.
  const reuse =
    drawnAxes?.delivery === "new_capture" && imagesEnabled && !previewOnly
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
    drawnAxes && reuse && stage?.kind === "teaser" && reuse.preview && drawnAxes.delivery === "new_capture"
      ? { ...drawnAxes, delivery: "cropped_preview" as const }
      : drawnAxes && reuse
        ? slurpReuseDelivery(
            drawnAxes,
            { shoot: Boolean(reuse.shoot), archive: Boolean(reuse.archive), preview: Boolean(reuse.preview) },
            account.id,
            sequence,
          )
        : drawnAxes;
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
  const axes = reuseKind && !reusedMedia ? drawnAxes : reusedAxes;
  // The decision is durable before the model is called, so a run that dies between the two does
  // not lose it and a retry repeats it instead of drawing again. A preview decides nothing.
  const opportunity =
    axes && !previewOnly
      ? await planSlurpOpportunity(db, {
          creatorAccountId: account.id,
          slotId: slotId ?? null,
          sequence,
          workflow: axes.delivery === "text_only" ? "text_only" : reusedMedia ? "reuse_media" : "publish",
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
  if (opportunity) {
    try {
      if (stage) await moveSlurpCampaignStage(db, stage, "claimed", { at, opportunityId: opportunity.id });
      else if (axes?.intent === "set") {
        await openSlurpCampaign(db, { creatorAccountId: account.id, opportunityId: opportunity.id, at, dueAt });
      }
    } catch (error) {
      logger.warn(error, "[slurp] Could not update a campaign; the post stands on its own");
    }
  }
  return { axes, shoot, reusedMedia, reusedSource, opportunity };
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
    ]).catch((error: unknown) => {
      logger.warn(error, "[slurp] Could not close a content plan; the post stands on its own");
    });
  }
}
