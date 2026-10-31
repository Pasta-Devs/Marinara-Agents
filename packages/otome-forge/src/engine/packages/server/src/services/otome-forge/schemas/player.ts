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
  normalizeCutouts,
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
  cutouts: {},
  noticed: null,
});

/** What he noticed (P19). `look` is the outfit id she wore, or BASE_LOOK for her base look. */
const NoticedSchema = z.object({
  li: z.string().min(1).max(80),
  text: z.string().min(1).max(400),
  look: z.string().min(1).max(80),
  at: z.string(),
});

/** The persona's full authored story fields, as every protagonist block carries them, or "" without them. */
export function aboutLine(player: Pick<Player, "about">): string {
  const about = player.about?.trim();
  return about
    ? `Who they are (their persona): ${about}\nTreat these authored fields as the protagonist's canon; do not invent conflicting biography or permanent traits. When authoring the protagonist's dialogue, thoughts, reactions, choice-option intents/labels or performed choice selections, ground their voice, motives and behaviour in these fields. Keep choice options meaningfully distinct and preserve the player's agency; never override or rewrite an accepted choice to fit the persona.`
    : "";
}

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
      about: z.string().optional(),
      // A persona's own appearance is kept whole as the identity line (the player wrote it).
      look: z.object({ identityLine: z.string(), outfitLine: text() }),
      portrait: z.string().optional(),
      portraitRef: z.string().optional(),
      art: PaintSchema.optional(),
      outfits: (value) => validItems(OutfitSchema, value, OUTFITS_MAX),
      cutouts: normalizeCutouts,
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
