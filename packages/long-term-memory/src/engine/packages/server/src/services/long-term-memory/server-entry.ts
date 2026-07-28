import { join } from "node:path";
import {
  configurePackageRuntime,
  type CapabilityRuntimeHost,
} from "./package-runtime.js";
import { activateLongTermMemoryStorage } from "./runtime.js";
import {
  prepareGenerationLongTermMemory,
  recordGenerationLongTermMemoryDispatch,
} from "./generation-injection.js";
import { createLongTermMemoryRoutes } from "./routes.js";
import { adoptLegacyLongTermMemoryAgentConfig, adoptLegacyLongTermMemoryChats } from "./legacy-adoption.js";
import type { FastifyPluginAsync } from "fastify";

let active: Awaited<ReturnType<typeof activateLongTermMemoryStorage>> | null =
  null;

type Api = {
  runtime: CapabilityRuntimeHost;
  registerService(name: string, service: unknown): () => void;
  registerPrivilegedRoutes(routes:FastifyPluginAsync,options:{prefix:string}):Promise<() => void>;
};

type ActivationContext = {
  api: Api;
  dataDir: string;
};

export async function activate({ api, dataDir }: ActivationContext) {
  const releaseHost = configurePackageRuntime({ ...api.runtime, dataDir });
  try {
    active = await activateLongTermMemoryStorage(
      join(dataDir, "long-term-memory"),
    );
    await adoptLegacyLongTermMemoryAgentConfig(active.root);
    await adoptLegacyLongTermMemoryChats();
    const releaseRoutes=await api.registerPrivilegedRoutes(createLongTermMemoryRoutes(active),{prefix:"/api/long-term-memory"});
    const releaseStorageService = api.registerService("long-term-memory:storage", {
      root: active.root,
      storage: active.storage,
      drafts: active.draftStore,
    });
    const releaseRuntimeService = api.registerService("long-term-memory:runtime", {
      recall: (input: {
        chatId: string;
        chatMode: string;
        characterIds: string[];
        messages: Array<{ role: string; content: string }>;
        signal?: AbortSignal;
        debugMode?: boolean;
      }) => prepareGenerationLongTermMemory({ ...input, root: active!.root }),
      recordPromptAccepted: (input: {
        chatId: string;
        receipt: unknown;
        messages: Array<{ content: string }>;
      }) => recordGenerationLongTermMemoryDispatch({ ...input, root: active!.root }),
    });
    return async () => {
      releaseRoutes();
      releaseRuntimeService();
      releaseStorageService();
      await active?.cleanup();
      active = null;
      releaseHost();
    };
  } catch (error) {
    active = null;
    releaseHost();
    throw error;
  }
}

export async function selfCheck() {
  if (!active) throw new Error("Long-Term Memory storage did not initialize");
  await active.selfCheck();
}
