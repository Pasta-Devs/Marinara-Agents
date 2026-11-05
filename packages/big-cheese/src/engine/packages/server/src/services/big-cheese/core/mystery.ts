// ──────────────────────────────────────────────
// Big Cheese M4 T4: Mystery layer and investigating (modules.md section 2, design.md 3.2, 10.1)
// ──────────────────────────────────────────────
// One case thread per term: 3 suspects, one culprit in `stakes` ("culprit:<id>"), clue beats, and the
// existing accusation big scene at the end. Each clue (1 hour) clears a suspect. An accusation
// closes the case: the culprit wins it, anyone else loses it.
import type { PlaceKit } from "./kits/types.js";
import { term } from "./clock.js";
import { crimeEvidence } from "./crime.js";
import { pick, roll } from "./rng.js";
import { addTrust, applyDelta, pure, spendHour } from "./run.js";
import { K } from "./stances.js";
import { closeThread, openStory } from "./threads.js";
import { DIFFICULTY_FACTOR, type Run } from "./types.js";

const CHANCE = 0.5;
const CASES = ["Something went missing", "Someone leaks the plans", "A strange note on the desk"];
const CULPRIT = "culprit:";

const isCase = (t: { layer?: unknown; kind: string }) => t.layer === "mystery" && t.kind === "mystery";

/** Monday: maybe open this term's case when none is open. */
export function mysterySeeds(s: Run) {
  const d = s.layers?.mystery ?? 0; // opt-in: no dial, no case
  const key = `mystery.${term(s.clock)}`;
  if (!d || s.tally[key] || Object.values(s.threads).some(isCase) || roll(s) >= (d / 100) * CHANCE) return;
  const live = Object.keys(s.people).filter((id) => s.people[id]!.status === "active");
  if (live.length < 2) return;
  const suspects: string[] = [];
  while (suspects.length < 3 && live.length > suspects.length)
    suspects.push(
      pick(
        s,
        live.filter((id) => !suspects.includes(id)),
      ),
    );
  s.tally[key] = 1;
  const t = openStory(s, "mystery", {
    title: pick(s, CASES),
    need: "standing",
    people: suspects,
    severity: 2,
    stakes: CULPRIT + pick(s, suspects),
    origin: "arc",
  });
  t.layer = "mystery";
}

export const isCleared = (s: Run, threadId: string, person: string) => !!s.tally[`clear.${threadId}.${person}`];

const hasDetective = (s: Run, kit: PlaceKit) =>
  kit.people.some((p) => /detective/i.test(p.role) && s.people[p.id]?.status === "active");

/**
 * Plays the next clue beat (1 hour). On a case it clears a suspect (two with a detective); on a
 * cover-up it puts the evidence in the drawer. With `accuse` it closes the case instead (no hour).
 */
export function investigate(s: Run, kit: PlaceKit, id: string, accuse?: string) {
  const t = s.threads[id];
  if (!t || t.state !== "open" || (t.kind !== "mystery" && t.kind !== "cover_up"))
    throw new Error("There is nothing to investigate there.");
  const culprit = t.stakes?.startsWith(CULPRIT) ? t.stakes.slice(CULPRIT.length) : undefined;
  if (accuse !== undefined) {
    if (!culprit || !t.people.includes(accuse)) throw new Error("That person is not a suspect.");
    const right = accuse === culprit;
    const k = K[t.severity ?? 2];
    s.meters = applyDelta(s.meters, { [t.need ?? "standing"]: right ? k : -k }, DIFFICULTY_FACTOR[s.difficulty]);
    if (!right) addTrust(s, accuse, -Math.round(10 * DIFFICULTY_FACTOR[s.difficulty]));
    closeThread(s, id, right ? "won" : "lost");
    return;
  }
  const clue = t.beats.find((b) => b.type === "check" && !b.result);
  if (!clue) throw new Error("There are no clues left.");
  spendHour(s);
  clue.result = "good";
  delete clue.planned; // played now, so it does not land again
  if (t.kind === "cover_up") return crimeEvidence(s, id, t.title, t.people[0]);
  const open = t.people.filter((p) => p !== culprit && !isCleared(s, id, p));
  for (let i = hasDetective(s, kit) ? 2 : 1; i > 0 && open.length; i--)
    s.tally[`clear.${id}.${open.splice(Math.floor(roll(s) * open.length), 1)[0]}`] = 1;
}

export const pureInvestigate = pure(investigate);
