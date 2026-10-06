/**
 * Spice: what a spicy post, chat or picture is, per Creator, and where the player's taste shows.
 *
 * Pure. The callers read the Creator's level (post guidance), turn-ons and hard noes (steering),
 * the Slurp-wide limit and the player's taste (the spice store); this decides what the model hears.
 *
 * ## Rules (user, 2026-09-27)
 *
 * - Each Creator is spicy in their own way: the kind of spicy post is drawn from their level and
 *   leans on their turn-ons; the flavour brief (7b0) decides how they do it.
 * - Public posts tease; explicit goes locked or to subscribers. The access step-down lives in
 *   `slp-post-guidance.ts`; this only says what a teaser teases.
 * - Everyone touches the player's taste a little, Creators it fits lean in more. A Creator's hard
 *   noes and the player's "never" list always win. About one spicy post or offer in five by default,
 *   spread out: never the same taste twice in a row for one Creator.
 * - No new guards, checks or disclaimers, and plain in-world words only.
 */
import {
  SLP_EXPLICIT_LEVELS,
  slpTasteKey,
  type SlpExplicitLevelName,
  type SlpSpiceLanguage,
  type SlpSpiceState,
  type SlpTaste,
  type SlpTasteNoticed,
  type SlpTasteStrength,
} from "../../../../../shared/src/slp/slp-spice.js";
import type { SlurpCanonAnchors } from "../feed/slp-post-beat.js";
import { SLURP_NEVER_PATTERN } from "../feed/slp-life-moments.js";
import { slurpWeightedPick } from "../feed/slp-weighted.js";

/** What is known about one Creator for spice decisions. */
export type SlurpSpiceCreator = {
  accountId: string;
  /** Card and anchor text, for the fit score and the card's own "never" sentences. */
  text: string;
  turnOns: readonly string[];
  hardNoes: readonly string[];
  anchors?: SlurpCanonAnchors | null;
};

// --- Words ---------------------------------------------------------------------------------------

const wordsOf = (value: string) =>
  (value.toLocaleLowerCase().match(/\p{L}{3,}/gu) ?? []).map((word) => word.replace(/(?<!s)s$/u, ""));

/** Two phrases share a word, where "toys" meets "toy" and "masturbating" meets "masturbat". */
function shareWord(left: string, right: string): boolean {
  const right_ = wordsOf(right);
  return wordsOf(left).some((a) =>
    right_.some((b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)))),
  );
}

/** The card's own "never / hates" sentences. */
function cardNever(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/u).filter((sentence) => SLURP_NEVER_PATTERN.test(sentence));
}

/** Everything this Creator will not do: their hard noes, the player's never list, the card's nevers. */
function blocked(value: string, creator: SlurpSpiceCreator, never: readonly string[]): boolean {
  return [...creator.hardNoes, ...never, ...cardNever(creator.text)].some((no) => shareWord(value, no));
}

// --- Spicy kinds ---------------------------------------------------------------------------------

type SpiceKind = {
  id: string;
  /** How the player sees it in "Slurp noticed you like …". */
  label: string;
  min: Exclude<SlpExplicitLevelName, "none">;
  partnered?: true;
  words: readonly string[];
  /** What happens, for the caption call. `{partner}` is filled in. */
  line: string;
  /** What a public teaser hints at. */
  tease: string;
  /** What the picture shows. */
  moment: string;
};

const KINDS: readonly SpiceKind[] = [
  {
    id: "lingerie",
    label: "lingerie shoots",
    min: "suggestive",
    words: ["lingerie", "underwear", "lace", "stockings", "bra", "panties"],
    line: "a lingerie shoot, something new on and shown off properly",
    tease: "the lingerie set you have not shown yet",
    moment: "posing in lingerie",
  },
  {
    id: "tease",
    label: "slow teases",
    min: "suggestive",
    words: ["tease", "teasing", "undress", "strip", "striptease"],
    line: "a slow tease, getting undressed and stopping right before the good part",
    tease: "how far you went after the camera kept rolling",
    moment: "half undressed, teasing the camera",
  },
  {
    id: "nudes",
    label: "nudes",
    min: "nudity",
    words: ["nude", "nudes", "naked", "nudity", "topless"],
    line: "nudes, just you with nothing on, posing for your own page",
    tease: "the nudes waiting behind the lock",
    moment: "posing nude",
  },
  {
    id: "shower",
    label: "shower scenes",
    min: "nudity",
    words: ["shower", "bath", "bathtub", "wet"],
    line: "the shower or the bath, wet and naked",
    tease: "what happened in the shower",
    moment: "naked in the shower, wet skin",
  },
  {
    id: "toys",
    label: "toys",
    min: "explicit",
    words: ["toy", "toys", "vibrator", "dildo", "plug"],
    line: "playing with a toy on camera, all the way until you finish",
    tease: "the new toy you finally tried",
    moment: "using a sex toy on the bed",
  },
  {
    id: "solo",
    label: "solo play",
    min: "explicit",
    words: ["masturbation", "masturbating", "solo", "touching", "orgasm", "fingering"],
    line: "touching yourself on camera until you come",
    tease: "what you did when you were alone last night",
    moment: "masturbating, flushed and close",
  },
  {
    id: "partnered",
    label: "partner scenes",
    min: "explicit",
    partnered: true,
    words: ["sex", "partner", "couple", "boyfriend", "girlfriend", "collab", "hookup", "threesome", "fucking"],
    line: "sex with {partner}",
    tease: "the night with {partner}",
    moment: "having sex with {partner}",
  },
];

export const SLURP_SPICE_KIND_IDS = KINDS.map((kind) => kind.id);

/** The learning label of a stored kind id ("toys" → "toys", "solo" → "solo play"). */
export function slurpSpiceKindLabel(id: string): string | null {
  return KINDS.find((kind) => kind.id === id)?.label ?? null;
}

const LEVEL_INDEX = (level: SlpExplicitLevelName) => SLP_EXPLICIT_LEVELS.indexOf(level);

/** Someone to be with. A couple partner from the card, a collab partner, or someone unnamed. */
export type SlurpSpicePartner = { kind: "couple" | "collab" | "unnamed"; name: string | null; company: string };

/** A card person who is their partner ("girlfriend", "Ehemann"). Couples read it too: a card partner means taken. */
export const SLURP_PARTNER_RELATION =
  /\b(boyfriend|girlfriend|partner|husband|wife|fianc[ée]e?|lover|spouse|freund(?:in)?|ehemann|ehefrau)\b/iu;

export function slurpSpicePartner(
  creator: SlurpSpiceCreator,
  collabs: readonly string[],
  seed: string,
  sequence: number,
  /**
   * In a couple with another Creator (7b-couples): their name, or null when they would not be in a
   * partner scene (level, hard noes). Then there is no collab partner either: they are taken.
   */
  slurpCouple?: string | null,
): SlurpSpicePartner {
  if (slurpCouple !== undefined)
    return slurpWeightedPick("spicePartner", seed, sequence, [
      { value: { kind: "unnamed", name: null, company: "a partner whose face stays out of frame" }, weight: 1 },
      ...(slurpCouple
        ? [
            {
              value: { kind: "couple" as const, name: slurpCouple, company: `${slurpCouple}, their partner` },
              weight: 3,
            },
          ]
        : []),
    ]);
  const couple = (creator.anchors?.people ?? []).find((person) => SLURP_PARTNER_RELATION.test(person.relation));
  const options: { value: SlurpSpicePartner; weight: number }[] = [
    { value: { kind: "unnamed", name: null, company: "a partner whose face stays out of frame" }, weight: 1 },
    ...(couple
      ? [
          {
            value: {
              kind: "couple" as const,
              name: couple.name,
              company: `${couple.name}, their ${couple.relation.toLocaleLowerCase()}`,
            },
            weight: 3,
          },
        ]
      : []),
    ...collabs.map((name) => ({
      value: { kind: "collab" as const, name, company: `${name}, a fellow Creator` },
      weight: 1.5 / collabs.length,
    })),
  ];
  return slurpWeightedPick("spicePartner", seed, sequence, options);
}

export type SlurpSpiceAngle = {
  kind: string;
  label: string;
  /** The instruction line for the caption call. */
  line: string;
  /** What the picture shows, and who else is in it. */
  moment: string;
  partner: SlurpSpicePartner | null;
  /** The player's taste this one touches, if any. */
  taste: string | null;
};

const PARTNER_LINE: Record<SlurpSpicePartner["kind"], (name: string | null) => string> = {
  // U (user): a couple is private and intimate; a collab partner scene is a planned, negotiated shoot.
  couple: (name) =>
    `${name} is in it with you, like a couple is: private and intimate, just the two of you, not a shoot for anyone.`,
  collab: (name) =>
    `It is a shoot with ${name}, a Creator you collab with, planned in your DMs beforehand: what you would do, what is off limits, how you split it. Professional, and still hot.`,
  unnamed: () => "The other person stays unnamed and their face stays out of the picture.",
};

/**
 * The spicy angle of one post, or null when the post is not spicy.
 *
 * `level` is the post's own level after access and intent (`slurpPostSexualLevel`). A locked post
 * gets the full kind; a public teaser only hints at a kind that sits behind the lock. Ordinary
 * public posts get nothing here: their level line already lets them flirt.
 */
export function slurpSpiceAngle(input: {
  level: SlpExplicitLevelName;
  /** The Creator's own ceiling, for what a teaser may hint at. */
  ceiling: SlpExplicitLevelName;
  access: "public" | "locked";
  teaser: boolean;
  creator: SlurpSpiceCreator;
  spice: Pick<SlpSpiceState, "tastes" | "never">;
  collabs?: readonly string[];
  /**
   * A post made together with another Creator (a collab): a partner scene is with them, or with
   * nobody when they would not do one (null). Absent for the Creator's own posts.
   */
  madeWith?: string | null;
  /** `madeWith` is their couple partner (a couple post): private and intimate, not a collab shoot (U). */
  intimate?: boolean;
  /** In a couple with another Creator: see `slurpSpicePartner`. Absent when single. */
  couple?: string | null;
  /** Earlier spicy posts of this Creator, newest first. */
  recent: readonly { kind: string; taste?: string | null }[];
  sequence: number;
  /** A drop delivers the kind its tease hinted at, when it is still allowed (3b). */
  teasedKind?: string | null;
}): SlurpSpiceAngle | null {
  if (input.level === "none") return null;
  const locked = input.access === "locked";
  if (!locked && !input.teaser) return null;
  // What the post is about: the post's level when locked, the Creator's ceiling when teased.
  const about = locked ? input.level : input.ceiling;
  const top = LEVEL_INDEX(about);
  const kinds = KINDS.filter((kind) => LEVEL_INDEX(kind.min) <= top).filter(
    (kind) =>
      !kind.words.some((word) => blocked(word, input.creator, input.spice.never)) &&
      !(kind.partnered && input.madeWith === null),
  );
  if (!kinds.length) return null;
  const seed = input.creator.accountId;
  const lastKinds = input.recent.slice(0, 3).map((entry) => entry.kind);
  const teased = locked ? kinds.find((candidate) => candidate.id === input.teasedKind) : undefined;
  const kind =
    teased ??
    slurpWeightedPick(
      "spiceKind",
      seed,
      input.sequence,
      kinds.map((candidate) => ({
        value: candidate,
        weight:
          // The top of the range carries the most weight: an explicit page is mostly explicit.
          (1 + 2 * (LEVEL_INDEX(candidate.min) / Math.max(1, top))) *
          (input.creator.turnOns.some((on) => candidate.words.some((word) => shareWord(on, word))) ? 3 : 1) *
          (lastKinds[0] === candidate.id ? 0.1 : lastKinds.includes(candidate.id) ? 0.4 : 1),
      })),
    );
  const partner: SlurpSpicePartner | null = !kind.partnered
    ? null
    : input.madeWith
      ? input.intimate
        ? { kind: "couple", name: input.madeWith, company: `${input.madeWith}, their partner` }
        : { kind: "collab", name: input.madeWith, company: `${input.madeWith}, a fellow Creator` }
      : slurpSpicePartner(input.creator, input.collabs ?? [], seed, input.sequence, input.couple);
  const who = partner?.name ?? "someone you are seeing";
  const fill = (value: string) => value.replace("{partner}", who);
  const taste = slurpTastePick(input.spice, input.creator, seed, input.sequence, input.recent);
  const tasteLine = taste
    ? `Your fans have been into ${taste.text} lately. Work it in if you can, your way, without making it the whole post.`
    : "";
  const line = locked
    ? [
        `This one is spicy: ${fill(kind.line)}.`,
        partner ? PARTNER_LINE[partner.kind](partner.name) : "",
        "Let it grow out of what happens today, and do it the way only you would.",
        tasteLine,
      ]
    : [
        `This teases ${fill(kind.tease)}, which sits behind the lock. Show a little and keep the rest for subscribers.`,
        tasteLine,
      ];
  return {
    kind: kind.id,
    label: kind.label,
    line: line.filter(Boolean).join(" "),
    moment: fill(kind.moment),
    partner: locked ? partner : null,
    taste: taste?.text ?? null,
  };
}

// --- The player's taste --------------------------------------------------------------------------

/** Base share of spicy posts or offers a taste shows up in, at an average fit. */
const STRENGTH_SHARE: Record<SlpTasteStrength, number> = { hint: 0.2, often: 0.4, obsessed: 0.6 };

/**
 * How well a taste fits a Creator, 0 to 1, or -1 when they would never.
 *
 * Their turn-ons count most, their card and anchors a little. Everyone else scores 0 and still
 * touches it now and then ("everyone a little").
 */
export function slurpTasteFit(taste: string, creator: SlurpSpiceCreator, never: readonly string[] = []): number {
  if (blocked(taste, creator, never)) return -1;
  if (creator.turnOns.some((on) => shareWord(taste, on))) return 1;
  return shareWord(taste, creator.text) ? 0.5 : 0;
}

/** How likely one taste shows up in this Creator's next spicy post or offer. */
export function slurpTasteChance(strength: SlpTasteStrength, fit: number): number {
  return fit < 0 ? 0 : STRENGTH_SHARE[strength] * (0.6 + 0.8 * fit);
}

/**
 * The taste one spicy post or offer touches, or null. `recent` is this Creator's earlier spicy
 * items, newest first: the one before never repeats, the two before that seldom.
 */
export function slurpTastePick(
  spice: Pick<SlpSpiceState, "tastes" | "never">,
  creator: SlurpSpiceCreator,
  seed: string,
  sequence: number,
  recent: readonly { taste?: string | null }[] = [],
): SlpTaste | null {
  const last = recent.slice(0, 3).map((entry) => (entry.taste ? slpTasteKey(entry.taste) : ""));
  const chances = spice.tastes
    .map((taste) => {
      const key = slpTasteKey(taste.text);
      const variety = last[0] === key ? 0 : last.includes(key) ? 0.35 : 1;
      return {
        taste,
        chance: slurpTasteChance(taste.strength, slurpTasteFit(taste.text, creator, spice.never)) * variety,
      };
    })
    .filter((entry) => entry.chance > 0);
  if (!chances.length) return null;
  // One roll for "a taste shows up at all", then which one, by its own chance.
  const none = chances.reduce((left, entry) => left * (1 - entry.chance), 1);
  const shows = slurpWeightedPick("taste", seed, sequence, [
    { value: true, weight: 1 - none },
    { value: false, weight: none },
  ]);
  if (!shows) return null;
  return slurpWeightedPick(
    "tasteWhich",
    seed,
    sequence,
    chances.map((entry) => ({ value: entry.taste, weight: entry.chance })),
  );
}

// --- Words for the flavour brief -----------------------------------------------------------------

const DM_LEVEL: Record<Exclude<SlpExplicitLevelName, "none">, string> = {
  suggestive: "In private chats you flirt and tease, and it stays suggestive.",
  nudity: "In private chats you can get naughty and send nudes when the mood is right.",
  explicit:
    "In private chats you can sext fully explicitly, take custom requests, and send explicit pictures when the mood is right.",
};

/**
 * Which words, once it gets naked (0.3.17). "dirty" is the word list the old steamy and explicit
 * Writing presets carried, now only where the level allows nudity. How far a post goes is already
 * its own line (`slurpPostLevelInstruction`), a chat's is DM_LEVEL.
 */
const LANGUAGE: Record<SlpSpiceLanguage, string> = {
  soft: "Keep the words soft and suggestive: innuendo and euphemism, never crude.",
  frank: "Say what happens plainly and frankly, without being crude.",
  dirty:
    "When there is nudity or sex, use thorough, graphic, horny descriptions. Name the body in dirty everyday words, not clinical ones: tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking. Describe how it looks, feels, and moves.",
};

/**
 * The spice part of the flavour brief, in plain sentences. `level` is where this chat or post may
 * go; a chat with somebody who has not subscribed stays one step lower and says so.
 */
export function slurpSpiceBriefLines(input: {
  use: "post" | "story" | "dm" | "comment" | "delivery";
  level: SlpExplicitLevelName;
  /** Only for chats: somebody who has not subscribed gets the tease, not the full thing. */
  held?: boolean;
  turnOns: readonly string[];
  hardNoes: readonly string[];
  never: readonly string[];
  taste?: string | null;
  /** The player's word choice (Settings › Spice); null reads as "dirty", the old shipped default. */
  language?: SlpSpiceLanguage | null;
}): string[] {
  if (input.level === "none") return [];
  const noes = [...new Set([...input.hardNoes, ...input.never])];
  const language = input.language ?? "dirty";
  return [
    input.use === "dm" ? DM_LEVEL[input.level] : "",
    // Soft and frank words fit any spicy level; the dirty word list only once nudity is allowed.
    input.use !== "comment" && (language !== "dirty" || input.level !== "suggestive") ? LANGUAGE[language] : "",
    input.use === "dm" && input.held ? "The full thing is for subscribers or a paid unlock; tease the rest." : "",
    input.turnOns.length ? `What turns you on and what you like showing: ${input.turnOns.join(", ")}.` : "",
    noes.length ? `Your hard noes, whatever anybody offers: ${noes.join(", ")}.` : "",
    input.taste
      ? `The person you are talking to has a thing for ${input.taste}. If it gets hot, you might bring it in, your way.`
      : "",
  ].filter(Boolean);
}

/** A chat's level: the Creator's own for subscribers, one step lower for everybody else. */
export function slurpDmSpiceLevel(level: SlpExplicitLevelName, subscribed: boolean): SlpExplicitLevelName {
  return subscribed ? level : (SLP_EXPLICIT_LEVELS[Math.max(0, LEVEL_INDEX(level) - 1)] ?? "none");
}

// --- Learning ------------------------------------------------------------------------------------

export const SLURP_TASTE_SIGNAL_WEIGHT = { like: 1, unlock: 2, tip: 3, request: 3 } as const;
export type SlurpTasteSignal = keyof typeof SLURP_TASTE_SIGNAL_WEIGHT;

const HALF_LIFE_DAYS = 14;
/** A new "Slurp noticed you like …" needs this much, from at least this many signals. */
const NOTICE_SCORE = 7;
const NOTICE_SIGNALS = 3;
/** A taste already on the list is offered stronger only at about twice that. */
const STRENGTHEN_SCORE = 14;
const DAY_MS = 86_400_000;

function decayed(score: number, from: string, at: Date): number {
  const age = (at.getTime() - Date.parse(from)) / DAY_MS;
  return Number.isFinite(age) && age > 0 ? score * 0.5 ** (age / HALF_LIFE_DAYS) : score;
}

/** One unlock, like, tip or request on something with these labels. Slow on purpose. */
export function slurpLearnTaste(
  state: SlpSpiceState,
  labels: readonly string[],
  signal: SlurpTasteSignal,
  at: Date,
): SlpSpiceState {
  const keys = [...new Set(labels.map(slpTasteKey).filter(Boolean))];
  if (!keys.length) return state;
  const learned = { ...state.learned };
  for (const key of keys) {
    const entry = learned[key];
    learned[key] = {
      score: (entry ? decayed(entry.score, entry.at, at) : 0) + SLURP_TASTE_SIGNAL_WEIGHT[signal],
      signals: (entry?.signals ?? 0) + 1,
      at: at.toISOString(),
    };
  }
  return { ...state, learned };
}

/** What Slurp has noticed and not been told yet, strongest first. At most four. */
export function slurpNoticedTastes(state: SlpSpiceState, at: Date): SlpTasteNoticed[] {
  const tastes = new Map(state.tastes.map((taste) => [slpTasteKey(taste.text), taste]));
  return Object.entries(state.learned)
    .map(([label, entry]) => ({ label, entry, score: decayed(entry.score, entry.at, at) }))
    .filter(({ label, entry, score }) => {
      if (state.dismissed.includes(label) || state.never.some((no) => shareWord(label, no))) return false;
      const taste = tastes.get(label);
      if (taste) return taste.strength !== "obsessed" && score >= STRENGTHEN_SCORE;
      return score >= NOTICE_SCORE && entry.signals >= NOTICE_SIGNALS;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map(({ label }) => ({ label, existing: tastes.has(label) }));
}

/**
 * The labels a request's words name: a taste or idea when every word of it is there ("dirty talk"
 * needs both), a spicy kind when one of its own words is ("vibrator" → toys).
 */
export function slurpTasteLabelsIn(text: string, state: SlpSpiceState, ideas: readonly string[]): string[] {
  if (!text.trim()) return [];
  const all = (label: string) => wordsOf(label).every((word) => shareWord(word, text));
  return [
    ...new Set(
      [
        ...[...state.tastes.map((taste) => taste.text), ...ideas].filter(all),
        ...KINDS.filter((kind) => kind.words.some((word) => shareWord(word, text))).map((kind) => kind.label),
      ].map(slpTasteKey),
    ),
  ];
}

/** The labels a spicy post stored at writing time (`metadata.slurpSpice`). */
export function slurpSpiceLabelsOf(metadata: unknown): string[] {
  const spice = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).slurpSpice : undefined;
  if (!spice || typeof spice !== "object") return [];
  const { kind, taste } = spice as { kind?: unknown; taste?: unknown };
  return [
    typeof kind === "string" ? slurpSpiceKindLabel(kind) : null,
    typeof taste === "string" && taste.trim() ? taste : null,
  ].filter((label): label is string => Boolean(label));
}

/** The player's answer to a noticed chip. */
export function slurpAnswerNoticed(
  state: SlpSpiceState,
  label: string,
  answer: "accept" | "stronger" | "remove",
  newId: () => string,
): SlpSpiceState {
  const key = slpTasteKey(label);
  const learned = { ...state.learned };
  delete learned[key];
  if (answer === "remove") return { ...state, learned, dismissed: [...new Set([...state.dismissed, key])] };
  const existing = state.tastes.find((taste) => slpTasteKey(taste.text) === key);
  if (existing) {
    const strength: SlpTasteStrength = existing.strength === "hint" ? "often" : "obsessed";
    return {
      ...state,
      learned,
      tastes: state.tastes.map((taste) => (taste === existing ? { ...taste, strength } : taste)),
    };
  }
  const taste: SlpTaste = { id: newId(), text: label.trim(), strength: answer === "stronger" ? "often" : "hint" };
  return { ...state, learned, tastes: [...state.tastes, taste] };
}

/**
 * The Language an install starts with (0.3.17), from the Writing text it had: the mild preset was
 * soft words, the steamy and explicit presets (and the shipped default) the dirty word list. An
 * edited text keeps its own words: the word list means dirty, "no explicit detail" soft, else frank.
 */
export function slurpSpiceLanguageFor(
  guidance: string,
  shipped: { mild: string; dirty: readonly string[] },
): SlpSpiceLanguage {
  if (guidance === shipped.mild) return "soft";
  if (shipped.dirty.includes(guidance)) return "dirty";
  if (/\b(pussy|cock|clit|tits)\b/iu.test(guidance)) return "dirty";
  if (/\b(do not|don't|never) (write|describe) explicit/iu.test(guidance)) return "soft";
  return "frank";
}
