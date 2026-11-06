// ──────────────────────────────────────────────
// Big Cheese: export to the Engine library (cast.md section 6 a-c, section 8 Export sheet)
// ──────────────────────────────────────────────
// Memories lorebook, place lorebook and a persona note. Only the player's action on the Export
// sheet writes anything. Adult scenes stay out unless the player ticks them (README Adult module).
import { z } from "zod";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { withCast } from "./cast.js";
import { placeKitOf } from "./core/kits/index.js";
import type { Run as Game } from "./core/types.js";
import { BigCheeseError, type Run, type RunStore } from "./store.js";

const Body = z.object({
  kind: z.enum(["memories", "place", "note"]),
  adult: z.boolean().optional(), // the player ticked "include adult scenes"
  preview: z.boolean().optional(), // build and return, write nothing
});

type Entry = { name: string; content: string; keys: string[]; enabled: true };

export const STANCE_TEXT: Record<string, string> = {
  invest: "paid for a real fix",
  cheap_fix: "went for a cheap fix",
  delay: "put it off",
  delegate: "handed it to someone else",
  refuse: "refused",
  ask_others: "asked others first",
};
export const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const entry = (name: string, content: string, keys: string[]): Entry => ({ name, content, keys, enabled: true });

/** Adult threads are the only adult scenes in a run. Without the tick (or the module) they are skipped. */
const adultOk = (g: Game, ticked: boolean | undefined) => !!ticked && !!g.adult;
export const openToExport = (g: Game, id: string, adult: boolean) => {
  if (adult) return true;
  const t = g.threads[id];
  if (t) return t.layer !== "adult";
  // Closed threads keep their layer (null = none). A missing layer is an old save and counts as adult.
  const c = g.closed.find((x) => x.id === id);
  return c?.layer !== undefined && c.layer !== "adult";
};
export const titleOf = (g: Game, id: string) => (g.threads[id] ?? g.closed.find((x) => x.id === id))?.title;

const PLACE = (run: Run) => withCast(placeKitOf(run), run.cast, run.game.clock);

/** (a) One entry per person with their memories of the boss, plus the closed key events. */
export function memoryEntries(run: Run, ticked?: boolean): Entry[] {
  const g = run.game;
  const adult = adultOk(g, ticked);
  const kit = PLACE(run);
  const nameOf = (id: string) => g.people[id]?.name ?? kit.people.find((p) => p.id === id)?.name ?? id;
  const out: Entry[] = [];
  for (const [id, p] of Object.entries(g.people)) {
    const lines = p.memories
      .filter((m) => openToExport(g, m.thread, adult))
      .slice(-8)
      .map((m) => {
        const what = titleOf(g, m.thread) ?? cut(run.text.cards[m.about]?.line ?? "a request", 80);
        return `Week ${m.week}: ${what}. The boss ${STANCE_TEXT[m.stance] ?? m.stance}.`;
      });
    if (lines.length === 0) continue;
    const role = kit.people.find((k) => k.id === id)?.role;
    const head = `${nameOf(id)}${role ? `, ${role}` : ""}, at ${kit.name}. Trust in the boss: ${Math.round(p.trust)} of 100.`;
    out.push(entry(nameOf(id), [head, ...lines].join("\n"), [nameOf(id)]));
  }
  for (const t of g.closed) {
    if (!t.title || t.secret || !openToExport(g, t.id, adult)) continue;
    out.push(entry(t.title, `${t.title} (${t.state}).`, [t.title]));
  }
  return out.slice(0, 60);
}

/** (b) The place: premise, rooms, groups, outside places and traditions. Private rooms are adult. */
export function placeEntries(run: Run, ticked?: boolean): Entry[] {
  const adult = adultOk(run.game, ticked);
  const kit = PLACE(run);
  return [
    entry(kit.name, `${kit.premise} The boss is the ${kit.bossTitle}.`, [kit.name]),
    ...kit.rooms
      .filter((r) => r.kind !== "hidden" && (r.kind !== "private" || adult))
      .map((r) => entry(r.name, r.text, [r.name])),
    ...kit.groups.map((x) => entry(x.name, x.text, [x.name])),
    ...kit.outside.map((x) => entry(x.name, x.text, [x.name])),
    ...kit.traditions.map((x) => entry(x.tag, x.text, [x.tag])),
  ];
}

const START = (id: string) => `[big-cheese:note:${id}]`;
const END = (id: string) => `[/big-cheese:note:${id}]`;

/** (c) Two to four lines about the run. */
export function noteText(run: Run, ticked?: boolean): string {
  const g = run.game;
  const adult = adultOk(g, ticked);
  const kit = PLACE(run);
  const meters = Object.entries(kit.meters)
    .map(([m, v]) => `${v.label} ${Math.round(g.meters[m as keyof typeof g.meters])}`)
    .join(", ");
  const events = g.closed
    .filter((t) => t.title && !t.secret && openToExport(g, t.id, adult))
    .slice(-2)
    .map((t) => `${t.title} (${t.state})`);
  return [
    `What happened at ${kit.name}:`,
    `Ran it as the ${kit.bossTitle} for ${g.clock.week} weeks.${g.ending ? ` It ended with ${g.ending}.` : ""}`,
    `Left it at ${meters}.`,
    ...(events.length ? [`Key events: ${events.join("; ")}.`] : []),
  ].join("\n");
}

const CardBody = z.object({ personId: z.string().max(60), adult: z.boolean().optional() });

/**
 * (d) A V2 character card for one generated person (cast.md section 6 d).
 * The card keeps the voice, the traits and the public memories. The person's secret and every
 * secret thread stay out. Adult threads are skipped unless the player ticked them.
 */
export function cardFromPerson(run: Run, id: string, ticked?: boolean) {
  const g = run.game;
  const kit = PLACE(run);
  const p = kit.people.find((k) => k.id === id);
  if (!p || run.cast?.people[id]?.engineId)
    throw new BigCheeseError(400, "This person has no card to make.", "bad-request");
  const name = g.people[id]?.name ?? p.name;
  const traits = g.people[id]?.traits ?? p.traits;
  const isSecret = (t: string) => !!(g.threads[t] ?? g.closed.find((x) => x.id === t))?.secret;
  const memories = (g.people[id]?.memories ?? [])
    .filter((m) => !isSecret(m.thread) && openToExport(g, m.thread, adultOk(g, ticked)))
    .slice(-8)
    .map(
      (m) =>
        `Week ${m.week}: ${titleOf(g, m.thread) ?? cut(run.text.cards[m.about]?.line ?? "a request", 80)}. ${STANCE_TEXT[m.stance] ?? m.stance}`,
    );
  const phrases = p.voice.phrases;
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name,
      description: [
        `${name} is the ${p.role} at ${kit.name}.`,
        p.core,
        memories.length ? `What happened:\n${memories.join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      personality: `${p.voice.style}. ${traits.join(", ")}`,
      scenario: `${kit.premise} The boss is the ${kit.bossTitle}.`,
      first_mes: phrases[0] ?? "",
      mes_example: phrases.map((x) => `<START>\n{{char}}: ${x}`).join("\n"),
      creator_notes: "Made from a Big Cheese run.",
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: phrases.slice(1, 3),
      tags: ["big-cheese"],
      creator: "Big Cheese",
      character_version: "1",
      extensions: {},
    },
  };
}

/** Puts the note between this run's markers. A repeat replaces the old block, nothing else changes. */
export function withNote(description: string, id: string, note: string): string {
  const block = `${START(id)}\n${note}\n${END(id)}`;
  const a = description.indexOf(START(id));
  const b = description.indexOf(END(id));
  if (a >= 0 && b > a) return description.slice(0, a) + block + description.slice(b + END(id).length);
  return description ? `${description}\n\n${block}` : block;
}

export function createExport(store: RunStore, runtime: CapabilityRuntimeHost) {
  const res = runtime.resources;
  const unsupported = () => new BigCheeseError(501, "This Engine cannot save to your library.", "unsupported");
  return {
    async lorebook(id: unknown, body: unknown) {
      const p = Body.safeParse(body ?? {});
      if (!p.success || p.data.kind === "note") throw new BigCheeseError(400, "Invalid request.", "bad-request");
      const run = await store.get(id);
      const kit = PLACE(run);
      const entries = p.data.kind === "memories" ? memoryEntries(run, p.data.adult) : placeEntries(run, p.data.adult);
      if (p.data.preview) return { entries };
      if (!res.createLorebook || !res.bulkCreateLorebookEntries) throw unsupported();
      const name = `${kit.name}: ${p.data.kind === "memories" ? "memories" : "the place"}`;
      const book = await res.createLorebook({ name, description: "Saved from Big Cheese.", category: "world" });
      await res.bulkCreateLorebookEntries(book.id, entries);
      return { lorebookId: book.id, name, count: entries.length };
    },
    async note(id: unknown, body: unknown) {
      const p = Body.safeParse(body ?? {});
      if (!p.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
      const run = await store.get(id);
      const boss = run.cast?.boss?.engineId;
      if (!boss) throw new BigCheeseError(400, "This run has no persona.", "bad-request");
      const [rec] = await res.listPersonas([boss]);
      if (!rec) throw new BigCheeseError(404, "That persona is gone.", "not-found");
      const old = (rec.data as { description?: unknown }).description;
      const description = withNote(typeof old === "string" ? old : "", String(id), noteText(run, p.data.adult));
      if (p.data.preview) return { description };
      if (!res.updatePersona) throw unsupported();
      await res.updatePersona(boss, { description });
      return { saved: true };
    },

    /** The card file is built here and downloaded by the client. Nothing goes to the Engine. */
    async character(id: unknown, body: unknown) {
      const p = CardBody.safeParse(body ?? {});
      if (!p.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
      const run = await store.get(id);
      return { card: cardFromPerson(run, p.data.personId, p.data.adult) };
    },
  };
}
