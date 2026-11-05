// ──────────────────────────────────────────────
// Big Cheese M4 T9: the 46 achievements (content.md 10.2)
// ──────────────────────────────────────────────
// All 46 names are data. Only the ones the code can see have a `check`; the rest are "later" and are
// never shown or unlocked. An Honest or Ironman run (`cheeseMark`) unlocks nothing (cheese-board.md 7).
import { METERS, type Run } from "./types.js";

const NAMES = [
  "Fired in week 2",
  "Everyone came to your farewell",
  "The first coffee machine you broke",
  'Said "let me think about it" 20 times',
  "Refused every card in a week",
  "Answered every card the same day",
  "Won the Friday raffle as the boss",
  "Gave a speech that ended early",
  "Pardoned the same person three times",
  "Learned a secret and kept it",
  "Learned a secret and told the room",
  "Survived a crisis with no meter below 40",
  "Lost a vote by one voice",
  "Won a vote by one voice",
  "Hired a person nobody liked",
  "Fired a person everybody liked",
  "Built a room that nobody uses",
  "Visited every room in one day",
  "Got a gift from a rival",
  "Gave a gift to a rival",
  "Had a plant named after you",
  "Cancelled a tradition and stayed alive",
  "Created a tradition by accident",
  "Delegated everything and went home early",
  "Spent your whole budget on cake",
  "Cleaned a room yourself",
  "Told a joke and the room laughed",
  "Told a joke and the room did not laugh",
  "Heard a rumour about yourself that was true",
  "Beat the rival in a week",
  "Avoided a strike by one phone call",
  "Held a meeting that ended on time",
  "Let a cat run the place for a day",
  "Used three wishes in one term",
  "Made a deputy cry in a good way",
  "Had a perfect Friday report",
  "Had a terrible Friday report and a good Monday",
  "Wore the wrong hat to a ceremony",
  "Was late to your own party",
  "Closed the place and opened it again",
  "Won a board hearing",
  "Won a hearing with one vote",
  "Typed an answer that nobody offered",
  "Kept a promise that was due on Friday",
  "Closed a cover-up thread before the paper found it",
  "Read every Letters from the last boss letter on its day",
];

/** The live ones, by number (1-based, as in the content file). */
const LIVE: Record<number, (s: Run) => boolean> = {
  4: (s) => (s.tally["ach.delay"] ?? 0) >= 20,
  34: (s) => s.wishPoints.left === 0,
  36: (s) => !!s.report && METERS.every((m) => s.report!.after[m] > s.report!.before[m]),
  41: (s) => !!s.lastHearing?.won,
  42: (s) => !!s.lastHearing?.won && s.lastHearing.backing === Math.floor(s.lastHearing.of / 2) + 1,
  45: (s) => s.closed.some((c) => c.layer === "crime" && c.state === "won"),
};

export const ACHIEVEMENTS = NAMES.map((name, i) => ({ id: `a${i + 1}`, name, check: LIVE[i + 1] }));

/** Called from `answerCard` for the boss's own answers. */
export function noteAnswer(s: Run, stance: string) {
  if (stance === "delay") s.tally["ach.delay"] = (s.tally["ach.delay"] ?? 0) + 1;
}

/** Unlocks each live achievement once. */
export function unlockAchievements(s: Run) {
  if (s.cheeseMark) return;
  for (const a of ACHIEVEMENTS) if (a.check && !s.achievements.includes(a.id) && a.check(s)) s.achievements.push(a.id);
}

/** The unlocked ones with their names, for the end card. */
export const unlocked = (s: Run) =>
  ACHIEVEMENTS.filter((a) => s.achievements.includes(a.id)).map(({ id, name }) => ({ id, name }));
