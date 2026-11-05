/**
 * Editing a DM thread by hand (docs/FEEDBACK-2026-10.md R9): change your own words, take a message
 * out, or have the Creator write their last answer again. Pure and shared: the server enforces it,
 * the thread shows only the actions it allows.
 *
 * Money stays out of it: a tip, a paid picture or a commission step is a record of coins moving, so
 * it cannot be edited or deleted here (`slurpMessageRemovable`).
 */
type Row = {
  id: string;
  role: "viewer" | "creator";
  kind: string;
  price: number;
  metadata?: Record<string, unknown>;
};

const REMOVABLE: ReadonlySet<string> = new Set(["text", "system", "post_preview", "broadcast"]);

/**
 * A message without coins attached: it may be deleted. A system line that belongs to a commission
 * (quote, payment, refund) or a scene (invite, recap) is a record, not chat, so it stays.
 */
export const slurpMessageRemovable = (message: Row) =>
  REMOVABLE.has(message.kind) &&
  !(message.price > 0) &&
  !(message.kind === "system" && (message.metadata?.commissionId || message.metadata?.scene));

/** Only plain words are edited, and only by the side that wrote them. */
export const slurpMessageEditable = (message: Row, side: "viewer" | "creator") =>
  message.kind === "text" && !(message.price > 0) && message.role === side;

/**
 * The Creator's last answer: every Creator message after the fan's latest one, oldest first, or null
 * when there is nothing to write again (no answer yet, or the answer carries coins).
 */
export function slurpLastAnswer(messages: readonly Row[]): string[] | null {
  const lastViewer = messages.map((message) => message.role).lastIndexOf("viewer");
  if (lastViewer < 0) return null;
  const answer = messages.slice(lastViewer + 1);
  if (!answer.length || !answer.every((message) => message.role === "creator" && slurpMessageRemovable(message)))
    return null;
  return answer.map((message) => message.id);
}
