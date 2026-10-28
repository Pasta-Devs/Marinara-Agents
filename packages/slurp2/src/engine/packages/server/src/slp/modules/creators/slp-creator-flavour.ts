/**
 * The flavour brief: who this Creator is and how they sound, compiled by code before a post,
 * Story, DM, comment reply or hand-over note goes to the model.
 *
 * Pure. The callers read the card, the anchors, their own past lines and the player's steering;
 * this decides what the model hears.
 *
 * ## The problem
 *
 * Every request carried the same labelled card dump ("Description: … Personality: …"), so the
 * model grabbed the same few traits every time, never saw how the person actually talks (the
 * card's example dialogue was never read), and nothing told a Creator they had opened five posts
 * in a row with the same two words. Different Creators converged; one Creator repeated itself.
 *
 * ## The approach
 *
 * A short core (who they are), the few facts that must always hold (the anchors' essentials: how
 * they communicate, their senses and body, firm limits), and a varied handful of true details from
 * the card, the canon anchors and their own past lines, drawn per request. The essentials are in
 * every brief; only the details rotate. Consecutive requests never share a detail:
 * every detail belongs to one of two alternating halves. One real line of theirs shows the voice.
 * A phrase they overuse is allowed now and then and called out the rest of the time. The player's
 * steering (focus, life phase, mood, topics) is always there, in plain words. No labels, no JSON.
 */

import type { SlpCreatorSteering, SlpSteeringMood } from "../../../../../shared/src/slp/slp-creator-steering.js";
import type { SlpDeepDetailsFlavour } from "../../../../../shared/src/slp/slp-deep-details.js";
import type { SlurpCanonAnchors } from "../feed/slp-post-beat.js";
import { slurpWeightedPick } from "../feed/slp-weighted.js";
import { SLURP_NEVER_PATTERN } from "../feed/slp-life-moments.js";
import { SLP_BODY_WORDS } from "./slp-appearance-profile.js";

export type SlurpFlavourUse = "post" | "story" | "dm" | "comment" | "delivery";

export type SlurpFlavourCard = {
  description?: string;
  personality?: string;
  backstory?: string;
  mes_example?: string;
  first_mes?: string;
  alternate_greetings?: readonly string[];
};

/** A plain sentence another Agent knows about them (see `slp-agent-memory-source.ts`). */
export type SlurpLatelyLine = { kind: "memory" | "mood" | "outfit" | "look" | "stat" | "weather"; text: string };

export type SlurpFlavourSource = {
  accountId: string;
  /** The name `{{char}}` resolves to. */
  name: string;
  card: SlurpFlavourCard;
  anchors?: SlurpCanonAnchors | null;
  /** Their own past captions or chat lines, newest first. Callers leave out anything paid. */
  ownLines?: readonly string[];
  steering?: SlpCreatorSteering | null;
  /** What the player's other Agents know, already in plain sentences. Optional (a setting). */
  lately?: readonly SlurpLatelyLine[];
  /** How spicy they are and what they will never do, already plain sentences (`slurpSpiceBriefLines`). */
  spice?: readonly string[];
  /** Their love life with another Creator (7b-couples), one plain sentence (`slurpRelationshipLine`). */
  relationship?: string;
};

export type SlurpFlavourBrief = {
  text: string;
  /** Keys of the details used, for tests and deep details. */
  bits: string[];
  sample: string | null;
  /** The same brief as parts, for Deep details. */
  shaped: SlpDeepDetailsFlavour;
};

/** `value` is the bare anchor ("Jonas (brother)") where `text` wraps it in a lead-in for the prompt. */
type Bit = { key: string; kind: string; text: string; value?: string };

/** Details per request, by use. A hand-over note is two sentences; a post can carry more colour. */
const BITS_PER_USE: Record<SlurpFlavourUse, number> = { post: 4, story: 3, dm: 3, comment: 2, delivery: 2 };
const CORE_DESCRIPTION_MAX = 360;
const CORE_PERSONALITY_MAX = 240;
const SENTENCE_MAX = 220;
/** A body sentence is kept whole up to this; past it the card is a wall of text, not a sentence. */
const BODY_SENTENCE_MAX = 900;
const SAMPLE_MIN = 12;
const SAMPLE_MAX = 170;
/** Own lines this recent are already in the prompt's history; samples come from further back. */
const SAMPLE_SKIP_NEWEST = 2;

const KIND_WEIGHT: Record<string, number> = {
  voice: 3,
  never: 2,
  habit: 2,
  people: 2,
  places: 1.5,
  work: 1.5,
  jokes: 1.5,
  objects: 1,
  life: 1,
  lately: 1.5,
};

const MOOD_LINE: Record<SlpSteeringMood, string> = {
  bright: "You have been in a bright, bubbly mood lately.",
  cozy: "You feel soft and cozy lately, in no hurry about anything.",
  restless: "You feel restless lately and want something new.",
  low: "You have been a bit low lately: quieter, less polished.",
  flirty: "You feel flirty and bold lately.",
  stressed: "You are busy and stretched thin lately.",
};

const clean = (value: string) => value.replace(/\s+/gu, " ").trim();

/** Where a one-line attribute list is cut: three or more of these make a list, fewer are prose. */
const LIST_CUT = /\s*;\s*|(?<=\))\s+/u;
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u;

/**
 * Card text as the Creator's own facts: `{{char}}` resolved, roleplay lines about the player dropped.
 *
 * ponytail: sentence ends are Western and full-width punctuation or a line break. An attribute list
 * on one line (W++, PList) is cut at its `;` and `)` only when it is too long to keep whole. Other
 * scripts and shapes stay one long piece; what must not be lost from them is the essentials' job.
 */
function cardSentences(value: string | undefined, name: string): string[] {
  return (
    (value ?? "")
      .replace(/\{\{\s*char\s*\}\}/giu, name)
      .split(/(?<=[.!?])\s+|(?<=[。！？])\s*|\n+/u)
      .flatMap((piece) => {
        if (piece.length <= (SLP_BODY_WORDS.test(piece) ? BODY_SENTENCE_MAX : SENTENCE_MAX)) return [piece];
        const parts = piece.split(LIST_CUT);
        return parts.length > 3 ? parts : [piece];
      })
      .map(clean)
      // Eight Latin letters are barely a word; four kana or hanzi are a sentence.
      .filter((sentence) => sentence.length >= (CJK.test(sentence) ? 3 : 8))
      .filter((sentence) => !/\{\{\s*user\s*\}\}|<\s*start\s*>/iu.test(sentence))
      .map((sentence) => {
        // A body sentence stays whole: furry and scalie cards put the whole anatomy in one comma list,
        // and the cap cut a dragon's wings, tail and claws out of every prompt.
        const max = SLP_BODY_WORDS.test(sentence) ? BODY_SENTENCE_MAX : SENTENCE_MAX;
        return sentence.length > max ? `${sentence.slice(0, max - 1).trim()}…` : sentence;
      })
  );
}

function takeUpTo(sentences: string[], max: number): { taken: string[]; rest: string[] } {
  const taken: string[] = [];
  let length = 0;
  let index = 0;
  for (; index < sentences.length; index += 1) {
    const sentence = sentences[index]!;
    if (taken.length > 0 && length + sentence.length > max) break;
    taken.push(sentence);
    length += sentence.length + 1;
  }
  return { taken, rest: sentences.slice(index) };
}

const VOICE =
  /\b(say|says|said|talks?|speaks?|swears?|curses?|calls?|voice|accent|slang|laugh|laughs|giggles?|sarcas\w*|teases?|jokes?|emoji|types?|texts?|lowercase|phrase|words?|mumbles?|sings?|whispers?|redet|sagt|flucht|spricht)\b/iu;
const HABIT =
  /\b(always|often|usually|every (morning|day|night|week)|habit|tends? to|loves?|obsessed|collects?|can'?t help|ständig|immer|liebt)\b/iu;

function cardKind(sentence: string): string {
  return VOICE.test(sentence)
    ? "voice"
    : SLURP_NEVER_PATTERN.test(sentence)
      ? "never"
      : HABIT.test(sentence)
        ? "habit"
        : "life";
}

function anchorBits(anchors: SlurpCanonAnchors | null | undefined): Bit[] {
  if (!anchors) return [];
  // Lead-ins, not templates around the anchor: an anchor is a noun phrase in the card's own
  // language ("um vier Uhr aufstehen"), and "{a} is a habit of yours" broke on half of them.
  const bit = (kind: string, lead: string) => (value: string) => ({
    key: `${kind}:${value}`,
    kind,
    text: `${lead} ${value}.`,
    value,
  });
  return [
    ...anchors.people.map((person) =>
      bit("people", "Someone in your life:")(person.relation ? `${person.name} (${person.relation})` : person.name),
    ),
    ...anchors.places.map(bit("places", "A place you are often:")),
    ...anchors.work.map(bit("work", "Part of your work:")),
    ...anchors.objects.map(bit("objects", "Something of yours:")),
    ...anchors.habits.map(bit("habit", "One of your habits:")),
    ...anchors.runningJokes.map(bit("jokes", "A running joke of yours:")),
  ];
}

/** Lines of theirs that show the voice: example dialogue, quoted speech in greetings, older own lines. */
function voiceSamples(source: SlurpFlavourSource): string[] {
  const name = source.name.trim();
  const quoted = (value: string) =>
    [...value.matchAll(/["“]([^"”]{8,})["”]/gu)].map((match) => match[1]!).filter(Boolean);
  const speakerPrefix = new RegExp(
    `^(?:\\{\\{\\s*char\\s*\\}\\}${name ? `|${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}` : ""})\\s*:\\s*`,
    "iu",
  );
  const dialogue = (source.card.mes_example ?? "")
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter((line) => speakerPrefix.test(line))
    .map((line) => line.replace(speakerPrefix, ""))
    .flatMap((line) => (quoted(line).length ? quoted(line) : [line.replace(/\*[^*]*\*/gu, "")]));
  const greetings = [source.card.first_mes ?? "", ...(source.card.alternate_greetings ?? [])].flatMap(quoted);
  const own = (source.ownLines ?? []).slice(SAMPLE_SKIP_NEWEST);
  const seen = new Set<string>();
  return [...dialogue, ...greetings, ...own]
    .map((line) => clean(line.replace(/\{\{\s*char\s*\}\}/giu, name)))
    .filter(
      (line) =>
        line.length >= SAMPLE_MIN &&
        line.length <= SAMPLE_MAX &&
        !/\{\{\s*user\s*\}\}|https?:\/\//iu.test(line) &&
        !seen.has(line.toLocaleLowerCase()) &&
        Boolean(seen.add(line.toLocaleLowerCase())),
    );
}

/**
 * A phrase they overuse: a two-to-four word opening shared by at least three of their last eight
 * lines. Real people repeat themselves a little; a feed where every post opens the same way reads
 * as a machine.
 */
export function slurpSignaturePhrase(lines: readonly string[]): string | null {
  const recent = lines.slice(0, 8).map((line) => clean(line));
  if (recent.length < 3) return null;
  for (const size of [4, 3, 2]) {
    const counts = new Map<string, { count: number; text: string }>();
    for (const line of recent) {
      const words = line.split(" ");
      if (words.length < size) continue;
      const text = words
        .slice(0, size)
        .join(" ")
        .replace(/[,.!?…]+$/u, "");
      const key = text.toLocaleLowerCase();
      if (key.replace(/[^\p{L}]/gu, "").length < 4) continue;
      const entry = counts.get(key) ?? { count: 0, text };
      entry.count += 1;
      counts.set(key, entry);
    }
    const best = [...counts.values()].sort((left, right) => right.count - left.count)[0];
    if (best && best.count >= 3) return best.text;
  }
  return null;
}

/** Which of the two alternating halves a detail belongs to, fixed per Creator. */
function half(accountId: string, key: string): number {
  return slurpWeightedPick("flavourHalf", `${accountId}:${key}`, 0, [
    { value: 0, weight: 1 },
    { value: 1, weight: 1 },
  ]);
}

/** Draw up to `count` details, never two of one kind while another kind is still free. */
const nameWords = (value: string) => value.match(/\p{Lu}\p{L}{2,}/gu) ?? [];

function draw(accountId: string, sequence: number, bits: Bit[], count: number): Bit[] {
  const left = [...bits];
  const chosen: Bit[] = [];
  while (chosen.length < count && left.length > 0) {
    const used = new Set(chosen.map((bit) => bit.kind));
    // Two details about the same named person or place say one thing twice.
    const named = new Set(chosen.flatMap((bit) => nameWords(bit.text.replace(/^\S+/u, ""))));
    const pick = slurpWeightedPick(
      `flavourBit${chosen.length}`,
      accountId,
      sequence,
      left.map((bit) => ({
        value: bit,
        weight:
          (KIND_WEIGHT[bit.kind] ?? 1) *
          (used.has(bit.kind) && left.some((b) => !used.has(b.kind)) ? 0.05 : 1) *
          (nameWords(bit.text.replace(/^\S+/u, "")).some((word) => named.has(word)) ? 0.05 : 1),
      })),
    );
    chosen.push(pick);
    left.splice(left.indexOf(pick), 1);
  }
  return chosen;
}

const pushedTopic = (steering: SlpCreatorSteering, sequence: number) =>
  steering.push.length ? steering.push[sequence % steering.push.length]! : null;

function steeringLines(steering: SlpCreatorSteering | null | undefined, sequence: number): string[] {
  if (!steering) return [];
  const push = pushedTopic(steering, sequence);
  return [
    steering.lifePhase ? `These days your life is about this: ${steering.lifePhase}.` : "",
    steering.focus ? `Lately you are focused on ${steering.focus}.` : "",
    steering.mood ? MOOD_LINE[steering.mood] : "",
    push ? `${push} keeps coming up for you lately, so it can show up if it fits.` : "",
    steering.avoid.length ? `Leave ${steering.avoid.join(", ")} out of it for now.` : "",
  ]
    .filter(Boolean)
    .map((line) => line.charAt(0).toLocaleUpperCase() + line.slice(1).replace(/\.\.$/u, "."));
}

/** Real people have flat days and good days. Only for posts, and only when the player set no mood. */
const DAY_TEXTURE = {
  flat: "It is one of those flat days: shorter and plainer than usual is fine.",
  good: "Today is a good day, and it shows a little.",
  small: "Something small and real from your own day can slip in.",
} as const;

function dayTexture(accountId: string, sequence: number): keyof typeof DAY_TEXTURE | null {
  return slurpWeightedPick<keyof typeof DAY_TEXTURE | null>("flavourDay", accountId, sequence, [
    { value: null, weight: 70 },
    { value: "flat", weight: 12 },
    { value: "good", weight: 8 },
    { value: "small", weight: 10 },
  ]);
}

export function compileSlurpFlavourBrief(
  source: SlurpFlavourSource,
  options: { use: SlurpFlavourUse; sequence: number },
): SlurpFlavourBrief {
  const name = source.name.trim() || "the Creator";
  const sequence = Number.isFinite(options.sequence) ? Math.max(0, Math.floor(options.sequence)) : 0;
  const description = takeUpTo(cardSentences(source.card.description, name), CORE_DESCRIPTION_MAX);
  const personality = takeUpTo(cardSentences(source.card.personality, name), CORE_PERSONALITY_MAX);
  const core = [...description.taken, ...personality.taken].join(" ");
  // Never rotated and never dropped for a topic the player wants left alone: without them the
  // Creator is somebody else (a mute character who talks, a blind one who admires the view).
  const essentials = (source.anchors?.essentials ?? [])
    .map((fact) => clean(fact).replace(/[.;\s]+$/u, ""))
    .filter(Boolean);
  const always = essentials.length
    ? `Always true about you, in everything you write, say and show: ${essentials.join("; ")}.`
    : "";

  const cardBits = [...description.rest, ...personality.rest, ...cardSentences(source.card.backstory, name)].map(
    (sentence) => ({ key: `card:${sentence.slice(0, 48)}`, kind: cardKind(sentence), text: sentence }),
  );
  // A topic the player wants left alone is left out of the details and the voice line too.
  const avoided = (value: string) =>
    (source.steering?.avoid ?? []).some((topic) => value.toLocaleLowerCase().includes(topic.toLocaleLowerCase()));
  // Another Agent's mood reading gives way to the mood the player set.
  const latelyBits = (source.lately ?? [])
    .filter((line) => !(line.kind === "mood" && source.steering?.mood))
    .map((line) => ({ key: `lately:${line.kind}:${line.text.slice(0, 40)}`, kind: "lately", text: line.text }));
  const pool = [...cardBits, ...anchorBits(source.anchors), ...latelyBits].filter((bit) => !avoided(bit.text));
  // Two halves that alternate, so consecutive requests never share a detail. Tiny pools share.
  const halves = [0, 1].map((side) => pool.filter((bit) => half(source.accountId, bit.key) === side));
  const usable = halves.every((list) => list.length > 0) ? halves[sequence % 2]! : pool;
  const bits = draw(source.accountId, sequence, usable, BITS_PER_USE[options.use]);

  const signature = slurpSignaturePhrase(source.ownLines ?? []);
  // A line that opens with the overused phrase would show the model the habit it is asked to drop.
  const samples = voiceSamples(source).filter(
    (line) => !avoided(line) && !(signature && line.toLocaleLowerCase().startsWith(signature.toLocaleLowerCase())),
  );
  const sampleHalves = [0, 1].map((side) => samples.filter((_, index) => index % 2 === side));
  const sampleSide = sampleHalves.every((list) => list.length > 0) ? sampleHalves[sequence % 2]! : samples;
  // One sample Creator with a single line shows it every other time: a little repetition, not a lot.
  const sample =
    sampleSide.length && (samples.length > 1 || sequence % 2 === 0)
      ? slurpWeightedPick(
          "flavourSample",
          source.accountId,
          sequence,
          sampleSide.map((value) => ({ value, weight: 1 })),
        )
      : null;

  const signatureAllowed = signature
    ? slurpWeightedPick("flavourSignature", source.accountId, sequence, [
        { value: true, weight: 1 },
        { value: false, weight: 3 },
      ])
    : false;
  const signatureLine = !signature
    ? ""
    : signatureAllowed
      ? `“${signature}” is a thing you say, and it fits once in a while, just not every time.`
      : `You opened with “${signature}” a lot lately, so open differently this time.`;

  const writing = options.use === "post" || options.use === "story";
  const life = steeringLines(source.steering, sequence);
  const day = writing && !source.steering?.mood ? dayTexture(source.accountId, sequence) : null;
  const texture = day ? DAY_TEXTURE[day] : "";

  const paragraphs = [
    core,
    always,
    bits.length ? `A few true things about you to draw on this time. ${bits.map((bit) => bit.text).join(" ")}` : "",
    sample ? `How you sound, in a line of yours from before (match the voice, never reuse the words): “${sample}”` : "",
    [...life, source.relationship ?? "", texture, signatureLine].filter(Boolean).join(" "),
    (source.spice ?? []).join(" "),
    writing
      ? "Use one or two of these where they fit, never as a list. What happens is decided in the post brief; this is how you would do it."
      : "Let this colour how you write. Never quote it or list it back.",
  ].filter(Boolean);
  const steering = source.steering;
  const shaped: SlpDeepDetailsFlavour = {
    details: bits.map((bit) => ({ kind: bit.kind, text: bit.value ?? bit.text })),
    voice: sample,
    opener: signature ? { phrase: signature, allowed: signatureAllowed } : null,
    day,
    relationship: source.relationship || null,
    steering:
      steering && life.length
        ? {
            mood: steering.mood ?? null,
            life: steering.lifePhase || null,
            focus: steering.focus || null,
            topic: pushedTopic(steering, sequence),
            leftOut: [...steering.avoid],
          }
        : null,
  };
  return { text: paragraphs.join("\n\n"), bits: bits.map((bit) => bit.key), sample, shaped };
}
