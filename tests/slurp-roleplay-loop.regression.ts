import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SLURP_DEFAULT_CREATOR_MESSAGING,
  readSlurpCreatorMessaging,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-messaging.js";

const read = (path: string) => readFileSync(path, "utf8");
const server = "packages/slurp2/src/engine/packages/server/src/";

// 6.1 — every payment gets a reaction, and only automatic Creators react.
const reaction = read(server + "services/slurp/slurp-payment-reaction.ts");
assert.match(reaction, /creator\.sourceKind !== "character"\) return;/u);
for (const [file, kind] of [
  ["routes/slurp.routes.ts", "tip"],
  ["routes/slurp.routes.ts", "unlock"],
  ["routes/slurp-messages.routes.ts", "ppv"],
  ["routes/slurp-messages.routes.ts", "commission"],
] as const) {
  assert.match(read(server + file), new RegExp(`reactToSlurpPayment\\([\\s\\S]{0,300}?kind: "${kind}"`, "u"), kind);
}

// 6.2 — a guided Story stays a Story instead of waiting for the rotation.
assert.match(
  read(server + "services/slurp/slurp-generation.service.ts"),
  /variation\?\.story === true \|\| input\.request\.postType === "story"/u,
);
assert.match(read(server + "routes/slurp.routes.ts"), /slurpNoodlerGenerationRequestSchema/u);
assert.match(
  read("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx"),
  /format,\n\s*postType,\n\s*\}\);/u,
  "the guided post must send its post type",
);

// 6.3 — posts may draw on long-term notes without leaking them.
const generation = read(server + "services/slurp/slurp-generation.service.ts");
assert.match(generation, /fanMemory/u);
assert.match(generation, /never name the person, quote them, or repeat a private detail in public/u);

// 6.4 — the per-Creator proactive switch defaults on, round-trips, and stops follow-ups.
assert.equal(SLURP_DEFAULT_CREATOR_MESSAGING.proactiveMessages, true);
assert.equal(readSlurpCreatorMessaging({ proactiveMessages: false }).proactiveMessages, false);
assert.equal(readSlurpCreatorMessaging({}).proactiveMessages, true);
assert.match(
  read(server + "services/slurp/slurp-follow-up-scheduler.service.ts"),
  /if \(!messaging\.proactiveMessages\) \{[\s\S]{0,200}?cancelScheduledFollowUp/u,
);

console.log("slurp roleplay loop regression: ok");
