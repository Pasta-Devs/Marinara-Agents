// ──────────────────────────────────────────────
// Otome Forge: the rules a love interest's bible keeps (plan M1 "Bible"), shared by the server and the bible editor
// ──────────────────────────────────────────────
// The server is the authority: S/schemas/unit.ts (BibleSchema) and S/setup/bible.ts (checkBible) build on these, and
// check every rule again. The editor checks the same rules before it saves, so the player sees which one an edit breaks.
import type { Bible } from "./api-types";

/** Love interests are always adults. */
export const MIN_AGE = 18;
export const SCHOOL_ROLE = /\b(student|pupil|school(girl|boy)?|high school|teen)/i;
/** The Wound: the stage whose gate reveals a secret (plan §1.11). */
export const WOUND_STAGE = 4;
/** Month and day, MM-DD. */
export const BIRTHDAY_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const MASK_TELLS_MIN = 3;
export const MASK_TELLS_MAX = 5;
export const SECRET_TELLS_MAX = 6;
export const SECRETS_MIN = 1;
export const SECRETS_MAX = 8;

export type BibleProblem =
  "age" | "pronouns" | "birthday" | "role" | "maskTells" | "secrets" | "secretTells" | "woundSecret";

/** The first rule the bible breaks, with its lists as they are saved (blank lines dropped), or null. */
export function bibleProblem(bible: Bible): BibleProblem | null {
  if (!Number.isInteger(bible.age) || bible.age < MIN_AGE) return "age";
  const { subject, object, possessive } = bible.pronouns;
  if (![subject, object, possessive].every((pronoun) => pronoun.trim())) return "pronouns";
  if (!BIRTHDAY_PATTERN.test(bible.birthday)) return "birthday";
  if (SCHOOL_ROLE.test(bible.role)) return "role";
  if (bible.mask.tells.length < MASK_TELLS_MIN || bible.mask.tells.length > MASK_TELLS_MAX) return "maskTells";
  if (bible.secrets.length < SECRETS_MIN || bible.secrets.length > SECRETS_MAX) return "secrets";
  if (bible.secrets.some((secret) => secret.tells.length > SECRET_TELLS_MAX)) return "secretTells";
  if (!bible.secrets.some((secret) => secret.revealAt.stage === WOUND_STAGE)) return "woundSecret";
  return null;
}
