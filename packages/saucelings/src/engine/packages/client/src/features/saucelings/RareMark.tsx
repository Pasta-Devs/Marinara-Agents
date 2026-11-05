import {
  SEASONAL_SPECIES,
  SPECIAL_SPECIES,
  type SaucelingDesign,
  type SaucelingSpeciesId,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { useSaucelingsTranslation } from "./localization.js";

type Rare = "special" | "halloween";

/** A built-in special's or October species' rarity; null for the rest and for anything invented by its caretaker. */
export function rareKind(pet: { species: SaucelingSpeciesId; design: SaucelingDesign | null }): Rare | null {
  if (pet.design) return null;
  if ((SPECIAL_SPECIES as readonly SaucelingSpeciesId[]).includes(pet.species)) return "special";
  if ((SEASONAL_SPECIES as readonly SaucelingSpeciesId[]).includes(pet.species)) return "halloween";
  return null;
}

/** 9 x 9 art pixels, one letter per colour: a gold star, and a pumpkin. */
const MARKS: Record<Rare, { rows: string[]; colours: Record<string, string> }> = {
  special: {
    rows: [
      "....K....",
      "...KYK...",
      "KKKKYKKKK",
      "KYYYWYYYK",
      ".KYYYYYK.",
      "..KYYYK..",
      ".KYYKYYK.",
      ".KYK.KYK.",
      ".KK...KK.",
    ],
    colours: { K: "#4a2c0a", Y: "#ffd84a", W: "#fff6c2" },
  },
  halloween: {
    rows: [
      ".....gg..",
      "....gG...",
      ".KKKgKKK.",
      "KOOoOoOOK",
      "KOOoOoOOK",
      "KOOoOoOOK",
      "KOOoOoOOK",
      ".KOOOOOK.",
      "..KKKKK..",
    ],
    colours: { K: "#5a2008", O: "#ff8a28", o: "#c95212", g: "#2f5e1e", G: "#7fd35a" },
  },
};

/** Each mark as runs of one colour along a row. */
const RUNS = Object.fromEntries(
  Object.entries(MARKS).map(([rare, { rows, colours }]) => [
    rare,
    rows.flatMap((row, y) =>
      [...row.matchAll(/([^.])\1*/gu)].map((run) => ({ x: run.index, y, w: run[0].length, fill: colours[run[1]] })),
    ),
  ]),
) as Record<Rare, Array<{ x: number; y: number; w: number; fill: string }>>;

/** The pixel mark beside a rare sauceling's name, two screen pixels per art pixel; nothing for the rest. `labelled`
 *  says what it means to a screen reader, for a name that has no label of its own. */
export function RareMark({
  pet,
  labelled = true,
}: {
  pet: { species: SaucelingSpeciesId; design: SaucelingDesign | null };
  labelled?: boolean;
}) {
  const { t } = useSaucelingsTranslation();
  const rare = rareKind(pet);
  if (!rare) return null;
  return (
    <svg
      className="sl-rare-mark"
      viewBox="0 0 9 9"
      width="18"
      height="18"
      shapeRendering="crispEdges"
      {...(labelled ? { role: "img", "aria-label": t(`saucelings.pet.rare.${rare}`) } : { "aria-hidden": true })}
    >
      {RUNS[rare].map((run) => (
        <rect key={`${run.x},${run.y}`} x={run.x} y={run.y} width={run.w} height={1} fill={run.fill} />
      ))}
    </svg>
  );
}
