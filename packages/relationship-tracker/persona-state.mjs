import {
  PACKAGE_ID,
  MAX_RELATIONSHIP_DESCRIPTION_LENGTH,
  MAX_RELATIONSHIP_LABEL_LENGTH,
  RelationshipStateError,
  characterCardName,
} from "./state.mjs";

export const PERSONA_STATE_SCHEMA_VERSION = 1;
export const PERSONA_STATE_DOCUMENT_KIND = "relationship-persona-state-v1";
const COLOR_CATEGORIES = new Set(["positive", "neutral", "negative", "complicated"]);
const ROOT_KEYS = ["schemaVersion", "chatId", "showPersona", "perceptions"];
const PERCEPTION_KEYS = ["characterId", "personaId", "state", "label", "description", "colorCategory", "manuallyLocked"];
const clone = (value) => structuredClone(value);
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const compareIds = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const compactText = (value) => typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

function fail(message, options) {
  throw new RelationshipStateError(message, options);
}
function requireRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object.`);
  return value;
}
function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail(`${label} must contain exactly: ${required.join(", ")}.`);
  }
}
function requireId(value, label) {
  if (typeof value !== "string" || !value) fail(`${label} must be a non-empty stable ID.`);
  return value;
}
function requireBriefText(value, label, maximum, { empty = false } = {}) {
  if (typeof value !== "string" || value !== value.trim() || /[\r\n]/u.test(value) || value.length > maximum || (!empty && !value)) {
    fail(`${label} must be a ${empty ? "possibly empty " : "non-empty "}trimmed single-line string of at most ${maximum} characters.`);
  }
  return value;
}
function personaName(persona) {
  let data = persona?.data;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { data = null; }
  }
  return compactText(isRecord(data) ? data.name : "");
}
function perceptionKey(value) {
  return JSON.stringify([value.characterId, value.personaId]);
}

export function normalizePersonaPerception(input, { allowedCharacterIds, expectedPersonaId } = {}) {
  const value = requireRecord(input, "Persona perception");
  requireExactKeys(value, PERCEPTION_KEYS, "Persona perception");
  const characterId = requireId(value.characterId, "characterId");
  const personaId = requireId(value.personaId, "personaId");
  if (allowedCharacterIds && !allowedCharacterIds.has(characterId)) fail("Persona perception references an unknown or unassigned character.", { code: "unknown_character_id" });
  if (expectedPersonaId !== undefined && personaId !== expectedPersonaId) fail("Persona perception does not reference the active chat persona.", { code: "wrong_persona_id" });
  if (value.state !== "defined" && value.state !== "undefined") fail("Persona perception state must be defined or undefined.");
  if (typeof value.manuallyLocked !== "boolean") fail("Persona perception manuallyLocked must be boolean.");
  const label = requireBriefText(value.label, "Persona perception label", MAX_RELATIONSHIP_LABEL_LENGTH, { empty: value.state === "undefined" });
  const description = requireBriefText(value.description, "Persona perception description", MAX_RELATIONSHIP_DESCRIPTION_LENGTH, { empty: value.state === "undefined" });
  if (value.state === "defined" && !COLOR_CATEGORIES.has(value.colorCategory)) fail("A defined persona perception requires a valid colorCategory.");
  if (value.state === "undefined" && (label || description || value.colorCategory !== null)) fail("An undefined persona perception must have empty prose and null colorCategory.");
  return { characterId, personaId, state: value.state, label, description, colorCategory: value.colorCategory, manuallyLocked: value.manuallyLocked };
}

export function normalizePersonaState(input, { expectedChatId } = {}) {
  const value = requireRecord(input, "Persona relationship state");
  requireExactKeys(value, ROOT_KEYS, "Persona relationship state");
  if (value.schemaVersion !== PERSONA_STATE_SCHEMA_VERSION) fail(`Persona state schemaVersion must be ${PERSONA_STATE_SCHEMA_VERSION}.`);
  const chatId = requireId(value.chatId, "chatId");
  if (expectedChatId !== undefined && chatId !== expectedChatId) fail("Persona state chatId does not match the requested chat.");
  if (typeof value.showPersona !== "boolean") fail("showPersona must be boolean.");
  if (!Array.isArray(value.perceptions)) fail("Persona perceptions must be an array.");
  const perceptions = value.perceptions.map((entry) => normalizePersonaPerception(entry));
  const keys = new Set();
  for (const perception of perceptions) {
    const key = perceptionKey(perception);
    if (keys.has(key)) fail("Persona state contains a duplicate character/persona perception.", { code: "duplicate_persona_perception" });
    keys.add(key);
  }
  perceptions.sort((left, right) => compareIds(left.personaId, right.personaId) || compareIds(left.characterId, right.characterId));
  return { schemaVersion: PERSONA_STATE_SCHEMA_VERSION, chatId, showPersona: value.showPersona, perceptions };
}

export function personaStateDocumentId(chatId) {
  return `${PACKAGE_ID}:persona-chat:${requireId(chatId, "chatId")}`;
}

export function createPersonaStateRepository(runtime) {
  const persistence = runtime?.persistence;
  const documents = persistence?.documents;
  const resources = runtime?.resources;
  if (typeof persistence?.getChat !== "function" || typeof persistence?.withChatLock !== "function" ||
      typeof documents?.getById !== "function" || typeof documents?.create !== "function" || typeof documents?.update !== "function" ||
      typeof resources?.listCharacters !== "function" || typeof resources?.listPersonas !== "function") {
    throw new Error("Relationship Tracker persona support requires chat, document, character, and persona package APIs.");
  }

  async function resolveScope(chatId) {
    const chat = await persistence.getChat(requireId(chatId, "chatId"));
    if (!chat) fail("Chat not found.", { code: "chat_not_found", statusCode: 404 });
    if (chat.mode !== "roleplay") fail("Persona relationships are available only for Roleplay chats.", { code: "wrong_chat_mode" });
    const characters = chat.characterIds.length ? await resources.listCharacters(chat.characterIds) : [];
    const allowed = new Set(chat.characterIds);
    const eligibleCharacters = characters.filter((character) => allowed.has(character.id));
    const personaId = typeof chat.personaId === "string" && chat.personaId ? chat.personaId : null;
    const personas = personaId ? await resources.listPersonas([personaId]) : [];
    const persona = personas.find((entry) => entry.id === personaId) ?? null;
    return { chat, characters: eligibleCharacters, allowedCharacterIds: new Set(eligibleCharacters.map((entry) => entry.id)), persona };
  }

  async function readDocument(chatId) {
    const document = await documents.getById(PACKAGE_ID, personaStateDocumentId(chatId));
    if (!document) return null;
    if (document.kind !== PERSONA_STATE_DOCUMENT_KIND) fail("Stored persona relationship state has the wrong document kind.", { code: "corrupt_persona_state", statusCode: 500 });
    try {
      return { state: normalizePersonaState(document.data, { expectedChatId: chatId }), revision: document.revision };
    } catch (error) {
      if (error instanceof RelationshipStateError) fail(`Stored persona relationship state is invalid: ${error.message}`, { code: "corrupt_persona_state", statusCode: 500 });
      throw error;
    }
  }

  async function writeState(state, expectedRevision) {
    const normalized = normalizePersonaState(state);
    const id = personaStateDocumentId(normalized.chatId);
    const current = await documents.getById(PACKAGE_ID, id);
    if (expectedRevision !== undefined && (current?.revision ?? null) !== expectedRevision) return null;
    const timestamp = new Date().toISOString();
    const write = { id, packageId: PACKAGE_ID, name: normalized.chatId, description: "Relationship Tracker persona state v1", data: clone(normalized), updatedAt: timestamp };
    const saved = current
      ? await documents.update({ ...write, expectedRevision: current.revision })
      : await documents.create({ ...write, kind: PERSONA_STATE_DOCUMENT_KIND, createdAt: timestamp });
    if (!saved) fail("Persona relationship state changed concurrently; retry the operation.", { code: "persona_state_conflict", statusCode: 409 });
    return clone(normalized);
  }

  async function getSnapshot(chatId) {
    const scope = await resolveScope(chatId);
    const stored = await readDocument(chatId);
    const activePersonaId = scope.persona?.id ?? null;
    const perceptions = stored?.state.perceptions.filter((entry) => entry.personaId === activePersonaId && scope.allowedCharacterIds.has(entry.characterId)) ?? [];
    return {
      chatId,
      persona: scope.persona ? { id: scope.persona.id, name: personaName(scope.persona) } : null,
      characters: clone(scope.characters),
      allowedCharacterIds: new Set(scope.allowedCharacterIds),
      showPersona: stored?.state.showPersona ?? true,
      perceptions: clone(perceptions),
      allPerceptions: clone(stored?.state.perceptions ?? []),
      stateRevision: stored?.revision ?? null,
    };
  }

  async function ensureState(chatId) {
    return persistence.withChatLock(chatId, async () => {
      const current = await readDocument(chatId);
      if (current) return current.state;
      return writeState({ schemaVersion: 1, chatId, showPersona: true, perceptions: [] });
    });
  }

  async function updateVisibility(chatId, showPersona) {
    if (typeof showPersona !== "boolean") fail("showPersona must be boolean.");
    return persistence.withChatLock(chatId, async () => {
      await resolveScope(chatId);
      const current = await readDocument(chatId);
      const state = current?.state ?? { schemaVersion: 1, chatId, showPersona: true, perceptions: [] };
      if (state.showPersona === showPersona) return clone(state);
      return writeState({ ...state, showPersona });
    });
  }

  async function updateManualPerception(chatId, input) {
    return persistence.withChatLock(chatId, async () => {
      const scope = await resolveScope(chatId);
      if (!scope.persona) fail("This chat has no active persona.", { code: "active_persona_required", statusCode: 409 });
      const current = await readDocument(chatId);
      const state = current?.state ?? { schemaVersion: 1, chatId, showPersona: true, perceptions: [] };
      const normalizedInput = isRecord(input) && !Object.hasOwn(input, "manuallyLocked") ? { ...input, manuallyLocked: true } : input;
      const perception = normalizePersonaPerception(normalizedInput, { allowedCharacterIds: scope.allowedCharacterIds, expectedPersonaId: scope.persona.id });
      const records = new Map(state.perceptions.map((entry) => [perceptionKey(entry), entry]));
      records.set(perceptionKey(perception), perception);
      return writeState({ ...state, perceptions: [...records.values()] });
    });
  }

  async function resumeAutomaticPerception(chatId, input) {
    const value = requireRecord(input, "Persona perception identity");
    requireExactKeys(value, ["characterId", "personaId"], "Persona perception identity");
    return persistence.withChatLock(chatId, async () => {
      const scope = await resolveScope(chatId);
      if (!scope.persona || value.personaId !== scope.persona.id || !scope.allowedCharacterIds.has(value.characterId)) fail("Persona perception is not eligible in this chat.");
      const current = await readDocument(chatId);
      if (!current) fail("Persona perception not found.", { code: "persona_perception_not_found", statusCode: 404 });
      const index = current.state.perceptions.findIndex((entry) => entry.characterId === value.characterId && entry.personaId === value.personaId);
      if (index < 0) fail("Persona perception not found.", { code: "persona_perception_not_found", statusCode: 404 });
      const perceptions = clone(current.state.perceptions);
      perceptions[index].manuallyLocked = false;
      return writeState({ ...current.state, perceptions });
    });
  }

  async function applyAutomaticPerceptions(chatId, proposed, { expectedStateRevision, stalePolicy }) {
    if (!Array.isArray(proposed) || (stalePolicy !== "skip" && stalePolicy !== "reject")) fail("Automatic persona update options are invalid.");
    return persistence.withChatLock(chatId, async () => {
      const scope = await resolveScope(chatId);
      if (!scope.persona) return null;
      const current = await readDocument(chatId);
      const state = current?.state ?? { schemaVersion: 1, chatId, showPersona: true, perceptions: [] };
      if ((current?.revision ?? null) !== expectedStateRevision) {
        if (stalePolicy === "reject") fail("Persona state changed while the model was running; retry the operation.", { code: "persona_state_stale", statusCode: 409 });
        return clone(state);
      }
      const records = new Map(state.perceptions.map((entry) => [perceptionKey(entry), entry]));
      for (const input of proposed) {
        const perception = normalizePersonaPerception({ ...input, manuallyLocked: false }, { allowedCharacterIds: scope.allowedCharacterIds, expectedPersonaId: scope.persona.id });
        const key = perceptionKey(perception);
        if (records.get(key)?.manuallyLocked) continue;
        records.set(key, perception);
      }
      const next = normalizePersonaState({ ...state, perceptions: [...records.values()] });
      if (JSON.stringify(next) === JSON.stringify(state)) return clone(state);
      return writeState(next, current?.revision ?? null);
    });
  }

  return Object.freeze({ getSnapshot, ensureState, updateVisibility, updateManualPerception, resumeAutomaticPerception, applyAutomaticPerceptions });
}

export { personaName, characterCardName };
