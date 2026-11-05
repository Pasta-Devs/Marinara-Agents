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
  type RunWindow,
  DAY,
  msToWall,
  shiftDay,
  wallToMs,
} from "./clock.js";
import { getMeanwhileRuntime, markOf, readMeanwhile, updateMeanwhile, withMark, type Circle } from "./store.js";
import { SUMMARY_PLACEHOLDER, at, cardInfo, json, pickSchedule, planLife } from "./routine.js";
import { askPlaces, askSummary, makeGate, runBeats, usageRow, type BeatRun, type World } from "./beats.js";

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

/** Circle days (wall dates) in the window that are over, have no beat call yet, in order. */
function beatDays(window: RunWindow, tz: string, done: ReadonlySet<string>, circleId: string): string[] {
  const out: string[] = [];
  const end = Date.parse(window.to);
  for (let day = msToWall(Date.parse(window.from), tz).slice(0, 10); ; day = shiftDay(day, 1)) {
    const over = wallToMs(`${shiftDay(day, 1)}T00:00`, tz);
    if (over === null || over > end) return out;
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
async function finish(circleId: string, now: number): Promise<void> {
  try {
    const first = await readMeanwhile();
    const start = first.circles.find((c) => c.id === circleId);
    if (!start) return;
    const to = circleNowMs(start.clock, now);
    const window = runWindow(Date.parse(start.lastRunCircle), to);
    const tz = start.clock.timezone;
    let plan: ReturnType<typeof planLife> | null = null;
    let usage = usageRow(first.usage, circleId, now);
    const run: BeatRun = { events: [], done: [], stoppedAt: null };
    let error: string | null = null;
    if (window) {
      const inputs = await readSchedules(start);
      const base = {
        circle: start,
        window,
        schedules: inputs.schedules,
        chatTruth: inputs.chatTruth,
        seeds: first.seeds,
        haveIds: new Set(first.events.map((e) => e.id)),
        dealtDays: new Set(first.dealtDays),
        now,
        // A character with a major event waiting for the user lives on routine only.
        holdIds: new Set(
          first.events.filter((e) => e.circleId === circleId && e.status === "proposed").flatMap((e) => e.cast),
        ),
      };
      plan = planLife({ ...base, tags: first.placeTags });
      let days: string[] = [];
      try {
        const gate = await makeGate(start, usage);
        usage = gate.usage;
        const asked = await askPlaces(gate, plan.tags);
        if (asked.changed) {
          const replaced = new Set(asked.tags.map((t) => t.characterId));
          plan = planLife({
            ...base,
            tags: [...first.placeTags.filter((t) => !replaced.has(t.characterId)), ...asked.tags],
          });
        }
        const world: World = { circle: start, ...inputs, tags: plan.tags, events: first.events, now };
        for (const event of plan.events.filter((e) => e.weight === "summary")) await askSummary(world, gate, event);
        days = beatDays(window, tz, new Set(first.beatDays), circleId);
        await runBeats(run, world, gate, days, [...first.seeds, ...plan.seeds], to);
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
      error && !run.stoppedAt ? lastRun : stopMs === null ? to : Math.min(to, Math.max(lastRun, stopMs));

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
      if (
        circle.lastRunCircle !== start.lastRunCircle ||
        JSON.stringify(circle.clock) !== JSON.stringify(start.clock)
      ) {
        return withMark(doc, { ...done, lastWindow: markOf(doc, circleId).lastWindow }); // stale: free the lease, keep the mark
      }
      let next = doc;
      if (window && plan) {
        const seedCutoff = shiftDay(msToWall(to, tz).slice(0, 10), -ROUTINE_KEEP_DAYS);
        const mine = (circleOf: string) => circleOf === circleId;
        const have = new Set(doc.events.map((e) => e.id));
        const usageCutoff = new Date(now - 7 * DAY).toISOString().slice(0, 10);
        const stored = plan;
        next = {
          ...doc,
          circles: doc.circles.map((c) =>
            c.id === circleId ? { ...c, lastRunCircle: new Date(advanceTo).toISOString() } : c,
          ),
          // ponytail: routine is cheap to recompute, so only the last 14 Circle days stay.
          // Notable events are kept for good.
          events: [...doc.events, ...stored.events, ...run.events.filter((e) => !have.has(e.id))].filter(
            (e) => !mine(e.circleId) || e.weight !== "routine" || Date.parse(e.start) >= to - ROUTINE_KEEP_DAYS * DAY,
          ),
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
          usage: [
            ...doc.usage.filter(
              (u) => !(u.circleId === circleId && u.realDay === usage.realDay) && u.realDay >= usageCutoff,
            ),
            usage,
          ],
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
