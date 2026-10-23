import type { SlurpLiveMenuItem } from "./slp-live.js";

/** One rung of her tip menu: the words, how far up her price it sits, and whether it ends in a picture. */
type MenuRung = { label: string; weight: number; picture?: boolean; minLevel: number; words?: readonly string[] };

/**
 * Her tip menu, cheapest first. `minLevel` is the spice step that opens it (0 clean, 1 flirty,
 * 2 suggestive, 3 explicit), so a clean or flirty room never lists what she would not do. `words`
 * name the item's topic: an item whose topic is one of her hard-nos is left out.
 */
const MENU_RUNGS: readonly MenuRung[] = [
  { label: "Say my name 💬", weight: 0.3, minLevel: 0 },
  { label: "Blow a kiss to the camera 😘", weight: 0.4, minLevel: 0 },
  { label: "Pick my next song 🎵", weight: 0.5, minLevel: 0 },
  { label: "Slow spin for the camera", weight: 0.7, minLevel: 1, picture: true },
  { label: "Show off the outfit up close", weight: 0.8, minLevel: 1, picture: true, words: ["outfit"] },
  { label: "Whisper something naughty", weight: 0.9, minLevel: 1 },
  { label: "Lingerie reveal 🖤", weight: 1.2, minLevel: 2, picture: true, words: ["lingerie", "underwear"] },
  { label: "Lose the top", weight: 1.5, minLevel: 2, picture: true, words: ["nudity", "topless"] },
  { label: "Oil show ✨", weight: 1.8, minLevel: 2, picture: true, words: ["oil"] },
  { label: "Feet tease 👣", weight: 1.3, minLevel: 2, picture: true, words: ["feet", "toes"] },
  { label: "Fully nude for one song", weight: 2.2, minLevel: 3, picture: true, words: ["nudity"] },
  { label: "Toy show 🔥", weight: 2.8, minLevel: 3, picture: true, words: ["toys", "toy"] },
  { label: "Make me cum (finale)", weight: 3.5, minLevel: 3, picture: true, words: ["orgasm"] },
];

const blocked = (rung: MenuRung, hardNoes: readonly string[]) =>
  (rung.words ?? []).some((word) => hardNoes.some((no) => no.toLowerCase().includes(word)));

/**
 * 5 to 8 items for her level (fewer in a clean room), the ones that match her turn-ons first, priced from her PPV price.
 * `topics` are her turn-ons, `hardNoes` her hard-nos (both plain words from her spice settings).
 */
export function slurpLiveMenuItems(
  level: number,
  topics: readonly string[],
  ppvPrice = 25,
  hardNoes: readonly string[] = [],
): SlurpLiveMenuItem[] {
  const step = Math.max(0, Math.min(3, Math.floor(level)));
  const count = Math.min(8, 5 + step);
  const turnOn = (rung: MenuRung) =>
    (rung.words ?? []).some((word) => topics.some((topic) => topic.toLowerCase().includes(word)));
  const open = MENU_RUNGS.filter((rung) => rung.minLevel <= step && !blocked(rung, hardNoes));
  const picked = [...open.filter(turnOn), ...open.filter((rung) => !turnOn(rung))]
    .slice(0, count)
    .sort((a, b) => a.weight - b.weight);
  return picked.map((rung, index) => ({
    id: `item-${index + 1}`,
    label: rung.label,
    price: Math.max(1, Math.round(ppvPrice * rung.weight)),
    picture: rung.picture === true,
  }));
}
