// Otome Forge's knowledge boundary across M2b and M3: another love interest's route or repair chapter never reaches a
// love interest's message of the day (P16), line pack (P15) or chat reply (P17), through recall, the ledgers or the
// grievances and disclosures it left behind, while the shared story and their own chapters do; a closed phone session
// stays a `chat` source for its own love interest beside the private chapters, and never reaches another one's reply.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type {
  Beat,
  Chapter,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import { ensureLinePacks } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/lines.ts";
import { serveNote } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/note.ts";
import {
  beatId,
  chapterId,
  runDocTarget,
  stateId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  createOtomeMemory,
  type OtomeMemory,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import {
  CHAT_CANON_BUDGET,
  sendMessage,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts";
import { closeAndRemember } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/memory.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { recallText } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import { KAI, MIR, json, storyWorld } from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];
const system = (messages: Messages) => messages[0]!.content;
const text = (messages: Messages) => messages.map((message) => message.content).join("\n");
const kindOf = (messages: Messages) =>
  system(messages).includes("message of the day")
    ? "note"
    : system(messages).includes("pre-written Home lines")
      ? "pack"
      : system(messages).includes("in your private message thread")
        ? "chat"
        : system(messages).includes("have just finished exchanging messages")
          ? "chat-memory"
          : "summary";

const times = (prefix: string) => ({
  morning: [`${prefix} m1.`, `${prefix} m2.`, `${prefix} m3.`],
  day: [`${prefix} d1.`, `${prefix} d2.`, `${prefix} d3.`],
  night: [`${prefix} n1.`, `${prefix} n2.`, `${prefix} n3.`],
});
const many = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}.`);

/** Answers each prompt by its kind; the summarizer echoes its source, so its text stands for its summary too. */
function reply(messages: Messages): string {
  switch (kindOf(messages)) {
    case "note":
      return json({
        text: "The lamp room was warm today.",
        face: "tender",
        mood: { word: "calm", reason: "quiet harbour" },
      });
    case "pack":
      return json({
        tap: { head: times("Head"), hand: times("Hand"), heart: times("Heart") },
        annoyed: many("Enough", 4),
        cold: many("Cold", 6),
        comfort: many("Rest", 8),
        claw: {
          cheer: many("Go", 4),
          cheat: many("Tilt", 3),
          win: many("Won", 3),
          miss: many("Missed", 3),
          plush: many("Plush", 3),
        },
      });
    case "chat":
      return json({ messages: [{ text: "Awake. Barely." }], suggestions: ["Sleep.", "Me too."] });
    case "chat-memory":
      return json({ memory: "PRIVATE-PHONE-KAI: Kai admitted the bell keeps him up.", quote: "Awake. Barely." });
    default: {
      const input = JSON.parse(messages.at(-1)!.content);
      if (input.source) return json({ summary: `${input.source.title}: ${input.source.content}` });
      return json({ summary: input.records.map((record: { content: string }) => record.content).join(" ") });
    }
  }
}

const at = (hour: number) => `2026-10-28T${String(hour).padStart(2, "0")}:00:00.000Z`;

async function boundaryWorld() {
  const t = await storyWorld({ runKey: "r-own-aaaaaa", replies: Array.from({ length: 80 }, () => reply) });
  /** Completes a chapter whose node i reads lines[i] (one segment, or several). */
  const complete = async (
    chapter: Omit<Chapter, "tags" | "summary" | "ledger" | "connectionId">,
    ...lines: (string | string[])[]
  ) => {
    await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, chapter.key)), normalizeChapter, () => ({
      tags: [],
      summary: "",
      ledger: { relationship: [], conflict: [], offscreen: [] },
      connectionId: "conn-text",
      ...chapter,
    }));
    for (const [i, line] of lines.entries()) {
      const beat: Beat = {
        key: chapter.key,
        i,
        kind: "beat",
        places: [],
        segments: [line].flat().map((text) => ({ speaker: "", text })),
        choices: [],
        choiceCanon: {},
        effects: {},
        applied: {},
        musicMood: "tense",
        readThrough: 0,
        written: { at: chapter.plannedAt, connectionId: "conn-text", model: "fake" },
        rewrites: 0,
      };
      await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, chapter.key, i)), normalizeBeat, () => beat);
    }
    await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
      ...state,
      chapters: {
        ...state.chapters,
        [chapter.key]: { beatsRead: lines.length, completed: chapter.plannedAt, applied: [] },
      },
    }));
  };
  const node = (li: string, count = 1) =>
    Array.from({ length: count }, (_, i) => ({ i, kind: "beat" as const, guide: "The scene.", cast: [li] }));
  // A node at the narrator's length (BEAT_WORDS, about 650 words, in 13 segments), so a route chapter outgrows P17's
  // small budget.
  const prose = (n: number) =>
    Array.from({ length: 13 }, (_, k) =>
      Array.from({ length: 50 }, (_, w) => `tower${(n * 650 + k * 50 + w) % 211}`).join(" "),
    );
  await complete(
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1", nodes: node(KAI), plannedAt: at(9) },
    "SHARED-QUAY: the lanterns along the quay go dark.",
  );
  await complete(
    {
      key: `route-${MIR}-2`,
      kind: "route",
      li: MIR,
      lead: MIR,
      title: "Mireille's Ledger",
      nodes: node(MIR),
      plannedAt: at(10),
    },
    "PRIVATE-LEDGER: Mireille shows Ines the forged pages.",
  );
  await complete(
    {
      key: `repair-${MIR}-1`,
      kind: "repair",
      li: MIR,
      lead: MIR,
      title: "Making It Right",
      nodes: node(MIR),
      plannedAt: at(11),
    },
    "PRIVATE-REPAIR: Mireille gives back the key she took.",
  );
  await complete(
    {
      key: `route-${KAI}-2`,
      kind: "route",
      li: KAI,
      lead: KAI,
      title: "The Bell Tower",
      nodes: node(KAI, 4),
      plannedAt: at(12),
    },
    ["KAI-ROUTE-OPENING: Kai unlocks the tower.", ...prose(0)],
    prose(1),
    prose(2),
    [...prose(3), "KAI-OWN-ROUTE: Kai rings the bell for Ines alone."],
  );
  // What Mireille's own chapters left on Kai's rows, beside what the shared story left.
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => {
    const kai = state.lis[KAI]!;
    return {
      ...state,
      ledgers: {
        ...state.ledgers,
        relationship: [
          { key: "main-1", li: KAI, line: "MAIN-RELATIONSHIP-KAI: he let her hold the lamp." },
          { key: `repair-${MIR}-1`, li: KAI, line: "MIR-REPAIR-RELATIONSHIP-KAI: he saw the key change hands." },
        ],
        offscreen: [
          { key: "main-1", li: KAI, line: "MAIN-OFFSCREEN-KAI: Kai rewired the bell." },
          { key: `route-${MIR}-2`, li: KAI, line: "MIR-ROUTE-OFFSCREEN-KAI: Kai watched Mireille burn a page." },
        ],
      },
      lis: {
        ...state.lis,
        [KAI]: {
          ...kai,
          grievances: [
            {
              id: "g-1",
              li: KAI,
              by: "li",
              text: "KAI-MAIN-GRIEVANCE: the lamp.",
              severity: "minor",
              opened: "main-1/0",
              status: "open",
            },
            {
              id: "g-2",
              li: KAI,
              by: "li",
              text: "MIR-ROUTE-GRIEVANCE: the burned page.",
              severity: "minor",
              opened: `route-${MIR}-2/0`,
              status: "open",
            },
          ],
          disclosures: [
            { text: "KAI-MAIN-DISCLOSURE: she fears the sea.", at: at(9), ref: "main-1/0" },
            { text: "MIR-REPAIR-DISCLOSURE: she kept the key.", at: at(11), ref: `repair-${MIR}-1/0` },
          ],
        },
      },
    };
  });
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  const ready = async () => {
    await memory.maintain({ runId: t.runId });
    for (let turn = 0; turn < 4000 && (await memory.status(t.runId)).phase === "pending"; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal((await memory.status(t.runId)).phase, "ready", "the story memory is ready");
  };
  const recalls: unknown[] = [];
  const watched: OtomeMemory = {
    ...memory,
    recall: (options) => {
      recalls.push(options);
      return memory.recall(options);
    },
  };
  const background = createBackgroundQueue(t.runtime);
  const deps = { ...t.deps, memory: watched, background };
  const prompts = (kind: string) =>
    t.calls.filter((call) => kindOf(call.messages) === kind).map((call) => text(call.messages));
  return { ...t, memory, ready, recalls, background, deps, prompts };
}

const MIREILLE_ONLY = [
  "PRIVATE-LEDGER",
  "PRIVATE-REPAIR",
  "Mireille's Ledger",
  "Making It Right",
  "MIR-REPAIR-RELATIONSHIP-KAI",
  "MIR-ROUTE-OFFSCREEN-KAI",
  "MIR-ROUTE-GRIEVANCE",
  "MIR-REPAIR-DISCLOSURE",
];
const leaked = (prompt: string) => MIREILLE_ONLY.filter((marker) => prompt.includes(marker));

test("another love interest's route or repair chapter never reaches a note, a line pack or a chat reply", async () => {
  const t = await boundaryWorld();
  try {
    await t.ready();
    const sources = await readMemorySources(t.store, t.runId);
    assert.deepEqual(
      sources.map((source) => [source.id, source.kind, source.audience ?? null]),
      [
        ["main-1", "chapter", null],
        [`route-${MIR}-2`, "chat", [MIR]],
        [`repair-${MIR}-1`, "chat", [MIR]],
        [`route-${KAI}-2`, "chat", [KAI]],
      ],
      "Mireille's own chapters are private to her",
    );

    // P16: Kai's note. His latest off-screen line is the shared story's, never one Mireille's route left behind.
    await serveNote(t.deps, t.runId, KAI, { debugMode: false });
    const [note] = t.prompts("note");
    assert.ok(note, "the note was written");
    assert.deepEqual(leaked(note), [], "nothing of Mireille's own chapters in Kai's note");
    assert.ok(note.includes("MAIN-OFFSCREEN-KAI"), "his off-screen line from the shared story");
    assert.ok(
      note.includes("KAI-MAIN-GRIEVANCE") && note.includes("KAI-MAIN-DISCLOSURE"),
      "his own grievance and disclosure",
    );
    const noteRecall = t.recalls[0] as { reader?: string; query?: { cues?: string[] } };
    assert.equal(noteRecall.reader, KAI, "the note recalls as Kai's own reader");
    assert.deepEqual(
      noteRecall.query?.cues,
      ["MAIN-RELATIONSHIP-KAI: he let her hold the lamp.", "MAIN-OFFSCREEN-KAI: Kai rewired the bell."],
      "recall is cued by the rows his own reader may know",
    );

    // P15: Kai's line pack reads only his card and stage.
    assert.deepEqual(await ensureLinePacks(t.deps, t.runId, [KAI], { debugMode: false }), [KAI]);
    for (let turn = 0; turn < 400 && !t.prompts("pack").length; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    const [pack] = t.prompts("pack");
    assert.ok(pack, "the line pack was written");
    assert.deepEqual(leaked(pack), [], "nothing of Mireille's own chapters in Kai's line pack");
    assert.ok(!pack.includes("KAI-OWN-ROUTE") && !pack.includes("SHARED-QUAY"), "a pack reads no story at all");

    // P17: Kai's reply knows the shared story and his own route, never Mireille's; hers knows her own. His route is
    // longer than P17's small budget, so its end goes in rather than nothing.
    await sendMessage(t.deps, t.runId, KAI, { text: "Are you awake?" }, { debugMode: false });
    const [kaiChat] = t.prompts("chat");
    assert.deepEqual(leaked(kaiChat!), [], "nothing of Mireille's own chapters in Kai's reply");
    assert.ok(kaiChat!.includes("SHARED-QUAY") && kaiChat!.includes("KAI-OWN-ROUTE"), "the shared story and his own");
    assert.ok(kaiChat!.includes("# The end of: ") && !kaiChat!.includes("KAI-ROUTE-OPENING"), "his route's end");
    assert.ok(kaiChat!.includes("MAIN-OFFSCREEN-KAI") && kaiChat!.includes("KAI-MAIN-GRIEVANCE"));
    await sendMessage(t.deps, t.runId, MIR, { text: "Still up?" }, { debugMode: false });
    const mirChat = t.prompts("chat")[1]!;
    assert.ok(mirChat.includes("PRIVATE-LEDGER") && mirChat.includes("PRIVATE-REPAIR"), "her own chapters reach her");
    assert.ok(!mirChat.includes("KAI-OWN-ROUTE") && !mirChat.includes("tower"), "and Kai's own route does not");

    // With memory not ready, the canonical history keeps the same rule on the same budget.
    const unready = { ...t.deps, memory: undefined };
    const history = (reader: string) =>
      recallText(unready, t.runId, { job: "chat", reader, query: { cues: [] }, budget: CHAT_CANON_BUDGET });
    const kaiHistory = await history(KAI);
    assert.ok(kaiHistory.includes("KAI-OWN-ROUTE") && kaiHistory.includes("SHARED-QUAY"), "his route's end, unready");
    assert.ok(!kaiHistory.includes("KAI-ROUTE-OPENING"), "cut from its end");
    assert.deepEqual(leaked(kaiHistory), []);
    const mirHistory = await history(MIR);
    assert.ok(mirHistory.includes("PRIVATE-REPAIR") && !mirHistory.includes("tower"), "hers, never his");

    // Kai's closed conversation is a `chat` source for him alone, and never reaches Mireille's next reply.
    await closeAndRemember(t.deps, t.runId, KAI, { debugMode: false });
    await t.ready();
    const phone = (await readMemorySources(t.store, t.runId)).filter((source) => source.id.startsWith("phone-"));
    assert.deepEqual(
      phone.map((source) => [source.kind, source.audience]),
      [["chat", [KAI]]],
    );
    await runForeground(t.runId, async () => undefined);
    await sendMessage(t.deps, t.runId, MIR, { text: "Tell me something." }, { debugMode: false });
    const later = t.prompts("chat").at(-1)!;
    assert.ok(!later.includes("PRIVATE-PHONE-KAI"), "Kai's phone memory never reaches Mireille");
    await sendMessage(t.deps, t.runId, KAI, { text: "Remember?" }, { debugMode: false });
    assert.ok(t.prompts("chat").at(-1)!.includes("PRIVATE-PHONE-KAI"), "it reaches Kai's own reply");
  } finally {
    t.memory.dispose();
    t.background.dispose();
  }
});
