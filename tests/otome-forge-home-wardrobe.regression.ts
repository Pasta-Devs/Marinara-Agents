// Otome Forge M4 on M3's Home: Wear at home puts the look on Home (his cut out once on the next read, his faces read on
// the look he wears, the uncut look when the cut-out fails, initials with no art; hers on Me, uncut); the line a love
// interest says on noticing her new look (P19) is Home's love interest's by default, shows on Me while she wears that
// look, and Home is told while it is being written (also when it lands during a read: Home and the Wardrobe never
// answer "none, and not noticing" then); Home's back layer takes his newest Album CG, an owned Memory's included, dated
// when it was won (its art may be its banner's, painted before); and M4's Snapshots and Character Stories stay with their love interest in M3's own-reader prompts (P15,
// P16, P17), as in M4's own P19 and P24.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type {
  Beat,
  Chapter,
  Grievance,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import type {
  Banner,
  Item,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import {
  cutoutsSettled,
  type CutoutClient,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import type { OtomeArt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/expressions.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import { ensureLinePacks } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/lines.ts";
import { serveNote } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/note.ts";
import type { RouteDeps } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  beatId,
  chapterId,
  itemId,
  playerId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  noticedMessages,
  showMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/items/prompts.ts";
import { createOtomeMemory } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { sendMessage } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts";
import { albumView } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/album.ts";
import {
  registerHomeRoutes,
  type HomeRouteDeps,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/home.ts";
import {
  noticingLooks,
  registerWardrobeRoutes,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/wardrobe.ts";
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
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { applyPull } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/pull.ts";
import { artWorld, routesOf, until } from "./fixtures/otome-forge-art.ts";
import { KAI, MIR, SOL, at, json, storyWorld } from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];
const gallery = (name: string) => `/api/global-gallery/file/${name}.png`;
const ready = (name: string, when = at) => ({ state: "ready" as const, at: when, url: gallery(name), ref: name });

const item = (id: string, changes: Partial<Item>): Item => ({
  id,
  kind: "snapshot3",
  banner: id.replace(/-(?:f|a[1-3]|s[1-6])$/, ""),
  li: KAI,
  title: `Title ${id}`,
  art: null,
  story: null,
  createdAt: at,
  ...changes,
});

const HIS = item("his-wardrobe-0-f", {
  kind: "his-look5",
  title: "Harbour Night",
  look: { name: "Harbour Night", outfitLine: "navy greatcoat, brass buttons" },
  art: ready("harbour-night"),
});
const SOLS = item("his-wardrobe-0-a1", {
  kind: "his-look4",
  li: SOL,
  title: "Pier Shirt",
  look: { name: "Pier Shirt", outfitLine: "linen shirt, rolled sleeves" },
  art: ready("pier-shirt"),
});
const HERS = item("my-wardrobe-0-f", {
  kind: "her-look5",
  title: "Lantern Dress",
  look: { name: "Lantern Dress", outfitLine: "amber silk dress, lantern earrings" },
  coupleWith: HIS.id,
  art: ready("lantern-dress"),
});

/** Home and the Wardrobe on one fake router, over the art fixture's world with `items` stored and owned. */
async function wardrobeHome(
  runKey: string,
  {
    items = [HIS, SOLS, HERS],
    owned = items.map((entry) => entry.id),
    replies = [],
    cutouts,
  }: {
    items?: Item[];
    owned?: string[];
    replies?: Parameters<typeof artWorld>[0]["replies"];
    cutouts?: CutoutClient;
  } = {},
) {
  const t = await artWorld({ runKey, replies });
  for (const value of items) {
    await t.store.mutateDoc(runDocTarget("item", itemId(t.runId, value.id)), normalizeItem, () => value);
  }
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    owned: { items: owned },
  }));
  const faces: string[] = [];
  const art: OtomeArt = {
    repaintExpressions: async () => assert.fail("Home reads must not repaint expressions"),
    queueExpressions: (_runId, beat) => void faces.push(...beat.segments.map((segment) => segment.speaker)),
    queueScenePaints: async () => undefined,
    releaseBeatArt: async () => undefined,
    active: () => true,
    dispose: () => undefined,
  };
  const deps: HomeRouteDeps = { ...t.deps, art, ...(cutouts ? { cutouts } : {}) };
  const call = routesOf(
    (router, routeDeps) => {
      registerHomeRoutes(router, routeDeps as HomeRouteDeps);
      registerWardrobeRoutes(router, routeDeps);
    },
    deps as RouteDeps,
    runKey,
  );
  const home = async () => {
    const answer = await call("GET", "/runs/:run/home");
    assert.equal(answer.status, 200, JSON.stringify(answer.body));
    return answer.body;
  };
  const wear = async (owner: string, look: string) => {
    const answer = await call("POST", "/runs/:run/wardrobe/wear", { owner, look });
    assert.equal(answer.status, 200, JSON.stringify(answer.body));
  };
  const setPortrait = (li: string, portrait: string) =>
    t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (unit) => ({ ...unit, portrait }));
  return { ...t, deps, call, home, wear, faces, setPortrait };
}

function cutoutClient() {
  const cuts: string[] = [];
  const state = { fail: false };
  const client: CutoutClient = {
    async cutOut(url) {
      cuts.push(url);
      if (state.fail) throw new Error("no background remover");
      return { id: `cut${cuts.length}`, url: `${url}.cut.png` };
    },
    deleteGalleryImage: async () => true,
  };
  return { cuts, state, client };
}

test("Wear at home puts his look on Home: cut out once on the next read, his faces on it, uncut or initials without", async () => {
  const cut = cutoutClient();
  const t = await wardrobeHome("r-m4hhim-aaaaaa", { cutouts: cut.client });
  const portrait = gallery("kai-base");
  await t.setPortrait(KAI, portrait);
  assert.equal((await t.home()).look.url, portrait, "his base portrait before he wears anything");
  await cutoutsSettled();

  await t.wear(KAI, HIS.id);
  assert.deepEqual(t.faces, ["Kai"], "his faces for the new look are queued (M2b)");
  const worn = HIS.art!.url!;
  assert.deepEqual((await t.home()).look, { url: worn, source: "look", cutoutState: "pending" }, "the look he wears");
  await cutoutsSettled();
  assert.deepEqual(cut.cuts, [portrait, worn], "the worn look is cut out lazily, once, on the next read");
  assert.deepEqual((await t.home()).look, {
    url: worn,
    source: "look",
    cutoutState: "ready",
    cutout: `${worn}.cut.png`,
  });

  // His faces are the ready set painted on the look he wears, never his portrait's, each cut out in turn.
  const set = (prefix: string) => ({
    state: "ready",
    at,
    images: { tender: { url: `/${prefix}-tender.png` }, cold: { url: `/${prefix}-cold.png` } },
  });
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    expressions: { [portrait]: set("base"), [worn]: set("harbour") },
  }));
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    images: { ...world.images, expressions: true },
  }));
  assert.deepEqual((await t.home()).faces, {
    tender: { url: "/harbour-tender.png", cutoutState: "pending" },
    cold: { url: "/harbour-cold.png", cutoutState: "pending" },
  });
  await cutoutsSettled();
  assert.deepEqual(cut.cuts.slice(2), ["/harbour-tender.png", "/harbour-cold.png"]);

  // Back in his base look, Home shows the portrait's cut-out made before, and its own faces.
  await t.wear(KAI, "base");
  const base = await t.home();
  assert.deepEqual(base.look, { url: portrait, source: "look", cutoutState: "ready", cutout: `${portrait}.cut.png` });
  assert.equal(base.faces.tender.url, "/base-tender.png");

  // Sol has no portrait: initials. His look, when its cut-out fails, pans uncut and is never tried again.
  await t.call("POST", "/runs/:run/home/set", { li: SOL });
  assert.equal((await t.home()).look, null, "no art: initials on a gradient");
  cut.state.fail = true;
  await t.wear(SOL, SOLS.id);
  assert.equal((await t.home()).look.cutoutState, "pending");
  await cutoutsSettled();
  const uncut = (await t.home()).look;
  assert.deepEqual(uncut, { url: SOLS.art!.url, source: "look", cutoutState: "uncut" }, "the slow pan, uncut");
  await cutoutsSettled();
  assert.equal(cut.cuts.filter((url) => url === SOLS.art!.url).length, 1, "a failed cut-out is never tried again");
});

test("Me shows the look she wears, with what Home's love interest noticed, told while it is written", async () => {
  const line = "Amber suits you. Do not let it go to your head.";
  const t = await wardrobeHome("r-m4hme-aaaaaa", { replies: [json({ text: line })] });
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    portrait: gallery("ines-base"),
    look: { identityLine: "short dark hair", outfitLine: "grey wool coat" },
  }));
  await t.call("POST", "/runs/:run/home/set", { li: MIR, show: "me" });
  const before = await t.home();
  assert.deepEqual(before.look, { url: gallery("ines-base"), source: "look", cutoutState: "pending" });
  assert.equal(before.noticed, null);
  assert.equal(before.noticing, false);

  // Her new look is noticed in the background (P19, one model call); the run's queue is held so Home reads it midway.
  let release!: () => void;
  const gate = runForeground(t.runId, () => new Promise<void>((resolve) => (release = resolve)));
  await t.wear("me", HERS.id);
  const writing = await t.home();
  assert.deepEqual(
    writing.look,
    { url: HERS.art!.url, source: "look", cutoutState: "pending" },
    "her look uses the same cleanup as his",
  );
  assert.equal(writing.noticing, true, "Home asks again while the line is written");
  assert.equal(writing.noticed, null);
  release();
  await gate;
  await until(async () => !(await t.home()).noticing, "P19");
  const noticed = (await t.home()).noticed;
  assert.deepEqual(
    [noticed.li, noticed.look, noticed.text],
    [MIR, HERS.id, line],
    "the love interest on Home notices it when the Wardrobe names nobody",
  );
  assert.equal(t.calls.length, 1, "one line for a new look");
  assert.ok(t.calls[0]!.messages[1]!.content.includes(`id ${MIR}:`), "P19 is written as Mireille");

  // Taking it off takes the line with it: what was noticed belongs to the look she wore.
  await t.wear("me", "base");
  const after = await t.home();
  assert.equal(after.look.url, gallery("ines-base"));
  assert.equal(after.noticed, null);
  assert.equal(t.calls.length, 1, "wearing her base look asks nothing");
});

test("Home's back layer is his newest Album CG, an owned Memory's included, never one not won or another's", async () => {
  const memory = (id: string, li: string, when: string, changes: Partial<Item> = {}) =>
    item(id, { kind: "memory5", li, title: id, art: ready(id, when), ...changes });
  const items = [
    memory("memories-0-f", KAI, "2026-10-28T12:00:00.000Z"),
    memory("memories-1-f", MIR, "2026-10-28T13:00:00.000Z"),
    memory("memories-2-f", KAI, "2026-10-28T14:00:00.000Z"),
    memory("memories-3-f", KAI, "2026-10-28T15:00:00.000Z", { art: { state: "pending", at } }),
  ];
  const t = await wardrobeHome("r-m4hback-aaaaaa", {
    items,
    owned: ["memories-0-f", "memories-1-f", "memories-3-f"],
  });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    album: {
      cgs: [{ key: "main-1-0", url: gallery("main-1-0"), ref: "main-1-0", at: "2026-10-28T11:00:00.000Z", li: KAI }],
    },
  }));
  assert.deepEqual(
    (await t.home()).backdrop,
    { url: gallery("memories-0-f"), kind: "cg" },
    "his owned Memory's CG is newer than the story CG; one not won, or still painting, is not his",
  );
  await t.call("POST", "/runs/:run/home/set", { li: MIR });
  assert.deepEqual((await t.home()).backdrop, { url: gallery("memories-1-f"), kind: "cg" }, "hers behind her");
  await t.call("POST", "/runs/:run/home/set", { li: SOL });
  assert.equal((await t.home()).backdrop, null, "none of his own and no place: the gradient");
});

test("Home and the Wardrobe say the line is on its way when it lands while they read, so Me keeps asking", async () => {
  const lines = ["Amber suits you.", "Amber again. Still suits you."];
  const t = await wardrobeHome("r-m4hrace-aaaaaa", { replies: lines.map((text) => json({ text })) });
  await t.call("POST", "/runs/:run/home/set", { li: MIR, show: "me" });
  // A read that has loaded the player is held at its item list while P19 writes the line and finishes.
  let armed = false;
  let release = () => {};
  const listRun = t.store.listRun.bind(t.store);
  t.store.listRun = (async (kind, runId) => {
    if (armed && kind === "item") {
      armed = false;
      release();
      await until(() => noticingLooks(t.runId).length === 0, "P19 to finish");
    }
    return listRun(kind, runId);
  }) as typeof t.store.listRun;
  const readers = {
    home: () => t.home(),
    wardrobe: async () => (await t.call("GET", "/runs/:run/wardrobe")).body,
  };
  for (const [name, read] of Object.entries(readers)) {
    const gate = runForeground(t.runId, () => new Promise<void>((resolve) => (release = resolve)));
    await t.wear("me", HERS.id);
    armed = true;
    const racing = await read();
    await gate;
    assert.ok(racing.noticed || racing.noticing, `${name}: "none, and not noticing" would stop the client asking`);
    assert.ok((await read()).noticed, `${name}: the next read has the line`);
    await t.wear("me", "base");
  }
  assert.equal(t.calls.length, 2, "one line for each new look");
});

test("Home and the Wardrobe stop saying the line is on its way once she has left the look it was for", async () => {
  const t = await wardrobeHome("r-m4hleft-aaaaaa", { replies: [json({ text: "Amber suits you." })] });
  await t.call("POST", "/runs/:run/home/set", { li: MIR, show: "me" });
  // P19 for the look is queued behind a held run queue, as it is when the model is slow.
  let release!: () => void;
  const gate = runForeground(t.runId, () => new Promise<void>((resolve) => (release = resolve)));
  await t.wear("me", HERS.id);
  assert.equal((await t.home()).noticing, true, "waiting on the look she wears");
  assert.equal((await t.call("GET", "/runs/:run/wardrobe")).body.noticing, true);

  await t.wear("me", "base");
  assert.deepEqual(noticingLooks(t.runId), [HERS.id], "the abandoned look is still queued");
  assert.equal((await t.home()).noticing, false, "Home: nothing is coming for the base look");
  assert.equal((await t.call("GET", "/runs/:run/wardrobe")).body.noticing, false, "the Wardrobe: the same");
  release();
  await gate;
  await until(() => noticingLooks(t.runId).length === 0, "the abandoned P19 to leave the queue");
  assert.equal(t.calls.length, 0, "a look she left is never asked for");
});

test("A Memory won after a story CG of his stands behind him and ends the Album, though its art was painted first", async () => {
  // A featured Memory shares its banner's art, painted the day the banner opened (S/wish/banners.ts).
  const featured = item("memories-0-f", {
    kind: "memory5",
    title: "Lantern Vigil",
    art: ready("lantern-vigil", "2026-10-01T09:00:05.000Z"),
  });
  const t = await wardrobeHome("r-m4hwon-aaaaaa", { items: [featured], owned: [] });
  const story = { key: "main-2-3", url: gallery("main-2-3"), ref: "main-2-3", at: "2026-10-03T20:00:00.000Z", li: KAI };
  const state = runDocTarget("state", stateId(t.runId));
  await t.store.updateDoc(state, normalizeState, (current) => ({ ...current, album: { cgs: [story] } }));
  assert.deepEqual((await t.home()).backdrop, { url: story.url, kind: "cg" }, "the story CG, while it is not won");

  // Two days after the story CG she wins it: the pull's one write records when.
  const banner: Banner = {
    key: "memories-0",
    kind: "memories",
    rotation: 0,
    startsDay: "2026-10-01",
    endsDay: "2026-10-14",
    featuredLi: KAI,
    items: { five: [featured.id], four: [], three: [] },
    art: featured.art,
    createdAt: at,
    connectionId: "conn-image",
    model: "image-model",
  };
  const won = "2026-10-05T10:00:00.000Z";
  await t.store.updateDoc(state, normalizeState, (current) => {
    const pulled = applyPull(current, {
      banner,
      items: new Map([[featured.id, featured]]),
      count: 1,
      at: won,
      random: () => 0.001,
    });
    assert.equal(pulled.results[0]!.item, featured.id);
    return pulled.state;
  });
  assert.deepEqual(
    (await t.home()).backdrop,
    { url: featured.art!.url, kind: "cg" },
    "the Memory just won is his newest",
  );
  assert.deepEqual(
    (await albumView(t.deps, t.runId)).cgs.map((cg) => [cg.key, cg.at]),
    [
      [story.key, story.at],
      [`item:${featured.id}`, won],
    ],
    "the Album dates it when it was won",
  );
});

// ── The knowledge boundary: M4's private canon in M3's own-reader prompts ──

const system = (messages: Messages) => messages[0]!.content;
const text = (messages: Messages) => messages.map((message) => message.content).join("\n");
const kindOf = (messages: Messages) =>
  system(messages).includes("message of the day")
    ? "note"
    : system(messages).includes("pre-written Home lines")
      ? "pack"
      : system(messages).includes("in your private message thread")
        ? "chat"
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
      return json({ text: "The lamp room was warm today.", face: "tender", mood: { word: "calm", reason: "harbour" } });
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
          miss: many("Miss", 3),
          plush: many("Plush", 3),
        },
      });
    case "chat":
      return json({ messages: [{ text: "Awake. Barely." }], suggestions: ["Sleep.", "Me too."] });
    default: {
      const input = JSON.parse(messages.at(-1)!.content);
      if (input.source) return json({ summary: `${input.source.title}: ${input.source.content}` });
      return json({ summary: input.records.map((record: { content: string }) => record.content).join(" ") });
    }
  }
}

const STORY = "story-memories-0-f";
const KAI_ONLY = [
  "KAI-STORY-SCENE",
  "KAI-STORY-RELATIONSHIP",
  "KAI-STORY-GRIEVANCE",
  "KAI-STORY-DISCLOSURE",
  "KAI-SNAPSHOT",
];
const leaked = (prompt: string, markers = KAI_ONLY) => markers.filter((marker) => prompt.includes(marker));

/** A run where Kai owns a Snapshot and finished a Character Story that left his rows; Mireille owns a Snapshot. */
async function privateCanonWorld() {
  const t = await storyWorld({ runKey: "r-m4own-aaaaaa", replies: Array.from({ length: 80 }, () => reply) });
  const complete = async (chapter: Omit<Chapter, "tags" | "summary" | "ledger" | "connectionId">, line: string) => {
    await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, chapter.key)), normalizeChapter, () => ({
      tags: [],
      summary: "",
      ledger: { relationship: [], conflict: [], offscreen: [] },
      connectionId: "conn-text",
      ...chapter,
    }));
    const beat: Beat = {
      key: chapter.key,
      i: 0,
      kind: "beat",
      places: [],
      segments: [{ speaker: "", text: line }],
      choices: [],
      choiceCanon: {},
      effects: {},
      applied: {},
      musicMood: "tense",
      readThrough: 0,
      written: { at: chapter.plannedAt, connectionId: "conn-text", model: "fake" },
      rewrites: 0,
    };
    await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, chapter.key, 0)), normalizeBeat, () => beat);
    await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
      ...state,
      chapters: { ...state.chapters, [chapter.key]: { beatsRead: 1, completed: chapter.plannedAt, applied: [] } },
    }));
  };
  const node = (li: string) => [{ i: 0, kind: "beat" as const, guide: "The scene.", cast: [li] }];
  await complete(
    {
      key: "main-1",
      kind: "main",
      number: 1,
      lead: KAI,
      title: "Night 1",
      nodes: node(KAI),
      plannedAt: "2026-10-28T09:00:00.000Z",
    },
    "SHARED-QUAY: the lanterns along the quay go dark.",
  );
  await complete(
    {
      key: STORY,
      kind: "story",
      li: KAI,
      lead: KAI,
      title: "Lantern Vigil",
      nodes: node(KAI),
      plannedAt: "2026-10-28T10:00:00.000Z",
    },
    "KAI-STORY-SCENE: Kai keeps the lamp lit for Ines alone.",
  );
  const items = [
    item("memories-0-f", { kind: "memory5", title: "Lantern Vigil", story: { key: STORY } }),
    // Won after the story was read, so each source has its own place in story order.
    item("memories-0-s1", {
      title: "Late Tea",
      text: "KAI-SNAPSHOT: the kettle sings while Kai pretends not to wait.",
      createdAt: "2026-10-28T11:00:00.000Z",
    }),
    item("memories-0-s2", {
      li: MIR,
      title: "Ink",
      text: "MIR-SNAPSHOT: Mireille blots a ledger and hums.",
      createdAt: "2026-10-28T11:00:00.000Z",
    }),
  ];
  for (const value of items) {
    await t.store.mutateDoc(runDocTarget("item", itemId(t.runId, value.id)), normalizeItem, () => value);
  }
  const grievance = (id: string, text: string, opened: string): Grievance => ({
    id,
    li: KAI,
    by: "li",
    text,
    severity: "minor",
    opened,
    status: "open",
  });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    owned: { items: items.map((value) => value.id) },
    ledgers: {
      ...state.ledgers,
      relationship: [{ key: STORY, li: KAI, line: "KAI-STORY-RELATIONSHIP: he let her keep the watch." }],
    },
    lis: {
      ...state.lis,
      [KAI]: {
        ...state.lis[KAI]!,
        grievances: [grievance("g-1", "KAI-STORY-GRIEVANCE: the lamp she let go out.", `${STORY}/0`)],
        disclosures: [{ text: "KAI-STORY-DISCLOSURE: she fears the dark.", at, ref: `${STORY}/0` }],
      },
    },
  }));
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  await memory.maintain({ runId: t.runId });
  for (let turn = 0; turn < 4000 && (await memory.status(t.runId)).phase === "pending"; turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal((await memory.status(t.runId)).phase, "ready", "the story memory is ready");
  const background = createBackgroundQueue(t.runtime);
  const deps = { ...t.deps, memory, background };
  const prompts = (kind: string) =>
    t.calls.filter((call) => kindOf(call.messages) === kind).map((call) => text(call.messages));
  return { ...t, memory, background, deps, prompts };
}

test("an owned Snapshot and a Character Story reach only their love interest's note, line pack and chat reply", async () => {
  const t = await privateCanonWorld();
  try {
    const sources = await readMemorySources(t.store, t.runId);
    assert.deepEqual(
      sources.map((source) => [source.id, source.kind, source.audience ?? null]),
      [
        ["main-1", "chapter", null],
        [STORY, "chat", [KAI]],
        ["memories-0-s1", "chat", [KAI]],
        ["memories-0-s2", "chat", [MIR]],
      ],
      "M4's canon is private to its love interest",
    );

    // P16: Mireille's note knows nothing of Kai's; Kai's has his own story's rows (ownView keeps a story's rows with
    // the love interest they name, who is its owner).
    await serveNote(t.deps, t.runId, MIR, { debugMode: false });
    await serveNote(t.deps, t.runId, KAI, { debugMode: false });
    const [mirNote, kaiNote] = t.prompts("note");
    assert.deepEqual(leaked(mirNote!), [], "nothing of Kai's in Mireille's note");
    assert.ok(
      kaiNote!.includes("KAI-STORY-GRIEVANCE") && kaiNote!.includes("KAI-STORY-DISCLOSURE"),
      "his own story's grievance and disclosure",
    );

    // P15: Mireille's line pack reads only her card and stage.
    assert.deepEqual(await ensureLinePacks(t.deps, t.runId, [MIR], { debugMode: false }), [MIR]);
    for (let turn = 0; turn < 400 && !t.prompts("pack").length; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    const [pack] = t.prompts("pack");
    assert.ok(pack, "the line pack was written");
    assert.deepEqual(leaked(pack, [...KAI_ONLY, "MIR-SNAPSHOT"]), [], "a pack reads no canon at all");

    // P17: Mireille's reply knows the shared story and her own Snapshot's world, never Kai's; Kai's knows his story.
    await sendMessage(t.deps, t.runId, MIR, { text: "Still up?" }, { debugMode: false });
    const [mirChat] = t.prompts("chat");
    assert.deepEqual(leaked(mirChat!), [], "nothing of Kai's in Mireille's reply");
    assert.ok(mirChat!.includes("SHARED-QUAY"), "the shared story reaches her");
    await runForeground(t.runId, async () => undefined);
    await sendMessage(t.deps, t.runId, KAI, { text: "Are you awake?" }, { debugMode: false });
    const kaiChat = t.prompts("chat")[1]!;
    assert.ok(kaiChat.includes("KAI-STORY-SCENE"), "his own Character Story reaches his reply");
    assert.ok(kaiChat.includes("KAI-STORY-GRIEVANCE"), "with his own story's grievance");
    assert.ok(!kaiChat.includes("MIR-SNAPSHOT"), "and Mireille's Snapshot does not");
  } finally {
    t.memory.dispose();
    t.background.dispose();
  }
});

test("P19 and P24 read his state as his own reader: another love interest's own chapters never reach them", async () => {
  const t = await storyWorld({ runKey: "r-m4p19own-aaaaaa" });
  const grievance = (id: string, text: string, opened: string): Grievance => ({
    id,
    li: KAI,
    by: "li",
    text,
    severity: "minor",
    opened,
    status: "open",
  });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: {
      ...state.lis,
      [KAI]: {
        ...state.lis[KAI]!,
        grievances: [
          grievance("g-1", "KAI-OWN-GRIEVANCE: the lamp.", `${STORY}/0`),
          grievance("g-2", "MIR-ROUTE-GRIEVANCE: the burned page.", `route-${MIR}-2/0`),
        ],
        disclosures: [
          { text: "KAI-OWN-DISCLOSURE: she fears the dark.", at, ref: "main-1/0" },
          { text: "MIR-REPAIR-DISCLOSURE: she kept the key.", at, ref: `repair-${MIR}-1/0` },
        ],
      },
    },
  }));
  const run = (await readRun(t.store, t.runId))!;
  const unit = run.units.find((entry) => entry.id === KAI)!;
  const look = { name: "Lantern Dress", outfitLine: "amber silk dress" };
  for (const build of [noticedMessages, showMessages]) {
    const prompt = text(build({ world: run.world, player: run.player, unit, state: run.state, look }));
    assert.ok(prompt.includes("KAI-OWN-GRIEVANCE") && prompt.includes("KAI-OWN-DISCLOSURE"), "his own, kept");
    assert.deepEqual(
      ["MIR-ROUTE-GRIEVANCE", "MIR-REPAIR-DISCLOSURE"].filter((marker) => prompt.includes(marker)),
      [],
      "nothing of Mireille's own chapters",
    );
  }
});
