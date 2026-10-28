import { z } from "zod";
import { ltmNoteTypeSchema, type LtmNote } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readLtmDebugLog, recordLtmDebugEvent } from "../maintenance/debug-log.js";
import type { LongTermMemoryStorage } from "../persistence/storage.js";
import { getLtmGlobalSettings } from "../settings.js";

/** The name a package gives itself when it reads memories; Memory Settings lists it. A malformed name is dropped. */
export const ltmPackageCallerSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9._:-]{0,63}$/iu)
  .optional()
  .catch(undefined);

const listNotesFilterSchema = z.object({
  caller: ltmPackageCallerSchema,
  type: ltmNoteTypeSchema.optional(),
  characterIds: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
});

const PACKAGE_READ_ACTIONS = ["package_list", "package_recall"] as const;

/** Whether another package may read this memory: not an imported source or archived, and usable outside game chats. */
export function isLtmNoteShareable(note: Pick<LtmNote, "type" | "status" | "modes">) {
  return (
    note.type !== "source" &&
    note.status !== "archived" &&
    note.modes.some((mode) => mode === "roleplay" || mode === "conversation")
  );
}

/** One debug-log line per read by another package, so Memory Settings can say who reads memories. */
export function recordLtmPackageRead(
  root: string,
  action: (typeof PACKAGE_READ_ACTIONS)[number],
  caller: string | undefined,
  memories: number,
) {
  return recordLtmDebugEvent({
    root,
    phase: "retrieval",
    action,
    status: "ok",
    ...(caller ? { source: caller } : {}),
    counts: { memories },
  });
}

const PACKAGE_READ_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The ten packages that read memories most lately, newest first, with their reads and returned memories over the
 * last 7 days; `caller` is null for a package that gave no name.
 */
export async function listLtmPackageReaders(root: string) {
  const since = Date.now() - PACKAGE_READ_WINDOW_MS;
  const readers = new Map<string | null, { lastReadAt: string; reads: number; memories: number }>();
  for (const event of await readLtmDebugLog({ phase: "retrieval" }, root)) {
    if (!(PACKAGE_READ_ACTIONS as readonly string[]).includes(event.action)) continue;
    const reader = readers.get(event.source ?? null) ?? { lastReadAt: event.ts, reads: 0, memories: 0 };
    if (event.ts > reader.lastReadAt) reader.lastReadAt = event.ts;
    if (Date.parse(event.ts) >= since) {
      reader.reads += 1;
      reader.memories += event.counts?.memories ?? 0;
    }
    readers.set(event.source ?? null, reader);
  }
  return [...readers]
    .map(([caller, reader]) => ({ caller, ...reader }))
    .sort((left, right) => right.lastReadAt.localeCompare(left.lastReadAt))
    .slice(0, 10);
}

/**
 * The `long-term-memory:storage` service any package can look up; Slurp's flavour brief reads a character's own
 * note through it. It lists only memories available to the named characters everywhere: a character-id query
 * never matches a memory limited to a chat or group, and imported sources (their text is the raw summary or
 * chat), archived and game-only memories are dropped. The vault folder, the other storage methods and the draft
 * store stay private. "Other Agents can read memories" turned off makes it list nothing.
 */
export function createLtmStorageReadService(storage: Pick<LongTermMemoryStorage, "listNotes" | "root">) {
  return {
    storage: {
      async listNotes(filter: unknown) {
        const parsed = listNotesFilterSchema.safeParse(filter);
        if (!parsed.success || !(await getLtmGlobalSettings(storage.root)).longTermMemoryShareWithPackages) return [];
        // Like chat recall, a malformed file elsewhere in the vault doesn't stop the read.
        const notes = (
          await storage.listNotes({
            type: parsed.data.type,
            characterIds: parsed.data.characterIds,
            skipInvalid: true,
          })
        ).filter(isLtmNoteShareable);
        await recordLtmPackageRead(storage.root, "package_list", parsed.data.caller, notes.length);
        return notes;
      },
    },
  };
}
