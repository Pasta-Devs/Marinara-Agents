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
/** Server app-setting key for Roleplay Chat Summary prompt templates shared across all roleplays. */
export const CHAT_SUMMARY_PROMPT_SETTINGS_KEY = "chat-summary-prompts";
/**
 * Bounds for `ChatMetadata.summaryTailMessages` — the single source of truth for
 * the tail limits, shared by the server resolver (read) and the popover slider
 * (write) so display and persistence can't drift. `DEFAULT` applies only when the
 * value is unset; an explicit `MIN` (0) means "hide the whole batch".
 */
export const SUMMARY_TAIL_MESSAGES = { MIN: 0, MAX: 50, DEFAULT: 10 };
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