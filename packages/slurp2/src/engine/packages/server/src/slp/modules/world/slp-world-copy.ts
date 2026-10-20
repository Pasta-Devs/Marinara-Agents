/**
 * What the audience says when it asks for something.
 *
 * Tier 1 of the fidelity ladder: combinatorial, deterministic, and free. The maintainer's rule is
 * that unattended work never calls the model, so a request opened by a background tick has to be
 * writable without one.
 *
 * These stay deliberately vague. A template that tries to sound specific about a post it has not
 * read is worse than one that does not try: "can you do something with the blue lighting again"
 * is a lie when there was no blue lighting, while "something soft, whatever you feel like" is
 * true of anything. Specificity is Tier 2's job, and Tier 2 runs when the player is present.
 *
 * ponytail: fixed banks. If the same phrasing starts repeating in practice, widen the arrays
 * before reaching for the model — the combinations here already run into the hundreds.
 */

import type { SlurpAudienceTone } from "../../../../../shared/src/slp/slp-tone.js";
import { SLURP_COMMISSION_OPENERS, SLURP_FAN_OPENERS } from "../../../../../shared/src/slp/slp-world.js";

const COMMISSION_ASKS = [
  "something soft, whatever direction you feel like taking it",
  "something in your usual style, but just for me",
  "a set built around one idea, your pick of which",
  "something a bit moodier than your last few",
  "whatever you have been wanting to make and have not yet",
  "something I can keep for myself rather than scroll past",
  "a piece with the feel of your older work",
  "a quick sketch, nothing polished",
  "a detailed full-body piece with a proper background",
  "the two of us together in one scene",
  "a small set of three around the same theme",
  "a simple headshot I can use as an icon",
  "a painted scene, as detailed as you like",
] as const;

const COMMISSION_CLOSERS = [
  "No rush at all.",
  "Take your time with it.",
  "Say a price and I will send it over.",
  "Happy to wait for a slot.",
  "Whatever you think is fair.",
  "I would love it by tonight if you can.",
] as const;

const QUESTIONS = [
  "how long did this one take you?",
  "is there more of this set somewhere?",
  "what made you go this direction?",
  "any chance of a follow-up to this one?",
  "do you take requests like this?",
  "is this a one-off or a series?",
  "what were you going for with this?",
  "would you ever do this again?",
  "did this turn out how you planned?",
  "is the locked one from the same day?",
] as const;

/** Deterministic index, so the same request always reads the same way. */
function pickIndex(seed: string, salt: string, length: number): number {
  let out = 0x811c9dc5;
  const value = `${salt}:${seed}`;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  out ^= out >>> 16;
  out = Math.imul(out, 0x85ebca6b);
  out ^= out >>> 13;
  return (out >>> 0) % length;
}

/** One commission brief. Three banks combined give several hundred distinct requests. */
export function slurpCommissionBrief(seed: string, openers: readonly string[] = []): string {
  // The player's own openers (Messaging settings) replace the built-in ones when there are any.
  const bank = openers.length > 0 ? openers : SLURP_COMMISSION_OPENERS;
  return [
    bank[pickIndex(seed, "opener", bank.length)]!,
    COMMISSION_ASKS[pickIndex(seed, "ask", COMMISSION_ASKS.length)]!,
    COMMISSION_CLOSERS[pickIndex(seed, "closer", COMMISSION_CLOSERS.length)]!,
  ].join(" ");
}

/** One question for a post. */
export function slurpAudienceQuestion(seed: string): string {
  return QUESTIONS[pickIndex(seed, "question", QUESTIONS.length)]!;
}

/** An opening line from somebody who has never written before; the player's own list wins when set. */
export function slurpAudienceOpener(seed: string, openers: readonly string[] = []): string {
  const bank = openers.length > 0 ? openers : SLURP_FAN_OPENERS;
  return bank[pickIndex(seed, "opener-dm", bank.length)]!;
}

/** Fans under a post of somebody who is publicly with someone: they talk to her about them. */
const COMMENTS_ABOUT_PARTNER = [
  "does {partner} see these? 👀",
  "{partner} really lets you post this? respect",
  "lucky {partner} 😮‍💨",
  "{partner} better be sharing",
  "if I were {partner} I'd never let you log off",
  "tell {partner} we said thanks",
  "how is {partner} ok with this 😳",
  "{partner} is a saint fr",
] as const;

export function slurpPartnerCommentBodies(partner: string): string[] {
  return COMMENTS_ABOUT_PARTNER.map((body) => body.replaceAll("{partner}", partner));
}

/** A fan's note to the player's page about the Creator the player is with, in public. */
const FAN_NOTES_ABOUT_PARTNER = [
  "you and {partner} are the cutest thing on here",
  "saw you with {partner}. lucky 😭",
  "{partner} better know how lucky they are",
  "ok the {partner} posts. I'm not jealous. I'm fine.",
  "shipping you two since day one, just so you know",
] as const;

/** A fan's note to the player's page: now and then about their partner (one in three), else an opener. */
export function slurpFanNote(seed: string, openers: readonly string[], partner: string | null): string {
  return partner && pickIndex(seed, "note-partner", 3) === 0
    ? FAN_NOTES_ABOUT_PARTNER[pickIndex(seed, "note-line", FAN_NOTES_ABOUT_PARTNER.length)]!.replaceAll(
        "{partner}",
        partner,
      )
    : slurpAudienceOpener(seed, openers);
}

/**
 * The note a character Creator sends with a finished commission.
 *
 * Every automatic delivery used to carry one hardcoded English sentence, so every Creator in the
 * world handed over their work with the same words forever. Vague on purpose, like the briefs:
 * the model rewrites it in the Creator's voice on the next read.
 */
const COMMISSION_DELIVERIES = [
  "here it is — I hope it is what you had in mind",
  "finished this last night. really enjoyed making it",
  "done! this one took a couple of tries but I like where it landed",
  "all yours. thank you for asking me for something like this",
  "here you go. tell me what you think, honestly",
  "finally happy with it. hope you are too",
  "this one was fun. thanks for trusting me with it",
  "took me a while but here it is",
] as const;

/** The same notes in the other languages Slurp speaks, for a chat held in one of them (7c M-008). */
const COMMISSION_DELIVERIES_BY_LANGUAGE: Record<SlurpChatLanguage, readonly string[]> = {
  en: COMMISSION_DELIVERIES,
  de: [
    "hier ist es. ich hoffe, es ist so, wie du es dir vorgestellt hast",
    "gestern abend fertig geworden. hat mir richtig spaß gemacht",
    "fertig! hat ein paar anläufe gebraucht, aber jetzt mag ich es",
    "gehört ganz dir. danke, dass du mich sowas fragst",
    "bitte schön. sag mir ehrlich, wie du es findest",
    "hat eine weile gedauert, aber hier ist es",
  ],
  ko: [
    "여기 있어요. 생각했던 거랑 비슷했으면 좋겠어요",
    "어젯밤에 끝냈어요. 만드는 동안 정말 즐거웠어요",
    "완성! 몇 번 다시 했는데 이제 마음에 들어요",
    "이제 당신 거예요. 이런 부탁 해줘서 고마워요",
    "여기요. 솔직하게 어떤지 말해줘요",
    "시간이 좀 걸렸지만 드디어 완성했어요",
  ],
  pl: [
    "proszę, gotowe. mam nadzieję, że o to ci chodziło",
    "gotowe od wczoraj wieczorem. robienie tego to była czysta przyjemność",
    "gotowe! trzeba było kilku podejść, ale efekt mi się podoba",
    "to już twoje. dzięki za takie zamówienie",
    "proszę bardzo. powiedz szczerze, co o tym myślisz",
    "trochę to trwało, ale oto jest",
  ],
};

export function slurpCommissionDeliveryNote(seed: string, language: SlurpChatLanguage = "en"): string {
  const bank = COMMISSION_DELIVERIES_BY_LANGUAGE[language];
  return bank[pickIndex(seed, "delivery", bank.length)]!;
}

/** The languages Slurp ships copy in. */
export type SlurpChatLanguage = "en" | "de" | "ko" | "pl";

const WORDS: Record<Exclude<SlurpChatLanguage, "ko">, ReadonlySet<string>> = {
  en: new Set("the and you is to it i that this for what with my your me so just are was".split(" ")),
  de: new Set(
    "ich du und nicht das ist ein eine mit auf für dich mir sehr danke hallo aber auch wie was der die".split(" "),
  ),
  pl: new Set("jest nie się że to jak ale mnie ciebie dzięki bardzo cześć tak co czy mi już".split(" ")),
};

/**
 * Which of Slurp's languages a chat is held in, from its newest lines (7c M-008): Hangul is Korean;
 * otherwise common words and letters decide, and English wins a tie.
 * ponytail: word and letter counts, not a language detector; other languages read as English.
 */
export function slurpChatLanguage(texts: readonly string[]): SlurpChatLanguage {
  const text = texts.join(" ").toLowerCase();
  if (/[\uac00-\ud7a3]/u.test(text)) return "ko";
  const words = text.match(/\p{L}+/gu) ?? [];
  const score = (language: Exclude<SlurpChatLanguage, "ko">) =>
    words.filter((word) => WORDS[language].has(word)).length +
    2 * (text.match(language === "de" ? /[äöüß]/gu : language === "pl" ? /[ąćęłńśźż]/gu : /(?!)/u)?.length ?? 0);
  const [best] = (["en", "de", "pl"] as const)
    .map((language) => [language, score(language)] as const)
    .sort((left, right) => right[1] - left[1]);
  return best && best[1] > score("en") ? best[0] : "en";
}

/**
 * The noise floor of a comment section.
 *
 * Most comments on a real post are not observations, they are somebody tapping out three words to
 * be seen tapping them out. Generating those with a model is the worst trade available: it is the
 * highest-volume text on the platform and the least worth reading, so it costs the most and
 * returns the least.
 *
 * So they are combinatorial, like everything else in Tier 1, and they hang off the free pulse
 * rather than the batched run. The model's budget goes entirely to Tier 2 — the comments that
 * have actually seen the post and come from somebody with a history.
 *
 * Deliberately post-agnostic, for the same reason the briefs are: "the lighting in this one" is a
 * lie about most posts, "ok this is unfair" is true of any of them.
 */
const REACTION_OPENERS = ["ok", "no because", "sorry but", "genuinely", "listen", "", "", ""] as const;

export const SLURP_SHIPPED_REACTIONS = [
  "this is unfair",
  "you never miss",
  "how are you real",
  "this one got me",
  "obsessed",
  "the best one yet",
  "I was not ready for this",
  "stop it",
  "perfection honestly",
  "this is the one",
  "screaming",
  "you did that",
  "unreal",
  "my god",
  "this is art",
  "instant favourite",
  "criminally good",
  "I keep coming back to this one",
  "not the way I gasped",
  "you are so unserious",
  "this is illegal",
  "brb rethinking my life",
  "the lighting here",
  "framed this in my head already",
  "who allowed this",
  "consistently unhinged and I love it",
  "this ate",
  "no notes",
  "I need a minute",
  "you understood the assignment",
  "this belongs in a museum",
  "okay but the outfit",
  "every single time",
  "I am normal about this",
  "cannot be doing this to us",
  "you are showing off now",
  "well that ruined my morning",
  "saving this one",
  "the audacity honestly",
] as const;

/**
 * A starter bank per built-in Fan Type.
 *
 * Three bodies each, not thirty: the point is that a Lurker sounds unlike a Troll on the first
 * tick of a fresh install, before any model call has ever run. Volume still comes from the shared
 * bank underneath and from `slurp-reaction-bank.operation.ts` growing each type past this floor.
 */
export const SLURP_SHIPPED_TYPE_REACTIONS: Readonly<Record<string, readonly string[]>> = {
  regular: ["this is lovely", "always a good one", "made my evening"],
  "night-owl": ["3am and here I am", "why am I awake for this", "the night shift approves"],
  "crossover-fan": [
    "found you through someone else and stayed",
    "this beats what I came from",
    "recommending you again",
  ],
  troll: ["sure ok", "bold of you to post this", "not paying for it though"],
  newcomer: ["new here, is it always like this", "wait how did I not know about you", "just followed"],
  lurker: ["🫶", "👀", "❤️"],
  superfan: [
    "been here since the early ones and this is top three",
    "you have gotten so good at this",
    "I noticed the change and I love it",
  ],
  whale: ["worth every coin", "put this in the shop", "take my money honestly"],
};

const REACTION_TAILS = ["", "", "", " 🔥", " 😍", " 🥺", "!!", "…", " ❤️", " 😭"] as const;

/**
 * One low-effort comment.
 *
 * `extraBodies` is the bank the player can edit in Settings, topped up occasionally by
 * `slurp-reaction-bank.operation.ts`. It is merged with the shipped bodies rather than replacing
 * them, so a bank that is empty, half-written, or cleared out still leaves the free tier working.
 *
 * The body is the part a reader notices — the opener and tail only dress it — so the count that
 * matters is the number of bodies, not the product of the three banks. Forty shipped bodies is the
 * floor, and the stored bank is what carries volume past it.
 */
export function slurpAudienceReaction(seed: string, extraBodies: readonly string[] = []): string {
  return slurpAudienceReactionFrom(
    seed,
    extraBodies.length > 0 ? [...SLURP_SHIPPED_REACTIONS, ...extraBodies] : SLURP_SHIPPED_REACTIONS,
  );
}

/**
 * The same line, from a body pool the caller chose.
 *
 * Per-type banks need the pool decided outside this function — a Troll drawing from the shared
 * shipped bodies is exactly what the fan types were added to stop. An empty pool falls back to the
 * shipped bodies, so a caller can never produce a blank comment.
 */
export function slurpAudienceReactionFrom(seed: string, pool: readonly string[]): string {
  const bodies = pool.length > 0 ? pool : SLURP_SHIPPED_REACTIONS;
  const opener = REACTION_OPENERS[pickIndex(seed, "reaction-open", REACTION_OPENERS.length)]!;
  const body = bodies[pickIndex(seed, "reaction", bodies.length)]!;
  const tail = REACTION_TAILS[pickIndex(seed, "reaction-tail", REACTION_TAILS.length)]!;
  return `${opener ? `${opener} ` : ""}${body}${tail}`;
}

/**
 * Fans taking sides under a rivalry post (7b-c). Tier 1 like every pulse comment: free, and vague
 * enough to be true of any spat. `{self}` is the poster, `{rival}` the other Creator.
 */
const RIVALRY_SIDES = [
  "team {self} forever",
  "ok but {rival} did it first tho",
  "not {rival} catching strays again 😭",
  "the way this is 100% about {rival}",
  "grabbing popcorn 🍿",
  "{self} would never. {rival} on the other hand…",
  "you are both iconic, can we not",
  "{rival} fans in shambles",
  "staying neutral (I am team {self})",
  "this is giving subtweet",
  "I like {rival} too, don't make me choose",
  "the receipts better be coming",
] as const;

export function slurpRivalryBodies(self: string, rival: string): string[] {
  return RIVALRY_SIDES.map((body) => body.replaceAll("{self}", self).replaceAll("{rival}", rival));
}

/**
 * Fans reacting to a couple's story (7b-couples), Tier 1 like the rivalry sides. `{self}` is the
 * poster, `{partner}` the other one. Shipping while it is sweet, worried when it is rocky, sad at the end.
 */
const COUPLE_REACTIONS: Record<"flirt" | "sweet" | "rocky" | "over", readonly string[]> = {
  flirt: [
    "wait are {self} and {partner} a thing??",
    "the comment section between these two 👀",
    "I ship it. I ship it so hard",
    "{partner} in the likes again, hmm",
    "just say it already",
  ],
  sweet: [
    "{self} and {partner} are my favourite couple now",
    "the launch I needed today 😭",
    "protect them at all costs",
    "ok this is actually cute",
    "couple goals, not even joking",
    "{partner} is so lucky tbh",
    "I KNEW IT",
    "wait since when??",
  ],
  rocky: [
    "uh oh… trouble in paradise?",
    "this is about {partner}, right?",
    "sending hugs, whatever it is",
    "team {self}, always",
    "they'll be fine. right? RIGHT?",
  ],
  over: [
    "not them breaking up 💔",
    "I'm actually sad about this",
    "{self} deserves the world",
    "the end of an era",
    "take care of yourself ❤️",
    "wait what happened??",
  ],
};

/**
 * Some fans take it personally (U, user: parasocial): a launch, a date or the partner showing up in a
 * post stings them. Mixed in with the sweet ones, so a few comments sound hurt, never all.
 */
const PARASOCIAL = [
  "wait so {self} is taken now?? 😭",
  "I thought we had something tbh",
  "unsubscribing. (I'm not)",
  "why does this hurt me personally",
  "{partner} better treat you right or else",
  "happy for you. I guess. 🙂",
] as const;

export function slurpCoupleReactionBodies(self: string, partner: string, moment: string): string[] {
  const mood =
    moment === "flirt"
      ? "flirt"
      : moment === "fight" || moment === "jealous"
        ? "rocky"
        : moment === "breakup" || moment === "pageClose" || moment === "movingOn"
          ? "over"
          : "sweet";
  const hurt = ["launch", "date", "cameo", "anniversary", "reunion"].includes(moment) ? PARASOCIAL : [];
  return [...COUPLE_REACTIONS[mood], ...hurt].map((body) =>
    body.replaceAll("{self}", self).replaceAll("{partner}", partner),
  );
}

/**
 * What a creator says back to a three-word comment.
 *
 * The other half of the free tier. A creator who never answers reads as a bot, but "obsessed 😍"
 * does not need a model to answer it — "🥺 thank you" is both what a real creator writes and the
 * whole of what the moment needs. Tier 2 keeps the model for comments that said something.
 */
const CREATOR_REPLIES = [
  "thank you 🥺",
  "you are too kind",
  "🥺🥺🥺",
  "this made my day",
  "stop it you",
  "thank you love",
  "ok this is so sweet",
  "aa thank you",
  "you always say the nicest things",
  "🥹 thank you",
  "means a lot honestly",
  "thank you for being here",
] as const;

export function slurpCreatorReaction(seed: string): string {
  return CREATOR_REPLIES[pickIndex(seed, "creator-reply", CREATOR_REPLIES.length)]!;
}

/** A Creator commenting under a fellow Creator's post (#1): a peer, not a fan. */
const CREATOR_PEER_COMMENTS = [
  "ok you ate this",
  "obsessed",
  "the way you always do this",
  "save some for the rest of us",
  "🔥🔥",
  "unfair honestly",
  "needed this today",
  "this one's my favorite",
  "teach me your ways",
  "😮‍💨",
  "the light in this?? 😍",
  "stop being so good at this",
] as const;

export function slurpCreatorPeerComment(seed: string): string {
  return CREATOR_PEER_COMMENTS[pickIndex(seed, "creator-peer", CREATOR_PEER_COMMENTS.length)]!;
}

/**
 * A creator writing to a fan who did not write first.
 *
 * The rapport model has measured silence since it shipped — a 21-day decay curve on exactly this
 * signal — and nothing ever acted on it. Somebody who used to talk to you every day going quiet
 * is the most legible thing in the whole relationship model, and it moved a number nobody saw.
 *
 * Two shapes, because two things happen on a real platform. `MISSED` is earned: it goes to
 * somebody with history who stopped turning up, and it only reads as sincere because it is rare.
 * `COLD` is the ordinary case — a creator with a slow afternoon messaging somebody who has done
 * nothing in particular. Both are Tier 1: the opener is canned, but the moment the fan answers,
 * the reply runs through the full direct-message path with rapport, arc, and recent posts. The
 * conversation is real even though the invitation was cheap.
 */
const MISSED = [
  "hey, you have been quiet lately. everything ok?",
  "you disappeared on me. how have you been?",
  "not seen you around in a bit. hope things are alright",
  "was just thinking about you. where did you go?",
  "you used to be in here all the time. miss you",
  "checking in. you have been away a while",
] as const;

const COLD = [
  "hey you 🙂",
  "hope your day is going ok",
  "just saying hi",
  "you have been lovely lately, wanted you to know",
  "thanks for sticking around, genuinely",
  "hi 🙂 hope I am not interrupting anything",
  "was doing a round of hellos. hello",
] as const;

export function slurpCreatorOpener(seed: string, kind: "missed" | "cold"): string {
  const bank = kind === "missed" ? MISSED : COLD;
  return bank[pickIndex(seed, `creator-dm-${kind}`, bank.length)]!;
}

/**
 * Why somebody stopped paying, in words.
 *
 * A lapse was silent: the tie moved to `lapsed` and the player saw a name with no reason attached,
 * which is the least useful shape a loss can have. The reason is already known at the point of the
 * decision — the price went past what they will pay, they stopped turning up, or they simply
 * drifted — so saying it costs nothing and is the difference between a number moving and something
 * happening.
 *
 * Tone-aware, because this is the one place the audience gets to be unkind. A warm audience loses
 * people quietly; an unfiltered one says why on the way out. `warm` is never allowed a cruel line,
 * whatever the reason: that is the promise the setting makes.
 */
const LAPSE_NOTES: Record<"price" | "quiet" | "drift", Record<"warm" | "blunt", readonly string[]>> = {
  price: {
    warm: [
      "cannot stretch to the subscription this month, sorry",
      "the price is a bit much for me right now",
      "pausing this one until money is easier",
    ],
    blunt: [
      "not paying that much for it",
      "the price went up and I did not",
      "was fine at the old price. not at this one",
    ],
  },
  quiet: {
    warm: ["been away from here for a while", "not been around much lately", "life got busy, stepping back"],
    blunt: ["nothing new worth staying for", "gone quiet, so have I", "there stopped being a reason to check"],
  },
  drift: {
    warm: [
      "off to spend my coins elsewhere for a bit",
      "still lovely, just not for me at the moment",
      "moving on, no hard feelings",
    ],
    blunt: ["not into it any more", "was good while it lasted", "found other things to follow"],
  },
};

export type SlurpLapseReason = "price" | "quiet" | "drift";

export function slurpLapseNote(seed: string, reason: SlurpLapseReason, tone: SlurpAudienceTone): string {
  const bank = LAPSE_NOTES[reason][tone === "warm" ? "warm" : "blunt"];
  return bank[pickIndex(seed, `lapse-${reason}`, bank.length)]!;
}
