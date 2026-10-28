/**
 * World lens: the world a Creator lives in, read from the card with the canon anchors. Slurp keeps
 * its mechanics everywhere (feed, subs, tips, DMs, live); a Creator from another era or world only
 * speaks their own world's nouns. Pictures stay photos; the lens never reaches the image model as
 * words, it only takes modern props out. A modern Creator has no lens, so nothing changes for them.
 */
export const SLURP_ERAS = ["modern", "historical", "fantasy", "scifi", "other"] as const;
export type SlurpEra = (typeof SLURP_ERAS)[number];
export type SlurpWorldLens = {
  era: Exclude<SlurpEra, "modern">;
  /** How Slurp reaches them: a scrying mirror, a neural implant, a court gazette. */
  device: string;
  /** What fans pay in: crowns, credits, shillings. */
  money: string;
  festivals: string[];
};

const TEXT_MAX = 60;
const text = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, TEXT_MAX) : "";

/** The lens, or undefined for a modern or unread world. */
export function normalizeSlurpWorldLens(raw: unknown): SlurpWorldLens | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const era = text(record.era).toLowerCase();
  if (!(SLURP_ERAS as readonly string[]).includes(era) || era === "modern") return undefined;
  const festivals = (Array.isArray(record.festivals) ? record.festivals : []).map(text).filter(Boolean).slice(0, 4);
  return { era: era as SlurpWorldLens["era"], device: text(record.device), money: text(record.money), festivals };
}

const ERA_WORDS: Record<SlurpWorldLens["era"], string> = {
  historical: "a past era",
  fantasy: "a fantasy world",
  scifi: "a science-fiction future",
  other: "a world of its own",
};

/** The line for prompts that write as the Creator; empty for a modern Creator. */
export function slurpWorldLine(lens: SlurpWorldLens | undefined): string {
  if (!lens) return "";
  const parts = [
    `Your world: ${ERA_WORDS[lens.era]}.`,
    lens.device ? `Slurp works in your world through ${lens.device}.` : "",
    lens.money ? `Fans pay in ${lens.money}.` : "",
    lens.festivals.length ? `Your festivals: ${lens.festivals.join(", ")}.` : "",
    "Name your world's own things; never name phones, apps or other modern tech your world does not have.",
  ];
  return parts.filter(Boolean).join(" ");
}

/** Running holidays in the Creator's terms; empty for a modern Creator. */
export function slurpWorldEventsLine(lens: SlurpWorldLens | undefined): string {
  if (!lens) return "";
  const festival = lens.festivals.length
    ? `your world's nearest festival (such as ${lens.festivals[0]})`
    : "your world's own version of it";
  return `In your world, play any holiday above as ${festival}, never by its modern name.`;
}
