// Otome Hearth's group chat (#2154): one thread with every love interest met. Who is in it (the starting cast once a
// chapter is read; a newcomer, a returning one too, only once their arc's first chapter is read; nobody else, ever, in
// its prompt, contract or sessions), its stored speaker and members as display fields, a send that lands once and is
// always answered whatever the squabble setting (the same id again, busy, Retry, only the protagonist's stickers),
// P17g's parser (a member the newest message names must answer), its content (plural rules, the knowledge line, each
// member's card and what stands between them as the whole cast may know it, ties without secrets, recall as the group:
// no DM, notebook, date, Read Him or Claw round, and no love interest's own chapter in full or what it left) and its
// cache layout, squabbles on the daily-message heartbeat's rule (off by default,
// armed, spent before work, skipped while open, busy or waiting, checked again when the job starts, background on the
// chat connection, landing unread, daily messages untouched), Close and remember for everyone in it (P18g, members,
// no affection) recalled only by its members, the settings, the list and Home's unread count.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type {
  Beat,
  Chapter,
  ClawRound,
  PhoneMessage,
  PhoneSession,
  StoryArc,
  World,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { GROUP_THREAD } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/home.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteDeps,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  arcId,
  beatId,
  chapterId,
  chatId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  createOtomeMemory,
  type OtomeMemory,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import {
  archivedCount,
  chatTarget,
  inThreadLock,
  normalizeThread,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts";
import {
  groupDue,
  groupJobKey,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/group.ts";
import { phoneMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/memory.ts";
import { normalizeGroupReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/replies.ts";
import { renderThread } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { registerHomeRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/home.ts";
import { registerPhoneRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/phone.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import {
  normalizeWorld,
  toWorldView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import type { FakeReply } from "./fixtures/otome-forge-fakes.ts";
import { HE, KAI, MIR, SOL, at, bible, json, storyWorld } from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];
const system = (messages: Messages) =>
  messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
const isGroupPrompt = (messages: Messages) => system(messages).startsWith("This is the group chat of an otome");
const isGroupMemory = (messages: Messages) => system(messages).startsWith("A group chat between");
const isDmPrompt = (messages: Messages) => system(messages).includes("in your private message thread");
const isDmMemory = (messages: Messages) => system(messages).includes("have just finished exchanging messages");
const isSquabble = (messages: Messages) => messages.at(-1)!.content.includes("start squabbling");

/** A newcomer, written after the world (so not one of the starting cast). */
const NEW = "li-noor-ab99";

const REPLY = {
  messages: [
    { speaker: "Kai", text: "Kai: Awake. Unfortunately. [ines_laugh]" },
    { speaker: "mireille", text: "Some of us were never asleep." },
    { speaker: "Kai", text: "[laugh_ines]" },
  ],
};
const SQUABBLE = {
  messages: [
    { speaker: "Sol", text: "Who left the north lamp burning?" },
    { speaker: "Kai", text: "Who asked you to count lamps?" },
    { speaker: "Sol", text: "Somebody has to." },
  ],
};
const MEMORY = { memory: "Kai and Mireille teased Ines about staying up.", quote: "Kai: Awake. Unfortunately." };
const DM_REPLY = { messages: [{ text: "Hm." }] };
const DM_MEMORY = { memory: "They spoke briefly.", quote: "" };

/** Answers the group's and the DM's prompts as often as asked, and the kit's summarizer; anything else fails. */
function model(reply: unknown = REPLY, squabble: unknown = SQUABBLE): FakeReply[] {
  return Array.from({ length: 60 }, () => (messages: Messages) => {
    if (isGroupPrompt(messages)) return json(isSquabble(messages) ? squabble : reply);
    if (isGroupMemory(messages)) return json(MEMORY);
    if (isDmPrompt(messages)) return json(DM_REPLY);
    if (isDmMemory(messages)) return json(DM_MEMORY);
    const input = JSON.parse(messages.at(-1)!.content);
    if (input.source) return json({ summary: `${input.source.title}: ${input.source.content}` });
    if (input.records) return json({ summary: input.records.map((r: { content: string }) => r.content).join(" ") });
    throw new Error(`Unexpected prompt: ${system(messages).slice(0, 80)}`);
  });
}

/** The phone, run and Home routes on a fake router wrapped in the kit's time zones; `call` answers like Fastify. */
function routes(deps: RouteDeps, runKey: string) {
  const table = new Map<string, RouteHandler>();
  const router = forgeTimeZoneRoutes({
    get: (path: string, handler: RouteHandler) => void table.set(`GET ${path}`, handler),
    post: (path: string, handler: RouteHandler) => void table.set(`POST ${path}`, handler),
  });
  for (const register of [registerPhoneRoutes, registerRunRoutes, registerHomeRoutes]) register(router, deps as never);
  return async (method: "GET" | "POST", path: string, { body = {}, li }: { body?: object; li?: string } = {}) => {
    const handler = table.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const fields = { timeZone: "UTC", debugMode: true, ...body };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? fields : undefined,
        query: method === "GET" ? fields : {},
        params: { run: runKey, ...(li ? { li } : {}) },
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

/** Holds every background admission until `open()` (the job waits as it would for the Engine's slot). */
function admissionGate() {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => (open = resolve));
  return {
    open: () => open(),
    admissionRun: async <T>(operation: () => Promise<T>) => {
      await gate;
      return operation();
    },
  };
}

/**
 * The story fixture's three love interests met (main-1 read), the phone routes, a background lane, a chat connection of
 * its own, and with `newcomer` a fourth love interest, Noor, written after the world. `withMemory` recalls the phone's
 * sources, or with "all" every source of the run (S/memory/sources.ts).
 */
async function groupWorld(
  runKey: string,
  {
    replies = model(),
    met = true,
    newcomer = false,
    withMemory = false,
    admissionRun,
  }: {
    replies?: FakeReply[];
    met?: boolean;
    newcomer?: boolean;
    withMemory?: boolean | "all";
    admissionRun?: <T>(operation: () => Promise<T>, mode: { kind: string }) => Promise<T>;
  } = {},
) {
  const t = await storyWorld({ runKey, replies, model: admissionRun ? { admissionRun } : {} });
  if (newcomer) {
    await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, NEW)), normalizeUnit, (unit) => ({
      ...unit,
      id: NEW,
      name: "Noor",
      pronouns: HE,
      bible: bible(),
      createdAt: "2026-11-01T12:00:00.000Z",
    }));
  }
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: newcomer ? { ...state.lis, [NEW]: { ...state.lis[KAI]! } } : state.lis,
    chapters: met ? { "main-1": { beatsRead: 7, completed: "2026-11-01T20:00:00.000Z", applied: [] } } : {},
  }));
  await t.store.mutateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    connections: { narration: "conn-text", chat: "conn-chat" },
  }));
  let memory: OtomeMemory | undefined;
  if (withMemory) {
    memory = createOtomeMemory({
      runtime: t.runtime,
      store: t.store,
      readSources: async (runId) =>
        withMemory === "all"
          ? readMemorySources(t.store, runId)
          : phoneMemorySources(t.store, runId, (await t.state())!),
    });
  }
  const background = createBackgroundQueue(t.runtime);
  const deps = { ...t.deps, background, handle: createHandle(t.runtime.logger), ...(memory ? { memory } : {}) };
  const call = routes(deps, runKey);
  const thread = () => t.store.readDoc(chatId(t.runId, GROUP_THREAD), normalizeThread);
  const groupCalls = () => t.calls.filter((entry) => isGroupPrompt(entry.messages));
  const complete = (key: string) =>
    t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
      ...state,
      chapters: { ...state.chapters, [key]: { beatsRead: 7, completed: "2026-11-02T20:00:00.000Z", applied: [] } },
    }));
  const arc = (number: number, from: number, li: string | null) =>
    t.store.mutateDoc(
      runDocTarget("arc", arcId(t.runId, number)),
      (data) => data as Partial<StoryArc>,
      () => ({
        version: 1,
        number,
        kind: "story",
        from,
        plan: Array.from({ length: 8 }, (_, index) => ({ n: from + index, purpose: "A chapter." })),
        newcomer: li ? { li, how: "arrives" } : null,
      }),
    );
  const world = async () => (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  const setWorld = (change: Partial<World>) =>
    t.store.mutateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (current) => ({
      ...current,
      ...change,
    }));
  return { ...t, deps, background, memory, call, thread, groupCalls, complete, arc, world, setWorld };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const list = "/runs/:run/phone";
const page = "/runs/:run/phone/group";
const send = "/runs/:run/phone/group/send";
const close = "/runs/:run/phone/group/close";
const seen = "/runs/:run/phone/group/seen";
const due = "/runs/:run/phone/due";

// ── Who is in it ──

test("the group opens once two are met: the starting cast after chapter 1, a newcomer only after their arc's first chapter", async () => {
  const t = await groupWorld("r-group01-aaaaaa", { met: false, newcomer: true });
  // Nobody is met before a chapter is read: no group, and its routes are a 409.
  assert.equal((await t.call("GET", list)).body.group, null);
  for (const [method, path] of [
    ["GET", page],
    ["POST", send],
    ["POST", close],
    ["POST", seen],
  ] as const) {
    const refused = await t.call(method, path, { body: { text: "Hello?" } });
    assert.deepEqual([refused.status, refused.body.code], [409, "conflict"], path);
  }
  // An unknown thread is still a 404 (the love interest routes).
  assert.equal((await t.call("GET", "/runs/:run/phone/:li", { li: "nobody" })).status, 404);

  await t.complete("main-1");
  // Noor is in the cast with a bible (her arc is being planned) but no arc names her yet.
  let view = await t.call("GET", list);
  assert.deepEqual(view.body.group, { members: [KAI, MIR, SOL], last: null, unread: 0, busy: false });
  // Her arc starts at chapter 2: she is not in it until that chapter is read.
  await t.arc(2, 2, NEW);
  assert.deepEqual((await t.call("GET", list)).body.group.members, [KAI, MIR, SOL]);
  // A non-member never reaches the prompt, its contract or a session.
  assert.equal((await t.call("POST", send, { body: { text: "Hello, everyone." } })).status, 200);
  const before = JSON.stringify(t.groupCalls()[0]!.messages);
  assert.ok(before.includes("Mireille") && !before.includes("Noor"), "Noor is in no part of the prompt");
  await t.complete("main-2");
  view = await t.call("GET", list);
  assert.deepEqual(view.body.group.members, [KAI, MIR, SOL, NEW]);
  assert.deepEqual((await t.call("GET", page)).body.members, [KAI, MIR, SOL, NEW]);
});

test("a returning newcomer keeps their old unit, and is in the group only once their new arc's first chapter is read", async () => {
  const t = await groupWorld("r-group02-aaaaaa", { newcomer: true });
  // Taken back from an arrival that failed long ago: an old createdAt, two arcs played since, none naming them.
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, NEW)), normalizeUnit, (unit) => ({
    ...unit,
    createdAt: "2026-10-01T00:00:00.000Z",
  }));
  await t.arc(1, 1, null);
  await t.complete("main-2");
  assert.deepEqual((await t.call("GET", list)).body.group.members, [KAI, MIR, SOL], "planning their arc");
  await t.arc(2, 9, NEW);
  assert.deepEqual((await t.call("GET", list)).body.group.members, [KAI, MIR, SOL]);
  await t.complete("main-9");
  assert.deepEqual((await t.call("GET", list)).body.group.members, [KAI, MIR, SOL, NEW]);
});

test("a malformed speaker or members field is dropped alone: the message and the session stay where they were", () => {
  const thread = normalizeThread({
    li: GROUP_THREAD,
    messages: [
      { id: "m-1-aaaaaaaa", who: "player", text: "Hi all", at },
      { id: "m-2-aaaaaaaa", who: "li", text: "Hello", at, li: "NOT AN LI" },
      { id: "m-3-aaaaaaaa", who: "li", text: "Hey", at, li: KAI },
    ],
    sessions: [
      { start: 0, count: 2, memory: { text: "A hello.", quote: "" }, closedAt: at, members: ["bad id", 3] },
      { start: 2, count: 1, memory: { text: "A hey.", quote: "" }, closedAt: at, members: [KAI, MIR] },
    ],
    seenAt: null,
  });
  assert.deepEqual(
    thread.messages.map((message) => [message.id, message.li ?? null]),
    [
      ["m-1-aaaaaaaa", null],
      ["m-2-aaaaaaaa", null],
      ["m-3-aaaaaaaa", KAI],
    ],
  );
  assert.deepEqual(
    thread.sessions.map((session) => session.members ?? null),
    [null, [KAI, MIR]],
  );
  assert.equal(archivedCount(thread), 3, "the closed conversations keep their bounds");
  // The one with no speaker reads as someone unknown; a DM's thread (no `li` anywhere) reads exactly as before.
  const text = renderThread(thread.messages, { li: "Someone", player: "Ines" }, "his", undefined, (message) =>
    message.li === KAI ? "Kai" : undefined,
  );
  assert.equal(text, "Ines: Hi all\nSomeone: Hello\nKai: Hey");
  const dm: PhoneMessage[] = [
    { id: "m-1", who: "player", text: "Hi", at },
    { id: "m-2", who: "li", text: "Hm.", at },
  ];
  assert.equal(renderThread(dm, { li: "Kai", player: "Ines" }, "his"), "Ines: Hi\nKai: Hm.");
});

// ── Sending ──

test("a send saves her message, then the members' reply once; the same id again makes no second message or call", async () => {
  const t = await groupWorld("r-group03-aaaaaa");
  assert.equal((await t.world()).groupSquabbles, undefined, "squabbles are off by default");
  const sent = await t.call("POST", send, { body: { text: "  Is anyone up?  ", id: "c-0001-abcd", quote: "x" } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const [mine, ...theirs] = sent.body.messages as PhoneMessage[];
  assert.deepEqual(
    [mine!.who, mine!.text, mine!.id, mine!.quote],
    ["player", "Is anyone up?", "c-0001-abcd", undefined],
  );
  // "Kai:" is taken off; each speaker keeps one sticker, matched by name; "mireille" is Mireille.
  assert.deepEqual(
    theirs.map((message) => [message.li, message.text, message.sticker ?? null]),
    [
      [KAI, "Awake. Unfortunately.", "you:laugh"],
      [MIR, "Some of us were never asleep.", null],
    ],
  );
  assert.equal(t.groupCalls().length, 1);
  assert.equal(t.calls[0]!.connectionId, "conn-chat");
  assert.ok(t.logs.some((entry) => entry.level === "debugOverride" && entry.args[0] === "phone-group/reply"));

  const again = await t.call("POST", send, { body: { text: "Is anyone up?", id: "c-0001-abcd" } });
  assert.deepEqual(
    (again.body.messages as PhoneMessage[]).map((message) => message.id),
    (sent.body.messages as PhoneMessage[]).map((message) => message.id),
  );
  assert.equal(t.groupCalls().length, 1, "no second call");
  assert.equal((await t.thread())!.messages.length, 3, "no second message");
  // Only the protagonist's five stickers can be sent here.
  const theirSticker = await t.call("POST", send, { body: { sticker: `${KAI}:smug` } });
  assert.deepEqual([theirSticker.status, theirSticker.body.code], [400, "bad-request"]);
  assert.equal((await t.call("POST", send, { body: { sticker: "you:shy" } })).status, 200);

  // The list shows the newest message; the members' reply to her newest one is unread until she sees it.
  const row = (await t.call("GET", list)).body.group;
  assert.deepEqual([row.last.li, row.unread, row.busy], [MIR, 2, false]);
});

test("one write at a time: a send or a close while the reply is written is busy, and the squabble quota never matters", async () => {
  const t = await groupWorld("r-group04-aaaaaa");
  await t.setWorld({ groupSquabbles: 1, groupDaily: { days: { "2026-01-01": { attempts: 1 } } } });
  let release!: () => void;
  const held = inThreadLock(t.runId, GROUP_THREAD, () => new Promise<void>((resolve) => (release = resolve)));
  const busy = await t.call("POST", send, { body: { text: "Hello?" } });
  const closing = await t.call("POST", close);
  assert.deepEqual([busy.status, busy.body.code, closing.status, closing.body.code], [409, "busy", 409, "busy"]);
  assert.deepEqual([(await t.call("GET", page)).body.busy, (await t.call("GET", list)).body.group.busy], [true, true]);
  release();
  await held;
  assert.equal(await t.thread(), null, "the busy send saved nothing");
  assert.equal((await t.call("POST", send, { body: { text: "Hello?" } })).status, 200, "always answered");
});

test("a failed reply keeps her message, and Retry answers it once", async () => {
  const refusal = "I can't help with writing that.";
  const t = await groupWorld("r-group05-aaaaaa", { replies: [refusal, refusal, ...model()] });
  const failed = await t.call("POST", send, { body: { text: "Talk to me." } });
  assert.deepEqual([failed.status, failed.body.code], [422, "declined"]);
  assert.deepEqual(
    (await t.thread())!.messages.map((message) => message.who),
    ["player"],
  );
  assert.equal((await t.call("GET", page)).body.retry, true);
  const retried = await t.call("POST", send, { body: { retry: true } });
  assert.equal(retried.status, 200, JSON.stringify(retried.body));
  assert.deepEqual(
    (await t.thread())!.messages.map((message) => message.who),
    ["player", "li", "li"],
  );
  const nothing = await t.call("POST", send, { body: { retry: true } });
  assert.deepEqual([nothing.status, nothing.body.code], [409, "conflict"]);
});

// ── P17g ──

const speakers = [
  { id: KAI, name: "Kai", stickers: [{ id: `${KAI}:smug`, name: "kai_smug", about: "smug" }] },
  { id: MIR, name: "Mireille", stickers: [] },
];
const yours = [{ id: "you:laugh", name: "ines_laugh", about: "laughing" }];

test("P17g's parser: speakers by name, the repair turn for the protagonist, a stranger, nothing or a lone squabbler", () => {
  const read = (messages: Array<Record<string, string>>, squabble = false) =>
    normalizeGroupReply({ messages }, { player: "Ines", members: speakers, yours }, { squabble });
  assert.match(read([{ speaker: "Ines", text: "Fine." }]) as string, /^a message was written as Ines/);
  assert.match(read([{ speaker: "Kai", text: "Hm.\nInes: fine" }]) as string, /^a message was written as Ines/);
  assert.match(read([{ speaker: "Noor", text: "Hello." }]) as string, /"Noor" is not in the group chat/);
  assert.match(read([{ text: "Hello." }]) as string, /names no speaker/);
  assert.match(read([{ speaker: "Kai", text: "  " }]) as string, /^the reply had no message/);
  assert.match(
    read(
      [
        { speaker: "Kai", text: "One." },
        { speaker: "KAI", text: "Two." },
      ],
      true,
    ) as string,
    /at least two of them/,
  );
  // One sticker per speaker: Kai's own or hers; Mireille cannot send Kai's.
  assert.deepEqual(
    read([
      { speaker: "Kai", text: "[kai_smug] [ines_laugh]" },
      { speaker: "Kai", text: "[smug_kai]" },
      { speaker: "Mireille", text: "[kai_smug] Mine." },
      { speaker: "Mireille", text: "[ines_laugh]" },
    ]),
    {
      messages: [
        { li: KAI, text: "", sticker: `${KAI}:smug` },
        { li: MIR, text: "Mine." },
        { li: MIR, text: "", sticker: "you:laugh" },
      ],
    },
  );
  const many = Array.from({ length: 12 }, (_, index) => ({
    speaker: index % 2 ? "Kai" : "Mireille",
    text: `${index}`,
  }));
  assert.equal((read(many) as { messages: unknown[] }).messages.length, 6);
  assert.equal((read(many, true) as { messages: unknown[] }).messages.length, 8);
});

test("P17g's parser: whoever the newest message names answers, by name or first name, as a word", () => {
  const members = [...speakers, { id: SOL, name: "Sol Varga", stickers: [] }];
  const answer = (answering: string, ...who: string[]) =>
    normalizeGroupReply(
      { messages: who.map((speaker) => ({ speaker, text: "Here." })) },
      { player: "Ines", members, yours },
      { answering },
    );
  assert.equal(
    answer("Sol, are you awake?", "Kai"),
    "Ines named Sol Varga: each one named answers with at least one message",
  );
  assert.match(answer("mireille? KAI's lamp is out", "Sol") as string, /^Ines named Kai, Mireille:/);
  assert.match(answer("Sol varga, Kai-chan", "Kai") as string, /^Ines named Sol Varga:/);
  // Answered, or no one named as a word: nothing to repair.
  assert.deepEqual(answer("Sol, Kai?", "Kai", "Sol"), {
    messages: [
      { li: KAI, text: "Here." },
      { li: SOL, text: "Here." },
    ],
  });
  for (const unnamed of ["Is anyone up?", "Solstice tonight", "Mireilles", ""]) {
    assert.equal(typeof answer(unnamed, "Kai"), "object", unnamed);
  }
  // A title or article is no one's name: "il" never names Il Dottore, "Mr." never names Mr. Darcy (CodeRabbit, #2168).
  const titled = [
    ...members,
    { id: "li-dottore-zz99", name: "Il Dottore", stickers: [] },
    { id: "li-darcy-zz98", name: "Mr. Darcy", stickers: [] },
  ];
  const titledAnswer = (answering: string, ...who: string[]) =>
    normalizeGroupReply(
      { messages: who.map((speaker) => ({ speaker, text: "Here." })) },
      { player: "Ines", members: titled, yours },
      { answering },
    );
  for (const unnamed of ["il treno è in ritardo", "Mr. nobody called", "the moon is out"]) {
    assert.equal(typeof titledAnswer(unnamed, "Kai"), "object", unnamed);
  }
  assert.match(titledAnswer("Dottore, sei sveglio?", "Kai") as string, /^Ines named Il Dottore:/);
  assert.match(titledAnswer("Darcy?", "Kai") as string, /^Ines named Mr\. Darcy:/);
  // A squabble answers no one.
  assert.equal(
    typeof normalizeGroupReply(
      {
        messages: [
          { speaker: "Kai", text: "Hm." },
          { speaker: "Sol", text: "Hm." },
        ],
      },
      { player: "Ines", members, yours },
      { squabble: true, answering: "Mireille?" },
    ),
    "object",
  );
});

test("a reply that leaves out a member she named gets the repair turn, and the member answers", async () => {
  const withSol = { messages: [{ speaker: "Sol", text: "Awake, and counting lamps." }] };
  const t = await groupWorld("r-group13-aaaaaa", { replies: [json(REPLY), json(withSol), ...model()] });
  const sent = await t.call("POST", send, { body: { text: "Sol, are you awake?" } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.deepEqual(
    (sent.body.messages as PhoneMessage[]).slice(1).map((message) => [message.li, message.text]),
    [[SOL, "Awake, and counting lamps."]],
  );
  const [first, repair] = t.groupCalls();
  assert.ok(!JSON.stringify(first!.messages).includes("each one named answers"));
  assert.ok(repair!.messages.at(-1)!.content.includes("Ines named Sol: each one named answers"));
  assert.equal(t.groupCalls().length, 2);
});

test("P17g: the plural rules, the knowledge line, each member's card, ties without secrets, and recall as the group", async () => {
  const t = await groupWorld("r-group06-aaaaaa", { withMemory: true });
  await t.setWorld({
    language: "Italiano",
    web: [
      { a: KAI, b: MIR, stance: "rivals", history: "They trained together.", debt: "none", secret: "WEB-SECRET" },
      { a: KAI, b: "li-gone-zz99", stance: "old friends", history: "GONE-ROW.", debt: "none" },
    ],
  });
  // Kai's own private things: a closed DM, and what he learned in Read Me.
  await t.store.mutateDoc(chatTarget(t.runId, KAI), normalizeThread, (thread) => ({
    ...thread,
    li: KAI,
    messages: [
      { id: "m-dm-0001", who: "player", text: "Tell me.", at },
      { id: "m-dm-0002", who: "li", text: "DM-PRIVATE", at },
    ],
    sessions: [{ start: 0, count: 2, memory: { text: "DM-PRIVATE memory", quote: "" }, closedAt: at, name: "Kai" }],
  }));
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: {
      ...state.lis,
      [KAI]: {
        ...state.lis[KAI]!,
        stage: 2,
        known: [{ id: "rm-1/0", category: "likes", text: "NOTEBOOK-LINE", verdict: "right", at }],
      },
    },
  }));
  assert.equal((await t.call("POST", send, { body: { text: "Hello, everyone." } })).status, 200);
  const prompt = t.groupCalls()[0]!.messages;
  const head = system(prompt);
  for (const part of [
    "Kai, Mireille, Sol and Ines, all in one thread",
    "Write every message in Italiano.",
    "Never write Ines's messages",
    "Nothing happens in the story because of this conversation",
    "Everyone in the group reads everything said here",
    "CONTENT CONTRACT",
  ]) {
    assert.ok(head.includes(part), `system has: ${part}`);
  }
  assert.ok(!head.includes("You are Kai") && !head.includes("HOW CLOSE YOU ARE"), "no single-LI P17 lines");
  assert.ok(!head.includes("A rupture stands between you"));
  const all = JSON.stringify(prompt);
  for (const name of ["Kai", "Mireille", "Sol"]) assert.ok(all.includes(`Between ${name} and the protagonist`), name);
  assert.ok(all.includes("Kai and Mireille: rivals. They trained together."), "the ties between members");
  assert.ok(!all.includes("WEB-SECRET") && !all.includes("GONE-ROW"), "no secret, no tie to a non-member");
  assert.ok(!all.includes("DM-PRIVATE") && !all.includes("NOTEBOOK-LINE"), "no DM, no notebook");
  assert.ok(!all.includes("HIDDEN-TRUTH") && !all.includes("MYSTERY-TRUTH"));
});

/** Completes a chapter: its document, one scene a line, and its progress read by `completed`. */
async function completeChapter(
  t: Awaited<ReturnType<typeof groupWorld>>,
  chapter: Pick<Chapter, "key" | "kind" | "lead" | "title"> & Partial<Pick<Chapter, "number" | "li">>,
  completed: string,
  ...lines: string[]
) {
  const nodes = lines.map((_, i) => ({ i, kind: "beat" as const, guide: "The scene.", cast: [chapter.lead] }));
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, chapter.key)), normalizeChapter, () => ({
    tags: [],
    summary: "",
    ledger: { relationship: [], conflict: [], offscreen: [] },
    connectionId: "conn-text",
    nodes,
    plannedAt: completed,
    ...chapter,
  }));
  for (const [i, text] of lines.entries()) {
    const beat: Beat = {
      key: chapter.key,
      i,
      kind: "beat",
      places: [],
      segments: [{ speaker: "", text }],
      choices: [],
      choiceCanon: {},
      effects: {},
      applied: {},
      musicMood: "tense",
      readThrough: 0,
      written: { at: completed, connectionId: "conn-text", model: "fake" },
      rewrites: 0,
    };
    await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, chapter.key, i)), normalizeBeat, () => beat);
  }
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [chapter.key]: { beatsRead: lines.length, completed, applied: [] } },
  }));
}

test("P17g recalls as the group: no date, Claw round, own chapter in full or what it left; Kai's DM still has them", async () => {
  const t = await groupWorld("r-group14-aaaaaa", { withMemory: "all" });
  await completeChapter(
    t,
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" },
    "2026-11-01T20:00:00.000Z",
    "MAIN-SCENE: the lanterns along the quay go dark.",
  );
  await completeChapter(
    t,
    { key: `route-${KAI}-1`, kind: "route", li: KAI, lead: KAI, title: "The Bell Tower" },
    "2026-11-01T21:00:00.000Z",
    "KAI-ROUTE-SCENE: Kai rings the bell for Ines alone.",
  );
  await completeChapter(
    t,
    { key: "date-1", kind: "date", li: KAI, lead: KAI, title: "Jellyfish Hour" },
    "2026-11-01T22:00:00.000Z",
    "KAI-DATE-SCENE: the jellyfish glow under the pier.",
  );
  const round: ClawRound = {
    id: "c-kai1-abcdef",
    li: KAI,
    name: "Kai",
    at: "2026-11-01T23:00:00.000Z",
    first: "partner",
    caught: [],
    cheat: null,
    paid: { starlight: 0, affection: 0 },
    capped: false,
    newPlush: [],
    firstPlush: false,
  };
  const grievance = (id: string, text: string, opened: string, severity: "minor" | "rupture" = "minor") => ({
    id,
    li: KAI,
    by: "li" as const,
    text,
    severity,
    opened,
    status: "open" as const,
  });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    claw: { rounds: [round] },
    lis: {
      ...state.lis,
      [KAI]: {
        ...state.lis[KAI]!,
        grievances: [
          grievance("g-1", "KAI-MAIN-GRIEVANCE: the lamp.", "main-1/0"),
          grievance("g-2", "KAI-ROUTE-GRIEVANCE: the bell he rang alone.", `route-${KAI}-1/0`, "rupture"),
        ],
        disclosures: [
          { text: "KAI-MAIN-DISCLOSURE: she fears the sea.", at, ref: "main-1/0" },
          { text: "KAI-ROUTE-DISCLOSURE: she hears the bell at night.", at, ref: `route-${KAI}-1/0` },
        ],
        rupture: { grievanceId: "g-2", since: at },
      },
    },
  }));
  const PRIVATE = [
    "KAI-ROUTE-SCENE",
    "Previous chapter in full: Kai",
    "KAI-DATE-SCENE",
    "Jellyfish Hour",
    "The claw machine with Kai",
    "KAI-ROUTE-GRIEVANCE",
    "KAI-ROUTE-DISCLOSURE",
  ];
  assert.equal((await t.call("POST", send, { body: { text: "Hello, everyone." } })).status, 200);
  const group = JSON.stringify(t.groupCalls().at(-1)!.messages);
  assert.deepEqual(
    PRIVATE.filter((marker) => group.includes(marker)),
    [],
    "nothing of Kai's own in the group",
  );
  for (const shared of [
    "MAIN-SCENE",
    "KAI-MAIN-GRIEVANCE",
    "KAI-MAIN-DISCLOSURE",
    "A rupture stands between them (g-2)",
  ]) {
    assert.ok(group.includes(shared), `the group still has: ${shared}`);
  }
  // His own reader keeps all of it.
  const dm = await t.call("POST", "/runs/:run/phone/:li/send", { li: KAI, body: { text: "Still up?" } });
  assert.equal(dm.status, 200, JSON.stringify(dm.body));
  const own = JSON.stringify(t.calls.filter((entry) => isDmPrompt(entry.messages)).at(-1)!.messages);
  assert.deepEqual(
    PRIVATE.filter((marker) => !own.includes(marker)),
    [],
    "Kai's DM has his own",
  );
});

test("P17g's cache layout: a reply marks the stable part, a squabble shares it unmarked, and the thread comes after it", async () => {
  const gate = admissionGate();
  const t = await groupWorld("r-group07-aaaaaa", { admissionRun: gate.admissionRun });
  gate.open();
  assert.equal((await t.call("POST", send, { body: { text: "First." } })).status, 200);
  assert.equal((await t.call("POST", send, { body: { text: "Second." } })).status, 200);
  const [first, second] = t.groupCalls().map((entry) => entry.messages);
  for (const messages of [first!, second!]) {
    assert.deepEqual(
      messages.map((message) => [message.role, !!(message as { cacheBreakpoint?: boolean }).cacheBreakpoint]),
      [
        ["system", false],
        ["user", true],
        ["user", false],
      ],
    );
  }
  assert.deepEqual([second![0]!.content, second![1]!.content], [first![0]!.content, first![1]!.content]);
  assert.ok(!first![1]!.content.includes("First.") && first![2]!.content.includes("Ines: First."));
  // A squabble: same system and stable part, no mark.
  await t.setWorld({ groupSquabbles: 24 });
  const T0 = Date.UTC(2026, 10, 2, 9);
  await groupDue(t.deps, t.runId, { open: null, now: T0 });
  await groupDue(t.deps, t.runId, { open: null, now: T0 + 60_000 });
  for (let round = 0; round < 400 && t.background.has(groupJobKey(t.runId)); round += 1) await tick();
  const squabble = t.groupCalls().at(-1)!.messages;
  assert.ok(isSquabble(squabble));
  assert.deepEqual([squabble[0]!.content, squabble[1]!.content], [first![0]!.content, first![1]!.content]);
  assert.ok(squabble.every((message) => !(message as { cacheBreakpoint?: boolean }).cacheBreakpoint));
});

// ── Squabbles ──

/** 09:00 UTC on a Monday. */
const T0 = Date.UTC(2026, 10, 2, 9);
const HOUR = 3_600_000;

test("squabbles: off by default, armed a minute after a visit starts, spread by the limit, background, landing unread", async () => {
  const t = await groupWorld("r-group08-aaaaaa");
  const heartbeat = async (now: number, open: string | null = null) =>
    (await t.call("POST", due, { body: { open, now } })).body;
  // The route's own clock: called directly with `now`, through the route for the shape.
  const route = await heartbeat(T0);
  assert.deepEqual(route, { status: "disabled", latest: null, group: { status: "disabled", latest: null } });
  const beat = (now: number, open: string | null = null, random = () => 0) =>
    groupDue(t.deps, t.runId, { open, now, random, debugMode: true });
  await t.setWorld({ groupSquabbles: 2 });
  assert.equal((await beat(T0)).status, "scheduled");
  assert.equal((await beat(T0 + 30_000)).status, "waiting");
  assert.equal((await beat(T0 + 60_000)).status, "queued");
  // Spent before anything is written, the next 12 h away, and one at a time.
  assert.deepEqual((await t.world()).groupDaily!.days["2026-11-02"], { attempts: 1, nextAt: T0 + 60_000 + 12 * HOUR });
  assert.equal((await beat(T0 + 61_000)).status, "busy");
  for (let round = 0; round < 400 && t.background.has(groupJobKey(t.runId)); round += 1) await tick();
  const thread = (await t.thread())!;
  assert.deepEqual(
    thread.messages.map((message) => [message.li, message.text]),
    SQUABBLE.messages.map((message) => [message.speaker === "Sol" ? SOL : KAI, message.text]),
  );
  assert.equal(thread.seenAt, null, "unread");
  assert.equal((await t.call("GET", list)).body.group.unread, 3);
  const call = t.groupCalls()[0]!;
  assert.equal(call.connectionId, "conn-chat");
  // Random 0 shuffles Mireille and Sol to the front: they start it.
  assert.ok(call.messages.at(-1)!.content.includes("Mireille and Sol start squabbling"));
  assert.ok(t.logs.some((entry) => entry.level === "debugOverride" && entry.args[0] === "phone-group/squabble"));
  const latest = (await t.world()).groupDaily!.last!;
  assert.deepEqual([latest.li, latest.at], [GROUP_THREAD, thread.messages.at(-1)!.at]);
  assert.deepEqual(await beat(T0 + 120_000), { status: "waiting", latest });
  // Daily messages are their own: off, untouched.
  assert.equal((await t.world()).phoneDaily, undefined);
  assert.deepEqual((await heartbeat(T0 + 130_000)).latest, null);
  // Marking it seen clears the unread count, never moving back.
  assert.equal((await t.call("POST", seen)).status, 200);
  assert.equal((await t.call("GET", list)).body.group.unread, 0);
});

test("squabbles skip an open, busy or waiting group, are checked again when the job starts, and a dropped one stays spent", async () => {
  const gate = admissionGate();
  const t = await groupWorld("r-group09-aaaaaa", { admissionRun: gate.admissionRun });
  await t.setWorld({ groupSquabbles: 24 });
  const beat = (now: number, open?: string | null) => groupDue(t.deps, t.runId, { open, now, random: () => 0 });
  // Open, or her message waiting, or a reply being written: nothing is armed or spent.
  assert.equal((await beat(T0, GROUP_THREAD)).status, "no-eligible");
  await t.store.mutateDoc(chatTarget(t.runId, GROUP_THREAD), normalizeThread, (thread) => ({
    ...thread,
    li: GROUP_THREAD,
    messages: [{ id: "m-her-0001", who: "player", text: "Anyone?", at }],
  }));
  assert.equal((await beat(T0, null)).status, "no-eligible");
  await t.store.mutateDoc(chatTarget(t.runId, GROUP_THREAD), normalizeThread, (thread) => ({
    ...thread,
    messages: [...thread.messages, { id: "m-kai-0001", who: "li", text: "Here.", at, li: KAI }],
  }));
  let release!: () => void;
  const held = inThreadLock(t.runId, GROUP_THREAD, () => new Promise<void>((resolve) => (release = resolve)));
  assert.equal((await beat(T0)).status, "no-eligible");
  release();
  await held;
  assert.equal((await t.world()).groupDaily, undefined, "nothing armed or spent");

  // Queued while she is away; she opens the group before the job is admitted: it drops, and the slot stays spent.
  assert.equal((await beat(T0 + 1_000)).status, "scheduled");
  assert.equal((await beat(T0 + 61_000)).status, "queued");
  assert.equal((await t.call("GET", page)).status, 200);
  gate.open();
  for (let round = 0; round < 400 && t.background.has(groupJobKey(t.runId)); round += 1) await tick();
  assert.equal(t.groupCalls().length, 0, "no provider work");
  assert.equal((await t.thread())!.messages.length, 2);
  assert.equal((await t.world()).groupDaily!.days["2026-11-02"]!.attempts, 1);
  assert.ok(t.logs.some((entry) => entry.level === "info" && entry.message.includes("squabble was dropped")));
});

test("a squabble holds the thread while written, and is dropped when the thread changed meanwhile", async () => {
  const t = await groupWorld("r-group10-aaaaaa");
  await t.setWorld({ groupSquabbles: 24 });
  let release!: () => void;
  let reached!: () => void;
  const waiting = new Promise<void>((resolve) => (reached = resolve));
  const gate = new Promise<void>((resolve) => (release = resolve));
  const models = t.runtime.languageModels as { resolveForRequest: typeof t.runtime.languageModels.resolveForRequest };
  const resolve = models.resolveForRequest.bind(models);
  models.resolveForRequest = async (request) => {
    const resolved = await resolve(request);
    return {
      ...resolved,
      async chatComplete(messages, options) {
        reached();
        await gate;
        return resolved.chatComplete(messages, options);
      },
    };
  };
  await groupDue(t.deps, t.runId, { open: null, now: T0 });
  await groupDue(t.deps, t.runId, { open: null, now: T0 + 60_000 });
  await waiting;
  assert.equal((await t.call("GET", list)).body.group.busy, true, "someone is typing");
  assert.deepEqual((await t.call("POST", send, { body: { text: "Hi" } })).body.code, "busy");
  await t.store.mutateDoc(chatTarget(t.runId, GROUP_THREAD), normalizeThread, (thread) => ({
    ...thread,
    li: GROUP_THREAD,
    messages: [{ id: "m-else-0001", who: "li", text: "Written elsewhere.", at, li: MIR }],
  }));
  release();
  for (let round = 0; round < 400 && t.background.has(groupJobKey(t.runId)); round += 1) await tick();
  assert.deepEqual(
    (await t.thread())!.messages.map((message) => message.text),
    ["Written elsewhere."],
  );
  assert.equal((await t.world()).groupDaily!.last, undefined);
  assert.ok(t.logs.some((entry) => entry.level === "info" && entry.message.includes("squabble was dropped")));
});

// ── Close and remember, and who recalls it ──

test("Close and remember in the group: P18g, one session with its members, no affection, recalled only by its members", async () => {
  const t = await groupWorld("r-group11-aaaaaa", { withMemory: true, newcomer: true });
  await t.arc(2, 2, NEW);
  assert.equal((await t.call("POST", send, { body: { text: "Is anyone up?" } })).status, 200);
  const points = Object.fromEntries(Object.entries((await t.state()).lis).map(([li, state]) => [li, state.points]));
  const closed = await t.call("POST", close);
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.deepEqual(closed.body, { memory: { text: MEMORY.memory, quote: "Awake. Unfortunately." }, grants: [] });
  assert.deepEqual(
    Object.fromEntries(Object.entries((await t.state()).lis).map(([li, state]) => [li, state.points])),
    points,
    "no affection",
  );
  const session = (await t.thread())!.sessions[0] as PhoneSession;
  assert.deepEqual(
    [session.start, session.count, session.name, session.members],
    [0, 3, "Kai, Mireille and Sol", [KAI, MIR, SOL]],
  );
  const memoryCall = t.calls.find((entry) => isGroupMemory(entry.messages))!;
  assert.ok(system(memoryCall.messages).startsWith("A group chat between Kai, Mireille, Sol and Ines has just ended."));
  assert.ok(memoryCall.messages.at(-1)!.content.includes("Mireille: Some of us were never asleep."));
  const replay = await t.call("POST", close);
  assert.deepEqual([replay.status, replay.body.grants], [200, []]);
  assert.equal((await t.thread())!.sessions.length, 1);

  const sources = await phoneMemorySources(t.store, t.runId, await t.state());
  const source = sources.find((entry) => entry.id === `phone-${GROUP_THREAD}-0`)!;
  assert.deepEqual(
    [source.kind, source.audience, source.title],
    [
      "chat",
      [KAI, MIR, SOL, GROUP_THREAD],
      "A group chat with Kai, Mireille and Sol (private: only they and the protagonist know what was said)",
    ],
  );
  const memory = t.memory!;
  assert.equal(await memory.maintain({ runId: t.runId }), true);
  for (let turn = 0; turn < 2000 && (await memory.status(t.runId)).phase === "pending"; turn += 1) await tick();
  const recall = async (who: { reader?: string; cast?: string[] }) =>
    ((await memory.recall({ runId: t.runId, job: "chat", query: { cues: ["x"] }, ...who })).recalls ?? [])
      .map((item) => item.content)
      .join("\n");
  assert.ok((await recall({ reader: KAI })).includes(MEMORY.memory), "a member's own reader");
  assert.ok((await recall({ cast: [SOL, NEW] })).includes(MEMORY.memory), "a scene with a member");
  assert.ok((await recall({ reader: GROUP_THREAD })).includes(MEMORY.memory), "the group itself");
  assert.ok(!(await recall({ reader: NEW })).includes(MEMORY.memory), "never a later member");
  assert.ok(!(await recall({ cast: [NEW] })).includes(MEMORY.memory), "never a scene without a member");
  assert.ok(!(await recall({ cast: [] })).includes(MEMORY.memory));
  // His DM reply recalls it; the next group prompt lists it in full rather than among the recalls.
  assert.equal(
    (await t.call("POST", "/runs/:run/phone/:li/send", { li: KAI, body: { text: "About earlier." } })).status,
    200,
  );
  const dm = t.calls.filter((entry) => isDmPrompt(entry.messages)).at(-1)!;
  assert.ok(JSON.stringify(dm.messages).includes(MEMORY.memory));
  assert.equal((await t.call("POST", send, { body: { text: "Again." } })).status, 200);
  const next = t.groupCalls().at(-1)!.messages[1]!.content;
  assert.ok(next.includes(`CONVERSATIONS THAT ARE OVER (in this group chat)\n- ${MEMORY.memory}`));
  assert.ok(!next.includes(`# Recalled memory: A group chat with`));
});

// ── Settings, Home ──

test("settings take 0 to 24 squabbles a day, the quota never reaches the client, and Home counts the group's unread", async () => {
  const t = await groupWorld("r-group12-aaaaaa");
  const saved = await t.call("POST", "/runs/:run/settings", { body: { groupSquabbles: 24 } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.world.groupSquabbles, 24);
  const refused = await t.call("POST", "/runs/:run/settings", { body: { groupSquabbles: 25 } });
  assert.deepEqual([refused.status, refused.body.code], [400, "bad-request"]);
  await t.setWorld({ groupDaily: { days: {}, last: { li: GROUP_THREAD, at } } });
  assert.equal("groupDaily" in toWorldView(await t.world()), false);
  // Saving the daily number keeps the squabbles.
  assert.equal(
    (await t.call("POST", "/runs/:run/settings", { body: { dailyMessages: 2 } })).body.world.groupSquabbles,
    24,
  );

  await t.store.mutateDoc(chatTarget(t.runId, GROUP_THREAD), normalizeThread, (thread) => ({
    ...thread,
    li: GROUP_THREAD,
    messages: [
      { id: "m-sol-0001", who: "li", text: "Lamps.", at, li: SOL },
      { id: "m-kai-0001", who: "li", text: "Again?", at, li: KAI },
    ],
  }));
  const home = await t.call("GET", "/runs/:run/home");
  assert.equal(home.status, 200, JSON.stringify(home.body));
  assert.equal(home.body.unread, 2);
});
