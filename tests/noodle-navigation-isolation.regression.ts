import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const shellPath = "packages/noodle/src/engine/packages/client/src/components/noodle/NoodleShell.tsx";
const homePath = "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerHome.tsx";
const typesPath = "packages/noodle/src/engine/packages/client/src/components/noodle/noodle-navigation.types.ts";

async function main() {
  const [shell, home, types] = await Promise.all([
    readFile(shellPath, "utf8"),
    readFile(homePath, "utf8"),
    readFile(typesPath, "utf8"),
  ]);

  assert.match(types, /\| \{ mode: "noodler"; view: "search" \}/);
  assert.match(types, /\| \{ mode: "noodler"; view: "notifications" \}/);
  // The NoodleR gear routes to the shared two-pane settings, so there is no
  // separate noodler settings view.
  assert.doesNotMatch(types, /\| \{ mode: "noodler"; view: "settings" \}/);
  assert.match(types, /view: "profile"; accountId: string \| null/);
  assert.match(home, /mode: "settings",\s*tab: "noodler",\s*section: "general",\s*returnTo: \{ mode: "noodler", view: "hub" \}/);
  assert.match(shell, /onOpenSearch/);
  assert.match(shell, /onOpenNotifications/);
  assert.match(shell, /onOpenProfile/);
  assert.match(shell, /onOpenSettings/);
  assert.match(home, /onOpenSearch: goToNoodlerSearch/);
  assert.match(home, /onNavigate\(\{ mode: "noodler", view: "notifications" \}\)/);
  assert.match(home, /onNavigate\(\{ mode: "noodler", view: "profile", accountId: mainAuthorProfile\?\.id \?\? null \}\)/);
  assert.match(home, /onOpenSettings: openSettings/);
  assert.doesNotMatch(home, /onNavigate\(\{ mode: "public", view: "profile"/);

  console.log("NoodleR navigation isolation regressions passed.");
}

void main();
