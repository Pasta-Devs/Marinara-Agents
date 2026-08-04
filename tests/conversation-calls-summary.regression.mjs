import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeSource = await readFile(
  new URL("../sources/engine/packages/server/src/routes/conversation-calls.routes.ts", import.meta.url),
  "utf8",
);
const builderSource = await readFile(new URL("../scripts/build-feature-packages.mjs", import.meta.url), "utf8");

assert.match(routeSource, /connection\.defaultParameters/);
assert.match(routeSource, /conversationCallSummaryConnectionId/);
assert.match(routeSource, /getDefaultForAgents\(\)/);
assert.match(routeSource, /maxTokens: 4096/);
assert.doesNotMatch(routeSource, /maxTokens: 600/);
assert.match(builderSource, /version: "1\.0\.9"/);
assert.match(builderSource, /minEngineVersion: "2\.4\.1"/);
assert.match(builderSource, /Call summary connection/);

process.stdout.write("Conversation Calls summary regression passed.\n");
