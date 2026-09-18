/**
 * Cross-feature numeric modifiers.
 *
 * A modifier is the whole vocabulary one feature has for nudging another feature's number. It is
 * deliberately not an event bus: there is no payload, no handler, and no subscription. World
 * produces modifiers from the events running at a timestamp, Economy asks for the ones aimed at it,
 * and nothing is stored. That is what makes the behaviour restart-safe — re-evaluating the same
 * settings at the same time gives the same answer, so a modifier never has to be undone.
 *
 * Add a target here only when a real feature needs it. A non-numeric reaction needs its own
 * contract, not a wider `value`.
 */

/** Every number another feature may modify. One entry today, on purpose. */
export type SlpModifierTarget = "economy.subscription-price";

export type SlpModifierOperation = "multiply" | "add";

/** Who asked for the change. `id` orders resolution, so it must identify the source uniquely. */
export type SlpModifierSourceRef = { kind: "platform-event"; id: string };

export type SlpModifier = {
  target: SlpModifierTarget;
  operation: SlpModifierOperation;
  value: number;
  source: SlpModifierSourceRef;
};

/**
 * Bounds for `economy.subscription-price`. A multiplier may not be negative, because a negative
 * price is not a discount, and `add` stays inside the same range Settings allows for a price.
 */
export const SLP_MODIFIER_MULTIPLY_MIN = 0;
export const SLP_MODIFIER_MULTIPLY_MAX = 10;
export const SLP_MODIFIER_ADD_MIN = -9999;
export const SLP_MODIFIER_ADD_MAX = 9999;

/** One event may not bury a price under a pile of modifiers. */
export const SLP_MODIFIERS_PER_SOURCE_MAX = 8;

/** A provider answers for one target at one caller-supplied time. It holds no clock of its own. */
export type SlpActiveModifierProvider = {
  modifiersFor(target: SlpModifierTarget, at: Date): SlpModifier[];
};

/** A source turns "what is running at `at`" into modifiers. Pure, and called on demand. */
export type SlpModifierSource = (at: Date) => readonly SlpModifier[];

/** A modifier before its source is known: what changes, without who asked. */
export type SlpModifierDraft = Omit<SlpModifier, "source">;
