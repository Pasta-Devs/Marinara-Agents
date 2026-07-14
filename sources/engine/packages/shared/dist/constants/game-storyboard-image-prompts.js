export const GAME_STORYBOARD_IMAGE_PROMPT_TEMPLATE_ID = "game-scene-illustration";
export const STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE_ID = "storyboard-illustration";
export const GAME_STORYBOARD_IMAGE_PROMPT_TEMPLATE_VARIABLES = [
    "sceneTitleLine",
    "scenePrompt",
    "narrativePurposeLine",
    "charactersLine",
    "referenceHandlingLine",
    "appearanceNotesBlock",
    "artDirectionLine",
    "imagePromptInstructionsLine",
];
export const GAME_STORYBOARD_IMAGE_PROMPT_TEMPLATE = [
    "${sceneTitleLine}",
    "Scene moment: ${scenePrompt}",
    "${narrativePurposeLine}",
    "${charactersLine}",
    "${referenceHandlingLine}",
    "${appearanceNotesBlock}",
    "${artDirectionLine}",
    "${imagePromptInstructionsLine}",
].join("\n");
export const STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE = [
    "${sceneTitleLine}",
    "Storyboard keyframe: ${scenePrompt}",
    "${referenceHandlingLine}",
    "${appearanceNotesBlock}",
    "${artDirectionLine}",
    "${imagePromptInstructionsLine}",
].join("\n");
export const GAME_STORYBOARD_IMAGE_BUILT_IN_PROMPT_TEMPLATES = [
    {
        id: GAME_STORYBOARD_IMAGE_PROMPT_TEMPLATE_ID,
        name: "Game Scene Illustration",
        description: "Uses the standard Game Mode scene-illustration formatter. Existing chats keep this behavior by default.",
        promptTemplate: GAME_STORYBOARD_IMAGE_PROMPT_TEMPLATE,
    },
    {
        id: STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE_ID,
        name: "Storyboard Illustration",
        description: "Keeps the planner's keyframe description primary while adding character references, appearance, campaign art direction, and image instructions.",
        promptTemplate: STORYBOARD_OPTIMIZED_IMAGE_PROMPT_TEMPLATE,
    },
];
//# sourceMappingURL=game-storyboard-image-prompts.js.map