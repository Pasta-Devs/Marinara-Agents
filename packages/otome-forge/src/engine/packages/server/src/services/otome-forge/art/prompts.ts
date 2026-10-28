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
// M5 adds a date's keepsake: a CG of the two of them with the keepsake's own framing.
import { forgeStoryExpressionPrompt } from "@forge-kit/story-expressions-server.mjs";
import type { Presentation, Unit, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import type { ImageRating } from "../../../../../client/src/features/otome-forge/shared/content.js";
import { FACE_LOOKS, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { otomeContentContract } from "../content-contract.js";
import type { StyleProfile } from "./image-client.js";

/** A look's size: a full-body portrait. */
export const LOOK_SIZE = { width: 832, height: 1216 } as const;
/** CGs and places (M2b). */
export const SCENE_SIZE = { width: 768, height: 1344 } as const;

export const LOOK_FRAMING = "full body, standing, neutral pose, plain flat mid-grey background";
const LOOK_NEGATIVE =
  "text, captions, logos, watermarks, borders, UI, collage layouts, duplicate faces, extra people, cropped-off heads, cropped feet, busy background, scenery";
/** Kept on every image, whatever the player edits. */
const ADULT_NEGATIVE = "child, childlike, minor, underage, school uniform";
const RATING_NEGATIVE: Record<ImageRating, string> = {
  sfw: "nudity, nsfw, sexual content, lingerie",
  suggestive: "explicit nudity, sex",
  explicit: "",
};

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
  const required = otomeContentContract({
    world,
    lis: [{ name: input.name, presentation: input.presentation }],
    kind: "image",
  });
  const requiredNegative = mergeTags(ADULT_NEGATIVE, RATING_NEGATIVE[world.images.rating]);
  const prompt = edited.prompt?.trim()
    ? withTags(edited.prompt, required)
    : [style.styleText, mergeTags(input.identityLine, input.outfitLine, LOOK_FRAMING, required, style.positiveTags)]
        .filter(Boolean)
        .join(", ");
  const negativePrompt = edited.negativePrompt?.trim()
    ? withTags(edited.negativePrompt, requiredNegative)
    : mergeTags(LOOK_NEGATIVE, requiredNegative, style.negativeTags);
  return { prompt, negativePrompt };
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

/** The negative prompt every image keeps: adults only and the rating's exclusions, then the kind's own. */
function safeNegative(world: Pick<World, "images">, ...parts: string[]): string {
  return mergeTags(...parts, ADULT_NEGATIVE, RATING_NEGATIVE[world.images.rating]);
}

/** An edited prompt keeps its wording with every required tag put back; otherwise `built()`. */
function finish(
  built: () => ImagePrompt,
  required: string,
  requiredNegative: string,
  edited: Partial<ImagePrompt>,
): ImagePrompt {
  const fresh = edited.prompt?.trim() && edited.negativePrompt?.trim() ? null : built();
  return {
    prompt: edited.prompt?.trim() ? withTags(edited.prompt, required) : fresh!.prompt,
    negativePrompt: edited.negativePrompt?.trim()
      ? withTags(edited.negativePrompt, requiredNegative)
      : fresh!.negativePrompt,
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
  const required = otomeContentContract({ world, lis: [], kind: "image" });
  const requiredNegative = safeNegative(world);
  return finish(
    () => ({
      prompt: [style.styleText, mergeTags(input.tags, PLACE_FRAMING, required, style.positiveTags)]
        .filter(Boolean)
        .join(", "),
      negativePrompt: mergeTags(PLACE_NEGATIVE, requiredNegative, style.negativeTags),
    }),
    required,
    requiredNegative,
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
  /** The shot's framing tags; CG_FRAMING by default (a keepsake has its own). */
  framing?: string;
}

/** A story CG: the brief, each person's look, then the framing, rating and adult tags for every person. */
export function cgPrompt(input: CgInput, edited: Partial<ImagePrompt> = {}): ImagePrompt {
  const { world, style } = input;
  const people = input.people.slice(0, CG_PEOPLE_MAX);
  const required = otomeContentContract({ world, lis: people, kind: "image" });
  const requiredNegative = safeNegative(world);
  const looks = people.map((person) => {
    const look = [person.identityLine, person.outfitLine].map((line) => line.trim()).filter(Boolean);
    const first = person.name.trim().split(/\s+/)[0] ?? "";
    return look.length ? sentence(`${first}: ${look.join("; ")}`) : "";
  });
  return finish(
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
      negativePrompt: mergeTags(
        CG_NEGATIVE,
        people.length <= 1 ? "extra people" : "",
        requiredNegative,
        style.negativeTags,
      ),
    }),
    required,
    requiredNegative,
    edited,
  );
}

// ── M5: a date's keepsake ──

const KEEPSAKE_FRAMING = "two people, romantic date, candid moment, cinematic composition, detailed background";

/** A person in the keepsake: who they are and what they wear (English, visual only), drawn as an adult. */
export type KeepsakePerson = CgPerson;
export type KeepsakeInput = Omit<CgInput, "framing">;

/**
 * A date's keepsake (S/minigames/date-night.ts): a CG of the two of them (the plan's English brief, each person's look,
 * then the rating and an adult tag for every person) with the keepsake's framing. An edited prompt keeps its wording
 * with every safety tag put back.
 */
export function keepsakePrompt(input: KeepsakeInput, edited: Partial<ImagePrompt> = {}): ImagePrompt {
  return cgPrompt({ ...input, framing: KEEPSAKE_FRAMING }, edited);
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
 * tags for a tag profile), with the rating and adult tags appended and the safety negatives.
 */
export function expressionPrompt(input: ExpressionInput): ImagePrompt {
  const { world, style, unit } = input;
  const presentation = unit.bible?.look.presentation ?? "person";
  const required = otomeContentContract({ world, lis: [{ name: unit.name, presentation }], kind: "image" });
  const { prompt } = forgeStoryExpressionPrompt(unit, input.base, input.face, style, {
    tagged: style.tagged === true,
    looks: FACE_LOOKS,
  });
  return {
    // A tag profile gets the tags; an edit instruction gets them as its closing sentence.
    prompt: style.tagged ? withTags(prompt, required) : [sentence(prompt), sentence(required)].join(" "),
    negativePrompt: mergeTags(safeNegative(world), style.negativeTags),
  };
}
