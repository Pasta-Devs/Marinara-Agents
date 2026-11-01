import { z } from "zod";
import type { LtmNote } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readLtmDebugLog, recordLtmDebugEvent } from "../maintenance/debug-log.js";

/** The name a package gives itself when it reads memories; Memory Settings lists it. A malformed name is dropped. */
export const ltmPackageCallerIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9._:-]{0,63}$/iu);
export const ltmPackageCallerSchema = ltmPackageCallerIdSchema.optional().catch(undefined);

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

/** One debug-log line per record another package added, so Memory Settings can say who adds memories. */
export function recordLtmPackageAdd(root: string, caller: string, memories: number) {
  return recordLtmDebugEvent({
    root,
    phase: "apply",
    action: "package_add",
    status: "ok",
    source: caller,
    counts: { memories },
  });
}

const PACKAGE_READ_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The ten packages that read or added memories most lately, newest first, with their reads, returned memories and
 * added memories over the last 7 days; `caller` is null for a package that gave no name, and `lastReadAt` is null
 * for one that has only added.
 */
export async function listLtmPackageReaders(root: string) {
  const since = Date.now() - PACKAGE_READ_WINDOW_MS;
  const readers = new Map<
    string | null,
    { lastReadAt: string | null; lastAt: string; reads: number; memories: number; added: number }
  >();
  for (const event of await readLtmDebugLog({}, root)) {
    const isAdd = event.action === "package_add";
    if (!isAdd && !(PACKAGE_READ_ACTIONS as readonly string[]).includes(event.action)) continue;
    const reader = readers.get(event.source ?? null) ?? {
      lastReadAt: null,
      lastAt: event.ts,
      reads: 0,
      memories: 0,
      added: 0,
    };
    if (event.ts > reader.lastAt) reader.lastAt = event.ts;
    if (isAdd) {
      if (Date.parse(event.ts) >= since) reader.added += event.counts?.memories ?? 0;
    } else {
      if (!reader.lastReadAt || event.ts > reader.lastReadAt) reader.lastReadAt = event.ts;
      if (Date.parse(event.ts) >= since) {
        reader.reads += 1;
        reader.memories += event.counts?.memories ?? 0;
      }
    }
    readers.set(event.source ?? null, reader);
  }
  return [...readers]
    .map(([caller, { lastAt, ...reader }]) => ({ caller, lastAt, ...reader }))
    .sort((left, right) => right.lastAt.localeCompare(left.lastAt))
    .slice(0, 10)
    .map(({ lastAt: _lastAt, ...reader }) => reader);
}
