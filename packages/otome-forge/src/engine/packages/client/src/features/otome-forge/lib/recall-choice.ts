// ──────────────────────────────────────────────
// Otome Hearth: whether Settings → Connections may offer an embedding connection for long-term recall (0.19.0)
// ──────────────────────────────────────────────
// Only once the recall status confirms this Engine lets a story choose its embedding model (capability API 1.818,
// `choosable: true`). While that status loads, or when it fails, the picker offers Built-in alone, as on an older Engine.

export const embeddingsChoosable = (status: { choosable?: boolean } | null | undefined): boolean =>
  status?.choosable === true;
