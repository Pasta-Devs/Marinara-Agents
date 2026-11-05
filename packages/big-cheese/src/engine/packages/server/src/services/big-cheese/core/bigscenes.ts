// Big Cheese: big scenes (design.md section 3.8). Blueprints are data, the code books a scene
// onto a thread as a `big_scene` beat, keeps the weekly budget and settles the result.
import { DAYS, dayIndex, WEEKS } from "./clock.js";
import type { PlaceKit } from "./kits/types.js";
import { applyDelta, newId } from "./run.js";
import { countEvent } from "./culture.js";
import { closeThread } from "./threads.js";
import { K, offer } from "./stances.js";
import { DIFFICULTY_FACTOR } from "./types.js";
import type { Beat, Run, Thread } from "./types.js";

export interface Blueprint {
  /** What closes the scene: the player picks a stance, picks an option, or the code tests a condition. */
  end: "stance" | "pick" | "check";
  title: (k: PlaceKit) => string;
  room: (k: PlaceKit, t?: Thread) => string;
  people: (k: PlaceKit, g: Run, t?: Thread) => string[];
  /** One line per part (3-6 parts). */
  goals: string[];
  picks?: { id: string; text: string }[];
  /** `check` end: does the condition hold? */
  check?: (g: Run, t?: Thread) => boolean;
  /** End line of the scene; `check` scenes use [fail, pass]. */
  outcome?: string[];
}

// ponytail: blueprints live here only, a kit cannot add its own yet. Add `blueprints` to PlaceKit when a kit needs one.
export const BLUEPRINTS: Record<string, Blueprint> = {
  arrival: {
    end: "stance",
    title: (k) => `Arrival at ${k.name}`,
    room: (k) => `${k.bossTitle}'s office`,
    people: (k, g) => [...new Set([g.deputy, k.guidedLetters[0]!.person])],
    goals: [
      "You walk in and meet your deputy.",
      "Your deputy shows you the desk, the key and the letters.",
      "A first problem walks in before you sit down.",
    ],
  },
  hearing: {
    end: "stance",
    title: () => "Board hearing",
    room: (k) => k.hearing.body,
    people: (_k, g) => g.hearingBody.map((m) => m.id),
    goals: [
      "The board reads the charge against you.",
      "You answer the charge in front of the board.",
      "Each member has a last word before the vote.",
    ],
  },
  storm: {
    end: "pick",
    title: (k) => `A bad night at ${k.name}`,
    room: (k) => k.name,
    people: (_k, g, t) => (t?.people.length ? t.people.slice(0, 3) : [g.deputy]),
    goals: [
      "The warning comes in.",
      "Everyone gathers to wait it out.",
      "The worst of it hits, and you must choose what to save.",
    ],
    picks: [
      { id: "work", text: "Save the work first." },
      { id: "people", text: "Get everyone to safety first." },
      { id: "split", text: "Split the crew and save a bit of both." },
    ],
    outcome: ["The night is over. The place is still standing."],
  },
  // T5: a family evening. The choice costs no hours (decision 6); the stance is the whole cost.
  family: {
    end: "stance",
    title: () => "A family evening",
    room: () => "The family table",
    people: (_k, g, t) => (t?.people.length ? t.people.slice(0, 3) : [g.deputy]),
    goals: [
      "You get home late. Dinner is already on the table.",
      "Someone asks how work is going.",
      "The phone buzzes. Work wants you back.",
    ],
    outcome: ["The evening ends. Your family remembers how you spent it."],
  },
  // M4 T7: the last night of the year in a Horror run. The result is the check.
  final_night: {
    end: "check",
    title: (k) => `The final night at ${k.name}`,
    room: (k) => k.name,
    people: (_k, g, t) => (t?.people.length ? t.people.slice(0, 3) : [g.deputy]),
    goals: [
      "The lamps go out one by one.",
      "Everyone gathers in the main room.",
      "Something knocks from the sealed side of the house.",
      "Morning comes, or it does not.",
    ],
    check: (g) => g.meters.people >= 50 && Object.values(g.people).every((p) => p.status !== "missing"),
    outcome: ["The night wins. The place stays dark for a long time.", "The sun comes up. Everyone is still here."],
  },
  // T4: nights of the Season and Big event blocks (blocks.ts). The result is the check, not the end.
  match_night: {
    end: "check",
    title: () => "Match night",
    room: () => "The quay",
    people: (_k, g, t) => (t?.people.length ? t.people.slice(0, 3) : [g.deputy]),
    goals: [
      "The squad waits on the quay in the cold.",
      "The line-up goes up on the wall. Everyone has an opinion.",
      "The race starts.",
    ],
    check: (g, t) => g.meters[t?.need ?? "standing"] >= 50,
    outcome: ["The squad loses. The quay goes quiet.", "The squad wins. The whole quay cheers."],
  },
  party: {
    end: "pick",
    title: () => "The big night",
    room: (k) => k.name,
    people: (_k, g, t) => (t?.people.length ? t.people.slice(0, 3) : [g.deputy]),
    goals: [
      "The first guests arrive.",
      "Someone expects a speech from you.",
      "A quiet corner fills up with people who need a word.",
      "The last drink is poured.",
      "The evening ends. You decide how to close it.",
    ],
    picks: [
      { id: "toast", text: "Raise a last glass with everyone." },
      { id: "quiet", text: "Thank the staff and let the guests drift out." },
    ],
    check: (g, t) => g.meters[t?.need ?? "people"] >= 50,
    outcome: ["The night falls flat. People leave early.", "The night is a success. People talk about it for weeks."],
  },
  accusation: {
    end: "check",
    title: () => "The accusation",
    room: (k) => k.name,
    people: (_k, g, t) => (t?.people.length ? t.people.slice(0, 3) : [g.deputy]),
    goals: [
      "Everyone comes into one room.",
      "You lay out what you found.",
      "You name the person.",
      "They give their answer.",
    ],
    // The proof counts: at least one earlier card of this story was answered well.
    check: (_g, t) => (t?.beats.filter((b) => b.result === "good").length ?? 0) >= 1,
    outcome: [
      "The room does not believe you. The matter stays open and it costs you.",
      "The room goes quiet. They believe you.",
    ],
  },
  // T14: out of the office (outside.ts). The people and the room come in on a stage thread.
  trip: {
    end: "pick",
    title: (k) => `A trip with ${k.name}`,
    room: (k, t) => t?.title ?? k.name,
    people: (_k, _g, t) => t?.people.slice(0, 4) ?? [],
    goals: [
      "You all leave the office behind. The air is different out here.",
      "Someone laughs at something small. The mood lifts.",
      "A quiet moment. People talk about things they never say at work.",
      "The way back is slow. Nobody wants to be the first to mention Monday.",
    ],
    picks: [
      { id: "easy", text: "Keep it easy and let the day be a day off" },
      { id: "work", text: "Use the day to talk about work" },
    ],
  },
  after_work: {
    end: "pick",
    title: () => "After work",
    room: (k, t) => t?.title ?? k.name,
    people: (_k, _g, t) => t?.people ?? [],
    goals: [
      "The day is over. Someone asks if you want to come along.",
      "The table is full of people who are not at work.",
      "Someone tells a story that is nearly true.",
    ],
    picks: [
      { id: "go", text: "Go along" },
      { id: "decline", text: "Decline and go home" },
    ],
  },
  walk: {
    end: "pick",
    title: () => "Walk and talk",
    room: (k, t) => t?.title ?? k.name,
    people: (_k, _g, t) => t?.people.slice(0, 1) ?? [],
    goals: [
      "You walk the floor together. Your guest talks while you look at the rooms.",
      "They slow down. There is something they wanted to say.",
      "You reach the end of the walk.",
    ],
    picks: [
      { id: "listen", text: "Listen" },
      { id: "share", text: "Tell them what is on your mind" },
    ],
  },
};

/** The answers a part offers, as ids. Only the last part follows the blueprint end; earlier parts offer stances. */
export const choices = (bp: Blueprint, h: { rng: number }, authority: Run["authority"], last: boolean): string[] =>
  !last || bp.end === "stance"
    ? offer(h, authority).map((a) => a.stance)
    : bp.end === "pick"
      ? bp.picks!.map((p) => p.id)
      : [];

/** Big scenes per week: Calm 1, Classic 2, Chaos 2. */
export const bigBudget = (s: Run) => (s.storyteller === "calm" ? 1 : 2);

const isBig = (b: Beat) => b.type === "big_scene";
const pendingBig = (s: Run) =>
  Object.values(s.threads).flatMap((t) => t.beats.filter((b) => isBig(b) && !b.result && b.planned && b.blueprint));
const at = (idx: number) => ({ week: Math.floor(idx / DAYS) + 1, day: idx % DAYS });
const idxOf = (p: { week: number; day: number }) => dayIndex(p);

/** Scenes already used or booked in a week. */
const usedIn = (s: Run, week: number) =>
  (s.bigScenes.week === week ? s.bigScenes.used : 0) + pendingBig(s).filter((b) => b.planned!.week === week).length;

/** Pending big scenes that land today: each takes one card off the day. */
export const bigToday = (s: Run) => pendingBig(s).filter((b) => idxOf(b.planned!) === dayIndex(s.clock)).length;

/**
 * Books a big scene on a thread, at least 2 days ahead, never two on one day, never past the weekly budget.
 * A full week defers it to the next week. Returns null when the thread clock runs out first (the thread then plays as normal beats).
 */
export function bookBigScene(s: Run, t: Thread, blueprint: string, wantIdx = 0): Beat | null {
  const dueWeek = typeof t.clock.dueWeek === "number" ? t.clock.dueWeek : Infinity;
  const taken = new Set(pendingBig(s).map((b) => idxOf(b.planned!)));
  for (let idx = Math.max(wantIdx, dayIndex(s.clock) + 2); ; idx++) {
    const p = at(idx);
    if (p.week > Math.min(dueWeek, WEEKS)) return null;
    if (taken.has(idx) || usedIn(s, p.week) >= bigBudget(s)) continue;
    const beat: Beat = { id: newId(s, "b"), type: "big_scene", planned: p, blueprint };
    t.beats.push(beat);
    return beat;
  }
}

/** Thread kinds that end on a big scene, and which one. */
const CLIMAX: Partial<Record<Thread["kind"], string>> = { mystery: "accusation", crisis: "storm" };

/** Morning: a thread near its end gets its climax booked on the day of its last beat. */
export function bookClimaxes(s: Run) {
  for (const t of Object.values(s.threads)) {
    const blueprint = CLIMAX[t.kind];
    if (!blueprint || t.beats.some(isBig)) continue;
    const last = Math.max(-1, ...t.beats.filter((b) => b.planned).map((b) => idxOf(b.planned!)));
    if (last >= dayIndex(s.clock) + 2) bookBigScene(s, t, blueprint, last);
  }
}

/** Settles a beat. Declined and missed scenes count against the week like played ones. */
export function settleBig(s: Run, beat: Beat, result: "done" | "declined" | "missed") {
  beat.result = result;
  const week = beat.planned!.week;
  s.bigScenes = { week, used: (s.bigScenes.week === week ? s.bigScenes.used : 0) + 1 };
  const t = Object.values(s.threads).find((x) => x.beats.includes(beat));
  if (t?.system !== undefined && result !== "done") endNight(s, t, false);
  // A family thread is only its evening, so the thread ends with the scene.
  else if (t?.layer === "family") closeThread(s, t.id, result === "done" ? "won" : "dropped");
}

/** The live night of a block thread has a result: the need meter moves (content.md 1.1: half k for a win, k for a loss), the fixture is marked and the thread closes. */
function endNight(s: Run, t: Thread, ok: boolean) {
  const k = K[t.severity ?? 2];
  const need = t.need ?? "standing";
  s.meters = applyDelta(s.meters, { [need]: ok ? Math.round(k / 2) : -k }, DIFFICULTY_FACTOR[s.difficulty]);
  const f = s.systems[t.system!]?.fixtures?.find((x) => x.week === (t.clock.dueWeek as number) - 1);
  if (f) f.won = ok;
  closeThread(s, t.id, ok ? "won" : "lost");
}

/** Morning: a booked scene whose day has passed was missed. */
export function lapse(s: Run) {
  for (const b of pendingBig(s)) if (idxOf(b.planned!) < dayIndex(s.clock)) settleBig(s, b, "missed");
}

/** The scene due today, with its thread. */
export function dueBig(s: Run): { beat: Beat; thread: Thread } | null {
  for (const thread of Object.values(s.threads)) {
    const beat = thread.beats.find((b) => isBig(b) && !b.result && b.planned && idxOf(b.planned) === dayIndex(s.clock));
    if (beat) return { beat, thread };
  }
  return null;
}

/** The scene is over: settle the beat; a `check` end also wins or loses the thread. Returns the outcome line. */
export function finishBig(s: Run, beatId: string): string | undefined {
  const found = Object.values(s.threads)
    .map((thread) => ({ thread, beat: thread.beats.find((b) => b.id === beatId) }))
    .find((x) => x.beat);
  if (!found) return undefined;
  const bp = BLUEPRINTS[found.beat!.blueprint ?? ""];
  settleBig(s, found.beat!, "done");
  if (found.beat!.blueprint) countEvent(s, found.beat!.blueprint, found.thread.title);
  if (found.thread.system !== undefined) {
    const ok = bp!.check!(s, found.thread);
    endNight(s, found.thread, ok);
    return bp!.outcome![ok ? 1 : 0];
  }
  if (bp?.end !== "check") return bp?.outcome?.[0];
  const ok = bp.check!(s, found.thread);
  closeThread(s, found.thread.id, ok ? "won" : "lost");
  return bp.outcome?.[ok ? 1 : 0];
}
