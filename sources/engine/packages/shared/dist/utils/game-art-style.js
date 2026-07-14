/**
 * Resolve the campaign-level visual style that should be sent to image prompt builders.
 * Existing games default to enabled; only an explicit false disables the stored style.
 */
export function resolveGameSetupArtStylePrompt(setupConfig) {
    if (!setupConfig || setupConfig.useCampaignArtStyle === false)
        return "";
    return typeof setupConfig.artStylePrompt === "string" ? setupConfig.artStylePrompt.trim() : "";
}
//# sourceMappingURL=game-art-style.js.map