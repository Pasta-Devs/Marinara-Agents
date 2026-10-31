// Otome Forge M4: items, the Wardrobe and the Album (S/items/*, S/art/outfits.ts, S/routes/{items,wardrobe,album}.ts).
// Items are written straight into the store as Wish's banners write them (SH/wish.ts Item) and owned through the state;
// paints run against the art fixture's image client, which counts paid calls, and model replies are scripted.
import assert from "node:assert/strict";
import test from "node:test";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import type { PortraitRequest } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import type { Item } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import type { OtomeArt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/expressions.ts";
import { paintPairNow } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/outfits.ts";
import { paintSlot } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import type {
  OtomeReply,
  RouteDeps,
  RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  chapterId,
  beatId,
  itemId,
  itemStoryKey,
  playerId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { normalizeStoryPlan } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/items/character-story.ts";
import { withCoupleTimeline } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/items/open.ts";
import type { StoryPlanReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/items/prompts.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { registerAlbumRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/album.ts";
import { registerItemRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/items.ts";
import { registerStoryRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/story.ts";
import { registerWardrobeRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/wardrobe.ts";
import { wornLookUrl } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/common.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeItem } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/wish.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { artWorld, setImages, until, type PaidCall } from "./fixtures/otome-forge-art.ts";
import { KAI, MIR, SOL, at, beatReply, json } from "./fixtures/otome-forge-story.ts";

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

const ITEMS = {
  memory: item("memories-0-f", {
    kind: "memory5",
    title: "Lantern Vigil",
    premise: "PREMISE: a storm keeps them in the lamp room until dawn.",
    cg: { brief: "The lamp room at night, rain on the glass, one blanket by the great lens.", cast: ["Kai", "Ines"] },
  }),
  moment: item("memories-0-a1", {
    kind: "moment4",
    li: MIR,
    title: "Quay Walk",
    premise: "MOMENT: a walk on the quay.",
  }),
  unowned: item("memories-0-a2", { kind: "moment4", li: SOL, title: "Not Won", premise: "Never won." }),
  snapshot: item("memories-0-s1", { title: "Late Tea", text: "SNAP-KAI: the lamp hums while they share a late tea." }),
  hisLook: item("his-wardrobe-0-f", {
    kind: "his-look5",
    title: "Harbour Night",
    look: { name: "Harbour Night", outfitLine: "navy greatcoat, brass buttons" },
  }),
  otherLook: item("his-wardrobe-0-a1", {
    kind: "his-look4",
    li: SOL,
    title: "Pier Shirt",
    look: { name: "Pier Shirt", outfitLine: "linen shirt, rolled sleeves" },
  }),
  herLook: item("my-wardrobe-0-f", {
    kind: "her-look5",
    title: "Lantern Dress",
    look: { name: "Lantern Dress", outfitLine: "amber silk dress, lantern earrings" },
    coupleWith: "his-wardrobe-0-f",
  }),
  herFour: item("my-wardrobe-0-a1", {
    kind: "her-look4",
    li: null,
    title: "Rain Coat",
    look: { name: "Rain Coat", outfitLine: "yellow raincoat, rubber boots" },
  }),
};
const OWNED = Object.values(ITEMS)
  .filter((value) => value !== ITEMS.unowned)
  .map((value) => value.id);

/** A valid P21 reply: three nodes for Kai (Mireille named in one is left out), and his voiced line. */
function storyPlan(changes: Partial<StoryPlanReply> = {}): StoryPlanReply {
  return {
    title: "Lantern Vigil",
    tags: [],
    summary: "A storm, a lamp, a long night.",
    voicedLine: "Stay. The lamp is easier to watch with you here.",
    nodes: [
      { kind: "beat", guide: "Kai lets Ines up to the lamp room as the storm rolls in.", cast: [KAI] },
      {
        kind: "moment",
        moment: "read-him",
        guide: "Ines reads Kai's face as the bell rings.",
        cast: [KAI, "Mireille"],
      },
      { kind: "beat", guide: "Dawn; Kai keeps her blanket.", cast: [KAI], cg: true, resolves: ["g-1"] },
    ],
    ledger: {
      relationship: [
        { li: KAI, line: "Kai let her keep the night watch with him." },
        { li: MIR, line: "PRIVATE-TO-KAI: Mireille was mentioned." },
      ],
      conflict: [],
      offscreen: [{ li: MIR, line: "PRIVATE-TO-KAI: Mireille counted the ledgers." }],
    },
    ...changes,
  };
}

/** The item, wardrobe, album and story routes on a fake router, with `params` beside `:run`. */
function routes(deps: RouteDeps, runKey: string) {
  const table = new Map<string, RouteHandler>();
  const router = {
    get: (path: string, handler: RouteHandler) => table.set(`GET ${path}`, handler),
    post: (path: string, handler: RouteHandler) => table.set(`POST ${path}`, handler),
  };
  for (const register of [registerItemRoutes, registerWardrobeRoutes, registerAlbumRoutes, registerStoryRoutes]) {
    register(router, deps);
  }
  return async (method: "GET" | "POST", path: string, body: object = {}, params: Record<string, string> = {}) => {
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
    const fields = { timeZone: "UTC", debugMode: true };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        params: { run: runKey, ...params },
        query: method === "GET" ? { ...fields, ...body } : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

/** The art fixture's world with every item stored and `owned` won, an art service that records queued faces. */
async function itemsWorld(
  runKey: string,
  {
    images = {},
    replies = [],
    owned = OWNED,
    before,
    heat,
  }: {
    images?: Parameters<typeof artWorld>[0]["images"];
    replies?: Parameters<typeof artWorld>[0]["replies"];
    owned?: string[];
    before?: (call: PaidCall, n: number) => void | Promise<void>;
    heat?: "sfw" | "fade" | "explicit";
  } = {},
) {
  const t = await artWorld({ runKey, images, replies, before });
  for (const value of Object.values(ITEMS)) {
    await t.store.mutateDoc(runDocTarget("item", itemId(t.runId, value.id)), normalizeItem, () => value);
  }
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    owned: { items: owned },
  }));
  // Her look lines, as her setup paint leaves them (without them, painting her look writes them first: P4).
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    look: { identityLine: "short dark hair, freckles", outfitLine: "grey wool coat" },
  }));
  if (heat) {
    await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
      ...world,
      content: { ...world.content, heat },
    }));
  }
  const outfitCalls: PortraitRequest[] = [];
  const faces: string[][] = [];
  let active = true;
  const art: OtomeArt = {
    repaintExpressions: async () => assert.fail("wardrobe reads must not repaint expressions"),
    queueExpressions: (_runId, beat) => void faces.push(beat.segments.map((segment) => segment.speaker)),
    queueScenePaints: async () => undefined,
    releaseBeatArt: async () => undefined,
    active: () => active,
    dispose: () => {
      active = false;
    },
  };
  const deps: RouteDeps = {
    ...t.deps,
    art,
    images: {
      ...t.images,
      async generateOutfit(request) {
        outfitCalls.push(request);
        return t.images.generatePortrait(request);
      },
    },
  };
  const call = routes(deps, runKey);
  const stored = async (id: string) => (await t.store.readDoc(itemId(t.runId, id), normalizeItem))!;
  const player = async () => (await t.store.readDoc(playerId(t.runId), normalizePlayer))!;
  const unit = async (li: string) => (await t.store.readDoc(unitId(t.runId, li), normalizeUnit))!;
  const open = (id: string, body: object = {}) => call("POST", "/runs/:run/items/:item/open", body, { item: id });
  const painted = (id: string) => until(async () => (await stored(id)).art?.state === "ready", `the art of ${id}`);
  return { ...t, deps, art, call, outfitCalls, faces, stored, player, unit, open, painted };
}

test("imageless Wardrobe describes owned looks without reading stories, secrets or paying for images", async () => {
  const t = await itemsWorld("r-looktext-dddddd", {
    images: { connectionId: null },
    owned: OWNED.filter((id) => id !== ITEMS.herLook.id),
  });
  const before = await t.store.readDoc(stateId(t.runId), normalizeState);
  const response = await t.call("GET", "/runs/:run/wardrobe");
  assert.equal(response.status, 200);
  assert.equal(response.body.me[0].description, "short dark hair, freckles\ngrey wool coat");
  assert.equal(
    response.body.me.find((look: { id: string }) => look.id === ITEMS.herFour.id).description,
    ITEMS.herFour.look!.outfitLine,
  );
  assert.equal(
    response.body.him[KAI].find((look: { id: string }) => look.id === ITEMS.hisLook.id).description,
    ITEMS.hisLook.look!.outfitLine,
  );
  assert.ok(!JSON.stringify(response.body).includes(ITEMS.herLook.look!.outfitLine), "an unowned look stays hidden");
  assert.equal(t.paid.length, 0);
  assert.deepEqual(t.calls, [], "descriptions need no model calls");
  assert.deepEqual(await t.store.readDoc(stateId(t.runId), normalizeState), before);
});

test("a Memory's first open paints its CG once and writes its Character Story once, even when opened twice at once", async () => {
  const t = await itemsWorld("r-m4bopen-aaaaaa", { replies: [json(storyPlan())] });
  const [a, b] = await Promise.all([t.open(ITEMS.memory.id), t.open(ITEMS.memory.id)]);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const key = itemStoryKey(ITEMS.memory.id);
  assert.deepEqual(a.body.story, { key });
  assert.deepEqual(b.body.story, { key });
  await t.painted(ITEMS.memory.id);

  assert.equal(t.paid.length, 1, "one paid image");
  assert.equal(t.paid[0]!.method, "generateBannerArt");
  assert.equal(t.paid[0]!.request.width, 768);
  assert.ok(t.paid[0]!.request.prompt.includes("rain on the glass"), "the item's brief");
  assert.ok(
    t.paid[0]!.request.units?.some((unit) => unit.personaId === "persona-ines"),
    "the protagonist is a reference when she is in it",
  );
  assert.equal(t.calls.length, 1, "one P21 call");

  const memory = await t.stored(ITEMS.memory.id);
  assert.deepEqual(memory.story, { key });
  assert.equal(memory.voicedLine, "Stay. The lamp is easier to watch with you here.");
  const chapter = (await t.store.readDoc(chapterId(t.runId, key), normalizeChapter))!;
  assert.equal(chapter.kind, "story");
  assert.equal(chapter.li, KAI);
  assert.equal(chapter.lead, KAI);
  assert.equal(chapter.title, "Lantern Vigil");
  assert.equal(chapter.nodes.length, 3);
  for (const node of chapter.nodes) {
    assert.deepEqual(node.cast, [KAI], "only he is in his story");
    assert.equal(node.cg, undefined);
    assert.equal(node.resolves, undefined);
  }
  assert.deepEqual(chapter.ledger.offscreen, []);
  assert.deepEqual(
    chapter.ledger.relationship.map((row) => row.li),
    [KAI],
    "no ledger row about anyone else leaves his private story",
  );

  const [system, user] = t.calls[0]!.messages.map((message) => message.content);
  assert.ok(system!.includes(forgeKnowledgeBoundary), "P21 carries the knowledge boundary");
  assert.ok(system!.includes("CONTENT CONTRACT"));
  assert.ok(user!.includes("PREMISE: a storm keeps them"));
  assert.ok(user!.includes(`id ${KAI}:`), "his full bible");
  assert.ok(!user!.includes(`id ${MIR}:`) && !user!.includes(`id ${SOL}:`), "no one else's bible");
  assert.ok(!user!.includes("MYSTERY-TRUTH"), "the mystery's truth stays out of a side story");

  const again = await t.open(ITEMS.memory.id);
  assert.equal(again.status, 200);
  assert.equal(again.body.art.state, "ready");
  assert.equal(again.body.item.voicedLine, memory.voicedLine);
  assert.equal(t.calls.length, 1, "a later open calls nothing");
  assert.equal(t.paid.length, 1, "a later open paints nothing");
});

test("an existing owned Snapshot paints its saved vignette once without rewriting its text, history or private memory", async () => {
  const t = await itemsWorld("r-snaplegacy-aaaaaa");
  const original = await t.stored(ITEMS.snapshot.id);
  const state = await t.store.readDoc(stateId(t.runId), normalizeState);
  const memory = await readMemorySources(t.store, t.runId);
  const [first, second] = await Promise.all([t.open(original.id), t.open(original.id)]);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.ok(first.body.art, "a legacy Snapshot's first open starts its illustration");
  await t.painted(original.id);
  assert.equal(t.paid.length, 1, "concurrent opens share one paid picture");
  assert.equal(t.paid[0]!.method, "generateBannerArt");
  assert.ok(t.paid[0]!.request.prompt.includes(original.text!), "the legacy vignette remains the scene context");
  assert.equal(t.paid[0]!.request.units?.length, 2, "only its love interest and protagonist are references");
  const saved = await t.stored(original.id);
  assert.deepEqual({ ...saved, art: null }, original, "only the saved illustration changes the reward");
  assert.deepEqual(
    await t.store.readDoc(stateId(t.runId), normalizeState),
    state,
    "currency, pity, progress and timeline survive",
  );
  assert.deepEqual(await readMemorySources(t.store, t.runId), memory, "its private vignette memory stays unchanged");
  assert.deepEqual(t.calls, [], "an illustration needs no new text-model call or Character Story");
  assert.equal((await t.open(original.id)).body.art.url, saved.art!.url);
  await t.call("GET", "/runs/:run/album");
  await t.call("GET", "/runs/:run/wardrobe");
  assert.equal(t.paid.length, 1, "repeat opens and list reads reuse the saved picture");
});

test("new Snapshot artwork uses its English brief and only the reward's own characters", async () => {
  const t = await itemsWorld("r-snapbrief-dddddd", { images: { ask: true } });
  const brief = `A shared cup of tea beside the lantern.\nKeep the authored spacing  here. ${"Evening light and the quiet room. ".repeat(150)}FINAL ILLUSTRATION DETAIL.`;
  assert.ok(brief.length > 4000);
  await t.store.updateDoc(runDocTarget("item", itemId(t.runId, ITEMS.snapshot.id)), normalizeItem, (current) => ({
    ...current,
    cg: { brief, cast: ["Kai", "Mireille", "Sol"] },
  }));
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    name: "Mireille",
  }));
  for (const [li, portrait] of [
    [KAI, "/kai.png"],
    [MIR, "/mireille.png"],
  ]) {
    await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li!)), normalizeUnit, (unit) => ({
      ...unit,
      portrait,
    }));
  }
  const opened = await t.open(ITEMS.snapshot.id);
  assert.equal(opened.body.art.state, "waiting-consent");
  const preview = await t.call("POST", "/runs/:run/items/:item/art/prompt", {}, { item: ITEMS.snapshot.id });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.ok(preview.body.prompt.includes(brief), "storage and prompt review preserve the full planner brief");
  const negative = `${"Keep the full reviewed negative. ".repeat(150)}FINAL NEGATIVE DETAIL`;
  assert.ok(negative.length > 4000);
  const painted = await t.call(
    "POST",
    "/runs/:run/items/:item/art",
    {
      ...preview.body,
      negativePrompt: negative,
    },
    { item: ITEMS.snapshot.id },
  );
  assert.equal(painted.status, 200, JSON.stringify(painted.body));
  assert.equal(painted.body.art.state, "ready");
  const request = t.paid[0]!.request;
  assert.ok(request.prompt.includes(brief));
  assert.ok(request.negativePrompt.includes(negative), "reviewed Snapshot negatives are not shortened either");
  assert.ok(!request.prompt.includes("SNAP-KAI"), "new artwork uses its planned English brief");
  assert.equal(request.units?.length, 2);
  assert.ok(request.units?.some((unit) => unit.portrait === "/kai.png"));
  assert.ok(
    request.units?.some((unit) => unit.personaId === "persona-ines"),
    "the protagonist keeps their selected persona even when another LI shares their name",
  );
  assert.ok(
    !request.units?.some((unit) => unit.portrait === "/mireille.png"),
    "another LI is not a private Snapshot reference",
  );
  assert.deepEqual(t.calls, []);
});

test("Snapshot art stays unclaimed without an image connection and paints on a later explicit open", async () => {
  const t = await itemsWorld("r-snaplater-eeeeee", { images: { connectionId: null } });
  const original = await t.stored(ITEMS.snapshot.id);
  const first = await t.open(original.id);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.art, null);
  assert.deepEqual(await t.stored(original.id), original);
  assert.deepEqual(t.paid, []);
  await setImages(t.store, t.runId, { connectionId: "conn-image" });
  await t.call("GET", "/runs/:run/album");
  assert.deepEqual(t.paid, [], "enabling images does not make a list read start paid work");
  await t.open(original.id);
  await t.painted(original.id);
  assert.equal(t.paid.length, 1);
  assert.deepEqual({ ...(await t.stored(original.id)), art: null }, original);
  assert.deepEqual(t.calls, []);
});

test("Snapshot illustrations respect consent, prompt review and explicit failed-paint retry", async () => {
  for (const review of [false, true]) {
    const t = await itemsWorld(`r-snapask${review ? "r" : "a"}-bbbbbb`, {
      images: { ask: !review },
      before: (_call, n) => {
        if (n === 1) throw new Error("The image provider failed.");
      },
    });
    const original = await t.stored(ITEMS.snapshot.id);
    const opened = await t.open(original.id, { reviewImagePrompts: review });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.art?.state, "waiting-consent");
    const preview = await t.call("POST", "/runs/:run/items/:item/art/prompt", {}, { item: original.id });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.ok(preview.body.prompt.includes(original.text!));
    assert.deepEqual(t.paid, [], "opening or previewing under consent does not pay for a picture");
    const failed = await t.call("POST", "/runs/:run/items/:item/art", preview.body, { item: original.id });
    assert.equal(failed.status, 200, JSON.stringify(failed.body));
    assert.equal(failed.body.art.state, "failed");
    await t.open(original.id);
    assert.equal(t.paid.length, 1, "opening a failed Snapshot never retries it automatically");
    const [one, two] = await Promise.all([
      t.call("POST", "/runs/:run/items/:item/art", preview.body, { item: original.id }),
      t.call("POST", "/runs/:run/items/:item/art", preview.body, { item: original.id }),
    ]);
    assert.equal(one.body.art.state, "ready");
    assert.deepEqual(two.body.art, one.body.art);
    assert.equal(t.paid.length, 2, "two explicit retry taps share one new picture");
    assert.deepEqual({ ...(await t.stored(original.id)), art: null }, original);
    assert.deepEqual(t.calls, []);
  }
  const unowned = await itemsWorld("r-snaplock-cccccc", { owned: [] });
  assert.equal((await unowned.open(ITEMS.snapshot.id)).status, 409);
  assert.equal((await unowned.call("POST", "/runs/:run/items/:item/art", {}, { item: ITEMS.snapshot.id })).status, 409);
  assert.deepEqual(unowned.paid, []);
});

test("a four-star Moment paints once on concurrent first opens and remains a playable memory in the Album", async () => {
  const t = await itemsWorld("r-momentart-aaaaaa");
  for (const li of [MIR, KAI]) {
    await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (unit) => ({
      ...unit,
      portrait: `/${li}.png`,
      identityLine: `VISUAL-${li}, dark hair`,
    }));
  }
  const original = await t.stored(ITEMS.moment.id);
  const state = await t.store.readDoc(stateId(t.runId), normalizeState);
  const opened = await Promise.all([t.open(original.id), t.open(original.id)]);
  for (const response of opened) {
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.story, { key: itemStoryKey(original.id) });
    assert.ok(response.body.art, "a four-star memory starts its illustration on open");
  }
  await t.painted(original.id);
  assert.equal(t.paid.length, 1, "concurrent opens share one paid illustration");
  const request = t.paid[0]!.request;
  assert.equal(t.paid[0]!.method, "generateBannerArt");
  assert.deepEqual([request.width, request.height], [768, 1344]);
  assert.ok(request.prompt.includes(original.premise!));
  assert.equal(request.units?.length, 2, "only the item's love interest and protagonist are references");
  assert.ok(request.units?.some((subject) => subject.personaId === "persona-ines"));
  assert.ok(request.units?.some((subject) => subject.portrait === `/${MIR}.png`));
  assert.ok(!request.units?.some((subject) => subject.portrait === `/${KAI}.png`));
  assert.ok(request.prompt.includes(`VISUAL-${MIR}`) && !request.prompt.includes(`VISUAL-${KAI}`));
  assert.ok(
    !request.prompt.includes("MYSTERY-TRUTH") && !request.prompt.includes("HIDDEN-TRUTH"),
    "the illustration never reads hidden plot or Bible truth",
  );
  assert.deepEqual(t.calls, [], "an illustration adds no planner or story-generation call");
  assert.deepEqual(await t.store.readDoc(stateId(t.runId), normalizeState), state, "opening charges no Starlight");
  const saved = await t.stored(original.id);
  assert.deepEqual({ ...saved, art: null, story: null }, original, "the saved premise and reward survive");
  const chapter = await t.store.readDoc(chapterId(t.runId, saved.story!.key), normalizeChapter);
  assert.equal(chapter?.nodes.length, 1, "the Moment keeps its one-scene playable chapter");
  assert.deepEqual(chapter?.nodes[0]!.cast, [MIR]);
  await t.store.updateDoc(runDocTarget("item", itemId(t.runId, ITEMS.unowned.id)), normalizeItem, (current) => ({
    ...current,
    art: saved.art,
  }));
  const album = (await t.call("GET", "/runs/:run/album")).body;
  assert.deepEqual(
    album.cgs.map((cg: { key: string; source: string; title: string; url: string }) => [
      cg.key,
      cg.source,
      cg.title,
      cg.url,
    ]),
    [[`item:${original.id}`, "memory", original.title, saved.art!.url]],
    "the Album discovers only the owned four-star illustration as a memory artwork",
  );
  const memory = album.memories.find((value: { id: string }) => value.id === original.id);
  assert.deepEqual(memory.story, saved.story);
  assert.equal(memory.art.url, saved.art!.url);
  assert.equal(memory.li, MIR);
  assert.equal(memory.rarity, 4);
  assert.equal(memory.read, "unread");
  assert.equal(memory.cg, undefined, "no private art brief leaks to the client");
  assert.equal((await t.open(original.id)).body.art.url, saved.art!.url);
  const tap = await t.call("POST", "/runs/:run/items/:item/art", {}, { item: original.id });
  assert.equal(tap.body.art.url, saved.art!.url);
  assert.equal(t.paid.length, 1, "reopening and paint taps reuse the saved picture");
});

test("four-star Moment art respects consent, prompt review and explicit failed-paint retry", async () => {
  for (const review of [false, true]) {
    const t = await itemsWorld(`r-momentask${review ? "r" : "a"}-bbbbbb`, {
      images: { ask: !review, rating: "suggestive" },
      before: (_call, n) => {
        if (n === 1) throw new Error("The image provider failed.");
      },
    });
    const id = ITEMS.moment.id;
    const opened = await t.open(id, { reviewImagePrompts: review });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.art?.state, "waiting-consent");
    const preview = await t.call("POST", "/runs/:run/items/:item/art/prompt", {}, { item: id });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.ok(preview.body.prompt.includes(ITEMS.moment.premise!));
    assert.deepEqual(t.paid, [], "open and prompt review await explicit painting consent");
    const edited = { prompt: "REVIEWED MOMENT, a walk on the quay", negativePrompt: "blurry" };
    const failed = await t.call("POST", "/runs/:run/items/:item/art", edited, { item: id });
    assert.equal(failed.status, 200, JSON.stringify(failed.body));
    assert.equal(failed.body.art.state, "failed");
    const chapter = await t.store.readDoc(chapterId(t.runId, itemStoryKey(id)), normalizeChapter);
    assert.equal(chapter?.nodes.length, 1, "failed artwork keeps the memory playable");
    await t.open(id);
    assert.equal(t.paid.length, 1, "an open never retries failed paid work");
    const retried = await Promise.all([
      t.call("POST", "/runs/:run/items/:item/art", edited, { item: id }),
      t.call("POST", "/runs/:run/items/:item/art", edited, { item: id }),
    ]);
    for (const response of retried) assert.equal(response.body.art.state, "ready");
    assert.deepEqual(retried[0]!.body.art, retried[1]!.body.art);
    assert.equal(t.paid.length, 2, "concurrent explicit retry taps share one new image");
    const request = t.paid[1]!.request;
    assert.ok(request.prompt.startsWith("REVIEWED MOMENT"), "the reviewed text reaches painting");
    assert.match(request.prompt, /(?:^|, )clothed(?:,|$)/);
    assert.ok(request.negativePrompt.includes("child") && request.negativePrompt.includes("nudity"));
    assert.deepEqual(t.calls, []);
  }
});

test("a Character Story plays privately, and an already-read four-star Moment gains art without replay or new charges", async () => {
  const t = await itemsWorld("r-m4bplay-aaaaaa", { images: { connectionId: null }, replies: [json(beatReply())] });
  const opened = await t.open(ITEMS.moment.id);
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.equal(opened.body.art, null, "images disabled leaves the story playable and its art unclaimed");
  assert.equal((await t.stored(ITEMS.moment.id)).art, null);
  const noConnection = await t.call("POST", "/runs/:run/items/:item/art", {}, { item: ITEMS.moment.id });
  assert.equal(noConnection.status, 503);
  assert.equal(noConnection.body.code, "no-connection");
  assert.equal(t.calls.length, 0, "a Moment needs no planning call");
  const key = itemStoryKey(ITEMS.moment.id);
  assert.deepEqual(opened.body.story, { key });
  const chapter = (await t.store.readDoc(chapterId(t.runId, key), normalizeChapter))!;
  assert.equal(chapter.nodes.length, 1);
  assert.deepEqual(chapter.nodes[0]!.cast, [MIR]);
  assert.ok(chapter.nodes[0]!.guide.includes("MOMENT: a walk on the quay."));

  const written = await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, { key, i: "0" });
  assert.equal(written.status, 200, JSON.stringify(written.body));
  const [system, user] = t.calls[0]!.messages.map((message) => message.content);
  assert.ok(user!.includes("Mireille's Character Story"), "P23 names whose side story it is");
  assert.ok(user!.includes("ONE-SCENE side story of Mireille's"));
  assert.ok(user!.includes("no other love interest appears"));
  assert.ok(system!.includes(forgeKnowledgeBoundary));

  const read = await t.call("POST", "/runs/:run/chapters/:key/beats/:i/read", { segment: 2 }, { key, i: "0" });
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.equal(read.body.chapterDone, true);
  assert.deepEqual(
    read.body.grants,
    [{ source: "beat", starlight: 30 }],
    "a story chapter pays its beats, nothing more",
  );

  const sources = await readMemorySources(t.store, t.runId);
  const story = sources.find((source) => source.id === key);
  assert.ok(story, "the finished Moment is canon");
  assert.equal(story.kind, "chat");
  assert.deepEqual(story.audience, [MIR], "only Mireille may recall it");
  const snapshot = sources.find((source) => source.content.includes("SNAP-KAI"));
  assert.ok(snapshot, "the owned Snapshot is canon");
  assert.deepEqual(snapshot.audience, [KAI], "a Snapshot is recalled only by its love interest");
  assert.ok(!sources.some((source) => source.content.includes("Never won.")), "nothing not won is canon");

  const before = {
    item: await t.stored(ITEMS.moment.id),
    chapter: await t.store.readDoc(chapterId(t.runId, key), normalizeChapter),
    beat: await t.store.readDoc(beatId(t.runId, key, 0), normalizeBeat),
    state: await t.store.readDoc(stateId(t.runId), normalizeState),
  };
  assert.deepEqual(t.paid, []);
  await setImages(t.store, t.runId, { connectionId: "conn-image", ask: true });
  await t.call("GET", "/runs/:run/album");
  assert.deepEqual(t.paid, [], "enabling images and reading the Album never start paid work");
  const reopened = await t.open(ITEMS.moment.id);
  assert.equal(reopened.body.art?.state, "waiting-consent", "an existing read memory offers its missing artwork");
  const painted = await t.call("POST", "/runs/:run/items/:item/art", {}, { item: ITEMS.moment.id });
  assert.equal(painted.body.art.state, "ready");
  assert.equal(t.paid.length, 1);
  assert.equal(t.calls.length, 1, "the saved scene is never rewritten to add its illustration");
  assert.deepEqual({ ...(await t.stored(ITEMS.moment.id)), art: null }, before.item);
  assert.deepEqual(await t.store.readDoc(chapterId(t.runId, key), normalizeChapter), before.chapter);
  assert.deepEqual(await t.store.readDoc(beatId(t.runId, key, 0), normalizeBeat), before.beat);
  assert.deepEqual(await t.store.readDoc(stateId(t.runId), normalizeState), before.state);
  assert.deepEqual(await readMemorySources(t.store, t.runId), sources, "private canon is unchanged");
  const album = (await t.call("GET", "/runs/:run/album")).body;
  assert.equal(album.memories.find((value: { id: string }) => value.id === ITEMS.moment.id).read, "done");
  assert.equal(
    album.cgs.find((value: { key: string }) => value.key === `item:${ITEMS.moment.id}`).url,
    painted.body.art.url,
  );
  const replayed = await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, { key, i: "0" });
  assert.equal(replayed.status, 200, JSON.stringify(replayed.body));
  await t.open(ITEMS.moment.id);
  assert.equal(t.calls.length, 1, "replay reads the saved scene");
  assert.equal(t.paid.length, 1, "replay and another open reuse its saved art");
  assert.deepEqual(await t.store.readDoc(stateId(t.runId), normalizeState), before.state);
});

test("Ask before painting and prompt review hold a first open's paint for the tap; a double tap pays once", async () => {
  const t = await itemsWorld("r-m4bask-aaaaaa", { images: { ask: true } });
  const opened = await t.open(ITEMS.hisLook.id);
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.equal(opened.body.art.state, "waiting-consent");
  assert.equal(t.paid.length, 0);
  assert.equal(t.calls.length, 0, "the first-wear beat needs no planning call");
  const chapter = (await t.store.readDoc(chapterId(t.runId, itemStoryKey(ITEMS.hisLook.id)), normalizeChapter))!;
  assert.ok(chapter.nodes[0]!.guide.includes('"Harbour Night"'), "the first-wear beat");
  assert.equal((await t.unit(KAI)).outfits.length, 0, "an unpainted look is not wearable");

  const tap = () => t.call("POST", "/runs/:run/items/:item/art", {}, { item: ITEMS.hisLook.id });
  const taps = await Promise.all([tap(), tap()]);
  for (const result of taps) {
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.art.state, "ready");
  }
  assert.equal(t.outfitCalls.length, 1, "one paid look");
  const request = t.outfitCalls[0]!;
  assert.deepEqual([request.width, request.height], [832, 1216]);
  assert.ok(request.prompt.includes("navy greatcoat") && request.prompt.includes("full body"));
  assert.deepEqual(request.unit.outfits, [], "the likeness is his, never a look he wears");
  const kai = await t.unit(KAI);
  assert.deepEqual(
    kai.outfits.map((outfit) => [outfit.id, outfit.name]),
    [[ITEMS.hisLook.id, "Harbour Night"]],
    "a painted look joins his wardrobe",
  );

  // Prompt review: the paint waits even with Ask off, and the reviewed prompt keeps its safety tags.
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    images: { ...world.images, ask: false },
  }));
  const reviewed = await t.open(ITEMS.herFour.id, { reviewImagePrompts: true });
  assert.equal(reviewed.body.art.state, "waiting-consent");
  assert.equal(t.paid.length, 1);
  const prompt = await t.call("POST", "/runs/:run/items/:item/art/prompt", {}, { item: ITEMS.herFour.id });
  assert.ok(prompt.body.prompt.includes("yellow raincoat"));
  const edited = await t.call(
    "POST",
    "/runs/:run/items/:item/art",
    { prompt: "MY OWN WORDS, yellow raincoat", negativePrompt: "blurry" },
    { item: ITEMS.herFour.id },
  );
  assert.equal(edited.body.art.state, "ready");
  const sent = t.outfitCalls[1]!;
  assert.ok(sent.prompt.startsWith("MY OWN WORDS") && sent.prompt.includes("safe for work"));
  assert.ok(sent.negativePrompt.includes("child"), "the adult negatives stay");
  assert.equal(sent.unit.personaId, "persona-ines", "her persona keeps her likeness");
});

test("without an image connection nothing is claimed or paid, and the Wardrobe still lists every look", async () => {
  const t = await itemsWorld("r-m4bnoimg-aaaaaa", { images: { connectionId: null } });
  const opened = await t.open(ITEMS.herFour.id);
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.equal(opened.body.art, null);
  assert.equal((await t.stored(ITEMS.herFour.id)).art, null, "a later open with images still paints it");
  const tap = await t.call("POST", "/runs/:run/items/:item/art", {}, { item: ITEMS.herFour.id });
  assert.equal(tap.status, 503);
  assert.equal(tap.body.code, "no-connection");
  assert.equal(t.paid.length, 0);

  const wardrobe = (await t.call("GET", "/runs/:run/wardrobe")).body;
  assert.deepEqual(
    wardrobe.me.map((look: { id: string }) => look.id),
    ["base", ITEMS.herLook.id, ITEMS.herFour.id],
  );
  const coat = wardrobe.me[2];
  assert.equal(coat.wearable, false);
  assert.equal(coat.unopened, false, "nothing to open without images");
  assert.deepEqual(
    Object.keys(wardrobe.him),
    [KAI, MIR, SOL],
    "every love interest, in cast order, from the base look up",
  );
  assert.deepEqual(
    wardrobe.him[KAI].map((look: { id: string; unopened: boolean }) => [look.id, look.unopened]),
    [
      ["base", false],
      [ITEMS.hisLook.id, true],
    ],
    "his first-wear beat waits for its open",
  );
  const wear = await t.call("POST", "/runs/:run/wardrobe/wear", { owner: "me", look: ITEMS.herFour.id });
  assert.equal(wear.status, 409, "an unpainted look cannot be worn");
  const base = await t.call("POST", "/runs/:run/wardrobe/wear", { owner: "me", look: "base" });
  assert.equal(base.status, 200);
});

test("Wear at home: his new look gets its faces, her new look is noticed once (P19, SFW), and base clears it", async () => {
  const t = await itemsWorld("r-m4bwear-aaaaaa", {
    heat: "fade",
    replies: [json({ text: "Amber suits you. Do not let it go to your head." })],
  });
  await t.open(ITEMS.hisLook.id);
  await t.open(ITEMS.herLook.id);
  await Promise.all([t.painted(ITEMS.hisLook.id), t.painted(ITEMS.herLook.id)]);

  const his = await t.call("POST", "/runs/:run/wardrobe/wear", { owner: KAI, look: ITEMS.hisLook.id });
  assert.equal(his.status, 200, JSON.stringify(his.body));
  const kai = await t.unit(KAI);
  assert.equal(kai.wornOutfit, ITEMS.hisLook.id);
  assert.equal(wornLookUrl(kai), (await t.stored(ITEMS.hisLook.id)).art!.url, "Home and the faces follow the look");
  assert.deepEqual(t.faces.at(-1), ["Kai"], "his faces for the new look are queued");
  const looks = his.body.wardrobe.him[KAI];
  assert.deepEqual(
    looks.map((look: { id: string; worn: boolean }) => [look.id, look.worn]),
    [
      ["base", false],
      [ITEMS.hisLook.id, true],
    ],
  );
  const wearAgain = await t.call("POST", "/runs/:run/wardrobe/wear", { owner: `li:${KAI}`, look: ITEMS.hisLook.id });
  assert.equal(wearAgain.status, 200, "wearing is idempotent");

  const hers = await t.call("POST", "/runs/:run/wardrobe/wear", { owner: "me", look: ITEMS.herLook.id, li: MIR });
  assert.equal(hers.status, 200, JSON.stringify(hers.body));
  assert.equal((await t.player()).wornOutfit, ITEMS.herLook.id);
  await until(async () => !!(await t.player()).noticed, "P19");
  const noticed = (await t.player()).noticed!;
  assert.deepEqual(
    [noticed.li, noticed.look, noticed.text],
    [MIR, ITEMS.herLook.id, "Amber suits you. Do not let it go to your head."],
  );
  assert.equal(t.calls.length, 1);
  const [system, user] = t.calls[0]!.messages.map((message) => message.content);
  assert.ok(system!.includes(forgeKnowledgeBoundary), "P19 carries the knowledge boundary");
  assert.ok(system!.includes("Heat: SFW."), "P19 takes the home contract whatever the Heat");
  assert.ok(!system!.includes("fade to black"));
  assert.ok(user!.includes("amber silk dress") && user!.includes(`id ${MIR}:`));
  assert.equal(t.calls[0]!.connectionId, "conn-text", "the chat job falls back to narration's connection");

  await t.call("POST", "/runs/:run/wardrobe/wear", { owner: "me", look: ITEMS.herLook.id });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(t.calls.length, 1, "a look already noticed is not noticed again");
  const view = (await t.call("GET", "/runs/:run/wardrobe")).body;
  assert.equal(view.noticed.text, noticed.text);
  assert.equal(view.noticing, false);

  const base = await t.call("POST", "/runs/:run/wardrobe/wear", { owner: "me", look: "base" });
  assert.equal(base.status, 200);
  const after = await t.player();
  assert.equal(after.wornOutfit, undefined);
  assert.equal(after.noticed, null, "what he noticed belongs to the look she took off");

  assert.equal(
    (await t.call("POST", "/runs/:run/wardrobe/wear", { owner: KAI, look: ITEMS.otherLook.id })).status,
    400,
  );
  assert.equal((await t.call("POST", "/runs/:run/wardrobe/wear", { owner: KAI, look: ITEMS.herLook.id })).status, 400);
  assert.equal((await t.call("POST", "/runs/:run/wardrobe/wear", { owner: "me", look: ITEMS.unowned.id })).status, 409);
  assert.equal(
    (await t.call("POST", "/runs/:run/wardrobe/wear", { owner: "li-nobody-zz99", look: "base" })).status,
    404,
  );
});

test("Show {{name}}: a line each time, and +20 affection once per look and love interest, within the day's cap", async () => {
  const lines = ["You chose amber on purpose.", "Again? It still suits you.", "The lamp approves.", "Hm."];
  const t = await itemsWorld("r-m4bshow-aaaaaa", {
    images: { connectionId: null },
    heat: "fade",
    replies: lines.map((text, i) => json({ text, ...(i === 0 ? { face: "flustered" } : { face: "smug" }) })),
  });
  const show = (li: string, look = ITEMS.herLook.id) => t.call("POST", "/runs/:run/wardrobe/show", { li, look });

  const first = await show(KAI);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual(first.body, {
    line: "You chose amber on purpose.",
    face: "flustered",
    grants: [{ source: "show-him", li: KAI, affection: 20 }],
  });
  const second = await show(KAI);
  assert.deepEqual(second.body, { line: "Again? It still suits you.", grants: [] }, "an unknown face is dropped");
  let state = await t.state();
  assert.equal(state.lis[KAI]!.points, 20, "paid once");
  assert.ok(state.lis[KAI]!.firsts["show:my-wardrobe-0-f"]);

  const [x, y] = await Promise.all([show(MIR), show(MIR)]);
  assert.equal(x.body.line, y.body.line, "two Shows at once share one call");
  assert.equal(t.calls.length, 3);
  assert.equal([...x.body.grants, ...y.body.grants].length, 1, "and one grant");

  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (current) => ({
    ...current,
    daily: { dayKey: forgeDayKey(Date.now()), starlight: 0, affection: { [SOL]: 300 } },
  }));
  const capped = await show(SOL);
  assert.deepEqual(capped.body.grants, [], "the day's cap took it");
  state = await t.state();
  assert.equal(state.lis[SOL]!.firsts["show:my-wardrobe-0-f"], undefined, "so it stays owed to a later Show");

  const [system] = t.calls[0]!.messages.map((message) => message.content);
  assert.ok(system!.includes(forgeKnowledgeBoundary), "P24 carries the knowledge boundary");
  assert.ok(system!.includes("fade to black"), "P24 takes the chat contract for him");

  assert.equal((await show(KAI, "base")).status, 400);
  assert.equal((await show(KAI, ITEMS.hisLook.id)).status, 400, "only her looks are shown");
  assert.equal((await show("li-nobody-zz99")).status, 404);
  assert.equal((await show(KAI, ITEMS.unowned.id)).status, 409);
});

test("a couple set completes once on the Love Timeline, and its pair portrait paints once", async () => {
  const t = await itemsWorld("r-m4bpair-aaaaaa");
  await t.open(ITEMS.herLook.id);
  await t.open(ITEMS.hisLook.id);
  const ref = `couple:${ITEMS.hisLook.id}+${ITEMS.herLook.id}`;
  let state = await t.state();
  assert.deepEqual(
    state.timeline.filter((entry) => entry.kind === "couple").map((entry) => [entry.ref, entry.li, entry.text]),
    [[ref, KAI, "Harbour Night · Lantern Dress"]],
  );
  assert.equal(withCoupleTimeline(state, Object.values(ITEMS), at), state, "dated once");

  await Promise.all([t.painted(ITEMS.hisLook.id), t.painted(ITEMS.herLook.id)]);
  let couple = (await t.call("GET", "/runs/:run/wardrobe")).body.couples[0];
  assert.deepEqual([couple.complete, couple.canPaintPair, couple.pair], [true, true, null]);

  const paidBefore = t.paid.length;
  const pair = () => t.call("POST", "/runs/:run/wardrobe/pair", { his: ITEMS.hisLook.id, hers: ITEMS.herLook.id });
  const taps = await Promise.all([pair(), pair()]);
  for (const tap of taps) assert.equal(tap.body.art.state, "ready", JSON.stringify(tap.body));
  assert.equal(t.paid.length, paidBefore + 1, "one paid portrait");
  const request = t.paid.at(-1)!.request;
  assert.equal(request.units?.length, 2);
  assert.deepEqual(
    request.units?.map((unit) => unit.portrait),
    [(await t.stored(ITEMS.hisLook.id)).art!.url, (await t.stored(ITEMS.herLook.id)).art!.url],
    "each painted look is its wearer's reference",
  );
  assert.ok(request.prompt.includes("navy greatcoat") && request.prompt.includes("amber silk dress"));
  state = await t.state();
  assert.deepEqual(
    state.album.cgs.map((entry) => entry.key),
    [`pair:${ITEMS.herLook.id}`],
  );
  couple = (await t.call("GET", "/runs/:run/wardrobe")).body.couples[0];
  assert.equal(couple.pair.state, "ready");
  const album = (await t.call("GET", "/runs/:run/album")).body;
  assert.deepEqual(
    album.cgs.filter((cg: { source: string }) => cg.source === "pair").map((cg: { title: string }) => cg.title),
    ["Harbour Night · Lantern Dress"],
  );

  const half = await itemsWorld("r-m4bhalf-aaaaaa", { owned: [ITEMS.herLook.id] });
  const view = (await half.call("GET", "/runs/:run/wardrobe")).body;
  assert.deepEqual(
    [view.couples[0].complete, view.couples[0].his.owned, view.couples[0].canPaintPair],
    [false, false, false],
  );
  assert.equal((await half.call("POST", "/runs/:run/wardrobe/pair", { hers: ITEMS.herLook.id })).status, 409);
  assert.equal((await half.state()).timeline.length, 0);
});

test("the pair portrait is built at its paid call: a rating lowered while it waits is sent, a switched connection pays nothing", async () => {
  const t = await itemsWorld("r-m4bpair2-aaaaaa", { images: { rating: "suggestive" } });
  await t.open(ITEMS.herLook.id);
  await t.open(ITEMS.hisLook.id);
  await Promise.all([t.painted(ITEMS.hisLook.id), t.painted(ITEMS.herLook.id)]);
  const paidBefore = t.paid.length;
  // Each tap waits in the lane behind a paint that holds it; the change lands once the tap has queued.
  const waitingTap = async (change: Parameters<typeof setImages>[2]) => {
    let reads = 0;
    const store = Object.create(t.store) as typeof t.store;
    store.readDoc = async (id, normalize) => {
      const value = await t.store.readDoc(id, normalize);
      if (id === itemId(t.runId, ITEMS.hisLook.id)) reads += 1;
      return value;
    };
    let release = () => {};
    const held = paintSlot("conn-image", () => new Promise<void>((resolve) => (release = resolve)));
    const tap = paintPairNow({ ...t.deps, store }, t.runId, ITEMS.herLook.id, { debugMode: false }).then(
      (art) => ({ art }),
      (error: { statusCode?: number; code?: string }) => ({ error }),
    );
    await until(() => reads > 0, "the tap read its couple set");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setImages(t.store, t.runId, change);
    release();
    await held;
    return tap;
  };

  const lowered = await waitingTap({ rating: "sfw" });
  assert.equal(lowered.art?.state, "ready", JSON.stringify(lowered));
  assert.equal(t.paid.length, paidBefore + 1);
  assert.ok(t.paid.at(-1)!.request.negativePrompt?.includes("nudity, nsfw"), "the rating in force at the paid call");

  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    album: { ...state.album, cgs: [] },
  }));
  const switched = await waitingTap({ connectionId: "conn-other" });
  assert.deepEqual([switched.error?.statusCode, switched.error?.code], [409, "conflict"]);
  assert.equal(t.paid.length, paidBefore + 1, "nothing is paid on the old connection");
});

test("a Memory whose item link was lost after its chapter was saved gets its voiced line on the next open", async () => {
  const t = await itemsWorld("r-m4bline-aaaaaa", { images: { connectionId: null }, replies: [json(storyPlan())] });
  assert.equal((await t.open(ITEMS.memory.id)).status, 200);
  // As if the process stopped between the chapter's write and the item's.
  await t.store.updateDoc(runDocTarget("item", itemId(t.runId, ITEMS.memory.id)), normalizeItem, (current) => {
    const { voicedLine: _line, ...rest } = current;
    return { ...rest, story: null };
  });
  const again = await t.open(ITEMS.memory.id);
  assert.equal(again.status, 200);
  assert.equal(again.body.item.voicedLine, "Stay. The lamp is easier to watch with you here.");
  assert.equal((await t.stored(ITEMS.memory.id)).voicedLine, "Stay. The lamp is easier to watch with you here.");
  assert.equal(t.calls.length, 1, "from the saved chapter: no second P21 call");
});

test("the Album lists only what is unlocked: owned Memories, seen and painted CGs, learned tells", async () => {
  const t = await itemsWorld("r-m4balbum-aaaaaa", { replies: [json(storyPlan())] });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: {
      ...state.lis,
      [KAI]: { ...state.lis[KAI]!, revealed: ["north-light"] },
      // Read Him (M5) taught two of Sol's mask tells, the last one first.
      [SOL]: { ...state.lis[SOL]!, tellsLearned: [2, 0] },
    },
    album: {
      cgs: [{ key: "main-1/1", url: "/api/global-gallery/file/seen.png", ref: "global-gallery:seen", at, li: KAI }],
    },
  }));
  await t.open(ITEMS.memory.id);
  await t.painted(ITEMS.memory.id);

  const album = (await t.call("GET", "/runs/:run/album")).body;
  assert.deepEqual(
    album.memories.map((memory: { id: string; read: string | null }) => [memory.id, memory.read]),
    [
      [ITEMS.memory.id, "unread"],
      [ITEMS.moment.id, null],
      [ITEMS.snapshot.id, null],
    ],
    "owned Memories in the order won, and nothing not won",
  );
  assert.equal(album.memories[2].text, ITEMS.snapshot.text);
  assert.equal(album.memories[0].cg, undefined, "no CG brief reaches the client");
  assert.deepEqual(
    album.cgs.map((cg: { key: string; source: string }) => [cg.key, cg.source]),
    [
      ["main-1/1", "story"],
      [`item:${ITEMS.memory.id}`, "memory"],
    ],
  );
  assert.deepEqual(album.tells[KAI], ["flinches at the bell"], "the tells of a secret she has learned");
  assert.deepEqual(album.tells[MIR], [], "no tell of a secret still hidden");
  assert.deepEqual(album.tells[SOL], ["won't sit", "polishes clean glass"], "the mask tells Read Him taught, in order");
  assert.equal(album.soundtrack.length, 6);
  assert.ok(album.soundtrack.every((entry: { track: unknown }) => entry.track === null));
  assert.ok(Array.isArray(album.timeline) && Array.isArray(album.favorites));
  // Each owned Moment and Memory is on the Love Timeline on the day it was won (#1947), as a pull or the Memory Selector
  // dates it (`owned.at`); nothing not won is, and nothing is stored.
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    owned: {
      ...state.owned,
      at: { [ITEMS.moment.id]: "2026-10-29T09:00:00.000Z", [ITEMS.memory.id]: "2026-10-30T09:00:00.000Z" },
    },
  }));
  const dated = (await t.call("GET", "/runs/:run/album")).body;
  assert.deepEqual(
    dated.timeline
      .filter((entry: { kind: string }) => entry.kind === "memory" || entry.kind === "moment")
      .map((entry: { kind: string; ref: string; at: string; text: string; li: string }) => [
        entry.kind,
        entry.ref,
        entry.at,
        entry.text,
        entry.li,
      ]),
    [
      ["moment", ITEMS.moment.id, "2026-10-29T09:00:00.000Z", ITEMS.moment.title, ITEMS.moment.li],
      ["memory", ITEMS.memory.id, "2026-10-30T09:00:00.000Z", ITEMS.memory.title, ITEMS.memory.li],
    ],
  );
  assert.ok(!JSON.stringify(dated.timeline).includes(ITEMS.unowned.id));
  assert.equal((await t.state()).timeline.length, 0, "never stored");
});

test("an item not won does not open, paint or show its prompt, and a malformed id names no item", async () => {
  const t = await itemsWorld("r-m4bnotwon-aaaaaa");
  const id = { item: ITEMS.unowned.id };
  assert.equal((await t.call("POST", "/runs/:run/items/:item/open", {}, id)).body.code, "locked");
  assert.equal((await t.call("POST", "/runs/:run/items/:item/art", {}, id)).status, 409);
  assert.equal((await t.call("POST", "/runs/:run/items/:item/art/prompt", {}, id)).status, 409);
  assert.equal((await t.call("POST", "/runs/:run/items/:item/open", {}, { item: "../index" })).status, 404);
  assert.equal(t.paid.length + t.calls.length, 0);
});

test("a failed paint is kept and never repainted by an open; its tap tries once more", async () => {
  const t = await itemsWorld("r-m4bfail-aaaaaa", {
    before: (_call, n) => {
      if (n === 1) throw new Error("the provider is down");
    },
  });
  await t.open(ITEMS.herFour.id);
  await until(async () => (await t.stored(ITEMS.herFour.id)).art?.state === "failed", "the failed paint");
  await t.open(ITEMS.herFour.id);
  assert.equal(t.paid.length, 1, "an open never repaints a failure");
  const retry = await t.call("POST", "/runs/:run/items/:item/art", {}, { item: ITEMS.herFour.id });
  assert.equal(retry.body.art.state, "ready");
  assert.equal(t.paid.length, 2);
  assert.deepEqual(
    (await t.player()).outfits.map((outfit) => outfit.id),
    [ITEMS.herFour.id],
  );
});

test("after teardown an open claims and pays for nothing", async () => {
  const t = await itemsWorld("r-m4bdown-aaaaaa");
  t.art.dispose();
  const opened = await t.open(ITEMS.herFour.id);
  assert.equal(opened.body.art, null);
  assert.equal((await t.stored(ITEMS.herFour.id)).art, null);
  assert.equal(t.paid.length, 0);
});

test("P21 is checked before it is saved: 3–5 nodes, no confrontation, only him, a short voiced line", () => {
  const context = {
    units: [
      { id: KAI, name: "Kai" },
      { id: MIR, name: "Mireille" },
    ],
    state: normalizeState({ lis: { [KAI]: {}, [MIR]: {} } }),
    world: { content: normalizeWorld({}).content },
    li: KAI,
    key: itemStoryKey(ITEMS.memory.id),
  };
  const plan = storyPlan();
  assert.match(String(normalizeStoryPlan({ ...plan, nodes: plan.nodes.slice(0, 2) }, context)), /3 to 5 nodes/);
  assert.match(
    String(
      normalizeStoryPlan(
        { ...plan, nodes: [...plan.nodes, { kind: "confrontation", guide: "They argue.", cast: [KAI] }] },
        context,
      ),
    ),
    /no confrontation/,
  );
  assert.match(
    String(normalizeStoryPlan({ ...plan, voicedLine: Array.from({ length: 25 }, () => "word").join(" ") }, context)),
    /voicedLine/,
  );
  const ok = normalizeStoryPlan(plan, context);
  assert.ok(typeof ok !== "string");
  assert.deepEqual(
    ok.nodes.map((node) => node.cast),
    [[KAI], [KAI], [KAI]],
  );
  assert.equal(ok.voicedLine, plan.voicedLine);
});
