import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const base = "packages/slurp/src/engine/packages/server/src/services/slurp/";

// 3.1 — the first post a new Creator makes is public, so the feed is not empty behind a paywall.
assert.match(read(base + "slurp-first-post-queue.service.ts"), /access: "public",/u);

// 3.2 — a persona Creator ends its first-post job as a skip, not a failure.
assert.match(
  read(base + "slurp-first-post-queue.service.ts"),
  /result\.status === "disabled"[\s\S]{0,400}?status: "skipped"/u,
);
assert.match(
  read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx"),
  /useNoodlerEligibleAccounts\("", "all", open\)/u,
  "onboarding must offer personas as well as characters",
);

// 3.3 — drafts only: a persona Creator never writes a DM reply or a comment reply on its own.
assert.match(
  read(base + "slurp-message.operation.ts"),
  /creator\.kind === "persona" && creator\.sourceKind === "persona"\) return \{ status: "ineligible" \}/u,
);
assert.match(
  read(base + "slurp-audience-reply.operation.ts"),
  /creator\.kind === "persona" && creator\.sourceKind === "persona"\) continue;/u,
);

console.log("slurp persona creator mode regression: ok");
