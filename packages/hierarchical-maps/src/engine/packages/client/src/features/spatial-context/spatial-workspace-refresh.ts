import type { SpatialContextDefinition } from "@marinara-engine/shared";
import type { SpatialHierarchyProfile } from "../../../../maps-shared/src/maps-model";

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function shouldRefreshSpatialWorkspace(options: {
  initialized: boolean;
  templateMode: boolean;
  dirty: boolean;
  baseDefinition: SpatialContextDefinition | null;
  serverDefinition: SpatialContextDefinition | null;
  baseHierarchyProfile: SpatialHierarchyProfile;
  serverHierarchyProfile: SpatialHierarchyProfile;
}): boolean {
  if (!options.initialized || options.templateMode || options.dirty) return false;
  return (
    !sameValue(options.baseDefinition, options.serverDefinition) ||
    !sameValue(options.baseHierarchyProfile, options.serverHierarchyProfile)
  );
}
