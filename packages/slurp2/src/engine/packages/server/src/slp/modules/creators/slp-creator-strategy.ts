/**
 * How this Creator runs their page.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * ## The problem
 *
 * Every rule the planner follows was the same for everybody. One skip rate, one set of intent
 * weights, one lean on text. Two Creators with nothing in common posted at the same rhythm, and a
 * player who wanted one of them to be the quiet one who mostly writes had nowhere to say so.
 *
 * ## The approach
 *
 * Every Creator gets a derived strategy: stable, based on the production style they already have,
 * and usable with nothing stored. Anything the user saves overrides one value and leaves the rest
 * derived, so a Creator keeps following the automatic profile as the defaults improve.
 *
 * The strategy says how this person uses Slurp. It must never carry voice, identity, appearance,
 * or personality — those belong to the source Character card. `strategyText` is the one free-text
 * field, and it is supplementary: the bounded numbers stay the source for every decision.
 */

import type { SlpCreatorStrategySettings } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";
import { SLURP_CONTENT_INTENTS } from "../../../../../shared/src/slp/slp-content-axes.js";
import {
  slurpProductionInstruction,
  slurpProductionProfile,
  SLURP_PRODUCTION_STYLES,
  type SlurpProductionProfile,
  type SlurpProductionStyle,
} from "./slp-production-profile.js";

export type SlurpCreatorStrategy = {
  production: SlurpProductionProfile;
  /** Out of 100. How often a scheduled slot goes unused. */
  skipRate: number;
  /** Out of 100. Scales every intent's lean on words instead of pictures. */
  textOnlyRate: number;
  /** Relative weight per intent, before the story and teaser decisions are applied. */
  intentWeights: Partial<Record<SlurpContentIntent, number>>;
  /** Supplementary prose. Empty when the user has not written any. */
  strategyText: string;
};

export const SLURP_STRATEGY_LIMITS = {
  skipRate: { min: 0, max: 40 },
  textOnlyRate: { min: 0, max: 100 },
  intentWeight: { min: 0, max: 100 },
  strategyText: 2000,
} as const;

/**
 * What each production style implies about posting rhythm.
 *
 * A Creator who shoots on a phone posts more often and writes more; one who runs a set posts less
 * often and almost always has a picture, because the picture is the thing they made.
 */
const DERIVED: Record<SlurpProductionStyle, { skipRate: number; textOnlyRate: number }> = {
  homemade: { skipRate: 10, textOnlyRate: 60 },
  polished: { skipRate: 14, textOnlyRate: 30 },
  documentary: { skipRate: 8, textOnlyRate: 55 },
  theatrical: { skipRate: 18, textOnlyRate: 25 },
};

function clamp(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function style(stored: SlpCreatorStrategySettings | undefined, derived: SlurpProductionStyle): SlurpProductionStyle {
  const value = stored?.style;
  return (SLURP_PRODUCTION_STYLES as readonly string[]).includes(value ?? "")
    ? (value as SlurpProductionStyle)
    : derived;
}

/** This Creator's strategy: derived from their production style, overridden by anything saved. */
export function slurpCreatorStrategy(
  creatorAccountId: string,
  stored?: SlpCreatorStrategySettings,
): SlurpCreatorStrategy {
  const production = slurpProductionProfile(
    creatorAccountId,
    style(stored, slurpProductionProfile(creatorAccountId).style),
  );
  const derived = DERIVED[production.style];
  const intentWeights: Partial<Record<SlurpContentIntent, number>> = {};
  for (const intent of SLURP_CONTENT_INTENTS) {
    const weight = clamp(
      stored?.intentWeights?.[intent],
      SLURP_STRATEGY_LIMITS.intentWeight.min,
      SLURP_STRATEGY_LIMITS.intentWeight.max,
    );
    if (weight !== null) intentWeights[intent] = weight;
  }
  return {
    production,
    skipRate:
      clamp(stored?.skipRate, SLURP_STRATEGY_LIMITS.skipRate.min, SLURP_STRATEGY_LIMITS.skipRate.max) ??
      derived.skipRate,
    textOnlyRate:
      clamp(stored?.textOnlyRate, SLURP_STRATEGY_LIMITS.textOnlyRate.min, SLURP_STRATEGY_LIMITS.textOnlyRate.max) ??
      derived.textOnlyRate,
    intentWeights,
    strategyText: (stored?.strategyText ?? "").trim().slice(0, SLURP_STRATEGY_LIMITS.strategyText),
  };
}

/**
 * The production block's text: how this Creator makes things, plus their own note on how they run
 * the page. The note is framed as the Creator's own habit so it can never read as a new identity.
 */
export function slurpStrategyInstruction(strategy: SlurpCreatorStrategy): string {
  return [
    slurpProductionInstruction(strategy.production),
    strategy.strategyText ? `How you run your page, in your own words: ${strategy.strategyText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Validate what the user saved. Out-of-range and unknown values are dropped, not clamped silently. */
export function normalizeSlurpCreatorStrategy(value: unknown): SlpCreatorStrategySettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const next: SlpCreatorStrategySettings = {};
  if ((SLURP_PRODUCTION_STYLES as readonly string[]).includes(String(raw.style))) next.style = String(raw.style);
  const skipRate = clamp(raw.skipRate, SLURP_STRATEGY_LIMITS.skipRate.min, SLURP_STRATEGY_LIMITS.skipRate.max);
  if (skipRate !== null) next.skipRate = skipRate;
  const textOnlyRate = clamp(
    raw.textOnlyRate,
    SLURP_STRATEGY_LIMITS.textOnlyRate.min,
    SLURP_STRATEGY_LIMITS.textOnlyRate.max,
  );
  if (textOnlyRate !== null) next.textOnlyRate = textOnlyRate;
  const weights: Record<string, number> = {};
  const storedWeights = raw.intentWeights;
  if (storedWeights && typeof storedWeights === "object" && !Array.isArray(storedWeights)) {
    for (const intent of SLURP_CONTENT_INTENTS) {
      const weight = clamp(
        (storedWeights as Record<string, unknown>)[intent],
        SLURP_STRATEGY_LIMITS.intentWeight.min,
        SLURP_STRATEGY_LIMITS.intentWeight.max,
      );
      if (weight !== null) weights[intent] = weight;
    }
  }
  if (Object.keys(weights).length > 0) next.intentWeights = weights;
  if (typeof raw.strategyText === "string" && raw.strategyText.trim()) {
    next.strategyText = raw.strategyText.trim().slice(0, SLURP_STRATEGY_LIMITS.strategyText);
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
