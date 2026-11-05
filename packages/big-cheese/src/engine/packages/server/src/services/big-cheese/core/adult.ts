// Adult module (README Adult module). Off by default; every function here needs `s.adult`.
// The prompt text lives here too, so gating is one check: no `adult` value, no adult words.
import { applyDelta, clamp as pct, pure } from "./run.js";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
import { closeThread, openStory } from "./threads.js";
import { pick, roll } from "./rng.js";
import type { Run } from "./types.js";

/** 0 fade to black, 1 suggestive, 2 explicit. */
export const INTENSITIES = ["fade", "suggestive", "explicit"] as const;
export const THEMES = ["romance", "workplace", "love_life", "rivals", "cuckold", "open", "power"] as const;
const THEME_WORDS: Record<string, string> = {
  romance: "romance and dating",
  workplace: "affairs between staff",
  love_life: "the boss's own love life",
  rivals: "rivalries in love and cheating",
  cuckold: "cuckolding, where the boss's partner is with someone else",
  open: "open relationships and polyamory",
  power: "power and dominance games",
};
const LEVEL_WORDS = [
  "Fade to black: show attraction and affairs through looks, talk and what follows. Cut away before anything physical.",
  "Suggestive: scenes may be sensual and flirtatious. Keep the physical side implied.",
  "Explicit: scenes may be written in full.",
];
const AFFAIR_CAP = 2;
const WEEKLY = 0.35;
/** Chance weight that a person strays (design: traits decide who strays). */
const STRAY: Record<string, number> = { faithful: 0, flirty: 3, curious: 3, romantic: 2, charming: 2, jealous: 1 };

export type Adult = NonNullable<Run["adult"]>;

/** The prompt part. Empty when the module is off. */
export const adultNotes = (a: Adult | null | undefined): string => {
  if (!a) return "";
  const themes = a.themes.map((t) => (Object.hasOwn(THEME_WORDS, t) ? THEME_WORDS[t] : t)).join("; ");
  return `Adult themes are on. ${LEVEL_WORDS[clamp(a.intensity, 0, 2)]}${themes ? ` Themes the player wants: ${themes}.` : ""} An affair story has stages: hints, lies, discovery, a choice for the boss.\n`;
};

/** The same part at fade to black: the fallback when a model refuses a scene. */
export const fadeOf = (a: Adult): Adult => ({ ...a, intensity: 0 });

/** The switch. Turning on needs the adult confirm; changing intensity or themes while on does not. */
export function setAdult(s: Run, i: { on: boolean; confirm?: boolean; intensity?: number; themes?: string[] }) {
  if (!i.on) {
    s.adult = null;
    for (const t of Object.values(s.threads)) if (t.layer === "adult") closeThread(s, t.id, "dropped");
    return;
  }
  if (!s.adult && i.confirm !== true) throw new Error("Confirm that you are an adult to turn this on.");
  const themes = [...new Set((i.themes ?? s.adult?.themes ?? []).map((t) => t.trim()).filter(Boolean))].slice(0, 12);
  s.adult = { intensity: clamp(Math.round(i.intensity ?? s.adult?.intensity ?? 1), 0, 2), themes };
}

/** Romance toward the boss (person) and attraction between two people (relation), 0-100. */
export function shiftRomance(s: Run, id: string, d: number) {
  const p = Object.hasOwn(s.people, id) ? s.people[id] : undefined;
  if (p) p.romance = pct((p.romance ?? 0) + d);
}
export function shiftAttraction(s: Run, a: string, b: string, d: number) {
  const r = s.relations.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (r) r.attraction = pct((r.attraction ?? 0) + d);
}

const active = (s: Run) => Object.keys(s.people).filter((id) => s.people[id]!.status === "active");
const strays = (s: Run, id: string) => {
  const t = s.people[id]!.traits ?? [];
  return t.includes("faithful") ? 0 : Math.max(1, ...t.map((x) => STRAY[x] ?? 1));
};

/** Strayers picked by trait: a faithful person never strays. */
export function pickStrayer(s: Run, ids: string[]): string | undefined {
  const w = ids.map((id) => strays(s, id));
  const total = w.reduce((x, y) => x + y, 0);
  if (!total) return undefined;
  let r = roll(s) * total;
  return ids.find((_, n) => (r -= w[n]!) < 0);
}

/** Monday: maybe open an affair thread between two active people. It runs as a mystery (hints, lies, discovery, choice). */
export function adultSeeds(s: Run) {
  if (!s.adult || Object.values(s.threads).filter((t) => t.layer === "adult").length >= AFFAIR_CAP || roll(s) >= WEEKLY)
    return;
  const ids = active(s);
  // ponytail: the cuckold theme makes the person the boss likes most the strayer; a real partner flag waits for the cast roles in the run
  const loved = ids.filter((id) => (s.people[id]!.attraction ?? 0) >= 50);
  const a = s.adult.themes.includes("cuckold") && loved.length ? pick(s, loved) : pickStrayer(s, ids);
  const others = ids.filter((id) => id !== a);
  if (!a || !others.length) return;
  const b = pick(s, others);
  const t = openStory(s, "mystery", {
    title: `Something between ${s.people[a]!.name ?? a} and ${s.people[b]!.name ?? b}`,
    need: "people",
    people: [a, b],
    severity: 2,
    stakes: "affair",
    origin: "block",
  });
  t.layer = "adult";
}

/** The boss's choice about an affair. "watch" and "agree" need the cuckolding theme. */
export function affairChoice(s: Run, id: string, choice: string) {
  const t = Object.hasOwn(s.threads, id) ? s.threads[id] : undefined;
  if (!s.adult || !t || t.layer !== "adult" || t.stakes !== "affair") throw new Error("There is no such affair.");
  if (!["stop", "watch", "agree"].includes(choice)) throw new Error("Pick stop, watch or agree.");
  if (choice !== "stop" && !s.adult.themes.includes("cuckold"))
    throw new Error("That choice needs the cuckolding theme.");
  const [a, b] = t.people as [string, string];
  if (choice === "stop") {
    shiftRomance(s, a, -10);
    shiftAttraction(s, a, b, -20);
    s.meters = applyDelta(s.meters, { standing: 2 });
  } else if (choice === "watch") {
    shiftRomance(s, a, 5);
    shiftAttraction(s, a, b, 10);
  } else {
    shiftRomance(s, a, 10);
    shiftAttraction(s, a, b, 20);
    s.meters = applyDelta(s.meters, { people: 2 });
  }
  closeThread(s, id, "won");
}

export const pureSetAdult = pure(setAdult);
export const pureAffairChoice = pure(affairChoice);
