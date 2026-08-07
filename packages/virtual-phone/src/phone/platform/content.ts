export interface ContentLimits {
  /** Characters per string. Also the per-item cap for `string[]` fields. */
  maxString?: number;
  /** Items per `string[]` field. */
  maxItems?: number;
  /** Overrides `maxString` for named fields. */
  perField?: Record<string, number>;
}

export interface ContentSchema {
  fields: Record<string, "string" | "number" | "boolean" | "string[]">;
  defaults: Record<string, unknown>;
  limits?: ContentLimits;
}

/**
 * Conservative defaults, kept at the old global values so a schema that declares no limits
 * behaves exactly as before. They are deliberately low — every call site that wants real prose
 * declares its own, and must also raise its `maxTokens`, which is the harder ceiling of the two.
 */
const DEFAULT_MAX_STRING = 300;
const DEFAULT_MAX_ITEMS = 10;

export function parseBoundedContent(input: string, schema: ContentSchema) {
  try {
    const start = input.indexOf("{");
    const end = input.lastIndexOf("}");
    if (start < 0 || end < start) throw new Error("Object required");
    const candidate = JSON.parse(input.slice(start, end + 1)) as Record<string, unknown>;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Object required");
    const maxItems = schema.limits?.maxItems ?? DEFAULT_MAX_ITEMS;
    const capFor = (field: string) => schema.limits?.perField?.[field] ?? schema.limits?.maxString ?? DEFAULT_MAX_STRING;
    const output: Record<string, unknown> = {};
    for (const [key, type] of Object.entries(schema.fields)) {
      const value = candidate[key];
      if (type === "string[]") {
        if (Array.isArray(value)) output[key] = value.slice(0, maxItems).map(String).map((item) => item.slice(0, capFor(key)));
      } else if (type === "string" && value != null) {
        output[key] = String(value).slice(0, capFor(key));
      } else if (type === "number" && Number.isFinite(Number(value))) {
        output[key] = Number(value);
      } else if (type === "boolean" && (typeof value === "boolean" || value === "true" || value === "false")) {
        output[key] = value === true || value === "true";
      }
    }
    return { ...schema.defaults, ...output };
  } catch {
    return { ...schema.defaults };
  }
}
