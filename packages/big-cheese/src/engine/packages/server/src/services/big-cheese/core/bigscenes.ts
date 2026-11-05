// Big Cheese: big scenes (design.md section 3.8). Blueprints are data, the code books a scene
// onto a thread as a `big_scene` beat, keeps the weekly budget and settles the result.
import { DAYS, dayIndex, WEEKS } from "./clock.js";
import type { PlaceKit } from "./kits/types.js";
import { newId } from "./run.js";
import { closeThread } from "./threads.js";
import { offer } from "./stances.js";
import type { Beat, Run, Thread } from "./types.js";

export interface Blueprint {
  /** What closes the scene: the player picks a stance, picks an option, or the code tests a condition. */
  end: "stance" | "pick" | "check";
  title: (k: PlaceKit) => string;
  room: (k: PlaceKit) => string;
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
  if (bp?.end !== "check") return bp?.outcome?.[0];
  const ok = bp.check!(s, found.thread);
  closeThread(s, found.thread.id, ok ? "won" : "lost");
  return bp.outcome?.[ok ? 1 : 0];
}
