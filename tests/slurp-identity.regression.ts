import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slurp2Source } from "./slurp2-source";

const root = join(import.meta.dirname, "..");
const routes = slurp2Source(join(root, "packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts"));
const storage = slurp2Source(
  join(root, "packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
);
const replyOperation = readFileSync(
  join(root, "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-creator-reply.operation.ts"),
  "utf8",
);
const home = slurp2Source(join(root, "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx"));

assert.match(
  routes,
  /async function resolveViewerIdentity\(personaId: string\)[\s\S]*?getSlurpAccountForEntity\("persona", personaId, "viewer"\)/u,
);
assert.match(
  routes,
  /resolvedActor\?\.kind === "persona" && resolvedActor\.entityId === personaId \? resolvedActor : null/u,
  "Viewer identity fallback must not authorize a different persona account",
);
assert.match(
  routes,
  /const actor = creatorBelongsToViewer\(gated\.creator, identity\.viewer\) \? gated\.creator : identity\.actor;[\s\S]*?actorAccountId: actor\.id,[\s\S]*?viewerPersonaId: identity\.personaId/u,
);
assert.match(routes, /account\.sourceKind === "persona" && account\.sourceEntityId === viewer\.entityId/u);
assert.match(routes, /viewerActorAccountId: identity\.actor\.id/u);
assert.match(
  routes,
  /getSlurpAccountForEntity\("persona", subscription\.viewerAccountId, "viewer"\)/u,
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
// The shell's persona switcher must show the raw persona account, while post cards act as the
// persona's Creator profile. The shell prop moved into shellProps, so match it where it lives now.
assert.match(
  home,
  /const shellProps = \{[\s\S]*?personaAccount: shellPersonaAccount/u,
  "The shell must identify the viewer by their persona account, not their Creator actor",
);
assert.match(
  storage,
  /normalizeLegacyNoodlerToggleInteraction[\s\S]*?actorAccountId: input\.actorAccountId/u,
  "Legacy persona-keyed toggle interactions must be normalized to the Slurp profile",
);

console.log("Slurp identity regressions passed");
