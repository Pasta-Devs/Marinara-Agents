// Mini-games (modules.md section 4): Speech and Interview. The code scores every pick;
// the model only writes the lines afterwards. T18 adds `seating` and `inspection` to MINIGAMES.
import type { PlaceKit } from "./kits/types.js";
import { addTrust, applyDelta, pure, spendHour } from "./run.js";
import { DIFFICULTY_FACTOR, type Minigame, type MiniOutcome, type MiniResult, type Run } from "./types.js";

/** One kind of mini-game: the options it offers and how the picks score. */
export interface MiniKind {
  play(s: Run, kit: PlaceKit, g: Minigame, picks: string[]): Omit<MiniResult, "lines">;
}

const STAND = /^h\d+$/;
// A speech line: the traits that like it and the traits that dislike it, two wordings.
export const SPEECH: Record<string, { like: string[]; dislike: string[]; text: [string, string] }> = {
  warm: {
    like: ["faithful", "loyal", "nurturing", "easygoing", "romantic"],
    dislike: ["strict", "vengeful", "loner"],
    text: ["Thank everyone for the hard week.", "Say that this place is a home, not only a job."],
  },
  bold: {
    like: ["ambitious", "brave", "hot-headed", "proud"],
    dislike: ["cautious", "anxious", "shy"],
    text: ["Promise that this term you aim higher.", "Say that the next week will beat the best one."],
  },
  funny: {
    like: ["joker", "gossip", "charming", "flirty", "easygoing"],
    dislike: ["strict", "proud", "perfectionist"],
    text: ["Open with a joke about yourself.", "Tell a short funny story from your first week."],
  },
  honest: {
    like: ["honest", "curious", "bookish", "perfectionist"],
    dislike: ["sly", "jealous", "gossip"],
    text: ["Say plainly what went wrong this week.", "Admit one mistake you made."],
  },
  firm: {
    like: ["strict", "perfectionist", "loyal", "ambitious"],
    dislike: ["rebel", "easygoing", "dreamy"],
    text: ["Remind everyone of the rules.", "Say that late work stops now."],
  },
};
// An interview question: the five traits it can bring out. Together the six cover all 30 traits.
export const QUESTIONS: Record<string, { probes: string[]; text: string }> = {
  pressure: {
    probes: ["cautious", "brave", "anxious", "hot-headed", "shy"],
    text: "What do you do when everything goes wrong?",
  },
  people: {
    probes: ["loyal", "faithful", "nurturing", "gossip", "loner"],
    text: "Tell me about a person you worked with.",
  },
  work: {
    probes: ["perfectionist", "ambitious", "bookish", "curious", "dreamy"],
    text: "What do you want to be doing in a year?",
  },
  money: {
    probes: ["frugal", "generous", "jealous", "sly", "proud"],
    text: "What would you do with a bit of spare money?",
  },
  rules: {
    probes: ["strict", "rebel", "honest", "stubborn", "easygoing"],
    text: "What do you do when a rule makes no sense?",
  },
  heart: {
    probes: ["charming", "joker", "flirty", "romantic", "vengeful"],
    text: "What do people like about you, and what do they not?",
  },
};
export const SPEECH_TAGS = Object.keys(SPEECH);
export const QUESTION_TAGS = Object.keys(QUESTIONS);
const WEIGHTS = [1, 1, 2]; // the closing line counts double
const STANDING: Record<MiniOutcome, number> = { great: 6, good: 3, flat: 0, bad: -4 };

export const outcomeOf = (score: number): MiniOutcome =>
  score >= 0.4 ? "great" : score >= 0.1 ? "good" : score > -0.1 ? "flat" : "bad";

const traitsOf = (s: Run, kit: PlaceKit, id: string): string[] =>
  kit.people.find((p) => p.id === id)?.traits ?? s.people[id]?.traits ?? [];

const react = (traits: string[], tag: string) => {
  const t = SPEECH[tag]!;
  return Number(traits.some((x) => t.like.includes(x))) - Number(traits.some((x) => t.dislike.includes(x)));
};

export const MINIGAMES: Record<string, MiniKind> = {
  speech: {
    play(s, kit, g, picks) {
      const tags = picks.map((id) => g.options.find((o) => o.id === id)!.tag);
      const steps = picks.map((id, i) => ({
        id,
        tag: tags[i]!,
        text: g.options.find((o) => o.id === id)!.text,
        value: g.people.reduce((a, p) => a + react(traitsOf(s, kit, p), tags[i]!), 0),
      }));
      const total = steps.reduce((a, x, i) => a + WEIGHTS[i]! * x.value, 0);
      const score = total / (g.people.length * WEIGHTS.reduce((a, b) => a + b, 0));
      const outcome = outcomeOf(score);
      for (const p of g.people) {
        const net = tags.reduce((a, t, i) => a + WEIGHTS[i]! * react(traitsOf(s, kit, p), t), 0);
        addTrust(s, p, Math.max(-3, Math.min(3, net)));
      }
      s.meters = applyDelta(s.meters, { standing: STANDING[outcome] }, DIFFICULTY_FACTOR[s.difficulty ?? "normal"]);
      return { picks, steps, score, outcome, revealed: [] };
    },
  },
  interview: {
    play(s, kit, g, picks) {
      const who = g.people[0]!;
      const have = traitsOf(s, kit, who);
      const steps = picks.map((id) => {
        const q = g.options.find((o) => o.id === id)!;
        const hit = QUESTIONS[q.tag]!.probes.find((t) => have.includes(t));
        return { id, tag: q.tag, text: q.text, value: hit ? 1 : 0, trait: hit };
      });
      const revealed = steps.flatMap((x) => (x.trait ? [x.trait] : []));
      addTrust(s, who, 3 * revealed.length);
      const score = revealed.length / g.need;
      return {
        picks,
        steps,
        score,
        outcome: revealed.length >= 2 ? "great" : revealed.length ? "good" : "flat",
        revealed,
      };
    },
  },
};

const make = (s: Run, kind: string, people: string[], options: Minigame["options"]): Minigame => ({
  kind,
  people,
  need: 3,
  options,
  week: s.clock.week,
  done: null,
});

/** Morning pass (in place): a new hire gets an interview, a Monday gets a speech. Uses no rng. */
export function minigameOffer(s: Run) {
  // An open game waits until its week ends, and only while its people are still here.
  const open = s.minigame && !s.minigame.done ? s.minigame : undefined;
  if (open && open.week === s.clock.week && open.people.every((p) => s.people[p]?.status === "active")) return;
  const played = s.minigames ?? [];
  const speechDay = s.clock.day === 0 && !played.includes(`speech:${s.clock.week}`); // Monday's speech goes first
  const id = Object.keys(s.people).find(
    (k) => STAND.test(k) && s.people[k]!.status === "active" && !played.includes(`interview:${k}`),
  );
  if (open) s.minigame = null;
  if (id && !speechDay) {
    s.minigame = make(
      s,
      "interview",
      [id],
      QUESTION_TAGS.map((tag) => ({ id: tag, tag, text: QUESTIONS[tag]!.text })),
    );
    return;
  }
  const crowd = Object.keys(s.people)
    .filter((k) => s.people[k]!.status === "active")
    .slice(0, 6);
  if (s.clock.day === 0 && crowd.length >= 2 && !played.includes(`speech:${s.clock.week}`)) {
    s.minigame = make(
      s,
      "speech",
      crowd,
      SPEECH_TAGS.map((tag) => ({ id: tag, tag, text: SPEECH[tag]!.text[s.clock.week % 2]! })),
    );
  }
}

/** The boss plays the open mini-game (in place). Picks must be `need` different option ids. */
export function minigamePlay(s: Run, kit: PlaceKit, kind: string, picks: string[]) {
  const g = s.minigame;
  if (!g || g.done || g.kind !== kind || !Object.hasOwn(MINIGAMES, kind)) throw new Error("No mini-game is open.");
  if (
    picks.length !== g.need ||
    new Set(picks).size !== picks.length ||
    picks.some((p) => !g.options.some((o) => o.id === p))
  )
    throw new Error(`Pick ${g.need} different ones.`);
  if (s.clock.hoursLeft < 1) throw new Error("Not enough hours.");
  spendHour(s);
  g.done = { ...MINIGAMES[kind]!.play(s, kit, g, picks), lines: [] };
  (s.minigames ??= []).push(kind === "interview" ? `interview:${g.people[0]}` : `${kind}:${g.week}`);
}

/** The model's words for the played mini-game: one line per step. */
export function minigameText(s: Run, lines: { who: string; text: string }[]) {
  const d = s.minigame?.done;
  if (!d) throw new Error("No mini-game is open.");
  d.lines = lines.slice(0, d.steps.length);
}

export const pureMinigamePlay = pure(minigamePlay);
export const pureMinigameText = pure(minigameText);
