import {
  FIRST_POLL_MS,
  POLL_MS,
  backoffMs,
  circleNowMs,
  claimLease,
  dueReason,
  runWindow,
  type DueReason,
  type RunMark,
  DAY,
  msToWall,
  shiftDay,
} from "./clock.js";
import { getMeanwhileRuntime, markOf, readMeanwhile, updateMeanwhile, withMark, type Circle } from "./store.js";
import { pickSchedule, planLife } from "./routine.js";

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

/** Schedules and chat-truth times (Circle ms of the newest linked chat message) per cast member. */
export async function readSchedules(circle: Circle) {
  const runtime = getMeanwhileRuntime();
  const schedules: Record<string, unknown> = {};
  const chatTruth: Record<string, number> = {};
  const chats = circle.linkedChatIds.length
    ? (await runtime.persistence.listChats()).filter((chat) => circle.linkedChatIds.includes(chat.id))
    : [];
  const cards = circle.castIds.length ? ((await runtime.resources?.listCharacters(circle.castIds)) ?? []) : [];
  for (const id of circle.castIds) {
    const mine = chats.filter((chat) => chat.characterIds.includes(id));
    schedules[id] = pickSchedule(
      id,
      mine.map((chat) => chat.metadata),
      cards.find((card) => card.id === id)?.data,
    );
    chatTruth[id] = Math.max(
      0,
      ...mine.map((chat) => {
        const at = chat.lastMessageAt ? Date.parse(chat.lastMessageAt) : NaN;
        return Number.isFinite(at) ? circleNowMs(circle.clock, at) : 0;
      }),
    );
  }
  return { schedules, chatTruth };
}

/**
 * One run, no model calls: fills routine and deals seeds for the window, then moves `lastRunCircle` to its end.
 * The mark only moves in the same write that stores the events, so a crash never loses or doubles a day.
 * If the user changed the Circle's clock or `lastRunCircle` while the run read its inputs, the result is dropped.
 */
async function finish(circleId: string, now: number): Promise<void> {
  try {
    const start = (await readMeanwhile()).circles.find((c) => c.id === circleId);
    if (!start) return;
    const window = runWindow(Date.parse(start.lastRunCircle), circleNowMs(start.clock, now));
    const { schedules, chatTruth } = window ? await readSchedules(start) : { schedules: {}, chatTruth: {} };
    await updateMeanwhile((doc) => {
      const circle = doc.circles.find((c) => c.id === circleId);
      if (!circle) return doc;
      const done = {
        ...markOf(doc, circleId),
        leaseUntil: 0,
        failures: 0,
        nextAt: 0,
        lastRunAt: now,
        lastWindow: window,
        lastError: null,
      };
      if (
        circle.lastRunCircle !== start.lastRunCircle ||
        JSON.stringify(circle.clock) !== JSON.stringify(start.clock)
      ) {
        return withMark(doc, { ...done, lastWindow: markOf(doc, circleId).lastWindow }); // stale: free the lease, keep the doc
      }
      let next = doc;
      if (window) {
        const plan = planLife({
          circle,
          window,
          schedules,
          chatTruth,
          tags: doc.placeTags,
          seeds: doc.seeds,
          haveIds: new Set(doc.events.map((e) => e.id)),
          dealtDays: new Set(doc.dealtDays),
          now,
        });
        const to = Date.parse(window.to);
        const seedCutoff = shiftDay(msToWall(to, circle.clock.timezone).slice(0, 10), -ROUTINE_KEEP_DAYS);
        const mine = (circleOf: string) => circleOf === circleId;
        next = {
          ...doc,
          circles: doc.circles.map((c) => (c.id === circleId ? { ...circle, lastRunCircle: window.to } : c)),
          // ponytail: routine is cheap to recompute, so only the last 14 Circle days stay. Notable events are kept.
          // Only this Circle is pruned: another Circle can have a different clock.
          events: [...doc.events, ...plan.events].filter(
            (e) => !mine(e.circleId) || e.weight !== "routine" || Date.parse(e.start) >= to - ROUTINE_KEEP_DAYS * DAY,
          ),
          placeTags: [
            ...doc.placeTags.filter((t) => !plan.tags.some((n) => n.characterId === t.characterId)),
            ...plan.tags,
          ],
          seeds: [...doc.seeds, ...plan.seeds].filter((s) => !mine(s.circleId) || s.day >= seedCutoff),
          dealtDays: [...doc.dealtDays, ...plan.dealtDays].filter(
            (k) => !k.startsWith(`${circleId}:`) || k.slice(-10) >= seedCutoff,
          ),
        };
      }
      return withMark(next, done);
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
