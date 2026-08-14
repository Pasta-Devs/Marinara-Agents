import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homePath = "packages/noodle/src/engine/packages/client/src/components/noodle/NoodleHome.tsx";
const publishingPath =
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerPublishingSettings.tsx";
const localePath =
  "packages/noodle/src/engine/packages/client/src/localization/locales/en.json";

async function main() {
  const [home, publishing, locale] = await Promise.all([
    readFile(homePath, "utf8"),
    readFile(publishingPath, "utf8"),
    readFile(localePath, "utf8"),
  ]);

  assert.match(home, /border border-dashed border-\[var\(--noodle-accent\)\]\/70/);
  assert.match(home, /view: "profile",\s*accountId: viewedProfileNoodler\.id/);
  assert.match(home, /authorKind: composerAuthorAccount\.kind/);
  assert.match(home, /authorEntityId: composerAuthorAccount\.entityId/);
  assert.match(home, /postAsValue1/);
  assert.match(home, /dataComponent="NoodleView\.ProfileComposer"/);
  assert.match(home, /view="publishing"/);
  assert.match(home, /view="creators"/);
  assert.match(home, /view="audience"/);

  assert.match(publishing, /generationRuntime/);
  assert.match(publishing, /textConnection\?\.model/);
  assert.match(publishing, /imageConnection\?\.model/);
  assert.match(publishing, /lifecycleHelp/);

  assert.match(locale, /Automatic publishing first prepares an unreleased reserve post/);
  assert.match(locale, /NoodleR then releases it as a locked post/);

  console.log("Noodle profile publishing workflow regressions passed.");
}

void main();
