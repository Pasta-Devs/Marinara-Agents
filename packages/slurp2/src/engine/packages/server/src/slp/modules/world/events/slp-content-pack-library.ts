/**
 * The content packs the player switches on and off in Backstage › Packs: events with dates, the
 * moments each one brings, and storylines. Data only; the rules live in `slp-content-packs.ts`
 * (which packs are on, how they join the libraries) and `feed/slp-occasion-beats.ts` (which moment
 * a Creator posts about, and whether it fits them at all).
 *
 * Lines say what happens, never how it is told: the flavour brief (7b0) makes each Creator tell it
 * their own way, the spice rules decide how far a post goes, and the purpose planner decides
 * whether it is a tease, a drop or a Story. `{partner}` is the Creator's couple partner, `{collab}`
 * someone they collab with; a line that needs one is only used when there is one.
 */
import type { SlpFit } from "../../../../../../shared/src/slp/slp-drama.js";
import type { SlpExplicitLevelName } from "../../../../../../shared/src/slp/slp-spice.js";
import type { SlurpBeatType } from "../../feed/slp-post-beat.js";
import type { SlpStoryline } from "../../../../../../shared/src/slp/slp-storyline.js";
import { SLURP_FAMILY_PACK } from "./slp-family-pack.js";
import { SLURP_KINK_PACKS } from "./slp-kink-packs.js";

export type SlurpPackLevel = Exclude<SlpExplicitLevelName, "none">;

/**
 * Whether something fits a Creator. Never softened: when it does not fit, it is skipped.
 * `needs`: the card, tags or anchors must say this. `topic`: a card "never / hates" sentence (or a
 * steering leave-out topic) about it rules it out. `level`: the Creator's spice level must reach it.
 * `hardNo`: a hard no sharing a word with one of these rules it out.
 */
export type SlurpPackFit = SlpFit;

export type SlurpPackBeat = {
  type: SlurpBeatType;
  line: string;
  /** Used instead when the Creator is in a couple. */
  withPartner?: string;
  /** Used instead when the Creator collabs with someone. */
  withCollab?: string;
  /** Only for a Creator at this spice level or above; the others skip this moment. */
  level?: SlurpPackLevel;
  /** Due this many days into the event (6.75: the evening of the seventh day). Missing: spread evenly. */
  atDay?: number;
};

export type SlurpPackEvent = {
  contentId: string;
  name: string;
  /** What the whole platform feels while it runs (every Creator's prompt, "where it fits"). */
  guidance: string;
  month: number;
  day: number;
  days: number;
  storyTags: string[];
  fit: SlurpPackFit;
  /** The moments, in order, spread over the event's days. */
  beats: SlurpPackBeat[];
};

export type SlurpPackArc = {
  contentId: string;
  name: string;
  description: string;
  /** [label, min days, max days, poll]. A poll is a real fan vote; the chapter after follows the winner. */
  chapters: (readonly [string, number, number, { question: string; options: string[] }?])[];
  fit: SlurpPackFit;
  once?: boolean;
  storyTags: string[];
};

/** Moments a pack adds to a date another pack already owns (the core holidays), by that event's id. */
export type SlurpPackDateBeats = { name: string; fit: SlurpPackFit; beats: SlurpPackBeat[] };

export type SlurpContentPack = {
  id: string;
  name: string;
  /** One line: what switching it on adds. */
  adds: string;
  defaultOn: boolean;
  events: SlurpPackEvent[];
  arcs: SlurpPackArc[];
  /** Storylines run by the drama runtime while the pack is on (docs/STORYLINES.md, PR 6). */
  storylines?: SlpStoryline[];
  dateBeats?: Record<string, SlurpPackDateBeats>;
  /** Each Creator's own birthday (from their card, else a steady day of their own). */
  birthday?: true;
  /** The first 1,000 subscribers, celebrated once when it really happens. */
  firstThousandSubs?: true;
};

const CROWDS = [
  "crowd",
  "crowds",
  "convention",
  "conventions",
  "cons",
  "people",
  "going out",
  "leaving the house",
  "fans in person",
  "meet fans",
  "meeting fans",
];
const STUDENT = [
  "student",
  "studies",
  "studying",
  "study",
  "uni",
  "university",
  "college",
  "campus",
  "exam",
  "exams",
  "semester",
  "lecture",
  "lectures",
  "thesis",
  "degree",
  "school",
  "studium",
  "studentin",
  "klausur*",
  "prüfung*",
];
const TOYS = ["toys", "dildo", "vibrator"];

export const SLURP_CONTENT_PACK_LIBRARY: readonly SlurpContentPack[] = [
  {
    id: "slurp-pack-slurpcon",
    name: "SlurpCon",
    adds: "The yearly creator convention: booths, cosplay, fan meet-ups and the afterparty, plus meet & greets.",
    defaultOn: true,
    events: [
      {
        contentId: "slurpcon",
        name: "SlurpCon",
        guidance:
          "SlurpCon is on: the big adult creator convention. Booths, cosplay, fan meet-ups, signing lines and a famous afterparty. Half the feed is there or wishes it were.",
        month: 8,
        day: 14,
        days: 4,
        storyTags: ["convention", "community", "performance"],
        fit: { topic: CROWDS },
        beats: [
          {
            type: "anticipation",
            line: "SlurpCon opens today and you are setting up your booth: what goes on the table, what you wear, what you brought for the fans.",
            withCollab:
              "SlurpCon opens today and you are sharing a booth with {collab} this year, setting it up together.",
          },
          {
            type: "showcase",
            line: "Your SlurpCon cosplay is finished and today is the reveal. Show it off properly.",
          },
          {
            type: "social_moment",
            line: "You meet fans in person at your SlurpCon booth: the line, the nerves, the one who brought you a gift.",
          },
          {
            type: "tease_flirt",
            line: "The SlurpCon afterparty. Everybody is out of costume and into something else, and the night gets away from you.",
            withPartner:
              "The SlurpCon afterparty with {partner}. The two of you slip out early, and the night is yours.",
          },
          {
            type: "sensory_mood",
            line: "SlurpCon is over. You are home, sore feet, a bag full of fan gifts, and still buzzing.",
          },
        ],
      },
    ],
    arcs: [
      {
        contentId: "fan-meet-greet",
        name: "Fan meet & greet",
        description:
          "The Creator plans a small meet & greet with fans, lets them pick where, meets them, and posts the photos after.",
        chapters: [
          [
            "announcing the meet & greet",
            1,
            3,
            { question: "Where should the meet & greet be?", options: ["A cosy café", "A bar after dark"] },
          ],
          ["getting ready and a little nervous", 1, 3],
          ["the meet & greet", 1, 1],
          ["the photos and the thank-yous", 1, 3],
        ],
        fit: { topic: CROWDS },
        storyTags: ["community", "fans"],
      },
    ],
  },
  {
    id: "slurp-pack-awards",
    name: "Creator awards",
    adds: "The Slurpies: nominations, fans voting, a red-carpet look and awards night.",
    defaultOn: true,
    events: [
      {
        contentId: "slurpies",
        name: "The Slurpies",
        guidance:
          "The Slurpies, Slurp's creator awards, are this week. Nominations, fan votes, red-carpet looks and a lot of speculation about who wins.",
        month: 11,
        day: 20,
        days: 3,
        storyTags: ["awards", "performance"],
        fit: {},
        beats: [
          { type: "anticipation", line: "The Slurpies are this week and you are picking your red-carpet look." },
          {
            type: "showcase",
            line: "Awards night at the Slurpies: the red-carpet look, the room, the moment the names are read.",
            withPartner: "Awards night at the Slurpies with {partner} on your arm: the look, the room, the names.",
          },
          {
            type: "sensory_mood",
            line: "The morning after the Slurpies. Whatever happened last night, you have thoughts.",
          },
        ],
      },
    ],
    arcs: [
      {
        contentId: "nominated",
        name: "Nominated",
        description: "The Creator is nominated for a Slurpie, asks fans to vote, and finds out on awards night.",
        chapters: [
          ["the nomination comes in", 1, 2],
          [
            "asking fans to vote",
            2,
            5,
            {
              question: "Which clip should go in for the award?",
              options: ["The one that went viral", "The fan favourite"],
            },
          ],
          ["awards night", 1, 1],
          ["winning or not, and what comes after", 1, 3],
        ],
        fit: {},
        once: false,
        storyTags: ["awards", "career"],
      },
    ],
  },
  {
    id: "slurp-pack-holidays",
    name: "Holiday specials",
    adds: "Valentine's sets, Halloween costumes, Pride month and the New Year countdown, each in the Creator's own way.",
    defaultOn: true,
    events: [
      {
        contentId: "pride",
        name: "Pride month",
        guidance: "It is Pride month. Colour, parades, community and people being loudly themselves.",
        month: 6,
        day: 1,
        days: 30,
        storyTags: ["community", "pride"],
        fit: { topic: ["pride"] },
        beats: [
          { type: "showcase", line: "A Pride look of your own: your colours, your way." },
          {
            type: "social_moment",
            line: "You go to the Pride parade and the whole day is loud, sweaty and happy.",
            withPartner: "You go to the Pride parade with {partner}, loud, sweaty and happy all day.",
          },
        ],
      },
    ],
    arcs: [],
    dateBeats: {
      valentines: {
        name: "Valentine's Day",
        fit: {},
        beats: [
          {
            type: "tease_flirt",
            line: "Valentine's Day: you made a special set for your fans, a little gift from you.",
            withPartner: "Valentine's Day with {partner}: a date, a gift, and a special set for your fans later.",
          },
        ],
      },
      halloween: {
        name: "Halloween",
        fit: { topic: ["halloween", "costume", "costumes", "dress up", "dressing up"] },
        beats: [
          {
            type: "anticipation",
            line: "You are deciding on your Halloween costume, and it is between two.",
            atDay: 0,
          },
          { type: "showcase", line: "Your Halloween costume is done. Today is the reveal.", atDay: 3 },
          {
            type: "social_moment",
            line: "Halloween night: out in costume.",
            withPartner: "Halloween night with {partner}, both in costume.",
            // The evening of the last day.
            atDay: 6.75,
          },
        ],
      },
      "new-years-eve": {
        name: "New Year's Eve",
        fit: {},
        beats: [
          {
            type: "social_moment",
            line: "New Year's Eve: the countdown, the kiss at midnight or the lack of one.",
            withPartner: "New Year's Eve with {partner}: the countdown and the kiss at midnight.",
            atDay: 0.75,
          },
        ],
      },
      "new-year": {
        name: "New Year",
        fit: {},
        beats: [{ type: "sensory_mood", line: "The first day of the year: slow morning, one resolution you mean." }],
      },
    },
  },
  {
    id: "slurp-pack-seasons",
    name: "Seasons of life",
    adds: "Summer body season, exam weeks, each Creator's birthday week and their first 1,000 subscribers.",
    defaultOn: true,
    birthday: true,
    // Decision after the merge (2026-09-28): a plain thank-you post, so it lives in a default-on pack.
    firstThousandSubs: true,
    events: [
      {
        contentId: "summer-body",
        name: "Summer body season",
        guidance: "Summer body season: gyms are full, everybody is planning beach days and new swimwear.",
        month: 5,
        day: 20,
        days: 21,
        storyTags: ["fitness", "summer"],
        fit: {
          topic: [
            "gym",
            "work out",
            "work outs",
            "workout",
            "workouts",
            "exercis*",
            "sport",
            "sports",
            "fitness",
            "diet*",
            "body",
          ],
        },
        beats: [
          { type: "achievement", line: "You are getting in shape for summer and today's session actually felt good." },
          { type: "showcase", line: "New swimwear for the summer. Time to try it on properly." },
        ],
      },
      {
        contentId: "exam-week-winter",
        name: "Winter exams",
        guidance: "Exam season: students are cramming, libraries are full and everyone is living on coffee.",
        month: 2,
        day: 1,
        days: 10,
        storyTags: ["study", "pressure"],
        fit: { needs: STUDENT, topic: STUDENT },
        beats: [
          { type: "sensory_mood", line: "Exam week. Notes everywhere, too much coffee, and no sleep.", atDay: 0 },
          { type: "achievement", line: "The last exam is done and you are finally free.", atDay: 8 },
        ],
      },
      {
        contentId: "exam-week-summer",
        name: "Summer exams",
        guidance: "Exam season: students are cramming, libraries are full and everyone is living on coffee.",
        month: 7,
        day: 1,
        days: 10,
        storyTags: ["study", "pressure"],
        fit: { needs: STUDENT, topic: STUDENT },
        beats: [
          { type: "sensory_mood", line: "Exam week. Notes everywhere, too much coffee, and no sleep.", atDay: 0 },
          { type: "achievement", line: "The last exam is done and you are finally free.", atDay: 8 },
        ],
      },
    ],
    arcs: [],
  },
  {
    id: "slurp-pack-spicy-firsts",
    name: "Spicy firsts",
    adds: "A Creator's first toy, first custom request, first explicit set, going fully explicit and a toy-review series.",
    // Decision after S (2026-09-28): the adult pack starts off; the player switches it on.
    defaultOn: false,
    events: [],
    arcs: [
      {
        contentId: "first-toy",
        name: "The first toy",
        description:
          "The Creator buys their first dildo: working up to it, letting fans pick, the unboxing, and trying it on camera.",
        chapters: [
          ["thinking about buying a first toy", 1, 3],
          [
            "letting fans pick the toy",
            1,
            3,
            { question: "Which one should I get?", options: ["Something small to start", "Go big or go home"] },
          ],
          ["the package arrives: the unboxing", 1, 1],
          ["trying it for the first time, for the subscribers", 1, 2],
        ],
        fit: { level: "explicit", hardNo: TOYS, topic: ["toy", "toys", "dildo", "dildos", "vibrator", "vibrators"] },
        once: true,
        storyTags: ["spicy", "toys"],
      },
      {
        contentId: "first-custom",
        name: "The first custom request",
        description:
          "A fan asks for the Creator's first custom content: the request, the price, making it, delivering it.",
        chapters: [
          ["a fan asks for something made just for them", 1, 2],
          ["naming a price and saying yes", 1, 2],
          ["making the custom", 1, 3],
          ["delivering it and hearing back", 1, 2],
        ],
        fit: { topic: ["custom", "customs", "request", "requests"] },
        once: true,
        storyTags: ["spicy", "business"],
      },
      {
        contentId: "first-explicit-set",
        name: "The first explicit set",
        description:
          "The Creator shoots their first fully explicit set: the nerves, the tease, the drop, and the reaction.",
        chapters: [
          ["planning the first explicit set", 1, 3],
          ["teasing it for the fans", 1, 2],
          ["the drop", 1, 1],
          ["reading the reactions", 1, 3],
        ],
        fit: { level: "explicit" },
        once: true,
        storyTags: ["spicy", "set"],
      },
      {
        contentId: "going-explicit",
        name: "Going fully explicit",
        description:
          "The Creator decides the page goes fully explicit: the decision, telling the fans, the first posts, and the new normal.",
        chapters: [
          ["deciding to go fully explicit", 1, 3],
          ["telling the fans what is coming", 1, 2],
          ["the first fully explicit posts", 2, 4],
          ["the new normal on the page", 2, 5],
        ],
        fit: { level: "explicit" },
        once: true,
        storyTags: ["spicy", "career"],
      },
      {
        contentId: "toy-reviews",
        name: "Toy-review series",
        description:
          "A running series where the Creator tries toys and reviews them honestly, and fans pick the next one.",
        chapters: [
          ["announcing the toy-review series", 1, 2],
          ["the first review", 2, 4],
          [
            "fans pick the next toy",
            1,
            3,
            { question: "What should I review next?", options: ["A vibrator", "Something I have never tried"] },
          ],
          ["the next review", 2, 4],
          ["the series favourite", 1, 3],
        ],
        fit: { level: "explicit", hardNo: TOYS, topic: ["toy", "toys", "dildo", "dildos", "vibrator", "vibrators"] },
        storyTags: ["spicy", "toys"],
      },
    ],
  },
  SLURP_FAMILY_PACK,
  ...SLURP_KINK_PACKS,
];

/** The birthday moments: two days before, the day, and the day after. */
export const SLURP_BIRTHDAY_BEATS: readonly SlurpPackBeat[] = [
  { type: "anticipation", line: "Your birthday is almost here and you are planning something for it." },
  {
    type: "social_moment",
    line: "It is your birthday today.",
    withPartner: "It is your birthday today, and {partner} has plans for you.",
  },
  { type: "showcase", line: "A birthday set, a little present from you to the fans who remembered." },
];

export const SLURP_FIRST_THOUSAND_SUBS_BEAT: SlurpPackBeat = {
  type: "achievement",
  line: "You just passed 1,000 subscribers. Your first thousand. Celebrate it with the people who got you here.",
};
