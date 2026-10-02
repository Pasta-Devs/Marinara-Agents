import { LongTermMemoryDraftStore } from "./draft-store.js";
import { getLtmExtractionConfig } from "./extraction-config.js";
import { getLtmGlobalSettings } from "./settings.js";
import { LongTermMemoryStorage } from "./storage.js";
import { withLtmVaultLock } from "./vault-lock.js";
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

/**
 * Private trusted-host boundary for Engine-owned vault publication/rollback. The
 * operation runs inside the reentrant vault lock so no read or recall can observe
 * a partially published vault, and the package-owned initialization/snapshot
 * caches are reset before and after it so the next read rebuilds from the final
 * disk state. The return value or error is preserved and the lock is always
 * released, including when the supplied rollback throws.
 */
export async function withLongTermMemoryVaultMutation<T>(root: string, operation: () => Promise<T>) {
  return withLtmVaultLock(root, async () => {
    const storage = new LongTermMemoryStorage(root);
    await storage.cleanup();
    try {
      return await operation();
    } finally {
      await storage.cleanup();
    }
  });
}
