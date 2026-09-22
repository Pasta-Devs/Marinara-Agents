import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const build = read("scripts/build-feature-packages.mjs");
const entry = read("packages/slurp2/src/engine/packages/server/src/slp/slp-server-entry.ts");
const host = read("packages/slurp2/src/engine/packages/server/src/slp/base/host/slp-generation-integrations.ts");
const post = read("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts");
const images = read("packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-images-service.ts");

assert.match(build, /capabilityApi: \{ major: 1, minor: 31 \}/u);
assert.match(entry, /if \(!integrations\)/u);
assert.match(entry, /setSlurpGenerationIntegrations\(integrations\)/u);
assert.match(host, /host\?\.llm\.createProvider/u);
assert.match(host, /host\?\.llm\.withFallback/u);
assert.match(host, /admissionMode: input\.admissionMode/u);
assert.match(host, /host\?\.images\.generate/u);
assert.match(host, /host\?\.images\.stage/u);
assert.match(post, /createSlurpPostProvider/u);
assert.match(images, /generateSlurpImageWithHost/u);
assert.match(images, /stageSlurpImageWithHost/u);

console.log("slurp generation integrations regression passed");
