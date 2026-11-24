import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";

// GitHub runs these events' workflows from the default branch and shows their runs on its head commit, where a
// cancelled run looks like a failed check. A workflow_dispatch run belongs to the ref it was dispatched on instead:
// dottore-review.yml runs on the pull request's base, and the shared reviewer it calls keeps its own cancelling group.
const DEFAULT_BRANCH_EVENTS = ["workflow_run", "check_run", "check_suite", "issue_comment"];
const REPOSITORY = "Pasta-Devs/Marinara-Agents";
const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

function readWorkflow(name) {
  return readFileSync(new URL(name, workflowsDirectory), "utf8");
}

function triggers(workflow) {
  const block = workflow.match(/^on:\n((?:(?: {2}.*)?\n)*)/mu)?.[1];
  assert.ok(block, "Every workflow lists its triggers as a block");
  return [...block.matchAll(/^ {2}([a-z_]+):/gmu)].map((match) => match[1]);
}

function steps(workflow) {
  return workflow
    .split(/^(?= {6}- name: )/mu)
    .slice(1)
    .map((text) => ({ name: text.match(/^ {6}- name: (.+)$/mu)[1], text }));
}

function step(workflow, name) {
  const found = steps(workflow).find((candidate) => candidate.name === name);
  assert.ok(found, `Missing workflow step: ${name}`);
  return found.text;
}

// A YAML block scalar under `key: |`, without its indentation.
function blockScalar(text, key, indent) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === `${" ".repeat(indent)}${key}: |`);
  assert.notEqual(start, -1, `Missing ${key} block`);
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && !line.startsWith(" ".repeat(indent + 2))) break;
    body.push(line.slice(indent + 2));
  }
  return body.join("\n").trimEnd();
}

// Evaluates a step's `if:` the way Actions does for these string comparisons, given the earlier steps' outputs.
function stepRuns(text, outputs) {
  const condition = text.match(/^ {8}if: (?:>-\n((?: {10}.*\n)+)|(.*)\n)/mu);
  if (!condition) return true;
  const expression = (condition[1] ?? condition[2]).replace(/\s+/gu, " ").trim();
  assert.match(expression, /^(?:steps\.[a-z-]+\.outputs\.[a-z]+ != '[a-z]*'(?: && |$))+$/u, expression);
  const resolved = expression.replace(/steps\.([a-z-]+)\.outputs\.([a-z]+)/gu, (_, id, output) =>
    JSON.stringify(outputs[id]?.[output] ?? ""),
  );
  return new Function(`return ${resolved};`)();
}

function validateNoCancellingGroups() {
  const checked = [];
  for (const name of readdirSync(workflowsDirectory).filter((file) => file.endsWith(".yml"))) {
    const workflow = readWorkflow(name);
    if (!triggers(workflow).some((event) => DEFAULT_BRANCH_EVENTS.includes(event))) continue;
    assert.doesNotMatch(
      workflow,
      /^ *concurrency:/mu,
      `${name} runs from the default branch, so it may not cancel runs`,
    );
    checked.push(name);
  }
  for (const name of ["owner-approval-review.yml", "dottore-review-approve.yml", "coderabbit-review-gate.yml"]) {
    assert.ok(checked.includes(name), `${name} must be checked as a default-branch workflow`);
  }
  return checked.length;
}

async function validateOwnerApprovalEvaluator() {
  const workflow = readWorkflow("owner-approval-review.yml");
  assert.deepEqual(
    steps(workflow).map(({ name }) => name),
    [
      "Resolve pull request",
      "Check for a newer review",
      "Checkout trusted default branch",
      "Set up Node.js",
      "Check for a newer review before publishing",
      "Publish owner approval status",
    ],
  );
  assert.match(workflow, /^ {6}actions: read$/mu);

  // Only the newest run gets past the checks; an older run skips the checkout, the setup and the publish.
  const gated = steps(workflow).slice(2);
  const ran = (outputs) => gated.filter(({ text }) => stepRuns(text, outputs)).map(({ name }) => name);
  const resolved = { "pull-request": { number: "1644" } };
  assert.deepEqual(ran({ "pull-request": { number: "" } }), []);
  assert.deepEqual(ran({ ...resolved, early: { superseded: "true" } }), []);
  assert.deepEqual(
    ran({ ...resolved, late: { superseded: "true" } }),
    gated.slice(0, 3).map(({ name }) => name),
  );
  assert.deepEqual(
    ran(resolved),
    gated.map(({ name }) => name),
  );

  const early = step(workflow, "Check for a newer review");
  const late = step(workflow, "Check for a newer review before publishing");
  assert.match(early, /^ {8}id: early$/mu);
  assert.match(late, /^ {8}id: late$/mu);
  for (const text of [early, late]) {
    assert.match(text, /uses: actions\/github-script@[0-9a-f]{40} #/u);
    assert.match(text, /PR_NUMBER: \$\{\{ steps\.pull-request\.outputs\.number \}\}/u);
  }
  const script = blockScalar(early, "script", 10);
  assert.equal(blockScalar(late, "script", 10), script, "Both checks run the same script");

  const signal = {
    id: 500,
    workflow_id: 77,
    created_at: "2026-11-24T22:33:30Z",
    head_sha: "a".repeat(40),
    pull_requests: [{ number: 1644 }],
  };
  const fork = { ...signal, pull_requests: [] };
  const run = (overrides) => ({
    id: 501,
    status: "queued",
    conclusion: null,
    head_sha: signal.head_sha,
    pull_requests: [{ number: 1644 }],
    ...overrides,
  });
  const cases = [
    { name: "no other run", runs: [run({ id: 500 })] },
    { name: "older run", runs: [run({ id: 499 })] },
    { name: "newer queued run", runs: [run({})], superseded: true },
    { name: "newer running run", runs: [run({ status: "in_progress" })], superseded: true },
    { name: "newer finished run", runs: [run({ status: "completed", conclusion: "success" })], superseded: true },
    { name: "newer cancelled run", runs: [run({ status: "completed", conclusion: "cancelled" })], superseded: true },
    { name: "newer run after a push", runs: [run({ head_sha: "b".repeat(40) })], superseded: true },
    { name: "newer run for another PR", runs: [run({ pull_requests: [{ number: 1645 }] })] },
    { name: "newer run awaiting approval", runs: [run({ status: "completed", conclusion: "action_required" })] },
    { name: "newer run waiting as action_required", runs: [run({ status: "action_required" })] },
    { name: "newer run that never started", runs: [run({ status: "completed", conclusion: "startup_failure" })] },
    { name: "fork: newer run on the head", signal: fork, runs: [run({ pull_requests: [] })], superseded: true },
    { name: "fork: newer run on another head", signal: fork, runs: [run({ pull_requests: [], head_sha: "c" })] },
    { name: "fork: older run on the head", signal: fork, runs: [run({ id: 499, pull_requests: [] })] },
    { name: "lookup fails", error: true, warned: true },
  ];
  for (const test of cases) {
    const payload = test.signal ?? signal;
    const listWorkflowRuns = Symbol("listWorkflowRuns");
    const requests = [];
    const outputs = {};
    const messages = { notice: [], warning: [] };
    const github = {
      rest: { actions: { listWorkflowRuns } },
      async paginate(route, parameters) {
        requests.push({ route, parameters });
        if (test.error) throw new Error("API unavailable");
        return test.runs;
      },
    };
    const core = {
      setOutput: (key, value) => (outputs[key] = value),
      notice: (message) => messages.notice.push(message),
      warning: (message) => messages.warning.push(message),
    };
    const context = { repo: { owner: "Pasta-Devs", repo: "Marinara-Agents" }, payload: { workflow_run: payload } };
    await new AsyncFunction("github", "context", "core", "process", script)(github, context, core, {
      env: { PR_NUMBER: "1644" },
    });
    assert.deepEqual(
      requests,
      [
        {
          route: listWorkflowRuns,
          parameters: {
            owner: "Pasta-Devs",
            repo: "Marinara-Agents",
            workflow_id: 77,
            created: ">=2026-11-24T22:33:30Z",
            per_page: 100,
          },
        },
      ],
      test.name,
    );
    assert.deepEqual(outputs, test.superseded ? { superseded: "true" } : {}, test.name);
    assert.equal(messages.notice.length, test.superseded ? 1 : 0, test.name);
    assert.equal(messages.warning.length, test.warned ? 1 : 0, test.name);
  }
  return cases.length;
}

function validateDottoreApprovalDispatch() {
  const workflow = readWorkflow("dottore-review-approve.yml");
  const runName = workflow.match(/^run-name: "(.*)"$/mu)?.[1];
  assert.ok(runName, "The dispatch names its runs after the head");
  const title = (sha, conclusion) =>
    runName
      .replace("${{ github.event.workflow_run.head_sha }}", sha)
      .replace("${{ github.event.workflow_run.conclusion }}", conclusion);
  assert.doesNotMatch(title("x", "y"), /\$\{\{/u);
  assert.match(workflow, /TRIGGER_CREATED: \$\{\{ github\.event\.workflow_run\.created_at \}\}/u);

  const dispatch = step(workflow, "Dispatch Dottore's approval check");
  const shell = blockScalar(dispatch, "run", 8).replaceAll("${{ github.repository }}", REPOSITORY);
  assert.doesNotMatch(shell, /\$\{\{/u);

  const head = "d".repeat(40);
  const directory = mkdtempSync(join(tmpdir(), "marinara-dottore-dispatch-"));
  try {
    const gh = join(directory, "gh");
    writeFileSync(
      gh,
      `#!/usr/bin/env node
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.MOCK_GH_CALLS, JSON.stringify(args) + "\\n");
const jq = args.indexOf("--jq");
function reply(value) {
  const json = JSON.stringify(value);
  if (jq === -1) return process.stdout.write(json);
  const result = spawnSync("jq", ["-r", args[jq + 1]], { input: json, encoding: "utf8" });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.status;
}
const path = args.find((arg) => arg.startsWith("repos/")) ?? "";
if (args[0] === "api" && path.endsWith("/actions/workflows/dottore-review-approve.yml/runs")) {
  const lookups = fs.readFileSync(process.env.MOCK_GH_CALLS, "utf8").split("\\n").filter((line) => line.includes(path));
  const pages = JSON.parse(process.env.MOCK_RUNS);
  const runs = pages[Math.min(lookups.length, pages.length) - 1];
  if (runs === null) process.exit(92);
  reply({ total_count: runs.length, workflow_runs: runs });
} else if (args[0] === "pr" && args[1] === "view") {
  reply({ state: "OPEN", isDraft: false, headRefOid: process.env.HEAD_SHA, baseRefName: "staging" });
} else if (args[0] === "api" && path.includes("/issues/")) {
  const markers = ["walkthrough", "last-reviewed-sha=" + process.env.HEAD_SHA, "discharge"];
  const body = markers.map((marker) => "<!-- dottore:" + marker + " -->").join("\\n") + "\\nExamination notes.";
  reply([{ user: { login: "github-actions[bot]" }, body }]);
} else if (!(args[0] === "workflow" && args[1] === "run")) {
  process.exit(91);
}
`,
    );
    chmodSync(gh, 0o700);

    const run = (overrides) => ({
      id: 501,
      display_title: title(head, "success"),
      status: "queued",
      conclusion: null,
      ...overrides,
    });
    const cases = [
      { name: "no newer run", runs: [[run({ id: 500, status: "in_progress" }), run({ id: 400 })]], dispatched: true },
      { name: "newer queued run", runs: [[run({})]] },
      { name: "newer running run", runs: [[run({ status: "in_progress" })]] },
      { name: "newer successful run", runs: [[run({ status: "completed", conclusion: "success" })]] },
      { name: "newer run appears before the dispatch", runs: [[], [run({ status: "in_progress" })]], late: true },
      // A run for another head, after a failed check, or one that ended without success dispatches nothing for this
      // head, so this run dispatches.
      {
        name: "newer run for another head",
        runs: [[run({ display_title: title("e".repeat(40), "success") })]],
        dispatched: true,
      },
      {
        name: "newer run after a failed check",
        runs: [[run({ display_title: title(head, "failure") })]],
        dispatched: true,
      },
      {
        name: "newer run that was cancelled",
        runs: [[run({ status: "completed", conclusion: "cancelled" })]],
        dispatched: true,
      },
      {
        name: "newer run that failed",
        runs: [[run({ status: "completed", conclusion: "failure" })]],
        dispatched: true,
      },
      { name: "older run", runs: [[run({ id: 499 })]], dispatched: true },
      { name: "lookup fails", runs: [null], dispatched: true },
    ];
    for (const test of cases) {
      const calls = join(directory, "calls");
      writeFileSync(calls, "");
      const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", shell], {
        encoding: "utf8",
        env: {
          PATH: `${directory}${delimiter}${process.env.PATH}`,
          GITHUB_REPOSITORY: REPOSITORY,
          GITHUB_RUN_ID: "500",
          GH_TOKEN: "token",
          HEAD_SHA: head,
          PR_FROM_RUN: "1644",
          HEAD_OWNER: "Pasta-Devs",
          HEAD_BRANCH: "feature/example",
          WORKFLOW_NAME: "Pull Request Checks",
          TRIGGER_CREATED: "2026-11-24T22:33:30Z",
          DOTTORE_BASE_REFS: "refactor,main,staging",
          MOCK_GH_CALLS: calls,
          MOCK_RUNS: JSON.stringify(test.runs),
        },
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, `${test.name}: ${result.stderr}`);
      const made = readFileSync(calls, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
      const lookups = made.filter((args) => args.some((arg) => arg.endsWith("/dottore-review-approve.yml/runs")));
      for (const lookup of lookups) {
        assert.deepEqual(lookup.slice(0, 11), [
          "api",
          "--method",
          "GET",
          "--paginate",
          `repos/${REPOSITORY}/actions/workflows/dottore-review-approve.yml/runs`,
          "-f",
          "event=workflow_run",
          "-f",
          "created=>=2026-11-24T22:33:30Z",
          "-f",
          "per_page=100",
        ]);
      }
      const reachedDispatch = Boolean(test.dispatched || test.late);
      assert.equal(lookups.length, reachedDispatch ? 2 : 1, test.name);
      assert.equal(
        made.some((args) => args[0] === "pr"),
        reachedDispatch,
        test.name,
      );
      assert.equal(
        made.some((args) => args[0] === "workflow"),
        Boolean(test.dispatched),
        test.name,
      );
    }
    return cases.length;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export async function validateDefaultBranchRuns() {
  return validateNoCancellingGroups() + (await validateOwnerApprovalEvaluator()) + validateDottoreApprovalDispatch();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.info(`Default-branch runs: ${await validateDefaultBranchRuns()} checks passed.`);
}
