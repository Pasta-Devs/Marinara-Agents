/**
 * A Creator who is with the player texts like a partner (Drama, "the player as a partner"): a few
 * times a day, on her own, about her day, her work and the two of them. Pure: code decides when and
 * what about; the message itself is written by the follow-up writer as an opener, in her voice.
 *
 * - **Pace by stage.** Together: every five hours or so; dating: less; a crush: now and then; after
 *   a fight (rocky): rarely, and it shows. A pending message or an unanswered one comes first.
 * - **By the clock.** Morning, day, evening and late-night reasons, in the Creator's own hours.
 * - **Seeded.** The same pair at the same hour decides the same way.
 */
import { hash } from "../projects/slp-project.js";
import type { SlurpCouple } from "../projects/slp-creator-couples.js";

const HOUR = 3_600_000;

export type SlurpPartnerStage = "sparks" | "dating" | "together" | "rocky";

/** Hours between her texts, and the percent chance once that long has passed (per hourly look). */
export const SLURP_PARTNER_TEXT_PACE: Record<SlurpPartnerStage, { gapHours: number; chance: number }> = {
  together: { gapHours: 5, chance: 35 },
  dating: { gapHours: 7, chance: 30 },
  sparks: { gapHours: 14, chance: 20 },
  rocky: { gapHours: 16, chance: 20 },
};

/** Written to the Creator, like the check-in reasons: "you" is her, "them" is her partner. */
const REASONS: Record<"morning" | "day" | "evening" | "night" | "rocky" | "sparks", readonly string[]> = {
  morning: [
    "You just woke up and your partner is the first thing on your mind. Send a good-morning text, short and warm.",
    "You had a dream about your partner last night. Tell them about it.",
    "Ask your partner how they slept, and say you miss waking up next to them.",
  ],
  day: [
    "Send your partner a little update about your day, the kind you only tell them.",
    "You are in the middle of work and thinking about your partner. Say so.",
    "Tease your partner about something you are about to post.",
    "Ask your partner if they have eaten, a little bossy and sweet.",
    "Something you saw reminded you of your partner. Tell them.",
  ],
  evening: [
    "Ask your partner what the two of you are doing tonight.",
    "Tell your partner you can't wait to see them.",
    "A long day is over. Send your partner something flirty.",
    "Tell your partner how your shoot went, and hint at the part you are keeping for them.",
  ],
  night: [
    "You can't sleep and you want to talk to your partner.",
    "A sleepy late-night text: you miss your partner.",
    "It is late and you feel bolder than in the daytime. Text your partner something you would not say at noon.",
  ],
  rocky: [
    "You are still a little hurt after your fight, but you reach out to your partner anyway.",
    "You want to talk things out with your partner. Start carefully.",
  ],
  sparks: ["Text your crush something flirty and pretend it is casual.", "Find an excuse to text your crush."],
};

/** Late at night, for a Creator whose level goes that far: she says what she wants, in private. */
/** Her public side, for a Creator whose level goes that far: her fans see her too, and her partner knows. */
const PUBLIC_HEAT: readonly string[] = [
  "You just posted something revealing for your fans. Tell your partner before they find it, and tease them about who else is looking.",
  "A fan left a bold comment on your latest post. Tell your partner what they said, and see how they take it.",
  "Your newest post is getting a lot of attention. Ask your partner what they think of everyone seeing you like that.",
];

const NIGHT_HEAT: readonly string[] = [
  "You are in bed and cannot stop thinking about your partner. Tell them exactly what you would do if they were here.",
  "You just got out of the shower and you are thinking about your partner. Describe it, and make them want to be there.",
  "It is late and you want your partner. Say it plainly, the way you only say it to them.",
];

/**
 * What happened to the two of them that she has not texted about yet: news comes before the ordinary
 * pace (dates with you: an invite on the day, a recap the morning after). `lastMessageAt`: the chat's
 * newest message, so news the two already talked about is not news any more. Null: nothing new.
 */
export function slurpPartnerNews(couple: SlurpCouple, at: Date, lastMessageAt: string | null): string | null {
  const since = lastMessageAt ? Date.parse(lastMessageAt) : 0;
  const age = (iso: string) => (at.getTime() - Date.parse(iso)) / HOUR;
  for (const moment of [...couple.moments].reverse()) {
    const hours = age(moment.at);
    if (hours < 0 || hours > 36) continue;
    const detail = moment.detail ? ` (${moment.detail})` : "";
    if (moment.kind === "date" && hours < 12 && Date.parse(moment.at) > since)
      return `You two have a date today${detail}. Ask your partner out for it, a little excited, and say what you are looking forward to.`;
    if (moment.kind === "date" && hours >= 12 && since < Date.parse(moment.at) + 12 * HOUR)
      return `Your date last night${detail} is still on your mind. Tell your partner what you liked most, and what you want next time.`;
    if (Date.parse(moment.at) <= since) continue;
    if (moment.kind === "anniversary")
      return `Today is your ${moment.detail || "anniversary"} with your partner. Text them about it, the way you would.`;
    // A secret has no public launch to talk about.
    if (moment.kind === "launch" && !couple.secret)
      return "You just made it official in public. Tell your partner how it feels, and what your fans are saying.";
    if (moment.kind === "makeup")
      return "You two made up after the fight. Tell your partner how you feel about them now.";
    if (moment.kind === "reunion") return "You are back together. Text your partner like you mean it this time.";
  }
  return null;
}

const part = (hour: number) =>
  hour < 5 ? "night" : hour < 11 ? "morning" : hour < 17 ? "day" : hour < 22 ? "evening" : "night";

/**
 * Whether she texts now, and about what. Null: not now. `hour` is her local hour (0-23);
 * `hoursSinceLast` counts from her last text to the player or his last message, whichever is later.
 */
export function slurpPartnerText(input: {
  pairKey: string;
  stage: SlurpPartnerStage;
  hour: number;
  hoursSinceLast: number | null;
  /** Something is already planned for this chat, or she still owes an answer. */
  busy: boolean;
  /** The hour this look is for (a whole-hour number), so one hour decides once. */
  slot: number;
  /** `slurpPartnerNews`: something new between the two of them; it does not wait for the pace. */
  news?: string | null;
  /** Her level goes to nudity or further: late at night she can say what she wants. */
  heat?: boolean;
}): string | null {
  if (input.busy) return null;
  if (input.news) return input.news;
  const pace = SLURP_PARTNER_TEXT_PACE[input.stage];
  if (input.hoursSinceLast !== null && input.hoursSinceLast < pace.gapHours) return null;
  if (hash(`${input.pairKey}:${input.slot}:partner-text`) % 100 >= pace.chance) return null;
  const time = part(input.hour);
  const pool =
    input.stage === "rocky"
      ? REASONS.rocky
      : input.stage === "sparks"
        ? REASONS.sparks
        : time === "night" && input.heat
          ? [...REASONS.night, ...NIGHT_HEAT]
          : (time === "day" || time === "evening") && input.heat
            ? [...REASONS[time], ...PUBLIC_HEAT]
            : REASONS[time];
  return pool[hash(`${input.pairKey}:${input.slot}:partner-why`) % pool.length]!;
}
