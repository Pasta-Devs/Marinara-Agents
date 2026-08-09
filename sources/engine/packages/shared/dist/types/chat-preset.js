// ──────────────────────────────────────────────
// Chat Settings Profile Types
// Legacy exported type names retain "ChatPreset" for storage/API compatibility.
// ──────────────────────────────────────────────
// Reusable bundles of chat settings that the user can apply as defaults
// when creating new chats. One "active" profile per chat mode determines
// the starting state for any newly created chat in that mode.
//
// What profiles DO carry: connection, prompt preset selection, and most metadata
// (agents, tools, lorebook settings, translation, advanced parameters,
// context limit, memory recall, discord mirror, etc.).
//
// What profiles DO NOT carry: per-chat identity (name, characters,
// persona, group, sprites, scene prompt, generated summaries, tags,
// ephemeral lorebook overrides, generated schedules, scene lifecycle
// state, connected chat link, hierarchical map state, folder/sort placement).
/** Metadata keys that must NOT be saved into a profile (chat-specific). */
export const CHAT_PRESET_EXCLUDED_METADATA_KEYS = [
    // Generated summaries stay with the chat; summary settings can still be profiled.
    "summary",
    "summaryEntries",
    "lastAutomaticSummaryMessageId",
    "daySummaries",
    "weekSummaries",
    "tags",
    "appliedChatPresetId",
    "agentVariables",
    "presetChoices",
    "spriteCharacterIds",
    "spritePlacements",
    "spriteCharacterVisualSettings",
    "entryStateOverrides",
    "entryTimingStates",
    "trackerStatIconOverrides",
    "groupScenarioOverride",
    "groupScenarioText",
    "characterSchedules",
    "scheduleWeekStart",
    "spotifyRecentTracks",
    "autonomousUnreadCount",
    "autonomousUnreadCharacterIds",
    "autonomousUnreadAt",
    "sceneOriginChatId",
    "sceneInitiatorCharId",
    "sceneDescription",
    "sceneScenario",
    "sceneSystemPrompt",
    "sceneRating",
    "sceneStatus",
    "sceneConversationContext",
    "sceneRelationshipHistory",
    "sceneBackground",
    "activeSceneChatId",
    "sceneBusyCharIds",
    // Lorebooks are owned by the chat, never by the profile.
    "activeLorebookIds",
    // Hierarchical Maps definitions and per-chat editing choices stay with the chat.
    "spatialContext",
    "spatialContextHierarchyProfile",
    "spatialMapGenerationPreferences",
    // Generated Game state is session identity/history, not reusable setup.
    "gameId",
    "gameSessionNumber",
    "gameSessionStatus",
    "gameIntroPresented",
    "gameCurrentSessionStartedAt",
    "gameActiveState",
    "gameGmCharacterId",
    "gamePartyCharacterIds",
    "gamePartyChatId",
    "gameMap",
    "gameMaps",
    "activeGameMapId",
    "gameInitialMapFallback",
    "gamePreviousSessionSummaries",
    "gameStoryArc",
    "gamePlotTwists",
    "gameDialogueChatId",
    "gameCombatChatId",
    "gameCombatState",
    "gameNpcs",
    "gameLastIllustrationTurn",
    "gameLastIllustrationSessionNumber",
    "gameLastIllustrationTag",
    "gameRecentSpotifyTracks",
    "gameLorebookKeeperLorebookId",
    "gameLorebookKeeperLastRun",
    "gameBlueprint",
    "gameCharacterCards",
    "gameWidgetState",
    "gameMorale",
    "lastMapPosition",
];
/** Top-level chat keys that CAN be saved into a profile. */
export const CHAT_PRESET_INCLUDED_CHAT_KEYS = ["connectionId", "promptPresetId"];
//# sourceMappingURL=chat-preset.js.map