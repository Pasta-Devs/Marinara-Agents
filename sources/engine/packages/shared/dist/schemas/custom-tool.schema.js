// ──────────────────────────────────────────────
// Custom Tool Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
export const toolExecutionTypeSchema = z.enum(["webhook", "static", "script"]);
export const createCustomToolSchema = z.object({
    name: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z][a-z0-9_]*$/, "Tool name must be lowercase snake_case"),
    description: z.string().min(1).max(500),
    parametersSchema: z.record(z.unknown()).default({}),
    executionType: toolExecutionTypeSchema.default("static"),
    webhookUrl: z.string().url().nullable().default(null),
    staticResult: z.string().nullable().default(null),
    scriptBody: z.string().nullable().default(null),
    includeHiddenContext: z.boolean().default(false),
    enabled: z.boolean().default(true),
    sortOrder: z.number().int().optional(),
});
export const updateCustomToolSchema = createCustomToolSchema.partial();
export const reorderCustomToolsSchema = z.object({
    toolIds: z.array(z.string().min(1)),
});
//# sourceMappingURL=custom-tool.schema.js.map