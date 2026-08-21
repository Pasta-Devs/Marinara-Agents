import { createChatsStorage } from "../storage/chats.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { resolveSlurpCreatorScheduleContext as resolveContext } from "./slurp-creator-schedule-context.js";

type CreatorSource = { kind: string; entityId: string; displayName: string };

export function resolveSlurpCreatorScheduleContext(
  chats: ReturnType<typeof createChatsStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
  source: CreatorSource,
  fallbackTimeZone?: string,
  now: Date = new Date(),
): Promise<string> {
  return resolveContext(chats, characters, source, fallbackTimeZone, now);
}
