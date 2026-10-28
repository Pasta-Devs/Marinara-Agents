// ──────────────────────────────────────────────
// Otome Forge: the checks a love interest's bible must pass (plan M1 "Bible")
// ──────────────────────────────────────────────
// BibleSchema (S/schemas/unit.ts) checks the shape; checkBible checks what needs the whole bible. It is generateJson's
// `normalize` for the bible step, so a failure there sends the one repair turn and then fails the step, and the bible
// editor route runs it on every edit. Love interests are always adults and never in a school or student role.
import type { Bible, LiId, Pronouns } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  MASK_TELLS_MIN,
  MIN_AGE,
  SCHOOL_ROLE,
  WOUND_STAGE,
} from "../../../../../client/src/features/otome-forge/shared/bible.js";

export interface BibleContext {
  /** The pronouns the player picked for him; the bible always carries these. */
  pronouns?: Pronouns;
  /** The run's other love interests: web rows are kept only for these, keyed by id (a row keyed by name is moved). */
  others?: ReadonlyArray<{ id: LiId; name: string }>;
}

/** The bible made consistent with its love interest, or the reason it is refused (a string the model is shown). */
export function checkBible(bible: Bible, { pronouns, others }: BibleContext = {}): Bible | string {
  if (!(bible.age >= MIN_AGE)) return `age must be ${MIN_AGE} or older; this love interest is an adult`;
  if (SCHOOL_ROLE.test(bible.role)) {
    return `role must be an adult role, never a school or student role (got "${bible.role.slice(0, 80)}")`;
  }
  // Counted as the editor saves them (trimmed, blank ones dropped); the schema already caps how many there are.
  const tells = bible.mask.tells.map((tell) => tell.trim()).filter(Boolean);
  if (tells.length < MASK_TELLS_MIN) return `mask.tells must hold at least ${MASK_TELLS_MIN} non-blank tells`;
  if (!bible.secrets.some((secret) => secret.revealAt.stage === WOUND_STAGE)) {
    return `at least one secret must have revealAt.stage ${WOUND_STAGE} (the Wound)`;
  }

  const ids = new Set<string>();
  const secrets = bible.secrets.map((secret, index) => {
    let id = secret.id.trim() || `secret-${index + 1}`;
    while (ids.has(id)) id = `${id}-${index + 1}`;
    ids.add(id);
    return { ...secret, id };
  });

  let web = bible.web;
  if (others) {
    const byName = new Map(others.map((other) => [other.name.trim().toLowerCase(), other.id]));
    const known = new Set(others.map((other) => other.id));
    web = {};
    for (const [key, row] of Object.entries(bible.web)) {
      const id = known.has(key) ? key : byName.get(key.trim().toLowerCase());
      if (id && !web[id]) web[id] = row;
    }
  }
  return { ...bible, ...(pronouns ? { pronouns } : {}), mask: { ...bible.mask, tells }, secrets, web };
}
