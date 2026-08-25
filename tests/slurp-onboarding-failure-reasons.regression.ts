import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requireModelAnswer } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-model-answer";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const slurpServices = "packages/slurp/src/engine/packages/server/src/services/slurp/";
const draft = read(`${slurpServices}slurp-stage-profile-draft.service.ts`);
const parsers = Object.fromEntries(
  [
    "slurp-stage-profile-draft.service.ts",
    "slurp-generation.service.ts",
    "slurp-reply-generation.service.ts",
    "slurp-fan-activity.service.ts",
    "slurp-ambient-profile-generation.service.ts",
    "slurp-invited-post-draft.service.ts",
    "slurp-public-profiles.service.ts",
  ].map((file) => [file, read(`${slurpServices}${file}`)] as const),
);
const routes = read("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts");
const panel = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx");
const en = JSON.parse(read("packages/slurp/src/engine/packages/client/src/localization/locales/en.json")) as Record<
  string,
  string
>;

// An empty provider answer used to reach JSON.parse and surface as "Unexpected end of JSON
// input", which named neither the cause nor a fix.
assert.equal(requireModelAnswer(' {"a":1} ', "a creator profile"), ' {"a":1} ');
for (const empty of ["", "   ", "\n\t"]) {
  assert.throws(
    () => requireModelAnswer(empty, "a creator profile"),
    /empty response for a creator profile[\s\S]*max output tokens/u,
    "An empty model answer must fail with a readable reason, not a JSON syntax error",
  );
}

// Every Slurp parse of a model answer goes through the guard, or that path still throws a raw
// JSON syntax error. The file list is checked against the tree, so a new call site cannot be
// added without being guarded.
assert.deepEqual(
  readdirSync(join(root, slurpServices))
    .filter((file) => /parseGameJsonish\(/u.test(read(`${slurpServices}${file}`)))
    .sort(),
  Object.keys(parsers).sort(),
  "A Slurp service parses a model answer without being covered here",
);
for (const [file, source] of Object.entries(parsers)) {
  for (const call of source.match(/parseGameJsonish\([^)]*/gu) ?? []) {
    assert.match(call, /requireModelAnswer\(/u, `Unguarded parseGameJsonish call in ${file}`);
  }
}
assert.match(
  draft,
  /modelAnswerForCorrection\(response\.content\)/u,
  "The repair retry must filter empty and empty-array assistant answers",
);
assert.match(
  draft,
  /const retry = await provider\.chatComplete/u,
  "Stage profile generation must retry malformed output once",
);
assert.match(draft, /That was not a valid stage profile object/u, "The retry must send a repair instruction");

// Every bulk exclusion carries a reason against its creator, or the wizard cannot say which
// creator failed for which cause.
assert.match(
  routes,
  /const reasons: \{ accountId: string; reason: string \}\[\] = \[\];/u,
  "Reasons must be recorded per creator, not as a bare list",
);
for (const call of routes.match(/noteReason\([\s\S]{0,40}/gu) ?? []) {
  assert.match(call, /noteReason\(\s*noodleAccountId,/u, "Every reason must name its creator");
}
assert.equal(
  (routes.match(/skipped\.push\(noodleAccountId\)/gu) ?? []).length,
  (routes.match(/skipped\.push\(noodleAccountId\);\s*\n\s*noteReason\(/gu) ?? []).length,
  "Every skip must record a reason",
);
assert.equal(
  (routes.match(/failed\.push\(noodleAccountId\)/gu) ?? []).length,
  (routes.match(/failed\.push\(noodleAccountId\);\s*\n\s*noteReason\(/gu) ?? []).length,
  "Every failure must record a reason",
);
assert.match(routes, /skipped,\s*\n\s*failed,\s*\n\s*reasons,/u, "The bulk response must return the reasons");

// Nothing created is a setup failure, not a first-post failure.
assert.match(
  panel,
  /input\.createdCount === 0 && input\.createFailures > 0\s*\n?\s*\? "creationFailed"/u,
  "A run that created nothing must not report a first-post failure",
);
assert.match(panel, /setCreationReasons\(result\.reasons \?\? \[\]\)/u, "The wizard must keep the server reasons");
assert.match(
  panel,
  /creationReasons\.length > 0 && \([\s\S]*?creationReasons\.map/u,
  "The completion screen must show the reasons",
);
assert.match(
  panel,
  /accounts\.find\([\s\S]*?account\.id === entry\.accountId[\s\S]*?\)\?\.displayName/u,
  "Each reason must name the creator it belongs to",
);

// A run that created nothing must not be recorded as finished onboarding.
assert.match(
  panel,
  /selected\.size === 0 \|\| newIds\.length === 0 \? "zero" : "completed"/u,
  "Nothing created must not write the completed onboarding state",
);
assert.match(
  panel,
  /if \(settingsSaved && newIds\.length > 0\) onComplete\?\.\(\);/u,
  "Nothing created must not report the wizard as complete",
);
assert.match(panel, /\(creationFailed \|\| completion === "creationFailed"\)/u, "A setup failure must offer a retry");
for (const key of [
  "ui.noodle.noodlerwizard.completion.creationFailed.title",
  "ui.noodle.noodlerwizard.completion.creationFailed.detail",
]) {
  assert.ok(en[key], `Missing locale key: ${key}`);
}

console.log("slurp-onboarding-failure-reasons regression passed");
