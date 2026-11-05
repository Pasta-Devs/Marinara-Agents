import { kitOf } from "./people.js";
import { addTrust, applyDelta, pure, spendHour } from "./run.js";
import { roll } from "./rng.js";
import { effect, offer, type Stance } from "./stances.js";
import { closeThread, planCardBeat, storyBeat } from "./threads.js";
import { METERS } from "./types.js";
import type { Authority, Meeting, MeetingItem, Run, Severity } from "./types.js";

// Meetings (design.md section 7, content.md section 13). The code picks the people, the agenda,
// the stances and every number; the model only writes the lines.

export interface MeetingType {
  mode: Meeting["mode"];
  size: [number, number];
}

// Attendee counts and result type from content.md section 13.
export const MEETINGS: Record<string, MeetingType> = {
  board: { mode: "vote", size: [4, 6] },
  all_hands: { mode: "agreement", size: [5, 6] },
  union_talks: { mode: "agreement", size: [3, 4] },
  safety_audit: { mode: "vote", size: [3, 4] },
  investor_pitch: { mode: "vote", size: [3, 4] },
  parent_forum: { mode: "agreement", size: [3, 5] },
  senate: { mode: "vote", size: [4, 6] },
  royal_council: { mode: "vote", size: [4, 6] },
  crew_vote: { mode: "vote", size: [4, 6] },
  prefects: { mode: "vote", size: [4, 5] },
  handover: { mode: "agreement", size: [4, 6] },
  outsiders: { mode: "agreement", size: [3, 4] },
};

// Which meetings each kind of boss can call. The Hafenkai kit is a manager.
export const MEETING_KINDS: Record<Authority, string[]> = {
  manager: ["board", "all_hands", "union_talks", "safety_audit", "investor_pitch", "handover", "outsiders"],
  strong_leader: ["board", "parent_forum", "senate", "crew_vote"],
  absolute: ["royal_council", "prefects", "handover", "outsiders"],
};

// Trait -> [stances they like, stances they dislike]. Fit is +2 / -2 per trait, kept in -3..+3.
const TASTE: Record<string, [Stance[], Stance[]]> = {
  frugal: [["cheap_fix", "delay"], ["invest"]],
  generous: [["invest"], ["refuse", "cheap_fix"]],
  cautious: [["delay", "ask_others"], ["invest"]],
  "hot-headed": [
    ["refuse", "invest"],
    ["delay", "ask_others"],
  ],
  stubborn: [["refuse"], ["ask_others", "delegate"]],
  loyal: [["ask_others"], ["refuse"]],
  ambitious: [["invest", "delegate"], ["delay"]],
  easygoing: [["delay", "delegate"], ["refuse"]],
  perfectionist: [["invest"], ["cheap_fix"]],
  strict: [["refuse"], ["delegate"]],
  nurturing: [["invest", "ask_others"], ["refuse"]],
  brave: [["invest", "refuse"], ["delay"]],
  rebel: [["refuse"], ["ask_others"]],
};

/** Stance fit, -3..+3, from the person's traits and ambition. */
export function fit(s: Run, id: string, stance: string): number {
  const traits = kitOf(s).people.find((p) => p.id === id)?.traits ?? [];
  let f = 0;
  for (const t of traits) {
    const [like, dislike] = TASTE[t] ?? [[], []];
    if ((like as string[]).includes(stance)) f += 2;
    if ((dislike as string[]).includes(stance)) f -= 2;
  }
  if ((s.people[id]?.ambition ?? 0) >= 60) f += stance === "invest" ? 1 : stance === "delay" ? -1 : 0;
  return Math.max(-3, Math.min(3, f));
}

/** Faction bonus, -2..+2. Only the deputy has a faction in M1: a greedy deputy works against the boss. */
export const faction = (s: Run, id: string): number =>
  id === s.deputy ? -Math.min(2, Math.floor(s.deputyAmbition / 40)) : 0;

/** One attendee's score on one item (design.md 7.2). `extra` is the +3 for an evidence card or a witness. */
export const support = (s: Run, id: string, fitScore: number, factionScore = 0, extra = 0): number =>
  ((s.people[id]?.trust ?? 50) - 50) / 5 + fitScore + factionScore + extra;

/** A vote passes at more than half of attendees above 0; an agreement at a total of 0 or more. */
export const passes = (mode: Meeting["mode"], scores: number[]): boolean =>
  mode === "vote" ? scores.filter((v) => v > 0).length > scores.length / 2 : scores.reduce((a, v) => a + v, 0) >= 0;

const ROOM_OK = (s: Run, id: string) => s.people[id]?.status === "active";

function agenda(s: Run, kind: string): Omit<MeetingItem, "offer" | "base" | "lines" | "suggestions">[] {
  const kit = kitOf(s);
  const items: ReturnType<typeof agenda> = [];
  if (kind === "board" && s.deputyAmbition >= 100) {
    items.push({ id: "deputy", title: "The deputy's challenge", deputy: true, need: "standing", severity: 2 });
  }
  const open = Object.values(s.threads)
    .filter((t) => t.state === "open" && t.kind !== "guided" && t.kind !== "hearing" && t.kind !== "promise")
    .sort(
      (a, b) =>
        Number(b.beats.some((x) => x.type === "meeting_item")) - Number(a.beats.some((x) => x.type === "meeting_item")),
    );
  for (const t of open) {
    if (items.length >= 3) break;
    items.push({
      id: t.id,
      title: t.title ?? t.kind,
      thread: t.id,
      need: t.need ?? "people",
      severity: t.severity ?? 1,
    });
  }
  const low = [...METERS].sort((a, b) => s.meters[a] - s.meters[b]);
  for (let i = 0; items.length < 2; i++) {
    const need = low[i % low.length]!;
    items.push({ id: `goal${i}`, title: `Term goal: ${kit.meters[need].label}`, need, severity: 1 as Severity });
  }
  return items;
}

/** Opens a meeting: attendees (3-6), agenda (2-3 items), three stances per item. Costs 1 hour. */
export function startMeeting(s: Run, kind: string) {
  if (!Object.hasOwn(MEETINGS, kind) || !MEETING_KINDS[s.authority].includes(kind))
    throw new Error("Not a meeting you can call");
  if (s.meeting && !s.meeting.done) throw new Error("A meeting is already open");
  spendHour(s);
  const def = MEETINGS[kind]!;
  const items = agenda(s, kind);
  const want = def.size[0] + Math.floor(roll(s) * (def.size[1] - def.size[0] + 1));
  const first = [s.deputy, ...items.flatMap((i) => (i.thread ? s.threads[i.thread]!.people : []))];
  const rest = Object.keys(s.people).sort(() => roll(s) - 0.5);
  const people = [...new Set([...first, ...rest])].filter((id) => ROOM_OK(s, id)).slice(0, want);
  s.meeting = {
    kind,
    mode: def.mode,
    title: kind,
    people,
    done: false,
    items: items.map((i) => ({
      ...i,
      offer: offer(s, s.authority),
      base: Object.fromEntries(people.map((id) => [id, support(s, id, 0, faction(s, id))])),
      lines: [],
      suggestions: [],
    })),
  };
}

/** The model's words for the item that is up. */
export function meetingText(s: Run, lines: MeetingItem["lines"], suggestions: MeetingItem["suggestions"]) {
  const item = s.meeting?.items.find((i) => i.chosen === undefined);
  if (!item) throw new Error("No meeting is open");
  item.lines = lines;
  item.suggestions = suggestions;
}

/** The boss answers the item that is up: score every attendee, then apply the result. */
export function meetingChoice(s: Run, stance: string) {
  const m = s.meeting;
  const item = m && !m.done ? m.items.find((i) => i.chosen === undefined) : undefined;
  if (!m || !item) throw new Error("No meeting is open");
  if (!item.offer.some((a) => a.stance === stance)) throw new Error(`Stance ${stance} is not offered`);
  item.chosen = stance;
  item.scores = Object.fromEntries(m.people.map((id) => [id, support(s, id, fit(s, id, stance), faction(s, id))]));
  item.passed = passes(m.mode, Object.values(item.scores));
  for (const id of m.people) {
    const v = item.scores[id]!;
    addTrust(s, id, Math.sign(v));
    const mem = s.people[id]?.memories;
    mem?.push({ week: s.clock.week, about: item.id, thread: item.thread ?? "", stance, weight: 1 });
    if (mem && mem.length > 5) mem.shift();
  }
  if (item.deputy) {
    if (!item.passed) s.meters = applyDelta(s.meters, { standing: -10, people: -5 });
    s.deputyAmbition = 0;
  } else if (item.passed) {
    s.meters = applyDelta(s.meters, effect({ need: item.need, severity: item.severity }, stance));
  }
  const t = item.thread ? s.threads[item.thread] : undefined;
  if (t) {
    const b = t.beats.find((x) => x.type === "meeting_item" && x.planned);
    if (b) {
      delete b.planned;
      b.card = item.id;
      storyBeat(s, t, item.id, item.passed);
    } else if (t.kind === "follow_up") {
      if (item.passed) closeThread(s, t.id, "won");
      else planCardBeat(s, t, { need: item.need, severity: item.severity }, 1);
    }
  }
  m.done = m.items.every((i) => i.chosen !== undefined);
}

export const pureStartMeeting = pure(startMeeting);
export const pureMeetingText = pure(meetingText);
export const pureMeetingChoice = pure(meetingChoice);
