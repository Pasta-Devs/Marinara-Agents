import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { SpatialContextDefinition, SpatialLocationKind } from "@marinara-engine/shared";
import {
  hierarchyTypeId,
  defaultHierarchyProfile,
  moveSpatialHierarchyType,
  type SpatialHierarchyProfile,
} from "../../../../../maps-shared/src/maps-model";

export interface SpatialHierarchyProfileDraft {
  definition: SpatialContextDefinition;
  profile: SpatialHierarchyProfile;
}

interface SpatialHierarchyProfileFieldsProps extends SpatialHierarchyProfileDraft {
  editable?: boolean;
  disabled?: boolean;
  onChange: (draft: SpatialHierarchyProfileDraft) => void;
}

export function SpatialHierarchyProfileFields({
  definition,
  profile,
  editable = true,
  disabled = false,
  onChange,
}: SpatialHierarchyProfileFieldsProps) {
  const assignedTypeIds = new Set(
    definition.locations.map((location) => profile.locationTypeIds[location.id]).filter(Boolean),
  );
  const applyProfile = (nextProfile: SpatialHierarchyProfile, nextDefinition = definition) => {
    onChange({
      definition: nextDefinition,
      profile: nextProfile,
    });
  };
  const profileNameMissing = editable && profile.name.trim().length === 0;

  return (
    <>
      <label className="block max-w-md text-xs font-medium text-[var(--marinara-editor-title)]">
        Profile name
        <input
          value={profile.name}
          maxLength={120}
          readOnly={!editable}
          disabled={disabled}
          aria-invalid={profileNameMissing}
          onChange={(event) =>
            applyProfile({
              ...profile,
              mode: "custom",
              name: event.target.value,
            })
          }
          className="mt-1 min-h-11 w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-xs read-only:cursor-default disabled:opacity-50"
        />
        {profileNameMissing && (
          <span className="mt-1 block text-[0.6875rem] text-[var(--destructive)]" role="alert">
            Profile name is required. Spaces will be trimmed when you save.
          </span>
        )}
      </label>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {profile.types.map((type, index) => (
          <div
            key={type.id}
            className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-2"
          >
            <input
              aria-label={`Location type ${index + 1} label`}
              value={type.label}
              maxLength={80}
              readOnly={!editable}
              disabled={disabled}
              onChange={(event) =>
                applyProfile({
                  ...profile,
                  mode: "custom",
                  types: profile.types.map((candidate) =>
                    candidate.id === type.id ? { ...candidate, label: event.target.value } : candidate,
                  ),
                })
              }
              className="min-h-11 min-w-0 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-xs read-only:cursor-default disabled:opacity-50"
            />
            <select
              aria-label={`${type.label || `Location type ${index + 1}`} semantic base kind`}
              value={type.baseKind}
              disabled={!editable || disabled}
              onChange={(event) => {
                const baseKind = event.target.value as SpatialLocationKind;
                const nextDefinition = {
                  ...definition,
                  locations: definition.locations.map((location) =>
                    profile.locationTypeIds[location.id] === type.id ? { ...location, kind: baseKind } : location,
                  ),
                };
                applyProfile(
                  {
                    ...profile,
                    mode: "custom",
                    types: profile.types.map((candidate) =>
                      candidate.id === type.id ? { ...candidate, baseKind } : candidate,
                    ),
                  },
                  nextDefinition,
                );
              }}
              className="min-h-11 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-2 text-[0.625rem] disabled:cursor-default disabled:opacity-70"
            >
              {(["region", "settlement", "place", "building", "floor", "room"] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            {editable && (
              <div
                className="col-span-2 flex items-center justify-end gap-1"
                aria-label={`Order ${type.label || "location type"}`}
              >
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => applyProfile(moveSpatialHierarchyType(profile, type.id, -1))}
                  className="mari-chrome-control h-11 w-11 p-0 disabled:opacity-35"
                  aria-label={`Move ${type.label || "location type"} up`}
                  title="Move up"
                >
                  <ArrowUp size="0.75rem" />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === profile.types.length - 1}
                  onClick={() => applyProfile(moveSpatialHierarchyType(profile, type.id, 1))}
                  className="mari-chrome-control h-11 w-11 p-0 disabled:opacity-35"
                  aria-label={`Move ${type.label || "location type"} down`}
                  title="Move down"
                >
                  <ArrowDown size="0.75rem" />
                </button>
                <button
                  type="button"
                  disabled={disabled || profile.types.length === 1 || assignedTypeIds.has(type.id)}
                  onClick={() =>
                    applyProfile({
                      ...profile,
                      mode: "custom",
                      types: profile.types.filter((candidate) => candidate.id !== type.id),
                    })
                  }
                  className="mari-chrome-control h-11 w-11 p-0 disabled:opacity-35"
                  aria-label={`Remove ${type.label || "location type"}`}
                  title={assignedTypeIds.has(type.id) ? "Reassign locations before removing this type." : "Remove type"}
                >
                  <Trash2 size="0.75rem" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editable && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || profile.types.length >= 40}
            onClick={() => {
              const base = hierarchyTypeId(`custom-${profile.types.length + 1}`);
              let id = base;
              let suffix = 2;
              while (profile.types.some((type) => type.id === id)) id = `${base}_${suffix++}`;
              applyProfile({
                ...profile,
                mode: "custom",
                types: [
                  ...profile.types,
                  { id, label: `Location type ${profile.types.length + 1}`, baseKind: "place" },
                ],
              });
            }}
            className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
          >
            <Plus size="0.75rem" /> Add location type
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const defaults = defaultHierarchyProfile(definition);
              applyProfile({
                ...defaults,
                showConnections: profile.showConnections,
                linkPresentations: profile.linkPresentations,
              });
            }}
            className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
          >
            <RotateCcw size="0.75rem" /> Revert to defaults
          </button>
        </div>
      )}
    </>
  );
}
