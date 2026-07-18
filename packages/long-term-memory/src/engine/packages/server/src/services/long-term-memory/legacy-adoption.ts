import { ltmAgentSettingsSchema } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { getLongTermMemoryDirectories, safeJoin } from "./paths.js";
import { getPackagePersistence, getPackageRuntime, logger } from "./package-runtime.js";

const LTM_AGENT_ID = "long-term-memory";
const LTM_ADOPTION_MARKER = "longTermMemoryPackageAdopted";

function metadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function adoptLegacyLongTermMemoryChats() {
  const persistence = getPackagePersistence();
  let chats: Awaited<ReturnType<typeof persistence.listChats>>;
  try {
    chats = await persistence.listChats();
  } catch (error) {
    logger.warn(error, "[ltm] Could not inspect chats for legacy settings adoption");
    return;
  }
  for (const chat of chats) {
    const metadata = metadataRecord(chat.metadata);
    if (metadata[LTM_ADOPTION_MARKER] === true) continue;
    const activeAgentIds = Array.isArray(metadata.activeAgentIds)
      ? metadata.activeAgentIds.filter((id): id is string => typeof id === "string")
      : [];
    if (metadata.enableLongTermMemory !== true && !activeAgentIds.includes(LTM_AGENT_ID)) continue;
    try {
      await persistence.updateChatMetadata({
        chatId: chat.id,
        metadata: {
          ...metadata,
          activeAgentIds: activeAgentIds.includes(LTM_AGENT_ID)
            ? activeAgentIds
            : [...activeAgentIds, LTM_AGENT_ID],
          enableAgents: true,
          [LTM_ADOPTION_MARKER]: true,
        },
        updatedAt: chat.updatedAt,
      });
    } catch (error) {
      logger.warn(error, "[ltm] Could not adopt legacy settings for chat %s", chat.id);
    }
  }
}

export async function adoptLegacyLongTermMemoryAgentConfig(root: string) {
  const path = safeJoin(getLongTermMemoryDirectories(root).config, "agent-settings.json");
  if (await readJsonFile<unknown>(path, null) !== null) return;
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
