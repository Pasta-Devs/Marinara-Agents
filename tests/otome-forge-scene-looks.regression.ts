// Otome Hearth #2509: love interests and the protagonist change into their own looks during a chapter's scenes
// (S/story/scene-looks.ts, S/story/beats.ts wearOf, S/prompts.ts P6's WHAT THEY WEAR and `wear`). Home's Wear dresses
// them on Home only.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type { Chapter } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  BASE_LOOK,
  SCENE_LOOKS,
  SCENE_OFFERED_MAX,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wardrobe.ts";
import type {
  Item,
  Rarity,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import type { OtomeArt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/expressions.ts";
import {
  beatId,
  chapterId,
  itemId,
  itemStoryKey,
  playerId,
  runDocTarget,
  stateId,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  normalizeState,
  readRun,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeItem } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/wish.ts";
import { readChapter } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import {
  chapterWardrobe,
  pickOffered,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/scene-looks.ts";
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

type World = Awaited<ReturnType<typeof storyWorld>>;
type Messages = CapabilityLanguageModelMessage[];

const beatPath = "/runs/:run/chapters/:key/beats/:i";
const node = (i: number) => ({ key: "main-1", i: String(i) });
const isPlanner = (messages: Messages) =>
  messages.some((message) => message.role === "system" && message.content.includes("chapter planner"));
const nodeOf = (messages: Messages) => Number(/Narrate node (\d+) of/.exec(messages.at(-1)!.content)?.[1] ?? 0) - 1;
const whole = (messages: Messages) => messages.map((message) => message.content).join("\n\n");

const HARBOUR = "his-wardrobe-0-a1";
const PIER = "his-wardrobe-0-a2";
const DRESS = "my-wardrobe-0-a1";
const GOWN = "my-wardrobe-0-f";

/** A look item, painted unless `art` is null. */
function lookItem(id: string, kind: Item["kind"], name: string, outfitLine: string, art = true): Item {
  return {
    id,
    kind,
    banner: id.replace(/-(?:f|a[1-3])$/, ""),
    li: KAI,
    title: name,
    look: { name, outfitLine },
    art: art ? { state: "ready", at, url: `/api/global-gallery/file/${id}.png`, ref: id } : null,
    story: null,
    createdAt: at,
  };
}

/** Saves the items and adds them to what she owns. */
async function own(t: World, items: Item[]) {
  for (const item of items) {
    await t.store.mutateDoc(runDocTarget("item", itemId(t.runId, item.id)), normalizeItem, () => item);
  }
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    owned: { ...state.owned, items: [...state.owned.items, ...items.map((item) => item.id)] },
  }));
}

/** Kai wears `look` at home (added to his outfits from its item). */
async function wearAtHome(t: World, item: Item) {
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    outfits: [
      ...unit.outfits.filter((outfit) => outfit.id !== item.id),
      { id: item.id, name: item.look!.name, outfitLine: item.look!.outfitLine, url: item.art!.url!, at },
    ],
    wornOutfit: item.id,
  }));
}

test("#2509: a chapter offers the everyday look, the one worn as it opens, and at most 3, 2 and 1 owned looks of each rarity", () => {
  const looks = (["3", "4", "5"] as const).flatMap((rarity) =>
    Array.from({ length: 5 }, (_, n) => ({ id: `look${rarity}-${n}`, rarity: Number(rarity) as Rarity })),
  );
  const count = (picked: string[], rarity: Rarity) =>
    picked.filter((id) => looks.find((look) => look.id === id)?.rarity === rarity).length;
  const first = pickOffered(looks, BASE_LOOK, () => 0);
  assert.equal(first[0], BASE_LOOK, "the everyday look always, first");
  assert.deepEqual(
    [count(first, 3), count(first, 4), count(first, 5)],
    [SCENE_LOOKS[3], SCENE_LOOKS[4], SCENE_LOOKS[5]],
  );
  assert.equal(first.length, SCENE_OFFERED_MAX);
  assert.equal(new Set(first).size, first.length, "no look twice");
  // At random among the owned ones: another draw picks others.
  const second = pickOffered(looks, BASE_LOOK, () => 0.999);
  assert.notDeepEqual(second, first);
  assert.ok(second.every((id) => id === BASE_LOOK || looks.some((look) => look.id === id)));
  // The look worn as the chapter opens is always offered, and counts towards its rarity's cap.
  for (const random of [() => 0, () => 0.999]) {
    const kept = pickOffered(looks, "look5-3", random);
    assert.deepEqual(kept.slice(0, 2), [BASE_LOOK, "look5-3"]);
    assert.equal(count(kept, 5), 1);
    assert.equal(kept.length, SCENE_OFFERED_MAX);
  }
  // Fewer than the caps: all of them. None: the everyday look alone.
  assert.deepEqual(pickOffered([{ id: "x", rarity: 4 }], BASE_LOOK), [BASE_LOOK, "x"]);
  assert.deepEqual(pickOffered([], BASE_LOOK), [BASE_LOOK]);
});

test("#2509: the scene writer dresses them from the chapter's looks by name; a change lasts, the cache holds, Home never reaches the story", async () => {
  const wear = {
    KAI: "harbour night",
    Ines: "No Such Dress",
    Mireille: "everyday",
    Nobody: "Harbour Night",
  };
  const t = await storyWorld({
    runKey: "r-scenelooks-aaaaaa",
    replies: Array.from({ length: 40 }, () => (messages: Messages) => {
      if (isPlanner(messages)) return json(planReply());
      if (isConfrontationPrompt(messages)) return json(confrontationReply());
      return json(beatReply(nodeOf(messages) === 0 ? { wear } : {}));
    }),
  });
  const faces: Array<Record<string, string> | undefined> = [];
  t.deps.art = {
    repaintExpressions: async () => assert.fail("no repaint"),
    queueExpressions: (_runId, _beat, options) => void faces.push(options.bases),
    queueScenePaints: async () => undefined,
    releaseBeatArt: async () => undefined,
    active: () => true,
    dispose: () => undefined,
  } as OtomeArt;
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  const harbour = lookItem(HARBOUR, "his-look3", "Harbour Night", "HIS-LOOK: navy greatcoat");
  const unpainted = lookItem(PIER, "his-look4", "Pier Shirt", "linen shirt", false);
  const dress = lookItem(DRESS, "her-look3", "Lantern Dress", "HER-LOOK: amber silk dress");
  await own(t, [harbour, unpainted, dress]);
  // He wears it on Home, and she wears her dress there: the story never reads either.
  await wearAtHome(t, harbour);
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    outfits: [{ id: DRESS, name: "Lantern Dress", outfitLine: "HER-LOOK: amber silk dress", url: "/d.png", at }],
    wornOutfit: DRESS,
  }));

  assert.equal((await t.call("POST", beatPath, {}, node(0))).status, 200);
  await t.settle();
  const scene = (i: number) =>
    t.calls.filter((call) => !isPlanner(call.messages) && nodeOf(call.messages) === i).at(-1)!;
  const first = whole(scene(0).messages);
  // The rule once, in the instructions every scene of the chapter shares; the lists by name in the scene's own part.
  assert.match(scene(0).messages[1]!.content, /- wear: in a node where someone has changed clothes, "wear": \{/);
  assert.match(first, /Going to sleep and waking is one change: into what they wear once they are up/);
  assert.match(
    first,
    /\nWHAT THEY WEAR\n- Ines, in "everyday" now; their looks: "everyday", "Lantern Dress"\.\n- Kai, in "everyday" now; their looks: "everyday", "Harbour Night"\./,
  );
  assert.match(first, /such as "choices", "effects", "cg", "voices" or "wear"\): \{/);
  assert.doesNotMatch(first, /HIS-LOOK|HER-LOOK|Pier Shirt/, "names only, never a Home look or an unpainted one");
  // Only Kai's change is kept: an unknown look, someone not in the scene and a stranger are dropped.
  const saved = (i: number) => t.store.readDoc(beatId(t.runId, "main-1", i), normalizeBeat);
  assert.deepEqual((await saved(0))!.wear, { [KAI]: HARBOUR });
  // The lookahead's next scene sees him in it, described from it.
  const second = whole(scene(1).messages);
  assert.match(second, /- Kai, in "Harbour Night" now/);
  assert.match(second, /How Kai looks now [^\n]*wearing HIS-LOOK: navy greatcoat\./);
  assert.equal((await saved(1))!.wear, undefined, "a scene that changes nothing keeps nothing");
  // Both scenes send the same cached parts: the story context and the instructions.
  assert.equal(scene(1).messages[0]!.content, scene(0).messages[0]!.content);
  assert.equal(scene(1).messages[1]!.content, scene(0).messages[1]!.content);
  // His faces are queued for the look he wears in the scene served.
  assert.equal(faces.at(-1)?.[KAI], `/api/global-gallery/file/${HARBOUR}.png`);
  // Home is as it was.
  assert.equal((await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!.wornOutfit, HARBOUR);
  assert.equal((await t.store.readDoc(playerId(t.runId), normalizePlayer))!.wornOutfit, DRESS);
  // The lists were picked once: a look won mid-chapter waits for the next chapter.
  const wardrobe = (await readChapter(t.store, t.runId, "main-1"))!.wardrobe!;
  assert.deepEqual(wardrobe.offered[KAI], [BASE_LOOK, HARBOUR]);
  assert.deepEqual(wardrobe.start, { me: BASE_LOOK, [KAI]: BASE_LOOK, [MIR]: BASE_LOOK, [SOL]: BASE_LOOK });
  await own(t, [lookItem("his-wardrobe-1-a1", "his-look3", "Storm Cloak", "grey cloak")]);
  assert.equal((await t.call("POST", beatPath, {}, node(1))).status, 200);
  await t.settle();
  assert.doesNotMatch(whole(scene(2).messages), /Storm Cloak/);
  assert.deepEqual((await readChapter(t.store, t.runId, "main-1"))!.wardrobe, wardrobe);
});

/** A one-node-per-entry chapter `key` of `kind`, with `cast` in each node (and `changes`). */
function chapterOf(key: string, nodes: number, changes: Partial<Chapter> = {}): Chapter {
  return {
    key,
    kind: "main",
    lead: KAI,
    title: key,
    tags: [],
    summary: "",
    nodes: Array.from({ length: nodes }, (_, i) => ({ i, kind: "beat" as const, guide: `Node ${i}.`, cast: [KAI] })),
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: at,
    connectionId: "conn-text",
    ...changes,
  };
}

async function saveChapter(t: World, chapter: Chapter, wear: Array<Record<string, string> | undefined> = []) {
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, chapter.key)), normalizeChapter, () => chapter);
  for (const [i, change] of wear.entries()) {
    await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, chapter.key, i)), normalizeBeat, () => ({
      ...beatReply(),
      key: chapter.key,
      i,
      kind: "beat",
      choices: [],
      choiceCanon: {},
      effects: {},
      applied: {},
      readThrough: 0,
      written: { at, connectionId: "conn-text", model: "m" },
      rewrites: 0,
      ...(change ? { wear: change } : {}),
    }));
  }
}

test("#2509: a chapter opens in the looks the previous one ended in; a chapter under way, a date, a hangout and a first-wear scene start as they were set", async () => {
  const t = await storyWorld({ runKey: "r-lookstart-aaaaaa" });
  const harbour = lookItem(HARBOUR, "his-look3", "Harbour Night", "navy greatcoat");
  const pier = lookItem(PIER, "his-look4", "Pier Shirt", "linen shirt");
  const dress = lookItem(DRESS, "her-look3", "Lantern Dress", "amber silk dress");
  const gown = lookItem(GOWN, "her-look5", "Midnight Gown", "black silk gown");
  await own(t, [harbour, pier, dress, gown]);
  await wearAtHome(t, pier);
  const run = async () => (await readRun(t.store, t.runId))!;
  const startOf = async (chapter: Chapter, options: { previous?: string; underway?: boolean } = {}) => {
    await saveChapter(t, chapter);
    return (await chapterWardrobe(t.deps, t.runId, chapter, await run(), { underway: false, ...options })).start;
  };
  // The previous chapter opened with her in her dress and him everyday; its second scene put him in his coat.
  await saveChapter(
    t,
    chapterOf("main-1", 2, {
      wardrobe: {
        offered: { me: [BASE_LOOK, DRESS], [KAI]: [BASE_LOOK, HARBOUR] },
        start: { me: DRESS, [KAI]: BASE_LOOK },
      },
    }),
    [undefined, { [KAI]: HARBOUR }],
  );
  const next = chapterOf("main-2", 2, { number: 2 });
  assert.deepEqual(await startOf(next, { previous: "main-1" }), { me: DRESS, [KAI]: HARBOUR });
  const saved = (await readChapter(t.store, t.runId, "main-2"))!.wardrobe!;
  assert.ok(
    saved.offered[KAI]!.includes(HARBOUR) && saved.offered.me!.includes(DRESS),
    "what they start in is offered",
  );
  // Saved once: a second pick reads the first.
  assert.deepEqual(
    await chapterWardrobe(t.deps, t.runId, (await readChapter(t.store, t.runId, "main-2"))!, await run(), {
      underway: false,
    }),
    saved,
  );
  // Offered looks are among their wearers' outfits, so they stand on stage and get faces; Home is untouched.
  const kai = (await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!;
  assert.ok(kai.outfits.some((outfit) => outfit.id === HARBOUR));
  assert.equal(kai.wornOutfit, PIER);
  const player = (await t.store.readDoc(playerId(t.runId), normalizePlayer))!;
  assert.ok(player.outfits.some((outfit) => outfit.id === DRESS));
  assert.equal(player.wornOutfit, undefined);
  // With no previous chapter, everyday looks; a chapter whose scenes were written before it had lists, its Home looks.
  assert.deepEqual(await startOf(chapterOf("main-3", 1)), { me: BASE_LOOK, [KAI]: BASE_LOOK });
  assert.deepEqual(await startOf(chapterOf("main-4", 1), { previous: "main-1", underway: true }), {
    me: BASE_LOOK,
    [KAI]: PIER,
  });
  // A date: her pick, and he chooses his own (everyday until then), whatever the last chapter left him in.
  const date = chapterOf("date-1", 2, {
    kind: "date",
    li: KAI,
    date: {
      li: KAI,
      place: "aquarium",
      placeName: "The Lantern Aquarium",
      herLook: GOWN,
      hisLook: BASE_LOOK,
      goesWrong: false,
      makeItRight: null,
      keepsake: { brief: "The two of them." },
    },
  });
  assert.deepEqual(await startOf(date, { previous: "main-1" }), { me: GOWN, [KAI]: BASE_LOOK });
  // A hangout: her pick.
  const hangout = chapterOf("story-hangout-1", 1, {
    kind: "story",
    lead: "",
    nodes: [{ i: 0, kind: "beat", guide: "Tea.", cast: [] }],
    friendStory: { kind: "hangout", friends: ["li-kaveh-ab12"], herLook: DRESS },
  });
  assert.deepEqual(await startOf(hangout, { previous: "main-1" }), { me: DRESS });
  // A 5★ look's first-wear scene: its wearer in it, everyone else as the last chapter left them.
  const firstWear = chapterOf(itemStoryKey(GOWN), 1, { kind: "story" });
  assert.deepEqual(await startOf(firstWear, { previous: "main-1" }), { me: GOWN, [KAI]: HARBOUR });
});
