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
  /**
   * `fresh` means it landed after the story last spoke, so this turn is the first the scene could
   * know about it. Anything not fresh has already been offered once and is reported as a standing
   * fact without its body — the block is rebuilt from scratch every turn, so without this the same
   * text is handed to the model on every generation until someone opens Messages, and a character
   * re-reacts to the same buzz turn after turn.
   */
  unread: Array<{ from: string; count: number; latest: string; fresh: boolean }>;
  /** Only worth saying the turn after it is written; after that it is furniture. */
  note?: { text: string; fresh: boolean };
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
      parts.push(thread.fresh
        ? `${thread.count} new from ${from}${latest ? `: "${latest}"` : ""}`
        : `${thread.count} still unread from ${from}`);
    }
    if (phone.note?.fresh) parts.push(`a note just written reads "${sanitizeForPrompt(phone.note.text)}"`);
    if (typeof phone.batteryLevel === "number" && phone.batteryLevel <= 15) {
      parts.push(`battery ${Math.round(phone.batteryLevel)}%`);
    }
    if (!parts.length) continue;
    lines.push(`${owner}'s phone: ${parts.join("; ")}.`);
  }
  if (!lines.length) return null;
  /**
   * Standing facts alone are not worth saying again. If nothing arrived since the story last spoke
   * and no phone is in a state the scene has to know about, the quietest thing is to say nothing.
   */
  const anythingNew = phones.some((phone) =>
    phone.unread.some((thread) => thread.fresh)
    || phone.note?.fresh
    || (typeof phone.batteryLevel === "number" && phone.batteryLevel <= 15)
    || phone.unread.length > 0);
  if (!anythingNew) return null;

  /**
   * No "write [phone: …] to act on it" instruction here, deliberately. The Engine recognises the
   * tag and strips it from the prose, but `parseCapabilityConversationCommands` keeps only the
   * command type and discards the text after the colon — so a payload the model wrote would vanish
   * silently. Telling it otherwise would be instructing the model to do something with no effect.
   */
  const block = `[Phone — ${lines.join(" ")}]`;
  if (block.length <= TURN_CONTEXT_CHARS) return block;
  // Cut back to the last complete sentence rather than mid-word: slicing blind could end the block
  // on a half-quoted message, which is the one string the model reads every single turn.
  const clipped = block.slice(0, TURN_CONTEXT_CHARS - 1);
  const lastSentence = clipped.lastIndexOf(". ");
  return `${lastSentence > 20 ? clipped.slice(0, lastSentence + 1) : clipped.replace(/\s+\S*$/u, "…")}]`;
}

/**
 * Minutes past midnight from a tracked time, or null when it is not a time at all.
 *
 * A tracker's time field is free text a model wrote, so it arrives as "21:40", "9:40 PM", "09:40"
 * or as prose nobody can parse. Anything that does not clearly resolve returns null and the phone
 * keeps its own clock rather than guessing.
 */
export function parseTrackedTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /\b(\d{1,2})[:.](\d{2})\s*(am|pm)?/iu.exec(value.trim());
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return null;
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (hours > 23) return null;
  return hours * 60 + minutes;
}
