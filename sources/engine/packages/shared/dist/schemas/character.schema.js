// ──────────────────────────────────────────────
// Character Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
export const depthPromptSchema = z.object({
    prompt: z.string().default(""),
    depth: z.number().int().min(0).default(4),
    role: z.enum(["system", "user", "assistant"]).default("system"),
});
const characterBookPositionSchema = z.union([
    z.enum(["before_char", "after_char", "at_depth", "depth"]),
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
]);
const characterBookRoleSchema = z.union([
    z.enum(["system", "user", "assistant"]),
    z.literal(0),
    z.literal(1),
    z.literal(2),
]);
/** Conversation-mode behavior directive insertion strategy. */
export const convoBehaviorInsertionStrategySchema = z.enum([
    "constant_before",
    "constant_after",
    "post_history_replace",
    "post_history_before",
    "post_history_after",
    "macro",
]);
/** Conversation-mode-only behavior directive. */
export const convoBehaviorConfigSchema = z.object({
    instruction: z.string().default(""),
    insertionStrategy: convoBehaviorInsertionStrategySchema.catch("constant_after").default("constant_after"),
});
/** Which sources the AI-write "about me" prompt draws from. Per-character. */
export const aboutMeSourceConfigSchema = z.object({
    description: z.boolean().optional(),
    personality: z.boolean().optional(),
    scenario: z.boolean().optional(),
    backstory: z.boolean().optional(),
    appearance: z.boolean().optional(),
    convoBehavior: z.boolean().optional(),
    lorebook: z.boolean().optional(),
    /** When set, only these linked lorebook entry ids are included; absent → all of them. */
    lorebookEntryIds: z.array(z.string()).optional(),
    chatContext: z.boolean().optional(),
    chatContextLimit: z.number().int().min(1).max(200).optional(),
});
export const characterExtensionsSchema = z
    .object({
    talkativeness: z.number().min(0).max(1).default(0.5),
    fav: z.boolean().default(false),
    world: z.string().default(""),
    depth_prompt: depthPromptSchema.default({}),
    backstory: z.string().default(""),
    appearance: z.string().default(""),
    // Conversation-mode-only fields (optional — absent on non-convo cards).
    convoDisplayName: z.string().optional(),
    convoDisplayNameInCard: z.boolean().optional(),
    aboutMe: z.string().optional(),
    convoBehavior: convoBehaviorConfigSchema.optional(),
    aboutMeSources: aboutMeSourceConfigSchema.optional(),
})
    .passthrough();
export const characterBookEntrySchema = z
    .object({
    keys: z.array(z.string()).default([]),
    content: z.string().default(""),
    extensions: z.record(z.unknown()).default({}),
    enabled: z.boolean().default(true),
    insertion_order: z.number().default(100),
    case_sensitive: z.boolean().default(false),
    name: z.string().default(""),
    priority: z.number().default(100),
    id: z.number().default(0),
    comment: z.string().default(""),
    selective: z.boolean().default(false),
    secondary_keys: z.array(z.string()).default([]),
    constant: z.boolean().default(false),
    position: characterBookPositionSchema.catch("before_char").default("before_char"),
    depth: z.number().optional(),
    role: characterBookRoleSchema.optional(),
})
    .passthrough();
export const characterBookSchema = z.object({
    name: z.string().default(""),
    description: z.string().default(""),
    scan_depth: z.number().default(2),
    token_budget: z.number().default(512),
    recursive_scanning: z.boolean().default(false),
    extensions: z.record(z.unknown()).default({}),
    entries: z.array(characterBookEntrySchema).default([]),
});
export const characterDataSchema = z
    .object({
    name: z.string().min(1),
    description: z.string().default(""),
    personality: z.string().default(""),
    scenario: z.string().default(""),
    first_mes: z.string().default(""),
    mes_example: z.string().default(""),
    creator_notes: z.string().default(""),
    system_prompt: z.string().default(""),
    post_history_instructions: z.string().default(""),
    tags: z.array(z.string()).default([]),
    creator: z.string().default(""),
    character_version: z.string().default(""),
    alternate_greetings: z.array(z.string()).default([]),
    extensions: characterExtensionsSchema.default({}),
    character_book: characterBookSchema.nullable().default(null),
})
    .passthrough();
export const characterCardV2Schema = z.object({
    spec: z.literal("chara_card_v2"),
    spec_version: z.literal("2.0"),
    data: characterDataSchema,
});
/** Default sources when a character has none configured: only the personality field. */
export const DEFAULT_ABOUT_ME_SOURCES = { personality: true };
/** Default number of recent messages to include when the chat-context source is on. */
export const DEFAULT_ABOUT_ME_CHAT_CONTEXT_LIMIT = 20;
/** Resolve a stored source config, falling back to the default (personality only) when absent. */
export function resolveAboutMeSources(raw) {
    if (raw == null)
        return { ...DEFAULT_ABOUT_ME_SOURCES };
    const parsed = aboutMeSourceConfigSchema.safeParse(raw);
    return parsed.success ? parsed.data : { ...DEFAULT_ABOUT_ME_SOURCES };
}
/** AI-write of a Convo "about me" from card/persona fields (Conversation mode). */
export const generateAboutMeSchema = z.object({
    connectionId: z.string().min(1),
    kind: z.enum(["character", "persona"]).default("character"),
    name: z.string().max(200).default(""),
    description: z.string().max(20000).default(""),
    personality: z.string().max(20000).default(""),
    scenario: z.string().max(20000).default(""),
    backstory: z.string().max(20000).default(""),
    appearance: z.string().max(20000).default(""),
    /** Convo behavior directive text (included only when the convoBehavior source is on). */
    convoBehavior: z.string().max(20000).default(""),
    /** Which sources to draw from. Absent → default (personality only). */
    sources: aboutMeSourceConfigSchema.optional(),
    /** Character id — lets the server pull linked/embedded lorebook entries. */
    characterId: z.string().optional(),
    /** Chat id — lets the server pull recent chat context (chat-exclusive about me only). */
    chatId: z.string().optional(),
    /** Optional freeform steer from the user (e.g. "keep it one line, chronically online"). */
    instruction: z.string().max(2000).optional(),
});
export const createCharacterSchema = z.object({
    data: characterDataSchema,
});
export const updateCharacterSchema = z.object({
    data: characterDataSchema.partial(),
});
export const createGroupSchema = z.object({
    name: z.string().min(1),
    description: z.string().default(""),
    avatarPath: z.string().nullable().optional(),
    characterIds: z.array(z.string()).default([]),
});
export const updateGroupSchema = createGroupSchema.partial();
export const createPersonaGroupSchema = z.object({
    name: z.string().min(1),
    description: z.string().default(""),
    personaIds: z.array(z.string()).default([]),
});
export const updatePersonaGroupSchema = createPersonaGroupSchema.partial();
//# sourceMappingURL=character.schema.js.map