function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json|text)?\s*([\s\S]*?)\s*```$/iu);
  return match?.[1]?.trim() || trimmed;
}

// User-authored image guidance is meant to shape the picture, so a short entry — an "Image
// generation instructions" field reading `anime style` — appears verbatim in any prompt that honours
// it. Matching those rejected every correctly rewritten prompt and sent the styleless draft instead,
// so guidance only counts as leaked once it arrives as a copied prose block.
// ponytail: length floor, not a structural check. If guidance ever leaks as a short value, give the
// callers a labelled block and extend `hasInternalMarker` rather than lowering this.
const MIN_GUIDANCE_BLOCK_LENGTH = 40;

/**
 * A fallback prompt is the post's visual idea plus the character's appearance, not a context dump.
 * The rendered template leads with the draft and appearance and trails with softer guidance, so a
 * head-first cut keeps the parts that decide what the picture looks like.
 * ponytail: a flat character ceiling, not a token count. Swap in a tokenizer only if a provider
 * starts rejecting prompts that fit this.
 */
export const MAX_FALLBACK_IMAGE_PROMPT_LENGTH = 1_500;

/** Cut to the ceiling on a sentence, then a word boundary — a mid-word cut reads as a typo. */
const squash = (value: string) => value.replace(/\s+/gu, " ");

export function capFallbackImagePrompt(value: string, max = MAX_FALLBACK_IMAGE_PROMPT_LENGTH): string {
  if (value.length <= max) return value;
  const head = value.slice(0, max);
  const sentenceEnd = Math.max(
    head.lastIndexOf("."),
    head.lastIndexOf("!"),
    head.lastIndexOf("?"),
    head.lastIndexOf("\n"),
  );
  // Only honour a boundary in the last quarter, so a prompt with one early full stop is not
  // truncated down to that sentence.
  const floor = Math.floor(max * 0.75);
  if (sentenceEnd >= floor) return head.slice(0, sentenceEnd + 1).trim();
  const wordEnd = head.lastIndexOf(" ");
  return (wordEnd >= floor ? head.slice(0, wordEnd) : head).trim();
}

/**
 * Drop a leading field label from an appearance block.
 *
 * The resolver formats it as `<name>'s Appearance: ...`, and that string is concatenated straight
 * into the prompt the image provider receives. The rewrite is told in as many words never to copy
 * a label like `Appearance:` into an image prompt; the fallback path was sending one every time.
 */
export function stripAppearanceLabel(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[^\n:]{1,60}'s\s+)?(?:character\s+)?appearance(?:\s+notes)?\s*:\s*/iu, ""))
    .join("\n")
    .trim();
}

/**
 * The body and face from a character card's appearance, without its clothes.
 *
 * Card appearance paragraphs describe a wardrobe too — "favours pastel dresses … for cosplay she
 * wears a costume and carries a prop". Sent with every picture, the image model drew all of it,
 * often as a second person in the costume. Clothing now comes from the post's own scene, so the
 * clothes are dropped here: only the clothing part of a sentence (V, user), so "Her curvy figure looks
 * great in tight clothing" keeps "Her curvy figure looks great" and "red hair, green eyes and a black
 * hoodie" keeps the hair and eyes. A Creator's own Stage appearance is trusted as written.
 * ponytail: a keyword filter over sentences and clauses. If cards need finer handling, generate a look
 * once per Creator with a language model and store it as Stage appearance.
 */
const CLOTHING_SENTENCE =
  /\b(?:wear|wears|wearing|worn|dress|dresses|dressed|outfits?|cloth(?:es|ing)|fashion|favou?rs|cosplay|costumes?|accessor(?:y|ies)|carries|carrying|shoes|boots|jewel(?:ry|lery)|hoodies?|shirts?|skirts?|jeans|jackets?|gowns?|couture|heels|lingerie|bikinis?|sweaters?|uniforms?)\b/iu;
const MAX_LOOK_LENGTH = 600;
/** Where a sentence splits into clauses; the separator stays with the clause after it. */
const CLAUSE_BREAK = /(,\s*|;\s*|\s+(?:and|but|while)\s+|\s+[—–]\s+)/u;
/** What a kept clause of a clothing sentence must be about: the body, not a mood or a habit. */
const BODY_TRAIT =
  /\b(?:hair|eyes?|skin|face|figure|body|build|frame|legs?|arms?|hips?|waist|chest|breasts?|curves?|curvy|shoulders?|lips?|smile|teeth|nose|jaw|cheeks?|freckle[sd]?|scars?|tattoo(?:s|ed)?|piercings?|muscles?|muscular|abs|tall|short|petite|slim|slender|lean|thick|chubby|stocky|athletic|height|cm|feet|ft|ears?|tail|fur|horns?|wings?|scales?|complexion|tan(?:ned)?|pale)\b/iu;
/** "… looks great in tight clothing": the clothes come in a phrase at the end. */
const CLOTHES_PHRASE = /\s+(?:in|under|beneath)\s+(?:[\p{L}'-]+\s+){0,3}$/u;

/** A sentence without its clothing clauses: only its body traits, or "" when it has none. */
function withoutClothes(sentence: string): string {
  if (!CLOTHING_SENTENCE.test(sentence)) return sentence;
  const end = /[.!?]$/u.test(sentence) ? sentence.slice(-1) : ".";
  const parts = sentence.replace(/[.!?]$/u, "").split(CLAUSE_BREAK);
  let kept = "";
  for (let index = 0; index < parts.length; index += 2) {
    let clause = parts[index]!.trim();
    const hit = CLOTHING_SENTENCE.exec(clause);
    if (hit) {
      const phrase = CLOTHES_PHRASE.exec(clause.slice(0, hit.index));
      const before = phrase ? clause.slice(0, phrase.index).trim() : "";
      clause = before.split(/\s+/u).length >= 2 && !CLOTHING_SENTENCE.test(before) ? before : "";
    }
    if (!BODY_TRAIT.test(clause)) clause = "";
    if (clause) kept += kept ? `${parts[index - 1] ?? " "}${clause}` : clause;
  }
  return kept ? `${kept[0]!.toUpperCase()}${kept.slice(1)}${end}` : "";
}

/** Words that already say who is drawn; the look then needs no "Male." or "Female." of its own. */
const SEX_WORD =
  /\b(?:male|female|man|woman|men|women|boy|girl|guy|lady|gentleman|femboy|tomboy|futa\w*|trans(?:gender|woman|man|girl|guy)?|androgynous|non-binary|nonbinary|enby|1girl|1boy|he|she|his|her|him)\b/iu;

/**
 * "Male." or "Female." in front of a look that does not say it (user, 2026-10-14): without it an
 * image model mostly draws a woman, whatever the page's gender. Other, no gender, or an empty look:
 * as written.
 */
export function slurpImageSexWord(appearance: string, gender: string | null | undefined): string {
  if (!appearance.trim() || (gender !== "male" && gender !== "female") || SEX_WORD.test(appearance)) return appearance;
  // The label goes first, or "Male. Appearance: …" keeps a label stripAppearanceLabel cannot reach.
  return `${gender === "male" ? "Male" : "Female"}. ${stripAppearanceLabel(appearance)}`;
}

export function slurpImageLook(appearance: string): string {
  const text = stripAppearanceLabel(appearance).replace(/\s+/gu, " ").trim();
  if (!text) return "";
  const kept = text
    .split(/(?<=[.!?])\s+/u)
    .map(withoutClothes)
    .filter(Boolean)
    .join(" ");
  const look = kept || text;
  return look.length <= MAX_LOOK_LENGTH ? look : `${look.slice(0, look.lastIndexOf(" ", MAX_LOOK_LENGTH))}`;
}

/**
 * The art style a Creator is drawn in, read from their look and image habits. `null` means a photo.
 *
 * The picture brief is written as a photograph (camera source, "personal photograph", "available
 * light", "unedited"), which is right for a Creator who is a real-looking person. For an anime,
 * furry or dragon Creator the simulation counted three to five photo terms per prompt against one
 * style phrase, and image models drew a cosplayer or a fursuit. A stylised Creator now leads with
 * their medium and loses the photo-only words; a photo-style Creator is unchanged.
 * ponytail: keyword match on the look. Upgrade to an "Art style" stage field if cards need more.
 */
const ART_STYLES: readonly { tag: string; negative: string; pattern: RegExp }[] = [
  {
    tag: "anime illustration, cel-shaded, 2D",
    negative: "photograph, photorealistic, cosplay",
    pattern: /\b(?:anime|manga|shoujo|shojo|shonen|shounen|cel[- ]shaded|chibi|visual novel)\b/iu,
  },
  {
    tag: "anthro furry art, digital illustration",
    negative: "photograph, photorealistic, fursuit, costume, mask",
    pattern:
      /\b(?:anthro(?:pomorphic)?|furry|fursona|scalie|kemono|digitigrade|dragon(?:ess|kin|born)?|wyvern|kobold|werewolf|werewolves|lizardfolk)\b(?![- ](?:tattoo|print|pattern|motif|earrings?|necklace|pendant|shirt|hoodie|plush))/iu,
  },
  {
    tag: "digital illustration",
    negative: "photograph, photorealistic",
    pattern:
      /\b(?:illustrat(?:ed|ion)|drawn (?:in|as|like)|cartoon(?:ish|y)?|comic(?:[- ]book)? style|painterly|pixel art|3d render(?:ed)?|cgi)\b/iu,
  },
];
const PHOTO_STYLE =
  /\b(?:photo[- ]?real(?:istic)?|photograph(?:ic|ed)?|realistic (?:style|render|photo)|real[- ]life|live[- ]action)\b/iu;

export function slurpArtStyle(look: string): { tag: string; negative: string } | null {
  if (!look.trim() || PHOTO_STYLE.test(look)) return null;
  const found = ART_STYLES.filter((style) => style.pattern.test(look));
  if (found.length === 0) return null;
  // "Drawn in anime style" matches the generic illustration too; the specific medium says it already.
  const matched = found.length > 1 ? found.filter((style) => style !== ART_STYLES.at(-1)) : found;
  return {
    tag: matched.map((style) => style.tag).join(", "),
    negative: [...new Set(matched.flatMap((style) => style.negative.split(", ")))].join(", "),
  };
}

// The photo words Slurp itself writes into a brief (`slp-camera-source.ts`, `slp-production-profile.ts`,
// `slp-image-brief.ts`), each with the neutral words a drawn picture keeps.
const PHOTO_ONLY_WORDS: readonly [RegExp, string][] = [
  [/\b(?:(?:observational|carefully composed|deliberately staged)\s+)?personal (?:photograph|snapshot)\b,?\s*/giu, ""],
  [/\b(?:ordinary )?available light\b/giu, "natural light"],
  [/\bself-timer photo\b/giu, "shot"],
  [/\bstill frame from a video, slight motion blur, soft focus\b/giu, "caught mid-motion"],
  [/\bolder snapshot from their own archive, slightly dated look\b/giu, "an older picture of theirs"],
  [/\bfaded older snapshot, slightly dated colours\b/giu, "an older picture of theirs"],
  [/\bcasual and unedited\b/giu, "casual"],
  [/\bphoto(?:graph)?s?\b/giu, "picture"],
];

/** The prompt in the Creator's medium: their style leads, Slurp's photo words go (see `slurpArtStyle`). */
export function slurpStyledImagePrompt(prompt: string, look: string): string {
  const style = slurpArtStyle(look);
  if (!style) return prompt;
  let styled = prompt;
  for (const [pattern, replacement] of PHOTO_ONLY_WORDS) styled = styled.replace(pattern, replacement);
  styled = styled
    .replace(/\bunedited\b,?\s*/giu, "")
    .replace(/,\s*(?=[,;.]|$)/gmu, "")
    .replace(/[ \t]{2,}/gu, " ");
  return styled.toLocaleLowerCase().startsWith(style.tag.toLocaleLowerCase()) ? styled : `${style.tag}\n${styled}`;
}

/**
 * The words of a trait that carry its meaning: lower case, 3+ letters or any number, without the
 * glue words every sentence shares. "Stands about 165 cm" → stands, 165.
 */
const TRAIT_STOP_WORDS = new Set(
  "the and with has have her his their its she he they them who that this from into are was were been about very also often usually slightly".split(
    " ",
  ),
);
function traitWords(value: string): string[] {
  return (value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (word) => (word.length >= 3 || /\d/u.test(word)) && !TRAIT_STOP_WORDS.has(word),
  );
}
// A trait whose words are mostly in the prompt already is there, reworded. 0.6: the rewrite keeps
// the nouns and drops the filler ("on the chubbier side with soft curves she's learned to love").
const TRAIT_PRESENT_SHARE = 0.6;

/**
 * Keep identity in the provider request even when review or rewrite replaces the draft.
 *
 * Only the traits the prompt does not already carry are added, each once. The whole look used to
 * go in front whenever the prompt did not contain it word for word — and a rewrite rewords it, the
 * fallback template holds the unfiltered Stage text — so 88 of 102 prod pictures (2026-09-28) sent
 * the appearance twice.
 */
export function ensureSlpImageAppearance(prompt: string, appearance: string): string {
  const look = slurpImageLook(appearance);
  if (!look) return prompt;
  const promptWords = new Set(traitWords(prompt));
  // Stems, so "curves"/"curvy" or "freckles"/"freckled" count as the same trait word.
  const stem = (word: string) => word.slice(0, 4);
  const stems = new Set([...promptWords].map(stem));
  const missing = look.split(/(?<=[.!?])\s+/u).filter((sentence) => {
    const words = traitWords(sentence);
    if (words.length === 0) return false;
    const present = words.filter((word) => promptWords.has(word) || stems.has(stem(word))).length;
    return present / words.length < TRAIT_PRESENT_SHARE;
  });
  return missing.length ? `${missing.join(" ")}\n${prompt}` : prompt;
}

/**
 * The character's name at the head of a picture prompt (0.3.5, player report): an image model that
 * learned a known character draws them from the name far better than from any appearance text, and
 * no scene field carried it, so every picture came out as a stranger with the same hair. Only when
 * the Creator's "The image model knows this character" switch is on and the identity is open.
 */
export function slurpApplyImageSubject(prompt: string, name: string, family: SlurpPromptFamily = "natural"): string {
  const who = name.replace(/\s+/gu, " ").trim();
  if (!who) return prompt;
  // A name tag behind other tags (the look Slurp inserted, a writer's line) moves to the front, once
  // (0.3.47, player report and review).
  const [rest, written] = slurpWithoutImageSubject(prompt, who, family);
  if (rest !== prompt) return [written.toLocaleLowerCase(), rest].filter(Boolean).join(", ");
  // Danbooru-style Appearance fields write the name as a tag ("asuka_langley_soryu", "\(eva\)"):
  // that counts as present too, so a tag prompt never gets the name twice (player report 0.3.5),
  // and so does the family name first ("ryuuzaki umi" for "Umi Ryuuzaki", 0.3.47).
  if (plainTag(prompt).includes(plainTag(who)) || slurpImageNamesPerson(prompt, [who])) return prompt;
  return family === "natural" ? `${who}\n${prompt}` : `${who.toLocaleLowerCase()}, ${prompt}`;
}

const plainTag = (text: string) =>
  text
    .toLocaleLowerCase()
    .replace(/\\([()])/gu, "$1")
    .replace(/[_\s]+/gu, " ")
    .trim();

/**
 * A tag prompt without the name's own tags, and the name as the prompt spelled it, so
 * `slurpApplyImageSubject` puts it in front (0.3.47, player report): the writer wrote "1girl, blue
 * hair, ryuuzaki umi, magic knight rayearth", the name and "Always in their pictures" counted as
 * present, and the identity tags stayed behind the body tags. A tag in another word order
 * ("ryuuzaki umi" for the card's "Umi Ryuuzaki") keeps the writer's order, the one a tag model
 * learned. Only whole tags move; a name inside a longer tag, a weight group or a sentence, and natural
 * prompts, stay.
 */
export function slurpWithoutImageSubject(
  prompt: string,
  name: string,
  family: SlurpPromptFamily,
): [prompt: string, name: string] {
  const wanted = name
    .split(",")
    .map((tag) => tag.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  if (family === "natural" || wanted.length === 0) return [prompt, name];
  const keys = new Set(wanted.map(nameKey));
  const written = new Map<string, string>();
  const lines = prompt.split("\n").map((line) => {
    const parts = line.split(",");
    const kept = parts.filter((part) => {
      const tag = part.trim().replace(/[.;]+$/u, "");
      const key = nameKey(tag);
      // A tag inside a weight group ("(1girl, umi)") stays: moving it would break the brackets.
      if (!keys.has(key) || /[()[\]{}]/u.test(tag.replace(/\\[()]/gu, ""))) return true;
      if (!written.has(key)) written.set(key, tag);
      return false;
    });
    return kept.length === parts.length
      ? line
      : kept
          .map((part) => part.trim())
          .filter(Boolean)
          .join(", ") || null;
  });
  if (written.size === 0) return [prompt, name];
  return [
    // Only a line the move emptied goes; the prompt's own blank lines stay, so it still ends the same.
    lines.filter((line) => line !== null).join("\n"),
    wanted.map((tag) => written.get(nameKey(tag)) ?? tag).join(", "),
  ];
}

const nameWords = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
const nameKey = (text: string) => nameWords(text).sort().join(" ");

/**
 * Whether a picture prompt names a person (0.3.47, player report): a tag prompt writes the card name
 * as a tag, often family name first ("ryuuzaki_umi" for "Umi Ryuuzaki"), so a plain substring check
 * missed a companion the writer did put in the picture. Whole words, in any order, next to each other
 * inside one tag or line: "summer, rain" is not "Summer Rain".
 */
export function slurpImageNamesPerson(prompt: string, names: readonly string[]): boolean {
  const tags = prompt.split(/[,;|\n]/u).map(nameWords);
  return names.some((name) => {
    const want = nameKey(name);
    const size = want ? want.split(" ").length : 0;
    if (!size) return false;
    return tags.some((tag) => {
      for (let start = 0; start + size <= tag.length; start++) {
        if (
          tag
            .slice(start, start + size)
            .sort()
            .join(" ") === want
        )
          return true;
      }
      return false;
    });
  });
}

/**
 * A final prompt cut behind its style lead (0.3.23, player report): the style profile's tags open
 * the compiled prompt, and the name and the look belong after them, in front of the scene. A name
 * ahead of the style tags read as style, and in a picture of two people the model mixed their
 * features. `lead` is the same profile compiled around an empty prompt; a prompt that no longer
 * starts with it (a reviewed prompt, a style part the device filter removed) has no lead.
 */
export function slurpSplitStyleLead(prompt: string, lead: string): [lead: string, scene: string] {
  const style = lead.trim();
  if (!style || !prompt.startsWith(style)) return ["", prompt];
  const gap = /^[ \t]*[,;.\n][\s,;.]*/u.exec(prompt.slice(style.length))?.[0];
  return gap ? [style + gap, prompt.slice(style.length + gap.length)] : ["", prompt];
}

/**
 * The name the picture leads with: the post writer's tagged name ("fubuki (one punch man)", player
 * report 0.3.5) when it names the same character as the card or the page, else the card name. A
 * writer's name for somebody else (a partner, another series) is never used.
 */
export function slurpImageSubjectName(knownAs: string | null | undefined, names: readonly string[]): string {
  const written = knownAs?.replace(/\s+/gu, " ").trim() ?? "";
  const words = (text: string) =>
    text
      .toLocaleLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3);
  const own = new Set(names.flatMap(words));
  return written && written.length <= 120 && words(written).some((word) => own.has(word))
    ? written
    : (names[0]?.trim() ?? "");
}

/**
 * Who the character is, for the enhancer only: the name and the start of their card, as context it
 * must not copy. The image model still gets only visible facts.
 */
export function slurpImageIdentityContext(name: string, cardDescription: string): string {
  const who = name.trim();
  const about = cardDescription.replace(/\s+/gu, " ").trim();
  const cut =
    about.length > 400
      ? `${
          about
            .slice(0, 400)
            .replace(/[^.!?]*$/u, "")
            .trim() || about.slice(0, 400)
        }`
      : about;
  return [who ? `Who this is: ${who}` : "", cut ? `From their card (context, do not copy): ${cut}` : ""]
    .filter(Boolean)
    .join("\n");
}

/**
 * How Slurp adds the Creator's look to a picture prompt (`imageAppearanceMode`, player report on
 * 0.2.41): one setting used to both hand the look to the prompt writer and insert it again, so a
 * look the writer had already worded was added a second time.
 * - `writer`: only the prompt writer gets it and words it into the scene (default).
 * - `insert`: the writer does not see it; Slurp inserts it into the final prompt.
 * - `both`: the writer gets it, and Slurp adds the traits the writer missed.
 */
export type SlurpImageAppearanceMode = "writer" | "insert" | "both";
export const SLURP_IMAGE_APPEARANCE_MODES = ["writer", "insert", "both"] as const;

/** Whether the prompt writer gets the look as context. */
export const slurpLookForWriter = (mode: SlurpImageAppearanceMode): boolean => mode !== "insert";

/**
 * The look in the final prompt. A prompt the writer did not produce (enhance off, a failed or
 * rejected rewrite, a reviewed prompt) always gets the missing traits, or nobody would be drawn;
 * only a used rewrite in `writer` mode is sent as written. A trait is never added twice.
 */
export function slurpApplyImageLook(
  prompt: string,
  look: string,
  mode: SlurpImageAppearanceMode,
  usedRewrite: boolean,
): string {
  return mode === "writer" && usedRewrite ? prompt : ensureSlpImageAppearance(prompt, look);
}

/**
 * One block per other person the scene names (0.3.24, player report): their look reached only the
 * enhancer, so without it a collab picture had a second person with no look, and the image model
 * gave them the Creator's features. Each gets a labelled look, to go in front of the scene; a tag model
 * gets their known name as a tag, since it reads no labels. The look follows the Creator's rule
 * (`slurpApplyImageLook`): none after a used rewrite in `writer` mode, the missing traits after any
 * other used rewrite, all of it when no rewrite was used. `own` is the Creator's own block: a
 * companion page of the same character is not tagged a second time.
 */
export function slurpImageCompanionBlocks(
  prompt: string,
  companions: readonly { name: string; known: string; look: string }[],
  family: SlurpPromptFamily,
  mode: SlurpImageAppearanceMode,
  usedRewrite: boolean,
  own = "",
): string {
  const has = (text: string, part: string) => text.toLocaleLowerCase().includes(part.toLocaleLowerCase());
  const blocks = companions
    .filter((companion) => slurpImageNamesPerson(prompt, [companion.name, companion.known]))
    .map(({ name, known, look }) => {
      // ponytail: after a rewrite, a trait the Creator shares ("blue eyes") counts as present for
      // the companion too. Match traits per person if rewritten collab pictures still mix them.
      const added = usedRewrite ? ensureSlpImageAppearance(prompt, look) : `${slurpImageLook(look)}\n${prompt}`;
      const traits = usedRewrite && mode === "writer" ? "" : added.slice(0, added.length - prompt.length).trim();
      if (family !== "natural") {
        const tag = known && !slurpImageNamesPerson(own + prompt, [known]) ? known.toLocaleLowerCase() : "";
        return [tag, traits].filter(Boolean).join(", ");
      }
      const label = has(known, name) ? known : has(name, known) ? name : `${name} (${known})`;
      return traits ? `${label}: ${traits}` : "";
    })
    .filter(Boolean);
  return blocks.length ? `${blocks.join("\n")}\n` : "";
}

/**
 * The device, as words. The post writer kept putting "phone held at arm's length" into the scene
 * even when the camera was a tripod, and the image model drew a phone in 37 of 46 pictures on prod
 * (0.2.74). The camera choice already decides how the picture was taken; the picture itself must
 * not show the device. `headphones`, `microphone` and `camera-shy` do not match.
 *
 * The arm is no longer stripped (PERSPECTIVE-RESEARCH.md): "selfie" and "arm extended toward the
 * viewer" are the only cues that make a weak model draw a selfie without a phone in the hand.
 */
const CAMERA_DEVICE_WORDS =
  /\b(?:smart|cell ?|i)?phones?\b|\bselfie[- ]sticks?\b|\bcameras?\b(?!-shy)|\btripods?\b|\bwebcams?\b|\bphotographers?\b|\bself-timer\b|\b(?:shot on|taken with)\b/iu;
/** How the picture was taken, for text that should say only what it showed (post history). */
const HOW_TAKEN_WORDS = new RegExp(
  `${CAMERA_DEVICE_WORDS.source}|\\bselfies?\\b|\\barm'?s[- ]length\\b|\\b(?:outstretched|extended|raised) arm\\b|\\barm (?:outstretched|extended|held out)\\b`,
  "iu",
);
// "Looking at the camera" is a gaze, not a device: say the viewer, or the whole clause would go.
const GAZE_AT_CAMERA = /\b(into|at|to|toward|towards|facing|teasing|for) the (?:camera|lens)\b/giu;

function withoutParts(prompt: string, pattern: RegExp, keep: readonly string[]): string {
  const kept = keep.filter(Boolean);
  const hide = (text: string) =>
    kept.reduce((value, phrase, index) => value.split(phrase).join(`\u0000${index}\u0000`), text);
  const show = (text: string) => text.replace(/\u0000(\d+)\u0000/gu, (_, index: string) => kept[Number(index)]!);
  return hide(prompt.replace(GAZE_AT_CAMERA, "$1 the viewer"))
    .split("\n")
    .map((line) =>
      line
        .split(/(?<=[,;.])\s+/u)
        .filter((part) => !pattern.test(part))
        .join(" ")
        .replace(/[,;]\s*$/u, ".")
        .trim(),
    )
    .filter(Boolean)
    .map(show)
    .join("\n");
}

/**
 * A picture prompt without the camera device: every comma, semicolon, or sentence part that names
 * a phone, a camera, a tripod or a photographer is removed, and the rest is kept as it was. A line
 * that was only about the device disappears. `keep` holds Slurp's own viewpoint phrase, which is
 * never cut (a mirror selfie holds the phone on purpose).
 */
export function slurpWithoutCameraDevice(prompt: string, keep: readonly string[] = []): string {
  return withoutParts(prompt, CAMERA_DEVICE_WORDS, keep);
}

/** What a picture showed, without how it was taken, so a history does not teach the same shot again. */
export function slurpPictureSubject(prompt: string): string {
  return withoutParts(prompt, HOW_TAKEN_WORDS, []);
}

/**
 * Which viewpoint words the image model understands (PERSPECTIVE-RESEARCH.md §6). The Engine style
 * profile's prompt mode decides; a hybrid profile falls back to the service and model name.
 * ComfyUI hides its checkpoint in the workflow, so there the style profile is the player's knob.
 */
export type SlurpPromptFamily = "tags" | "e621" | "natural";

const TAG_MODEL = /pony|illustrious|noob|animagine|novelai|\bnai\b|autismmix|anything|counterfeit/iu;

export function slurpPromptFamily(input: {
  promptMode?: string | null;
  service?: string | null;
  model?: string | null;
  /** The Creator is drawn as anthro/furry: tag models get e621 spellings. */
  furry?: boolean;
}): SlurpPromptFamily {
  const tags =
    input.promptMode === "tagged" ||
    input.promptMode === "danbooru" ||
    (input.promptMode !== "natural" && (input.service === "novelai" || TAG_MODEL.test(input.model ?? "")));
  return tags ? (input.furry ? "e621" : "tags") : "natural";
}

/** Old post drafts were rule prose for a language model. They describe no picture and must not be reused. */
export function slurpIsLegacyImageBrief(value: string | null | undefined): boolean {
  return /^One photograph this person took/u.test(value?.trim() ?? "");
}

/** Select only the visual prompt that can be sent to an image provider. */
export function selectSlpImageProviderPrompt(input: {
  rewrittenPrompt: string | null | undefined;
  rawPrompt: string;
  /** Visual facts that must survive a capped fallback when the rewrite is unavailable. */
  fallbackPrefix?: string;
  /** The post's own scene. When the fallback overflows the cap it leads, so the look cannot push it out. */
  fallbackScene?: string;
  /** Never belongs in a visual prompt at any length, so it is matched whole. */
  privateContext?: ReadonlyArray<string | null | undefined>;
  /** Authored to steer the image, so only a copied block counts as a leak. */
  guidanceContext?: ReadonlyArray<string | null | undefined>;
  /** The rewrite was expected to run, so an empty result is a fallback rather than a deliberate skip. */
  rewriteAttempted?: boolean;
  /** Why the attempted rewrite gave no prompt (from `rewriteSlpImagePrompt`'s `onFailure`). */
  rewriteFailure?: string | null;
  /** Called with the reason whenever an attempted or rejected rewrite falls back to the draft. */
  onFallback?: (reason: string) => void;
}): string {
  const fallback = (reason: string) => {
    input.onFallback?.(reason);
    const prefix = input.fallbackPrefix?.trim() ?? "";
    const full = [prefix && !squash(input.rawPrompt).includes(squash(prefix)) ? prefix : "", input.rawPrompt]
      .filter(Boolean)
      .join("\n\n");
    if (full.length <= MAX_FALLBACK_IMAGE_PROMPT_LENGTH || (!prefix && !input.fallbackScene)) {
      return capFallbackImagePrompt(full);
    }
    // Over the cap a long look led and used all of it, so the picture was an appearance and no
    // scene. The look keeps a bounded share and the scene gets the rest.
    const head = capFallbackImagePrompt(prefix, 900);
    const scene = capFallbackImagePrompt(
      input.fallbackScene?.trim() || input.rawPrompt,
      MAX_FALLBACK_IMAGE_PROMPT_LENGTH - head.length - 2,
    );
    return [head, scene].filter(Boolean).join("\n\n");
  };
  const rewrittenPrompt = input.rewrittenPrompt?.trim();
  if (!rewrittenPrompt) {
    return input.rewriteAttempted
      ? fallback(
          input.rewriteFailure || "the rewrite did not run or returned nothing (check the agent text connection)",
        )
      : input.rawPrompt;
  }

  const normalizedPrompt = rewrittenPrompt.toLocaleLowerCase().replace(/\s+/gu, " ");
  const hasInternalMarker =
    /(?:^|[\n<])\s*(?:user[ _]image[ _]instructions|image[ _]prompting[ _]instructions|generation[ _]guidance|personality|character[ _]image[ _]preferences|character[ _]context|art[ _]style[ _]guidance|post[ _]text)\s*[:>]/iu.test(
      rewrittenPrompt,
    );
  const copies = (values: ReadonlyArray<string | null | undefined> | undefined, minLength: number) =>
    values?.some((value) => {
      const normalizedValue = value?.trim().toLocaleLowerCase().replace(/\s+/gu, " ");
      return normalizedValue && normalizedValue.length >= minLength && normalizedPrompt.includes(normalizedValue);
    });

  const copiesPrivateContext = copies(input.privateContext, 2);
  const copiesGuidance = copies(input.guidanceContext, MIN_GUIDANCE_BLOCK_LENGTH);

  if (hasInternalMarker) return fallback("the rewrite contained an internal prompt label");
  if (copiesPrivateContext) return fallback("the rewrite copied private character context");
  if (copiesGuidance) return fallback("the rewrite copied an image guidance block");
  return rewrittenPrompt;
}

/**
 * Recover the visual idea when a weaker timeline model wraps imagePrompt in
 * JSON or repeats Marinara's legacy prompt-assembly labels inside the field.
 */
export function normalizeSlpImagePrompt(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const candidate = stripCodeFence(value);

  if (candidate.startsWith("{")) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      for (const key of ["imagePrompt", "image_prompt", "prompt", "draftPrompt"]) {
        const nested = parsed[key];
        if (typeof nested === "string" && nested.trim() && nested.trim() !== candidate) {
          return normalizeSlpImagePrompt(nested);
        }
      }
      return null;
    } catch {
      // Keep the original text when it only happens to begin with a brace.
    }
  }

  const legacyMarker = /(?:^|\n)\s*(?:draft image idea|image prompt)\s*:\s*/iu.exec(candidate);
  if (legacyMarker?.index !== undefined) {
    const visualStart = legacyMarker.index + legacyMarker[0].length;
    const visualTail = candidate.slice(visualStart);
    const nextMetadata = visualTail.search(
      /\n\s*(?:user instructions|character appearance notes|post text|output only)\s*:/iu,
    );
    const recovered = (nextMetadata >= 0 ? visualTail.slice(0, nextMetadata) : visualTail).trim();
    if (recovered) return recovered;
  }

  return candidate;
}

/**
 * A short description of a post's attached image, for prompts that generate reactions to it.
 *
 * A generated image already carries the prompt that produced it, which describes the picture
 * better than a caption model would and costs nothing to reuse. An uploaded image has no prompt,
 * so it is announced as present but undescribed — a reader who knows an image exists writes
 * "cute pic" rather than "what pic?", which was the whole failure.
 *
 * Returns `null` when the post has no image, so callers can spread it away.
 */
export function slpImageContext(post: { imageUrl?: string | null; imagePrompt?: string | null }): string | null {
  if (!post.imageUrl) return null;
  const prompt = post.imagePrompt?.trim();
  return prompt ? `The post has an attached image showing: ${prompt}` : "The post has an attached image.";
}
