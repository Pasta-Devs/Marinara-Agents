// ──────────────────────────────────────────────
// Otome Forge: the scene card (plan §1.7, design: Character bible)
// ──────────────────────────────────────────────
// Every prompt except the planners' gets a love interest's scene card for the current stage instead of the bible:
// about 150–250 tokens, each list at most 3 items. A secret not yet revealed never appears on it, only its tells.
// The card starts with what M1 knows (the bible and the stage); each milestone adds its lines as their state appears
// (trust and tension, grievances, disclosures, learned tells). Prompt text: English, never localized.
// M5: the mask tells the protagonist has read right in Read Him (`tellsLearned`, indexes into bible.mask.tells) are a
// line of their own, so every later scene knows the protagonist can see through them.
import { estimateTextTokens, sliceTextToTokenBudget } from "@forge-kit/shared-token-estimator.mjs";
import type { ArcStageKey, RunState, Unit } from "../../../../client/src/features/otome-forge/shared/api-types.js";
import { stageRow } from "../../../../client/src/features/otome-forge/shared/arcs.js";

export const SCENE_CARD_MAX_TOKENS = 250;
const LIST_MAX = 3;
const NAME_MAX = 60;

export type SceneCardUnit = Pick<Unit, "name" | "pronouns" | "bible">;
/** `tellsLearned` is optional so a prompt that only knows the stage (a line pack) still builds a card. */
export type SceneCardState = Pick<RunState["lis"][string], "stage"> & { tellsLearned?: readonly number[] };

/** One line of text, at most `max` characters (by code point, cut at a word where there is one), no full stop. */
function clip(text: string, max: number): string {
  const value = text.replace(/\s+/g, " ").trim().replace(/\.+$/, "");
  const characters = [...value];
  if (characters.length <= max) return value;
  const cut = characters.slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > cut.length / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

interface Limits {
  list: number;
  scalar: number;
  item: number;
}

function render(unit: SceneCardUnit, stage: number, learnedTells: readonly number[], limits: Limits): string {
  const { pronouns } = unit;
  const header = `${clip(unit.name, NAME_MAX)} (${pronouns.subject}/${pronouns.object})`;
  const bible = unit.bible;
  if (!bible) return `${header}.`;
  const one = (text: string) => clip(text, limits.scalar);
  const list = (items: readonly string[]) =>
    items
      .map((item) => clip(item, limits.item))
      .filter(Boolean)
      .slice(0, limits.list)
      .join("; ");
  const sentence = (...parts: Array<[label: string, value: string]>) =>
    parts
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}${value}.`)
      .join(" ");
  const hidden = bible.secrets.filter((secret) => secret.revealAt.stage > stage).flatMap((secret) => secret.tells);
  const known = bible.secrets
    .filter((secret) => secret.revealAt.stage <= stage)
    .sort((a, b) => b.revealAt.stage - a.revealAt.stage)
    .map((secret) => secret.truth);
  // An index the bible no longer has (an edited bible) names nothing.
  const learned = learnedTells.map((index) => bible.mask.tells[index] ?? "").filter((tell) => tell.trim());
  const meta = stageRow(stage);
  const title = `${meta.name[0]!.toUpperCase()}${meta.name.slice(1)}`;
  return [
    `${header} — stage ${stage} (${title}). ${meta.balance}.`,
    sentence(
      ["Voice: ", one(bible.voice.register)],
      ["Never: ", list(bible.voice.never)],
      ["Care: ", one(bible.voice.careLanguage)],
      ["Anger: ", one(bible.voice.angerStyle)],
      ["Jealousy: ", one(bible.voice.jealousyStyle)],
    ),
    sentence(
      ["Wants from the protagonist now: ", one(bible.arc[String(stage) as ArcStageKey]?.wantsFromHer ?? "")],
      ["Own want, besides the protagonist: ", one(bible.want)],
    ),
    sentence(
      ["Mask: ", one(bible.mask.presents)],
      ["Tells (let them slip; never explain them): ", list(bible.mask.tells)],
    ),
    sentence(["The protagonist has learned to read these tells and may call them out: ", list(learned)]),
    sentence(["Hidden (never state it; it may show only as these tells): ", list(hidden)]),
    sentence(["The protagonist knows: ", list(known)]),
    sentence(["Red lines: ", list(bible.redLines)], ["Moral code: ", one(bible.moralCode)]),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The love interest's scene card at `liState.stage`. A secret revealed at a later stage shows only as its tells; one
 * revealed at this stage or earlier is something the protagonist knows. Until the card fits SCENE_CARD_MAX_TOKENS (the
 * kit's token estimate, so CJK text counts as it should), lists lose their last items, then every field shortens.
 */
export function otomeSceneCard(unit: SceneCardUnit, liState: SceneCardState): string {
  const stage = stageRow(liState.stage).stage;
  let limits: Limits = { list: LIST_MAX, scalar: 160, item: 100 };
  const learned = liState.tellsLearned ?? [];
  let card = render(unit, stage, learned, limits);
  while (estimateTextTokens(card) > SCENE_CARD_MAX_TOKENS && limits.item > 12) {
    limits =
      limits.list > 1
        ? { ...limits, list: limits.list - 1 }
        : { list: 1, scalar: Math.floor(limits.scalar * 0.85), item: Math.floor(limits.item * 0.85) };
    card = render(unit, stage, learned, limits);
  }
  return estimateTextTokens(card) > SCENE_CARD_MAX_TOKENS ? sliceTextToTokenBudget(card, SCENE_CARD_MAX_TOKENS) : card;
}
