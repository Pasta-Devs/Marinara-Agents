import { createCharactersStorage } from "../../../lib/host-characters-storage.js";
import { resolveSlurpCreatorScheduleContext as resolveContext } from "../../modules/creators/slp-creator-schedule-context.js";

import { slurpWorldNow } from "../../../../../shared/src/slp/slp-world-clock.js";
type CreatorSource = { kind: string; entityId: string; displayName: string };

export function resolveSlurpCreatorScheduleContext(
  characters: ReturnType<typeof createCharactersStorage>,
  source: CreatorSource,
  fallbackTimeZone?: string,
  now: Date = slurpWorldNow(),
): Promise<string> {
  return resolveContext(characters, source, fallbackTimeZone, now);
}
