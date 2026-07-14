import { CHAT_MODE_CAPABILITIES } from "./chat-mode-capabilities.js";
export const CHAT_MODES = {
    conversation: {
        id: "conversation",
        name: "Conversation",
        description: "A straightforward AI conversation — no roleplay elements.",
        icon: "💬",
        defaultAgents: [...CHAT_MODE_CAPABILITIES.conversation.defaultAgentIds],
    },
    roleplay: {
        id: "roleplay",
        name: "Roleplay",
        description: "Immersive roleplay with characters, game state tracking, and world simulation.",
        icon: "🎭",
        defaultAgents: [...CHAT_MODE_CAPABILITIES.roleplay.defaultAgentIds],
    },
    visual_novel: {
        id: "visual_novel",
        name: "Roleplay (Legacy)",
        description: "Legacy roleplay chats retained for import and existing conversation compatibility.",
        icon: "🎮",
        defaultAgents: [...CHAT_MODE_CAPABILITIES.visual_novel.defaultAgentIds],
    },
    game: {
        id: "game",
        name: "Game",
        description: "AI-managed singleplayer RPG with a Game Master, party members, sessions, and dice.",
        icon: "🎲",
        defaultAgents: [...CHAT_MODE_CAPABILITIES.game.defaultAgentIds],
    },
};
//# sourceMappingURL=chat-modes.js.map