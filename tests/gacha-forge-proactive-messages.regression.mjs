import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createForgeProactiveMessages,
  forgeProactiveChatMessages,
  normalizeForgeDailyUnitMessages,
} from "../packages/gacha-forge/src/proactive-messages-server.mjs";
import { withForgeChatSend } from "../packages/gacha-forge/src/chat-continuity-server.mjs";
import { forgeDayKey, forgeTimeZoneRoutes, forgeResetIn } from "../packages/gacha-forge/src/time-zone-server.mjs";

const runId = "proactive-proof";
const unitId = `${runId}:unit:arden`;
const chatId = `${runId}:chat:arden`;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};

function fixture({ limit = 2, reply = async () => ({ ok: true, value: "How has your day been?" }), random } = {}) {
  const docs = new Map();
  const seed = (id, kind, data) => docs.set(id, { id, kind, packageId: "gacha-forge", revision: 1, data });
  seed("index", "index", { activeRunId: runId, runs: [{ runId, story: { dailyUnitMessages: limit } }] });
  seed(`${runId}:session`, "session", { roster: { [unitId]: { bondFights: 2 } }, progress: { 1: { normal: 1 } } });
  seed(unitId, "unit", { kind: "character", name: "Arden", cardId: "arden-card" });
  seed(chatId, "chat", { messages: [{ id: "old", who: "unit", text: "Earlier message." }], sessions: [] });
  let clock = Date.parse("2026-10-25T10:00:00Z");
  let tail = Promise.resolve();
  let failCommit = false;
  const store = {
    async getById(_package, id) {
      return structuredClone(docs.get(id) || null);
    },
    async list(_package, kind) {
      return structuredClone([...docs.values()].filter((doc) => doc.kind === kind));
    },
    async create(doc) {
      assert.equal(docs.has(doc.id), false);
      const saved = { ...structuredClone(doc), revision: 1 };
      docs.set(doc.id, saved);
      return saved;
    },
    async update(doc) {
      const old = docs.get(doc.id);
      if (failCommit && doc.id === `${runId}:session` && doc.data.proactiveMessages?.pending?.status === "sent")
        throw new Error("Controlled atomic failure");
      if (old?.revision !== doc.expectedRevision) return null;
      const saved = { ...old, ...structuredClone(doc), revision: old.revision + 1 };
      delete saved.expectedRevision;
      docs.set(doc.id, saved);
      return saved;
    },
  };
  const persistence = {
    documents: store,
    transaction(work) {
      const result = tail.then(async () => {
        const saved = structuredClone(docs);
        try {
          return await work({ documents: store });
        } catch (error) {
          docs.clear();
          for (const entry of saved) docs.set(...entry);
          throw error;
        }
      });
      tail = result.catch(() => {});
      return result;
    },
  };
  const calls = [];
  const contexts = [];
  let contextValid = true;
  const create = () =>
    createForgeProactiveMessages({
      packageId: "gacha-forge",
      persistence,
      isUnlocked: (unit, own) => unit.kind === "character" && !unit.isProtagonist && own.bondFights >= 2,
      withChatSend: withForgeChatSend,
      dayKey: forgeDayKey,
      resetIn: forgeResetIn,
      now: () => clock,
      random,
      readContext: async (input) => {
        contexts.push(input);
        return { messages: [{ role: "user", content: "Controlled played context." }], cardFingerprint: "canon-v1" };
      },
      contextStillCurrent: async () => contextValid,
      generate: async (input) => {
        calls.push(input);
        return reply(input);
      },
    });
  const manager = create();
  return {
    docs,
    seed,
    calls,
    contexts,
    persistence,
    manager,
    create,
    time: () => clock,
    advance: (milliseconds) => (clock += milliseconds),
    day: () => forgeDayKey(clock),
    session: () => docs.get(`${runId}:session`).data,
    run: () => docs.get("index").data.runs[0],
    due: (body = {}) => manager.due({ runId, ...body }),
    contextValid: (value) => (contextValid = value),
    failCommit: (value) => (failCommit = value),
  };
}

async function ready(f) {
  assert.equal((await f.due()).status, "scheduled");
  f.advance(60_000);
}

test("daily quota accepts safe typed integers and canonical numeric strings without a small UX maximum", () => {
  for (const value of [0, 1, 10_000, Number.MAX_SAFE_INTEGER, "0", "10000"])
    assert.equal(normalizeForgeDailyUnitMessages(value), Number(value));
  for (const value of [undefined, null, true, false, -1, 1.5, Infinity, NaN, 2 ** 53, "", " 2 ", "1.5", "02", "1e3"])
    assert.equal(normalizeForgeDailyUnitMessages(value), 0);
});

test("disabled, locked, weapons, protagonist and inactive worlds make no context/provider calls", async () => {
  for (const mutate of [
    (f) => (f.run().story.dailyUnitMessages = 0),
    (f) => (f.session().roster[unitId].bondFights = 1),
    (f) => (f.docs.get(unitId).data.kind = "weapon"),
    (f) => (f.docs.get(unitId).data.isProtagonist = true),
    (f) => (f.docs.get("index").data.activeRunId = "different-world"),
  ]) {
    const f = fixture();
    mutate(f);
    await f.due();
    assert.equal(f.calls.length, 0);
    assert.equal(f.contexts.length, 0);
    assert.equal(f.session().proactiveMessages, undefined);
  }
});

test("first poll schedules, one due attempt appends to existing history without charging player currency", async () => {
  const f = fixture();
  await ready(f);
  assert.equal(f.calls.length, 0);
  const result = await f.due({ debugMode: true });
  assert.equal(result.status, "sent");
  assert.equal(result.unitName, "Arden");
  assert.equal(result.said.who, "unit");
  assert.equal(result.said.proactive, true);
  assert.equal(f.calls[0].debugMode, true);
  assert.equal(f.docs.get(chatId).data.messages.length, 2);
  assert.equal(f.docs.get(chatId).data.messages[0].id, "old");
  assert.equal(f.session().proactiveMessages.days[f.day()].attempts, 1);
  assert.equal(f.session().wallet, undefined);
  assert.equal((await f.due()).status, "waiting");
  assert.equal(f.calls.length, 1);
});

test("reloads and concurrent tabs share durable quota with no duplicate paid attempt", async () => {
  const gate = deferred();
  const started = deferred();
  const f = fixture({ limit: 1, reply: async () => (started.resolve(), await gate.promise) });
  await ready(f);
  const first = f.due();
  await started.promise;
  assert.equal((await f.due()).status, "busy");
  const secondInstance = f.create();
  assert.equal((await secondInstance.due({ runId })).status, "no-eligible");
  gate.resolve({ ok: true, value: "A single new check-in." });
  assert.equal((await first).status, "sent");
  const reopened = f.create();
  assert.equal((await reopened.due({ runId })).status, "quota");
  assert.equal(f.calls.length, 1);
  assert.equal(f.docs.get(chatId).data.messages.length, 2);
});

test("an unlocked character can initiate its first conversation using the ordinary saved chat format", async () => {
  const f = fixture();
  f.docs.delete(chatId);
  await ready(f);
  assert.equal(f.docs.has(chatId), false, "scheduling must not create an empty conversation");
  const result = await f.due();
  assert.equal(result.status, "sent");
  assert.deepEqual(f.docs.get(chatId).data, {
    unitId,
    name: "Arden",
    messages: [result.said],
    sessions: [],
  });
  assert.equal(f.calls.length, 1);
});

test("failed and ambiguous paid attempts are consumed rather than retried on poll or reload", async () => {
  for (const reply of [
    async () => ({ ok: false, error: "provider unavailable" }),
    async () => {
      throw new Error("Ambiguous timeout");
    },
  ]) {
    const f = fixture({ limit: 1, reply });
    await ready(f);
    assert.deepEqual(await f.due(), { ok: false, error: "generation-failed", retry: false });
    assert.equal((await f.due()).status, "quota");
    assert.equal((await f.create().due({ runId })).status, "quota");
    assert.equal(f.calls.length, 1);
    assert.equal(f.docs.get(chatId).data.messages.length, 1);
  }
});

test("capacity failures preserve safe configuration detail without resending the reserved attempt", async () => {
  const f = fixture({
    limit: 1,
    reply: async () => ({
      ok: false,
      error: "generation-output-capacity",
      detail: JSON.stringify({
        minimumOutputTokens: 8192,
        availableContextTokens: 7000,
        configuredMaxOutputTokens: 4096,
        rawProviderText: "DO_NOT_EXPOSE_PROVIDER_CONTENT",
        requestedMaxTokens: Infinity,
      }),
    }),
  });
  await ready(f);
  assert.deepEqual(await f.due(), {
    ok: false,
    error: "generation-failed",
    detail: "generation-output-capacity",
    capacity: { minimumOutputTokens: 8192, availableContextTokens: 7000, configuredMaxOutputTokens: 4096 },
    retry: false,
  });
  assert.equal((await f.due()).status, "quota");
  assert.equal(f.calls.length, 1);
  assert.equal(f.docs.get(chatId).data.messages.length, 1);
});

test("an interrupted durable reservation is never reissued by a new process", async () => {
  const f = fixture({ limit: 1 });
  f.session().proactiveMessages = {
    days: { [f.day()]: { attempts: 1, nextAt: f.time() } },
    lastSeenAt: f.time(),
    sourceRevision: f.docs.get("index").revision,
    pending: { id: "already-paid", boot: "prior-process", status: "generating" },
  };
  assert.equal((await f.due()).status, "quota");
  assert.equal(f.session().proactiveMessages.pending.status, "interrupted");
  assert.equal(f.calls.length, 0);
});

test("returning after inactivity re-arms the initial delay instead of catching up", async () => {
  const f = fixture({ limit: 10 });
  await ready(f);
  f.advance(5 * 3_600_000);
  assert.equal((await f.due()).status, "scheduled");
  assert.equal(f.calls.length, 0);
  f.advance(60_000);
  assert.equal((await f.due()).status, "sent");
  assert.equal((await f.due()).status, "waiting");
  assert.equal(f.calls.length, 1);
});

test("a settings save re-arms pacing without resetting consumed daily attempts", async () => {
  const f = fixture({ limit: 100 });
  await ready(f);
  assert.equal((await f.due()).status, "sent");
  f.advance(60_000);
  f.docs.get("index").revision++;
  assert.equal((await f.due()).status, "scheduled");
  assert.equal(f.calls.length, 1);
  assert.equal(f.session().proactiveMessages.days[f.day()].attempts, 1);
});

test("paid pacing survives a poll gap without shortening its full interval", async () => {
  const f = fixture({ limit: 10 });
  await ready(f);
  const paid = await f.due();
  assert.equal(paid.status, "sent");
  assert.equal(paid.nextAt, f.time() + 86_400_000 / 10);
  f.advance(120_001);
  const resumed = await f.due();
  assert.equal(resumed.status, "scheduled");
  assert.equal(resumed.nextAt, paid.nextAt, "inactivity must not shorten the reserved interval");
  f.advance(60_000);
  assert.equal((await f.due()).status, "waiting");
  assert.equal(f.calls.length, 1);
  assert.equal(f.session().proactiveMessages.days[f.day()].attempts, 1);
});

test("paid pacing survives unrelated wallet and index revision updates", async () => {
  const f = fixture({ limit: 10 });
  await ready(f);
  const paid = await f.due();
  assert.equal(paid.status, "sent");
  f.advance(60_000);
  f.session().wallet = { funds: 200 };
  f.docs.get("index").revision++;
  const refreshed = await f.due();
  assert.equal(refreshed.status, "scheduled");
  assert.equal(refreshed.nextAt, paid.nextAt, "an index write must not shorten the reserved interval");
  f.advance(60_000);
  assert.equal((await f.due()).status, "waiting");
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.session().wallet, { funds: 200 });
});

test("paid pacing remains durable in a fresh service even without last-seen metadata", async () => {
  for (const missingLastSeen of [false, true]) {
    const f = fixture({ limit: 10 });
    await ready(f);
    const paid = await f.due();
    assert.equal(paid.status, "sent");
    f.manager.dispose();
    if (missingLastSeen) delete f.session().proactiveMessages.lastSeenAt;
    const reopened = f.create();
    const resumed = await reopened.due({ runId });
    assert.equal(resumed.status, missingLastSeen ? "scheduled" : "waiting");
    assert.equal(resumed.nextAt, paid.nextAt, "the durable deadline outlives a service instance");
    f.advance(60_000);
    assert.equal((await reopened.due({ runId })).status, "waiting");
    assert.equal(f.calls.length, 1);
    assert.equal(f.session().proactiveMessages.days[f.day()].attempts, 1);
    reopened.dispose();
  }
});

test("paid pacing cannot be shortened by a backwards clock adjustment", async () => {
  const f = fixture({ limit: 10 });
  await ready(f);
  const paid = await f.due();
  assert.equal(paid.status, "sent");
  f.advance(-60_000);
  const adjusted = await f.due();
  assert.equal(adjusted.status, "scheduled");
  assert.equal(adjusted.nextAt, paid.nextAt, "moving the clock back must not advance a paid deadline");
  f.advance(60_000);
  assert.equal((await f.due()).status, "waiting");
  assert.equal(f.calls.length, 1);
});

test("an overdue paid interval resumes after one minute without catching up missed messages", async () => {
  const f = fixture({ limit: 10 });
  await ready(f);
  const paid = await f.due();
  f.advance(paid.nextAt - f.time() + 1);
  const resumed = await f.due();
  assert.equal(resumed.status, "scheduled");
  assert.equal(resumed.nextAt, f.time() + 60_000);
  assert.equal(f.calls.length, 1);
  assert.equal((await f.due()).status, "waiting");
  f.advance(60_000);
  assert.equal((await f.due()).status, "sent");
  assert.equal(f.calls.length, 2);
  assert.equal(f.session().proactiveMessages.days[f.day()].attempts, 2);
  assert.equal((await f.due()).status, "waiting");
});

test("player send and close share the same lock; unresolved player rows keep their retry path", async () => {
  const f = fixture();
  await ready(f);
  await withForgeChatSend(runId, unitId, async () => {
    assert.equal((await f.due()).status, "no-eligible");
    assert.equal(f.calls.length, 0);
  });
  f.docs.get(chatId).data.messages.push({ id: "failed-player", who: "player", text: "Please answer this first." });
  assert.equal((await f.due()).status, "no-eligible");
  assert.equal(f.calls.length, 0);
  f.docs.get(chatId).data.sessions = [{ count: 2 }];
  assert.equal((await f.due()).status, "sent", "an archived player row is no longer an unanswered active send");
});

test("random selection chooses among eligible units under one world-wide daily budget", async () => {
  const picks = [0.999, 0.999, 0]; // Initial scheduling poll, then two actual due selections.
  const f = fixture({ limit: 10000, random: () => picks.shift() });
  const second = `${runId}:unit:briar`;
  f.session().roster[second] = { bondFights: 2 };
  f.seed(second, "unit", { kind: "character", name: "Briar" });
  await ready(f);
  assert.equal((await f.due()).unitId, unitId);
  f.advance(60_000);
  assert.equal((await f.due()).unitId, second);
  assert.equal(f.session().proactiveMessages.days[f.day()].attempts, 2);
});

test("world activation, settings, played context, chat and unit edits fence late results", async () => {
  const changes = [
    (f) => (f.docs.get("index").data.activeRunId = "another-world"),
    (f) => (f.run().story.dailyUnitMessages = 0),
    (f) => f.docs.get("index").revision++,
    (f) => f.session().progress[1].normal++,
    (f) => (f.session().reading = { chapter: 1, storyIndex: 0, at: 2 }),
    (f) => (f.session().bondChapters = { [unitId]: { beats: 1 } }),
    (f) => f.session().roster[unitId].bondFights++,
    (f) => f.seed(`${runId}:beat:1:0`, "beat", { choiceCanon: { "choice-1": "option-2" } }),
    (f) => f.docs.get(chatId).revision++,
    (f) => (f.docs.get(unitId).data.cardId = "another-card"),
    (f) => f.docs.delete(unitId),
    (f) => f.contextValid(false),
  ];
  for (const change of changes) {
    const gate = deferred();
    const started = deferred();
    const f = fixture({ reply: async () => (started.resolve(), await gate.promise) });
    await ready(f);
    const pending = f.due();
    await started.promise;
    change(f);
    gate.resolve({ ok: true, value: "Stale result must never be saved." });
    assert.equal((await pending).error, "context-changed");
    assert.equal(f.docs.get(chatId).data.messages.length, 1);
  }
});

test("unrelated wallet, vigor, inventory and rank updates do not discard an already-paid check-in", async () => {
  const gate = deferred();
  const started = deferred();
  const f = fixture({ reply: async () => (started.resolve(), await gate.promise) });
  await ready(f);
  const pending = f.due();
  await started.promise;
  Object.assign(f.session(), { wallet: { vigor: 100, funds: 200 }, inventory: { ore: 1 }, account: { level: 30 } });
  gate.resolve({ ok: true, value: "Your check-in is still current." });
  assert.equal((await pending).status, "sent");
  assert.equal(f.docs.get(chatId).data.messages.at(-1).text, "Your check-in is still current.");
  assert.deepEqual(f.session().wallet, { vigor: 100, funds: 200 });
});

test("invalidation and disposal fence a provider that ignores abort, with no deleted-world resurrection", async () => {
  for (const remove of [false, true]) {
    const gate = deferred();
    const started = deferred();
    const f = fixture({ reply: async () => (started.resolve(), await gate.promise) });
    await ready(f);
    const pending = f.due();
    await started.promise;
    if (remove) {
      f.manager.dispose();
      f.docs.clear();
    } else f.manager.invalidate(runId);
    gate.resolve({ ok: true, value: "Late ignored-abort result." });
    assert.equal((await pending).error, "cancelled");
    assert.equal(remove ? f.docs.size : f.docs.get(chatId).data.messages.length, remove ? 0 : 1);
  }
});

test("chat append and reservation settlement roll back together on a storage error", async () => {
  const f = fixture({ limit: 1 });
  await ready(f);
  f.failCommit(true);
  assert.equal((await f.due()).ok, false);
  assert.equal(f.docs.get(chatId).data.messages.length, 1);
  f.failCommit(false);
  assert.equal((await f.due()).status, "quota");
  assert.equal(f.calls.length, 1);
});

test("local-day reset respects the existing timezone route scope, preserving prior date quota", async () => {
  const f = fixture({ limit: 1 });
  let route;
  forgeTimeZoneRoutes({ post: (_path, handler) => (route = handler) }).post("/due", (request) => f.due(request.body));
  const body = { timeZone: "Pacific/Kiritimati" };
  assert.equal((await route({ body })).status, "scheduled");
  f.advance(60_000);
  assert.equal((await route({ body })).status, "sent");
  assert.equal(f.session().proactiveMessages.pending.day, "2026-10-26");
  assert.equal((await route({ body })).status, "quota");
  assert.equal((await route({ body: { timeZone: "America/Adak" } })).status, "scheduled");
  assert.equal((await route({ body })).status, "quota", "returning to the first date cannot reset its quota");
});

test("prompt reuses chat fields, all four authored fields, and played context without roleplay card fields", () => {
  let captured;
  const messages = forgeProactiveChatMessages(
    (context) => {
      captured = context;
      return [
        { role: "system", content: "EXISTING_CHAT_RULES " + context.story },
        { role: "assistant", content: "EARLIER_MESSAGE" },
      ];
    },
    {
      unit: {
        description: "CONTRADICTORY_GENERATED_DESCRIPTION",
        personality: "CONTRADICTORY_GENERATED_PERSONALITY",
        forgeCardCanon: {
          description: "AUTHORED_DESCRIPTION",
          personality: "AUTHORED_PERSONALITY",
          backstory: "Pantalone and Dottore have always been best friends.",
          appearance: "AUTHORED_APPEARANCE",
          scenario: "FORBIDDEN_SCENARIO",
          first_mes: "FORBIDDEN_GREETING",
          mes_example: "FORBIDDEN_EXAMPLES",
        },
      },
      protagonist: { name: "Mari", backstory: "AUTHORED_PLAYER_BACKSTORY", scenario: "FORBIDDEN_PLAYER_SCENARIO" },
      story: "PLAYED_EVENT_CANON",
      photos: true,
    },
  );
  const text = JSON.stringify(messages);
  for (const expected of [
    "EXISTING_CHAT_RULES",
    "PLAYED_EVENT_CANON",
    "AUTHORED_DESCRIPTION",
    "AUTHORED_PERSONALITY",
    "best friends",
    "AUTHORED_APPEARANCE",
    "EARLIER_MESSAGE",
    "NOT a message sent by the player",
  ])
    assert.ok(text.includes(expected), expected);
  for (const forbidden of ["FORBIDDEN_", "CONTRADICTORY_GENERATED_"]) assert.ok(!text.includes(forbidden));
  assert.equal(captured.photos, false);
  assert.equal(captured.protagonist.scenario, undefined);
});
