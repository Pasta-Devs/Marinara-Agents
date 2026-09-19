import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const read = (path: string) => slurp2Source(path);
const base = "packages/slurp2/src/engine/packages/server/src/services/slurp/";
const schema = read("packages/slurp2/src/engine/packages/server/src/db/schema/slurp.ts");
const storage = read("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");
const routes = read("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");

// 3.1 — the first post a new Creator makes is public, so the feed is not empty behind a paywall.
assert.match(read(base + "slurp-first-post-queue.service.ts"), /access: "public",/u);

// 3.2 — a persona Creator ends its first-post job as a skip, not a failure.
assert.match(
  read(base + "slurp-first-post-queue.service.ts"),
  /result\.status === "disabled"[\s\S]{0,400}?status: "skipped"/u,
);
assert.match(
  read("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx"),
  /useCreatorEligibleAccounts\("", "all", open\)/u,
  "onboarding must offer personas as well as characters",
);

// 3.3 — drafts only: a persona Creator never writes a DM reply or a comment reply on its own.
assert.match(
  read(base + "slurp-message.operation.ts"),
  /creator\.kind === "persona" && creator\.sourceKind === "persona"\)\) \{[\s\S]*?return \{ status: "ineligible" \}/u,
);
assert.match(
  read(base + "slurp-audience-reply.operation.ts"),
  /creator\.kind === "persona" && creator\.sourceKind === "persona"\) continue;/u,
);

// Persona Creators still receive audience activity: the fan scheduler and the world pulse must not
// filter them out, only the paths where the Creator itself writes.
assert.doesNotMatch(read(base + "slurp-fan-activity.operation.ts"), /sourceKind === "persona"/u);
assert.match(
  read(base + "slurp-world.operation.ts"),
  /targets: creators\.flatMap/u,
  "pulse targets must come from every creator, not automaticCreators",
);
assert.match(
  read(base + "slurp-world.operation.ts"),
  /const creators: SlurpWorldCreator\[\] = await Promise\.all\(\s*accounts\.map/u,
);

// A persona viewer actor and that persona's Creator use the same source entity, but they are
// different account roles. The schema must scope their uniqueness separately, and lookups must
// select the requested role instead of whichever row the file store returns first.
assert.match(
  schema,
  /keys: \["sourceKind", "sourceEntityId"\](?:(?!keys:)[\s\S])*?row\.kind === "persona" && row\.invited === "true"/u,
);
assert.match(
  schema,
  /keys: \["sourceKind", "sourceEntityId", "invited"\][\s\S]*?row\.kind === "persona" &&[\s\S]*?row\.invited === "true"/u,
);
assert.match(
  schema,
  /keys: \["handle"\][\s\S]*?row\.platform === "slurp" && !\(row\.kind === "persona" && row\.invited === "true"\)/u,
);
assert.match(schema, /keys: \["handle", "invited"\][\s\S]*?row\.kind === "persona" && row\.invited === "true"/u);
assert.match(storage, /role: SlurpAccountRole = "creator"/u);
assert.match(
  storage,
  /role === "viewer" \? isSlurpViewerActorAccount\(account\) : !isSlurpViewerActorAccount\(account\)/u,
);
assert.match(
  storage,
  /input\.kind === "persona" && input\.invited !== false \? "viewer" : "creator"/u,
  "persona bootstrap must update the viewer actor, not the Creator row",
);
assert.match(routes, /getSlurpAccountForEntity\("persona", personaId, "viewer"\)/u);

console.log("slurp persona creator mode regression: ok");
