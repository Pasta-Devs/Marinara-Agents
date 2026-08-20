import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSlurpActivationLifecycle } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-activation-lifecycle.ts";
import { buildSlurpPostTimingContext } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-post-timing.ts";
import { runSlurpAutoPostPollOperations } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-autopost-poll.ts";

const storage = readFileSync("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
const refreshScheduler = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-refresh-scheduler.service.ts",
  "utf8",
);
const hooks = readFileSync("packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");
const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
const settingsUi = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx",
  "utf8",
);

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
assert.match(storage, /autoPostGenerationMode: "pre_generate"/u);
assert.match(storage, /state: "scheduled"/u);
assert.match(storage, /ELAPSED_PREPARED_SLOT_MS = 60 \* 60 \* 1000/u);
assert.match(storage, /Date\.parse\(item\.publishAt\) < at\.getTime\(\) - ELAPSED_PREPARED_SLOT_MS/u);
assert.match(routes, /app\.patch\("\/noodler\/auto-post\/schedule\/:slotId"/u);
assert.match(hooks, /slots: SlurpScheduleSlot\[\]/u);
assert.match(settingsUi, /useUpdateNoodlerScheduleSlot/u);
assert.match(settingsUi, /type="datetime-local"/u);
assert.match(
  storage,
  /current\.publishAt !== input\.expectedPublishAt/u,
  "an in-flight generation must not overwrite a slot that was rescheduled",
);

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
