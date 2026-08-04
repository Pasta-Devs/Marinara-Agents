export interface LocationArtworkAssignment {
  id: string;
  status: string;
  childPresentation: string;
  referenceImageId?: string | null;
  useReferenceImage?: boolean;
  mapBackgroundImageId?: string | null;
  mapBackgroundPosition?: { x: number; y: number };
}

export interface LocationArtworkGap<
  TLocation extends LocationArtworkAssignment,
> {
  location: TLocation;
  referenceMissing: boolean;
  mapBackgroundMissing: boolean;
}

export interface LocationArtworkReplacement {
  referenceImageId?: string;
  useReferenceImage?: true;
  mapBackgroundImageId?: string;
  mapBackgroundPosition?: { x: number; y: number };
}

/**
 * Resolve the artwork roles that need replacement. Existing IDs remain trusted
 * until both Gallery queries finish so a loading or failed query cannot make a
 * valid assignment look dangling.
 */
export function locationArtworkGaps<
  TLocation extends LocationArtworkAssignment,
>(
  locations: readonly TLocation[],
  availableReferenceIds: ReadonlySet<string>,
  referencesResolved: boolean,
): Array<LocationArtworkGap<TLocation>> {
  const isAvailable = (referenceId: string | null | undefined) =>
    Boolean(
      referenceId &&
      (!referencesResolved || availableReferenceIds.has(referenceId)),
    );

  return locations.flatMap((location) => {
    if (location.status !== "active") return [];
    const referenceMissing = !isAvailable(location.referenceImageId);
    const mapBackgroundMissing =
      location.childPresentation === "map" &&
      !isAvailable(location.mapBackgroundImageId);
    return referenceMissing || mapBackgroundMissing
      ? [{ location, referenceMissing, mapBackgroundMissing }]
      : [];
  });
}

export function replacementArtworkPatch(
  gap: Pick<
    LocationArtworkGap<LocationArtworkAssignment>,
    "referenceMissing" | "mapBackgroundMissing"
  >,
  imageId: string,
  currentBackgroundPosition?: { x: number; y: number },
): LocationArtworkReplacement {
  return {
    ...(gap.referenceMissing
      ? { referenceImageId: imageId, useReferenceImage: true as const }
      : {}),
    ...(gap.mapBackgroundMissing
      ? {
          mapBackgroundImageId: imageId,
          mapBackgroundPosition: currentBackgroundPosition ?? { x: 50, y: 50 },
        }
      : {}),
  };
}

/** Preserve artwork roles changed after generation began while filling roles that remain unchanged and missing. */
export function replacementArtworkPatchForCurrentLocation<
  TLocation extends LocationArtworkAssignment,
>(
  originalGap: LocationArtworkGap<TLocation>,
  currentLocation: TLocation,
  imageId: string,
): LocationArtworkReplacement | null {
  if (currentLocation.status !== "active") return null;
  const referenceMissing =
    originalGap.referenceMissing &&
    currentLocation.referenceImageId === originalGap.location.referenceImageId &&
    currentLocation.useReferenceImage === originalGap.location.useReferenceImage;
  const mapBackgroundMissing =
    originalGap.mapBackgroundMissing &&
    currentLocation.childPresentation === "map" &&
    currentLocation.mapBackgroundImageId === originalGap.location.mapBackgroundImageId;
  if (!referenceMissing && !mapBackgroundMissing) return null;
  return replacementArtworkPatch(
    { referenceMissing, mapBackgroundMissing },
    imageId,
    currentLocation.mapBackgroundPosition,
  );
}
