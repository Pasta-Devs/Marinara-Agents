import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const noodleHooks = readFileSync("packages/noodle/src/engine/packages/client/src/hooks/use-noodle.ts", "utf8");
assert.match(noodleHooks, /useInfiniteQuery/u);
assert.match(noodleHooks, /\/noodle\/feed\?limit=20/u);
assert.match(noodleHooks, /getNextPageParam: \(page\) => page\.nextCursor/u);

const noodleRoutes = readFileSync("packages/noodle/src/engine/packages/server/src/routes/noodle.routes.ts", "utf8");
assert.match(noodleRoutes, /app\.get\("\/feed"/u);

const noodleStorage = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/storage/noodle.storage.ts",
  "utf8",
);
assert.match(noodleStorage, /async listPostPage/u);
assert.match(noodleStorage, /limit \+ 1/u);

console.log("Noodle bounded feed regressions passed.");
