import assert from "node:assert/strict";
import { slpReservePolicyStale } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/records/slp-storage-model.ts";

const fingerprint = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    sourceKind: "character",
    sourceId: "char-1",
    sourceUpdatedAt: "2026-09-25T08:00:00.000Z",
    stageProfileUpdatedAt: "2026-09-25T08:00:00.000Z",
    disclosure: "open",
    stagePersonality: "dry and warm",
    mediaPolicy: { nightQuiet: false },
    timezone: "Europe/Berlin",
    ...overrides,
  });

// A card or schedule edit (source updatedAt), a disclosure change, or a new stage voice make a
// prepared post stale.
assert.equal(slpReservePolicyStale(fingerprint(), fingerprint()), false);
assert.equal(slpReservePolicyStale(fingerprint(), fingerprint({ sourceUpdatedAt: "2026-09-25T09:00:00.000Z" })), true);
assert.equal(slpReservePolicyStale(fingerprint(), fingerprint({ disclosure: "secret" })), true);
assert.equal(slpReservePolicyStale(fingerprint(), fingerprint({ stagePersonality: "loud" })), true);
// Account timestamps and media policy change too often to rewrite posts on.
assert.equal(
  slpReservePolicyStale(fingerprint(), fingerprint({ stageProfileUpdatedAt: "2026-09-26T00:00:00.000Z" })),
  false,
);
assert.equal(slpReservePolicyStale(fingerprint(), fingerprint({ mediaPolicy: { nightQuiet: true } })), false);
// An unreadable stored value is not a reason to throw a post away.
assert.equal(slpReservePolicyStale("", fingerprint()), false);
assert.equal(slpReservePolicyStale(null, fingerprint()), false);

console.log("slurp2 reserve staleness regression checks passed");
