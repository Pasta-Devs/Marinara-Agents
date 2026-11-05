// Otome Forge's phone (M3): private threads with one reply in flight each, history pages, a send that lands once (its
// id sent again makes no second message or call), Retry after a failed reply, P17 written as a message from him alone
// (the knowledge boundary, his chat contract, the comfort rule, his stage, a rupture, the quoted note, nothing hidden,
// never the protagonist's words), Close and remember (one session, P18 on the summary contract, a verbatim quote, the
// capped affection once, a replay earning nothing, the cap on the player's own day), a closed session as a `chat`
// source recalled only by its own love interest, unread and seen, and a run deleted mid-reply leaving no thread; P17
// keeps recalled memory whole beside the previous chapter in full; a card name of any length never costs a session; a
// note's full length fits the Reply quote; Close and remember never waits behind the run's story queue, yet still holds
// its thread, and P18 gets a thinking model's summary room (#2039). Daily messages (#2044): off by default, armed a
// minute after the app opens, spaced 24 h / limit apart and never past the local midnight of the request's zone, a
// spent attempt never retried, a random met love interest who is not in the open thread, not busy and not waiting on
// her message, written by P17 "first" in the background lane on the chat connection (never the run's foreground
// queue), dropped when the thread changed meanwhile, and landing unread.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type {
  Beat,
  Chapter,
  PhoneMessage,
  PhoneThread,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { NOTE_TEXT_MAX } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/home.ts";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import {
  COMFORT_RULE,
  SUMMARY_WORDING,
  chatReplyMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteDeps,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  beatId,
  chapterId,
  chatId,
  PROLOGUE_KEY,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  createOtomeMemory,
  type OtomeMemory,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import {
  SESSION_NAME_MAX,
  archivedCount,
  chatTarget,
  inThreadLock,
  normalizeThread,
  sessionSourceId,
  unreadCount,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts";
import {
  dailyJobKey,
  phoneDue,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/daily.ts";
import { phoneMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/memory.ts";
import { normalizeChatReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/replies.ts";
import { registerPhoneRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/phone.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import type { FakeReply, FakeRuntimeOptions } from "./fixtures/otome-forge-fakes.ts";
import { KAI, MIR, SOL, json, saveStoryMemory, squeezedMemory, storyWorld } from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];
// #2066: a story prompt opens with the shared story context, then its own instructions: both are system messages.
const system = (messages: Messages) =>
  messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
const isReplyPrompt = (messages: Messages) => system(messages).includes("in your private message thread");
const isMemoryPrompt = (messages: Messages) => system(messages).includes("have just finished exchanging messages");

const REPLY = {
  // #2044: a sticker is its bracketed name; the second one in a reply is dropped.
  messages: [{ text: "Kai: Awake. Unfortunately." }, { text: "[ines_laugh]" }, { text: "[laugh_ines]" }],
  // #2066: no replies are suggested any more; a model that still writes them is read without them.
  suggestions: ["Go to sleep.", "Me too."],
};
const MEMORY = {
  memory: "Kai admitted he had stayed up. Ines told him to sleep, and he did not argue.",
  quote: '"Awake. Unfortunately."',
};

/** Answers P17 with `reply` and P18 with `memory`, as many times as asked; anything else fails the test. */
function phoneModel(reply: unknown = REPLY, memory: unknown = MEMORY): FakeReply[] {
  return Array.from({ length: 40 }, () => (messages: Messages) => {
    if (isReplyPrompt(messages)) return json(reply);
    if (isMemoryPrompt(messages)) return json(memory);
    // The kit's summarizer (memory upkeep): a detail echoes its source, an overview joins its records.
    const input = JSON.parse(messages.at(-1)!.content);
    if (input.source) return json({ summary: `${input.source.title}: ${input.source.content}` });
    if (input.records) return json({ summary: input.records.map((r: { content: string }) => r.content).join(" ") });
    throw new Error(`Unexpected prompt: ${system(messages).slice(0, 80)}`);
  });
}

/** The phone routes on a fake router wrapped by the kit's forgeTimeZoneRoutes; `call` answers like Fastify. */
function phoneRoutes(deps: RouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  registerPhoneRoutes(
    forgeTimeZoneRoutes({
      get: (path: string, handler: RouteHandler) => void routes.set(`GET ${path}`, handler),
      post: (path: string, handler: RouteHandler) => void routes.set(`POST ${path}`, handler),
    }),
    deps,
  );
  return async (
    method: "GET" | "POST",
    path: string,
    { li, body = {}, timeZone = "UTC" }: { li?: string; body?: object; timeZone?: string } = {},
  ) => {
    const handler = routes.get(`${method} ${path}`);
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
    const fields = { timeZone, debugMode: true, ...body };
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

async function phoneWorld(
  runKey: string,
  options: {
    replies?: FakeReply[];
    withMemory?: boolean;
    model?: Pick<FakeRuntimeOptions, "maxContext" | "maxOutputTokens">;
  } = {},
) {
  const t = await storyWorld({ runKey, replies: options.replies ?? phoneModel(), model: options.model ?? {} });
  let memory: OtomeMemory | undefined;
  if (options.withMemory) {
    memory = createOtomeMemory({
      runtime: t.runtime,
      store: t.store,
      readSources: async (runId) => phoneMemorySources(t.store, runId, (await t.state())!),
    });
  }
  const deps: RouteDeps = { ...t.deps, handle: createHandle(t.runtime.logger), ...(memory ? { memory } : {}) };
  const thread = async (li: string): Promise<PhoneThread | null> =>
    t.store.readDoc(chatId(t.runId, li), normalizeThread);
  return { ...t, deps, memory, thread, phone: phoneRoutes(deps, runKey) };
}

/** Holds the first model call until `release()` (`reached` resolves once it waits); later calls answer at once. */
function gateFirstCall(runtime: Awaited<ReturnType<typeof storyWorld>>["runtime"]) {
  let release!: () => void;
  let arrived!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const reached = new Promise<void>((resolve) => (arrived = resolve));
  let first = true;
  const models = runtime.languageModels as { resolveForRequest: typeof runtime.languageModels.resolveForRequest };
  const resolve = models.resolveForRequest.bind(models);
  models.resolveForRequest = async (request) => {
    const model = await resolve(request);
    return {
      ...model,
      async chatComplete(messages, options) {
        if (first) {
          first = false;
          arrived();
          await gate;
        }
        return model.chatComplete(messages, options);
      },
    };
  };
  return Object.assign(release, { reached });
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const send = "/runs/:run/phone/:li/send";
const close = "/runs/:run/phone/:li/close";
const page = "/runs/:run/phone/:li";
const localDay = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

test("a send saves her message, then his reply once, and the same id again makes no second message or call", async () => {
  const t = await phoneWorld("r-phone1-aaaaaa");
  const sent = await t.phone("POST", send, { li: KAI, body: { text: "  Are you awake?  ", id: "c-0001-abcd" } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const [mine, ...his] = sent.body.messages as PhoneMessage[];
  assert.deepEqual([mine!.who, mine!.text, mine!.id], ["player", "Are you awake?", "c-0001-abcd"]);
  // "Kai:" is taken off, and one sticker is kept.
  assert.deepEqual(
    his.map((message) => [message.who, message.text, message.sticker ?? null]),
    [
      ["li", "Awake. Unfortunately.", null],
      ["li", "", "you:laugh"],
    ],
  );
  assert.equal(sent.body.suggestions, undefined, "the player writes their own replies (#2066)");
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0]!.options?.temperature, undefined);

  const again = await t.phone("POST", send, { li: KAI, body: { text: "Are you awake?", id: "c-0001-abcd" } });
  assert.equal(again.status, 200);
  assert.deepEqual(
    (again.body.messages as PhoneMessage[]).map((message) => message.id),
    (sent.body.messages as PhoneMessage[]).map((message) => message.id),
  );
  assert.equal(again.body.suggestions, undefined);
  assert.equal(t.calls.length, 1, "no second call");
  assert.equal((await t.thread(KAI))!.messages.length, 3, "no second message");

  const view = await t.phone("GET", page, { li: KAI });
  assert.equal(view.status, 200);
  assert.deepEqual([view.body.activeCount, view.body.past, view.body.busy, view.body.retry], [3, 0, false, false]);
  assert.equal(view.body.suggestions, undefined);
  assert.ok(!t.calls[0]!.messages.some((message) => /suggestion/iu.test(message.content)), "P17 asks for none");

  const bad = await t.phone("POST", send, { li: KAI, body: { text: "   " } });
  assert.deepEqual([bad.status, bad.body.code], [400, "bad-request"]);
  const badId = await t.phone("POST", send, { li: KAI, body: { text: "Hi", id: "NOT A MESSAGE ID" } });
  assert.deepEqual([badId.status, badId.body.code], [400, "bad-request"]);
  // #2044: a sticker is an id she may send; an old face name, or his sticker before it is painted, is refused.
  for (const sticker of ["cold", `${KAI}:smug`]) {
    const refused = await t.phone("POST", send, { li: KAI, body: { sticker } });
    assert.deepEqual([refused.status, refused.body.code], [400, "bad-request"], sticker);
  }
});

test("one reply in flight per thread: a second send or a close is busy, and another thread only waits its turn", async () => {
  const t = await phoneWorld("r-phone2-aaaaaa");
  const release = gateFirstCall(t.runtime);
  const first = t.phone("POST", send, { li: KAI, body: { text: "First." } });
  const second = await t.phone("POST", send, { li: KAI, body: { text: "Second." } });
  const closing = await t.phone("POST", close, { li: KAI });
  assert.deepEqual([second.status, second.body.code], [409, "busy"]);
  assert.deepEqual([closing.status, closing.body.code], [409, "busy"]);
  const other = t.phone("POST", send, { li: MIR, body: { text: "Mireille?" } });
  await tick();
  const view = await t.phone("GET", page, { li: KAI });
  assert.equal(view.body.busy, true);
  const list = await t.phone("GET", "/runs/:run/phone");
  assert.deepEqual(
    (list.body.threads as Array<{ li: string; busy: boolean }>).map((thread) => [thread.li, thread.busy]).slice(0, 2),
    [
      [KAI, true],
      [MIR, true],
    ],
  );
  release();
  const [done, theirs] = await Promise.all([first, other]);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(theirs.status, 200, JSON.stringify(theirs.body));
  assert.equal(t.calls.length, 2);
  assert.deepEqual(
    (await t.thread(KAI))!.messages.map((message) => message.text),
    ["First.", "Awake. Unfortunately.", ""],
    "the busy send saved nothing",
  );
  assert.equal((await t.phone("GET", page, { li: KAI })).body.busy, false);
});

test("a failed reply keeps her message; the same id or Retry answers it once", async () => {
  const refusal = "I can't help with writing that.";
  const t = await phoneWorld("r-phone3-aaaaaa", { replies: [refusal, refusal, ...phoneModel()] });
  const failed = await t.phone("POST", send, { li: KAI, body: { text: "Talk to me.", id: "c-0003-abcd" } });
  assert.deepEqual([failed.status, failed.body.code], [422, "declined"]);
  assert.deepEqual(
    (await t.thread(KAI))!.messages.map((message) => message.who),
    ["player"],
  );
  assert.equal((await t.phone("GET", page, { li: KAI })).body.retry, true);

  const resent = await t.phone("POST", send, { li: KAI, body: { text: "Talk to me.", id: "c-0003-abcd" } });
  assert.equal(resent.status, 200, JSON.stringify(resent.body));
  assert.deepEqual(
    (resent.body.messages as PhoneMessage[]).map((message) => message.who),
    ["player", "li", "li"],
  );
  assert.equal(t.calls.length, 3);
  const nothing = await t.phone("POST", send, { li: KAI, body: { retry: true } });
  assert.deepEqual([nothing.status, nothing.body.code], [409, "conflict"]);

  // Retry with no new message answers the waiting one.
  const u = await phoneWorld("r-phone3-bbbbbb", { replies: [refusal, refusal, ...phoneModel()] });
  assert.equal((await u.phone("POST", send, { li: KAI, body: { text: "Hello?" } })).status, 422);
  const retried = await u.phone("POST", send, { li: KAI, body: { retry: true } });
  assert.equal(retried.status, 200, JSON.stringify(retried.body));
  assert.deepEqual(
    (await u.thread(KAI))!.messages.map((message) => message.who),
    ["player", "li", "li"],
  );
});

test("a reply written as the protagonist on a later line is refused, an ordinary colon is not", () => {
  const names = { li: "Kai", player: "Ines" };
  const refused = (text: string) => normalizeChatReply({ messages: [{ text }] }, names);
  assert.match(refused("Kai: hey\nInes: fine, I'll sleep.") as string, /^a message was written as Ines/);
  assert.match(refused("He waits.\nInes: fine") as string, /^a message was written as Ines/);
  const kept = refused("Kai: Meet at 7:30\nBring the key.");
  assert.deepEqual(kept, { messages: [{ text: "Meet at 7:30\nBring the key." }] });
});

test("P17 is a message from him alone: boundary, chat contract, comfort rule, stage, rupture, the note, nothing hidden", async () => {
  const asHer = { messages: [{ text: "Ines: Fine, I'll sleep." }] };
  const t = await phoneWorld("r-phone4-aaaaaa", { replies: [json(asHer), ...phoneModel()] });
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: {
      ...state.lis,
      [KAI]: {
        ...state.lis[KAI]!,
        stage: 2,
        grievances: [
          {
            id: "g-1",
            li: KAI,
            by: "li",
            text: "She read his logbook.",
            severity: "rupture",
            opened: "main-1/3",
            status: "open",
          },
        ],
        rupture: { grievanceId: "g-1", since: "2026-10-27T10:00:00.000Z" },
      },
    },
    ledgers: { ...state.ledgers, offscreen: [{ key: "main-1", li: KAI, line: "He mended the north lens alone." }] },
  }));
  const quote = "You left the lab light on again. I turned it off.";
  const sent = await t.phone("POST", send, { li: KAI, body: { text: "I read your note.", quote } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.equal((sent.body.messages as PhoneMessage[])[0]!.quote, quote);

  // Written as the protagonist: refused, and the repair turn names why.
  assert.equal(t.calls.length, 2);
  assert.match(
    t.calls[1]!.messages.at(-1)!.content,
    /did not match the required format: a message was written as Ines/,
  );
  const prompt = t.calls[0]!.messages;
  const head = system(prompt);
  for (const part of [
    forgeKnowledgeBoundary,
    "CONTENT CONTRACT",
    "Darkness: Angst",
    COMFORT_RULE,
    "Never write Ines's reply",
    "Nothing happens in the story because of this conversation",
    "Your mask has started to crack",
    "A rupture stands between you",
    "anything about their life outside the story",
  ]) {
    assert.ok(head.includes(part), `system has: ${part.slice(0, 50)}`);
  }
  const user = prompt.at(-1)!.content;
  assert.ok(user.includes(`Ines: (replying to your note: "${quote}") I read your note.`));
  assert.ok(user.includes("He mended the north lens alone."));
  assert.ok(user.includes("Open grievance g-1"));
  const all = JSON.stringify(prompt);
  assert.ok(!all.includes("HIDDEN-TRUTH") && !all.includes("MYSTERY-TRUTH"), "no unrevealed secret, no mystery truth");
  const logged = t.logs.filter((entry) => entry.level === "debugOverride" && entry.args[0] === `phone/${KAI}`);
  assert.ok(logged.length >= 1 && logged.every((entry) => entry.override === true), "logged in debug mode");
});

test("Close and remember: one session, P18 on the summary contract, the capped affection once, a replay earns nothing", async () => {
  const t = await phoneWorld("r-phone5-aaaaaa");
  const today = localDay("UTC");
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    daily: { dayKey: today, starlight: 0, affection: { [KAI]: 297 } },
  }));
  assert.equal((await t.phone("POST", send, { li: KAI, body: { text: "Are you awake?" } })).status, 200);
  const points = (await t.state()).lis[KAI]!.points;

  const closed = await t.phone("POST", close, { li: KAI });
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.deepEqual(closed.body.memory, { text: MEMORY.memory, quote: "Awake. Unfortunately." });
  assert.deepEqual(
    closed.body.grants,
    [{ source: "close-and-remember", li: KAI, affection: 3 }],
    "capped at 300 a day",
  );
  assert.equal((await t.state()).lis[KAI]!.points, points + 3);
  const thread = (await t.thread(KAI))!;
  assert.deepEqual(
    thread.sessions.map((session) => [session.start, session.count, session.name]),
    [[0, 3, "Kai"]],
  );
  assert.equal("suggestions" in thread, false);

  const memoryCall = t.calls.find((call) => isMemoryPrompt(call.messages))!;
  const head = system(memoryCall.messages);
  assert.ok(head.includes(SUMMARY_WORDING) && head.includes("Heat: SFW"), "an SFW story's summary contract");
  assert.ok(!head.includes(forgeKnowledgeBoundary), "the summarizer writes no one's words");
  assert.ok(memoryCall.messages.at(-1)!.content.includes("Kai: Awake. Unfortunately."));
  assert.ok(t.logs.some((entry) => entry.level === "debugOverride" && entry.args[0] === `phone-memory/${KAI}`));

  const calls = t.calls.length;
  const replay = await t.phone("POST", close, { li: KAI });
  assert.deepEqual([replay.status, replay.body.memory.text, replay.body.grants], [200, MEMORY.memory, []]);
  assert.equal(t.calls.length, calls, "a replay makes no call");
  assert.equal((await t.thread(KAI))!.sessions.length, 1);

  const view = await t.phone("GET", page, { li: KAI });
  assert.deepEqual([view.body.activeCount, view.body.past], [0, 1]);
  assert.ok((view.body.messages as Array<{ archived: boolean }>).every((message) => message.archived));

  // The day's cap is reached: the next conversation is remembered and earns nothing.
  assert.equal((await t.phone("POST", send, { li: KAI, body: { text: "Still up." } })).status, 200);
  const capped = await t.phone("POST", close, { li: KAI });
  assert.deepEqual([capped.status, capped.body.grants], [200, []]);
  assert.deepEqual(
    (await t.thread(KAI))!.sessions.map((session) => [session.start, session.count]),
    [
      [0, 3],
      [3, 3],
    ],
  );
  assert.equal((await t.state()).lis[KAI]!.points, points + 3);
});

test("Close and remember never waits behind the run's story queue, and its thread still takes one write at a time", async () => {
  const t = await phoneWorld("r-phoneq-aaaaaa");
  assert.equal((await t.phone("POST", send, { li: KAI, body: { text: "Are you awake?" } })).status, 200);
  // A story write (a lookahead beat, say) holds the run's foreground queue the whole time.
  let free!: () => void;
  const story = runForeground(t.runId, () => new Promise<void>((resolve) => (free = resolve)));
  const release = gateFirstCall(t.runtime);
  try {
    const closing = t.phone("POST", close, { li: KAI });
    const started = await Promise.race([
      release.reached.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000)),
    ]);
    assert.ok(started, "P18 is written at once, not behind the story write");
    // While it is summarized, the thread takes no other write.
    const busy = await t.phone("POST", send, { li: KAI, body: { text: "Wait." } });
    assert.deepEqual([busy.status, busy.body.code], [409, "busy"]);
    release();
    const closed = await closing;
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.deepEqual(closed.body.grants, [{ source: "close-and-remember", li: KAI, affection: 5 }]);
    assert.equal((await t.thread(KAI))!.sessions.length, 1, "remembered while the story write still runs");
  } finally {
    release();
    free();
    await story;
  }
});

test("P18 is a summary: it may write at least 10240 tokens for a thinking model, or the connection's lower cap", async () => {
  for (const [maxOutputTokens, least] of [
    [null, 10240],
    [65536, 10240],
    [4096, 4096],
  ] as const) {
    const t = await phoneWorld(`r-phone${maxOutputTokens ?? 0}-aaaaaa`, { model: { maxOutputTokens } });
    assert.equal((await t.phone("POST", send, { li: KAI, body: { text: "Are you awake?" } })).status, 200);
    const closed = await t.phone("POST", close, { li: KAI });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    const maxTokens = t.calls.find((call) => isMemoryPrompt(call.messages))!.options!.maxTokens!;
    assert.ok(maxTokens >= least, `cap ${maxOutputTokens}: P18 may write ${maxTokens}`);
    if (maxOutputTokens) assert.ok(maxTokens <= maxOutputTokens);
  }
});

test("the grant lands once through a stale write, a one-sided talk earns nothing, and the day follows her zone", async () => {
  const late = "Etc/GMT+12";
  const early = "Etc/GMT-14";
  const t = await phoneWorld("r-phone6-aaaaaa", {
    replies: [
      "",
      "",
      ...phoneModel(REPLY, { memory: "Ines wrote to Kai and he did not answer.", quote: "I never said this" }),
    ],
  });
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    daily: { dayKey: localDay(late), starlight: 0, affection: { [KAI]: 300 } },
  }));
  // His reply fails (two empty replies), so the conversation holds only her message.
  assert.equal(
    (await t.phone("POST", send, { li: KAI, body: { text: "Are you there?" }, timeZone: late })).status,
    422,
  );
  const lonely = await t.phone("POST", close, { li: KAI, timeZone: early });
  assert.equal(lonely.status, 200, JSON.stringify(lonely.body));
  assert.deepEqual(lonely.body.grants, [], "a conversation with nothing from him earns nothing");
  assert.equal(lonely.body.memory.quote, "", "a quote the conversation does not hold is dropped");

  // A full conversation on her early-zone day: a new day, so the cap from the late zone's day does not apply. Two
  // stale revisions on the way make both writes apply again, and still the session and the grant land once.
  assert.equal((await t.phone("POST", send, { li: KAI, body: { text: "Now?" }, timeZone: early })).status, 200);
  t.fake.interfere(chatId(t.runId, KAI));
  t.fake.interfere(stateId(t.runId));
  const before = (await t.state()).lis[KAI]!.points;
  const closed = await t.phone("POST", close, { li: KAI, timeZone: early });
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.deepEqual(closed.body.grants, [{ source: "close-and-remember", li: KAI, affection: 5 }]);
  const state = await t.state();
  assert.equal(state.lis[KAI]!.points, before + 5);
  assert.deepEqual(state.daily, { dayKey: localDay(early), starlight: 0, affection: { [KAI]: 5 } });
  assert.equal((await t.thread(KAI))!.sessions.length, 2);
});

test("a closed session is a chat source for its love interest only: recalled by him, never by another", async () => {
  const t = await phoneWorld("r-phone7-aaaaaa", { withMemory: true });
  const seed = async (li: string, text: string) =>
    t.store.mutateDoc(chatTarget(t.runId, li), normalizeThread, (thread) => ({
      ...thread,
      li,
      messages: [
        { id: `m-seed-${li}-1`, who: "player", text: "Tell me.", at: "2026-10-27T09:00:00.000Z" },
        { id: `m-seed-${li}-2`, who: "li", text, at: "2026-10-27T09:01:00.000Z" },
      ],
      sessions: [
        {
          start: 0,
          count: 2,
          memory: { text: `They talked about ${text}`, quote: text },
          closedAt: "2026-10-27T09:05:00.000Z",
          name: li,
        },
      ],
    }));
  await seed(KAI, "PRIVATE-LIGHTHOUSE");
  await seed(MIR, "PRIVATE-LEDGER");

  const sources = await phoneMemorySources(t.store, t.runId, await t.state());
  assert.deepEqual(
    sources.map((source) => [source.id, source.kind, source.audience]),
    [
      [sessionSourceId(KAI, { start: 0 }), "chat", [KAI]],
      [sessionSourceId(MIR, { start: 0 }), "chat", [MIR]],
    ],
  );

  const memory = t.memory!;
  assert.equal(await memory.maintain({ runId: t.runId }), true);
  for (let turn = 0; turn < 2000 && (await memory.status(t.runId)).phase === "pending"; turn += 1) await tick();
  assert.equal((await memory.status(t.runId)).phase, "ready");
  const recall = async (who: { reader?: string; cast?: string[] }) =>
    // #2066: a closed conversation comes back among the recalls.
    (
      (await memory.recall({ runId: t.runId, job: "chat", query: { cues: ["what we talked about"] }, ...who }))
        .recalls ?? []
    )
      .map((item) => `${item.title}\n${item.content}`)
      .join("\n");
  assert.ok((await recall({ reader: KAI })).includes("PRIVATE-LIGHTHOUSE"));
  assert.ok(!(await recall({ reader: KAI })).includes("PRIVATE-LEDGER"));
  assert.ok((await recall({ reader: MIR })).includes("PRIVATE-LEDGER"));
  assert.ok(!(await recall({ reader: MIR })).includes("PRIVATE-LIGHTHOUSE"));
  assert.ok(!(await recall({ cast: [] })).includes("PRIVATE-"), "never for a scene he is not in");
  // A scene with Kai and Mireille in it recalls his conversation as private, so she does not know of it.
  assert.equal(
    sources[0]!.title,
    `${KAI}'s message exchange (private: only ${KAI} and the protagonist know what was said)`,
  );
  const together = await recall({ cast: [KAI, MIR] });
  assert.ok(
    together.includes(`${KAI}'s message exchange (private: only ${KAI} and the protagonist know`),
    "its title marks it private in a shared scene",
  );

  // Each prompt lists its own love interest's conversations and never the other's.
  const calls = t.calls.length;
  assert.equal((await t.phone("POST", send, { li: MIR, body: { text: "About the ledger." } })).status, 200);
  const theirs = JSON.stringify(t.calls.slice(calls).find((call) => isReplyPrompt(call.messages))!.messages);
  assert.ok(theirs.includes("PRIVATE-LEDGER") && !theirs.includes("PRIVATE-LIGHTHOUSE"));
  const next = t.calls.length;
  assert.equal((await t.phone("POST", send, { li: KAI, body: { text: "About the lighthouse." } })).status, 200);
  const his = JSON.stringify(t.calls.slice(next).find((call) => isReplyPrompt(call.messages))!.messages);
  assert.ok(his.includes("PRIVATE-LIGHTHOUSE") && !his.includes("PRIVATE-LEDGER"));
});

test("history pages hold 80 messages, newest first, with archived flags; unread and seen never move back", async () => {
  const t = await phoneWorld("r-phone8-aaaaaa");
  const start = Date.parse("2026-10-27T08:00:00.000Z");
  const messages: PhoneMessage[] = Array.from({ length: 170 }, (_, index) => ({
    id: `m-seed-${String(index).padStart(4, "0")}`,
    who: index % 2 ? "li" : "player",
    text: `line ${index}`,
    at: new Date(start + index * 1000).toISOString(),
  }));
  await t.store.mutateDoc(chatTarget(t.runId, KAI), normalizeThread, (thread) => ({
    ...thread,
    li: KAI,
    messages,
    sessions: [
      { start: 0, count: 100, memory: { text: "They talked.", quote: "" }, closedAt: messages[99]!.at, name: "Kai" },
    ],
    seenAt: messages[149]!.at,
  }));
  const first = await t.phone("GET", page, { li: KAI, body: { page: "1" } });
  assert.equal(first.status, 200);
  const shown = first.body.messages as Array<PhoneMessage & { archived: boolean }>;
  assert.deepEqual([shown.length, shown[0]!.text, shown.at(-1)!.text], [80, "line 90", "line 169"]);
  assert.deepEqual(
    [first.body.page, first.body.pages, first.body.from, first.body.past, first.body.activeCount],
    [1, 3, 90, 1, 70],
  );
  assert.deepEqual([shown.filter((message) => message.archived).length, first.body.retry], [10, false]);
  const last = await t.phone("GET", page, { li: KAI, body: { page: "3" } });
  assert.deepEqual(
    [(last.body.messages as PhoneMessage[]).length, last.body.from, (last.body.messages as PhoneMessage[])[0]!.text],
    [10, 0, "line 0"],
  );

  const unread = async () =>
    ((await t.phone("GET", "/runs/:run/phone")).body.threads as Array<{ li: string; unread: number }>).find(
      (thread) => thread.li === KAI,
    )!.unread;
  assert.equal(await unread(), 10, "his messages after the 150th");
  assert.deepEqual(
    (await t.phone("POST", "/runs/:run/phone/:li/seen", { li: KAI, body: { last: messages[159]!.id } })).body,
    {},
  );
  assert.equal(await unread(), 5);
  await t.phone("POST", "/runs/:run/phone/:li/seen", { li: KAI, body: { last: messages[3]!.id } });
  assert.equal(await unread(), 5, "seen never moves back");
  await t.phone("POST", "/runs/:run/phone/:li/seen", { li: KAI });
  assert.equal(await unread(), 0);
});

test("a run deleted while he writes leaves no thread; an unknown love interest is a 404 and an unforged world a 409", async () => {
  const t = await phoneWorld("r-phone9-aaaaaa");
  const release = gateFirstCall(t.runtime);
  const sending = t.phone("POST", send, { li: KAI, body: { text: "Hello?" } });
  await release.reached;
  assert.ok(await t.thread(KAI), "her message was saved before the reply");
  // The run's delete sweeps every document while the reply is being written.
  for (const id of [worldId(t.runId), chatId(t.runId, KAI)]) await t.store.removeDoc(id);
  release();
  const done = await sending;
  assert.deepEqual([done.status, done.body.code], [404, "not-found"]);
  assert.equal(await t.thread(KAI), null, "the late reply did not bring the thread back");

  const u = await phoneWorld("r-phone9-bbbbbb");
  const unknown = await u.phone("POST", send, { li: "li-nobody-zz99", body: { text: "Hi" } });
  assert.deepEqual([unknown.status, unknown.body.code], [404, "not-found"]);
  assert.equal((await u.phone("GET", page, { li: "not-an-li" })).status, 404);
  await u.store.mutateDoc(runDocTarget("world", worldId(u.runId)), normalizeWorld, (world) => ({
    ...world,
    forge: { phase: "forging", steps: [] },
  }));
  const forging = await u.phone("POST", send, { li: KAI, body: { text: "Hi" } });
  assert.deepEqual([forging.status, forging.body.code], [409, "conflict"]);
  assert.equal(u.calls.length, 0);
});

test("P17 keeps the overview and recalled details whole beside the previous chapter in full, however long", async () => {
  const t = await phoneWorld("r-phonea-aaaaaa");
  const done = "2026-10-27T10:00:00.000Z";
  const key = "main-1";
  const chapter: Chapter = {
    key,
    kind: "main",
    number: 1,
    lead: KAI,
    title: "Harbour",
    tags: [],
    summary: "",
    nodes: Array.from({ length: 6 }, (_, i) => ({ i, kind: "beat" as const, guide: `Node ${i}.`, cast: [KAI] })),
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: done,
    connectionId: "conn-text",
  };
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, key)), normalizeChapter, () => chapter);
  // Six beats of about 650 words (the narrator's cap): far past the 2000 tokens P17 read of it before 0.6.17.
  const words = Array.from({ length: 65 }, () => "harbour").join(" ");
  for (let i = 0; i < 6; i += 1) {
    const segments = Array.from({ length: 10 }, (_, n) => ({
      speaker: n % 2 ? "Kai" : "",
      text: i === 0 && n === 0 ? `LATEST-START-MARK ${words}.` : i === 5 && n === 9 ? "LATEST-END-MARK." : `${words}.`,
    }));
    const beat: Beat = {
      key,
      i,
      kind: "beat",
      places: [],
      segments,
      choices: [],
      choiceCanon: {},
      effects: {},
      applied: {},
      musicMood: "tense",
      readThrough: 9,
      written: { at: done, connectionId: "conn-text", model: "fake" },
      rewrites: 0,
    };
    await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, key, i)), normalizeBeat, () => beat);
  }
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [key]: { beatsRead: 6, completed: done, applied: [] } },
  }));
  // A ready memory: the timeline as saved, an older conversation among the recalls (past the six P17 lists), the
  // chapter.
  await saveStoryMemory(t.store, t.runId, { head: "OVERVIEW-MARK: she came to the harbour city." });
  const memory = {
    async recall() {
      const recalls = [
        { id: "phone-old", title: "Kai's phone conversation", content: "OLD-SESSION-MARK: her sister Mina.", order: 1 },
      ];
      return {
        status: { phase: "ready" as const, retryable: false },
        lagging: false,
        overview: "",
        details: [],
        recalls,
        maxContext: 32768,
        text: "",
      };
    },
    maintain: async () => true,
  };
  const phone = phoneRoutes({ ...t.deps, memory: memory as unknown as OtomeMemory }, "r-phonea-aaaaaa");
  const sent = await phone("POST", send, { li: KAI, body: { text: "Do you remember my sister's name?" } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const user = t.calls.find((call) => isReplyPrompt(call.messages))!.messages.at(-1)!.content;
  for (const mark of ["OVERVIEW-MARK", "OLD-SESSION-MARK", "# Previous chapter in full: Harbour", "LATEST-END-MARK"]) {
    assert.ok(user.includes(mark), `P17 holds ${mark}`);
  }
  assert.ok(user.includes("LATEST-START-MARK"), "the previous chapter goes in whole, as GF's chat gets it");
});

test("P17 hands its memory to the fit: a recalled detail too big for the reader's window gives way", async () => {
  // A 1M-token connection, memory recalled for a 60k reader: only the fit it is handed to leaves the detail out.
  const t = await phoneWorld("r-phonesq-aaaaaa", { model: { maxContext: 1_000_000, maxOutputTokens: null } });
  const phone = phoneRoutes(
    { ...t.deps, memory: (await squeezedMemory(t, 60_000)) as unknown as OtomeMemory },
    "r-phonesq-aaaaaa",
  );
  const sent = await phone("POST", send, { li: KAI, body: { text: "Do you remember the quay?" } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const reply = t.calls.find((call) => isReplyPrompt(call.messages))!;
  const text = reply.messages.map((message) => message.content).join("\n");
  assert.ok(text.includes("SQUEEZED-OVERVIEW"), "the overview stays");
  assert.ok(!text.includes("SQUEEZED-DETAIL"), "the recalled detail gives way");
  assert.ok(reply.options!.maxTokens! >= 24_192, "with the whole reply budget");
});

test("a card name of any length never costs a session: clipped as written, the memory kept, the grant paid once", async () => {
  const t = await phoneWorld("r-phoneb-aaaaaa", {
    replies: phoneModel(
      { messages: [{ text: "Awake." }], suggestions: [] },
      { memory: "They talked late.", quote: "" },
    ),
  });
  const long = `Kai ${"of the North Light ".repeat(12)}`.trim();
  assert.ok([...long].length > SESSION_NAME_MAX);
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    name: long,
  }));
  assert.equal((await t.phone("POST", send, { li: KAI, body: { text: "Are you awake?" } })).status, 200);
  const before = (await t.state()).lis[KAI]!.points;
  const closed = await t.phone("POST", close, { li: KAI });
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.equal(closed.body.grants.length, 1);
  const thread = (await t.thread(KAI))!;
  assert.deepEqual(
    thread.sessions.map((session) => [session.start, session.count, [...(session.name ?? "")].length]),
    [[0, 2, SESSION_NAME_MAX]],
  );
  assert.equal(archivedCount(thread), 2, "nothing reopens");
  const replay = await t.phone("POST", close, { li: KAI });
  assert.deepEqual([replay.status, replay.body.grants], [200, []], "a second Close earns nothing");
  assert.equal((await t.state()).lis[KAI]!.points, before + 5);

  // A stored session or message with a display field out of bounds keeps its place; only that field is dropped.
  const read = normalizeThread({
    ...thread,
    messages: [{ ...thread.messages[0], sticker: "smug", quote: "q".repeat(5000) }, thread.messages[1]],
    sessions: [{ ...thread.sessions[0], name: "n".repeat(500) }],
  });
  assert.deepEqual([read.messages.length, read.sessions.length, archivedCount(read)], [2, 1, 2]);
  assert.deepEqual(
    [read.messages[0]!.sticker, read.messages[0]!.quote, read.sessions[0]!.name],
    [undefined, undefined, undefined],
  );
});

test("Reply from Home quotes a note of any stored length", async () => {
  const t = await phoneWorld("r-phonec-aaaaaa");
  // Thai is written without spaces between words, so a note within P16's word limit can run long in characters.
  const quote = "ฉันทิ้งตะเกียงไว้ให้เธอที่บันไดและกาน้ำชายังอุ่นอยู่".repeat(12).slice(0, NOTE_TEXT_MAX);
  const sent = await t.phone("POST", send, { li: KAI, body: { text: "I read it.", quote } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.equal((sent.body.messages as PhoneMessage[])[0]!.quote, quote);
});

// ── Daily messages (#2044) ──

const DAILY = {
  messages: [{ text: "The quay was quiet tonight. I kept a lantern lit for you." }],
};
const FIRST_LINE = "you are writing to Ines first, on your own, and it answers nothing they sent";
const HOUR = 3_600_000;
/** 09:00 UTC on a Monday. */
const T0 = Date.UTC(2026, 10, 2, 9, 0, 0);

/** Runs `operation` in `timeZone`, as every route does (the kit's forgeTimeZoneRoutes). */
function inZone<T>(timeZone: string, operation: () => Promise<T>): Promise<T> {
  let result!: Promise<T>;
  forgeTimeZoneRoutes({
    get: () => undefined,
    post: (_path: string, handler: RouteHandler) => {
      result = handler(
        { method: "POST", url: "/", body: { timeZone }, params: {}, query: {} },
        {} as OtomeReply,
      ) as Promise<T>;
    },
  }).post("/", () => operation());
  return result;
}

/** A forged world with chapter 1 read (the cast is met), a background lane and a chat connection of its own. */
async function dailyWorld(runKey: string, { limit, replies }: { limit?: number; replies?: FakeReply[] } = {}) {
  const t = await phoneWorld(runKey, { replies: replies ?? phoneModel(DAILY) });
  const background = createBackgroundQueue(t.runtime);
  const deps = { ...t.deps, background };
  // Which connection each admitted job held, and how.
  const admitted: string[] = [];
  const admission = t.runtime.integrations!.admission!;
  const admit = admission.run.bind(admission);
  Object.assign(admission, {
    run: (connectionId: string, mode: { kind: string }, operation: () => Promise<unknown>) => {
      admitted.push(`${connectionId} ${mode.kind}`);
      return admit(connectionId, mode as never, operation);
    },
  });
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { "main-1": { beatsRead: 7, completed: "2026-11-01T20:00:00.000Z", applied: [] } },
  }));
  const setLimit = (value: number | undefined) =>
    t.store.mutateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
      ...world,
      connections: { narration: "conn-text", chat: "conn-chat" },
      ...(value === undefined ? {} : { dailyMessages: value }),
    }));
  await setLimit(limit);
  const due = (
    now: number,
    // `open` left out keeps the thread last marked open (the app always names it; a thread read marks it too).
    {
      open,
      timeZone = "UTC",
      random = () => 0,
    }: { open?: string | null; timeZone?: string; random?: () => number } = {},
  ) => inZone(timeZone, () => phoneDue(deps, t.runId, { open, now, random, debugMode: true }));
  /** Lets the daily job finish. */
  const drain = async () => {
    for (let round = 0; round < 400 && background.has(dailyJobKey(t.runId)); round += 1) await tick();
  };
  const daily = async () => (await t.store.readDoc(worldId(t.runId), normalizeWorld))!.phoneDaily;
  const firstCalls = () =>
    t.calls.filter((call) => call.messages.some((message) => message.content.includes(FIRST_LINE)));
  return { ...t, deps, background, admitted, setLimit, due, drain, daily, firstCalls };
}

test("daily messages: off by default, armed a minute after the app opens, spread by the limit, and landing unread", async () => {
  const t = await dailyWorld("r-daily1-aaaaaa");
  const status = async (now: number, options?: Parameters<typeof t.due>[1]) => (await t.due(now, options)).status;
  assert.equal(await status(T0), "disabled", "absent is 0: off");
  await t.setLimit(0);
  assert.equal(await status(T0), "disabled");
  assert.equal(await t.daily(), undefined, "nothing is written while it is off");

  await t.setLimit(3);
  // The first heartbeat of a visit only arms the next attempt, a minute away.
  assert.equal(await status(T0), "scheduled");
  assert.deepEqual((await t.daily())!.days, { "2026-11-02": { attempts: 0, nextAt: T0 + 60_000 } });
  assert.equal(await status(T0 + 30_000), "waiting");
  assert.equal(t.calls.length, 0);

  // Due: the attempt is spent before anything is written, the next is 24 h / 3 away, and the job runs in the background.
  const due = await t.due(T0 + 60_000, { random: () => 0 });
  assert.deepEqual(due, { status: "queued", latest: null });
  assert.deepEqual((await t.daily())!.days["2026-11-02"], { attempts: 1, nextAt: T0 + 60_000 + 8 * HOUR });
  assert.equal(await status(T0 + 61_000), "busy", "one attempt at a time");
  await t.drain();

  // Fisher-Yates with random 0 puts Mireille first; her thread gets his message, unseen, so it counts as unread.
  const thread = (await t.thread(MIR))!;
  assert.deepEqual(
    thread.messages.map((message) => [message.who, message.text]),
    [["li", DAILY.messages[0]!.text]],
  );
  assert.deepEqual([thread.seenAt, unreadCount(thread), "suggestions" in thread], [null, 1, false]);
  assert.equal(await t.thread(KAI), null);
  const latest = (await t.daily())!.last!;
  assert.deepEqual([latest.li, latest.at], [MIR, thread.messages[0]!.at]);
  const unread = await t.phone("GET", "/runs/:run/phone");
  assert.equal(unread.body.threads.find((row: { li: string }) => row.li === MIR).unread, 1);

  // One P17 call, on the chat connection inside the Engine's background admission, written as him writing first.
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0]!.connectionId, "conn-chat");
  assert.deepEqual(t.admitted, ["conn-chat background"]);
  const prompt = t.calls[0]!.messages.at(-1)!.content;
  assert.ok(prompt.includes(FIRST_LINE), prompt.slice(-600));
  assert.ok(prompt.includes("THE THREAD NOW (oldest first)\n(no messages yet)"));
  assert.ok(!prompt.includes("answering Ines"));
  assert.ok(
    t.logs.some((log) => log.args.some((arg) => String(arg).includes("phone-daily/"))),
    "its prompt is logged",
  );

  // The heartbeat reports the newest one, so the client reads the phone again; the next attempt is 8 h away.
  assert.deepEqual(await t.due(T0 + 120_000), { status: "waiting", latest });
  assert.equal(t.calls.length, 1);
  // Back after a gap three hours later: re-arming keeps the interval already set rather than a minute from now.
  assert.equal(await status(T0 + 3 * HOUR), "scheduled");
  assert.equal((await t.daily())!.days["2026-11-02"]!.nextAt, T0 + 60_000 + 8 * HOUR);
  assert.equal(await status(T0 + 3 * HOUR + 61_000), "waiting");
  // After a long gap the app re-arms (a minute, never sooner than the interval already set)…
  assert.equal(await status(T0 + 60_000 + 8 * HOUR), "scheduled");
  assert.equal((await t.daily())!.days["2026-11-02"]!.nextAt, T0 + 120_000 + 8 * HOUR);
  // …and at 17:02 the next attempt is capped at the local midnight, so the third waits for tomorrow's count.
  assert.equal(await status(T0 + 120_000 + 8 * HOUR, { random: () => 0.999 }), "queued");
  await t.drain();
  assert.deepEqual((await t.daily())!.days["2026-11-02"], {
    attempts: 2,
    nextAt: Date.UTC(2026, 10, 3),
    wrote: [MIR, KAI],
  });
  assert.equal((await t.thread(KAI))!.messages.length, 1, "random 0.999 keeps the cast order: Kai");
  assert.equal(await status(T0 + 180_000 + 8 * HOUR), "waiting");
});

test("daily messages: the limit is how many love interests write first a day, each once, spread over those met", async () => {
  // The maintainer's setting of 2: two love interests a day, never one of them twice.
  const t = await dailyWorld("r-daily6-aaaaaa", { limit: 2 });
  const status = async (now: number) => (await t.due(now, { random: () => 0 })).status;
  assert.equal(await status(T0), "scheduled");
  assert.equal(await status(T0 + 60_000), "queued");
  await t.drain();
  // Random 0 puts Mireille first whenever she may write; 24 h / 2 to the next.
  assert.deepEqual((await t.daily())!.days["2026-11-02"], {
    attempts: 1,
    nextAt: T0 + 60_000 + 12 * HOUR,
    wrote: [MIR],
  });
  assert.equal(await status(T0 + 60_000 + 12 * HOUR), "scheduled");
  assert.equal(await status(T0 + 120_000 + 12 * HOUR), "queued");
  await t.drain();
  assert.equal((await t.thread(MIR))!.messages.length, 1, "Mireille wrote first today already");
  assert.equal((await t.thread(SOL))!.messages.length, 1, "random 0 among the others puts Sol first");
  assert.deepEqual((await t.daily())!.days["2026-11-02"]!.wrote, [MIR, SOL]);
  assert.equal(await status(T0 + 180_000 + 12 * HOUR), "quota");
  // The next day she may write again.
  const tomorrow = Date.UTC(2026, 10, 3, 9);
  assert.equal(await status(tomorrow), "scheduled");
  assert.equal(await status(tomorrow + 60_000), "queued");
  await t.drain();
  assert.equal((await t.thread(MIR))!.messages.length, 2);
  assert.deepEqual((await t.daily())!.days["2026-11-03"]!.wrote, [MIR]);
});

test("daily messages: a limit above the cast spreads over those met, and nobody writes first twice a day", async () => {
  const t = await dailyWorld("r-daily7-aaaaaa", { limit: 24 });
  const status = async (now: number) => (await t.due(now, { random: () => 0 })).status;
  /** 01:00 UTC, so three attempts 8 h apart fit in the day. */
  const early = Date.UTC(2026, 10, 2, 1);
  assert.equal(await status(early), "scheduled");
  assert.equal(await status(early + 60_000), "queued");
  await t.drain();
  // 24 h over the three met, not over 24.
  assert.equal((await t.daily())!.days["2026-11-02"]!.nextAt, early + 60_000 + 8 * HOUR);
  for (const at of [early + 8 * HOUR, early + 16 * HOUR]) {
    assert.equal(await status(at + 60_000), "scheduled");
    assert.equal(await status(at + 120_000), "queued");
    await t.drain();
  }
  assert.deepEqual((await t.daily())!.days["2026-11-02"]!.wrote, [MIR, SOL, KAI]);
  for (const li of [MIR, SOL, KAI]) assert.equal((await t.thread(li))!.messages.length, 1, li);
  assert.equal((await t.due(early + 16 * HOUR + 180_000)).status, "no-eligible", "each of them wrote today");
});

test("daily messages count each local day of the request's zone, and a spent attempt is never retried", async () => {
  const refusal = "I can't help with writing that.";
  const t = await dailyWorld("r-daily2-aaaaaa", { limit: 1, replies: [refusal, refusal, ...phoneModel(DAILY)] });
  // Kiritimati is UTC+14: 09:00 UTC is 23:00 there on 2 November.
  const kiritimati = { timeZone: "Pacific/Kiritimati" };
  assert.equal((await t.due(T0, kiritimati)).status, "scheduled");
  assert.equal((await t.due(T0 + 60_000, kiritimati)).status, "queued");
  await t.drain();
  // The model declined twice: nothing landed, and the day's one attempt is gone, never tried again.
  assert.equal(t.calls.length, 2);
  assert.equal((await t.daily())!.last, undefined);
  assert.deepEqual((await t.daily())!.days["2026-11-02"], { attempts: 1, nextAt: Date.UTC(2026, 10, 2, 10) });
  assert.equal((await t.due(T0 + 90_000, kiritimati)).status, "quota");
  assert.equal(t.calls.length, 2);

  // Just after 10:00 UTC it is 3 November in Kiritimati, so the count starts again there, but not in UTC.
  const after = Date.UTC(2026, 10, 2, 10, 0, 30);
  assert.equal((await t.due(after)).status, "quota");
  assert.equal((await t.due(after + 1_000, kiritimati)).status, "scheduled");
  assert.equal((await t.due(after + 61_000, kiritimati)).status, "queued");
  await t.drain();
  assert.deepEqual((await t.daily())!.days["2026-11-03"]!.attempts, 1);
  assert.equal(t.firstCalls().length, 3, "the failed attempt and its repair turn, then the new day's");
  assert.equal((await t.daily())!.last!.li, MIR);
});

test("daily messages skip the open thread, a busy one and one waiting on her message, and never wait on the story", async () => {
  const t = await dailyWorld("r-daily3-aaaaaa", { limit: 24 });
  // Nobody is met before a chapter is read, and the prologue meets no one: nothing is armed or spent.
  const chapters = (await t.store.readDoc(stateId(t.runId), normalizeState))!.chapters;
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: {
      [PROLOGUE_KEY]: { beatsRead: 1, completed: "2026-11-02T08:00:00.000Z", applied: [] },
      "main-1": { ...state.chapters["main-1"]!, completed: null },
    },
  }));
  assert.equal((await t.due(T0 - 1_000, { open: null })).status, "no-eligible");
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({ ...state, chapters }));
  // Kai's open conversation ends on her message, Mireille's thread is open, and Sol's reply is being written.
  await t.store.mutateDoc(chatTarget(t.runId, KAI), normalizeThread, (thread) => ({
    ...thread,
    messages: [{ id: "m-her-0001", who: "player", text: "Are you there?", at: "2026-11-02T08:00:00.000Z" }],
  }));
  let releaseSol!: () => void;
  const solBusy = inThreadLock(t.runId, SOL, () => new Promise<void>((resolve) => (releaseSol = resolve)));
  assert.equal((await t.due(T0, { open: MIR })).status, "no-eligible");
  assert.equal(await t.daily(), undefined, "nothing armed or spent");
  releaseSol();
  await solBusy;

  // She leaves it, then opens it again: reading a thread marks it open until the next heartbeat names another. The
  // story's foreground queue is held the whole time.
  assert.equal((await t.due(T0 + 1_000, { open: null })).status, "scheduled");
  assert.equal((await t.phone("GET", page, { li: MIR })).status, 200);
  let releaseStory!: () => void;
  const story = runForeground(t.runId, () => new Promise<void>((resolve) => (releaseStory = resolve)));
  // Random 0.999 keeps the cast order, so Mireille would come first were her thread not open.
  assert.equal((await t.due(T0 + 61_000, { random: () => 0.999 })).status, "queued");
  await t.drain();
  assert.equal((await t.thread(SOL))!.messages.length, 1, "Sol, the only one free, wrote while the story waited");
  assert.equal(await t.thread(MIR), null);
  assert.equal((await t.thread(KAI))!.messages.length, 1);
  releaseStory();
  await story;

  // Leaving Mireille's thread (the heartbeat says none is open) lets her write; Kai still waits on Ines. The limit of
  // 24 spreads over the three met: 8 h apart.
  await t.store.mutateDoc(chatTarget(t.runId, SOL), normalizeThread, (thread) => ({
    ...thread,
    messages: [...thread.messages, { id: "m-her-0002", who: "player", text: "Hi Sol", at: "2026-11-02T09:05:00.000Z" }],
  }));
  assert.equal((await t.due(T0 + 61_000 + 8 * HOUR, { open: null })).status, "scheduled");
  assert.equal((await t.due(T0 + 121_000 + 8 * HOUR, { open: null })).status, "queued");
  await t.drain();
  assert.equal((await t.thread(MIR))!.messages.length, 1);
  assert.equal(t.firstCalls().length, 2);
});

test("a daily message holds his thread while it is written, and is dropped when the thread changed meanwhile", async () => {
  const t = await dailyWorld("r-daily4-aaaaaa", { limit: 24 });
  const release = gateFirstCall(t.runtime);
  assert.equal((await t.due(T0)).status, "scheduled");
  assert.equal((await t.due(T0 + 60_000, { random: () => 0.999 })).status, "queued");
  await release.reached;
  // Kai is typing: the list says so, and a send of hers there is busy until he is done.
  const list = await t.phone("GET", "/runs/:run/phone");
  assert.equal(list.body.threads.find((row: { li: string }) => row.li === KAI).busy, true);
  const busy = await t.phone("POST", send, { li: KAI, body: { text: "Kai?" } });
  assert.deepEqual([busy.status, busy.body.code], [409, "busy"]);
  // Another writer changes the thread before his message is saved: it is dropped, and the attempt stays spent.
  await t.store.mutateDoc(chatTarget(t.runId, KAI), normalizeThread, (thread) => ({
    ...thread,
    messages: [{ id: "m-else-0001", who: "li", text: "Written elsewhere.", at: "2026-11-02T09:01:00.000Z" }],
  }));
  release();
  await t.drain();
  assert.deepEqual(
    (await t.thread(KAI))!.messages.map((message) => message.text),
    ["Written elsewhere."],
  );
  assert.equal((await t.daily())!.last, undefined);
  assert.equal((await t.daily())!.days["2026-11-02"]!.attempts, 1);
  assert.ok(t.logs.some((log) => log.level === "info" && log.message.includes("daily message")));
});

test("P17 written first changes only its task line: the same role, rules, boundary and contract", async () => {
  const t = await phoneWorld("r-daily5-aaaaaa");
  const run = (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  const unit = (await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!;
  const input = {
    world: run,
    player: { name: "Ines", pronouns: { subject: "she", object: "her", possessive: "her" }, traits: [], about: "" },
    unit,
    liState: (await t.state()).lis[KAI]!,
    tail: [],
    memories: [],
    story: "",
  };
  const reply = chatReplyMessages(input);
  const first = chatReplyMessages({ ...input, first: true });
  assert.equal(first[0]!.content, reply[0]!.content, "the system message is the same");
  const lines = (messages: typeof reply) => messages[1]!.content.split("\n");
  const changed = lines(first).filter((line) => !lines(reply).includes(line));
  assert.equal(changed.length, 1);
  assert.ok(changed[0]!.includes(FIRST_LINE));
  assert.ok(lines(first).includes("(no messages yet)"));
});
