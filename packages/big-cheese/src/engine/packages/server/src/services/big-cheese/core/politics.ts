// Layer: Politics (modules.md section 2, design.md section 7)
// An election thread holds two candidates and a short campaign; the vote is a normal meeting item.
// Election state lives in the thread: `stakes` is "election", or "election:<person>" once the boss backs one.
// An outside law is a thread with a `rule`, so the existing proposal vote sets the house rule.
import type { PlaceKit } from "./kits/types.js";
import { ruleOption } from "./authority.js";
import { term } from "./clock.js";
import { pick, roll } from "./rng.js";
import { addTrust, newId, pure } from "./run.js";
import { closeThread, openThread } from "./threads.js";
import { DIFFICULTY_FACTOR, type Run, type Thread } from "./types.js";

const dialOf = (s: Run) => s.layers?.politics ?? 0; // opt-in layer: no dial, no politics
/** Weekly chance at dial 100; at most one election and one outside law per term. */
const CHANCE = 0.5;
const TITLES = ["Who speaks for the staff?", "Who takes the open council seat?"];

export const isElection = (t: Thread) => t.layer === "politics" && !!t.stakes.startsWith("election");
const backedOf = (t: Thread) => t.stakes.slice(9);

/** An election is ready for a vote once its campaign beats have all landed. */
export const electionReady = (t: Thread) => !isElection(t) || t.beats.every((b) => !b.planned);

/** Monday: a dial above 0 may open this term's election (two active people, 2-3 campaign beats). */
export function politicsSeeds(s: Run) {
  const d = dialOf(s);
  const key = `politics.election.${term(s.clock)}`;
  if (!d || s.tally[key] || Object.values(s.threads).some(isElection) || roll(s) >= (d / 100) * CHANCE) return;
  const live = Object.keys(s.people).filter((id) => s.people[id]!.status === "active");
  if (live.length < 2) return;
  const a = pick(s, live);
  const b = pick(
    s,
    live.filter((id) => id !== a),
  );
  s.tally[key] = 1;
  const t = openThread(s, {
    kind: "personal_arc", // not follow_up: a thread with only check beats would close as won when they land
    title: pick(s, TITLES),
    origin: "arc",
    people: [a, b],
    need: "standing",
    severity: 2,
    stakes: "election",
    dueWeek: "open",
  });
  t.layer = "politics";
  const beats = 2 + (roll(s) < 0.5 ? 1 : 0);
  for (let i = 1; i <= beats; i++)
    t.beats.push({ id: newId(s, "b"), type: "check", planned: { week: s.clock.week + i, day: 2 } });
}

/** A meeting starts: an outside law may land on this term's table. Needs the kit for the rule options. */
export function lawArrives(s: Run, kit: PlaceKit) {
  const d = dialOf(s);
  const key = `politics.law.${term(s.clock)}`;
  if (!d || s.tally[key] || roll(s) >= (d / 100) * CHANCE) return;
  const r = pick(
    s,
    kit.houseRules.filter((x) => x.options.length > 1),
  );
  if (!r) return;
  const option = pick(
    s,
    r.options.filter((o) => o !== ruleOption(s, r)),
  );
  s.tally[key] = 1;
  const t = openThread(s, {
    kind: "follow_up",
    title: `Outside law: ${r.text}: ${option}`,
    origin: "arc",
    people: [],
    need: "standing",
    severity: 2,
  });
  t.layer = "politics";
  t.rule = { id: r.id, option };
}

/** The boss backs one candidate: trust +5 with them, -5 with the other. Costs no hour, works once. */
export function backCandidate(s: Run, threadId: string, person: string) {
  const t = s.threads[threadId];
  if (!t || t.state !== "open" || !isElection(t)) throw new Error("No such election");
  if (backedOf(t)) throw new Error("You already backed a candidate");
  if (!t.people.includes(person)) throw new Error("Not a candidate");
  t.stakes = `election:${person}`;
  for (const p of t.people) addTrust(s, p, p === person ? 5 : -Math.round(5 * DIFFICULTY_FACTOR[s.difficulty]));
}

/** The vote on an election item: a pass seats the favourite (the backed one, else the one with more trust), a fail seats the other. */
export function electionVote(s: Run, threadId: string | undefined, passed: boolean) {
  const t = threadId ? s.threads[threadId] : undefined;
  if (!t || !isElection(t)) return;
  const [a, b] = t.people as [string, string];
  const backed = backedOf(t);
  const fav = backed || ((s.people[a]?.trust ?? 0) >= (s.people[b]?.trust ?? 0) ? a : b);
  addTrust(s, passed ? fav : fav === a ? b : a, 5);
  closeThread(s, t.id, passed ? "won" : "lost");
}

export const pureBackCandidate = pure(backCandidate);
