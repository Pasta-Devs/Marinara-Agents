// ──────────────────────────────────────────────
// Agent System Types
// ──────────────────────────────────────────────
import { BUILT_IN_AGENT_MANIFESTS, replaceBuiltInAgentManifestRegistry, } from "../features/agents/agent-registry.js";
const AGENT_PHASE_VALUES = new Set(["pre_generation", "parallel", "post_processing"]);
export function normalizeAgentPhaseValue(value, fallback = "post_processing") {
    return typeof value === "string" && AGENT_PHASE_VALUES.has(value) ? value : fallback;
}
export function normalizeAgentPhaseForType(_agentType, configuredPhase, fallback = "post_processing") {
    // Keep the historical helper name for call-site compatibility, but do not
    // coerce built-ins by type. If the agent editor lets a user choose a phase,
    // that valid phase must survive storage, UI hydration, and runtime resolution.
    return normalizeAgentPhaseValue(configuredPhase, fallback);
}
export const DEFAULT_AGENT_AUTHOR = "Pasta Devs";
export const DEFAULT_AGENT_PROMPT_TEMPLATE_ID = "default";
function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
export function parseAgentSettingsRecord(value) {
    if (!value)
        return {};
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return isRecord(parsed) ? parsed : {};
        }
        catch {
            return {};
        }
    }
    return isRecord(value) ? value : {};
}
export const AGENT_CONFIG_DELETED_SETTING_KEY = "deletedFromLibrary";
export function isAgentConfigDeleted(settings) {
    return parseAgentSettingsRecord(settings)[AGENT_CONFIG_DELETED_SETTING_KEY] === true;
}
export function markAgentConfigDeletedSettings(settings) {
    return {
        ...parseAgentSettingsRecord(settings),
        [AGENT_CONFIG_DELETED_SETTING_KEY]: true,
    };
}
function normalizePromptTemplateId(value, fallback) {
    const raw = typeof value === "string" ? value.trim() : "";
    const normalized = raw
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/(^-|-$)/g, "");
    return normalized || fallback;
}
function normalizePromptTemplateName(value, fallback) {
    const raw = typeof value === "string" ? value.trim() : "";
    return raw || fallback;
}
function getUniquePromptTemplateId(id, usedIds) {
    let candidate = id;
    let attempt = 2;
    while (usedIds.has(candidate) || candidate === DEFAULT_AGENT_PROMPT_TEMPLATE_ID) {
        candidate = `${id}-${attempt}`;
        attempt++;
    }
    usedIds.add(candidate);
    return candidate;
}
export function normalizeAgentPromptTemplateOptions(value) {
    const entries = Array.isArray(value)
        ? value
        : isRecord(value)
            ? Object.entries(value).map(([id, entry]) => (isRecord(entry) ? { ...entry, id } : entry))
            : [];
    const usedIds = new Set();
    const options = [];
    for (const [index, entry] of entries.entries()) {
        if (!isRecord(entry))
            continue;
        const promptTemplate = typeof entry.promptTemplate === "string"
            ? entry.promptTemplate
            : typeof entry.prompt === "string"
                ? entry.prompt
                : "";
        if (!promptTemplate.trim())
            continue;
        const name = normalizePromptTemplateName(entry.name ?? entry.label, `Option ${index + 1}`);
        const id = getUniquePromptTemplateId(normalizePromptTemplateId(entry.id, `option-${index + 1}`), usedIds);
        const description = typeof entry.description === "string" ? entry.description.trim() : "";
        options.push({
            id,
            name,
            promptTemplate,
            ...(description ? { description } : {}),
        });
    }
    return options;
}
export function getAgentPromptTemplateOptions(input) {
    const settings = parseAgentSettingsRecord(input.settings);
    const basePromptTemplate = input.promptTemplate?.trim() ? input.promptTemplate : (input.fallbackPromptTemplate ?? "");
    const defaultName = normalizePromptTemplateName(settings.defaultPromptTemplateName, "Default");
    const defaultDescription = typeof settings.defaultPromptTemplateDescription === "string"
        ? settings.defaultPromptTemplateDescription.trim()
        : "";
    return [
        {
            id: DEFAULT_AGENT_PROMPT_TEMPLATE_ID,
            name: defaultName,
            promptTemplate: basePromptTemplate,
            ...(defaultDescription ? { description: defaultDescription } : {}),
        },
        ...normalizeAgentPromptTemplateOptions(settings.promptTemplates),
    ];
}
export function resolveDefaultAgentPromptTemplateId(settingsValue) {
    const settings = parseAgentSettingsRecord(settingsValue);
    const configuredId = normalizePromptTemplateId(settings.defaultPromptTemplateId, DEFAULT_AGENT_PROMPT_TEMPLATE_ID);
    if (configuredId === DEFAULT_AGENT_PROMPT_TEMPLATE_ID)
        return configuredId;
    return normalizeAgentPromptTemplateOptions(settings.promptTemplates).some((option) => option.id === configuredId)
        ? configuredId
        : DEFAULT_AGENT_PROMPT_TEMPLATE_ID;
}
export function normalizeAgentPromptTemplateSelectionMap(value) {
    if (!isRecord(value))
        return {};
    const selections = {};
    for (const [agentType, promptTemplateId] of Object.entries(value)) {
        if (typeof promptTemplateId !== "string")
            continue;
        const cleanedType = agentType.trim();
        const cleanedId = normalizePromptTemplateId(promptTemplateId, "");
        if (!cleanedType || !cleanedId)
            continue;
        selections[cleanedType] = cleanedId;
    }
    return selections;
}
export function resolveAgentPromptTemplate(input) {
    const explicitSelectedId = normalizePromptTemplateId(input.selectedPromptTemplateId, "");
    const selectedId = explicitSelectedId || resolveDefaultAgentPromptTemplateId(input.settings);
    if (selectedId === DEFAULT_AGENT_PROMPT_TEMPLATE_ID) {
        return input.promptTemplate?.trim() ? input.promptTemplate : (input.fallbackPromptTemplate ?? "");
    }
    const option = getAgentPromptTemplateOptions(input).find((entry) => entry.id === selectedId);
    return (option?.promptTemplate ??
        (input.promptTemplate?.trim() ? input.promptTemplate : (input.fallbackPromptTemplate ?? "")));
}
/** Built-in agent type identifiers. */
export const BUILT_IN_AGENT_IDS = {
    WORLD_STATE: "world-state",
    PROSE_GUARDIAN: "prose-guardian",
    CONTINUITY: "continuity",
    EXPRESSION: "expression",
    ECHO_CHAMBER: "echo-chamber",
    DIRECTOR: "director",
    QUEST: "quest",
    ILLUSTRATOR: "illustrator",
    LOREBOOK_KEEPER: "lorebook-keeper",
    CARD_EVOLUTION_AUDITOR: "card-evolution-auditor",
    COMBAT: "combat",
    BACKGROUND: "background",
    CHARACTER_TRACKER: "character-tracker",
    PERSONA_STATS: "persona-stats",
    HTML: "html",
    SPOTIFY: "spotify",
    KNOWLEDGE_RETRIEVAL: "knowledge-retrieval",
    KNOWLEDGE_ROUTER: "knowledge-router",
    CUSTOM_TRACKER: "custom-tracker",
    HAPTIC: "haptic",
    CYOA: "cyoa",
};
export const RETIRED_BUILT_IN_AGENT_IDS = [
    "prompt-reviewer",
    "response-orchestrator",
    "schedule-planner",
    "chat-summary",
    "autonomous-messenger",
    "youtube",
    "secret-plot-driver",
];
const RETIRED_BUILT_IN_AGENT_ID_SET = new Set(RETIRED_BUILT_IN_AGENT_IDS);
export function isRetiredBuiltInAgentId(agentId) {
    return RETIRED_BUILT_IN_AGENT_ID_SET.has(agentId);
}
function toBuiltInAgentMeta(agent) {
    return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        author: agent.author ?? DEFAULT_AGENT_AUTHOR,
        phase: normalizeAgentPhaseForType(agent.id, agent.phase),
        enabledByDefault: agent.enabledByDefault,
        ...(agent.defaultInjectAsSection !== undefined ? { defaultInjectAsSection: agent.defaultInjectAsSection } : {}),
        category: agent.category,
        ...(agent.libraryHidden !== undefined ? { libraryHidden: agent.libraryHidden } : {}),
        ...(agent.runtimeDisabled !== undefined ? { runtimeDisabled: agent.runtimeDisabled } : {}),
        ...(agent.modeAllowlist !== undefined ? { modeAllowlist: [...agent.modeAllowlist] } : {}),
        ...(agent.promptTemplates !== undefined ? { promptTemplates: [...agent.promptTemplates] } : {}),
        ...(agent.execution !== undefined ? { execution: agent.execution } : {}),
    };
}
export const BUILT_IN_AGENTS = [];
export const BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS = {};
export const DEFAULT_AGENT_CONTEXT_SIZE = 5;
export const DEFAULT_AGENT_MAX_TOKENS = 4096;
export const MIN_AGENT_MAX_TOKENS = 128;
export const MAX_AGENT_MAX_TOKENS = 32768;
export const CUSTOM_AGENT_CAPABILITY_IDS = [
    "create_lorebooks",
    "edit_lorebooks",
    "edit_messages",
    "edit_trackers",
    "change_frontend_styling",
    "trigger_image_generation",
    "access_vectors",
    "edit_main_prompt",
];
const CUSTOM_AGENT_CAPABILITY_SET = new Set(CUSTOM_AGENT_CAPABILITY_IDS);
const CUSTOM_AGENT_RESULT_CAPABILITY = {
    text_rewrite: "edit_messages",
    lorebook_update: "edit_lorebooks",
    character_tracker_update: "edit_trackers",
    persona_stats_update: "edit_trackers",
    custom_tracker_update: "edit_trackers",
    quest_update: "edit_trackers",
    game_state_update: "edit_trackers",
    image_prompt: "trigger_image_generation",
    prompt_patch: "edit_main_prompt",
    frontend_theme_update: "change_frontend_styling",
};
function normalizeCapabilityMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return {};
    const output = {};
    for (const [key, enabled] of Object.entries(value)) {
        if (!CUSTOM_AGENT_CAPABILITY_SET.has(key) || enabled !== true)
            continue;
        output[key] = true;
    }
    return output;
}
export function normalizeCustomAgentCapabilities(settings) {
    const capabilities = normalizeCapabilityMap(settings?.customCapabilities ?? settings?.capabilities);
    const enabledToolsValue = settings?.enabledTools;
    const enabledTools = Array.isArray(enabledToolsValue) ? enabledToolsValue : [];
    const resultType = typeof settings?.resultType === "string" ? settings.resultType : null;
    if (settings?.lorebookWriteEnabled === true || enabledTools.includes("save_lorebook_entry")) {
        capabilities.edit_lorebooks = true;
    }
    if (resultType && Object.prototype.hasOwnProperty.call(CUSTOM_AGENT_RESULT_CAPABILITY, resultType)) {
        const capability = CUSTOM_AGENT_RESULT_CAPABILITY[resultType];
        if (capability)
            capabilities[capability] = true;
    }
    return capabilities;
}
export function customAgentHasCapability(settings, capability) {
    return normalizeCustomAgentCapabilities(settings)[capability] === true;
}
export function getCustomAgentResultCapability(resultType) {
    return CUSTOM_AGENT_RESULT_CAPABILITY[resultType] ?? null;
}
export function getDefaultBuiltInAgentSettings(agentType) {
    const builtIn = BUILT_IN_AGENT_MANIFESTS.find((agent) => agent.id === agentType);
    const settings = {
        maxTokens: DEFAULT_AGENT_MAX_TOKENS,
        ...(builtIn?.defaultSettings ?? {}),
    };
    if (builtIn) {
        settings.author = builtIn.author ?? DEFAULT_AGENT_AUTHOR;
    }
    if (builtIn?.promptTemplates?.length) {
        settings.promptTemplates = [...builtIn.promptTemplates];
    }
    if (builtIn?.defaultInjectAsSection) {
        settings.injectAsSection = true;
    }
    if (builtIn?.runInterval !== undefined) {
        settings.runInterval = builtIn.runInterval;
    }
    return settings;
}
const OBSOLETE_BUILT_IN_PROMPT_TEMPLATE_IDS = {
    illustrator: new Set(["illustration", "sketch"]),
};
export function mergeBuiltInAgentSettings(agentType, settings) {
    const parsed = parseAgentSettingsRecord(settings);
    const builtIn = BUILT_IN_AGENT_MANIFESTS.find((agent) => agent.id === agentType);
    if (!builtIn)
        return parsed;
    const defaults = getDefaultBuiltInAgentSettings(agentType);
    const merged = {
        ...defaults,
        ...parsed,
    };
    const defaultPromptTemplates = normalizeAgentPromptTemplateOptions(defaults.promptTemplates);
    const savedPromptTemplates = normalizeAgentPromptTemplateOptions(parsed.promptTemplates);
    const obsoleteIds = OBSOLETE_BUILT_IN_PROMPT_TEMPLATE_IDS[agentType] ?? new Set();
    const savedPromptTemplatesById = new Map(savedPromptTemplates.filter((entry) => !obsoleteIds.has(entry.id)).map((entry) => [entry.id, entry]));
    const usedIds = new Set();
    const mergedDefaultPromptTemplates = defaultPromptTemplates.map((defaultOption) => {
        usedIds.add(defaultOption.id);
        const savedOption = savedPromptTemplatesById.get(defaultOption.id);
        return savedOption ? { ...defaultOption, ...savedOption } : defaultOption;
    });
    const customPromptTemplates = savedPromptTemplates.filter((entry) => {
        if (obsoleteIds.has(entry.id) || usedIds.has(entry.id))
            return false;
        usedIds.add(entry.id);
        return true;
    });
    const promptTemplates = [...mergedDefaultPromptTemplates, ...customPromptTemplates];
    if (promptTemplates.length) {
        merged.promptTemplates = promptTemplates;
    }
    else {
        delete merged.promptTemplates;
    }
    return merged;
}
/** Recommended default tools for each built-in agent type. */
export const DEFAULT_AGENT_TOOLS = {};
export function replaceBuiltInAgentDefinitions(manifests) {
    replaceBuiltInAgentManifestRegistry(manifests);
    BUILT_IN_AGENTS.splice(0, BUILT_IN_AGENTS.length, ...manifests.map(toBuiltInAgentMeta));
    for (const key of Object.keys(BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS))
        delete BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS[key];
    for (const key of Object.keys(DEFAULT_AGENT_TOOLS))
        delete DEFAULT_AGENT_TOOLS[key];
    for (const agent of manifests) {
        if (agent.runInterval !== undefined)
            BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS[agent.id] = agent.runInterval;
        DEFAULT_AGENT_TOOLS[agent.id] = [...(agent.defaultTools ?? [])];
    }
}
/**
 * Single proposed edit to a character card field.
 *
 * Unlike LorebookUpdateResult, these edits are NEVER applied automatically —
 * the server emits them as an agent_result SSE event and the client shows
 * a confirmation modal. Character cards are more sensitive than lorebook
 * entries because they define the character's identity.
 */
export const EDITABLE_CHARACTER_CARD_FIELDS = [
    "description",
    "personality",
    "scenario",
    "first_mes",
    "mes_example",
    "creator_notes",
    "system_prompt",
    "post_history_instructions",
    "backstory",
    "appearance",
    "aboutMe",
];
//# sourceMappingURL=agent.js.map