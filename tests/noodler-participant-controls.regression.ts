import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homePath = "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx";
const hooksPath = "packages/noodle/src/engine/packages/client/src/hooks/use-noodle.ts";
const creatorHooksPath = "packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts";
const publishingSettingsPath = "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx";

async function main() {
  const [home, hooks, creatorHooks, publishingSettings] = await Promise.all([
    readFile(homePath, "utf8"),
    readFile(hooksPath, "utf8"),
    readFile(creatorHooksPath, "utf8"),
    readFile(publishingSettingsPath, "utf8"),
  ]);

  assert.match(hooks, /api\.post<NoodleAccount>\("\/noodle\/invites", \{ characterId \}\)/);
  assert.match(hooks, /`\/noodle\/invites\/\$\{encodeURIComponent\(characterId\)\}`/);
  assert.match(creatorHooks, /noodlerAccounts\(\)[\s\S]*noodlerEligibleAccountsRoot\(\)[\s\S]*noodlerViewers\(\)/);
  assert.match(creatorHooks, /useDeleteNoodlerStageProfile/);

  assert.match(home, /useCreateNoodlerStageProfile\(\)/);
  assert.match(home, /useUpdateNoodlerStageProfile\(\)/);
  assert.match(home, /useNoodlerEligibleAccounts\(/);
  assert.match(home, /onAccessChange=\{\(access\) =>[\s\S]*updateAccess\.mutate\(/);
  assert.doesNotMatch(home, /useInviteNoodleCharacter|useRemoveNoodleCharacter/);
  assert.doesNotMatch(home, /onClick=\{onDelete\}/);
  assert.match(publishingSettings, /useSlurpSettings/);
  assert.match(publishingSettings, /useUpdateSlurpSettings/);
  assert.doesNotMatch(publishingSettings, /removeCharacter|\/noodle\//);
  assert.match(
    creatorHooks,
    /api\.post<NoodlerStageProfile>\([\s\S]*`\/slurp\/accounts\/\$\{encodeURIComponent\(sourceAccountId\)\}\/noodler`/,
  );
  assert.match(creatorHooks, /api\.patch<SlurpSettings>\("\/slurp\/settings", patch\)/);
  assert.doesNotMatch(creatorHooks, /"\/noodle\/invites"/);

  console.log("NoodleR participant control regressions passed.");
}

void main();
