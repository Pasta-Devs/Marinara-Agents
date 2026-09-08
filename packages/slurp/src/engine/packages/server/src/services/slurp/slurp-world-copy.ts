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

const COMMISSION_OPENERS = [
  "Would you take a request?",
  "Hoping you have space for a commission.",
  "Not sure if you do these, but",
  "Been saving up for this one.",
  "If your list is open,",
  "Long shot, but",
] as const;

const COMMISSION_ASKS = [
  "something soft, whatever direction you feel like taking it",
  "something in your usual style, but just for me",
  "a set built around one idea, your pick of which",
  "something a bit moodier than your last few",
  "whatever you have been wanting to make and have not yet",
  "something I can keep for myself rather than scroll past",
  "a piece with the feel of your older work",
] as const;

const COMMISSION_CLOSERS = [
  "No rush at all.",
  "Take your time with it.",
  "Say a price and I will send it over.",
  "Happy to wait for a slot.",
  "Whatever you think is fair.",
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
export function slurpCommissionBrief(seed: string): string {
  return [
    COMMISSION_OPENERS[pickIndex(seed, "opener", COMMISSION_OPENERS.length)]!,
    COMMISSION_ASKS[pickIndex(seed, "ask", COMMISSION_ASKS.length)]!,
    COMMISSION_CLOSERS[pickIndex(seed, "closer", COMMISSION_CLOSERS.length)]!,
  ].join(" ");
}

/** One question for a post. */
export function slurpAudienceQuestion(seed: string): string {
  return QUESTIONS[pickIndex(seed, "question", QUESTIONS.length)]!;
}

/**
 * An opening line from somebody who has never written before.
 *
 * Same rule as the commission briefs: vague on purpose. A first message that pretends to know
 * something specific about a post it has not read is worse than one that simply says hello.
 */
const OPENERS = [
  "hi — been reading for a while, finally said something",
  "hope it is ok to message. just wanted to say I like what you do",
  "you probably get this a lot but you seem genuinely nice",
  "not asking for anything, just wanted to say hi",
  "been meaning to write for weeks and kept chickening out",
  "hey. long time reader, first time writing",
  "sorry to appear out of nowhere. your last few posts got me",
  "is it weird to message? felt weird not to",
] as const;

export function slurpAudienceOpener(seed: string): string {
  return OPENERS[pickIndex(seed, "opener-dm", OPENERS.length)]!;
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
  const bodies = extraBodies.length > 0 ? [...SLURP_SHIPPED_REACTIONS, ...extraBodies] : SLURP_SHIPPED_REACTIONS;
  const opener = REACTION_OPENERS[pickIndex(seed, "reaction-open", REACTION_OPENERS.length)]!;
  const body = bodies[pickIndex(seed, "reaction", bodies.length)]!;
  const tail = REACTION_TAILS[pickIndex(seed, "reaction-tail", REACTION_TAILS.length)]!;
  return `${opener ? `${opener} ` : ""}${body}${tail}`;
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
