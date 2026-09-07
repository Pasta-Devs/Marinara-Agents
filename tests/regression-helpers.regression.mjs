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
  { encoding: "utf8" },
);
assert.notEqual(timeoutResult.status, 0, timeoutResult.stdout + timeoutResult.stderr);
assert.match(timeoutResult.stderr, /"name":"RegressionCompletionTimeoutError"/u);
assert.match(timeoutResult.stderr, /never regression did not reach completion within 25ms/u);

const successResult = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `import { runRegressionToCompletion } from ${JSON.stringify(helperUrl)};
await runRegressionToCompletion("quick", async () => {});`,
  ],
  { encoding: "utf8" },
);
assert.equal(successResult.status, 0, successResult.stdout + successResult.stderr);

console.log("Regression completion watchdog: timeout and success paths passed.");
