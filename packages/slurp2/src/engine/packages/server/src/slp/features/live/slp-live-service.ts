import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { slurpFanTypeWeeklyBudget, slurpResolveFanType } from "../../../../../shared/src/slp/slp-fan-types.js";
import {
  normalizeSlpLiveSettings,
  slpLiveApplyTip,
  slpLiveMinute,
  slpLiveStart,
  slpLiveUnit,
  slurpLiveSlot,
  slpLiveWorkQueue,
  type SlpLiveFan,
} from "../../../../../shared/src/slp/slp-live.js";
import { trySlpOperation } from "../../base/locking/slp-operation-lock.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { resolveSlurpCreatorSpice } from "../../data/creators/slp-spice-storage.js";
import { createSlurpLiveStorage, type SlurpLiveShow } from "../../data/live/slp-live-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { withSlurpLiveShow } from "./slp-live-lock.js";
import { slurpIsCouplePage } from "../../modules/projects/slp-creator-couples.js";
import { notifySlurpLiveStart, postSlurpLiveSummary } from "./slp-live-news.js";

const MINUTE = 60_000;
/** ponytail: a fixed cap keeps the code simulation cheap; make it a setting if players want busier evenings. */
const MAX_OPEN_SHOWS = 3;
/** A world that was off for hours catches up at most this much per show in one pass. */
const MAX_CATCH_UP_MINUTES = 240;
const FANS_MAX = 120;
/** A room with fewer live fans fills up with passers-by from the population. */
const ROOM_MIN = 8;

type Settings = Awaited<ReturnType<ReturnType<typeof createSlurpStorage>["getSettings"]>>;

/** The world tick for live shows: move every open show to now, end the finished ones, start the due ones. */
export async function advanceSlurpLive(db: DB, at = new Date()): Promise<void> {
  const settings = await createSlurpStorage(db).getSettings();
  if (!slpExtensionOn(settings, "live")) return;
  await trySlpOperation("slurp-live-tick", async () => {
    const storage = createSlurpLiveStorage(db);
    const open: SlurpLiveShow[] = [];
    for (const show of await storage.listOpen()) {
      const next = await simulateSlurpLiveShow(db, show, settings, at);
      if (!next.endedAt) open.push(next);
    }
    await startDueShows(db, settings, open, at);
  });
}

async function startDueShows(db: DB, settings: Settings, open: SlurpLiveShow[], at: Date) {
  const live = normalizeSlpLiveSettings(settings.live);
  const storage = createSlurpLiveStorage(db);
  const population = createSlurpPopulationStorage(db);
  const busy = new Set(open.map((show) => show.hostId));
  const creators = (await createSlurpStorage(db).listNoodlerAccounts()).filter((account) => account.kind !== "persona");
  for (const creator of creators) {
    if (open.length >= MAX_OPEN_SHOWS) return;
    if (busy.has(creator.id)) continue;
    const slot = slurpLiveSlot(creator.id, live, at.getTime());
    if (await storage.get(slot.id)) continue;
    // Not yet, or the first half went by while the world was off: that show happened without anyone.
    if (at.getTime() < slot.startAt || at.getTime() > (slot.startAt + slot.endsAt) / 2) continue;
    const spice = await resolveSlurpCreatorSpice(db, creator);
    const fans = (await population.listTiesForCreator(creator.id)).filter((tie) => tie.stage !== "lapsed").length;
    const show: SlurpLiveShow = {
      id: slot.id,
      hostKind: "creator",
      hostId: creator.id,
      startedAt: new Date(slot.startAt).toISOString(),
      endsAt: new Date(slot.endsAt).toISOString(),
      endedAt: null,
      state: slpLiveStart({ level: spice.level, fans }),
      watchedAt: null,
      createdAt: at.toISOString(),
    };
    if (!(await createIfFree(storage, show))) continue;
    await notifySlurpLiveStart(db, show).catch((error: unknown) => logger.warn(error, "[slurp-live] Notify failed"));
    open.push(await simulateSlurpLiveShow(db, show, settings, at));
    busy.add(creator.id);
  }
}

async function liveFans(db: DB, hostId: string, settings: Settings): Promise<Array<SlpLiveFan & { budget: number }>> {
  const population = createSlurpPopulationStorage(db);
  const ties = (await population.listTiesForCreator(hostId))
    .filter((tie) => tie.stage !== "lapsed")
    .sort((a, b) => Number(b.spent) - Number(a.spent))
    .slice(0, FANS_MAX);
  const fans: Array<SlpLiveFan & { budget: number }> = [];
  const add = (member: Awaited<ReturnType<typeof population.listAll>>[number]) => {
    const type = slurpResolveFanType(settings.fanTypes, member);
    const budget = slurpFanTypeWeeklyBudget(type, member.id);
    if (!type.enabled || budget <= 0) return;
    fans.push({
      id: member.id,
      name: member.displayName,
      activeHour: member.activeHour,
      tipChance: type.spend.tipChance,
      maxTip: Math.max(5, Math.round(budget / 3)),
      budget,
    });
  };
  for (const tie of ties) {
    const member = await population.get(tie.memberId);
    if (member) add(member);
  }
  if (fans.length >= ROOM_MIN) return fans;
  // Seeded per host, so the same passers-by stay from minute to minute; a tip ties them to the Creator.
  const seen = new Set(ties.map((tie) => tie.memberId));
  const walkers = (await population.listAll(200))
    .filter((member) => !seen.has(member.id))
    .sort((a, b) => slpLiveUnit(`${hostId}:${a.id}:walk`) - slpLiveUnit(`${hostId}:${b.id}:walk`));
  for (const member of walkers) {
    if (fans.length >= ROOM_MIN) break;
    add(member);
  }
  return fans;
}

/**
 * Move one show forward to `at` (or its end), a world minute at a time, with code only. Fans' tips are paid
 * from their weekly budget and credited to the Creator like any tip. Saves and returns the show.
 */
export function simulateSlurpLiveShow(
  db: DB,
  show: SlurpLiveShow,
  settings: Settings,
  at: Date,
): Promise<SlurpLiveShow> {
  return withSlurpLiveShow(show.id, async () => {
    const fresh = (await createSlurpLiveStorage(db).get(show.id)) ?? show;
    return simulateLocked(db, fresh, settings, at);
  });
}

async function simulateLocked(db: DB, show: SlurpLiveShow, settings: Settings, at: Date): Promise<SlurpLiveShow> {
  const started = Date.parse(show.startedAt);
  const until = Math.min(at.getTime(), Date.parse(show.endsAt)) - started;
  const state = show.state;
  // Minutes [0, simulatedTo / MINUTE) are done; minute m runs once the clock reaches its start.
  const from = Math.round(state.simulatedTo / MINUTE);
  const to = Math.min(Math.floor(until / MINUTE) + 1, from + MAX_CATCH_UP_MINUTES);
  if (until >= 0 && to > from) {
    const population = createSlurpPopulationStorage(db);
    const noodle = createSlurpStorage(db);
    const fans = await liveFans(db, show.hostId, settings);
    const budgets = new Map(fans.map((fan) => [fan.id, fan.budget]));
    for (let minute = from; minute < to; minute += 1) {
      const when = started + minute * MINUTE;
      const tips = slpLiveMinute(state, fans, { showId: show.id, minute, hour: new Date(when).getUTCHours() });
      for (const tip of tips) {
        const operationId = `live:${show.id}:${tip.by}:${minute}`;
        // A pass that died before its save replays this minute: the receipt says it was already paid.
        if (await noodle.hasCreatorIncomeOperation(show.hostId, operationId)) {
          slpLiveApplyTip(state, tip, minute * MINUTE);
          continue;
        }
        const paid = await population
          .reserveWeeklySpend(tip.by, show.hostId, tip.amount, budgets.get(tip.by) ?? 0, new Date(when))
          .catch(() => false);
        if (!paid) continue;
        slpLiveApplyTip(state, tip, minute * MINUTE);
        await noodle
          .creditCreatorIncome(show.hostId, tip.amount, "tip", operationId)
          .catch((error: unknown) => logger.warn(error, "[slurp-live] Could not credit a live tip"));
        await population
          .advanceTie(tip.by, show.hostId, { spent: tip.amount, tipped: tip.amount, interactions: 1 })
          .catch(() => undefined);
      }
      slpLiveWorkQueue(state, minute * MINUTE);
      state.simulatedTo = (minute + 1) * MINUTE;
      // Money moved this minute: save now, so a crash cannot replay (and pay) the same tips again.
      if (tips.length) await createSlurpLiveStorage(db).save(show.id, { state });
    }
  }
  // A closed show stays closed, whatever clock this pass ran on.
  const endedAt = show.endedAt ?? (at.getTime() >= Date.parse(show.endsAt) ? show.endsAt : null);
  const next = { ...show, state, endedAt };
  await createSlurpLiveStorage(db).save(show.id, { state, endedAt });
  // The show just closed: a Creator thanks the room; a player host writes their own posts.
  if (endedAt && !show.endedAt && show.hostKind === "creator") await postSlurpLiveSummary(db, next);
  return next;
}

/** One open show per host: the world tick and the player's Go live check and create under one host lock. */
function createIfFree(storage: ReturnType<typeof createSlurpLiveStorage>, show: SlurpLiveShow) {
  return withSlurpLiveShow(`host:${show.hostId}`, async () =>
    (await storage.listOpen()).some(
      (open) => open.hostId === show.hostId && Date.parse(open.endsAt) > Date.parse(show.startedAt),
    )
      ? false
      : storage.create(show),
  );
}

export type SlurpLiveHostResult = { show: SlurpLiveShow } | "missing" | "live";

/**
 * The player goes live as a Creator: their persona's own Creator account, or (from Stir) the Creator they
 * play. The world still fills the room and pays the tips; the player writes the host's lines.
 */
export async function hostSlurpLiveShow(
  db: DB,
  input: { personaId: string; creatorId?: string; minutes: number },
  at = new Date(),
): Promise<SlurpLiveHostResult> {
  const noodle = createSlurpStorage(db);
  const host = input.creatorId
    ? await noodle.getAccountById(input.creatorId)
    : await noodle.getSlurpAccountForEntity("persona", input.personaId, "creator").catch(() => null);
  if (!host || host.kind === "viewer") return "missing";
  // Another persona's Creator is not the player's to run.
  if (host.kind === "persona" && host.sourceEntityId !== input.personaId) return "missing";
  if (slurpIsCouplePage(host)) return "missing";
  const storage = createSlurpLiveStorage(db);
  // The player picks the length; the Backstage show length only shapes Creator shows.
  const minutes = Math.min(240, Math.max(10, Math.round(input.minutes)));
  const spice = await resolveSlurpCreatorSpice(db, host);
  const fans = (await createSlurpPopulationStorage(db).listTiesForCreator(host.id)).filter(
    (tie) => tie.stage !== "lapsed",
  ).length;
  const show: SlurpLiveShow = {
    id: `live:${host.id}:player:${at.getTime()}`,
    hostKind: "player",
    hostId: host.id,
    startedAt: at.toISOString(),
    endsAt: new Date(at.getTime() + minutes * MINUTE).toISOString(),
    endedAt: null,
    state: { ...slpLiveStart({ level: spice.level, fans }), hostPersona: input.personaId },
    watchedAt: at.toISOString(),
    createdAt: at.toISOString(),
  };
  if (!(await createIfFree(storage, show))) return "live";
  return { show };
}

/** The hosting player ends their show early; the room's tips so far stay paid. */
export async function endSlurpLiveShow(db: DB, input: { showId: string; personaId: string }, at = new Date()) {
  return withSlurpLiveShow(input.showId, async () => {
    const storage = createSlurpLiveStorage(db);
    const show = await storage.get(input.showId);
    if (!show || show.hostKind !== "player" || show.state.hostPersona !== input.personaId) return "missing";
    if (show.endedAt) return show;
    const endsAt = new Date(Math.min(at.getTime(), Date.parse(show.endsAt))).toISOString();
    await storage.save(show.id, { endsAt });
    // Plays the last minutes and closes the show now, so the summary does not wait for the world tick.
    return simulateLocked(db, { ...show, endsAt }, await createSlurpStorage(db).getSettings(), at);
  });
}
