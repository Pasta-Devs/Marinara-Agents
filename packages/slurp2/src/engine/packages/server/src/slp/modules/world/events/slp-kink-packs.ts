/**
 * Kink theme packs (docs/SPICY.md, item 1): Lingerie, Cosplay, Feet, Dom/sub and Exhibition, written as pack
 * data on the storyline engine, each off by default. A pack's `fit` keeps it to Creators at its spice level
 * whose hard-nos and "never" lines leave it alone; turn-ons lean who takes it (`slurpTasteWeight`). Fans vote
 * where the story goes, the sets become looks in her closet, and the spiciest stage waits for her spice.
 */
import {
  slpStorylineSchema,
  type SlpStoryline,
  type SlpStorylineStage,
} from "../../../../../../shared/src/slp/slp-storyline.js";
import type { SlpFit } from "../../../../../../shared/src/slp/slp-drama.js";
import type { SlurpContentPack } from "./slp-content-pack-library.js";

type Stage = Partial<SlpStorylineStage> & { key: string; label: string; days: [number, number] };
type Look = { name: string; summary: string; description: string; tags: string[] };

const stage = ({ key, label, days, ...rest }: Stage) =>
  ({
    key,
    label,
    days,
    guidance: "",
    influences: [],
    beats: [],
    deck: [],
    enter: [],
    leave: [],
    ...rest,
  }) as SlpStorylineStage;

/** A locked post for her subscribers. */
const tease = (line: string) => ({ role: "her", channel: "post" as const, heat: { line, for: "fans" as const } });
/** A public post. */
const post = (line: string) => ({ role: "her", channel: "post" as const, heat: { line } });
const crowd = (...lines: string[]) => ({
  role: "crowd" as const,
  channel: "comment" as const,
  on: "her",
  lines,
  // Lands on the post the stage made, not on an older one.
  delayHours: [4, 12] as [number, number],
});
const addLook = (look: Look) => ({ kind: "add-look" as const, look: { ...look, suitability: "locked" as const } });

function story(input: {
  id: string;
  name: string;
  description: string;
  fit: SlpFit;
  tags: string[];
  stages: Stage[];
  ending: { label: string; line: string; look?: Look; fact?: { tag: string; label: string; line: string } };
  weight?: number;
  track?: "work" | "public";
}): SlpStoryline {
  return slpStorylineSchema.parse({
    id: input.id,
    contentId: input.id,
    name: input.name,
    description: input.description,
    tone: "playful",
    storyTags: input.tags,
    fit: input.fit,
    cast: [{ key: "her", needs: {} }],
    start: { mode: "auto", weight: input.weight ?? 0.6, cooldownDays: 45 },
    maxDays: 21,
    stages: input.stages.map((entry) =>
      stage(
        entry.condition
          ? { ...entry, condition: { track: input.track ?? "work", ...entry.condition, tag: input.id } }
          : entry,
      ),
    ),
    endings: [
      {
        key: "done",
        label: input.ending.label,
        beat: tease(input.ending.line),
        outcomes: [
          ...(input.ending.look ? [addLook(input.ending.look)] : []),
          ...(input.ending.fact
            ? [{ kind: "add-creator-fact" as const, ...input.ending.fact, expiresAfterDays: 60 }]
            : []),
        ],
      },
    ],
    builtin: true,
    source: { kind: "drama", id: input.id },
  });
}

const pack = (id: string, name: string, adds: string, storylines: SlpStoryline[]): SlurpContentPack => ({
  id,
  name,
  adds,
  defaultOn: false,
  events: [],
  arcs: [],
  storylines,
});

// ── Lingerie ────────────────────────────────────────────────────────────────────────────────────────────
const LINGERIE: SlpFit = {
  level: "suggestive",
  topic: ["lingerie", "underwear", "bra", "bras", "panties", "stockings", "garter*"],
  hardNo: ["lingerie", "underwear"],
};
const set = (key: string, label: string, look: string, line: string): Stage => ({
  key,
  label,
  days: [2, 3],
  condition: { tag: "lingerie-week", label: "Lingerie week", line: `It is your lingerie week. Today: ${look}.`, look },
  beats: [tease(line), crowd("this one. this one forever", "ok I need a minute", "the fans picked RIGHT")],
  next: "finale",
});

export const SLURP_LINGERIE_PACK = pack(
  "slurp-pack-lingerie",
  "Lingerie",
  "Lingerie week with fan votes on the sets, and a lingerie brand that wants her in its line.",
  [
    story({
      id: "lingerie-week",
      name: "Lingerie week",
      description: "A haul of new sets, the fans vote which one she shoots first, and the week ends with a finale.",
      fit: LINGERIE,
      tags: ["lingerie", "fan-vote"],
      stages: [
        {
          key: "haul",
          label: "The haul",
          days: [1, 2],
          condition: {
            tag: "lingerie-week",
            label: "Lingerie week",
            line: "Your new lingerie came today and you are planning a whole week of sets.",
            look: "a lingerie haul spread over the bed, tags still on",
          },
          beats: [post("lingerie week starts tomorrow. you pick the first set")],
          choice: {
            asks: "fans",
            question: "Which set first?",
            options: [
              { label: "Black lace", next: "black" },
              { label: "Red satin", next: "red" },
              { label: "White and sheer", next: "white" },
            ],
            default: 0,
            timeoutDays: 2,
          },
        },
        set("black", "Black lace", "a black lace bra and panties with stockings", "you voted. black lace it is"),
        set("red", "Red satin", "a red satin set with a garter belt", "red satin, as ordered"),
        set("white", "White and sheer", "a sheer white set that hides almost nothing", "white and sheer. be nice"),
        {
          key: "finale",
          label: "The finale",
          days: [1, 2],
          minSpice: 2,
          condition: {
            tag: "lingerie-week",
            label: "Lingerie week",
            line: "It is the last day of your lingerie week and the set comes off slowly.",
          },
          beats: [tease("last day of lingerie week. the set doesn't stay on")],
        },
      ],
      ending: {
        label: "The week is over",
        line: "lingerie week is over. which set do I keep wearing?",
        look: {
          name: "Lingerie week set",
          summary: "the set from her lingerie week",
          description: "The lingerie set her fans voted for during lingerie week, with stockings.",
          tags: ["lingerie"],
        },
      },
    }),
    story({
      id: "lingerie-brand",
      name: "The lingerie brand",
      description: "A lingerie label sends her a box. Try-on shoot, honest review, maybe a deal.",
      fit: LINGERIE,
      tags: ["lingerie", "brand"],
      weight: 0.4,
      stages: [
        {
          key: "box",
          label: "The box",
          days: [1, 2],
          condition: {
            tag: "lingerie-brand",
            label: "Lingerie brand box",
            line: "A lingerie brand sent you a box of their new line to try on for your fans.",
          },
          beats: [post("a lingerie brand sent me their whole new line 👀")],
          enter: [{ kind: "brand-offer", words: ["lingerie", "underwear", "intimates", "bra", "bras", "lace"] }],
        },
        {
          key: "try-on",
          label: "Try-on shoot",
          days: [2, 3],
          condition: {
            tag: "lingerie-brand",
            label: "Lingerie brand try-on",
            line: "You are shooting the brand's new line, one set after another.",
            look: "the brand's new lingerie line, a different set in every shot",
          },
          beats: [tease("try-on haul. rating every set for you")],
          influences: [{ target: "economy.creator-earnings", operation: "multiply", value: 1.1 }],
        },
      ],
      ending: { label: "The review", line: "my honest review of every set. one of them is staying on" },
    }),
  ],
);

// ── Cosplay ─────────────────────────────────────────────────────────────────────────────────────────────
const COSPLAY: SlpFit = {
  level: "suggestive",
  topic: ["cosplay*", "costume*", "anime", "convention*", "con"],
  hardNo: ["cosplay", "costume"],
};
const costume = (key: string, label: string, look: string, line: string): Stage => ({
  key,
  label,
  days: [2, 4],
  condition: {
    tag: "cosplay",
    label: `Cosplay: ${label}`,
    line: `You are in costume as ${label.toLowerCase()}.`,
    look,
  },
  beats: [post(line), crowd("the accuracy??", "ok now do the lewd version", "I'm not ok")],
  next: "lewd",
});

export const SLURP_COSPLAY_PACK = pack(
  "slurp-pack-cosplay",
  "Cosplay",
  "Fans pick her next costume, con weekends in character, and the lewd version for subscribers.",
  [
    story({
      id: "cosplay-pick",
      name: "Fans pick the cosplay",
      description: "She lets her fans choose the next costume, shows the build and then the lewd version.",
      fit: COSPLAY,
      tags: ["cosplay", "fan-vote"],
      stages: [
        {
          key: "poll",
          label: "The poll",
          days: [1, 2],
          condition: {
            tag: "cosplay",
            label: "Cosplay poll",
            line: "You asked your fans which costume you should do next.",
          },
          beats: [post("next cosplay is your call. vote")],
          choice: {
            asks: "fans",
            question: "Which cosplay next?",
            options: [
              { label: "A fantasy elf", next: "elf" },
              { label: "A superhero", next: "hero" },
              { label: "A maid", next: "maid" },
            ],
            default: 0,
            timeoutDays: 2,
          },
        },
        costume("elf", "A fantasy elf", "an elf cosplay: pointed ears, a green leaf corset", "elf cosplay is done 🧝"),
        costume("hero", "A superhero", "a superhero cosplay: a tight suit, a cape, boots", "suited up. who am I"),
        costume(
          "maid",
          "A maid",
          "a maid cosplay: a short black dress, a white apron, a headband",
          "your maid is here",
        ),
        {
          key: "lewd",
          label: "The lewd version",
          days: [1, 2],
          minSpice: 2,
          condition: {
            tag: "cosplay",
            label: "Lewd cosplay",
            line: "The costume is coming off, piece by piece, for your subscribers.",
          },
          beats: [tease("you asked for the lewd version. here it is")],
        },
      ],
      ending: {
        label: "The costume goes in the closet",
        line: "this costume lives in my closet now",
        look: {
          name: "Fan-picked cosplay",
          summary: "the cosplay her fans voted for",
          description: "The costume her fans voted for, worn for shoots and the lewd set.",
          tags: ["cosplay"],
        },
      },
    }),
    story({
      id: "cosplay-con",
      name: "Con weekend in costume",
      description: "She builds a costume for a convention, spends the weekend in character, then the after-party.",
      fit: COSPLAY,
      tags: ["cosplay", "convention"],
      weight: 0.4,
      stages: [
        {
          key: "build",
          label: "The build",
          days: [3, 5],
          condition: {
            tag: "cosplay-con",
            label: "Costume build",
            line: "You are building a costume for a convention: glue, foam and no sleep.",
          },
          beats: [post("costume build day 3. send help and hot glue")],
        },
        {
          key: "con",
          label: "Con day",
          days: [1, 2],
          condition: {
            tag: "cosplay-con",
            label: "At the con",
            line: "You are at the convention in full costume and people stop you for photos all day.",
            look: "her finished convention costume, in a crowded con hall",
          },
          beats: [post("con day. stopped for 200 photos")],
          influences: [{ target: "audience.growth", operation: "multiply", value: 1.2 }],
        },
        {
          key: "after-party",
          label: "The after-party",
          days: [1, 1],
          minSpice: 2,
          condition: {
            tag: "cosplay-con",
            label: "Con after-party",
            line: "The con is over and the costume comes off at the after-party.",
          },
          beats: [tease("what happens after the con")],
        },
      ],
      ending: { label: "Back home", line: "post-con depression is real. the costume isn't retiring" },
    }),
  ],
);

// ── Feet ────────────────────────────────────────────────────────────────────────────────────────────────
const FEET: SlpFit = {
  level: "suggestive",
  topic: ["feet", "foot", "toes", "soles", "pedicure"],
  hardNo: ["feet", "foot", "toes"],
};
export const SLURP_FEET_PACK = pack(
  "slurp-pack-feet",
  "Feet",
  "Foot fans find her, pedicure days, heels or socks votes, and foot content that sells.",
  [
    story({
      id: "feet-fans",
      name: "The foot fans",
      description: "Foot fans flood her comments. She tries a foot set, and it sells better than anything.",
      fit: FEET,
      tags: ["feet"],
      stages: [
        {
          key: "comments",
          label: "The comments",
          days: [2, 3],
          condition: {
            tag: "feet",
            label: "Foot fans",
            line: "Foot fans keep asking about your feet in every comment section.",
          },
          beats: [
            post("why does everyone want my feet lol"),
            crowd("feet pics when", "the toes in pic 3 👀", "I'd pay for the feet alone"),
          ],
        },
        {
          key: "pedicure",
          label: "Pedicure day",
          days: [1, 2],
          condition: {
            tag: "feet",
            label: "Pedicure day",
            line: "You got a pedicure and you show it off.",
            look: "bare feet with a fresh glossy pedicure, close up",
          },
          beats: [tease("fresh pedicure. for my foot people")],
        },
        {
          key: "selling",
          label: "It sells",
          days: [3, 4],
          condition: {
            tag: "feet",
            label: "Foot content",
            line: "Your foot content sells better than you thought and you make more of it.",
          },
          beats: [tease("ok the foot set outsold everything. round two")],
          influences: [{ target: "economy.creator-earnings", operation: "multiply", value: 1.15 }],
        },
      ],
      ending: {
        label: "A foot niche",
        line: "I have a foot niche now. no regrets",
        fact: { tag: "foot-content", label: "Makes foot content", line: "You make foot content and it sells." },
      },
    }),
    story({
      id: "heels-or-socks",
      name: "Heels or socks",
      description: "Her fans vote: high heels or thigh-high socks. The winner gets a whole set.",
      fit: FEET,
      tags: ["feet", "fan-vote"],
      weight: 0.5,
      stages: [
        {
          key: "vote",
          label: "The vote",
          days: [1, 2],
          condition: { tag: "feet", label: "Heels or socks", line: "You asked your fans: heels or socks?" },
          beats: [post("heels or socks. you decide")],
          choice: {
            asks: "fans",
            question: "Heels or socks?",
            options: [
              { label: "High heels", next: "heels" },
              { label: "Thigh-high socks", next: "socks" },
            ],
            default: 0,
            timeoutDays: 2,
          },
        },
        {
          key: "heels",
          next: "done",
          label: "High heels",
          days: [2, 3],
          condition: {
            tag: "feet",
            label: "Heels set",
            line: "You shoot a set in high heels, legs and feet first.",
            look: "strappy high heels, bare legs, the camera low",
          },
          beats: [tease("heels won. the set is up")],
        },
        {
          key: "socks",
          label: "Thigh-high socks",
          days: [2, 3],
          condition: {
            tag: "feet",
            label: "Socks set",
            line: "You shoot a set in thigh-high socks.",
            look: "white thigh-high socks, feet up on the bed",
          },
          beats: [tease("socks won. you're all predictable")],
        },
      ],
      ending: { label: "The winner stays", line: "the winner stays in rotation" },
    }),
  ],
);

// ── Dom/sub ─────────────────────────────────────────────────────────────────────────────────────────────
const DOMSUB: SlpFit = {
  level: "suggestive",
  topic: ["dom", "domme", "dominant", "sub", "submissive", "bdsm", "bondage", "spanking", "mistress"],
  hardNo: ["bdsm", "dom", "domme", "submissive", "bondage"],
};
export const SLURP_DOMSUB_PACK = pack(
  "slurp-pack-domsub",
  "Dom/sub",
  "Power play: her domme era with begging fans and tributes, or her soft side where fans set the rules.",
  [
    story({
      id: "domme-era",
      name: "Her domme era",
      description: "She tries being in charge. Leather, rules, fans who beg and pay tribute.",
      fit: DOMSUB,
      tags: ["domsub", "domme"],
      stages: [
        {
          key: "attitude",
          label: "New attitude",
          days: [2, 3],
          condition: {
            tag: "domme",
            label: "Domme era",
            line: "You are in your domme era: you give orders now and your fans like it.",
            look: "a black leather corset, thigh-high boots, a riding crop",
          },
          beats: [
            post("new rules on this page. you'll learn them"),
            crowd("yes mistress", "please", "I'll do anything"),
          ],
        },
        {
          key: "tribute",
          label: "Tribute",
          days: [3, 4],
          condition: {
            tag: "domme",
            label: "Tribute",
            line: "Your fans pay tribute to earn your attention, and you make them work for it.",
          },
          beats: [tease("good pets get rewarded. tribute first")],
          influences: [{ target: "economy.creator-earnings", operation: "multiply", value: 1.2 }],
        },
        {
          key: "in-charge",
          label: "In charge",
          days: [2, 3],
          minSpice: 2,
          condition: {
            tag: "domme",
            label: "In charge",
            line: "You are fully in charge in your content now, and you take it further.",
          },
          beats: [tease("kneel. this one is for the obedient ones")],
        },
      ],
      ending: {
        label: "The era stays",
        line: "the domme era isn't ending. obviously",
        look: {
          name: "Domme leather",
          summary: "her domme outfit",
          description: "A black leather corset with thigh-high boots and a riding crop.",
          tags: ["domsub", "leather"],
        },
      },
    }),
    story({
      id: "soft-side",
      name: "Her soft side",
      description: "She asks her fans to set her rules for a week and shows how well she obeys.",
      fit: DOMSUB,
      tags: ["domsub", "sub", "fan-vote"],
      weight: 0.5,
      stages: [
        {
          key: "ask",
          label: "Set my rules",
          days: [1, 2],
          condition: {
            tag: "sub",
            label: "Fans set the rules",
            line: "You asked your fans to set your rules for the week.",
          },
          beats: [post("this week you make the rules. be gentle. or don't")],
          choice: {
            asks: "fans",
            question: "Which rules for her week?",
            options: [
              { label: "Strict rules", next: "strict" },
              { label: "Gentle rules", next: "gentle" },
            ],
            default: 1,
            timeoutDays: 2,
          },
        },
        {
          key: "strict",
          next: "done",
          label: "Strict rules",
          days: [3, 4],
          minSpice: 2,
          condition: {
            tag: "sub",
            label: "Strict rules",
            line: "Your fans gave you strict rules and you obey every one of them on camera.",
            look: "a collar, kneeling, hands behind her back",
          },
          beats: [tease("rule 4 was mean. I did it anyway")],
        },
        {
          key: "gentle",
          label: "Gentle rules",
          days: [3, 4],
          condition: {
            tag: "sub",
            label: "Gentle rules",
            line: "Your fans gave you gentle rules: good-morning pictures, saying please, a little collar.",
            look: "a thin velvet collar, soft pajamas",
          },
          beats: [tease("good morning, as instructed 🥺")],
        },
      ],
      ending: { label: "Rules week is over", line: "rules week is over. I kind of miss them" },
    }),
  ],
);

// ── Exhibition ──────────────────────────────────────────────────────────────────────────────────────────
const EXHIBITION: SlpFit = {
  level: "nudity",
  topic: ["exhibition*", "exhibitionist", "public", "flashing"],
  hardNo: ["public", "outdoor", "exhibition"],
};
export const SLURP_EXHIBITION_PACK = pack(
  "slurp-pack-exhibition",
  "Exhibition",
  "Risky outdoor shoots, almost getting caught, and dares from her fans.",
  [
    story({
      id: "almost-caught",
      name: "Almost caught",
      description: "An outdoor shoot goes a little too far and somebody almost walks in. The fans go wild.",
      fit: EXHIBITION,
      track: "public",
      tags: ["exhibition"],
      stages: [
        {
          key: "outdoor",
          label: "Outdoor shoot",
          days: [1, 2],
          condition: {
            tag: "exhibition",
            label: "Outdoor shoot",
            line: "You are shooting outside, somewhere quiet, with less on than you should.",
            look: "outdoors in a quiet spot, a summer dress pulled down off one shoulder",
          },
          beats: [tease("found a quiet spot. mostly quiet")],
        },
        {
          key: "close-call",
          label: "The close call",
          days: [1, 2],
          condition: {
            tag: "exhibition",
            label: "Almost caught",
            line: "Somebody almost walked in on your outdoor shoot and you are still shaking from it.",
          },
          beats: [
            post("someone ALMOST walked in. my heart"),
            crowd("you're insane", "do it again", "where is this 👀"),
          ],
          influences: [{ target: "audience.growth", operation: "multiply", value: 1.3 }],
        },
        {
          key: "again",
          label: "Again",
          days: [2, 3],
          minSpice: 3,
          condition: {
            tag: "exhibition",
            label: "Risky again",
            line: "The close call made you braver, and the next outdoor set goes all the way.",
          },
          beats: [tease("you said do it again. so I did")],
        },
      ],
      ending: {
        label: "A taste for it",
        line: "I have a problem and it's called outside",
        fact: { tag: "exhibitionist", label: "Likes it risky", line: "You like shooting in risky places." },
      },
    }),
    story({
      id: "fan-dares",
      name: "Fan dares",
      description: "Her fans dare her to shoot somewhere risky. She picks the dare they vote for.",
      fit: EXHIBITION,
      track: "public",
      tags: ["exhibition", "fan-vote"],
      weight: 0.5,
      stages: [
        {
          key: "dare",
          label: "The dare",
          days: [1, 2],
          condition: { tag: "exhibition", label: "Fan dares", line: "You asked your fans to dare you." },
          beats: [post("dare me. top vote wins")],
          choice: {
            asks: "fans",
            question: "Which dare?",
            options: [
              { label: "The balcony", next: "balcony" },
              { label: "The changing room", next: "changing-room" },
              { label: "An empty beach", next: "beach" },
            ],
            default: 0,
            timeoutDays: 2,
          },
        },
        {
          key: "balcony",
          next: "done",
          label: "The balcony",
          days: [1, 2],
          condition: {
            tag: "exhibition",
            label: "Balcony dare",
            line: "You did the balcony dare: neighbours across the street, nothing on.",
            look: "on a city balcony at dusk, wrapped in nothing but a sheet",
          },
          beats: [tease("balcony dare done. hi neighbours")],
        },
        {
          key: "changing-room",
          next: "done",
          label: "The changing room",
          days: [1, 2],
          condition: {
            tag: "exhibition",
            label: "Changing room dare",
            line: "You did the changing room dare in a busy shop, the curtain barely closed.",
            look: "in a shop changing room, the curtain half open, trying on a bikini",
          },
          beats: [tease("changing room dare. the curtain did NOT close")],
        },
        {
          key: "beach",
          label: "An empty beach",
          days: [1, 2],
          condition: {
            tag: "exhibition",
            label: "Beach dare",
            line: "You did the beach dare on a beach that was not as empty as you thought.",
            look: "on a beach at sunrise, the bikini top gone",
          },
          beats: [tease("the beach was not empty. worth it")],
        },
      ],
      ending: { label: "Dare done", line: "dare done. next one?" },
    }),
  ],
);

export const SLURP_KINK_PACKS: readonly SlurpContentPack[] = [
  SLURP_LINGERIE_PACK,
  SLURP_COSPLAY_PACK,
  SLURP_FEET_PACK,
  SLURP_DOMSUB_PACK,
  SLURP_EXHIBITION_PACK,
];
