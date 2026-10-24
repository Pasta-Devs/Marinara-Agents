import assert from "node:assert/strict";
import {
  slurpLiveForViewer,
  slurpLivePictureTriggers,
  slurpLivePrivatePrice,
  slurpLivePrivateUntil,
  slurpLiveReplyClaimAllowed,
  type SlurpLiveShow,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live.ts";

const now = new Date("2026-10-23T12:00:00.000Z");
const show: SlurpLiveShow = {
  id: "show",
  hostKind: "creator",
  hostId: "creator",
  startedAt: now.toISOString(),
  endsAt: new Date(now.getTime() + 20 * 60_000).toISOString(),
  endedAt: null,
  goal: 100,
  raised: 100,
  goalHitAt: now.toISOString(),
  script: [
    { at: 0, kind: "narration", text: "public" },
    { at: 1, kind: "narration", text: "secret", personaId: "a" },
  ],
  events: [{ at: 1, kind: "chat", name: "A", text: "private", personaId: "a" }],
  audienceTipKeys: [],
  lastReplyAt: null,
  recapPostId: null,
  menu: [{ id: "item", label: "Photo", price: 25, picture: true }],
  queue: [{ itemId: "item", label: "Photo", name: "A", at: 1, served: true, requestId: "order" }],
  segment: null,
  lastSeenAt: now.toISOString(),
  missedSummary: null,
  announcedFor: null,
  reminders: [],
  announcementPostId: null,
  startedNoticeAt: now.toISOString(),
  mode: "pictures",
  private: { personaId: "a", until: new Date(now.getTime() + 10 * 60_000).toISOString(), block: 1 },
  privateClaims: [{ requestId: "paid", personaId: "a", status: "paid", block: 1, at: now.toISOString() }],
  pictures: [],
  pictureViewers: [{ personaId: "a", mode: "pictures", seenAt: now.toISOString() }],
  pictureViewerId: "a",
  pictureSeenAt: now.toISOString(),
};
assert.equal(slurpLivePrivatePrice(15.5), 47);
assert.equal(
  slurpLivePrivateUntil(show.private, "a", new Date(now.getTime() + 60_000)),
  new Date(now.getTime() + 20 * 60_000).toISOString(),
);
assert.equal(slurpLivePrivateUntil(show.private, "b", now), new Date(now.getTime() + 10 * 60_000).toISOString());
assert.equal(slurpLiveReplyClaimAllowed(now.toISOString(), new Date(now.getTime() + 20_000), true), true);
assert.equal(slurpLiveReplyClaimAllowed(now.toISOString(), new Date(now.getTime() + 19_999), true), false);
assert.equal(
  slurpLiveForViewer(show, "b", now).script.some((line) => line.text === "secret"),
  false,
);
assert.equal(slurpLiveForViewer(show, "b", now).events.length, 0);
assert.equal(slurpLiveForViewer(show, "b", now).private?.personaId, "");
assert.equal(slurpLiveForViewer(show, "b", now).pictureViewerId, null);
assert.equal(slurpLiveForViewer(show, "b", now).pictureModeBusy, true);
assert.equal(slurpLiveForViewer(show, "a", now).pictureModeBusy, false);
assert.equal(slurpLiveForViewer(show, "a", now).script.length, 2);
assert.deepEqual(slurpLivePictureTriggers(show, "a", now), ["goal", "menu:order", "private:1"]);
assert.deepEqual(slurpLivePictureTriggers(show, "b", now), []);
assert.deepEqual(
  slurpLivePictureTriggers(
    { ...show, pictureSeenAt: null, pictureViewers: [{ personaId: "a", mode: "pictures", seenAt: null }] },
    "a",
    now,
  ),
  [],
);
assert.deepEqual(
  slurpLivePictureTriggers({ ...show, pictures: [{ personaId: "a", trigger: "goal", status: "pending" }] }, "a", now),
  ["menu:order", "private:1"],
);
assert.deepEqual(
  slurpLivePictureTriggers(
    {
      ...show,
      pictures: Array.from({ length: 6 }, (_, i) => ({
        personaId: "a",
        trigger: `used:${i}`,
        status: "ready" as const,
      })),
    },
    "a",
    now,
  ),
  [],
);
console.log("slurp2 live private and pictures: ok");
