import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const messages = slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx");
const hooks = slurp2Source("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts");
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/routes/slurp-messages.routes.ts");
const operation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-message.operation.ts",
);
const response = slurp2Source("packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-dm-response.ts");
const media = slurp2Source("packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-media.ts");

assert.match(response, /sharePost: z\.number\(\)\.int\(\)\.min\(0\)\.max\(4\)/u);
assert.match(operation, /kind: "post_preview"/u);
assert.match(messages, /message\.kind === "post_preview"/u);
assert.match(hooks, /useSendSlurpCreatorImage/u);
assert.match(routes, /messages\/threads\/:threadId\/image/u);
assert.match(routes, /drawn\.promote\(\)/u);
assert.match(routes, /drawn\.compensate\(\)/u);
assert.match(routes, /ownsCreator\(parsed\.data\.personaId, thread\.creatorAccountId\)/u);
assert.match(routes, /messages\/threads\/:threadId\/image-upload/u);
assert.match(routes, /readSlurpMessageImage/u);
assert.match(media, /stageSlurpMessageMedia/u);
assert.match(messages, /preparingImage/u);
assert.match(messages, /onPreparingImage\(true\)/u);
assert.match(messages, /onPreparingImage\(false\)/u);

console.log("slurp chat media regression passed");
