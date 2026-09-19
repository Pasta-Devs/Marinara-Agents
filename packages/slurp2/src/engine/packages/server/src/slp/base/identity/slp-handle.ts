export function normalizeSlpHandle(value: string): string {
  return value.trim().replace(/^@/u, "").toLowerCase();
}
