import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createJournal, type Journal } from "../game/journal.service.js";
import { createChatsStorage } from "../storage/chats.storage.js";

export async function updateJournal(
  db: DB,
  chatId: string,
  transform: (journal: Journal) => Journal | null,
): Promise<void> {
  try {
    const chatsStore = createChatsStorage(db);
    await chatsStore.patchMetadata(chatId, (freshMeta) => {
      const journal = (freshMeta.gameJournal as Journal) ?? createJournal();
      const updated = transform(journal);
      return updated ? { gameJournal: updated } : {};
    });
  } catch (error) {
    logger.warn(error, "[game] Journal auto-fill failed for chat %s", chatId);
    // Non-critical; generation should not fail because journal auto-fill failed.
  }
}
