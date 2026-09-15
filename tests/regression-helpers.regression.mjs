import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const helperUrl = new URL("./regression-helpers.mjs", import.meta.url).href;
const timeoutResult = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `import { runRegressionToCompletion } from ${JSON.stringify(helperUrl)};
try {
  await runRegressionToCompletion("never", () => new Promise(() => {}), 25);
} catch (error) {
  console.error(JSON.stringify({ name: error.name, message: error.message }));
  process.exitCode = 1;
}`,
  ],
  { encoding: "utf8", timeout: 2_000 },
);
assert.notEqual(timeoutResult.status, 0, timeoutResult.stdout + timeoutResult.stderr);
assert.match(timeoutResult.stderr, /"name":"RegressionCompletionTimeoutError"/u);
assert.match(timeoutResult.stderr, /never regression did not reach completion within 25ms/u);

const liveHandleResult = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `import { runRegressionToCompletion } from ${JSON.stringify(helperUrl)};
setInterval(() => {}, 1_000);
try {
  await runRegressionToCompletion("live-handle", () => new Promise(() => {}), 25);
} catch (error) {
  console.error(JSON.stringify({ name: error.name, message: error.message }));
  process.exitCode = 1;
}`,
  ],
  { encoding: "utf8", timeout: 2_000 },
);
assert.notEqual(liveHandleResult.status, null, liveHandleResult.error?.message);
assert.notEqual(liveHandleResult.status, 0, liveHandleResult.stdout + liveHandleResult.stderr);

const successResult = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `import { runRegressionToCompletion } from ${JSON.stringify(helperUrl)};
await runRegressionToCompletion("quick", async () => {}, 30_000);`,
  ],
  { encoding: "utf8", timeout: 1_000 },
);
assert.equal(successResult.status, 0, successResult.stdout + successResult.stderr);

const rejectionResult = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `import { runRegressionToCompletion } from ${JSON.stringify(helperUrl)};
try {
  await runRegressionToCompletion("rejection", async () => {
    throw new Error("ordinary failure");
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}`,
  ],
  { encoding: "utf8", timeout: 1_000 },
);
assert.notEqual(rejectionResult.status, 0, rejectionResult.stdout + rejectionResult.stderr);
assert.match(rejectionResult.stderr, /ordinary failure/u);

console.log("Regression completion watchdog: timeout and success paths passed.");
