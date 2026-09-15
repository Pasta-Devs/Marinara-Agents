import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSlurpActivationLifecycle } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-activation-lifecycle.ts";
import { buildSlurpPostTimingContext } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-post-timing.ts";
import { runSlurpAutoPostPollOperations } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-autopost-poll.ts";
import { normalizeSlurpFanActivityRows } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-fan-activity-response.ts";
import { hasSlurpCreatorPostingIntervalConflict } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-posting-interval.ts";

const storage = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts",
  "utf8",
);
const refreshScheduler = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-refresh-scheduler.service.ts",
  "utf8",
);
const hooks = readFileSync("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");
const routes = readFileSync("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
const settingsUi = readFileSync(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx",
  "utf8",
);
const homeUi = readFileSync("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");
const onboardingUi = readFileSync(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx",
  "utf8",
);
const locale = JSON.parse(
  readFileSync("packages/slurp2/src/engine/packages/client/src/localization/locales/en.json", "utf8"),
) as Record<string, string>;

assert.match(
  storage,
  /preparationNotBefore: timestamp/u,
  "new reserve state must be immediately eligible for its first prepared post",
);
assert.match(
  storage,
  /return \{ lastObservedBudgetTime: timestamp, preparationNotBefore: timestamp \};/u,
  "new reserve state must return the timestamp it persisted instead of an undefined shorthand",
);
assert.match(
  storage,
  /storedPreparationMs > observedMs\s*\n\s*\? observed/u,
  "upgraded reserve state must repair the old future startup hold",
);
assert.match(
  refreshScheduler,
  /payload: \{ mode: "noodler" \}/u,
  "the Slurp refresh scheduler must call the supported NoodleR route mode",
);
const viewerHook = hooks.slice(
  hooks.indexOf("export function useNoodlerViewer"),
  hooks.indexOf("/**\n * Unseen-post count"),
);
assert.match(viewerHook, /refetchInterval: enabled && personaId \? 30_000 : false/u);
assert.match(hooks, /invalidateQueries\(\{ queryKey: noodleKeys\.viewer\(personaId\) \}\)/u);
assert.match(storage, /autoPostGenerationMode: z\.enum\(\["pre_generate", "on_demand"\]\)/u);
assert.match(
  storage,
  /autoPostGenerationMode: "on_demand"/u,
  "new Slurp installs must generate automatic posts on demand",
);
assert.match(storage, /state: "scheduled"/u);
assert.match(storage, /ROLLING_DAY_MS = 24 \* 60 \* 60 \* 1000/u);
// The grace on a late slot is one posting interval, asserted in full further down. It was a fixed
// hour, which is why this used to pin a constant here.
assert.match(
  storage,
  /Date\.parse\(item\.publishAt\) < at\.getTime\(\) - elapsedPreparedSlotMs\(settings\.postsPerDay\)/u,
);
assert.match(storage, /slurpCreatorPostingIntervalMs\(settings\.postsPerDay\)/u);
assert.match(storage, /hasSlurpCreatorPostingIntervalConflict\(activityTimes, publishMs, settings\.postsPerDay\)/u);
assert.match(
  storage,
  /latestCreatorPost\.createdAt\) \+ slurpCreatorPostingIntervalMs\(settings\.postsPerDay\) > at\.getTime\(\)/u,
);
const postingInterval = (24 * 60 * 60 * 1000) / 8;
const candidateAt = Date.parse("2026-08-27T12:00:00.000Z");
assert.equal(hasSlurpCreatorPostingIntervalConflict([candidateAt - postingInterval], candidateAt, 8), false);
assert.equal(hasSlurpCreatorPostingIntervalConflict([candidateAt + postingInterval * 2], candidateAt, 8), false);
assert.equal(hasSlurpCreatorPostingIntervalConflict([candidateAt - postingInterval + 1], candidateAt, 8), true);

// ── postsPerDay means posts per day ─────────────────────────────────────────
// The reserve's coverage test and the per-creator spacing rule must use the SAME interval. They
// did not: coverage used half an interval, so a candidate half an interval after an existing slot
// read as uncovered, and with a spare Creator to hand the per-creator rule let it through. The
// reserve laid down twice the requested slots, `reconcileNoodlerPreparedPosts` capped future slots
// back to `postsPerDay` and discarded the rest, and the rolling daily attempt budget — also
// `postsPerDay` — ran out halfway through the day. A production install showed the result: slot
// gaps of 30 minutes for a requested 24 a day, and 100 discarded rows against 42 published.
const reserve = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-reserve.operation.ts",
  "utf8",
);
assert.match(
  reserve,
  /Math\.abs\(Date\.parse\(existing\) - Date\.parse\(candidate\)\) < DAY_MS \/ settings\.postsPerDay,/u,
  "reserve slot coverage must span a whole posting interval, not half of one",
);
assert.doesNotMatch(
  reserve,
  /DAY_MS \/ settings\.postsPerDay \/ 2/u,
  "the half-interval coverage test is what doubled the daily post count",
);

// Drive the actual selection rules over a simulated day. Three or more Creators is the case that
// broke: with only one or two, the per-creator rule masked the disagreement.
const DAY_MS_TEST = 24 * 60 * 60 * 1000;
function slotsPlacedInADay(postsPerDay: number, creators: number): number {
  const interval = DAY_MS_TEST / postsPerDay;
  const ids = Array.from({ length: creators }, (_, index) => `c${index + 1}`);
  const placed: Array<{ at: number; creator: string }> = [];
  for (let poll = 0; poll < 24 * 60; poll += 1) {
    const now = poll * 60_000;
    const live = placed.filter((slot) => slot.at > now - interval);
    const candidate = Array.from({ length: postsPerDay }, (_, i) => now + interval * (i + 1)).find(
      (time) => !live.some((slot) => Math.abs(slot.at - time) < interval),
    );
    if (candidate === undefined) continue;
    const eligible = ids.filter(
      (id) =>
        !hasSlurpCreatorPostingIntervalConflict(
          live.filter((slot) => slot.creator === id).map((slot) => slot.at),
          candidate,
          postsPerDay,
        ),
    );
    if (eligible.length === 0) continue;
    placed.push({ at: candidate, creator: eligible[0]! });
  }
  // Slots laid down for the first full day after the run started.
  return placed.filter((slot) => slot.at <= DAY_MS_TEST).length;
}
for (const postsPerDay of [4, 8, 24]) {
  for (const creators of [1, 3, 6, 12]) {
    const placed = slotsPlacedInADay(postsPerDay, creators);
    assert.ok(
      placed <= postsPerDay,
      `postsPerDay=${postsPerDay} with ${creators} creators placed ${placed} slots in a day`,
    );
  }
}

// The shipped presets document themselves as a ceiling ("at most four posts a day"), and the
// settings ceiling has to be able to express the rate the doubling used to produce by accident.
assert.match(storage, /postsPerDay: z\.number\(\)\.int\(\)\.min\(1\)\.max\(96\),/u);

// ── The grace on a late slot tracks the pace ────────────────────────────────
// Both windows were a hardcoded hour that never learned about `postsPerDay`. At 24 posts a day the
// grace equalled the spacing, so a slot had one interval to survive any hiccup; at 4 posts a day a
// slot missed by 61 minutes was destroyed with its replacement still five hours out. Bunching is
// guarded separately, by refusing to publish within one interval of the creator's last post.
assert.doesNotMatch(
  storage,
  /ELAPSED_PREPARED_SLOT_MS/u,
  "the fixed one-hour grace must not come back; it belongs to the posting interval",
);
assert.match(
  storage,
  /const elapsedPreparedSlotMs = \(postsPerDay: number\) => slurpCreatorPostingIntervalMs\(postsPerDay\);/u,
);
assert.match(storage, /elapsedPreparedSlotMs\(settings\.postsPerDay\)/u);
assert.doesNotMatch(reserve, /DAY_MS \/ 24/u, "the reserve's working-set window was the same fixed hour");
assert.match(reserve, /Date\.parse\(item\.publishAt\) > at\.getTime\(\) - DAY_MS \/ settings\.postsPerDay,/u);
// The anti-bunching guard is what actually stops a late post landing on top of the next one, so it
// has to stay for the widened grace to be safe.
assert.match(
  storage,
  /latestCreatorPost\.createdAt\) \+ slurpCreatorPostingIntervalMs\(settings\.postsPerDay\) > at\.getTime\(\)/u,
);
// A slot is publishable right up to its interval and retired past it, at every pace.
for (const postsPerDay of [4, 24, 96]) {
  const interval = 86_400_000 / postsPerDay;
  assert.equal(hasSlurpCreatorPostingIntervalConflict([0], interval - 1, postsPerDay), true);
  assert.equal(hasSlurpCreatorPostingIntervalConflict([0], interval, postsPerDay), false);
}
assert.match(settingsUi, /value=\{settings\.postsPerDay\}\s*\n\s*min=\{1\}\s*\n\s*max=\{96\}/u);
assert.match(routes, /app\.patch\("\/noodler\/auto-post\/schedule\/:slotId"/u);
assert.match(storage, /item\.id !== current\.id && \(item\.state === "scheduled" \|\| item\.state === "prepared"\)/u);
assert.match(storage, /hasSlurpCreatorPostingIntervalConflict\(activityTimes, publishMs, settings\.postsPerDay\)/u);
assert.match(routes, /result === "conflict"/u);
assert.match(hooks, /slots: SlurpScheduleSlot\[\]/u);
assert.match(settingsUi, /useUpdateNoodlerScheduleSlot/u);
assert.match(settingsUi, /type="datetime-local"/u);
assert.match(homeUi, /ui\.noodle\.stageprofileview\.automaticPostingProviderDisclosure/u);
assert.match(onboardingUi, /ui\.noodle\.noodlerwizard\.autoPostingHelp/u);
for (const key of [
  "ui.noodle.stageprofileview.automaticPostingProviderDisclosure",
  "ui.noodle.noodlerwizard.autoPostingHelp",
]) {
  assert.match(locale[key] ?? "", /provider|API/u, `${key} must disclose provider or API use`);
}
assert.match(
  storage,
  /current\.publishAt !== input\.expectedPublishAt/u,
  "an in-flight generation must not overwrite a slot that was rescheduled",
);
const koboldActivity = normalizeSlurpFanActivityRows(
  [
    { actor: "late_night_raider", type: "like", targetId: "post-1" },
    { actor: "new_visitor", type: "reply", targetId: "post-2", content: "Worth it though." },
  ],
  new Map([
    ["post-1", "creator-1"],
    ["post-2", "creator-1"],
  ]),
);
assert.equal(koboldActivity.rows.length, 2, "KoboldCpp audience arrays and field aliases must normalize");
assert.equal(koboldActivity.rows[1]?.creatorAccountId, "creator-1");
assert.equal(koboldActivity.rows[0]?.actorHandle, "late_night_raider");
assert.equal(koboldActivity.rows[0]?.targetPostId, "post-1");
const aliasedActivity = normalizeSlurpFanActivityRows({
  activities: [
    { actorHandle: "a", creatorAccountId: "creator-1", targetPostId: "post-1", kind: "comment", text: "Nice." },
    { actorHandle: "b", creatorAccountId: "creator-1", targetPostId: "post-1", action: "reply", comment: "Same." },
  ],
});
assert.equal(aliasedActivity.rows[0]?.type, "reply", "a comment type must map to reply");
assert.equal(aliasedActivity.rows[0]?.content, "Nice.");
assert.equal(aliasedActivity.rows[1]?.type, "reply");
assert.equal(aliasedActivity.rows[1]?.content, "Same.");

const generatedAt = new Date("2026-08-20T15:25:00.000Z");
const publicationTime = new Date("2026-08-21T08:30:00.000Z");
const immediateTiming = buildSlurpPostTimingContext(generatedAt);
const scheduledTiming = buildSlurpPostTimingContext(generatedAt, publicationTime);
assert.match(immediateTiming, /Current local date and time:/u);
assert.match(immediateTiming, /Write for publication now/u);
assert.match(scheduledTiming, /Expected publication date and time:/u);
assert.match(scheduledTiming, /Write as if the post is being published at that expected time/u);
assert.doesNotMatch(scheduledTiming, /Write for publication now/u);

const reschedule = storage.slice(
  storage.indexOf("async rescheduleNoodlerPost"),
  storage.indexOf("async listNoodlerPreparedPosts"),
);
assert.match(reschedule, /policyFingerprint: noodlerReservePolicyFingerprint\(account, settings, source\?\.updatedAt/u);

async function testPollOrdering() {
  const operations: string[] = [];
  let publishPass = 0;
  let preparePass = 0;
  const result = await runSlurpAutoPostPollOperations({
    reconcile: async () => {
      operations.push("reconcile");
    },
    publishDue: async () => {
      operations.push(`publish:${++publishPass}`);
      return 1;
    },
    prepare: async () => {
      operations.push(`prepare:${++preparePass}`);
      return "prepared";
    },
    generationMode: async () => "on_demand",
  });
  assert.deepEqual(operations, ["reconcile", "publish:1", "prepare:1", "publish:2", "prepare:2"]);
  assert.deepEqual(result, { published: 2, reserve: "prepared" });

  const preGeneratedOperations: string[] = [];
  const preGenerated = await runSlurpAutoPostPollOperations({
    reconcile: async () => {
      preGeneratedOperations.push("reconcile");
    },
    publishDue: async () => {
      preGeneratedOperations.push("publish");
      return 1;
    },
    prepare: async () => {
      preGeneratedOperations.push("prepare");
      return "prepared";
    },
    generationMode: async () => "pre_generate",
  });
  assert.deepEqual(preGeneratedOperations, ["reconcile", "publish", "prepare", "publish"]);
  assert.deepEqual(preGenerated, { published: 2, reserve: "prepared" });

  const failedOperations: string[] = [];
  const failed = await runSlurpAutoPostPollOperations({
    reconcile: async () => {
      failedOperations.push("reconcile");
    },
    publishDue: async () => {
      failedOperations.push("publish");
      return 0;
    },
    prepare: async () => {
      failedOperations.push("prepare");
      return "busy";
    },
    generationMode: async () => "pre_generate",
  });
  assert.deepEqual(failedOperations, ["reconcile", "publish", "prepare"]);
  assert.deepEqual(failed, { published: 0, reserve: "busy" });
}
async function testActivationLifecycle() {
  const lifecycle = createSlurpActivationLifecycle();
  const order: string[] = [];
  let releaseRegistration!: () => void;
  const registrationBlocked = new Promise<void>((resolve) => {
    releaseRegistration = resolve;
  });
  const firstActivation = lifecycle.activate(async (addTeardown) => {
    addTeardown(() => order.push("routes"));
    await registrationBlocked;
    addTeardown(() => order.push("service"));
    addTeardown(() => order.push("scheduler"));
  });
  await assert.rejects(
    lifecycle.activate(async () => {}),
    /Slurp is already active/u,
  );
  releaseRegistration();
  const stop = await firstActivation;
  await stop();
  assert.deepEqual(order, ["scheduler", "service", "routes"]);

  const activationError = new Error("scheduler failed to start");
  await assert.rejects(
    lifecycle.activate((addTeardown) => {
      addTeardown(() => order.push("partial routes"));
      throw activationError;
    }),
    (error) => error === activationError,
  );
  assert.deepEqual(order, ["scheduler", "service", "routes", "partial routes"]);

  const stopAfterFailure = await lifecycle.activate(async () => {});
  await stopAfterFailure();
  await stopAfterFailure();

  const firstFailureLifecycle = createSlurpActivationLifecycle();
  const laterError = new Error("later cleanup failed");
  const stopWithFailures = await firstFailureLifecycle.activate((addTeardown) => {
    addTeardown(() => {
      throw laterError;
    });
    addTeardown(() => {
      throw undefined;
    });
  });
  await assert.rejects(stopWithFailures, (error) => error === undefined);

  const stopAfterTeardownError = await firstFailureLifecycle.activate(async () => {});
  await stopAfterTeardownError();
}

Promise.all([testPollOrdering(), testActivationLifecycle()]).then(
  () => console.log("Slurp automatic posting regressions passed."),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
