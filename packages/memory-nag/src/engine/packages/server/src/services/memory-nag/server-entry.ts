import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { FastifyPluginAsync } from "fastify";
import { memoryNagAgentRuntime } from "./agent-runtime.js";
import { configureMemoryNagRuntime } from "./package-runtime.js";
import { contributeMemoryNags } from "./prompt-context.js";
import { memoryNagRoutes } from "./routes.js";
import { readMemoryNagVault } from "./vault.js";

type ActivationContext = {
  api: {
    runtime: CapabilityRuntimeHost;
    registerService(name: string, service: unknown): () => void;
    registerPromptContext(contributor: typeof contributeMemoryNags): () => void;
    registerPrivilegedRoutes(routes: FastifyPluginAsync, options: { prefix: string }): Promise<() => void>;
  };
};

let ready = false;

export async function activate({ api }: ActivationContext) {
  const releaseRuntime = configureMemoryNagRuntime(api.runtime);
  try {
    const releaseRoutes = await api.registerPrivilegedRoutes(memoryNagRoutes, { prefix: "/api/memory-nag" });
    const releaseAgent = api.registerService("agent-runtime:memory-nag", memoryNagAgentRuntime);
    const releasePrompt = api.registerPromptContext(contributeMemoryNags);
    ready = true;
    return () => {
      ready = false;
      releasePrompt();
      releaseAgent();
      releaseRoutes();
      releaseRuntime();
    };
  } catch (error) {
    releaseRuntime();
    throw error;
  }
}

export async function selfCheck() {
  if (!ready) throw new Error("Memory Nag did not initialize");
  await readMemoryNagVault("__marinara_capability_self_check__");
}
