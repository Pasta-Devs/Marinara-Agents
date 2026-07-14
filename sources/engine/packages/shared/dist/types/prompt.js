// ──────────────────────────────────────────────
// Prompt System Types
// ──────────────────────────────────────────────
export const GENERATION_PARAMETER_SEND_KEYS = [
    "temperature",
    "maxTokens",
    "topP",
    "topK",
    "frequencyPenalty",
    "presencePenalty",
    "reasoningEffort",
    "verbosity",
];
/** Well-known built-in marker identifiers (match ST). */
export const BUILTIN_MARKERS = {
    MAIN: "main",
    NSFW: "nsfw",
    JAILBREAK: "jailbreak",
    ENHANCE_DEFINITIONS: "enhanceDefinitions",
    CHAR_DESCRIPTION: "charDescription",
    CHAR_PERSONALITY: "charPersonality",
    SCENARIO: "scenario",
    PERSONA_DESCRIPTION: "personaDescription",
    DIALOGUE_EXAMPLES: "dialogueExamples",
    CHAT_HISTORY: "chatHistory",
    WORLD_INFO_BEFORE: "worldInfoBefore",
    WORLD_INFO_AFTER: "worldInfoAfter",
};
//# sourceMappingURL=prompt.js.map