// Big Cheese model tasks (design.md section 15): a prompt, a validator and a Lite fallback for each task.
// The model writes words only. Each validator rebuilds its output from known fields, so a number or an id
// that the model adds on its own never reaches the run state.
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { PlaceKit } from "../core/kits/types.js";
import { pick } from "../core/rng.js";
import { STANCES } from "../core/stances.js";
import { TRAITS } from "../core/traits.js";
import type { TermFacts } from "../core/reviews.js"; // T10
import { METERS, SLOTS } from "../core/types.js";
import type { Meter, Severity, Tier } from "../core/types.js";
import { adultNotes, fadeOf, type Adult } from "../core/adult.js";

export type Band = "cold" | "wary" | "neutral" | "warm" | "loyal";
type Msg = { role: "system" | "user"; content: string };
/** Returns the model's raw text. Throw on any failure. */
/** One debug-log line: the task name, what happened and how long it took. No prompt or reply text. */
export type CallEntry = { task: string; outcome: "ok" | "retry" | "refusal" | "lite"; ms: number };
export type ModelCall = ((messages: Msg[], o: { signal: AbortSignal; maxTokens: number }) => Promise<string>) & {
  /** Set by the route; runTask reports each call here. */
  onCall?: (e: CallEntry) => void;
};
type Obj = Record<string, unknown>;

// --- Inputs and outputs ---------------------------------------------------------------------

export interface CardSeed {
  id: string;
  asker: string;
  need: Meter;
  severity: Severity;
  offer: { tier: Tier; stance: string }[]; // chosen by the code (design 4.2)
  advisors?: { who: string; stance: string }[]; // inner circle, each with the stance the code picked for them
}
/** T5: prompt parts for the story layers Press, Rivals and Family. A layer with dial 0 adds nothing. */
const LAYER_NOTES: Record<string, string> = {
  press: "Press and gossip: the local paper, rumours and viral moments follow the boss.",
  rivals: "Rivals: a rival boss with moles and sabotage works against this place.",
  family: "Family and home: the boss has a home life, and evenings with family clash with work.",
  politics: "Politics: elections, campaigns and outside laws. Staff pick who speaks for them.",
  horror:
    "Horror: a dark place at night. Dark secrets, strange sounds, missing staff and a sealed room. Tone follows the place.",
  strange:
    "The strange: magic, curses, odd artefacts and odd machines. A crew member may be an AI. Tone follows the place.",
  legacy:
    "Legacy: a young worker wants to learn the boss's trade, and someone may take the job one day. Staff talk about who comes after the boss.",
  crime: "Crime: bribes, fraud and blackmail. A fixer on the staff knows who to pay and who to ask.",
  mystery: "Mystery: a case with clues in rooms and a few suspects. A detective on the staff helps the boss look.",
};
export const layerNotes = (kit: PlaceKit, d?: Record<string, number>) =>
  Object.entries(LAYER_NOTES)
    .filter(([l]) => (d?.[l] ?? 0) > 0)
    .map(
      ([l, t]) =>
        `${l === "rivals" ? t.replace("a rival boss", `a rival boss (${kit.outside?.find((o) => o.kind === "rival")?.name ?? "unnamed"})`) : t} Weight: ${d![l]! >= 70 ? "strong" : "light"}.\n`,
    )
    .join("");

export interface CardsDayInput {
  layers?: Record<string, number>;
  adult?: Adult | null; // null or missing = module off, no adult text
  kit: PlaceKit;
  rng: number;
  seeds: CardSeed[];
}
export interface CardsDayOutput {
  cards: {
    seed: string;
    text: string;
    answers: { stance: string; text: string }[];
    advice?: { who: string; stance: string; text: string }[];
  }[];
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
  layers?: Record<string, number>;
  adult?: Adult | null;
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

const ADVICE_NOTE =
  ' Cards with "advisors" also get "advice":[{"who":"","text":""}], one entry per advisor in the same order, one short line in that person\'s voice that leans to the given stance. Echo "who".';

/** The advice lines of one card: the model words them, the code keeps the person and the stance. */
const adviceOf = (c: Obj, s: CardSeed) => {
  if (!s.advisors?.length) return {};
  const a = Array.isArray(c.advice) ? c.advice : [];
  return {
    // A bad or missing advice line is dropped; the card and its other lines stay.
    advice: s.advisors.flatMap((x, k) => {
      try {
        const e = obj(a[k]);
        if (e.who !== x.who) return [];
        return [{ who: x.who, stance: x.stance, text: str(e.text, 3, 160, "advice") }];
      } catch {
        return [];
      }
    }),
  };
};

/** Lite advice is the card's own answer line for the advisor's stance. */
const liteAdvice = (s: CardSeed, answers: { stance: string; text: string }[]) =>
  s.advisors?.length
    ? { advice: s.advisors.map((x) => ({ ...x, text: answers.find((a) => a.stance === x.stance)?.text ?? "" })) }
    : {};

const cardsDay: Task<CardsDayInput, CardsDayOutput> = {
  tokens: 1500,
  prompt: (i) =>
    msgs(
      i.kit,
      `${layerNotes(i.kit, i.layers)}${adultNotes(i.adult)}Write each card: the asker's line, then one short answer line per given stance, in the given order. Echo "seed" and every "stance" exactly.${i.seeds.some((s) => s.advisors?.length) ? ADVICE_NOTE : ""}
Shape: {"cards":[{"seed":"","text":"","answers":[{"stance":"","text":""}]}]}
Stances: ${stanceHelp(STANCES)}
Voices:\n${voiceSheet(i.kit, [...new Set(i.seeds.flatMap((s) => [s.asker, ...(s.advisors ?? []).map((a) => a.who)]))])}`,
      {
        cards: i.seeds.map((s) => ({
          seed: s.id,
          asker: s.asker,
          topic: s.need,
          stances: s.offer.map((o) => o.stance),
          ...(s.advisors?.length ? { advisors: s.advisors } : {}),
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
          ...adviceOf(c, s),
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
        const answers = s.offer.map((o) => ({ stance: o.stance, text: t[o.tier] }));
        return { seed: s.id, text: t.ask, answers, ...liteAdvice(s, answers) };
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
      `${layerNotes(i.kit, i.layers)}${adultNotes(i.adult)}Write one part of a scene in "${i.room}". Goal: ${i.goal}
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
  planted?: { person: string; text: string }; // T13: the boss's own rumour, told first
}
export interface GrapevineBatchOutput {
  lines: { source: string; line: string }[];
}

const grapevineBatch: Task<GrapevineBatchInput, GrapevineBatchOutput> = {
  tokens: 700,
  prompt: (i) =>
    msgs(
      i.kit,
      `Turn the day's moments into 3 to 6 rumours the staff pass on. "source" is the person who tells it, from the list. Rumours stay close to the facts and add no new facts.${i.planted ? ` The boss planted this rumour, so tell it first and keep its meaning: ${i.planted.person}: ${i.planted.text}.` : ""} Shape: {"lines":[{"source":"","line":""}]}\nMoments:\n${i.facts.map((f) => `- ${f.person}: ${f.text}`).join("\n")}\nVoices:\n${voiceSheet(
        i.kit,
        i.kit.people.map((p) => p.id),
      )}`,
      { facts: i.facts },
    ),
  parse(raw, i) {
    const lines = list(obj(raw).lines, Math.min(3, i.facts.length), 6);
    const out = lines.map((l) => {
      const x = obj(l);
      return { source: person(i.kit, x.source).id, line: words(x.line, 3, 160, "line") };
    });
    // T13: the planted rumour always leads, in the model's words when it kept the starter
    const p = i.planted;
    return {
      lines:
        p && !out.some((l) => l.source === p.person) ? [{ source: p.person, line: p.text }, ...out].slice(0, 6) : out,
    };
  },
  lite: (i) => ({ lines: i.facts.slice(0, 6).map((f) => ({ source: f.person, line: f.text })) }),
};

// thread.beat (design.md 3.4): a thread opens from text. The code plans the kind, people, need and beat types; the model writes
// the title, the stakes line and one line per beat.
export interface ThreadBeatInput {
  adult?: Adult | null;
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
      `${adultNotes(i.adult)}Write the plan of one story in the place. Kind: ${i.kind}. Idea: ${i.idea.slice(0, 200)}. It puts ${i.need} at risk. A short title, one line on what is at stake, and one line for each beat in order: ${i.beats.map((b) => b.type).join(", ")}. Shape: {"title":"","stakes":"","lines":[""]}\nVoices:\n${voiceSheet(i.kit, i.people)}`,
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
  "evidence.add",
  "tradition.set",
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
touches by verb: person.feelings {trust|stress: {size, dir}, mood: "great|fine|low|sick|away"}; relation.shift {relation: {kind: friend|rival|crush|couple|mentor|enemy|family|secret_affair, size, dir}} with who of 2 people; ambition.set {ambition: {size, dir}}; secret.add {} with who = the person it is about, then who knows it ("boss" is the player), and "scene" = the secret in one line; room.condition {room: id, size, dir}; card.add {need: money|output|people|standing, size}; meter.set {meter, size, dir}; evidence.add {} with who the person is about and "scene" = the secret in one line; tradition.set {op: "add" with text and count 0-9, or "remove" with id from the world traditions and loud: true when people protest}.
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

// kit.fix (design.md section 14): a broken import goes to the model once. The code checks the answer again.
export interface KitFixInput {
  kit: unknown;
  reasons: string[];
}
export interface KitFixOutput {
  kit: unknown;
}
const kitFix: Task<KitFixInput, KitFixOutput> = {
  tokens: 6000,
  prompt: (i) => [
    {
      role: "system",
      content: `You repair a Place Kit, the JSON of a game place. Fix only what the reasons name and keep every other field as it is. Do not add new people or rooms beyond what the reasons need. Shape: {"kit":{...the whole kit...}}`,
    },
    { role: "user", content: JSON.stringify({ reasons: i.reasons, kit: i.kit }) },
  ],
  parse: (raw) => ({ kit: obj(raw).kit }),
  lite: (i) => ({ kit: i.kit }), // no model: the kit goes back unchanged and fails the check again
};

// --- T3: the place draft (design.md section 13 steps 2 and 3) -------------------
// The model makes up the place and its roles. The code only checks and applies what comes back, and
// fills every gap from the family's built-in kit. Counts are not checked here: the kit normalizer
// does that, and the caller retries once with its reasons.

export type DraftPart = "all" | "people" | "rooms" | "name";
type KitRoom = PlaceKit["rooms"][number];
type KitPerson = PlaceKit["people"][number];

export interface PlaceDraftInput {
  kit: PlaceKit; // the family's built-in kit, or the draft that is being rerolled
  rng: number;
  wish: string;
  size: number;
  storyteller: string;
  part: DraftPart;
  fixed?: string[]; // names the player picked as staff
  problems?: string[]; // why the last answer was refused
}

export interface PlaceDraftOutput {
  name?: string;
  family?: string;
  premise?: string;
  bossTitle?: string;
  meters?: Partial<Record<Meter, string>>;
  rooms?: KitRoom[];
  people?: KitPerson[];
  roles?: NonNullable<PlaceKit["roles"]>;
  groups?: PlaceKit["groups"];
  relations?: PlaceKit["relations"];
  traditions?: PlaceKit["traditions"];
  surprises?: string[];
  crisisDeck?: PlaceKit["crisisDeck"];
  hearing?: { body: string; ending: string };
}

export interface PlacePeopleInput {
  kit: PlaceKit;
  rng: number;
  rooms: { id: string; name: string; kind: string }[];
  people: { id: string; name: string; role: string }[];
  problems?: string[];
}

export interface PlacePeopleOutput {
  people: {
    id: string;
    core: string;
    ambition: string;
    secret: string;
    voice: KitPerson["voice"];
    routine: KitPerson["routine"];
  }[];
}

const ROOM_KINDS = ["work", "social", "outside", "private", "hidden"];
const REL_KINDS = ["friend", "rival", "crush", "couple", "mentor", "enemy", "family"];
const COLOURS = ["#8a5a44", "#4a7ba6", "#6a9a5b", "#b0803a", "#8a6aa6", "#a65a6a", "#4aa69a", "#a69a4a"];
const LEAN =
  "Write in-world words for a management game. No AI voice, no taglines, no em dashes. Reply with ONLY one JSON object in the given shape. No prose, no code fence.";

/** Draft text is cleaned, not refused: one em dash must not throw away a whole place. */
const say = (v: unknown, max: number, fb = ""): string =>
  (typeof v === "string"
    ? v
        .replace(/\s*[—–]\s*/g, ", ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "") || fb;
const items = (v: unknown, max: number): Obj[] =>
  (Array.isArray(v) ? v : []).filter((x): x is Obj => !!x && typeof x === "object" && !Array.isArray(x)).slice(0, max);
const slugId = (v: unknown, fb: string) =>
  say(v, 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || fb;
/** Unique ids in list order. */
const idsOf = (list: Obj[], fb: string, taken: string[] = []): string[] => {
  const seen = new Set(taken);
  return list.map((x, i) => {
    let id = slugId(x.id ?? x.name, `${fb}-${i + 1}`);
    for (let n = 2; seen.has(id); n++) id = `${id.slice(0, 20)}-${n}`;
    seen.add(id);
    return id;
  });
};
const clampN = (v: unknown, lo: number, hi: number, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fb;
};

/** A full routine: given rooms that exist win, gaps go to work rooms by day, a social room in the evening, home at night. */
export const routineOf = (given: unknown, rooms: { id: string; kind: string }[], n: number): KitPerson["routine"] => {
  const g = given && typeof given === "object" ? (given as Obj) : {};
  const ok = (id: unknown): id is string => id === "home" || (typeof id === "string" && rooms.some((r) => r.id === id));
  const work = rooms.filter((r) => r.kind === "work");
  const social = rooms.filter((r) => r.kind === "social");
  const day = (work[n % (work.length || 1)] ?? rooms[0])?.id ?? "home";
  const eve = (social[n % (social.length || 1)] ?? work[0] ?? rooms[0])?.id ?? "home";
  return Object.fromEntries(
    SLOTS.map((s) => [s, ok(g[s]) ? g[s] : s === "night" ? "home" : s === "evening" ? eve : day]),
  ) as KitPerson["routine"];
};

const draftRooms = (v: unknown): KitRoom[] => {
  const l = items(v, 24);
  const ids = idsOf(l, "room", ["home"]);
  return l.map((x, i) => ({
    id: ids[i]!,
    name: say(x.name, 40, "A room"),
    kind: ROOM_KINDS.includes(x.kind as string) ? (x.kind as KitRoom["kind"]) : "work",
    condition: clampN(x.condition, 35, 70, 55), // the 35-70 start clamp applies to the draft only
    feeds: null,
    text: say(x.text, 200, "A room."),
  }));
};

const draftPeople = (v: unknown): KitPerson[] => {
  const l = items(v, 24);
  const ids = idsOf(l, "person");
  return l.map((x, i) => ({
    id: ids[i]!,
    name: say(x.name, 40, "Someone"),
    role: say(x.role, 40, "Staff"),
    colour: /^#[0-9a-f]{6}$/i.test(String(x.colour)) ? String(x.colour) : COLOURS[i % COLOURS.length]!,
    deputy: x.deputy === true,
    traits: (Array.isArray(x.traits) ? x.traits : [])
      .filter((t) => (TRAITS as readonly unknown[]).includes(t))
      .slice(0, 2) as string[],
    ambition: "",
    secret: "",
    routine: {} as KitPerson["routine"],
    voice: { style: "", phrases: [] },
  }));
};

const FIELDS: Record<DraftPart, string> = {
  all: "name premise bossTitle family meters rooms people roles groups relations traditions surprises crisisDeck hearing",
  name: "name premise bossTitle",
  rooms: "rooms",
  people: "people roles groups relations",
};
const SHAPE: Record<string, string> = {
  name: '"name":"short place name"',
  premise: '"premise":"two plain sentences about the place"',
  bossTitle: '"bossTitle":"what staff call the player"',
  family: '"family":"one lowercase word for the kind of place"',
  meters:
    '"meters":{"money":"","output":"","people":"","standing":""} (a short label for each meter that fits this place)',
  rooms: '"rooms":[{"id":"","name":"","kind":"work|social|outside|private|hidden","text":"one line"}] (6 to 10 rooms)',
  people: `"people":[{"id":"","name":"","role":"","deputy":false,"traits":[""]}] (traits: 1 or 2 of ${TRAITS.join(", ")}; exactly one deputy)`,
  roles: '"roles":[{"id":"","name":"","about":"one line"}] (3 to 5 job roles that fit this place)',
  groups: '"groups":[{"id":"","name":"","spokesperson":"<person id>","text":""}] (1 to 3)',
  relations:
    '"relations":[{"a":"<person id>","b":"<person id>","kind":"friend|rival|crush|couple|mentor|enemy|family","level":50}] (5 to 10)',
  traditions: '"traditions":[{"id":"","tag":"one word","text":""}] (2)',
  surprises: '"surprises":[""] (4 odd events; you may use {place}, {person} and {room})',
  crisisDeck: `"crisisDeck":[{"id":"","name":"","text":"","meters":["money|output|people|standing"],"stances":["${STANCES.join("|")}"]}] (3)`,
  hearing: '"hearing":{"body":"who judges the player","ending":"title of the bad ending"}',
};

const placeDraft: Task<PlaceDraftInput, PlaceDraftOutput> = {
  tokens: 3000,
  prompt: (i) => {
    const k = i.kit;
    const keep =
      i.part === "all"
        ? ""
        : `\nKeep the place "${k.name}": ${k.premise}\nRooms: ${k.rooms.map((r) => `${r.id} (${r.name})`).join(", ")}\nPeople: ${k.people.map((p) => `${p.id} (${p.name}, ${p.role})`).join(", ")}`;
    return [
      { role: "system", content: LEAN },
      {
        role: "user",
        content:
          `Wish: "${i.wish.slice(0, 400) || "a workplace of your choice"}"\nStoryteller: ${i.storyteller}.\nPeople to write: ${i.size}.${keep}` +
          (i.fixed?.length
            ? `\nThese people work here. Use their names and make up their roles: ${i.fixed.join(", ")}.`
            : "") +
          (i.problems?.length ? `\nYour last answer was refused: ${i.problems.join(" ")}` : "") +
          `\nShape: {${FIELDS[i.part]
            .split(" ")
            .map((f) => SHAPE[f])
            .join(",")}}`,
      },
    ];
  },
  parse(raw, i) {
    const o = obj(raw);
    const all = i.part === "all";
    const out: PlaceDraftOutput = {};
    if (all || i.part === "name") {
      out.name = say(o.name, 60);
      out.premise = say(o.premise, 400);
      out.bossTitle = say(o.bossTitle, 40);
      if (!out.name || !out.premise) throw new Error("no name or premise");
    }
    if (all || i.part === "rooms") {
      out.rooms = draftRooms(o.rooms);
      if (!out.rooms.length) throw new Error("no rooms");
    }
    if (all || i.part === "people") {
      out.people = draftPeople(o.people);
      if (!out.people.length) throw new Error("no people");
      const ids = out.people.map((p) => p.id);
      const gl = items(o.groups, 4);
      const gid = idsOf(gl, "group");
      out.groups = gl
        .map((x, n) => ({
          id: gid[n]!,
          name: say(x.name, 40, "A group"),
          spokesperson: say(x.spokesperson, 40),
          text: say(x.text, 200),
        }))
        .filter((g) => ids.includes(g.spokesperson));
      out.relations = items(o.relations, 16)
        .filter(
          (x) =>
            ids.includes(x.a as string) &&
            ids.includes(x.b as string) &&
            x.a !== x.b &&
            REL_KINDS.includes(x.kind as string),
        )
        .map((x) => ({
          a: x.a as string,
          b: x.b as string,
          kind: x.kind as never,
          level: clampN(x.level, 0, 100, 50),
        }));
      const rl = items(o.roles, 6);
      const rid = idsOf(rl, "role");
      out.roles = rl.map((x, n) => ({ id: rid[n]!, name: say(x.name, 40, "Staff"), about: say(x.about, 160) }));
    }
    if (all) {
      out.family = slugId(o.family, "");
      out.meters = Object.fromEntries(
        METERS.map((m) => [m, say((obj(o.meters ?? {}) as Obj)[m], 24)]).filter(([, l]) => l),
      ) as never;
      const tl = items(o.traditions, 4);
      const tid = idsOf(tl, "tradition");
      out.traditions = tl
        .map((x, n) => ({ id: tid[n]!, tag: say(x.tag, 20, "habit"), text: say(x.text, 200) }))
        .filter((t) => t.text);
      out.surprises = (Array.isArray(o.surprises) ? o.surprises : [])
        .map((s) => say(s, 140))
        .filter(Boolean)
        .slice(0, 6);
      const cl = items(o.crisisDeck, 4);
      const cid = idsOf(cl, "crisis");
      out.crisisDeck = cl
        .map((x, n) => ({
          id: cid[n]!,
          name: say(x.name, 40, "A crisis"),
          text: say(x.text, 200),
          meters: (Array.isArray(x.meters) ? x.meters : [])
            .filter((m) => (METERS as readonly unknown[]).includes(m))
            .slice(0, 2) as Meter[],
          stances: (Array.isArray(x.stances) ? x.stances : []).filter((s) =>
            (STANCES as readonly unknown[]).includes(s),
          ) as string[],
        }))
        .filter((c) => c.text && c.meters.length && c.stances.length);
      const h = obj(o.hearing ?? {});
      if (say(h.body, 80) && say(h.ending, 40)) out.hearing = { body: say(h.body, 80), ending: say(h.ending, 40) };
    }
    return out;
  },
  // No model: the kit that is already there. A reroll changes nothing, a first draft takes the wish as its name and premise.
  lite(i) {
    const k = i.kit;
    const first = i.part === "all";
    const out: PlaceDraftOutput = {};
    if (first || i.part === "name") {
      const w = i.wish.trim();
      out.name =
        first && w ? say(w.split(" ").slice(0, 3).join(" "), 40).replace(/^./, (c) => c.toUpperCase()) : k.name;
      out.premise = w && first ? say(w, 300) : k.premise;
      out.bossTitle = k.bossTitle;
    }
    if (first || i.part === "rooms") out.rooms = k.rooms;
    if (first || i.part === "people") {
      const head = k.people.slice(0, i.size);
      const deputy = k.people.find((p) => p.deputy);
      out.people = deputy && !head.includes(deputy) ? [...head.slice(0, -1), deputy] : head;
    }
    return out;
  },
};

const placePeople: Task<PlacePeopleInput, PlacePeopleOutput> = {
  tokens: 3600,
  prompt: (i) => [
    { role: "system", content: LEAN },
    {
      role: "user",
      content:
        `Write the inner life of each person in "${i.kit.name}": ${i.kit.premise}\nRooms:\n${i.rooms.map((r) => `- ${r.id}: ${r.name} (${r.kind})`).join("\n")}\nPeople:\n${i.people.map((p) => `- ${p.id}: ${p.name}, ${p.role}`).join("\n")}` +
        (i.problems?.length ? `\nYour last answer was refused: ${i.problems.join(" ")}` : "") +
        `\nPer person: "core" is one short line on who they are, "ambition" is what they want, "secret" is what they hide, "voice.style" is 2 or 3 words, "voice.phrases" are 3 short lines they say, "routine" maps morning, midday, afternoon, evening and night to a room id (or "home").\nShape: {"people":[{"id":"","core":"","ambition":"","secret":"","voice":{"style":"","phrases":[""]},"routine":{"morning":"","midday":"","afternoon":"","evening":"","night":"home"}}]}`,
    },
  ],
  // A person the model left out or garbled gets plain values, so a long list never fails as a whole.
  parse(raw, i) {
    const l = items(obj(raw).people, 24);
    return {
      people: i.people.map((p, n) => {
        const x = l.find((e) => e.id === p.id) ?? {};
        const v = obj((x.voice as unknown) ?? {});
        return {
          id: p.id,
          core: say(x.core, 120, p.role),
          ambition: say(x.ambition, 160),
          secret: say(x.secret, 160),
          voice: {
            style: say(v.style, 60, "plain"),
            phrases: (Array.isArray(v.phrases) ? v.phrases : [])
              .map((s) => say(s, 120))
              .filter(Boolean)
              .slice(0, 4),
          },
          routine: routineOf(x.routine, i.rooms, n),
        };
      }),
    };
  },
  lite: (i) => ({
    people: i.people.map((p, n) => {
      const b = i.kit.people.find((x) => x.id === p.id);
      return {
        id: p.id,
        core: b?.core ?? p.role,
        ambition: b?.ambition ?? "",
        secret: b?.secret ?? "",
        voice: b?.voice ?? { style: "plain", phrases: [`I am the ${p.role}.`] },
        routine: routineOf(b?.routine, i.rooms, n),
      };
    }),
  }),
};

// wish.classify (design.md 3.7): the player's wish line becomes a need, a size and people. The
// code opens the thread; it never takes a number from here.
export interface WishClassifyInput {
  kit: PlaceKit;
  rng: number;
  text: string;
}
export interface WishClassifyOutput {
  kind: "wish" | "crisis";
  need: Meter;
  people: string[];
}
const wishClassify: Task<WishClassifyInput, WishClassifyOutput> = {
  tokens: 300,
  prompt: (i) =>
    msgs(
      i.kit,
      `Read the boss's wish. Say which need it touches: ${METERS.join(", ")}. Say "crisis" if it asks for trouble, "wish" if it asks for anything else. List up to 3 people it is about, only if it names them or their job. Shape: {"kind":"wish","need":"standing","people":["id"]}\nPeople:\n${i.kit.people.map((p) => `- ${p.id}: ${p.name}, ${p.role}`).join("\n")}`,
      { wish: i.text.slice(0, 300) },
    ),
  parse(raw, i) {
    const o = obj(raw);
    if (!METERS.includes(o.need as Meter)) throw new Error("need: not a meter");
    return {
      kind: o.kind === "crisis" ? "crisis" : "wish",
      need: o.need as Meter,
      people: list(o.people, 0, 3).map((x) => person(i.kit, x).id),
    };
  },
  lite: () => ({ kind: "wish", need: "standing", people: [] }),
};

// chronicle.term (design.md section 15): the yearbook page of one term, written from facts the code picked.
export interface ChronicleTermInput {
  kit: PlaceKit;
  rng: number;
  facts: TermFacts;
  adult: Adult | null; // null unless the player chose adult text for the page
}
export interface ChronicleTermOutput {
  title: string;
  text: string;
}

const TERM_WORD = ["one", "two", "three", "four", "five"];
const REVIEW_WORDS: Record<string, string> = {
  praise: "got praise",
  raise: "got a raise",
  role: "got a new role",
  warning: "got a warning",
};

const chronicleTerm: Task<ChronicleTermInput, ChronicleTermOutput> = {
  tokens: 700,
  prompt: (i) =>
    msgs(
      i.kit,
      `${adultNotes(i.adult)}Write the yearbook page for one term at ${i.kit.name}: a short title and 3 to 6 sentences of text, the way the place would tell it to its staff. Use only the facts. Add no new event, person or number. Call the term by the word "term" only. Shape: {"title":"","text":""}`,
      i.facts,
    ),
  parse: (raw) => {
    const o = obj(raw);
    return { title: words(o.title, 1, 60, "title"), text: words(o.text, 20, 1400, "text") };
  },
  lite: (i) => {
    const f = i.facts;
    const met = f.goals.filter((g) => g.met).length;
    return {
      title: `Term ${TERM_WORD[f.term - 1] ?? "after term"} at ${i.kit.name}`,
      text: [
        f.closed.length
          ? `The office closed: ${f.closed.map((c) => c.title).join(", ")}.`
          : "No story came to an end this term.",
        !f.goals.length
          ? ""
          : met === f.goals.length
            ? "The boss met every goal."
            : met
              ? "The boss met some goals."
              : "The boss missed every goal.",
        ...f.reviews.map((r) => `${r.person} ${REVIEW_WORDS[r.pick] ?? "got a review"}.`),
        f.award ? `${f.award} was named Employee of the term.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  },
};

// call.line (M4 T21): one turn of a phone call with one person. The call is a scene inside
// Big Cheese. It writes words only, so no number, trust or memory changes.
export const CALL_TOPICS: Record<string, string> = {
  feeling: "how they are doing",
  work: "how work is going",
  day: "what the day was like",
};
export interface CallLineInput {
  kit: PlaceKit;
  rng: number;
  person: string;
  band: Band;
  topic: string;
  earlier: { who: "you" | "them"; text: string }[];
}
export interface CallLineOutput {
  line: string;
}

const LITE_CALL: Record<Band, string> = {
  cold: "Make it quick.",
  wary: "I can talk for a minute.",
  neutral: "Sure, go on.",
  warm: "Good to hear from you.",
  loyal: "I was hoping you would call.",
};

const callLine: Task<CallLineInput, CallLineOutput> = {
  tokens: 200,
  prompt: (i) =>
    msgs(
      i.kit,
      `The boss phones ${person(i.kit, i.person).name}. Write the one reply ${person(i.kit, i.person).name} says on the phone, in their own voice, one to three short sentences. They feel ${i.band} toward the boss. The boss asks about ${CALL_TOPICS[i.topic] ?? CALL_TOPICS.feeling}. Shape: {"line":""}\nVoice:\n${voiceSheet(i.kit, [i.person])}`,
      { earlier: i.earlier.slice(-6) },
    ),
  parse: (raw) => ({ line: words(obj(raw).line, 3, 300, "line") }),
  lite: (i) => {
    const h = { rng: i.rng };
    return { line: `${LITE_CALL[i.band]} ${pick(h, person(i.kit, i.person).voice.phrases)}` };
  },
};

// minigame.lines (modules.md section 4, M4 T17): the words for a played mini-game, one line per step.
// The code scored the picks already; `verdict` is a plain sentence the line must keep to.
export interface MiniLinesInput {
  kit: PlaceKit;
  kind: string;
  people: string[];
  steps: { text: string; verdict: string }[];
}
export interface MiniLinesOutput {
  lines: { who: string; text: string }[];
}

const miniLines: Task<MiniLinesInput, MiniLinesOutput> = {
  tokens: 700,
  prompt: (i) =>
    msgs(
      i.kit,
      `Write one short line for each step of a ${i.kind}, in the same order. Each line shows what the step does and keeps to its verdict. Write no numbers. "who" is a person id from the list, or "" for the narrator. Shape: {"lines":[{"who":"","text":""}]}\nVoices:\n${voiceSheet(i.kit, i.people)}`,
      { kind: i.kind, people: i.people, steps: i.steps },
    ),
  parse: (raw, i) => {
    const o = obj(raw);
    return {
      lines: list(o.lines, i.steps.length, i.steps.length).map((l) => {
        const x = obj(l);
        const who = typeof x.who === "string" ? x.who : "";
        if (who && !i.people.includes(who)) throw new Error("line: who is not in the mini-game");
        return { who, text: words(x.text, 3, 200, "line") };
      }),
    };
  },
  lite: (i) => ({ lines: i.steps.map((x) => ({ who: "", text: x.verdict })) }),
};

export const tasks = {
  "wish.classify": wishClassify,
  "place.draft": placeDraft,
  "place.people": placePeople,
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
  "kit.fix": kitFix,
  "chronicle.term": chronicleTerm,
  "minigame.lines": miniLines, // M4 T17
  "call.line": callLine,
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
  opts: {
    model?: ModelCall;
    signal?: AbortSignal;
    timeoutMs?: number;
    log?: (task: string, error: unknown) => void;
  } = {},
): Promise<{ output: ReturnType<Tasks[K]["lite"]>; source: "model" | "lite" }> {
  const t = tasks[task] as unknown as Task<unknown, unknown>;
  const lite = () => ({ output: t.lite(input) as ReturnType<Tasks[K]["lite"]>, source: "lite" as const });
  if (!opts.model) return lite();
  const t0 = Date.now();
  const note = (outcome: CallEntry["outcome"]) => opts.model?.onCall?.({ task, outcome, ms: Date.now() - t0 });
  try {
    const signal = AbortSignal.any([
      AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      ...(opts.signal ? [opts.signal] : []),
    ]);
    const aborted = new Promise<never>((_, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
    );
    const call = async (inp: unknown) => {
      const text = await Promise.race([
        opts.model!(t.prompt(inp), { signal, maxTokens: t.tokens + REASONING_HEADROOM }),
        aborted,
      ]);
      return t.parse(parseJson(text), inp) as ReturnType<Tasks[K]["lite"]>;
    };
    try {
      const output = await call(input);
      note("ok");
      return { output, source: "model" };
    } catch (e) {
      // A refused or blocked adult scene falls back to fade to black, then to Lite.
      const adult = (input as { adult?: Adult | null }).adult;
      if (!adult || adult.intensity === 0 || signal.aborted) throw e;
      opts.log?.(task, e);
      note("refusal");
      const output = await call({ ...(input as object), adult: fadeOf(adult) });
      note("retry");
      return { output, source: "model" };
    }
  } catch (e) {
    // The retry failed too, or a non-Adult call failed: both end in Lite.
    opts.log?.(task, e);
    note("lite");
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

// --- Model call debug log (GET /runs/:id/calls) -----------------------------

const CALL_LOG_CAP = 50;
// ponytail: in memory, lost on restart; persist it only if the log must survive a restart.
const callLogs = new Map<string, CallEntry[]>();

/** The last 50 calls of one run, oldest first. */
export const callsOf = (runId: string): CallEntry[] => callLogs.get(runId) ?? [];

/** Hands the run's log to the model, so runTask records each call. A Lite run has no model and no log. */
export function withCallLog(model: ModelCall | undefined, runId: string): ModelCall | undefined {
  if (!model) return model;
  const wrapped: ModelCall = (m, o) => model(m, o);
  wrapped.onCall = (e) => {
    const list = callLogs.get(runId) ?? [];
    list.push(e);
    callLogs.set(runId, list.slice(-CALL_LOG_CAP));
  };
  return wrapped;
}
