import { CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS, } from "../types/conversation-call.js";
export const VIDEO_GENERATION_SETTINGS_KEY = "video-generation";
export const VIDEO_SCENE_DURATION_MIN = 1;
export const VIDEO_SCENE_DURATION_MAX = 60;
export const VIDEO_CALL_CLIP_DURATION_MIN = 1;
export const VIDEO_CALL_CLIP_DURATION_MAX = 15;
export const VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MIN = 1;
export const VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MAX = 8;
export const DEFAULT_CONVERSATION_CALL_VIDEO_CLIP_DURATIONS = {
    idle: 5,
    talking: 5,
    laughing: 5,
    angry: 5,
    crying: 5,
    sighing: 5,
};
export const DEFAULT_VIDEO_GENERATION_USER_SETTINGS = {
    sceneVideoDurationSeconds: 10,
    callClipDurations: DEFAULT_CONVERSATION_CALL_VIDEO_CLIP_DURATIONS,
    callCustomClipDurationSeconds: 5,
    animatedExpressionClipDurationSeconds: 3,
};
function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
export function clampVideoDuration(value, fallback, min, max) {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(numeric))
        return fallback;
    return Math.trunc(Math.min(max, Math.max(min, numeric)));
}
function readCallClipDurations(raw) {
    const source = isRecord(raw) ? raw : {};
    return CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.reduce((durations, kind) => {
        durations[kind] = clampVideoDuration(source[kind], DEFAULT_CONVERSATION_CALL_VIDEO_CLIP_DURATIONS[kind], VIDEO_CALL_CLIP_DURATION_MIN, VIDEO_CALL_CLIP_DURATION_MAX);
        return durations;
    }, {});
}
export function normalizeVideoGenerationUserSettings(raw) {
    let parsed = raw;
    if (typeof parsed === "string") {
        try {
            parsed = JSON.parse(parsed);
        }
        catch {
            parsed = null;
        }
    }
    const source = isRecord(parsed) ? parsed : {};
    return {
        sceneVideoDurationSeconds: clampVideoDuration(source.sceneVideoDurationSeconds, DEFAULT_VIDEO_GENERATION_USER_SETTINGS.sceneVideoDurationSeconds, VIDEO_SCENE_DURATION_MIN, VIDEO_SCENE_DURATION_MAX),
        callClipDurations: readCallClipDurations(source.callClipDurations),
        callCustomClipDurationSeconds: clampVideoDuration(source.callCustomClipDurationSeconds, DEFAULT_VIDEO_GENERATION_USER_SETTINGS.callCustomClipDurationSeconds, VIDEO_CALL_CLIP_DURATION_MIN, VIDEO_CALL_CLIP_DURATION_MAX),
        animatedExpressionClipDurationSeconds: clampVideoDuration(source.animatedExpressionClipDurationSeconds, DEFAULT_VIDEO_GENERATION_USER_SETTINGS.animatedExpressionClipDurationSeconds, VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MIN, VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MAX),
    };
}
export function getConversationCallVideoClipDuration(settings, kind) {
    return settings.callClipDurations[kind] ?? DEFAULT_CONVERSATION_CALL_VIDEO_CLIP_DURATIONS[kind];
}
//# sourceMappingURL=video-generation-settings.js.map