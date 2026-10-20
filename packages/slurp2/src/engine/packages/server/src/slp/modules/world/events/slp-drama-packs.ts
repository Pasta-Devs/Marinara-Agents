/**
 * The situations and dramas Slurp ships (`docs/DRAMA.md`, starter set). Every one is off until the
 * player switches it on in Settings › Stir › Drama. Written as data and validated by the same schema
 * as an imported pack, so a built-in can never do what a pack could not.
 *
 * Heat first: every post beat is the one line of *why* on top of an ordinary spicy post, never the
 * story so far. Most of a drama lives in DMs, comments and notifications. `{role}` is that role's name.
 */
import {
  slpDramaSchema,
  slpSituationSchema,
  type SlpDrama,
  type SlpSituation,
} from "../../../../../../shared/src/slp/slp-drama.js";

const situation = (value: Record<string, unknown>): SlpSituation =>
  slpSituationSchema.parse({ ...value, builtin: true });
const drama = (value: Record<string, unknown>): SlpDrama => slpDramaSchema.parse({ ...value, builtin: true });

const her = { key: "her", needs: { relationToPlayer: ["partner"] } };
const you = { key: "you", player: true };

export const SLURP_BUILTIN_SITUATIONS: readonly SlpSituation[] = [
  situation({
    id: "partner-is-creator",
    name: "Your partner is a Creator",
    description:
      "The Creator you are with posts like everyone here. Their fans, their tips, their DMs about work, and you in the middle of it.",
    roles: [her, you],
    dials: [
      { key: "audience-knows", options: ["yes", "rumoured", "no"], default: "yes" },
      { key: "tone", options: ["warm", "playful", "cold"], default: "playful" },
    ],
    perDay: 2,
    deck: [
      {
        role: "her",
        channel: "dm",
        to: "you",
        seed: "a fan just tipped big for {her:his} newest set; tells you, half proud, half teasing",
      },
      {
        role: "her",
        channel: "dm",
        to: "you",
        seed: "{her:his} top fan asked for something custom again; asks what you think",
        chance: 70,
      },
      {
        role: "her",
        channel: "dm",
        to: "you",
        seed: "asks if you saw {her:his} new post, and whether you liked it",
        when: { tone: "warm" },
      },
      {
        role: "her",
        channel: "dm",
        to: "you",
        seed: "bets you watched {her:his} new post more than once",
        when: { tone: "playful" },
      },
      {
        role: "her",
        channel: "dm",
        to: "you",
        seed: "reminds you, a little cool, that you are not the only one who watches",
        when: { tone: "cold" },
      },
      {
        role: "crowd",
        channel: "comment",
        on: "her",
        when: { "audience-knows": "yes" },
        lines: [
          "lucky {you-man}",
          "does your {you-bf} see these? 👀",
          "tell {you-him} to share 😏",
          "your {you-bf} is winning at life",
        ],
      },
      {
        role: "crowd",
        channel: "comment",
        on: "her",
        when: { "audience-knows": "rumoured" },
        lines: [
          "who is the {you-man} in your stories?",
          "are you seeing someone?? 👀",
          "the hoodie is not yours, is it",
        ],
      },
      {
        role: "crowd",
        channel: "comment",
        on: "her",
        when: { "audience-knows": "no" },
        lines: ["marry me", "are you single??", "please be single 🙏", "I'd treat you better than anyone"],
      },
      {
        role: "her",
        channel: "notification",
        seed: "{her}'s new set is up, and {her:his} fans are unlocking it fast",
        chance: 60,
      },
      { role: "her", channel: "money", to: "you", amount: { min: 10, max: 30 }, chance: 15 },
    ],
  }),
  situation({
    id: "roommates",
    name: "Roommates",
    description:
      "Two Creators who share a flat: shared mirrors, shared shots, and the one who hears everything through the wall.",
    roles: [{ key: "a" }, { key: "b", needs: { tiedTo: { role: "a", kinds: ["roommate"] } } }],
    dials: [],
    perDay: 1,
    deck: [
      {
        role: "b",
        channel: "comment",
        on: "a",
        lines: ["I heard you taking these 🙄", "that's MY mirror", "so that's why the bathroom was locked for an hour"],
      },
      {
        role: "a",
        channel: "comment",
        on: "b",
        lines: [
          "you borrowed that top without asking",
          "the landlord is going to see this",
          "we live together and I still found out from the feed",
        ],
      },
      { role: "a", channel: "notification", seed: "{a} and {b} posted from the same flat again" },
    ],
  }),
];

export const SLURP_BUILTIN_DRAMAS: readonly SlpDrama[] = [
  drama({
    id: "rivals",
    name: "Rivals",
    description: "Two Creators in the same scene start a thirst-trap war. The fans pick a side.",
    roles: [
      { key: "a", needs: { minSpice: 1 } },
      { key: "b", needs: { minSpice: 1, sharesNicheWith: "a" } },
    ],
    cooldownDays: 14,
    maxDays: 14,
    stages: [
      {
        key: "spark",
        days: [1, 2],
        beats: [
          {
            role: "b",
            channel: "comment",
            on: "a",
            lines: ["cute. I did it first though", "interesting choice 😊", "we get it"],
          },
        ],
      },
      {
        key: "one-up",
        days: [2, 4],
        beats: [
          { role: "a", channel: "post", heat: { line: "saw what someone posted. cute. anyway", for: "fans" } },
          {
            role: "b",
            channel: "post",
            heat: { line: "oh, we're doing this? fine.", for: "fans" },
            delayHours: [4, 12],
          },
          {
            role: "crowd",
            channel: "comment",
            on: "a",
            lines: ["team {a} 🔥", "{b} could never", "this is war and I'm here for it"],
          },
          {
            role: "crowd",
            channel: "comment",
            on: "b",
            lines: ["team {b}", "{a} is shaking rn", "the bar just went up"],
          },
          { role: "a", channel: "notification", seed: "{a} and {b} are one-upping each other on the feed" },
        ],
        choice: {
          asks: "fans",
          question: "Who wore it better, {a} or {b}?",
          options: [
            { label: "{a}", next: "crowned" },
            { label: "{b}", next: "crowned" },
          ],
          default: 0,
        },
        outcomes: [{ kind: "tie", tie: "rival", between: ["a", "b"] }],
      },
      {
        key: "crowned",
        days: [1, 2],
        beats: [{ role: "a", channel: "post", heat: { line: "the fans have spoken. for them.", for: "fans" } }],
      },
    ],
    exit: { role: "a", channel: "post", heat: { line: "truce. for now." } },
  }),
  drama({
    id: "top-fan",
    name: "Top fan",
    description: "A Creator notices you: always first, always there. Their content starts being made for you.",
    roles: [{ key: "her", needs: { minSpice: 1 } }, you],
    cooldownDays: 30,
    maxDays: 14,
    stages: [
      {
        key: "noticed",
        days: [1, 2],
        beats: [
          {
            role: "her",
            channel: "dm",
            to: "you",
            seed: "noticed you are always the first to like and comment; says it with a smile",
          },
        ],
      },
      {
        key: "for-you",
        days: [2, 4],
        minSpice: 2,
        beats: [
          {
            role: "her",
            channel: "post",
            heat: { line: "this one's for my favourite. you know who you are.", for: "you" },
          },
          {
            role: "crowd",
            channel: "comment",
            on: "her",
            lines: ["who's the favourite 👀", "I want to be the favourite", "someone's getting special treatment"],
          },
          {
            role: "her",
            channel: "dm",
            to: "you",
            seed: "asks if you liked the one {her:he} made for you",
            delayHours: [2, 8],
          },
        ],
      },
      {
        key: "thanks",
        days: [1, 3],
        beats: [
          { role: "her", channel: "money", to: "you", amount: { min: 10, max: 25 } },
          { role: "her", channel: "dm", to: "you", seed: "sent you a little thank-you for being there from the start" },
        ],
      },
    ],
    exit: { role: "her", channel: "dm", to: "you", seed: "tells you you are still {her:his} favourite" },
  }),
  drama({
    id: "friends-to-lovers",
    name: "Friends to lovers",
    description: "Two close friends whose duo posts start to feel like more. Everyone sees it before they do.",
    roles: [{ key: "a" }, { key: "b", needs: { tiedTo: { role: "a", kinds: ["friend"] } } }],
    cooldownDays: 30,
    maxDays: 21,
    stages: [
      {
        key: "closer",
        days: [2, 4],
        beats: [
          { role: "a", channel: "post", heat: { line: "a day with {b}. just friends. obviously.", with: "b" } },
          {
            role: "crowd",
            channel: "comment",
            on: "a",
            lines: ["just friends 😭", "the way you look at each other", "kiss already"],
          },
        ],
      },
      {
        key: "tension",
        days: [2, 4],
        minSpice: 2,
        beats: [
          {
            role: "b",
            channel: "post",
            heat: { line: "{a} took this one. didn't ask about the staring.", shotBy: "a" },
          },
          { role: "a", channel: "comment", on: "b", lines: ["you know why", "delete this 🙈", "…"] },
        ],
        choice: {
          asks: "role",
          role: "b",
          question: "Does {b} say something?",
          options: [
            { label: "yes", next: "together" },
            { label: "not yet", next: "end" },
          ],
          default: 1,
        },
      },
      {
        key: "together",
        days: [1, 2],
        beats: [
          { role: "a", channel: "post", heat: { line: "okay. not just friends.", with: "b" } },
          { role: "a", channel: "notification", seed: "{a} and {b} are more than friends now" },
        ],
        outcomes: [{ kind: "tie", tie: "couple", between: ["a", "b"] }],
      },
    ],
    exit: { role: "b", channel: "post", heat: { line: "some things take their time" } },
  }),
  drama({
    id: "love-triangle",
    name: "Love triangle",
    description: "Two admirers, one Creator who teases them both. The fans choose who they end up with.",
    roles: [
      { key: "her", needs: { minSpice: 1 } },
      { key: "one", needs: { gender: "male" } },
      { key: "two", needs: { gender: "male" } },
    ],
    cooldownDays: 30,
    maxDays: 18,
    stages: [
      {
        key: "admirers",
        days: [1, 3],
        beats: [
          { role: "one", channel: "comment", on: "her", lines: ["stunning, as always", "dinner. me. you. this week?"] },
          { role: "two", channel: "comment", on: "her", lines: ["he can't handle you. I can.", "ignore him 😏"] },
        ],
      },
      {
        key: "tease",
        days: [2, 4],
        minSpice: 2,
        beats: [
          { role: "her", channel: "post", heat: { line: "for both of you. fight about it.", for: "fans" } },
          {
            role: "crowd",
            channel: "comment",
            on: "her",
            lines: ["team {one}", "team {two}", "{her} is playing them both and I love it"],
          },
        ],
        choice: {
          asks: "fans",
          question: "Who does {her} pick?",
          options: [
            { label: "{one}", next: "picked-one" },
            { label: "{two}", next: "picked-two" },
          ],
          default: 0,
        },
      },
      {
        key: "picked-one",
        days: [1, 2],
        next: "end",
        beats: [{ role: "her", channel: "post", heat: { line: "decided. sorry {two}.", with: "one" } }],
        outcomes: [{ kind: "tie", tie: "couple", between: ["her", "one"] }],
      },
      {
        key: "picked-two",
        days: [1, 2],
        beats: [{ role: "her", channel: "post", heat: { line: "decided. sorry {one}.", with: "two" } }],
        outcomes: [{ kind: "tie", tie: "couple", between: ["her", "two"] }],
      },
    ],
    exit: { role: "her", channel: "post", heat: { line: "no more questions." } },
  }),
  drama({
    id: "corruption",
    name: "Getting bolder",
    description: "A careful Creator tries something new, then something more. Their fans notice every step.",
    roles: [{ key: "her" }],
    cooldownDays: 45,
    maxDays: 21,
    stages: [
      {
        key: "first-step",
        days: [2, 4],
        beats: [
          { role: "her", channel: "post", heat: { line: "trying something new. be nice.", for: "fans" } },
          {
            role: "crowd",
            channel: "comment",
            on: "her",
            lines: ["who are you and what did you do with {her:him} 😳", "oh?", "more of this"],
          },
        ],
      },
      {
        key: "braver",
        days: [2, 4],
        minSpice: 2,
        beats: [{ role: "her", channel: "post", heat: { line: "you liked the last one. so.", for: "fans" } }],
      },
      {
        key: "bold",
        days: [2, 4],
        minSpice: 3,
        beats: [
          { role: "her", channel: "post", heat: { line: "no more holding back.", for: "fans" } },
          { role: "her", channel: "notification", seed: "{her} is posting like never before" },
        ],
      },
    ],
    exit: { role: "her", channel: "post", heat: { line: "this is me now." } },
  }),
  drama({
    id: "open-relationship",
    name: "Open relationship",
    description: "A new guy keeps showing up on your partner's page. Your partner asks you before they shoot with him.",
    requires: { situation: "partner-is-creator" },
    roles: [her, you, { key: "him", needs: { gender: "male", minSpice: 2 }, prefer: "newcomer" }],
    cooldownDays: 21,
    maxDays: 21,
    stages: [
      {
        key: "noticed",
        days: [1, 3],
        beats: [
          {
            role: "him",
            channel: "comment",
            on: "her",
            lines: ["okay wow", "we should shoot together sometime", "🔥🔥"],
          },
          {
            role: "her",
            channel: "dm",
            to: "you",
            seed: "this new guy {him} keeps commenting on {her:his} posts; finds it funny",
          },
        ],
      },
      {
        key: "ask",
        days: [1, 2],
        choice: {
          asks: "player",
          question: "{him} wants to shoot with me. is that okay with you?",
          options: [
            { label: "okay…", next: "shoot" },
            { label: "no", next: "end" },
          ],
          default: 0,
        },
      },
      {
        key: "shoot",
        days: [2, 4],
        minSpice: 3,
        beats: [
          {
            role: "her",
            channel: "post",
            heat: { line: "shot at {him}'s place. you'll see why.", with: "him", shotBy: "him" },
          },
          {
            role: "crowd",
            channel: "comment",
            on: "her",
            lines: ["does your {you-bf} know? 👀", "{him} is a lucky man", "the chemistry 😳"],
          },
          { role: "him", channel: "notification", seed: "{her} was tagged in a post by {him}" },
          { role: "her", channel: "dm", to: "you", seed: "asks if you saw the new set", delayHours: [2, 8] },
        ],
        outcomes: [{ kind: "tie", tie: "friend", between: ["her", "him"], level: 2 }],
      },
      {
        key: "again",
        days: [2, 4],
        minSpice: 3,
        choice: {
          asks: "player",
          question: "{him} asked if I can stay over after the next shoot. okay?",
          options: [
            { label: "okay", next: "stays" },
            { label: "come home", next: "end" },
          ],
          default: 0,
        },
      },
      {
        key: "stays",
        days: [1, 3],
        beats: [
          { role: "her", channel: "post", heat: { line: "didn't make it home last night.", with: "him" } },
          {
            role: "her",
            channel: "dm",
            to: "you",
            seed: "tells you about heading home, and that {her:he} thought of you",
            delayHours: [6, 14],
          },
        ],
      },
    ],
    exit: { role: "her", channel: "dm", to: "you", seed: "is home, and asks what you thought of all of it" },
  }),
  drama({
    id: "secret",
    name: "The secret",
    description: "Your partner has a new collaborator they do not mention. You find out from the feed.",
    requires: { situation: "partner-is-creator" },
    roles: [her, you, { key: "him", needs: { gender: "male", minSpice: 2 }, prefer: "newcomer" }],
    cooldownDays: 30,
    maxDays: 18,
    stages: [
      {
        key: "tagged",
        days: [1, 3],
        minSpice: 2,
        beats: [
          { role: "him", channel: "notification", seed: "{her} was tagged in a post by {him}" },
          {
            role: "her",
            channel: "post",
            heat: { line: "a shoot I didn't tell anyone about.", with: "him", shotBy: "him" },
          },
        ],
      },
      {
        key: "asked",
        days: [1, 2],
        choice: {
          asks: "player",
          question: "you saw it, didn't you?",
          options: [
            { label: "I saw it", next: "honest" },
            { label: "say nothing", next: "again" },
          ],
          default: 1,
        },
      },
      {
        key: "again",
        days: [2, 4],
        minSpice: 3,
        next: "end",
        beats: [
          { role: "her", channel: "post", heat: { line: "some things are just for me.", with: "him" } },
          {
            role: "crowd",
            channel: "comment",
            on: "her",
            lines: ["does your {you-bf} know? 👀", "{him} again??", "{her} is glowing"],
          },
        ],
      },
      {
        key: "honest",
        days: [1, 2],
        beats: [
          {
            role: "her",
            channel: "dm",
            to: "you",
            seed: "admits it and tells you everything about the shoot with {him}",
          },
        ],
      },
    ],
    exit: { role: "her", channel: "dm", to: "you", seed: "asks if things are okay between you" },
  }),
  drama({
    id: "the-other-one",
    name: "You are the other one",
    description: "A Creator in a couple starts writing to you. Their partner has no idea.",
    roles: [{ key: "her", needs: { minSpice: 2, tiedTo: { role: "him", kinds: ["couple"] } } }, { key: "him" }, you],
    cooldownDays: 30,
    maxDays: 18,
    stages: [
      {
        key: "hello",
        days: [1, 3],
        beats: [
          { role: "her", channel: "dm", to: "you", seed: "writes to you first, curious, while {him} is not around" },
        ],
      },
      {
        key: "secret",
        days: [2, 4],
        minSpice: 3,
        beats: [
          { role: "her", channel: "post", heat: { line: "this one isn't for who you think.", for: "you" } },
          { role: "him", channel: "comment", on: "her", lines: ["beautiful ❤️", "mine 😘"] },
          {
            role: "her",
            channel: "dm",
            to: "you",
            seed: "tells you the last post was for you, not for {him}",
            delayHours: [1, 6],
          },
        ],
      },
      {
        key: "gift",
        days: [1, 2],
        beats: [{ role: "her", channel: "money", to: "you", amount: { min: 15, max: 40 } }],
      },
    ],
    exit: {
      role: "her",
      channel: "dm",
      to: "you",
      seed: "says it is time to be careful now; {him} is getting suspicious",
    },
  }),
  drama({
    id: "spoiled",
    name: "Spoiled",
    description: "A generous admirer starts paying a Creator's way. Everyone wants to know who.",
    roles: [
      { key: "her", needs: { minSpice: 1 } },
      { key: "him", needs: { gender: "male" }, prefer: "popular" },
    ],
    cooldownDays: 30,
    maxDays: 14,
    stages: [
      {
        key: "gifts",
        days: [2, 4],
        beats: [
          { role: "him", channel: "money", to: "her", amount: { min: 30, max: 80 } },
          {
            role: "her",
            channel: "post",
            heat: { line: "someone spoiled me again. new outfit, you're welcome.", for: "him" },
          },
          {
            role: "crowd",
            channel: "comment",
            on: "her",
            lines: ["who is paying for all this??", "must be nice 💅", "sugar daddy spotted"],
          },
        ],
      },
      {
        key: "trip",
        days: [2, 4],
        minSpice: 2,
        beats: [
          { role: "him", channel: "money", to: "her", amount: { min: 50, max: 100 } },
          { role: "her", channel: "post", heat: { line: "he flew me out. worth every photo.", for: "him" } },
        ],
      },
    ],
    exit: { role: "her", channel: "post", heat: { line: "the gifts stopped. the photos didn't." } },
  }),
  drama({
    id: "she-spoils-you",
    name: "Spoiled by a Creator",
    description: "A Creator decides you are their project: coins, rules, and posts about their favourite.",
    roles: [{ key: "her", needs: { minSpice: 1 } }, you],
    cooldownDays: 30,
    maxDays: 14,
    stages: [
      {
        key: "offer",
        days: [1, 2],
        beats: [
          {
            role: "her",
            channel: "dm",
            to: "you",
            seed: "confesses to liking you and wanting to take care of you; you just have to let {her:him}",
          },
          { role: "her", channel: "money", to: "you", amount: { min: 15, max: 30 } },
        ],
      },
      {
        key: "rules",
        days: [2, 4],
        choice: {
          asks: "player",
          question: "I pay, you do what I ask. deal?",
          options: [
            { label: "deal", next: "hers" },
            { label: "no strings", next: "end" },
          ],
          default: 0,
        },
      },
      {
        key: "hers",
        days: [2, 4],
        minSpice: 2,
        beats: [
          { role: "her", channel: "money", to: "you", amount: { min: 20, max: 40 } },
          {
            role: "her",
            channel: "post",
            heat: { line: "my favourite {you-boy} did exactly as told.", for: "you" },
          },
          {
            role: "her",
            channel: "dm",
            to: "you",
            seed: "tells you what to buy with it, and to show {her:him}",
          },
        ],
      },
    ],
    exit: { role: "her", channel: "dm", to: "you", seed: "says {her:he} will call on you again" },
  }),
];
