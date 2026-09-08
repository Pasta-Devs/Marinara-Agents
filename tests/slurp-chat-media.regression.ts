import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const messages = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx",
  "utf8",
);
const hooks = readFileSync("packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");
const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp-messages.routes.ts", "utf8");
const operation = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message.operation.ts",
  "utf8",
);
const response = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-dm-response.ts",
  "utf8",
);
const media = readFileSync("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-media.ts", "utf8");

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

console.log("slurp chat media regression passed");
