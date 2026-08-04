import assert from "node:assert/strict";
import {
  locationArtworkGaps,
  replacementArtworkPatch,
} from "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/location-artwork";

const locations = [
  {
    id: "complete",
    status: "active",
    childPresentation: "map",
    referenceImageId: "gallery-complete",
    mapBackgroundImageId: "gallery-complete",
  },
  {
    id: "reference-rejected",
    status: "active",
    childPresentation: "map",
    referenceImageId: undefined,
    mapBackgroundImageId: "gallery-background",
  },
  {
    id: "dangling-both",
    status: "active",
    childPresentation: "map",
    referenceImageId: "gallery-deleted",
    mapBackgroundImageId: "gallery-deleted",
  },
  {
    id: "archived",
    status: "archived",
    childPresentation: "map",
  },
] as const;

const loading = locationArtworkGaps(locations, new Set<string>(), false);
assert.deepEqual(
  loading.map((gap) => gap.location.id),
  ["reference-rejected"],
  "Unresolved Gallery queries must not classify saved IDs as dangling",
);

const resolved = locationArtworkGaps(
  locations,
  new Set(["gallery-complete", "gallery-background"]),
  true,
);
assert.deepEqual(
  resolved.map(({ location, referenceMissing, mapBackgroundMissing }) => ({
    id: location.id,
    referenceMissing,
    mapBackgroundMissing,
  })),
  [
    {
      id: "reference-rejected",
      referenceMissing: true,
      mapBackgroundMissing: false,
    },
    { id: "dangling-both", referenceMissing: true, mapBackgroundMissing: true },
  ],
  "Rejected and dangling roles must each remain eligible for a provider replacement request",
);
assert.equal(
  resolved.length,
  2,
  "Every incomplete active location must map to one explicit provider request",
);
assert.deepEqual(
  replacementArtworkPatch(resolved[0]!, "gallery-new-reference"),
  {
    referenceImageId: "gallery-new-reference",
    useReferenceImage: true,
  },
  "A rejected reference must receive a new image without replacing or copying its surviving background",
);
assert.deepEqual(
  replacementArtworkPatch(resolved[1]!, "gallery-new-both"),
  {
    referenceImageId: "gallery-new-both",
    useReferenceImage: true,
    mapBackgroundImageId: "gallery-new-both",
    mapBackgroundPosition: { x: 50, y: 50 },
  },
  "One generated image must replace both dangling roles",
);

console.info(
  "World Maps artwork rejection and dangling-link regression passed.",
);
