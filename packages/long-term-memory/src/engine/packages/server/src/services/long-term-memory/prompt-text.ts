import {
  type LtmRelationshipDimensionChanges,
  type LtmRelationshipDimensions,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { RELATIONSHIP_DIMENSIONS } from "../../../../shared/src/features/agents/long-term-memory/constants.js";
import { cleanLongTermMemoryChunkText } from "./chunking.js";
import type { LtmMemoryChunk } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

const RELATIONSHIP_DIMENSION_ORDER = new Map(RELATIONSHIP_DIMENSIONS.map((dimension, index) => [dimension, index]));

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatSignedDelta(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function orderedRelationshipDimensionNames(
  dimensions?: LtmRelationshipDimensions,
  dimensionChanges?: LtmRelationshipDimensionChanges,
) {
  const names = new Set<string>();
  for (const [name, value] of Object.entries(dimensions ?? {})) {
    if (isFiniteNumber(value)) names.add(name);
  }
  for (const [name, value] of Object.entries(dimensionChanges ?? {})) {
    if (isFiniteNumber(value) && value !== 0) names.add(name);
  }

  return Array.from(names).sort((left, right) => {
    const leftOrder = RELATIONSHIP_DIMENSION_ORDER.get(left as (typeof RELATIONSHIP_DIMENSIONS)[number]);
    const rightOrder = RELATIONSHIP_DIMENSION_ORDER.get(right as (typeof RELATIONSHIP_DIMENSIONS)[number]);
    if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return left.localeCompare(right);
  });
}

export function formatLtmRelationshipScoresLine(
  dimensions?: LtmRelationshipDimensions,
  dimensionChanges?: LtmRelationshipDimensionChanges,
) {
  const dimensionRecord = dimensions as Record<string, unknown> | undefined;
  const changeRecord = dimensionChanges as Record<string, unknown> | undefined;
  const entries = orderedRelationshipDimensionNames(dimensions, dimensionChanges).flatMap((dimension) => {
    const score = dimensionRecord?.[dimension];
    const delta = changeRecord?.[dimension];
    const hasScore = isFiniteNumber(score);
    const hasDelta = isFiniteNumber(delta) && delta !== 0;
    if (hasScore) {
      return [`${dimension} ${score}/100${hasDelta ? ` (${formatSignedDelta(delta)})` : ""}`];
    }
    if (hasDelta) {
      return [`${dimension} change ${formatSignedDelta(delta)}`];
    }
    return [];
  });

  return entries.length > 0 ? `Relationship scores: ${entries.join(", ")}` : "";
}

export function formatLtmChunkPromptText(chunk: LtmMemoryChunk) {
  const text = cleanLongTermMemoryChunkText(chunk.text);
  if (!text) return "";

  if (chunk.noteType === "relationship") {
    const scoresLine = formatLtmRelationshipScoresLine(chunk.dimensions, chunk.dimensionChanges);
    return scoresLine ? `${scoresLine}\n${text}` : text;
  }

  if (chunk.noteType === "thread") {
    const questTag = chunk.tags.includes("quest") ? " quest" : "";
    return `${text} [${chunk.status}${questTag}]`;
  }

  return text;
}
