import { CHAT_SUMMARY_PROMPT_MAX_LENGTH, DEFAULT_CHAT_SUMMARY_COMBINE_PROMPT, LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT_ID, } from "../constants/agent-prompts.js";
export function isLongTermMemoryChatSummaryPromptAllowed(chatMetadata) {
    return (chatMetadata.enableAgents === true &&
        Array.isArray(chatMetadata.activeAgentIds) &&
        chatMetadata.activeAgentIds.includes("long-term-memory"));
}
function normalizeTemplates(value) {
    if (!Array.isArray(value))
        return [];
    const seen = new Set();
    const templates = [];
    for (const item of value) {
        if (!item || typeof item !== "object" || Array.isArray(item))
            continue;
        const record = item;
        const id = typeof record.id === "string" ? record.id.trim() : "";
        const name = typeof record.name === "string" ? record.name.trim() : "";
        const prompt = typeof record.prompt === "string"
            ? record.prompt.trim().slice(0, CHAT_SUMMARY_PROMPT_MAX_LENGTH)
            : "";
        if (!id || !name || !prompt || id === LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT_ID || seen.has(id))
            continue;
        seen.add(id);
        templates.push({ id, name, prompt });
    }
    return templates;
}
export function normalizeChatSummaryPromptSettings(value) {
    let parsed = value;
    if (typeof parsed === "string") {
        try {
            parsed = JSON.parse(parsed);
        }
        catch {
            parsed = null;
        }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { templates: [], activeTemplateId: null, combinePrompt: DEFAULT_CHAT_SUMMARY_COMBINE_PROMPT };
    }
    const record = parsed;
    const templates = normalizeTemplates(record.templates);
    const activeTemplateId = typeof record.activeTemplateId === "string" && record.activeTemplateId.trim()
        ? record.activeTemplateId.trim()
        : null;
    return {
        templates,
        combinePrompt: typeof record.combinePrompt === "string" && record.combinePrompt.trim()
            ? record.combinePrompt.trim().slice(0, CHAT_SUMMARY_PROMPT_MAX_LENGTH)
            : DEFAULT_CHAT_SUMMARY_COMBINE_PROMPT,
        activeTemplateId: activeTemplateId &&
            (activeTemplateId === LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT_ID ||
                templates.some((template) => template.id === activeTemplateId))
            ? activeTemplateId
            : null,
    };
}
//# sourceMappingURL=chat-summary-prompt-settings.js.map