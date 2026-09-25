import { slurpIsLegacyImageBrief } from "../../base/media/slp-image-prompt.js";
import type { SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";

const SLURP_HISTORY_IMAGE_LENGTH = 240;
// An older picture only has to be recognisable as a repeat; its first clause is the action.
const SLURP_HISTORY_OLDER_IMAGE_LENGTH = 100;
const SLURP_HISTORY_SUBJECT_LENGTH = 80;

/**
 * What this page and the rest of the feed already posted about, as subjects rather than text.
 *
 * Eight full captions went into every prompt, and the model learned its own verbal habits from
 * them: on a production install one Creator used the same filler word in 18 of 24 posts, and it
 * appeared nowhere in the card, only ten times in this section. So only the last post is quoted,
 * for continuity; older posts appear as their title and what they showed, which is enough to avoid
 * a repeat and carries no voice to copy. Other Creators' recent public titles are listed so the
 * whole feed stops posting about the same thing on the same day.
 *
 * In classic mode the last caption is the only carrier of post-to-post facts ("more tomorrow"). In
 * beats mode a published post's beat becomes a continuity fact, so no caption is quoted at all.
 */
export function formatSlurpPostHistory(
  posts: SlpCreatorManagedPost[],
  protect: (value: string) => string,
  otherSubjects: readonly string[] = [],
  /** False in beats mode: the last post is a continuity fact there, not a quote. */
  quoteLast = true,
): string {
  const showed = (post: SlpCreatorManagedPost, length: number) =>
    post.imagePrompt && !slurpIsLegacyImageBrief(post.imagePrompt)
      ? post.imagePrompt.replace(/\s+/gu, " ").trim().slice(0, length)
      : "";
  const withShowed = (line: string, post: SlpCreatorManagedPost, length = SLURP_HISTORY_IMAGE_LENGTH) =>
    showed(post, length) ? `${line}\n  (showed: ${protect(showed(post, length))})` : line;
  const [latest, ...rest] = posts;
  const older = quoteLast ? rest : posts;
  const lines = latest
    ? [
        ...(quoteLast
          ? [
              "Your last post, quoted for continuity only. Do not reuse its wording:",
              withShowed(
                `- ${latest.createdAt}: ${latest.title ? `${protect(latest.title)} — ` : ""}${protect(latest.content)}`,
                latest,
              ),
            ]
          : []),
        ...(older.length
          ? [
              "Earlier subjects on this page. Pick a different subject, place, and activity:",
              ...older.map((post) =>
                withShowed(
                  `- ${post.createdAt}: ${protect(post.title || post.content.slice(0, SLURP_HISTORY_SUBJECT_LENGTH))}`,
                  post,
                  SLURP_HISTORY_OLDER_IMAGE_LENGTH,
                ),
              ),
            ]
          : []),
      ]
    : ["No previous posts on this Slurp page."];
  if (otherSubjects.length) {
    lines.push(
      "Other Creators posted about these recently. Choose something different:",
      ...otherSubjects.map((subject) => `- ${protect(subject)}`),
    );
  }
  return lines.join("\n");
}
