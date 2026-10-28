import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slpErrorText } from "../packages/slurp2/src/engine/packages/client/src/slp/base/ui/slp-error-text";
import { countSlurpRefreshOutcomes } from "../packages/slurp2/src/engine/packages/client/src/slp/features/creators/slp-refresh-batch";
import { SLP_BACKSTAGE_LABEL_KEYS } from "../packages/slurp2/src/engine/packages/client/src/slp/features/backstage/slp-backstage-label-keys";
import { SLP_BACKSTAGE_SETTING_PLACEMENT } from "../packages/slurp2/src/engine/packages/client/src/slp/features/backstage/slp-backstage-placement";
import { reconcileSlpFanActivityDayPlan } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/audience/slp-fan-activity-day-plan";

// Fix phase 1, batch F (REVIEW-1 remaining medium findings): R1-007, R1-008, R1-024, R1-025, R1-026,
// R1-027, R1-067, R1-068, R1-069, R1-085, R1-086, R1-102, R1-103, R1-106, R1-131, R1-132, R1-138.
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");
const en = JSON.parse(read("client/src/slp/locales/en.json")) as Record<string, string>;

// ── R1-138: one rule for failure text ──
const api = (status: number, error: unknown) => Object.assign(new Error("raw"), { status, payload: { error } });
assert.equal(slpErrorText(api(402, "Not enough coins"), "fallback", "coins"), "coins");
assert.equal(slpErrorText(api(409, "Send them a message first."), "fallback", "coins"), "Send them a message first.");
assert.equal(slpErrorText(api(400, { formErrors: ["Number must be…"] }), "fallback", "coins"), "fallback");
assert.equal(slpErrorText(api(500, "Internal Server Error"), "fallback", "coins"), "fallback");
assert.equal(slpErrorText(new TypeError("Failed to fetch"), "fallback", "coins"), "fallback");
for (const file of [
  "client/src/slp/app/screens/SlpHomeHelpers.tsx",
  "client/src/slp/modules/settings/slp-backstage-format.ts",
])
  assert.match(read(file), /slpErrorText\(/u, file);

// ── R1-068: "Generate posts" counts what happened ──
assert.deepEqual(
  countSlurpRefreshOutcomes([
    { accountId: "a", status: "generated" },
    { accountId: "b", status: "skipped" },
    { accountId: "c", status: "busy" },
    { accountId: "d", status: "error" },
    { accountId: "e", status: "connection_required" },
  ]),
  { made: 1, skipped: 2, failed: 2 },
);

// ── R1-102: a Creator made after the day's plan joins today's remaining runs ──
const morning = new Date();
morning.setHours(0, 5, 0, 0);
const first = reconcileSlpFanActivityDayPlan(null, ["a"], morning, 8);
const later = reconcileSlpFanActivityDayPlan(first, ["a", "b"], new Date(morning.getTime() + 60_000), 8);
const scheduled = later.runs.filter((run) => !run.manual && run.status === "scheduled");
assert.ok(scheduled.length > 0);
assert.ok(
  scheduled.some((run) => run.creatorIds.includes("b")),
  "the new Creator is in a run today",
);
const again = reconcileSlpFanActivityDayPlan(later, ["a", "b"], new Date(morning.getTime() + 120_000), 8);
assert.equal(
  again.runs.flatMap((run) => run.creatorIds).filter((id) => id === "b").length,
  later.runs.flatMap((run) => run.creatorIds).filter((id) => id === "b").length,
  "reconciling again adds nothing twice",
);
const removed = reconcileSlpFanActivityDayPlan(again, ["a"], new Date(morning.getTime() + 180_000), 8);
assert.ok(
  removed.runs.filter((run) => run.status === "scheduled").every((run) => !run.creatorIds.includes("b")),
  "a removed Creator leaves the remaining runs",
);

// ── R1-132: every visible setting has a label that exists ──
for (const [key, placement] of Object.entries(SLP_BACKSTAGE_SETTING_PLACEMENT)) {
  if (placement.internal) continue;
  const labelKey = SLP_BACKSTAGE_LABEL_KEYS[key as keyof typeof SLP_BACKSTAGE_LABEL_KEYS];
  assert.ok(labelKey && en[labelKey], `${key} has a label`);
}
assert.equal(en[SLP_BACKSTAGE_LABEL_KEYS.walletUnlockCost ?? ""] !== undefined, true);
assert.match(read("client/src/slp/features/backstage/SlpBackstageNavigation.tsx"), /SLP_BACKSTAGE_LABEL_KEYS\[key\]/u);

// ── R1-007: the inbox unread counts only the threads it lists ──
const threadRoutes = read("server/src/slp/features/messages/slp-messages-thread-routes.ts");
assert.match(threadRoutes, /unread: threads\s*\.filter\(\(thread\) => thread\.state !== "declined"\)/u);
// ── R1-008: a chat opened from a profile uses its loaded thread ──
assert.match(
  read("client/src/slp/features/messages/SlpThreadHeader.tsx"),
  /const threadId = thread\?\.id \?\? threadIdProp;/u,
);
// Pin changed on purpose in L (R1-012): both routes build the relationship through one helper that
// lists the follow-ups; the intent (the compose route carries them) is unchanged.
assert.match(threadRoutes, /const relationshipFor = [\s\S]*scheduledFollowUps: thread\.scheduledFollowUps,/u);
assert.match(threadRoutes, /relationship: thread \? await relationshipFor\(thread, creator, "viewer"/u);
// ── R1-024: the Story ring means "not watched" ──
assert.match(
  read("server/src/slp/features/viewer/slp-viewer-context.ts"),
  /interaction\.type === "story_view" && interaction\.actorAccountId === context\.viewerActorAccountId/u,
);
assert.match(read("client/src/slp/app/screens/SlpScreenMoments.tsx"), /const isNew = isUnwatched\(moment\);/u);
// ── R1-025 / R1-026: the Creator's own price, and Guide keeps the Locked price ──
assert.match(read("client/src/slp/app/screens/SlpScreenComposer.tsx"), /creatorPrices\?\.messaging\.unlockPrice \?\?/u);
assert.match(read("server/src/slp/features/feed/slp-generation-service.ts"), /input\.request\.unlockPrice \?\?/u);
// ── R1-027: the switch is on the composer the card uses; Cancel keeps the comment ──
assert.match(
  read("client/src/slp/modules/post/SlpReplyComposer.tsx"),
  /askForReply\.setAsked\(event\.target\.checked\)/u,
);
assert.match(
  read("client/src/slp/app/slp-home-post-actions.ts"),
  /const askForReply = input\.askForReply && \(await confirmProviderDisclosure\(\)\);/u,
);
// ── R1-067: Vote opens the poll post; no voting line before it exists ──
assert.match(
  read("client/src/slp/features/projects/SlpArcTimelineCard.tsx"),
  /const votePostId = shown\.openChoice\?\.pollPostId \?\? undefined;/u,
);
// ── R1-069: Location in Edit profile ──
assert.match(read("client/src/slp/features/creators/SlpCreatorProfileEditor.tsx"), /location: nextLocation,/u);
// ── R1-085: the direction is named ──
assert.ok(en["ui.slurp.events.single.audience_arc_burnout"] && en["ui.slurp.events.single.audience_arc_overattached"]);
// ── R1-086: message events stay out of the badge ──
assert.match(
  read("server/src/slp/data/notifications/slp-notification-storage.ts"),
  /ne\(slurpEvents\.kind, "message"\)/u,
);
// ── R1-103: a skipped run is finished ──
// 0.3.6: the terminal-status list moved to the pure Pulse model.
assert.match(read("client/src/slp/modules/chrome/slp-pulse-model.ts"), /"skipped",\s*\]\)\.has\(status\)/u);
// ── R1-131: an empty Hub offers Add creators ──
assert.match(
  read("client/src/slp/app/screens/SlpScreenHub.tsx"),
  /onAction=\{authorProfile \? onOpenAuthorProfile : onAddCreators\}/u,
);

console.log("slurp2 fix1 remaining medium regression passed");
