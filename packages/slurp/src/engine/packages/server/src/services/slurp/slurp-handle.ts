export function normalizeNoodleHandle(value: string): string {
  return value.trim().replace(/^@/u, "").toLowerCase();
}
