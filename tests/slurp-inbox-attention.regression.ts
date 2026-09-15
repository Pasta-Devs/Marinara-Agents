import assert from "node:assert/strict";

import { selectSlurpAttentionCommissions } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-inbox-attention.js";
import type { SlurpCommission } from "../packages/slurp2/src/engine/packages/server/src/services/storage/slurp-messages.storage.js";

const commission = (
  id: string,
  state: SlurpCommission["state"],
  threadId: string,
  creatorAccountId: string,
  updatedAt: string,
): SlurpCommission => ({
  id,
  state,
  threadId,
  creatorAccountId,
  viewerAccountId: "viewer-a",
  brief: id,
  price: 20,
  deliveryMessageId: null,
  deliverAt: null,
  createdAt: updatedAt,
  updatedAt,
});

const selected = selectSlurpAttentionCommissions({
  viewerThreadIds: new Set(["viewer-thread"]),
  operatedCreatorIds: new Set(["owned-creator"]),
  viewerCommissions: [
    commission("viewer-quoted", "quoted", "viewer-thread", "other-creator", "2026-09-09T10:00:00Z"),
    commission("viewer-waiting", "brief", "viewer-thread", "other-creator", "2026-09-09T11:00:00Z"),
    commission("foreign-viewer", "quoted", "foreign-thread", "other-creator", "2026-09-09T12:00:00Z"),
  ],
  creatorCommissions: [
    commission("creator-quote", "brief", "creator-thread", "owned-creator", "2026-09-09T13:00:00Z"),
    commission("creator-deliver", "accepted", "creator-thread", "owned-creator", "2026-09-09T14:00:00Z"),
    commission("creator-done", "delivered", "creator-thread", "owned-creator", "2026-09-09T15:00:00Z"),
    commission("foreign-creator", "accepted", "foreign-thread", "other-creator", "2026-09-09T16:00:00Z"),
  ],
});

assert.deepEqual(
  selected.map(({ id, side }) => [id, side]),
  [
    ["creator-deliver", "creator"],
    ["creator-quote", "creator"],
    ["viewer-quoted", "viewer"],
  ],
);
assert.ok(selected.every((entry) => entry.state !== "declined" && entry.state !== "delivered"));

console.log("slurp inbox attention regression passed");
