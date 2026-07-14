import {
  SPATIAL_CONTEXT_LIMITS,
  buildSpatialLocationIndex,
  resolveSpatialBreadcrumb,
  resolveSpatialDestinations,
  type ResolvedOwnerSpatialProjection,
  type SpatialContextDefinition,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { resolveEffectiveSpatialState, type ResolveSpatialStateOptions } from "./state-resolution.js";

const MAX_PROMPT_BREADCRUMB_NODES = 20;
const OWNER_SPATIAL_BLOCK_PATTERN =
  /<spatial_context mode="(?:roleplay|game)" authority="application">[\s\S]*?<\/spatial_context>/;

function boundedText(value: string | undefined, maximumLength: number): string {
  return (value ?? "").trim().slice(0, maximumLength);
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

export function buildOwnerSpatialProjection(
  chatId: string,
  definition: SpatialContextDefinition | null,
  currentLocationId: string | null,
): ResolvedOwnerSpatialProjection | null {
  if (!definition?.enabled || !currentLocationId) return null;

  const current = buildSpatialLocationIndex(definition).get(currentLocationId);
  if (!current) return null;

  const allDestinations = resolveSpatialDestinations(definition, currentLocationId);
  const destinations = allDestinations.slice(0, SPATIAL_CONTEXT_LIMITS.maxPromptDestinations);
  return {
    kind: "owner",
    chatId,
    ownerMode: definition.ownerMode,
    definitionRevision: definition.revision,
    currentLocationId,
    breadcrumb: resolveSpatialBreadcrumb(definition, currentLocationId)
      .slice(-MAX_PROMPT_BREADCRUMB_NODES)
      .map(({ id, name }) => ({ id, name: boundedText(name, SPATIAL_CONTEXT_LIMITS.maxNameLength) })),
    description: boundedText(current.description, SPATIAL_CONTEXT_LIMITS.maxDescriptionLength),
    modelMemory: current.modelMemory
      ? boundedText(current.modelMemory, SPATIAL_CONTEXT_LIMITS.maxModelMemoryLength) || null
      : null,
    destinations,
    lorebookEntryIds: current.lorebookEntryIds,
    omittedDestinationCount: Math.max(0, allDestinations.length - destinations.length),
  };
}

export async function resolveOwnerSpatialProjection(
  db: DB,
  chatId: string,
  options: ResolveSpatialStateOptions = {},
): Promise<ResolvedOwnerSpatialProjection | null> {
  const state = await resolveEffectiveSpatialState(db, chatId, options);
  return buildOwnerSpatialProjection(chatId, state.definition, state.currentLocationId);
}

export function formatOwnerSpatialBreadcrumb(projection: ResolvedOwnerSpatialProjection): string {
  return projection.breadcrumb.map(({ name }) => name).join(" > ");
}

export function formatOwnerSpatialPrompt(projection: ResolvedOwnerSpatialProjection): string {
  const breadcrumb = escapeXmlText(formatOwnerSpatialBreadcrumb(projection));
  const description = projection.description
    ? escapeXmlText(projection.description)
    : "(No public description is set.)";
  const destinationLines = projection.destinations.length
    ? projection.destinations.map((destination) => {
        const label = destination.label ? ` — ${escapeXmlText(destination.label)}` : "";
        return `- ${escapeXmlText(destination.name)} [${escapeXmlText(destination.id)}]${label}`;
      })
    : ["- None"];
  if (projection.omittedDestinationCount > 0) {
    destinationLines.push(`- ${projection.omittedDestinationCount} additional destinations omitted.`);
  }
  const authorityInstruction =
    projection.ownerMode === "game"
      ? "Treat this as the authoritative location for the GM and party. The application, not generated tracker text, commits location changes."
      : "Treat this as the authoritative location for the focal scene. The application, not generated narration, commits location changes.";

  return [
    `<spatial_context mode="${projection.ownerMode}" authority="application">`,
    `Current path: ${breadcrumb}`,
    `Current location ID: ${escapeXmlText(projection.currentLocationId)}`,
    "",
    "Visible location context:",
    description,
    ...(projection.modelMemory ? ["", "Private model context:", escapeXmlText(projection.modelMemory)] : []),
    "",
    "Available destinations:",
    ...destinationLines,
    "",
    authorityInstruction,
    "</spatial_context>",
  ].join("\n");
}

export function injectOwnerSpatialPrompt<T extends { role: "system" | "user" | "assistant"; content: string }>(
  messages: T[],
  projection: ResolvedOwnerSpatialProjection | null,
): T[] {
  if (!projection) return messages;
  const next = messages.slice();
  const block = formatOwnerSpatialPrompt(projection);
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
