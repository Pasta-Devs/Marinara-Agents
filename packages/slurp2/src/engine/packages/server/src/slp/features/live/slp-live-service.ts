import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { slurpFanTypeWeeklyBudget, slurpResolveFanType } from "../../../../../shared/src/slp/slp-fan-types.js";
import {
  normalizeSlpLiveSettings,
  slpLiveApplyTip,
  slpLiveMinute,
  slpLiveStart,
  slurpLiveSlot,
  slpLiveWorkQueue,
  type SlpLiveFan,
} from "../../../../../shared/src/slp/slp-live.js";
import { trySlpOperation } from "../../base/locking/slp-operation-lock.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { resolveSlurpCreatorSpice } from "../../data/creators/slp-spice-storage.js";
import { createSlurpLiveStorage, type SlurpLiveShow } from "../../data/live/slp-live-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";

const MINUTE = 60_000;
/** ponytail: a fixed cap keeps the code simulation cheap; make it a setting if players want busier evenings. */
const MAX_OPEN_SHOWS = 3;
/** A world that was off for hours catches up at most this much per show in one pass. */
const MAX_CATCH_UP_MINUTES = 240;
const FANS_MAX = 120;

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
    if (!(await storage.create(show))) continue;
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
  for (const tie of ties) {
    const member = await population.get(tie.memberId);
    if (!member) continue;
    const type = slurpResolveFanType(settings.fanTypes, member);
    const budget = slurpFanTypeWeeklyBudget(type, member.id);
    if (!type.enabled || budget <= 0) continue;
    fans.push({
      id: member.id,
      name: member.displayName,
      activeHour: member.activeHour,
      tipChance: type.spend.tipChance,
      maxTip: Math.max(5, Math.round(budget / 3)),
      budget,
    });
  }
  return fans;
}

/**
 * Move one show forward to `at` (or its end), a world minute at a time, with code only. Fans' tips are paid
 * from their weekly budget and credited to the Creator like any tip. Saves and returns the show.
 */
export async function simulateSlurpLiveShow(
  db: DB,
  show: SlurpLiveShow,
  settings: Settings,
  at: Date,
): Promise<SlurpLiveShow> {
  const started = Date.parse(show.startedAt);
  const until = Math.min(at.getTime(), Date.parse(show.endsAt)) - started;
  const state = show.state;
  const from = Math.floor(state.simulatedTo / MINUTE) + (state.simulatedTo ? 1 : 0);
  const to = Math.min(Math.floor(until / MINUTE), from + MAX_CATCH_UP_MINUTES);
  if (to >= from) {
    const population = createSlurpPopulationStorage(db);
    const noodle = createSlurpStorage(db);
    const fans = await liveFans(db, show.hostId, settings);
    const budgets = new Map(fans.map((fan) => [fan.id, fan.budget]));
    for (let minute = from; minute <= to; minute += 1) {
      const when = started + minute * MINUTE;
      const tips = slpLiveMinute(state, fans, { showId: show.id, minute, hour: new Date(when).getUTCHours() });
      for (const tip of tips) {
        const paid = await population
          .reserveWeeklySpend(tip.by, show.hostId, tip.amount, budgets.get(tip.by) ?? 0, new Date(when))
          .catch(() => false);
        if (!paid) continue;
        slpLiveApplyTip(state, tip, minute * MINUTE);
        await noodle
          .creditCreatorIncome(show.hostId, tip.amount, "tip", `live:${show.id}:${tip.by}:${minute}`)
          .catch((error: unknown) => logger.warn(error, "[slurp-live] Could not credit a live tip"));
        await population
          .advanceTie(tip.by, show.hostId, { spent: tip.amount, tipped: tip.amount, interactions: 1 })
          .catch(() => undefined);
      }
      slpLiveWorkQueue(state, minute * MINUTE);
      state.simulatedTo = minute * MINUTE;
    }
  }
  const endedAt = at.getTime() >= Date.parse(show.endsAt) ? show.endsAt : null;
  const next = { ...show, state, endedAt };
  await createSlurpLiveStorage(db).save(show.id, { state, endedAt });
  return next;
}
