import assert from "node:assert/strict";
import {
  contributeMeanwhile,
  markDelivered,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/context.ts";
import { meanwhileRoutes } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/routes.ts";
import {
  configureMeanwhileRuntime,
  defaultCircle,
  readMeanwhile,
  updateMeanwhile,
  type LifeEvent,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/store.ts";

const NOW = Date.now();
const docs = new Map<string, any>();
let messages: { role: string; createdAt: string }[] = [];
const runtime: any = {
  logger: { warn: () => undefined },
  resources: { listCharacters: async () => [{ id: "x", data: { name: "Lily" } }] },
  persistence: {
    listChats: async () => [],
    getChat: async () => ({ characterIds: ["x", "y"], lastMessageAt: new Date(NOW + 1000).toISOString() }),
    listMessages: async () => messages,
    documents: {
      getById: async (_p: string, id: string) => docs.get(id) ?? null,
      create: async (input: any) => (docs.set(input.id, { ...input, revision: 1 }), docs.get(input.id)),
      update: async (input: any) => {
        const current = docs.get(input.id);
        if (current.revision !== input.expectedRevision) return null;
        docs.set(input.id, { ...current, ...input, revision: current.revision + 1 });
        return docs.get(input.id);
      },
    },
  },
};

const handlers = new Map<string, (request: any, reply: any) => Promise<any>>();
const app: any = {};
for (const method of ["get", "post", "patch", "delete"]) {
  app[method] = (path: string, handler: any) => handlers.set(`${method.toUpperCase()} ${path}`, handler);
}
async function call(method: string, url: string, payload?: unknown) {
  const m = /^\/circles\/([^/]+)(\/.*)?$/.exec(url);
  const handler = handlers.get(
    `${method} ${m ? `/circles/:id${(m[2] ?? "").replace(/^\/events\/[^/]+/, "/events/:eventId")}` : url}`,
  )!;
  const reply = { code: (status: number) => ({ send: (body: unknown) => ({ replied: true, status, body }) }) };
  const out = await handler(
    { params: { id: m?.[1], eventId: /events\/([^/]+)/.exec(url)?.[1] }, body: payload, query: {} },
    reply,
  );
  return out && typeof out === "object" && "replied" in out ? (out as any) : { status: 200, body: out };
}

const iso = (n: number) => new Date(NOW - n * 60_000).toISOString();
const event = (id: string, over: Partial<LifeEvent> = {}): LifeEvent => ({
  id,
  circleId: "k",
  start: iso(120),
  end: iso(60),
  createdAt: NOW,
  cast: ["x"],
  kind: "friends",
  weight: "notable",
  text: `Text ${id}`,
  source: "generated",
  status: "accepted",
  visibility: "circle",
  ...over,
});

async function main() {
  const release = configureMeanwhileRuntime(runtime);
  await meanwhileRoutes(app, {});
  assert.equal((await call("POST", "/circles", { name: "A" })).body.surprise, false);

  const circle = { ...defaultCircle("k", NOW), castIds: ["x", "y"], linkedChatIds: ["c1"], surprise: true };
  const texts = [{ from: "x", to: "y", time: iso(90), text: "TEXT" }];
  await updateMeanwhile((d) => ({
    ...d,
    circles: [circle, { ...circle, id: "k2", linkedChatIds: [] }],
    events: [
      event("routine", { weight: "routine", text: "Routine work" }),
      event("note", { text: "SECRET note" }),
      event("hooked", { text: "SECRET hooked", hook: { x: "SECRET job offer" }, diary: { x: "SECRET diary" } }),
      event("phone", { text: "SECRET phone", texts }),
      event("gone", { visibility: "chat:gone", text: "Gone chat" }),
      event("old", { start: iso(60 * 24 * 20 + 120), end: iso(60 * 24 * 20 + 60), text: "Old news" }),
      event("nochat", { circleId: "k2", text: "No chat" }),
      event("review", { status: "proposed", weight: "major", text: "Needs review" }),
      event("routinePhone", { weight: "routine", text: "Routine phone", texts }),
    ],
    papers: [
      {
        id: "p1",
        circleId: "k",
        weekStart: "2026-11-02",
        title: "SECRET paper",
        items: [],
        createdAt: NOW,
        eventIds: ["note"],
      },
    ],
  }));
  const spoilers = (body: unknown) => JSON.stringify(body).includes("SECRET");

  // Surprise on: the routes show routine and review events, nothing told.
  const timeline = (await call("GET", "/circles/k/timeline")).body;
  assert.deepEqual(timeline.events.map((e: any) => e.id).sort(), ["gone", "review", "routine", "routinePhone"]);
  assert.equal(timeline.dealt.length, 0);
  const home = (await call("GET", "/circles/k/home")).body;
  assert.equal(home.hooks.length, 0);
  assert.equal(home.diary.x.length, 0);
  assert.equal(home.waiting.length, 1);
  const widget = (await call("GET", "/widget")).body;
  assert.equal(widget.hooks.length, 0);
  assert.equal(widget.quiet[0].toHear, 3);
  assert.equal((await call("GET", "/circles")).body.circles[0].toHear, 3);
  assert.equal((await call("GET", "/circles")).body.circles[1].toHear, 0);
  assert.equal((await call("GET", "/circles/k/phone")).body.threads[0].texts.length, 1);
  assert.equal((await call("GET", "/circles/k/papers")).body.papers.length, 0);
  assert.equal((await call("GET", "/circles/k/nudges")).status, 200);
  for (const body of [timeline, home, widget]) assert.ok(!spoilers(body));
  // A hidden event cannot be vetoed or edited; one in review still can.
  assert.equal((await call("POST", "/circles/k/events/note/veto")).status, 404);
  assert.equal((await call("POST", "/circles/k/events/review/veto")).status, 200);
  await updateMeanwhile((d) => ({
    ...d,
    events: d.events.map((e) => (e.id === "review" ? { ...e, status: "proposed" } : e)),
  }));

  // Delivery: the prompt context takes the hook and the plain notable event, and marks both as told.
  const first = (await contributeMeanwhile({ chatId: "c1", targetCharacterIds: ["x"] }))!;
  assert.ok(first.includes("SECRET note") && first.includes("SECRET job offer"));
  messages = [{ role: "assistant", createdAt: new Date(NOW + 5000).toISOString() }];
  await markDelivered();
  const told = (await readMeanwhile()).events.filter((e) => Object.keys(e.delivered ?? {}).length).map((e) => e.id);
  assert.ok(
    told.includes("note") && told.includes("hooked") && told.includes("phone"),
    "non-hook events are marked told too",
  );
  const after = (await call("GET", "/circles/k/home")).body;
  assert.equal(after.hooks.length, 1);
  assert.equal(after.diary.x.length, 1);
  assert.ok((await call("GET", "/circles/k/timeline")).body.events.some((e: any) => e.id === "note"));

  // Group chat: only the character who replied has the event marked told.
  await updateMeanwhile((d) => ({
    ...d,
    circles: [...d.circles, { ...circle, id: "g", linkedChatIds: ["c2"], castIds: ["x", "y"] }],
    events: [
      ...d.events,
      event("gx", { circleId: "g", cast: ["x"], hook: { x: "x news" } }),
      event("gy", { circleId: "g", cast: ["y"], hook: { y: "y news" } }),
    ],
  }));
  messages = [{ role: "assistant", characterId: "x", createdAt: new Date(NOW + 9000).toISOString() } as any];
  await markDelivered();
  const grouped = (await readMeanwhile()).events;
  assert.ok(Object.keys(grouped.find((e) => e.id === "gx")!.delivered ?? {}).length);
  assert.ok(!Object.keys(grouped.find((e) => e.id === "gy")!.delivered ?? {}).length);

  // Surprise off: everything is visible and nothing is counted.
  await updateMeanwhile((d) => ({ ...d, circles: d.circles.map((c) => ({ ...c, surprise: false })) }));
  assert.equal((await call("GET", "/circles/k/timeline")).body.events.length, 7);
  assert.equal((await call("GET", "/circles/k/papers")).body.papers.length, 1);
  assert.equal((await call("GET", "/circles")).body.circles[0].toHear, 0);

  release();
  console.log("meanwhile surprise regression passed");
}

void main();
