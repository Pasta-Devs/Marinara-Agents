import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSlurpCheatDirective } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-cheat-directive.js";

assert.deepEqual(parseSlurpCheatDirective("coins 42"), { kind: "coins", coins: 42 });
assert.deepEqual(parseSlurpCheatDirective("help"), { kind: "help" });
assert.deepEqual(parseSlurpCheatDirective("budget reset"), { kind: "invalid" });
assert.deepEqual(parseSlurpCheatDirective("make the next reply cheerful"), {
  kind: "guidance",
  text: "make the next reply cheerful",
});
assert.deepEqual(parseSlurpCheatDirective(""), { kind: "invalid" });
assert.deepEqual(parseSlurpCheatDirective("budget"), { kind: "invalid" });
assert.deepEqual(parseSlurpCheatDirective("coins -1"), { kind: "guidance", text: "coins -1" });
assert.deepEqual(parseSlurpCheatDirective("force creator photo studio light"), {
  kind: "force_creator_photo",
  guidance: "studio light",
});
assert.deepEqual(parseSlurpCheatDirective("force paid unlock"), { kind: "force_ppv", guidance: "" });
assert.deepEqual(parseSlurpCheatDirective("mood -25"), { kind: "mood", amount: -25 });
assert.deepEqual(parseSlurpCheatDirective("rapport +10"), { kind: "rapport", amount: 10 });
assert.deepEqual(parseSlurpCheatDirective("availability 45"), { kind: "availability", minutes: 45 });
assert.deepEqual(parseSlurpCheatDirective("test follow-up reminder 30 minutes check in later"), {
  kind: "follow_up",
  type: "reminder",
  timing: "30 minutes",
  reason: "check in later",
});
assert.deepEqual(parseSlurpCheatDirective("test promise tonight promised photo"), {
  kind: "follow_up",
  type: "promise_delivery",
  timing: "tonight",
  reason: "promised photo",
});

const route = readFileSync("packages/slurp2/src/engine/packages/server/src/routes/slurp-messages.routes.ts", "utf8");
assert.match(route, /generationGuidance: directive\.text/u);
const cheatRoute = route.slice(
  route.indexOf('app.post("/messages/cheat"'),
  route.indexOf('app.post("/messages/threads/:threadId/force-reply"'),
);
assert.match(cheatRoute, /process\.env\.NODE_ENV !== "development"\s*\|\|\s*process\.env\.CHEATS_ENABLED !== "true"/u);
assert.doesNotMatch(cheatRoute, /force: true/u);
assert.match(route, /setWalletCoinsForDevelopment\(viewer\.id, directive\.coins\)/u);
assert.match(cheatRoute, /ownsCreator\(parsed\.data\.personaId, parsed\.data\.creatorAccountId\)/u);
assert.match(cheatRoute, /adjustCheatState\(thread\.id/u);
assert.match(cheatRoute, /addScheduledFollowUps\(thread\.id, followUps\)/u);
assert.match(cheatRoute, /price: messaging\.ppvPrice/u);

const storage = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
const adjustCheatState = storage.slice(
  storage.indexOf("async adjustCheatState"),
  storage.indexOf("async addScheduledFollowUps"),
);
assert.match(adjustCheatState, /input\.mood == null \? \{\} : \{ moodUpdatedAt: timestamp \}/u);

const slurpRoutes = readFileSync("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
assert.match(
  slurpRoutes,
  /cheatsEnabled:\s*process\.env\.NODE_ENV === "development" && process\.env\.CHEATS_ENABLED === "true"/u,
);
