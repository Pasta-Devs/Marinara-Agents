import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlpCreatorGenerationRequest } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import { slurpOnlyIntent, slurpPostAxes, slurpReuseDelivery } from "../../modules/feed/slp-content-axes.js";
import type { SlurpCreatorStrategy } from "../../modules/creators/slp-creator-strategy.js";
import { findReusableSlurpShoot } from "../../data/feed/slp-shoot-storage.js";
import { planSlurpOpportunity } from "../../data/feed/slp-opportunity-storage.js";
import { findSlurpReuse, loadSlurpReuse } from "../media/slp-media-contract.js";

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
  const drawn =
    !directed || chosen
      ? slurpPostAxes(account.id, sequence, {
          story: storyVariation,
          teaser: chosen ? chosen === "teaser" : isTeaser,
          images: imagesEnabled,
          intentWeights: chosen ? slurpOnlyIntent(chosen) : strategy.intentWeights,
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
        }).catch((error: unknown) => {
          logger.warn(error, "[slurp] Could not look for a picture to reuse; a new one is drawn instead");
          return null;
        })
      : null;
  const reusedAxes =
    drawnAxes && reuse
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
  return { axes, shoot, reusedMedia, reusedSource, opportunity };
}
