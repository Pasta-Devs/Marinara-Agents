// ──────────────────────────────────────────────
// Professor Mari Workspace Agent Contracts
// ──────────────────────────────────────────────
export const MARI_STARTER_CHIPS = [
    {
        id: "starter-character",
        label: "Create a character",
        entity: "characters",
        icon: "UserPlus",
        prompt: "Let's create a new character together - guide me through it step by step.",
    },
    {
        id: "starter-lorebook",
        label: "Create a lorebook",
        entity: "lorebooks",
        icon: "BookOpen",
        prompt: "Help me build a new lorebook, one entry at a time.",
    },
    {
        id: "starter-persona",
        label: "Create a persona",
        entity: "personas",
        icon: "UserRound",
        prompt: "Help me create a persona for myself, step by step.",
    },
    {
        id: "starter-explore",
        label: "What can you do?",
        icon: "Wand2",
        prompt: "What kinds of things can you help me do here?",
    },
    {
        id: "starter-surprise",
        label: "Surprise me",
        icon: "Dices",
        prompt: "Surprise me - suggest something fun we could create.",
    },
];
const MARI_CHIP_ENTITIES = new Set([
    "characters",
    "lorebooks",
    "personas",
    "presets",
    "connections",
    "agents",
    "settings",
    "chat",
]);
const MARI_CHIP_ENTITY_ALIASES = {
    character: "characters",
    characters: "characters",
    lorebook: "lorebooks",
    lorebooks: "lorebooks",
    persona: "personas",
    personas: "personas",
    preset: "presets",
    presets: "presets",
    connection: "connections",
    connections: "connections",
    agent: "agents",
    agents: "agents",
    setting: "settings",
    settings: "settings",
    chat: "chat",
};
const MARI_CHIP_TONES = new Set(["default", "danger", "caution", "success"]);
function truncateMariChipText(value, maxLength) {
    const trimmed = value.trim();
    return trimmed.length > maxLength ? trimmed.slice(0, maxLength).trimEnd() : trimmed;
}
const CHIP_LABEL_KEYS = ["label", "text", "title", "name", "option"];
const CHIP_PROMPT_KEYS = ["prompt", "message", "value", "send", "query", "reply"];
function firstStringField(record, keys) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === "string" && value.trim())
            return value;
    }
    return undefined;
}
function normalizeMariChipEntity(value) {
    if (typeof value !== "string")
        return undefined;
    const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "_");
    if (MARI_CHIP_ENTITIES.has(normalized))
        return normalized;
    return MARI_CHIP_ENTITY_ALIASES[normalized];
}
/**
 * Models frequently drift from the exact { label, prompt } contract (plain string arrays,
 * a "text"/"title" key instead of "label", a missing "prompt" that should just reuse the
 * label, etc). Strict validation would silently discard the whole chip in those cases, so
 * this accepts the common near-miss shapes rather than requiring exact compliance.
 */
export function sanitizeMariSuggestionChips(raw, options = {}) {
    if (!Array.isArray(raw))
        return [];
    const maxChips = options.maxChips ?? 6;
    const chips = [];
    for (const entry of raw) {
        const record = typeof entry === "string" ? { label: entry, prompt: entry } : entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
        if (Object.keys(record).length === 0)
            continue;
        const rawLabel = firstStringField(record, CHIP_LABEL_KEYS);
        const rawPrompt = firstStringField(record, CHIP_PROMPT_KEYS) ?? rawLabel;
        if (!rawLabel || !rawPrompt)
            continue;
        const label = truncateMariChipText(rawLabel, 40);
        const prompt = truncateMariChipText(rawPrompt, 400);
        if (!label || !prompt)
            continue;
        const chip = {
            id: typeof record.id === "string" && record.id.trim()
                ? truncateMariChipText(record.id, 80)
                : `suggestion-${chips.length + 1}`,
            label,
            prompt,
        };
        const entity = normalizeMariChipEntity(record.entity);
        if (entity)
            chip.entity = entity;
        if (typeof record.icon === "string" && record.icon.trim()) {
            chip.icon = truncateMariChipText(record.icon, 40);
        }
        if (typeof record.tone === "string" && MARI_CHIP_TONES.has(record.tone)) {
            chip.tone = record.tone;
        }
        chips.push(chip);
        if (chips.length >= maxChips)
            break;
    }
    return chips;
}
const PLAN_STEP_FIELD_KEY_KEYS = ["fieldKey", "key", "field", "name"];
const PLAN_STEP_QUESTION_KEYS = ["question", "prompt", "label", "text"];
/** Same tolerant-parsing philosophy as sanitizeMariSuggestionChips - accept near-miss shapes. */
export function sanitizeMariGuidedPlan(raw, options = {}) {
    if (!Array.isArray(raw))
        return [];
    const maxSteps = options.maxSteps ?? 8;
    const maxChipsPerStep = options.maxChipsPerStep ?? 5;
    const steps = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
            continue;
        const record = entry;
        const rawFieldKey = firstStringField(record, PLAN_STEP_FIELD_KEY_KEYS);
        const rawQuestion = firstStringField(record, PLAN_STEP_QUESTION_KEYS) ?? rawFieldKey;
        if (!rawFieldKey || !rawQuestion)
            continue;
        const chips = sanitizeMariSuggestionChips(record.chips ?? record.options ?? record.suggestions, { maxChips: maxChipsPerStep });
        if (chips.length === 0)
            continue;
        steps.push({
            fieldKey: truncateMariChipText(rawFieldKey, 40).replace(/\s+/g, "_"),
            question: truncateMariChipText(rawQuestion, 120),
            chips,
        });
        if (steps.length >= maxSteps)
            break;
    }
    return steps;
}
//# sourceMappingURL=professor-mari-workspace.js.map