// ──────────────────────────────────────────────
// Otome Forge: reading stored documents field by field, and the small shapes several documents share
// ──────────────────────────────────────────────
// Schemas use only the zod API v3 and v4 share (the server bundle gets the Engine's zod 4, the tests run zod 3), so
// there is no .default() or .catch(): readFields gives each field that is missing or fails its schema the default,
// and a document from an older test build or a hand edit keeps every other field.
import { z, type ZodType } from "zod";
import type { Paint, Pronouns } from "../../../../../client/src/features/otome-forge/shared/api-types.js";

/** A field's schema, or a function that reads the raw value into its full shape (and supplies its own default). */
export type Reader<V> = ZodType<V> | ((value: unknown) => V);

export function field(data: unknown, key: string): unknown {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>)[key] : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Each field of `data` read through its reader; a schema that fails, or a missing value, keeps `defaults()`'s. */
export function readFields<T extends object>(
  readers: { [K in keyof T]-?: Reader<T[K]> },
  defaults: () => T,
  data: unknown,
): T {
  const result = defaults();
  for (const key of Object.keys(readers) as Array<keyof T & string>) {
    const reader = readers[key] as Reader<T[typeof key]>;
    const raw = field(data, key);
    if (typeof reader === "function") {
      result[key] = reader(raw);
      continue;
    }
    const parsed = reader.safeParse(raw);
    if (parsed.success && parsed.data !== undefined) result[key] = parsed.data;
  }
  return result;
}

/** The items of `value` that pass `schema`; anything else is dropped. */
export function validItems<V>(schema: ZodType<V>, value: unknown, max = Infinity): V[] {
  const items: V[] = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const parsed = schema.safeParse(raw);
    if (parsed.success) items.push(parsed.data);
    if (items.length >= max) break;
  }
  return items;
}

export const text = (max = 4000) => z.string().max(max);
export const textList = (maxItems = 12, max = 600) => z.array(z.string().max(max)).max(maxItems);

export const PronounsSchema: ZodType<Pronouns> = z.object({
  subject: z.string().min(1).max(40),
  object: z.string().min(1).max(40),
  possessive: z.string().min(1).max(40),
});

/** Nothing assumes a gender: a missing set of pronouns reads as they/them. */
export const defaultPronouns = (): Pronouns => ({ subject: "they", object: "them", possessive: "their" });

export const PaintSchema: ZodType<Paint> = z.object({
  state: z.enum(["waiting-consent", "pending", "ready", "failed", "stopped"]),
  at: z.string(),
  url: z.string().optional(),
  ref: z.string().optional(),
  error: z.string().optional(),
});
