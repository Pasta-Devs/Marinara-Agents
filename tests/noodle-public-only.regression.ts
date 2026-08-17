import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const entryPath = "packages/noodle/src/engine/packages/client/src/noodle-package-entry.tsx";
const viewPath = "packages/noodle/src/engine/packages/client/src/components/noodle/NoodleView.tsx";
const navigationPath = "packages/noodle/src/engine/packages/client/src/components/noodle/noodle-navigation.types.ts";
const serverEntryPath = "packages/noodle/src/engine/packages/server/src/services/noodle/server-entry.ts";

async function main() {
  const [entry, view, navigation, serverEntry] = await Promise.all([
    readFile(entryPath, "utf8"),
    readFile(viewPath, "utf8"),
    readFile(navigationPath, "utf8"),
    readFile(serverEntryPath, "utf8"),
  ]);

  for (const [name, source] of Object.entries({ entry, view, navigation })) {
    assert.doesNotMatch(
      source,
      /\b(?:NoodleR|Noodler|Slurp|Creator)\b/,
      `${name} must not expose legacy product markers`,
    );
  }
  assert.match(view, /<NoodleHome navigation=\{navigation\} onNavigate=\{setNavigation\} \/>/);
  assert.doesNotMatch(view, /SlurpHome|mode === "noodler"/);
  assert.match(navigation, /mode: "public"/);
  assert.doesNotMatch(navigation, /mode: "noodler"|tab\?: "noodle" \| "noodler"/);
  assert.match(serverEntry, /Creator routes run in Slurp/);
  const serverBehavior = serverEntry.replace(
    /\/\/ Noodle exposes only the public timeline capability\. Creator routes run in Slurp\./,
    "",
  );
  assert.doesNotMatch(serverBehavior, /\bNoodleR\b|\bNoodler\b|(?:\/api\/slurp|creatorRoutes|slurpRoutes)/i);
  assert.match(serverEntry, /startNoodleRefreshScheduler\(app\)/);
  assert.match(serverEntry, /registerService\("noodle:backup"/);
  assert.doesNotMatch(serverEntry, /AutoPost|FanActivity|auto-post|fan-activity/);

  console.log("Noodle public-only activation regressions passed.");
}

void main();
