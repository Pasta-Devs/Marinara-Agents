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
const MAX_PROMPT_KNOWN_LOCATIONS = 50;

type ResolvedOwnerSpatialProjectionWithKnownLocationLimit = ResolvedOwnerSpatialProjection & {
  omittedKnownLocationCount?: number;
};

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
): ResolvedOwnerSpatialProjectionWithKnownLocationLimit | null {
  if (!definition?.enabled || !currentLocationId) return null;

  const current = buildSpatialLocationIndex(definition).get(currentLocationId);
  if (!current) return null;

  const allDestinations = resolveSpatialDestinations(definition, currentLocationId);
  const destinations = allDestinations.slice(0, SPATIAL_CONTEXT_LIMITS.maxPromptDestinations);
  const allKnownLocations = definition.locations.filter((location) => location.status === "active");
  const knownLocations = allKnownLocations
    .slice(0, MAX_PROMPT_KNOWN_LOCATIONS)
    .map((location) => ({
      id: location.id,
      path: resolveSpatialBreadcrumb(definition, location.id)
        .slice(-MAX_PROMPT_BREADCRUMB_NODES)
        .map(({ name }) => boundedText(name, SPATIAL_CONTEXT_LIMITS.maxNameLength))
        .join(" > "),
    }));
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
    referenceImageId: current.referenceImageId?.trim() || null,
    useReferenceImage: current.useReferenceImage === true,
    destinations,
    knownLocations,
    omittedKnownLocationCount: Math.max(0, allKnownLocations.length - knownLocations.length),
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
  const knownLocationLines = projection.knownLocations?.length
    ? projection.knownLocations.map(
        ({ id, path }) => `- ${escapeXmlText(path)} [${escapeXmlText(id)}]`,
      )
    : ["- None"];
  const omittedKnownLocationCount =
    (projection as ResolvedOwnerSpatialProjectionWithKnownLocationLimit).omittedKnownLocationCount ?? 0;
  if (omittedKnownLocationCount > 0) {
    knownLocationLines.push(`- ${omittedKnownLocationCount} additional known locations omitted.`);
  }
  const knownLocationIndex = [
    "Known map locations (active breadcrumb names and exact IDs only):",
    ...knownLocationLines,
    "",
  ].join("\n");
  const userLedTransitionInstruction =
    'Use the latest user message as the authority for map changes. Treat direct present-tense or imperative movement by the focal party, such as “We go to the Kitchen” or “We follow her into the outdoor section,” as establishing arrival for this turn. When that user-led arrival matches a known map location, append [spatial_move: destination_id="exact_id"] as the final line, even when it was reached through a newly revealed or secret route; the application records that direct route. When the user explicitly establishes discovery or arrival at a significant named, durable, revisitable place that has no known match, such as “We discover a hidden room,” append [spatial_discover: name="Place Name" relation="enter" description="Short orientation"] as the final line; use relation="link" for a neighboring or travel-connected place rather than a place inside the current one. The visible response may narrate the consequence, but your own narration alone never authorizes either command. Do not emit either command for future intentions, failed or unfinished travel, mentions, NPC-only movement, imagined places, temporary camps, hallways, vehicles, or other transient scene details. These commands are hidden from the user and validated by the application.';
  const authorityInstruction =
    projection.ownerMode === "game"
      ? `${knownLocationIndex}Treat this as the authoritative world location for the GM and party. A legacy Game map, when present, is only local/tactical detail inside this location. Keep the current location unless the latest user message establishes a change. ${userLedTransitionInstruction}`
      : `${knownLocationIndex}Treat this as the authoritative location for the focal scene. Keep the current location unless the latest user message establishes a change. ${userLedTransitionInstruction}`;
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
