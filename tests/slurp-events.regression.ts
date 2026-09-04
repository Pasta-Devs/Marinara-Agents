import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  groupSlurpEvents,
  isNotableSlurpEvent,
  slurpEventWeight,
  SLURP_EVENT_NOTABLE,
  type SlurpEventLike,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-event-weight.js";

// ── Money outranks attention ────────────────────────────────────────────────
// A like is the cheapest thing a person can do; a commission is somebody asking you to make
// something. Between two events the player has time to read, the costlier one wins.
assert.ok(slurpEventWeight("commission_requested") > slurpEventWeight("subscribed"));
assert.ok(slurpEventWeight("subscribed") > slurpEventWeight("tip"));
assert.ok(slurpEventWeight("tip") > slurpEventWeight("comment"));
assert.ok(slurpEventWeight("message") > slurpEventWeight("unlock"));

// Losing a subscriber is news. A world that only reports good outcomes has no stakes.
assert.ok(isNotableSlurpEvent("lapsed"));

// ── Amount lifts money kinds, but on a curve ────────────────────────────────
// A 500-coin tip is not the same news as a 5-coin one, but no single payment may crowd out a whole
// day of everything else.
assert.ok(slurpEventWeight("tip", 500) > slurpEventWeight("tip", 5));
assert.ok(slurpEventWeight("tip", 5) > slurpEventWeight("tip", 0));
// A tip can outrank a subscription; no tip outranks a commission request by an order of magnitude.
assert.ok(slurpEventWeight("tip", 500) > slurpEventWeight("subscribed"));
assert.ok(slurpEventWeight("tip", 1_000_000) < slurpEventWeight("commission_requested") * 3);
// An ordinary small unlock must stay groupable. A first curve gave 3 coins a +12 boost and pushed
// every routine unlock over the notable line, which is the flood this rule exists to prevent.
assert.ok(!isNotableSlurpEvent("unlock", 3), "a routine unlock must group");
assert.ok(!isNotableSlurpEvent("unlock", 5), "a routine unlock must group");
assert.ok(isNotableSlurpEvent("unlock", 200), "a large unlock earns its own line");
// Attention kinds ignore amount entirely.
assert.equal(slurpEventWeight("comment", 9_999), slurpEventWeight("comment"));

// Nonsense amounts must not produce NaN in a sort key.
for (const amount of [-50, Number.NaN]) {
  assert.ok(Number.isFinite(slurpEventWeight("tip", amount)), `weight was not finite for ${amount}`);
}

// ── Grouping keeps a busy day readable ──────────────────────────────────────
// Notable events keep their own line. Everything else folds into one line per kind, so twenty
// likes are one row instead of twenty.
const event = (id: string, kind: SlurpEventLike["kind"], amount = 0, createdAt = "2026-09-05T10:00:00.000Z") => ({
  id,
  kind,
  amount,
  weight: slurpEventWeight(kind, amount),
  createdAt,
});

const grouped = groupSlurpEvents([
  event("a", "subscribed"),
  event("b", "comment"),
  event("c", "comment"),
  event("d", "comment", 0, "2026-09-05T11:00:00.000Z"),
  event("e", "tip", 200),
  event("f", "followers"),
]);

const singles = grouped.filter((entry) => entry.type === "single");
const groups = grouped.filter((entry) => entry.type === "group");
assert.deepEqual(
  singles.map((entry) => (entry.type === "single" ? entry.event.id : "")),
  ["a", "e"],
  "only notable events keep their own line",
);
const comments = groups.find((entry) => entry.type === "group" && entry.kind === "comment");
assert.ok(comments && comments.type === "group");
assert.equal(comments.count, 3);
assert.equal(comments.latestAt, "2026-09-05T11:00:00.000Z", "a group carries its newest timestamp");
assert.deepEqual(comments.ids, ["b", "c", "d"]);

// Money groups carry a total, so "14 unlocks" can say what they were worth.
const money = groupSlurpEvents([event("g", "unlock", 3), event("h", "unlock", 5)]);
assert.equal(money.length, 1);
assert.ok(money[0]?.type === "group" && money[0].total === 8);

// The order of notable events is preserved rather than re-sorted: a feed that reorders itself is
// hard to follow when you have already read the top.
const ordered = groupSlurpEvents([event("x", "subscribed"), event("y", "commission_requested")]);
assert.deepEqual(
  ordered.filter((entry) => entry.type === "single").map((entry) => (entry.type === "single" ? entry.event.id : "")),
  ["x", "y"],
);

assert.deepEqual(groupSlurpEvents([]), []);
assert.ok(SLURP_EVENT_NOTABLE > 0);

// ── Wiring ──────────────────────────────────────────────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp/src/engine/packages");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const storage = read("server/src/services/storage/slurp.storage.ts");
// A character-backed Creator has no operator, so it produces no notifications. That is the
// correct answer, not a failure.
assert.match(storage, /if \(!creator \|\| creator\.sourceKind !== "persona" \|\| !creator\.sourceEntityId\) return;/u);
// A notification failure must never break the action that caused it.
assert.match(storage, /\[slurp-events\] Could not record a %s event/u);
// Every paid path reports, including when the wallet is off.
for (const call of ["subscribe", "unlock", "renew"]) {
  assert.match(storage, new RegExp(`notifyCreatorIncome\\([^)]*"${call}"`, "u"), `${call} must notify`);
}
assert.match(storage, /recordCreatorEvent\(creatorAccountId, "lapsed"/u, "a lapse must be reported");
assert.match(storage, /recordCreatorEvent\(creator\.id, "tip"/u, "a tip must be reported");

const messages = read("server/src/services/storage/slurp-messages.storage.ts");
assert.match(messages, /recordCreatorEvent\(creatorAccountId, "commission_requested"/u);
assert.match(messages, /recordCreatorEvent\(creatorAccountId, "message"/u);

const routes = read("server/src/routes/slurp.routes.ts");
assert.match(routes, /app\.get\("\/noodler\/notifications"/u);
assert.match(routes, /app\.post\("\/noodler\/notifications\/seen"/u);
// Actor ids are resolved to names: "abc-123 subscribed" is the failure this surface exists to fix.
assert.match(routes, /names\.get\(event\.actorLabel\)/u);

const home = read("client/src/components/slurp/SlurpHome.tsx");
assert.match(home, /function SlurpNotificationsView/u);
// Marking seen happens on leaving, so the catch-up does not vanish while it is being read.
assert.match(home, /const leave = \(\) => \{[\s\S]*?markSeen\.mutate/u);

console.log("slurp events regression passed");
