import { logger } from "../../lib/logger.js";
import type { CharacterCommand, SceneCommand } from "../conversation/character-commands.js";

type CharactersStore = {
  getById(id: string): Promise<{ data: unknown } | null>;
};

export async function handleConversationSceneCommand(args: {
  command: CharacterCommand;
  characterId: string | null;
  chatId: string;
  chars: CharactersStore;
  sendSceneRequested: (data: Record<string, unknown>) => void;
}): Promise<boolean> {
  if (args.command.type !== "scene") return false;
  const command = args.command as SceneCommand;

  try {
    const initiatorRow = args.characterId ? await args.chars.getById(args.characterId) : null;
    const initiatorData = parseRecord(initiatorRow?.data);
    const initiatorName =
      typeof initiatorData?.name === "string" && initiatorData.name.trim() ? initiatorData.name : "Character";

    args.sendSceneRequested({
      originChatId: args.chatId,
      prompt: command.scenario,
      background: command.background ?? null,
      plan: command.plan ?? null,
      initiatorCharId: args.characterId,
      initiatorCharName: initiatorName,
    });
    logger.info('[commands] Scene requested by "%s" from chat %s', initiatorName, args.chatId);
  } catch (err) {
    logger.error(err, "[commands] Scene request failed");
  }

  return true;
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
