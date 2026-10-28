// ──────────────────────────────────────────────
// Otome Forge: the wire contract between the package's routes and its client (types only)
// ──────────────────────────────────────────────
// Imported by both bundles, so a code or field added on one side has to be handled on the other.

/** The `code` of a failed route's `{error, code?}`; the client shows ui.otomeForge.errors.<code> (plan §1.5). */
export type OtomeErrorCode =
  | "bad-request"
  | "age-gate"
  | "not-found"
  | "conflict"
  | "busy"
  | "locked"
  | "insufficient"
  | "declined"
  | "bad-format"
  | "no-connection";

export interface OtomeRunEntry {
  runKey: string;
  title: string;
  createdAt: string;
  lastPlayedAt: string | null;
}

/** The `otome-forge:index` document, as GET /index returns it with every field defaulted. */
export interface OtomeIndex {
  version: 1;
  runs: OtomeRunEntry[];
  /** The run key the picker opens, or null. Always one of `runs`. */
  activeRun: string | null;
  ageGate: { confirmedAt: string } | null;
  lastOpenedAt: string | null;
}
