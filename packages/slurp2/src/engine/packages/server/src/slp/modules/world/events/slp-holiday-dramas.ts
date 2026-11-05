/**
 * Holiday dramas (docs/DRAMA.md). Built-in like the starter set, so off until the player switches
 * Drama on in Settings › Stir.
 */
import { slpDramaSchema, type SlpDrama } from "../../../../../../shared/src/slp/slp-drama.js";

const winner = (role: "a" | "b" | "c") => ({
  key: `${role}-wins`,
  days: [0, 1] as [number, number],
  next: "end" as const,
  beats: [
    {
      role,
      channel: "post" as const,
      heat: { line: "you won the costume contest: the reward set, the costume coming off piece by piece", for: "you" },
    },
    {
      role: "crowd" as const,
      channel: "comment" as const,
      on: role,
      lines: ["deserved 👑", "the judge has taste", `{${role}} won and we all won`],
    },
  ],
});

/** Three Creators post costumes, the player judges, and the winner posts a reward set. */
export const SLURP_COSTUME_CONTEST: SlpDrama = slpDramaSchema.parse({
  id: "costume-contest",
  name: "Halloween costume contest",
  description:
    "Three Creators enter a Halloween costume contest and you are the judge. Each shows a costume that fits who they are; the winner posts a reward set.",
  builtin: true,
  roles: [{ key: "a" }, { key: "b" }, { key: "c" }, { key: "you", player: true }],
  cooldownDays: 300,
  maxDays: 4,
  weight: 0.1,
  stages: [
    {
      key: "costumes",
      days: [0, 1],
      beats: [
        { role: "a", channel: "notification", seed: "{a}, {b} and {c} entered the Halloween costume contest" },
        {
          role: "a",
          channel: "post",
          heat: { line: "your Halloween costume for the contest, made from who you are. vote for me 🎃", for: "fans" },
        },
        {
          role: "b",
          channel: "post",
          heat: { line: "your contest costume, nothing like anyone else's. pick me 🕯️", for: "fans" },
        },
        {
          role: "c",
          channel: "post",
          heat: { line: "your contest costume, the most you thing you could wear. I'm winning this 🦇", for: "fans" },
        },
        {
          role: "crowd",
          channel: "comment",
          on: "a",
          lines: ["no because this is winning", "the effort 😭", "team {a} 🎃"],
        },
        {
          role: "crowd",
          channel: "comment",
          on: "b",
          lines: ["{b} understood the assignment", "ok this is cute", "team {b} 🕯️"],
        },
        {
          role: "crowd",
          channel: "comment",
          on: "c",
          lines: ["{c} really said go big", "this is so them", "team {c} 🦇"],
        },
      ],
      choice: {
        asks: "player",
        question: "You judge the Halloween costume contest. Whose costume wins?",
        options: [
          { label: "{a}", next: "a-wins" },
          { label: "{b}", next: "b-wins" },
          { label: "{c}", next: "c-wins" },
        ],
        default: 0,
        timeoutDays: 2,
      },
    },
    winner("a"),
    winner("b"),
    winner("c"),
  ],
  exit: {
    role: "a",
    channel: "post",
    heat: { line: "the costume goes back in the box until next Halloween", for: "fans" },
  },
});
