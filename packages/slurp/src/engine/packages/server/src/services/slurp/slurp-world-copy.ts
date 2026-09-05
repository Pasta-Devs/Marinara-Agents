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
