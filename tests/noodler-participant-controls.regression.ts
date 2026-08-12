import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homePath = "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerHome.tsx";
const hooksPath = "packages/noodle/src/engine/packages/client/src/hooks/use-noodle.ts";
const publishingSettingsPath =
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerPublishingSettings.tsx";

async function main() {
  const [home, hooks, publishingSettings] = await Promise.all([
    readFile(homePath, "utf8"),
    readFile(hooksPath, "utf8"),
    readFile(publishingSettingsPath, "utf8"),
  ]);

  assert.match(hooks, /api\.post<NoodleAccount>\("\/noodle\/invites", \{ characterId \}\)/);
  assert.match(hooks, /`\/noodle\/invites\/\$\{encodeURIComponent\(characterId\)\}`/);
  assert.match(hooks, /useInviteNoodleCharacter[\s\S]*noodleKeys\.bootstrap\(\)[\s\S]*noodlerAccounts\(\)[\s\S]*noodlerEligibleAccountsRoot\(\)[\s\S]*noodlerViewers\(\)/);
  assert.match(hooks, /useRemoveNoodleCharacter[\s\S]*noodleKeys\.bootstrap\(\)[\s\S]*noodlerAccounts\(\)[\s\S]*noodlerEligibleAccountsRoot\(\)[\s\S]*noodlerViewers\(\)/);

  assert.match(home, /const characterSource = publicSource\?\.kind === "character" \? publicSource : null/);
  assert.match(home, /characterSource && profile\.sourceStatus\.state !== "missing"/);
  assert.match(home, /const directInvite = characterSource\?\.invited === true/);
  assert.match(home, /sourceFolderInvited[\s\S]*folderOnlyParticipation[\s\S]*notInvited/);
  assert.match(home, /inviteCharacter\.mutate\(selectedPublicSource\.entityId/);
  assert.doesNotMatch(home, /removeCharacter\.mutate\(selectedPublicSource\.entityId/);
  assert.doesNotMatch(home, /onUninviteCharacter/);
  assert.doesNotMatch(home, /onClick=\{onDelete\}/);
  assert.match(publishingSettings, /useDeleteNoodlerStageProfile/);
  assert.match(publishingSettings, /deleteCreator\.mutateAsync\(profile\.id\)/);
  assert.match(publishingSettings, /removeCharacter\.mutateAsync\(source\.entityId\)/);
  assert.match(publishingSettings, /<Trash2 size=\{\d+\} \/>/);
  // The delete control closes the row and keeps a touch-sized target on a phone.
  assert.match(publishingSettings, /className="ml-auto flex h-9 w-9 shrink-0 touch-manipulation/);
  // Deleting also uninvites a linked character, so the dialog must say which case it is.
  assert.match(publishingSettings, /deleteCreatorConfirmWithCharacter/);

  console.log("NoodleR participant control regressions passed.");
}

void main();
