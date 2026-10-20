/**
 * Words that follow a page's gender, and the clothing style that follows it unless overridden.
 *
 * Pure. Gender is the discovery gender on the page (male, female, other); a page without one is
 * "they" (user, 2026-10-14), so an old Creator saved before gender was asked never reads as "she"
 * by default.
 */
export type SlpGender = "male" | "female" | "other";

/** What a Creator wears: lingerie or briefs, a dress or a suit. `auto` follows the page's gender. */
export const SLP_CLOTHING_STYLES = ["auto", "feminine", "masculine", "neutral"] as const;
export type SlpClothingStyle = (typeof SLP_CLOTHING_STYLES)[number];
export type SlpWear = Exclude<SlpClothingStyle, "auto">;

/** The style in use: the override, or the one the gender implies. A male Creator in lingerie sets `feminine`. */
export function slpWear(gender: string | null | undefined, style: SlpClothingStyle | null | undefined): SlpWear {
  if (style && style !== "auto") return style;
  return gender === "male" ? "masculine" : gender === "female" ? "feminine" : "neutral";
}

export type SlpGenderWords = {
  he: string;
  him: string;
  his: string;
  himself: string;
  /** Man, girl or one: "the new {man}". */
  man: string;
  boy: string;
  /** What a partner calls them: bf, gf or partner. */
  bf: string;
  boyfriend: string;
};

/** He/she/they and the words around them for one gender. */
export function slpGenderWords(gender: string | null | undefined): SlpGenderWords {
  if (gender === "male")
    return {
      he: "he",
      him: "him",
      his: "his",
      himself: "himself",
      man: "man",
      boy: "boy",
      bf: "bf",
      boyfriend: "boyfriend",
    };
  if (gender === "female")
    return {
      he: "she",
      him: "her",
      his: "her",
      himself: "herself",
      man: "girl",
      boy: "girl",
      bf: "gf",
      boyfriend: "girlfriend",
    };
  return {
    he: "they",
    him: "them",
    his: "their",
    himself: "themself",
    man: "one",
    boy: "one",
    bf: "partner",
    boyfriend: "partner",
  };
}

/** "he/him", "she/her" or "they/them", for a prompt line. */
export const slpPronouns = (gender: string | null | undefined): string => {
  const words = slpGenderWords(gender);
  return `${words.he}/${words.him}`;
};

/** The gender stored on an account's profile settings, or null. Engine-side account types do not declare it. */
export function slpAccountGender(account: { settings?: unknown }): SlpGender | null {
  const settings = account.settings as { profile?: { gender?: unknown } } | undefined;
  const gender = settings?.profile?.gender;
  return gender === "male" || gender === "female" || gender === "other" ? gender : null;
}
