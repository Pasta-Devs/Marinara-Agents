import assert from "node:assert/strict";
import {
  SLURP_AUDIENCE_SCOPES,
  SLURP_CONTINUITY_STATUSES,
  SLURP_REALITY_SCOPES,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-continuity.ts";
import {
  SLURP_CONTINUITY_FINISHED_RETENTION_MS,
  SLURP_CONTINUITY_MAX_EVENTS,
  slurpContinuityCanMove,
  slurpContinuityPrunable,
  slurpContinuityReadable,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/continuity/slp-continuity-rules.ts";
import { slurp2Source } from "./slurp2-source";

const at = new Date("2026-09-21T12:00:00.000Z");
const record = (overrides: Partial<Parameters<typeof slurpContinuityReadable>[0]> = {}) => ({
  audienceScope: "creator_public" as const,
  realityScope: "slurp" as const,
  status: "active" as const,
  threadId: null,
  expiresAt: null,
  ...overrides,
});

// A fan's private detail never reaches a post, public or locked.
for (const audienceScope of ["thread_private", "fan_private", "canon_only"] as const) {
  for (const surface of ["public_post", "locked_post"] as const) {
    assert.ok(
      !slurpContinuityReadable(record({ audienceScope, threadId: "t1" }), surface, { at, threadId: "t1" }),
      `${audienceScope} leaked into ${surface}`,
    );
  }
}
// A thread reads its own private records and no other thread's.
assert.ok(
  slurpContinuityReadable(record({ audienceScope: "thread_private", threadId: "t1" }), "fan_thread", {
    at,
    threadId: "t1",
  }),
);
assert.ok(
  !slurpContinuityReadable(record({ audienceScope: "thread_private", threadId: "t1" }), "fan_thread", {
    at,
    threadId: "t2",
  }),
);
assert.ok(
  !slurpContinuityReadable(record({ audienceScope: "fan_private", threadId: null }), "fan_thread", {
    at,
    threadId: null,
  }),
);
// canon_only is for later adapters and reaches only the editor.
assert.ok(!slurpContinuityReadable(record({ audienceScope: "canon_only" }), "fan_thread", { at }));
assert.ok(slurpContinuityReadable(record({ audienceScope: "canon_only" }), "creator_editor", { at }));
// Creator-owned audiences reach posts and threads.
for (const audienceScope of ["creator_public", "cross_platform", "creator_private"] as const) {
  for (const surface of ["public_post", "locked_post", "fan_thread"] as const) {
    assert.ok(slurpContinuityReadable(record({ audienceScope }), surface, { at }), `${audienceScope} on ${surface}`);
  }
}

// A scene is not history: conversation, roleplay, and game records never reach a Slurp prompt.
for (const realityScope of ["conversation", "roleplay", "game"] as const) {
  for (const surface of ["public_post", "locked_post", "fan_thread"] as const) {
    assert.ok(
      !slurpContinuityReadable(record({ realityScope }), surface, { at }),
      `${realityScope} reached ${surface}`,
    );
  }
  assert.ok(slurpContinuityReadable(record({ realityScope }), "creator_editor", { at }), "the editor sees everything");
}
for (const realityScope of ["canon", "slurp", "campaign"] as const) {
  assert.ok(slurpContinuityReadable(record({ realityScope }), "public_post", { at }));
}
// Only confirmed and active records are relied on, and never after they expire.
for (const status of SLURP_CONTINUITY_STATUSES) {
  assert.equal(
    slurpContinuityReadable(record({ status }), "public_post", { at }),
    status === "confirmed" || status === "active",
    status,
  );
}
assert.ok(!slurpContinuityReadable(record({ expiresAt: at.toISOString() }), "public_post", { at }));
assert.ok(
  slurpContinuityReadable(record({ expiresAt: new Date(at.getTime() + 1).toISOString() }), "public_post", { at }),
);
// Every audience and reality is known to the rules (no scope silently unreadable everywhere).
for (const audienceScope of SLURP_AUDIENCE_SCOPES) {
  assert.ok(slurpContinuityReadable(record({ audienceScope, threadId: "t" }), "creator_editor", { at }));
}
assert.equal(SLURP_REALITY_SCOPES.length, 6);

// Retracted and rejected are final, so a retracted fact cannot come back.
for (const done of ["retracted", "rejected"] as const) {
  for (const to of SLURP_CONTINUITY_STATUSES) assert.ok(!slurpContinuityCanMove(done, to), `${done} is final`);
}
assert.ok(slurpContinuityCanMove("proposed", "active"));
assert.ok(slurpContinuityCanMove("disputed", "confirmed"));
assert.ok(!slurpContinuityCanMove("proposed", "retracted"), "never applied, so reject it instead");

// Retention: finished records past the window go, live ones stay, and the cap holds.
const old = new Date(at.getTime() - SLURP_CONTINUITY_FINISHED_RETENTION_MS - 1).toISOString();
const recent = new Date(at.getTime() - 1000).toISOString();
assert.deepEqual(
  slurpContinuityPrunable(
    [
      { id: "live-old", status: "active", createdAt: old },
      { id: "retracted-old", status: "retracted", createdAt: old },
      { id: "retracted-new", status: "retracted", createdAt: recent },
    ],
    at,
  ),
  ["retracted-old"],
);
const many = Array.from({ length: SLURP_CONTINUITY_MAX_EVENTS + 3 }, (_, index) => ({
  id: `e${index}`,
  status: "active" as const,
  createdAt: recent,
}));
assert.deepEqual(slurpContinuityPrunable(many, at), ["e500", "e501", "e502"], "the oldest over the cap go");

// Storage wiring.
const storage = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/data/continuity/slp-continuity-storage.ts",
);
// Idempotent system events.
assert.match(
  storage,
  /eq\(slurpContinuityEvents\.fingerprint, input\.fingerprint\)[\s\S]*?if \(existing\[0\]\) return/u,
);
// Every read goes through the one privacy rule.
assert.match(storage, /\.filter\(\(fact\) => slurpContinuityReadable\(fact, surface, context\)\)/u);
assert.match(storage, /\.filter\(\(event\) => slurpContinuityReadable\(event, surface, context\)\)/u);
// A manual edit is protected from source retraction.
assert.match(storage, /contribution: "manual",/u);
assert.match(storage, /if \(row\.contribution === "manual"\) continue;/u);
// Status moves obey the rules.
assert.match(storage, /!slurpContinuityCanMove\(String\(row\.status\) as SlurpContinuityStatus, to\)/u);
// Bounded text, and an empty fact is refused.
assert.match(storage, /\.slice\(0, SLURP_CONTINUITY_TEXT_MAX\);\s*if \(!text\) return null;/u);

// Deleting a Creator removes their ledger, plans, campaigns, and shoots on both delete paths.
for (const file of [
  "packages/slurp2/src/engine/packages/server/src/slp/data/creators/slp-creators-storage-2.ts",
  "packages/slurp2/src/engine/packages/server/src/slp/data/creators/slp-creators-storage-3.ts",
]) {
  assert.match(slurp2Source(file), /await deleteSlurpCreatorPlanningRows\(tx, (?:existing\.)?id\);/u, file);
}
for (const table of [
  "slurpContinuityFacts",
  "slurpContinuityEvents",
  "slurpContinuityProposals",
  "slurpContentCampaignStages",
  "slurpContentCampaigns",
  "slurpContentOpportunities",
  "slurpShootSessions",
]) {
  assert.match(storage, new RegExp(`await tx\\.delete\\(${table}\\)`, "u"), `${table} survives account deletion`);
}

console.log("slurp continuity ledger regression checks passed");
