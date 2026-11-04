// ──────────────────────────────────────────────
// Big Cheese: small pieces every screen shares
// ──────────────────────────────────────────────
import type { CSSProperties } from "react";
import type { KitPerson, KitView, RunDoc } from "./api";

export const HOURS = 5;

/** What a screen gets from RunView. `act` posts one action and resolves true when it went through. */
export interface Ctx {
  run: RunDoc;
  kit: KitView;
  busy: boolean;
  act: (path: string, body?: object) => Promise<boolean>;
  go: (view: string) => void;
}

// Literal keys, so the locale validator finds each one.
export const DAY_KEYS = [
  "ui.bigCheese.day.mon",
  "ui.bigCheese.day.tue",
  "ui.bigCheese.day.wed",
  "ui.bigCheese.day.thu",
  "ui.bigCheese.day.fri",
];
export const dayKey = (day: number) => (day < 0 ? "ui.bigCheese.day.sun" : (DAY_KEYS[day] ?? DAY_KEYS[0]));

const STANCE_KEYS: Record<string, string> = {
  invest: "ui.bigCheese.stance.invest",
  cheap_fix: "ui.bigCheese.stance.cheapFix",
  delay: "ui.bigCheese.stance.delay",
  delegate: "ui.bigCheese.stance.delegate",
  refuse: "ui.bigCheese.stance.refuse",
  ask_others: "ui.bigCheese.stance.askOthers",
};
export const stanceKey = (stance: string) => STANCE_KEYS[stance] ?? "ui.bigCheese.stance.other";

const MOOD_KEYS: Record<string, string> = {
  great: "ui.bigCheese.mood.great",
  fine: "ui.bigCheese.mood.fine",
  low: "ui.bigCheese.mood.low",
  sick: "ui.bigCheese.mood.sick",
  away: "ui.bigCheese.mood.away",
};
export const moodKey = (mood: string) => MOOD_KEYS[mood] ?? MOOD_KEYS.fine;

// Trust shows as a word, never a number (ui.md §5.10).
const TRUST_KEYS = [
  "ui.bigCheese.trust.cold",
  "ui.bigCheese.trust.wary",
  "ui.bigCheese.trust.neutral",
  "ui.bigCheese.trust.warm",
  "ui.bigCheese.trust.loyal",
];
export const trustKey = (trust: number) => TRUST_KEYS[Math.min(4, Math.max(0, Math.floor(trust / 20)))];

export const person = (kit: KitView, id: string): KitPerson | undefined => kit.people.find((p) => p.id === id);
export const nameOf = (kit: KitView, id: string) => person(kit, id)?.name ?? id;

/** A kit hue is a CSS colour or an OKLCH hue angle. */
const hueColor = (hue: string | number | undefined) =>
  typeof hue === "number" ? `oklch(65% 0.13 ${hue})` : hue || "var(--muted-foreground)";

/** The person's colour mixed into the card surface, so it follows the theme. */
export const tint = (hue: string | number | undefined) => ({ "--bc-hue": hueColor(hue) }) as CSSProperties;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => /^\p{L}/u.test(part))
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

/** Face: no portraits in M1, so a ring in the person's colour with their initials. */
export function Face({ kit, id, size = "m" }: { kit: KitView; id: string; size?: "s" | "m" | "l" }) {
  const who = person(kit, id);
  return (
    <span className={`bc-face bc-face-${size}`} style={tint(who?.hue)} aria-hidden="true">
      {initials(who?.name ?? id)}
    </span>
  );
}

/** Hours as pips, with a text label for screen readers. */
export function HourPips({ left, label }: { left: number; label: string }) {
  return (
    <span className="bc-pips" role="img" aria-label={label}>
      {Array.from({ length: HOURS }, (_, i) => (
        <span key={i} className={i < left ? "bc-pip bc-pip-full" : "bc-pip"} />
      ))}
    </span>
  );
}
