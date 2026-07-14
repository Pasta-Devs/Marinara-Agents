import { z } from "zod";
import { SPATIAL_CONTEXT_LIMITS, validateSpatialContextDefinition } from "../utils/spatial-context.js";
const spatialIdSchema = z
    .string()
    .trim()
    .min(1)
    .max(SPATIAL_CONTEXT_LIMITS.maxIdLength)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u, "Use letters, numbers, dots, underscores, colons, or hyphens.");
export const spatialOwnerModeSchema = z.enum(["roleplay", "game"]);
export const spatialLocationKindSchema = z.enum(["region", "settlement", "place", "building", "floor", "room"]);
export const spatialChildPresentationSchema = z.enum(["map", "layers", "list"]);
export const spatialLocationStatusSchema = z.enum(["active", "archived"]);
export const spatialLinkStateSchema = z.enum(["available", "hidden", "blocked"]);
export const spatialMapDraftSizeSchema = z.enum(["small", "medium", "large"]);
export const spatialMapDraftOperationSchema = z.enum(["create", "replace", "expand"]);
export const spatialMapGroundingModeSchema = z.enum(["setup", "lore_strict", "lore_expand"]);
export const spatialLocationPlacementSchema = z
    .object({
    x: z.number().finite().min(0).max(100),
    y: z.number().finite().min(0).max(100),
})
    .strict();
export const spatialLocationLinkSchema = z
    .object({
    targetId: spatialIdSchema,
    label: z.string().trim().min(1).max(SPATIAL_CONTEXT_LIMITS.maxLinkLabelLength).optional(),
    bidirectional: z.boolean().default(false),
    state: spatialLinkStateSchema.default("available"),
})
    .strict();
export const spatialLocationSchema = z
    .object({
    id: spatialIdSchema,
    parentId: spatialIdSchema.nullable(),
    name: z.string().trim().min(1).max(SPATIAL_CONTEXT_LIMITS.maxNameLength),
    kind: spatialLocationKindSchema,
    description: z.string().max(SPATIAL_CONTEXT_LIMITS.maxDescriptionLength),
    modelMemory: z.string().max(SPATIAL_CONTEXT_LIMITS.maxModelMemoryLength).optional(),
    awarenessSummary: z.string().max(SPATIAL_CONTEXT_LIMITS.maxAwarenessSummaryLength).optional(),
    icon: z.string().trim().min(1).max(64).optional(),
    lorebookEntryIds: z
        .array(z.string().trim().min(1))
        .max(SPATIAL_CONTEXT_LIMITS.maxLorebookEntryIdsPerLocation)
        .default([]),
    childPresentation: spatialChildPresentationSchema.default("list"),
    placement: spatialLocationPlacementSchema.optional(),
    layerOrder: z.number().int().safe().optional(),
    links: z.array(spatialLocationLinkSchema).max(SPATIAL_CONTEXT_LIMITS.maxLinksPerLocation).default([]),
    status: spatialLocationStatusSchema.default("active"),
    sortOrder: z.number().int().safe().default(0),
})
    .strict();
export const spatialContextDefinitionSchema = z
    .object({
    schemaVersion: z.literal(1),
    ownerMode: spatialOwnerModeSchema,
    enabled: z.boolean(),
    locations: z.array(spatialLocationSchema).max(SPATIAL_CONTEXT_LIMITS.maxLocations),
    startingLocationId: spatialIdSchema.nullable(),
    revision: z.number().int().nonnegative().safe(),
})
    .strict()
    .superRefine((definition, ctx) => {
    const validation = validateSpatialContextDefinition(definition);
    for (const issue of validation.issues) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: issue.message,
            path: issue.path,
            params: { spatialCode: issue.code, locationId: issue.locationId },
        });
    }
});
export const pendingSpatialTransitionSchema = z
    .object({
    destinationId: spatialIdSchema,
    expectedDefinitionRevision: z.number().int().nonnegative().safe(),
    expectedCurrentLocationId: spatialIdSchema.nullable(),
    commandId: z.string().trim().min(1).max(SPATIAL_CONTEXT_LIMITS.maxCommandIdLength),
})
    .strict();
export const spatialSnapshotSourceSchema = z.enum([
    "bootstrap",
    "owner_turn",
    "assistant_swipe",
    "definition_repair",
    "branch_copy",
]);
export const spatialContextSnapshotSchema = z
    .object({
    id: z.string().trim().min(1).max(SPATIAL_CONTEXT_LIMITS.maxIdLength),
    chatId: z.string().trim().min(1),
    messageId: z.string().trim().min(1),
    swipeIndex: z.number().int().nonnegative(),
    currentLocationId: spatialIdSchema.nullable(),
    definitionRevision: z.number().int().nonnegative().safe(),
    source: spatialSnapshotSourceSchema,
    transitionCommandId: z.string().trim().min(1).max(SPATIAL_CONTEXT_LIMITS.maxCommandIdLength).nullable(),
    transitionPayloadHash: z
        .string()
        .regex(/^[a-f0-9]{64}$/u)
        .nullable(),
    createdAt: z.string().datetime(),
})
    .strict();
export const updateSpatialContextRequestSchema = z
    .object({
    expectedRevision: z.number().int().nonnegative().safe(),
    expectedCurrentLocationId: spatialIdSchema.nullable(),
    replacementCurrentLocationId: spatialIdSchema.nullable().optional(),
    definition: spatialContextDefinitionSchema,
})
    .strict();
export const generateSpatialMapDraftRequestSchema = z
    .object({
    operation: spatialMapDraftOperationSchema.default("create"),
    size: spatialMapDraftSizeSchema.default("medium"),
    targetLocationId: spatialIdSchema.optional(),
    instructions: z.string().trim().max(4_000).optional(),
    connectionId: z.string().trim().min(1).optional(),
    groundingMode: spatialMapGroundingModeSchema.optional().default("setup"),
    sourceLorebookIds: z.array(z.string().trim().min(1)).max(20).optional().default([]),
    sourceEntryIds: z.array(z.string().trim().min(1)).max(100).optional().default([]),
    debugMode: z.boolean().optional().default(false),
})
    .strict()
    .superRefine((request, ctx) => {
    if (request.operation === "expand" && !request.targetLocationId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Choose a location to expand.",
            path: ["targetLocationId"],
        });
    }
    if (request.operation !== "expand" && request.targetLocationId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A target location is used only when expanding an existing map.",
            path: ["targetLocationId"],
        });
    }
    if (request.groundingMode === "setup" && (request.sourceLorebookIds.length > 0 || request.sourceEntryIds.length > 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Lorebook sources require a lore-grounded map mode.",
            path: ["groundingMode"],
        });
    }
    if (request.groundingMode !== "setup" &&
        request.sourceLorebookIds.length === 0 &&
        request.sourceEntryIds.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Choose at least one lorebook or lore entry for a lore-grounded map.",
            path: ["sourceLorebookIds"],
        });
    }
});
//# sourceMappingURL=spatial-context.schema.js.map