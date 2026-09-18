import assert from "node:assert/strict";

import {
  makeSlurpProject,
  readSlurpCrossoverRef,
  readSlurpProject,
  readSlurpProjects,
  resolveSlurpArcConfig,
  slurpArcLifeLine,
  slurpAutoArcCount,
  slurpCrossoverForViewer,
  slurpCrossoverLeave,
  slurpCrossoverMerge,
  slurpCrossoverPartner,
  slurpCrossoverStart,
  slurpCrossoverView,
  slurpProjectAdvance,
  slurpProjectInstruction,
  slurpProjectRecord,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-project.js";
import { slurp2Source } from "./slurp2-source";

const at = new Date("2026-09-13T10:00:00.000Z");
const DAY = 86_400_000;

// Canonical record + reference resolution. The record keeps creatorIds and per-participant proposals;
// a reference is not a project, so reading a list never turns it into a second copy.
const base = makeSlurpProject(
  "x1",
  {
    title: "Road trip",
    chapters: ["planning", "on the road"],
    type: {
      id: "trip",
      name: "Trip",
      description: "",
      chapters: [
        { label: "planning", minDays: 0, maxDays: 0 },
        { label: "on the road", minDays: 0, maxDays: 0, profile: { location: "Lisbon" } },
      ],
      tags: [],
      tone: "",
      durationDays: 14,
      enabled: true,
      builtin: false,
      hidden: false,
    },
    origin: "auto",
  },
  at,
)!;
const arc = slurpCrossoverStart(base, ["a", "b"]);
assert.deepEqual(arc.creatorIds, ["a", "b"]);
const stored = readSlurpProject(JSON.parse(JSON.stringify(arc)))!;
assert.deepEqual(stored.creatorIds, ["a", "b"], "creatorIds survive a round trip");
assert.equal(
  readSlurpProject({ ...arc, creatorIds: ["a"] })!.creatorIds.length,
  0,
  "one participant is not a crossover",
);
const ref = { crossoverOf: { ownerCreatorId: "a", projectId: "x1" } };
assert.deepEqual(readSlurpCrossoverRef(ref), ref.crossoverOf);
assert.equal(readSlurpProjects(JSON.stringify([ref])).length, 0, "a reference never reads as a project");

// Advancing from b's view lands on the one record, records who posted, and gives both participants
// the new chapter's profile proposal separately.
const bView = slurpCrossoverView(stored, "b");
const advanced = slurpProjectRecord(bView, slurpProjectAdvance(bView, at), at, "post-1", "b");
const merged = slurpCrossoverMerge(stored, advanced, "b", at);
assert.equal(merged.chapter, 1);
assert.equal(merged.history[0]!.authors?.["post-1"], "b", "the post keeps its author");
assert.equal(merged.pendingProfile, null, "the stored record keeps proposals per participant");
assert.equal(merged.profiles.a!.pendingProfile?.location, "Lisbon");
assert.equal(merged.profiles.b!.pendingProfile?.location, "Lisbon");
// b rejects; a still has theirs.
const rejected = slurpCrossoverMerge(merged, { ...slurpCrossoverView(merged, "b"), pendingProfile: null }, "b", at);
assert.equal(rejected.profiles.b!.pendingProfile, null);
assert.equal(rejected.profiles.a!.pendingProfile?.location, "Lisbon");

// Limits: an automatic crossover counts once toward the global cap, in the list that stores it, and
// in every participant's active count (their resolved lists both hold it).
assert.equal(slurpAutoArcCount([slurpCrossoverView(stored, "a")], "a"), 1);
assert.equal(slurpAutoArcCount([slurpCrossoverView(stored, "b")], "b"), 0);
assert.equal(slurpAutoArcCount([slurpCrossoverView(stored, "b")]), 1, "without a Creator id every arc counts");

// Auto pairing: shared tag or a relationship, only eligible partners, deterministic, about 1 in 4.
const candidates = [
  { id: "tagged", tags: ["Fitness"], related: false, eligible: true },
  { id: "follower", tags: [], related: true, eligible: true },
  { id: "stranger", tags: ["cooking"], related: false, eligible: true },
  { id: "protected", tags: ["fitness"], related: true, eligible: false },
];
const days = Array.from({ length: 400 }, (_, index) => new Date(at.getTime() + index * DAY));
const picks = days.map((day) =>
  slurpCrossoverPartner({ creatorAccountId: "me", at: day, creatorTags: ["fitness"], candidates }),
);
const hits = picks.filter(Boolean);
assert.ok(hits.length > 50 && hits.length < 150, `about 1 in 4 days pairs, got ${hits.length}`);
assert.ok(
  hits.every((id) => id === "tagged" || id === "follower"),
  "only a shared tag or a relationship pairs",
);
assert.ok(!picks.includes("protected"), "an ineligible (protected) Creator is never picked");
assert.deepEqual(
  days.map((day) => slurpCrossoverPartner({ creatorAccountId: "me", at: day, creatorTags: ["fitness"], candidates })),
  picks,
  "the same day gives the same partner",
);
assert.equal(
  slurpCrossoverPartner({
    creatorAccountId: "me",
    at: days[picks.findIndex(Boolean)]!,
    creatorTags: [],
    candidates: [{ id: "stranger", tags: ["cooking"], related: false, eligible: true }],
  }),
  null,
);

// Per-Creator override of arcCrossovers.
assert.equal(
  resolveSlurpArcConfig({ arcAutoMode: "auto", arcCooldownWeeks: 1, arcPace: "normal" }, {}).crossovers,
  true,
);
assert.equal(
  resolveSlurpArcConfig(
    { arcAutoMode: "auto", arcCooldownWeeks: 1, arcPace: "normal", arcCrossovers: true },
    { crossovers: false },
  ).crossovers,
  false,
);

// Participant deletion: three become two; two become a normal arc of whoever is left, keeping their proposal.
const trio = slurpCrossoverStart(base, ["a", "b", "c"]);
assert.deepEqual(slurpCrossoverLeave(trio, "a").creatorIds, ["b", "c"]);
const solo = slurpCrossoverLeave(merged, "a");
assert.deepEqual(solo.creatorIds, []);
assert.equal(solo.pendingProfile?.location, "Lisbon");

// Point of view: the other Creator by public display name, never the source character.
const aView = { ...slurpCrossoverView(stored, "a"), partnerNames: ["Bee Stage"] };
assert.match(slurpArcLifeLine([aView])!, /together with Bee Stage/);
const instruction = slurpProjectInstruction({
  title: "Road trip",
  direction: "",
  chapter: null,
  history: [],
  partners: ["Bee Stage"],
});
assert.match(instruction, /shared story with Bee Stage/);
const storage = slurp2Source(
  new URL("../packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts", import.meta.url),
);
assert.match(storage, /names\.push\(account\.displayName\)/, "partner names come from the Slurp account");
assert.match(storage, /await this\.leaveCrossovers\(id\)/, "deleting a Creator leaves its crossovers");

// Viewer route: a hidden participant and their posts are left out.
const withPosts = {
  ...merged,
  creatorIds: ["a", "b", "c"],
  history: [{ ...merged.history[0]!, postIds: ["post-1", "post-a"], authors: { "post-1": "b", "post-a": "a" } }],
};
const forViewer = slurpCrossoverForViewer(withPosts, "a", (id) => id !== "b");
assert.deepEqual(forViewer.partnerIds, ["c"]);
assert.deepEqual(forViewer.history[0]!.postIds, ["post-a"]);
assert.equal(JSON.stringify(forViewer).includes('"b"'), false, "nothing names the hidden participant");
const routes = slurp2Source(
  new URL("../packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts", import.meta.url),
);
assert.match(routes, /slurpCrossoverForViewer\(project, creator\.id, visible\)/);

console.log("slurp2 arc crossover regression passed");
