import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSlurpCheatDirective } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-cheat-directive.js";

assert.deepEqual(parseSlurpCheatDirective("coins 42"), { kind: "coins", coins: 42 });
assert.deepEqual(parseSlurpCheatDirective("budget reset"), { kind: "invalid" });
assert.deepEqual(parseSlurpCheatDirective("make the next reply cheerful"), {
  kind: "guidance",
  text: "make the next reply cheerful",
});
assert.deepEqual(parseSlurpCheatDirective(""), { kind: "invalid" });
assert.deepEqual(parseSlurpCheatDirective("budget"), { kind: "invalid" });
assert.deepEqual(parseSlurpCheatDirective("coins -1"), { kind: "guidance", text: "coins -1" });

const route = readFileSync("packages/slurp2/src/engine/packages/server/src/routes/slurp-messages.routes.ts", "utf8");
assert.match(route, /process\.env\.CHEATS_ENABLED !== "true"/u);
assert.match(route, /generationGuidance: directive\.text/u);
const cheatRoute = route.slice(
  route.indexOf('app.post("/messages/cheat"'),
  route.indexOf('app.post("/messages/threads/:threadId/force-reply"'),
);
assert.doesNotMatch(cheatRoute, /force: true/u);
assert.match(route, /setWalletCoinsForDevelopment\(viewer\.id, directive\.coins\)/u);
