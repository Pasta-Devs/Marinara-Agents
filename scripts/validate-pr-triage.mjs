import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const triageWorkflow = readFileSync(new URL("../.github/workflows/pull-request-triage.yml", import.meta.url), "utf8");
const reviewWorkflow = readFileSync(
  new URL("../.github/workflows/owner-approval-review.yml", import.meta.url),
  "utf8",
);

assert.doesNotMatch(triageWorkflow, /^\s+pull_request_review:/mu);
assert.match(triageWorkflow, /name: Branch policy check/u);
assert.match(triageWorkflow, /name: Owner approval for outside contributors/u);
assert.match(triageWorkflow, /name: Pull Request template check/u);
assert.match(triageWorkflow, /name: Exempt trusted contributor/u);
assert.match(reviewWorkflow, /pull_request_review:\s+types: \[submitted, dismissed\]/u);
assert.match(reviewWorkflow, /github\.event\.review\.user\.login == 'SpicyMarinara'/u);
assert.match(reviewWorkflow, /'Ignore unrelated approval review'/u);
assert.match(reviewWorkflow, /REVIEW_EVENT_RELEVANT/u);
assert.doesNotMatch(reviewWorkflow, /Branch policy check|Pull Request template check/u);

console.info("Pull request gate topology is stable.");
