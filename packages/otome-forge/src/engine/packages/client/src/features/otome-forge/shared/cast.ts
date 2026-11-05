// ──────────────────────────────────────────────
// Otome Forge: the cast's limits, in one place (#1983 M3).
// ──────────────────────────────────────────────
// Setup and the end-of-arc "meet someone new" both read them, and the client hides an option the server would refuse,
// so the two must never drift: one constant, imported on both sides.
export const LIS_MIN = 2;
export const LIS_MAX = 5;
