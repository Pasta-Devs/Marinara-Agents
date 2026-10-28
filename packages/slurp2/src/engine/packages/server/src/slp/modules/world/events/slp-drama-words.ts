/**
 * Words in drama pack text: a role's name ("{her}"), their he/she/they words ("{her:he}"), and the
 * words about the player ("{you-bf}"). Pure.
 */
import { slpGenderWords } from "../../../../../../shared/src/slp/slp-gender.js";
import type { SlpDramaCreator } from "./slp-drama-runtime.js";

/**
 * Words about the player in pack text, from their page's gender: "{you-bf}" is bf, gf or partner,
 * "{you-man}" man, girl or one, "{you-him}", "{you-he}", "{you-boy}". None: the neutral words.
 */
export function slpDramaPlayerWords(player: Pick<SlpDramaCreator, "gender"> | undefined): Record<string, string> {
  const words = slpGenderWords(player?.gender);
  return {
    "you-bf": words.bf,
    "you-man": words.man,
    "you-boy": words.boy,
    "you-him": words.him,
    "you-he": words.he,
  };
}

/**
 * Words about one cast role, from that Creator's gender: "{her:he}" is he, she or they for whoever
 * plays `her`, and "{her:his}", "{her:him}", "{her:himself}", "{her:man}", "{her:bf}" likewise.
 * A role key is only a name; a man can play `her`.
 */
export function slpDramaRoleWords(key: string, creator: Pick<SlpDramaCreator, "gender">): Record<string, string> {
  return Object.fromEntries(
    Object.entries(slpGenderWords(creator.gender)).map(([word, value]) => [`${key}:${word}`, value]),
  );
}

/**
 * `{role}` in pack text becomes that role's name, `{role:he}` one of their words (see
 * `slpDramaRoleWords`); `{role:He}` starts a sentence. Unknown roles stay as they are.
 */
export function slpDramaText(text: string, names: Readonly<Record<string, string>>): string {
  return text.replace(/\{([a-z][a-z0-9-]*)(?::([A-Za-z]+))?\}/gu, (whole, role: string, word?: string) => {
    if (!word) return names[role] ?? whole;
    const value = names[`${role}:${word.toLocaleLowerCase()}`];
    if (value === undefined) return whole;
    return word[0] === word[0]!.toLocaleUpperCase() ? value[0]!.toLocaleUpperCase() + value.slice(1) : value;
  });
}
