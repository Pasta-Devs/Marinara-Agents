import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slurpChatMomentKey } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/continuity/slp-continuity-rules.ts";

// One saved moment per chat message: the same message saved twice has the same key.
assert.equal(slurpChatMomentKey("chat-1", "msg-9"), "chat:chat-1:msg-9");
assert.equal(slurpChatMomentKey(" chat-1 ", " msg-9 "), slurpChatMomentKey("chat-1", "msg-9"));
assert.equal(slurpChatMomentKey("chat-1"), "chat:chat-1:");

// "Save to Slurp": an explicit player action, stored as the Creator's private note from a chat,
// idempotent per message, on every page the character runs.
const routes = readFileSync(
  join(
    import.meta.dirname,
    "..",
    "packages/slurp2/src/engine/packages/server/src/slp/features/creators/slp-continuity-routes.ts",
  ),
  "utf8",
);
const route = routes.slice(
  routes.indexOf('app.post("/continuity/from-chat"'),
  routes.indexOf('app.patch("/continuity/facts/:id"'),
);
assert.ok(route.length > 0, "the from-chat route exists");
assert.match(route, /source: "chat"/u);
assert.match(route, /audienceScope: "creator_private"/u, "a chat moment is never public on its own");
assert.match(route, /findSlurpContinuityFactBySourceHash\(app\.db, account\.id, sourceHash\)/u);
assert.match(route, /account\.sourceKind === "character" && account\.sourceEntityId === characterId/u);

console.log("slurp2 chat moments regression checks passed");
