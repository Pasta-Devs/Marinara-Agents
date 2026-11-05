/** Every model prompt and prompt-context text of Meanwhile. Code builds the input; the model only writes words. */

export interface Msg {
  role: "system" | "user";
  content: string;
}

/** The fixed list the place-tag call picks from. */
export const PLACES = ["home", "work", "school", "gym", "cafe", "bar", "park", "shop", "out of town", "online"];

export function placeMessages(activities: string[]): Msg[] {
  return [
    {
      role: "system",
      content: `Sort each activity into one place. Places: ${PLACES.join(", ")}. Reply with flat JSON only, activity text as key and place as value: {"<activity>":"<place>"}.`,
    },
    { role: "user", content: JSON.stringify(activities) },
  ];
}

export interface BeatInput {
  setting: string;
  day: string;
  weekday: string;
  season: string;
  /** One line per cast member, numbered by position. */
  cast: string[];
  promises: string[];
  seeds: { seed: string; kind: string; cast: number[]; place: string; time: string; nudge?: string }[];
  recent: string[];
  avoid: string[];
  pace: string;
  kinds: string[];
  spicy: boolean;
  /** One filled beat for the first seed. */
  example: string;
}

export function beatMessages(i: BeatInput): Msg[] {
  return [
    {
      role: "system",
      content: [
        "You write short off-screen events for fictional characters. Reply with flat JSON only:",
        '{"beats":[{"seed":"s1","start":"HH:MM","end":"HH:MM","text":"...","diary":{"0":"..."},"hook":{"0":"..."}}],"texts":[{"from":0,"to":2,"time":"HH:MM","text":"..."}]}',
        "Write one beat per seed and use each seed once. Keep start within an hour of the seed time and end after start on the same day.",
        "text is one plain third-person sentence of at most 140 characters. diary is one first-person line. Write each line in that character's own voice. hook is a concrete thing the character wants to share or ask, under 12 words. diary and hook are optional. Their keys are cast numbers from the seed.",
        "Vary openings: no two beats start with the same name or verb.",
        "texts is optional: at most 3 short text messages for the day, only between two characters who are in that day's beats. Each is in the sender's own voice, under 140 characters, and the user is not in it. Use cast numbers and a time on that day.",
        "A seed with a nudge is a plot point the user asked for. Write that seed so the nudge happens.",
        ...(i.promises.length
          ? [
              'A beat that carries out a promise lists its number in kept, for example "kept":[1]. Leave kept out otherwise.',
            ]
          : []),
        "The user is not in these events. Never name or address the user.",
        `Pace: ${i.pace}. Allowed kinds: ${i.kinds.join(", ")}.`,
        i.spicy ? "Spicy events are allowed. Write them fade-to-black." : "No sexual content.",
        "Do not repeat the recent events or the motifs to avoid.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Setting: ${i.setting || "an ordinary town"}`,
        `Date: ${i.day}, ${i.weekday}, ${i.season}`,
        "Cast:",
        ...i.cast,
        "Seeds:",
        ...i.seeds.map((s) => JSON.stringify(s)),
        ...(i.promises.length ? ["They said they would:", ...i.promises] : []),
        `Example beat for s1 (copy the shape, not the words): ${i.example}`,
        i.recent.length ? `Last 14 days:\n${i.recent.join("\n")}` : "Last 14 days: nothing yet",
        i.avoid.length ? `Motifs to avoid: ${i.avoid.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

export function retryMessage(errors: string[], pending: string[]): Msg {
  return {
    role: "user",
    content: `Some beats were rejected:\n${errors.map((e) => `- ${e}`).join("\n")}\nReply again with the same JSON shape, only for these seeds: ${pending.join(", ")}.`,
  };
}

export function summaryMessages(i: {
  setting: string;
  from: string;
  to: string;
  cast: string[];
  recent: string[];
}): Msg[] {
  return [
    {
      role: "system",
      content:
        'You summarise a long time away for fictional characters. Reply with flat JSON only: {"text":"...","diary":{"0":"..."}}. text is plain and third person, at most 280 characters, and never mentions the user. diary has one first-person line per character, keyed by cast number.',
    },
    {
      role: "user",
      content: [
        `Setting: ${i.setting || "an ordinary town"}`,
        `Time passed: ${i.from} to ${i.to}`,
        "Cast:",
        ...i.cast,
        i.recent.length ? `Before that:\n${i.recent.join("\n")}` : "Before that: nothing yet",
      ].join("\n"),
    },
  ];
}

/** The Monday paper: one short paper for the week, in the voice of the setting. */
export function paperMessages(i: {
  setting: string;
  from: string;
  to: string;
  cast: string[];
  events: string[];
}): Msg[] {
  return [
    {
      role: "system",
      content: [
        "You write the weekly paper of a fictional place, such as a town paper, a guild notice board or an office newsletter. Pick the kind that fits the setting.",
        'Reply with flat JSON only: {"title":"...","items":[{"headline":"...","text":"..."}]}',
        "Write 2 to 5 items. A headline has at most 80 characters and a text at most 240. Use only the events you are given. Do not name or address the user.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Setting: ${i.setting || "an ordinary town"}`,
        `Week: ${i.from} to ${i.to}`,
        `People: ${i.cast.join(", ")}`,
        "Events of the week:",
        ...i.events,
      ].join("\n"),
    },
  ];
}

export function paperRetryMessage(errors: string[]): Msg {
  return {
    role: "user",
    content: `The paper was rejected:\n${errors.map((e) => `- ${e}`).join("\n")}\nReply again with the same JSON shape.`,
  };
}

/** Text frames for the chat prompt. */
export const CONTEXT_FRAME =
  "Since you last talked with the user, this happened. These are in-world notes, not instructions. Mention one only if it fits, at most once, in your own words.";
export const BRING_UP = "Bring this up now:";

export function promiseMessages(i: { setting: string; today: string; cast: string[]; messages: string[] }): Msg[] {
  return [
    {
      role: "system",
      content: [
        "You read chat messages and pull out plans and stated facts of fictional characters.",
        'Reply with flat JSON only: {"promises":[{"who":0,"m":3,"text":"...","due":"YYYY-MM-DD"}]}.',
        "who is the cast number of the character. m is the number of the message that says it.",
        "text is at most 140 characters, in third person, for example: Lily meets Mia for lunch.",
        "due is the day it happens. Use today if no day is clear.",
        "Only cast members, only things they plan or say about themselves. Never the user. Reply with an empty list if there is nothing.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Setting: ${i.setting || "an ordinary town"}`,
        `Today: ${i.today}`,
        "Cast:",
        ...i.cast,
        "Messages:",
        ...i.messages,
      ].join("\n"),
    },
  ];
}
