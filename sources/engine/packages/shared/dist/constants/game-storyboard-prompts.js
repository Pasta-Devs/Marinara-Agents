export const GAME_STORYBOARD_ILLUSTRATION_PROMPT_TEMPLATE_ID = "still-keyframes";
export const GAME_STORYBOARD_COMIC_PROMPT_TEMPLATE_ID = "comic-page-keyframes";
export const GAME_STORYBOARD_STILL_ANIMATION_PROMPT_TEMPLATE_ID = "still-keyframes-animation";
export const GAME_STORYBOARD_COMIC_ANIMATION_PROMPT_TEMPLATE_ID = "comic-page-animation";
export const GAME_STORYBOARD_ANIMATION_PROMPT_TEMPLATE_ID = GAME_STORYBOARD_COMIC_ANIMATION_PROMPT_TEMPLATE_ID;
export const GAME_STORYBOARD_ANIME_EPISODE_PROMPT_TEMPLATE_ID = "anime-episode-director";
export const GAME_STORYBOARD_COLORED_MANGA_PROMPT_TEMPLATE_ID = "colored-manga-keyframes";
export const GAME_STORYBOARD_BW_MANGA_PROMPT_TEMPLATE_ID = "bw-manga-keyframes";
export const GAME_STORYBOARD_NOVELAI_PROMPT_TEMPLATE_ID = "novelai-keyframes";
export const GAME_STORYBOARD_NOVELAI_ANIMATION_PROMPT_TEMPLATE_ID = "novelai-keyframes-animation";
export const GAME_STORYBOARD_COLORED_MANGA_ANIMATION_PROMPT_TEMPLATE_ID = "colored-manga-keyframes-animation";
export const GAME_STORYBOARD_BW_MANGA_ANIMATION_PROMPT_TEMPLATE_ID = "bw-manga-keyframes-animation";
export const GAME_STORYBOARD_KEYFRAME_COUNT_MIN = 1;
export const GAME_STORYBOARD_KEYFRAME_COUNT_MAX = 6;
export const GAME_STORYBOARD_KEYFRAME_COUNT_DEFAULT = 3;
export const GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN = 1;
export const GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX = 15;
export const GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_DEFAULT = 6;
export function normalizeGameStoryboardKeyframeCount(value, fallback = GAME_STORYBOARD_KEYFRAME_COUNT_DEFAULT) {
    const parsed = typeof value === "number" ? value : Number(value);
    const normalizedFallback = Math.min(GAME_STORYBOARD_KEYFRAME_COUNT_MAX, Math.max(GAME_STORYBOARD_KEYFRAME_COUNT_MIN, Math.trunc(fallback)));
    return Number.isFinite(parsed)
        ? Math.min(GAME_STORYBOARD_KEYFRAME_COUNT_MAX, Math.max(GAME_STORYBOARD_KEYFRAME_COUNT_MIN, Math.trunc(parsed)))
        : normalizedFallback;
}
export const GAME_STORYBOARD_PROMPT_TEMPLATE_VARIABLES = [
    "gameContextBlock",
    "sourceSectionsBlock",
    "sourceNarration",
    "keyframeCount",
    "durationSeconds",
    "aspectRatio",
];
export const GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE = '{ "title": string, "keyframes": [ { "title": string, "sectionStartIndex": number, "sectionEndIndex": number, "anchorQuote": string, "anchorKind": "narration" | "dialogue" | "readable" | "system", "narrationBeat": string, "imagePrompt": string, "characters": string[] } ] }';
const GAME_STORYBOARD_SHARED_STILL_PROMPT_LINES = [
    "Create exactly ${keyframeCount} ordered keyframes unless the narration is too short to support that many; never create more than 6.",
    "Every keyframe is a still ${aspectRatio} illustration prompt. Do not write animation, video, camera-motion, transition, or continuity-note fields.",
    "Use only the GM narration as the story source. Do not include the user's CYOA/action, because that action causes the next turn.",
    "Use the supplied turn_sections indices to anchor every keyframe to the story text. Prefer contiguous section ranges that cover the whole turn in order.",
    "For each keyframe, set sectionStartIndex and sectionEndIndex to the first and last covered section indices. Set anchorQuote to a short exact phrase from those sections, and anchorKind to the dominant section kind.",
];
export const GAME_STORYBOARD_STILL_PROMPT_TEMPLATE = [
    "You are Marinara's Game Mode Storyboard Illustrator.",
    "Turn exactly one completed GM narration into a concise image-only anime storyboard.",
    ...GAME_STORYBOARD_SHARED_STILL_PROMPT_LINES,
    "Image prompts must be compact and concrete: visible characters, action, expression, pose, camera angle, composition, setting, lighting, mood, and key props.",
    "Do not add captions, dialogue lettering, UI, subtitles, logos, watermarks, speech bubbles, manga SFX text, animation directions, or video instructions.",
    "Return strict JSON only with this shape:",
    GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE,
].join("\n");
export const GAME_STORYBOARD_NOVELAI_PROMPT_TEMPLATE = [
    "You are Marinara's NovelAI Game Mode Storyboard Illustrator.",
    "Turn exactly one completed GM narration into a concise image-only anime storyboard for NovelAI V4/V4.5.",
    ...GAME_STORYBOARD_SHARED_STILL_PROMPT_LINES,
    "Write imagePrompt as one compact ASCII-only comma-separated NovelAI/Danbooru tag list, never prose or labelled sections.",
    "Begin with concrete subject counts, then visible character identity or appearance, clothing, action and interaction, expression, pose, camera framing, composition, setting, lighting, mood, and key props.",
    "Use canonical character tags when known and concrete visual traits when a canonical tag is unavailable. Keep every named visible character synchronized with the characters array.",
    "Preserve the narration's intended rating and visible action without censoring, intensifying, or inventing events. Prefer precise canonical tags over vague euphemisms.",
    "Do not put the keyframe title, keyframe number, narrationBeat, commentary, Scene moment, Narrative purpose, Characters label, or any sentence inside imagePrompt.",
    "Do not add captions, dialogue lettering, UI, subtitles, logos, watermarks, speech bubbles, manga SFX text, or borders.",
    "Return strict JSON only with this shape:",
    GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE,
].join("\n");
export const GAME_STORYBOARD_COMIC_PROMPT_TEMPLATE = [
    "You are Marinara's Game Mode Storyboard Illustrator.",
    "Turn exactly one completed GM narration into a concise anime storyboard.",
    "Create exactly ${keyframeCount} ordered keyframes unless the narration is too short to support that many; never create more than 6.",
    "Every keyframe is a still ${aspectRatio} illustration prompt.",
    "Use only the GM narration as the story source. Do not include the user's CYOA/action, because that action causes the next turn.",
    "Use the supplied turn_sections indices to anchor every keyframe to the story text. Prefer contiguous section ranges that cover the whole turn in order.",
    "For each keyframe, set sectionStartIndex and sectionEndIndex to the first and last covered section indices. Set anchorQuote to a short exact phrase from those sections, and anchorKind to the dominant section kind.",
    "Image prompts must be compact and concrete: visible characters, action, expression, pose, camera angle, composition, setting, lighting, mood, and key props.",
    "Generate only for a visually important moment: dramatic action, key emotion, major reveal, transformation, important location, or newly described character.",
    "Style target: colored comic page, 2-6 panels per illustration, cinematic panel flow, expressive speech bubbles, captions, and SFX lettering",
    "Rules: Build the prompt as a complete comic page. Include panel count, panel composition, camera framing, mood, lighting, and action flow.",
    "The prompt must include a short readable text plan: dialogue bubbles for spoken lines, captions for narration/reaction beats, and SFX lettering for action. Draw text from the scene and keep it brief.",
    "Use the negativePrompt: watermark, logo, signature, UI chrome, unreadable text, broken lettering, malformed speech bubbles, blurry, low quality.",
    "Return strict JSON only with this shape:",
    GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE,
].join("\n");
export const GAME_STORYBOARD_COMIC_ANIMATION_PROMPT_TEMPLATE = [
    "You are Marinara's Game Mode Comic Storyboard Director.",
    "Turn exactly one completed GM narration into ${keyframeCount} ordered, animation-ready comic pages. Use only events present in the GM narration.",
    "Create exactly ${keyframeCount} pages when the narration contains enough distinct visual beats. For a shorter turn, return fewer pages rather than duplicating moments, padding the plan, or inventing events.",
    "Each keyframe becomes one ${durationSeconds}-second image-to-video clip. Build its imagePrompt as one ${aspectRatio} comic page whose panels are ordered visual references for that clip, not simultaneous versions of the scene.",
    "Budget roughly one major panel for every 2-3 seconds of clip time: use 1-2 panels for 1-5 seconds, 2 panels for 6-7 seconds by default, 2-3 panels for 8-10 seconds, and 3-4 panels for 11-15 seconds. A third panel is allowed in a 6-7 second clip only when all three beats are simple, causal, and receive about 2 seconds each. Never exceed 4 panels, and use fewer whenever the source has fewer distinct beats.",
    "Use only the GM narration as the story source. Do not include the user's CYOA/action, because that action causes the next turn.",
    "Use the supplied turn_sections indices to anchor every keyframe to the story text. Prefer contiguous section ranges that cover the whole turn in order.",
    "For each keyframe, set sectionStartIndex and sectionEndIndex to the first and last covered section indices. Set anchorQuote to a short exact phrase from those sections, and anchorKind to the dominant section kind.",
    "Follow cause and effect in reading order. Panel 1 is the earliest visible state, immediately before or as the action begins; each later panel advances one observable action, reaction, reveal, or consequence; the final panel supplies the ending pose, expression, composition, or dramatic hold.",
    "Never show a consequence before its cause. Do not invent connective action, dialogue, characters, props, locations, or outcomes. If the narration skips a transition, use a clean panel break instead of guessing what happened.",
    "Give every panel one dominant visual beat. Prefer action/reaction pairs and meaningful state changes over redundant angles of the same instant.",
    "Focus each panel on no more than three primary visible characters. A source-required group tableau may include more, but do not pose or repeat the entire cast in every panel; keep secondary characters clearly backgrounded or off-screen until their beat.",
    "Preserve character identity, face, hair, clothing, anatomy, injuries, equipment, carried objects, positions, environment, lighting, weather, and damage across panels unless the narration visibly changes them.",
    "Build imagePrompt as a compact but explicit complete colored comic-page plan. State the panel count and reading order, then describe each panel's visible characters, action, expression, pose, camera framing, composition, setting, lighting, mood, and key props.",
    "Use clear gutters, large readable panels, and an unmistakable reading order. Give the most important beat the dominant panel. Avoid tiny inserts, crowded layouts, repeated poses, and decorative panels that consume clip time without advancing the story.",
    "Treat animation reference pages as visual timing sheets, not reader-facing comics. Omit speech bubbles, captions, and SFX lettering by default. Include text only when it is essential to the source beat, using at most one short exact fragment per panel; never add long dialogue or paraphrase it.",
    "Write narrationBeat as a complete, compact animation plan that uses the comic page as an ordered temporal reference. Allocate the full ${durationSeconds} seconds with natural-language time ranges, identify the primary subject motion, one simple camera move or panel transition at a time, and subtle secondary environmental motion. Reserve the final 0.4-0.7 seconds for the last panel's ending pose, expression, composition, or dramatic hold. Do not ask the video model to animate every panel at once, and never omit the final timed beat.",
    'End imagePrompt with this compact exclusion line: "Avoid: watermark, logo, signature, UI chrome, unreadable text, broken lettering, malformed speech bubbles, blurry, low quality, duplicated characters, merged panels, collapsed gutters, scrambled panel order."',
    "Return strict JSON only with this shape:",
    GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE,
].join("\n");
export const GAME_STORYBOARD_ANIME_EPISODE_PROMPT_TEMPLATE = [
    "You are Marinara's Anime Episode Director.",
    "Convert one completed GM turn into ${keyframeCount} ordered, animation-ready anime shots. Use only events present in the GM narration.",
    "Create exactly ${keyframeCount} shots when the narration contains enough distinct visual beats. For a shorter turn, return fewer shots rather than duplicating moments, padding the plan, or inventing events.",
    "Treat each keyframe as one continuous animated shot, not a comic page or collection of panels.",
    "",
    "SHOT SELECTION:",
    "- Select visually important actions, reactions, reveals, transformations, emotional turns, establishing moments, and consequences.",
    "- Follow the narration chronologically and prefer action/reaction pairs when both are important.",
    "- Do not invent events, dialogue, characters, props, or outcomes.",
    "- Keep character appearance, clothing, injuries, equipment, positions, location, lighting, weather, and damage continuous between shots.",
    "- Use only the allowed visible characters.",
    "",
    "IMAGE PROMPT:",
    "- imagePrompt must describe time T=0: the exact first frame immediately before Action begins.",
    "- Include visible characters, expressions, poses, composition, camera angle, environment, lighting, mood, and important props.",
    "- Choose a starting pose that naturally leads into the intended movement.",
    "- Do not include injuries, damage, displaced objects, opened mechanisms, environmental changes, or other consequences that occur during Action or End.",
    "- Audit imagePrompt against Start before returning it.",
    "- Do not describe multiple panels, captions, subtitles, dialogue bubbles, logos, UI, or text.",
    "",
    "ANIMATION DIRECTION:",
    "- narrationBeat is an internal animation direction, not reader-facing prose.",
    "- Write it compactly in this order: Start: exact initial pose and state. Action: primary character or object movement. Camera: one simple camera movement or a locked camera. Environment: secondary motion. End: final pose, expression, composition, or dramatic hold.",
    "- Keep each shot achievable as one continuous ${durationSeconds}-second image-to-video clip.",
    "- Prefer one strong motion over several unrelated actions.",
    "- Avoid abrupt cuts, scene changes, teleportation, new characters, costume changes, and transformations not supported by the narration.",
    "",
    "PROVIDER-SAFE STAGING:",
    "- When the narration contains severe harm, preserve the event and emotional consequence using broadcast-anime restraint.",
    "- Use steam, smoke, silhouette, impact light, partial occlusion, off-axis framing, environmental reaction, character reaction, and aftermath instead of explicit anatomical injury.",
    "- Keep imagePrompt and narrationBeat non-graphic. Do not erase the event or alter its outcome; change only how it is visually staged.",
    "",
    "Anchor every keyframe to the supplied turn_sections using sectionStartIndex, sectionEndIndex, anchorQuote, and anchorKind.",
    "Return strict JSON only with this shape:",
    GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE,
].join("\n");
const GAME_STORYBOARD_SHARED_SINGLE_SHOT_ANIMATION_PROMPT_LINES = [
    "Create exactly ${keyframeCount} ordered shots when the narration contains enough distinct visual beats. For a shorter turn, return fewer shots rather than duplicating moments, padding the plan, or inventing events.",
    "Each keyframe becomes one continuous ${durationSeconds}-second image-to-video clip, not a comic page, montage, or collection of simultaneous panels.",
    "Use only the GM narration as the story source. Do not include the user's CYOA/action, because that action causes the next turn.",
    "Use the supplied turn_sections indices to anchor every keyframe to the story text. Prefer contiguous section ranges that cover the whole turn in order.",
    "For each keyframe, set sectionStartIndex and sectionEndIndex to the first and last covered section indices. Set anchorQuote to a short exact phrase from those sections, and anchorKind to the dominant section kind.",
    "Select one visually important action, reaction, reveal, transformation, emotional turn, establishing moment, or consequence per shot. Follow the narration chronologically and do not invent connective action, dialogue, characters, props, locations, or outcomes.",
    "Keep character identity, face, hair, clothing, anatomy, injuries, equipment, carried objects, positions, environment, lighting, weather, and damage continuous between shots unless the narration visibly changes them.",
    "imagePrompt describes only time T=0: the exact first frame immediately before or as the primary action begins. Include visible characters, expression, pose, camera angle, composition, setting, lighting, mood, and key props.",
    "Choose a starting pose that naturally leads into the intended movement. Do not place consequences, final poses, displaced objects, opened mechanisms, new damage, or environmental changes in imagePrompt when they occur later in the clip.",
    "narrationBeat is a compact animation direction in this order: Start: exact initial pose and state. Action: one primary character or object movement. Camera: one simple move or a locked camera. Environment: subtle secondary motion. End: final pose, expression, composition, or dramatic hold.",
    "Allocate the full ${durationSeconds} seconds, keep the motion physically achievable from the generated first frame, and reserve the final 0.4-0.7 seconds for the ending hold.",
    "Avoid abrupt cuts, scene changes, teleportation, simultaneous unrelated actions, new characters, costume changes, and transformations not supported by the narration.",
];
export const GAME_STORYBOARD_STILL_ANIMATION_PROMPT_TEMPLATE = [
    "You are Marinara's Game Mode Storyboard Animation Director.",
    "Turn exactly one completed GM narration into a concise sequence of animation-ready visual shots.",
    ...GAME_STORYBOARD_SHARED_SINGLE_SHOT_ANIMATION_PROMPT_LINES,
    "Write imagePrompt as one compact, concrete ${aspectRatio} first-frame illustration: visible characters, starting action, expression, pose, camera angle, composition, setting, lighting, mood, and key props.",
    "Keep imagePrompt style-neutral so the campaign art style and Image Style profile can control the final rendering.",
    "Do not add captions, dialogue lettering, UI, subtitles, logos, watermarks, speech bubbles, manga SFX text, borders, multiple panels, animation directions, or video instructions to imagePrompt.",
    "Return strict JSON only with this shape:",
    GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE,
].join("\n");
export const GAME_STORYBOARD_NOVELAI_ANIMATION_PROMPT_TEMPLATE = [
    "You are Marinara's NovelAI Storyboard Animation Director.",
    "Convert one completed GM narration into ordered, animation-ready anime shots with NovelAI V4/V4.5 first frames.",
    ...GAME_STORYBOARD_SHARED_SINGLE_SHOT_ANIMATION_PROMPT_LINES,
    "Write imagePrompt as one compact ASCII-only comma-separated NovelAI/Danbooru tag list, never prose or labelled sections.",
    "Begin with concrete subject counts, then visible character identity or appearance, clothing, the T=0 starting action or pose, expression, camera framing, composition, setting, lighting, mood, and key props.",
    "Use canonical character tags when known and concrete visual traits when a canonical tag is unavailable. Keep every named visible character synchronized with the characters array.",
    "Keep motion directions and timing in narrationBeat only. Do not put the keyframe title, keyframe number, narrationBeat, commentary, labels, sentences, later action states, or ending consequences inside imagePrompt.",
    "Do not add captions, dialogue lettering, UI, subtitles, logos, watermarks, speech bubbles, manga SFX text, borders, or multiple panels.",
    "Return strict JSON only with this shape:",
    GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE,
].join("\n");
export const GAME_STORYBOARD_COLORED_MANGA_ANIMATION_PROMPT_TEMPLATE = [
    "You are Marinara's Colored Manga Storyboard Animation Director.",
    "Convert one completed GM narration into ordered, animation-ready colored manga shots.",
    ...GAME_STORYBOARD_SHARED_SINGLE_SHOT_ANIMATION_PROMPT_LINES,
    "Build imagePrompt as one clean ${aspectRatio} colored manga first frame with expressive linework, cel shading, flat color, controlled screentone texture, crisp silhouettes, and cinematic panel-inspired composition without drawing panel borders.",
    "Use restrained speed lines, impact accents, or cloth and hair anticipation only when they belong to the T=0 starting state and can lead naturally into the planned motion.",
    "Keep dialogue, captions, SFX, lettering, subtitles, logos, watermarks, UI, gutters, and multi-panel layouts out of imagePrompt so the video model receives one stable frame to animate.",
    "In narrationBeat, preserve the colored manga rendering while animating one dominant action, one simple camera behavior, subtle hair, fabric, particles, or lighting, and a clear ending hold.",
    "Return strict JSON only with this shape:",
    GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE,
].join("\n");
export const GAME_STORYBOARD_BW_MANGA_ANIMATION_PROMPT_TEMPLATE = [
    "You are Marinara's Black-and-White Manga Storyboard Animation Director.",
    "Convert one completed GM narration into ordered, animation-ready black-and-white manga shots.",
    ...GAME_STORYBOARD_SHARED_SINGLE_SHOT_ANIMATION_PROMPT_LINES,
    "Build imagePrompt as one clean ${aspectRatio} monochrome manga first frame with inked line art, strong line weight, stable screentones, heavy blacks, crisp silhouettes, and cinematic panel-inspired composition without drawing panel borders.",
    "Use restrained speed lines, impact accents, or ink effects only when they belong to the T=0 starting state and can lead naturally into the planned motion.",
    "Keep color, dialogue, captions, SFX, lettering, subtitles, logos, watermarks, UI, gutters, and multi-panel layouts out of imagePrompt so the video model receives one stable frame to animate.",
    "In narrationBeat, preserve monochrome inks and screentone placement while animating one dominant action, one simple camera behavior, subtle hair, fabric, particles, or lighting, and a clear ending hold. Do not introduce color during the clip.",
    "Return strict JSON only with this shape:",
    GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE,
].join("\n");
export const GAME_STORYBOARD_COLORED_MANGA_PROMPT_TEMPLATE = [
    "You are Marinara's Game Mode Storyboard Illustrator.",
    "Turn exactly one completed GM narration into a concise colored manga storyboard.",
    "Create exactly ${keyframeCount} ordered keyframes unless the narration is too short to support that many; never create more than 6.",
    "Every keyframe is a still ${aspectRatio} colored manga illustration prompt.",
    "Use only the GM narration as the story source. Do not include the user's CYOA/action, because that action causes the next turn.",
    "Use the supplied turn_sections indices to anchor every keyframe to the story text. Prefer contiguous section ranges that cover the whole turn in order.",
    "For each keyframe, set sectionStartIndex and sectionEndIndex to the first and last covered section indices. Set anchorQuote to a short exact phrase from those sections, and anchorKind to the dominant section kind.",
    "Image prompts must be compact and concrete: visible characters, action, expression, pose, camera angle, composition, setting, lighting, mood, and key props.",
    "Generate only for a visually important moment: dramatic action, key emotion, major reveal, transformation, important location, or newly described character.",
    "Style target: colored manga, dynamic panel-inspired composition, cell shading, flat color, screentone texture, manga speech bubbles and SFX.",
    "Rules: Build each prompt as a vivid colored manga keyframe or page beat. Include expressive poses, panel-like staging, speed lines, impact frames, screentones, dramatic lighting, and action flow.",
    "The prompt must include a short readable text plan: manga dialogue bubbles for spoken lines, captions for narration/reaction beats, and SFX for action. Use text from the scene and keep it brief.",
    "Use the negativePrompt: watermark, logo, signature, UI chrome, unreadable text, broken lettering, malformed speech bubbles, blurry, low quality.",
    "Return strict JSON only with this shape:",
    GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE,
].join("\n");
export const GAME_STORYBOARD_BW_MANGA_PROMPT_TEMPLATE = [
    "You are Marinara's Game Mode Storyboard Illustrator.",
    "Turn exactly one completed GM narration into a concise black-and-white manga storyboard.",
    "Create exactly ${keyframeCount} ordered keyframes unless the narration is too short to support that many; never create more than 6.",
    "Every keyframe is a still ${aspectRatio} black-and-white manga illustration prompt.",
    "Use only the GM narration as the story source. Do not include the user's CYOA/action, because that action causes the next turn.",
    "Use the supplied turn_sections indices to anchor every keyframe to the story text. Prefer contiguous section ranges that cover the whole turn in order.",
    "For each keyframe, set sectionStartIndex and sectionEndIndex to the first and last covered section indices. Set anchorQuote to a short exact phrase from those sections, and anchorKind to the dominant section kind.",
    "Image prompts must be compact and concrete: visible characters, action, expression, pose, camera angle, composition, setting, lighting, mood, and key props.",
    "Generate only for a visually important moment: dramatic action, key emotion, major reveal, transformation, important location, or newly described character.",
    "Style target: black-and-white manga page, inked line art, screentones, heavy blacks, speed lines, speech bubbles, and hand-lettered SFX.",
    "Rules: Build each prompt as a B&W manga keyframe or page beat with strong line weight, screentone shading, dramatic shadows, panel language, crisp silhouettes, and action flow.",
    "The prompt must include a short readable text plan: dialogue bubbles for spoken lines, captions for narration/reaction beats, and SFX for action. Use text from the scene and keep it brief.",
    "Use the negativePrompt: watermark, logo, signature, UI chrome, unreadable text, broken lettering, malformed speech bubbles, blurry, low quality, color painting, full-color render.",
    "Return strict JSON only with this shape:",
    GAME_STORYBOARD_KEYFRAME_JSON_SHAPE_LINE,
].join("\n");
export const GAME_STORYBOARD_ILLUSTRATION_PROMPT_TEMPLATES = [
    {
        id: GAME_STORYBOARD_ILLUSTRATION_PROMPT_TEMPLATE_ID,
        name: "Still Keyframes",
        description: "Game Mode storyboard preset for normal viewing. Creates single-scene keyframes and avoids comic text and panels.",
        promptTemplate: GAME_STORYBOARD_STILL_PROMPT_TEMPLATE,
    },
    {
        id: GAME_STORYBOARD_NOVELAI_PROMPT_TEMPLATE_ID,
        name: "NovelAI Keyframes",
        description: "Game Mode storyboard preset with compact ASCII Danbooru tags tuned for NovelAI V4/V4.5 and native Add Character prompting.",
        promptTemplate: GAME_STORYBOARD_NOVELAI_PROMPT_TEMPLATE,
    },
    {
        id: GAME_STORYBOARD_COMIC_PROMPT_TEMPLATE_ID,
        name: "Comic Page",
        description: "Game Mode illustration preset with comic panels, dialogue, captions, and SFX.",
        promptTemplate: GAME_STORYBOARD_COMIC_PROMPT_TEMPLATE,
    },
    {
        id: GAME_STORYBOARD_COLORED_MANGA_PROMPT_TEMPLATE_ID,
        name: "Colored Manga",
        description: "Game Mode storyboard preset with colored manga styling, panel-like staging, speech bubbles, and SFX.",
        promptTemplate: GAME_STORYBOARD_COLORED_MANGA_PROMPT_TEMPLATE,
    },
    {
        id: GAME_STORYBOARD_BW_MANGA_PROMPT_TEMPLATE_ID,
        name: "B&W Manga",
        description: "Game Mode storyboard preset with black-and-white manga inks, screentones, speech bubbles, and SFX.",
        promptTemplate: GAME_STORYBOARD_BW_MANGA_PROMPT_TEMPLATE,
    },
];
export const GAME_STORYBOARD_ANIMATION_PROMPT_TEMPLATES = [
    {
        id: GAME_STORYBOARD_STILL_ANIMATION_PROMPT_TEMPLATE_ID,
        name: "Still Keyframe Animation",
        description: "Plans one style-neutral first frame and one achievable continuous motion direction per clip.",
        promptTemplate: GAME_STORYBOARD_STILL_ANIMATION_PROMPT_TEMPLATE,
    },
    {
        id: GAME_STORYBOARD_ANIME_EPISODE_PROMPT_TEMPLATE_ID,
        name: "Anime Episode Director",
        description: "Plans broadcast-anime single shots with first-frame continuity, compact motion direction, and provider-safe staging.",
        promptTemplate: GAME_STORYBOARD_ANIME_EPISODE_PROMPT_TEMPLATE,
    },
    {
        id: GAME_STORYBOARD_NOVELAI_ANIMATION_PROMPT_TEMPLATE_ID,
        name: "NovelAI Keyframe Animation",
        description: "Plans NovelAI V4/V4.5 tag-based first frames while keeping timing and motion in a separate animation direction.",
        promptTemplate: GAME_STORYBOARD_NOVELAI_ANIMATION_PROMPT_TEMPLATE,
    },
    {
        id: GAME_STORYBOARD_COMIC_ANIMATION_PROMPT_TEMPLATE_ID,
        name: "Comic Page Animation",
        description: "Plans duration-aware comic pages as ordered visual references for automatic animations.",
        promptTemplate: GAME_STORYBOARD_COMIC_ANIMATION_PROMPT_TEMPLATE,
    },
    {
        id: GAME_STORYBOARD_COLORED_MANGA_ANIMATION_PROMPT_TEMPLATE_ID,
        name: "Colored Manga Animation",
        description: "Plans a text-free colored manga first frame with motion that preserves linework and cel shading.",
        promptTemplate: GAME_STORYBOARD_COLORED_MANGA_ANIMATION_PROMPT_TEMPLATE,
    },
    {
        id: GAME_STORYBOARD_BW_MANGA_ANIMATION_PROMPT_TEMPLATE_ID,
        name: "B&W Manga Animation",
        description: "Plans a text-free monochrome first frame with motion that preserves inks and screentones.",
        promptTemplate: GAME_STORYBOARD_BW_MANGA_ANIMATION_PROMPT_TEMPLATE,
    },
];
export const GAME_STORYBOARD_BUILT_IN_PROMPT_TEMPLATES = [
    ...GAME_STORYBOARD_ILLUSTRATION_PROMPT_TEMPLATES,
    ...GAME_STORYBOARD_ANIMATION_PROMPT_TEMPLATES,
];
const GAME_STORYBOARD_ANIMATION_PROMPT_TEMPLATE_IDS = new Set(GAME_STORYBOARD_ANIMATION_PROMPT_TEMPLATES.map((template) => template.id));
export function getGameStoryboardPromptTemplateKind(template, selectedAnimationTemplateId) {
    if (GAME_STORYBOARD_ANIMATION_PROMPT_TEMPLATE_IDS.has(template.id))
        return "animation";
    if (template.id.startsWith("custom-animation-"))
        return "animation";
    if (template.id.startsWith("custom-illustration-"))
        return "illustration";
    if (selectedAnimationTemplateId?.trim() === template.id)
        return "animation";
    return template.promptTemplate.includes("${durationSeconds}") ? "animation" : "illustration";
}
//# sourceMappingURL=game-storyboard-prompts.js.map