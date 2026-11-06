import assert from "node:assert/strict";
import { meanwhileRoutes } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/routes.ts";
import { pickItems } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/context.ts";
import {
  cancelFastForward,
  ffStatus,
  previewFastForward,
  runCircleNow,
  runDuePass,
  startFastForward,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/scheduler.ts";
import {
  configureMeanwhileRuntime,
  defaultCircle,
  readMeanwhile,
  updateMeanwhile,
  type Circle,
  type LifeEvent,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/store.ts";

const T0 = Date.UTC(2026, 0, 5); // Monday
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const REAL0 = Date.UTC(2026, 8, 2);
const iso = (ms: number) => new Date(ms).toISOString();

const card = {
  data: {
    extensions: {
      conversationSchedule: {
        days: Object.fromEntries(
          ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => [
            d,
            [{ time: "09:00-10:00", activity: "coffee", status: "online" }],
          ]),
        ),
      },
    },
  },
};

const docs = new Map<string, any>();
let messages: { id: string; role: string; characterId: string | null; content: string; createdAt: string }[] = [];
let chatCount = 0;
let calls = 0;
let beatPrompts: string[] = [];
let promiseCalls = 0;
let promiseAnswer: unknown = { promises: [] };
let onBeatCall: (() => void) | null = null;
// Beats name a promise (kept) only in this mode: the first beat that has cast number 0 in it.
let keepMode = false;
let hold: Promise<void> | null = null;
let active = 0;
let maxActive = 0;
let race: { left: number; fn: () => void } | null = null;
const warnings: string[] = [];

configureMeanwhileRuntime({
  logger: { warn: (m: string) => warnings.push(m) },
  json: { parseJsonish: (raw: string) => JSON.parse(raw) },
  languageModels: {
    resolve: async () => ({
      chatComplete: async (msgs: { role: string; content: string }[]) => {
        calls += 1;
        const reply = (value: unknown) => ({
          content: JSON.stringify(value),
          usage: { promptTokens: 10, completionTokens: 5 },
        });
        if (msgs[0]!.content.startsWith("You read chat messages")) {
          promiseCalls += 1;
          return reply(promiseAnswer);
        }
        if (msgs[0]!.content.startsWith("You summarise")) return reply({ text: "Time passed quietly.", diary: {} });
        const lines = msgs
          .at(-1)!
          .content.split("\n")
          .filter((l) => l.startsWith('{"seed"'));
        if (!lines.length) return reply({});
        beatPrompts.push(msgs.map((m) => m.content).join("\n"));
        onBeatCall?.();
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (hold) await hold;
        active -= 1;
        let keptGiven = false;
        const beats = lines.map((l) => {
          const s = JSON.parse(l) as { seed: string; time: string; cast: number[] };
          const m = Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3)) + 30;
          const pad = (n: number) => String(n).padStart(2, "0");
          return {
            seed: s.seed,
            start: s.time,
            end: `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`,
            text: "They met up.",
            hook: { [s.cast[0]!]: "met up" },
            ...(keepMode && !keptGiven && s.cast.includes(0) && msgs.at(-1)!.content.includes("P1 (")
              ? ((keptGiven = true), { kept: [1] })
              : {}),
          };
        });
        return reply({ beats });
      },
    }),
  },
  resources: {
    listCharacters: async () => [
      { id: "x", data: card },
      { id: "y", data: card },
    ],
  },
  persistence: {
    listChats: async () =>
      chatCount
        ? [{ id: "c1", name: "c1", characterIds: ["x", "y"], lastMessageAt: iso(REAL0 - 30 * DAY), metadata: {} }]
        : [],
    getChat: async () => null,
    listMessages: async () => messages,
    documents: {
      getById: async (_p: string, id: string) => {
        if (race && --race.left === 0) {
          race.fn();
          race = null;
        }
        return docs.get(id) ?? null;
      },
      create: async (input: any) => (docs.set(input.id, { ...input, revision: 1 }), docs.get(input.id)),
      update: async (input: any) => {
        const doc = docs.get(input.id);
        if (doc.revision !== input.expectedRevision) return null;
        docs.set(input.id, { ...doc, ...input, revision: doc.revision + 1 });
        return docs.get(input.id);
      },
    },
  },
} as any);

function circle(over: Partial<Circle> = {}): Circle {
  return {
    ...defaultCircle("q", T0),
    castIds: ["x", "y"],
    connectionId: "m",
    budgetCallsPerDay: 50,
    clock: { anchorCircle: iso(T0 + HOUR), anchorReal: REAL0, speed: 0, timezone: "UTC" },
    lastRunCircle: iso(T0),
    ...over,
  };
}
async function reset(c: Circle, events: LifeEvent[] = []) {
  docs.clear();
  calls = 0;
  promiseCalls = 0;
  beatPrompts = [];
  onBeatCall = null;
  keepMode = false;
  hold = null;
  race = null;
  maxActive = 0;
  await updateMeanwhile((d) => ({ ...d, circles: [c], events }));
}
const settled = async (id: string) => {
  while (ffStatus(id).running) await new Promise((r) => setTimeout(r, 5));
};
const event = (over: Partial<LifeEvent>): LifeEvent => ({
  id: "e1",
  circleId: "q",
  start: iso(T0 + 10 * HOUR),
  end: iso(T0 + 11 * HOUR),
  createdAt: T0,
  cast: ["x"],
  kind: "luck",
  weight: "notable",
  text: "Lily found a coin.",
  source: "generated",
  status: "accepted",
  visibility: "circle",
  hook: { x: "found a coin" },
  ...over,
});

// Minimal Fastify stand-in with path parameters.
const handlers = new Map<string, (request: any, reply: any) => Promise<any>>();
const app: any = {};
for (const method of ["get", "post", "patch", "delete"]) {
  app[method] = (path: string, handler: any) => handlers.set(`${method.toUpperCase()} ${path}`, handler);
}
async function call(method: string, path: string, params: Record<string, string>, body?: unknown) {
  const reply = { code: (status: number) => ({ send: (b: unknown) => ({ replied: true, status, body: b }) }) };
  const out = await handlers.get(`${method} ${path}`)!({ params, body, query: {} }, reply);
  return out && typeof out === "object" && "replied" in out ? (out as any) : { status: 200, body: out };
}

async function main() {
  await fastForwardCases();
  await reviewCases();
  await promiseCases();
  console.log("meanwhile review tests passed");
}

async function fastForwardCases() {
  // x0: the clock still moves. 5 days beat day by day, never one long-absence summary.
  await reset(circle());
  const estimate = (await previewFastForward("q", 5 * DAY, REAL0))!;
  assert.ok(estimate.days >= 3 && estimate.days <= 5, `days ${estimate.days}`);
  assert.equal(estimate.left, 50);
  assert.ok(await startFastForward("q", 5 * DAY, false, REAL0));
  assert.equal(await startFastForward("q", DAY, false, REAL0), false, "one run per Circle");
  await settled("q");
  let doc = await readMeanwhile();
  const q = doc.circles[0]!;
  assert.equal(q.clock.anchorCircle, iso(T0 + HOUR + 5 * DAY));
  assert.equal(q.clock.speed, 0);
  assert.equal(doc.beatDays.length, estimate.days);
  assert.ok(!doc.events.some((e) => e.weight === "summary"));
  // The estimate counts a Monday paper call (at most 1) that a week with fewer than 2 events does not make.
  assert.ok(
    calls === estimate.calls || calls === estimate.calls - 1,
    JSON.stringify({ estimate, calls, beat: doc.beatDays, usage: doc.usage }),
  );
  assert.equal(q.lastRunCircle, iso(T0 + HOUR + 5 * DAY));
  assert.deepEqual(ffStatus("q"), { running: false, dayIndex: estimate.days, days: estimate.days });

  // Cancel after the first beat call: that day stays, the mark covers only it.
  await reset(circle());
  onBeatCall = () => void cancelFastForward("q");
  await startFastForward("q", 5 * DAY, false, REAL0);
  await settled("q");
  doc = await readMeanwhile();
  assert.equal(doc.beatDays.length, 1);
  assert.ok(doc.events.some((e) => e.source === "generated"));
  assert.ok(Date.parse(doc.circles[0]!.lastRunCircle) < T0 + HOUR + 5 * DAY);
  assert.equal(doc.marks[0]!.failures, 0);

  // Over budget: the route needs the flag, and the calls still count.
  await reset(circle({ budgetCallsPerDay: 1 }));
  await meanwhileRoutes(app, {});
  const ask = await call("POST", "/circles/:id/fast-forward", { id: "q" }, { days: 5 });
  assert.equal(ask.status, 409);
  assert.equal(ask.body.overBudget, true);
  assert.match(ask.body.error, /of 1 calls left today/u);
  assert.equal((await readMeanwhile()).circles[0]!.clock.anchorCircle, iso(T0 + HOUR), "nothing moved");
  assert.equal((await call("POST", "/circles/:id/fast-forward", { id: "q" }, { days: 9 })).status, 400);
  const go = await call("POST", "/circles/:id/fast-forward", { id: "q" }, { days: 5, allowOverBudget: true });
  assert.equal(go.status, 200);
  await settled("q");
  doc = await readMeanwhile();
  assert.ok(calls > 1 && doc.usage[0]!.calls === calls);
  assert.equal(doc.beatDays.length, estimate.days);

  // A timer pass while a fast forward holds the lease skips the Circle: one run at a time.
  await reset(circle());
  let release!: () => void;
  hold = new Promise<void>((resolve) => (release = resolve));
  assert.ok(await startFastForward("q", 2 * DAY, false, REAL0));
  while (!beatPrompts.length) await new Promise((r) => setTimeout(r, 5));
  const during = calls;
  assert.deepEqual(await runDuePass(REAL0), []);
  assert.equal(calls, during);
  hold = null;
  release();
  await settled("q");
  assert.equal(maxActive, 1);

  // x24: the clock re-anchors at the real time of the jump and keeps its speed.
  await reset(
    circle({
      clock: { anchorCircle: iso(T0 + HOUR), anchorReal: REAL0, speed: 24, timezone: "UTC" },
      lastRunCircle: iso(T0 + DAY + HOUR),
    }),
  );
  const later = REAL0 + HOUR; // one real hour = one Circle day at x24
  assert.ok(await startFastForward("q", 2 * DAY, false, later));
  await settled("q");
  const fast = (await readMeanwhile()).circles[0]!;
  assert.equal(fast.clock.speed, 24);
  assert.equal(fast.clock.anchorReal, later);
  assert.equal(fast.clock.anchorCircle, iso(T0 + HOUR + 3 * DAY));
  assert.equal(fast.lastRunCircle, fast.clock.anchorCircle);

  // A Circle that was already behind keeps a summary for the days before the span, and the preview says so.
  await reset(circle({ lastRunCircle: iso(T0 - 10 * DAY) }));
  const behind = (await previewFastForward("q", 2 * DAY, REAL0))!;
  assert.equal(behind.missed, 9);
  assert.ok(await startFastForward("q", 2 * DAY, false, REAL0));
  await settled("q");
  doc = await readMeanwhile();
  assert.ok(doc.events.some((e) => e.weight === "summary" && e.text === "Time passed quietly."));
  assert.equal(calls, behind.calls + 1); // the estimate counts one paper call; the fake model gives a bad paper, so the retry adds one
  assert.equal(doc.circles[0]!.lastRunCircle, doc.circles[0]!.clock.anchorCircle);
}

async function reviewCases() {
  await reset(circle(), [
    event({ id: "big", kind: "death", weight: "major", status: "proposed", text: "Mia moves away.", hook: undefined }),
    event({ id: "ok", text: "Lily found a coin." }),
    event({ id: "routine", weight: "routine", text: "coffee" }),
  ]);
  const names = { x: "Lily" };
  const shown = (id: string) => {
    return readMeanwhile().then((d) => pickItems(d, "c1", ["x"], names)?.text ?? "");
  };
  await updateMeanwhile((d) => ({ ...d, circles: [{ ...d.circles[0]!, linkedChatIds: ["c1"] }] }));
  chatCount = 1;
  const statusOf = async (id: string) => (await readMeanwhile()).events.find((e) => e.id === id)!.status;
  const p = { id: "q", eventId: "" };

  assert.ok(!(await shown("")).includes("Mia moves away"), "a proposed event stays out of the chat");
  assert.equal((await call("GET", "/circles/:id/home", { id: "q" })).body.waiting.length, 1);
  assert.match(
    (await call("GET", "/circles/:id/home", { id: "q" })).body.waiting[0].time,
    /^\d\d:\d\d$/,
    "cards carry a time of day for friendly dates",
  );
  assert.equal((await call("GET", "/circles", {})).body.circles[0].waiting, 1);

  assert.equal((await call("POST", "/circles/:id/events/:eventId/accept", { ...p, eventId: "ok" })).status, 409);
  assert.equal((await call("POST", "/circles/:id/events/:eventId/accept", { ...p, eventId: "big" })).status, 200);
  assert.equal(await statusOf("big"), "accepted");
  assert.ok((await shown("")).includes("Mia moves away"));

  // Edit runs the banned check ("you" is banned, like in the beat call) and only fits notable and major events.
  const edit = (eventId: string, text: unknown) =>
    call("PATCH", "/circles/:id/events/:eventId", { ...p, eventId }, { text });
  assert.equal((await edit("ok", "Lily told you about it.")).status, 400);
  assert.equal((await edit("ok", "")).status, 400);
  assert.equal((await edit("ok", "x".repeat(141))).status, 400);
  assert.equal((await edit("routine", "walk")).status, 409);
  assert.equal((await edit("ok", "Lily found a wallet.")).status, 200);
  assert.equal((await readMeanwhile()).events.find((e) => e.id === "ok")!.text, "Lily found a wallet.");
  assert.equal((await edit("nope", "x")).status, 404);

  // Veto works on an accepted event: it leaves the chat context, the diary and the hooks.
  assert.equal((await call("POST", "/circles/:id/events/:eventId/veto", { ...p, eventId: "ok" })).status, 200);
  assert.equal(await statusOf("ok"), "vetoed");
  assert.ok(!(await shown("")).includes("found a coin"), "a vetoed event leaves the context");
  const home = (await call("GET", "/circles/:id/home", { id: "q" })).body;
  assert.ok(!home.hooks.some((h: any) => h.eventId === "ok"));
  assert.equal((await call("POST", "/circles/:id/events/:eventId/veto", { ...p, eventId: "ok" })).status, 409);

  // A proposed event that nobody answers is vetoed after 7 Circle days, in the run.
  chatCount = 0;
  await reset(circle({ clock: { anchorCircle: iso(T0 + 10 * DAY), anchorReal: REAL0, speed: 0, timezone: "UTC" } }), [
    event({ id: "old", kind: "death", weight: "major", status: "proposed", end: iso(T0 + DAY) }),
    event({ id: "fresh", kind: "death", weight: "major", status: "proposed", cast: ["y"], end: iso(T0 + 8 * DAY) }),
  ]);
  assert.ok(await runCircleNow("q", REAL0));
  const events = (await readMeanwhile()).events;
  assert.equal(events.find((e) => e.id === "old")!.status, "vetoed");
  assert.equal(events.find((e) => e.id === "fresh")!.status, "proposed");
  // y waits on routine only, x lives on.
  const seeded = events.filter((e) => e.source === "generated" && e.id !== "fresh");
  assert.ok(
    seeded.every((e) => !e.cast.includes("y")),
    "y has an event that waits",
  );
  // Expiry or a second click between read and write: the status is checked again inside the write.
  const veto = (id: string) => () => {
    const stored = [...docs.values()][0];
    stored.data = {
      ...stored.data,
      events: stored.data.events.map((e: LifeEvent) => (e.id === id ? { ...e, status: "vetoed" } : e)),
    };
  };
  await reset(circle(), [event({ id: "big", kind: "death", weight: "major", status: "proposed", hook: undefined })]);
  race = { left: 2, fn: veto("big") };
  const lost = await call("POST", "/circles/:id/events/:eventId/accept", { id: "q", eventId: "big" });
  assert.equal(lost.status, 409);
  assert.equal(await statusOf("big"), "vetoed", "the accept did not bring it back");
  await reset(circle(), [event({ id: "ok" })]);
  race = { left: 2, fn: veto("ok") };
  assert.equal((await edit("ok", "Lily found a ring.")).status, 409);
  assert.equal((await readMeanwhile()).events[0]!.text, "Lily found a coin.");
}

async function promiseCases() {
  let doc: Awaited<ReturnType<typeof readMeanwhile>>;
  chatCount = 1;
  const clock = { anchorCircle: iso(T0 + 2 * DAY + 12 * HOUR), anchorReal: REAL0, speed: 1, timezone: "UTC" };
  const msg = (content: string) => ({
    id: "m1",
    role: "assistant",
    characterId: "x",
    content,
    createdAt: iso(REAL0 - HOUR),
  });
  promiseAnswer = {
    promises: [
      { who: 0, m: 1, text: "Lily sees Mia.", due: "2026-01-06" },
      { who: 7, m: 1, text: "bad" },
    ],
  };

  for (const shared of [false, true]) {
    await reset(circle({ clock, linkedChatIds: ["c1"], sharedWorld: shared }));
    keepMode = true;
    messages = [msg("I'm seeing Mia tomorrow")];
    assert.ok(await runCircleNow("q", REAL0));
    doc = await readMeanwhile();
    assert.equal(promiseCalls, 1);
    assert.equal(doc.promises.length, 1, "the bad entry is dropped");
    const p = doc.promises[0]!;
    assert.equal(p.visibility, shared ? "circle" : "chat:c1");
    assert.deepEqual(p.anchor, { chatId: "c1", messageId: "m1" });
    assert.equal(doc.promisePass.c1, Date.parse(messages[0]!.createdAt));
    // The beat call for the due day gets the line, and the beat that follows keeps the promise.
    assert.ok(beatPrompts.some((t) => t.includes("They said they would:\nP1 (0): Lily sees Mia.")));
    assert.equal(p.status, "kept");
    const built = doc.events.filter((e) => e.anchors?.some((a) => a.messageId === "m1"));
    assert.ok(built.length > 0);
    assert.ok(built.every((e) => e.visibility === p.visibility));
    // Only the beat that names the promise takes its visibility. Other events, also of Mia, stay Circle-wide.
    const others = doc.events.filter((e) => e.source === "generated" && !e.anchors?.length);
    assert.ok(others.length > 0 && others.every((e) => e.visibility === "circle"));
    assert.ok(
      others.some((e) => e.cast.includes("y")),
      "an event of Mia without the promise stays Circle-wide",
    );
    // The promise pass counted as a call and costs nothing when no chat has a newer message.
    const before = promiseCalls;
    await updateMeanwhile((d) => ({
      ...d,
      circles: d.circles.map((c) => ({
        ...c,
        clock: { ...c.clock, anchorCircle: iso(T0 + 3 * DAY + 12 * HOUR) },
        lastRunCircle: iso(T0 + 2 * DAY + 12 * HOUR),
      })),
    }));
    await runCircleNow("q", REAL0);
    assert.equal(promiseCalls, before);

    // The user edits the message: the promise and the events built on it go stale and leave the context.
    messages = [msg("Never mind, I am staying home")];
    await updateMeanwhile((d) => ({
      ...d,
      circles: d.circles.map((c) => ({
        ...c,
        clock: { ...c.clock, anchorCircle: iso(T0 + 4 * DAY + 12 * HOUR) },
        lastRunCircle: iso(T0 + 3 * DAY + 12 * HOUR),
      })),
    }));
    await runCircleNow("q", REAL0);
    doc = await readMeanwhile();
    assert.equal(doc.promises.find((x) => x.id === p.id)!.status, "stale");
    assert.ok(
      doc.events.filter((e) => e.anchors?.some((a) => a.messageId === "m1")).every((e) => e.status === "stale"),
    );
  }

  // A beat that does not name the promise leaves it open, and the next day's prompt lists it again.
  promiseAnswer = { promises: [{ who: 0, m: 1, text: "Lily sees Mia.", due: "2026-01-06" }] };
  await reset(circle({ clock: { ...clock, anchorCircle: iso(T0 + DAY + 12 * HOUR) }, linkedChatIds: ["c1"] }));
  messages = [msg("I'm seeing Mia tomorrow")];
  await runCircleNow("q", REAL0);
  await updateMeanwhile((d) => ({
    ...d,
    circles: d.circles.map((c) => ({
      ...c,
      clock: { ...c.clock, anchorCircle: iso(T0 + 3 * DAY + 12 * HOUR) },
      lastRunCircle: iso(T0 + DAY + 12 * HOUR),
    })),
  }));
  await runCircleNow("q", REAL0);
  doc = await readMeanwhile();
  assert.equal(doc.promises[0]!.status, "open");
  assert.ok(beatPrompts.filter((t) => t.includes("P1 (0): Lily sees Mia.")).length >= 2);
  assert.ok(doc.events.every((e) => !e.anchors?.length));
  promiseAnswer = {
    promises: [
      { who: 0, m: 1, text: "Lily sees Mia.", due: "2026-01-06" },
      { who: 7, m: 1, text: "bad" },
    ],
  };

  // A deleted message is stale as well.
  await reset(circle({ clock, linkedChatIds: ["c1"] }));
  messages = [msg("I'm seeing Mia tomorrow")];
  await runCircleNow("q", REAL0);
  messages = [];
  await updateMeanwhile((d) => ({
    ...d,
    circles: d.circles.map((c) => ({
      ...c,
      clock: { ...c.clock, anchorCircle: iso(T0 + 3 * DAY + 12 * HOUR) },
      lastRunCircle: iso(T0 + 2 * DAY + 12 * HOUR),
    })),
  }));
  await runCircleNow("q", REAL0);
  assert.equal((await readMeanwhile()).promises[0]!.status, "stale", "a deleted message is stale");

  // A promise that no beat honoured is dropped two days after its due day.
  await reset(
    circle({ clock: { ...clock, anchorCircle: iso(T0 + 4 * DAY + 12 * HOUR) }, lastRunCircle: iso(T0 + 3 * DAY) }),
  );
  await updateMeanwhile((d) => ({
    ...d,
    promises: [
      {
        id: "p",
        circleId: "q",
        characterId: "gone", // no beat can honour a character who left the cast
        text: "Someone plans a trip.",
        due: "2026-01-01",
        visibility: "circle",
        anchor: { chatId: "c1", messageId: "m9" },
        hash: "",
        createdAt: T0,
        status: "open",
      },
    ],
  }));
  await runCircleNow("q", REAL0);
  assert.equal((await readMeanwhile()).promises.find((p) => p.id === "p")!.status, "dropped");

  // Home widget: only accepted, Circle-visible, non-spicy, unheard hooks; newest first, at most 3.
  const at = (h: number) => iso(T0 + h * HOUR);
  const hooked = (id: string, h: number, over: Partial<LifeEvent> = {}) =>
    event({ id, start: at(h), end: at(h + 1), createdAt: T0 + h * HOUR, hook: { x: id }, ...over });
  await reset(circle({ name: "Berlin friends" }), [
    hooked("w1", 1, { createdAt: T0 + 10 * HOUR }),
    hooked("w2", 2),
    hooked("w3", 3),
    hooked("w4", 4),
    hooked("spicy", 9, { kind: "spicy" }),
    hooked("proposed", 9, { status: "proposed" }),
    hooked("vetoed", 9, { status: "vetoed" }),
    hooked("stale", 9, { status: "stale" }),
    hooked("chat", 9, { visibility: "chat:c1" }),
    hooked("told", 9, { delivered: { c1: T0 } }),
  ]);
  const shown = (await call("GET", "/widget")).body as any;
  assert.deepEqual(
    shown.hooks.map((h: any) => h.text),
    ["w1", "w4", "w3"],
  );
  assert.equal(shown.hooks[0].circleName, "Berlin friends");
  assert.equal(shown.quiet.length, 0);

  // A Circle with nothing to tell is listed as caught up.
  await reset(circle({ name: "Berlin friends" }), [hooked("spicy", 9, { kind: "spicy" })]);
  const quiet = (await call("GET", "/widget")).body as any;
  assert.equal(quiet.hooks.length, 0);
  assert.equal(quiet.quiet[0].name, "Berlin friends");

  // Phone: one thread per pair, newest thread first. Spicy, proposed, vetoed and chat-only texts stay out.
  const texted = (id: string, h: number, over: Partial<LifeEvent> = {}, to = "y") =>
    event({ id, texts: [{ from: "x", to, time: at(h), text: id }], ...over });
  await reset(circle({ clock: { anchorCircle: at(30), anchorReal: Date.now(), speed: 1, timezone: "UTC" } }), [
    texted("t1", 1),
    texted("t2", 3),
    texted("t3", 2, {}, "z"),
    texted("spicy", 4, { kind: "spicy" }),
    texted("proposed", 5, { status: "proposed" }),
    texted("vetoed", 5, { status: "vetoed" }),
    texted("chat", 5, { visibility: "chat:c1" }),
  ]);
  const phone = (await call("GET", "/circles/:id/phone", { id: "q" })).body as any;
  assert.deepEqual(
    phone.threads.map((t: any) => [t.a, t.b, t.texts.map((m: any) => m.text)]),
    [
      ["x", "y", ["t1", "t2"]],
      ["x", "z", ["t3"]],
    ],
  );
  assert.equal((await call("GET", "/circles/:id/phone", { id: "nope" })).status, 404);
}

main().catch((error) => {
  console.error(error, warnings);
  process.exit(1);
});
