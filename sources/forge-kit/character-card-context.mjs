function forgeCharacterCardFields(card) {
  return Object.fromEntries(
    ["description", "personality", "backstory", "appearance"].map((field) => [
      field,
      typeof card?.[field] === "string" ? card[field] : "",
    ]),
  );
}

/** Read current linked cards for this request only. These copies are prompt input, never saved units. */
export async function forgeHydrateStoryCharacters(units, readCard, logger) {
  const reads = new Map();
  const read = async (cardId) => {
    try {
      const card = await readCard(cardId);
      if (card && typeof card === "object" && !Array.isArray(card)) return forgeCharacterCardFields(card);
    } catch {
      // Missing and failed reads keep the same unit's legacy characterization available.
    }
    logger?.warn?.(
      "[gacha-forge] linked character card %s could not be read; using the saved character summary",
      cardId,
    );
    return null;
  };
  return Promise.all(
    (Array.isArray(units) ? units : []).map(async (unit) => {
      if (!unit || typeof unit !== "object") return unit;
      const copy = { ...unit };
      delete copy.forgeCardCanon;
      if (unit.kind !== "character" || typeof unit.cardId !== "string" || !unit.cardId) return copy;
      if (!reads.has(unit.cardId)) reads.set(unit.cardId, read(unit.cardId));
      const canon = await reads.get(unit.cardId);
      if (canon) copy.forgeCardCanon = canon;
      return copy;
    }),
  );
}

/** Only these authored fields define the character; scenario, dialogue and metadata are not references. */
export function forgeFormatCharacterCardReference(card, name = card?.name) {
  if (!card || typeof card !== "object") return "";
  return (
    `CANONICAL CHARACTER CARD — current player-authored reference for ${name || "(unnamed)"}:\n` +
    JSON.stringify(forgeCharacterCardFields(card), null, 2)
  );
}

/** Retain the game kit and current outfit, with full authored canon replacing generated summaries. */
export function forgeFormatStoryCharacters(legacyFormatter, units, outfit = false) {
  const characters = Array.isArray(units) ? units : [];
  const linked = characters.filter((unit) => unit?.kind === "character" && unit.forgeCardCanon);
  if (!linked.length) return legacyFormatter(units, outfit);
  const legacy = legacyFormatter(
    characters.map((unit) =>
      unit?.kind === "character" && unit.forgeCardCanon ? { ...unit, description: "", personality: "" } : unit,
    ),
    outfit,
  );
  return [legacy, ...linked.map((unit) => forgeFormatCharacterCardReference(unit.forgeCardCanon, unit.name))]
    .filter(Boolean)
    .join("\n\n");
}

/** A Character Story may name its focus only by pronoun. Resolve its forced ID within this run's documents. */
export function forgeIncludeStoryFocusCharacters(documents, matchedUnits, forcedIds = []) {
  const selected = [...matchedUnits];
  const forced = new Set(forcedIds);
  for (const document of documents) {
    const unit = document?.data;
    if (forced.has(document?.id) && unit?.kind === "character" && !selected.includes(unit)) selected.push(unit);
  }
  return selected;
}

/** Call after context fitting, immediately before sending these messages to the provider. */
export function logForgeStoryPrompt(runtime, label, messages, options = {}) {
  const override =
    options.debugMode === true ||
    runtime?.isDebugAgentsEnabled?.() === true ||
    /^(1|true)$/iu.test(process.env.DEBUG_AGENTS || "");
  const logger = runtime?.logger;
  if (!override && logger?.isLevelEnabled?.("debug") === false) return;
  const format = "[debug/gacha-forge/%s] Messages sent to the provider: %s";
  if (typeof logger?.debugOverride === "function") {
    logger.debugOverride(override, format, label, JSON.stringify(messages));
  } else {
    logger?.[override ? "info" : "debug"]?.(format, label, JSON.stringify(messages));
  }
}
