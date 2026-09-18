/**
 * Validation for saved modifiers. Strict at the edge, lenient over a stored list.
 *
 * `slpModifierDraftSchema` rejects an unknown target or operation, a non-finite value, and a value
 * out of range. `slpNormalizeModifierDrafts` then drops a broken entry instead of failing the event that
 * carries it, exactly as platform events themselves are normalized: one bad modifier saved by an
 * older or hand-edited settings blob must not cost the user their whole event list.
 */
import { z } from "zod";

import {
  SLP_MODIFIER_ADD_MAX,
  SLP_MODIFIER_ADD_MIN,
  SLP_MODIFIER_MULTIPLY_MAX,
  SLP_MODIFIER_MULTIPLY_MIN,
  SLP_MODIFIERS_PER_SOURCE_MAX,
  type SlpModifierDraft,
} from "./slp-modifier.types.js";

export const slpModifierTargetSchema = z.enum(["economy.subscription-price"]);
export const slpModifierOperationSchema = z.enum(["multiply", "add"]);

export const slpModifierSourceRefSchema = z.object({
  kind: z.literal("platform-event"),
  id: z.string().trim().min(1).max(64),
});

/**
 * The value range depends on the operation, so the bounds are checked after the shape. `z.number()`
 * already rejects `NaN` and the infinities, so a non-finite value never reaches the refinement.
 */
const inRangeForOperation = (item: { operation: "multiply" | "add"; value: number }) =>
  item.operation === "multiply"
    ? item.value >= SLP_MODIFIER_MULTIPLY_MIN && item.value <= SLP_MODIFIER_MULTIPLY_MAX
    : item.value >= SLP_MODIFIER_ADD_MIN && item.value <= SLP_MODIFIER_ADD_MAX;

const rangeCheck = { message: "modifier value is out of range for its operation", path: ["value"] as const };

const modifierEffect = {
  target: slpModifierTargetSchema,
  operation: slpModifierOperationSchema,
  value: z.number(),
};

/**
 * What a source stores: the effect alone. The source stamps itself on at activation, so a saved
 * event cannot claim a modifier on another event's behalf or drift out of sync with its own id.
 */
export const slpModifierDraftSchema = z.object(modifierEffect).refine(inRangeForOperation, rangeCheck);

export const slpModifierSchema = z
  .object({ ...modifierEffect, source: slpModifierSourceRefSchema })
  .refine(inRangeForOperation, rangeCheck);

export const slpModifierDraftsSchema = z.array(slpModifierDraftSchema).max(SLP_MODIFIERS_PER_SOURCE_MAX);

export const slpModifiersSchema = z.array(slpModifierSchema).max(SLP_MODIFIERS_PER_SOURCE_MAX);

/** Parse leniently: keep the good modifiers, drop the broken ones, never throw. */
export function slpNormalizeModifierDrafts(raw: unknown): SlpModifierDraft[] {
  if (!Array.isArray(raw)) return [];
  const kept: SlpModifierDraft[] = [];
  for (const entry of raw) {
    if (kept.length >= SLP_MODIFIERS_PER_SOURCE_MAX) break;
    const parsed = slpModifierDraftSchema.safeParse(entry);
    if (parsed.success) kept.push(parsed.data);
  }
  return kept;
}
