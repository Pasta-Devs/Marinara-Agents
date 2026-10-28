/**
 * The Family pack (docs/STORYLINES.md, PR 6): a pregnancy, written as pack data, off by default.
 * Slurp is a creator platform, so it is her business too: an announcement brings subscribers and
 * baby brands, a secret costs a few fans. Four ways in, one storyline each: her couple partner, a
 * collab partner, the player, or nobody she will name. Hard endings sit behind the `hard` dial.
 *
 * One hard line, as DRAMA.md sets for family ties: the child never appears in a picture and is never
 * part of a spicy post. After the birth the child is a mention.
 */
import {
  slpStorylineSchema,
  type SlpStoryline,
  type SlpStorylineStage,
} from "../../../../../../shared/src/slp/slp-storyline.js";
import type { SlurpContentPack } from "./slp-content-pack-library.js";

type Father = "couple" | "collab" | "player" | "surprise";

const BRAND_WORDS = ["baby", "babies", "maternity", "mom*", "mum*", "pregnan*", "parent*", "nursery"];

const month = (n: number, line: string, look?: string): SlpStorylineStage["condition"] => ({
  tag: "pregnant",
  label: `Pregnant, month ${n}`,
  track: "body",
  line,
  ...(look ? { look } : {}),
  deck: [
    { line: "You are tired all day and fans keep asking why you post less." },
    { line: "You have a craving at 2 am and you film yourself giving in to it." },
    { line: "Your body is changing and you talk about it with your followers." },
    { line: "Fans in your comments guess what is going on with you.", withPartner: false },
    { line: "Your partner fusses over you and you pretend to hate it.", withPartner: true },
  ],
  share: 0.3,
});

const stage = (key: string, label: string, days: [number, number], rest: Partial<SlpStorylineStage> = {}) =>
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

function pregnancy(father: Father): SlpStoryline {
  const dad = father !== "surprise";
  // Condition lines and guidance reach the writer as they are (no role names filled in).
  const who = { couple: "your partner", collab: "your collab partner", player: "the father", surprise: "the father" }[
    father
  ];
  const cast = [
    { key: "mom", needs: father === "player" ? { relationToPlayer: ["partner", "crush"] as const } : {} },
    ...(father === "couple" ? [{ key: "dad", needs: { tiedTo: { role: "mom", kinds: ["couple"] as const } } }] : []),
    ...(father === "collab" ? [{ key: "dad", needs: { tiedTo: { role: "mom", kinds: ["collab"] as const } } }] : []),
    ...(father === "player" ? [{ key: "dad", player: true }] : []),
  ];
  const told = (key: string) => (dad ? key : "month-2");
  const stages: SlpStorylineStage[] = [
    stage("test", "The test", [1, 2], {
      guidance:
        father === "surprise"
          ? "She is pregnant and will not say who the father is; a fan from a meet & greet, a shoot, she keeps it vague."
          : father === "collab"
            ? "She is pregnant after a collab shoot with her collab partner."
            : "She just found out she is pregnant.",
      condition: month(1, "You just found out you are pregnant. Nobody knows yet."),
      beats: [
        { role: "mom", channel: "post", heat: { line: "something big happened today. not telling yet", for: "fans" } },
      ],
      next: told("tell"),
    }),
    ...(dad
      ? [
          stage("tell", "Telling the father", [1, 2], {
            condition: month(1, `You are pregnant and you have not told ${who} yet.`),
            choice: {
              asks: "role",
              role: "mom",
              question: `Tell ${who} now?`,
              options: [
                { label: "Tell now", next: "told" },
                { label: "Wait a little", next: "waiting" },
              ],
              default: 0,
              timeoutDays: 2,
            },
          }),
          stage("waiting", "Keeping it quiet", [2, 4], {
            condition: month(1, `You are pregnant and you hide it from ${who} for now.`),
            next: "told",
          }),
          stage("told", "Telling the father", [1, 1], {
            condition: month(2, `You are two months pregnant. ${who[0]!.toUpperCase()}${who.slice(1)} knows.`),
            beats:
              father === "player"
                ? [{ role: "mom", channel: "dm", to: "dad", seed: "she is pregnant and the baby is yours" }]
                : [
                    { role: "mom", channel: "notification", seed: "{mom} told {dad} she is pregnant" },
                    { role: "dad", channel: "comment", on: "mom", lines: ["proud of you", "you know why 🤍"] },
                  ],
            next: "month-2",
          }),
        ]
      : []),
    stage("month-2", "Month two", [4, 6], {
      condition: month(2, "You are two months pregnant. Your followers do not know yet."),
      next: "month-3",
    }),
    stage("month-3", "Month three", [4, 6], {
      condition: month(
        3,
        "You are three months pregnant. A small bump is starting.",
        "a very small bump, easy to hide",
      ),
      choice: {
        asks: "role",
        role: "mom",
        question: "Announce the pregnancy to your fans, or keep it secret?",
        options: [
          { label: "Announce it", next: "announced" },
          { label: "Keep it secret", next: "secret" },
        ],
        default: 0,
        timeoutDays: 3,
      },
    }),
    stage("secret", "The secret", [8, 10], {
      condition: month(
        4,
        "You are four months pregnant and you keep it secret: loose clothes, careful angles.",
        "loose clothes and careful angles that hide a small bump",
      ),
      influences: [{ target: "audience.growth", operation: "multiply", value: 0.9 }],
      deck: [
        { role: "crowd", channel: "comment", on: "mom", lines: ["is she hiding something?", "the angles lately 👀"] },
      ],
      next: "reveal",
    }),
    stage("reveal", "The reveal", [1, 2], {
      condition: month(
        5,
        "You are five months pregnant and you just told your fans.",
        "visibly pregnant, about five months",
      ),
      beats: [{ role: "mom", channel: "post", heat: { line: "okay. the secret is out", for: "fans" } }],
      influences: [
        { target: "audience.growth", operation: "multiply", value: 1.4 },
        { target: "economy.creator-earnings", operation: "multiply", value: 1.15 },
      ],
      enter: [{ kind: "brand-offer", words: BRAND_WORDS }],
      next: "month-6",
    }),
    stage("announced", "The announcement", [4, 6], {
      condition: month(
        4,
        "You are four months pregnant and your fans know.",
        "a small pregnancy bump, about four months",
      ),
      beats: [{ role: "mom", channel: "post", heat: { line: "so. there's two of us now", for: "fans" } }],
      influences: [
        { target: "audience.growth", operation: "multiply", value: 1.3 },
        { target: "economy.creator-earnings", operation: "multiply", value: 1.1 },
      ],
      enter: [{ kind: "brand-offer", words: BRAND_WORDS }],
      next: "month-5",
    }),
    stage("month-5", "Month five", [4, 6], {
      condition: month(5, "You are five months pregnant.", "visibly pregnant, about five months"),
      next: "month-6",
    }),
    stage("month-6", "Month six", [4, 6], {
      condition: month(6, "You are six months pregnant.", "visibly pregnant, about six months"),
      beats: [{ role: "mom", channel: "post", heat: { line: "the first kick. i cried", for: "fans" } }],
      choice: {
        asks: "role",
        role: "mom",
        question: "The scan",
        options: [
          { label: "Everything looks fine", next: "month-7" },
          { label: "A small scare, then good news", next: "month-7" },
          { label: "A strong heartbeat", next: "month-7" },
          { label: "Bad news at the scan", next: "loss", when: { hard: "on" } },
        ],
        default: 0,
        timeoutDays: 1,
      },
    }),
    stage("month-7", "Month seven", [4, 6], {
      condition: month(7, "You are seven months pregnant.", "heavily pregnant, about seven months"),
      beats: [{ role: "mom", channel: "post", heat: { line: "bump shoot. you asked for it", for: "fans" } }],
      influences: [{ target: "economy.creator-earnings", operation: "multiply", value: 1.1 }],
      next: "month-8",
    }),
    stage("month-8", "Month eight", [4, 6], {
      condition: month(8, "You are eight months pregnant and you slow down.", "heavily pregnant, about eight months"),
      choice: {
        asks: "fans",
        question: "Name the baby?",
        options: [
          { label: "Let the fans pick", next: "month-9" },
          { label: "Keep it private", next: "month-9" },
        ],
        default: 1,
        timeoutDays: 3,
      },
    }),
    stage("month-9", "Month nine", [3, 5], {
      condition: month(
        9,
        "You are nine months pregnant. The due date is close.",
        "heavily pregnant, about nine months",
      ),
      beats: [{ role: "mom", channel: "post", heat: { line: "any day now. going quiet for a bit", for: "fans" } }],
      influences: [{ target: "feed.reach", operation: "multiply", value: 0.8 }],
      next: "born",
    }),
  ];
  const id = `family-pregnancy-${father}`;
  return slpStorylineSchema.parse({
    id,
    contentId: id,
    name: {
      couple: "Pregnant: her partner",
      collab: "Pregnant: after a collab",
      player: "Pregnant: yours",
      surprise: "Pregnant: she won't say",
    }[father],
    description: {
      couple: "She and her partner are expecting. Months, cravings, the announcement, the birth.",
      collab: "A collab shoot went further than planned. Now she is expecting.",
      player: "She is pregnant and the baby is yours. She tells you first.",
      surprise: "She is pregnant and will not say who the father is. Her fans have theories.",
    }[father],
    tone: "warm",
    storyTags: ["pregnancy", "family"],
    fit: { topic: ["pregnan*", "breed*", "baby", "babies"] },
    cast,
    requires: {
      tags: { couple: ["partner"], collab: ["collab"], player: [], surprise: [] }[father],
      lacks: ["pregnant", "parent"],
    },
    track: "body",
    start: { mode: "auto", weight: father === "surprise" ? 0.3 : 0.5, cooldownDays: 120, once: true },
    maxDays: 70,
    dials: [{ key: "hard", options: ["off", "on"], default: "off" }],
    stages,
    endings: [
      {
        key: "born",
        label: "The birth",
        beat: { role: "mom", channel: "post", heat: { line: "they're here. we're okay. back soon", for: "fans" } },
        outcomes: [
          {
            kind: "add-creator-fact",
            tag: "parent",
            label: "New parent",
            track: "family",
            line: "You have a new baby at home. The baby stays off camera: never in a picture, never in a spicy post.",
          },
        ],
      },
      {
        key: "loss",
        label: "A loss",
        beat: {
          role: "mom",
          channel: "post",
          heat: { line: "taking some time off. thank you for the messages", for: "fans" },
        },
        outcomes: [
          {
            kind: "add-creator-fact",
            tag: "grieving",
            label: "Grieving",
            track: "family",
            line: "You lost the pregnancy and you are taking it slow.",
            expiresAfterDays: 21,
          },
        ],
      },
    ],
    builtin: true,
    source: { kind: "drama", id },
  });
}

export const SLURP_FAMILY_STORYLINES: readonly SlpStoryline[] = (
  ["couple", "collab", "player", "surprise"] as const
).map(pregnancy);

export const SLURP_FAMILY_PACK: SlurpContentPack = {
  id: "slurp-pack-family",
  name: "Family",
  adds: "A pregnancy: with her partner, after a collab, with you, or with a father she won't name.",
  defaultOn: false,
  events: [],
  arcs: [],
  storylines: [...SLURP_FAMILY_STORYLINES],
};
