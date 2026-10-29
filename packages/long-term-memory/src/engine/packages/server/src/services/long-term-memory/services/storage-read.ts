import { z } from "zod";
import type { LtmNote } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readLtmDebugLog, recordLtmDebugEvent } from "../maintenance/debug-log.js";

/** The name a package gives itself when it reads memories; Memory Settings lists it. A malformed name is dropped. */
export const ltmPackageCallerSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9._:-]{0,63}$/iu)
  .optional()
  .catch(undefined);

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
