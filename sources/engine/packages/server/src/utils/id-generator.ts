// ──────────────────────────────────────────────
// Utility: ID Generation
// ──────────────────────────────────────────────
import { nanoid } from "nanoid";

let lastSortableTimestamp = 0;
let sortableSequence = 0;

/** Generate a unique ID (21-char nanoid). */
export function newId(): string {
  return nanoid();
}

/** Generate an ID whose lexical order follows creation order within this server process. */
export function newTimeSortableId(): string {
  const timestamp = Date.now();
  if (timestamp === lastSortableTimestamp) sortableSequence += 1;
  else {
    lastSortableTimestamp = timestamp;
    sortableSequence = 0;
  }
  return `${timestamp.toString(36).padStart(10, "0")}${sortableSequence.toString(36).padStart(4, "0")}${nanoid(7)}`;
}

/** Get the current ISO timestamp. */
export function now(): string {
  return new Date().toISOString();
}
