import { z } from "zod";

/**
 * `.default(value)` that also fills the nested defaults (zod 4 calls this `.prefault`). Zod 3 parses
 * a default value, zod 4 returns it as-is, so on zod 4 a plain `.default({})` leaves every inner
 * field unset. Parsing the value here gives the same filled object on both, and a fresh one per parse.
 */
export const slpFilledDefault = <T extends z.ZodTypeAny>(schema: T, value: unknown = {}) =>
  schema.default(() => schema.parse(value));

/**
 * `.partial()` for update bodies. Zod 4 applies an inner `.default()` to a missing optional field,
 * so a plain `.partial()` patch resets every unsent field to its default. A missing field stays
 * missing here, on zod 3 and 4.
 */
export const slpPartialInput = <Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) =>
  schema
    .partial()
    .extend(
      Object.fromEntries(
        Object.entries(schema.shape).map(([key, field]) => [key, z.union([z.undefined(), field]).optional()]),
      ) as { [Key in keyof Shape]: z.ZodOptional<z.ZodUnion<[z.ZodUndefined, Shape[Key]]>> },
    );
