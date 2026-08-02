import assert from "node:assert/strict";
import { evaluateOwnerApproval, OWNER_APPROVAL_CONTEXT } from "./evaluate-owner-approval.mjs";

const basePullRequest = {
  state: "open",
  base: { ref: "staging" },
  head: { sha: "head-sha" },
  user: { login: "OutsideContributor" },
};

function createMock({ pullRequest = basePullRequest, membership, membershipError, reviews = [] }) {
  const statuses = [];
  const request = async ({ token, method = "GET", path, body }) => {
    if (method === "POST" && path.endsWith("/statuses/head-sha")) {
      assert.equal(token, "github-token");
      statuses.push(body);
      return body;
    }
    if (path.includes("/pulls/42/reviews")) return reviews;
    if (path.endsWith("/pulls/42")) return pullRequest;
    if (path.includes("/memberships/")) {
      assert.equal(token, "members-token");
      if (membershipError) throw membershipError;
      return membership;
    }
    throw new Error(`Unexpected request: ${method} ${path}`);
  };
  return { request, statuses };
}

async function runCase(options, env = {}) {
  const mock = createMock(options);
  const result = await evaluateOwnerApproval({
    request: mock.request,
    env: {
      GITHUB_REPOSITORY: "Pasta-Devs/Marinara-Agents",
      GITHUB_TOKEN: "github-token",
      MEMBERS_TOKEN_CONFIGURED: "true",
      PASTA_DEVS_MEMBERS_TOKEN: "members-token",
      PR_NUMBER: "42",
      RUN_URL: "https://github.example/actions/runs/1",
      ...env,
    },
  });
  assert.equal(mock.statuses.length, 1);
  assert.equal(mock.statuses[0].context, OWNER_APPROVAL_CONTEXT);
  return { result, status: mock.statuses[0] };
}

{
  const { result, status } = await runCase({
    pullRequest: { ...basePullRequest, user: { login: "MemberDeveloper" } },
    membership: { state: "active", role: "member" },
  });
  assert.equal(result.internal, true);
  assert.equal(status.state, "success");
}

{
  const { status } = await runCase(
    { pullRequest: { ...basePullRequest, user: { login: "SpicyMarinara" } } },
    { MEMBERS_TOKEN_CONFIGURED: "false", PASTA_DEVS_MEMBERS_TOKEN: "" },
  );
  assert.equal(status.state, "success");
}

{
  const notFound = Object.assign(new Error("Not Found"), { status: 404 });
  const { status } = await runCase({ membershipError: notFound });
  assert.equal(status.state, "failure");
}

{
  const notFound = Object.assign(new Error("Not Found"), { status: 404 });
  const { status } = await runCase({
    membershipError: notFound,
    reviews: [
      { id: 1, state: "APPROVED", commit_id: "head-sha", user: { login: "SpicyMarinara" } },
    ],
  });
  assert.equal(status.state, "success");
}

{
  const notFound = Object.assign(new Error("Not Found"), { status: 404 });
  const { status } = await runCase({
    membershipError: notFound,
    reviews: [
      { id: 1, state: "APPROVED", commit_id: "stale-sha", user: { login: "SpicyMarinara" } },
    ],
  });
  assert.equal(status.state, "failure");
}

{
  const { status } = await runCase(
    {},
    { MEMBERS_TOKEN_CONFIGURED: "false", PASTA_DEVS_MEMBERS_TOKEN: "" },
  );
  assert.equal(status.state, "error");
}

{
  const forbidden = Object.assign(new Error("Forbidden"), { status: 403 });
  const { status } = await runCase({ membershipError: forbidden });
  assert.equal(status.state, "error");
}

console.info("Owner approval evaluator tests passed.");
