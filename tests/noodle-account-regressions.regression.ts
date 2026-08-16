import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [storage, routes, hooks] = await Promise.all([
    readFile("packages/noodle/src/engine/packages/server/src/services/storage/noodle.storage.ts", "utf8"),
    readFile("packages/noodle/src/engine/packages/server/src/routes/noodle.routes.ts", "utf8"),
    readFile("packages/noodle/src/engine/packages/client/src/hooks/use-noodle.ts", "utf8"),
  ]);

  assert.match(storage, /input\?\.followed \?\? input\?\.following/u);
  assert.match(storage, /DEFAULT_ACCOUNT_SETTINGS/u);
  assert.match(storage, /filter\(\(row\) => row\.id !== id\)/u);
  assert.match(storage, /nextAvailableHandle/u);
  // A bootstrap sync must not overwrite a saved bio or display name with card data.
  assert.match(storage, /!String\(existing\.bio \?\? ""\)\.trim\(\) && input\.bio/u);
  assert.match(storage, /sync \|\| !String\(existing\.displayName \?\? ""\)\.trim\(\)/u);
  assert.match(routes, /updateAccountFollow/u);
  assert.match(hooks, /api\.patch<\{ account: NoodleAccount; changed: boolean \}>/u);
  assert.match(hooks, /onSuccess: \(\{ account \}\)/u);
  console.log("Noodle account regressions passed.");
}

void main();
