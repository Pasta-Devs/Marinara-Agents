// ──────────────────────────────────────────────
// Big Cheese M4 T9: the 15 endings (content.md 10.1, README Core loop step 5)
// ──────────────────────────────────────────────
// Every way a run stops maps to one ending. The code fills the epilogue with real names, so a
// placeholder is never empty. Coup, School closed, Promoted away and Merger have no trigger the
// code can see yet: their rows are here for the table, nothing ends a run with them.
import { unlockAchievements, unlocked } from "./achievements.js";
import type { PlaceKit } from "./kits/types.js";
import { WEEKS, isFriday } from "./clock.js";
import { METERS, type Run } from "./types.js";

export const ENDINGS = {
  win: {
    title: "Win the year",
    text: "{boss} led {place} for a full year. {deputy} gave a speech. {tradition} grew into a custom.",
  },
  fired: { title: "Fired", text: "The board thanked {boss} and sent a box for the desk. {deputy} took the keys." },
  voted_out: { title: "Voted out", text: "{deputy} won by {n} votes. {boss} left by the side door." },
  quit: { title: "Quit", text: "{boss} walked out at noon. {person} still keeps their mug." },
  sold: { title: "Sold the place", text: "{place} got a new name. {person} cried, then asked for a raise." },
  overthrown: { title: "Overthrown", text: "The gates opened from inside. {deputy} read the new decree." },
  coup: { title: "Coup", text: "{enforcer} held the keys at dawn. {boss} left with one bag." },
  marooned: { title: "Marooned", text: "They left {boss} on a small island with a flag and a bottle." },
  closed: { title: "School closed", text: "{place} closed in spring. {person} kept the bell." },
  abdication: { title: "Abdication", text: "{boss} handed the crown to {heir}. The feast lasted three days." },
  promoted: { title: "Promoted away", text: "{boss} moved up. {deputy} inherited a good place and a bad habit." },
  merger: { title: "Merger", text: "{place} became part of {rival}. {person} liked the new coffee." },
  burnout: { title: "Burnout", text: "{boss} took a long rest. The place ran on without them." },
  scandal: { title: "Scandal", text: "The paper ran the story on page one. {boss} said nothing for a week." },
  legend: { title: "Legend", text: "People still talk about {boss}. A plaque hangs in {room}." },
} satisfies Record<string, { title: string; text: string }>;
export type EndingId = keyof typeof ENDINGS;

/** README: at least 2 of the 3 goals met in every term (`goals[].met` is set by T8 at each term end). */
export const wonYear = (s: Run) => [1, 2, 3].every((t) => (s.goals.find((g) => g.term === t)?.met.length ?? 0) >= 2);

/** The ending of a finished run, or null (still playing, or a year kept without a win). */
export function endingIdOf(s: Run): EndingId | null {
  if (s.status === "playing") return null;
  if (s.endingId && s.endingId in ENDINGS) return s.endingId as EndingId;
  if (s.status === "complete") return wonYear(s) ? "win" : null;
  // A lost hearing or a lost revolt: the kit names its own ending.
  const e = s.ending ?? "";
  return /maroon/i.test(e)
    ? "marooned"
    : /overthrow/i.test(e)
      ? "overthrown"
      : /remov|vote/i.test(e)
        ? "voted_out"
        : "fired";
}

function finish(s: Run, id: EndingId, status: Run["status"] = "ended") {
  s.status = status;
  s.endingId = id;
  if (status === "ended") s.ending = ENDINGS[id].title; // `ending` is the way a run was lost; a good end leaves it null
}

/** The player leaves: quits, sells the place or steps down for the heir (the deputy if none is named). */
export function leaveRun(s: Run, kind: "quit" | "sell" | "abdicate") {
  if (s.status !== "playing") throw new Error("This run is over.");
  finish(s, { quit: "quit", sell: "sold", abdicate: "abdication" }[kind] as EndingId);
}

/** Last Friday check of the Burnout, Scandal and Legend rules, then the achievements. */
export function judgeRun(s: Run) {
  if (s.status === "playing") {
    const lost = s.closed.some((c) => c.layer === "crime" && c.state === "lost");
    if (s.mode !== "sandbox" && s.boss.weeksAt100 >= 2) finish(s, "burnout");
    else if (s.mode !== "sandbox" && lost && s.meters.standing < 20) finish(s, "scandal");
    // Legend is a year-end ending: it never cuts the year short.
    else if (
      s.mode !== "sandbox" &&
      s.clock.week >= WEEKS &&
      isFriday(s.clock) &&
      s.meterHistory.length >= 8 &&
      s.meterHistory.slice(-8).every((h) => METERS.every((m) => h[m] > 70))
    )
      finish(s, "legend", "complete");
  }
  unlockAchievements(s);
}

/** The ending card of a finished run: title, filled epilogue and unlocked achievements. */
export function endView(s: Run, kit: PlaceKit) {
  const id = endingIdOf(s);
  const name = (p?: string) => (p && (s.people[p]?.name ?? kit.people.find((k) => k.id === p)?.name)) || p || "";
  const person = Object.keys(s.people)
    .filter((p) => (s.people[p]!.status ?? "active") === "active")
    .sort((a, b) => s.people[b]!.trust - s.people[a]!.trust)[0];
  const h = s.lastHearing;
  const v: Record<string, string> = {
    boss: kit.boss?.name || kit.bossTitle,
    place: kit.name,
    deputy: name(s.deputy) || "the deputy",
    heir: name(s.legacy?.heir ?? s.deputy) || "the deputy",
    person: name(person) || name(s.deputy) || "the deputy",
    tradition: s.traditions.find((t) => t.active)?.text || "A small habit",
    n: String(h ? Math.max(1, h.of - h.backing) : 1),
    enforcer: name(s.deputy) || "the deputy",
    rival: "a rival",
    room: (kit.rooms.find((r) => r.kind === "social") ?? kit.rooms[0])?.name ?? kit.name,
  };
  return {
    id,
    title: id ? ENDINGS[id].title : "",
    text: id ? ENDINGS[id].text.replace(/\{(\w+)\}/g, (_, k: string) => v[k] || k) : "",
    achievements: unlocked(s),
  };
}
