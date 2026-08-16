import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const draft = read(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-stage-profile-draft.service.ts",
);
const routes = read(
  "packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts",
);
const panel = read(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx",
);
const en = JSON.parse(
  read(
    "packages/slurp/src/engine/packages/client/src/localization/locales/en.json",
  ),
) as Record<string, string>;

// An empty provider answer used to reach JSON.parse and surface as "Unexpected end of JSON
// input", which named neither the cause nor a fix.
assert.match(
  draft,
  /if \(!content\.trim\(\)\) \{[\s\S]*?throw new Error\([\s\S]*?empty response/u,
  "An empty model answer must fail with a readable reason, not a JSON syntax error",
);
assert.match(
  draft,
  /response\.content\?\.trim\(\)\s*\?\s*\[\{ role: "assistant"/u,
  "The repair retry must not send an empty assistant turn",
);

// Every bulk exclusion carries a reason, or the wizard can only report a count.
for (const site of [
  /skipped\.push\(noodleAccountId\);\s*\n\s*noteReason\(/u,
  /failed\.push\(noodleAccountId\);\s*\n\s*noteReason\(/u,
]) {
  assert.match(routes, site, "Bulk skips and failures must record a reason");
}
assert.equal(
  (routes.match(/skipped\.push\(noodleAccountId\)/gu) ?? []).length,
  (routes.match(/skipped\.push\(noodleAccountId\);\s*\n\s*noteReason\(/gu) ?? [])
    .length,
  "Every skip must record a reason",
);
assert.equal(
  (routes.match(/failed\.push\(noodleAccountId\)/gu) ?? []).length,
  (routes.match(/failed\.push\(noodleAccountId\);\s*\n\s*noteReason\(/gu) ?? [])
    .length,
  "Every failure must record a reason",
);
assert.match(
  routes,
  /skipped,\s*\n\s*failed,\s*\n\s*reasons,/u,
  "The bulk response must return the reasons",
);

// Nothing created is a setup failure, not a first-post failure.
assert.match(
  panel,
  /input\.createdCount === 0 && input\.createFailures > 0\s*\n?\s*\? "creationFailed"/u,
  "A run that created nothing must not report a first-post failure",
);
assert.match(
  panel,
  /setCreationReasons\(result\.reasons \?\? \[\]\)/u,
  "The wizard must keep the server reasons",
);
assert.match(
  panel,
  /creationReasons\.length > 0 && \([\s\S]*?creationReasons\.map/u,
  "The completion screen must show the reasons",
);
assert.match(
  panel,
  /\(creationFailed \|\| completion === "creationFailed"\)/u,
  "A setup failure must offer a retry",
);
for (const key of [
  "ui.noodle.noodlerwizard.completion.creationFailed.title",
  "ui.noodle.noodlerwizard.completion.creationFailed.detail",
]) {
  assert.ok(en[key], `Missing locale key: ${key}`);
}

console.log("slurp-onboarding-failure-reasons regression passed");
