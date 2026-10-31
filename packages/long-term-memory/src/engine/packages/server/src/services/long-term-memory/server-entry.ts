import { join } from "node:path";
import { configurePackageRuntime, type CapabilityRuntimeHost } from "./package-runtime.js";
import { activateLongTermMemoryStorage, withLongTermMemoryVaultMutation } from "./runtime.js";
import { refreshLongTermMemoryIndexes } from "./recall/rebuild.js";
import { resumeLtmIndexRebuild, stopLtmIndexRebuild } from "./recall/rebuild-job.js";
import { resumeLtmAutoImport, stopLtmAutoImport } from "./sources/auto-import-job.js";
import {
  prepareGenerationLongTermMemory,
  recordGenerationLongTermMemoryDispatch,
} from "./recall/generation-injection.js";
import { createLongTermMemoryRoutes } from "./routes.js";
import { createLtmRecallService } from "./services/recall.js";
import { adoptLegacyLongTermMemoryAgentConfig } from "./maintenance/legacy-adoption.js";
import type { FastifyPluginAsync } from "fastify";

// Issue #1964: the block form `advancedMemoryUnits` reads. Names, not ids; no thread bucket, because Advanced Memory
// recaps carry no open-thread lists and threads keep coming from chat extraction.
const ADVANCED_MEMORY_BLOCK_INSTRUCTION = [
  "After the recap, add a memory block made of short entries separated by blank lines. Each entry is one heading line and its fields, using only these forms:",
  "## timeline_event\nSummary: one thing that happened in this scene\nWhen: when it happened in the story (optional)",
  "## character_fact\nCharacter: the character's exact name\nFact: a lasting fact about that character",
  "## relationship_state\nBetween: first exact name, second exact name\nState: how those two now stand with each other",
  "## world_fact\nFact: a lasting fact about the world or setting",
  "Use the names exactly as they appear in the chat. Write one fact per entry, only what the scene establishes, and leave out anything uncertain.",
].join("\n\n");

let active: Awaited<ReturnType<typeof activateLongTermMemoryStorage>> | null = null;

type Api = {
  runtime: CapabilityRuntimeHost;
  registerService(name: string, service: unknown, options?: { hostOnly?: boolean }): () => void;
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
    resumeLtmAutoImport(activationRoot);
    await adoptLegacyLongTermMemoryAgentConfig(active.root);
    const releaseRoutes = await api.registerPrivilegedRoutes(createLongTermMemoryRoutes(active), {
      prefix: "/api/long-term-memory",
    });
    const releaseRecallService = api.registerService("long-term-memory:recall", createLtmRecallService(active.storage));
    // Host-only from Capability API 1.388: only the Engine reads it. Older Engines ignore the option.
    const releaseRuntimeService = api.registerService(
      "long-term-memory:runtime",
      {
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
        withVaultMutation: <T>(operation: () => Promise<T>) =>
          withLongTermMemoryVaultMutation(activationRoot, operation),
        // Issue #1964: from Capability API 1.391 the Engine appends this to an Advanced Memory scene recap request and
        // stores the reply as the record's block. Older Engines never call it.
        summaryMemoryInstruction: () => ADVANCED_MEMORY_BLOCK_INSTRUCTION,
      },
      { hostOnly: true },
    );
    return async () => {
      releaseRoutes();
      releaseRuntimeService();
      releaseRecallService();
      // A background import must not write after deactivation; the next reply after activation arms it again. It stops
      // first, so a rebuild it requests on the way out is stopped below.
      await stopLtmAutoImport(activationRoot);
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
