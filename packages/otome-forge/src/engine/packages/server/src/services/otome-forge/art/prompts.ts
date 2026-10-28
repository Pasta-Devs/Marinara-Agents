// ──────────────────────────────────────────────
// Otome Forge: image prompts, built in code with no model call (plan §1.8, M1 "Image prompts")
// ──────────────────────────────────────────────
// A look is the identity line and the outfit line, full body on a flat mid-grey background (so the Home cut-out has
// an easy matte), plus the world's image rating and "adult <presentation>" from the content contract. The prompt goes
// to the Engine as a prompt override, which replaces the Engine's own prompt and style, so the chosen style profile's
// text and tags are added here. A prompt the player edited in the review dialog keeps every rating and adult tag:
// the missing ones are appended again. Image prompts are always English. GF's buildImagePromptsMessages (server.mjs,
// offset 574915) is the reference for the wording.
// M2b adds a place (scenery from the beat's English tags, no people), a story CG (the narrator's English brief, then
// each person's identity and outfit lines; at most 4 people, matching the references) and an expression edit (the
// kit's edit instruction, which changes only the face). Each one carries the rating and adult tags the same way.
// 0.0.6: the tags follow what the image is for (content-contract.ts otomeImageTags). Looks, faces, outfits, the pair
// portrait and Memory art stay clothed portraits at most Suggestive; above SFW a place carries no person or rating
// tags; a story CG is explicit only when its brief set `explicit` under Explicit Heat and the Explicit rating, and then
// its people are drawn from their identity lines alone (an outfit line would dress the moment). The adult negatives
// stay on every image, whatever the rating or the player's edit, and above SFW no part of a prompt names a minor
// (adultsOnly). At SFW every prompt is what it was before.
// M5 adds a date's keepsake: a story CG of the two of them (never explicit) with the keepsake's own framing.
import { forgeStoryExpressionPrompt } from "@forge-kit/story-expressions-server.mjs";
import type { Presentation, Unit, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import type { ImageRating } from "../../../../../client/src/features/otome-forge/shared/content.js";
import { FACE_LOOKS, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { effectiveImageRating, otomeImageTags, type ImageUse } from "../content-contract.js";
import type { StyleProfile } from "./image-client.js";

/** A look's size: a full-body portrait. */
export const LOOK_SIZE = { width: 832, height: 1216 } as const;
/** CGs and places (M2b). */
export const SCENE_SIZE = { width: 768, height: 1344 } as const;

export const LOOK_FRAMING = "full body, standing, neutral pose, plain flat mid-grey background";
const LOOK_NEGATIVE =
  "text, captions, logos, watermarks, borders, UI, collage layouts, duplicate faces, extra people, cropped-off heads, cropped feet, busy background, scenery";
/** Kept on every image, whatever the settings or the player's edits. */
const ADULT_NEGATIVE = "child, childlike, minor, underage, school uniform";
/** Added to the adult negatives on every image above SFW. */
const ADULT_NEGATIVE_ABOVE_SFW = "loli, shota, teenager";
/** What each rating rules out: at SFW on every image, as before 0.0.6; above SFW on a story CG (a place keeps SFW's). */
const RATING_NEGATIVE: Record<ImageRating, string> = {
  sfw: "nudity, nsfw, sexual content, lingerie",
  suggestive: "explicit, nude, nudity, nipples, genitals, sex",
  explicit: "",
};
/** Above SFW, a clothed portrait (a look, a face, an outfit, the pair portrait, Memory art) may be revealing, never bare. */
const CLOTHED_NEGATIVE = "nude, nudity, nipples, genitals, sex, explicit";

/** A part of a prompt that names or describes a minor (English: image prompts are always English). */
const MINOR_TERMS =
  /\b(child|children|childlike|kids?|minors?|underage|preteens?|teens?|teenagers?|teenage|loli|lolita|shota|schoolgirls?|schoolboys?|school uniform|toddlers?|infants?)\b|\b([1-9]|1[0-7])[- ]?(years?|yrs?)[- ]?old\b/i;

/**
 * Above SFW, the positive prompt keeps no comma-separated part that names a minor, whoever wrote it (the player's
 * edit, a model-written brief or outfit line): the negative prompt says the same, but xAI drops negatives. ponytail:
 * an English word list, not a classifier; ceiling: a paraphrase it does not list; upgrade path: an Engine-side check
 * before the paid call.
 */
function adultsOnly(world: Pick<World, "images">, prompt: string): string {
  if (world.images.rating === "sfw") return prompt;
  return prompt
    .split(",")
    .filter((part) => !MINOR_TERMS.test(part))
    .join(",")
    .trim();
}

/** The negatives an image of this use always keeps: adults only, then what its rating rules out. */
function requiredNegative(world: Pick<World, "content" | "images">, use: ImageUse, explicitScene = false): string {
  if (world.images.rating === "sfw") return mergeTags(ADULT_NEGATIVE, RATING_NEGATIVE.sfw);
  const ruledOut =
    use === "clothed" ? CLOTHED_NEGATIVE : RATING_NEGATIVE[effectiveImageRating({ world, use, explicitScene })];
  return mergeTags(ADULT_NEGATIVE, ADULT_NEGATIVE_ABOVE_SFW, ruledOut);
}

export interface LookInput {
  name: string;
  identityLine: string;
  outfitLine: string;
  presentation: Presentation;
  world: Pick<World, "content" | "images">;
  style: StyleProfile;
}

export interface ImagePrompt {
  prompt: string;
  negativePrompt: string;
}

const tagsOf = (text: string) =>
  text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

/** Comma-separated tags in order, each once (case-insensitive). */
function mergeTags(...parts: string[]): string {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of parts.flatMap(tagsOf)) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags.join(", ");
}

/**
 * `text` as written, with every tag of `required` it lacks appended. Whole comma-separated tags are compared, so
 * "adult manga style" does not stand in for "adult man", nor "not fully clothed" for "fully clothed".
 */
function withTags(text: string, required: string): string {
  const have = new Set(tagsOf(text).map((tag) => tag.toLowerCase()));
  const missing = tagsOf(required).filter((tag) => !have.has(tag.toLowerCase()));
  return [text.trim().replace(/[,\s]+$/, ""), ...missing].filter(Boolean).join(", ");
}

/**
 * The look prompt for one person. With `edited` (the review dialog's text), the player's wording is kept and only the
 * rating, adult and negative safety tags it dropped are put back.
 */
export function lookPrompt(input: LookInput, edited: Partial<ImagePrompt> = {}): ImagePrompt {
  const { world, style } = input;
  const required = otomeImageTags({
    world,
    people: [{ name: input.name, presentation: input.presentation }],
    use: "clothed",
    tagged: style.tagged === true,
  });
  const negative = requiredNegative(world, "clothed");
  const prompt = edited.prompt?.trim()
    ? withTags(edited.prompt, required)
    : [style.styleText, mergeTags(input.identityLine, input.outfitLine, LOOK_FRAMING, required, style.positiveTags)]
        .filter(Boolean)
        .join(", ");
  const negativePrompt = edited.negativePrompt?.trim()
    ? withTags(edited.negativePrompt, negative)
    : mergeTags(LOOK_NEGATIVE, negative, style.negativeTags);
  return { prompt: adultsOnly(world, prompt), negativePrompt };
}

// ── M2b: places, story CGs and expressions ──

export const PLACE_FRAMING = "scenery, no humans, wide establishing shot, detailed background, atmospheric lighting";
const PLACE_NEGATIVE =
  "people, person, humans, crowd, character, text, captions, logos, watermarks, borders, UI, collage layouts";
export const CG_FRAMING = "cinematic composition, detailed background, dramatic lighting, emotional moment";
const CG_NEGATIVE =
  "text, captions, logos, watermarks, borders, UI, collage layouts, duplicate faces, cropped-off heads, extra limbs";
/** At most this many people are drawn in a CG (and sent as references). */
export const CG_PEOPLE_MAX = 4;

const sentence = (value: string) => {
  const text = value.trim().replace(/[,\s]+$/, "");
  return !text || /[.!?…]$/.test(text) ? text : `${text}.`;
};

/** An edited prompt keeps its wording with every required tag put back; otherwise `built()`. */
function finish(
  world: Pick<World, "images">,
  built: () => ImagePrompt,
  required: string,
  negative: string,
  edited: Partial<ImagePrompt>,
): ImagePrompt {
  const fresh = edited.prompt?.trim() && edited.negativePrompt?.trim() ? null : built();
  return {
    prompt: adultsOnly(world, edited.prompt?.trim() ? withTags(edited.prompt, required) : fresh!.prompt),
    negativePrompt: edited.negativePrompt?.trim() ? withTags(edited.negativePrompt, negative) : fresh!.negativePrompt,
  };
}

export interface PlaceInput {
  /** The place's name in the world's language (only its English tags describe it). */
  name: string;
  /** 4–8 English image tags, from the beat. */
  tags: string;
  world: Pick<World, "content" | "images">;
  style: StyleProfile;
}

/** A place: the beat's English tags as scenery, with no people in it. */
export function placePrompt(input: PlaceInput, edited: Partial<ImagePrompt> = {}): ImagePrompt {
  const { world, style } = input;
  const required = otomeImageTags({ world, people: [], use: "place", tagged: style.tagged === true });
  const negative = requiredNegative(world, "place");
  return finish(
    world,
    () => ({
      prompt: [style.styleText, mergeTags(input.tags, PLACE_FRAMING, required, style.positiveTags)]
        .filter(Boolean)
        .join(", "),
      negativePrompt: mergeTags(PLACE_NEGATIVE, negative, style.negativeTags),
    }),
    required,
    negative,
    edited,
  );
}

/** A person in a CG: who they are and what they wear (English, visual only), drawn as an adult. */
export interface CgPerson {
  name: string;
  identityLine: string;
  outfitLine: string;
  presentation: Presentation;
}

export interface CgInput {
  /** The narrator's English brief: where and how the moment is shot, never anyone's looks. */
  brief: string;
  people: readonly CgPerson[];
  world: Pick<World, "content" | "images">;
  style: StyleProfile;
  /** cg: a story CG; clothed: the pair portrait and Memory or banner art, which stay clothed and at most Suggestive. */
  use: Extract<ImageUse, "cg" | "clothed">;
  /** The story CG's brief set `explicit` (beat.cg.explicit). */
  explicit?: boolean;
  /** The shot's framing tags; CG_FRAMING by default (a keepsake has its own). */
  framing?: string;
}

/** A story CG: the brief, each person's look, then the framing, rating and adult tags for every person. */
export function cgPrompt(input: CgInput, edited: Partial<ImagePrompt> = {}): ImagePrompt {
  const { world, style, use } = input;
  const people = input.people.slice(0, CG_PEOPLE_MAX);
  const explicitScene = input.explicit === true;
  const required = otomeImageTags({ world, people, use, explicitScene, tagged: style.tagged === true });
  const negative = requiredNegative(world, use, explicitScene);
  // An explicit moment draws each person from who they are: their outfit line would dress it again.
  const bare = effectiveImageRating({ world, use, explicitScene }) === "explicit";
  const looks = people.map((person) => {
    const look = [person.identityLine, bare ? "" : person.outfitLine].map((line) => line.trim()).filter(Boolean);
    const first = person.name.trim().split(/\s+/)[0] ?? "";
    return look.length ? sentence(`${first}: ${look.join("; ")}`) : "";
  });
  return finish(
    world,
    () => ({
      prompt: [
        style.styleText,
        sentence(input.brief),
        ...looks,
        mergeTags(input.framing ?? CG_FRAMING, required, style.positiveTags),
      ]
        .filter(Boolean)
        .join(" "),
      // One person: nobody else may appear. Two or more: the Engine's own "extra people" is left out on purpose.
      negativePrompt: mergeTags(CG_NEGATIVE, people.length <= 1 ? "extra people" : "", negative, style.negativeTags),
    }),
    required,
    negative,
    edited,
  );
}

// ── M5: a date's keepsake ──

const KEEPSAKE_FRAMING = "two people, romantic date, candid moment, cinematic composition, detailed background";

/** A person in the keepsake: who they are and what they wear (English, visual only), drawn as an adult. */
export type KeepsakePerson = CgPerson;
export type KeepsakeInput = Omit<CgInput, "framing" | "use" | "explicit">;

/**
 * A date's keepsake (S/minigames/date-night.ts): a CG of the two of them (the plan's English brief, each person's look,
 * then the rating and an adult tag for every person) with the keepsake's framing. A story CG whose brief never sets
 * `explicit` (the date planner writes no explicit brief), so it stays at most Suggestive. An edited prompt keeps its
 * wording with every safety tag put back.
 */
export function keepsakePrompt(input: KeepsakeInput, edited: Partial<ImagePrompt> = {}): ImagePrompt {
  return cgPrompt({ ...input, use: "cg", framing: KEEPSAKE_FRAMING }, edited);
}

export interface ExpressionInput {
  /** The love interest as stored: his name, identity and outfit lines, and his bible's presentation. */
  unit: Pick<Unit, "name" | "identityLine" | "outfitLine" | "portrait" | "outfits" | "bible">;
  /** The image the face is painted onto (his worn look, or his portrait). */
  base: string;
  face: Face;
  world: Pick<World, "content" | "images">;
  style: StyleProfile;
}

/**
 * An expression: the kit's edit instruction (change only the face, from SH/faces.ts FACE_LOOKS, as a sentence or as
 * tags for a tag profile), with the rating and adult tags appended and the safety negatives. A face is a clothed
 * portrait at any rating: it is the base of every Home cut-out and story reference after it.
 */
export function expressionPrompt(input: ExpressionInput): ImagePrompt {
  const { world, style, unit } = input;
  const presentation = unit.bible?.look.presentation ?? "person";
  const tagged = style.tagged === true;
  const required = otomeImageTags({ world, people: [{ name: unit.name, presentation }], use: "clothed", tagged });
  const { prompt } = forgeStoryExpressionPrompt(unit, input.base, input.face, style, { tagged, looks: FACE_LOOKS });
  return {
    // A tag profile gets the tags; an edit instruction gets them as its closing sentence.
    prompt: adultsOnly(world, tagged ? withTags(prompt, required) : [sentence(prompt), sentence(required)].join(" ")),
    negativePrompt: mergeTags(requiredNegative(world, "clothed"), style.negativeTags),
  };
}
