// ──────────────────────────────────────────────
// UNO deck construction
// ──────────────────────────────────────────────

import { UNO_COLORS, type UnoCard, type UnoColor, type UnoValue } from "./types.js";

const NUMBER_VALUES: readonly UnoValue[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const COLOR_ACTIONS: readonly UnoValue[] = ["skip", "reverse", "draw2"];

/**
 * Build a fresh, ORDERED standard 108-card deck (caller shuffles):
 *   per color: one 0, two each of 1-9, two Skip, two Reverse, two Draw Two (25 × 4 = 100)
 *   + 4 Wild + 4 Wild Draw Four = 108.
 * Card ids are stable and unique within the deck.
 */
export function buildStandardDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  let counter = 0;
  const push = (color: UnoCard["color"], value: UnoValue) => {
    deck.push({ id: `${color}-${value}-${counter++}`, color, value });
  };

  for (const color of UNO_COLORS as readonly UnoColor[]) {
    push(color, "0");
    for (const value of NUMBER_VALUES) {
      push(color, value);
      push(color, value);
    }
    for (const value of COLOR_ACTIONS) {
      push(color, value);
      push(color, value);
    }
  }

  for (let i = 0; i < 4; i++) push("wild", "wild");
  for (let i = 0; i < 4; i++) push("wild", "wild4");

  return deck;
}

export const TOTAL_DECK_SIZE = 108;

/** A wild face (color chosen on play). */
export function isWildValue(value: UnoValue): boolean {
  return value === "wild" || value === "wild4";
}

/** The printed point/symbol value, used for "same value" matching (wilds match by being wild). */
export function isActionValue(value: UnoValue): boolean {
  return value === "skip" || value === "reverse" || value === "draw2";
}
