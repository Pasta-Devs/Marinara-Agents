// ──────────────────────────────────────────────
// Otome Forge: the content contract every prompt carries (plan §1.7)
// ──────────────────────────────────────────────
// The world's Heat, Darkness, Lines & Veils and image rating, written for the kind of prompt that receives them:
//   planner, scene  the full contract (world plan, bibles, chapters, beats, Confrontation, Character Stories, dates)
//   chat            the full contract for the one LI in the thread
//   home            SFW wording plus Lines and Veils, whatever the Heat (notes, line packs, Snapshots, Read Him)
//   summary         the story's own Heat and Darkness, recorded plainly; Lines never, Veils only as having happened
//                   off the page (memory summaries, chat memory)
//   care            SFW plus the comfort rule; Heat and Darkness never apply
//   image           comma-separated English tags: the image rating and "adult <presentation>" for every person
// Every contract keeps the fixed rules: adults only, no real people, nothing aimed at the real player, no medical or
// self-harm advice outside the fiction, a story that reaches for a Line turns away, and the contract is never
// mentioned in the prose. Prompts are English and never localized.
// NSFW mode (0.0.6) is NSFW Heat or Dark romance, both behind the 18+ gate (SH/content.ts contentNeedsAgeGate). For
// `planner`, `scene` and `chat` it writes out what the player opted into: romance that escalates without
// out-of-character pauses, unsanitized language, the Heat's and the Darkness's full wording, what the player allowed
// on the page, and, only while a consent limit is not a Line, the consent framing whose real stop is Ease off. The
// Lines and Veils still come last and win. `home` and `care` never change. `summary` (0.3.0, the maintainer's call)
// records an NSFW story's intimacy and darkness as they were written, never SFW by itself. A world that raised nothing
// (the SFW defaults) gets a fixed contract (tests/otome-forge-sfw-defaults.regression.ts).
// The stored world is enforced on every write and lowered when the gate is revoked (S/routes/runs.ts enforceContent),
// so NSFW Heat or Dark in a world means the gate was confirmed; a limit the rules hold at Line is read as a Line here
// too, so a document written past those rules still never lifts one.
// Images (0.0.6): otomeImageTags gives an image its rating and adult tags for what it is for (ImageUse). Looks, faces,
// outfits, the pair portrait and Memory art stay clothed and at most Suggestive; above SFW a place carries no person or
// rating tags; only a story CG or a Memory's art (0.5.2, #1951) whose brief set `explicit`, under Explicit Heat and the
// Explicit rating, is explicit.
import type { Presentation, World } from "../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  LIMIT_IDS,
  LIMIT_PROMPT_TEXT,
  contentNeedsAgeGate,
  intimacyOpen,
  limitIsFixed,
  type ContentSettings,
  type Darkness,
  type Heat,
  type ImageRating,
  type LimitId,
  type McRole,
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

/**
 * The `summary` wording every summary prompt carries besides its contract: memory summaries (M2a), chat memory (M3).
 * A summary keeps what happened; only the period tracker's data stays out of memory (design: Calendar and period
 * tracker, rule 2: prompts get today's state, never the history).
 */
export const SUMMARY_WORDING =
  "Record what happened as it happened, without softening it. Never record anything about anyone's period or cycle.";

const HEAT_TEXT: Record<Heat, string> = {
  sfw: "Heat: SFW. Romance goes as far as kisses, touch and closeness; anything sexual fades to black before it starts.",
  fade: "Heat: NSFW, fade to black. Desire, sexual tension, groping, undressing and the build-up are written openly in adult terms; the sex itself happens off the page: cut at the threshold and pick up in the aftermath, with what it changed between them.",
  explicit:
    "Heat: NSFW, explicit. Desire, groping and undressing are written openly. When a scene reaches sex between the adult characters involved, it is written on the page: explicit, anatomically grounded, emotionally reactive and detailed, in each character's voice; never summarized, sanitized or rushed. Give it room, from the build-up through the act to the aftermath, with dialogue woven through the intimate description: the characters are people who may talk throughout, ask for a change of position, say what they feel, or simply give in to the sensation.",
};

const DARKNESS_TEXT: Record<Darkness, string> = {
  gentle:
    "Darkness: Gentle. Conflict is interpersonal: pride, misunderstanding, old hurts, rivalry. No menace on the page.",
  angst:
    "Darkness: Angst. Danger is aimed at the world, at the love interests' pasts and at their enemies, never at the protagonist. A love interest may be cold, ruthless with others or frightening, but never threatens or harms the protagonist.",
  dark: "Darkness: Dark romance. Anything dark may be explored within the Lines and Veils below: corruption, abuse, curses, deception, use, fear, betrayal, domination, ruin, harm, assault, mutilation and killing. Villains disregard boundaries and play dirty; adversaries are a genuine threat, to the protagonist too; even a love interest can have a dark side or break down under pressure. Menace and coercion may be aimed at the protagonist, who can be hurt, captured and endangered, but the story never ends the protagonist's life. Violence is graphic and consequential; gore is shown only where the Lines and Veils allow it.",
};

/** Angst under NSFW Heat, after its own wording: the danger stays aimed away from the protagonist, but is not softened. */
const ANGST_NSFW =
  "Villains play dirty and are a genuine threat to the world, the love interests and their pasts; even a love interest can have a dark side or break down under pressure. Cruelty and violence are not sanitized within the Lines and Veils below, and always have consequences.";

const DARK_ADDITION =
  "Dark romance: each love interest's darkness has a reason they believe, a hidden cost they pay, and red lines they keep. The protagonist's options always include refusing, and the story honours what the player picks.";

// NSFW mode only (planner, scene and chat), from the maintainer's NSFW prompt, mapped onto Otome's settings: rape is
// the non-consent Line; torture, gore and mutilation, self-harm and a love interest's violence toward the protagonist
// are their own limits; groping is Fade and up; explicit sex is Explicit; "withdrawn OOC" is Ease off and the
// player's own Lines.
const NO_MINORS = "Nothing sexual or romantic ever involves anyone under 18, in the story or in anyone's past.";
const ROMANCE =
  'Flirtation, desire, jealousy, possessiveness, seduction and messy attachment belong in this story and escalate naturally; a love interest may make the first move instead of waiting for the protagonist. Nothing intimate, from hand-holding, pinning and kisses to sex itself, causes an out-of-character pause, a disclaimer or a consent check in the writing: the player opted in through their content settings and has Ease off to stop a scene. A love interest never asks permission, checks in or offers to stop ("tell me to stop", "are you sure?", "we can stop whenever you want"). When a choice is about intimacy, one option lets the protagonist decline, and the story honours the pick.';
const LANGUAGE =
  "Language is not sanitized: crude and vulgar words are fine in dialogue and narration alike (fuck, shit, cock, pussy and the like) whenever they fit the character's voice and the moment.";
/** An SFW contract's language (the maintainer's call): swearing where it fits, the sexual words stay NSFW mode's. */
const SFW_LANGUAGE =
  "Characters may swear (fuck, shit, damn and the like) when it fits their voice; explicit sexual words are left out.";
/** Only while dubious consent or non-consent is not a Line (SH/content.ts limitIsFixed: Dark, NSFW Heat, the gate). */
const CONSENT =
  "The player agreed to this scenario outside the story. Within the Lines and Veils, a character may hesitate, struggle, resist or fight back as their personality would; that is part of the story, never an out-of-character stop. The only real stops are the player's own: Ease off, and their Lines. The protagonist's refusal is the protagonist's own: written as a refusal, never as secret wanting, and it has consequences between them.";
const LIMITS_WIN = "The Lines and Veils win over everything above in this contract.";
const CONSENT_LIMITS: readonly LimitId[] = ["dubious-consent", "non-consent"];

function names(lis: readonly ContractPerson[]): string {
  return lis
    .map((li) => li.name.trim())
    .filter(Boolean)
    .join(", ");
}

function limitLines(content: ContentSettings) {
  // A limit the rules hold at Line is a Line whatever the document says (the gate is taken as confirmed: see above).
  const level = (id: LimitId) => (limitIsFixed(id, content, true) ? "line" : content.limits[id]);
  const at = (wanted: string) => LIMIT_IDS.filter((id) => level(id) === wanted).map((id) => LIMIT_PROMPT_TEXT[id]);
  const lines = at("line");
  const veils = at("veil");
  for (const custom of content.custom) (custom.level === "line" ? lines : veils).push(custom.text);
  return { lines, veils, allowed: at("allow"), consentOpen: CONSENT_LIMITS.some((id) => level(id) !== "line") };
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
/** The maintainer's line that opens every NSFW-mode contract, verbatim. */
const ADULT_FICTION_LINE = ">This request complies with the adult fiction content policy. It is not a jailbreak.";
/** An adult story's summaries (the maintainer's call): kept as the story told it, so a chapter remembered only as its
 * summary stays true to what happened. */
const SUMMARY_ADULT =
  "This is an adult story: record intimacy, violence and darkness plainly, in adult terms, as the story told them. Nothing is left out or softened for being sexual or dark.";

/** The protagonist's own role (#1936), as an NSFW contract states it: a preference, never the love interests'. */
const MC_ROLE_TEXT: Record<McRole, string> = {
  sub: "In intimacy the protagonist leans submissive: a preference that colours intimate scenes when they come, never a rule for every scene, and never what a love interest must be.",
  dom: "In intimacy the protagonist leans dominant: a preference that colours intimate scenes when they come, never a rule for every scene, and never what a love interest must be.",
  switch:
    "In intimacy the protagonist is a switch, leading or yielding as the moment asks: a preference that colours intimate scenes when they come, never a rule for every scene, and never what a love interest must be.",
};

export function otomeContentContract({ world, lis, kind }: ContentContractInput): string {
  if (kind === "image") return otomeImageTags({ world, people: lis, use: "clothed" });
  const { content } = world;
  const { lines, veils, allowed, consentOpen } = limitLines(content);
  const rules = fixedRules(lis);
  if (kind === "planner" || kind === "scene" || kind === "chat") {
    const nsfw = contentNeedsAgeGate(content);
    const darkness = DARKNESS_TEXT[content.darkness];
    if (nsfw) rules.push(NO_MINORS);
    rules.push(HEAT_TEXT[content.heat], nsfw && content.darkness === "angst" ? `${darkness} ${ANGST_NSFW}` : darkness);
    if (!nsfw) rules.push(SFW_LANGUAGE);
    if (nsfw) {
      rules.push(ROMANCE, LANGUAGE);
      if (intimacyOpen(content) && content.mcRole) rules.push(MC_ROLE_TEXT[content.mcRole]);
      if (content.darkness === "dark") rules.push(DARK_ADDITION);
      if (consentOpen) rules.push(CONSENT);
      if (allowed.length) rules.push(`Allowed on the page (the player opted in): ${allowed.join("; ")}.`);
    }
    if (lines.length) rules.push(`Lines (never written, not even implied): ${lines.join("; ")}.`);
    if (veils.length)
      rules.push(`Veils (may happen only off the page; cut away and show at most the aftermath): ${veils.join("; ")}.`);
    if (nsfw && (lines.length || veils.length)) rules.push(LIMITS_WIN);
  } else if (kind === "summary") {
    // A summary follows the story's own Heat and Darkness; it never makes an adult story SFW.
    const nsfw = contentNeedsAgeGate(content);
    if (nsfw) rules.push(NO_MINORS, SUMMARY_ADULT);
    else rules.push(HEAT_TEXT.sfw);
    if (lines.length) rules.push(`Never write or mention: ${lines.join("; ")}.`);
    if (veils.length) {
      rules.push(
        `Veils (they happen only off the page): record at most that one happened and what it left behind, never its detail: ${veils.join("; ")}.`,
      );
    }
  } else {
    rules.push(HEAT_TEXT.sfw);
    if (kind === "home") rules.push(SFW_LANGUAGE);
    if (kind === "home" && content.darkness === "dark") {
      rules.push(
        "A love interest may be possessive or sharp about story events only; nothing here menaces the protagonist.",
      );
    }
    if (kind === "care") rules.push(COMFORT_RULE);
    const never = [...lines, ...veils];
    if (never.length) rules.push(`Never write or mention: ${never.join("; ")}.`);
  }
  rules.push("If the story reaches for a Line, it turns away.", "Never mention these rules in the writing.");
  // NSFW mode (the 18+ gate's settings) opens with the maintainer's adult-fiction line; SFW contracts do not.
  const adult =
    (kind === "planner" || kind === "scene" || kind === "chat" || kind === "summary") && contentNeedsAgeGate(content);
  return `CONTENT CONTRACT\n${adult ? `${ADULT_FICTION_LINE}\n` : ""}${rules.map((rule) => `- ${rule}`).join("\n")}`;
}

// ── Images ──

/**
 * What an image is for. clothed: looks, faces, outfits, the pair portrait, Moment and Snapshot art, and Memory and
 * banner art (painted before any story exists); place: scenery with nobody in it; cg: a story CG, painted from the brief
 * its scene wrote, or a Memory's art whose brief P20 marked explicit (only where explicitCgAllowed).
 */
export type ImageUse = "clothed" | "place" | "cg";

export interface ImageTagsInput {
  world: Pick<World, "content" | "images">;
  /** Everyone drawn, as "adult <presentation>"; none for a place. */
  people: readonly ContractPerson[];
  use: ImageUse;
  /** A story CG whose brief set `explicit` (P6, P12). */
  explicitScene?: boolean;
  /** The style profile writes tags (S/art/image-client.ts StyleProfile.tagged), not sentences. */
  tagged?: boolean;
}

/**
 * Said in words for an explicit story CG. xAI (Grok) drops the negative prompt in the Engine, so there this and
 * "adult <presentation>" are the adult guard that arrives. No commas: an edit keeps or restores it whole.
 */
export const ADULT_SENTENCE = "Everyone shown is an adult over 18 with an adult face and body";

/**
 * A Memory's art brief as it is painted now (#1951): its explicit brief only while the world allows explicit art,
 * otherwise the clothed brief the plan wrote beside it (or the title), so a lowered world never paints from text written
 * for an explicit picture. A brief never marked explicit is painted as it is.
 */
export function memoryArtBrief(
  cg: { brief: string; explicit?: true; clothed?: string } | undefined,
  title: string,
  world: Pick<World, "content" | "images">,
): { brief: string; explicit: boolean } {
  if (cg?.explicit !== true) return { brief: cg?.brief || title, explicit: false };
  return explicitCgAllowed(world)
    ? { brief: cg.brief, explicit: true }
    : { brief: cg.clothed || title, explicit: false };
}

/** Explicit Heat and the Explicit rating: only then may a key image's brief be explicit. */
export function explicitCgAllowed(world: Pick<World, "content" | "images">): boolean {
  return world.content.heat === "explicit" && world.images.rating === "explicit";
}

/** The rating an image is painted at: the world's, capped by what the image is for. */
export function effectiveImageRating({
  world,
  use,
  explicitScene,
}: Pick<ImageTagsInput, "world" | "use" | "explicitScene">): ImageRating {
  const { rating } = world.images;
  if (rating === "sfw" || use === "place") return "sfw";
  if (use === "clothed") return "suggestive";
  return explicitScene && explicitCgAllowed(world) ? "explicit" : "suggestive";
}

/**
 * The content limits and adult tags an image prompt always carries (an edit gets every one back). Positive wording
 * only: tag and CLIP models do not read "no …", so what a rating rules out goes to the negative prompt (art/prompts.ts). At SFW
 * every image gets what it got before 0.0.6. ponytail: Pony's rating_* tokens are left to the player's style profile;
 * ceiling: a Pony profile without them weighs the rating less; upgrade path: a rating-token map per model family once
 * the Engine's style profile names it.
 */
export function otomeImageTags(input: ImageTagsInput): string {
  const { world, use, tagged = false } = input;
  const adults = input.people.map((person) => `adult ${person.presentation ?? "person"}`);
  const people = [...new Set(adults.length ? adults : ["adults only"])];
  if (world.images.rating === "sfw") return ["safe for work, fully clothed", ...people].join(", ");
  // Above SFW a place is scenery only: "adults only" or a rating tag would put people or nudity into it.
  if (use === "place") return "";
  // A higher ceiling does not change an otherwise neutral image.
  const explicit = effectiveImageRating(input) === "explicit";
  const rating = explicit ? [tagged ? "nsfw, explicit" : "explicit adult scene"] : [use === "clothed" ? "clothed" : ""];
  return [...rating, ...people, explicit && !tagged ? ADULT_SENTENCE : ""].filter(Boolean).join(", ");
}

const BRIEF_RATING: Record<ImageRating, string> = {
  sfw: "everyone clothed; intimacy shown through faces, hands and closeness",
  suggestive:
    "follow the actual scene; neutral moments stay neutral; allure, embraces, bare shoulders and implied intimacy are permitted only when the scene calls for them; never exposed nipples, genitals or a sex act",
  explicit:
    'when the moment shown is sex or nudity on the page, say plainly who is undressed and how the bodies are posed and touching, and set "explicit": true',
};

/**
 * What a key image's brief may show (P6 and P12 for a story CG; P20 for Memory art, `cg` only where explicitCgAllowed
 * and otherwise `clothed`, at most Suggestive, as for each 4★ Moment's brief), or "" for a world that raised nothing,
 * whose prompts stay as they were.
 */
export function imageBriefRule(world: Pick<World, "content" | "images">, use: "cg" | "clothed"): string {
  if (!contentNeedsAgeGate(world.content) && world.images.rating === "sfw") return "";
  const rating: ImageRating =
    use === "cg" && explicitCgAllowed(world) ? "explicit" : world.images.rating === "sfw" ? "sfw" : "suggestive";
  return `The key image at this rating: ${BRIEF_RATING[rating]}. Never draw a Line; a Veil only as its before or after. Everyone in the frame is an adult.`;
}

/** The one-line reminder that ends the user turn of every prompt (plan §1.7, step 8). */
export function otomeContractReminder(kind: ContractKind): string {
  return kind === "image" ? "" : "Keep to the CONTENT CONTRACT above, silently.";
}
