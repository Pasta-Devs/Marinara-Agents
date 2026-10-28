/**
 * The occasion moment for one post (Backstage › Packs), read and decided in one place. The rules
 * live in `modules/feed/slp-occasion-beats.ts`. Read-only and best effort: a failed read means no
 * occasion moment, never a failed post.
 */
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import type { SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";
import { slurpRunningPlatformEventWindows } from "../../../../../shared/src/slp/slp-platform-events.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { listSlurpOpportunities } from "../../data/feed/slp-opportunity-storage.js";
import { resolveSlurpCreatorSpice } from "../../data/creators/slp-spice-storage.js";
import { slurpCollabPartners } from "../../modules/projects/slp-project.js";
import { slurpContentPacksOn } from "../../modules/world/events/slp-content-packs.js";
import { readSlurpDramaLibrary } from "../../data/world/slp-drama-storage.js";
import { slurpOccasionBeat, slurpPackOccasions, slurpPackTopicOff } from "../../modules/feed/slp-occasion-beats.js";
import type { SlurpBeat, SlurpBeatHistory } from "../../modules/feed/slp-post-beat.js";
import { readSlurpCouplePartner } from "../projects/slp-projects-contract.js";
import { slpExtensionOn, slpLiveEvents } from "../../../../../shared/src/slp/slp-extensions.js";

export async function planSlurpOccasionBeat(
  db: DB,
  input: {
    accountId: string;
    sequence: number;
    /** The Creator's card text and tags, for what fits. */
    creatorText: string;
    /** Topics the player asked to leave out (steering). */
    avoid: readonly string[];
    history: Pick<SlurpBeatHistory, "sharedToday">;
    intents: readonly SlurpContentIntent[];
    at: Date;
  },
): Promise<SlurpBeat | null> {
  try {
    const noodle = createSlurpStorage(db);
    const settings = await noodle.getSettings();
    const imported = (await readSlurpDramaLibrary(db)).packs
      .filter((pack) => settings.contentPacks[pack.id] !== false)
      .flatMap((pack) =>
        pack.occasions.filter((occasion) => !slurpPackTopicOff(pack.id, occasion.fit, settings.contentPacks ?? {})),
      );
    if (!slurpContentPacksOn(settings.contentPacks).length && !imported.length) return null;
    const account = await noodle.getNoodlerAccountById(input.accountId, { includeHidden: true });
    if (!account) return null;
    const [occurrences, subscriptions, fans] = await Promise.all([
      noodle.listStoryOccurrences().catch(() => []),
      noodle.listSubscriptionsForCreator(account.id).catch(() => []),
      createSlurpPopulationStorage(db)
        .countSubscribersForCreators([account.id])
        .catch(() => new Map<string, number>()),
    ]);
    const occasions = slurpPackOccasions({
      windows: slurpRunningPlatformEventWindows(
        slpLiveEvents(settings),
        input.at,
        { id: account.id, tags: account.settings.profile.tags ?? [] },
        // Started occasions make their own windows: Living world off, none runs.
        slpExtensionOn(settings, "world") ? occurrences : [],
      ),
      toggles: settings.contentPacks,
      imported,
      creatorAccountId: account.id,
      creatorText: input.creatorText,
      subscribers: subscriptions.length + (fans.get(account.id) ?? 0),
      at: input.at,
    });
    if (!occasions.length) return null;
    const [spice, couple, plans] = await Promise.all([
      resolveSlurpCreatorSpice(db, account),
      readSlurpCouplePartner(db, account.id).catch(() => ({ inCouple: false, partnerId: null })),
      listSlurpOpportunities(db, account.id, 40),
    ]);
    const nameOf = async (id: string | null | undefined) =>
      id
        ? ((await noodle.getNoodlerAccountById(id, { includeHidden: true }).catch(() => null))?.displayName ?? null)
        : null;
    return slurpOccasionBeat({
      creatorAccountId: account.id,
      sequence: input.sequence,
      at: input.at,
      creator: {
        text: input.creatorText,
        level: spice.level,
        hardNoes: spice.hardNoes,
        avoid: input.avoid,
        partner: couple.inCouple ? await nameOf(couple.partnerId) : null,
        collab: await nameOf(slurpCollabPartners(settings.creatorCollabs, account.id)[0]?.partnerId),
      },
      occasions,
      used: plans.flatMap((plan) => (plan.beat?.sharedId?.startsWith("occasion:") ? [plan.beat.sharedId] : [])),
      history: input.history,
      intents: input.intents,
      tastes: spice.spice.tastes,
    });
  } catch (error) {
    logger.warn(error, "[slurp] Could not read occasions; this post is planned without one");
    return null;
  }
}
