import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { slurp2Source } from "./slurp2-source";

const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");
const home = slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx");
const cards = readFileSync("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpPostCard.tsx", "utf8");
const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");

assert.match(routes, /resolveInteractableNoodlerPost/u);
assert.match(
  routes,
  /const actor = creatorBelongsToViewer\(gated\.creator, identity\.viewer\) \? gated\.creator : identity\.actor/u,
  "an owning persona must interact through its public Creator identity",
);
assert.match(
  routes,
  /actor\.id !== gated\.creator\.id && \(parsed\.data\.type === "reply" \|\| parsed\.data\.type === "vote"\)/u,
  "self-interactions must not mint engagement coins",
);
assert.equal(
  (routes.match(/creatorBelongsToViewer\(actor, identity\.viewer\)/gu) ?? []).length,
  2,
  "persona Creator comments must remain editable and deletable",
);
assert.doesNotMatch(home, /viewingOwnCreator \? null : viewerActorAccount/u);
assert.doesNotMatch(home, /creator\.profile\.id === authorProfile\?\.id \? null : postCardCtx\.personaAccount/u);
assert.match(
  storage,
  /const ownsAuthor = author\.sourceKind === "persona" && author\.sourceEntityId === input\.viewerPersonaId/u,
  "storage must recognize an owning persona's Creator identity",
);
assert.match(
  storage,
  /const ownsAuthor =\s*currentAuthor\.sourceKind === "persona" && currentAuthor\.sourceEntityId === viewerPersonaId/u,
  "poll votes must recognize the same Creator identity",
);
assert.equal(
  (storage.match(/!ownsAuthor &&\s*!canViewNoodlerPost/gu) ?? []).length,
  3,
  "owning personas must bypass audience paywalls when adding, removing, or voting on their own posts",
);
assert.match(
  cards,
  /options\.personaAccount\?\.id !== post\.authorAccountId \? askForReply : false/u,
  "commenting as a Creator must not ask that same Creator to auto-reply",
);

console.log("slurp2 persona Creator interaction regression checks passed");
