import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSlurpActivationLifecycle } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-activation-lifecycle.ts";

const storage = readFileSync("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
const refreshScheduler = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-refresh-scheduler.service.ts",
  "utf8",
);
const hooks = readFileSync("packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");

assert.match(
  storage,
  /preparationNotBefore: timestamp/u,
  "new reserve state must be immediately eligible for its first prepared post",
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
    activationError,
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

testActivationLifecycle().then(
  () => console.log("Slurp automatic posting regressions passed."),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
