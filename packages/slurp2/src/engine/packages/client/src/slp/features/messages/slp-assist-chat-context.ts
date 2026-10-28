import type { SlurpMessage } from "./slp-messages-contract";

/** Who the player writes as in this chat: their persona, their own Creator, or Slurp Support. */
export type SlurpAssistSeat = "persona" | "creator" | "support";

const LINES = 8;
const LINE_MAX = 280;
/** Under the assist's 2000-character `context` limit. */
const TOTAL_MAX = 1900;

const clip = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max - 1)}…`);

/**
 * "Help me write" in a DM (7c M-004): the newest lines of the chat, each named by who said it, and
 * one line saying who the player writes as and to whom. Events (tips, payments, locked photos,
 * shared posts, commission steps, Slurp's notices) are marked as events, never as anyone's words.
 */
export function slurpAssistChatContext(input: {
  messages: readonly Pick<SlurpMessage, "role" | "kind" | "content" | "price" | "metadata">[];
  seat: SlurpAssistSeat;
  creatorName: string;
  /** The fan's (or the persona's) name; unknown for a persona that has not written yet. */
  viewerName: string | null;
  supportName: string;
}): string {
  const { creatorName, supportName } = input;
  const viewerName = input.viewerName?.trim() || (input.seat === "persona" ? "you" : "the fan");
  const speaker = (message: (typeof input.messages)[number]) => {
    const scene = message.metadata.sceneSpeaker;
    if (message.role === "viewer" && typeof scene === "string" && scene.trim()) return scene.trim();
    return message.role === "creator" ? creatorName : viewerName;
  };
  const line = (message: (typeof input.messages)[number]): string | null => {
    const who = speaker(message);
    const words = clip(message.content.replace(/\s+/gu, " ").trim(), LINE_MAX);
    if (message.metadata.paymentReaction) return `(${who} ${words.replace(/^\[|\]$/gu, "")})`;
    switch (message.kind) {
      case "text":
      case "broadcast":
      case "commission_brief":
        return words ? `${who}: ${words}` : null;
      case "tip":
        return `(${who} tipped ${message.price} coins)${words ? ` ${who}: ${words}` : ""}`;
      case "ppv":
        return `(${who} sent a locked photo for ${message.price} coins)`;
      case "post_preview":
        return `(${who} shared a post)`;
      case "commission_quote":
        return `(${who} quoted ${message.price} coins for the commission)`;
      case "commission_delivery":
        return `(${who} delivered the commission)${words ? ` ${who}: ${words}` : ""}`;
      default:
        return words ? `(Slurp: ${words})` : null;
    }
  };
  const seat =
    input.seat === "support"
      ? `You write as ${supportName}, Slurp's own staff, to ${creatorName}, a Creator on Slurp.`
      : input.seat === "creator"
        ? `You write as ${creatorName}, a Creator on Slurp, to ${viewerName}.`
        : input.viewerName?.trim()
          ? `You write as ${viewerName} to ${creatorName}, a Creator on Slurp.`
          : `You write to ${creatorName}, a Creator on Slurp.`;
  const chat: string[] = [];
  const included: (typeof input.messages)[number][] = [];
  let size = seat.length;
  for (const message of [...input.messages].reverse()) {
    const text = line(message);
    if (!text) continue;
    if (chat.length >= LINES || size + text.length + 1 > TOTAL_MAX) break;
    chat.unshift(text);
    included.unshift(message);
    size += text.length + 1;
  }
  if (!chat.length) return `${seat}\nNothing has been said yet: this is the first message.`;
  // A newest line from the player's own side is followed up on, not answered.
  const newest = included.at(-1)!;
  const own =
    input.seat === "creator"
      ? newest.role === "creator"
      : newest.role === "viewer" && (input.seat === "support") === (newest.metadata.supportVoice === true);
  const task = own
    ? "The newest line is your own and has no answer yet: write a follow-up, in the language of the chat."
    : "Answer the newest line, in the language of the chat.";
  return [seat, `The chat so far (newest last). ${task}`, ...chat].join("\n");
}
