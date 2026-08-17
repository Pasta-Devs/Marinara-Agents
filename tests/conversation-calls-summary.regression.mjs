import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCallSummaryCompletionOptions,
  buildConversationCallProviderArguments,
  resolveCallSummaryConnection,
} from "../sources/engine/packages/server/src/services/conversation/call-summary-routing.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const connection = (id, overrides = {}) => ({
  id,
  provider: "openai",
  model: `${id}-model`,
  apiKey: `${id}-key`,
  baseUrl: `https://${id}.example/v1`,
  maxContext: 128_000,
  openrouterProvider: null,
  maxTokensOverride: 12_000,
  claudeFastMode: "true",
  treatAsLocalEndpoint: "false",
  defaultParameters: JSON.stringify({
    customParameters: { verbosity: "high" },
    reasoningEffort: "high",
  }),
  ...overrides,
});
const selected = connection("selected");
const agentDefault = connection("agent-default");
const chat = connection("chat");
const byId = new Map([selected, agentDefault, chat].map((item) => [item.id, item]));
const storage = (agentConnection = agentDefault) => ({
  async getWithKey(id) {
    return byId.get(id) ?? null;
  },
  async getDefaultForAgents() {
    return agentConnection;
  },
});
const resolveBaseUrl = (item) => item.baseUrl ?? "";

assert.deepEqual(
  await resolveCallSummaryConnection(
    storage(),
    { metadata: JSON.stringify({ conversationCallSummaryConnectionId: selected.id }), connectionId: chat.id },
    resolveBaseUrl,
  ),
  { connection: selected, source: "selected" },
);
assert.deepEqual(
  await resolveCallSummaryConnection(
    storage(),
    { metadata: { conversationCallSummaryConnectionId: "missing" }, connectionId: chat.id },
    resolveBaseUrl,
  ),
  { connection: agentDefault, source: "agent-default" },
);
assert.deepEqual(
  await resolveCallSummaryConnection(
    storage(connection("invalid-agent", { provider: "image_generation" })),
    { metadata: {}, connectionId: chat.id },
    resolveBaseUrl,
  ),
  { connection: chat, source: "chat" },
);

const providerArguments = buildConversationCallProviderArguments(selected, resolveBaseUrl);
assert.equal(providerArguments[1], selected.baseUrl);
assert.equal(providerArguments[5], selected.maxTokensOverride);
assert.equal(providerArguments[6], true);
assert.equal(providerArguments[7], false);
assert.equal(providerArguments[8], selected.defaultParameters);
assert.deepEqual(JSON.parse(providerArguments[8]), {
  customParameters: { verbosity: "high" },
  reasoningEffort: "high",
});
assert.deepEqual(buildCallSummaryCompletionOptions(selected.model), {
  model: selected.model,
  maxTokens: 4096,
  temperature: 0.2,
});

const packageRoot = join(repoRoot, "packages/conversation-calls");
const manifest = JSON.parse(await readFile(join(packageRoot, "manifest.json"), "utf8"));
assert.equal(manifest.version, "1.0.10");
assert.equal(manifest.engine.min, "2.4.1");
for (const payload of manifest.files) {
  const bytes = await readFile(join(packageRoot, payload.path));
  assert.equal(payload.bytes, bytes.byteLength, `${payload.path} byte count`);
  assert.equal(payload.sha256, sha256(bytes), `${payload.path} digest`);
}

const artifactPath = join(repoRoot, `artifacts/conversation-calls-${manifest.version}.zip`);
const artifactBytes = await readFile(artifactPath);
const artifactManifest = JSON.parse(execFileSync("unzip", ["-p", artifactPath, "manifest.json"], { encoding: "utf8" }));
const artifactClient = execFileSync("unzip", ["-p", artifactPath, "client.js"], { encoding: "utf8" });
assert.deepEqual(artifactManifest, manifest);
assert.match(artifactClient, /Call summary connection/u);
assert.match(artifactClient, /Loading connection(?:…|\\u2026)/u);
assert.match(artifactClient, /mari-chrome-control flex h-8 w-8 items-center justify-center p-0 max-md:h-9 max-md:w-9/u);

for (const relativePath of ["catalog/catalog.json", "catalog/v2/catalog.json", "catalog/v3/catalog.json"]) {
  const catalog = JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
  const entry = catalog.packages.find((item) => item.manifest?.id === "conversation-calls");
  assert.ok(entry, `${relativePath} contains conversation-calls`);
  assert.deepEqual(entry.manifest, manifest, `${relativePath} manifest`);
  assert.equal(entry.artifact.bytes, artifactBytes.byteLength, `${relativePath} artifact byte count`);
  assert.equal(entry.artifact.sha256, sha256(artifactBytes), `${relativePath} artifact digest`);
  assert.match(entry.artifact.url, /conversation-calls-1\.0\.10\.zip$/u);
}

process.stdout.write("Conversation Calls summary regression passed.\n");
