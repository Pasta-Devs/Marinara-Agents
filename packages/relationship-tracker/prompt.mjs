import { characterCardName, normalizeRelationshipState } from "./state.mjs";

const compareIds = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const compactText = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();
const escapeRegularExpression = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

function assignedCharacterIdentity(character) {
  const characterId = typeof character?.id === "string"
    ? character.id
    : typeof character?.characterId === "string"
      ? character.characterId
      : "";
  const name = characterCardName(character, "");
  return { characterId, name };
}

function buildUniqueNameMatchers(characters, allowedCharacterIds) {
  if (!Array.isArray(characters)) throw new Error("Relationship presence requires an assigned-character array.");
  const candidatesByName = new Map();
  for (const character of characters) {
    const candidate = assignedCharacterIdentity(character);
    if (!candidate.characterId || !allowedCharacterIds.has(candidate.characterId) || !candidate.name) continue;
    const normalizedName = candidate.name.toLowerCase();
    candidatesByName.set(normalizedName, candidatesByName.has(normalizedName) ? null : candidate);
  }
  return [...candidatesByName.values()]
    .filter(Boolean)
    .map((candidate) => ({
      characterId: candidate.characterId,
      matcher: new RegExp(
        `(^|[^\\p{L}\\p{N}_])${escapeRegularExpression(candidate.name)}(?=$|[^\\p{L}\\p{N}_])`,
        "iu",
      ),
    }));
}

export function detectPresentCharacterIds(messages, allowedCharacterIds, lookbackMessages, characters = []) {
  if (!Array.isArray(messages)) throw new Error("Relationship presence requires a message array.");
  if (!(allowedCharacterIds instanceof Set)) throw new Error("Relationship presence requires an allowed character-ID set.");
  if (!Number.isInteger(lookbackMessages) || lookbackMessages < 1) {
    throw new Error("Relationship presence lookback must be a positive integer.");
  }
  const nameMatchers = buildUniqueNameMatchers(characters, allowedCharacterIds);
  const recent = messages
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .slice(-lookbackMessages);
  const present = new Set();
  for (const message of recent) {
    if (typeof message?.characterId === "string" && allowedCharacterIds.has(message.characterId)) present.add(message.characterId);
    if (Array.isArray(message?.characterIds)) {
      for (const characterId of message.characterIds) {
        if (typeof characterId === "string" && allowedCharacterIds.has(characterId)) present.add(characterId);
      }
    }
    if (message?.role !== "assistant") continue;
    const responseText = compactText(message?.content);
    if (!responseText) continue;
    for (const candidate of nameMatchers) {
      if (candidate.matcher.test(responseText)) present.add(candidate.characterId);
    }
  }
  return [...present].sort(compareIds);
}

export function selectPromptRelationships(state, messages = [], characters = []) {
  const valid = normalizeRelationshipState(state);
  const defined = valid.relationships.filter((relationship) => relationship.state === "defined");
  if (valid.injectionMode === "all") return defined;
  const allowedCharacterIds = new Set(defined.flatMap((relationship) => [relationship.characterAId, relationship.characterBId]));
  const presentCharacterIds = new Set(detectPresentCharacterIds(messages, allowedCharacterIds, valid.presenceLookbackMessages, characters));
  return defined.filter((relationship) => presentCharacterIds.has(relationship.characterAId) && presentCharacterIds.has(relationship.characterBId));
}

function naturalizeLegacyProse(value, names) {
  let text = compactText(value);
  const characters = [...names].sort(([leftId], [rightId]) => rightId.length - leftId.length);
  for (const [characterId, name] of characters) text = text.split(characterId).join(name);
  return text.replace(/\[character-card-id:[^\]]+\]/gu, "").replace(/\s+/gu, " ").trim();
}

function finishSentence(value) {
  if (!value) return "";
  return /[.!?…]$/u.test(value) ? value : `${value}.`;
}

function explicitPromptEntry(relationship, names) {
  const left = names.get(relationship.characterAId);
  const right = names.get(relationship.characterBId);
  if (!left || !right) throw new Error("Relationship prompt requires natural names for both assigned character cards.");
  const title = naturalizeLegacyProse(relationship.label, names) || "Defined";
  const description = finishSentence(naturalizeLegacyProse(relationship.description, names));
  const explanation = description || finishSentence(`${left} and ${right} are ${title.toLocaleLowerCase()}`);
  return `${left} and ${right} relationship: ${title} — ${explanation}`;
}

function characterNames(characters) {
  return new Map(
    (Array.isArray(characters) ? characters : [])
      .filter((character) => typeof character?.id === "string")
      .map((character) => [character.id, characterCardName(character, "")])
      .filter(([, name]) => name),
  );
}

export function serializeRelationshipPrompt(relationships, characters) {
  if (!Array.isArray(relationships) || relationships.length === 0) return null;
  const names = characterNames(characters);
  const entries = relationships.map((relationship) => explicitPromptEntry(relationship, names));
  return `Relationships: ${entries.join(" | ")}`;
}

export function selectPromptPersonaPerceptions(personaSnapshot, relationshipState, messages = [], characters = []) {
  if (!personaSnapshot?.persona || !Array.isArray(personaSnapshot.perceptions)) return [];
  const defined = personaSnapshot.perceptions.filter((entry) => entry.state === "defined");
  if (relationshipState?.injectionMode === "all") return defined;
  const allowedCharacterIds = new Set(defined.map((entry) => entry.characterId));
  const lookback = relationshipState?.presenceLookbackMessages ?? 15;
  const present = new Set(detectPresentCharacterIds(messages, allowedCharacterIds, lookback, characters));
  return defined.filter((entry) => present.has(entry.characterId));
}

export function serializePersonaPerceptionPrompt(perceptions, persona, characters) {
  if (!persona || !Array.isArray(perceptions) || perceptions.length === 0) return null;
  const names = characterNames(characters);
  const entries = perceptions.map((entry) => {
    const characterName = names.get(entry.characterId);
    if (!characterName) throw new Error("Persona perception prompt requires the assigned character's natural name.");
    const label = compactText(entry.label) || "Defined";
    return `${characterName} → ${persona.name}: ${label} — ${finishSentence(compactText(entry.description))}`;
  });
  return `Character perceptions of the active persona (subjective and possibly mistaken): ${entries.join(" | ")} Do not use these perceptions to define or control the persona's thoughts, feelings, dialogue, decisions, intentions, or actions.`;
}
