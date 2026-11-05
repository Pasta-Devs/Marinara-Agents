// Big Cheese model tasks (design.md section 15): a prompt, a validator and a Lite fallback for each task.
// The model writes words only. Each validator rebuilds its output from known fields, so a number or an id
// that the model adds on its own never reaches the run state.
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { PlaceKit } from "../core/kits/types.js";
import { pick } from "../core/rng.js";
import { STANCES } from "../core/stances.js";
import { TRAITS } from "../core/traits.js";
import { METERS, SLOTS } from "../core/types.js";
import type { Meter, Severity, Tier } from "../core/types.js";

export type Band = "cold" | "wary" | "neutral" | "warm" | "loyal";
type Msg = { role: "system" | "user"; content: string };
/** Returns the model's raw text. Throw on any failure. */
export type ModelCall = (messages: Msg[], o: { signal: AbortSignal; maxTokens: number }) => Promise<string>;
type Obj = Record<string, unknown>;

// --- Inputs and outputs ---------------------------------------------------------------------

export interface CardSeed {
  id: string;
  asker: string;
  need: Meter;
  severity: Severity;
  offer: { tier: Tier; stance: string }[]; // chosen by the code (design 4.2)
}
export interface CardsDayInput {
  kit: PlaceKit;
  rng: number;
  seeds: CardSeed[];
}
export interface CardsDayOutput {
  cards: { seed: string; text: string; answers: { stance: string; text: string }[] }[];
}

export interface AnswerTagInput {
  kit: PlaceKit;
  text: string;
  allowed?: readonly string[]; // defaults to every core stance
  asker?: string;
}
export interface AnswerTagOutput {
  stance: string;
  promise?: { to: string; what: string };
}

export interface ScenePartInput {
  kit: PlaceKit;
  rng: number;
  blueprint: string;
  goal: string;
  room: string;
  people: string[]; // on stage
  offer: string[]; // stances the player can pick from; empty for a `check` part
  earlier?: string[]; // one-line summaries of earlier parts; its length is this part's index
  chose?: string[]; // the stance the player picked in each earlier part
}
export interface ScenePartOutput {
  lines: { who: string; text: string }[];
  suggestions: { stance: string; text: string }[];
  summary: string;
}

export interface FeelingLinesInput {
  kit: PlaceKit;
  rng: number;
  people: { person: string; band: Band }[];
}
export interface FeelingLinesOutput {
  lines: { person: string; band: Band; line: string }[];
}

// --- Validation helpers ---------------------------------------------------------------------

const obj = (v: unknown): Obj => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("expected an object");
  return v as Obj;
};
const list = (v: unknown, min: number, max = min): unknown[] => {
  if (!Array.isArray(v) || v.length < min || v.length > max) throw new Error("wrong item count");
  return v;
};
// AI-speak check: no em dash and no "No X, no Y" (design: voice rules).
const str = (v: unknown, min: number, max: number, what: string): string => {
  const t = typeof v === "string" ? v.trim() : "";
  if (t.length < min || t.length > max) throw new Error(`${what}: bad length`);
  if (/[–—]|\bno\s+\w+,\s*no\s+\w+/i.test(t)) throw new Error(`${what}: AI-speak`);
  return t;
};
const words = (v: unknown, min: number, max: number, what: string): string => {
  const t = str(v, min, max, what);
  if (/\d/.test(t)) throw new Error(`${what}: has a digit`);
  return t;
};
// Deny lists (design 4.3). shortcut: word lists, swap for an answer.tag check if false fits show up in play.
const DENY: Record<string, RegExp> = { refuse: /\b(fund|yes|pay for)\b/i, invest: /\b(no|later)\b/i };
const answerText = (stance: string, v: unknown): string => {
  const t = words(v, 3, 80, "answer");
  if (DENY[stance]?.test(t)) throw new Error(`answer: wrong words for ${stance}`);
  return t;
};
const suggestions = (v: unknown, offer: string[]) => {
  const a = list(v, offer.length);
  return offer.map((stance, i) => {
    const s = obj(a[i]);
    if (s.stance !== stance) throw new Error("suggestion: stance out of order");
    return { stance, text: answerText(stance, s.text) };
  });
};
const person = (kit: PlaceKit, id: unknown) => {
  const p = kit.people.find((x) => x.id === id);
  if (!p) throw new Error(`unknown person ${String(id)}`);
  return p;
};

// --- Prompt helpers -------------------------------------------------------------------------

const RULES = [
  "Write in-world speech only. People talk the way people in this place talk.",
  "Never write as an AI. No taglines. No 'No X, no Y' lines. No em dashes. No hype words.",
  "Keep lines short, the way a person would say them.",
  "Write no numbers, no meters, no trust values and no outcomes. The code owns every number.",
  "Reply with ONLY one JSON object in the given shape. No prose, no code fence.",
].join("\n");

const MEANING: Record<string, string> = {
  invest: "pay for a proper fix",
  cheap_fix: "a quick cheap patch",
  delay: "put it off for now",
  delegate: "hand it to someone else",
  refuse: "say no",
  ask_others: "ask the others first",
};
const stanceHelp = (stances: readonly string[]) => stances.map((s) => `${s} (${MEANING[s] ?? s})`).join(", ");

const voiceSheet = (kit: PlaceKit, ids: string[]) =>
  ids
    .map((id) => {
      const p = person(kit, id);
      return `- ${id}: ${p.name}, ${p.role}.${p.core ? ` ${p.core}` : ""} Voice: ${p.voice.style}. Sounds like: ${p.voice.phrases.map((x) => `"${x}"`).join(" / ")}`;
    })
    .join("\n");

const msgs = (kit: PlaceKit, system: string, user: unknown): Msg[] => [
  {
    role: "system",
    content: `You write for "${kit.name}", a game place. ${kit.premise}${kit.boss ? `\nThe boss is ${kit.boss.name}. ${kit.boss.about}` : ""}\n${RULES}\n${system}`,
  },
  { role: "user", content: JSON.stringify(user) },
];

// --- Tasks ----------------------------------------------------------------------------------

interface Task<I, O> {
  tokens: number; // the reply's own need; runTask adds reasoning headroom
  prompt(i: I): Msg[];
  parse(raw: unknown, i: I): O;
  lite(i: I): O;
}

const cardsDay: Task<CardsDayInput, CardsDayOutput> = {
  tokens: 1500,
  prompt: (i) =>
    msgs(
      i.kit,
      `Write each card: the asker's line, then one short answer line per given stance, in the given order. Echo "seed" and every "stance" exactly.
Shape: {"cards":[{"seed":"","text":"","answers":[{"stance":"","text":""}]}]}
Stances: ${stanceHelp(STANCES)}
Voices:\n${voiceSheet(i.kit, [...new Set(i.seeds.map((s) => s.asker))])}`,
      {
        cards: i.seeds.map((s) => ({
          seed: s.id,
          asker: s.asker,
          topic: s.need,
          stances: s.offer.map((o) => o.stance),
        })),
      },
    ),
  parse(raw, i) {
    const cards = list(obj(raw).cards, i.seeds.length);
    return {
      cards: i.seeds.map((s, n) => {
        const c = obj(cards[n]);
        if (c.seed !== s.id) throw new Error("card: seed out of order");
        const a = list(c.answers, s.offer.length);
        return {
          seed: s.id,
          text: str(c.text, 3, 240, "ask"),
          answers: s.offer.map((o, k) => {
            const x = obj(a[k]);
            if (x.stance !== o.stance) throw new Error("answer: stance out of order");
            return { stance: o.stance, text: answerText(o.stance, x.text) };
          }),
        };
      }),
    };
  },
  lite(i) {
    const h = { rng: i.rng };
    return {
      cards: i.seeds.map((s) => {
        const t = pick(h, i.kit.templates.cards[s.need][s.severity]);
        return { seed: s.id, text: t.ask, answers: s.offer.map((o) => ({ stance: o.stance, text: t[o.tier] })) };
      }),
    };
  },
};

// Lite matcher: first rule that fits an allowed stance wins.
const KEYWORDS: [string, RegExp][] = [
  ["delay", /\b(not (now|yet|this)|later|wait|next|tomorrow|soon|think about)\b/i],
  ["refuse", /\b(no|never|refuse|won'?t|can'?t|deny|denied)\b/i],
  ["ask_others", /\b(ask (the|everyone|all|others)|vote|poll|crew decides)\b/i],
  ["delegate", /\b(delegate|hand|sort it|deal with it|let \w+ (handle|sort|deal))\b/i],
  ["invest", /\b(buy|pay|fund|hire|replace|order|proper|new)\b/i],
  ["cheap_fix", /\b(patch|tape|quick|repair|fix|temporary|for now|cheap)\b/i],
];

const answerTag: Task<AnswerTagInput, AnswerTagOutput> = {
  tokens: 400,
  prompt: (i) =>
    msgs(
      i.kit,
      `The player typed an answer to a request. Pick the ONE stance that fits it best from: ${stanceHelp(i.allowed ?? STANCES)}.
If the player promises something to a person, add it. Do not judge the answer.
Shape: {"stance":"","promise":null} or {"stance":"","promise":{"to":"<person id>","what":"<short phrase>"}}
People ids: ${i.kit.people.map((p) => p.id).join(", ")}`,
      { text: i.text.slice(0, 300), asker: i.asker ?? null },
    ),
  parse(raw, i) {
    const o = obj(raw);
    const allowed: readonly string[] = i.allowed ?? STANCES;
    const stance = allowed.find((s) => s === o.stance);
    if (!stance) throw new Error("stance not allowed");
    if (o.promise == null) return { stance };
    const p = obj(o.promise);
    return { stance, promise: { to: person(i.kit, p.to).id, what: str(p.what, 3, 120, "promise") } };
  },
  lite(i) {
    const allowed: readonly string[] = i.allowed ?? STANCES;
    const hit = KEYWORDS.find(([s, re]) => allowed.includes(s) && re.test(i.text));
    const stance = hit?.[0] ?? (allowed.includes("delay") ? "delay" : allowed[0]!);
    return i.asker && /\bpromise\b/i.test(i.text)
      ? { stance, promise: { to: i.asker, what: i.text.trim().slice(0, 120) } }
      : { stance };
  },
};

// Stock suggestion lines for Lite mode, one per stance.
/** What the player chose, in plain words, for scene summaries and the next part's first line. */
export const CHOSE: Record<string, string> = {
  invest: "You chose to pay for it.",
  cheap_fix: "You chose the cheap fix.",
  delay: "You chose to wait.",
  delegate: "You handed it to someone else.",
  refuse: "You said no.",
  ask_others: "You asked the others first.",
  other: "You answered in your own words.",
};

const SUGGEST: Record<string, string> = {
  invest: "Do it properly. I will pay for it.",
  cheap_fix: "A quick fix for now.",
  delay: "Not yet. We wait and see.",
  delegate: "Someone else will handle it.",
  refuse: "No. Not this time.",
  ask_others: "We ask the others first.",
};

const scenePart: Task<ScenePartInput, ScenePartOutput> = {
  tokens: 1200,
  prompt: (i) =>
    msgs(
      i.kit,
      `Write one part of a scene in "${i.room}". Goal: ${i.goal}
Write 3 to 12 lines. "who" is a person id from the list, or "narrator" for a line of narration.
${i.offer.length ? `Then write one short line the boss could say for each stance, in the given order. Echo each "stance". Stances: ${stanceHelp(i.offer)}` : `Write "suggestions": [].`}
Write "summary": one sentence, at most 120 characters.
Shape: {"lines":[{"who":"","text":""}],"suggestions":[{"stance":"","text":""}],"summary":""}
People on stage:\n${voiceSheet(i.kit, i.people)}`,
      { scene: i.blueprint, earlier: i.earlier ?? [], stances: i.offer },
    ),
  parse(raw, i) {
    const o = obj(raw);
    const lines = list(o.lines, 3, 12).map((l) => {
      const x = obj(l);
      if (x.who !== "narrator" && !i.people.includes(x.who as string)) throw new Error("line: who is not on stage");
      return { who: x.who as string, text: words(x.text, 3, 200, "line") };
    });
    return {
      lines,
      suggestions: suggestions(o.suggestions ?? [], i.offer),
      summary: str(o.summary, 3, 120, "summary"),
    };
  },
  lite(i) {
    const h = { rng: i.rng };
    const part = i.earlier?.length ?? 0;
    // The kit's arrival lines come in groups of 4, one group per part.
    const arrival = i.kit.templates.arrival.slice(part * 4, part * 4 + 4);
    const last = i.chose?.[part - 1];
    const lines = [
      ...(last ? [{ who: "narrator", text: CHOSE[last] ?? CHOSE.other! }] : []),
      ...(i.blueprint === "arrival" && arrival.length >= 3
        ? arrival.map((text) => ({ who: "narrator", text }))
        : Array.from({ length: Math.max(3, i.people.length) }, (_, n) => {
            const p = person(i.kit, i.people[(n + part) % i.people.length]);
            return { who: p.id, text: pick(h, p.voice.phrases) };
          })),
    ];
    return {
      lines,
      suggestions: i.offer.map((stance) => ({ stance, text: SUGGEST[stance] ?? SUGGEST.delay! })),
      summary: i.goal.slice(0, 120),
    };
  },
};

const feelingLines: Task<FeelingLinesInput, FeelingLinesOutput> = {
  tokens: 800,
  prompt: (i) =>
    msgs(
      i.kit,
      `Write one line for each person: how they feel about the boss, in their own voice or as a short note about them. The line must fit the given band. Echo "person" and "band".
Shape: {"lines":[{"person":"","band":"","line":""}]}
Bands, with examples:\n${(Object.keys(i.kit.templates.feeling) as Band[]).map((b) => `- ${b}: ${i.kit.templates.feeling[b].slice(0, 2).join(" / ")}`).join("\n")}
Voices:\n${voiceSheet(
        i.kit,
        i.people.map((p) => p.person),
      )}`,
      { people: i.people },
    ),
  parse(raw, i) {
    const a = list(obj(raw).lines, i.people.length);
    return {
      lines: i.people.map((p, n) => {
        const x = obj(a[n]);
        if (x.person !== p.person || x.band !== p.band) throw new Error("feeling: person or band mismatch");
        return { person: p.person, band: p.band, line: words(x.line, 3, 120, "feeling") };
      }),
    };
  },
  lite(i) {
    const h = { rng: i.rng };
    return { lines: i.people.map((p) => ({ ...p, line: pick(h, i.kit.templates.feeling[p.band]) })) };
  },
};

// cast.read (cast.md section 3): an Engine card becomes a casting sheet. Only the card's own fields go in.
export interface CastReadInput {
  kit: PlaceKit;
  card: { name: string; description: string; personality: string; scenario: string; backstory: string; tags: string[] };
  roles: string[]; // open roles in the place
}
export interface CastReadOutput {
  core: string;
  roleFit: string[]; // roles from `roles`, best first
  traits: string[]; // 0 to 2 ids from the catalog (0 only on the Lite path)
  tone: string;
  lines: string[];
}

const castRead: Task<CastReadInput, CastReadOutput> = {
  tokens: 700,
  prompt: (i) =>
    msgs(
      i.kit,
      `Read this character card for a new member of staff. The person keeps their own voice. Never invent an age. Roles open in the place: ${i.roles.join(", ")}. Traits: ${TRAITS.join(", ")}. Shape: {"core":"","roleFit":[""],"traits":[""],"tone":"","lines":[""]}. "core" is at most 60 words on who they are. "roleFit" is up to 2 roles from the list, best first. "traits" is 1 or 2 from the list. "tone" is 1 to 4 words on how they talk. "lines" is 2 or 3 short things they would say, close to how the card writes them.`,
      i.card,
    ),
  parse(raw, i) {
    const o = obj(raw);
    const traits = [...new Set(Array.isArray(o.traits) ? o.traits : [])].filter((t) =>
      (TRAITS as readonly unknown[]).includes(t),
    );
    if (!traits.length) throw new Error("no trait from the catalog");
    return {
      core: str(o.core, 3, 500, "core"),
      roleFit: (Array.isArray(o.roleFit) ? o.roleFit : [])
        .filter((r) => i.roles.includes(r as string))
        .slice(0, 2) as string[],
      traits: traits.slice(0, 2) as string[],
      tone: str(o.tone ?? "", 0, 40, "tone"),
      lines: list(o.lines, 1, 3).map((l) => str(l, 3, 160, "line")),
    };
  },
  // Lite: the card's own words. Traits are the catalog words the card uses, so there can be none.
  lite(i) {
    const c = i.card;
    const text = `${c.personality} ${c.description}`.toLowerCase();
    const first = (c.personality || c.description).split(/(?<=[.!?])\s/)[0].slice(0, 160);
    return {
      core: `${c.name}. ${(c.description || c.personality).split(/\s+/).slice(0, 50).join(" ")}`.trim(),
      roleFit: [],
      traits: TRAITS.filter((t) => new RegExp(`\\b${t}\\b`).test(text)).slice(0, 2),
      tone: "",
      lines: first ? [first] : [],
    };
  },
};

// --- ambient.batch and grapevine.batch (design.md section 6, 8.2 and 15) ---------------

export interface AmbientBatchInput {
  kit: PlaceKit;
  rng: number;
  // One entry per person overheard: where they are, their mood and who they are close to or at odds with.
  people: {
    person: string;
    room: string;
    mood: string;
    with: { person: string; kind: string }[];
    reasons?: string[];
  }[];
}
export interface AmbientBatchOutput {
  lines: { person: string; line: string }[];
}

const ambientBatch: Task<AmbientBatchInput, AmbientBatchOutput> = {
  tokens: 600,
  prompt: (i) =>
    msgs(
      i.kit,
      `Write one short line for each person: something they say out loud or a small thing they do, as the boss overhears it in the room. Echo "person". Use the mood and the relations as a hint, and never state them. Shape: {"lines":[{"person":"","line":""}]}\nPeople:\n${i.people
        .map(
          (p) =>
            `- ${p.person}, in ${p.room}, mood ${p.mood}${p.with.map((w) => `, ${w.kind} of ${w.person}`).join("")}${(p.reasons ?? []).map((r) => `. True now, react in character: ${r}`).join("")}`,
        )
        .join("\n")}\nVoices:\n${voiceSheet(
        i.kit,
        i.people.map((p) => p.person),
      )}`,
      { people: i.people },
    ),
  parse(raw, i) {
    const lines = list(obj(raw).lines, i.people.length);
    return {
      lines: i.people.map((p, n) => {
        const x = obj(lines[n]);
        if (x.person !== p.person) throw new Error("ambient: person out of order");
        return { person: p.person, line: words(x.line, 3, 160, "line") };
      }),
    };
  },
  lite(i) {
    const h = { rng: i.rng };
    return {
      lines: i.people.map((p, n) => {
        const other = i.kit.people.find((x) => x.id === i.people[(n + 1) % i.people.length]?.person);
        let k = 0;
        const line = pick(h, i.kit.smallMoments)
          .replace(/\{person\}/g, () => (k++ ? (other ?? person(i.kit, p.person)).name : person(i.kit, p.person).name))
          .replace("{room}", p.room)
          .replace("{place}", i.kit.name);
        return { person: p.person, line };
      }),
    };
  },
};

export interface GrapevineBatchInput {
  kit: PlaceKit;
  rng: number;
  facts: { person: string; text: string }[]; // the day's moments, picked by the code
}
export interface GrapevineBatchOutput {
  lines: { source: string; line: string }[];
}

const grapevineBatch: Task<GrapevineBatchInput, GrapevineBatchOutput> = {
  tokens: 700,
  prompt: (i) =>
    msgs(
      i.kit,
      `Turn the day's moments into 3 to 6 rumours the staff pass on. "source" is the person who tells it, from the list. Rumours stay close to the facts and add no new facts. Shape: {"lines":[{"source":"","line":""}]}\nMoments:\n${i.facts.map((f) => `- ${f.person}: ${f.text}`).join("\n")}\nVoices:\n${voiceSheet(
        i.kit,
        i.kit.people.map((p) => p.id),
      )}`,
      { facts: i.facts },
    ),
  parse(raw, i) {
    const lines = list(obj(raw).lines, Math.min(3, i.facts.length), 6);
    return {
      lines: lines.map((l) => {
        const x = obj(l);
        return { source: person(i.kit, x.source).id, line: words(x.line, 3, 160, "line") };
      }),
    };
  },
  lite: (i) => ({ lines: i.facts.slice(0, 6).map((f) => ({ source: f.person, line: f.text })) }),
};

// thread.beat (design.md 3.4): a thread opens from text. The code plans the kind, people, need and beat types; the model writes
// the title, the stakes line and one line per beat.
export interface ThreadBeatInput {
  kit: PlaceKit;
  rng: number;
  kind: string;
  idea: string; // the wish, the action seed or the arc in the player's words
  people: string[];
  need: Meter;
  beats: { type: string }[];
}
export interface ThreadBeatOutput {
  title: string;
  stakes: string;
  lines: string[];
}

const threadBeat: Task<ThreadBeatInput, ThreadBeatOutput> = {
  tokens: 700,
  prompt: (i) =>
    msgs(
      i.kit,
      `Write the plan of one story in the place. Kind: ${i.kind}. Idea: ${i.idea.slice(0, 200)}. It puts ${i.need} at risk. A short title, one line on what is at stake, and one line for each beat in order: ${i.beats.map((b) => b.type).join(", ")}. Shape: {"title":"","stakes":"","lines":[""]}\nVoices:\n${voiceSheet(i.kit, i.people)}`,
      { people: i.people, beats: i.beats },
    ),
  parse(raw, i) {
    const o = obj(raw);
    const n = i.beats.length;
    return {
      title: words(o.title, 1, 60, "title"),
      stakes: words(o.stakes, 3, 200, "stakes"),
      lines: list(o.lines, n, n).map((l) => words(l, 3, 160, "line")),
    };
  },
  // Lite: the idea is the title, each beat gets a plain line.
  lite: (i) => ({
    title: i.idea.slice(0, 60) || i.kind,
    stakes: i.idea.slice(0, 200) || `Something is at stake for ${i.need}.`,
    lines: i.beats.map((b) => (b.type === "card" ? "Someone asks for help." : "Something happens in the place.")),
  }),
};

// meeting.turn (design.md 7.1): what the attendees say on one item, then a line for each stance.
export interface MeetingTurnInput {
  kit: PlaceKit;
  rng: number;
  title: string; // the meeting
  item: string; // the item that is up
  first: boolean; // the chair opens the meeting
  people: { person: string; side: "for" | "open" | "against" }[];
  offer: string[];
}
export interface MeetingTurnOutput {
  lines: { who: string; text: string }[];
  suggestions: { stance: string; text: string }[];
}

const meetingTurn: Task<MeetingTurnInput, MeetingTurnOutput> = {
  tokens: 900,
  prompt: (i) =>
    msgs(
      i.kit,
      `Write 2 to 4 lines the attendees of a "${i.title}" meeting say about this item: "${i.item}".${i.first ? " The chair opens the meeting first." : ""} "who" is a person id from the list. Each person speaks for, against or undecided, as given. Then write one suggestion line the boss could say for each stance, in the given order. Echo each "stance". Stances: ${stanceHelp(i.offer)}
Shape: {"lines":[{"who":"","text":""}],"suggestions":[{"stance":"","text":""}]}
Attendees:\n${i.people.map((p) => `- ${p.person}: ${p.side}`).join("\n")}
Voices:\n${voiceSheet(
        i.kit,
        i.people.map((p) => p.person),
      )}`,
      { people: i.people, offer: i.offer },
    ),
  parse(raw, i) {
    const o = obj(raw);
    const lines = list(o.lines, 2, 4).map((l) => {
      const x = obj(l);
      if (!i.people.some((p) => p.person === x.who)) throw new Error("line: who is not at the meeting");
      return { who: x.who as string, text: words(x.text, 3, 200, "line") };
    });
    return { lines, suggestions: suggestions(o.suggestions, i.offer) };
  },
  lite(i) {
    const h = { rng: i.rng };
    const lines = i.people.slice(0, i.first ? 3 : 2).map((p) => ({
      who: p.person,
      text: pick(h, person(i.kit, p.person).voice.phrases),
    }));
    return {
      lines: i.first
        ? [{ who: "narrator", text: `The ${i.title.replace(/_/g, " ")} begins. First up: ${i.item}.` }, ...lines]
        : lines,
      suggestions: i.offer.map((stance) => ({ stance, text: SUGGEST[stance] ?? SUGGEST.delay! })),
    };
  },
};

// board.plan (cheese-board.md §4): one Spin line becomes up to 8 beats. The model picks verbs, people and
// size words only; the Board turns sizes into numbers and checks every id against the run.
export const BOARD_PLAN_VERBS = [
  "person.feelings",
  "relation.shift",
  "ambition.set",
  "secret.add",
  "room.condition",
  "card.add",
  "meter.set",
] as const;
export const MAX_PLAN_BEATS = 8;

export interface BoardPlanInput {
  kit: PlaceKit;
  rng: number;
  text: string;
  target: string | null;
  world: Obj; // the run in short: clock, meters, people, rooms, open threads
}

export interface PlanBeat {
  id: string;
  when: { week: number; day: number; slot: string } | null; // null = now
  verb: string;
  who: string[];
  touches: Obj;
  scene: string;
}

export interface BoardPlanOutput {
  summary: string;
  question: string | null;
  cant: string[];
  thread: { title: string; people: string[]; need: Meter; stakes: string } | null;
  beats: PlanBeat[];
}

const boardPlan: Task<BoardPlanInput, BoardPlanOutput> = {
  tokens: 1200,
  prompt: (i) =>
    msgs(
      i.kit,
      `Plan the player's wish as at most ${MAX_PLAN_BEATS} beats, each on its own day. Verbs: ${BOARD_PLAN_VERBS.join(", ")}.
Never write a number. Size is "small", "medium" or "big"; "dir" is "up" or "down".
touches by verb: person.feelings {trust|stress: {size, dir}, mood: "great|fine|low|sick|away"}; relation.shift {relation: {kind: friend|rival|crush|couple|mentor|enemy|family|secret_affair, size, dir}} with who of 2 people; ambition.set {ambition: {size, dir}}; secret.add {} with who = the person it is about, then who knows it ("boss" is the player), and "scene" = the secret in one line; room.condition {room: id, size, dir}; card.add {need: money|output|people|standing, size}; meter.set {meter, size, dir}.
"when" is {week, day 0-4, slot: morning|midday|afternoon|evening|night} or null for now. Set "question" when the words are unclear, and put parts you cannot plan in "cant".
Shape: {"summary":"","question":null,"cant":[],"thread":{"title":"","people":[],"need":"people","stakes":""},"beats":[{"id":"b1","when":null,"verb":"","who":[],"touches":{},"scene":""}]}`,
      { text: i.text, target: i.target, world: i.world },
    ),
  parse(raw) {
    const o = obj(raw);
    const beats = list(o.beats ?? [], 0, MAX_PLAN_BEATS).map((b, n) => {
      const x = obj(b);
      if (!(BOARD_PLAN_VERBS as readonly unknown[]).includes(x.verb)) throw new Error("unknown verb");
      let when: PlanBeat["when"] = null;
      if (x.when != null) {
        const w = obj(x.when);
        const week = Number(w.week);
        const day = Number(w.day);
        if (!Number.isInteger(week) || week < 1 || week > 24 || !Number.isInteger(day) || day < 0 || day > 4)
          throw new Error("bad when");
        when = { week, day, slot: (SLOTS as readonly unknown[]).includes(w.slot) ? (w.slot as string) : "morning" };
      }
      return {
        id: str(x.id ?? `b${n + 1}`, 1, 20, "id"),
        when,
        verb: x.verb as string,
        who: list(x.who ?? [], 0, 4).map((p) => str(p, 1, 40, "who")),
        touches: obj(x.touches ?? {}),
        scene: x.scene == null ? "" : str(x.scene, 0, 200, "scene"),
      };
    });
    const t = o.thread == null ? null : obj(o.thread);
    return {
      summary: str(o.summary, 3, 160, "summary"),
      question: o.question == null ? null : str(o.question, 1, 200, "question"),
      cant: list(o.cant ?? [], 0, 5).map((c) => str(c, 1, 160, "cant")),
      thread: t && {
        title: str(t.title, 1, 80, "title"),
        people: list(t.people ?? [], 0, 4).map((p) => str(p, 1, 40, "people")),
        need: (METERS as readonly unknown[]).includes(t.need) ? (t.need as Meter) : "standing",
        stakes: t.stakes == null ? "" : str(t.stakes, 0, 200, "stakes"),
      },
      beats,
    };
  },
  // No model, no plan: the Set layer still works (cheese-board.md §8 fallback).
  lite: () => ({ summary: "", question: null, cant: [], thread: null, beats: [] }),
};

// digest.away (design.md section 12): one short note on what moved while the boss skipped ahead.
export interface DigestAwayInput {
  kit: PlaceKit;
  facts: string[]; // written by the code from the state change
}
export interface DigestAwayOutput {
  text: string;
}
const digestAway: Task<DigestAwayInput, DigestAwayOutput> = {
  tokens: 400,
  prompt: (i) =>
    msgs(
      i.kit,
      `Write 2 to 4 short sentences for the boss about what happened at ${i.kit.name} while the boss skipped ahead. Use only the facts. Add no new event and no digits. Shape: {"text":""}`,
      { facts: i.facts },
    ),
  parse: (raw) => ({ text: words(obj(raw).text, 10, 700, "text") }),
  lite: (i) => ({ text: i.facts.length ? i.facts.join(" ") : "Nothing much happened." }),
};

export const tasks = {
  "digest.away": digestAway,
  "cast.read": castRead,
  "cards.day": cardsDay,
  "answer.tag": answerTag,
  "scene.part": scenePart,
  "feeling.lines": feelingLines,
  "thread.beat": threadBeat,
  "ambient.batch": ambientBatch,
  "grapevine.batch": grapevineBatch,
  "meeting.turn": meetingTurn,
  "board.plan": boardPlan,
};
type Tasks = typeof tasks;

// --- Running a task -------------------------------------------------------------------------

// Reasoning models spend tokens thinking, so every call gets this much on top of the reply (copied from
// otome-forge generation.ts REASONING_HEADROOM). engineModel caps the sum at the connection's own limit.
const REASONING_HEADROOM = 16_000;
const CUT_OFF = new Set(["length", "max_tokens", "max_output_tokens"]);

// Tolerant parse: drop a code fence or text around the JSON object.
const parseJson = (text: string): unknown => {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  return JSON.parse(a >= 0 && b > a ? text.slice(a, b + 1) : text);
};

/**
 * Try the model, check its output, and fall back to Lite on any error, bad output or timeout.
 * Without a model it goes straight to Lite. Lite output is deterministic for a given `input.rng`.
 */
export async function runTask<K extends keyof Tasks>(
  task: K,
  input: Parameters<Tasks[K]["lite"]>[0],
  opts: { model?: ModelCall; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<{ output: ReturnType<Tasks[K]["lite"]>; source: "model" | "lite" }> {
  const t = tasks[task] as unknown as Task<unknown, unknown>;
  const lite = () => ({ output: t.lite(input) as ReturnType<Tasks[K]["lite"]>, source: "lite" as const });
  if (!opts.model) return lite();
  try {
    const signal = AbortSignal.any([
      AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      ...(opts.signal ? [opts.signal] : []),
    ]);
    const aborted = new Promise<never>((_, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
    );
    const text = await Promise.race([
      opts.model(t.prompt(input), { signal, maxTokens: t.tokens + REASONING_HEADROOM }),
      aborted,
    ]);
    return { output: t.parse(parseJson(text), input) as ReturnType<Tasks[K]["lite"]>, source: "model" };
  } catch {
    return lite();
  }
}

/**
 * Builds a ModelCall from the Engine runtime, the way otome-forge generation.ts does: resolve the
 * connection, then `chatComplete` with only `maxTokens` and `signal` (no temperature, no JSON mode).
 * Throws when the connection cannot be used; the route should then call runTask with no model.
 */
export async function engineModel(
  runtime: Pick<CapabilityRuntimeHost, "languageModels">,
  connectionId: string | null, // null = the default connection
): Promise<ModelCall> {
  const model = await runtime.languageModels.resolveForRequest({ connectionId });
  return async (messages, { signal, maxTokens }) => {
    const cap = model.maxOutputTokens;
    const reply = await model.chatComplete(messages, {
      maxTokens: cap && cap > 0 ? Math.min(maxTokens, cap) : maxTokens,
      signal,
    });
    if (CUT_OFF.has(reply.finishReason ?? "")) throw new Error("reply cut off at the token limit");
    return reply.content ?? "";
  };
}
