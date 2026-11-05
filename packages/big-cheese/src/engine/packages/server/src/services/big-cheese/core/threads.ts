import { DAYS, dayIndex } from "./clock.js";
import { roll } from "./rng.js";
import { addTrust, newId, pure } from "./run.js";
import type { Beat, Letter, Meter, Run, Severity, Thread } from "./types.js";

type Init = Pick<Thread, "kind" | "title" | "origin"> &
  Partial<Pick<Thread, "people" | "need" | "severity" | "stakes" | "promise">> & { dueWeek?: number | "open" };

export function openThread(s: Run, init: Init): Thread {
  const { dueWeek, ...rest } = init;
  const t: Thread = {
    id: newId(s, "t"),
    people: [],
    stakes: "",
    ...rest,
    clock: { dueWeek: dueWeek ?? "open", pressure: "quiet" },
    beats: [],
    state: "open",
  };
  return (s.threads[t.id] = t);
}

export function closeThread(s: Run, id: string, state: Thread["state"]) {
  const t = s.threads[id];
  if (!t) return;
  delete s.threads[id];
  // The title stays, so a person's memory of a closed thread can still name it.
  s.closed.push({ id, state, title: t.title, ...(t.need && { need: t.need }) });
  // Won or lost: everyone in the thread remembers it (design.md 3.2).
  if (state !== "dropped") {
    for (const p of t.people) {
      const mem = s.people[p]?.memories;
      mem?.push({ week: s.clock.week, about: t.title ?? t.kind, thread: id, stance: state, weight: 2 });
      if (mem && mem.length > 5) mem.shift();
    }
  }
}

// Beat plans (design.md 3.2): the code plans the types and days, the model only writes the words.
// shortcut: Beat has no moment or scene type yet, so those beats are code-only "check" beats; replace once types.ts has them.
const rep = (type: Beat["type"], n: number): Beat["type"][] => Array.from({ length: n }, () => type);
const SHAPES = (k: number): Partial<Record<Thread["kind"], [Beat["type"][], number, number]>> => ({
  crisis: [rep("card", 3), 1, 0], // 3 days in a row
  revolt: [rep("card", 3), 7, 0], // 3 weeks
  personal_arc: [[...rep("check", k - 1), "card"], 5, 6],
  mystery: [rep("check", k), 4, 4],
  cover_up: [["check", "card"], 3, 5],
  project: [["check", "card", "card", "card", "check"], 5, 3],
  wish: [rep("check", k - 2), 3, 4],
});

/** Opens a thread of a story kind with its beats planned from today. Needs `need` for card beats. */
export function openStory(s: Run, kind: Thread["kind"], init: Omit<Init, "kind">): Thread {
  const [types, gap, jitter] = SHAPES(3 + Math.floor(roll(s) * 3))[kind] ?? [[], 0, 0];
  const hard = kind === "crisis" || kind === "revolt";
  let day = dayIndex(s.clock);
  const beats = types.map((type): Beat => {
    day += gap + Math.floor(roll(s) * (jitter + 1));
    const planned = { week: Math.floor(day / DAYS) + 1, day: day % DAYS };
    const seed =
      type === "card" ? { need: init.need!, severity: hard ? (3 as Severity) : (init.severity ?? 2) } : undefined;
    return { id: newId(s, "b"), type, planned, ...(seed && { seed }) };
  });
  const last = beats.at(-1)?.planned?.week ?? s.clock.week;
  const t = openThread(s, {
    ...init,
    kind,
    dueWeek: kind === "revolt" ? s.clock.week + 3 : last + (kind === "crisis" ? 0 : 1),
  });
  t.beats = beats;
  return t;
}

/** A card beat of a story kind got its answer (or was ignored). Crisis: 2 good answers win, 2 bad lose. Cover-up: its one card decides. Project: 2 bad lose. */
export function storyBeat(s: Run, t: Thread, cardId: string, good: boolean) {
  const b = t.beats.find((x) => x.card === cardId);
  if (b) b.result = good ? "good" : "bad";
  const n = (r: string) => t.beats.filter((x) => x.result === r).length;
  const won = t.kind === "crisis" ? n("good") >= 2 : t.kind === "cover_up" && good;
  const lost = t.kind === "crisis" || t.kind === "project" ? n("bad") >= 2 : t.kind === "cover_up" && !good;
  if (won || lost) closeThread(s, t.id, won ? "won" : "lost");
}

// A follow-up is the next beat of the card's thread, planned for the same weekday some weeks later.
export function planCardBeat(s: Run, t: Thread, seed: { need: Meter; severity: Severity }, weeks: number) {
  t.beats.push({ id: newId(s, "b"), type: "card", planned: { week: s.clock.week + weeks, day: s.clock.day }, seed });
  t.clock = { dueWeek: s.clock.week + weeks, pressure: "building" };
}

// Promise thread: one check beat on the due date. Trust -8 when it is not kept by then.
export function openPromise(s: Run, p: { to: string; what: string; due: { week: number; day: number } }) {
  const t = openThread(s, {
    kind: "promise",
    title: p.what,
    people: [p.to],
    origin: "own_answer",
    dueWeek: p.due.week,
    promise: { ...p, kept: false },
  });
  t.beats.push({ id: newId(s, "b"), type: "check", planned: p.due });
}

export function keepPromise(s: Run, id: string) {
  const t = s.threads[id];
  if (t?.promise) t.promise.kept = true;
}

export function checkPromises(s: Run) {
  for (const t of Object.values(s.threads)) {
    if (!t.promise || dayIndex(t.promise.due) > dayIndex(s.clock)) continue;
    if (!t.promise.kept) addTrust(s, t.promise.to, -8);
    closeThread(s, t.id, t.promise.kept ? "won" : "lost");
  }
}

// Guided thread: letters are kit data. Never lost; won when the last letter is read.
export function openGuided(s: Run, letters: Letter[]) {
  const t = openThread(s, {
    kind: "guided",
    title: "Letters from the last boss",
    origin: "guided",
    people: [...new Set(letters.map((l) => l.person))],
    dueWeek: 1,
  });
  t.beats = letters.map((letter): Beat => ({
    id: newId(s, "b"),
    type: "letter",
    letter: structuredClone(letter),
    read: false,
  }));
}

// Letters that have arrived (Sunday = day -1 of week 1; all of them after week 1).
export function lettersUnlocked(s: Run): Letter[] {
  const g = Object.values(s.threads).find((t) => t.kind === "guided");
  return (g?.beats ?? []).flatMap((b) =>
    b.letter && (s.clock.week > 1 || b.letter.day <= s.clock.day) ? [b.letter] : [],
  );
}

export function readLetter(s: Run, index: number) {
  const g = Object.values(s.threads).find((t) => t.kind === "guided");
  const b = g?.beats[index];
  if (!g || !b?.letter) throw new Error("No such letter");
  if (!lettersUnlocked(s).includes(b.letter)) throw new Error("Letter has not arrived");
  b.read = true;
  if (g.beats.every((x) => x.read)) closeThread(s, g.id, "won");
}

export const pureOpenPromise = pure(openPromise);
export const pureKeepPromise = pure(keepPromise);
export const pureReadLetter = pure(readLetter);
