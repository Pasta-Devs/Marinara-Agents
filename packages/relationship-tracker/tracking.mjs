import { canonicalizePair, characterCardName, relationshipDescriptionIssue } from "./state.mjs";
import { PERSONA_TRACKING_INSTRUCTIONS, applyPersonaDelta, personaPreparedContext } from "./persona-tracking.mjs";

export const MAX_RELATIONSHIP_LABEL_LENGTH = 80;
export const MAX_RELATIONSHIP_DESCRIPTION_LENGTH = 240;
export const MAX_MODEL_RELATIONSHIP_LABEL_LENGTH = 48;
export const MAX_MODEL_PERSPECTIVE_LENGTH = 80;

const SNAPSHOT_RESULT_ROOT_KEYS = ["relationships"];
const CONTEXT_RELATIONSHIP_KEYS = [
  "characterARef",
  "characterBRef",
  "state",
  "label",
  "description",
  "colorCategory",
];
const MODEL_RELATIONSHIP_KEYS = [
  "characterARef",
  "characterBRef",
  "state",
  "label",
  "characterAPerspective",
  "characterBPerspective",
  "colorCategory",
];
const ALLOWED_CHARACTER_KEYS = ["alias", "characterId", "name", "characterRef"];
const BASE_PREPARED_CONTEXT_KEYS = [
  "schemaVersion",
  "chatId",
  "trackingEnabled",
  "trackingInstructions",
  "allowedCharacters",
  "existingRelationships",
  "stateRevision",
];
const PERSONA_PREPARED_CONTEXT_KEYS = [
  ...BASE_PREPARED_CONTEXT_KEYS,
  "activePersona",
  "existingPersonaPerceptions",
  "personaStateRevision",
];
const TRACKING_INSTRUCTIONS = `${PERSONA_TRACKING_INSTRUCTIONS} Return only compact per-edge relationship updates directly supported by the newly completed turn in the host-provided <assistant_response>. Output exactly {\"u\":[]} when nothing changed. Each u item is exactly [aliasA,aliasB,state,label,perspectiveA,perspectiveB,colorCategory]. Copy aliases only from allowedCharacters.alias; never output character IDs or characterRef values. existingRelationships is the compact baseline; each item is [aliasA,aliasB,state,label,description,colorCategory,locked]. state is defined or undefined. For defined updates, label is at most 48 characters, each perspective is at most 80 characters, and colorCategory is positive, neutral, negative, or complicated. perspectiveA must name B's natural name and perspectiveB must name A's natural name. State a participant's own stance only when evidence establishes it; otherwise describe only the evidenced situation, such as is openly distrusted by Cora, without inventing reciprocal feelings. For undefined updates use empty label and perspectives and null colorCategory. The bounded recent chat history is context for continuity only and must never recreate or revise an edge by itself. Omit every unchanged pair and every pair whose baseline locked value is true. Labels and perspectives must use natural names and contain no aliases, character IDs, reasoning, or extra fields. Scene presence is separate and must not gate relationship tracking.`;
const COLOR_CATEGORIES = new Set(["positive", "neutral", "negative", "complicated"]);
const compareIds = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function trackingPair(characterAId, characterBId) {
  try {
    return canonicalizePair(characterAId, characterBId);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Relationship snapshot contains an invalid character pair.");
  }
}

const pairKey = (relationship) => {
  const pair = trackingPair(relationship?.characterAId, relationship?.characterBId);
  return JSON.stringify([pair.characterAId, pair.characterBId]);
};

export class RelationshipTrackingError extends Error {
  constructor(message) {
    super(message);
    this.name = "RelationshipTrackingError";
  }
}

function fail(message) {
  throw new RelationshipTrackingError(message);
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

function requireBriefText(value, label, maximum, { empty = false } = {}) {
  if (typeof value !== "string") fail(`${label} must be a string.`);
  if (value !== value.trim() || /[\r\n]/u.test(value)) fail(`${label} must be trimmed and single-line.`);
  if (!empty && value.length === 0) fail(`${label} must not be empty.`);
  if (value.length > maximum) fail(`${label} must be at most ${maximum} characters.`);
  return value;
}

export function formatCharacterReference(characterId, name) {
  const resolvedId = requireBriefText(characterId, "Character reference ID", 200);
  const resolvedName = requireBriefText(name, "Character reference name", 200);
  return `${resolvedName} [character-card-id:${resolvedId}]`;
}

export function buildAllowedCharacterReferences(allowedCharacters) {
  if (!Array.isArray(allowedCharacters)) fail("Allowed characters must be an array.");
  const ids = new Set();
  const refs = new Set();
  const normalized = allowedCharacters.map((input) => {
    const character = requireRecord(input, "Each allowed character");
    requireExactKeys(character, ["characterId", "name"], "Each source allowed character");
    const characterId = requireBriefText(character.characterId, "Allowed character ID", 200);
    const name = requireBriefText(character.name, "Allowed character name", 200);
    const characterRef = formatCharacterReference(characterId, name);
    if (ids.has(characterId)) fail("Allowed character IDs must not contain duplicates.");
    if (refs.has(characterRef)) fail("Allowed character references must not contain duplicates.");
    ids.add(characterId);
    refs.add(characterRef);
    return { characterId, name, characterRef };
  });
  normalized.sort((left, right) => compareIds(left.characterId, right.characterId));
  return normalized.map((character, index) => ({ alias: `c${index}`, ...character }));
}

function identityFromReferences(allowedCharacters) {
  if (!Array.isArray(allowedCharacters)) fail("Allowed characters must be an array.");
  const byAlias = new Map();
  const byRef = new Map();
  const byId = new Map();
  const nameCounts = new Map();
  for (const [index, value] of allowedCharacters.entries()) {
    const character = requireRecord(value, "Each allowed character");
    requireExactKeys(character, ALLOWED_CHARACTER_KEYS, "Each allowed character");
    const expectedRef = formatCharacterReference(character.characterId, character.name);
    if (character.alias !== `c${index}`) fail("Allowed character aliases must be deterministic and contiguous.");
    if (character.characterRef !== expectedRef) fail("Allowed character reference does not match its name and ID.");
    if (byAlias.has(character.alias) || byRef.has(character.characterRef) || byId.has(character.characterId)) {
      fail("Allowed characters must not contain duplicate aliases, IDs, or references.");
    }
    byAlias.set(character.alias, character);
    byRef.set(character.characterRef, character);
    byId.set(character.characterId, character);
    const foldedName = character.name.toLocaleLowerCase();
    nameCounts.set(foldedName, (nameCounts.get(foldedName) ?? 0) + 1);
  }
  return { byAlias, byRef, byId, nameCounts };
}

function decodeDeltaEnvelope(input, label) {
  const root = requireRecord(input, label);
  const keys = Object.keys(root);
  if (keys.length !== 1 || (keys[0] !== "u" && keys[0] !== "updates")) {
    fail(`${label} must contain exactly u (or legacy updates).`);
  }
  const key = keys[0];
  if (!Array.isArray(root[key])) fail(`${key} must be an array.`);
  return { entries: root[key], compact: key === "u" };
}

function decodeCompactDeltaEntry(input, identity, label) {
  if (!Array.isArray(input) || input.length !== 7) {
    fail(`${label} must be a seven-value tuple: aliasA, aliasB, state, label, perspectiveA, perspectiveB, colorCategory.`);
  }
  const [aliasA, aliasB, state, relationshipLabel, perspectiveA, perspectiveB, colorCategory] = input;
  const left = identity.byAlias.get(aliasA);
  const right = identity.byAlias.get(aliasB);
  if (!left || !right) fail(`${label} references an unknown character alias.`);
  return {
    characterARef: left.characterRef,
    characterBRef: right.characterRef,
    state,
    label: relationshipLabel,
    characterAPerspective: perspectiveA,
    characterBPerspective: perspectiveB,
    colorCategory,
  };
}

function decodeDeltaEntry(input, identity, compact, label) {
  return compact ? decodeCompactDeltaEntry(input, identity, label) : input;
}

function resolveModelPair(relationship, identity) {
  const left = identity.byRef.get(relationship.characterARef);
  const right = identity.byRef.get(relationship.characterBRef);
  if (!left || !right) fail("Relationship snapshot references an unknown or mismatched character reference.");
  return trackingPair(left.characterId, right.characterId);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function mentionedCharacterIds(text, identity) {
  const ids = new Set();
  for (const character of identity.byId.values()) {
    if ((identity.nameCounts.get(character.name.toLocaleLowerCase()) ?? 0) !== 1) continue;
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegex(character.name)}(?=$|[^\\p{L}\\p{N}_])`, "iu");
    if (pattern.test(text)) ids.add(character.characterId);
  }
  return ids;
}

function samePairMembers(pair, ids) {
  return ids.size === 2 && ids.has(pair.characterAId) && ids.has(pair.characterBId);
}

function descriptionIssue(description, pair, identity) {
  return relationshipDescriptionIssue(
    description,
    pair,
    new Map([...identity.byId].map(([characterId, character]) => [characterId, character.name])),
  );
}

function mentionsNaturalName(text, name) {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegex(name)}(?=$|[^\\p{L}\\p{N}_])`, "iu");
  return pattern.test(text);
}

function normalizePerspective(value, label, ownerName) {
  const text = requireBriefText(value, label, MAX_MODEL_PERSPECTIVE_LENGTH);
  const ownerPrefix = new RegExp(`^${escapeRegex(ownerName)}(?=$|[^\\p{L}\\p{N}_])\\s*`, "iu");
  const fragment = text.replace(ownerPrefix, "").replace(/[.!?]+$/u, "").trim();
  if (!fragment) fail(`${label} must contain a meaningful phrase.`);
  if (fragment.includes(";")) fail(`${label} must be one perspective fragment without a semicolon.`);
  return fragment;
}

function structuredModelDescription(relationship, pair, identity) {
  const sourceA = identity.byRef.get(relationship.characterARef);
  const sourceB = identity.byRef.get(relationship.characterBRef);
  if (!sourceA || !sourceB) fail("Relationship perspectives reference an unknown character.");

  if (relationship.state === "undefined") {
    if (relationship.characterAPerspective !== "" || relationship.characterBPerspective !== "") {
      fail("An undefined relationship must have empty perspective values.");
    }
    return "";
  }

  const perspectiveA = normalizePerspective(relationship.characterAPerspective, "Character A perspective", sourceA.name);
  const perspectiveB = normalizePerspective(relationship.characterBPerspective, "Character B perspective", sourceB.name);
  if (!mentionsNaturalName(perspectiveA, sourceB.name)) {
    fail("Character A perspective must name character B.");
  }
  if (!mentionsNaturalName(perspectiveB, sourceA.name)) {
    fail("Character B perspective must name character A.");
  }

  const perspectiveById = new Map([
    [sourceA.characterId, perspectiveA],
    [sourceB.characterId, perspectiveB],
  ]);
  const left = identity.byId.get(pair.characterAId);
  const right = identity.byId.get(pair.characterBId);
  const description = `${left.name} ${perspectiveById.get(left.characterId)}; ${right.name} ${perspectiveById.get(right.characterId)}.`;
  return requireBriefText(description, "Combined relationship description", MAX_RELATIONSHIP_DESCRIPTION_LENGTH);
}

function containsCharacterAlias(text, identity) {
  return [...identity.byAlias.keys()].some((alias) => {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegex(alias)}(?=$|[^\\p{L}\\p{N}_])`, "iu");
    return pattern.test(text);
  });
}

function naturalizeModelProse(value, identity) {
  let text = typeof value === "string" ? value : "";
  const characters = [...identity.byId.values()]
    .sort((left, right) => right.characterId.length - left.characterId.length);
  for (const character of characters) text = text.split(character.characterId).join(character.name);
  return text.replace(/\[character-card-id:[^\]]+\]/gu, "").replace(/\s+/gu, " ").trim();
}

export function modelRelationshipSnapshot(existingRelationships, allowedCharacters) {
  const identity = identityFromReferences(allowedCharacters);
  if (!Array.isArray(existingRelationships)) fail("Existing relationships must be an array.");
  return existingRelationships.map((relationship) => {
    const pair = trackingPair(relationship?.characterAId, relationship?.characterBId);
    const left = identity.byId.get(pair.characterAId);
    const right = identity.byId.get(pair.characterBId);
    if (!left || !right) fail("Existing relationship references an unknown allowed character.");
    return [
      left.alias,
      right.alias,
      relationship.state,
      naturalizeModelProse(relationship.label, identity),
      naturalizeModelProse(relationship.description, identity),
      relationship.colorCategory,
      relationship.manuallyLocked,
    ];
  });
}

function decodePreparedRelationship(input, identity) {
  if (!Array.isArray(input) || input.length !== 7) {
    fail("Each prepared relationship must be a seven-value tuple: aliasA, aliasB, state, label, description, colorCategory, locked.");
  }
  const [aliasA, aliasB, state, label, description, colorCategory, manuallyLocked] = input;
  const left = identity.byAlias.get(aliasA);
  const right = identity.byAlias.get(aliasB);
  if (!left || !right) fail("Prepared relationship references an unknown character alias.");
  const pair = trackingPair(left.characterId, right.characterId);
  if (pair.characterAId !== left.characterId || pair.characterBId !== right.characterId) {
    fail("Prepared relationship aliases must use canonical order.");
  }
  if (state !== "defined" && state !== "undefined") fail("Prepared relationship state must be defined or undefined.");
  if (typeof manuallyLocked !== "boolean") fail("Prepared relationship locked value must be boolean.");
  if (state === "undefined") {
    if (label !== "" || description !== "" || colorCategory !== null) {
      fail("An undefined prepared relationship must use empty prose and null colorCategory.");
    }
  } else {
    requireBriefText(label, "Prepared relationship label", MAX_RELATIONSHIP_LABEL_LENGTH);
    requireBriefText(description, "Prepared relationship description", MAX_RELATIONSHIP_DESCRIPTION_LENGTH);
    if (!COLOR_CATEGORIES.has(colorCategory)) fail("Prepared relationship colorCategory is invalid.");
  }
  return { ...pair, state, label, description, colorCategory, manuallyLocked };
}

export function normalizeAutomaticRelationshipResult(input, allowedCharacters, existingRelationships = [], {
  evidenceText = "",
} = {}) {
  const root = requireRecord(input, "Relationship Tracker result");
  requireExactKeys(root, SNAPSHOT_RESULT_ROOT_KEYS, "Relationship Tracker snapshot result");
  const identity = identityFromReferences(allowedCharacters);
  if (!Array.isArray(existingRelationships)) fail("Existing relationships must be an array.");
  if (!Array.isArray(root.relationships)) fail("relationships must be an array.");

  const existingByPair = new Map(existingRelationships.map((entry) => [pairKey(entry), {
    ...entry,
    label: naturalizeModelProse(entry?.label, identity),
    description: naturalizeModelProse(entry?.description, identity),
  }]));
  const evidenceParticipants = mentionedCharacterIds(String(evidenceText ?? ""), identity);
  const pairs = new Set();
  const relationships = root.relationships.map((inputRelationship) => {
    const relationship = requireRecord(inputRelationship, "Each relationship snapshot entry");
    requireExactKeys(relationship, MODEL_RELATIONSHIP_KEYS, "Each relationship snapshot entry");
    const pair = resolveModelPair(relationship, identity);
    const key = pairKey(pair);
    if (pairs.has(key)) fail("Relationship Tracker result contains a duplicate character pair.");
    pairs.add(key);

    if (relationship.state !== "defined" && relationship.state !== "undefined") {
      fail("Relationship snapshot state must be defined or undefined.");
    }
    const label = requireBriefText(
      relationship.label,
      "Relationship snapshot label",
      MAX_RELATIONSHIP_LABEL_LENGTH,
      { empty: relationship.state === "undefined" },
    );
    const description = structuredModelDescription(relationship, pair, identity);
    if (relationship.state === "defined" && !COLOR_CATEGORIES.has(relationship.colorCategory)) {
      fail("A defined relationship snapshot entry requires a valid colorCategory.");
    }
    if (relationship.state === "undefined" && (label !== "" || description !== "" || relationship.colorCategory !== null)) {
      fail("An undefined relationship snapshot entry must have an empty label and perspective values and colorCategory null.");
    }
    const normalized = {
      ...pair,
      state: relationship.state,
      label,
      description,
      colorCategory: relationship.colorCategory,
    };
    const modelProse = `${label} ${relationship.characterAPerspective} ${relationship.characterBPerspective}`;
    const prose = `${label} ${description}`;
    if (modelProse.includes("[character-card-id:") || [...identity.byId.keys()].some((characterId) => modelProse.includes(characterId))) {
      fail("Relationship labels and perspectives must use natural names and must not contain character-card IDs.");
    }
    const existing = existingByPair.get(key);
    if (!relationshipValuesMatch(existing, normalized)) {
      const issue = relationship.state === "defined" ? descriptionIssue(description, pair, identity) : null;
      if (issue) fail(`Relationship snapshot description ${issue}.`);
      const describedParticipants = mentionedCharacterIds(prose, identity);
      if ([...describedParticipants].some((characterId) => characterId !== pair.characterAId && characterId !== pair.characterBId)) {
        fail("Relationship snapshot description names a character outside its referenced pair.");
      }
      if (evidenceParticipants.size === 2 && !samePairMembers(pair, evidenceParticipants)) {
        fail("Changed relationship pair contradicts the two explicit participants in the completed evidence.");
      }
    }
    return normalized;
  });

  for (const existing of existingRelationships) {
    const pair = trackingPair(existing?.characterAId, existing?.characterBId);
    if (!pairs.has(pairKey(pair))) {
      fail("Relationship Tracker result omitted a pair from the existing relationship snapshot.");
    }
  }

  relationships.sort((left, right) =>
    compareIds(left.characterAId, right.characterAId) || compareIds(left.characterBId, right.characterBId));
  return relationships;
}

function normalizeAutomaticDeltaEntry(inputRelationship, identity) {
  const relationship = requireRecord(inputRelationship, "Each automatic relationship update");
  requireExactKeys(relationship, MODEL_RELATIONSHIP_KEYS, "Each automatic relationship update");
  const pair = resolveModelPair(relationship, identity);
  if (relationship.state !== "defined" && relationship.state !== "undefined") {
    fail("Automatic relationship update state must be defined or undefined.");
  }
  const label = requireBriefText(
    relationship.label,
    "Automatic relationship update label",
    MAX_MODEL_RELATIONSHIP_LABEL_LENGTH,
    { empty: relationship.state === "undefined" },
  );
  const description = structuredModelDescription(relationship, pair, identity);
  if (relationship.state === "defined" && !COLOR_CATEGORIES.has(relationship.colorCategory)) {
    fail("A defined automatic relationship update requires a valid colorCategory.");
  }
  if (relationship.state === "undefined" && (label !== "" || description !== "" || relationship.colorCategory !== null)) {
    fail("An undefined automatic relationship update must have an empty label and perspective values and colorCategory null.");
  }
  const modelProse = `${label} ${relationship.characterAPerspective} ${relationship.characterBPerspective}`;
  const prose = `${label} ${description}`;
  if (modelProse.includes("[character-card-id:") ||
      [...identity.byId.keys()].some((characterId) => modelProse.includes(characterId)) ||
      containsCharacterAlias(modelProse, identity)) {
    fail("Automatic relationship labels and perspectives must use natural names and must not contain aliases or character-card IDs.");
  }
  return {
    relationship: {
      ...pair,
      state: relationship.state,
      label,
      description,
      colorCategory: relationship.colorCategory,
    },
    prose,
  };
}

export function normalizeHistoryRelationshipDelta(input, allowedCharacters, existingRelationships = [], {
  evidenceText = "",
} = {}) {
  const { entries, compact } = decodeDeltaEnvelope(input, "Relationship Tracker history result");
  const identity = identityFromReferences(allowedCharacters);
  if (!Array.isArray(existingRelationships)) fail("Existing relationships must be an array.");

  const existingByPair = new Map(existingRelationships.map((entry) => [pairKey(entry), {
    ...entry,
    label: naturalizeModelProse(entry?.label, identity),
    description: naturalizeModelProse(entry?.description, identity),
  }]));
  const evidenceParticipants = mentionedCharacterIds(String(evidenceText ?? ""), identity);
  const pairs = new Set();
  const updates = [];

  for (const inputRelationship of entries) {
    const decoded = decodeDeltaEntry(inputRelationship, identity, compact, "Each history update");
    const { relationship, prose } = normalizeAutomaticDeltaEntry(decoded, identity);
    const key = pairKey(relationship);
    if (pairs.has(key)) fail("Relationship Tracker history result contains a duplicate character pair.");
    pairs.add(key);
    if (relationshipValuesMatch(existingByPair.get(key), relationship)) continue;
    const issue = relationship.state === "defined" ? descriptionIssue(relationship.description, relationship, identity) : null;
    if (issue) fail(`History relationship description ${issue}.`);
    const describedParticipants = mentionedCharacterIds(prose, identity);
    if ([...describedParticipants].some((characterId) =>
      characterId !== relationship.characterAId && characterId !== relationship.characterBId)) {
      fail("History relationship description names a character outside its referenced pair.");
    }
    if (evidenceParticipants.size === 2 && !samePairMembers(relationship, evidenceParticipants)) {
      fail("History relationship pair contradicts the two explicit participants in the bounded evidence.");
    }
    updates.push(relationship);
  }

  updates.sort((left, right) =>
    compareIds(left.characterAId, right.characterAId) || compareIds(left.characterBId, right.characterBId));
  return updates;
}

export function normalizeAutomaticRelationshipDelta(input, allowedCharacters, existingRelationships = [], {
  evidenceText = "",
} = {}) {
  const { entries, compact } = decodeDeltaEnvelope(input, "Relationship Tracker automatic result");
  const identity = identityFromReferences(allowedCharacters);
  if (!Array.isArray(existingRelationships)) fail("Existing relationships must be an array.");

  const existingByPair = new Map(existingRelationships.map((entry) => [pairKey(entry), {
    ...entry,
    label: naturalizeModelProse(entry?.label, identity),
    description: naturalizeModelProse(entry?.description, identity),
  }]));
  const completedEvidence = String(evidenceText ?? "").trim();
  const evidenceParticipants = mentionedCharacterIds(completedEvidence, identity);
  const candidatesByPair = new Map();

  for (const inputRelationship of entries) {
    try {
      const decoded = decodeDeltaEntry(inputRelationship, identity, compact, "Each automatic update");
      const candidate = normalizeAutomaticDeltaEntry(decoded, identity);
      const key = pairKey(candidate.relationship);
      const candidates = candidatesByPair.get(key) ?? [];
      candidates.push(candidate);
      candidatesByPair.set(key, candidates);
    } catch (error) {
      if (!(error instanceof RelationshipTrackingError)) throw error;
    }
  }

  const updates = [];
  for (const [key, candidates] of candidatesByPair) {
    if (candidates.length !== 1) continue;
    const { relationship, prose } = candidates[0];
    if (relationshipValuesMatch(existingByPair.get(key), relationship)) continue;
    if (relationship.state === "defined" && descriptionIssue(relationship.description, relationship, identity)) continue;
    const describedParticipants = mentionedCharacterIds(prose, identity);
    const namesOutsidePair = [...describedParticipants].some((characterId) =>
      characterId !== relationship.characterAId && characterId !== relationship.characterBId);
    const contradictsCompletedTurn = evidenceParticipants.size >= 2 &&
      (!evidenceParticipants.has(relationship.characterAId) || !evidenceParticipants.has(relationship.characterBId));
    if (!completedEvidence || namesOutsidePair || contradictsCompletedTurn) continue;
    updates.push(relationship);
  }

  updates.sort((left, right) =>
    compareIds(left.characterAId, right.characterAId) || compareIds(left.characterBId, right.characterBId));
  return updates;
}

export function buildPreparedTrackingContext(snapshot, personaSnapshot = null) {
  const characters = buildAllowedCharacterReferences([...snapshot.characters]
    .map((character) => ({ characterId: character.id, name: characterCardName(character, "") })));
  return {
    schemaVersion: 1,
    chatId: snapshot.chatId,
    trackingEnabled: snapshot.state !== null,
    trackingInstructions: TRACKING_INSTRUCTIONS,
    allowedCharacters: characters,
    existingRelationships: snapshot.state ? modelRelationshipSnapshot(snapshot.state.relationships, characters) : [],
    stateRevision: snapshot.stateRevision ?? null,
    ...(personaSnapshot?.persona ? personaPreparedContext(personaSnapshot, characters) : {}),
  };
}

function normalizePreparedTrackingContext(input, expectedChatId) {
  const prepared = requireRecord(input, "Prepared Relationship Tracker context");
  const hasPersonaContext = Object.hasOwn(prepared, "activePersona");
  requireExactKeys(prepared, hasPersonaContext ? PERSONA_PREPARED_CONTEXT_KEYS : BASE_PREPARED_CONTEXT_KEYS, "Prepared Relationship Tracker context");
  if (prepared.schemaVersion !== 1) fail("Prepared Relationship Tracker context must use schemaVersion 1.");
  if (typeof prepared.chatId !== "string" || !prepared.chatId || prepared.chatId !== expectedChatId) {
    fail("Prepared Relationship Tracker context has the wrong chat ID.");
  }
  if (typeof prepared.trackingEnabled !== "boolean") fail("trackingEnabled must be a boolean.");
  if (prepared.trackingEnabled) {
    if (!Number.isInteger(prepared.stateRevision) || prepared.stateRevision < 1) {
      fail("Enabled tracking context must include a positive stateRevision.");
    }
  } else if (prepared.stateRevision !== null) {
    fail("Disabled tracking context must use a null stateRevision.");
  }
  if (prepared.trackingInstructions !== TRACKING_INSTRUCTIONS) fail("Prepared tracking instructions are incompatible.");
  if (!Array.isArray(prepared.allowedCharacters)) fail("allowedCharacters must be an array.");
  if (!Array.isArray(prepared.existingRelationships)) fail("existingRelationships must be an array.");
  if (hasPersonaContext && (prepared.activePersona?.alias !== "p0" || typeof prepared.activePersona?.id !== "string" || !prepared.activePersona.id || typeof prepared.activePersona?.name !== "string" || !prepared.activePersona.name)) fail("activePersona is invalid.");
  if (hasPersonaContext && !Array.isArray(prepared.existingPersonaPerceptions)) fail("existingPersonaPerceptions must be an array.");
  if (hasPersonaContext && prepared.personaStateRevision !== null && (!Number.isInteger(prepared.personaStateRevision) || prepared.personaStateRevision < 1)) fail("Persona state revision must be null or a positive integer.");


  const identity = identityFromReferences(prepared.allowedCharacters);
  const pairs = new Set();
  const existingRelationships = prepared.existingRelationships.map((inputRelationship) => {
    const relationship = decodePreparedRelationship(inputRelationship, identity);
    const key = pairKey(relationship);
    if (pairs.has(key)) fail("Prepared relationships must not contain duplicate pairs.");
    pairs.add(key);
    return relationship;
  });

  if (!prepared.trackingEnabled && existingRelationships.length > 0) {
    fail("Disabled tracking context must not include relationship state.");
  }
  return {
    trackingEnabled: prepared.trackingEnabled,
    allowedCharacters: prepared.allowedCharacters,
    existingRelationships,
    stateRevision: prepared.stateRevision,
    activePersona: prepared.activePersona ?? null,
    existingPersonaPerceptions: prepared.existingPersonaPerceptions ?? [],
    personaStateRevision: prepared.personaStateRevision ?? null,
  };
}

function relationshipValuesMatch(relationship, proposed) {
  return relationship &&
    relationship.state === proposed.state &&
    relationship.label === proposed.label &&
    relationship.description === proposed.description &&
    relationship.colorCategory === proposed.colorCategory;
}

export function buildRunDiagnostics(relationships, existingRelationships, storedState) {
  const existingByPair = new Map(existingRelationships.map((relationship) => [pairKey(relationship), relationship]));
  const storedByPair = new Map((storedState?.relationships ?? []).map((relationship) => [pairKey(relationship), relationship]));
  let proposedUpdates = 0;
  let savedUpdates = 0;
  let ignoredLockedUpdates = 0;
  for (const proposed of relationships) {
    if (relationshipValuesMatch(existingByPair.get(pairKey(proposed)), proposed)) continue;
    proposedUpdates += 1;
    const stored = storedByPair.get(pairKey(proposed));
    if (stored?.manuallyLocked && !relationshipValuesMatch(stored, proposed)) ignoredLockedUpdates += 1;
    else if (relationshipValuesMatch(stored, proposed)) savedUpdates += 1;
  }
  return {
    schemaVersion: 1,
    outcome: "processed",
    proposedUpdates,
    savedUpdates,
    ignoredLockedUpdates,
  };
}

export async function applyValidatedAutomaticSnapshot(repository, chatId, resultData, {
  allowedCharacters,
  existingRelationships,
  stateRevision,
  evidenceText = "",
}) {
  const relationships = normalizeAutomaticRelationshipResult(
    resultData,
    allowedCharacters,
    existingRelationships,
    { evidenceText },
  );
  const storedState = await repository.applyAutomaticSnapshot(chatId, relationships, {
    expectedStateRevision: stateRevision,
    stalePolicy: "skip",
  });
  return {
    relationships,
    storedState,
    diagnostics: buildRunDiagnostics(relationships, existingRelationships, storedState),
  };
}

export async function applyValidatedHistoryDelta(repository, chatId, resultData, {
  allowedCharacters,
  existingRelationships,
  stateRevision,
  evidenceText = "",
}) {
  const relationships = normalizeHistoryRelationshipDelta(
    resultData,
    allowedCharacters,
    existingRelationships,
    { evidenceText },
  );
  const storedState = await repository.applyAutomaticSnapshot(chatId, relationships, {
    expectedStateRevision: stateRevision,
    stalePolicy: "reject",
  });
  return {
    relationships,
    storedState,
    diagnostics: buildRunDiagnostics(relationships, existingRelationships, storedState),
  };
}

export async function applyValidatedAutomaticDelta(repository, chatId, resultData, {
  allowedCharacters,
  existingRelationships,
  stateRevision,
  evidenceText = "",
}) {
  const relationships = normalizeAutomaticRelationshipDelta(
    resultData,
    allowedCharacters,
    existingRelationships,
    { evidenceText },
  );
  const storedState = relationships.length > 0
    ? await repository.applyAutomaticSnapshot(chatId, relationships, {
      expectedStateRevision: stateRevision,
      stalePolicy: "skip",
    })
    : { relationships: existingRelationships };
  return {
    relationships,
    storedState,
    diagnostics: buildRunDiagnostics(relationships, existingRelationships, storedState),
  };
}

function consumedResult(result, diagnostics) {
  return {
    ...result,
    type: "context_injection",
    data: { text: "", diagnostics },
    success: true,
    error: null,
  };
}

function automaticResultData(result, parseJsonish) {
  if (result.type !== "context_injection") fail("Relationship Tracker received an unexpected result type.");
  const envelope = requireRecord(result.data, "Relationship Tracker text result");
  requireExactKeys(envelope, ["text"], "Relationship Tracker text result");
  if (typeof envelope.text !== "string" || envelope.text.trim().length === 0) {
    fail("Relationship Tracker text result must contain non-empty JSON text.");
  }
  try {
    return parseJsonish(envelope.text);
  } catch {
    fail("Relationship Tracker text result was not valid JSON.");
  }
}

export function createAutomaticTrackingRuntime(repository, activity, {
  parseJsonish = JSON.parse,
  personaRepository = null,
} = {}) {
  if (typeof repository?.getTrackingSnapshot !== "function" || typeof repository?.applyAutomaticSnapshot !== "function") {
    throw new Error("Relationship Tracker requires its canonical tracking repository.");
  }
  if (typeof parseJsonish !== "function") throw new Error("Relationship Tracker requires a JSON parser.");
  if (personaRepository !== null && (typeof personaRepository?.getSnapshot !== "function" || typeof personaRepository?.applyAutomaticPerceptions !== "function")) {
    throw new Error("Relationship Tracker requires its persona tracking repository.");
  }

  return Object.freeze({
    async prepareContext({ agent, context }) {
      if (agent?.type !== "relationship-tracker") fail("Relationship Tracker received the wrong agent type.");
      if (context?.chatMode !== "roleplay") return null;
      const token = activity?.begin?.(context.chatId, "automatic");
      try {
        const snapshot = await repository.getTrackingSnapshot(context.chatId);
        const personaSnapshot = personaRepository ? await personaRepository.getSnapshot(context.chatId) : null;
        return buildPreparedTrackingContext(snapshot, personaSnapshot);
      } catch (error) {
        if (token !== undefined) activity.finish(context.chatId, token);
        throw error;
      }
    },

    async finalizeResult({ agent, context, preparedContext, result }) {
      try {
        if (agent?.type !== "relationship-tracker") fail("Relationship Tracker received the wrong agent type.");
        if (!result?.success) return result;
        const resultData = automaticResultData(result, parseJsonish);
        const prepared = normalizePreparedTrackingContext(preparedContext, context?.chatId);
        const combined = personaRepository && prepared.activePersona ? requireRecord(resultData, "Relationship Tracker combined result") : null;
        if (combined) requireExactKeys(combined, ["u", "p"], "Relationship Tracker combined result");
        const cardResultData = combined ? { u: combined.u } : resultData;
        if (!prepared.trackingEnabled) {
          return consumedResult(result, {
            schemaVersion: 1,
            outcome: "tracking_disabled",
            proposedUpdates: 0,
            savedUpdates: 0,
            ignoredLockedUpdates: 0,
          });
        }
        const evidenceText = typeof context?.mainResponse === "string" ? context.mainResponse : "";
        const applied = await applyValidatedAutomaticDelta(repository, context.chatId, cardResultData, {
          ...prepared,
          evidenceText,
        });
        let personaUpdates = 0;
        if (personaRepository && prepared.activePersona) {
          const personaApplied = await applyPersonaDelta(personaRepository, context.chatId, combined.p, {
            allowedCharacters: prepared.allowedCharacters,
            personaSnapshot: {
              persona: { id: prepared.activePersona.id, name: prepared.activePersona.name },
              perceptions: prepared.existingPersonaPerceptions,
            },
            personaStateRevision: prepared.personaStateRevision ?? null,
            evidenceText,
          }, "skip");
          personaUpdates = personaApplied.updates.length;
        }
        return consumedResult(result, prepared.activePersona
          ? { ...applied.diagnostics, personaUpdates }
          : applied.diagnostics);
      } finally {
        activity?.finishSource?.(context?.chatId, "automatic");
      }
    },
  });
}
