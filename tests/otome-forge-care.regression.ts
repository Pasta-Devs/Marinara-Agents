// Otome Forge's Caring message and Remind Me calendar (M6, server). The care line reaches P27 only when all three debug
// conditions are off (the request's debugMode, DEBUG_AGENTS, a logger writing debug), and each one alone, or a logger
// that cannot say, answers from his comfort pool with no model call; "Keep it off the model" sends no line; the line
// must be exactly one of the protagonist's three templates or the request is a 400 that never quotes it; P27 carries
// the care contract, the comfort rule, the knowledge boundary and his card without darkness, and its checks keep it
// to comfort, and no comfort line that sounds medical stands in for it; a debug switch turned on mid-call stops the
// repair turn; the store is byte-for-byte unchanged after every kind of care note and memory sources never hold it;
// Otome's prompt log shows `[cycle state redacted]`; Otome logs nothing about a care request, its failures included,
// and the route silences the Engine's request lines (a timestamped line would date a cycle day); every response is
// no-store;
// the server's templates are exactly the client's careLines, and its speak request has no cacheKey; the calendar
// reads birthdays, anniversaries in the request's zone (the Love Timeline's firsts, M2b's stages among them, never
// M4's Snapshots or couple sets) and (defensively) banner end dates, labelled with story text.
import assert from "node:assert/strict";
import test from "node:test";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type { CapabilityLanguageModelMessage, CapabilityRuntimeHost } from "@marinara-engine/shared";
import {
  careLine,
  careLines,
  careSpeakOptions,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/cycle.ts";
import { comfortPool } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/tap-mood.ts";
import type { LinesView } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  careLineAllowed,
  checkCareNote,
  poolNote,
  writeCareNote,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/care/care-note.ts";
import {
  allowedCareLines,
  careLineFor,
  careNoteMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/care/prompts.ts";
import { COMFORT_RULE } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/content-contract.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteDeps,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  runDocTarget,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import {
  chatTarget,
  normalizeThread,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts";
import { REDACTED } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompt-log.ts";
import {
  calendarView,
  registerCareRoutes,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/care.ts";
import { readRun } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { passGate } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/stages.ts";
import { createFakeRuntime, type FakeRuntimeOptions } from "./fixtures/otome-forge-fakes.ts";
import { KAI, MIR, SOL, at, json, storyWorld } from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];

/** Kai's comfort lines (P15's fixed pack). Mireille and Sol have none yet. */
const COMFORT = Array.from({ length: 8 }, (_, index) => `Kai comfort line ${index + 1}.`);
const DAY_TWO = "Ines has told you: today is day 2 of her period.";
const WARM = "Sit. I made tea, and the blanket is already warm. Stay as long as you like.";

/** Markers on Kai's bible and state that a care prompt must never carry (his darkness, secrets and hurts). */
const DARK_MARKERS = [
  "ANGER-MARKER",
  "JEALOUSY-MARKER",
  "RED-LINE-MARKER",
  "MORAL-MARKER",
  "DARKNESS-MARKER",
  "GUARDED-MARKER",
  "ANGRY-MARKER",
  "GRIEVANCE-MARKER",
  "HIDDEN-TRUTH",
  "flinches at the bell",
  "polishes clean glass",
];

/**
 * The care routes on a fake router, wrapped in the kit's time zones as server-entry wraps them. `options` holds the
 * Fastify route options a route passes, as the Engine's collector takes them: (path, handler) or (path, options,
 * handler).
 */
function careRoutes(deps: RouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  const options = new Map<string, unknown>();
  const collect =
    (method: "GET" | "POST") =>
    (path: string, ...rest: unknown[]) => {
      routes.set(`${method} ${path}`, rest.at(-1) as RouteHandler);
      if (rest.length > 1) options.set(`${method} ${path}`, rest[0]);
    };
  registerCareRoutes(forgeTimeZoneRoutes({ get: collect("GET"), post: collect("POST") }), deps);
  const call = async (
    method: "GET" | "POST",
    path: string,
    {
      body = {},
      debugMode = false,
      timeZone = "UTC",
      params = {},
    }: { body?: object; debugMode?: unknown; timeZone?: string; params?: Record<string, string> } = {},
  ) => {
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const headers: Record<string, string> = {};
    const reply: OtomeReply & { header(name: string, value: string): unknown } = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
      header(name, value) {
        headers[name.toLowerCase()] = value;
        return reply;
      },
    };
    const fields = debugMode === undefined ? { timeZone } : { timeZone, debugMode };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        params: { run: runKey, ...params },
        query: method === "GET" ? fields : {},
      },
      reply,
    );
    return { status, headers, body: (result === reply ? payload : result) as Record<string, any> };
  };
  return Object.assign(call, { options });
}

/**
 * A forged world (Ines, she/her; Kai, Mireille, Sol) whose Kai has comfort lines, dark markers on his bible and a
 * rupture, with the care routes on a runtime built from `options` (no debug condition by default).
 */
async function careWorld(runKey: string, options: Omit<FakeRuntimeOptions, "documents"> = {}) {
  const t = await storyWorld({
    runKey,
    lis: {
      [KAI]: {
        stage: 2,
        rupture: { grievanceId: "g-1", since: at },
        grievances: [
          {
            id: "g-1",
            li: KAI,
            by: "li",
            text: "GRIEVANCE-MARKER: she lied about the bell.",
            severity: "rupture",
            opened: "main-1/2",
            status: "open",
          },
        ],
      },
    },
  });
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    bible: {
      ...unit.bible!,
      birthday: "03-14",
      redLines: ["RED-LINE-MARKER: never lies to her"],
      moralCode: "MORAL-MARKER",
      darkness: { kinds: ["DARKNESS-MARKER"] },
      voice: {
        register: "Dry and exact",
        tics: ["taps the glass twice"],
        never: ["says sorry first"],
        careLanguage: "Brings tea without asking",
        angerStyle: "ANGER-MARKER",
        jealousyStyle: "JEALOUSY-MARKER",
        samples: { guarded: "GUARDED-MARKER", tender: "Drink this. Slowly.", angry: "ANGRY-MARKER" },
      },
    },
    lines: {
      stages: {},
      fixed: { comfort: COMFORT, claw: { cheer: [], cheat: [], win: [], miss: [], plush: [] }, at },
    },
  }));
  const fake = createFakeRuntime({ documents: t.fake.documents, ...options });
  const deps: RouteDeps = { runtime: fake.runtime, store: t.store, handle: createHandle(fake.runtime.logger) };
  const call = careRoutes(deps, runKey);
  /** Every stored row, revisions and times included. */
  const snapshot = () => JSON.stringify([...t.fake.rows.entries()]);
  const care = (body: object, extra: { debugMode?: unknown } = {}) =>
    call("POST", "/runs/:run/care-note", { body, ...extra });
  return { ...t, ...fake, deps, call, care, snapshot };
}

const userTurn = (messages: Messages) => messages.find((message) => message.role === "user")!.content;
const everything = (messages: Messages) => messages.map((message) => message.content).join("\n");
const occurrences = (text: string, part: string) => text.split(part).length - 1;
/** What the Engine's log writes at its default level (warn) or at info: never Otome's own prompt log (debug). */
const writtenAtDefault = (logs: Array<{ level: string }>) =>
  logs.filter((entry) => entry.level === "info" || entry.level === "warn" || entry.level === "error");

// ── The gate ──

test("careLineAllowed holds only when all three debug conditions are off; each one alone, or a logger that cannot say, keeps the line back", () => {
  const off = createFakeRuntime().runtime;
  assert.equal(careLineAllowed(off, { body: { debugMode: false }, query: {} }), true);
  assert.equal(careLineAllowed(off, { body: {} }), true, "a request that names no debugMode is not in debug mode");

  assert.equal(careLineAllowed(off, { body: { debugMode: true } }), false, "the request's debugMode");
  assert.equal(careLineAllowed(createFakeRuntime({ debugAgents: true }).runtime, { body: {} }), false, "DEBUG_AGENTS");
  assert.equal(
    careLineAllowed(createFakeRuntime({ enabledLevels: ["debug"] }).runtime, { body: {} }),
    false,
    "the debug log level",
  );

  // Fail closed: anything but absent or false is debug mode, wherever it is.
  for (const value of ["true", 1, "false", null]) {
    assert.equal(careLineAllowed(off, { body: { debugMode: value } }), false, `debugMode ${JSON.stringify(value)}`);
  }
  assert.equal(careLineAllowed(off, { body: { debugMode: false }, query: { debugMode: "true" } }), false);
  const { isLevelEnabled: _level, ...levelless } = off.logger;
  assert.equal(careLineAllowed({ ...off, logger: levelless }, { body: {} }), false, "no isLevelEnabled is debug on");
  const throwing: Pick<CapabilityRuntimeHost, "isDebugAgentsEnabled" | "logger"> = {
    logger: off.logger,
    isDebugAgentsEnabled: () => {
      throw new Error("config unavailable");
    },
  };
  assert.equal(careLineAllowed(throwing, { body: {} }), false, "a check that throws is debug on");

  const saved = process.env.DEBUG_AGENTS;
  try {
    process.env.DEBUG_AGENTS = "true";
    assert.equal(careLineAllowed(off, { body: {} }), false, "the environment the kit's logger reads");
  } finally {
    if (saved === undefined) delete process.env.DEBUG_AGENTS;
    else process.env.DEBUG_AGENTS = saved;
  }
});

// ── The care note ──

test("with nothing that could log it, the one line reaches P27 with the care contract, the boundary and his card without darkness", async () => {
  const t = await careWorld("r-care01-aaaaaa", { replies: [json({ note: WARM })] });
  const before = t.snapshot();
  const result = await t.care({ li: KAI, careLine: DAY_TWO });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { note: WARM, source: "model" });
  assert.equal(result.headers["cache-control"], "no-store");
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0]!.options?.debugMode, false, "the provider is told it is not in debug mode");

  const messages = t.calls[0]!.messages;
  const system = messages[0]!.content;
  assert.equal(occurrences(everything(messages), DAY_TWO), 1, "the line appears once, as told");
  assert.ok(userTurn(messages).includes(`TOLD TODAY\n${DAY_TWO}`));
  assert.ok(system.includes(COMFORT_RULE), "the comfort rule");
  assert.ok(system.includes(forgeKnowledgeBoundary), "the knowledge boundary, verbatim");
  assert.ok(system.includes("CONTENT CONTRACT") && system.includes("Heat: SFW"), "the care contract");
  assert.ok(userTurn(messages).includes("Care: Brings tea without asking."), "how he cares");
  assert.ok(userTurn(messages).includes("How Kai sounds when tender: Drink this. Slowly."));
  for (const marker of DARK_MARKERS) assert.ok(!everything(messages).includes(marker), `no ${marker}`);
  assert.ok(!/\bperiod\b/.test(everything(messages).replace(DAY_TWO, "")), "nothing else about the cycle");

  assert.equal(t.snapshot(), before, "nothing is written");
  assert.ok(!JSON.stringify(t.logs).includes(DAY_TWO), "no log carries the line");
  assert.ok(!JSON.stringify(t.logs).includes(WARM), "no log carries the note");
});

const DEBUG_CONDITIONS: Array<{
  condition: string;
  options: Omit<FakeRuntimeOptions, "documents">;
  debugMode: boolean;
}> = [
  { condition: "the request's debugMode", options: {}, debugMode: true },
  { condition: "DEBUG_AGENTS", options: { debugAgents: true }, debugMode: false },
  { condition: "the debug log level", options: { enabledLevels: ["debug"] }, debugMode: false },
];
for (const [index, { condition, options, debugMode }] of DEBUG_CONDITIONS.entries()) {
  test(`${condition} alone keeps the line back: his comfort pool answers with no model call`, async () => {
    const t = await careWorld(`r-care02-aaaaa${index}`, { ...options, replies: [json({ note: WARM })] });
    const before = t.snapshot();
    const result = await t.care({ li: KAI, careLine: DAY_TWO }, { debugMode });
    assert.equal(result.status, 200);
    assert.equal(result.body.source, "pool");
    assert.ok(COMFORT.includes(result.body.note), "one of his own comfort lines");
    assert.equal(result.headers["cache-control"], "no-store");
    assert.equal(t.calls.length, 0, "the line is never sent");
    assert.ok(!JSON.stringify(t.logs).includes(DAY_TWO), "nor logged");
    assert.equal(t.snapshot(), before, "nothing is written");
  });
}

test("Keep it off the model sends no line, and a love interest without comfort lines yet leaves the catalog's to the client", async () => {
  const t = await careWorld("r-care03-aaaaaa");
  const before = t.snapshot();
  const kai = await t.care({ li: KAI });
  assert.equal(kai.status, 200);
  assert.equal(kai.body.source, "pool");
  assert.ok(COMFORT.includes(kai.body.note));
  const nullLine = await t.care({ li: KAI, careLine: null });
  assert.equal(nullLine.body.source, "pool", "a null line is no line");

  for (const li of [MIR, SOL]) {
    assert.deepEqual((await t.care({ li })).body, { note: null, source: "pool" });
    assert.deepEqual((await t.care({ li }, { debugMode: true })).body, { note: null, source: "pool" });
  }
  assert.equal(t.calls.length, 0);
  assert.equal(t.snapshot(), before, "no comfort pack is queued or written from here");
});

test("a debug switch turned on while the request waited in the run's queue keeps the line back", async () => {
  const t = await careWorld("r-care04-aaaaaa", { replies: [json({ note: WARM })] });
  let checks = 0;
  const level = t.runtime.logger.isLevelEnabled!;
  // On arrival the debug level is off; by the time the queue reaches the request, it is on.
  t.runtime.logger.isLevelEnabled = (name) => (name === "debug" ? checks++ > 0 : level(name));
  const result = await t.care({ li: KAI, careLine: DAY_TWO });
  assert.equal(result.body.source, "pool");
  assert.equal(t.calls.length, 0);
  assert.equal(checks, 2, "checked on arrival and again in the queue");
});

test("the store is byte-for-byte unchanged after every kind of care note, and memory sources never hold it", async () => {
  const t = await careWorld("r-care05-aaaaaa", {
    replies: [
      json({ note: WARM }),
      "I can't help with that.",
      "I cannot write that.",
      new Error(`upstream said: ${DAY_TWO}`),
      json({ note: WARM }),
    ],
  });
  // A phone session Kai remembers (M3's chat source): the memory a care note could leak into, were it ever written.
  await t.store.mutateDoc(chatTarget(t.runId, KAI), normalizeThread, (thread) => ({
    ...thread,
    li: KAI,
    messages: [
      { id: "m-care-1", who: "player", text: "Long day.", at: "2026-10-27T09:00:00.000Z" },
      { id: "m-care-2", who: "li", text: "Then sit.", at: "2026-10-27T09:01:00.000Z" },
    ],
    sessions: [
      {
        start: 0,
        count: 2,
        memory: { text: "They talked by the lamp.", quote: "Then sit." },
        closedAt: at,
        name: "Kai",
      },
    ],
  }));
  const sources = JSON.stringify(await readMemorySources(t.store, t.runId));
  assert.ok(sources.includes("They talked by the lamp."), "the phone session is a memory source");
  const before = t.snapshot();
  const rows = t.fake.rows.size;
  const results = [
    await t.care({ li: KAI, careLine: DAY_TWO }), // P27
    await t.care({ li: KAI, careLine: DAY_TWO }), // P27 declines twice: the pool
    await t.care({ li: KAI, careLine: DAY_TWO }), // the provider fails: the pool
    await t.care({ li: KAI, careLine: DAY_TWO }, { debugMode: true }), // debug: the pool
    await t.care({ li: KAI }), // Keep it off the model
    await t.care({ li: MIR, careLine: DAY_TWO }), // P27 for a love interest with no comfort lines yet
    await t.care({ li: MIR }), // and his catalog fallback
  ];
  assert.deepEqual(
    results.map((result) => [result.status, result.body.source]),
    [
      [200, "model"],
      [200, "pool"],
      [200, "pool"],
      [200, "pool"],
      [200, "pool"],
      [200, "model"],
      [200, "pool"],
    ],
  );
  assert.equal(t.calls.length, 5, "P27 twice, the decline and its repair turn, the failed call");
  assert.equal(t.snapshot(), before, "no document changed, and none was created");
  assert.equal(t.fake.rows.size, rows);
  const after = JSON.stringify(await readMemorySources(t.store, t.runId));
  assert.equal(after, sources);
  assert.ok(!after.includes(DAY_TWO) && !after.includes(WARM), "memory never holds the line or the note");
});

test("Otome's prompt log shows [cycle state redacted] instead of the line, the repair turn's too, while the provider receives it", async () => {
  // Called directly with the debug level on, as if it changed mid-call: the route never sends the line then.
  const t = await careWorld("r-care06-aaaaaa", { enabledLevels: ["debug"] });
  t.replies.push(json({ note: "word ".repeat(50).trim() }), json({ note: WARM }));
  const run = (await readRun(t.store, t.runId))!;
  const unit = run.units.find((entry) => entry.id === KAI)!;
  const note = await writeCareNote(t.deps, {
    runId: t.runId,
    world: run.world,
    player: run.player,
    unit,
    careLine: DAY_TWO,
  });
  assert.equal(note, WARM);
  const prompts = t.logs.filter((entry) => entry.message.includes("Messages sent to the provider"));
  assert.deepEqual(
    prompts.map((entry) => entry.args[0]),
    ["care-note", "care-note/repair"],
  );
  for (const entry of prompts) {
    assert.equal(entry.override, false, "never logged as a debug override");
    assert.ok(String(entry.args[1]).includes(REDACTED), "the log shows the redaction");
    assert.ok(!String(entry.args[1]).includes(DAY_TWO), "and never the line");
  }
  assert.ok(
    t.calls.every((entry) => everything(entry.messages).includes(DAY_TWO)),
    "the provider still gets it",
  );
  assert.ok(String(prompts[1]!.args[1]).includes("40 words or fewer"), "the repair names the problem, not the line");
});

test("the care line must be exactly one of the protagonist's templates: free text is a 400 that never quotes it", async () => {
  const t = await careWorld("r-care07-aaaaaa", { replies: Array.from({ length: 12 }, () => json({ note: WARM })) });
  const player = { name: "Ines", pronouns: { subject: "she", object: "her", possessive: "her" } };
  const accepted = [
    ...Array.from({ length: 8 }, (_, index) => `Ines has told you: today is day ${index + 1} of her period.`),
    "Ines has told you: her period is due in 1 day.",
    "Ines has told you: her period is due in 2 days.",
    "Ines has told you: her period is due in 3 days.",
    "Ines has told you: her period is due around today.",
  ];
  assert.deepEqual([...allowedCareLines(player)].sort(), [...accepted].sort());
  assert.equal(careLineFor(player, { kind: "day", n: 2 }), DAY_TWO);
  assert.equal(
    careLineFor(
      { name: "  ", pronouns: { subject: "they", object: "them", possessive: "their" } },
      { kind: "due-today" },
    ),
    "The protagonist has told you: their period is due around today.",
    "an unnamed protagonist and the default pronoun",
  );

  const rejected = [
    "Ines has told you: I feel awful today and my cramps are bad.",
    "Ines has told you: today is day 9 of her period.",
    "Ines has told you: today is day 0 of her period.",
    "Ines has told you: her period is due in 4 days.",
    "Ines has told you: her period is due in 1 days.",
    "Ines has told you: her period is late.",
    "Ines has told you: today is day 2 of their period.",
    "Mira has told you: today is day 2 of her period.",
    `${DAY_TWO} `,
    ` ${DAY_TWO}`,
    `${DAY_TWO}\nAlso, she was late last month.`,
    "",
  ];
  const before = t.snapshot();
  for (const careLine of rejected) {
    for (const debugMode of [false, true]) {
      const result = await t.care({ li: KAI, careLine }, { debugMode });
      assert.equal(result.status, 400, JSON.stringify(careLine));
      assert.equal(result.body.code, "bad-request");
      assert.equal(result.headers["cache-control"], "no-store", "errors are no-store too");
      const said = JSON.stringify(result.body);
      assert.ok(!said.includes("has told you") && !said.includes("period"), "the error never quotes the line");
    }
  }
  for (const careLine of [42, { text: DAY_TWO }, "x".repeat(301)]) {
    const result = await t.care({ li: KAI, careLine });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "bad-request");
    const said = JSON.stringify(result.body);
    assert.ok(!said.includes("xxxxxxxxxx") && !said.includes("has told you"), "the body is not echoed");
  }
  assert.equal(t.calls.length, 0, "nothing rejected reaches the model");
  assert.deepEqual(
    t.logs.filter((entry) => entry.level === "error"),
    [],
  );

  for (const careLine of accepted) {
    const result = await t.care({ li: KAI, careLine });
    assert.deepEqual([result.status, result.body.source], [200, "model"], careLine);
  }
  assert.equal(t.calls.length, accepted.length);
  assert.equal(t.snapshot(), before);
});

test("his comfort pool stands in when P27 declines, fails or cannot be reached, and nothing is logged about it", async () => {
  const t = await careWorld("r-care08-aaaaaa", {
    replies: [
      "I can't help with that.",
      "I cannot write that.",
      new Error(`provider rejected messages: ${DAY_TWO}`),
      "not json",
      "still not json",
    ],
  });
  const declined = await t.care({ li: KAI, careLine: DAY_TWO });
  const failed = await t.care({ li: KAI, careLine: DAY_TWO });
  const badFormat = await t.care({ li: KAI, careLine: DAY_TWO });
  for (const result of [declined, failed, badFormat]) {
    assert.equal(result.status, 200);
    assert.equal(result.body.source, "pool");
    assert.ok(COMFORT.includes(result.body.note));
  }
  // The button shows only on a day the tracker marks: a timestamped line, even one naming only the code, would date it.
  assert.deepEqual(writtenAtDefault(t.logs), []);
  assert.ok(!JSON.stringify(t.logs).includes(DAY_TWO), "no log line carries the request body");

  // No connection for the chat job: the pool, not a 503.
  await t.store.mutateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    connections: { narration: "" },
  }));
  const offline = await t.care({ li: KAI, careLine: DAY_TWO });
  assert.equal(offline.body.source, "pool");
  assert.deepEqual(writtenAtDefault(t.logs), []);
});

test("a debug switch turned on while P27 is out keeps the line from its repair turn", async () => {
  let debugAgents = false;
  const t = await careWorld("r-care12-aaaaaa", {
    replies: [
      () => {
        // .env edited to DEBUG_AGENTS=true mid-call: the Engine's env watcher applies it live.
        debugAgents = true;
        return json({ note: "word ".repeat(60).trim() });
      },
      json({ note: WARM }),
    ],
  });
  t.runtime.isDebugAgentsEnabled = () => debugAgents;
  const result = await t.care({ li: KAI, careLine: DAY_TWO });
  assert.deepEqual([result.status, result.body.source], [200, "pool"]);
  assert.ok(COMFORT.includes(result.body.note));
  assert.equal(t.calls.length, 1, "no repair turn once a debug condition holds");
  assert.deepEqual(writtenAtDefault(t.logs), []);
});

test("a comfort line that prescribes or diagnoses never stands in as care, on the server or in the browser", () => {
  const medical = ["Take a painkiller and lie down, I'll stay.", "Cramps pass. Sleep now."];
  const kind = ["Stay here. I've got you.", "Tea first, then nothing at all."];
  const unit = (comfort: string[]) => ({
    lines: { stages: {}, fixed: { comfort, claw: { cheer: [], cheat: [], win: [], miss: [], plush: [] }, at } },
  });
  for (let round = 0; round < 40; round += 1) assert.ok(kind.includes(poolNote(unit([...medical, ...kind]))!));
  assert.equal(poolNote(unit(medical)), null, "none left: the client shows a catalog comfort line");
  const lines = (comfort: string[]) => ({ comfort }) as unknown as LinesView;
  assert.deepEqual(comfortPool(lines([...medical, ...kind])), kind, "Rough day? and the kept-off Caring message");
  assert.deepEqual(comfortPool(lines(medical)), []);
});

test("an unexpected failure of a care request is a plain 500 that is never logged, not even its path", async () => {
  const t = await careWorld("r-care13-aaaaaa", { replies: [json({ note: WARM })] });
  const broken = Object.assign(Object.create(t.store) as typeof t.store, {
    readDoc: async () => {
      throw new Error("the disk is full");
    },
  });
  const call = careRoutes({ ...t.deps, store: broken }, "r-care13-aaaaaa");
  const result = await call("POST", "/runs/:run/care-note", { body: { li: KAI, careLine: DAY_TWO } });
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: "Otome Forge could not complete the request." });
  assert.equal(result.headers["cache-control"], "no-store");
  assert.deepEqual(t.logs, [], "createHandle would log the care-note path; the route keeps it out of the log");
  assert.deepEqual(writtenAtDefault(t.logs), []);
  assert.equal(t.calls.length, 0);
  // Nor does the Engine write its request lines (incoming request, request completed) for it, at any level: the
  // route asks Fastify for silence. The calendar, which says nothing about the cycle, is logged as any route is.
  assert.deepEqual(Object.fromEntries(call.options), { "POST /runs/:run/care-note": { logLevel: "silent" } });
});

test("the server accepts exactly the lines the client's careLine can give, for any protagonist", () => {
  for (const player of [
    { name: "Ines", pronouns: { subject: "she", object: "her", possessive: "her" } },
    { name: "", pronouns: { subject: "they", object: "them", possessive: "their" } },
    { name: " Ren ", pronouns: { subject: "he", object: "him", possessive: "his" } },
    { name: "Аня", pronouns: { subject: "xe", object: "xem", possessive: "  " } },
  ]) {
    assert.deepEqual([...allowedCareLines(player)].sort(), careLines(player).sort(), player.name);
    assert.equal(careLineFor(player, { kind: "due", inDays: 2 }), careLine({ kind: "due", inDays: 2 }, player));
  }
});

test("the client's speak request for a caring message carries no cacheKey, so the Engine never caches its audio", () => {
  // OtomeAudioController.speak (M2b) adds a cacheKey only while `cache` is on; the e2e spec checks the request itself.
  assert.deepEqual(careSpeakOptions(), { cache: false });
});

test("P27's checks keep the note to comfort: short, no question, nothing about absence, nothing medical", () => {
  assert.deepEqual(checkCareNote({ note: `  “${WARM}”  ` }), { note: WARM });
  assert.match(String(checkCareNote({ note: "word ".repeat(41) })), /40 words or fewer/);
  assert.match(String(checkCareNote({ note: "One. Two. Three. Four." })), /3 sentences/);
  assert.match(String(checkCareNote({ note: "Do you want tea?" })), /question/);
  assert.match(String(checkCareNote({ note: "Welcome back. Rest here." })), /away/);
  for (const note of [
    "Take two ibuprofen and rest.",
    "I brought painkillers and tea.",
    "Have you thought you might be pregnant.",
    "Doctor's orders: stay in bed.",
    "A hot water bottle helps the cramps.",
    "Take 400 mg with food.",
  ]) {
    assert.match(String(checkCareNote({ note })), /comfort only/, note);
  }
  assert.equal(checkCareNote({ note: "   " }), "note is empty");
});

test("P27 stays SFW and warm under explicit Heat and Dark romance, and its system turn never names the line", async () => {
  const t = await careWorld("r-care09-aaaaaa");
  const run = (await readRun(t.store, t.runId))!;
  const unit = run.units.find((entry) => entry.id === KAI)!;
  const messages = careNoteMessages({
    world: { ...run.world, content: { ...defaultContent(), heat: "explicit", darkness: "dark" } },
    player: run.player,
    unit,
    careLine: DAY_TWO,
  });
  const system = messages[0]!.content;
  assert.ok(system.includes("Heat: SFW"));
  assert.ok(!system.includes("explicit") && !system.includes("Dark romance"), "Heat and Darkness never apply");
  assert.ok(system.includes("Warmth only"));
  assert.ok(!system.includes(DAY_TWO), "the line is only in the user turn");
  assert.ok(userTurn(messages).trimEnd().endsWith("Keep to the CONTENT CONTRACT above, silently."));
});

test("404s for an unknown run or love interest, no-store and without the body", async () => {
  const t = await careWorld("r-care10-aaaaaa");
  for (const [body, params] of [
    [{ li: "li-nobody-zz99", careLine: DAY_TWO }, {}],
    [{ li: "not an id", careLine: DAY_TWO }, {}],
    [{ li: KAI, careLine: DAY_TWO }, { run: "r-nope00-zzzzzz" }],
    [{ li: KAI, careLine: DAY_TWO }, { run: "../index" }],
  ] as const) {
    const result = await t.call("POST", "/runs/:run/care-note", { body, params });
    assert.equal(result.status, 404, JSON.stringify(body));
    assert.equal(result.body.code, "not-found");
    assert.equal(result.headers["cache-control"], "no-store");
    assert.ok(!JSON.stringify(result.body).includes("period"));
  }
  assert.equal(t.calls.length, 0);
});

// ── The calendar ──

test("a stage M2b's gate moves dates a Love Timeline first, and the calendar shows it on that day every year", async () => {
  const t = await careWorld("r-care13-aaaaaa");
  const run = (await readRun(t.store, t.runId))!;
  run.state.lis[KAI]!.stage = 1;
  const gate = { kind: "beat" as const, guide: "The gate.", cast: [KAI], gate: true };
  const { state, stageUp } = passGate(
    run.state,
    { key: `route-${KAI}-2`, kind: "route", li: KAI, stage: 2, title: "The Lamp at Midnight", nodes: [gate] },
    0,
    { secrets: [], at: "2026-11-03T22:30:00.000Z" },
  );
  assert.deepEqual(stageUp, { li: KAI, stage: 2 });
  const view = calendarView({ ...run, state }, [], "2026-10-28");
  assert.deepEqual(view.anniversaries.at(-1), { md: "11-03", label: "The Lamp at Midnight", li: KAI, year: 2026 });
});

test("the calendar lists birthdays in cast order and the story's first day on the request's own local day", async () => {
  const t = await careWorld("r-care11-aaaaaa");
  // 23:30 UTC is already the next day in Tokyo.
  await t.store.mutateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    createdAt: "2026-10-28T23:30:00.000Z",
  }));
  const utc = await t.call("GET", "/runs/:run/calendar", { timeZone: "UTC" });
  assert.equal(utc.status, 200);
  assert.deepEqual(utc.body, {
    birthdays: [
      { li: KAI, md: "03-14" },
      { li: MIR, md: "01-01" },
      { li: SOL, md: "01-01" },
    ],
    anniversaries: [{ md: "10-28", label: "The Lantern Court", year: 2026 }],
    bannerEnds: [],
  });
  const tokyo = await t.call("GET", "/runs/:run/calendar", { timeZone: "Asia/Tokyo" });
  assert.deepEqual(tokyo.body.anniversaries, [{ md: "10-29", label: "The Lantern Court", year: 2026 }]);
  const missing = await t.call("GET", "/runs/:run/calendar", { params: { run: "r-nope00-zzzzzz" } });
  assert.equal(missing.status, 404);
});

test("the calendar labels Love Timeline firsts and M4's banners from story text, and skips a bad row rather than fail", async () => {
  const t = await careWorld("r-care12-aaaaaa");
  const run = (await readRun(t.store, t.runId))!;
  // The Love Timeline's firsts, each on its own day; an entry with no real time, or for someone no longer in the
  // cast, is left out. So are the things won (M4's Snapshots and couple sets, written as wish/pull.ts and
  // items/open.ts write them): a ten-pull's vignettes would otherwise fill Coming up on that day every year.
  const vignette = (n: number) =>
    `Snapshot ${n}: he leaves the umbrella by your door without a word. It is still warm from his hand.`;
  run.state.timeline = [
    { at: "2026-11-02T23:30:00.000Z", li: KAI, kind: "first-kiss", text: "  The first kiss,\n at the lamp.  " },
    { at: "not a time", li: KAI, kind: "first-date", text: "A date with no day." },
    { at: "2026-11-05T10:00:00.000Z", li: "li-gone-zz99", kind: "first-call", text: "Someone long gone." },
    ...[1, 2, 3, 4, 5].map((n) => ({
      at: "2026-11-02T12:00:00.000Z",
      li: KAI,
      kind: "snapshot",
      text: vignette(n),
      ref: `memories-0-s${n}`,
    })),
    {
      at: "2026-11-02T12:00:00.000Z",
      li: KAI,
      kind: "couple",
      text: "Night Court Coat · Lantern Dress",
      ref: "couple:his-wardrobe-0-f+my-wardrobe-0-f",
    },
  ];
  run.units.find((unit) => unit.id === SOL)!.bible!.birthday = "13-40";
  const banners = [
    { key: "memories-0", kind: "memories", endsDay: "2026-11-10", featuredLi: KAI },
    { key: "my-wardrobe-0", kind: "my-wardrobe", endsDay: "2026-11-10", featuredLi: KAI },
    { key: "his-wardrobe-0", kind: "his-wardrobe", endsDay: "2026-10-28", featuredLi: MIR },
    { key: "his-wardrobe-x", kind: "his-wardrobe", endsDay: "2026-10-28", featuredLi: "li-gone-zz99" },
    { key: "memories-old", kind: "memories", endsDay: "2026-10-01", featuredLi: MIR },
    { key: "no-day", kind: "my-wardrobe", endsDay: "soon", featuredLi: KAI },
    null,
    "garbage",
  ];
  const view = calendarView(run, banners, "2026-10-28");
  assert.deepEqual(view.birthdays, [
    { li: KAI, md: "03-14" },
    { li: MIR, md: "01-01" },
  ]);
  assert.deepEqual(view.anniversaries, [
    { md: "10-28", label: "The Lantern Court", year: 2026 },
    { md: "11-02", label: "The first kiss, at the lamp.", li: KAI, year: 2026 },
  ]);
  assert.deepEqual(view.bannerEnds, [
    { day: "2026-10-28", banner: "Mireille" },
    { day: "2026-11-10", banner: "Kai" },
  ]);
  run.world.title = "   ";
  assert.deepEqual(
    calendarView(run, [], "2026-10-28").anniversaries.map((row) => row.label),
    ["The first kiss, at the lamp."],
    "an untitled world has no label for its first day",
  );

  // Through the route: a stored banner of any shape never breaks the calendar.
  for (const [key, data] of [
    ["memories-9", { key: "memories-9", kind: "memories", endsDay: "2999-01-01", featuredLi: KAI }],
    ["memories-1", { key: "memories-1", kind: "memories", endsDay: "2000-01-01", featuredLi: KAI }],
    ["broken-1", { endsDay: 12 }],
  ] as const) {
    await t.store.mutateDoc(
      { id: `${t.runId}:banner:${key}`, kind: "banner", name: "Otome Forge banner" },
      (value: unknown) => value,
      () => data,
    );
  }
  const routed = await t.call("GET", "/runs/:run/calendar");
  assert.equal(routed.status, 200);
  assert.deepEqual(routed.body.bannerEnds, [{ day: "2999-01-01", banner: "Kai" }]);
});
