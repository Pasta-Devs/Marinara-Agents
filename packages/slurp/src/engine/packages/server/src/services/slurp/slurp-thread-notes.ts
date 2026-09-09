/**
 * What one creator has learned about one fan, as two short lists.
 *
 * Pure, like `slurp-mood.ts`: the rule can be tested without an Engine checkout, and a later
 * prompt can be built from the exact same facts the last reply wrote.
 *
 * Working memory is recent and allowed to change. Long-term memory is the stable residue — a
 * name, a job, a pet, a boundary — and it only moves when the model names the fact by id.
 * Append-only notes could not do that: a fan who quit the hospital kept both jobs forever.
 */

export const SLURP_NOTE_MAX_LENGTH = 160;

/** Per reply. The creator may notice one or two things, not empty the conversation into storage. */
export const SLURP_NOTES_PER_REPLY = 2;

export const SLURP_WORKING_NOTE_LIMIT = 8;
export const SLURP_LONGTERM_NOTE_LIMIT = 8;

export const SLURP_NOTE_TIERS = ["working", "longterm"] as const;
export type SlurpNoteTier = (typeof SLURP_NOTE_TIERS)[number];

export const SLURP_NOTE_OPS = ["add", "replace", "forget", "keep"] as const;
export type SlurpNoteOp = (typeof SLURP_NOTE_OPS)[number];

export type SlurpThreadNote = {
  id: string;
  text: string;
  tier: SlurpNoteTier;
  /** Optional tags for categorization: "promise", "task", "recurring", etc. */
  tags?: string[];
  /** Optional metadata for promise tracking */
  metadata?: {
    type?: "promise" | "task" | "commitment";
    /** ISO timestamp of last follow-up related to this note */
    lastFollowUp?: string;
    /** Count of follow-ups sent for this promise */
    followUpCount?: number;
    /** Maximum follow-ups to send */
    maxFollowUps?: number;
    /** For recurring promises: "daily", "every 4 hours", etc. */
    frequency?: string;
    /** Related to a tip amount */
    tipAmount?: number;
  };
};

export type SlurpNoteOperation =
  | { op: "add"; text: string }
  | { op: "replace"; id: string; text: string }
  | { op: "forget"; id: string }
  | { op: "keep"; id: string };

const WORKING_PREFIX = "w";
const LONGTERM_PREFIX = "l";

const isNoteOp = (value: string): value is SlurpNoteOp => (SLURP_NOTE_OPS as readonly string[]).includes(value);

const clipNote = (value: string): string => value.trim().slice(0, SLURP_NOTE_MAX_LENGTH);

const sameText = (left: string, right: string): boolean => left.toLowerCase() === right.toLowerCase();

function nextId(notes: SlurpThreadNote[], prefix: string): string {
  let max = 0;
  for (const note of notes) {
    if (!note.id.startsWith(prefix)) continue;
    const parsed = Number(note.id.slice(prefix.length));
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  return `${prefix}${max + 1}`;
}

function findNote(notes: SlurpThreadNote[], id: string): SlurpThreadNote | undefined {
  return notes.find((note) => note.id === id);
}

function capTier(notes: SlurpThreadNote[], tier: SlurpNoteTier, limit: number): SlurpThreadNote[] {
  const kept: SlurpThreadNote[] = [];
  let remaining = limit;
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const note = notes[index];
    if (note.tier !== tier) {
      kept.push(note);
      continue;
    }
    if (remaining <= 0) continue;
    kept.push(note);
    remaining -= 1;
  }
  return kept.reverse();
}

/**
 * Notes are generated text written by an earlier reply. A blob written by an older build, or by
 * hand, must render as a thread with no notes rather than throw the whole inbox away.
 *
 * Plain strings are the 1.2.42 shape: they become working notes, with the oldest overflow moved
 * into long-term memory so a long thread does not forget the stable facts it already had.
 */
export function readStoredNotes(raw: unknown): SlurpThreadNote[] {
  const parsed = parseNotesJson(raw);
  if (!parsed) return [];
  if (Array.isArray(parsed)) return normalizeNoteList(parsed);
  return [];
}

function parseNotesJson(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeNoteList(parsed: unknown[]): SlurpThreadNote[] {
  if (parsed.every((entry) => typeof entry === "string")) {
    return migrateLegacyNotes(parsed.filter((entry): entry is string => typeof entry === "string"));
  }
  const notes: SlurpThreadNote[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const text = typeof record.text === "string" ? clipNote(record.text) : "";
    if (!text) continue;
    const tier = record.tier === "longterm" ? "longterm" : "working";
    const prefix = tier === "longterm" ? LONGTERM_PREFIX : WORKING_PREFIX;
    const id = typeof record.id === "string" && record.id.startsWith(prefix) ? record.id : nextId(notes, prefix);
    if (seen.has(id)) continue;
    seen.add(id);
    notes.push({ id, text, tier });
  }
  return capTier(capTier(notes, "working", SLURP_WORKING_NOTE_LIMIT), "longterm", SLURP_LONGTERM_NOTE_LIMIT);
}

function migrateLegacyNotes(values: string[]): SlurpThreadNote[] {
  const texts = values.map(clipNote).filter(Boolean);
  const longTermTexts = texts.slice(-SLURP_WORKING_NOTE_LIMIT - SLURP_LONGTERM_NOTE_LIMIT, -SLURP_WORKING_NOTE_LIMIT);
  const workingTexts = texts.slice(-SLURP_WORKING_NOTE_LIMIT);
  const notes: SlurpThreadNote[] = [];
  for (const text of longTermTexts) notes.push({ id: nextId(notes, LONGTERM_PREFIX), text, tier: "longterm" });
  for (const text of workingTexts) notes.push({ id: nextId(notes, WORKING_PREFIX), text, tier: "working" });
  return notes;
}

/**
 * Read memory operations out of a model answer.
 *
 * A string is the old "append this fact" shape and becomes an add. Unknown operations are
 * dropped rather than rejected: a reply with good words and a malformed memory field is still
 * the thing the fan asked for.
 */
export function readSlurpNoteOperations(value: unknown): SlurpNoteOperation[] {
  if (!Array.isArray(value)) return [];
  const operations: SlurpNoteOperation[] = [];
  for (const entry of value) {
    if (operations.length >= SLURP_NOTES_PER_REPLY) break;
    const operation = readOneOperation(entry);
    if (operation) operations.push(operation);
  }
  return operations;
}

function readOneOperation(entry: unknown): SlurpNoteOperation | null {
  if (typeof entry === "string") {
    const text = clipNote(entry);
    return text ? { op: "add", text } : null;
  }
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const record = entry as Record<string, unknown>;
  const op = typeof record.op === "string" && isNoteOp(record.op) ? record.op : null;
  if (!op) return null;
  if (op === "add") {
    const text = typeof record.text === "string" ? clipNote(record.text) : "";
    return text ? { op: "add", text } : null;
  }
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) return null;
  if (op === "forget" || op === "keep") return { op, id };
  const text = typeof record.text === "string" ? clipNote(record.text) : "";
  return text ? { op: "replace", id, text } : null;
}

/**
 * Apply at most two operations to one thread's notes.
 *
 * Unknown ids are skipped. A duplicate add is skipped. Working memory drops its oldest fact when
 * it is full; long-term memory refuses a keep rather than silently deleting a stable fact.
 */
export function applySlurpThreadNotes(notes: SlurpThreadNote[], operations: SlurpNoteOperation[]): SlurpThreadNote[] {
  let next = notes.map((note) => ({ ...note }));
  for (const operation of operations.slice(0, SLURP_NOTES_PER_REPLY)) {
    next = applyOne(next, operation);
  }
  return capTier(capTier(next, "working", SLURP_WORKING_NOTE_LIMIT), "longterm", SLURP_LONGTERM_NOTE_LIMIT);
}

function applyOne(notes: SlurpThreadNote[], operation: SlurpNoteOperation): SlurpThreadNote[] {
  if (operation.op === "add") return addNote(notes, operation.text);
  const existing = findNote(notes, operation.id);
  if (!existing) return notes;
  if (operation.op === "forget") return notes.filter((note) => note.id !== operation.id);
  if (operation.op === "replace") {
    return notes.map((note) => (note.id === operation.id ? { ...note, text: operation.text } : note));
  }
  if (existing.tier === "longterm") return notes;
  const longTermCount = notes.filter((note) => note.tier === "longterm").length;
  if (longTermCount >= SLURP_LONGTERM_NOTE_LIMIT) return notes;
  const id = nextId(notes, LONGTERM_PREFIX);
  return notes.map((note) => (note.id === existing.id ? { id, text: note.text, tier: "longterm" } : note));
}

function addNote(notes: SlurpThreadNote[], text: string): SlurpThreadNote[] {
  if (notes.some((note) => sameText(note.text, text))) return notes;
  const added = [...notes, { id: nextId(notes, WORKING_PREFIX), text, tier: "working" as const }];
  return capTier(added, "working", SLURP_WORKING_NOTE_LIMIT);
}

export function notesForPrompt(notes: SlurpThreadNote[]): {
  working: Array<{ id: string; text: string }>;
  longTerm: Array<{ id: string; text: string }>;
} {
  return {
    working: notes.filter((note) => note.tier === "working").map((note) => ({ id: note.id, text: note.text })),
    longTerm: notes.filter((note) => note.tier === "longterm").map((note) => ({ id: note.id, text: note.text })),
  };
}

/**
 * Find promise/commitment notes that might need follow-ups.
 */
export function findPromiseNotes(notes: SlurpThreadNote[]): SlurpThreadNote[] {
  return notes.filter((note) => note.tags?.includes("promise") || note.metadata?.type === "promise");
}

/**
 * Check if a note has reached its maximum follow-ups.
 */
export function hasReachedMaxFollowUps(note: SlurpThreadNote): boolean {
  if (!note.metadata?.maxFollowUps) return false;
  const count = note.metadata.followUpCount ?? 0;
  return count >= note.metadata.maxFollowUps;
}

/**
 * Increment the follow-up count for a promise note.
 */
export function incrementFollowUpCount(note: SlurpThreadNote): SlurpThreadNote {
  return {
    ...note,
    metadata: {
      ...note.metadata,
      followUpCount: (note.metadata?.followUpCount ?? 0) + 1,
      lastFollowUp: new Date().toISOString(),
    },
  };
}
