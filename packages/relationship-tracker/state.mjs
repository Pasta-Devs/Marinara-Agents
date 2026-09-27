export const PACKAGE_ID = "relationship-tracker";
export const STATE_SCHEMA_VERSION = 1;
export const READ_API_VERSION = 1;
export const STATE_DOCUMENT_KIND = "relationship-chat-state-v1";
export const DEFAULT_PRESENCE_LOOKBACK_MESSAGES = 15;
export const MAX_RELATIONSHIP_LABEL_LENGTH = 80;
export const MAX_RELATIONSHIP_DESCRIPTION_LENGTH = 240;

const STATE_KEYS = [
  "schemaVersion",
  "chatId",
  "injectionMode",
  "presenceLookbackMessages",
  "presentCharacterIds",
  "relationships",
];
const RELATIONSHIP_KEYS = [
  "characterAId",
  "characterBId",
  "state",
  "label",
  "description",
  "colorCategory",
  "manuallyLocked",
];
const SETTINGS_KEYS = ["injectionMode", "presenceLookbackMessages"];
const MANUAL_RELATIONSHIP_KEYS = [
  "characterAId",
  "characterBId",
  "state",
  "label",
  "description",
  "colorCategory",
  "manuallyLocked",
];
const COLOR_CATEGORIES = new Set(["positive", "neutral", "negative", "complicated"]);
const INJECTION_MODES = new Set(["all", "sceneOnly"]);

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const compareIds = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const clone = (value) => structuredClone(value);
const compactText = (value) => typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

function namePattern(name, flags = "iu") {
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegex(name)}(?=$|[^\\p{L}\\p{N}_])`, flags);
}

function countExactName(text, name) {
  let count = 0;
  const matcher = namePattern(name, "giu");
  while (matcher.exec(text)) count += 1;
  return count;
}

export function relationshipDescriptionIssue(description, pair, characterNames) {
  const text = compactText(description);
  if (!text) return "must not be empty";
  if (!/[.!?…]$/u.test(text)) return "must end with sentence punctuation";
  if (!(characterNames instanceof Map)) return "requires the current natural character names";
  const left = compactText(characterNames.get(pair?.characterAId));
  const right = compactText(characterNames.get(pair?.characterBId));
  if (!left || !right) return "requires natural names for both referenced characters";
  if (left.toLocaleLowerCase() === right.toLocaleLowerCase()) {
    if (countExactName(text, left) < 2) return `must name both referenced characters as ${left}`;
  } else if (countExactName(text, left) < 1 || countExactName(text, right) < 1) {
    return `must explicitly name both ${left} and ${right}`;
  }
  const clauses = text.replace(/[.!?…]$/u, "").split(";").map(compactText);
  if (clauses.length !== 2 || clauses.some((clause) => !clause)) {
    return "must contain exactly two semicolon-separated perspective clauses";
  }
  const startsWithName = (clause, name) => new RegExp(`^${escapeRegex(name)}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(clause);
  if (!startsWithName(clauses[0], left) || !startsWithName(clauses[1], right)) {
    return `must start its first clause with ${left} and its second clause with ${right}`;
  }
  if (left.toLocaleLowerCase() === right.toLocaleLowerCase()) {
    if (clauses.some((clause) => countExactName(clause, left) < 2)) {
      return `must name the other ${left} in each participant clause`;
    }
  } else if (countExactName(clauses[0], right) < 1 || countExactName(clauses[1], left) < 1) {
    return "must name the other participant in each perspective clause";
  }
  return null;
}

export class RelationshipStateError extends Error {
  constructor(message, { code = "invalid_relationship_state", statusCode = 400 } = {}) {
    super(message);
    this.name = "RelationshipStateError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

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
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty character-card ID.`);
  return value;
}

function requireChatId(value) {
  if (typeof value !== "string" || value.length === 0) fail("chatId must be a non-empty string.");
  return value;
}

export function normalizeInjectionSettings(input) {
  const settings = requireRecord(input, "Relationship injection settings");
  requireExactKeys(settings, SETTINGS_KEYS, "Relationship injection settings");
  if (!INJECTION_MODES.has(settings.injectionMode)) fail("injectionMode must be all or sceneOnly.");
  if (!Number.isInteger(settings.presenceLookbackMessages) || settings.presenceLookbackMessages < 1) {
    fail("presenceLookbackMessages must be a positive integer.");
  }
  return {
    injectionMode: settings.injectionMode,
    presenceLookbackMessages: settings.presenceLookbackMessages,
  };
}

export function canonicalizePair(characterAId, characterBId) {
  const left = requireId(characterAId, "characterAId");
  const right = requireId(characterBId, "characterBId");
  if (left === right) fail("A character cannot have a relationship with itself.", { code: "self_relationship" });
  return compareIds(left, right) < 0
    ? { characterAId: left, characterBId: right }
    : { characterAId: right, characterBId: left };
}

function normalizeRelationship(input, allowedCharacterIds) {
  const relationship = requireRecord(input, "Each relationship");
  requireExactKeys(relationship, RELATIONSHIP_KEYS, "Each relationship");
  const pair = canonicalizePair(relationship.characterAId, relationship.characterBId);
  if (allowedCharacterIds) {
    for (const characterId of [pair.characterAId, pair.characterBId]) {
      if (!allowedCharacterIds.has(characterId)) {
        fail(`Relationship references unknown or unassigned character-card ID ${JSON.stringify(characterId)}.`, {
          code: "unknown_character_id",
        });
      }
    }
  }
  if (relationship.state !== "defined" && relationship.state !== "undefined") {
    fail("Relationship state must be defined or undefined.");
  }
  if (typeof relationship.label !== "string" || typeof relationship.description !== "string") {
    fail("Relationship label and description must be strings.");
  }
  if (typeof relationship.manuallyLocked !== "boolean") fail("manuallyLocked must be a boolean.");
  if (relationship.state === "defined") {
    if (relationship.label.length === 0) fail("A defined relationship requires a non-empty label.");
    if (!COLOR_CATEGORIES.has(relationship.colorCategory)) {
      fail("A defined relationship requires a valid colorCategory.");
    }
  } else if (relationship.label !== "" || relationship.description !== "" || relationship.colorCategory !== null) {
    fail("An undefined relationship must have empty label and description values and colorCategory null.");
  }
  return {
    ...pair,
    state: relationship.state,
    label: relationship.label,
    description: relationship.description,
    colorCategory: relationship.colorCategory,
    manuallyLocked: relationship.manuallyLocked,
  };
}

function containsExposedCharacterId(value, allowedCharacterIds, characterNames) {
  if (value.includes("[character-card-id:")) return true;
  let text = value;
  if (characterNames instanceof Map) {
    const naturalNames = [...new Set(characterNames.values())]
      .map(compactText)
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);
    for (const name of naturalNames) text = text.replace(namePattern(name, "giu"), "$1");
  }
  return allowedCharacterIds && [...allowedCharacterIds].some((characterId) => text.includes(characterId));
}

export function normalizeManualRelationship(input, allowedCharacterIds, characterNames) {
  const relationship = requireRecord(input, "Manual relationship update");
  const normalizedInput = Object.hasOwn(relationship, "manuallyLocked")
    ? relationship
    : { ...relationship, manuallyLocked: true };
  requireExactKeys(normalizedInput, MANUAL_RELATIONSHIP_KEYS, "Manual relationship update");
  for (const [field, maximum] of [["label", MAX_RELATIONSHIP_LABEL_LENGTH], ["description", MAX_RELATIONSHIP_DESCRIPTION_LENGTH]]) {
    const value = normalizedInput[field];
    if (typeof value !== "string" || value !== value.trim() || /[\r\n]/u.test(value) || value.length > maximum) {
      fail(`Manual relationship ${field} must be a trimmed single-line string of at most ${maximum} characters.`);
    }
    if (containsExposedCharacterId(value, allowedCharacterIds, characterNames)) {
      fail(`Manual relationship ${field} must use natural names and must not contain character-card IDs.`);
    }
  }
  if (normalizedInput.state === "defined" && normalizedInput.description.length === 0) {
    fail("A defined manual relationship requires a non-empty description.");
  }
  return normalizeRelationship(normalizedInput, allowedCharacterIds);
}

export function normalizeRelationshipPair(input) {
  const pair = requireRecord(input, "Relationship pair");
  requireExactKeys(pair, ["characterAId", "characterBId"], "Relationship pair");
  return canonicalizePair(pair.characterAId, pair.characterBId);
}

export function normalizeRelationshipState(input, { expectedChatId, allowedCharacterIds } = {}) {
  const state = requireRecord(input, "Relationship state");
  requireExactKeys(state, STATE_KEYS, "Relationship state");
  if (state.schemaVersion !== STATE_SCHEMA_VERSION) fail(`schemaVersion must be ${STATE_SCHEMA_VERSION}.`);
  const chatId = requireChatId(state.chatId);
  if (expectedChatId !== undefined && chatId !== expectedChatId) fail("Relationship state chatId does not match the requested chat.");
  const settings = normalizeInjectionSettings({
    injectionMode: state.injectionMode,
    presenceLookbackMessages: state.presenceLookbackMessages,
  });
  if (!Array.isArray(state.presentCharacterIds)) fail("presentCharacterIds must be an array.");
  const presentCharacterIds = state.presentCharacterIds.map((characterId) => requireId(characterId, "presentCharacterIds item"));
  if (new Set(presentCharacterIds).size !== presentCharacterIds.length) fail("presentCharacterIds must not contain duplicates.");
  if (allowedCharacterIds) {
    for (const characterId of presentCharacterIds) {
      if (!allowedCharacterIds.has(characterId)) {
        fail(`Presence references unknown or unassigned character-card ID ${JSON.stringify(characterId)}.`, {
          code: "unknown_character_id",
        });
      }
    }
  }
  if (!Array.isArray(state.relationships)) fail("relationships must be an array.");
  const relationships = state.relationships.map((relationship) => normalizeRelationship(relationship, allowedCharacterIds));
  const pairs = new Set();
  for (const relationship of relationships) {
    const pairKey = JSON.stringify([relationship.characterAId, relationship.characterBId]);
    if (pairs.has(pairKey)) fail("Relationship state contains a duplicate character pair.", { code: "duplicate_relationship" });
    pairs.add(pairKey);
  }
  relationships.sort((left, right) =>
    compareIds(left.characterAId, right.characterAId) || compareIds(left.characterBId, right.characterBId));
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    chatId,
    ...settings,
    presentCharacterIds: [...presentCharacterIds].sort(compareIds),
    relationships,
  };
}

export function projectEligibleState(state, allowedCharacterIds) {
  const valid = normalizeRelationshipState(state);
  return {
    ...valid,
    presentCharacterIds: valid.presentCharacterIds.filter((characterId) => allowedCharacterIds.has(characterId)),
    relationships: valid.relationships.filter(
      (relationship) => allowedCharacterIds.has(relationship.characterAId) && allowedCharacterIds.has(relationship.characterBId),
    ),
  };
}

export function toReadApiResponse(state, chatId = state?.chatId) {
  const resolvedChatId = requireChatId(chatId);
  if (state === null || state === undefined) {
    return { schemaVersion: READ_API_VERSION, chatId: resolvedChatId, relationships: [] };
  }
  const valid = normalizeRelationshipState(state, { expectedChatId: resolvedChatId });
  return {
    schemaVersion: READ_API_VERSION,
    chatId: resolvedChatId,
    relationships: valid.relationships
      .filter((relationship) => relationship.state === "defined")
      .map(({ characterAId, characterBId, label, description, colorCategory, manuallyLocked }) => ({
        characterAId,
        characterBId,
        label,
        description,
        colorCategory,
        manuallyLocked,
      })),
  };
}

export function toSettingsResponse(state, chatId = state?.chatId) {
  const resolvedChatId = requireChatId(chatId);
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    chatId: resolvedChatId,
    configured: state !== null && state !== undefined,
    injectionMode: state?.injectionMode ?? null,
    presenceLookbackMessages: state?.presenceLookbackMessages ?? DEFAULT_PRESENCE_LOOKBACK_MESSAGES,
  };
}

export function characterCardName(character) {
  let data = character?.data;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { data = null; }
  }
  const dataName = isRecord(data) ? compactText(data.name) : "";
  const topLevelName = compactText(character?.name);
  return dataName || topLevelName;
}

export function toPanelResponse(snapshot) {
  const state = snapshot?.state ?? null;
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    chatId: requireChatId(snapshot?.chatId),
    configured: state !== null,
    settings: {
      injectionMode: state?.injectionMode ?? null,
      presenceLookbackMessages: state?.presenceLookbackMessages ?? DEFAULT_PRESENCE_LOOKBACK_MESSAGES,
    },
    characters: [...(snapshot?.characters ?? [])]
      .map((character) => ({ characterId: character.id, name: characterCardName(character) }))
      .sort((left, right) => compareIds(left.characterId, right.characterId)),
    relationships: clone(state?.relationships ?? []),
  };
}

export function stateDocumentId(chatId) {
  return `${PACKAGE_ID}:chat:${requireChatId(chatId)}`;
}

export function createRelationshipStateRepository(runtime) {
  const persistence = runtime?.persistence;
  const resources = runtime?.resources;
  const documents = persistence?.documents;
  if (typeof persistence?.getChat !== "function" || typeof persistence?.withChatLock !== "function" ||
      typeof documents?.getById !== "function" || typeof documents?.create !== "function" ||
      typeof documents?.update !== "function" || typeof resources?.listCharacters !== "function") {
    throw new Error("Relationship Tracker requires Marinara's package persistence and character resource APIs.");
  }

  async function resolveChat(chatId) {
    const validChatId = requireChatId(chatId);
    const chat = await persistence.getChat(validChatId);
    if (!chat) fail("Chat not found.", { code: "chat_not_found", statusCode: 404 });
    if (chat.mode !== "roleplay") fail("Relationship state is available only for Roleplay chats.", {
      code: "wrong_chat_mode",
      statusCode: 400,
    });
    const assignedIds = new Set(chat.characterIds);
    const characters = chat.characterIds.length > 0 ? await resources.listCharacters(chat.characterIds) : [];
    const eligibleCharacters = characters.filter((character) => assignedIds.has(character.id));
    const allowedCharacterIds = new Set(eligibleCharacters.map((character) => character.id));
    return { chat, characters: eligibleCharacters, allowedCharacterIds };
  }

  async function readStoredSnapshot(chatId) {
    const document = await documents.getById(PACKAGE_ID, stateDocumentId(chatId));
    if (!document) return null;
    if (document.kind !== STATE_DOCUMENT_KIND) {
      fail("Stored relationship state has the wrong document kind.", { code: "corrupt_relationship_state", statusCode: 500 });
    }
    try {
      return {
        state: normalizeRelationshipState(document.data, { expectedChatId: chatId }),
        revision: document.revision,
      };
    } catch (error) {
      if (error instanceof RelationshipStateError) {
        throw new RelationshipStateError(`Stored relationship state is invalid: ${error.message}`, {
          code: "corrupt_relationship_state",
          statusCode: 500,
        });
      }
      throw error;
    }
  }

  async function readStoredState(chatId) {
    return (await readStoredSnapshot(chatId))?.state ?? null;
  }

  async function writeStoredState(normalized) {
    const id = stateDocumentId(normalized.chatId);
    const current = await documents.getById(PACKAGE_ID, id);
    const timestamp = new Date().toISOString();
    const write = {
      id,
      packageId: PACKAGE_ID,
      name: normalized.chatId,
      description: "Canonical Relationship Tracker chat state v1",
      data: clone(normalized),
      updatedAt: timestamp,
    };
    const saved = current
      ? await documents.update({ ...write, expectedRevision: current.revision })
      : await documents.create({ ...write, kind: STATE_DOCUMENT_KIND, createdAt: timestamp });
    if (!saved) fail("Relationship state changed concurrently; retry the operation.", {
      code: "relationship_state_conflict",
      statusCode: 409,
    });
    return clone(normalized);
  }

  async function getState(chatId) {
    const { allowedCharacterIds } = await resolveChat(chatId);
    const state = await readStoredState(chatId);
    return state ? projectEligibleState(state, allowedCharacterIds) : null;
  }

  async function saveState(input) {
    const requested = requireRecord(input, "Relationship state");
    const chatId = requireChatId(requested.chatId);
    return persistence.withChatLock(chatId, async () => {
      const { allowedCharacterIds } = await resolveChat(chatId);
      const normalized = normalizeRelationshipState(requested, { expectedChatId: chatId, allowedCharacterIds });
      return writeStoredState(normalized);
    });
  }

  async function getTrackingSnapshot(chatId) {
    const validChatId = requireChatId(chatId);
    const { characters, allowedCharacterIds } = await resolveChat(validChatId);
    const stored = await readStoredSnapshot(validChatId);
    return {
      chatId: validChatId,
      characters: clone(characters),
      allowedCharacterIds: new Set(allowedCharacterIds),
      state: stored ? projectEligibleState(stored.state, allowedCharacterIds) : null,
      stateRevision: stored?.revision ?? null,
    };
  }

  async function updatePresentCharacterIds(chatId, presentCharacterIds) {
    const validChatId = requireChatId(chatId);
    if (!Array.isArray(presentCharacterIds)) fail("Present character IDs must be an array.");
    return persistence.withChatLock(validChatId, async () => {
      const { allowedCharacterIds } = await resolveChat(validChatId);
      const stored = await readStoredState(validChatId);
      if (!stored) return null;
      const current = projectEligibleState(stored, allowedCharacterIds);
      const projectedNext = normalizeRelationshipState({
        ...current,
        presentCharacterIds,
      }, { expectedChatId: validChatId, allowedCharacterIds });
      const next = normalizeRelationshipState({
        ...stored,
        presentCharacterIds: projectedNext.presentCharacterIds,
      }, { expectedChatId: validChatId });
      if (JSON.stringify(next) === JSON.stringify(stored)) return clone(current);
      return projectEligibleState(await writeStoredState(next), allowedCharacterIds);
    });
  }

  async function applyAutomaticSnapshot(chatId, snapshotRelationships, options) {
    const validChatId = requireChatId(chatId);
    if (!Array.isArray(snapshotRelationships)) fail("Automatic relationship snapshot must be an array.");
    if (!isRecord(options) || !Number.isInteger(options.expectedStateRevision) || options.expectedStateRevision < 1 ||
        (options.stalePolicy !== "skip" && options.stalePolicy !== "reject")) {
      fail("Automatic relationship writes require a positive expectedStateRevision and a stalePolicy of skip or reject.");
    }
    return persistence.withChatLock(validChatId, async () => {
      const { allowedCharacterIds } = await resolveChat(validChatId);
      const storedSnapshot = await readStoredSnapshot(validChatId);
      if (!storedSnapshot) return null;
      const stored = storedSnapshot.state;
      const current = projectEligibleState(stored, allowedCharacterIds);
      if (storedSnapshot.revision !== options.expectedStateRevision) {
        if (options.stalePolicy === "reject") {
          fail("Relationship state changed while the model was running; retry the operation.", {
            code: "relationship_state_stale",
            statusCode: 409,
          });
        }
        return clone(current);
      }
      const relationships = new Map(stored.relationships.map((existing) => [
        JSON.stringify([existing.characterAId, existing.characterBId]),
        existing,
      ]));
      for (const proposed of snapshotRelationships) {
        const pair = canonicalizePair(proposed?.characterAId, proposed?.characterBId);
        for (const characterId of [pair.characterAId, pair.characterBId]) {
          if (!allowedCharacterIds.has(characterId)) fail(`Relationship references unknown or unassigned character-card ID ${JSON.stringify(characterId)}.`, {
            code: "unknown_character_id",
          });
        }
        const key = JSON.stringify([pair.characterAId, pair.characterBId]);
        if (relationships.get(key)?.manuallyLocked) continue;
        relationships.set(key, {
          ...pair,
          state: proposed.state,
          label: proposed.label,
          description: proposed.description,
          colorCategory: proposed.colorCategory,
          manuallyLocked: false,
        });
      }
      const next = normalizeRelationshipState({
        ...stored,
        presentCharacterIds: current.presentCharacterIds,
        relationships: [...relationships.values()],
      }, { expectedChatId: validChatId });
      if (JSON.stringify(next) === JSON.stringify(stored)) return clone(current);
      return projectEligibleState(await writeStoredState(next), allowedCharacterIds);
    });
  }

  async function updateManualRelationship(chatId, input) {
    const validChatId = requireChatId(chatId);
    return persistence.withChatLock(validChatId, async () => {
      const { characters, allowedCharacterIds } = await resolveChat(validChatId);
      const stored = await readStoredState(validChatId);
      if (!stored) fail("Configure Relationship Tracker for this chat before editing relationships.", {
        code: "relationship_state_not_configured",
        statusCode: 409,
      });
      const current = projectEligibleState(stored, allowedCharacterIds);
      const characterNames = new Map(characters.map((character) => [character.id, characterCardName(character)]));
      const relationship = normalizeManualRelationship(input, allowedCharacterIds, characterNames);
      const key = JSON.stringify([relationship.characterAId, relationship.characterBId]);
      const relationships = new Map(stored.relationships.map((entry) => [
        JSON.stringify([entry.characterAId, entry.characterBId]),
        entry,
      ]));
      relationships.set(key, relationship);
      const next = normalizeRelationshipState({
        ...stored,
        presentCharacterIds: current.presentCharacterIds,
        relationships: [...relationships.values()],
      }, { expectedChatId: validChatId });
      if (JSON.stringify(next) === JSON.stringify(stored)) return clone(current);
      return projectEligibleState(await writeStoredState(next), allowedCharacterIds);
    });
  }

  async function resumeAutomaticRelationship(chatId, input) {
    const validChatId = requireChatId(chatId);
    const pair = normalizeRelationshipPair(input);
    return persistence.withChatLock(validChatId, async () => {
      const { allowedCharacterIds } = await resolveChat(validChatId);
      const stored = await readStoredState(validChatId);
      if (!stored) fail("Configure Relationship Tracker for this chat before editing relationships.", {
        code: "relationship_state_not_configured",
        statusCode: 409,
      });
      for (const characterId of [pair.characterAId, pair.characterBId]) {
        if (!allowedCharacterIds.has(characterId)) fail(`Relationship references unknown or unassigned character-card ID ${JSON.stringify(characterId)}.`, {
          code: "unknown_character_id",
        });
      }
      const current = projectEligibleState(stored, allowedCharacterIds);
      const index = stored.relationships.findIndex((entry) =>
        entry.characterAId === pair.characterAId && entry.characterBId === pair.characterBId);
      if (index < 0) fail("Relationship pair not found.", { code: "relationship_not_found", statusCode: 404 });
      const relationships = clone(stored.relationships);
      relationships[index] = { ...relationships[index], manuallyLocked: false };
      const next = normalizeRelationshipState({
        ...stored,
        presentCharacterIds: current.presentCharacterIds,
        relationships,
      }, { expectedChatId: validChatId });
      if (JSON.stringify(next) === JSON.stringify(stored)) return clone(current);
      return projectEligibleState(await writeStoredState(next), allowedCharacterIds);
    });
  }

  async function getPanelResponse(chatId) {
    return toPanelResponse(await getTrackingSnapshot(chatId));
  }

  async function getSettings(chatId) {
    const validChatId = requireChatId(chatId);
    await resolveChat(validChatId);
    return toSettingsResponse(await readStoredState(validChatId), validChatId);
  }

  async function updateSettings(chatId, input) {
    const validChatId = requireChatId(chatId);
    const settings = normalizeInjectionSettings(input);
    return persistence.withChatLock(validChatId, async () => {
      const { allowedCharacterIds } = await resolveChat(validChatId);
      const current = await readStoredState(validChatId);
      const projected = current ? projectEligibleState(current, allowedCharacterIds) : null;
      const normalized = normalizeRelationshipState({
        schemaVersion: STATE_SCHEMA_VERSION,
        chatId: validChatId,
        ...settings,
        presentCharacterIds: projected?.presentCharacterIds ?? [],
        relationships: current?.relationships ?? [],
      });
      return toSettingsResponse(await writeStoredState(normalized), validChatId);
    });
  }

  async function getReadResponse(chatId) {
    const state = await getState(chatId);
    return toReadApiResponse(state, chatId);
  }

  return Object.freeze({
    getState,
    saveState,
    getTrackingSnapshot,
    updatePresentCharacterIds,
    applyAutomaticSnapshot,
    updateManualRelationship,
    resumeAutomaticRelationship,
    getPanelResponse,
    getSettings,
    updateSettings,
    getReadResponse,
  });
}
