import { join } from "node:path";
import { configurePackageRuntime, type CapabilityRuntimeHost } from "./package-runtime.js";
import { activateLongTermMemoryStorage, withLongTermMemoryVaultMutation } from "./runtime.js";
import { refreshLongTermMemoryIndexes } from "./recall/rebuild.js";
import { resumeLtmIndexRebuild, stopLtmIndexRebuild } from "./recall/rebuild-job.js";
import {
  prepareGenerationLongTermMemory,
  recordGenerationLongTermMemoryDispatch,
} from "./recall/generation-injection.js";
import { createLongTermMemoryRoutes } from "./routes.js";
import { createLtmRecallService } from "./services/recall.js";
import { createLtmStorageReadService } from "./services/storage-read.js";
import { adoptLegacyLongTermMemoryAgentConfig } from "./maintenance/legacy-adoption.js";
import type { FastifyPluginAsync } from "fastify";

let active: Awaited<ReturnType<typeof activateLongTermMemoryStorage>> | null = null;

type Api = {
  runtime: CapabilityRuntimeHost;
  registerService(name: string, service: unknown): () => void;
  registerPrivilegedRoutes(routes: FastifyPluginAsync, options: { prefix: string }): Promise<() => void>;
};

type ActivationContext = {
  api: Api;
  dataDir: string;
};

export async function activate({ api, dataDir }: ActivationContext) {
  const releaseHost = configurePackageRuntime({ ...api.runtime, dataDir });
  try {
    active = await activateLongTermMemoryStorage(join(dataDir, "long-term-memory"));
    const activationRoot = active.root;
    resumeLtmIndexRebuild(activationRoot);
    await adoptLegacyLongTermMemoryAgentConfig(active.root);
    const releaseRoutes = await api.registerPrivilegedRoutes(createLongTermMemoryRoutes(active), {
      prefix: "/api/long-term-memory",
    });
    const releaseStorageService = api.registerService(
      "long-term-memory:storage",
      createLtmStorageReadService(active.storage),
    );
    const releaseRecallService = api.registerService("long-term-memory:recall", createLtmRecallService(active.storage));
    const releaseRuntimeService = api.registerService("long-term-memory:runtime", {
      refresh: async ({ signal }: { signal: AbortSignal }) => {
        await refreshLongTermMemoryIndexes(activationRoot, signal);
        return { status: "refreshed" as const };
      },
      recall: (input: {
        chatId: string;
        chatMode: string;
        characterIds: string[];
        messages: Array<{ role: string; content: string }>;
        signal?: AbortSignal;
        debugMode?: boolean;
      }) => prepareGenerationLongTermMemory({ ...input, root: active!.root }),
      recordPromptAccepted: (input: { chatId: string; receipt: unknown; messages: Array<{ content: string }> }) =>
        recordGenerationLongTermMemoryDispatch({ ...input, root: active!.root }),
      withVaultMutation: <T>(operation: () => Promise<T>) => withLongTermMemoryVaultMutation(activationRoot, operation),
    });
    return async () => {
      releaseRoutes();
      releaseRuntimeService();
      releaseStorageService();
      releaseRecallService();
      // A scheduled rebuild must not publish after deactivation; the index stays dirty and the next recall rebuilds it.
      await stopLtmIndexRebuild(activationRoot);
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
