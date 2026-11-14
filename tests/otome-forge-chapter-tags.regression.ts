// Otome Hearth's chapter tags (S/story/canon.ts storyTags; the maintainer's, 2026-11-10 and again 2026-11-14): every
// chapter summary sent to a model says which chapter it is, by number and name ("[Chapter 4] Night 4", "[Character
// Story 2, after chapter 4] …", "[After chapter 3] …"), recalled chapter memories too, and the condensed timeline head
// just says it covers chapters 1–x. The tags are worked out from the chapter keys and story order each time a prompt is
// built, never saved: a story already in progress has them on its next prompt, with no summary written again and its
// memory document untouched.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  Beat,
  Chapter,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { birthdaySceneKey } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/birthdays.ts";
import { bondStoryKey } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/bond.ts";
import { figurineSceneKey } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/shop.ts";
import {
  beatId,
  chapterId,
  memoryId,
  runDocTarget,
  stateId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { createOtomeMemory } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import {
  recallText,
  storyTags,
  tagged,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import { KAI, MIR, SOL, saveStoryMemory, storyWorld } from "./fixtures/otome-forge-story.ts";

type World = Awaited<ReturnType<typeof storyWorld>>;
type Done = Partial<Chapter> & Pick<Chapter, "key" | "kind" | "lead" | "title">;

const keyOf = (id: string, kind = "chapter") => JSON.stringify([kind, id]);
const at = (h: number, m = 0) => `2026-10-28T0${h}:${String(m).padStart(2, "0")}:00.000Z`;
const HEAD = "HEAD: the harbour's first nights, condensed.";
const PRIVATE = "(private: only the people in its scenes know what happened in it)";
/** How the story names each love interest's own chapter (S/story/canon.ts titleOf), as saved, with no tag. */
const SHELL = `Kai's own story chapter "The Shell" ${PRIVATE}`;
const HER_FIRST = `Mireille's own route chapter "Her First" ${PRIVATE}`;
const KAI_DATE = `Kai's own date chapter "Jellyfish Hour" ${PRIVATE}`;

/** A chapter of one beat, completed at `completed`. */
async function complete(t: World, changes: Done, completed: string) {
  const chapter: Chapter = {
    tags: [],
    summary: "",
    nodes: [{ i: 0, kind: "beat", guide: "The scene.", cast: [changes.lead] }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: completed,
    connectionId: "conn-text",
    ...changes,
  };
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, chapter.key)), normalizeChapter, () => chapter);
  const beat: Beat = {
    key: chapter.key,
    i: 0,
    kind: "beat",
    places: [],
    segments: [{ speaker: "", text: `TEXT-${chapter.key}` }],
    choices: [],
    choiceCanon: {},
    effects: {},
    applied: {},
    musicMood: "tense",
    readThrough: 0,
    written: { at: completed, connectionId: "conn-text", model: "fake" },
    rewrites: 0,
  };
  await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, chapter.key, 0)), normalizeBeat, () => beat);
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [chapter.key]: { beatsRead: 1, completed, applied: [] } },
  }));
}

/**
 * A story in progress, saved before tags existed: Nights 1–5, Kai's Character Story "The Shell" after Night 2, her route
 * chapter and his date after Night 3, his figurine scene and his Character Story "The Lamp Room" after Night 4. The
 * timeline's head condensed Nights 1–3, The Shell, her chapter and his date; Night 4 and Night 5 are its entries, under
 * their plain titles. The Lamp Room has its summary, not yet in the timeline.
 */
async function inProgress(runKey: string) {
  const t = await storyWorld({ runKey });
  for (const n of [1, 2, 3, 4, 5]) {
    await complete(t, { key: `main-${n}`, kind: "main", number: n, lead: KAI, title: `Night ${n}` }, at(n));
  }
  const kai = { li: KAI, lead: KAI };
  await complete(t, { key: "story-item-shell-0001", kind: "story", ...kai, title: "The Shell" }, at(2, 30));
  await complete(
    t,
    { key: `route-${MIR}-2`, kind: "route", li: MIR, lead: MIR, stage: 2, title: "Her First" },
    at(3, 30),
  );
  await complete(t, { key: "date-1", kind: "date", ...kai, title: "Jellyfish Hour" }, at(3, 40));
  await complete(t, { key: figurineSceneKey(KAI), kind: "story", ...kai, title: "Kai in Porcelain" }, at(4, 20));
  await complete(t, { key: "story-item-lamp-0001", kind: "story", ...kai, title: "The Lamp Room" }, at(4, 40));
  await saveStoryMemory(t.store, t.runId, {
    head: HEAD,
    entries: [4, 5].map((n) => ({ key: keyOf(`main-${n}`), title: `Night ${n}`, text: `ENTRY-${n}` })),
    covered: [
      ...["main-1", "main-2", "main-3", `route-${MIR}-2`].map((id) => keyOf(id)),
      keyOf("story-item-shell-0001", "character-story"),
      keyOf("date-1", "character-story"),
    ],
    summaries: {
      ...Object.fromEntries([1, 2, 3, 4, 5].map((n) => [keyOf(`main-${n}`), `N${n}-SUMMARY`])),
      [keyOf(`route-${MIR}-2`)]: "HER-FIRST-SUMMARY",
      [keyOf("story-item-shell-0001", "character-story")]: "SHELL-SUMMARY",
      [keyOf("date-1", "character-story")]: "KAI-DATE-SUMMARY",
      [keyOf("story-item-lamp-0001", "character-story")]: "LAMP-SUMMARY",
    },
  });
  return t;
}

const plan = { job: "structured" as const, continues: "main" as const, cached: {}, lastStory: true };

test("a story already in progress is tagged on its next prompt, and nothing is summarized or saved again", async () => {
  const t = await inProgress("r-tagsongoing-aaaaaa");
  const saved = () => JSON.stringify(t.fake.rows.get(memoryId(t.runId)));
  const before = saved();
  assert.ok(!before.includes("[Chapter"), "the saved titles are the plain ones");
  const { text } = await recallText({ store: t.store }, t.runId, { ...plan, cast: [KAI] });
  // The head just says which main chapters it holds; each entry says which chapter it is.
  assert.ok(text.includes(`# Canon to date\n[Chapters 1–3]\n${HEAD}\n\n[Chapter 4] Night 4\nENTRY-4`), text);
  assert.ok(text.includes("# Previous chapter in full: [Chapter 5] Night 5\n\nTEXT-main-5"), text);
  assert.ok(!text.includes("ENTRY-5"), "the previous chapter's entry stays out, as before");
  assert.equal(saved(), before, "the memory document is byte for byte as it was");
  assert.equal(t.calls.length, 0, "no model call: nothing summarized again");
});

test("Character Stories are numbered in story order, and every other chapter says where it falls", async () => {
  const tags = storyTags([
    { key: "story-item-early-0001", order: 5000.1 },
    { key: `repair-${MIR}-1`, order: 5000.2 },
    { key: "main-1", order: 10000 },
    { key: bondStoryKey(KAI, 2), order: 15000.1 },
    { key: figurineSceneKey(KAI), order: 15000.2 },
    { key: birthdaySceneKey(KAI, 2026), order: 15000.3 },
    { key: "story-item-shell-0001", order: 15000.4 },
    { key: "main-2", order: 20000 },
    { key: "date-1", order: 25000.1 },
    { key: `side-${KAI}-1`, order: 25000.2 },
    { key: "story-item-lamp-0001", order: 25000.3 },
  ]);
  assert.deepEqual(
    [...tags].map(([key, tag]) => [key, tagged(tag, "T")]),
    [
      ["story-item-early-0001", "[Character Story 1, before chapter 1 ended] T"],
      [`repair-${MIR}-1`, "[Before chapter 1 ended] T"],
      ["main-1", "[Chapter 1] T"],
      // A bond story is a Character Story of his (S/story/bond.ts); a figurine or birthday scene counts toward nothing.
      [bondStoryKey(KAI, 2), "[Character Story 2, after chapter 1] T"],
      [figurineSceneKey(KAI), "[After chapter 1] T"],
      [birthdaySceneKey(KAI, 2026), "[After chapter 1] T"],
      ["story-item-shell-0001", "[Character Story 3, after chapter 1] T"],
      ["main-2", "[Chapter 2] T"],
      ["date-1", "[After chapter 2] T"],
      [`side-${KAI}-1`, "[After chapter 2] T"],
      ["story-item-lamp-0001", "[Character Story 4, after chapter 2] T"],
    ],
  );
  assert.equal(tagged(undefined, "T"), "T", "a chapter with no tag keeps its title");
  // In a prompt, for any cast: the last Character Story by its number, the figurine scene before it never counted.
  const t = await inProgress("r-tagsstories-aaaaaa");
  const { text } = await recallText({ store: t.store }, t.runId, { ...plan, cast: [SOL] });
  const last = `"The Lamp Room" (private between Ines and Kai; nobody else knows what happened in it)`;
  assert.ok(
    text.includes(`# Last Character Story, by its summary: [Character Story 2, after chapter 4] ${last}\nLAMP-SUMMARY`),
    text,
  );
});

test('a chapter recalled by meaning goes by its number: "# Chapter 2 in detail: Night 2"', async () => {
  const t = await inProgress("r-tagsdetail-aaaaaa");
  const recalled = ["main-2", "story-item-shell-0001", `route-${MIR}-2`];
  const context = await recallText({ store: t.store }, t.runId, {
    job: "narration",
    cast: [KAI, MIR],
    continues: "main",
    recalled,
  });
  assert.deepEqual(context.recalled, recalled);
  const expected = [
    `# Canon to date\n[Chapters 1–3]\n${HEAD}`,
    "# Chapter 2 in detail: Night 2\nN2-SUMMARY",
    `# Character Story 1 in detail, after chapter 2: ${SHELL}\nSHELL-SUMMARY`,
    `# Earlier, in detail: [After chapter 3] ${HER_FIRST}\nHER-FIRST-SUMMARY`,
    "# Canon to date, continued\n[Chapter 4] Night 4\nENTRY-4",
  ].join("\n\n");
  assert.ok(context.text.includes(expected), context.text);
});

test('a date recalled from the pool says where it falls: "# Recalled memory: [After chapter 3] …"', async () => {
  const t = await inProgress("r-tagsdate-aaaaaa");
  const real = createOtomeMemory({ runtime: t.runtime, store: t.store });
  // The pool as the memory recalls it; its upkeep is no part of this, so it is never queued.
  const memory = { recall: real.recall.bind(real), maintain: async () => false };
  try {
    const options = { job: "chat" as const, reader: KAI, query: { cues: ["Do you remember the jellyfish?"] } };
    const { text } = await recallText({ store: t.store, memory }, t.runId, options);
    assert.ok(text.includes(`# Recalled memory: [After chapter 3] ${KAI_DATE}\nKAI-DATE-SUMMARY`), text);
    // Home and Read Him put the newest recall's tag before its content (they drop its title).
    const { recalls } = await real.recall({ ...options, runId: t.runId });
    assert.deepEqual(
      recalls?.map(({ id, tag }) => [id, tag]),
      [["date-1", "[After chapter 3]"]],
    );
  } finally {
    real.dispose();
  }
});

test("his side is tagged where the chapter it tells again falls, however late it is read", async () => {
  // An unread side stays on offer (S/story/his-side.ts), so his side of Night 2 may be read only after Night 5.
  const t = await inProgress("r-tagsside-aaaaaa");
  const hisSide = { arc: 1, ref: "main-2/0", moment: "truth", stage: 2, trust: 0, tension: 0, open: [], rupture: null };
  const side = { key: `side-${KAI}-1`, kind: "story", li: KAI, lead: KAI, title: "Night 2" } as const;
  await complete(t, { ...side, hisSide: { ...hisSide, at: at(5, 30) } } as Done, at(5, 30));
  const { text } = await recallText({ store: t.store }, t.runId, { job: "narration", cast: [KAI], continues: "main" });
  assert.match(text, /# Canon in full: \[After chapter 2\] Kai's side of "Night 2" \(/u, text);
  assert.ok(!text.includes("[After chapter 5] Kai's side"), "not where it was read");
});

test("a Character Story has one number in every block, even after one with no canon to give (Dottore, #2291)", async () => {
  const t = await inProgress("r-tagsgone-aaaaaa");
  // Completed, its scene since gone (a missing beat), so it has no canon and is no memory source; it is still counted,
  // as every completed chapter is.
  const gone = { key: "story-item-gone-0001", kind: "story", li: KAI, lead: KAI, title: "Gone" } as const;
  await complete(t, gone, at(2, 10));
  assert.ok(await t.store.removeDoc(beatId(t.runId, gone.key, 0)));
  const sources = await readMemorySources(t.store, t.runId);
  assert.ok(!sources.some(({ id }) => id === gone.key), "it gave no source");
  const { text } = await recallText({ store: t.store }, t.runId, {
    job: "narration",
    cast: [KAI],
    continues: "main",
    recalled: ["story-item-shell-0001"],
  });
  assert.ok(text.includes(`# Character Story 2 in detail, after chapter 2: ${SHELL}`), text);
  const real = createOtomeMemory({ runtime: t.runtime, store: t.store });
  try {
    // The Home note's recall (no timeline, so his Character Stories come as recalls): the same number.
    const { recalls } = await real.recall({ runId: t.runId, job: "chat", reader: KAI, ownStories: true });
    const shell = recalls?.find(({ id }) => id === "story-item-shell-0001");
    assert.equal(shell?.tag, "[Character Story 2, after chapter 2]");
    assert.equal(shell?.title, `[Character Story 2, after chapter 2] ${SHELL}`);
  } finally {
    real.dispose();
  }
});
