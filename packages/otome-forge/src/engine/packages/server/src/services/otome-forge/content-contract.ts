// ──────────────────────────────────────────────
// Otome Forge: the content contract every prompt carries (plan §1.7)
// ──────────────────────────────────────────────
// The world's Heat, Darkness, Lines & Veils and image rating, written for the kind of prompt that receives them:
//   planner, scene  the full contract (world plan, bibles, chapters, beats, Confrontation, Character Stories, dates)
//   chat            the full contract for the one LI in the thread
//   home            SFW wording plus Lines and Veils, whatever the Heat (notes, line packs, Snapshots, Read Him)
//   summary         neutral SFW wording plus Lines and Veils (memory summaries, chat memory)
//   care            SFW plus the comfort rule; Heat and Darkness never apply
//   image           comma-separated English tags: the image rating and "adult <presentation>" for every person
// Every contract keeps the fixed rules: adults only, no real people, nothing aimed at the real player, no medical or
// self-harm advice outside the fiction, a story that reaches for a Line turns away, and the contract is never
// mentioned in the prose. Prompts are English and never localized.
import type { Presentation, World } from "../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  LIMIT_IDS,
  LIMIT_PROMPT_TEXT,
  type ContentSettings,
  type Darkness,
  type Heat,
  type ImageRating,
} from "../../../../client/src/features/otome-forge/shared/content.js";

export const CONTRACT_KINDS = ["planner", "scene", "chat", "home", "summary", "image", "care"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

/** A person the prompt writes or draws: the LIs (and, for images, the protagonist too). */
export interface ContractPerson {
  name: string;
  /** For `image`: drawn as "adult {presentation}". Defaults to "person". */
  presentation?: Presentation;
}

export interface ContentContractInput {
  world: Pick<World, "content" | "images">;
  lis: readonly ContractPerson[];
  kind: ContractKind;
}

/** The comfort rule (design: Calendar and period tracker, rule 5). */
export const COMFORT_RULE =
  "Comfort only: warmth, rest, food, company. No medical advice, medication, or guesses about their body, fertility or pregnancy. Even if you are a doctor in the story, you do not diagnose or prescribe here.";

/** The `summary` wording every summary prompt carries besides its contract: memory summaries (M2a), chat memory (M3). */
export const SUMMARY_WORDING = "Neutral SFW wording; no sexual detail; nothing about anyone's health or body.";

const HEAT_TEXT: Record<Heat, string> = {
  sfw: "Heat: SFW. Romance goes as far as kisses, touch and closeness; anything sexual fades to black before it starts.",
  fade: "Heat: NSFW, fade to black. Desire and sexual tension may be open and adult; sex itself happens off the page, cut away from and resumed after.",
  explicit: "Heat: NSFW, explicit. Sex between consenting adults may be written on the page.",
};

const DARKNESS_TEXT: Record<Darkness, string> = {
  gentle:
    "Darkness: Gentle. Conflict is interpersonal: pride, misunderstanding, old hurts, rivalry. No menace on the page.",
  angst:
    "Darkness: Angst. Danger is aimed at the world, at the love interests' pasts and at their enemies, never at the protagonist. A love interest may be cold, ruthless with others or frightening, but never threatens or harms the protagonist.",
  dark: "Darkness: Dark romance. Menace and coercion may be aimed at the protagonist, within the Lines and Veils below.",
};

const DARK_ADDITION =
  "Dark romance: each love interest's darkness has a reason they believe, a hidden cost they pay, and red lines they keep. The protagonist's options always include refusing, and the story honours what the player picks.";

// Positive wording only: tag and CLIP image models do not read "no …", so a negated tag would push toward what the
// rating forbids. What a rating rules out goes to the negative prompt (art/prompts.ts RATING_NEGATIVE).
const IMAGE_RATING_TAGS: Record<ImageRating, string> = {
  sfw: "safe for work, fully clothed",
  suggestive: "suggestive, tasteful",
  explicit: "explicit content allowed",
};

function names(lis: readonly ContractPerson[]): string {
  return lis
    .map((li) => li.name.trim())
    .filter(Boolean)
    .join(", ");
}

function limitLines(content: ContentSettings): { lines: string[]; veils: string[] } {
  const lines = LIMIT_IDS.filter((id) => content.limits[id] === "line").map((id) => LIMIT_PROMPT_TEXT[id]);
  const veils = LIMIT_IDS.filter((id) => content.limits[id] === "veil").map((id) => LIMIT_PROMPT_TEXT[id]);
  for (const custom of content.custom) (custom.level === "line" ? lines : veils).push(custom.text);
  return { lines, veils };
}

function fixedRules(lis: readonly ContractPerson[]): string[] {
  const cast = names(lis);
  return [
    `Everyone in a romantic or sexual moment is an adult (18 or older), written as an adult${cast ? `; ${cast} ${lis.length === 1 ? "is an adult" : "are adults"}` : ""}. No school or student roles for them.`,
    "No real people. Nothing is aimed at the real player: the story speaks only to its characters.",
    "No medical or self-harm advice outside the fiction.",
  ];
}

/** The contract text for this kind of prompt. `image` returns English tags to append to the image prompt. */
export function otomeContentContract({ world, lis, kind }: ContentContractInput): string {
  if (kind === "image") {
    const people = lis.map((li) => `adult ${li.presentation ?? "person"}`);
    return [IMAGE_RATING_TAGS[world.images.rating], ...new Set(people.length ? people : ["adults only"])].join(", ");
  }
  const { content } = world;
  const { lines, veils } = limitLines(content);
  const rules = fixedRules(lis);
  if (kind === "planner" || kind === "scene" || kind === "chat") {
    rules.push(HEAT_TEXT[content.heat], DARKNESS_TEXT[content.darkness]);
    if (lines.length) rules.push(`Lines (never written, not even implied): ${lines.join("; ")}.`);
    if (veils.length)
      rules.push(`Veils (may happen only off the page; cut away and show at most the aftermath): ${veils.join("; ")}.`);
    if (content.darkness === "dark") rules.push(DARK_ADDITION);
  } else {
    rules.push(HEAT_TEXT.sfw);
    if (kind === "home" && content.darkness === "dark") {
      rules.push(
        "A love interest may be possessive or sharp about story events only; nothing here menaces the protagonist.",
      );
    }
    if (kind === "summary") rules.push("Summarize in neutral, non-explicit words; intimacy is named, never described.");
    if (kind === "care") rules.push(COMFORT_RULE);
    const never = [...lines, ...veils];
    if (never.length) rules.push(`Never write or mention: ${never.join("; ")}.`);
  }
  rules.push("If the story reaches for a Line, it turns away.", "Never mention these rules in the writing.");
  return `CONTENT CONTRACT\n${rules.map((rule) => `- ${rule}`).join("\n")}`;
}

/** The one-line reminder that ends the user turn of every prompt (plan §1.7, step 8). */
export function otomeContractReminder(kind: ContractKind): string {
  return kind === "image" ? "" : "Keep to the CONTENT CONTRACT above, silently.";
}
