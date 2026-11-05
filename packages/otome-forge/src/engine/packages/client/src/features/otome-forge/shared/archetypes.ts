// ──────────────────────────────────────────────
// Otome Forge: the six original archetypes a love interest can start from (design: Love Interests, setup step 3)
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles: the client's Cast step offers these ids (labelled through its own literal
// map of ui.otomeForge.* keys), and the server's world-plan and bible prompts read the English name and seed. Seeds
// are prompt text, never localized, and assume no gender: pronouns come from the player's pick for each character.

export const ARCHETYPE_IDS = [
  "brilliant-monster",
  "gilded-tyrant",
  "gentle-liar",
  "loyal-blade",
  "ruined-saint",
  "laughing-stranger",
] as const;
export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];

/** The English name and one-line seed each prompt receives. */
export const ARCHETYPES: Record<ArchetypeId, { name: string; seed: string }> = {
  "brilliant-monster": {
    name: "Brilliant Monster",
    seed: "A genius who treats people as experiments and feels nothing about it, until the protagonist becomes the one result they cannot predict.",
  },
  "gilded-tyrant": {
    name: "Gilded Tyrant",
    seed: "Power worn like silk: commands everyone, trusts no one, and is unsettled by how much the protagonist's defiance delights them.",
  },
  "gentle-liar": {
    name: "Gentle Liar",
    seed: "Kindness as camouflage: every soft word serves a hidden agenda, until one of them stops being a lie.",
  },
  "loyal-blade": {
    name: "Loyal Blade",
    seed: "Sworn to someone else's cause, deadly and dutiful; caring for the protagonist would mean breaking the oath that holds them together.",
  },
  "ruined-saint": {
    name: "Ruined Saint",
    seed: "Once revered, now fallen: a faith broken into something sharp, still kneeling to an ideal that failed them.",
  },
  "laughing-stranger": {
    name: "Laughing Stranger",
    seed: "A charming drifter who jokes past every question; the laughter covers the thing they ran from.",
  },
};

export function isArchetypeId(value: unknown): value is ArchetypeId {
  return typeof value === "string" && (ARCHETYPE_IDS as readonly string[]).includes(value);
}
