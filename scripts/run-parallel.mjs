#!/usr/bin/env node
/**
 * Run independent commands concurrently, one process per core by default.
 *
 * The Pull Request Checks job used to run its lint, typecheck and some forty regression steps one after another on a
 * four-core runner (#1579). This runs the commands it is given as arguments, or one per line on stdin (blank lines and
 * `#` comments are skipped), keeps each command's output together and prints it when the command finishes, as a
 * collapsed log group on GitHub Actions. Every command runs even after one fails, so one run shows every failure, and
 * the exit status is 1 if any command failed.
 *
 * ponytail: no per-command timeout; the job's own timeout bounds a hung command.
 */
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";

const USAGE = "Usage: node scripts/run-parallel.mjs [--jobs <n>] [<command>...]  (no commands: one per line on stdin)";

const args = process.argv.slice(2);
let jobs = availableParallelism();
if (args[0] === "--jobs") {
  if (!/^[1-9]\d*$/.test(args[1] ?? "")) usage("--jobs takes a positive whole number.");
  jobs = Number(args.splice(0, 2)[1]);
}
const commands = (args.length ? args : (await readStdin()).split("\n"))
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
// An empty list is a misconfiguration (a heredoc that lost its body, say), never a clean run.
if (commands.length === 0) usage("No commands to run.");

function usage(message) {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
}

const onActions = process.env.GITHUB_ACTIONS === "true";
const started = performance.now();
const seconds = (since) => ((performance.now() - since) / 1000).toFixed(1);
let failures = 0;
let next = 0;

async function worker() {
  while (next < commands.length) {
    const command = commands[next++];
    const { code, signal, output } = await run(command);
    const status = code === 0 ? "passed" : `failed (${signal ?? `exit ${code}`})`;
    const title = `${command}: ${status} in ${seconds(output.started)}s`;
    if (code !== 0) failures += 1;
    // A failure stays expanded so the log shows it; GitHub collapses groups by default.
    if (onActions && code !== 0) console.log(`::error::${title}`);
    if (onActions && code === 0) console.log(`::group::${title}`);
    else console.log(`+ ${title}`);
    process.stdout.write(output.text);
    if (onActions && code === 0) console.log("::endgroup::");
  }
}

function run(command) {
  return new Promise((resolve) => {
    const output = { started: performance.now(), text: "" };
    const child = spawn(command, { shell: true, stdio: ["ignore", "pipe", "pipe"] });
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => (output.text += chunk));
    child.on("error", (error) => resolve({ code: 1, signal: null, output: { ...output, text: `${error}\n` } }));
    child.on("close", (code, signal) => resolve({ code: code ?? 1, signal, output }));
  });
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (text += chunk));
    process.stdin.on("end", () => resolve(text));
    process.stdin.on("error", reject);
  });
}

await Promise.all(Array.from({ length: Math.min(jobs, commands.length) }, worker));
console.log(
  `${commands.length - failures} of ${commands.length} commands passed in ${seconds(started)}s (${jobs} jobs)`,
);
process.exit(failures ? 1 : 0);
