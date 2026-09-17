/**
 * Advance the world.
 *
 * One function, two callers: the background tick and the catch-up when the player opens Slurp.
 * The plan requires exactly that shape, and it mirrors `applyStipend`, which bills on read and
 * needs no timer to stay correct.
 *
 * Everything here is free-tier. The maintainer's rule is that unattended work never calls the
 * model, so briefs and questions come from the combinatorial bank in `slurp-world-copy.ts`.
 * Auto-posting is the one exception to that rule and it lives in its own scheduler.
 */
import {
  slurpCommissionQuote,
  slurpDynamicPriceTarget,
  slurpFanHaggle,
  slurpStepPrice,
} from "./slurp-creator-pricing.js";
import type { DB } from "../../db/connection.js";
import { and, eq } from "../../db/file-query.js";
import { slurpWorldClaims } from "../../db/schema/slurp.js";
import { logger } from "../../lib/logger.js";
import { newId } from "../../utils/id-generator.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { isSlurpFileUniqueConstraintError } from "../storage/slurp-file-errors.js";
import { createSlurpMessagesStorage } from "../storage/slurp-messages.storage.js";
import { createSlurpPopulationStorage } from "../storage/slurp-population.storage.js";
import { isAmbientNoodleAccount } from "./slurp-ambient-profiles.js";
import { tryNoodleOperation } from "./slurp-operation-lock.js";
import { readSlurpAudienceTone } from "./slurp-tone.js";
import { slurpCapTickEvents, slurpRhythmMultiplier } from "./slurp-tuning.js";
import { slurpCreatorReach } from "./slurp-reach.js";
import { selectSlurpAudienceCharacterIds, slurpAudienceCharacterFanTypeId } from "./slurp-audience-characters.js";
import { isSlurpPopulationMemberId, slurpMembersActiveAt } from "./slurp-population.js";
import {
  slurpFanTypeCommissionBudget,
  slurpFanTypeForPinnedOrSeed,
  slurpFanTypeSpendTier,
  slurpFanTypeWeeklyBudget,
  slurpPickFanType,
  slurpResolveFanType,
  type SlurpFanType,
} from "./slurp-fan-types.js";
import { isNotableAudienceArcChange, slurpNextAudienceArc } from "./slurp-audience-arc.js";
import {
  slurpAudiencePaidThrough,
  slurpAudienceSubscriptionDecision,
  slurpLapseReason,
} from "./slurp-audience-subscription.js";
import { slurpPlatformScaleMultiplier, slurpWorldActivityMultiplier } from "./slurp-scale.js";
import {
  slurpAudienceOpener,
  slurpAudienceQuestion,
  slurpAudienceReactionFrom,
  SLURP_SHIPPED_TYPE_REACTIONS,
  slurpCommissionBrief,
  slurpCreatorOpener,
  slurpCreatorReaction,
  slurpLapseNote,
} from "./slurp-world-copy.js";
import { slurpReactionBodiesForType, type SlurpReactionBanks } from "./slurp-reaction-bank.js";
import { enqueueSlurpPendingText } from "./slurp-pending-text.service.js";
import { generateSlurpArc } from "./slurp-arc-generation.service.js";
import {
  planSlurpWorldTick,
  slurpAudienceTipAmount,
  slurpCreatorOpenerKind,
  slurpQuestionPostIds,
  slurpCreatorReplyChance,
  SLURP_MAX_CREATOR_OPENERS_PER_TICK,
  SLURP_MAX_CREATOR_REPLIES_PER_TICK,
  type SlurpWorldAction,
  type SlurpWorldCreator,
} from "./slurp-world.js";
import { SLURP_POST_LANDED_REACTIONS } from "./slurp-creator-state.js";
import { planSlurpWorldPulse, slurpPulseTieAdvance, type SlurpPulseAction } from "./slurp-world-pulse.js";
import { noodlerUnlockPriceFromMetadata } from "./slurp-prices.js";

const TICK_KEY = "slurp2.world.tick";
const MAINTENANCE_KEY = "slurp2.world.maintenance";
const WORLD_CLAIM_ID = "world";
const WORLD_CLAIM_STALE_MS = 30 * 60_000;

/** The local day, so a per-pair roll is made once a day rather than on every page load. */
function localDayKey(at: Date): string {
  return `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;
}

/** A stable number in [0, 1) for one string. Same shape as the other Slurp rule modules use. */
function slurpDeterministicUnit(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  out ^= out >>> 16;
  out = Math.imul(out, 0x85ebca6b);
  out ^= out >>> 13;
  return (out >>> 0) / 0x100000000;
}

/**
 * The pulse keeps its own mark, and this is why.
 *
 * The tick advances on every notifications read, which the client polls every 30 seconds. So a
 * pulse saw `elapsedMinutes` of about 0.5, `slurpPulseBudget` floored that to zero at every
 * audience size, and `writeLastTick` then consumed the half-minute anyway. The layer whose whole
 * stated purpose is "likes must arrive while the player watches" produced nothing for as long as
 * the player was watching, and only fired if Slurp had been closed for five minutes or more.
 *
 * Holding a separate mark lets the unspent time accumulate until it is worth at least one
 * reaction, instead of being rounded away several thousand times a day.
 */
const PULSE_KEY = "slurp2.world.pulse";

/** Posts older than this are no longer worth asking about. */
const RECENT_POST_DAYS = 7;

/** Silence this long and somebody drifts out of the funnel. Churn is the cure for repetition. */
const CHURN_SILENT_DAYS = 45;
/** A few new visible people per day keep the named audience from becoming a fixed cast. */
const DAILY_NEWCOMERS = 3;

export type SlurpWorldResult = {
  status: "advanced" | "idle" | "busy";
  actions: number;
};

async function readLastTick(db: DB): Promise<Date | null> {
  const raw = await createAppSettingsStorage(db).get(TICK_KEY);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

async function writeLastTick(db: DB, at: Date): Promise<void> {
  await createAppSettingsStorage(db).set(TICK_KEY, at.toISOString());
}

async function readMaintenanceMark(db: DB): Promise<Date | null> {
  const raw = await createAppSettingsStorage(db).get(MAINTENANCE_KEY);
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

async function writeMaintenanceMark(db: DB, at: Date): Promise<void> {
  await createAppSettingsStorage(db).set(MAINTENANCE_KEY, at.toISOString());
}

async function readPulseMark(db: DB): Promise<Date | null> {
  const raw = await createAppSettingsStorage(db).get(PULSE_KEY);
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

/** Claim the world tick across processes until the current pass finishes. */
async function claimWorldTick(db: DB, at: Date): Promise<(() => Promise<void>) | null> {
  const token = newId();
  try {
    await db.transaction(async (tx) => {
      const rows = await tx.select().from(slurpWorldClaims).where(eq(slurpWorldClaims.id, WORLD_CLAIM_ID));
      const current = rows[0] as Record<string, unknown> | undefined;
      const claimedAt = current?.claimedAt ? Date.parse(String(current.claimedAt)) : Number.NaN;
      if (current && Number.isFinite(claimedAt) && at.getTime() - claimedAt < WORLD_CLAIM_STALE_MS) {
        throw new Error("slurp world tick is already claimed");
      }
      if (current) await tx.delete(slurpWorldClaims).where(eq(slurpWorldClaims.id, WORLD_CLAIM_ID));
      await tx.insert(slurpWorldClaims).values({ id: WORLD_CLAIM_ID, token, claimedAt: at.toISOString() });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "slurp world tick is already claimed") return null;
    if (isSlurpFileUniqueConstraintError(error, "slurp2_world_claims", ["id"])) return null;
    throw error;
  }
  return async () => {
    await db
      .delete(slurpWorldClaims)
      .where(and(eq(slurpWorldClaims.id, WORLD_CLAIM_ID), eq(slurpWorldClaims.token, token)));
  };
}

/**
 * Advance the world to `until`.
 *
 * The first call only records the mark and does nothing else: there is no stretch of time to
 * simulate yet, and inventing one would open a brand-new install onto a backlog it never earned.
 */
export async function advanceSlurpWorld(db: DB, until = new Date()): Promise<SlurpWorldResult> {
  // The in-process guard handles local overlap. The database lease below handles separate workers.
  const lease = await claimWorldTick(db, new Date());
  if (!lease) return { status: "busy", actions: 0 };
  try {
    const operation = await tryNoodleOperation("slurp-world-tick", async () => {
      const since = await readLastTick(db);
      if (!since) {
        await writeLastTick(db, until);
        return { status: "idle" as const, actions: 0 };
      }

      const settings = await createSlurpStorage(db).getSettings();
      const activity = slurpWorldActivityMultiplier(settings.worldActivity);
      const scale = slurpPlatformScaleMultiplier(settings.platformScale);
      const tuning = settings.simulationTuning;
      // Deep night is quiet and the evening is busy, everywhere at once. One multiplier on top of the
      // world-activity dial, so every rule that already takes `activity` gets a rhythm for nothing.
      const rhythm = slurpRhythmMultiplier(until, tuning.rhythm);
      // Every event this tick writes goes through one budget, arc events inside storage included.
      const noodle = slurpCapTickEvents(createSlurpStorage(db), tuning.clock.maxEventsPerTick);
      /** Churn is a full scan, so it only runs when enough time has passed for it to find anything. */
      const CHURN_MIN_ELAPSED_DAYS = tuning.funnel.churnDays;
      /** How many people the world keeps on hand to act. Small: actions per tick are capped anyway. */
      const WORLD_AUDIENCE_POOL = tuning.pulse.poolSize;
      if (activity === 0) {
        await writeLastTick(db, until);
        return { status: "idle" as const, actions: 0 };
      }
      const accounts = await noodle.listNoodlerAccounts();
      const automaticCreators = accounts.filter(
        (account) => !(account.kind === "persona" && account.sourceKind === "persona"),
      );
      const allAccounts = await noodle.listAccounts();

      // Provision character accounts invited to the audience, plus their current handle and avatar.
      // Without this, a character added since the last tick has no row and cannot hold threads or a
      // wallet, and a renamed character would keep the stale snapshot forever.
      await noodle.ensureAudienceCharacterAccounts().catch(() => undefined);
      const invitedCharacters = await noodle.listAudienceCharacterAccounts().catch(() => []);

      // The generated population, plus the ambient roster when it is switched on.
      //
      // The population is not gated by `allowRandomUsers`. That setting governs whether ambient
      // profiles join in as visible participants in the feed; it is not a switch for whether the
      // Creator has an audience at all. It defaults to false, so gating the whole tick on it meant a
      // fresh install never produced a single commission or question — the entire obligation layer
      // was dark by default.
      //
      // Both kinds can hold threads: ambient profiles are account rows, and population members key
      // their thread and wallet by id like any other viewer.
      const population = createSlurpPopulationStorage(db);
      const returning = await population.listAll(WORLD_AUDIENCE_POOL);
      // Top the pool up with fresh people when the world has not met many yet, so a new install has
      // somebody to act and an old one keeps gaining faces.
      const newcomers = await Promise.all(
        Array.from({ length: Math.max(0, WORLD_AUDIENCE_POOL - returning.length) }, () =>
          population.ensure(newId(), until, settings.fanTypes),
        ),
      );
      const dailyNewcomers = await Promise.all(
        Array.from({ length: DAILY_NEWCOMERS }, (_, index) =>
          population.ensure(`world:${localDayKey(until)}:${index}`, until, settings.fanTypes),
        ),
      );
      const ambientIds = allAccounts.filter((account) => isAmbientNoodleAccount(account)).map((account) => account.id);
      const ambient = settings.allowRandomUsers ? ambientIds : [];
      // Who is actually around at this hour. `activeHour` has been stored on every member since the
      // population shipped and read by nothing, so a night owl and an early riser were equally likely
      // to turn up at four in the morning.
      const pool = [
        ...new Map([...dailyNewcomers, ...returning, ...newcomers].map((member) => [member.id, member])).values(),
      ];
      const awake = slurpMembersActiveAt(pool, until.getUTCHours(), WORLD_AUDIENCE_POOL);
      // Every invited character's account id to the Fan Type the user pinned, whether or not they
      // act this tick. The funnel and the money read this: a character who subscribed on a day they
      // were drawn must still be billed and still be able to lapse on a day they are not, or a
      // subscription would run forever unpaid.
      const characterFanPinnedTypeIds = new Map(
        invitedCharacters.map(
          (entry) => [entry.account.id, slurpAudienceCharacterFanTypeId(settings, entry.characterId)] as const,
        ),
      );
      // Who acts. `audienceCharacterLimit` is a prompt-cost bound, so it decides who speaks this
      // tick, not who holds a relationship. Invited characters are people the user chose by hand,
      // so they are not thinned by the hourly rhythm — and `allowRandomUsers` does not hide them
      // either, since that switch governs the six shipped ambient profiles.
      const actingCharacterFanIds = selectSlurpAudienceCharacterIds(
        invitedCharacters.map((entry) => entry.characterId),
        settings.audienceCharacterLimit ?? 0,
        `world:${localDayKey(until)}`,
      ).flatMap((characterId) => {
        const account = invitedCharacters.find((entry) => entry.characterId === characterId)?.account;
        return account ? [account.id] : [];
      });
      const audience = [...awake.map((member) => member.id), ...ambient, ...actingCharacterFanIds];
      // What each actor's Fan Type makes them do. Ambient accounts have no row, so they read as the
      // fallback type rather than dropping out of the weighting entirely.
      const actorWeights = new Map(
        audience.map((id) => {
          const member = pool.find((entry) => entry.id === id);
          const type = member
            ? slurpResolveFanType(settings.fanTypes, member)
            : slurpFanTypeForPinnedOrSeed(settings.fanTypes, characterFanPinnedTypeIds.get(id) ?? null, id);
          const weeklyBudget = slurpFanTypeWeeklyBudget(type, id);
          return [
            id,
            {
              activity: type.behavior.activity,
              like: type.behavior.like,
              follow: type.behavior.follow,
              comment: type.behavior.comment,
              followChance: type.funnel.followChance,
              question: type.behavior.question,
              dm: type.behavior.dm,
              commission: type.behavior.commission,
              tip: type.behavior.tip,
              unlock: type.behavior.unlock,
              tipChance: type.spend.tipChance,
              weeklyBudget,
              tipAmount: slurpAudienceTipAmount(weeklyBudget, tuning.economy.audienceTipShare),
            },
          ] as const;
        }),
      );

      const messages = createSlurpMessagesStorage(db);
      const cutoff = new Date(until.getTime() - RECENT_POST_DAYS * 86_400_000).toISOString();
      const postsByAccount = await noodle.listNoodlerPostsByAccounts(
        accounts.map((account) => account.id),
        8,
      );
      // One read per Creator feeds churn, subscriptions, event eligibility and prompt memory. A
      // second scan of the same tie table would make the configurable clock pay for the same data
      // several times every minute.
      const tiesByCreator = new Map(
        await Promise.all(
          accounts.map(async (account) => [account.id, await population.listTiesForCreator(account.id)] as const),
        ),
      );

      // Churn. Somebody who has not been near a Creator in a long time drifts out of the funnel, so
      // the named cast rotates instead of freezing into the same thirty faces. Subscribers are left
      // alone: their tie ends when the subscription does, which has its own path and its own event.
      //
      // Skipped on short hops. The catch-up runs on every notifications read, and this is a full scan
      // of every tie of every Creator; nobody's 45-day silence changes between two page loads.
      const staleBefore = new Date(until.getTime() - CHURN_SILENT_DAYS * 86_400_000).toISOString();
      const maintenanceMark = await readMaintenanceMark(db);
      const maintenanceSince = maintenanceMark ?? since;
      const maintenanceDue = (until.getTime() - maintenanceSince.getTime()) / 86_400_000 >= CHURN_MIN_ELAPSED_DAYS;
      for (const account of maintenanceDue ? accounts : []) {
        for (const tie of tiesByCreator.get(account.id) ?? []) {
          if (tie.stage === "lapsed" || tie.stage === "stranger" || tie.stage === "subscriber") continue;
          if (tie.lastSeenAt >= staleBefore) continue;
          await population.lapseTie(tie.memberId, account.id).catch(() => undefined);
        }
      }

      // Character Creators price like a market: popularity lifts them, a thin paying audience pulls
      // them back, and no price moves more than the Settings cap in one week. Existing subscribers
      // keep the price they signed up at.
      if (maintenanceDue && settings.pricingDynamicCharacters) {
        const automated = accounts.filter((account) => account.sourceKind !== "persona");
        const ids = automated.map((account) => account.id);
        const [followers, subscribers] = await Promise.all([
          population.countFollowersForCreators(ids),
          population.countSubscribersForCreators(ids),
        ]);
        const prices = createSlurpStorage(db);
        for (const account of automated) {
          const pricing = await messages.getCreatorMessaging(account.id);
          if (pricing.pricedAt && until.getTime() - Date.parse(pricing.pricedAt) < 7 * 86_400_000) continue;
          const demand = { followers: followers.get(account.id) ?? 0, subscribers: subscribers.get(account.id) ?? 0 };
          const step = (current: number, base: number) =>
            slurpStepPrice(current, slurpDynamicPriceTarget(base, demand), settings.pricingMaxWeeklyChangePercent);
          await prices
            .setCreatorSubscriptionPrice(
              account.id,
              step(await prices.getCreatorSubscriptionPrice(account.id), settings.walletSubscriptionCost),
            )
            .catch(() => undefined);
          await messages
            .setCreatorMessaging(account.id, {
              unlockPrice: step(pricing.unlockPrice ?? settings.walletUnlockCost, settings.walletUnlockCost),
              commissionBase: step(pricing.commissionBase, tuning.economy.audienceCommissionPrice),
              pricedAt: until.toISOString(),
            })
            .catch(() => undefined);
        }
      }

      // Creator arcs. A chapter with a day range moves on once its time runs out, posted or not, so a
      // move does not stall forever on a Creator who stopped posting.
      for (const account of maintenanceDue ? accounts : []) {
        await noodle.tickProjects(account.id, until).catch(() => []);
        // After the tick, so an arc that just finished leaves room for the next one.
        // Generated arcs are the one model call here; a failed call starts nothing this tick.
        await noodle
          .rollAutoArc(account.id, until, (id, partnerIds) =>
            generateSlurpArc(db, id, partnerIds, "", { kind: "background" }),
          )
          .catch(() => null);
      }

      // Arcs. Where each relationship is heading, as opposed to where it stands. Runs on the same
      // cadence as churn because it reads the same silence, and because recomputing a three-week
      // trajectory on every page load would be a full scan for nothing.
      for (const account of maintenanceDue ? accounts : []) {
        for (const tie of tiesByCreator.get(account.id) ?? []) {
          if (tie.stage === "stranger") continue;
          const next = slurpNextAudienceArc({
            stage: tie.stage,
            interactions: tie.interactions,
            spent: tie.spent,
            daysSinceSeen: (until.getTime() - Date.parse(tie.lastSeenAt)) / 86_400_000 || 0,
            daysOnAudienceArc: tie.audienceArcSince
              ? (until.getTime() - Date.parse(tie.audienceArcSince)) / 86_400_000 || 0
              : 999,
            audienceArc: tie.audienceArc,
          });
          if (next === tie.audienceArc) continue;
          await population.setTieAudienceArc(tie.id, next).catch(() => undefined);
          // Only a change somebody would notice. Sliding back to steady is the absence of news.
          if (isNotableAudienceArcChange(tie.audienceArc, next)) {
            await noodle.recordCreatorEvent(account.id, next === "returning" ? "returned" : "audience_arc", {
              actorLabel: tie.memberId,
              subjectId: next,
            });
          }
        }
      }

      // The audience pays. A follower who can afford the price converts, a subscriber renews when
      // their week runs out, and somebody priced out lapses.
      //
      // Runs every tick, so a conversion or a lapse lands when it is due rather than on the churn
      // cadence. The roll is deterministic per `funnel.rollCadence` bucket and a payment sets
      // `paidThroughAt` a week ahead, so repeated ticks cannot bill the same person twice.
      //
      // ponytail: a full tie scan per tick with one member read per distinct member. Ties that cannot
      // decide anything (paid through the future, or unpaid and not a follower) skip the member read.
      // Add a batch member getter, or a due-date index on ties, if the audience grows past a few
      // thousand rows.
      //
      // Ambient accounts hold ties but no population row. They pay only with `funnel.ambientCanPay`,
      // on the spend tier their id would generate; otherwise they read as `none`, which never
      // subscribes and lets an already-paid one lapse.
      //
      // No wallet is touched. An audience member is not a viewer and holds no balance; the money is
      // credited to the Creator and that is the whole transaction, exactly as an audience commission
      // already settles. Only a first subscribe and a lapse are notified — a renewal every week from
      // every subscriber is the flood the readable-handful rule exists to prevent.
      const ambientSet = new Set(ambientIds);
      /**
       * The Fan Type that decides whether this member pays, or null for somebody who never can.
       *
       * Three kinds of audience member reach this, and they differ in where the type comes from:
       *
       * - A generated member has a population row, so the row's own type is authoritative.
       * - An invited character has no row, but the user chose it by hand. It pays on its pinned
       *   type, or one derived from its id, and `ambientCanPay` does not gate it. Reading null here
       *   was the bug that let an invited character follow a Creator but never subscribe.
       * - An ambient profile has no row either, and is gated: switched off it reads as somebody with
       *   no budget, which never subscribes and lets an already-paid one lapse.
       *
       * Anybody else — a stale tie whose member is gone — reads null and is skipped.
       */
      const payingFanTypeFor = async (memberId: string): Promise<SlurpFanType | null> => {
        // Only a generated member has a row, so anybody else skips the read rather than paying for
        // a query that can only return null.
        if (isSlurpPopulationMemberId(memberId)) {
          const member = await population.get(memberId).catch(() => null);
          if (member) return slurpResolveFanType(settings.fanTypes, member);
        }
        if (characterFanPinnedTypeIds.has(memberId)) {
          return slurpFanTypeForPinnedOrSeed(
            settings.fanTypes,
            characterFanPinnedTypeIds.get(memberId) ?? null,
            memberId,
          );
        }
        if (!ambientSet.has(memberId)) return null;
        return tuning.funnel.ambientCanPay ? slurpPickFanType(settings.fanTypes, memberId) : null;
      };
      /** Resolved once per distinct member per tick: the Fan Type is what decides money now. */
      const fanTypeFor = new Map<string, SlurpFanType | null>();
      for (const account of accounts) {
        const price = await noodle.getCreatorSubscriptionPrice(account.id).catch(() => 0);
        for (const tie of await population.listTiesForCreator(account.id)) {
          // Mirrors the `none` branches of `slurpAudienceSubscriptionDecision` that ignore spend tier.
          const paidThrough = tie.paidThroughAt ? Date.parse(tie.paidThroughAt) : Number.NaN;
          if (Number.isFinite(paidThrough) ? until.getTime() < paidThrough : tie.stage !== "follower") continue;
          if (!fanTypeFor.has(tie.memberId)) {
            fanTypeFor.set(tie.memberId, await payingFanTypeFor(tie.memberId));
          }
          const fanType = fanTypeFor.get(tie.memberId);
          if (!fanType) continue;
          const weeklyBudget = slurpFanTypeWeeklyBudget(fanType, tie.memberId);
          const decision = slurpAudienceSubscriptionDecision(
            {
              memberId: tie.memberId,
              creatorAccountId: account.id,
              stage: tie.stage,
              spendTier: slurpFanTypeSpendTier(weeklyBudget),
              weeklyBudget,
              subConversionPerDay: fanType.funnel.subConversionPerDay,
              price,
              paidThroughAt: tie.paidThroughAt,
              interactions: tie.interactions,
              followedAt: tie.followedAt,
              renewChance: fanType.funnel.renewChance,
            },
            until,
            tuning.funnel,
          );
          if (decision === "none") continue;
          if (decision === "lapse") {
            await population.lapseTie(tie.memberId, account.id).catch(() => undefined);
            // A loss with no reason on it is a number, not an event. The reason is known here, the
            // line is free, and the tone setting decides whether the crowd says it kindly.
            await noodle.recordCreatorEvent(account.id, "lapsed", {
              actorLabel: tie.memberId,
              note: slurpLapseNote(
                `${tie.memberId}:${account.id}:${until.toISOString().slice(0, 10)}`,
                slurpLapseReason({
                  weeklyBudget,
                  price,
                  daysSinceSeen: (until.getTime() - Date.parse(tie.lastSeenAt)) / 86_400_000,
                }),
                readSlurpAudienceTone(settings.audienceTone),
              ),
            });
            continue;
          }
          // A free subscription reserves nothing; the budget helper refuses zero and would stop the funnel.
          if (price > 0 && !(await population.reserveWeeklySpend(tie.memberId, account.id, price, weeklyBudget, until)))
            continue;
          await population
            .advanceTie(tie.memberId, account.id, { stage: "subscriber", spent: price, hasSubscription: true })
            .catch(() => undefined);
          await population.setTiePaidThrough(tie.id, slurpAudiencePaidThrough(until)).catch(() => undefined);
          await noodle.creditCreatorIncome(account.id, price, decision === "subscribe" ? "subscribe" : "renew");
          if (decision === "subscribe") {
            await noodle.recordCreatorEvent(account.id, "subscribed", { actorLabel: tie.memberId, amount: price });
          }
        }
      }
      // Also written when the mark is missing: without that, the fallback resolves to the previous
      // tick on every run, so a box that ticks more often than the interval never arms the clock.
      if (maintenanceDue || !maintenanceMark) await writeMaintenanceMark(db, until);

      // Automated Creators review briefs on the world tick. Do not quote during request creation: the
      // fan must see a real review step and the Creator must have time to decline or revise the quote.
      // The quote reads the brief: a quick sketch costs less than a detailed scene with two people.
      const automatedCreatorIds = new Set<string>();
      for (const commission of await messages.listAutomatedBriefCommissions()) {
        automatedCreatorIds.add(commission.creatorAccountId);
        const pricing = await messages.getCreatorMessaging(commission.creatorAccountId);
        await messages
          .quoteCommission(commission.id, slurpCommissionQuote(commission.brief, pricing))
          .catch(() => null);
      }
      // A persona Creator can let its own pricing answer the audience instead of quoting each brief.
      for (const commission of await messages.listAudienceBriefCommissions()) {
        const pricing = await messages.getCreatorMessaging(commission.creatorAccountId);
        if (!pricing.autoQuote) continue;
        await messages
          .quoteCommission(commission.id, slurpCommissionQuote(commission.brief, pricing))
          .catch(() => null);
      }
      for (const account of accounts) if (account.sourceKind !== "persona") automatedCreatorIds.add(account.id);

      // Settle quotes the audience is sitting on. The accept route wants the player's persona, and
      // generated fans are not one, so this path handles their decision without a wallet debit.
      //
      // Deterministic per commission, so the same quote does not flip its answer between two ticks,
      // and gated on a day's thinking time so a price is never answered the instant it is named.
      for (const commission of await messages.listQuotedCommissions()) {
        const quotedFor = (until.getTime() - Date.parse(commission.updatedAt)) / 86_400_000;
        if (!Number.isFinite(quotedFor) || quotedFor < 1) continue;
        const member = await population.get(commission.viewerAccountId).catch(() => null);
        if (!member) continue;
        // Cheap work is taken, expensive work is haggled away. The appetite is the Fan Type's
        // `spend.commissionBudget` now, so raising it is a setting rather than a patched constant.
        const budget = slurpFanTypeCommissionBudget(slurpResolveFanType(settings.fanTypes, member), member.id);
        // A pending offer waits for the Creator. A persona Creator answers it by hand.
        if (commission.counterPrice !== null) continue;
        const answer = slurpFanHaggle({ quote: commission.price, budget, round: commission.haggleRounds });
        if (answer.kind === "counter") {
          const countered = await messages.counterCommission(commission.id, answer.price).catch(() => null);
          if (countered && automatedCreatorIds.has(commission.creatorAccountId)) {
            const pricing = await messages.getCreatorMessaging(commission.creatorAccountId);
            await messages.answerCommissionCounter(commission.id, pricing.commissionMin).catch(() => null);
          }
          continue;
        }
        await messages
          .settleAudienceCommission(commission.id, answer.kind === "accept" ? "accept" : "decline")
          .catch(() => null);
      }

      // Counted after churn, so reach reflects the audience that is left rather than the one that
      // just drifted out.
      const tickFunnel = await population.countFollowersForCreators(accounts.map((account) => account.id));
      const creators: SlurpWorldCreator[] = await Promise.all(
        accounts.map(async (account) => ({
          id: account.id,
          // Arc stat effects on growth scale the reach the pulse hands out follows by, the one place
          // new followers come from. The follower count shown to the player is left alone.
          followers: Math.round(
            slurpCreatorReach(
              {
                accountId: account.id,
                createdAt: account.createdAt,
                // Request rates scale with audience, so the tick has to see the same follower count
                // the player does. Passing zero here made a large Creator as quiet as a new one.
                realFollowers: tickFunnel.get(account.id) ?? 0,
                scale,
              },
              until,
              tuning.reach,
            ) * (await noodle.arcEffectMultiplier(account.id, "growth")),
          ),
          recentPostIds: slurpQuestionPostIds(
            postsByAccount.get(account.id) ?? [],
            cutoff,
            tuning.world.questionNeedsRecentPost,
          ),
          lockedPosts: (postsByAccount.get(account.id) ?? [])
            .filter((post) => post.access === "locked")
            .map((post) => ({ id: post.id, price: noodlerUnlockPriceFromMetadata(post.metadata) })),
          // A queue nobody answered gets no more. Asking again while three requests sit unread is
          // how an obligation layer turns into a chore.
          // Unanswered conversations count with unanswered commissions. Both are somebody waiting on
          // the player, and three of either is already more than a session should open with.
          openRequests: await (async () => {
            const openCommissions = await messages.listOpenCommissionsForCreator(account.id);
            const commissionThreadIds = new Set(openCommissions.map((commission) => commission.threadId));
            const unreadThreads = (await messages.listThreadsForCreators([account.id])).filter(
              (thread) => thread.creatorUnread > 0 && !commissionThreadIds.has(thread.id),
            );
            return openCommissions.length + unreadThreads.length;
          })(),
        })),
      );

      // The pulse: likes and follows landing while the player watches. Driven by elapsed minutes
      // rather than days, so it fires during a session, where the day-scale plan below cannot.
      //
      // Measured from the pulse's own mark, not the tick's, so time too short to buy a whole
      // reaction is kept rather than discarded. See `PULSE_KEY`.
      const pulseSince = (await readPulseMark(db)) ?? since;
      const pulse = planSlurpWorldPulse(
        {
          elapsedMinutes: (until.getTime() - pulseSince.getTime()) / 60_000,
          audience,
          actorWeights,
          seed: `${pulseSince.toISOString()}:${until.toISOString()}`,
          activity: activity * rhythm,
          targets: creators.flatMap((creator) =>
            (postsByAccount.get(creator.id) ?? [])
              .filter((post) => post.access !== "draft")
              .map((post) => ({
                creatorAccountId: creator.id,
                postId: post.id,
                ageHours: (until.getTime() - Date.parse(post.createdAt)) / 3_600_000,
                creatorReach: creator.followers,
              })),
          ),
        },
        tuning.pulse,
      );
      let pulsed = 0;
      // A follow is the rare one that actually moves the funnel, so it is worth more than a like.
      const landedBy = new Map<string, number>();
      for (const action of pulse) {
        try {
          if (await applyPulse(db, action, settings.audienceReactionBank, settings.fanTypes)) {
            pulsed += 1;
            const weight = action.kind === "follow" ? 3 : 1;
            landedBy.set(action.creatorAccountId, (landedBy.get(action.creatorAccountId) ?? 0) + weight);
          }
        } catch (error) {
          logger.warn(error, "[slurp-world] Could not apply a %s pulse", action.kind);
        }
      }
      // The audience reacting is the only channel the world had into a Creator that she could
      // actually feel, and it went straight into the counters without touching her. This is not a
      // rolling average on purpose: the thing being modelled is noticing your notifications.
      const slurpForPulse = createSlurpStorage(db);
      for (const [creatorAccountId, weight] of landedBy) {
        if (weight < SLURP_POST_LANDED_REACTIONS) continue;
        try {
          await slurpForPulse.addCreatorModifier(creatorAccountId, "post_landed", `${weight} reactions`);
        } catch (error) {
          logger.warn(error, "[slurp-world] Could not record a landed post for %s", creatorAccountId);
        }
      }
      // Only spend the pulse clock when the pulse actually bought something. An empty plan leaves
      // the mark where it is so the time carries into the next tick instead of being rounded away.
      if (pulse.length > 0 || !(await readPulseMark(db))) {
        await createAppSettingsStorage(db).set(PULSE_KEY, until.toISOString());
      }

      // Creators answering their audience. Free tier, like the pulse: a three-word comment does not
      // need a model to answer it, and a creator who never answers anybody reads as a bot however
      // good the comments underneath are.
      //
      // Which comments get answered is decided by what the commenter is to this creator, so being a
      // particular fan changes something the player can see rather than only changing a prompt they
      // cannot. Nobody is at zero: a stranger's first comment sometimes getting a reply is the thing
      // that makes them comment again.
      let replied = 0;
      for (const account of automaticCreators) {
        if (replied >= SLURP_MAX_CREATOR_REPLIES_PER_TICK) break;
        const recent = (postsByAccount.get(account.id) ?? []).filter((post) => post.access !== "draft").slice(0, 4);
        if (recent.length === 0) continue;
        const interactions = await noodle.listNoodlerInteractions(recent.map((post) => post.id));
        const answered = new Set(
          interactions
            .filter((entry) => entry.actorAccountId === account.id && entry.parentInteractionId)
            .map((entry) => entry.parentInteractionId!),
        );
        const ties = new Map((await population.listTiesForCreator(account.id)).map((tie) => [tie.memberId, tie]));
        for (const comment of interactions) {
          if (replied >= SLURP_MAX_CREATOR_REPLIES_PER_TICK) break;
          if (comment.type !== "reply" || !comment.content?.trim()) continue;
          // Never answer yourself, and never answer the same comment twice.
          if (comment.actorAccountId === account.id || answered.has(comment.id)) continue;
          const tie = ties.get(comment.actorAccountId) ?? null;
          // Deterministic per comment, so a comment does not flip between answered and ignored
          // across two ticks of the same stretch of time.
          const roll = slurpDeterministicUnit(`${account.id}:${comment.id}`);
          if (roll >= slurpCreatorReplyChance(tie)) continue;
          const written = await noodle
            .createInteraction(comment.postId, {
              actorAccountId: account.id,
              type: "reply",
              content: slurpCreatorReaction(`${account.id}:${comment.id}`),
              parentInteractionId: comment.id,
            })
            .catch(() => null);
          if (written) {
            answered.add(comment.id);
            replied += 1;
          }
        }
      }

      // Creators writing first. The rapport model has measured silence since it shipped and nothing
      // ever read the number: somebody who used to be here every day going quiet is the most legible
      // thing in the whole relationship model, and it moved a counter nobody saw.
      //
      // Tier 1, so it stays free and safe to run unattended. Only the opener is canned — the moment
      // the fan answers, the reply runs through the full direct-message path with rapport, arc, and
      // the creator's recent posts. A cheap invitation to a real conversation.
      let opened = 0;
      for (const account of automaticCreators) {
        if (opened >= SLURP_MAX_CREATOR_OPENERS_PER_TICK) break;
        const messaging = await messages.getCreatorMessaging(account.id);
        if (!messaging.proactiveMessages) continue;
        for (const tie of await population.listTiesForCreator(account.id)) {
          if (opened >= SLURP_MAX_CREATOR_OPENERS_PER_TICK) break;
          const daysSinceSeen = (until.getTime() - Date.parse(tie.lastSeenAt)) / 86_400_000;
          if (!Number.isFinite(daysSinceSeen)) continue;
          const existingThread = await messages.getThread(tie.memberId, account.id);
          const kind = slurpCreatorOpenerKind({
            tie,
            daysSinceSeen,
            hasThread: Boolean(existingThread),
            // Bucketed by day, so the same pair is not re-rolled on every page load — otherwise a
            // 1.5% chance fires within an hour of scrolling.
            roll: slurpDeterministicUnit(`${account.id}:${tie.memberId}:${localDayKey(until)}`),
            mood: existingThread?.mood,
          });
          if (!kind) continue;
          const sent = await messages
            .sendCreatorMessage(account.id, tie.memberId, {
              content: slurpCreatorOpener(`${account.id}:${tie.memberId}:${localDayKey(until)}`, kind),
            })
            .catch(() => null);
          if (sent) opened += 1;
        }
      }

      const plan = planSlurpWorldTick(
        {
          since,
          until,
          creators,
          audience,
          actorWeights,
          stageOf: (creatorAccountId, actorAccountId) =>
            tiesByCreator.get(creatorAccountId)?.find((tie) => tie.memberId === actorAccountId)?.stage,
          activity: activity * rhythm,
          catchUpHours: tuning.clock.catchUpHours,
        },
        tuning.world,
      );
      let applied = 0;
      for (const action of plan) {
        try {
          if (await applyAction(db, action, until, noodle, settings.fanTypes)) applied += 1;
        } catch (error) {
          // One failed action must not abandon the rest of the tick, and must never stop the mark
          // being written — otherwise the same stretch of time is replayed on every call.
          logger.warn(error, "[slurp-world] Could not apply a %s action", action.kind);
        }
      }
      await writeLastTick(db, until);
      return {
        status: applied + pulsed > 0 ? ("advanced" as const) : ("idle" as const),
        actions: applied + pulsed,
      };
    });
    return operation.acquired ? operation.value : { status: "busy", actions: 0 };
  } finally {
    await lease();
  }
}

/**
 * Who is acting.
 *
 * An actor is either an ambient profile, which has a real Slurp account row, or a generated
 * population member, which has no account row at all. Both must work: resolving accounts only
 * silently dropped every population action and left the world back at six faces.
 */
async function resolveActor(
  db: DB,
  actorAccountId: string,
): Promise<{
  id: string;
  entityId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  fanTypeId?: string | null;
  archetype?: string;
} | null> {
  const account = await createSlurpStorage(db).getNoodlerAccountById(actorAccountId);
  if (account) {
    return {
      id: account.id,
      entityId: account.entityId,
      handle: account.handle,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
    };
  }
  const member = await createSlurpPopulationStorage(db).get(actorAccountId);
  if (!member) return null;
  return {
    id: member.id,
    entityId: member.id,
    handle: member.handle,
    displayName: member.displayName,
    avatarUrl: null,
    fanTypeId: member.fanTypeId,
    archetype: member.archetype,
  };
}

async function applyAction(
  db: DB,
  action: SlurpWorldAction,
  at: Date,
  noodle: ReturnType<typeof createSlurpStorage>,
  fanTypes: readonly SlurpFanType[],
): Promise<boolean> {
  const actor = await resolveActor(db, action.actorAccountId);
  if (!actor) return false;

  if (action.kind === "tip") {
    const operationId = `audience-tip:${action.creatorAccountId}:${actor.id}:${localDayKey(at)}`;
    if (await noodle.hasCreatorIncomeOperation(action.creatorAccountId, operationId)) return false;
    const fanType =
      actor.fanTypeId || actor.archetype ? slurpResolveFanType(fanTypes, actor) : slurpPickFanType(fanTypes, actor.id);
    if (
      !(await createSlurpPopulationStorage(db).reserveWeeklySpend(
        actor.id,
        action.creatorAccountId,
        action.amount,
        slurpFanTypeWeeklyBudget(fanType, actor.id),
        at,
      ))
    )
      return false;
    await noodle.creditCreatorIncome(action.creatorAccountId, action.amount, "tip", operationId);
    await createSlurpPopulationStorage(db)
      .advanceTie(actor.id, action.creatorAccountId, {
        stage: "follower",
        spent: action.amount,
        tipped: action.amount,
        interactions: 1,
      })
      .catch(() => undefined);
    await noodle.notifyCreatorIncome(action.creatorAccountId, "tip", action.amount, actor.id);
    return true;
  }

  if (action.kind === "unlock") {
    const population = createSlurpPopulationStorage(db);
    if ((await noodle.listPostUnlocksForViewer(actor.id)).some((unlock) => unlock.postId === action.postId))
      return false;
    const fanType =
      actor.fanTypeId || actor.archetype ? slurpResolveFanType(fanTypes, actor) : slurpPickFanType(fanTypes, actor.id);
    if (
      !(await population.reserveWeeklySpend(
        actor.id,
        action.creatorAccountId,
        action.amount,
        slurpFanTypeWeeklyBudget(fanType, actor.id),
        at,
      ))
    )
      return false;
    const created = await noodle.recordAudiencePostUnlock(actor.id, action.creatorAccountId, action.postId);
    if (!created) {
      // A stale or duplicate unlock must hand its reservation back, or it blocks the week's budget.
      await population.releaseWeeklySpend(actor.id, action.creatorAccountId, action.amount, at).catch(() => undefined);
      return false;
    }
    const operationId = `audience-unlock:${action.postId}:${actor.id}`;
    await noodle.creditCreatorIncome(action.creatorAccountId, action.amount, "unlock", operationId);
    await population
      .advanceTie(actor.id, action.creatorAccountId, {
        stage: "liker",
        spent: action.amount,
        unlocked: action.amount,
        interactions: 1,
      })
      .catch(() => undefined);
    await noodle.notifyCreatorIncome(action.creatorAccountId, "unlock", action.amount, actor.id, action.postId);
    return true;
  }

  if (action.kind === "message") {
    const messages = createSlurpMessagesStorage(db);
    const sent = await messages.sendViewerMessage(
      action.actorAccountId,
      action.creatorAccountId,
      slurpAudienceOpener(`${action.creatorAccountId}:${action.actorAccountId}:${at.toISOString()}`),
    );
    if (sent.status !== "sent") return false;
    await enqueueSlurpPendingText(db, {
      kind: "opener",
      subjectId: sent.message.id,
      creatorAccountId: action.creatorAccountId,
      actorLabel: actor.id,
    });
    const population = createSlurpPopulationStorage(db);
    await population
      .advanceTie(actor.id, action.creatorAccountId, { stage: "viewer", interactions: 1 })
      .catch(() => undefined);
    await population.touch(actor.id).catch(() => undefined);
    return true;
  }

  if (action.kind === "commission") {
    const messages = createSlurpMessagesStorage(db);
    const brief = slurpCommissionBrief(`${action.creatorAccountId}:${action.actorAccountId}:${at.toISOString()}`);
    const commission = await messages.createCommission(action.actorAccountId, action.creatorAccountId, brief);
    // `"open_request"` means this fan already has one waiting. Piling on a second is exactly what
    // the cap exists to stop, so the tick spends its action elsewhere.
    if (!commission || commission === "open_request") return false;
    // The brief is a placeholder. Queue it to be written properly the next time the player is here.
    await enqueueSlurpPendingText(db, {
      kind: "commission",
      subjectId: commission.id,
      creatorAccountId: action.creatorAccountId,
      actorLabel: actor.id,
    });
    const population = createSlurpPopulationStorage(db);
    await population
      .advanceTie(actor.id, action.creatorAccountId, { stage: "viewer", interactions: 1 })
      .catch(() => undefined);
    await population.touch(actor.id).catch(() => undefined);
    return true;
  }

  const result = await noodle.createNoodlerWorldInteraction(action.postId, {
    creatorAccountId: action.creatorAccountId,
    actorId: actor.id,
    type: "reply",
    content: slurpAudienceQuestion(`${action.postId}:${action.actorAccountId}`),
  });
  if (!result?.created) return false;
  await enqueueSlurpPendingText(db, {
    kind: "question",
    subjectId: result.interaction.id,
    creatorAccountId: action.creatorAccountId,
    postId: action.postId,
    actorLabel: actor.id,
  });
  // Commenting is a step up the funnel, and the funnel is what a follower count is counted from.
  const population = createSlurpPopulationStorage(db);
  await population
    .advanceTie(actor.id, action.creatorAccountId, { stage: "liker", interactions: 1 })
    .catch(() => undefined);
  // Mark them as recently active, or `listAll` keeps ordering by creation time and the same people
  // are drawn forever while everyone who actually shows up sinks out of the pool.
  await population.touch(actor.id).catch(() => undefined);
  // A question is an obligation, so it is reported. An ordinary comment is not.
  await noodle.recordCreatorEvent(action.creatorAccountId, "comment", {
    subjectId: action.postId,
    actorLabel: actor.id,
  });
  return true;
}

/**
 * Apply one pulse reaction.
 *
 * Free tier: no model call, ever. All three kinds write a real interaction row, so they show as
 * named people, feed the funnel, and cost nothing. A "follow" differs only in how far it moves the
 * tie. A follow still counts when its like row already exists, so an earlier like never blocks it.
 *
 * A "comment" carries Tier 1 copy. Most comments on a real post are three words from somebody who
 * wanted to be seen typing them, and paying a model to write those is backwards: they are the
 * highest-volume text on the platform and the least worth reading. The batched run keeps the
 * model, and keeps it for comments that have actually seen the post.
 */
async function applyPulse(
  db: DB,
  action: SlurpPulseAction,
  banks: SlurpReactionBanks,
  fanTypes: readonly SlurpFanType[],
): Promise<boolean> {
  const noodle = createSlurpStorage(db);
  const actor = await resolveActor(db, action.actorAccountId);
  if (!actor) return false;
  const isComment = action.kind === "comment";
  // Whose words these are. A comment is the only place the audience is heard, so it draws from the
  // actor's own Fan Type bank before the shared one.
  // An ambient account has no population row, so it is drawn onto a type by id, as the money pass
  // already does, rather than all sounding like the fallback type.
  const fanTypeId = !isComment
    ? null
    : actor.fanTypeId || actor.archetype
      ? slurpResolveFanType(fanTypes, actor).id
      : slurpPickFanType(fanTypes, actor.id).id;
  const result = await noodle.createNoodlerWorldInteraction(action.postId, {
    creatorAccountId: action.creatorAccountId,
    actorId: actor.id,
    type: isComment ? "reply" : "like",
    // Tier 1 copy, so this stays free: the pulse runs unattended and must never call the model.
    content: isComment
      ? slurpAudienceReactionFrom(
          `${action.postId}:${actor.id}`,
          slurpReactionBodiesForType(banks, fanTypeId, SLURP_SHIPPED_TYPE_REACTIONS[fanTypeId ?? ""] ?? []),
        )
      : null,
  });
  if (!result) return false;
  const advance = slurpPulseTieAdvance(action.kind, result.created);
  if (!advance) return false;
  const population = createSlurpPopulationStorage(db);
  // A follow whose like row already existed counts only when it actually moves the tie.
  const before = result.created
    ? null
    : await population.ensureTie(actor.id, action.creatorAccountId).catch(() => null);
  const after = await population.advanceTie(actor.id, action.creatorAccountId, advance).catch(() => null);
  if (!result.created && (!before || !after || after.stage === before.stage)) return false;
  await population.touch(actor.id).catch(() => undefined);
  return true;
}
