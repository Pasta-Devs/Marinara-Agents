import { ltmAgentSettingsSchema } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "../persistence/atomic-json.js";
import { getLongTermMemoryDirectories, safeJoin } from "../persistence/paths.js";
import { getPackageRuntime, logger } from "../package-runtime.js";

export async function adoptLegacyLongTermMemoryAgentConfig(root: string) {
  const path = safeJoin(getLongTermMemoryDirectories(root).config, "agent-settings.json");
  if ((await readJsonFile<unknown>(path, null)) !== null) return;
  const getAgentConfig = getPackageRuntime().getAgentConfig;
  if (!getAgentConfig) return;
  try {
    const config = await getAgentConfig();
    if (!config) return;
    const settings = ltmAgentSettingsSchema.parse({
      ...config.settings,
      connectionId: config.settings.connectionId ?? config.connectionId ?? undefined,
    });
    await writeJsonAtomic(path, settings);
  } catch (error) {
    logger.warn(error, "[ltm] Could not adopt legacy agent settings");
  }
}
