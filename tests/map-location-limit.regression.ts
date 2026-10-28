import assert from "node:assert/strict";
import { SPATIAL_CONTEXT_LIMITS } from "@marinara-engine/shared";
import {
  SPATIAL_MAP_LOCATION_LIMIT,
  spatialMapDefinitionSchema,
  updateSpatialMapRequestSchema,
  validateSpatialMapDefinition,
} from "../packages/hierarchical-maps/src/engine/packages/maps-shared/src/maps-model";

const place = (index: number) => ({
  id: `place-${index}`,
  parentId: null,
  name: `Place ${index}`,
  kind: "place" as const,
  description: "",
  lorebookEntryIds: [],
  childPresentation: "list" as const,
  links: [],
  status: "active" as const,
  sortOrder: index,
});
const map = (locations: ReturnType<typeof place>[]) => ({
  schemaVersion: 1 as const,
  ownerMode: "roleplay" as const,
  enabled: true,
  revision: 0,
  startingLocationId: "place-0",
  locations,
});
const places = (count: number) => Array.from({ length: count }, (_, index) => place(index));

// Tripwire: once the vendored snapshot carries the Engine's 5,000, the package-owned ceiling can go (#1132).
assert.equal(SPATIAL_CONTEXT_LIMITS.maxLocations, 500);
assert.equal(SPATIAL_MAP_LOCATION_LIMIT, 5_000);

const atLimit = map(places(SPATIAL_MAP_LOCATION_LIMIT));
assert.deepEqual(validateSpatialMapDefinition(atLimit), { valid: true, issues: [] });
assert.equal(spatialMapDefinitionSchema.safeParse(atLimit).success, true);
assert.equal(
  updateSpatialMapRequestSchema.safeParse({ expectedRevision: 0, expectedCurrentLocationId: null, definition: atLimit })
    .success,
  true,
  "saving a map must accept the package ceiling, not the vendored 500",
);

const overLimit = map(places(SPATIAL_MAP_LOCATION_LIMIT + 1));
assert.deepEqual(
  validateSpatialMapDefinition(overLimit).issues.map((issue) => issue.code),
  ["too_many_locations"],
);
assert.equal(spatialMapDefinitionSchema.safeParse(overLimit).success, false);

// Every other shared rule still applies.
const duplicate = map([place(0), place(0)]);
assert.ok(validateSpatialMapDefinition(duplicate).issues.some((issue) => issue.code === "duplicate_location_id"));

console.log("World Maps location limit regression passed.");
