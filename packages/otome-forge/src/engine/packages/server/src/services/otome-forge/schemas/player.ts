// ──────────────────────────────────────────────
// Otome Forge: the `${R}:player` document (the protagonist, from an Engine persona)
// ──────────────────────────────────────────────
import { z } from "zod";
import type { Player } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { BASE_LOOK } from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import {
  OUTFITS_MAX,
  OutfitSchema,
  PaintSchema,
  PronounsSchema,
  defaultPronouns,
  field,
  isRecord,
  readFields,
  readWornOutfit,
  text,
  validItems,
} from "./common.js";

export const PLAYER_TRAITS_MAX = 5;
export const PLAYER_GOAL_MAX = 300;

const defaultPlayer = (): Player => ({
  personaId: "",
  name: "",
  pronouns: defaultPronouns(),
  traits: [],
  goal: "",
  look: { identityLine: "", outfitLine: "" },
  outfits: [],
  noticed: null,
});

/** What he noticed (P19). `look` is the outfit id she wore, or BASE_LOOK for her base look. */
const NoticedSchema = z.object({
  li: z.string().min(1).max(80),
  text: z.string().min(1).max(400),
  look: z.string().min(1).max(80),
  at: z.string(),
});

export function normalizePlayer(data: unknown): Player {
  const player = readFields<Player>(
    {
      personaId: z.string(),
      name: z.string(),
      pronouns: PronounsSchema,
      traits: (value) =>
        (Array.isArray(value) ? value : [])
          .filter((trait): trait is string => typeof trait === "string")
          .slice(0, PLAYER_TRAITS_MAX),
      goal: z.string(),
      look: z.object({ identityLine: text(), outfitLine: text() }),
      portrait: z.string().optional(),
      portraitRef: z.string().optional(),
      art: PaintSchema.optional(),
      outfits: (value) => validItems(OutfitSchema, value, OUTFITS_MAX),
      wornOutfit: z.string().optional(),
      noticed: NoticedSchema.nullable(),
    },
    defaultPlayer,
    isRecord(data) ? data : undefined,
  );
  const { wornOutfit: _worn, ...rest } = player;
  const worn = readWornOutfit(player.outfits, field(data, "wornOutfit"));
  // A line about a look she no longer wears is not shown (a later wear writes a new one).
  const noticed = player.noticed && player.noticed.look === (worn ?? BASE_LOOK) ? player.noticed : null;
  return worn ? { ...rest, noticed, wornOutfit: worn } : { ...rest, noticed };
}
