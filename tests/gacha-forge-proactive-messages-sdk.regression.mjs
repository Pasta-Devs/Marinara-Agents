// Actual activated package routes, saved chat records and controlled local model HTTP.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createChapterRuntime,
  chapterRunId as runId,
  chapterUnitId as unitId,
  currentCardCanon,
} from "./fixtures/gacha-forge-chapter-runtime.mjs";

const timeZone = "UTC";
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
// Background work crosses the fixture's real local HTTP, so waits poll real time with a bound.
async function until(check, label) {
  for (let turn = 0; turn < 500; turn += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`timed out waiting for ${label}`);
}

async function fixture(options) {
  const f = await createChapterRuntime(options);
  // Saving Sources must not launch unrelated missing battle-art prefetch requests.
  f.seed(`${runId}:combat-art`, "combat-art", { effigies: { byKey: {}, hasArt: false } });
  f.transport.stage = "proactive-chat";
  f.transport.reply = (body) => {
    if (String(body.messages?.[0]?.content).includes("Summarize only the supplied canonical story history")) {
      const input = JSON.parse(body.messages.find((message) => message.role === "user").content);
      return JSON.stringify({
        summary:
          input.source?.content ||
          [input.previousOverview, ...input.records.map((row) => row.content)].filter(Boolean).join("\n\n"),
      });
    }
    return "Arden: How is your day going? I was thinking about our promise.";
  };
  f.calls.length = 0;
  f.resolved.length = 0;
  const run = () => f.docs.get("index").data.runs[0];
  return {
    ...f,
    run,
    due: (extra = {}) => f.post("/chat/proactive/due", { timeZone, ...extra }),
    sources: (story) => f.post("/run/sources", { timeZone, sources: { story } }),
    makeDue() {
      const state = f.session().proactiveMessages;
      const day = new Date().toISOString().slice(0, 10);
      assert.ok(state?.days?.[day], "Actual route created today's durable pacing record");
      state.days[day].nextAt = Date.now() - 1;
      state.lastSeenAt = Date.now();
    },
  };
}

test("actual routes default to no proactive paid work and normalize the saved opt-in count", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.due()).body.status, "disabled");
    assert.equal(f.calls.length, 0);
    const saved = await f.sources({ dailyUnitMessages: "3" });
    assert.equal(saved.body.ok, true, JSON.stringify(saved));
    assert.equal(f.run().story.dailyUnitMessages, 3);
    assert.equal((await f.due()).body.status, "scheduled");
    assert.equal(f.calls.length, 0);
    assert.equal((await f.sources({ dailyUnitMessages: -1 })).body.ok, true);
    assert.equal(f.run().story.dailyUnitMessages, 0);
    assert.equal((await f.due()).body.status, "disabled");
    assert.equal(f.calls.length, 0);
  } finally {
    await f.close();
  }
});

test("actual generation uses current four-field canon and played event/story continuity, then appends once", async () => {
  const f = await fixture();
  const summaries = deferred();
  try {
    // Room for background summaries: the fixture's default 10k window leaves them too little output to run at
    // all, so "the message never waits for summaries" would pass without any summary.
    f.transport.maxContext = 32768;
    // Every summary is held until the message is saved: the message must not queue behind one.
    const answer = f.transport.reply;
    f.transport.reply = async (body, transport) => {
      if (String(body.messages?.[0]?.content).includes("Summarize only the supplied canonical story history"))
        await summaries.promise;
      return answer(body, transport);
    };
    f.run().story.dailyUnitMessages = 1;
    // Completed event canon participates in ordinary current-chat memory; prefetched content must not.
    f.seed(`${runId}:chapter:event-1`, "chapter-plan", {
      chapter: "event-1",
      eventId: `${runId}:story-event:1`,
      title: "A remembered lantern festival",
      after: 1,
      opened: 100,
      nodes: [{ type: "story", title: "Friends at the festival" }],
    });
    f.seed(`${runId}:beat:event-1:0`, "beat", {
      chapter: "event-1",
      storyIndex: 0,
      segments: [{ text: "PLAYED_EVENT_FRIENDSHIP_CANON: Arden and Mari watched the lanterns together." }],
    });
    f.session().progress["event-1"] = { normal: 1 };
    f.docs.get(`${runId}:beat:2:6`).data.segments = [{ text: "UNPLAYED_FUTURE_SECRET" }];
    f.chatDoc().data.messages.push({ id: "recent", who: "unit", text: "RECENT_ACTIVE_CHAT_CANON" });
    const originalIds = f.chatDoc().data.messages.map((row) => row.id);
    assert.equal((await f.due()).body.status, "scheduled");
    f.makeDue();
    let answered = false;
    const pending = f.due({ debugMode: true });
    pending.then(
      () => (answered = true),
      () => (answered = true),
    );
    await until(() => answered, "the message while every summary is held");
    const reply = await pending;
    assert.equal(reply.status, 200);
    assert.equal(reply.body.status, "sent", JSON.stringify(reply));
    const messages = f.calls.filter((call) => call.kind === "proactive-chat");
    const paid = () => f.calls.filter((call) => call.kind !== "summary").length;
    assert.equal(messages.length, 1, "Exactly one routed proactive-message request for the reserved attempt");
    assert.equal(
      f.calls.slice(0, f.calls.indexOf(messages[0])).filter((call) => call.kind === "summary").length,
      0,
      "The message never waits for memory summaries; unsummarized canon goes in as written",
    );
    assert.equal(paid(), 1, "Every paid-request scope is counted; no format repair or hidden retry");
    const memory = async () => (await f.post("/story-memory/status")).body.memory;
    assert.equal((await memory()).phase, "pending", "Memory catches up in the background, after the message");
    await until(() => f.calls.some((call) => call.kind === "summary"), "a held background summary");
    summaries.resolve();
    await until(async () => !["pending", "stale"].includes((await memory()).phase), "background memory");
    const settled = await memory();
    assert.equal(settled.phase, "ready", JSON.stringify(settled));
    assert.deepEqual(
      f.docs
        .get(`${runId}:summary:memory`)
        .data.records.map((record) => record.kind)
        .sort(),
      ["chapter", "chat", "story-event"],
      "The completed chapter, the played event and the closed DM session are summarized",
    );
    assert.equal(paid(), 1, "Summaries are the only other requests");
    assert.equal(f.errors.length, 0);
    assert.ok(f.resolved.some((request) => request.connectionId === f.run().connectionId));
    const prompt = JSON.stringify(messages[0].body.messages);
    for (const expected of [
      currentCardCanon,
      "Patient and careful.",
      "They grew up near the lighthouse.",
      "A blue lighthouse coat.",
      "PRESERVED_COMPLETED_CANON",
      "PLAYED_EVENT_FRIENDSHIP_CANON",
      "INDEPENDENT_DM_CANON",
      "RECENT_ACTIVE_CHAT_CANON",
      "Out-of-world generation instruction",
    ])
      assert.ok(prompt.includes(expected), expected);
    for (const forbidden of ["DISALLOWED_CARD_SCENARIO", "UNPLAYED_FUTURE_SECRET"])
      assert.ok(!prompt.includes(forbidden), forbidden);
    assert.ok(f.logs.some((entry) => entry.level === "info" && JSON.stringify(entry.args).includes(currentCardCanon)));
    const saved = f.chatDoc().data.messages;
    assert.deepEqual(
      saved.slice(0, -1).map((row) => row.id),
      originalIds,
    );
    assert.equal(saved.at(-1).proactive, true);
    assert.equal(saved.at(-1).who, "unit");
    assert.equal(saved.at(-1).id, reply.body.said.id);
    const opened = await f.post("/chat/open", { unitId, timeZone });
    assert.ok(opened.body.messages.some((row) => row.id === reply.body.said.id));
    assert.equal((await f.due()).body.status, "quota");
    assert.equal(paid(), 1);
  } finally {
    summaries.resolve();
    await f.close();
  }
});

test("actual locked and unanswered chats make no paid call and keep the normal retry available", async () => {
  const f = await fixture();
  try {
    f.run().story.dailyUnitMessages = 2;
    f.session().roster[unitId].bondFights = 0;
    assert.equal((await f.due()).body.status, "no-eligible");
    f.session().roster[unitId].bondFights = 100000;
    f.chatDoc().data.messages.push({ id: "unanswered", who: "player", text: "Answer this first." });
    assert.equal((await f.due()).body.status, "no-eligible");
    const opened = await f.post("/chat/open", { unitId, timeZone });
    assert.equal(opened.body.retry, true);
    assert.equal(f.calls.length, 0);
  } finally {
    await f.close();
  }
});

test("actual due request coordinates normal send and consumes failed paid attempts without polling retries", async () => {
  const f = await fixture();
  try {
    f.run().story.dailyUnitMessages = 1;
    assert.equal((await f.due()).body.status, "scheduled");
    f.makeDue();
    const started = deferred();
    const gate = deferred();
    f.transport.started = started.resolve;
    f.transport.release = gate.promise;
    const pending = f.due();
    await started.promise;
    assert.equal((await f.due()).body.status, "busy");
    const send = await f.post("/chat/send", { unitId, text: "A parallel send", timeZone });
    assert.equal(send.body.error, "generation-in-progress");
    f.transport.mode = "fail";
    gate.resolve();
    assert.equal((await pending).body.error, "generation-failed");
    const attempted = f.calls.length;
    assert.equal((await f.due()).body.status, "quota");
    assert.equal((await f.due()).body.status, "quota");
    assert.equal(f.calls.length, attempted);
    assert.ok(!f.chatDoc().data.messages.some((row) => row.proactive || row.text === "A parallel send"));
  } finally {
    await f.close();
  }
});

test("actual settings changes fence late provider results and do not append stale messages", async () => {
  const f = await fixture();
  try {
    f.run().story.dailyUnitMessages = 1;
    assert.equal((await f.due()).body.status, "scheduled");
    f.makeDue();
    const started = deferred();
    const gate = deferred();
    f.transport.started = started.resolve;
    f.transport.release = gate.promise;
    f.transport.ignoreAbort = true;
    const pending = f.due();
    await started.promise;
    assert.equal((await f.sources({ dailyUnitMessages: 0 })).body.ok, true);
    gate.resolve();
    assert.ok(["cancelled", "context-changed"].includes((await pending).body.error));
    assert.ok(!f.chatDoc().data.messages.some((row) => row.proactive));
    assert.equal((await f.due()).body.status, "disabled");
  } finally {
    await f.close();
  }
});

test("actual world deletion fences a late provider and never recreates its session or chat", async () => {
  const f = await fixture({ allowWorldDelete: true });
  try {
    f.run().story.dailyUnitMessages = 1;
    assert.equal((await f.due()).body.status, "scheduled");
    f.makeDue();
    const started = deferred();
    const gate = deferred();
    f.transport.started = started.resolve;
    f.transport.release = gate.promise;
    f.transport.ignoreAbort = true;
    const pending = f.due();
    await started.promise;
    const removed = await f.post("/run/delete", { timeZone });
    assert.equal(removed.body.ok, true, JSON.stringify(removed));
    gate.resolve();
    assert.ok(["cancelled", "context-changed"].includes((await pending).body.error));
    assert.ok(![...f.docs.keys()].some((id) => id.startsWith(`${runId}:`)));
    assert.equal((await f.due()).body.status, "inactive");
  } finally {
    await f.close();
  }
});
