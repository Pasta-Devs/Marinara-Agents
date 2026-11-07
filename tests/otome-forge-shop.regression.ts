// Otome Hearth (#2128): the Shop in Wish, gifts for dates and each love interest's figurine.
// - The catalogue's numbers are pinned, and the aphrodisiac is offered only under NSFW Heat.
// - applyPurchase charges once (a request id seen before replays), refuses before changing anything (not enough
//   Starlight, the aphrodisiac under SFW, a second figurine, a love interest who is not in the story), and the state's
//   gifts, figurines and purchases read back from older, partial and damaged documents.
// - The routes answer with the Shop, the Wardrobe lists what was bought, Home stands the painted figurines in L0, and
//   buying a figurine writes its scene: a one-node Character Story that plays with no planning call and pays its beat.
// - #2138: a figurine is one paid image, painted once in the background right after it is bought, never on a Shop or
//   Home read, with the debug prompt sent in debug mode; Ask before painting and prompt review hold it for the tap; a
//   failure is kept and Retry repaints it once; the image is saved only onto the record that asked, and the record is
//   checked again before the paid call; the cut-out follows and every view shows it; with no image connection nothing
//   is painted; the art routes answer 404, 409 and 503 as the header of S/routes/shop.ts says. The prompt is a clothed
//   collectible figure on the look's chroma matte, and an old 0.9.0 SVG is dropped on read.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  ImageSettings,
  RunState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  FIGURINE_COST,
  GIFT_AFFECTION,
  GIFT_IDS,
  GIFT_PRICES,
  GIFT_PROMPT_NAMES,
  figurineLiOf,
  figurineSceneKey,
  giftsFor,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/shop.ts";
import {
  wardrobeWorking,
  type WardrobeView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wardrobe.ts";
import {
  cutoutsSettled,
  type CutoutClient,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import type { PortraitRequest } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import { paintSlot } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import type {
  OtomeReply,
  RouteDeps,
  RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  chapterId,
  isChapterKey,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import {
  FIGURINE_FRAMING,
  figurinePrompt,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { registerHomeRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/home.ts";
import {
  applyPurchase,
  registerShopRoutes,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/shop.ts";
import { registerStoryRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/story.ts";
import { registerWardrobeRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/wardrobe.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeChapter } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { fakeImages, setImages, until, type PaidCall } from "./fixtures/otome-forge-art.ts";
import { KAI, MIR, SOL, beatReply, json, storyWorld } from "./fixtures/otome-forge-story.ts";

const NSFW = { ...defaultContent(), heat: "fade" as const };
const PAINTED = "/api/global-gallery/file/img1.png";
const STYLE = { styleText: "", positiveTags: "", negativeTags: "" };

function code(error: unknown): string | undefined {
  return (error as { code?: string }).code;
}

test("the Shop's numbers are pinned, and the aphrodisiac is offered only under NSFW Heat", () => {
  assert.deepEqual(GIFT_IDS, ["flowers", "chocolates", "wine", "aphrodisiac"]);
  assert.deepEqual(GIFT_PRICES, { flowers: 200, chocolates: 300, wine: 600, aphrodisiac: 1000 });
  for (const gift of GIFT_IDS) {
    assert.equal(GIFT_AFFECTION[gift], GIFT_PRICES[gift] / 5, `${gift}: a fifth of its price`);
    assert.ok(GIFT_PRICES[gift] >= 100 && GIFT_PRICES[gift] <= 1000);
  }
  assert.equal(GIFT_PROMPT_NAMES.aphrodisiac, "an aphrodisiac");
  assert.equal(FIGURINE_COST, 5000);
  assert.deepEqual(giftsFor({ heat: "sfw" }), ["flowers", "chocolates", "wine"]);
  assert.deepEqual(giftsFor({ heat: "fade" }), GIFT_IDS);
  assert.deepEqual(giftsFor({ heat: "explicit" }), GIFT_IDS);
  // A figurine's scene is a Character Story key, with room for the longest love interest id.
  assert.ok(isChapterKey(figurineSceneKey("li-abcdefghijklmnop-ab12")));
});

test("applyPurchase charges once, replays a seen request id, and refuses before changing anything", () => {
  const at = "2026-11-06T10:00:00.000Z";
  const state = { ...normalizeState({ lis: { [KAI]: {}, [MIR]: {} } }), wallet: { starlight: 5600 } } as RunState;
  const sfw = { heat: "sfw" as const };

  const flowers = applyPurchase(state, { purchase: { gift: "flowers" }, content: sfw, requestId: "s-req-0001", at });
  assert.equal(flowers.replayed, false);
  assert.equal(flowers.state.wallet.starlight, 5400);
  assert.deepEqual(flowers.state.owned.gifts, { flowers: 1 });
  assert.deepEqual(flowers.state.purchases, [{ id: "s-req-0001", what: "flowers", at }]);
  assert.deepEqual(state.owned.gifts, {}, "the state it was given is never changed");

  const again = applyPurchase(flowers.state, {
    purchase: { gift: "flowers" },
    content: sfw,
    requestId: "s-req-0001",
    at,
  });
  assert.equal(again.replayed, true);
  assert.equal(again.state, flowers.state, "a request id seen before changes nothing");
  assert.throws(
    () => applyPurchase(flowers.state, { purchase: { gift: "wine" }, content: sfw, requestId: "s-req-0001", at }),
    (error) => code(error) === "bad-request",
  );
  const second = applyPurchase(flowers.state, { purchase: { gift: "flowers" }, content: sfw, at });
  assert.deepEqual(second.state.owned.gifts, { flowers: 2 }, "gifts are unlimited");
  assert.deepEqual(second.state.purchases, flowers.state.purchases, "no request id, no record");

  assert.throws(
    () => applyPurchase(state, { purchase: { gift: "aphrodisiac" }, content: sfw, at }),
    (error) => code(error) === "locked",
    "the aphrodisiac is refused under SFW Heat",
  );
  const potion = applyPurchase(state, { purchase: { gift: "aphrodisiac" }, content: { heat: "explicit" }, at });
  assert.deepEqual(potion.state.owned.gifts, { aphrodisiac: 1 });

  const kai = applyPurchase(flowers.state, { purchase: { figurine: KAI }, content: sfw, requestId: "s-req-0002", at });
  assert.equal(kai.state.wallet.starlight, 400);
  assert.deepEqual(kai.state.owned.figurines, { [KAI]: at });
  assert.throws(
    () =>
      applyPurchase({ ...kai.state, wallet: { starlight: 9000 } }, { purchase: { figurine: KAI }, content: sfw, at }),
    (error) => code(error) === "conflict",
    "one figurine per love interest",
  );
  assert.throws(
    () => applyPurchase(kai.state, { purchase: { figurine: MIR }, content: sfw, at }),
    (error) => code(error) === "insufficient",
  );
  assert.throws(
    () => applyPurchase(kai.state, { purchase: { gift: "wine" }, content: sfw, at }),
    (error) => code(error) === "insufficient",
  );
  assert.throws(
    () => applyPurchase(state, { purchase: { figurine: SOL }, content: sfw, at }),
    (error) => code(error) === "not-found",
    "a love interest who is not in the story",
  );
});

test("the state reads gifts, figurines and purchases from older, partial and damaged documents", () => {
  // Older documents (and several fixtures) write `owned` with items alone.
  const old = normalizeState({ owned: { items: ["memories-0-f"] } });
  assert.deepEqual(old.owned.gifts, {});
  assert.deepEqual(old.owned.figurines, {});
  assert.deepEqual(old.purchases, []);
  assert.deepEqual(normalizeState(undefined).owned, { items: [], at: {}, plush: {}, gifts: {}, figurines: {} });

  const purchases = Array.from({ length: 25 }, (_, n) => ({
    id: `s-req-${String(n).padStart(4, "0")}`,
    what: "wine",
    at: "t",
  }));
  const read = normalizeState({
    owned: {
      items: [],
      gifts: { flowers: 2, wine: 0, aphrodisiac: 1.5, perfume: 3, chocolates: 4 },
      figurines: { [KAI]: "2026-11-06T10:00:00.000Z", "not-an-li": "t", [MIR]: 7 },
    },
    purchases: [...purchases, { id: "s-bad", what: 1 }],
  });
  assert.deepEqual(read.owned.gifts, { flowers: 2, chocolates: 4 }, "unknown gifts and bad counts are dropped");
  assert.deepEqual(read.owned.figurines, { [KAI]: "2026-11-06T10:00:00.000Z" });
  assert.equal(read.purchases.length, 20, "the newest 20 are kept");
  assert.equal(read.purchases[0]!.id, "s-req-0005");
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(read))), read, "what is kept reads back the same");
});

/** Every route a Shop test calls, on a fake router; `call` answers like Fastify ({status, body}). */
function shopRoutes(deps: RouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  const router = {
    get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
    post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
  };
  registerShopRoutes(router, deps);
  registerWardrobeRoutes(router, deps);
  registerHomeRoutes(router, deps);
  registerStoryRoutes(router, deps);
  return async (method: "GET" | "POST", path: string, body: object = {}, params: Record<string, string> = {}) => {
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(value) {
        status = value;
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
        query: method === "GET" ? fields : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

interface ShopWorldOptions extends Partial<Parameters<typeof storyWorld>[0]> {
  /** An image connection (`conn-image`) with these settings; none without. */
  images?: Partial<ImageSettings>;
  /** Runs before the n-th paid image answers (1-based): throw to fail it, or wait to hold it. */
  before?: (call: PaidCall, n: number) => void | Promise<void>;
}

async function shopWorld(runKey: string, { images: settings, before, ...options }: ShopWorldOptions = {}) {
  const t = await storyWorld({ runKey, ...options });
  if (settings) await setImages(t.store, t.runId, { connectionId: "conn-image", ...settings });
  const fake = fakeImages({ before });
  // A figurine is painted as a look is (generateOutfit); the fake counts it as a paid portrait.
  const outfitCalls: PortraitRequest[] = [];
  const cuts: string[] = [];
  const cutouts: CutoutClient = {
    async cutOut(url) {
      cuts.push(url);
      return { id: `cut${cuts.length}`, url: `/api/global-gallery/file/cut-${cuts.length}.png` };
    },
    deleteGalleryImage: async () => true,
  };
  const deps: RouteDeps = {
    ...t.deps,
    cutouts,
    images: {
      ...fake.images,
      async generateOutfit(request) {
        outfitCalls.push(request);
        return fake.images.generatePortrait(request);
      },
    },
  };
  const call = shopRoutes(deps, runKey);
  const setStarlight = (starlight: number) =>
    t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
      ...state,
      wallet: { starlight },
    }));
  const unit = async (li: string) => (await t.store.readDoc(unitId(t.runId, li), normalizeUnit))!;
  const setUnit = (li: string, change: (unit: ReturnType<typeof normalizeUnit>) => ReturnType<typeof normalizeUnit>) =>
    t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, change);
  const settle = async () => {
    for (let round = 0; round < 50; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      await runForeground(t.runId, async () => undefined);
    }
  };
  const buy = (li: string, body: object = {}) => call("POST", "/runs/:run/shop/figurines/:li", body, { li });
  const tap = (li: string, body: object = {}) => call("POST", "/runs/:run/shop/figurines/:li/art", body, { li });
  const shown = async (li: string) =>
    (await call("GET", "/runs/:run/shop")).body.figurines.find((entry: { li: string }) => entry.li === li);
  const painted = (li: string, state = "ready") =>
    until(async () => (await unit(li)).figurine?.state === state, `${li}'s figurine ${state}`);
  return {
    ...t,
    ...fake,
    deps,
    call,
    setStarlight,
    unit,
    setUnit,
    settle,
    buy,
    tap,
    shown,
    painted,
    outfitCalls,
    cuts,
  };
}

test("the Shop routes sell gifts and a figurine once, and the Wardrobe and Home show what was bought", async () => {
  // No image connection: buying a figurine paints nothing, and the shelf keeps their portrait frame.
  const t = await shopWorld("r-shop01-aaaaaa");
  await t.setStarlight(5500);
  const shop = await t.call("GET", "/runs/:run/shop");
  assert.equal(shop.status, 200, JSON.stringify(shop.body));
  assert.equal(shop.body.starlight, 5500);
  assert.deepEqual(
    shop.body.gifts.map((gift: { id: string }) => gift.id),
    ["flowers", "chocolates", "wine"],
    "no aphrodisiac under SFW Heat",
  );
  assert.deepEqual(
    shop.body.figurines.map((entry: Record<string, unknown>) => [
      entry.li,
      entry.owned,
      entry.art,
      entry.cutting,
      "url" in entry,
    ]),
    [
      [KAI, false, null, false, false],
      [MIR, false, null, false, false],
      [SOL, false, null, false, false],
    ],
  );
  assert.equal(shop.body.figurineCost, 5000);

  const bought = await t.call("POST", "/runs/:run/shop/gifts", { gift: "chocolates", requestId: "s-gift-0001" });
  assert.equal(bought.status, 200, JSON.stringify(bought.body));
  assert.equal(bought.body.starlight, 5200);
  assert.equal(bought.body.shop.gifts.find((gift: { id: string }) => gift.id === "chocolates").owned, 1);
  const replay = await t.call("POST", "/runs/:run/shop/gifts", { gift: "chocolates", requestId: "s-gift-0001" });
  assert.equal(replay.body.starlight, 5200, "a request sent again charges nothing");
  for (const [body, status, errorCode] of [
    [{ gift: "perfume" }, 404, "not-found"],
    [{ gift: "aphrodisiac" }, 409, "locked"],
    [{}, 400, "bad-request"],
  ] as const) {
    const refused = await t.call("POST", "/runs/:run/shop/gifts", body);
    assert.equal(refused.status, status, JSON.stringify(refused.body));
    assert.equal(refused.body.code, errorCode);
  }
  for (const li of ["not-an-li", "li-nobody-zz99"]) {
    const refused = await t.buy(li);
    assert.equal(refused.status, 404, li);
  }

  const figurine = await t.buy(KAI, { requestId: "s-fig-00001" });
  assert.equal(figurine.status, 200, JSON.stringify(figurine.body));
  assert.equal(figurine.body.starlight, 200);
  const key = figurineSceneKey(KAI);
  assert.deepEqual(figurine.body.story, { key });
  assert.deepEqual(figurine.body.shop.figurines[0].story, { key });
  assert.equal(figurine.body.shop.figurines[0].owned, true);
  assert.equal(figurine.body.shop.figurines[0].art, null, "no image connection: nothing is set to paint");
  assert.equal((await t.unit(KAI)).figurine, undefined);
  const chapter = (await t.store.readDoc(chapterId(t.runId, key), normalizeChapter))!;
  assert.equal(chapter.kind, "story");
  assert.equal(chapter.li, KAI);
  assert.equal(chapter.lead, KAI);
  assert.equal(chapter.connectionId, "", "no planning call wrote it");
  assert.equal(chapter.nodes.length, 1);
  assert.deepEqual(chapter.nodes[0]!.cast, [KAI]);
  assert.match(chapter.nodes[0]!.guide, /FIGURINE SCENE between Kai and the protagonist/);
  assert.match(chapter.nodes[0]!.guide, /funny and cute/);
  assert.equal(t.calls.length, 0, "buying calls no model");
  assert.equal(t.paid.length, 0, "and paints nothing without an image connection");
  const noImages = await t.tap(KAI);
  assert.equal(noImages.status, 503, JSON.stringify(noImages.body));
  assert.equal(noImages.body.code, "no-connection");

  const lost = await t.buy(KAI, { requestId: "s-fig-00001" });
  assert.equal(lost.status, 200, "the same request again is answered as before");
  assert.deepEqual(lost.body.story, { key });
  assert.equal(lost.body.starlight, 200);
  await t.setStarlight(9000);
  const twice = await t.buy(KAI);
  assert.equal(twice.status, 409);
  assert.equal(twice.body.code, "conflict");
  const mireille = await t.buy(MIR);
  assert.equal(mireille.status, 200);
  await t.setStarlight(100);
  const poor = await t.buy(SOL);
  assert.equal(poor.status, 409);
  assert.equal(poor.body.code, "insufficient");
  assert.equal((await t.state()).owned.figurines[SOL], undefined);

  const wardrobe = await t.call("GET", "/runs/:run/wardrobe");
  assert.equal(wardrobe.status, 200, JSON.stringify(wardrobe.body));
  assert.deepEqual(wardrobe.body.gifts, { chocolates: 1 });
  assert.deepEqual(wardrobe.body.figurines, [
    { li: KAI, art: null, cutting: false, story: { key } },
    { li: MIR, art: null, cutting: false, story: { key: figurineSceneKey(MIR) } },
  ]);
  const home = await t.call("GET", "/runs/:run/home");
  assert.equal(home.status, 200, JSON.stringify(home.body));
  assert.deepEqual(home.body.figurines, [], "a figurine not painted does not stand on Home");

  // Painted ones (a story that had an image connection): only a bought one stands on Home, cut out once it is.
  const ready = { state: "ready" as const, at: "2026-11-06T10:00:00.000Z", url: PAINTED };
  await t.setUnit(MIR, (unit) => ({ ...unit, figurine: ready }));
  await t.setUnit(SOL, (unit) => ({ ...unit, figurine: { ...ready, url: "/api/global-gallery/file/sol.png" } }));
  const after = await t.call("GET", "/runs/:run/home");
  assert.deepEqual(after.body.figurines, [{ li: MIR, art: ready, url: PAINTED, cutting: true }], "uncut meanwhile");
  await cutoutsSettled();
  assert.deepEqual(t.cuts, [PAINTED], "Home cuts out only the bought one, for free");
  const cut = "/api/global-gallery/file/cut-1.png";
  assert.deepEqual((await t.call("GET", "/runs/:run/home")).body.figurines, [
    { li: MIR, art: ready, url: cut, cutting: false },
  ]);
  assert.equal((await t.call("GET", "/runs/:run/wardrobe")).body.figurines[1].url, cut);
  assert.equal(t.paid.length, 0, "Home and the Shop never paint");

  // A painted figurine whose cut-out was never queued (a restart between paint and cut-out): the Wardrobe queues it
  // itself, for free, so it never reads as being cut out with nothing on the way (its poll waits on `cutting`).
  const kaiPainted = "/api/global-gallery/file/kai.png";
  await t.setUnit(KAI, (unit) => ({ ...unit, figurine: { ...ready, url: kaiPainted } }));
  const first = await t.call("GET", "/runs/:run/wardrobe");
  assert.equal(first.body.figurines[0].cutting, true, "being cut out");
  await cutoutsSettled();
  assert.deepEqual(t.cuts.slice(-1), [kaiPainted], "queued by the Wardrobe read, with no Shop or Home visit");
  const kai = (await t.call("GET", "/runs/:run/wardrobe")).body.figurines[0];
  assert.equal(kai.cutting, false, "cut out, so the Wardrobe stops polling");
  assert.notEqual(kai.url, kaiPainted);
  assert.equal(t.paid.length, 0, "the Wardrobe never paints");
});

test("under NSFW Heat the Shop sells the aphrodisiac; Heat lowered keeps it owned, unlisted and unsold", async () => {
  const t = await shopWorld("r-shop02-bbbbbb", { content: NSFW });
  const shop = await t.call("GET", "/runs/:run/shop");
  assert.deepEqual(
    shop.body.gifts.map((gift: { id: string; price: number }) => [gift.id, gift.price]),
    [
      ["flowers", 200],
      ["chocolates", 300],
      ["wine", 600],
      ["aphrodisiac", 1000],
    ],
  );
  const bought = await t.call("POST", "/runs/:run/shop/gifts", { gift: "aphrodisiac" });
  assert.equal(bought.status, 200, JSON.stringify(bought.body));
  assert.equal(bought.body.starlight, 1000);
  assert.deepEqual((await t.state()).owned.gifts, { aphrodisiac: 1 });
  assert.deepEqual((await t.call("GET", "/runs/:run/wardrobe")).body.gifts, { aphrodisiac: 1 });

  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    content: defaultContent(),
  }));
  assert.deepEqual((await t.call("GET", "/runs/:run/wardrobe")).body.gifts, {}, "not listed under SFW Heat");
  assert.ok(
    !(await t.call("GET", "/runs/:run/shop")).body.gifts.some((gift: { id: string }) => gift.id === "aphrodisiac"),
  );
  const refused = await t.call("POST", "/runs/:run/shop/gifts", { gift: "aphrodisiac" });
  assert.equal(refused.body.code, "locked", "the server refuses it, whatever the client shows");
  assert.deepEqual((await t.state()).owned.gifts, { aphrodisiac: 1 }, "and it stays owned");
});

test("a figurine's scene is a private Character Story that plays without a planning call and pays its beat", async () => {
  const t = await shopWorld("r-shop03-cccccc", { replies: [json(beatReply())] });
  await t.setStarlight(5000);
  const bought = await t.call("POST", "/runs/:run/shop/figurines/:li", {}, { li: MIR });
  assert.equal(bought.status, 200, JSON.stringify(bought.body));
  const key = bought.body.story.key as string;
  assert.equal(key, figurineSceneKey(MIR));

  const story = await t.call("GET", "/runs/:run/story");
  const entry = story.body.chapters.find((chapter: { key: string }) => chapter.key === key);
  assert.deepEqual(
    { kind: entry.kind, li: entry.li, nodes: entry.nodes, state: entry.state },
    { kind: "story", li: MIR, nodes: 1, state: "in-progress" },
    "it is listed on the Story screen as hers",
  );

  const written = await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, { key, i: "0" });
  assert.equal(written.status, 200, JSON.stringify(written.body));
  assert.equal(t.calls.length, 1, "one call: the scene itself");
  const user = t.calls[0]!.messages.at(-1)!.content!;
  assert.ok(user.includes("Mireille's Character Story"));
  assert.ok(user.includes("ONE-SCENE side story of Mireille's"));
  assert.ok(user.includes("FIGURINE SCENE between Mireille and the protagonist"));

  const read = await t.call("POST", "/runs/:run/chapters/:key/beats/:i/read", { segment: 2 }, { key, i: "0" });
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.equal(read.body.chapterDone, true);
  assert.deepEqual(read.body.grants, [{ source: "beat", starlight: 30 }]);
  const source = (await readMemorySources(t.store, t.runId)).find((entry) => entry.id === key);
  assert.ok(source, "the scene is canon");
  assert.equal(source.kind, "character-story");
  assert.equal(source.audience?.[0], MIR, "private to her (and anyone who speaks in it)");
});

test("buying a figurine paints it once in the background, never on a read, and its cut-out reaches every view", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const t = await shopWorld("r-shop04-dddddd", { images: {}, before: () => gate });
  await t.setStarlight(6000);
  const portrait = "/api/global-gallery/file/kai.png";
  await t.setUnit(KAI, (unit) => ({
    ...unit,
    portrait,
    identityLine: "tall man, cyan hair, red eyes",
    outfitLine: "black greatcoat",
    outfits: [
      {
        id: "his-look-0001",
        name: "Dress uniform",
        outfitLine: "white dress uniform with gold braid",
        url: "/api/global-gallery/file/kai-uniform.png",
        at: "2026-11-01T10:00:00.000Z",
      },
    ],
    wornOutfit: "his-look-0001",
  }));
  for (const path of ["/runs/:run/shop", "/runs/:run/home", "/runs/:run/shop"]) {
    assert.equal((await t.call("GET", path)).status, 200);
  }
  await t.settle();
  assert.equal(t.paid.length, 0, "opening the Shop or Home paints nothing");

  const bought = await t.buy(KAI, { requestId: "s-fig-00004" });
  assert.equal(bought.status, 200, JSON.stringify(bought.body));
  assert.equal(bought.body.shop.figurines[0].art.state, "pending", "claimed before the paid call");
  await until(() => t.paid.length === 1, "the paid call");
  // The purchase answered while its one paid image is still being painted.
  assert.equal((await t.shown(KAI)).art.state, "pending");
  assert.equal((await t.buy(KAI, { requestId: "s-fig-00004" })).status, 200, "the same purchase again");
  await t.call("GET", "/runs/:run/home");
  await t.settle();
  assert.equal(t.paid.length, 1, "a replay, the Shop and Home never paint it again");

  release();
  await t.painted(KAI);
  assert.equal(t.paid.length, 1);
  const [request] = t.outfitCalls;
  assert.equal(request!.connectionId, "conn-image");
  assert.deepEqual([request!.width, request!.height], [832, 1216], "a look's portrait size");
  assert.equal(request!.debugMode, true, "the Engine logs the prompt in debug mode");
  assert.deepEqual(
    request!.unit,
    { kind: "character", portrait, outfits: [], who: "Kai" },
    "their likeness, as a look gets it, never painted as a stranger",
  );
  assert.ok(request!.prompt.startsWith("tall man, cyan hair, red eyes, white dress uniform with gold braid"));
  assert.ok(request!.prompt.includes(FIGURINE_FRAMING));
  assert.ok(!request!.prompt.includes("black greatcoat"), "the look they wear now");
  assert.match(request!.prompt, /plain flat solid chroma (green|magenta) #[0-9A-F]{6} background/);
  assert.match(request!.prompt, /safe for work, fully clothed, adult person/);
  assert.match(request!.negativePrompt, /child, childlike, minor/);
  assert.match(request!.negativePrompt, /cast shadow, floor shadow/);

  // The cut-out follows the paint (free), and the Shop, the Wardrobe and Home show it.
  // (Home's read before cut out the look Kai wears; the figurine's is its own.)
  await until(() => t.cuts.includes(PAINTED), "the cut-out");
  await cutoutsSettled();
  const cut = (await t.unit(KAI)).cutouts[PAINTED]!.url!;
  assert.match(cut, /^\/api\/global-gallery\/file\/cut-\d\.png$/u);
  const shelf = await t.shown(KAI);
  assert.equal(shelf.art.state, "ready");
  assert.equal(shelf.art.url, PAINTED);
  assert.equal(shelf.url, cut);
  assert.equal(shelf.cutting, false);
  assert.equal((await t.call("GET", "/runs/:run/wardrobe")).body.figurines[0].url, cut);
  assert.deepEqual(
    (await t.call("GET", "/runs/:run/home")).body.figurines.map((entry: { li: string; url: string }) => [
      entry.li,
      entry.url,
    ]),
    [[KAI, cut]],
  );
  await t.call("GET", "/runs/:run/shop");
  await t.settle();
  assert.equal(t.paid.length, 1, "a painted figurine is never painted again");
  assert.equal(t.cuts.filter((url) => url === PAINTED).length, 1, "nor cut out again");
});

test("Ask before painting and prompt review hold a bought figurine for the tap, which paints it once", async () => {
  const t = await shopWorld("r-shop05-eeeeee", { images: { ask: true } });
  await t.setStarlight(20000);
  const kai = await t.buy(KAI);
  assert.equal(kai.status, 200, JSON.stringify(kai.body));
  assert.equal(kai.body.shop.figurines[0].art.state, "waiting-consent");
  await setImages(t.store, t.runId, { ask: false });
  const mir = await t.buy(MIR, { reviewImagePrompts: true });
  assert.equal(mir.body.shop.figurines[1].art.state, "waiting-consent", "the Engine's prompt review holds it too");
  await t.settle();
  assert.equal(t.paid.length, 0, "nothing is painted before the tap");

  for (const [li, status, code] of [
    [SOL, 409, "locked"],
    ["li-nobody-zz99", 404, "not-found"],
    ["not-an-li", 404, "not-found"],
  ] as const) {
    const refused = await t.tap(li);
    assert.equal(refused.status, status, `${li}: ${JSON.stringify(refused.body)}`);
    assert.equal(refused.body.code, code);
    const prompt = await t.call("POST", "/runs/:run/shop/figurines/:li/art/prompt", {}, { li });
    assert.equal(prompt.status, status, li);
  }
  const review = await t.call("POST", "/runs/:run/shop/figurines/:li/art/prompt", {}, { li: KAI });
  assert.equal(review.status, 200, JSON.stringify(review.body));
  assert.ok(review.body.prompt.includes(FIGURINE_FRAMING));
  assert.match(review.body.negativePrompt, /child, childlike/);
  assert.equal(t.paid.length, 0, "the prompt to review costs nothing");

  const tapped = await t.tap(KAI, { prompt: "a tiny Kai figure", negativePrompt: "" });
  assert.equal(tapped.status, 200, JSON.stringify(tapped.body));
  assert.equal(tapped.body.art.state, "ready", "the tap waits for its paint");
  assert.equal(t.paid.length, 1);
  assert.ok(t.outfitCalls[0]!.prompt.startsWith("a tiny Kai figure, "), "the reviewed prompt, as edited");
  assert.match(t.outfitCalls[0]!.prompt, /safe for work, fully clothed/, "with its rating tags put back");
  assert.equal((await t.tap(KAI)).body.art.state, "ready");
  assert.equal(t.paid.length, 1, "a painted figurine answers a tap as it is");

  const [one, two] = await Promise.all([t.tap(MIR), t.tap(MIR)]);
  assert.deepEqual([one.body.art.state, two.body.art.state], ["ready", "ready"]);
  assert.equal(t.paid.length, 2, "two taps at once pay once");
  await cutoutsSettled();
});

test("a failed figurine paint is kept, never painted again by itself, and Retry paints it once", async () => {
  const t = await shopWorld("r-shop06-ffffff", {
    images: {},
    before: (_call, n) => {
      if (n === 1) throw new Error("the provider refused");
    },
  });
  await t.setStarlight(5000);
  await t.buy(SOL);
  await t.painted(SOL, "failed");
  const failed = await t.shown(SOL);
  assert.equal(failed.art.state, "failed");
  assert.equal(failed.art.error, "the provider refused");
  assert.equal("url" in failed, false, "the portrait frame stands in");
  assert.deepEqual((await t.call("GET", "/runs/:run/home")).body.figurines, [], "a failed one is not on Home");
  await t.call("GET", "/runs/:run/wardrobe");
  await t.settle();
  assert.equal(t.paid.length, 1, "a failure is never painted again without a tap");

  const retried = await t.tap(SOL);
  assert.equal(retried.status, 200, JSON.stringify(retried.body));
  assert.equal(retried.body.art.state, "ready");
  assert.equal(t.paid.length, 2, "Retry paints it once");
  await cutoutsSettled();
});

test("a figurine's image is saved only onto the record that asked, which is checked again before the paid call", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const t = await shopWorld("r-shop07-gggggg", { images: {}, before: (_call, n) => (n === 1 ? gate : undefined) });
  await t.setStarlight(20000);
  await t.buy(KAI);
  await until(() => t.paid.length === 1, "the paid call");
  // Another claim replaced the record while this one painted (a restart's, say): the image is not kept.
  const other = { state: "pending" as const, at: "2026-11-06T09:00:00.000Z" };
  await t.setUnit(KAI, (unit) => ({ ...unit, figurine: other }));
  release();
  await until(() => t.deleted.length === 1, "the image nothing keeps");
  assert.deepEqual(t.deleted, ["img1"], "deleted from the gallery again");
  assert.deepEqual((await t.unit(KAI)).figurine, other);
  assert.equal((await t.shown(KAI)).art.state, "stopped", "a pending record nothing paints reads as stopped");
  assert.equal((await t.tap(KAI)).body.art.state, "ready", "and its tap paints it");
  assert.equal(t.paid.length, 2);

  // The image connection changes while the figurine waits for its turn: it is stopped, and nothing is paid for.
  let free!: () => void;
  const busy = paintSlot("conn-image", () => new Promise<void>((resolve) => (free = resolve)));
  await until(() => !!free, "the slot held");
  await t.buy(MIR);
  assert.equal((await t.shown(MIR)).art.state, "pending");
  await setImages(t.store, t.runId, { connectionId: "conn-other" });
  free();
  await busy;
  await t.painted(MIR, "stopped");
  assert.equal(t.paid.length, 2);
  await cutoutsSettled();
});

test("the figurine prompt is a clothed collectible figure on a chroma matte, whatever the image rating", () => {
  const input = {
    name: "Kai",
    identityLine: "tall man, cyan hair, red eyes",
    outfitLine: "black greatcoat",
    presentation: "man" as const,
    style: STYLE,
  };
  const images = normalizeWorld(undefined).images;
  const sfw = figurinePrompt({ ...input, world: { content: defaultContent(), images } });
  assert.equal(
    sfw.prompt,
    `tall man, cyan hair, red eyes, black greatcoat, ${FIGURINE_FRAMING}, plain flat solid chroma green #00FF00 background, safe for work, fully clothed, adult man`,
  );
  assert.match(sfw.negativePrompt, /nudity, nsfw, sexual content/);
  const explicit = figurinePrompt({
    ...input,
    world: { content: { ...defaultContent(), heat: "explicit" }, images: { ...images, rating: "explicit" } },
  });
  assert.match(explicit.prompt, /, clothed, adult man$/u, "a look's own tags: never explicit");
  assert.doesNotMatch(explicit.prompt, /explicit|nsfw/u);
  assert.match(explicit.negativePrompt, /nudity, explicit sexual activity/);
  const edited = figurinePrompt({ ...input, world: { content: defaultContent(), images } }, { prompt: "a small Kai" });
  assert.equal(edited.prompt, "a small Kai, safe for work, fully clothed, adult man", "an edit keeps its tags");
});

test("a unit keeps its figurine's paint record and drops a 0.9.0 SVG figurine", () => {
  const ready = { state: "ready", at: "t", url: PAINTED, ref: "global-gallery:img1" };
  assert.deepEqual(normalizeUnit({ id: KAI, figurine: ready }).figurine, ready);
  assert.equal("figurine" in normalizeUnit({ id: KAI }), false, "none yet: no key at all");
  assert.equal("figurine" in normalizeUnit({ id: KAI, figurine: { state: "drawn" } }), false, "a damaged one goes");
  const old = normalizeUnit({ id: KAI, figurineArt: { svg: "<svg/>", at: "t" } });
  assert.equal("figurineArt" in old, false, "an old drawing is simply dropped");
  assert.equal("figurine" in old, false);
});

test("a figurine scene's key names its love interest; no other chapter key does", () => {
  assert.equal(figurineLiOf(figurineSceneKey(KAI)), KAI);
  for (const key of ["story-memories-1-f", "main-3", "story-figurine-", "prestige-li-kai-0001-1"]) {
    assert.equal(figurineLiOf(key), null, key);
  }
});

test("the Wardrobe keeps reading while a figurine paints or is cut out, and stops once it is shown cut out", () => {
  const base = { him: {}, me: [], couples: [], noticed: null, noticing: false } as unknown as WardrobeView;
  const figurine = (art: unknown, cutting: boolean) =>
    ({ ...base, figurines: [{ li: KAI, story: { key: figurineSceneKey(KAI) }, art, cutting }] }) as WardrobeView;
  assert.equal(wardrobeWorking(base), false, "nothing on its way");
  assert.equal(wardrobeWorking(figurine({ state: "pending" }, false)), true, "painting");
  assert.equal(wardrobeWorking(figurine({ state: "ready" }, true)), true, "painted, its cut-out still being made");
  assert.equal(wardrobeWorking(figurine({ state: "ready" }, false)), false, "cut out");
  assert.equal(wardrobeWorking({ ...base, figurines: undefined } as WardrobeView), false, "an older server's view");
});
