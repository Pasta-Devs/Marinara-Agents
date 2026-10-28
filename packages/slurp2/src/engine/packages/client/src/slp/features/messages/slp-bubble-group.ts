// How quick messages from one sender join into a run, and the corners that show it (step 4).
// Pure, so the regression can run it.
import type { SlurpMessage } from "./slp-messages-contract";

/** Where a bubble sits in a run of quick messages from one sender. */
export type SlurpBubbleGroup = "single" | "first" | "middle" | "last";

/** Messages this close together from one side read as one burst, like a texting app shows them. */
const SLURP_BUBBLE_GROUP_MS = 3 * 60_000;
const UNGROUPED_KINDS = new Set(["tip", "post_preview", "broadcast", "system", "ppv"]);

type SlurpTimelineEntryLike = { kind: string; at: string; message?: SlurpMessage };

/**
 * The bubble's place in its burst. A burst breaks on a change of sender, a gap of three minutes,
 * a new day, a card that is not a plain bubble, or the unread line.
 */
export function slurpBubbleGroup(
  entries: readonly SlurpTimelineEntryLike[],
  index: number,
  breakBeforeId: string | null,
): SlurpBubbleGroup {
  const joins = (left: SlurpTimelineEntryLike | undefined, right: SlurpTimelineEntryLike | undefined) => {
    if (left?.kind !== "message" || right?.kind !== "message" || !left.message || !right.message) return false;
    const a = left.message;
    const b = right.message;
    if (
      a.role !== b.role ||
      a.kind !== b.kind ||
      UNGROUPED_KINDS.has(a.kind) ||
      UNGROUPED_KINDS.has(b.kind) ||
      a.metadata.paymentReaction ||
      b.metadata.paymentReaction
    )
      return false;
    if (b.id === breakBeforeId) return false;
    const gap = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return gap >= 0 && gap <= SLURP_BUBBLE_GROUP_MS && a.createdAt.slice(0, 10) === b.createdAt.slice(0, 10);
  };
  const withPrevious = joins(entries[index - 1], entries[index]);
  const withNext = joins(entries[index], entries[index + 1]);
  if (withPrevious && withNext) return "middle";
  if (withPrevious) return "last";
  if (withNext) return "first";
  return "single";
}

const BIG = "1.25rem";
const SMALL = "0.4rem";

/**
 * Corners in `border-radius` order. No tail (it rendered as a notch or a hairline curl, B30): the
 * sender's side tightens where the burst continues, so the run itself shows who is talking.
 */
export function slurpBubbleRadius(group: SlurpBubbleGroup, mine: boolean): string {
  const above = group === "middle" || group === "last" ? SMALL : BIG;
  const below = group === "first" || group === "middle" ? SMALL : BIG;
  // top-left, top-right, bottom-right, bottom-left
  return mine ? `${BIG} ${above} ${below} ${BIG}` : `${above} ${BIG} ${BIG} ${below}`;
}
