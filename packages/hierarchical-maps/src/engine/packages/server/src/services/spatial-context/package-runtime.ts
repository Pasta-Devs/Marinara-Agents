import { nanoid } from "nanoid";

let lastSortableTimestamp = 0;
let sortableSequence = 0;

/** Generate an opaque package-owned record ID. */
export function newId(): string {
  return nanoid();
}

/** Generate a package-owned ID whose lexical order follows creation order. */
export function newTimeSortableId(): string {
  const timestamp = Date.now();
  if (timestamp === lastSortableTimestamp) sortableSequence += 1;
  else {
    lastSortableTimestamp = timestamp;
    sortableSequence = 0;
  }
  return `${timestamp.toString(36).padStart(10, "0")}${sortableSequence.toString(36).padStart(4, "0")}${nanoid(7)}`;
}

export function now(): string {
  return new Date().toISOString();
}
