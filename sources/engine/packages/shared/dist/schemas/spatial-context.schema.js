// ../marinara-engine-4618/packages/shared/src/schemas/spatial-context.schema.ts
import { z } from "zod";

// ../marinara-engine-4618/packages/shared/src/utils/spatial-context.ts
var SPATIAL_CONTEXT_LIMITS = {
  maxLocations: 500,
  maxDepth: 20,
  maxLinksPerLocation: 50,
  maxNameLength: 200,
  maxDescriptionLength: 4e3,
  maxAwarenessSummaryLength: 1e3,
  maxModelMemoryLength: 8e3,
  maxIdLength: 128,
  maxLinkLabelLength: 200,
  maxCommandIdLength: 200,
  maxPromptDestinations: 50,
  maxLorebookEntryIdsPerLocation: 50,
  /** Maximum number of destination IDs returned for one routed transition. */
  maxRouteLocations: 64
};
function issue(code, message, path, locationId) {
  return {
    code,
    message,
    path,
    ...locationId ? { locationId } : {}
  };
}
function validateSpatialContextDefinition(definition) {
  const issues = [];
  const firstIndexById = /* @__PURE__ */ new Map();
  const byId = /* @__PURE__ */ new Map();
  if (definition.locations.length > SPATIAL_CONTEXT_LIMITS.maxLocations) {
    issues.push(
      issue(
        "too_many_locations",
        `A spatial map can contain at most ${SPATIAL_CONTEXT_LIMITS.maxLocations} locations.`,
        ["locations"]
      )
    );
  }
  definition.locations.forEach((location, index) => {
    const firstIndex = firstIndexById.get(location.id);
    if (firstIndex !== void 0) {
      issues.push(
        issue(
          "duplicate_location_id",
          `Location ID "${location.id}" is already used by another location.`,
          ["locations", index, "id"],
          location.id
        )
      );
      return;
    }
    firstIndexById.set(location.id, index);
    byId.set(location.id, location);
  });
  if (definition.startingLocationId !== null) {
    const startingLocation = byId.get(definition.startingLocationId);
    if (!startingLocation) {
      issues.push(
        issue(
          "starting_location_missing",
          "The starting location does not exist.",
          ["startingLocationId"],
          definition.startingLocationId
        )
      );
    } else if (startingLocation.status !== "active") {
      issues.push(
        issue(
          "starting_location_archived",
          "The starting location must be active.",
          ["startingLocationId"],
          startingLocation.id
        )
      );
    }
  }
  definition.locations.forEach((location, index) => {
    if (location.parentId !== null) {
      if (location.parentId === location.id) {
        issues.push(
          issue("self_parent", "A location cannot be its own parent.", ["locations", index, "parentId"], location.id)
        );
      } else if (!byId.has(location.parentId)) {
        issues.push(
          issue(
            "parent_missing",
            "The selected parent location does not exist.",
            ["locations", index, "parentId"],
            location.id
          )
        );
      }
    }
    if (location.links.length > SPATIAL_CONTEXT_LIMITS.maxLinksPerLocation) {
      issues.push(
        issue(
          "too_many_links",
          `A location can contain at most ${SPATIAL_CONTEXT_LIMITS.maxLinksPerLocation} links.`,
          ["locations", index, "links"],
          location.id
        )
      );
    }
    const seenLorebookEntryIds = /* @__PURE__ */ new Set();
    location.lorebookEntryIds.forEach((entryId, entryIndex) => {
      if (seenLorebookEntryIds.has(entryId)) {
        issues.push(
          issue(
            "duplicate_lorebook_entry_id",
            "A lorebook entry can be attached to a location only once.",
            ["locations", index, "lorebookEntryIds", entryIndex],
            location.id
          )
        );
      }
      seenLorebookEntryIds.add(entryId);
    });
    const seenLinkTargets = /* @__PURE__ */ new Set();
    location.links.forEach((link, linkIndex) => {
      if (link.targetId === location.id) {
        issues.push(
          issue(
            "self_link",
            "A location cannot link to itself.",
            ["locations", index, "links", linkIndex, "targetId"],
            location.id
          )
        );
      } else if (!byId.has(link.targetId)) {
        issues.push(
          issue(
            "link_target_missing",
            "The linked location does not exist.",
            ["locations", index, "links", linkIndex, "targetId"],
            location.id
          )
        );
      }
      if (seenLinkTargets.has(link.targetId)) {
        issues.push(
          issue(
            "duplicate_link_target",
            "A location can link to a destination only once.",
            ["locations", index, "links", linkIndex, "targetId"],
            location.id
          )
        );
      }
      seenLinkTargets.add(link.targetId);
    });
  });
  definition.locations.forEach((location, index) => {
    const seen = /* @__PURE__ */ new Set();
    let current = location;
    let depth = 0;
    let cycleFound = false;
    while (current) {
      if (seen.has(current.id)) {
        cycleFound = true;
        break;
      }
      seen.add(current.id);
      depth += 1;
      if (current.parentId === null) break;
      current = byId.get(current.parentId);
    }
    if (cycleFound) {
      issues.push(
        issue("parent_cycle", "Location parents must not form a cycle.", ["locations", index, "parentId"], location.id)
      );
    } else if (depth > SPATIAL_CONTEXT_LIMITS.maxDepth) {
      issues.push(
        issue(
          "maximum_depth_exceeded",
          `Location nesting cannot exceed ${SPATIAL_CONTEXT_LIMITS.maxDepth} levels.`,
          ["locations", index, "parentId"],
          location.id
        )
      );
    }
  });
  const childrenByParent = /* @__PURE__ */ new Map();
  definition.locations.forEach((location, index) => {
    if (location.parentId === null) return;
    const children = childrenByParent.get(location.parentId);
    const entry = { location, index };
    if (children) children.push(entry);
    else childrenByParent.set(location.parentId, [entry]);
  });
  for (const [parentId, children] of childrenByParent) {
    const parent = byId.get(parentId);
    if (!parent || parent.childPresentation !== "layers") continue;
    const usedOrders = /* @__PURE__ */ new Map();
    for (const { location, index } of children) {
      if (location.layerOrder === void 0) {
        issues.push(
          issue(
            "layer_order_missing",
            "Every child of a layer location needs a layer order.",
            ["locations", index, "layerOrder"],
            location.id
          )
        );
        continue;
      }
      const existingLocationId = usedOrders.get(location.layerOrder);
      if (existingLocationId !== void 0) {
        issues.push(
          issue(
            "duplicate_layer_order",
            `Layer order ${location.layerOrder} is already used by location "${existingLocationId}".`,
            ["locations", index, "layerOrder"],
            location.id
          )
        );
      } else {
        usedOrders.set(location.layerOrder, location.id);
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

// ../marinara-engine-4618/packages/shared/src/schemas/spatial-context.schema.ts
var spatialIdSchema = z.string().trim().min(1).max(SPATIAL_CONTEXT_LIMITS.maxIdLength).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u, "Use letters, numbers, dots, underscores, colons, or hyphens.");
var spatialOwnerModeSchema = z.enum(["roleplay", "game"]);
var spatialLocationKindSchema = z.enum(["region", "settlement", "place", "building", "floor", "room"]);
var spatialChildPresentationSchema = z.enum(["map", "layers", "list"]);
var spatialLocationStatusSchema = z.enum(["active", "archived"]);
var spatialLinkStateSchema = z.enum(["available", "hidden", "blocked"]);
var spatialMapDraftSizeSchema = z.enum(["small", "medium", "large"]);
var spatialMapDraftOperationSchema = z.enum(["create", "replace", "expand"]);
var spatialMapGroundingModeSchema = z.enum(["setup", "lore_strict", "lore_expand"]);
var spatialTravelModeSchema = z.enum(["step_by_step", "travel_now"]);
var spatialLocationPlacementSchema = z.object({
  x: z.number().finite().min(0).max(100),
  y: z.number().finite().min(0).max(100)
}).strict();
var spatialLocationLinkSchema = z.object({
  targetId: spatialIdSchema,
  label: z.string().trim().min(1).max(SPATIAL_CONTEXT_LIMITS.maxLinkLabelLength).optional(),
  bidirectional: z.boolean().default(false),
  state: spatialLinkStateSchema.default("available")
}).strict();
var spatialLocationSchema = z.object({
  id: spatialIdSchema,
  parentId: spatialIdSchema.nullable(),
  name: z.string().trim().min(1).max(SPATIAL_CONTEXT_LIMITS.maxNameLength),
  kind: spatialLocationKindSchema,
  description: z.string().max(SPATIAL_CONTEXT_LIMITS.maxDescriptionLength),
  modelMemory: z.string().max(SPATIAL_CONTEXT_LIMITS.maxModelMemoryLength).optional(),
  awarenessSummary: z.string().max(SPATIAL_CONTEXT_LIMITS.maxAwarenessSummaryLength).optional(),
  icon: z.string().trim().min(1).max(64).optional(),
  referenceImageId: z.string().trim().min(1).max(200).optional(),
  useReferenceImage: z.boolean().optional(),
  mapBackgroundImageId: z.string().trim().min(1).max(200).optional(),
  mapBackgroundPosition: spatialLocationPlacementSchema.optional(),
  lorebookEntryIds: z.array(z.string().trim().min(1)).max(SPATIAL_CONTEXT_LIMITS.maxLorebookEntryIdsPerLocation).default([]),
  childPresentation: spatialChildPresentationSchema.default("list"),
  placement: spatialLocationPlacementSchema.optional(),
  layerOrder: z.number().int().safe().optional(),
  links: z.array(spatialLocationLinkSchema).max(SPATIAL_CONTEXT_LIMITS.maxLinksPerLocation).default([]),
  status: spatialLocationStatusSchema.default("active"),
  sortOrder: z.number().int().safe().default(0)
}).strict();
var spatialContextDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  ownerMode: spatialOwnerModeSchema,
  enabled: z.boolean(),
  locations: z.array(spatialLocationSchema).max(SPATIAL_CONTEXT_LIMITS.maxLocations),
  startingLocationId: spatialIdSchema.nullable(),
  revision: z.number().int().nonnegative().safe()
}).strict().superRefine((definition, ctx) => {
  const validation = validateSpatialContextDefinition(definition);
  for (const issue2 of validation.issues) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue2.message,
      path: issue2.path,
      params: { spatialCode: issue2.code, locationId: issue2.locationId }
    });
  }
});
var pendingSpatialTransitionSchema = z.object({
  destinationId: spatialIdSchema,
  travelMode: spatialTravelModeSchema.optional(),
  expectedDefinitionRevision: z.number().int().nonnegative().safe(),
  expectedCurrentLocationId: spatialIdSchema.nullable(),
  commandId: z.string().trim().min(1).max(SPATIAL_CONTEXT_LIMITS.maxCommandIdLength)
}).strict();
var spatialSnapshotSourceSchema = z.enum([
  "bootstrap",
  "owner_turn",
  "assistant_swipe",
  "definition_repair",
  "branch_copy"
]);
var spatialContextSnapshotSchema = z.object({
  id: z.string().trim().min(1).max(SPATIAL_CONTEXT_LIMITS.maxIdLength),
  chatId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  swipeIndex: z.number().int().nonnegative(),
  currentLocationId: spatialIdSchema.nullable(),
  definitionRevision: z.number().int().nonnegative().safe(),
  source: spatialSnapshotSourceSchema,
  transitionCommandId: z.string().trim().min(1).max(SPATIAL_CONTEXT_LIMITS.maxCommandIdLength).nullable(),
  transitionPayloadHash: z.string().regex(/^[a-f0-9]{64}$/u).nullable(),
  createdAt: z.string().datetime()
}).strict();
var updateSpatialContextRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative().safe(),
  expectedCurrentLocationId: spatialIdSchema.nullable(),
  replacementCurrentLocationId: spatialIdSchema.nullable().optional(),
  definition: spatialContextDefinitionSchema
}).strict();
var generateSpatialMapDraftRequestSchema = z.object({
  operation: spatialMapDraftOperationSchema.default("create"),
  size: spatialMapDraftSizeSchema.default("medium"),
  targetLocationId: spatialIdSchema.optional(),
  instructions: z.string().trim().max(4e3).optional(),
  connectionId: z.string().trim().min(1).optional(),
  groundingMode: spatialMapGroundingModeSchema.optional().default("setup"),
  sourceLorebookIds: z.array(z.string().trim().min(1)).max(20).optional().default([]),
  sourceEntryIds: z.array(z.string().trim().min(1)).max(100).optional().default([]),
  debugMode: z.boolean().optional().default(false)
}).strict().superRefine((request, ctx) => {
  if (request.operation === "expand" && !request.targetLocationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose a location to expand.",
      path: ["targetLocationId"]
    });
  }
  if (request.operation !== "expand" && request.targetLocationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A target location is used only when expanding an existing map.",
      path: ["targetLocationId"]
    });
  }
  if (request.groundingMode === "setup" && (request.sourceLorebookIds.length > 0 || request.sourceEntryIds.length > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Lorebook sources require a lore-grounded map mode.",
      path: ["groundingMode"]
    });
  }
  if (request.groundingMode !== "setup" && request.sourceLorebookIds.length === 0 && request.sourceEntryIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose at least one lorebook or lore entry for a lore-grounded map.",
      path: ["sourceLorebookIds"]
    });
  }
});
export {
  generateSpatialMapDraftRequestSchema,
  pendingSpatialTransitionSchema,
  spatialChildPresentationSchema,
  spatialContextDefinitionSchema,
  spatialContextSnapshotSchema,
  spatialLinkStateSchema,
  spatialLocationKindSchema,
  spatialLocationLinkSchema,
  spatialLocationPlacementSchema,
  spatialLocationSchema,
  spatialLocationStatusSchema,
  spatialMapDraftOperationSchema,
  spatialMapDraftSizeSchema,
  spatialMapGroundingModeSchema,
  spatialOwnerModeSchema,
  spatialSnapshotSourceSchema,
  spatialTravelModeSchema,
  updateSpatialContextRequestSchema
};
