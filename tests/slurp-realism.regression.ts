import assert from "node:assert/strict";
import { slurpPostCameraSource } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source";
import {
  slurpPostEffort,
  slurpProductionProfile,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-production-profile";
import { SLURP_THREAD_STATE_DEFAULT } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-state";
import {
  SLURP_DEFAULT_REPLY_DELAYS,
  slurpReplyPacing,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging";
import { slurpRapportTier } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-rapport";

const share = (options: Parameters<typeof slurpPostCameraSource>[2], source: string) => {
  let hits = 0;
  for (let sequence = 0; sequence < 400; sequence += 1) {
    if (slurpPostCameraSource("camera-creator", sequence, options) === source) hits += 1;
  }
  return hits / 400;
};

// A planned shoot is not photographed at arm's length, and an ordinary day is not on a tripod.
const setSelfies = share({ companyCanHoldCamera: true, intent: "set", effort: "high" }, "selfie");
const casualSelfies = share({ companyCanHoldCamera: true, intent: "casual", effort: "low" }, "selfie");
assert.ok(setSelfies < 0.2, `a planned shoot is a selfie ${Math.round(setSelfies * 100)}% of the time`);
assert.ok(casualSelfies > setSelfies * 2, "an ordinary day should still be mostly a phone in her hand");
const setTripods = share({ companyCanHoldCamera: true, intent: "set", effort: "high" }, "tripod");
assert.ok(setTripods > 0.3, `a planned shoot uses a tripod only ${Math.round(setTripods * 100)}% of the time`);
// Nothing is ruled out: the draw stays a draw.
assert.ok(share({ companyCanHoldCamera: true, intent: "set", effort: "high" }, "mirror") > 0.05);

// Two Creators who shoot the same way no longer share one effort sequence.
const profile = slurpProductionProfile("creator-one", "polished");
const one = Array.from({ length: 24 }, (_, index) => slurpPostEffort(profile, index, "creator-one"));
const two = Array.from({ length: 24 }, (_, index) => slurpPostEffort(profile, index, "creator-two"));
assert.notDeepEqual(one, two, "same style, same effort sequence");

// A conversation starts between strangers.
assert.equal(SLURP_THREAD_STATE_DEFAULT.posture, "open");
assert.equal(SLURP_THREAD_STATE_DEFAULT.familiarity, 0);
assert.equal(slurpRapportTier(0), "stranger");

// A first message from a stranger is answered the same hour, not two hours later.
const rapport = { score: 0, tier: "stranger" as const, contributions: [] };
const firstReply = slurpReplyPacing({
  online: false,
  rapport,
  subscribed: false,
  messageLength: 40,
  minutesUntilOnline: null,
  firstContact: true,
});
assert.ok(firstReply.notBeforeMs <= 60 * 60_000, `a first reply waits ${firstReply.notBeforeMs / 60_000} minutes`);
// A cold thread the Creator has already answered still waits longer than an online reply.
const laterReply = slurpReplyPacing({
  online: false,
  rapport,
  subscribed: false,
  messageLength: 40,
  minutesUntilOnline: null,
});
assert.ok(laterReply.notBeforeMs >= firstReply.notBeforeMs);
assert.ok(SLURP_DEFAULT_REPLY_DELAYS.messagesUnknownReturnDelayMinutes <= 60);
assert.ok(SLURP_DEFAULT_REPLY_DELAYS.messagesMaxReplyDelayMinutes <= 120);

console.log("slurp realism regression passed");
