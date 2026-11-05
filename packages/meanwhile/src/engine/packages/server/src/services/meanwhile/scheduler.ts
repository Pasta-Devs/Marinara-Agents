import {
  FIRST_POLL_MS,
  POLL_MS,
  backoffMs,
  circleNowMs,
  claimLease,
  dueReason,
  fastForwardWindow,
  runWindow,
  setTime,
  type DueReason,
  type RunMark,
  type RunWindow,
  DAY,
  msToWall,
  shiftDay,
  wallToMs,
} from "./clock.js";
import {
  getMeanwhileRuntime,
  markOf,
  readMeanwhile,
  updateMeanwhile,
  withMark,
  type Circle,
  type LifeEvent,
  type MeanwhileDocument,
  type PromiseRecord,
} from "./store.js";
import { SUMMARY_PLACEHOLDER, at, cardInfo, json, pickSchedule, planLife } from "./routine.js";
import {
  TIME_TOLERANCE_MIN,
  askPlaces,
  askSummary,
  makeGate,
  runBeats,
  usageRow,
  type BeatRun,
  type World,
} from "./beats.js";
import { markDelivered } from "./context.js";
import { applyStale, askPromises, dropOld, hasNewMessages, staleAnchors } from "./promises.js";
import type { Seed } from "./deck.js";

/** Claims the lease for one Circle. Returns false when another run holds it. */
async function claim(circleId: string, now: number): Promise<boolean> {
  let won = false;
  await updateMeanwhile((doc) => {
    const claimed = doc.circles.some((c) => c.id === circleId) ? claimLease(markOf(doc, circleId), now) : null;
    won = claimed !== null;
    return claimed ? withMark(doc, { ...claimed, trigger: null }) : doc;
  });
  return won;
}

/** Days of routine events that stay in storage. */
const ROUTINE_KEEP_DAYS = 14;
const NOTABLE_KEEP = 500;

/** Schedules, chat-truth times (Circle ms of the newest linked chat message), cast cards and the user's persona names. */
export async function readSchedules(circle: Circle) {
  const runtime = getMeanwhileRuntime();
  const schedules: Record<string, unknown> = {};
  const chatTruth: Record<string, number> = {};
  const cast: Record<string, { name: string; about: string }> = {};
  const chats = circle.linkedChatIds.length
    ? (await runtime.persistence.listChats()).filter((chat) => circle.linkedChatIds.includes(chat.id))
    : [];
  const cards = circle.castIds.length ? ((await runtime.resources.listCharacters(circle.castIds)) ?? []) : [];
  for (const id of circle.castIds) {
    const mine = chats.filter((chat) => chat.characterIds.includes(id));
    const card = cards.find((card) => card.id === id)?.data;
    schedules[id] = pickSchedule(
      id,
      mine.map((chat) => chat.metadata),
      card,
    );
    cast[id] = cardInfo(card);
    chatTruth[id] = Math.max(
      0,
      ...mine.map((chat) => {
        const last = chat.lastMessageAt ? Date.parse(chat.lastMessageAt) : NaN;
        return Number.isFinite(last) ? circleNowMs(circle.clock, last) : 0;
      }),
    );
  }
  let personas: string[] = [];
  const personaIds = [...new Set(chats.map((chat) => chat.personaId).filter((id): id is string => Boolean(id)))];
  if (personaIds.length) {
    try {
      const rows = await runtime.resources.listPersonas(personaIds);
      personas = rows
        .map((row) => at(json(row.data), "name"))
        .filter((n): n is string => typeof n === "string" && n.trim() !== "");
    } catch {
      // Older Engines have no persona list: the second-person check still guards the text.
    }
  }
  return { schedules, chatTruth, cast, personas };
}

/**
 * Circle days (wall dates) in the window that have no beat call yet, in order: the days that are over, and
 * today once its last seed time plus the beat tolerance has passed. Still one call per day.
 */
function beatDays(
  window: RunWindow,
  tz: string,
  done: ReadonlySet<string>,
  circleId: string,
  seeds: readonly Seed[],
): string[] {
  const out: string[] = [];
  const end = Date.parse(window.to);
  for (let day = msToWall(Date.parse(window.from), tz).slice(0, 10); ; day = shiftDay(day, 1)) {
    const over = wallToMs(`${shiftDay(day, 1)}T00:00`, tz);
    if (over === null) return out;
    if (over > end) {
      const times = seeds
        .filter((s) => s.circleId === circleId && s.day === day)
        .map((s) => wallToMs(`${day}T${s.time}`, tz) ?? Infinity);
      if (!done.has(`${circleId}:${day}`) && times.length && Math.max(...times) + TIME_TOLERANCE_MIN * 60_000 <= end)
        out.push(day);
      return out;
    }
    if (!done.has(`${circleId}:${day}`)) out.push(day);
  }
}

/**
 * One run: fills routine and deals seeds for the window, then asks the model for place tags, a
 * long-absence summary and one beat call per finished Circle day. A model error keeps what is
 * stored and counts as a failure. `lastRunCircle` moves only to the end of the last fully
 * processed day, in the same write that stores the events, so a crash never loses or doubles a day.
 * If the user changed the Circle's clock or `lastRunCircle` while the run read its inputs, the result is dropped.
 */
/** What `planLife` needs. A character with a major event that waits for the user lives on routine only. */
function lifeInput(
  doc: MeanwhileDocument,
  circle: Circle,
  window: RunWindow,
  inputs: Awaited<ReturnType<typeof readSchedules>>,
  now: number,
  lapsed: (e: LifeEvent) => boolean,
) {
  return {
    circle,
    window,
    schedules: inputs.schedules,
    chatTruth: inputs.chatTruth,
    seeds: doc.seeds,
    haveIds: new Set(doc.events.map((e) => e.id)),
    dealtDays: new Set(doc.dealtDays),
    now,
    holdIds: new Set(
      doc.events
        .filter((e) => e.circleId === circle.id && e.status === "proposed" && !lapsed(e))
        .flatMap((e) => e.cast),
    ),
  };
}

/** Live state of a fast forward, read by the status route and the cancel route. */
export interface Ff {
  running: boolean;
  dayIndex: number;
  days: number;
  cancel: boolean;
}
interface FinishOpts {
  ff?: Ff;
  /** Circle time a fast forward moved the clock by. */
  spanMs?: number;
  /** Ignore the daily call limit (calls still count). */
  over?: boolean;
}
/** A proposed big event that nobody answered is vetoed after this many Circle days. */
export const PROPOSAL_DAYS = 7;

async function finish(circleId: string, now: number, opts: FinishOpts = {}): Promise<void> {
  try {
    const first = await readMeanwhile();
    const start = first.circles.find((c) => c.id === circleId);
    if (!start) return;
    const to = circleNowMs(start.clock, now);
    const window =
      opts.spanMs === undefined
        ? runWindow(Date.parse(start.lastRunCircle), to)
        : fastForwardWindow(Date.parse(start.lastRunCircle), to, opts.spanMs);
    const lapsed = (e: LifeEvent) => e.status === "proposed" && Date.parse(e.end) < to - PROPOSAL_DAYS * DAY;
    let promises: PromiseRecord[] = first.promises.filter((p) => p.circleId === circleId).map((p) => ({ ...p }));
    let pass = first.promisePass;
    let staleSet: ReadonlySet<string> = new Set();
    const tz = start.clock.timezone;
    let plan: ReturnType<typeof planLife> | null = null;
    let usage = usageRow(first.usage, circleId, now);
    const run: BeatRun = { events: [], done: [], stoppedAt: null };
    let error: string | null = null;
    let held = false;
    if (window) {
      const inputs = await readSchedules(start);
      const base = lifeInput(first, start, window, inputs, now, lapsed);
      plan = planLife({ ...base, tags: first.placeTags });
      let days: string[] = [];
      try {
        const gate = await makeGate(start, usage, { over: opts.over, stop: () => opts.ff?.cancel === true });
        usage = gate.usage;
        const asked = await askPlaces(gate, plan.tags);
        if (asked.changed) {
          const replaced = new Set(asked.tags.map((t) => t.characterId));
          plan = planLife({
            ...base,
            tags: [...first.placeTags.filter((t) => !replaced.has(t.characterId)), ...asked.tags],
          });
        }
        if (start.linkedChatIds.length) {
          staleSet = await staleAnchors(start, promises, to);
          promises = applyStale(promises, [], staleSet).promises;
          const asked = await askPromises(start, inputs.cast, first.promisePass, gate, to);
          if (asked) {
            const have = new Set(promises.map((p) => p.id));
            promises = [...promises, ...asked.promises.filter((p) => !have.has(p.id))];
            pass = asked.pass;
          }
        }
        const world: World = { circle: start, ...inputs, tags: plan.tags, events: first.events, promises, now };
        const summaries = plan.events.filter((e) => e.weight === "summary");
        if (summaries.length && gate.left() < 1) {
          // No budget for the summary: drop the placeholder, do not move past the cut, try again on the next real day.
          plan.events = plan.events.filter((e) => e.weight !== "summary");
          held = true;
        } else {
          for (const event of summaries) await askSummary(world, gate, event);
          const seeds = [...first.seeds, ...plan.seeds];
          days = beatDays(window, tz, new Set(first.beatDays), circleId, seeds);
          if (opts.ff) opts.ff.days = days.length;
          await runBeats(run, world, gate, days, seeds, to, (n) => {
            if (opts.ff) opts.ff.dayIndex = n;
          });
        }
      } catch (e) {
        error = e instanceof Error ? e.message.slice(0, 200) : "Run failed";
        run.stoppedAt = days[run.done.length] ?? null;
        // A summary that never got its text is made again by the next run.
        plan.events = plan.events.filter((e) => e.weight !== "summary" || e.text !== SUMMARY_PLACEHOLDER);
      }
    }
    const stopMs = run.stoppedAt ? wallToMs(`${run.stoppedAt}T00:00`, tz) : null;
    const lastRun = Date.parse(start.lastRunCircle);
    // Not done: stay at the first undone day. Failed before any day: stay where we were.
    const advanceTo =
      (error && !run.stoppedAt) || held ? lastRun : stopMs === null ? to : Math.min(to, Math.max(lastRun, stopMs));

    await updateMeanwhile((doc) => {
      const circle = doc.circles.find((c) => c.id === circleId);
      if (!circle) return doc;
      const mark = markOf(doc, circleId);
      const done = {
        ...mark,
        leaseUntil: 0,
        failures: error ? mark.failures + 1 : 0,
        nextAt: error ? now + backoffMs(mark.failures + 1) : 0,
        lastRunAt: now,
        lastWindow: window,
        lastError: error,
      };
      const usageCutoff = new Date(now - 7 * DAY).toISOString().slice(0, 10);
      // The calls were made even if the result is dropped.
      const withUsage = (d: typeof doc) =>
        window
          ? {
              ...d,
              usage: [
                ...d.usage.filter(
                  (u) => !(u.circleId === circleId && u.realDay === usage.realDay) && u.realDay >= usageCutoff,
                ),
                usage,
              ],
            }
          : d;
      if (
        circle.lastRunCircle !== start.lastRunCircle ||
        JSON.stringify(circle.clock) !== JSON.stringify(start.clock)
      ) {
        return withMark(withUsage(doc), { ...done, lastWindow: markOf(doc, circleId).lastWindow }); // stale: free the lease, keep the mark
      }
      let next = doc;
      if (window && plan) {
        const seedCutoff = shiftDay(msToWall(to, tz).slice(0, 10), -ROUTINE_KEEP_DAYS);
        const mine = (circleOf: string) => circleOf === circleId;
        const have = new Set(doc.events.map((e) => e.id));
        const stored = plan;
        const all = [...doc.events, ...stored.events, ...run.events.filter((e) => !have.has(e.id))];
        const keep = new Set(
          all
            .filter((e) => mine(e.circleId) && e.weight !== "routine")
            .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
            .slice(0, NOTABLE_KEEP)
            .map((e) => e.id),
        );
        const kept = all.filter((e) =>
          !mine(e.circleId)
            ? true
            : e.weight === "routine"
              ? Date.parse(e.start) >= to - ROUTINE_KEEP_DAYS * DAY
              : keep.has(e.id),
        );
        const swept = applyStale(dropOld(promises, msToWall(to, tz).slice(0, 10)), kept, staleSet);
        next = {
          ...doc,
          circles: doc.circles.map((c) =>
            c.id === circleId ? { ...c, lastRunCircle: new Date(advanceTo).toISOString() } : c,
          ),
          // ponytail: routine is cheap to recompute, so only the last 14 Circle days stay. Notable events
          // are capped per Circle (diary and hooks derive from them); an archive store would lift the cap.
          events: swept.events.map((e) => (mine(e.circleId) && lapsed(e) ? { ...e, status: "vetoed" } : e)),
          promises: [
            ...doc.promises.filter((p) => !mine(p.circleId)),
            ...swept.promises.filter((p) => p.status === "open" || p.due >= seedCutoff),
          ],
          promisePass: { ...doc.promisePass, ...pass },
          placeTags: [
            ...doc.placeTags.filter((t) => !stored.tags.some((n) => n.characterId === t.characterId)),
            ...stored.tags,
          ],
          seeds: [...doc.seeds.filter((s) => !mine(s.circleId) || s.day >= seedCutoff), ...stored.seeds],
          dealtDays: [
            ...doc.dealtDays.filter((k) => !k.startsWith(`${circleId}:`) || k.slice(-10) >= seedCutoff),
            ...stored.dealtDays,
          ],
          beatDays: [
            ...doc.beatDays.filter((k) => !k.startsWith(`${circleId}:`) || k.slice(-10) >= seedCutoff),
            ...run.done.map((d) => `${circleId}:${d}`),
          ],
        };
      }
      return withMark(withUsage(next), done);
    });
  } catch (error) {
    await updateMeanwhile((doc) => {
      const mark = markOf(doc, circleId);
      return withMark(doc, {
        ...mark,
        leaseUntil: 0,
        failures: mark.failures + 1,
        nextAt: now + backoffMs(mark.failures + 1),
        lastError: error instanceof Error ? error.message.slice(0, 200) : "Run failed",
      });
    });
    throw error;
  }
}

/** Manual run. Returns false when a run for this Circle is already live. */
export async function runCircleNow(circleId: string, now = Date.now()): Promise<boolean> {
  if (!(await claim(circleId, now))) return false;
  await finish(circleId, now);
  return true;
}

const forwards = new Map<string, Ff>();

export function ffStatus(circleId: string) {
  const f = forwards.get(circleId);
  return { running: f?.running ?? false, dayIndex: f?.dayIndex ?? 0, days: f?.days ?? 0 };
}

/** The run stops after the day it is on. Finished days stay stored and the mark covers only them. */
export function cancelFastForward(circleId: string): boolean {
  const f = forwards.get(circleId);
  if (!f?.running) return false;
  f.cancel = true;
  return true;
}

/** What a fast forward would cost, without writing anything. Null when the Circle does not exist. */
export async function previewFastForward(circleId: string, spanMs: number, now = Date.now()) {
  const doc = await readMeanwhile();
  const circle = doc.circles.find((c) => c.id === circleId);
  if (!circle) return null;
  const to = circleNowMs(circle.clock, now) + spanMs;
  const window = fastForwardWindow(Date.parse(circle.lastRunCircle), to, spanMs);
  const left = circle.budgetCallsPerDay - usageRow(doc.usage, circleId, now).calls;
  if (!window) return { days: 0, calls: 0, left };
  const lapsed = (e: LifeEvent) => e.status === "proposed" && Date.parse(e.end) < to - PROPOSAL_DAYS * DAY;
  const plan = planLife({
    ...lifeInput(doc, circle, window, await readSchedules(circle), now, lapsed),
    tags: doc.placeTags,
  });
  const seeds = [...doc.seeds, ...plan.seeds];
  const days = beatDays(window, circle.clock.timezone, new Set(doc.beatDays), circleId, seeds);
  // A day without seeds is marked done without a call.
  const beats = days.filter((d) => seeds.some((s) => s.circleId === circleId && s.day === d)).length;
  const places = plan.tags.some((t) => !t.asked && Object.values(t.byActivity).includes("unknown")) ? 1 : 0;
  const promises = (await hasNewMessages(circle, doc.promisePass)) ? 1 : 0;
  return { days: days.length, calls: beats + places + promises, left };
}

/**
 * Moves the Circle clock forward by `spanMs` (at any speed, also x0) and runs the generator for that span in
 * the background. False when a run for this Circle is already live.
 */
export async function startFastForward(
  circleId: string,
  spanMs: number,
  over: boolean,
  now = Date.now(),
): Promise<boolean> {
  if (!(await claim(circleId, now))) return false;
  const ff: Ff = { running: true, dayIndex: 0, days: 0, cancel: false };
  forwards.set(circleId, ff);
  try {
    await updateMeanwhile((doc) => ({
      ...doc,
      circles: doc.circles.map((c) =>
        c.id === circleId ? { ...c, clock: setTime(c.clock, circleNowMs(c.clock, now) + spanMs, now) } : c,
      ),
    }));
  } catch (error) {
    ff.running = false; // ponytail: the lease stays until it expires (30 min), release it here if that hurts
    throw error;
  }
  const logger = getMeanwhileRuntime().logger;
  void finish(circleId, now, { ff, spanMs, over })
    .catch((error) =>
      logger.warn(`[meanwhile] fast forward failed: ${error instanceof Error ? error.message : String(error)}`),
    )
    .finally(() => {
      ff.running = false;
    });
  return true;
}

/** Why a Circle is due, or null. Pure reads, no writes. */
export function dueNow(circle: Circle, mark: RunMark, chatNewer: boolean, now: number): DueReason | null {
  return dueReason({
    hasConnection: circle.connectionId !== "",
    mark,
    now,
    chatNewer,
    backgroundTimer: circle.backgroundTimer,
    circleNow: circleNowMs(circle.clock, now),
    lastRunCircle: Date.parse(circle.lastRunCircle),
  });
}

/** One wake: run every due Circle. A tab ping is spent here whether or not it led to a run. */
export async function runDuePass(now = Date.now()): Promise<string[]> {
  // Captured first: after deactivate the runtime is gone, and a late catch must still be able to log.
  const logger = getMeanwhileRuntime().logger;
  const doc = await readMeanwhile();
  if (doc.circles.length === 0) return [];
  await markDelivered().catch((error) =>
    logger.warn(`[meanwhile] delivery check failed: ${error instanceof Error ? error.message : String(error)}`),
  );
  const chatTimes = new Map<string, number>();
  if (doc.circles.some((c) => c.linkedChatIds.length > 0)) {
    for (const chat of await getMeanwhileRuntime().persistence.listChats()) {
      chatTimes.set(chat.id, chat.lastMessageAt ? Date.parse(chat.lastMessageAt) : 0);
    }
  }
  const due: string[] = [];
  await updateMeanwhile((current) => {
    due.length = 0;
    let next = current;
    for (const circle of current.circles) {
      const mark = markOf(current, circle.id);
      const chatNewer = circle.linkedChatIds.some((id) => (chatTimes.get(id) ?? 0) > mark.lastRunAt);
      const claimed = dueNow(circle, mark, chatNewer, now) ? claimLease(mark, now) : null;
      if (claimed) due.push(circle.id);
      if (claimed || mark.trigger) next = withMark(next, { ...(claimed ?? mark), trigger: null });
    }
    return next;
  });
  const ran: string[] = [];
  for (const id of due) {
    try {
      await finish(id, now);
      ran.push(id);
    } catch (error) {
      logger.warn(`[meanwhile] run failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return ran;
}

/** Wakes 90 s after start, then every 5 min. The timer is unref'd and the returned stop clears it. */
export function startMeanwhileScheduler(): () => void {
  const logger = getMeanwhileRuntime().logger;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (ms: number) => {
    if (stopped) return;
    timer = setTimeout(() => void wake(), ms);
    timer.unref?.();
  };
  const wake = async () => {
    try {
      await runDuePass();
    } catch (error) {
      logger.warn(`[meanwhile] wake failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      schedule(POLL_MS);
    }
  };
  schedule(FIRST_POLL_MS);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
