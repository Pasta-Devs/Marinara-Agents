// ──────────────────────────────────────────────
// Chat & Message Types
// ──────────────────────────────────────────────
export const CONVERSATION_COMMAND_KEYS = [
    "schedule_update",
    "cross_post",
    "selfie",
    "memory",
    "scene",
    "call",
    "uno",
    "chess",
    "poker",
    "eightball",
    "tic_tac_toe",
    "rock_paper_scissors",
    "music",
    "haptic",
    "influence",
    "note",
    "react",
];
/** Downloadable agent package that owns each optional Conversation command. */
export const CONVERSATION_COMMAND_AGENT_IDS = {
    selfie: "illustrator",
    call: "conversation-calls",
    uno: "uno",
    chess: "chess",
    poker: "poker",
    eightball: "eightball",
    tic_tac_toe: "tic-tac-toe",
    rock_paper_scissors: "rock-paper-scissors",
    music: "spotify",
    haptic: "haptic",
};
/** Server app-setting key for Roleplay Chat Summary prompt templates shared across all roleplays. */
export const CHAT_SUMMARY_PROMPT_SETTINGS_KEY = "chat-summary-prompts";
/**
 * Defaults for `ChatMetadata.summaryTailMessages`. `DEFAULT` applies only when
 * the value is unset; an explicit `MIN` (0) means "hide the whole batch".
 * There is intentionally no upper limit because the user controls the context
 * and model budget for this local app.
 */
export const SUMMARY_TAIL_MESSAGES = { MIN: 0, DEFAULT: 10 };
export function normalizeSummaryTailMessages(value) {
    const { MIN, DEFAULT } = SUMMARY_TAIL_MESSAGES;
    if (value === undefined || value === null)
        return DEFAULT;
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed) || parsed < MIN)
        return MIN;
    return parsed;
}
export const CHAT_SUMMARY_OUTPUT_TOKENS = { MIN: 1, MAX: 32768, DEFAULT: 4096 };
export function normalizeManualTrackerAgentTypes(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return {};
    const manualTypes = {};
    for (const [agentType, enabled] of Object.entries(value)) {
        const key = agentType.trim();
        if (key && enabled === true)
            manualTypes[key] = true;
    }
    return manualTypes;
}
//# sourceMappingURL=chat.js.map