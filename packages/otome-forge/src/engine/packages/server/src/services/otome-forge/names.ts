// ──────────────────────────────────────────────
// Otome Forge: how a written name is matched to a person (S/art/cg.ts resolveCast, S/phone/replies.ts namedIn)
// ──────────────────────────────────────────────
// Kept apart from cg.ts so the phone's reply checks can use it without importing the art pipeline (and its prompts).

/** Titles and articles before (or inside) a name: "Lord Kai", "Il Dottore". */
export const TITLE_WORDS: ReadonlySet<string> = new Set(
  (
    "lord lady sir dame mr mrs ms miss dr doctor professor prof captain master mistress prince princess king queen " +
    "il la le the el al von van de di da"
  ).split(" "),
);
const HONORIFIC = /-(?:sama|san|kun|chan|dono|senpai|sensei|ssi|nim)$/u;

/**
 * Folded for matching: accents on Latin, Greek and Cyrillic letters dropped ("Inès" is "ines"), compatibility forms
 * unified, lower case. Marks in other scripts stay: a Devanagari vowel sign or a kana's dakuten makes another name.
 */
export const fold = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/([\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}])\p{M}+/gu, "$1")
    .normalize("NFKC")
    .toLowerCase();
/** A name's words, folded, without edge punctuation or an honorific suffix ("Kai-sama," is "kai"). A possessive stays. */
export const nameWords = (name: string) =>
  fold(name)
    .split(/\s+/u)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(HONORIFIC, ""))
    .filter(Boolean);
/** The words that name the person: without titles and articles, unless nothing else is left. */
export const coreOf = (words: readonly string[]) => {
  const core = words.filter((word) => !TITLE_WORDS.has(word));
  return core.length ? core : [...words];
};
/** A name's core words, folded: "Il Dottore" is ["dottore"], "Mr. Darcy" ["darcy"]. */
export const nameCore = (name: string) => coreOf(nameWords(name));
