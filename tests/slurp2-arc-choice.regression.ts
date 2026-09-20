import assert from "node:assert/strict";

import {
  makeSlurpProject,
  readSlurpProject,
  slurpProjectRecord,
  type SlurpArcType,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-project.js";
import {
  slurpArcFanVotes,
  slurpProjectAdvance,
  slurpProjectChoose,
  slurpProjectDirect,
  slurpProjectInstruction,
  slurpProjectPollDue,
  slurpProjectTick,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-progress.js";
import {
  slurpArcTypeFromProject,
  slurpGeneratedArcProject,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-library.js";
import { slurp2Source } from "./slurp2-source";

const at = new Date("2026-09-13T10:00:00.000Z");
const hours = (count: number) => new Date(at.getTime() + count * 3_600_000);

const type: SlurpArcType = {
  id: "trip",
  name: "Trip",
  description: "",
  chapters: [
    {
      label: "planning",
      minDays: 0,
      maxDays: 2,
      choice: {
        question: "Where to?",
        options: [
          { label: "Lisbon", chapters: [{ label: "Lisbon trams", minDays: 1, maxDays: 2 }] },
          { label: "Stay home", chapters: [] },
        ],
      },
    },
    { label: "back home", minDays: 0, maxDays: 1 },
  ],
  tags: [],
  tone: "",
  durationDays: 14,
  enabled: true,
  builtin: false,
  hidden: false,
};

// Copied at start, round-trips through storage and back to the library.
const arc = makeSlurpProject("arc-1", { type }, at)!;
assert.equal(arc.choices[0]?.question, "Where to?");
assert.equal(arc.choices[1], null);
assert.deepEqual(readSlurpProject(JSON.parse(JSON.stringify(arc)))!.choices, arc.choices);
assert.equal(slurpArcTypeFromProject(arc, "copy").chapters[0]!.choice?.options.length, 2);

// Poll blocks advance and tick; the first poll post opens it for the configured hours.
const posted = slurpProjectAdvance(arc, hours(1), "normal", { postId: "p1", hours: 24 });
assert.equal(posted.chapter, 0);
assert.equal(posted.pollPostId, "p1");
assert.equal(posted.pollClosesAt, hours(25).toISOString());
assert.equal(slurpProjectAdvance(posted, hours(2), "normal", { postId: "p2", hours: 24 }).pollPostId, "p1");
assert.equal(slurpProjectTick(posted, hours(24 * 30)), posted);
assert.equal(slurpProjectPollDue(posted, hours(24)), false);
assert.equal(slurpProjectPollDue(posted, hours(25)), true);
// No poll post ever: due once the chapter's time runs out, so the arc cannot stall.
assert.equal(slurpProjectPollDue(arc, hours(47)), false);
assert.equal(slurpProjectPollDue(arc, hours(48)), true);

// Winner: branch inserted after the chapter, history keeps the result, arc moves on.
const won = slurpProjectChoose(posted, hours(25), [3, 1])!;
assert.deepEqual(won.chapters, ["planning", "Lisbon trams", "back home"]);
assert.deepEqual(won.phaseDays[1], { min: 1, max: 2 });
assert.deepEqual(won.choices, [null, null, null]);
assert.equal(won.chapter, 1);
assert.equal(won.pollPostId, null);
assert.deepEqual(won.history[0]!.poll, {
  question: "Where to?",
  winner: "Lisbon",
  votes: [
    { label: "Lisbon", count: 3 },
    { label: "Stay home", count: 1 },
  ],
  decidedBy: "fans",
});
assert.equal(won.history.at(-1)!.label, "Lisbon trams");
assert.equal(readSlurpProject(JSON.parse(JSON.stringify(won)))!.history[0]!.poll?.winner, "Lisbon");
assert.equal(slurpProjectChoose(won, hours(26), [1, 0]), null, "nothing to settle twice");

// Tie and no votes: deterministic seeded pick among the leaders.
const tie = slurpProjectChoose(posted, hours(25), [2, 2])!;
assert.equal(slurpProjectChoose(posted, hours(25), [2, 2])!.history[0]!.poll!.winner, tie.history[0]!.poll!.winner);
const none = slurpProjectChoose(arc, hours(48), [])!;
assert.equal(none.history[0]!.poll!.decidedBy, "chance");
assert.equal(slurpProjectChoose(arc, hours(48), [])!.chapters.join("|"), none.chapters.join("|"));
assert.deepEqual(slurpArcFanVotes(posted, 2), slurpArcFanVotes(posted, 2));
const fans = slurpArcFanVotes(posted, 2).reduce((sum, count) => sum + count, 0);
assert.ok(fans >= 3 && fans <= 12);

// Director pick wins over the votes; an unknown option is refused.
const picked = slurpProjectDirect(posted, "choose", hours(3), "1", Math.random, [9, 0])!;
assert.equal(picked.history[0]!.poll!.winner, "Stay home");
assert.equal(picked.history[0]!.poll!.decidedBy, "director");
assert.deepEqual(picked.chapters, ["planning", "back home"]);
assert.equal(slurpProjectDirect(posted, "choose", at, "7"), null);
assert.equal(slurpProjectDirect(posted, "choose", at, ""), null);
// Choosing on the last chapter finishes the arc.
const last = slurpProjectRecord(arc, { ...arc, chapter: 1, choices: [null, arc.choices[0]!] }, at);
assert.equal(slurpProjectChoose(last, hours(1), [0, 1])!.status, "complete");

// Generated arcs keep at most one choice.
const generated = slurpGeneratedArcProject(
  "g",
  {
    title: "Gen",
    chapters: [
      { label: "a", minDays: 1, maxDays: 2, choice: type.chapters[0]!.choice },
      { label: "b", minDays: 1, maxDays: 2, choice: type.chapters[0]!.choice },
      { label: "c", minDays: 1, maxDays: 2, choice: { question: "bad", options: [{ label: "only" }] } },
    ],
  },
  at,
  { origin: "manual", status: "suggested" },
)!;
assert.deepEqual(
  generated.choices.map((choice) => Boolean(choice)),
  [true, false, false],
);

// The post instruction poses the question; the poll is attached structurally, not parsed.
assert.match(
  slurpProjectInstruction({
    title: "Trip",
    direction: "",
    chapter: "planning",
    choice: { question: "Where to?", options: ["Lisbon", "Stay home"] },
    history: [],
  }),
  /ask them in your own voice: Where to\? \(options: Lisbon \/ Stay home\)/,
);
const generation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts",
);
assert.match(generation, /arcPoll \? \{ poll: arcPoll \}/);

// Director choose goes through the gated director route; viewer votes are one per account.
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");
const director = routes.slice(routes.indexOf('"/slurp/accounts/:id/projects/:projectId/director"'));
assert.ok(director.indexOf("arcDirectorMode") < director.indexOf("directProject"));
const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");
assert.match(storage, /arcPollHours: 24,/);
assert.match(storage, /const existingVote = existingVotes\[0\];/, "a second vote replaces the first");
const tick = storage.slice(storage.indexOf("async tickProjects("), storage.indexOf("async rollAutoArc("));
assert.match(tick, /slurpProjectPollDue[\s\S]*slurpProjectChoose/);

console.log("slurp2 arc choice regression passed");
