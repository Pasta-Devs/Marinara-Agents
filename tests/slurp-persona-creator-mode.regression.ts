import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const base = "packages/slurp2/src/engine/packages/server/src/services/slurp/";

// 3.1 — the first post a new Creator makes is public, so the feed is not empty behind a paywall.
assert.match(read(base + "slurp-first-post-queue.service.ts"), /access: "public",/u);

// 3.2 — a persona Creator ends its first-post job as a skip, not a failure.
assert.match(
  read(base + "slurp-first-post-queue.service.ts"),
  /result\.status === "disabled"[\s\S]{0,400}?status: "skipped"/u,
);
assert.match(
  read("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx"),
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

// Persona Creators still receive audience activity: the fan scheduler and the world pulse must not
// filter them out, only the paths where the Creator itself writes.
assert.doesNotMatch(read(base + "slurp-fan-activity.operation.ts"), /sourceKind === "persona"/u);
assert.match(
  read(base + "slurp-world.operation.ts"),
  /targets: creators\.flatMap/u,
  "pulse targets must come from every creator, not automaticCreators",
);
assert.match(
  read(base + "slurp-world.operation.ts"),
  /const creators: SlurpWorldCreator\[\] = await Promise\.all\(\s*accounts\.map/u,
);

console.log("slurp persona creator mode regression: ok");
