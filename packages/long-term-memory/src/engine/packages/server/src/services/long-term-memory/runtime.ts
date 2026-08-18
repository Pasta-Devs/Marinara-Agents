import { LongTermMemoryDraftStore } from "./draft-store.js";
import { getLtmExtractionConfig } from "./extraction-config.js";
import { getLtmGlobalSettings } from "./settings.js";
import { LongTermMemoryStorage } from "./storage.js";
import { validateLongTermMemoryInjectionReceipts, validateLongTermMemoryUsage } from "./usage.js";
import { ltmAgentSettingsSchema } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile } from "./atomic-json.js";
import { getLongTermMemoryDirectories, safeJoin } from "./paths.js";
export async function activateLongTermMemoryStorage(root: string) {
  const storage = new LongTermMemoryStorage(root);
  const draftStore = new LongTermMemoryDraftStore(root);
  const runtime = {
    root,
    storage,
    draftStore,
    async selfCheck() {
      await storage.initializeLtmStore();
      await Promise.all([
        getLtmGlobalSettings(root),
        getLtmExtractionConfig(root),
        validateLongTermMemoryUsage(root),
        validateLongTermMemoryInjectionReceipts(root),
        readJsonFile<unknown>(safeJoin(getLongTermMemoryDirectories(root).config, "agent-settings.json"), {}).then(
          (value) => ltmAgentSettingsSchema.parse(value),
        ),
      ]);
    },
    async cleanup() {
      await storage.cleanup();
    },
  };
  try {
    await runtime.selfCheck();
    return runtime;
  } catch (error) {
    await runtime.cleanup();
    throw error;
  }
}
