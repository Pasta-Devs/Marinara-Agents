// ──────────────────────────────────────────────
// Otome Forge: what P15 (line pack) and P16 (message of the day) send back, and its checks (plan M3 "Home server")
// ──────────────────────────────────────────────
// The prompts are in S/prompts.ts. Here: the reply shapes, and the two checks the repair turn names (S/home/lines.ts,
// S/home/note.ts, and the care note's S/care/care-note.ts): English wording about the protagonist's absence, and a
// question mark in any script.
import { z, type ZodType } from "zod";
import { NOTE_TEXT_MAX, type TimeOfDay } from "../../../../../client/src/features/otome-forge/shared/home.js";

/**
 * English wording that speaks about the protagonist's absence: a reply that uses it gets the repair turn. The prompt
 * rule covers every language; this catches the common English slips.
 */
const ABSENCE =
  /\b(?:where (?:have|were) you|welcome back|you(?:['’]re| are) back|(?:you )?came back|been (?:a while|ages|so long|too long|forever)|long time no|(?:have )?missed you|you(?:['’]ve| have) been (?:gone|away)|finally (?:here|back)|left me waiting)\b/i;

export function mentionsAbsence(text: string): boolean {
  return ABSENCE.test(text);
}

/** A question mark in any script P15 and P16 may write: neither the note nor a line asks one. */
export const QUESTION_MARK = /[?？¿؟]/u;

// ── P15's reply: the line pack (the prompt: S/prompts.ts linePackMessages) ──

const line = z.string().max(400);
const lines = z.array(line).max(16);
const times = z.object({ morning: lines, day: lines, night: lines });
const claw = z.object({ cheer: lines, cheat: lines, win: lines, miss: lines, plush: lines });

export interface LinePackReply {
  tap: { head: Record<TimeOfDay, string[]>; hand: Record<TimeOfDay, string[]>; heart: Record<TimeOfDay, string[]> };
  annoyed: string[];
  cold: string[];
  comfort?: string[] | null;
  claw?: { cheer: string[]; cheat: string[]; win: string[]; miss: string[]; plush: string[] } | null;
}

export const LinePackReplySchema: ZodType<LinePackReply> = z.object({
  tap: z.object({ head: times, hand: times, heart: times }),
  annoyed: lines,
  cold: lines,
  comfort: lines.nullable().optional(),
  claw: claw.nullable().optional(),
});

// ── P16's reply: the message of the day (the prompt: S/prompts.ts noteMessages) ──

export interface NoteReply {
  text: string;
  face?: string | null;
  mood: { word: string; reason: string };
}

export const NoteReplySchema: ZodType<NoteReply> = z.object({
  text: z.string().min(1).max(NOTE_TEXT_MAX),
  face: z.string().max(40).nullable().optional(),
  mood: z.object({ word: z.string().min(1).max(60), reason: z.string().max(120) }),
});
