// Story layers (Drama, Romance) and the Project block (modules.md 1-2, 5).
// The storyteller calls layerSeeds() each Monday and projects() each morning.
import { pick, roll } from "./rng.js";
import { shiftRelation } from "./people.js";
import { applyDelta, newId } from "./run.js";
import { K } from "./stances.js";
import { closeThread, openStory, openThread } from "./threads.js";
import type { Meter, Run, Thread } from "./types.js";

type Layer = "drama" | "romance";
const LAYERS: Layer[] = ["drama", "romance"];
const WEEKLY = 0.6; // chance per Monday at dial 100, scales down with the dial

/** The dial for a layer, 0-100. A run without one uses 50. */
export const dial = (s: Run, l: Layer) => s.layers?.[l] ?? 50;

interface Seed {
  title: string;
  need: Meter;
  kind?: "rival" | "crush"; // the bond the pair gets if they have none
}
const SEEDS: Record<Layer, Seed[]> = {
  drama: [
    { title: "Two people stop talking", need: "people", kind: "rival" },
    { title: "A feud splits two groups", need: "standing", kind: "rival" },
  ],
  romance: [
    { title: "Two quiet people finally talk", need: "people", kind: "crush" },
    { title: "A love letter goes to the wrong desk", need: "standing", kind: "crush" },
    { title: "A shy person asks the boss for advice about love", need: "people", kind: "crush" },
  ],
};
const WEDDING: Seed = { title: "A wedding at the place", need: "people" };

/** Opens a small card thread for a pair and moves their bond a little. */
function seedPair(s: Run, l: Layer, seed: Seed, a: string, b: string) {
  const t = openThread(s, {
    kind: "follow_up",
    title: seed.title,
    need: seed.need,
    severity: 1,
    people: [a, b],
    origin: "block",
  });
  t.layer = l;
  const tomorrow =
    s.clock.day === 4 ? { week: s.clock.week + 1, day: 0 } : { week: s.clock.week, day: s.clock.day + 1 };
  t.beats.push({ id: newId(s, "b"), type: "card", planned: tomorrow, seed: { need: seed.need, severity: 1 } });
  if (seed.kind) {
    if (!s.relations.some((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)))
      s.relations.push({ a, b, kind: seed.kind, level: 25 });
    shiftRelation(s, a, b, 10);
  }
}

/** Monday: a dial at 0 opens nothing; a higher dial opens a pair thread more often. One open thread per layer. */
export function layerSeeds(s: Run, cap: number) {
  for (const r of s.relations) if (r.kind === "crush" && r.level >= 80 && dial(s, "romance") > 0) r.kind = "couple";
  for (const l of LAYERS) {
    const d = dial(s, l);
    const open = Object.values(s.threads);
    if (!d || open.length >= cap || open.some((t) => t.layer === l) || roll(s) >= (d / 100) * WEEKLY) continue;
    const ok = Object.keys(s.people).filter((id) => s.people[id]!.status === "active");
    const couple =
      l === "romance"
        ? s.relations.find((r) => r.kind === "couple" && ok.includes(r.a) && ok.includes(r.b))
        : undefined;
    if (couple && roll(s) < 0.2) {
      seedPair(s, l, WEDDING, couple.a, couple.b);
      continue;
    }
    if (ok.length < 2) continue;
    const a = pick(s, ok);
    seedPair(
      s,
      l,
      pick(s, SEEDS[l]),
      a,
      pick(
        s,
        ok.filter((id) => id !== a),
      ),
    );
  }
}

/** Project progress as a clock: beats landed out of 5. */
export const projectProgress = (t: Thread) => 5 - t.beats.filter((b) => b.planned).length;

/** The "start a project" action. One project at a time. */
export function startProject(s: Run, title = "A new project") {
  return (
    Object.values(s.threads).find((t) => t.kind === "project") ??
    openStory(s, "project", { title, need: "output", people: [], severity: 2, origin: "action" })
  );
}

/** Morning: a project whose last beat (the reveal) has landed and that has not failed is won. Two bad cards lose it elsewhere. */
export function projects(s: Run) {
  for (const t of Object.values(s.threads)) {
    if (t.kind !== "project" || projectProgress(t) < 5) continue;
    closeThread(s, t.id, "won");
    s.meters = applyDelta(s.meters, { [t.need ?? "output"]: K[t.severity ?? 2] });
  }
}
