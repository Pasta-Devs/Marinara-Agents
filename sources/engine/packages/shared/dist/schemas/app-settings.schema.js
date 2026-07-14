// ──────────────────────────────────────────────
// App Settings Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
/** Payload for PUT /api/app-settings/:key — the opaque serialized settings blob. */
export const appSettingsUpdateSchema = z.object({
    value: z.string().max(1_000_000),
});
/** Response shape for GET /api/app-settings/:key. */
export const appSettingsResponseSchema = z.object({
    value: z.string().nullable(),
});
//# sourceMappingURL=app-settings.schema.js.map