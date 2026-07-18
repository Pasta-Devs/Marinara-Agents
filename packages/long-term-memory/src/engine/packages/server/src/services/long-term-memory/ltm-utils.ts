export { uniqueStrings } from "../../../../shared/src/features/agents/long-term-memory/utils.js";

export function nowIso(): string {
  return new Date().toISOString();
}

export function safeSnippet(text: string | undefined) {
  const value = text?.replace(/\s+/g, " ").trim() ?? "";
  if (!value || value.length < 12) return undefined;
  return value.length > 280 ? `${value.slice(0, 277).trim()}...` : value;
}

export function countBy<T extends string>(values: T[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function isEnoent(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === "ENOENT";
}
