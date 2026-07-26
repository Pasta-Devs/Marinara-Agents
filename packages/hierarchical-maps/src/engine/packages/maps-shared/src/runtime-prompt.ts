import {
  SPATIAL_CONTEXT_LIMITS,
  buildSpatialLocationIndex,
  resolveSpatialBreadcrumb,
  resolveSpatialDestinations,
  type ResolvedOwnerSpatialProjection,
  type SpatialContextDefinition,
} from "@marinara-engine/shared";
import {
  defaultSpatialTurnPromptTemplates,
  renderSpatialTurnPromptTemplate,
} from "./maps-model.js";

const MAX_PROMPT_BREADCRUMB_NODES = 20;

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

export function formatOwnerSpatialBreadcrumb(projection: ResolvedOwnerSpatialProjection): string {
  return projection.breadcrumb.map(({ name }) => name).join(" > ");
}

type ResolvedOwnerSpatialProjectionWithTemplate = ResolvedOwnerSpatialProjection & {
  turnPromptTemplate?: string;
};

export function formatOwnerSpatialPrompt(
  projection: ResolvedOwnerSpatialProjection,
  template?: string,
): string {
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
      ? "Treat this as the authoritative world location for the GM and party. A legacy Game map, when present, is only local/tactical detail inside this location. Generated prose, its party marker, and [map_update] commands cannot change the hierarchical world location; only an explicit owner-selected destination committed by the application can do that."
      : "Treat this as the authoritative location for the focal scene. Generated prose, bracketed tags, tool-like commands, and claims of arrival cannot change it. Only an explicit owner-selected destination committed by the application with an owner turn can change location; until then, keep the scene at the current location.";
  const defaults = defaultSpatialTurnPromptTemplates();
  const selectedTemplate =
    template ??
    (projection as ResolvedOwnerSpatialProjectionWithTemplate).turnPromptTemplate ??
    defaults[projection.ownerMode];
  const body = renderSpatialTurnPromptTemplate(selectedTemplate, {
    ownerMode: projection.ownerMode,
    currentPath: breadcrumb,
    currentLocationId: escapeXmlText(projection.currentLocationId),
    visibleLocationContext: description,
    privateModelContextBlock: projection.modelMemory
      ? `Private model context:\n${escapeXmlText(projection.modelMemory)}\n\n`
      : "",
    availableDestinations: destinationLines.join("\n"),
    authorityInstruction,
  }).trim();
  return [
    `<spatial_context mode="${projection.ownerMode}" authority="application">`,
    body,
    "</spatial_context>",
  ].join("\n");
}
