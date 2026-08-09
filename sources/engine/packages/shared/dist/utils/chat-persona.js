/**
 * Resolve the Persona visible to a chat. Explicit chat selection always wins.
 * Conversation may use the globally active Persona for its account-style UX;
 * Roleplay and Game remain Persona-less unless selected.
 */
export function resolveChatPersonaCandidate(personas, chatPersonaId, chatMode) {
    return ((chatPersonaId ? personas.find((persona) => persona.id === chatPersonaId) : null) ??
        (chatMode === "conversation"
            ? personas.find((persona) => persona.isActive === "true" || persona.isActive === true)
            : null) ??
        null);
}
//# sourceMappingURL=chat-persona.js.map