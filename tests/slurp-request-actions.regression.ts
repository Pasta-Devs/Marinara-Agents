import assert from "node:assert/strict";
import {
  SLURP_REQUEST_ACTIONS,
  SLURP_REQUEST_DELAY_DEFAULT_HOURS,
  SLURP_REQUEST_DELAY_MAX_HOURS,
  slurpRequestActionEffect,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-request-actions.ts";
import {
  normalizeSlurpDemandTopic,
  SLURP_DEMAND_TOPIC_MAX,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-demand.ts";
import { slurp2Source } from "./slurp2-source";

// Every action is answerable, and each creates exactly what it should.
assert.deepEqual([...SLURP_REQUEST_ACTIONS], ["fulfill", "tease", "decline", "delay", "ignore", "aggregate"]);
const effect = (action: (typeof SLURP_REQUEST_ACTIONS)[number], dueInHours?: number) =>
  slurpRequestActionEffect(action, { dueInHours });
assert.deepEqual(effect("fulfill"), {
  promise: { intent: "request", dueInHours: 0 },
  promiseEvent: true,
  boundary: false,
  aggregate: false,
});
assert.deepEqual(effect("tease").promise, { intent: "teaser", dueInHours: 0 });
assert.equal(effect("delay").promise?.dueInHours, SLURP_REQUEST_DELAY_DEFAULT_HOURS);
assert.equal(effect("decline").boundary, true);
assert.equal(effect("decline").promise, null, "declining owes no post");
assert.equal(effect("aggregate").aggregate, true);
assert.equal(effect("aggregate").promise, null);
// Ignore is a real answer that creates nothing: the request is filed, not acted on.
assert.deepEqual(effect("ignore"), { promise: null, promiseEvent: false, boundary: false, aggregate: false });
// A delay is bounded, so a promise cannot be pushed past the point of meaning anything.
assert.equal(effect("delay", 10_000).promise?.dueInHours, SLURP_REQUEST_DELAY_MAX_HOURS);
assert.equal(effect("delay", 0).promise?.dueInHours, 1);
assert.equal(effect("delay", 2.4).promise?.dueInHours, 2);

// A demand topic is a short label, normalised so the same ask counts once.
assert.equal(normalizeSlurpDemandTopic("  Red   DRESS set "), "red dress set");
assert.equal(normalizeSlurpDemandTopic("x".repeat(200)).length, SLURP_DEMAND_TOPIC_MAX);
assert.equal(normalizeSlurpDemandTopic("   "), "");

// The service: one answer per request, and the fan never leaves the thread.
const service = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/messages/slp-request-action-service.ts",
);
assert.match(service, /if \(answered\?\.action\) return "already_answered";/u);
assert.match(service, /if \(input\.action === "aggregate" && !input\.topic\?\.trim\(\)\) return "topic_required";/u);
// Every event this writes is thread-private.
for (const call of service.match(/eventType: "[a-z_]+",[\s\S]{0,200}?audienceScope: "[a-z_]+"/gu) ?? []) {
  assert.match(call, /audienceScope: "thread_private"/u, `a request action wrote a wider audience: ${call}`);
}
// Only the typed label reaches the Creator-wide count; the request text never does.
assert.match(service, /bumpSlurpDemandTrend\(db, input\.creatorAccountId, input\.topic, at\)/u);
assert.doesNotMatch(service, /bumpSlurpDemandTrend\([^)]*request\.payload/u);
// A promise is a planned opportunity tied to the request that caused it.
assert.match(service, /workflow: "planned",[\s\S]*?sourceEventId: input\.requestId,/u);

// Routes: only the Creator's side may read or answer requests.
const routes = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/messages/slp-messages-request-routes.ts",
);
assert.match(
  routes,
  /if \(!viewer \|\| !thread \|\| !\(await ownsCreator\(viewer\.id, thread\.creatorAccountId\)\)\) return null;/u,
);
assert.equal((routes.match(/await ownedThread\(/gu) ?? []).length, 2, "both routes must check ownership");

// The planner honours promises before campaigns, and never leaks the private request into a post.
const plan = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-plan-service.ts");
assert.match(plan, /await findDueSlurpPromise\(db, account\.id, \{ at, access: request\.access \?\? "public" \}\)/u);
assert.match(
  plan,
  /!directed && !chosen && !promise && !previewOnly/u,
  "a promise takes the slot before a campaign stage",
);
assert.match(plan, /await claimSlurpPromise\(db, promise\.id, \{/u);
assert.match(plan, /axes\?\.intent === "request" && !promise && !previewOnly/u, "a promised post gets no demand label");
assert.match(plan, /eventType: "promise_kept",[\s\S]*?audienceScope: "thread_private",/u);
// Oldest promise first, and an unkept promise is never pruned away.
const opportunities = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/data/feed/slp-opportunity-storage.ts",
);
assert.match(
  opportunities,
  /\.sort\(\(left, right\) => left\.plannedAt\.localeCompare\(right\.plannedAt\)\)\[0\] \?\? null/u,
);
assert.match(opportunities, /filter\(\(entry\) => !\(entry\.workflow === "planned" && entry\.sourceEventId\)\)/u);
assert.match(
  opportunities,
  /row\.intent !== "teaser" \|\| input\.access === "public"/u,
  "a teaser promise needs a public slot",
);
// Both completion paths record a kept promise.
for (const file of [
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-plan-service.ts",
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/reserve/slp-reserve-operation.ts",
]) {
  assert.match(slurp2Source(file), /recordSlurpPromiseKept\(db, opportunity, \{/u, file);
}
// The post prompt gets the label and an order never to name anyone.
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts"),
  /Several subscribers have asked for: \$\{demandTopic\}\. Do not name or quote anyone\./u,
);

// Promotion writes a new derived record and leaves the private source alone.
const storage = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/data/continuity/slp-continuity-storage.ts",
);
assert.match(storage, /export async function promoteSlurpContinuityFact/u);
assert.match(storage, /evidence: `Promoted from \$\{source\.id\}`,/u);
assert.match(storage, /contribution: "manual",\s*\},\s*at,\s*\);\s*return derived/u);
assert.doesNotMatch(
  storage,
  /promoteSlurpContinuityFact[\s\S]*?update\(slurpContinuityFacts\)/u,
  "promotion must not mutate the source",
);

console.log("slurp request action regression checks passed");
