import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
import { withLtmVaultLock } from "./vault-lock.js";
import { getPackageRuntime, logger } from "../package-runtime.js";

// The chat messages "Hide imported messages from the AI" hid, per chat and source note: only the ids the host
// reported as changed, so turning the setting off or deleting the note shows exactly those again. It lives in config/
// beside the settings; a backup restore or Delete all replaces every note, so it shows them all first.
export type LtmHiddenMessages = Record<string, Record<string, string[]>>;

const hiddenMessagesPath = (root: string) =>
  safeJoin(getLongTermMemoryDirectories(root).config, "hidden-messages.json");

/** The host's hide/show call, or null on an Engine without one. */
export function ltmSetMessagesHiddenFromAI() {
  const persistence = getPackageRuntime().persistence;
  return typeof persistence?.setMessagesHiddenFromAI === "function"
    ? persistence.setMessagesHiddenFromAI.bind(persistence)
    : null;
}

export async function readLtmHiddenMessages(root = getLongTermMemoryRoot()): Promise<LtmHiddenMessages> {
  const file = await readJsonFile<{ chats?: unknown }>(hiddenMessagesPath(root), {});
  const chats: LtmHiddenMessages = {};
  if (!file.chats || typeof file.chats !== "object") return chats;
  for (const [chatId, notes] of Object.entries(file.chats)) {
    if (!notes || typeof notes !== "object") continue;
    for (const [noteId, ids] of Object.entries(notes)) {
      const kept = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
      if (kept.length) (chats[chatId] ??= {})[noteId] = kept;
    }
  }
  return chats;
}

export async function writeLtmHiddenMessages(chats: LtmHiddenMessages, root = getLongTermMemoryRoot()) {
  await writeJsonAtomic(hiddenMessagesPath(root), { version: 1, chats });
}

/** Shows the messages hidden for these source notes, or for every note when none are named, and forgets them. */
export async function showLtmHiddenMessages(root = getLongTermMemoryRoot(), noteIds?: Iterable<string>) {
  return withLtmVaultLock(root, async () => {
    const chats = await readLtmHiddenMessages(root),
      wanted = noteIds ? new Set(noteIds) : null,
      setHidden = ltmSetMessagesHiddenFromAI();
    let changed = false;
    // Written even when a later chat fails, so the record never lists messages already shown.
    try {
      for (const [chatId, notes] of Object.entries(chats)) {
        const ids = Object.entries(notes).flatMap(([noteId, owned]) => (!wanted || wanted.has(noteId) ? owned : []));
        if (!ids.length) continue;
        if (!setHidden) {
          logger.warn("[ltm] This Marinara version cannot show hidden messages again; %d stay hidden.", ids.length);
          return;
        }
        try {
          await setHidden(chatId, ids, false);
        } catch (error) {
          // A deleted chat has nothing left to show; anything else keeps the record so a later try can show them.
          if (!(error instanceof Error && error.message === `Chat ${chatId} was not found.`)) throw error;
        }
        for (const noteId of Object.keys(notes)) if (!wanted || wanted.has(noteId)) delete notes[noteId];
        if (!Object.keys(notes).length) delete chats[chatId];
        changed = true;
      }
    } finally {
      if (changed) await writeLtmHiddenMessages(chats, root);
    }
  });
}
