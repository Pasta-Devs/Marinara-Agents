// Otome Hearth 0.20.4, a chapter's small memories (the maintainer's: cached, and never switching between scenes):
// - a chapter's first scene recalls the small memories for everyone in its nodes, and saves the ones it sent on the
//   chapter, which the client never sees;
// - every scene of the chapter, and its Confrontation, sends exactly those, as a cached system message of its own
//   right after the story context, whoever is in the scene and whatever memory is made meanwhile, which waits for the
//   next chapter;
// - a love interest outside the chapter never has their small memories in it.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";
import { fitForgeMemoryPrompt, forgeComposeMemoryPrompt } from "@forge-kit/story-memory-fit.mjs";
import { createOtomeMemory } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import {
  chatTarget,
  normalizeThread,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts";
import {
  chapterId,
  runDocTarget,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  normalizeChapter,
  toChapterView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import {
  POOL_HEADING,
  recallText,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import {
  KAI,
  MIR,
  SOL,
  at,
  beatReply,
  confrontationReply,
  isConfrontationPrompt,
  json,
  planReply,
  storyWorld,
} from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];

const beatPath = "/runs/:run/chapters/:key/beats/:i";
const isPlanner = (messages: Messages) =>
  messages.some((message) => message.role === "system" && message.content.includes("chapter planner"));
const nodeOf = (messages: Messages) =>
  Number(/(?:Narrate|Write the confrontation of) node (\d+) of/.exec(messages.at(-1)!.content)?.[1] ?? 0) - 1;
const memoriesOf = (messages: Messages) => messages.find((message) => message.content.startsWith("RECALLED MEMORIES"));

/** A closed phone conversation with `li`, its memory `text`, closed at `closedAt`. */
async function phoneMemory(
  t: Awaited<ReturnType<typeof storyWorld>>,
  li: string,
  name: string,
  memories: Array<{ text: string; closedAt: string }>,
) {
  await t.store.mutateDoc(chatTarget(t.runId, li), normalizeThread, (thread) => ({
    ...thread,
    li,
    messages: memories.flatMap((_, n) => [
      { id: `m-${li}-${n}a`, who: "player" as const, text: "Hello.", at },
      { id: `m-${li}-${n}b`, who: "li" as const, text: "Hello.", at },
    ]),
    sessions: memories.map(({ text, closedAt }, n) => ({
      start: n * 2,
      count: 2,
      memory: { text, quote: "" },
      closedAt,
      name,
    })),
  }));
}

test("a chapter's small memories are chosen once for everyone in it, and every scene sends them cached", async () => {
  const replies = Array.from({ length: 60 }, () => (messages: Messages) => {
    if (isPlanner(messages)) return json(planReply());
    if (isConfrontationPrompt(messages)) return json(confrontationReply());
    return json(beatReply());
  });
  const t = await storyWorld({ runKey: "r-pool-aaaaaa", replies });
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  t.deps.memory = memory;
  try {
    await phoneMemory(t, KAI, "Kai", [{ text: "KAI-DM: they talked about the north light.", closedAt: at }]);
    await phoneMemory(t, MIR, "Mireille", [{ text: "MIR-DM: she asked about the ledger.", closedAt: at }]);
    await phoneMemory(t, SOL, "Sol", [{ text: "SOL-DM: he sent a song.", closedAt: at }]);

    const planned = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
    assert.equal(planned.status, 200, JSON.stringify(planned.body));
    const key = "main-1";
    const node = (i: number) => ({ key, i: String(i) });
    // Chapter 1 brings everyone in; Sol is taken out of his one node, so he is in none of it.
    await t.store.updateDoc(runDocTarget("chapter", chapterId(t.runId, key)), normalizeChapter, (chapter) =>
      chapter
        ? { ...chapter, nodes: chapter.nodes.map((entry) => (entry.i === 3 ? { ...entry, cast: [KAI] } : entry)) }
        : chapter,
    );
    assert.equal((await t.call("POST", beatPath, {}, node(0))).status, 200);
    await t.settle();
    // The first scene saved what it sent: Kai's and Mireille's, never Sol's, who is in no node.
    const saved = (await t.store.readDoc(chapterId(t.runId, key), normalizeChapter))!;
    assert.equal(saved.memories?.length, 2, JSON.stringify(saved.memories));
    assert.equal("memories" in toChapterView(saved), false, "the client never sees them");

    // A memory made after the chapter chose its own waits for the next chapter.
    await phoneMemory(t, KAI, "Kai", [
      { text: "KAI-DM: they talked about the north light.", closedAt: at },
      { text: "KAI-LATER: he wrote after the bell.", closedAt: "2026-10-28T12:00:00.000Z" },
    ]);
    for (let i = 1; i <= 4; i += 1) {
      assert.equal((await t.call("POST", beatPath, {}, node(i))).status, 200, `node ${i}`);
      await t.settle();
    }

    const calls = t.calls.filter(
      (call) => /Narrate node \d+ of/.test(call.messages.at(-1)!.content) || isConfrontationPrompt(call.messages),
    );
    const byNode = new Map(calls.map((call) => [nodeOf(call.messages), call.messages]));
    assert.deepEqual([...byNode.keys()].sort(), [0, 1, 2, 3, 4, 5], "every node through the Confrontation");
    const first = memoriesOf(byNode.get(0)!)!;
    assert.ok(first, "the first scene sends them");
    assert.match(first.content, /KAI-DM/u);
    assert.match(first.content, /MIR-DM/u, "Mireille's too, in a scene she is not in: they are the chapter's");
    assert.doesNotMatch(first.content, /SOL-DM/u, "never a love interest outside the chapter");
    assert.match(first.content, /private: only Mireille and the protagonist know what was said/u, "titled whose");
    for (const [i, messages] of byNode) {
      const sent = memoriesOf(messages);
      assert.equal(sent?.content, first.content, `node ${i} sends the same memories`);
      assert.equal(sent?.cacheBreakpoint, true, `node ${i}: a cached part`);
      assert.equal(messages.indexOf(sent!), 1, `node ${i}: right after the story context`);
      assert.ok(messages[0]!.cacheBreakpoint, `node ${i}: the story context is cached too`);
      assert.ok(messages.filter((message) => message.cacheBreakpoint).length <= 4, `node ${i}: at most four marks`);
      assert.doesNotMatch(messages.at(-1)!.content, /# Recalled memory/u, `node ${i}: none after the cached part`);
      assert.doesNotMatch(JSON.stringify(messages), /KAI-LATER/u, `node ${i}: the later memory waits`);
    }
    assert.ok(isConfrontationPrompt(byNode.get(5)!), "node 6 is the Confrontation");

    // A chosen memory deleted meanwhile is left out of the scenes after; the others stay as chosen.
    await t.store.mutateDoc(chatTarget(t.runId, MIR), normalizeThread, (thread) => ({ ...thread, sessions: [] }));
    // The scenes are read and the Confrontation is played first: the scene after it follows its stances.
    for (let i = 0; i <= 5; i += 1) {
      if (i === 5) assert.equal((await t.call("POST", beatPath, {}, node(5))).status, 200);
      if (i < 5) assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(i))).status, 200);
    }
    for (let round = 1; round <= 3; round += 1) {
      const played = await t.call("POST", `${beatPath}/stance`, { round, stance: "hold" }, node(5));
      assert.equal(played.status, 200, JSON.stringify(played.body));
    }
    assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(5))).status, 200);
    assert.equal((await t.call("POST", beatPath, {}, node(6))).status, 200);
    await t.settle();
    const last = t.calls.filter((call) => /Narrate node 7 of/.test(call.messages.at(-1)!.content)).at(-1)!.messages;
    const after = memoriesOf(last)!.content;
    assert.match(after, /KAI-DM/u);
    assert.doesNotMatch(after, /MIR-DM|KAI-LATER/u);

    // The next chapter's first scene would choose afresh, the later memory among them.
    const fresh = await recallText({ store: t.store, memory, runtime: t.runtime }, t.runId, {
      job: "narration",
      cast: [KAI],
      cached: {},
      continues: "main",
      pool: { cast: [KAI, MIR] },
    });
    assert.match(fresh.pool?.text ?? "", /KAI-LATER/u);
    assert.equal(fresh.memories?.length, 2, "Kai's two; Mireille's was deleted");
  } finally {
    memory.dispose();
  }
});

test("a chapter's small memories are saved only from a pool that was read, in story order", async () => {
  const t = await storyWorld({ runKey: "r-pool-bbbbbb" });
  const item = (id: string, order: number) => ({ id, title: `${id} (private)`, content: `${id} text`, order });
  const stub = (recall: Record<string, unknown>) => ({
    recall: async () => ({ text: "", details: [], maxContext: null, ...recall }) as never,
    maintain: async () => true,
  });
  const options = {
    job: "narration" as const,
    cast: [KAI],
    cached: {},
    continues: "main" as const,
    pool: { cast: [KAI] },
  };
  const read = await recallText(
    { store: t.store, memory: stub({ recalls: [item("a", 1), item("b", 2)] }) },
    t.runId,
    options,
  );
  assert.deepEqual(read.memories, ["a", "b"], "in story order, as they go");
  assert.match(read.pool?.text ?? "", /# Recalled memory: a \(private\)[\s\S]*# Recalled memory: b \(private\)/u);
  const failed = await recallText(
    { store: t.store, memory: stub({ recalls: [], poolFailed: true }) },
    t.runId,
    options,
  );
  assert.equal(failed.memories, undefined, "a pool that failed is chosen again next time");
  const none = await recallText({ store: t.store, memory: stub({ recalls: [] }) }, t.runId, options);
  assert.deepEqual(none.memories, [], "an empty pool is a choice too");
});

test("a scene too long for its context sends all of the chapter's small memories or none (Dottore on #2198)", async () => {
  const t = await storyWorld({ runKey: "r-pool-cccccc" });
  const memories = ["one", "two", "three"].map((id, order) => ({
    id,
    title: `${id} (private)`,
    content: `${id.toUpperCase()}-MEMORY ${"words ".repeat(200)}`,
    order,
  }));
  const memory = {
    recall: async () => ({ text: "", details: [], maxContext: null, recalls: memories }) as never,
    maintain: async () => true,
  };
  const context = await recallText({ store: t.store, memory }, t.runId, {
    job: "narration",
    cast: [KAI],
    cached: {},
    continues: "main",
    pool: { cast: [KAI], ids: ["one", "two", "three"] },
  });
  const pool = context.pool!;
  assert.equal(pool.details.length, 1, "one item for the fitter: all of them or none");
  assert.equal(pool.optional.length, 0);
  const sent = pool.text;
  assert.ok(sent.startsWith(`${POOL_HEADING}\n# Recalled memory: one (private)`), sent.slice(0, 120));
  assert.ok(sent.includes("THREE-MEMORY"));
  const messages = forgeComposeMemoryPrompt(
    () => [
      { role: "system", content: "STORY CONTEXT" },
      { role: "system", content: sent },
      { role: "user", content: `Narrate node 9 of 9. ${"scene ".repeat(400)}` },
    ],
    [pool, context],
  );
  const estimate = (list: Array<{ content: string }>) =>
    list.reduce((sum, message) => sum + estimateTextTokens(message.content), 0);
  const fit = (room: number) =>
    fitForgeMemoryPrompt(messages, {
      maxContext: estimate(messages) + 1024 + room,
      maxTokens: 1024,
      estimateMessages: estimate,
      safetyTokens: 0,
      minOutputTokens: 256,
    });
  assert.equal(fit(0).messages[1]!.content, sent, "with room, all of them");
  // A few hundred tokens short: a recall pool would give way one memory at a time here.
  const squeezed = fit(-300);
  assert.equal(squeezed.droppedDetails, 1);
  assert.equal(squeezed.messages[1]!.content, "", "all of them give way together, never one by one");
});
