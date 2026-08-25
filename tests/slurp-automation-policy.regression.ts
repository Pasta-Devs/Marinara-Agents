import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const storage = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
  "utf8",
);
const routes = readFileSync(join(root, "packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts"), "utf8");
const onboarding = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx"),
  "utf8",
);
const home = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx"),
  "utf8",
);
const settings = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx"),
  "utf8",
);

assert.match(storage, /sourceKind === "persona" && account\.kind === "persona"/u);
assert.match(routes, /Persona-owned Slurp profiles cannot post automatically/u);
assert.equal((routes.match(/Persona-owned Slurp profiles cannot post automatically/g) ?? []).length, 3);
assert.match(home, /personaSourceIds=\{new Set\(personas\.map\(\(persona\) => persona\.id\)\)\}/u);
assert.match(settings, /personaSourceIds\.has\(creator\.sourceAccountId\)/u);
assert.match(onboarding, /onSeeFeed\?: \(\) => void/u);
assert.match(onboarding, /onSeeFeed\?\.\(\)/u);
assert.match(home, /onSeeFeed=\{[\s\S]*?view: "hub"/u);
assert.match(home, /const actorAccountId = viewerActorAccount\?\.id/u);

console.log("Slurp automation policy regressions passed");
