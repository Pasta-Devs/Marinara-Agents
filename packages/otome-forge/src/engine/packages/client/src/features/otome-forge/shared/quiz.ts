// ──────────────────────────────────────────────
// Otome Hearth: the personality quiz (#2174), what the server and the client share
// ──────────────────────────────────────────────
// While a chapter is planned (outside the wait that plans an arc), the player may answer statements on a 1–5 scale,
// from strongly disagree to strongly agree, and then see how each love interest answered the same statement. Their
// answers are written from their bibles by the Planning connection (S/minigames/quiz.ts) and are never sent with any
// other model call. How alike the player and a love interest are is counted here, with no model call.
import type { LiId } from "./api-types";

export const QUIZ_SCALE = [1, 2, 3, 4, 5] as const;
export type QuizScore = (typeof QUIZ_SCALE)[number];

export const isQuizScore = (value: unknown): value is QuizScore =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

/** How many new statements one refill writes, once the player has answered every one they can see. */
export const QUIZ_REFILL = 50;

/** A statement as the quiz serves it. */
export interface QuizStatementView {
  id: string;
  text: string;
  /** The player's own answer, once given; the first answer is final. */
  answer?: QuizScore;
  /** Each current love interest's answer, once written. */
  scores: Partial<Record<LiId, QuizScore>>;
}

/**
 * GET /runs/:run/quiz and POST /runs/:run/quiz/answer: the statements the player may see (an 18+ one only while Heat is
 * NSFW), split into those still open (in the order they are asked) and those answered, and what is being written.
 */
export interface QuizView {
  open: QuizStatementView[];
  answered: QuizStatementView[];
  /** New statements are being written: the player answered every one they can see. */
  refilling: boolean;
  /** Love interests' answers that are missing (an older story, someone new, Heat raised) are being written. */
  scoring: boolean;
}

/**
 * How alike the player and `li` answered, 0–100: the mean of 1 − |player − theirs| / 4 over the statements both
 * answered, so the same answer counts fully and opposite ends not at all. Null before there is one.
 */
export function quizAgreement(answered: readonly QuizStatementView[], li: LiId): number | null {
  let sum = 0;
  let count = 0;
  for (const statement of answered) {
    const theirs = statement.scores[li];
    if (!statement.answer || !theirs) continue;
    sum += 1 - Math.abs(statement.answer - theirs) / 4;
    count += 1;
  }
  return count ? Math.round((sum / count) * 100) : null;
}
