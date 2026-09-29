import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const hooks = await readFile("packages/noodle/src/engine/packages/client/src/hooks/use-noodle.ts", "utf8");
  assert.match(hooks, /api\.post<NoodleAccount>\("\/noodle\/invites", \{ characterId \}\)/);
  assert.match(hooks, /`\/noodle\/invites\/\$\{encodeURIComponent\(characterId\)\}`/);
  console.log("Noodle participant control regressions passed.");
}

void main();
