// Mini-games (modules.md section 4): Speech, Interview, Seating and Inspection. The code scores
// every pick; the model only writes the lines afterwards.
import { dayIndex } from "./clock.js";
import { kitOf } from "./horror.js";
import { dial } from "./layers.js";
import type { PlaceKit } from "./kits/types.js";
import { relKey, shiftRelation } from "./people.js";
import { pick } from "./rng.js";
import { addTrust, applyDelta, pure, spendHour } from "./run.js";
import { DIFFICULTY_FACTOR, type Minigame, type MiniOutcome, type MiniResult, type Run } from "./types.js";

/** One kind of mini-game: the options it offers, how the picks score, and the plain sentence for a step. */
export interface MiniKind {
  play(s: Run, kit: PlaceKit, g: Minigame, picks: string[]): Omit<MiniResult, "lines">;
  /** What the model's line for this step has to keep to. */
  verdict(x: MiniResult["steps"][number]): string;
  /** Extra pick check when picks are not plain option ids (Seating). */
  valid?(g: Minigame, picks: string[]): boolean;
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
export const STANDING: Record<MiniOutcome, number> = { great: 6, good: 3, flat: 0, bad: -4 };

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
    verdict: (x) =>
      x.value > 0
        ? "The crowd likes this line."
        : x.value < 0
          ? "The crowd does not like this line."
          : "The crowd stays quiet.",
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
    verdict: (x) => (x.trait ? `The answer shows they are ${x.trait}.` : "The answer shows nothing new."),
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
  // Picks are "person@seat". Seats sit in a row, so each seat has the next one as its neighbour.
  seating: {
    verdict: (x) =>
      x.value < 0 ? `${x.text} They do not get on.` : x.value > 0 ? `${x.text} They are glad of it.` : x.text,
    valid(g, picks) {
      const ps = picks.map((x) => x.split("@"));
      return (
        ps.every(
          ([p, seat], i) => ps[i]!.length === 2 && g.people.includes(p!) && g.options.some((o) => o.id === seat),
        ) &&
        new Set(ps.map((x) => x[0])).size === ps.length &&
        new Set(ps.map((x) => x[1])).size === ps.length
      );
    },
    play(s, kit, g, picks) {
      const name = (id: string) => kit.people.find((p) => p.id === id)?.name ?? s.people[id]?.name ?? id;
      const seated = new Map(picks.map((x) => [x.split("@")[1]!, x.split("@")[0]!]));
      const row = g.options.map((o) => seated.get(o.id)!);
      const love = dial(s, "romance") > 0;
      const steps: MiniResult["steps"] = [];
      for (let i = 0; i + 1 < row.length; i++) {
        const [a, b] = [row[i]!, row[i + 1]!];
        const r = s.relations.find((x) => relKey(x) === relKey({ a, b }));
        const d = r?.kind === "rival" ? -5 : r?.kind === "friend" ? 3 : r?.kind === "crush" && love ? 5 : 0;
        if (!d) continue;
        shiftRelation(s, a, b, d);
        steps.push({ id: `${a}|${b}`, tag: r!.kind, text: `${name(a)} sits next to ${name(b)}.`, value: d });
      }
      const score = Math.max(-1, Math.min(1, steps.reduce((t, x) => t + x.value, 0) / 10));
      return { picks, steps, score, outcome: outcomeOf(score), revealed: [] };
    },
  },
  // Picks are the rooms the boss shows (0..all). The inspector also opens one room that was not shown.
  inspection: {
    verdict: (x) =>
      x.tag === "hidden"
        ? `${x.text} They were not meant to see it.`
        : `${x.text} ${x.value < -0.2 ? "It is in a poor state." : x.value > 0.2 ? "It is in good shape." : "It is fine."}`,
    play(s, kit, g, picks) {
      const room = (id: string) => kit.rooms.find((r) => r.id === id)!;
      const hidden = (id: string) => room(id).kind === "hidden" && !s.openedRooms.includes(id);
      const left = kit.rooms.filter((r) => !picks.includes(r.id));
      const found = left.length ? pick(s, left).id : null;
      const steps = [...picks, ...(found ? [found] : [])].map((id) => {
        const cond = Object.hasOwn(s.rooms, id) ? s.rooms[id]!.condition : room(id).condition;
        return {
          id,
          tag: hidden(id) ? "hidden" : id === found ? "found" : "shown",
          text: `${id === found ? "The inspector opens" : "The inspector looks at"} ${room(id).name}.`,
          value: hidden(id) ? -1 : (cond - 50) / 50,
        };
      });
      const score = steps.length ? steps.reduce((t, x) => t + x.value, 0) / steps.length : 0;
      const outcome = outcomeOf(score);
      const standing = STANDING[outcome] + (found && hidden(found) ? -5 : 0);
      s.meters = applyDelta(s.meters, { standing }, DIFFICULTY_FACTOR[s.difficulty ?? "normal"]);
      return { picks, steps, score, outcome, revealed: [] };
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
  // Priority: Monday speech, a new hire's interview, tonight's seating, then an inspector's visit.
  const active = (k: string) => s.people[k]?.status === "active";
  const here = Object.keys(s.people).filter(active).slice(0, 6);
  const party = Object.values(s.threads)
    .flatMap((t) => t.beats)
    .some(
      (b) =>
        b.type === "big_scene" &&
        !b.result &&
        (b.blueprint === "party" || b.blueprint === "gala") &&
        b.planned &&
        dayIndex(b.planned) === dayIndex(s.clock),
    );
  const visit = Object.values(s.threads).find(
    (t) =>
      t.state === "open" &&
      t.kind === "crisis" &&
      t.need === "standing" &&
      /inspect/i.test(t.title) &&
      !played.includes(`inspection:${t.id}`),
  );
  if (!speechDay && party && here.length >= 3 && !played.includes(`seating:${s.clock.week}`)) {
    const seats = here.map((_, i) => ({ id: `s${i + 1}`, tag: "seat", text: String(i + 1) }));
    s.minigame = { ...make(s, "seating", here, seats), need: here.length };
    return;
  }
  // A hidden room stays out of the list until the boss has opened it.
  const rooms = (kitOf(s)?.rooms ?? [])
    .filter((r) => r.kind !== "hidden" || s.openedRooms.includes(r.id))
    .map((r) => ({ id: r.id, tag: r.kind, text: r.name }));
  if (!speechDay && visit && rooms.length) {
    s.minigame = {
      ...make(s, "inspection", visit.people.filter(active), rooms),
      need: rooms.length,
      min: 0,
      key: `inspection:${visit.id}`,
    };
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
    picks.length < (g.min ?? g.need) ||
    picks.length > g.need ||
    new Set(picks).size !== picks.length ||
    !(MINIGAMES[kind]!.valid?.(g, picks) ?? picks.every((p) => g.options.some((o) => o.id === p)))
  )
    throw new Error(g.min === undefined ? `Pick ${g.need} different ones.` : `Pick up to ${g.need} different ones.`);
  if (s.clock.hoursLeft < 1) throw new Error("Not enough hours.");
  spendHour(s);
  g.done = { ...MINIGAMES[kind]!.play(s, kit, g, picks), lines: [] };
  (s.minigames ??= []).push(g.key ?? (kind === "interview" ? `interview:${g.people[0]}` : `${kind}:${g.week}`));
}

/** The model's words for the played mini-game: one line per step. */
export function minigameText(s: Run, lines: { who: string; text: string }[]) {
  const d = s.minigame?.done;
  if (!d) throw new Error("No mini-game is open.");
  d.lines = lines.slice(0, d.steps.length);
}

export const pureMinigamePlay = pure(minigamePlay);
export const pureMinigameText = pure(minigameText);
