import { z } from "zod";
import { ltmNoteTypeSchema, type LtmNote } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import type { LongTermMemoryStorage } from "../persistence/storage.js";

const listNotesFilterSchema = z.object({
  type: ltmNoteTypeSchema.optional(),
  characterIds: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
});

/** Whether another package may read this memory: not an imported source or archived, and usable outside game chats. */
export function isLtmNoteShareable(note: Pick<LtmNote, "type" | "status" | "modes">) {
  return (
    note.type !== "source" &&
    note.status !== "archived" &&
    note.modes.some((mode) => mode === "roleplay" || mode === "conversation")
  );
}

/**
 * The `long-term-memory:storage` service any package can look up; Slurp's flavour brief reads a character's own
 * note through it. It lists only memories available to the named characters everywhere: a character-id query
 * never matches a memory limited to a chat or group, and imported sources (their text is the raw summary or
 * chat), archived and game-only memories are dropped. The vault
 * folder, the other storage methods and the draft store stay private.
 */
export function createLtmStorageReadService(storage: Pick<LongTermMemoryStorage, "listNotes">) {
  return {
    storage: {
      async listNotes(filter: unknown) {
        const parsed = listNotesFilterSchema.safeParse(filter);
        if (!parsed.success) return [];
        // Like chat recall, a malformed file elsewhere in the vault doesn't stop the read.
        const notes = await storage.listNotes({
          type: parsed.data.type,
          characterIds: parsed.data.characterIds,
          skipInvalid: true,
        });
        return notes.filter(isLtmNoteShareable);
      },
    },
  };
}
