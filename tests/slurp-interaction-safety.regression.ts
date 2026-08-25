import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const home = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx"),
  "utf8",
);
const onboarding = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx"),
  "utf8",
);
const settings = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx"),
  "utf8",
);
const locales = ["en", "de", "ko", "pl"].map((locale) => ({
  locale,
  values: JSON.parse(
    readFileSync(
      join(root, `packages/slurp/src/engine/packages/client/src/localization/locales/${locale}.json`),
      "utf8",
    ),
  ) as Record<string, string>,
}));

const submitReply = home.slice(home.indexOf("const submitReply = async"), home.indexOf("const savePost = async"));
assert.match(
  submitReply,
  /if \(input\.askForReply && !\(await confirmProviderDisclosure\(\)\)\) return;[\s\S]*?createInteraction\.mutateAsync/u,
  "Reply disclosure must be confirmed before the comment mutation",
);
assert.doesNotMatch(
  submitReply,
  /createInteraction\.mutateAsync[\s\S]*?confirmProviderDisclosure/u,
  "Cancelling reply disclosure must not leave a comment behind",
);

for (const source of [onboarding, settings]) {
  assert.doesNotMatch(source, /capabilities\.actions\.cancel/u, "Slurp must not render an unresolved Cancel key");
  assert.match(source, /ui\.slurp\.actions\.cancel/u, "Affected Slurp dialogs must use the Slurp Cancel key");
}
for (const { locale, values } of locales) {
  assert.equal(typeof values["ui.slurp.actions.cancel"], "string", `${locale} must define the Slurp Cancel label`);
}

console.log("Slurp interaction safety regressions passed");
