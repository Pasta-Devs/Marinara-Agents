// ──────────────────────────────────────────────
// Otome Forge: a love interest's five faces (plan M2a "Faces") and whose line it is, shared by the narrator and the
// reader
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles. A dialogue or thought line may name one face; an untagged line shows his
// plain portrait. The narrator's prompt lists these names, the reader passes them to the kit's
// forgeStoryExpressionArt(names), and M2b paints each face as an edit of his look from the English description below
// (prompt text, never localized; the client labels faces through its own literal map of ui.otomeForge.* keys).

export const FACES = ["tender", "flustered", "cold", "hurt", "angry"] as const;
export type Face = (typeof FACES)[number];

/** Each face's edit look: [the sentence for natural-language prompts, the tags for tag prompts]. */
export const FACE_LOOKS: Record<Face, [sentence: string, tags: string]> = {
  tender: ["a tender expression: softened eyes, a faint warm smile", "gentle smile, soft eyes"],
  flustered: [
    "a flustered expression: blushing cheeks, eyes glancing away, lips pressed together",
    "blush, looking away, pressed lips",
  ],
  cold: ["a cold expression: a level, unimpressed stare, a still mouth", "expressionless, cold stare, closed mouth"],
  hurt: ["a hurt expression: drawn brows, glassy eyes, a tight mouth", "hurt, teary eyes, furrowed brows"],
  // Gacha Forge's anger look (forge-kit story-expressions-server forgeExpressionLooks.anger).
  angry: ["an angry expression: furrowed brows, narrowed glaring eyes, a tense jaw", "angry, furrowed brows, glaring"],
};

export function isFace(value: unknown): value is Face {
  return typeof value === "string" && (FACES as readonly string[]).includes(value);
}

/** The six soundtrack cues a beat may ask for. */
export const MUSIC_MOODS = ["home", "date", "tender", "tense", "angst", "confession"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

const nameKey = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, " ").trim();
const firstName = (value: string) => nameKey(value).split(" ")[0] ?? "";

/**
 * True when a line's `speaker` names `name`: the whole name, or just its first word ("Ilvar" for "Ilvar Thorne"). The
 * server checks a reply's thoughts with the same match the reader shows them with, so no line escapes the rules.
 */
export function sameName(speaker: string, name: string): boolean {
  const key = nameKey(speaker);
  return !!key && (key === nameKey(name) || key === firstName(name));
}
