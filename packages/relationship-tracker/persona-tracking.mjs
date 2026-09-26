import { MAX_RELATIONSHIP_DESCRIPTION_LENGTH, MAX_RELATIONSHIP_LABEL_LENGTH } from "./state.mjs";

export const PERSONA_TRACKING_INSTRUCTIONS = "Also track each assigned character's subjective perception of the active persona. Return a compact p array alongside u. Each p item is exactly [characterAlias,state,label,perception,colorCategory]. perception must begin with the character's natural name, name the persona, and describe only that character's subjective, possibly mistaken view. Never assert or invent the persona's thoughts, feelings, wants, intentions, dialogue, decisions, or actions. Omit unchanged and locked perceptions.";
const COLORS = new Set(["positive", "neutral", "negative", "complicated"]);
const compact = (value) => typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const mentions = (text, name) => new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegex(name)}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(text);
export class PersonaTrackingError extends Error {
  constructor(message) {
    super(message);
    this.name = "PersonaTrackingError";
  }
}
function fail(message) { throw new PersonaTrackingError(message); }

export function modelPersonaSnapshot(snapshot, allowedCharacters) {
  const aliases = new Map(allowedCharacters.map((entry) => [entry.characterId, entry.alias]));
  return snapshot.perceptions.map((entry) => {
    const alias = aliases.get(entry.characterId);
    if (!alias) fail("Persona baseline references an unknown character.");
    return [alias, entry.state, entry.label, entry.description, entry.colorCategory, entry.manuallyLocked];
  });
}

export function personaPreparedContext(snapshot, allowedCharacters) {
  if (!snapshot?.persona) return { activePersona: null, existingPersonaPerceptions: [], personaStateRevision: snapshot?.stateRevision ?? null };
  return {
    activePersona: { alias: "p0", id: snapshot.persona.id, name: snapshot.persona.name },
    existingPersonaPerceptions: modelPersonaSnapshot(snapshot, allowedCharacters),
    personaStateRevision: snapshot.stateRevision,
  };
}

export function normalizePersonaDelta(input, allowedCharacters, personaSnapshot, { evidenceText = "" } = {}) {
  if (!Array.isArray(input)) fail("Persona perception updates must be an array.");
  if (!personaSnapshot?.persona) return [];
  const byAlias = new Map(allowedCharacters.map((entry) => [entry.alias, entry]));
  const baseline = new Map(personaSnapshot.perceptions.map((entry) => [entry.characterId, entry]));
  const seen = new Set();
  const updates = [];
  for (const [index, tuple] of input.entries()) {
    if (!Array.isArray(tuple) || tuple.length !== 5) fail(`Persona update ${index + 1} must contain exactly five values.`);
    const [alias, state, rawLabel, rawDescription, colorCategory] = tuple;
    const character = byAlias.get(alias);
    if (!character) fail("Persona update references an unknown character alias.");
    if (seen.has(character.characterId)) fail("Persona result contains a duplicate character perception.");
    seen.add(character.characterId);
    if (state !== "defined" && state !== "undefined") fail("Persona perception state must be defined or undefined.");
    const label = compact(rawLabel);
    const description = compact(rawDescription);
    if (label !== rawLabel || description !== rawDescription || /[\r\n]/u.test(description)) fail("Persona perception prose must be trimmed and single-line.");
    if (state === "undefined") {
      if (label || description || colorCategory !== null) fail("Undefined persona perceptions require empty prose and null colorCategory.");
    } else {
      if (!label || label.length > MAX_RELATIONSHIP_LABEL_LENGTH || !description || description.length > MAX_RELATIONSHIP_DESCRIPTION_LENGTH || !COLORS.has(colorCategory)) {
        fail("Defined persona perception prose or color is invalid.");
      }
      if (!new RegExp(`^${escapeRegex(character.name)}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(description) || !mentions(description, personaSnapshot.persona.name)) {
        fail("Persona perception must begin with the character's name and name the active persona.");
      }
      const forbidden = /\b(?:the persona|the user)\s+(?:thinks|feels|wants|intends|decides|says|does|will)\b/iu;
      if (forbidden.test(description)) fail("Persona perception must not assert the persona's internal state or agency.");
    }
    const existing = baseline.get(character.characterId);
    if (existing?.manuallyLocked) continue;
    if (existing && existing.state === state && existing.label === label && existing.description === description && existing.colorCategory === colorCategory) continue;
    if (!compact(evidenceText)) continue;
    updates.push({ characterId: character.characterId, personaId: personaSnapshot.persona.id, state, label, description, colorCategory });
  }
  return updates;
}

export async function applyPersonaDelta(repository, chatId, input, context, stalePolicy) {
  const updates = normalizePersonaDelta(input, context.allowedCharacters, context.personaSnapshot, { evidenceText: context.evidenceText });
  const storedState = updates.length ? await repository.applyAutomaticPerceptions(chatId, updates, {
    expectedStateRevision: context.personaStateRevision,
    stalePolicy,
  }) : null;
  return { updates, storedState };
}
