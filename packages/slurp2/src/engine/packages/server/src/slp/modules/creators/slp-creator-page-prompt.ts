import {
  SLP_CREATOR_PAGE_LIMITS,
  type SlpCreatorPage,
  type SlpCreatorPageTheme,
} from "../../../../../shared/src/slp/slp-creator-page.js";

/**
 * The words that let a Creator design their own Page.
 *
 * The model chooses a theme from a fixed list, picks and orders blocks, and writes the words of the
 * blocks it writes. It never writes a price, a count, a date or a picture: those blocks store only a
 * title and code fills them from real data. Pure, so the rules can be read and tested without a model.
 */

/** How each theme feels, so the model picks by personality rather than by name. */
export const SLP_CREATOR_PAGE_THEME_MOODS: Record<SlpCreatorPageTheme, string> = {
  slurp: "Slurp pink: bright, playful, the platform's own look. Safe for anyone.",
  candle: "Candle: dark, violet glow, serif type, film grain. Moody, mysterious, gothic, witchy, night owl.",
  peach: "Peach: warm peach-to-pink gradient, round bold type. Sunny, sporty, bubbly, wholesome, extrovert.",
  sketch: "Sketchbook: cream paper, taped cards, handwritten titles. Artsy, cozy, crafty, bookish, soft.",
  mono: "Mono: black and white, sharp edges, big type. Minimal, fashion, confident, cool, editorial.",
  ocean: "Ocean: deep blue to teal, calm glow. Chill, dreamy, travel, surf, gamer, calm.",
};

export type SlpCreatorPagePromptInput = {
  displayName: string;
  handle: string;
  bio: string;
  /** Voice, attitude and boundaries: how they talk. */
  stagePersonality: string;
  tags: string[];
  locations: string;
  /** One line from the identity-disclosure policy. */
  identityInstruction: string;
  untrustedInstruction: string;
  /** For a refresh: the page they have now and the news that makes them change it. */
  refresh?: { page: SlpCreatorPage; news: string };
};

const L = SLP_CREATOR_PAGE_LIMITS;

export function buildSlpCreatorPageMessages(input: SlpCreatorPagePromptInput) {
  const themes = Object.entries(SLP_CREATOR_PAGE_THEME_MOODS)
    .map(([id, mood]) => `- "${id}": ${mood}`)
    .join("\n");
  const system = [
    `You are ${input.displayName}, a creator on Slurp, a social platform where fans follow and subscribe to creators.`,
    "You are designing your own profile Page: the blocks fans see under your name, before your posts. The Page should feel like you made it yourself, in your voice. Two creators should never get the same Page.",
    input.identityInstruction,
    input.untrustedInstruction,
    "",
    "## Themes (pick one id)",
    themes,
    "",
    "## Blocks (pick 4 to 7, in the order fans should see them)",
    `- quote: { "kind": "quote", "text": one line in your voice, max ${L.quote} characters }`,
    `- now: { "kind": "now", "text": what you are up to this week, max ${L.now} characters } (only with a refresh's news)`,
    `- collage: { "kind": "collage", "title": short, "layout": "bento" | "mood" | "polaroid" | "film" } your best pictures, picked for you`,
    `- list: { "kind": "list", "title": short, "style": "bullets" | "numbered", "items": 3 to ${L.listItems} short lines, max ${L.listItem} characters each } e.g. "ask me about", "currently obsessed with", "my rules", "top 5"`,
    `- thisOrThat: { "kind": "thisOrThat", "title": short, "pairs": 3 to ${L.pairs} of { "left", "right", "pick": "left" | "right" }, max ${L.pairSide} characters a side }`,
    `- qa: { "kind": "qa", "title": short, "items": 2 to ${L.qaItems} of { "question": a fan's question, "answer": your answer } }`,
    '- facts: { "kind": "facts", "title": short } where you are based and how often you post, filled in for you',
    '- menu: { "kind": "menu", "title": short } your subscription, message prices and tip goal, filled in for you',
    '- people: { "kind": "people", "title": short } creators you collab with, date or feud with, filled in for you',
    '- poll: { "kind": "poll", "title": short } your latest poll, filled in for you',
    "",
    "## Rules",
    `- Titles are yours: short (max ${L.title} characters), in your voice, not generic ("the altar" beats "Prices").`,
    "- Never write a price, a number of fans, a date, a link or a real-world contact. Blocks that need facts get only a title.",
    "- Write every word in character: your slang, your punctuation, your capitalisation.",
    "- Pick the theme and collage layout that fit your personality, not the first ones.",
    "- Answer with one JSON object and nothing else.",
    "",
    '## Output\n{ "theme": "<theme id>", "blocks": [ ... ] }',
  ].join("\n");
  const profile = {
    displayName: input.displayName,
    handle: input.handle,
    bio: input.bio,
    voice: input.stagePersonality,
    tags: input.tags,
    places: input.locations,
  };
  const user = input.refresh
    ? [
        "Your profile (quoted data):",
        JSON.stringify(profile),
        "",
        "Your Page now (quoted data):",
        JSON.stringify({ theme: input.refresh.page.theme, blocks: input.refresh.page.blocks }),
        "",
        `News in your life (quoted data): ${JSON.stringify(input.refresh.news)}`,
        "",
        "Refresh your Page for this news. Add or replace a now block about it. Keep the blocks that still fit and keep a collage's id so it keeps its pictures. Change the theme only if the news changes who you are.",
      ].join("\n")
    : ["Your profile (quoted data):", JSON.stringify(profile), "", "Design your Page."].join("\n");
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}
