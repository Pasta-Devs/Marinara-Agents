import { z } from "zod";
export const IMPERSONATE_PROMPT_TEMPLATES_SETTINGS_KEY = "impersonate-prompt-templates";
export const IMPERSONATE_PROMPT_TEMPLATE_CATALOG_VERSION = 1;
const IMPERSONATE_PROMPT_TEMPLATE_MAX_COUNT = 20;
export const IMPERSONATE_PROMPT_TEMPLATE_MAX_NAME_LENGTH = 80;
const IMPERSONATE_PROMPT_TEMPLATE_MAX_PROMPT_LENGTH = 20_000;
const IMPERSONATE_PROMPT_TEMPLATE_MAX_CATALOG_LENGTH = 500_000;
const impersonatePromptTemplatePromptSchema = z
    .string()
    .max(IMPERSONATE_PROMPT_TEMPLATE_MAX_PROMPT_LENGTH)
    .refine((prompt) => prompt.trim().length > 0);
const impersonatePromptTemplateSchema = z
    .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(IMPERSONATE_PROMPT_TEMPLATE_MAX_NAME_LENGTH),
    prompt: impersonatePromptTemplatePromptSchema,
})
    .strict();
const impersonatePromptTemplateListSchema = z
    .array(impersonatePromptTemplateSchema)
    .max(IMPERSONATE_PROMPT_TEMPLATE_MAX_COUNT)
    .superRefine((templates, context) => {
    const ids = new Set();
    for (const [index, template] of templates.entries()) {
        if (ids.has(template.id)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [index, "id"],
                message: "Template ids must be unique",
            });
        }
        ids.add(template.id);
    }
});
export const impersonatePromptTemplateCatalogSchema = z
    .object({
    version: z.literal(IMPERSONATE_PROMPT_TEMPLATE_CATALOG_VERSION),
    templates: impersonatePromptTemplateListSchema,
})
    .strict()
    .superRefine((catalog, context) => {
    if (JSON.stringify(catalog).length > IMPERSONATE_PROMPT_TEMPLATE_MAX_CATALOG_LENGTH) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Serialized catalog must not exceed ${IMPERSONATE_PROMPT_TEMPLATE_MAX_CATALOG_LENGTH} characters`,
        });
    }
});
export const EMPTY_IMPERSONATE_PROMPT_TEMPLATE_CATALOG = {
    version: IMPERSONATE_PROMPT_TEMPLATE_CATALOG_VERSION,
    templates: [],
};
//# sourceMappingURL=impersonate-prompt-templates.schema.js.map