import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [home, settings, hooks, locale] = await Promise.all([
    readFile("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8"),
  ]);
  assert.match(home, /view: "profile",\s*accountId:/u);
  assert.match(home, /useCreateNoodlerPost/u);
  assert.match(home, /useGenerateNoodlerNoodlePost/u);
  assert.match(home, /useUpdateNoodlerAutoPosting/u);
  assert.match(home, /useUpdateNoodlerFanActivity/u);
  assert.match(settings, /useSlurpSettings/u);
  assert.match(settings, /useUpdateSlurpSettings/u);
  assert.match(hooks, /\/slurp\/noodler\/posts/u);
  assert.match(hooks, /\/slurp\/settings/u);
  assert.match(locale, /locked posts/u);
  console.log("Slurp profile publishing workflow regressions passed.");
}

void main();
