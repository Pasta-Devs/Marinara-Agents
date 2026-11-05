// ──────────────────────────────────────────────
// Big Cheese M4 T11: delegation (modules.md section 4)
// ──────────────────────────────────────────────
// Give an area (a meter, a room or a group) to a person. At day end they answer its cards by
// their own traits, which costs the boss no hour. Each card gives the delegate +15 ambition.
import { lean } from "./advisors.js";
import { answerCard } from "./cards.js";
import { clamp, pure, spendHour } from "./run.js";
import { METERS } from "./types.js";
import type { PlaceKit } from "./kits/types.js";
import type { Card, Run } from "./types.js";

export const DELEGATE_AMBITION = 15;

const isArea = (kit: PlaceKit, area: string) =>
  (METERS as readonly string[]).includes(area) ||
  kit.rooms.some((r) => r.id === area) ||
  (kit.groups ?? []).some((g) => g.id === area);

/** Who holds the area a card falls in: its need meter, the asker's room or the asker's group. */
function holderOf(s: Run, kit: PlaceKit, c: Card): string | undefined {
  const keys = [
    c.need,
    s.people[c.asker]?.room,
    ...(kit.groups ?? []).filter((g) => g.spokesperson === c.asker).map((g) => g.id),
  ];
  const key = keys.find((k) => k && Object.hasOwn(s.delegated, k));
  return key ? s.delegated[key] : undefined;
}

/** 1 hour: give an area to an active person. A new delegate replaces the old one. */
export function delegate(s: Run, kit: PlaceKit, area: string, person: string) {
  if (!isArea(kit, area)) throw new Error("No such area.");
  if (!Object.hasOwn(s.people, person) || s.people[person]!.status !== "active")
    throw new Error("Nobody by that name can take it.");
  spendHour(s);
  s.delegated = { ...s.delegated, [area]: person };
  return s;
}

/** Take an area back at any time. The person remembers it. */
export function takeBack(s: Run, area: string) {
  if (!Object.hasOwn(s.delegated, area)) throw new Error("Nobody holds that area.");
  const p = s.people[s.delegated[area]!];
  s.delegated = Object.fromEntries(Object.entries(s.delegated).filter(([k]) => k !== area));
  if (p) {
    p.memories.push({ week: s.clock.week, about: area, thread: "", stance: "refuse", weight: 1 });
    if (p.memories.length > 5) p.memories.shift();
  }
  return s;
}

/** End of day: the delegates answer the waiting cards in their areas. The hour is not the boss's. */
export function delegateDay(s: Run, kit: PlaceKit) {
  if (!Object.keys(s.delegated).length) return;
  const log = [...(s.delegateLog ?? [])];
  for (const c of [...s.inbox]) {
    const who = holderOf(s, kit, c);
    const p = who ? s.people[who] : undefined;
    if (!who || !p || p.status !== "active") continue;
    const stance = lean(kit, who, c.answers);
    s.clock = { ...s.clock, hoursLeft: s.clock.hoursLeft + 1 }; // answerCard spends one; net zero
    answerCard(s, c.id, stance, [], true);
    p.ambition = clamp(p.ambition + DELEGATE_AMBITION);
    if (who === s.deputy) s.deputyAmbition = Math.min(100, s.deputyAmbition + DELEGATE_AMBITION);
    log.push({ week: s.clock.week, who, need: c.need, stance });
  }
  s.delegateLog = log.slice(-25);
}

export const pureDelegate = pure(delegate);
export const pureTakeBack = pure(takeBack);
