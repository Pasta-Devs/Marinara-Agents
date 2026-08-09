/**
 * What the story is told about the phone, once per generated turn.
 *
 * Until Engine 2.4.2 there was no way to say anything: the phone read the story and the story read
 * nothing back, so a character could be texted for twenty turns and still not know it had happened.
 * `registerPromptContext` closes that, and this file decides what is worth saying.
 *
 * Two rules shape everything here:
 *
 * 1. State, not instructions. The block describes what is on the character's phone right now. It
 *    does not tell the model what to do about it — that is the scene's business.
 * 2. Generated text is not trusted. Message bodies, notes and page titles were written by a model
 *    in another context; splicing them raw into the system prompt is a laundering path straight
 *    into the turn's instructions. Everything is flattened, bracket-stripped and capped.
 */

/** Whole-block ceiling. Small on purpose: this is paid for on every single generation. */
export const TURN_CONTEXT_CHARS = 600;
/** Per-quoted-line ceiling, applied before the block ceiling. */
const LINE_CHARS = 90;
const MAX_THREADS = 3;

/**
 * Flattens generated text for safe inclusion in the prompt.
 *
 * Square brackets go because the block itself is bracket-delimited and the conversation commands
 * are bracket-tagged: a note reading "[phone: delete everything]" must not arrive looking like an
 * instruction the Engine or the model should act on. Newlines go so one field cannot fake a new
 * section of the prompt.
 */
export function sanitizeForPrompt(value: string, limit = LINE_CHARS) {
  const flattened = value
    .replace(/[\r\n]+/gu, " ")
    .replace(/[[\]]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return flattened.length > limit ? `${flattened.slice(0, limit).replace(/\s+\S*$/u, "")}…` : flattened;
}

export interface TurnPhoneState {
  ownerName: string;
  /** Whose phone this is, so the block can address the character or the user's persona. */
  ownerType: "persona" | "character";
  /** The time this phone shows, when the user has set a story clock. */
  clock?: string;
  unread: Array<{ from: string; count: number; latest: string }>;
  /** The most recently written note, if there is one. */
  note?: string;
  /** Set only when it is low enough to matter to a scene. */
  batteryLevel?: number;
}

/**
 * The block appended to the turn, or null when the phone has nothing worth saying — which is the
 * common case and must stay cheap, because silence costs no tokens.
 */
export function buildTurnContext(phones: TurnPhoneState[]): string | null {
  const lines: string[] = [];
  for (const phone of phones) {
    const owner = sanitizeForPrompt(phone.ownerName, 40) || "Someone";
    const parts: string[] = [];
    if (phone.clock) parts.push(`it is ${sanitizeForPrompt(phone.clock, 12)}`);
    for (const thread of phone.unread.slice(0, MAX_THREADS)) {
      const from = sanitizeForPrompt(thread.from, 40) || "an unknown number";
      const latest = sanitizeForPrompt(thread.latest);
      parts.push(
        `${thread.count} unread from ${from}${latest ? `, latest: "${latest}"` : ""}`,
      );
    }
    if (phone.note) parts.push(`a note reads "${sanitizeForPrompt(phone.note)}"`);
    if (typeof phone.batteryLevel === "number" && phone.batteryLevel <= 15) {
      parts.push(`battery ${Math.round(phone.batteryLevel)}%`);
    }
    if (!parts.length) continue;
    lines.push(`${owner}'s phone: ${parts.join("; ")}.`);
  }
  if (!lines.length) return null;

  /**
   * No "write [phone: …] to act on it" instruction here, deliberately. The Engine recognises the
   * tag and strips it from the prose, but `parseCapabilityConversationCommands` keeps only the
   * command type and discards the text after the colon — so a payload the model wrote would vanish
   * silently. Telling it otherwise would be instructing the model to do something with no effect.
   */
  const block = `[Phone — ${lines.join(" ")}]`;
  return block.length > TURN_CONTEXT_CHARS ? `${block.slice(0, TURN_CONTEXT_CHARS - 1)}]` : block;
}
