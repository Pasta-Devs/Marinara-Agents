/**
 * Issue #1353: "The image model knows this character" can be chosen while adding a Creator, in the
 * Quick setup / customise wizard and in the role-play sign-up. The choice rides on the add request
 * and the server stores it in the existing per-Creator `creatorImageNames` setting.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../packages/slurp2/src/engine/packages/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const routes = read("server/src/slp/features/onboarding/slp-onboarding-routes.ts");
const wizard = read("client/src/slp/features/onboarding/slp-onboarding-wizard-model.ts");
const steps = read("client/src/slp/features/onboarding/SlpOnboardingSteps.tsx");
const sceneModel = read("client/src/slp/features/onboarding/slp-scene-model.ts");
const scene = read("client/src/slp/features/onboarding/SlpSceneOnboarding.tsx");
const actions = read("client/src/slp/app/slp-home-actions.ts");
const createStep = read("client/src/slp/app/screens/SlpScreenCreateProfile.tsx");
const hooks = read("client/src/slp/features/creators/slp-creator-profile-hooks.ts");
const label = "ui.slurp.settings.creators.imageName";

// Server: both add routes accept the value and store false in the per-Creator setting.
assert.match(routes, /imageNameKnown: z\.boolean\(\)\.optional\(\)/u, "the add routes accept the value");
assert.equal(routes.match(/imageNameKnown: z\.boolean\(\)\.optional\(\)/gu)?.length, 2, "single add and bulk add");
assert.match(
  routes,
  /creatorImageNames: \{ \.\.\.creatorImageNames, \.\.\.Object\.fromEntries\(ids\.map\(\(id\) => \[id, false\]\)\) \}/u,
);
assert.match(routes, /imageNameKnown === false\) await turnImageNameOff\(\[created\.id\]\)/u, "single add stores it");
assert.match(routes, /then\.imageNameKnown === false\) await turnImageNameOff\(ids\)/u, "bulk add stores it");

// Client: the wizard (Quick setup and customise share step 4) and the role-play sign-up send it.
assert.match(wizard, /useState\(true\)/u, "default stays on");
assert.match(
  wizard,
  /completeOnboarding: !selectionOnly,\s*imageNameKnown: imagesEnabled/u,
  "the bulk request carries it",
);
assert.match(steps, new RegExp(`${label.replaceAll(".", "\\.")}[\\s\\S]{0,160}value=\\{imageNameKnown\\}`, "u"));
assert.match(sceneModel, /imageNameKnown: setup\.imageNameKnown/u, "the scene create carries it");
assert.match(scene, /imageNameKnown \}\)/u, "the scene setup passes it on");
assert.match(scene, new RegExp(label.replaceAll(".", "\\.")), "the scene setup shows the same label");
assert.match(hooks, /imageNameKnown === false \? \{ imageNameKnown \} : \{\}/u, "only an off choice is sent");

// The manual "Create stage profile" flow: the disclosure step shows it and the create call sends it.
assert.match(createStep, new RegExp(`${label.replaceAll(".", "\\.")}[\\s\\S]{0,160}value=\\{imageNameKnown\\}`, "u"));
assert.match(actions, /stageProfile: input, imageNameKnown: creationImageNameKnown/u, "manual create carries it");
// A hidden choice is never saved: with pictures off the wizard sends the default.
assert.match(wizard, /imageNameKnown: imagesEnabled \? imageNameKnown : true/u);
// The new Creator's settings are never read from a stale cache.
assert.equal(hooks.match(/invalidateQueries\(\{ queryKey: slpKeys\.settings\(\) \}\)/gu)?.length, 2);

// The label already exists in every language.
for (const lang of ["en", "de", "ko", "pl"]) {
  const strings = JSON.parse(read(`client/src/slp/locales/${lang}.json`)) as Record<string, string>;
  assert.ok(strings[label], `${lang} has ${label}`);
}
console.log("slurp2 add-creator image name: ok");
