import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const schema = slurp2Source("packages/slurp2/src/engine/packages/server/src/db/schema/slurp.ts");
const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/data/feed/slp-post-media-storage.ts");
const operation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-media-operation.ts",
);
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-feed-post-routes.ts");
const viewer = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/viewer/slp-viewer-context.ts");
const purge = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/maintenance/slp-autopurge.ts");
const composer = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpScreenComposer.tsx");

assert.match(schema, /fileTable\(\s*"slurp2_post_media"/u);
assert.match(schema, /uniqueBy: \[\{ keys: \["postId", "position"\] \}\]/u);
assert.match(storage, /postMedia: rows\.map/u, "responses must expose ordered secondary media");
assert.match(operation, /generateSlurpSecondaryImages/u);
assert.match(operation, /publishing primary only/u, "secondary failure must reduce rather than fail the post");
assert.match(routes, /\/noodler\/posts\/:id\/media\/:position/u);
assert.match(routes, /readCreatorLockedTeaser/u, "locked attachments must never serve original bytes");
assert.match(viewer, /images = post\.images\.flatMap/u);
assert.match(purge, /delete\(slpPostMedia\)/u);
assert.match(composer, /contentDelivery/u);

console.log("slurp multi-image regression checks passed");
