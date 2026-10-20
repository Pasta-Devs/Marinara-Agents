/**
 * The spicy side of one post, read and decided in one place: what makes it spicy in this Creator's
 * own way (the kind of spicy post, a partner, now and then the player's taste), the level it goes
 * to after access and intent, and the picture's moment and company for a locked one (the caller's
 * variation is replaced by the one returned here). Rules live in
 * `modules/creators/slp-spice.ts`.
 */
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import type { SlpAccount, SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import { resolveSlurpSpiceCreator } from "../../data/creators/slp-flavour-source.js";
import { slurpSpicyCollabNames } from "../../data/creators/slp-spice-storage.js";
import { listSlurpFeedSpice } from "../../data/feed/slp-feed-subjects-storage.js";
import { resolveSlurpExplicitLevel } from "../../data/settings/slp-post-guidance-storage.js";
import { readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import { slurpSpiceAngle } from "../../modules/creators/slp-spice.js";
import { slurpPostSexualLevel, type SlurpExplicitLevel } from "../../modules/feed/slp-post-guidance.js";
import type { SlurpPostVariation } from "../../modules/feed/slp-post-variation.js";
import type { SlurpBeat } from "../../modules/feed/slp-post-beat.js";
import { slurpCollabPartners, type SlurpCreatorCollab } from "../../modules/projects/slp-project.js";
import { slurpWorkingPartnerIds } from "../../modules/projects/slp-creator-ties.js";
import { readSlurpCouplePartner } from "../projects/slp-projects-contract.js";
import type { SlurpTieStamp } from "../../modules/projects/slp-tie-stamp.js";
import { SLP_EXPLICIT_LEVELS } from "../../../../../shared/src/slp/slp-spice.js";

/**
 * How far this post may go: the Creator's level, and for a collab the lower of the two pages', since
 * the joint post shows on both and the partner's subscribers read it there too.
 */
export async function resolveSlurpPostDial(
  db: DB,
  creatorId: string,
  tie: SlurpTieStamp | undefined,
): Promise<SlurpExplicitLevel> {
  // A couple post too: it shows on the partner's page or their shared page (7b-couples).
  const partnerId = tie?.kind === "collab" || tie?.kind === "couple" ? tie.partnerId : undefined;
  const [own, partner] = await Promise.all([
    resolveSlurpExplicitLevel(db, creatorId),
    partnerId ? resolveSlurpExplicitLevel(db, partnerId).catch(() => null) : null,
  ]);
  return partner && SLP_EXPLICIT_LEVELS.indexOf(partner) < SLP_EXPLICIT_LEVELS.indexOf(own) ? partner : own;
}

/**
 * Who a partner scene may be with. A collab or couple post: that partner, or nobody (null) when their
 * level or hard noes rule it out. A Creator in a couple: the couple partner or someone unnamed.
 * Otherwise: the Creators this one works with, paired in settings or from a collab they made (minus
 * blocked pairs and open rivalries).
 */
async function spicePartners(
  db: DB,
  creatorId: string,
  paired: readonly SlurpCreatorCollab[],
  tie: SlurpTieStamp | undefined,
): Promise<{ collabs: string[]; madeWith?: string | null; intimate?: boolean; couple?: string | null }> {
  // A couple post (a cameo, a date, their shared page) is intimate, with the partner or nobody (U).
  if ((tie?.kind === "collab" || tie?.kind === "couple") && tie.partnerId)
    return {
      collabs: [],
      madeWith: (await slurpSpicyCollabNames(db, [tie.partnerId]))[0] ?? null,
      ...(tie.kind === "couple" ? { intimate: true } : {}),
    };
  // Taken: the couple partner is the partner, when their level and hard noes allow it (7b-couples).
  const couple = await readSlurpCouplePartner(db, creatorId);
  if (couple.inCouple)
    return {
      collabs: [],
      couple: couple.partnerId ? ((await slurpSpicyCollabNames(db, [couple.partnerId]))[0] ?? null) : null,
    };
  const { ties } = await readSlurpCreatorTiesDocument(db);
  const ids = slurpCollabPartners(paired, creatorId).map((entry) => entry.partnerId);
  return { collabs: await slurpSpicyCollabNames(db, slurpWorkingPartnerIds(ties, creatorId, ids)) };
}

/** Couple moments that are about something else than sex: a fight, jealousy, a breakup, a goodbye. */
const SLURP_UNSPICY_COUPLE: ReadonlySet<string> = new Set(["fight", "jealous", "breakup", "pageClose"]);

/** What earlier spicy posts of this Creator were, newest first, from what each post stored. */
function recentSpice(posts: readonly { metadata?: unknown }[]) {
  return posts.flatMap((post) => {
    const stored = (post.metadata as Record<string, unknown> | undefined)?.slurpSpice as
      { kind?: unknown; taste?: unknown } | undefined;
    return typeof stored?.kind === "string"
      ? [{ kind: stored.kind, taste: typeof stored.taste === "string" ? stored.taste : null }]
      : [];
  });
}

export async function planSlurpPostSpice(
  db: DB,
  input: {
    account: Pick<SlpAccount, "id"> & { settings: { strategy?: unknown } };
    source: Pick<SlpAccount, "kind" | "entityId"> | null;
    disclosureMode: SlpIdentityDisclosure;
    access: "public" | "locked";
    intent: string | undefined;
    teaser: boolean;
    /** The player's own direction decides the post; no spicy angle on top of it. */
    directed: boolean;
    /** This post's planned level and the Creator's ceiling, both under the Slurp-wide limit. */
    explicitLevel: SlurpExplicitLevel;
    dialLevel: SlurpExplicitLevel;
    collabs: readonly SlurpCreatorCollab[];
    recentPosts: readonly { metadata?: unknown }[];
    sequence: number;
    variation: SlurpPostVariation | null;
    beat: SlurpBeat | null;
    /** A drop delivers the kind its tease hinted at (3b). */
    teasedKind?: string | null;
    /** When the post is written for; other Creators' spice is read around it. */
    at?: Date;
  },
) {
  const spiceRead = await resolveSlurpSpiceCreator(db, input).catch((error: unknown) => {
    logger.warn(error, "[slurp] Could not read the Creator's spice; the post goes without it");
    return null;
  });
  const postLevel = slurpPostSexualLevel({ level: input.explicitLevel, access: input.access, intent: input.intent });
  const locked = input.access === "locked";
  // A sponsored post, a rivalry post or a fight / breakup is about that; the spice stays for the other posts.
  const tie = input.beat?.tie;
  const partners =
    postLevel === "explicit" && locked
      ? await spicePartners(db, input.account.id, input.collabs, tie).catch(() => ({
          collabs: [],
          ...(tie?.kind === "collab" || tie?.kind === "couple" ? { madeWith: null } : {}),
        }))
      : { collabs: [] };
  const spicy = tie?.kind !== "sponsor" && tie?.kind !== "rival" && !SLURP_UNSPICY_COUPLE.has(tie?.moment ?? "");
  const angle =
    spiceRead && !input.directed && spicy
      ? slurpSpiceAngle({
          level: postLevel,
          ceiling: input.dialLevel,
          access: input.access,
          teaser: input.teaser,
          creator: spiceRead.creator,
          spice: spiceRead.spice.spice,
          ...partners,
          recent: recentSpice(input.recentPosts),
          // Read only when the angle can be spicy; it scans other Creators' posts.
          feed:
            // A trend adoption skips the damping: being alike is its point (docs/TRENDS.md).
            postLevel !== "none" && (locked || input.teaser) && input.beat?.anchorKind !== "trend"
              ? await listSlurpFeedSpice(db, input.account.id, input.at ?? new Date())
              : [],
          sequence: input.sequence,
          teasedKind: input.teasedKind,
        })
      : null;
  // A locked spicy post's picture shows its own moment, and a partner scene its partner.
  const variation =
    angle && locked && input.variation
      ? {
          ...input.variation,
          moment: angle.moment,
          ...(angle.partner ? { company: angle.partner.company, companyCanHoldCamera: false } : {}),
        }
      : input.variation;
  // A named partner is in the cast, so the claim check does not call them invented.
  const partner = angle?.partner?.name;
  const beat =
    input.beat && partner && !input.beat.cast.includes(partner)
      ? { ...input.beat, cast: [...input.beat.cast, partner] }
      : input.beat;
  // Stored on the post: unlocks, likes and tips on it teach Slurp the player's taste.
  const metadata = angle ? { slurpSpice: { kind: angle.kind, ...(angle.taste ? { taste: angle.taste } : {}) } } : {};
  return { spice: spiceRead?.spice ?? null, postLevel, angle, variation, beat, metadata };
}
