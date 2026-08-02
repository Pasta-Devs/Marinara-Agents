import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function extractNamedStep(workflow, stepName) {
  const marker = `      - name: ${stepName}\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing workflow step: ${stepName}`);

  const nextStep = workflow.indexOf("\n      - ", start + marker.length);
  return workflow.slice(start, nextStep === -1 ? undefined : nextStep);
}

export function validatePullRequestTriage() {
  const triageWorkflow = readFileSync(
    new URL("../.github/workflows/pull-request-triage.yml", import.meta.url),
    "utf8",
  );
  const codeOwners = readFileSync(new URL("../.github/CODEOWNERS", import.meta.url), "utf8");
  const untrustedReviewGate = new URL("../.github/workflows/owner-approval-review.yml", import.meta.url);
  const triggersSectionStart = triageWorkflow.indexOf("\non:\n");
  const triggersSectionEnd = triageWorkflow.indexOf("\nconcurrency:\n", triggersSectionStart);
  const jobsSectionStart = triageWorkflow.indexOf("\njobs:\n");

  assert.notEqual(triggersSectionStart, -1, "Missing workflow trigger section");
  assert.notEqual(triggersSectionEnd, -1, "Missing end of workflow trigger section");
  assert.notEqual(jobsSectionStart, -1, "Missing workflow jobs section");
  assert.equal(
    triageWorkflow.slice(triggersSectionStart + 1, triggersSectionEnd),
    "on:\n  pull_request_target:\n    types: [opened, reopened, edited, synchronize, ready_for_review]\n    branches: [staging, main]\n",
  );

  const jobIds = [
    ...triageWorkflow
      .slice(jobsSectionStart + "\njobs:\n".length)
      .matchAll(/^  ([A-Za-z_][A-Za-z0-9_-]*):\s*$/gmu),
  ].map((match) => match[1]);
  assert.ok(jobIds.includes("branch-policy"));
  assert.ok(jobIds.includes("template-check"));
  assert.equal(jobIds.some((jobId) => /approval|review/iu.test(jobId)), false);
  assert.doesNotMatch(triageWorkflow, /github\.event\.review|pulls\.listReviews|PASTA_DEVS_MEMBERS_TOKEN/u);

  const exemptionStep = extractNamedStep(triageWorkflow, "Exempt trusted contributor");
  assert.match(
    exemptionStep,
    /if: >-\n\s+github\.event\.pull_request\.author_association == 'MEMBER' \|\|\n\s+github\.event\.pull_request\.author_association == 'OWNER' \|\|\n\s+github\.event\.pull_request\.author_association == 'COLLABORATOR'/u,
  );
  assert.match(
    exemptionStep,
    /run: echo "Trusted contributor; pull request template validation is not required\."/u,
  );

  assert.equal(existsSync(untrustedReviewGate), false);
  assert.match(codeOwners, /^\* @SpicyMarinara$/mu);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validatePullRequestTriage();
  console.info("Pull request workflow gates are stable; owner approval is enforced by the native staging ruleset.");
}
