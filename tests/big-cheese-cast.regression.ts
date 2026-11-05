import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import { HAFENKAI_PLACE as kit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { runTask } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";
import { withCast } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/cast.js";
import { activate } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/server-entry.js";

const MARI = "__professor_mari__";

function fakeDocuments(): CapabilityDocumentStore {
  const docs = new Map<string, CapabilityDocumentRecord>();
  return {
    list: async (_p, kind) => [...docs.values()].filter((d) => d.kind === kind),
    getById: async (_p, id) => docs.get(id) ?? null,
    create: async (input) => {
      const record = { ...input, revision: 1 } as CapabilityDocumentRecord;
      docs.set(record.id, record);
      return record;
    },
    update: async (input) => {
      const current = docs.get(input.id);
      if (!current || current.revision !== input.expectedRevision) return null;
      const record = { ...current, ...input, revision: current.revision + 1 } as CapabilityDocumentRecord;
      docs.set(record.id, record);
      return record;
    },
    remove: async (_p, id, revision) => docs.get(id)?.revision === revision && docs.delete(id),
  } as CapabilityDocumentStore;
}

const card = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  data: { name, description: `${name} runs a tight crew.`, personality: "Blunt and loyal. Hates losing.", ...extra },
});

// Starts the real routes on a fake Engine that holds these cards and personas. The language model always fails, so Lite runs.
async function harness(cards: ReturnType<typeof card>[], personas: ReturnType<typeof card>[] = []) {
  const routes: {
    method: string;
    re: RegExp;
    names: string[];
    handler: (req: unknown, reply: unknown) => Promise<unknown>;
  }[] = [];
  const add = (method: string) => (path: string, handler: never) => {
    const names: string[] = [];
    const re = new RegExp("^" + path.replace(/:(\w+)/g, (_m, n) => (names.push(n), "([^/]+)")) + "$");
    routes.push({ method, re, names, handler });
  };
  const rows = (list: ReturnType<typeof card>[], ids?: string[]) =>
    list
      .filter((c) => !ids || ids.includes(c.id))
      .map((c) => ({ id: c.id, data: JSON.stringify(c.data), comment: "" }));
  const api = {
    runtime: {
      persistence: { documents: fakeDocuments() },
      logger: { error() {} },
      languageModels: { resolveForRequest: async () => Promise.reject(new Error("no model")) },
      resources: {
        listCharacters: async (ids?: string[]) => rows(cards, ids),
        listPersonas: async (ids?: string[]) => rows(personas, ids),
      },
    },
    registerPrivilegedRoutes: async (fn: (router: unknown) => Promise<void>) => {
      await fn({ get: add("GET"), post: add("POST"), delete: add("DELETE") });
      return () => {};
    },
  };
  await activate({ api } as never);
  const call = async (method: string, url: string, body?: unknown) => {
    const route = routes.find((r) => r.method === method && r.re.test(url))!;
    const m = route.re.exec(url)!;
    const params = Object.fromEntries(route.names.map((n, i) => [n, m[i + 1]]));
    const reply = {
      code: 200,
      status(c: number) {
        this.code = c;
        return this;
      },
      send: (p: unknown) => p,
    };
    const out: any = await route.handler({ params, body }, reply);
    return { code: reply.code, body: out };
  };
  return { call };
}

const tomasz = kit.people.find((p) => p.id === "tomasz")!;
const sheet = (over: object = {}) => ({
  role: tomasz.role,
  traits: ["hot-headed", "loyal"],
  tone: "short, dry",
  lines: ["Again. And this time, row like you mean it."],
  core: "Rhea Sand. Former rower.",
  ...over,
});
const start = (h: Awaited<ReturnType<typeof harness>>, body: object) =>
  h.call("POST", "/runs", { kitId: "hafenkai", lite: true, ...body });

test("the picker lists names and short lines, never Professor Mari, never a full card", async () => {
  const many = Array.from({ length: 250 }, (_, i) => card(`m${i}`, `Person ${String(i).padStart(3, "0")}`));
  const h = await harness(
    [card(MARI, "Professor Mari"), card("c1", "Rhea Sand", { scenario: "SECRET-SCENARIO" }), ...many],
    [card("p1", "Wren Calloway")],
  );
  const r = await h.call("GET", "/cast");
  assert.equal(r.code, 200);
  assert.ok(!r.body.characters.some((c: { id: string }) => c.id === MARI));
  assert.equal(r.body.characters.length, 200);
  assert.deepEqual(
    r.body.personas.map((p: { name: string }) => p.name),
    ["Wren Calloway"],
  );
  assert.ok(!JSON.stringify(r.body).includes("SECRET-SCENARIO"));
  assert.deepEqual(Object.keys(r.body.characters[0]).sort(), ["avatar", "id", "line", "name"]);
});

test("avatars are kept only when they are paths on the Engine", async () => {
  const h = await harness([
    card("a", "Ada", { avatarPath: "/api/avatars/a.png" }),
    card("b", "Bo", { avatarPath: "https://evil.example/x.png" }),
    card("c", "Cy", { avatarPath: "//evil.example/x.png" }),
    card("d", "Di", { avatarPath: "/a/../../b.png" }),
  ]);
  const byName = Object.fromEntries(
    (await h.call("GET", "/cast")).body.characters.map((c: { name: string; avatar: string }) => [c.name, c.avatar]),
  );
  assert.deepEqual(byName, { Ada: "/api/avatars/a.png", Bo: "", Cy: "", Di: "" });
});

test("cast.read builds a sheet in Lite, offers no deputy role and refuses Mari", async () => {
  const h = await harness([card("c1", "Rhea Sand"), card(MARI, "Professor Mari")]);
  const r = await h.call("POST", "/cast/read", { kitId: "hafenkai", characterId: "c1", lite: true });
  assert.equal(r.code, 200);
  assert.ok(r.body.slots.length > 0 && !r.body.slots.some((s: { id: string }) => s.id === "henrike"));
  assert.ok(r.body.slots.some((s: { role: string }) => s.role === r.body.sheet.role));
  assert.deepEqual(r.body.sheet.traits, ["loyal"]);
  assert.ok(r.body.sheet.lines.length >= 1);
  assert.equal((await h.call("POST", "/cast/read", { kitId: "hafenkai", characterId: MARI })).code, 400);
  assert.equal((await h.call("POST", "/cast/read", { kitId: "hafenkai", characterId: "nope" })).code, 404);
  assert.equal((await h.call("POST", "/cast/read", { kitId: "hafenkai" })).code, 400);
});

test("sheet fields are capped at the route", async () => {
  const h = await harness([card("c1", "Rhea Sand")]);
  const bads = [
    sheet({ traits: [] }),
    sheet({ traits: ["loyal", "loyal"] }),
    sheet({ traits: ["loyal", "honest", "brave"] }),
    sheet({ traits: ["not-a-trait"] }),
    sheet({ lines: [] }),
    sheet({ lines: ["a", "b", "c", "d"] }),
    sheet({ lines: ["x".repeat(161)] }),
    sheet({ tone: "x".repeat(41) }),
    sheet({ core: "x".repeat(501) }),
  ];
  for (const s of bads)
    assert.equal((await start(h, { staff: [{ characterId: "c1", sheet: s }] })).code, 400, JSON.stringify(s));
  const four = ["c1", "c1", "c1", "c1"].map((characterId) => ({ characterId, sheet: sheet() }));
  assert.equal((await start(h, { staff: four })).code, 400);
});

test("staff replace the kit person with the same role and the run keeps ids", async () => {
  const h = await harness([card("c1", "Rhea Sand", { avatarPath: "/api/avatars/r.png" }), card("c2", "Silas Marr")]);
  const r = await start(h, { staff: [{ characterId: "c1", sheet: sheet() }] });
  assert.equal(r.code, 200);
  const who = r.body.kit.people.find((p: { id: string }) => p.id === "tomasz");
  assert.equal(who.name, "Rhea Sand");
  assert.equal(who.role, tomasz.role);
  assert.equal(who.library, true);
  assert.equal(who.avatar, "/api/avatars/r.png");
  assert.deepEqual(who.traits, ["hot-headed", "loyal"]);
  assert.equal(r.body.kit.people.length, kit.people.length);
  assert.equal(r.body.run.cast.people.tomasz.engineId, "c1");
  // The kit's own text uses the new name, and the old one is gone from it.
  assert.ok(r.body.kit.letters.some((l: { text: string }) => l.text.includes("Rhea")));
  assert.ok(!JSON.stringify(r.body.kit).includes("Tomasz"));
  assert.ok(!r.body.run.game.people.rhea);
  // The core still has its person under the old id.
  assert.ok(r.body.run.game.people.tomasz);
  // The name comes from the Engine card, not from the client.
  assert.equal(JSON.stringify(r.body).includes("Silas"), false);
});

test("the deputy, an unknown role, repeats and Mari are refused", async () => {
  const h = await harness([card("c1", "Rhea Sand"), card("c2", "Silas Marr"), card(MARI, "Professor Mari")]);
  const cases = [
    [{ characterId: "c1", replaces: "henrike", sheet: sheet() }],
    [{ characterId: "c1", sheet: sheet({ role: "Deputy, day shift lead" }) }],
    [{ characterId: "c1", sheet: sheet({ role: "Astronaut" }) }],
    [
      { characterId: "c1", sheet: sheet() },
      { characterId: "c2", sheet: sheet() },
    ],
    [
      { characterId: "c1", sheet: sheet() },
      { characterId: "c1", replaces: "dilek", sheet: sheet() },
    ],
    [{ characterId: MARI, sheet: sheet() }],
    [{ characterId: "gone", sheet: sheet() }],
  ];
  for (const staff of cases) assert.ok([400, 404].includes((await start(h, { staff })).code), JSON.stringify(staff));
  assert.equal((await start(h, { boss: MARI })).code, 400);
  assert.equal((await start(h, { boss: "gone" })).code, 404);
});

test("a run without a cast is unchanged", async () => {
  const h = await harness([card("c1", "Rhea Sand")]);
  const r = await start(h, {});
  assert.equal(r.code, 200);
  assert.equal(r.body.run.cast, undefined);
  assert.equal(r.body.kit.people.find((p: { id: string }) => p.id === "tomasz").name, tomasz.name);
});

test("the boss name and description reach the model prompt, and the cast person's voice with them", async () => {
  const h = await harness(
    [card("c1", "Rhea Sand")],
    [
      card("p1", "Wren Calloway", {
        description: "A former soldier with a soft spot for ferries.",
        avatarPath: "/api/avatars/w.png",
      }),
    ],
  );
  const r = await start(h, { boss: "p1", staff: [{ characterId: "c1", sheet: sheet() }] });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.kit.boss, { name: "Wren Calloway", avatar: "/api/avatars/w.png" });
  const played = withCast(kit, r.body.run.cast);
  let sent = "";
  const model = async (messages: { content: string }[]) => {
    sent = messages.map((m) => m.content).join("\n");
    return "not json";
  };
  const out = await runTask(
    "scene.part",
    { kit: played, rng: 1, blueprint: "arrival", goal: "g", room: "office", people: ["tomasz"], offer: [] },
    { model },
  );
  assert.equal(out.source, "lite");
  assert.match(sent, /The boss is Wren Calloway\. A former soldier with a soft spot for ferries\./);
  assert.match(sent, /tomasz: Rhea Sand/);
  assert.match(sent, /Rhea Sand\. Former rower\./);
});

test("cast names are replaced once, with word boundaries, and special characters stay literal", () => {
  const [x, y] = kit.people.filter((p) => !p.deputy);
  const yFirst = y!.name.split(" ")[0]!;
  const person = (name: string) => ({ engineId: "c", name, core: "", traits: [], tone: "", lines: [], avatar: "" });
  const played = withCast(kit, { people: { [x!.id]: person(yFirst), [y!.id]: person("A$'B") } } as never);
  assert.equal(played.people.find((p) => p.id === x!.id)!.name, yFirst);
  assert.equal(played.people.find((p) => p.id === y!.id)!.name, "A$'B");
  assert.ok(!JSON.stringify(played).includes(y!.name));
});

test("cards that state an age under 18 are refused; a stated adult age is kept", async () => {
  const h = await harness([
    card("kid", "Pip", { description: "Pip is a 16-year-old deckhand." }),
    card("tag", "Lia", { tags: ["Loli"] }),
    card("adult", "Rhea Sand", { description: "Rhea Sand, 34 years old, former rower." }),
  ]);
  for (const id of ["kid", "tag"]) {
    const r = await start(h, { staff: [{ characterId: id, sheet: sheet() }] });
    assert.equal(r.code, 400, id);
    assert.match(r.body.message, /under 18/);
  }
  const ok = await start(h, { staff: [{ characterId: "adult", sheet: sheet() }] });
  assert.equal(ok.code, 200);
  assert.equal(ok.body.run.cast.people.tomasz.age, 34);
});
