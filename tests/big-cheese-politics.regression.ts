import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import {
  proposalVote,
  ruleOption,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/authority.js";
import {
  backCandidate,
  electionVote,
  isElection,
  lawArrives,
  politicsSeeds,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/politics.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import type { Run } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/types.js";

const run = (politics: number, seed = 1) => {
  const s = core.newRun(HAFENKAI_PLACE, seed);
  s.layers = { politics };
  return s;
};
const elections = (s: Run) => Object.values(s.threads).filter(isElection);
const open = (s: Run) => {
  for (let i = 0; i < 60 && !elections(s).length; i++) politicsSeeds(s);
  return elections(s)[0]!;
};

test("dial 0 opens no election and no law", () => {
  const s = run(0);
  for (let i = 0; i < 60; i++) politicsSeeds(s);
  for (let i = 0; i < 60; i++) lawArrives(s, HAFENKAI_PLACE);
  assert.equal(Object.values(s.threads).filter((t) => t.layer === "politics").length, 0);
});

test("dial 100 opens one election per term with two candidates and 2-3 campaign beats", () => {
  const s = run(100);
  for (let i = 0; i < 60; i++) politicsSeeds(s);
  const [e, ...rest] = elections(s);
  assert.equal(rest.length, 0);
  assert.equal(e!.people.length, 2);
  assert.ok(e!.beats.length >= 2 && e!.beats.length <= 3);
});

test("backing a candidate moves trust once and costs no hour", () => {
  const s = run(100);
  const e = open(s);
  const [a, b] = e.people as [string, string];
  const [ta, tb, hours] = [s.people[a]!.trust, s.people[b]!.trust, s.clock.hoursLeft];
  backCandidate(s, e.id, a);
  assert.equal(s.people[a]!.trust, Math.min(100, ta + 5));
  assert.equal(s.people[b]!.trust, Math.max(0, tb - 5));
  assert.equal(s.clock.hoursLeft, hours);
  assert.throws(() => backCandidate(s, e.id, b), /already backed/);
});

test("backing a candidate costs the other one more trust on hard", () => {
  const s = run(100);
  s.difficulty = "hard";
  const e = open(s);
  const [a, b] = e.people as [string, string];
  const tb = s.people[b]!.trust;
  backCandidate(s, e.id, a);
  assert.equal(s.people[b]!.trust, Math.max(0, tb - 6));
});

test("the vote seats the favourite on a pass and the other candidate on a fail", () => {
  for (const passed of [true, false]) {
    const s = run(100);
    const e = open(s);
    const [a, b] = e.people as [string, string];
    backCandidate(s, e.id, a);
    const [ta, tb] = [s.people[a]!.trust, s.people[b]!.trust];
    electionVote(s, e.id, passed);
    assert.equal(s.threads[e.id], undefined);
    assert.equal(s.people[passed ? a : b]!.trust, Math.min(100, (passed ? ta : tb) + 5));
  }
});

test("an election waits for its campaign, then reaches the meeting agenda", () => {
  const s = run(100);
  const e = open(s);
  s.clock.hoursLeft = 5;
  assert.ok(!core.startMeeting(s, "board", HAFENKAI_PLACE).meeting!.items.some((i) => i.thread === e.id));
  for (const b of e.beats) delete b.planned;
  const g = core.startMeeting(s, "board", HAFENKAI_PLACE);
  const m = g.meeting!;
  assert.equal(m.items[0]!.thread, e.id);
  const done = core.meetingChoice(g, m.items[0]!.offer[0]!.stance, HAFENKAI_PLACE);
  assert.equal(done.threads[e.id], undefined);
});

test("an outside law sets its house rule when the vote passes", () => {
  const s = run(100);
  for (let i = 0; i < 60 && !Object.values(s.threads).some((t) => t.rule); i++) lawArrives(s, HAFENKAI_PLACE);
  const t = Object.values(s.threads).find((x) => x.rule)!;
  assert.equal(t.layer, "politics");
  const rule = HAFENKAI_PLACE.houseRules.find((r) => r.id === t.rule!.id)!;
  assert.notEqual(ruleOption(s, rule), t.rule!.option);
  proposalVote(s, HAFENKAI_PLACE, t.id, true);
  assert.equal(ruleOption(s, rule), t.rule!.option);
});
