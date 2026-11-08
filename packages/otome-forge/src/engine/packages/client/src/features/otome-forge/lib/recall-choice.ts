// ──────────────────────────────────────────────
// Otome Hearth: which embedding connections Settings → Connections offers for long-term recall (0.19.0)
// ──────────────────────────────────────────────
// Every connection with an embedding model once the recall status confirms this Engine lets a story choose one
// (capability API 1.818, `choosable: true`); none on an Engine confirmed older (`choosable: false`). While the status
// loads, or when it failed, only the connection already saved is listed, so it shows by its name (never "Missing")
// and nothing new is offered before the Engine is known.

export const embeddingsChoosable = (status: { choosable?: boolean } | null | undefined): boolean =>
  status?.choosable === true;

export function embeddingOptions<T extends { id: string }>(
  status: { choosable?: boolean } | null | undefined,
  connections: readonly T[],
  saved: string,
): T[] {
  if (status?.choosable === true) return [...connections];
  if (status?.choosable === false) return [];
  return connections.filter((connection) => connection.id === saved);
}
