// ──────────────────────────────────────────────
// Otome Forge: the phone prompts P17 (chat reply) and P18 (chat memory), plan M3 "Phone server"
// ──────────────────────────────────────────────
// P17 is GF's cv() made Otome's: he writes a MESSAGE, never a scene, never the protagonist's reply, and nothing in the
// story happens because of it. GF's closeness ladder becomes his stage's wording (and a rupture keeps him curt). The
// system message holds the role, the JSON shape, the hard rules, the knowledge boundary with the writing rules, and the
// `chat` contract for him alone; the user turn holds his scene card with what stands between them, the story as he may
// know it (recall with `reader: li`), the conversations that are over, the thread now, and the task, ending with the
// contract reminder. The comfort rule applies whenever the protagonist says they are unwell or had a hard day.
// Read Me (#1945): P17 carries his own notebook beside his card (story/prompts.ts knowsAboutYou), so a reply may show
// what he has come to know about the protagonist; P18 writes no one's words and gets none.
// P18 is GF's sv(): what he will remember of a closed conversation, on the `summary` contract with the summary wording
// and no knowledge boundary (it writes no one's words). Its quote must be a line the conversation really holds.
// Prompts are English and never localized; messages, suggestions and memories are written in the world's language.
import { z, type ZodType } from "zod";
import type {
  LiState,
  PhoneMessage,
  PhoneSession,
  Player,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { FACES, isFace, sameName, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { NOTE_TEXT_MAX } from "../../../../../client/src/features/otome-forge/shared/home.js";
import { COMFORT_RULE, SUMMARY_WORDING, otomeContentContract, otomeContractReminder } from "../content-contract.js";
import type { OtomeMessage } from "../generation.js";
import { otomeSceneCard } from "../scene-card.js";
import { betweenYou, knowsAboutYou } from "../story/prompts.js";
import { otomeWritingRules } from "../writing-rules.js";
import { aboutLine } from "../schemas/player.js";

/** A message's text, the player's or his (the route's body limit, and the cut on his). */
export const MESSAGE_TEXT_MAX = 1000;
/** The quoted note a reply from Home carries: any stored note fits (SH/home.ts NOTE_TEXT_MAX). */
export const NOTE_QUOTE_MAX = NOTE_TEXT_MAX;
/** His messages in one reply. */
export const REPLY_MESSAGES_MAX = 3;
export const SUGGESTIONS_MAX = 3;
/** Characters (code points) in one suggested reply. */
export const SUGGESTION_CHARS_MAX = 40;
/** A closed conversation's memory, and the line kept from it. */
export const MEMORY_CHARS_MAX = 800;
export const MEMORY_QUOTE_MAX = 200;

const chars = (value: string) => [...value].length;
const squash = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, " ").trim();
const pronounText = (pronouns: Unit["pronouns"]) => `${pronouns.subject}/${pronouns.object}/${pronouns.possessive}`;

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

/**
 * The thread as prompt text, oldest first: `Name: text`, with a sticker and a quoted note in brackets. `voice: "his"`
 * writes them for him (your note, your face), `"told"` for the summarizer (Kai's note, Kai's face).
 */
export function renderThread(messages: readonly PhoneMessage[], names: ThreadNames, voice: "his" | "told"): string {
  const own = voice === "his" ? "your" : `${names.li}'s`;
  return messages
    .map((message) => {
      const parts: string[] = [];
      if (message.quote) parts.push(`(replying to ${own} note: "${message.quote}")`);
      if (message.text) parts.push(message.text);
      if (message.sticker) {
        parts.push(
          message.who === "player"
            ? `[sends a sticker of ${own} ${message.sticker} face]`
            : `[sticker: ${message.sticker} face]`,
        );
      }
      return `${message.who === "player" ? names.player : names.li}: ${parts.join(" ")}`;
    })
    .join("\n");
}

// ── P17: chat reply (chat, 0.95, chat contract) ──

/** His stage, in place of GF's closeness ladder. */
const CHAT_STAGE: Record<number, string> = {
  1: "You are still behind your mask with them: guarded and brief. You deflect anything personal and never say outright what you feel.",
  2: "Your mask has started to crack with them: now and then something real slips into a message, and you cover it.",
  3: "You are drawn to them, and it shows in small ways you would deny if asked: you write a little more than you need to.",
  4: "Your mask has broken with them: what you feel shows, raw rather than smooth, and it frightens you.",
  5: "You are reckoning with who you have been: more honest with them than is comfortable, and still yourself.",
  6: "You have changed toward them, and only toward them: open in your own register, never sugary, with your edges still turned to the world.",
};

const RUPTURE_LINE =
  "A rupture stands between you. Answer curt and cold, at a distance, within your red lines. Do not pretend it is fine, and do not mend it here.";

export interface ChatReplyInput {
  world: Pick<World, "language" | "content" | "images" | "writingStyle" | "bannedPhrases">;
  player: Pick<Player, "name" | "pronouns" | "traits" | "about">;
  unit: Pick<Unit, "name" | "pronouns" | "bible">;
  liState: LiState;
  /** The open conversation's newest messages, oldest first; the last is the protagonist's. */
  tail: readonly PhoneMessage[];
  /** His memories of conversations that are over, oldest first. */
  memories: readonly PhoneSession[];
  /** The story as he may know it (recall for `reader: li`), or "". */
  story: string;
  /** His latest off-screen line from the ledgers, or "". */
  offscreen?: string;
}

export function chatReplyMessages({
  world,
  player,
  unit,
  liState,
  tail,
  memories,
  story,
  offscreen = "",
}: ChatReplyInput): OtomeMessage[] {
  const name = unit.name;
  const them = player.name || "the protagonist";
  const known = knowsAboutYou(unit, liState);
  const system = [
    `You are ${name} (${pronounText(unit.pronouns)}), a love interest in an otome visual novel: a character-driven romance. You are writing to ${them} in your private message thread, by whatever carries messages in this world (never a phone or a screen unless the world has them). This is a MESSAGE, not a scene: write as ${name}, in the first person, in your own voice.`,
    "Reply with ONLY a JSON object of this shape:",
    `{"messages": [{"text": "...", "sticker": "${FACES.join("|")}"}], "suggestions": ["...", "..."]}`,
    `- messages: 1 to ${REPLY_MESSAGES_MAX} messages sent one after another, usually 1 or 2, each short: a line or a few, the way people text.`,
    `- sticker: optional, one of your own faces sent as a sticker (${FACES.join(", ")}) when a face says it better than words; at most one in a reply. A sticker may stand alone with "text": "".`,
    `- suggestions: 2 or 3 short replies ${them} might send next, each at most ${SUGGESTION_CHARS_MAX} characters, different from one another in tone, in ${them}'s voice. They are only offers: ${them} may write anything.`,
    `- Write every message and suggestion in ${world.language}.`,
    "",
    "HOW CLOSE YOU ARE",
    CHAT_STAGE[liState.stage] ?? CHAT_STAGE[1]!,
    liState.rupture ? RUPTURE_LINE : "",
    "",
    "HARD RULES",
    `- Write ONLY your own messages. Never write ${them}'s reply, and never narrate what they do or feel.`,
    "- It is a message, not a chapter: no scene headings, no narration, no third person about yourself, no actions in asterisks.",
    "- Nothing happens in the story because of this conversation. You can talk about what has happened and what you feel; you cannot decide events, hand over items, set up a meeting the story must keep, or give away a secret you are still hiding. No grievance or rupture is settled by text: only the story settles it.",
    "- Never invent shared history: what you two share is only what the story and these conversations hold.",
    `- Never mention how long it has been since ${them} last wrote, that they were away, or anything about their life outside the story, and never ask where they have been.`,
    `- If ${them} says they feel unwell or had a hard day, answer with comfort only. ${COMFORT_RULE}`,
    "- Never repeat a line you already sent in this thread.",
    "",
    otomeWritingRules({ story: true, style: world.writingStyle, banned: world.bannedPhrases }),
    "",
    otomeContentContract({ world, lis: [{ name }], kind: "chat" }),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  const user = [
    "WHO YOU ARE",
    otomeSceneCard(unit, liState),
    betweenYou(unit, liState),
    // An empty notebook adds no line (a "" here would leave a blank one before the off-screen line).
    ...(known ? [known] : []),
    offscreen.trim()
      ? `What you were doing lately, away from ${them}: ${offscreen.trim()} You may hint at it in your own way; never give away what you are hiding.`
      : "",
    "",
    "THE PROTAGONIST",
    `${them} (${pronounText(player.pronouns)}). Never assume a gender the pronouns do not state.`,
    player.traits.length ? `Traits: ${player.traits.join("; ")}` : "",
    aboutLine(player),
    "",
    story.trim()
      ? `WHAT YOU KNOW OF THE STORY\nYou remember what you were there for or were told; anything else you know only as news that reached you, so never claim you were there.\n${story.trim()}`
      : "",
    "",
    memories.length
      ? [
          "CONVERSATIONS THAT ARE OVER",
          ...memories.map(
            (session) =>
              `- ${session.memory.text}${session.memory.quote ? ` One line from it: "${session.memory.quote}"` : ""}`,
          ),
          "They already happened. Bring one up only where it fits; never replay it or start from it again.",
        ].join("\n")
      : "",
    "",
    "THE THREAD NOW (oldest first)",
    renderThread(tail, { li: name, player: them }, "his"),
    "",
    `Write ${name}'s next message now, answering ${them}.`,
    otomeContractReminder("chat"),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** P17's reply as the model sends it (nulls allowed); normalizeChatReply makes it a ChatReply. */
export interface ChatReplyRaw {
  messages: Array<{ text?: string | null; sticker?: string | null }>;
  suggestions?: string[] | null;
}

export interface ChatReply {
  messages: Array<{ text: string; sticker?: Face }>;
  suggestions: string[];
}

export const ChatReplySchema: ZodType<ChatReplyRaw> = z.object({
  messages: z
    .array(
      z.object({ text: z.string().max(4000).nullable().optional(), sticker: z.string().max(40).nullable().optional() }),
    )
    .min(1)
    .max(8),
  suggestions: z.array(z.string().max(400)).max(12).nullable().optional(),
});

/**
 * His messages (a leading "Name:" taken off, at most one sticker, at most three messages, each cut to
 * MESSAGE_TEXT_MAX) and up to three distinct suggestions of at most 40 characters; longer ones are dropped. A message
 * written as the protagonist, or a reply with nothing in it, is refused (the repair turn names why).
 */
export function normalizeChatReply(raw: ChatReplyRaw, names: ThreadNames): ChatReply | string {
  const messages: ChatReply["messages"] = [];
  let stickers = 0;
  for (const entry of raw.messages) {
    let text = (entry.text ?? "").trim();
    // Any line of the message may be the protagonist's, not only the first.
    const asPlayer =
      !!names.player &&
      text.split(/\r?\n/u).some((line) => {
        const spoken = speakerPrefix(line.trim());
        return !!spoken && sameName(spoken.speaker, names.player);
      });
    if (asPlayer) {
      return `a message was written as ${names.player}: write only ${names.li}'s own messages, never their reply`;
    }
    const prefix = speakerPrefix(text);
    if (prefix && sameName(prefix.speaker, names.li)) text = prefix.rest;
    const sticker = isFace(entry.sticker) && stickers === 0 ? entry.sticker : undefined;
    if (sticker) stickers += 1;
    if (!text && !sticker) continue;
    messages.push({ text: [...text].slice(0, MESSAGE_TEXT_MAX).join(""), ...(sticker ? { sticker } : {}) });
  }
  if (!messages.length) return `the reply had no message from ${names.li}`;
  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const value of raw.suggestions ?? []) {
    const suggestion = value
      .trim()
      .replace(/^["“”'‘’«»]+|["“”'‘’«»]+$/gu, "")
      .trim();
    if (!suggestion || chars(suggestion) > SUGGESTION_CHARS_MAX || seen.has(squash(suggestion))) continue;
    seen.add(squash(suggestion));
    suggestions.push(suggestion);
  }
  return { messages: messages.slice(0, REPLY_MESSAGES_MAX), suggestions: suggestions.slice(0, SUGGESTIONS_MAX) };
}

// ── P18: chat memory (compress, summary contract) ──

export interface ChatMemoryInput {
  world: Pick<World, "language" | "content" | "images" | "writingStyle" | "bannedPhrases">;
  names: ThreadNames;
  /** The closed conversation, rendered for the summarizer (renderThread with `"told"`). */
  conversation: string;
}

export function chatMemoryMessages({ world, names, conversation }: ChatMemoryInput): OtomeMessage[] {
  const system = [
    `Two people have just finished exchanging messages: ${names.li} and ${names.player}. Write what ${names.li} will remember of it.`,
    "Reply with ONLY a JSON object of this shape:",
    '{"memory": "...", "quote": "..."}',
    `- memory: 2 to 4 sentences in the third person about what passed between them: what was said that matters, what changed, what was left unsaid. Not a transcript. Written in ${world.language}.`,
    "- quote: ONE line copied word for word from the conversation, the one worth hearing again, without quotation marks around it. Leave it empty when nothing stands out.",
    "HARD RULES",
    "- It already happened: write it as a memory, never as a scene that is going on.",
    "- Invent nothing: only what is in the conversation below.",
    "",
    otomeContentContract({ world, lis: [{ name: names.li }], kind: "summary" }),
    SUMMARY_WORDING,
  ].join("\n");
  const user = ["The conversation:", conversation, "", "Write the memory now.", otomeContractReminder("summary")].join(
    "\n",
  );
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

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
 * conversation really holds it word for word (a speaker's name before it is taken off).
 */
export function normalizeChatMemory(
  raw: ChatMemoryRaw,
  names: ThreadNames,
  conversation: string,
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
  if (prefix && (sameName(prefix.speaker, names.li) || sameName(prefix.speaker, names.player))) quote = prefix.rest;
  if (!quote || chars(quote) > MEMORY_QUOTE_MAX || !squash(conversation).includes(squash(quote))) quote = "";
  return { memory, quote };
}
