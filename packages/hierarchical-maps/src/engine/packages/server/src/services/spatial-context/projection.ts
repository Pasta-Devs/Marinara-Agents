import type { ResolvedOwnerSpatialProjection } from "@marinara-engine/shared";
import { resolveEffectiveSpatialState, type ResolveSpatialStateOptions } from "./state-resolution.js";
import { getPackageAgentSettings, logger } from "./package-runtime.js";
import {
  buildOwnerSpatialProjection,
  formatOwnerSpatialBreadcrumb,
  formatOwnerSpatialPrompt,
} from "../../../../maps-shared/src/runtime-prompt.js";
import {
  defaultSpatialTurnPromptTemplates,
  normalizeSpatialTurnPromptTemplates,
  SPATIAL_TURN_PROMPT_TEMPLATES_SETTINGS_KEY,
} from "../../../../maps-shared/src/maps-model.js";

export { buildOwnerSpatialProjection, formatOwnerSpatialBreadcrumb, formatOwnerSpatialPrompt };

const OWNER_SPATIAL_BLOCK_PATTERN =
  /<spatial_context mode="(?:roleplay|game)" authority="application">[\s\S]*?<\/spatial_context>/;
const LEGACY_GAME_MAP_STATE_PATTERN = /<map_state>([\s\S]*?)<\/map_state>/g;
const LEGACY_GAME_MAP_UPDATE_PATTERN = /^[ \t]*- \[map_update:[^\r\n]*$/gim;
const LOCAL_GAME_MAP_UPDATE_INSTRUCTION =
  `- [map_update: new_location="Location Name" connected_to="Previous Location Name" node_emoji="emoji"] - only to add local/tactical detail inside the current hierarchical location. This may move the legacy Local map marker, but it must never represent or cause travel between hierarchical locations; the application commits world movement.`;

function scopeLegacyGameMapPrompt(
  content: string,
  role: "system" | "user" | "assistant",
): string {
  if (role === "assistant") return content;

  let scoped = content.replace(LEGACY_GAME_MAP_STATE_PATTERN, (_match, state: string) => {
    const normalizedState = state.trim();
    return [
      `<local_map_state authority="tactical" world_location_source="spatial_context">`,
      `This legacy Game map is local/tactical detail inside the authoritative hierarchical location. Its party marker cannot change the hierarchical world location.`,
      ...(normalizedState ? ["", normalizedState] : []),
      `</local_map_state>`,
    ].join("\n");
  });

  const isGeneratedGameInstruction =
    role === "system" || (scoped.includes("<output_format>") && scoped.includes("COMMANDS:"));
  if (isGeneratedGameInstruction) {
    scoped = scoped.replace(LEGACY_GAME_MAP_UPDATE_PATTERN, LOCAL_GAME_MAP_UPDATE_INSTRUCTION);
  }
  return scoped;
}

export async function resolveOwnerSpatialProjection(
  chatId: string,
  options: ResolveSpatialStateOptions = {},
): Promise<ResolvedOwnerSpatialProjection | null> {
  const state = await resolveEffectiveSpatialState(chatId, options);
  const projection = buildOwnerSpatialProjection(chatId, state.definition, state.currentLocationId);
  if (!projection) return null;
  const settings = await getPackageAgentSettings("hierarchical-maps").catch((error) => {
    logger.warn("Could not read global Hierarchical Maps turn prompt templates; using built-ins: %s", error);
    return {};
  });
  const templates = normalizeSpatialTurnPromptTemplates(
    settings[SPATIAL_TURN_PROMPT_TEMPLATES_SETTINGS_KEY],
  );
  return {
    ...projection,
    turnPromptTemplate: templates[projection.ownerMode],
  } as ResolvedOwnerSpatialProjection;
}

export function injectOwnerSpatialPrompt<T extends { role: "system" | "user" | "assistant"; content: string }>(
  messages: T[],
  projection: ResolvedOwnerSpatialProjection | null,
): T[] {
  if (!projection) return messages;
  const next =
    projection.ownerMode === "game"
      ? messages.map((message) => ({
          ...message,
          content: scopeLegacyGameMapPrompt(message.content, message.role),
        }))
      : messages.slice();
  let block: string;
  try {
    block = formatOwnerSpatialPrompt(projection);
  } catch (error) {
    logger.warn(
      "Could not render the saved Hierarchical Maps turn prompt template; using the built-in: %s",
      error instanceof Error ? error.message : String(error),
    );
    block = formatOwnerSpatialPrompt(
      projection,
      defaultSpatialTurnPromptTemplates()[projection.ownerMode],
    );
  }
  const existingIndex = next.findIndex(
    (message) => message.role === "system" && OWNER_SPATIAL_BLOCK_PATTERN.test(message.content),
  );
  if (existingIndex >= 0) {
    const existing = next[existingIndex]!;
    next[existingIndex] = {
      ...existing,
      content: existing.content.replace(OWNER_SPATIAL_BLOCK_PATTERN, block),
    };
    return next;
  }
  const firstHistoryIndex = next.findIndex((message) => message.role !== "system");
  const insertAt = firstHistoryIndex >= 0 ? firstHistoryIndex : next.length;
  next.splice(insertAt, 0, {
    role: "system",
    content: block,
  } as T);
  return next;
}

export function projectGameSnapshotLocation<T extends object>(
  snapshot: T | null,
  projection: ResolvedOwnerSpatialProjection | null,
): T | null {
  if (!snapshot || projection?.ownerMode !== "game") return snapshot;
  return { ...snapshot, location: formatOwnerSpatialBreadcrumb(projection) };
}

export function omitAuthoritativeGameLocation<T extends Record<string, unknown>>(
  patch: T,
  projection: ResolvedOwnerSpatialProjection | null,
): T {
  if (projection?.ownerMode !== "game" || !("location" in patch)) return patch;
  const { location: _ignored, ...remaining } = patch;
  return remaining as T;
}
