import assert from "node:assert/strict";
import { bindPackageIntegrations } from "../sources/host-integrations/packages/server/src/services/package-host.js";
import { createLLMProvider } from "../sources/host-integrations/packages/server/src/services/llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../sources/host-integrations/packages/server/src/services/llm/connection-fallback-provider.js";
import { getLocalSidecarProvider } from "../sources/host-integrations/packages/server/src/services/llm/local-sidecar.js";

async function main() {
  assert.throws(() => createLLMProvider("openai", "", ""), /outside activation/);
  assert.throws(() => bindPackageIntegrations(undefined), /capability API 1.31/);
  const calls: unknown[][] = [];
  const provider = {
    async chatComplete(messages: unknown[], options: unknown) {
      calls.push([messages, options]);
      return { content: "from host" };
    },
  };
  const host = {
    llm: {
      createProvider(...args: unknown[]) {
        calls.push(args);
        return provider;
      },
      withFallback(options: unknown) {
        calls.push([options]);
        return provider;
      },
      localSidecar() {
        return provider;
      },
    },
  };
  const release = bindPackageIntegrations(host as Parameters<typeof bindPackageIntegrations>[0]);
  try {
    const defaults = { customParameters: { seed: 42 }, customHeaders: { "X-Session": "fixture" } };
    const created = createLLMProvider(
      "nanogpt",
      "https://fixture.invalid",
      "synthetic-key",
      8192,
      null,
      1024,
      false,
      false,
      defaults,
      "connection-1",
    );
    assert.equal(created, provider, "Use the live host provider without a package-owned wrapper");
    assert.deepEqual(calls[0], [
      "nanogpt",
      "https://fixture.invalid",
      "synthetic-key",
      8192,
      null,
      1024,
      false,
      false,
      defaults,
      "connection-1",
    ]);
    const abort = new AbortController();
    const messages = [{ role: "user" as const, content: "Synthetic request" }];
    const options = { model: "z-ai/glm-5.3", reasoningEffort: "none" as const, signal: abort.signal, debugMode: true };
    assert.equal((await created.chatComplete(messages, options)).content, "from host");
    assert.equal(calls[1]?.[0], messages);
    assert.equal(calls[1]?.[1], options, "Provider reasoning rules, cancellation and debug logging are host-owned");
    const fallback = {
      primary: created,
      primaryConnectionId: "connection-1",
      fallbackConnection: null,
      fallbackBaseUrl: "",
      category: "agents" as const,
    };
    assert.equal(withConnectionFallbackProvider(fallback), provider);
    assert.equal(calls[2]?.[0], fallback);
    assert.equal(getLocalSidecarProvider(), provider);
  } finally {
    release();
  }
  assert.throws(() => getLocalSidecarProvider(), /outside activation/);
  console.log(
    "Package LLM calls preserve host provider identity, connection settings, options and activation lifetime.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
