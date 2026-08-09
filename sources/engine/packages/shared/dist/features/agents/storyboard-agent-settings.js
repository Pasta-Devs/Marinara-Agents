import { normalizeAgentPromptTemplateOptions } from "../../types/agent.js";
export const STORYBOARD_AGENT_ID = "storyboard";
function asRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return {};
    return value;
}
function normalizeId(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function normalizeIdList(value) {
    if (!Array.isArray(value))
        return [];
    return Array.from(new Set(value
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)));
}
function normalizeBoundedInteger(value, fallback, min, max) {
    if (value == null || value === "")
        return fallback;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed))
        return fallback;
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
function selectedId(value, options) {
    const id = normalizeId(value);
    return id && options.some((option) => option.id === id) ? id : (options[0]?.id ?? null);
}
export function normalizeStoryboardAgentSettings(value) {
    const settings = asRecord(value);
    const plannerTemplates = normalizeAgentPromptTemplateOptions(settings.promptTemplates).slice(0, 40);
    const illustrationTemplates = normalizeAgentPromptTemplateOptions(settings.illustrationTemplates).slice(0, 20);
    const videoTemplates = normalizeAgentPromptTemplateOptions(settings.videoTemplates).slice(0, 20);
    const roleplayEpisodeTemplates = normalizeAgentPromptTemplateOptions(settings.roleplayEpisodeTemplates).slice(0, 10);
    const roleplayStyleTemplates = normalizeAgentPromptTemplateOptions(settings.roleplayStyleTemplates).slice(0, 20);
    const roleplayAnimationTemplates = normalizeAgentPromptTemplateOptions(settings.roleplayAnimationTemplates).slice(0, 10);
    const roleplayOutputTemplates = normalizeAgentPromptTemplateOptions(settings.roleplayOutputTemplates).slice(0, 10);
    const plannerIds = new Set(plannerTemplates.map((template) => template.id));
    const illustrationPlannerTemplateIds = normalizeIdList(settings.illustrationPlannerTemplateIds).filter((id) => plannerIds.has(id));
    const animationPlannerTemplateIds = normalizeIdList(settings.animationPlannerTemplateIds).filter((id) => plannerIds.has(id));
    const illustrationOptions = plannerTemplates.filter((template) => illustrationPlannerTemplateIds.includes(template.id));
    const animationOptions = plannerTemplates.filter((template) => animationPlannerTemplateIds.includes(template.id));
    const autoGenerateMode = settings.autoGenerateMode === "animation"
        ? "animation"
        : settings.autoGenerateMode === "manual"
            ? "manual"
            : "illustration";
    return {
        plannerTemplates,
        illustrationPlannerTemplateIds,
        animationPlannerTemplateIds,
        illustrationTemplates,
        videoTemplates,
        roleplayEpisodeTemplates,
        roleplayStyleTemplates,
        roleplayAnimationTemplates,
        roleplayOutputTemplates,
        illustrationPlannerTemplateId: selectedId(settings.illustrationPlannerTemplateId, illustrationOptions),
        animationPlannerTemplateId: selectedId(settings.animationPlannerTemplateId, animationOptions),
        illustrationTemplateId: selectedId(settings.illustrationTemplateId, illustrationTemplates),
        videoTemplateId: selectedId(settings.videoTemplateId, videoTemplates),
        roleplayEpisodeTemplateId: selectedId(settings.roleplayEpisodeTemplateId, roleplayEpisodeTemplates),
        roleplayStyleTemplateId: selectedId(settings.roleplayStyleTemplateId, roleplayStyleTemplates),
        roleplayAnimationTemplateId: selectedId(settings.roleplayAnimationTemplateId, roleplayAnimationTemplates),
        roleplayOutputTemplateId: selectedId(settings.roleplayOutputTemplateId, roleplayOutputTemplates),
        imageConnectionId: normalizeId(settings.imageConnectionId),
        videoConnectionId: normalizeId(settings.videoConnectionId),
        autoGenerateMode,
        keyframeCount: normalizeBoundedInteger(settings.keyframeCount, 3, 1, 6),
        animationDurationSeconds: normalizeBoundedInteger(settings.animationDurationSeconds, 6, 1, 15),
        viewerDisplayMode: settings.viewerDisplayMode === "background" ? "background" : "floating",
        includeCharacterAppearance: settings.includeCharacterAppearance !== false,
        useAvatarReferences: settings.useAvatarReferences !== false,
        useNovelAiCharacterPrompts: settings.useNovelAiCharacterPrompts !== false,
        usePromptTemplate: settings.usePromptTemplate !== false,
        runInterval: normalizeBoundedInteger(settings.runInterval, 1, 1, 100),
    };
}
//# sourceMappingURL=storyboard-agent-settings.js.map