import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";

export function validateDottoreReadiness() {
  const workflow = readFileSync(new URL("../.github/workflows/dottore-review.yml", import.meta.url), "utf8");
  const auto = readFileSync(new URL("../.github/workflows/dottore-review-auto.yml", import.meta.url), "utf8");
  const admission = workflow.match(/^ {2}admission:\n([\s\S]*?)(?=^ {2}review:\n)/mu)?.[1];
  assert.ok(admission, "Dottore must admit a fresh ready PR before calling the shared reviewer");
  assert.match(admission, /permissions:\n {6}contents: read\n {6}pull-requests: read/u);
  assert.match(admission, /admitted: \$\{\{ steps\.ready\.outputs\.admitted \}\}/u);
  assert.match(admission, /id: ready/u);
  assert.match(admission, /PR_NUM: \$\{\{ inputs\.pr_number \}\}/u);
  assert.match(admission, /GH_REPO: \$\{\{ github\.repository \}\}/u);
  assert.match(admission, /DOTTORE_BASE_REFS: \$\{\{ vars\.DOTTORE_BASE_REFS \|\| 'refactor,main,staging' \}\}/u);
  assert.doesNotMatch(admission, /actions\/checkout|npm |pnpm |uses:|actions: write|DOTTORE_.*API_KEY/u);
  assert.match(
    workflow,
    / {2}review:\n {4}needs: admission\n {4}if: needs\.admission\.outputs\.admitted == 'true'\n {4}uses: Pasta-Devs\/Marinara-Engine\/\.github\/workflows\/dottore-review\.yml@[0-9a-f]{40}\n/u,
  );
  assert.match(workflow, /cancel-in-progress: true/u);
  assert.match(auto, /types: \[opened, reopened, synchronize, ready_for_review, edited\]/u);
  assert.match(auto, /vars\.DOTTORE_AUTO_REVIEW == 'true'/u);
  assert.match(auto, /--ref "\$TARGET_REF"/u);

  const run = admission.match(/ {8}run: \|\n([\s\S]*)/u)?.[1];
  assert.ok(run, "Admission must expose its actual shell for execution controls");
  const shell = run
    .trimEnd()
    .split("\n")
    .map((line) => line.replace(/^ {10}/u, ""))
    .join("\n");
  assert.doesNotMatch(shell, /\$\{\{/u, "Use environment variables rather than interpolating event input into shell");

  const directory = mkdtempSync(join(tmpdir(), "marinara-dottore-admission-"));
  try {
    const gh = join(directory, "gh");
    writeFileSync(
      gh,
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.MOCK_GH_CALLS, JSON.stringify(args) + "\\n");
const expected = ["pr", "view", process.env.PR_NUM, "--repo", process.env.GH_REPO, "--json", "state,isDraft,baseRefName"];
if (JSON.stringify(args) !== JSON.stringify(expected)) process.exit(91);
if (process.env.MOCK_GH_FAILURE === "true") process.exit(92);
process.stdout.write(process.env.MOCK_PR_JSON);
`,
    );
    chmodSync(gh, 0o700);
    const ready = { state: "OPEN", isDraft: false, baseRefName: "staging" };
    const cases = [
      { name: "ready staging", pr: ready, admitted: true },
      { name: "ready main", pr: { ...ready, baseRefName: "main" }, admitted: true },
      {
        name: "ready while CI is pending",
        pr: { ...ready, statusCheckRollup: [{ status: "PENDING" }] },
        admitted: true,
      },
      { name: "ready fork metadata remains data", pr: { ...ready, isCrossRepository: true }, admitted: true },
      { name: "draft", pr: { ...ready, isDraft: true } },
      { name: "draft main", pr: { ...ready, isDraft: true, baseRefName: "main" } },
      { name: "closed", pr: { ...ready, state: "CLOSED" } },
      { name: "merged", pr: { ...ready, state: "MERGED" } },
      { name: "unreviewed base", pr: { ...ready, baseRefName: "feature/example" } },
      { name: "base must match a whole entry", pr: { ...ready, baseRefName: "main-extra" } },
      { name: "configured bases", pr: { ...ready, baseRefName: "release" }, refs: "release", admitted: true },
      { name: "configured bases restrict staging", pr: ready, refs: "release" },
      { name: "missing draft flag", pr: { state: "OPEN", baseRefName: "staging" }, failure: true },
      { name: "string draft flag", pr: { ...ready, isDraft: "false" }, failure: true },
      { name: "missing state", pr: { isDraft: false, baseRefName: "staging" }, failure: true },
      { name: "unknown state", pr: { ...ready, state: "UNKNOWN" }, failure: true },
      { name: "empty base", pr: { ...ready, baseRefName: "" }, failure: true },
      { name: "malformed response", json: "not json", failure: true },
      { name: "API failure", pr: ready, apiFailure: true, failure: true },
      { name: "invalid PR number", number: "--help", pr: ready, failure: true, calls: 0 },
      { name: "zero PR number", number: "0", pr: ready, failure: true, calls: 0 },
    ];
    for (const test of cases) {
      const output = join(directory, "output");
      const calls = join(directory, "calls");
      writeFileSync(output, "");
      writeFileSync(calls, "");
      const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", shell], {
        encoding: "utf8",
        env: {
          PATH: `${directory}${delimiter}${process.env.PATH}`,
          GH_REPO: "Pasta-Devs/Marinara-Agents",
          PR_NUM: test.number ?? "1644",
          DOTTORE_BASE_REFS: test.refs ?? "main,staging",
          GITHUB_OUTPUT: output,
          MOCK_GH_CALLS: calls,
          MOCK_PR_JSON: test.json ?? JSON.stringify(test.pr),
          MOCK_GH_FAILURE: String(test.apiFailure ?? false),
        },
      });
      assert.ifError(result.error);
      assert.equal(result.status === 0, !test.failure, `${test.name}: ${result.stderr}`);
      assert.equal(
        readFileSync(output, "utf8"),
        test.admitted ? "admitted=false\nadmitted=true\n" : "admitted=false\n",
        test.name,
      );
      assert.equal(readFileSync(calls, "utf8").trim().split("\n").filter(Boolean).length, test.calls ?? 1, test.name);
    }
    return cases.length;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.info(`Dottore readiness: ${validateDottoreReadiness()} admission controls passed.`);
}
