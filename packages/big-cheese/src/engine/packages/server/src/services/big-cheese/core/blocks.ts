// ──────────────────────────────────────────────
// Big Cheese: Big event and Season blocks (modules.md section 1, design.md 3.8)
// ──────────────────────────────────────────────
// A system of the kit is a block. A Season has one thread per fixture and a Big event has one thread
// for its night. Each is a follow_up thread with origin "block" and the id of its system. Prep beats
// are code-only checks; the live night is a big scene whose result (bigscenes.ts) moves the need meter.
import { bookBigScene } from "./bigscenes.js";
import { dayIndex } from "./clock.js";
import type { PlaceKit } from "./kits/types.js";
import { newId } from "./run.js";
import { closeThread, openThread } from "./threads.js";
import type { Run } from "./types.js";

// Season: 6 fixtures, one every 4 weeks. Event: one night in the middle of the year.
const WEEKS = { season: [3, 7, 11, 15, 19, 23], event: [12] };
// Prep: the days of the lead week on which the steps land.
const PREP = { season: [1, 2, 3], event: [1, 3] };

/** A new run copies the kit's blocks into its system table, with the season table filled in. */
export function startSystems(s: Run, kit: PlaceKit) {
  kit.systems.forEach((b, i) => {
    const fixtures = b.kind === "project" ? undefined : WEEKS[b.kind].map((week) => ({ week }));
    s.systems[String(i)] = { on: true, kind: b.kind, name: b.name, text: b.text, fixtures };
  });
}

/** Monday morning: the week before a fixture or an event night, its thread opens and the night is booked. */
export function blocks(s: Run) {
  if (s.clock.day !== 0) return;
  for (const [id, st] of Object.entries(s.systems)) {
    if (!st.on || !st.kind || st.kind === "project") continue;
    for (const f of st.fixtures ?? []) {
      const open = Object.values(s.threads).some((t) => t.system === id && t.clock.dueWeek === f.week + 1);
      if (f.week !== s.clock.week + 1 || f.won !== undefined || open) continue;
      const n = (st.fixtures ?? []).indexOf(f) + 1;
      const t = openThread(s, {
        kind: "follow_up",
        title: st.kind === "season" ? `${st.name}, match ${n}` : (st.name ?? "The big night"),
        people: [],
        need: st.kind === "season" ? "standing" : "people",
        severity: 2,
        stakes: st.text ?? "",
        origin: "block",
        dueWeek: f.week + 1,
      });
      t.system = id;
      for (const day of PREP[st.kind])
        t.beats.push({ id: newId(s, "b"), type: "check", planned: { week: s.clock.week, day } });
      // The night is on Thursday of the fixture week.
      if (!bookBigScene(s, t, st.kind === "season" ? "match_night" : "party", dayIndex({ week: f.week, day: 3 }))) {
        f.won = false;
        closeThread(s, t.id, "dropped");
      }
    }
  }
}

/** Turn a block off or on. Its fixtures and results stay, so a block that comes back keeps its table. */
export const setSystem = (s: Run, id: string, on: boolean) => {
  if (s.systems[id]) s.systems[id].on = on;
};
