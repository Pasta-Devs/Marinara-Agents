/**
 * The content formats and the hard length cap, in a leaf module.
 *
 * Formats used to carry their own hard caps (a caption was cut at 300 characters), which chopped
 * posts mid-sentence whenever a model wrote a little long. A format is now only a target in the
 * prompt; the player's `postMaxLength` setting is the one generated-post ceiling, and edits are held
 * to the shared schema maximum.
 */

export type SlpCreatorContentFormat = "caption" | "announcement" | "long_form";

/** Mirrors NOODLE_POST_CONTENT_MAX_LENGTH, the shared schema's limit for any stored post. */
export const NOODLER_CONTENT_HARD_MAX_LENGTH = 4000;
