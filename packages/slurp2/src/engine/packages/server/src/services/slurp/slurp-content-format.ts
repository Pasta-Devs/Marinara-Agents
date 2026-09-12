/**
 * The content formats and their length caps, in a leaf module.
 *
 * The caps used to live in slurp-generation.service.ts, which imports the storage layer, so storage
 * could not read them back without a cycle. Post edits therefore truncated to a flat 4000
 * characters and a 300-character caption could be edited into a wall of text that no generated
 * post of that format could ever be.
 */

export type NoodlerContentFormat = "caption" | "announcement" | "long_form";

/** Mirrors NOODLE_POST_CONTENT_MAX_LENGTH; long_form is the only format allowed the full length. */
export const NOODLER_CONTENT_HARD_MAX_LENGTH = 4000;

export const NOODLER_FORMAT_MAX_LENGTH: Record<NoodlerContentFormat, number> = {
  caption: 300,
  announcement: 1000,
  long_form: NOODLER_CONTENT_HARD_MAX_LENGTH,
};

function isNoodlerContentFormat(value: unknown): value is NoodlerContentFormat {
  return value === "caption" || value === "announcement" || value === "long_form";
}

/**
 * The cap a stored post must be held to, read from its own metadata. Unknown or missing formats
 * fall back to the hard maximum rather than to `caption`, so an older post is never silently
 * truncated by an edit that only meant to fix a typo.
 */
export function noodlerContentLimitFor(metadata: { noodlerContentFormat?: unknown } | null | undefined): number {
  const format = metadata?.noodlerContentFormat;
  return isNoodlerContentFormat(format) ? NOODLER_FORMAT_MAX_LENGTH[format] : NOODLER_CONTENT_HARD_MAX_LENGTH;
}
