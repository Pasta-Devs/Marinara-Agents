import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const routes = readFileSync(join(root, "packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts"), "utf8");
const storage = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
  "utf8",
);
const replyOperation = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-creator-reply.operation.ts"),
  "utf8",
);
const home = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx"),
  "utf8",
);

assert.match(
  routes,
  /async function resolveViewerIdentity\(personaId: string\)[\s\S]*?getSlurpAccountForEntity\("persona", personaId\)/u,
);
assert.match(
  routes,
  /resolvedActor\?\.kind === "persona" && resolvedActor\.entityId === personaId \? resolvedActor : null/u,
  "Viewer identity fallback must not authorize a different persona account",
);
assert.match(routes, /actorAccountId: identity\.actor\.id,[\s\S]*?viewerPersonaId: identity\.personaId/u);
assert.match(routes, /viewerActorAccountId: identity\.actor\.id/u);
assert.match(
  routes,
  /getSlurpAccountForEntity\("persona", subscription\.viewerAccountId\)/u,
  "Subscriber rows must display the subscriber's Slurp profile",
);
assert.match(storage, /viewerPersonaId: string;/u);
assert.match(
  storage,
  /actor\.sourceEntityId !== input\.viewerPersonaId/u,
  "Interaction mutations must bind the actor profile to the requested persona",
);
assert.match(storage, /eq\(noodleAccountSubscriptions\.viewerAccountId, input\.viewerPersonaId\)/u);
assert.match(storage, /eq\(noodlePostUnlocks\.viewerAccountId, input\.viewerPersonaId\)/u);
assert.match(storage, /viewerActorAccountId: string/u);
assert.match(replyOperation, /viewerPersonaId: string;[\s\S]*?viewerActorAccountId: string/u);
assert.match(home, /const viewerActorAccount =[\s\S]*?id: myCreatorProfile\.id/u);
assert.match(home, /personaAccount: viewerActorAccount/u);
assert.match(home, /<ViewerHub[\s\S]*?personaAccount=\{shellPersonaAccount\}/u);
assert.match(
  storage,
  /normalizeLegacyNoodlerToggleInteraction[\s\S]*?actorAccountId: input\.actorAccountId/u,
  "Legacy persona-keyed toggle interactions must be normalized to the Slurp profile",
);

console.log("Slurp identity regressions passed");
