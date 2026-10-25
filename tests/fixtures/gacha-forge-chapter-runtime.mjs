import assert from "node:assert/strict";
import { chatRunId, chatUnitId, createChatRuntime } from "./gacha-forge-chat-runtime.mjs";

export const chapterRunId = chatRunId;
export const chapterUnitId = chatUnitId;
export const currentCardCanon = "CURRENT_AUTHORED_CARD_CANON: Arden guards the lighthouse and honors their friendship.";
export const freshMainPlan = {
  title: "Fresh lighthouse chapter",
  premise: "Keep the established friendship.",
  nodes: Array.from({ length: 10 }, (_, index) =>
    [1, 4, 8].includes(index)
      ? {
          type: "combat",
          title: "A shared challenge",
          setup: "Protect the lighthouse together.",
          tier: index === 8 ? "boss" : index === 4 ? "elite" : "soldier",
        }
      : {
          type: "story",
          title: "A renewed meeting",
          goal: "Talk as friends.",
          guide: "Honor the current character canon.",
        },
  ),
};
export const freshBondPlan = {
  title: "Fresh Character Story",
  premise: "A quiet promise between friends.",
  nodes: Array.from({ length: 3 }, () => ({
    type: "story",
    title: "The promise",
    goal: "Listen to Arden.",
    guide: "Honor their established friendship.",
  })),
};

// Reuse the actual package SDK/HTTP/model transport. Only the disposable document
// store's public transaction contract is controlled; real Engine rollback has separate proof.
export async function createChapterRuntime({ bond = false } = {}) {
  const fixture = await createChatRuntime();
  const { docs, persistence } = fixture;
  // This story fixture already knows its cast; planning must not spend a model
  // request inferring an unrelated missing identity field.
  docs.get(chapterUnitId).data.identitySex = "male";
  docs.get(chapterUnitId).data.cardId = "chapter-proof-arden-card";
  fixture.transport.cards = new Map([
    [
      "chapter-proof-arden-card",
      {
        id: "chapter-proof-arden-card",
        data: {
          name: "Arden",
          description: currentCardCanon,
          personality: "Patient and careful.",
          extensions: { backstory: "They grew up near the lighthouse.", appearance: "A blue lighthouse coat." },
          scenario: "DISALLOWED_CARD_SCENARIO",
        },
      },
    ],
  ]);
  const seed = (id, kind, data) =>
    docs.set(id, {
      id,
      packageId: "gacha-forge",
      kind,
      revision: 1,
      name: id,
      description: "Synthetic chapter proof",
      data: structuredClone(data),
    });
  const session = fixture.session();
  session.progress = { 1: { normal: 10 }, 2: { normal: 3 } };
  session.reading = { chapter: 2, storyIndex: 1, at: 2 };
  session.preforge = { 2: { autos: 1 } };
  seed(`${chapterRunId}:chapter:1`, "chapter-plan", { ...freshMainPlan, title: "Completed lighthouse chapter" });
  seed(`${chapterRunId}:chapter:2`, "chapter-plan", { ...freshMainPlan, title: "Discarded current chapter" });
  for (let story = 0; story < 7; story++) {
    seed(`${chapterRunId}:beat:1:${story}`, "beat", {
      chapter: 1,
      storyIndex: story,
      segments: [{ text: "PRESERVED_COMPLETED_CANON" }],
    });
    seed(`${chapterRunId}:beat:2:${story}`, "beat", {
      chapter: 2,
      storyIndex: story,
      segments: [{ text: "DISCARDED_CURRENT_ONLY" }],
    });
  }
  seed(`${chapterRunId}:cg:2:0`, "cg", { chapter: 2, url: "fixture://old-chapter-image" });
  seed(`${chapterRunId}:summary:2`, "summary", { chapter: 2, digest: "DISCARDED_CURRENT_ONLY" });
  seed(`${chapterRunId}:chat:arden`, "chat", {
    unitId: chapterUnitId,
    name: "Arden",
    messages: [
      { id: "old-player", who: "player", text: "Keep this independent conversation." },
      { id: "old-unit", who: "unit", text: "I remember.", photo: { url: "fixture://preserved-photo" } },
    ],
    sessions: [
      {
        at: 1,
        count: 2,
        chapter: 2,
        memory: "INDEPENDENT_DM_CANON",
        quote: "We remember.",
        memoryPosition: { chapter: 2, nodeIndex: 3 },
      },
    ],
  });
  if (bond) {
    session.bondChapters = { [chapterUnitId]: { beats: 3, after: 1, opened: 100, beats2: 1, after2: 2, opened2: 200 } };
    for (const part of [1, 2]) {
      const chapter = `bond-arden${part > 1 ? `-${part}` : ""}`;
      seed(`${chapterRunId}:chapter:${chapter}`, "chapter-plan", {
        ...freshBondPlan,
        title: part === 1 ? "Completed Character Story" : "Discarded Character Story",
        bondUnitId: chapterUnitId,
        bondPart: part,
        after: part,
      });
      for (let story = 0; story < 3; story++)
        seed(`${chapterRunId}:beat:${chapter}:${story}`, "beat", {
          chapter,
          storyIndex: story,
          segments: [{ text: part === 1 ? "PRESERVED_COMPLETED_BOND" : "DISCARDED_BOND_ONLY" }],
        });
    }
  }
  const faults = { removeId: "", updateId: "" };
  const originalUpdate = persistence.documents.update;
  persistence.documents.update = (row) => (row.id === faults.updateId ? Promise.resolve(null) : originalUpdate(row));
  persistence.documents.remove = async (_packageId, id, revision) => {
    assert.notEqual(docs.get(id)?.kind, "chat", "Reset must never delete conversation records");
    if (id === faults.removeId || docs.get(id)?.revision !== revision) return false;
    return docs.delete(id);
  };
  persistence.transaction = async (operation) => {
    const before = structuredClone(docs);
    try {
      return await operation({ documents: persistence.documents });
    } catch (error) {
      docs.clear();
      for (const [id, row] of before) docs.set(id, row);
      throw error;
    }
  };
  fixture.calls.length = 0;
  fixture.transport.stage = "chapter-plan";
  fixture.transport.reply = (body) => {
    const system = String(body.messages?.[0]?.content || "");
    if (system.includes("Summarize only the supplied canonical story history"))
      return JSON.stringify({ summary: "The lighthouse friendship and independent conversations remain canonical." });
    return JSON.stringify(system.includes("BOND CHAPTER") ? freshBondPlan : freshMainPlan);
  };
  return { ...fixture, seed, faults, post: (path, body = {}) => fixture.post(path, { unitId: "", ...body }) };
}
