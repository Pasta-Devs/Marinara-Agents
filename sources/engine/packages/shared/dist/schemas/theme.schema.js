// ──────────────────────────────────────────────
// Theme Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { cssByteLimit, cssByteMessage } from "./css-size.js";
export const createThemeSchema = z.object({
    name: z.string().min(1).max(200),
    css: z.string().default("").refine(cssByteLimit, { message: cssByteMessage }),
    installedAt: z.string().datetime().optional(),
});
export const updateThemeSchema = z
    .object({
    name: z.string().min(1).max(200).optional(),
    css: z.string().optional().refine(cssByteLimit, { message: cssByteMessage }),
})
    .refine((value) => value.name !== undefined || value.css !== undefined, {
    message: "Must update at least one field",
});
export const setActiveThemeSchema = z.object({
    id: z.string().nullable(),
});
//# sourceMappingURL=theme.schema.js.map