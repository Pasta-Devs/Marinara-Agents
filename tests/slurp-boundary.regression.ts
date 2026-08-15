import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [path] : [];
  });
}

const files = [
  ...sourceFiles("packages/slurp/src/engine/packages/client"),
  ...sourceFiles("packages/slurp/src/engine/packages/server"),
];

const slurpRoutes = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts"),
  "utf8",
);
assert.match(
  slurpRoutes,
  /app\.delete\("\/noodler\/posts\/:id"[\s\S]*?accountId is required[\s\S]*?existing\.authorAccountId !== accountId/u,
  "NoodleR post deletion must require and verify the owning account",
);

for (const file of files) {
  const source = readFileSync(join(root, file), "utf8");
  for (const marker of [
    /packages\/noodle\/src\/engine\/packages/u,
    /\/api\/noodle/u,
    /noodle\.settings/u,
    /["`]noodle_(?:accounts|posts|interactions|prepared_posts|automatic_attempts|reserve_state|fan_activity_state|account_subscriptions|post_unlocks)["`]/u,
    /["`]noodler_(?:accounts|posts|interactions|prepared_posts|automatic_attempts|reserve_state|fan_activity_state|account_subscriptions|post_unlocks)["`]/u,
  ]) {
    assert.doesNotMatch(source, marker, `${file} contains a legacy Noodle persistence marker: ${marker}`);
  }
}

console.log("Slurp extraction boundary regressions passed.");
