// ──────────────────────────────────────────────
// Otome Forge: what P17 (chat reply) and P18 (chat memory) send back, and how it is read (plan M3 "Phone server")
// ──────────────────────────────────────────────
// The prompts are in S/prompts.ts (with renderThread, the thread as prompt text). Here: the limits they share with the
// routes, the sticker names P17 lists and its parser matches (#2044: either order; a sticker-shaped name that is not
// listed is dropped), and the checks that send the repair turn: a message written as the protagonist or a reply with
// nothing in it, and a P18 quote the conversation does not hold word for word.
// The group chat (#2154): P17g's reply names each message's speaker, a member matched by sameName; a message written
// as the protagonist, by anyone else, or a reply with nothing in it gets the repair turn, and so does a squabble from
// one speaker alone, or a reply with nothing from a member the protagonist's newest message names (the maintainer's
// rule: whoever is named answers). Each speaker sends at most one sticker in a reply, their own or the protagonist's.
import { z, type ZodType } from "zod";
import { sameName } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { NOTE_TEXT_MAX } from "../../../../../client/src/features/otome-forge/shared/home.js";
import type { StickerLookup } from "../art/stickers.js";
import { fold, nameCore } from "../names.js";

/** A message's text, the player's or his (the route's body limit, and the cut on his). */
export const MESSAGE_TEXT_MAX = 1000;
/** The quoted note a reply from Home carries: any stored note fits (SH/home.ts NOTE_TEXT_MAX). */
export const NOTE_QUOTE_MAX = NOTE_TEXT_MAX;
/** His messages in one reply. */
export const REPLY_MESSAGES_MAX = 3;
/** A closed conversation's memory, and the line kept from it. */
export const MEMORY_CHARS_MAX = 800;
export const MEMORY_QUOTE_MAX = 200;

const chars = (value: string) => [...value].length;
const squash = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, " ").trim();

/** "Name: rest" when a line opens with a speaker's name (within 60 characters), otherwise null. */
function speakerPrefix(text: string): { speaker: string; rest: string } | null {
  const colon = text.search(/[:：]/u);
  if (colon <= 0 || colon > 60) return null;
  return { speaker: text.slice(0, colon).trim(), rest: text.slice(colon + 1).trim() };
}

/** Who is texting: his name and the protagonist's. */
export interface ThreadNames {
  li: string;
  player: string;
}

// ── Stickers in his replies (#2044) ──

/** A sticker P17 lists: its id, its `name_emotion` name and what it shows (English). */
export interface ReplySticker {
  id: string;
  name: string;
  about: string;
}

/** What P17 offers: his own, and the protagonist's, which he may send too; `name` renders the thread's stickers. */
export interface ReplyStickers {
  his: readonly ReplySticker[];
  yours: readonly ReplySticker[];
  name: StickerLookup;
}

/** Accents and case folded. */
const folded = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** A bracketed name as the parser compares it: accents and case folded, spaces and hyphens as "_". */
export function stickerToken(value: string): string {
  return folded(value).replace(/[\s-]+/g, "_");
}

const BRACKETED = /\[([^[\]\n]{1,60})\]/gu;
/**
 * What a sticker name looks like as written: words joined by "_", with no space or hyphen (a name the model made up is
 * dropped, as an unknown one is). Bracketed words like [laughs softly] or [Café Lumière] are text, and stay.
 */
const STICKER_SHAPED = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;

/** The listed sticker a token names, `name_emotion` or `emotion_name`, or null. */
export function stickerMatcher(listed: readonly ReplySticker[]): (token: string) => string | null {
  const byToken = new Map<string, string>();
  for (const sticker of listed) {
    const cut = sticker.name.lastIndexOf("_");
    const reversed = `${sticker.name.slice(cut + 1)}_${sticker.name.slice(0, cut)}`;
    for (const token of [sticker.name, reversed]) if (!byToken.has(token)) byToken.set(token, sticker.id);
  }
  return (token) => byToken.get(stickerToken(token)) ?? null;
}

// ── P17's reply: his chat reply (the prompt: S/prompts.ts chatReplyMessages) ──

/** P17's reply as the model sends it (nulls allowed); normalizeChatReply makes it a ChatReply. */
export interface ChatReplyRaw {
  messages: Array<{ text?: string | null; sticker?: string | null }>;
  invite?: boolean | null;
}

export interface ChatReply {
  /** `sticker` is a listed sticker's id (S/art/stickers.ts). */
  messages: Array<{ text: string; sticker?: string }>;
  /** #2156: his last message asks her out to clear the air (kept only when P17 offered it). */
  invite?: true;
}

export const ChatReplySchema: ZodType<ChatReplyRaw> = z.object({
  messages: z
    .array(
      z.object({ text: z.string().max(4000).nullable().optional(), sticker: z.string().max(40).nullable().optional() }),
    )
    .min(1)
    .max(8),
  invite: z.boolean().nullable().optional(),
});

/**
 * His messages (a leading "Name:" taken off, at most one sticker, at most three messages, each cut to
 * MESSAGE_TEXT_MAX). A message
 * written as the protagonist, or a reply with nothing in it, is refused (the repair turn names why). A sticker is the
 * first bracketed name of `listed` in the reply (either order; a `sticker` field is read the same way); every other
 * sticker-shaped bracketed name is taken out of the text, and other bracketed text stays. `invite` (#2156) is kept
 * only when P17 offered it (`offered`).
 */
export function normalizeChatReply(
  raw: ChatReplyRaw,
  names: ThreadNames,
  listed: readonly ReplySticker[] = [],
  offered = false,
): ChatReply | string {
  const messages: ChatReply["messages"] = [];
  const match = stickerMatcher(listed);
  let stickers = 0;
  for (const entry of raw.messages) {
    const message = readMessage(entry, names, match, stickers === 0);
    if (message === AS_PLAYER) {
      return `a message was written as ${names.player}: write only ${names.li}'s own messages, never their reply`;
    }
    if (!message) continue;
    if (message.sticker) stickers += 1;
    messages.push(message);
  }
  if (!messages.length) return `the reply had no message from ${names.li}`;
  return {
    messages: messages.slice(0, REPLY_MESSAGES_MAX),
    ...(offered && raw.invite === true ? { invite: true } : {}),
  };
}

const AS_PLAYER = "as-player";

/**
 * One message as `names.li` sent it: a leading "Name:" taken off, its first listed sticker (when `stickerFree`) and its
 * other sticker-shaped bracketed names taken out, cut to MESSAGE_TEXT_MAX; null when nothing is left, AS_PLAYER when a
 * line of it is the protagonist's.
 */
function readMessage(
  entry: { text?: string | null; sticker?: string | null },
  names: ThreadNames,
  match: (token: string) => string | null,
  stickerFree: boolean,
): { text: string; sticker?: string } | typeof AS_PLAYER | null {
  let text = (entry.text ?? "").trim();
  let sticker: string | undefined;
  const take = (id: string | null) => {
    if (id && stickerFree && !sticker) sticker = id;
  };
  const before = text;
  text = text.replace(BRACKETED, (whole, inner: string) => {
    const id = match(inner);
    take(id);
    return id || STICKER_SHAPED.test(folded(inner)) ? " " : whole;
  });
  if (text !== before)
    text = text
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .trim();
  if (entry.sticker) take(match(entry.sticker.replace(/^\[|\]$/g, "")));
  // Any line of the message may be the protagonist's, not only the first.
  const asPlayer =
    !!names.player &&
    text.split(/\r?\n/u).some((line) => {
      const spoken = speakerPrefix(line.trim());
      return !!spoken && sameName(spoken.speaker, names.player);
    });
  if (asPlayer) return AS_PLAYER;
  const prefix = speakerPrefix(text);
  if (prefix && sameName(prefix.speaker, names.li)) text = prefix.rest;
  if (!text && !sticker) return null;
  return { text: [...text].slice(0, MESSAGE_TEXT_MAX).join(""), ...(sticker ? { sticker } : {}) };
}

// ── P17g's reply: the group chat (#2154; the prompt: S/prompts.ts groupChatMessages) ──

/** The members' messages in one reply to the player, and in one squabble. */
export const GROUP_REPLY_MAX = 6;
export const GROUP_SQUABBLE_MAX = 8;

export interface GroupReplyRaw {
  messages: Array<{ speaker?: string | null; text?: string | null; sticker?: string | null }>;
}

export const GroupReplySchema: ZodType<GroupReplyRaw> = z.object({
  messages: z
    .array(
      z.object({
        speaker: z.string().max(200).nullable().optional(),
        text: z.string().max(4000).nullable().optional(),
        sticker: z.string().max(40).nullable().optional(),
      }),
    )
    .min(1)
    .max(16),
});

/** A member as P17g's parser reads them: their id, name, and the stickers of their own they may send. */
export interface GroupSpeaker {
  id: string;
  name: string;
  stickers: readonly ReplySticker[];
}

/**
 * The members `text` names, by their whole name or its first word (as sameName reads a speaker), standing as a word.
 * ponytail: a word is told by the letters around it, so a name written straight on to other letters (in a script
 * without spaces, Han or kana, say) is not found and the prompt's rule alone covers it; the upgrade path is
 * Intl.Segmenter's words.
 */
function namedIn(text: string, members: readonly GroupSpeaker[]): GroupSpeaker[] {
  const said = fold(text);
  return members.filter((member) => {
    // The first word that names them, past titles and articles: "Il Dottore" is named by "Dottore", never by any "il"
    // (CodeRabbit on #2168).
    const first = nameCore(member.name)[0];
    if (!first) return false;
    const name = first.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])${name}(?![\\p{L}\\p{N}\\p{M}])`, "u").test(said);
  });
}

/**
 * The members' messages (see the header): each read as normalizeChatReply reads his, with its speaker's own stickers
 * and the protagonist's (`yours`), at most GROUP_REPLY_MAX (a squabble GROUP_SQUABBLE_MAX), or the repair turn's reason.
 * `answering` is the protagonist's newest message a reply answers: each member it names must have a message in it.
 */
export function normalizeGroupReply(
  raw: GroupReplyRaw,
  { player, members, yours }: { player: string; members: readonly GroupSpeaker[]; yours: readonly ReplySticker[] },
  { squabble = false, answering = "" }: { squabble?: boolean; answering?: string } = {},
): { messages: Array<{ li: string; text: string; sticker?: string }> } | string {
  const messages: Array<{ li: string; text: string; sticker?: string }> = [];
  const sent = new Set<string>();
  const everyone = members.map((member) => member.name).join(", ");
  for (const entry of raw.messages) {
    const named = (entry.speaker ?? "").trim();
    if (named && sameName(named, player)) {
      return `a message was written as ${player}: write only the messages of ${everyone}, never ${player}'s`;
    }
    const member = members.find((candidate) => sameName(named, candidate.name));
    if (!member) {
      return `${named ? `"${named}" is not` : "a message names no speaker who is"} in the group chat: every speaker is one of ${everyone}, by their exact name`;
    }
    const match = stickerMatcher([...member.stickers, ...yours]);
    const message = readMessage(entry, { li: member.name, player }, match, !sent.has(member.id));
    if (message === AS_PLAYER) {
      return `a message was written as ${player}: write only the messages of ${everyone}, never ${player}'s`;
    }
    if (!message) continue;
    if (message.sticker) sent.add(member.id);
    messages.push({ li: member.id, ...message });
  }
  if (!messages.length) return `the reply had no message from ${everyone}`;
  const kept = messages.slice(0, squabble ? GROUP_SQUABBLE_MAX : GROUP_REPLY_MAX);
  const speaking = new Set(kept.map((message) => message.li));
  if (squabble && speaking.size < 2) return "a squabble needs messages from at least two of them";
  const silent = squabble ? [] : namedIn(answering, members).filter((member) => !speaking.has(member.id));
  const names = silent.map((member) => member.name).join(", ");
  if (names) return `${player} named ${names}: each one named answers with at least one message`;
  return { messages: kept };
}

// ── P18's reply: his chat memory (the prompt: S/prompts.ts chatMemoryMessages) ──

export interface ChatMemoryRaw {
  memory: string;
  quote?: string | null;
}

export const ChatMemorySchema: ZodType<ChatMemoryRaw> = z.object({
  memory: z.string().min(1).max(4000),
  quote: z.string().max(1000).nullable().optional(),
});

/**
 * The memory (one paragraph, at most MEMORY_CHARS_MAX characters, or the repair turn) and its quote, kept only when the
 * conversation really holds it word for word (a speaker's name before it is taken off: his, the protagonist's, or in the
 * group chat any of `others`).
 */
export function normalizeChatMemory(
  raw: ChatMemoryRaw,
  names: ThreadNames,
  conversation: string,
  others: readonly string[] = [],
): { memory: string; quote: string } | string {
  const memory = raw.memory.replace(/\s+/gu, " ").trim();
  if (!memory) return "the memory was empty";
  if (chars(memory) > MEMORY_CHARS_MAX) {
    return `the memory is too long: 2 to 4 sentences, at most ${MEMORY_CHARS_MAX} characters`;
  }
  let quote = (raw.quote ?? "")
    .trim()
    .replace(/^["“”'‘’«»「」]+|["“”'‘’«»「」]+$/gu, "")
    .trim();
  const prefix = speakerPrefix(quote);
  const speakers = [names.li, names.player, ...others];
  if (prefix && speakers.some((name) => sameName(prefix.speaker, name))) quote = prefix.rest;
  if (!quote || chars(quote) > MEMORY_QUOTE_MAX || !squash(conversation).includes(squash(quote))) quote = "";
  return { memory, quote };
}
