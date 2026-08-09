// ──────────────────────────────────────────────
// App Settings Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
export const MAX_MANAGED_GENERATION_PARAMETER_DEFINITIONS = 100;
export const managedGenerationParameterDefinitionSchema = z.object({
    id: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(100),
    requestKey: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
    min: z.number().finite(),
    max: z.number().finite(),
    tooltip: z.string().trim().max(500).optional(),
});
export const managedGenerationParameterDefinitionsSchema = z
    .array(managedGenerationParameterDefinitionSchema)
    .max(MAX_MANAGED_GENERATION_PARAMETER_DEFINITIONS);
/** Payload for PUT /api/app-settings/:key — the opaque serialized settings blob. */
export const appSettingsUpdateSchema = z.object({
    value: z.string().max(1_000_000),
});
/** Response shape for GET /api/app-settings/:key. */
export const appSettingsResponseSchema = z.object({
    value: z.string().nullable(),
});
//# sourceMappingURL=app-settings.schema.js.map