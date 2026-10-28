// ──────────────────────────────────────────────
// Otome Forge: the `${R}:player` document (the protagonist, from an Engine persona)
// ──────────────────────────────────────────────
import { z } from "zod";
import type { Player } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { PaintSchema, PronounsSchema, defaultPronouns, isRecord, readFields, text } from "./common.js";

export const PLAYER_TRAITS_MAX = 5;
export const PLAYER_GOAL_MAX = 300;

const defaultPlayer = (): Player => ({
  personaId: "",
  name: "",
  pronouns: defaultPronouns(),
  traits: [],
  goal: "",
  look: { identityLine: "", outfitLine: "" },
});

export function normalizePlayer(data: unknown): Player {
  return readFields<Player>(
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
    },
    defaultPlayer,
    isRecord(data) ? data : undefined,
  );
}
