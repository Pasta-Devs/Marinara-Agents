import { createCharactersStorage } from "../storage/characters.storage.js";
import { resolveSlurpCreatorScheduleContext as resolveContext } from "./slurp-creator-schedule-context.js";

type CreatorSource = { kind: string; entityId: string; displayName: string };

export function resolveSlurpCreatorScheduleContext(
  characters: ReturnType<typeof createCharactersStorage>,
  source: CreatorSource,
  fallbackTimeZone?: string,
  now: Date = new Date(),
): Promise<string> {
  return resolveContext(characters, source, fallbackTimeZone, now);
}
