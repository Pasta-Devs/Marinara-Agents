// ──────────────────────────────────────────────
// Chat Mode Capability Matrix
// ──────────────────────────────────────────────
// This is the shared source of truth for mode-specific settings and feature
// availability. UI code should render the common settings shell from this map
// instead of scattering mode checks across large components.
import { BUILT_IN_AGENTS, isRetiredBuiltInAgentId } from "../types/agent.js";
export const SHARED_CHAT_SETTINGS_SECTIONS = [
    "chat-name",
    "connection",
    "participants",
    "linked-chat",
    "lorebooks",
    "agents",
    "memory-recall",
    "discord-mirror",
    "function-calling",
    "translation",
    "advanced-parameters",
    "context-limit",
    "impersonation",
];
export const ROLEPLAY_AGENT_PICKER_HIDDEN_IDS = [];
export const CONVERSATION_AGENT_IDS = [];
// Conversation mode's About Me profile and update_about_me tool are core features,
// not downloadable agents. Conversation still permits user-authored custom agents.
export const CONVERSATION_ALLOWED_AGENT_IDS = [];
export const ROLEPLAY_DEFAULT_AGENT_IDS = [
    "world-state",
    "prose-guardian",
    "continuity",
    "expression",
];
export const VISUAL_NOVEL_DEFAULT_AGENT_IDS = [
    "world-state",
    "prose-guardian",
    "expression",
];
// Game mode has native GM/world-state/quest/combat/knowledge systems.
// Roleplay helper agents must not be exposed as per-game agent toggles here.
export const GAME_AGENT_IDS = [];
export const GAME_OPTIONAL_AGENT_IDS = [];
export const CHAT_MODE_CAPABILITIES = {
    conversation: {
        mode: "conversation",
        label: "Conversation",
        participantModel: "chat-participants",
        defaultAgentIds: CONVERSATION_AGENT_IDS,
        agentPolicy: {
            kind: "allowlist",
            defaultAgentIds: CONVERSATION_AGENT_IDS,
            allowedAgentIds: CONVERSATION_ALLOWED_AGENT_IDS,
        },
        sharedSections: SHARED_CHAT_SETTINGS_SECTIONS,
        modeSections: [
            "prompt-preset",
            "manual-replies",
            "autonomous-messaging",
            "conversation-commands",
            "cross-chat-awareness",
            "automatic-summarization",
        ],
        supportsChatSettingsPresets: true,
        supportsPromptPresets: true,
        supportsGroupChatControls: false,
        supportsSceneInstructions: false,
        supportsConnectedChat: true,
    },
    roleplay: {
        mode: "roleplay",
        label: "Roleplay",
        participantModel: "chat-participants",
        defaultAgentIds: ROLEPLAY_DEFAULT_AGENT_IDS,
        agentPolicy: {
            kind: "all",
            defaultAgentIds: ROLEPLAY_DEFAULT_AGENT_IDS,
            hiddenPickerAgentIds: ROLEPLAY_AGENT_PICKER_HIDDEN_IDS,
        },
        sharedSections: SHARED_CHAT_SETTINGS_SECTIONS,
        modeSections: ["chat-settings-presets", "prompt-preset", "scene-instructions", "group-chat", "conversation-notes"],
        supportsChatSettingsPresets: true,
        supportsPromptPresets: true,
        supportsGroupChatControls: true,
        supportsSceneInstructions: true,
        supportsConnectedChat: true,
    },
    visual_novel: {
        mode: "visual_novel",
        label: "Roleplay (Legacy)",
        participantModel: "chat-participants",
        defaultAgentIds: VISUAL_NOVEL_DEFAULT_AGENT_IDS,
        agentPolicy: {
            kind: "all",
            defaultAgentIds: VISUAL_NOVEL_DEFAULT_AGENT_IDS,
            hiddenPickerAgentIds: ROLEPLAY_AGENT_PICKER_HIDDEN_IDS,
        },
        sharedSections: SHARED_CHAT_SETTINGS_SECTIONS,
        modeSections: ["chat-settings-presets", "prompt-preset", "scene-instructions", "group-chat", "conversation-notes"],
        supportsChatSettingsPresets: true,
        supportsPromptPresets: true,
        supportsGroupChatControls: true,
        supportsSceneInstructions: true,
        supportsConnectedChat: true,
    },
    game: {
        mode: "game",
        label: "Game",
        participantModel: "game-party",
        defaultAgentIds: GAME_AGENT_IDS,
        agentPolicy: {
            kind: "allowlist",
            defaultAgentIds: GAME_AGENT_IDS,
            // Music DJ is allowed (opt-in via the game music toggle) but not on by default.
            allowedAgentIds: [...GAME_AGENT_IDS, ...GAME_OPTIONAL_AGENT_IDS, "spotify"],
        },
        sharedSections: SHARED_CHAT_SETTINGS_SECTIONS,
        modeSections: ["prompt-preset", "conversation-notes"],
        supportsChatSettingsPresets: false,
        supportsPromptPresets: true,
        supportsGroupChatControls: false,
        supportsSceneInstructions: false,
        supportsConnectedChat: true,
    },
};
export function getChatModeCapabilities(mode) {
    return CHAT_MODE_CAPABILITIES[mode ?? "roleplay"] ?? CHAT_MODE_CAPABILITIES.roleplay;
}
export function isAgentAvailableInChatMode(mode, agentId) {
    if (isRetiredBuiltInAgentId(agentId))
        return false;
    const normalizedMode = mode ?? "roleplay";
    const builtIn = BUILT_IN_AGENTS.find((agent) => agent.id === agentId);
    if (builtIn?.modeAllowlist?.length && !builtIn.modeAllowlist.includes(normalizedMode))
        return false;
    if (builtIn?.execution === "feature")
        return true;
    const policy = getChatModeCapabilities(mode).agentPolicy;
    if (policy.kind === "all")
        return true;
    if (!BUILT_IN_AGENTS.some((agent) => agent.id === agentId))
        return true;
    return policy.allowedAgentIds.includes(agentId);
}
export function isAgentHiddenFromChatSettingsPicker(mode, agentId) {
    const hidden = getChatModeCapabilities(mode).agentPolicy.hiddenPickerAgentIds ?? [];
    return hidden.includes(agentId);
}
//# sourceMappingURL=chat-mode-capabilities.js.map
