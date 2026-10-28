import { sanitizeForPrompt } from "./turn-context";

export interface StoryEvidenceMessage {
  role: string;
  characterId: string | null;
  content: string;
}

/**
 * Preserves agency when transcript history becomes model evidence. Plain joined message bodies
 * erase whether the user, a character, or narration established a fact.
 */
export function projectStoryEvidence(
  messages: StoryEvidenceMessage[],
  names: { personaName?: string; characterNames?: ReadonlyMap<string, string> } = {},
) {
  return messages.map((message) => {
    const characterName = message.characterId ? names.characterNames?.get(message.characterId) : undefined;
    const speaker = message.role === "user"
      ? `USER${names.personaName ? ` (${sanitizeForPrompt(names.personaName, 40)})` : ""}`
      : message.role === "narrator"
        ? "NARRATOR"
        : characterName
          ? `CHARACTER (${sanitizeForPrompt(characterName, 40)})`
          : message.role === "assistant"
            ? "CHARACTER (unresolved)"
            : `RECORD (${sanitizeForPrompt(message.role, 24) || "unknown"})`;
    return `${speaker}: ${message.content}`;
  });
}
