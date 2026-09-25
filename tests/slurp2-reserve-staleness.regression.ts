import assert from "node:assert/strict";
import { slpReservePolicyStale } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/records/slp-storage-model.ts";

const fingerprint = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    sourceKind: "character",
    sourceId: "char-1",
    sourceUpdatedAt: "2026-09-25T08:00:00.000Z",
    contentHash: "hash-a",
    stageProfileUpdatedAt: "2026-09-25T08:00:00.000Z",
    disclosure: "open",
    stagePersonality: "dry and warm",
    mediaPolicy: { nightQuiet: false },
    timezone: "Europe/Berlin",
    ...overrides,
  });

// A card or schedule edit (content hash), a disclosure change, or a new stage voice make a
// prepared post stale.
assert.equal(slpReservePolicyStale(fingerprint(), fingerprint()), false);
// The Engine bumps the source's updatedAt on every conversation status change: not a content edit.
assert.equal(slpReservePolicyStale(fingerprint(), fingerprint({ sourceUpdatedAt: "2026-09-25T09:00:00.000Z" })), false);
assert.equal(
  slpReservePolicyStale(fingerprint(), fingerprint({ contentHash: "hash-b" })),
  true,
  "a card or schedule edit",
);
// A fingerprint written before the content hash existed is not judged on it.
assert.equal(
  slpReservePolicyStale(fingerprint({ contentHash: undefined }), fingerprint({ contentHash: "hash-b" })),
  false,
);
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
