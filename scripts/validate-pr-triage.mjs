import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const triageWorkflow = readFileSync(new URL("../.github/workflows/pull-request-triage.yml", import.meta.url), "utf8");
const codeOwners = readFileSync(new URL("../.github/CODEOWNERS", import.meta.url), "utf8");
const untrustedReviewGate = new URL("../.github/workflows/owner-approval-review.yml", import.meta.url);

assert.doesNotMatch(triageWorkflow, /^\s+pull_request_review:/mu);
assert.match(triageWorkflow, /name: Branch policy check/u);
assert.match(triageWorkflow, /name: Pull Request template check/u);
assert.match(triageWorkflow, /name: Exempt trusted contributor/u);
assert.doesNotMatch(triageWorkflow, /Owner approval for outside contributors/u);
assert.equal(existsSync(untrustedReviewGate), false);
assert.match(codeOwners, /^\* @SpicyMarinara$/mu);

console.info("Pull request workflow gates are stable; owner approval is enforced by the native staging ruleset.");
