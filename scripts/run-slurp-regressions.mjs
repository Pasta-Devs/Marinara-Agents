import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Runs every Slurp regression file, four at a time. The files in PLAIN_TSX keep the default
// tsconfig, the same exemption `test:noodle:regressions` makes.
const root = fileURLToPath(new URL("..", import.meta.url));
const tsx = join(root, "node_modules/.bin/tsx");
const PLAIN_TSX = new Set([
  "tests/slurp-phase1-durability.regression.ts",
  "tests/slurp2-reset-activity.regression.ts",
  "tests/slurp2-anchor-edits.regression.ts",
  "tests/slurp2-message-deep-details.regression.ts",
  "tests/slurp2-engine-avatar-variant.regression.ts",
  "tests/slurp2-restore-media.regression.ts",
]);
const CONCURRENCY = 4;
const TAIL_LINES = 30;
const TIMEOUT_MS = 5 * 60 * 1000;

// Some files copy from an Engine checkout. Fail loudly instead of skipping them when there is none.
const engineRoot = process.env.MARINARA_ENGINE_ROOT || join(root, "../Marinara-Engine");
if (!existsSync(join(engineRoot, "packages/shared/src/types/noodle.ts"))) {
  console.error(
    `Slurp regressions need a Marinara Engine checkout. Set MARINARA_ENGINE_ROOT (looked in ${engineRoot}).`,
  );
  process.exit(1);
}
// Some files import the built shared package, so the Engine must have it built first.
if (!existsSync(join(engineRoot, "packages/shared/dist/index.js"))) {
  console.error(
    `Missing ${join(engineRoot, "packages/shared/dist/index.js")}. Build the Engine shared package first: pnpm --filter @marinara-engine/shared build`,
  );
  process.exit(1);
}

const files = readdirSync(join(root, "tests"))
  .filter((name) => /^slurp(2)?-.*\.regression\.ts$/u.test(name))
  .map((name) => `tests/${name}`)
  .sort();
if (files.length === 0) {
  console.error("No Slurp regression files matched tests/slurp-*.regression.ts or tests/slurp2-*.regression.ts.");
  process.exit(1);
}

function runFile(file) {
  const args = PLAIN_TSX.has(file) ? [file] : ["--tsconfig", "tests/tsconfig.regressions.json", file];
  return new Promise((resolve) => {
    const child = spawn(tsx, args, { cwd: root, env: process.env });
    let output = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
    }, TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ file, passed: false, output: `${output}\n${error.stack ?? error}\n` });
    });
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) output += `\nTimed out after ${TIMEOUT_MS / 1000} seconds.\n`;
      resolve({ file, passed: !timedOut && code === 0, output });
    });
  });
}

const failures = [];
let next = 0;
async function worker() {
  while (next < files.length) {
    const result = await runFile(files[next++]);
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.file}`);
    if (!result.passed) failures.push(result);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

for (const failure of failures) {
  console.log(`\n--- ${failure.file}: last ${TAIL_LINES} output lines ---`);
  console.log(failure.output.trimEnd().split("\n").slice(-TAIL_LINES).join("\n"));
}

console.log(
  `\nSlurp regressions: ${files.length - failures.length} passed, ${failures.length} failed of ${files.length}`,
);
process.exitCode = failures.length > 0 ? 1 : 0;
