import assert from "node:assert/strict";

import {
  makeSlurpProject,
  readSlurpProject,
  SLURP_ARC_HISTORY_POSTS,
  SLURP_ARC_RANDOM_TWISTS,
  slurpProjectRecord,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-project.js";
import {
  slurpProjectAdvance,
  slurpProjectDirect,
  slurpProjectInstruction,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-progress.js";
import { slurp2Source } from "./slurp2-source";

const at = new Date("2026-09-13T10:00:00.000Z");
const later = (minutes: number) => new Date(at.getTime() + minutes * 60_000);

// History across advance and completion. Posts land on the chapter they were written for.
let arc = makeSlurpProject("a", { title: "Trip", chapters: ["plan", "away", "home"] }, at)!;
assert.equal(arc.history.length, 1);
assert.equal(arc.completedAt, null);
const advance = (postId: string, minutes: number) => {
  const next = slurpProjectAdvance(arc, later(minutes));
  arc = slurpProjectRecord(arc, { ...next, twist: "" }, later(minutes), postId);
};
advance("p1", 1);
assert.equal(arc.chapter, 1);
assert.deepEqual(arc.history[0]!.postIds, ["p1"]);
assert.equal(arc.history[0]!.endedAt, later(1).toISOString());
assert.deepEqual(
  { chapter: arc.history[1]!.chapter, label: arc.history[1]!.label, endedAt: arc.history[1]!.endedAt },
  { chapter: 1, label: "away", endedAt: null },
);
advance("p2", 2);
advance("p3", 3);
assert.equal(arc.status, "complete");
assert.equal(arc.completedAt, later(3).toISOString());
assert.deepEqual(arc.history.at(-1)!.postIds, ["p3"]);
assert.equal(arc.history.at(-1)!.endedAt, later(3).toISOString());

// Post ids are capped per chapter visit.
let open = makeSlurpProject("o", { title: "Open" }, at)!;
for (let index = 0; index < SLURP_ARC_HISTORY_POSTS + 3; index += 1)
  open = slurpProjectRecord(open, slurpProjectAdvance(open, at), at, `p${index}`);
assert.equal(open.history[0]!.postIds.length, SLURP_ARC_HISTORY_POSTS);
assert.equal(open.history[0]!.postIds.at(-1), `p${SLURP_ARC_HISTORY_POSTS + 2}`);

// Old records derive one entry from the current chapter.
const legacy = readSlurpProject({
  id: "l",
  title: "Old",
  chapters: ["x", "y"],
  chapter: 1,
  startedAt: at.toISOString(),
  chapterStartedAt: later(5).toISOString(),
})!;
assert.deepEqual(legacy.history, [
  { chapter: 1, label: "y", startedAt: later(5).toISOString(), endedAt: null, postIds: [] },
]);
assert.equal(legacy.twist, "");

// Director bounds: no back before the first chapter, no skip past the last, nothing on a finished arc.
const fresh = makeSlurpProject("d", { title: "Move", chapters: ["one", "two"] }, at)!;
assert.equal(slurpProjectDirect(fresh, "back", at), null);
const skipped = slurpProjectDirect(fresh, "skip", later(1))!;
assert.equal(skipped.chapter, 1);
assert.equal(skipped.history.length, 2);
assert.equal(slurpProjectDirect(skipped, "skip", later(2)), null);
assert.equal(slurpProjectDirect(skipped, "back", later(2))!.chapter, 0);
assert.equal(slurpProjectDirect(fresh, "pause", at)!.status, "paused");
assert.equal(slurpProjectDirect(fresh, "resume", at), null);
assert.equal(slurpProjectDirect(fresh, "label", at, "  "), null);
assert.equal(slurpProjectDirect(fresh, "label", at, "first")!.history.at(-1)!.label, "first");
const ended = slurpProjectDirect(fresh, "end", later(4))!;
assert.equal(ended.status, "complete");
assert.equal(ended.completedAt, later(4).toISOString());
assert.equal(slurpProjectDirect(ended, "resume", at), null);
assert.equal(slurpProjectDirect({ ...fresh, status: "suggested" }, "skip", at), null);

// Twist: random picks from the list; it reaches the instruction once and publication clears it.
const random = slurpProjectDirect(fresh, "twist", at, "random", () => 0)!;
assert.equal(random.twist, SLURP_ARC_RANDOM_TWISTS[0]);
const written = slurpProjectDirect(fresh, "twist", at, "The van breaks down")!;
assert.equal(written.twist, "The van breaks down");
assert.match(
  slurpProjectInstruction({ title: "Move", direction: "", chapter: "one", twist: written.twist, history: [] }),
  /Twist for this post: The van breaks down/,
);
const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");
const advanceBody = storage.slice(storage.indexOf("async advanceProject("), storage.indexOf("async directProject("));
assert.match(advanceBody, /slurpProjectAdvance\([\s\S]*?twist: "" \}/, "advance clears the twist");
assert.doesNotMatch(
  slurpProjectInstruction({ title: "Move", direction: "", chapter: "one", twist: "", history: [] }),
  /Twist/,
);

// Director route is gated on the setting before anything else runs.
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");
const director = routes.slice(routes.indexOf('"/slurp/accounts/:id/projects/:projectId/director"'));
assert.ok(director.length > 0);
const gate = director.indexOf("arcDirectorMode");
assert.ok(gate > 0 && gate < director.indexOf("directProject"), "director route checks arcDirectorMode first");
assert.match(director.slice(gate, gate + 120), /code\(403\)/);
assert.match(storage, /arcDirectorMode: false,/, "Director mode is off by default");

// The viewer timeline route never exposes suggestions, directions, or twists.
const arcs = routes.slice(routes.indexOf('"/slurp/accounts/:id/arcs"'), routes.indexOf("A Creator's arc overrides"));
assert.match(arcs, /status !== "suggested"/);
assert.doesNotMatch(arcs, /direction,|twist,/);
// Viewer access is gone; a protected identity still hides the timeline.
assert.match(arcs, /identityDisclosure \?\? "open"\) !== "open"/);

console.log("slurp2 arc director regression passed");
