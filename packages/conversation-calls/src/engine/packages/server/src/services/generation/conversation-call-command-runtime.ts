// Calls registers this module as the Engine's "conversation-calls:command" service. It replaces the vendored
// Engine file at this path, a host shim that only looks that service up again, so registering it never rang.
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { ringCharacterCall, parseRecord, type CallCommandArgs } from "../conversation/call-command.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createConversationCallsStorage } from "../storage/conversation-calls.storage.js";

export async function handleConversationCallCommand(args: CallCommandArgs & { db: DB }): Promise<boolean> {
  return ringCharacterCall(args, {
    calls: createConversationCallsStorage(args.db),
    readTtsSettings: async () => parseRecord(await createAppSettingsStorage(args.db).get("tts")),
    log: logger,
  });
}
