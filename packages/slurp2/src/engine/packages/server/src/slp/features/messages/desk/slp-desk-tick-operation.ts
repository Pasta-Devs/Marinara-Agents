/**
 * The Support desk's part of the world clock (docs/SUPPORT-DESK.md). For every Creator: suspicion
 * fades, the risk of being caught is rolled, challenges and the contract are counted, the leave
 * countdown runs, and a Creator may write in with a ticket. Slurp's notices go out (milestones,
 * results), and AI Support writes to the Creators the player runs.
 *
 * Free tier: nothing here calls the model. A Creator's line starts as a template and is rewritten in
 * their voice when the player is here (`slp-pending-text-service.ts`, kind "desk").
 */
import type { DB } from "../../../../db/connection.js";
import { logger } from "../../../../lib/logger.js";
import { newId } from "../../../../utils/id-generator.js";
import { createSlurpMessagesStorage, createSlurpStorage } from "../../../data/slp-storage.js";
import { createSlurpPopulationStorage } from "../../../data/audience/slp-audience-storage-funnel.js";
import { readSlurpSupportDesk, updateSlurpSupportDesk } from "../../../data/creators/slp-support-desk-storage.js";
import { countSlurpDeskPublished } from "../../../data/creators/slp-support-desk-counts.js";
import { appendSlurpDeskLine } from "../../../data/messages/slp-support-desk-thread.js";
import { enqueueSlurpPendingText } from "../../world/slp-world-contract.js";
import { slurpDeskSituation } from "../../../modules/messages/slp-desk-situation.js";
import { readSlurpCreatorTiesDocument } from "../../../data/projects/slp-creator-ties-storage.js";
import { readSlurpDeskOffer, slurpDeskOfferSummary } from "../../../modules/messages/slp-support-desk-talk.js";
import { SLURP_SUPPORT_ACCOUNT_ID } from "../../../../../../shared/src/slp/slp-support.js";
import { slurpCreatorReach } from "../../../../../../shared/src/slp/slp-reach.js";
import { slurpRunsItself } from "../../projects/slp-projects-contract.js";
import { slurpPlatformScaleMultiplier } from "../../../../../../shared/src/slp/slp-scale.js";
import { slpExtensionOn } from "../../../../../../shared/src/slp/slp-extensions.js";
import { isSlurpViewerActorAccount } from "../../../modules/settings/slp-settings.js";
import {
  SLP_DESK_STAY_AT,
  slpDeskAdjust,
  slpDeskAttitudeFor,
  slpDeskGrantPerk,
  slpDeskPerkLine,
  slpDeskSeed,
  slpDeskTick,
  type SlpDeskTickEvent,
  type SlpDeskTicketTopic,
  type SlpSupportDesk,
} from "../../../../../../shared/src/slp/slp-support-desk.js";

const DAY_MS = 86_400_000;
const MILESTONES = [100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000];

/** What a Creator writes in about, before it is rewritten in their voice. */
const TICKET_LINES: Record<SlpDeskTicketTopic, { topic: string; line: string }> = {
  views: { topic: "Views dropped", line: "Hi Slurp Support. My views dropped a lot lately. Did something change?" },
  fan: {
    topic: "A fan is too much",
    line: "Hi Slurp Support. There is a fan who is getting to be a lot. What can I do?",
  },
  badge: { topic: "Wants a badge", line: "Hi Slurp Support. How do I get verified on Slurp?" },
  collab: { topic: "Wants a collab", line: "Hi Slurp Support. Can Slurp help me find someone to collab with?" },
  money: { topic: "Earnings", line: "Hi Slurp Support. My earnings are lower than I expected. Can you look at it?" },
  burnout: { topic: "Tired", line: "Hi Slurp Support. Honestly, I am tired. Is there any way to take it easier?" },
};

async function creatorLine(db: DB, creatorAccountId: string, content: string, metadata: Record<string, unknown>) {
  const id = `desk:${newId()}`;
  const line = await appendSlurpDeskLine(db, creatorAccountId, { as: "creator", id, content, metadata });
  if (line) await enqueueSlurpPendingText(db, { kind: "desk", subjectId: line.id, creatorAccountId });
  return line;
}

const notice = (db: DB, creatorAccountId: string, content: string, metadata: Record<string, unknown> = {}) =>
  appendSlurpDeskLine(db, creatorAccountId, { as: "notice", content, metadata });

/** A side effect of the desk pass, run only after the desk record is written (never twice). */
type Later = (effect: () => Promise<unknown>) => void;

/** Carry out what one tick decided for one Creator. Lines, coins and switches go to `later`. */
async function applyEvents(
  later: Later,
  db: DB,
  creator: { id: string; displayName: string; kind: string; sourceKind?: string | null },
  events: SlpDeskTickEvent[],
  desk: SlpSupportDesk,
  settings: Awaited<ReturnType<ReturnType<typeof createSlurpStorage>["getSettings"]>>["supportDesk"],
  at: Date,
): Promise<SlpSupportDesk> {
  const storage = createSlurpStorage(db);
  let next = desk;
  const name = creator.displayName;
  // A page the player runs pays out into their own wallet: a coin reward or bonus set before 0.3.7
  // (the desk refuses new ones) stops paying there.
  const paysCoins = slurpRunsItself(creator);
  for (const event of events) {
    switch (event.kind) {
      case "caught": {
        next = {
          ...next,
          ticket: {
            id: newId(),
            kind: "caught",
            topic: "Caught Slurp playing them",
            status: "open",
            openedBy: "creator",
            openedAt: at.toISOString(),
            resolvedAt: null,
            rating: null,
          },
        };
        later(() =>
          creatorLine(db, creator.id, "Slurp Support, I know what you did. That was not okay.", {
            deskTicket: "caught",
          }),
        );
        break;
      }
      case "leave-warning": {
        next = {
          ...next,
          ticket: {
            id: newId(),
            kind: "leaving",
            topic: "Thinking about leaving Slurp",
            status: "open",
            openedBy: "creator",
            openedAt: at.toISOString(),
            resolvedAt: null,
            rating: null,
          },
        };
        later(() =>
          creatorLine(db, creator.id, "I am thinking about leaving Slurp. Give me one reason to stay.", {
            deskTicket: "leaving",
          }),
        );
        break;
      }
      case "won-back":
        later(() => notice(db, creator.id, `Slurp: ${name} decided to stay on Slurp.`));
        break;
      case "left": {
        const account = await storage.getNoodlerAccountById(creator.id);
        const wasPosting = account?.settings.scheduler.autoPosting?.enabled === true;
        if (wasPosting) later(() => storage.bulkUpdateCreatorProfiles([creator.id], { autoPosting: false }));
        next = { ...next, pausedAutoPosting: wasPosting };
        later(() => notice(db, creator.id, `Slurp: ${name} left Slurp.`, { deskLeft: true }));
        break;
      }
      case "challenge-won": {
        next = slpDeskGrantPerk(next, event.challenge.reward, settings, at);
        if (event.challenge.reward.kind === "coins" && paysCoins)
          later(() =>
            storage.creditSponsorFee(
              creator.id,
              event.challenge.reward.coins ?? 0,
              "Slurp challenge",
              `desk:challenge:${event.challenge.id}`,
            ),
          );
        if (settings.noticeResults)
          later(() =>
            notice(
              db,
              creator.id,
              event.challenge.reward.kind === "coins" && !paysCoins
                ? `Slurp: ${name} won the challenge. No coin reward: Slurp does not pay coins to a page you run.`
                : `Slurp: ${name} won the challenge. ${slpDeskPerkLine(event.challenge.reward).replace(/^Got/u, "Reward:")}.`,
            ),
          );
        break;
      }
      case "challenge-failed":
        next = slpDeskAdjust(next, { trust: -2, text: "Failed a Slurp challenge" }, settings, at);
        if (settings.noticeResults)
          later(() => notice(db, creator.id, `Slurp: ${name} did not finish the challenge in time.`));
        break;
      case "contract-kept":
        if (event.contract.weeklyBonus > 0 && paysCoins)
          later(() =>
            storage.creditSponsorFee(
              creator.id,
              event.contract.weeklyBonus,
              "Slurp contract",
              `desk:contract:${event.contract.id}:${event.contract.weekStart}`,
            ),
          );
        if (settings.noticeResults)
          later(() =>
            notice(
              db,
              creator.id,
              paysCoins || event.contract.weeklyBonus <= 0
                ? `Slurp: ${name} kept the contract this week (${event.contract.weeklyBonus} coins).`
                : `Slurp: ${name} kept the contract this week. No bonus: Slurp does not pay coins to a page you run.`,
            ),
          );
        break;
      case "contract-broken":
        if (settings.noticeResults)
          later(() => notice(db, creator.id, `Slurp: ${name} missed the contract this week. No bonus.`));
        break;
      case "contract-ended":
        if (settings.noticeResults) later(() => notice(db, creator.id, `Slurp: ${name}'s contract has ended.`));
        break;
      case "ticket": {
        const { topic, line } = TICKET_LINES[event.topic];
        next = {
          ...next,
          ticket: {
            id: newId(),
            kind: "help",
            topic,
            status: "open",
            openedBy: "creator",
            openedAt: at.toISOString(),
            resolvedAt: null,
            rating: null,
          },
        };
        later(() => creatorLine(db, creator.id, line, { deskTicket: event.topic }));
        break;
      }
    }
  }
  return next;
}

/** The one-time mark that milestones count shown followers (0.3.7). */
const MILESTONE_SHOWN = "milestone:shown";

/** The newest 40 notices. The one-time mark stays however many come after it, so the silent pass never repeats. */
function noticedWith(noticed: readonly string[], ...keys: string[]): string[] {
  const all = [...noticed, ...keys];
  const pinned = all.includes(MILESTONE_SHOWN);
  const rest = all.filter((key) => key !== MILESTONE_SHOWN).slice(pinned ? -39 : -40);
  return pinned ? [MILESTONE_SHOWN, ...rest] : rest;
}

/** Slurp's milestone notice, once per step. */
async function milestoneNotice(
  later: Later,
  db: DB,
  creator: { id: string; displayName: string },
  desk: SlpSupportDesk,
  followers: number,
) {
  const reached = MILESTONES.filter((step) => followers >= step).at(-1);
  // 0.3.7 counts shown followers, which are far above the real ones: the first pass records where a
  // Creator already is without a notice, so the update does not send one for every Creator at once.
  if (!desk.noticed.includes(MILESTONE_SHOWN))
    return {
      ...desk,
      noticed: noticedWith(desk.noticed, MILESTONE_SHOWN, ...(reached ? [`milestone:${reached}`] : [])),
    };
  if (!reached || desk.noticed.includes(`milestone:${reached}`)) return desk;
  later(() =>
    notice(db, creator.id, `Slurp: ${creator.displayName} reached ${reached.toLocaleString("en")} followers.`, {
      deskMilestone: reached,
    }),
  );
  return { ...desk, noticed: noticedWith(desk.noticed, `milestone:${reached}`) };
}

/**
 * Slurp's trending notice: a post from the last day with at least twice the likes of their usual post
 * (and ten or more). Once per post.
 */
async function trendingNotice(
  later: Later,
  db: DB,
  creator: { id: string; displayName: string },
  desk: SlpSupportDesk,
  at: Date,
) {
  const posts = (await createSlurpStorage(db).listNoodlerPostsByAccount(creator.id, 8)).filter(
    (post) => post.access !== "draft",
  );
  const recent = posts.filter((post) => at.getTime() - Date.parse(post.createdAt) < DAY_MS);
  const usual = posts.filter((post) => !recent.includes(post));
  if (!recent.length || usual.length < 3) return desk;
  const average = usual.reduce((sum, post) => sum + (post.likeCount ?? 0), 0) / usual.length;
  const best = [...recent].sort((left, right) => (right.likeCount ?? 0) - (left.likeCount ?? 0))[0]!;
  const key = `trending:${best.id}`;
  if ((best.likeCount ?? 0) < Math.max(10, average * 2) || desk.noticed.includes(key)) return desk;
  const title = (best.title || best.content || "").replace(/\s+/gu, " ").slice(0, 60);
  later(() =>
    notice(db, creator.id, `Slurp: ${creator.displayName}'s post "${title}" is trending.`, {
      deskTrending: best.id,
    }),
  );
  return { ...desk, noticed: noticedWith(desk.noticed, key) };
}

/**
 * AI Support writes to a Creator the player runs: now and then an offer (a challenge with a reward),
 * which the player answers as that Creator. With "games" on, now and then a quiet throttle.
 */
async function supportToYourCreator(
  later: Later,
  db: DB,
  creator: { id: string; displayName: string },
  desk: SlpSupportDesk,
  settings: Awaited<ReturnType<ReturnType<typeof createSlurpStorage>["getSettings"]>>["supportDesk"],
  elapsedMs: number,
  at: Date,
): Promise<SlpSupportDesk> {
  const chance = (perDay: number) => Math.random() < 1 - Math.pow(1 - perDay, elapsedMs / DAY_MS);
  let next = desk;
  // One Offer at a time: an unanswered one waits for the player before Slurp sends another.
  const thread = await createSlurpMessagesStorage(db).getThread(SLURP_SUPPORT_ACCOUNT_ID, creator.id);
  const waiting = thread
    ? (await createSlurpMessagesStorage(db).listMessages(thread.id, 30)).some(
        (line: { role: string; metadata?: Record<string, unknown> | null }) =>
          line.role === "viewer" && readSlurpDeskOffer(line.metadata)?.status === "pending",
      )
    : false;
  if (!waiting && chance(0.25) && !next.challenges.some((entry) => entry.status === "active")) {
    const input = {
      accountId: creator.id,
      metric: "stories" as const,
      count: 3,
      days: 7,
      reward: { perk: "feature" as const, days: 2 },
    };
    later(() =>
      appendSlurpDeskLine(db, creator.id, {
        as: "support",
        content: `Hi ${creator.displayName}! Slurp Support here. Post 3 Stories this week and we will feature you on Discover for 2 days. Deal?`,
        metadata: {
          deskOffer: {
            action: "set-challenge",
            input,
            summary: slurpDeskOfferSummary("set-challenge", input),
            status: "pending",
          },
        },
      }),
    );
  }
  if (settings.gamesWithYourCreators && settings.shadyMoves && chance(0.08) && !next.throttle) {
    next = { ...next, throttle: { until: new Date(at.getTime() + 2 * DAY_MS).toISOString(), factor: 0.6 } };
  }
  return next;
}

// ponytail: one pass per 30 minutes in-process; a stored "last desk pass" if several processes share a DB.
let lastPassMs = 0;
const PASS_MS = 30 * 60_000;

/**
 * One pass of the desk for every Creator, at most every half hour (the risk and the ticket chance
 * scale with the time since a Creator's last pass, so the pace does not change the odds). Each
 * Creator's pass runs inside that desk's own update, so a play at the same moment waits its turn.
 */
export async function advanceSlurpSupportDesk(db: DB, at = new Date()): Promise<void> {
  if (at.getTime() - lastPassMs < PASS_MS) return;
  lastPassMs = at.getTime();
  const storage = createSlurpStorage(db);
  const allSettings = await storage.getSettings();
  // Support desk off: no tickets, no risk, no milestones. Case files keep their state for later.
  // ponytail: tickedAt stands still while off, so the first pass back rolls up to a week's odds at once;
  // move tickedAt on switch-on if that burst shows.
  if (!slpExtensionOn(allSettings, "supportDesk")) {
    // Only the desk keeps a Creator who left away: with it off, they are back and post again.
    for (const account of await storage.listNoodlerAccounts()) {
      if (!(await readSlurpSupportDesk(db, account.id)).pausedAt) continue;
      let resume = false;
      await updateSlurpSupportDesk(db, account.id, (desk) => {
        resume = desk.pausedAutoPosting;
        return { ...desk, pausedAt: null, pausedAutoPosting: false };
      });
      if (resume) await storage.bulkUpdateCreatorProfiles([account.id], { autoPosting: true });
    }
    return;
  }
  const settings = allSettings.supportDesk;
  // Milestones count the followers the profile shows (reach plus real followers), not the real ones alone.
  const reachScale = slurpPlatformScaleMultiplier(allSettings.platformScale);
  const accounts = (await storage.listNoodlerAccounts()).filter((account) => !isSlurpViewerActorAccount(account));
  const followers = await createSlurpPopulationStorage(db)
    .countFollowersForCreators(accounts.map((account) => account.id))
    .catch(() => new Map<string, number>());
  const collabs = (await readSlurpCreatorTiesDocument(db).catch(() => null))?.ties.collabs ?? [];
  for (const account of accounts) {
    // Lines, coins and switches wait until the desk is written: a pass that fails writes nothing twice.
    const effects: (() => Promise<unknown>)[] = [];
    const later: Later = (effect) => void effects.push(effect);
    const written = await updateSlurpSupportDesk(db, account.id, async (before) => {
      const yours = account.sourceKind === "persona";
      const elapsed = before.tickedAt
        ? Math.max(0, Math.min(7 * DAY_MS, at.getTime() - Date.parse(before.tickedAt)))
        : 0;
      let desk = before.seededAt ? before : slpDeskSeed(before, { signedUpBySupport: false, at });
      if (!desk.attitude)
        desk = { ...desk, attitude: slpDeskAttitudeFor(`${account.displayName} ${account.bio ?? ""}`, account.id) };
      // Won back after leaving: a perk (or a talk) lifted trust again.
      if (desk.pausedAt && desk.trust > SLP_DESK_STAY_AT) {
        if (desk.pausedAutoPosting) later(() => storage.bulkUpdateCreatorProfiles([account.id], { autoPosting: true }));
        desk = { ...desk, pausedAt: null, pausedAutoPosting: false };
        later(() => notice(db, account.id, `Slurp: ${account.displayName} is back on Slurp.`));
      }
      const needsCounts =
        desk.challenges.some((entry) => entry.status === "active") || desk.contract?.status === "active";
      // Only a Creator who may write in, with no ticket open, needs their week read.
      const situation =
        !yours && settings.tickets !== "off" && !desk.pausedAt && (!desk.ticket || desk.ticket.status === "resolved")
          ? slurpDeskSituation({
              creatorId: account.id,
              at,
              ledger: (await storage.getEarnings(account.id).catch(() => null))?.ledger ?? [],
              collabs,
            })
          : undefined;
      const ticked = slpDeskTick(desk, {
        at,
        // The player's own Creators never catch Slurp, leave or write tickets: the player is them.
        settings: yours
          ? {
              ...settings,
              tickets: "off",
              leaving: false,
              shadyMoves: settings.gamesWithYourCreators && settings.shadyMoves,
            }
          : settings,
        counts: needsCounts ? await countSlurpDeskPublished(db, account.id) : { posts: 0, stories: 0 },
        rolls: [Math.random(), Math.random(), Math.random()],
        situation,
      });
      desk = await applyEvents(later, db, account, ticked.events, ticked.desk, settings, at);
      if (settings.noticeMilestones)
        desk = await milestoneNotice(
          later,
          db,
          account,
          desk,
          slurpCreatorReach(
            {
              accountId: account.id,
              createdAt: account.createdAt,
              realFollowers: followers.get(account.id) ?? 0,
              scale: reachScale,
            },
            at,
            allSettings.simulationTuning.reach,
          ),
        );
      if (settings.noticeTrending && !desk.pausedAt) desk = await trendingNotice(later, db, account, desk, at);
      if (yours && settings.toYourCreators && elapsed > 0)
        desk = await supportToYourCreator(later, db, account, desk, settings, elapsed, at);
      return desk;
    }).then(
      () => true,
      (error: unknown) => {
        logger.warn(error, "[slurp-desk] Tick failed for %s", account.id);
        return false;
      },
    );
    if (!written) continue;
    for (const effect of effects)
      await effect().catch((error: unknown) =>
        logger.warn(error, "[slurp-desk] A desk effect failed for %s", account.id),
      );
  }
}
