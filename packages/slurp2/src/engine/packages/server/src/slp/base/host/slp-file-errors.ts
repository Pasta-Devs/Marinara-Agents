type FileUniqueConstraintErrorLike = {
  code?: unknown;
  table?: unknown;
  keys?: unknown;
};

/** Match host storage errors across the capability-package bundle boundary. */
export function isSlurpFileUniqueConstraintError(error: unknown, table?: string, keys?: readonly string[]): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as FileUniqueConstraintErrorLike;
  if (candidate.code !== "FILE_UNIQUE_CONSTRAINT") return false;
  if (table !== undefined && candidate.table !== table) return false;
  if (keys === undefined) return true;
  return (
    Array.isArray(candidate.keys) &&
    candidate.keys.length === keys.length &&
    keys.every((key, index) => candidate.keys[index] === key)
  );
}
