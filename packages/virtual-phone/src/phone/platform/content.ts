export interface ContentSchema {
  fields: Record<string, "string" | "number" | "boolean" | "string[]">;
  defaults: Record<string, unknown>;
}

const MAX_FIELDS = 8;
const MAX_STRING = 300;
const MAX_ITEMS = 10;

export function parseBoundedContent(input: string, schema: ContentSchema) {
  try {
    const start = input.indexOf("{");
    const end = input.lastIndexOf("}");
    if (start < 0 || end < start) throw new Error("Object required");
    const candidate = JSON.parse(input.slice(start, end + 1)) as Record<string, unknown>;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Object required");
    const output: Record<string, unknown> = {};
    for (const [key, type] of Object.entries(schema.fields).slice(0, MAX_FIELDS)) {
      const value = candidate[key];
      if (type === "string[]") {
        if (Array.isArray(value)) output[key] = value.slice(0, MAX_ITEMS).map(String).map((item) => item.slice(0, MAX_STRING));
      } else if (type === "string" && value != null) {
        output[key] = String(value).slice(0, MAX_STRING);
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
