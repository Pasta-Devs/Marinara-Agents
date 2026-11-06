// Otome Hearth (#2128): the Shop in Wish, gifts for dates and each love interest's figurine.
// - The catalogue's numbers are pinned, and the aphrodisiac is offered only under NSFW Heat.
// - applyPurchase charges once (a request id seen before replays), refuses before changing anything (not enough
//   Starlight, the aphrodisiac under SFW, a second figurine, a love interest who is not in the story), and the state's
//   gifts, figurines and purchases read back from older, partial and damaged documents.
// - The routes answer with the Shop, the Wardrobe lists what was bought, Home stands the drawn figurines in L0, and
//   buying a figurine writes its scene: a one-node Character Story that plays with no planning call and pays its beat.
// - GET /shop draws each figurine once, in the background, through the plush allow-list, with the prompt logged in
//   debug mode; a reply with no box of its own is repaired.
import assert from "node:assert/strict";
import test from "node:test";
import type { RunState } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  FIGURINE_COST,
  GIFT_AFFECTION,
  GIFT_IDS,
  GIFT_PRICES,
  GIFT_PROMPT_NAMES,
  figurineSceneKey,
  giftsFor,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/shop.ts";
import { plushSvgUrl } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/plush-svg.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
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
import { normalizeFigurineReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/plush.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
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
import { KAI, MIR, SOL, beatReply, json, storyWorld } from "./fixtures/otome-forge-story.ts";

const FIGURE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96"><ellipse cx="32" cy="88" rx="20" ry="5" fill="#2ec4c4" stroke="#3b2a40" stroke-width="1.2"/>' +
  '<rect x="24" y="48" width="16" height="36" rx="6" fill="#1f2a44" stroke="#3b2a40" stroke-width="1.2"/>' +
  '<circle cx="32" cy="32" r="18" fill="#f3d6c6" stroke="#3b2a40" stroke-width="1.2"/></svg>';
const figurineReply = (svg = FIGURE) => JSON.stringify({ svg });
const isFigurine = (messages: Array<{ content: string }>) =>
  messages[0]!.content.includes("You design one small collectible figurine");
const NSFW = { ...defaultContent(), heat: "fade" as const };

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

async function shopWorld(runKey: string, options: Partial<Parameters<typeof storyWorld>[0]> = {}) {
  const t = await storyWorld({ runKey, ...options });
  const background = createBackgroundQueue(t.runtime);
  const deps: RouteDeps = { ...t.deps, background };
  const call = shopRoutes(deps, runKey);
  const setStarlight = (starlight: number) =>
    t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
      ...state,
      wallet: { starlight },
    }));
  const unit = async (li: string) => (await t.store.readDoc(unitId(t.runId, li), normalizeUnit))!;
  const settle = async () => {
    for (let round = 0; round < 200; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      await runForeground(t.runId, async () => undefined);
    }
  };
  const figurineCalls = () => t.calls.filter((entry) => isFigurine(entry.messages));
  return { ...t, background, deps, call, setStarlight, unit, settle, figurineCalls };
}

test("the Shop routes sell gifts and a figurine once, and the Wardrobe and Home show what was bought", async () => {
  const t = await shopWorld("r-shop01-aaaaaa");
  await t.setStarlight(5500);
  // Hold the lane so no figurine is drawn in this test: the Shop answers without them.
  t.background.ensure({ key: "blocker", connectionId: "conn-text", run: () => new Promise(() => undefined) });
  const shop = await t.call("GET", "/runs/:run/shop");
  assert.equal(shop.status, 200, JSON.stringify(shop.body));
  assert.equal(shop.body.starlight, 5500);
  assert.deepEqual(
    shop.body.gifts.map((gift: { id: string }) => gift.id),
    ["flowers", "chocolates", "wine"],
    "no aphrodisiac under SFW Heat",
  );
  assert.deepEqual(
    shop.body.figurines.map((entry: Record<string, unknown>) => [entry.li, entry.owned, entry.drawing, "art" in entry]),
    [
      [KAI, false, true, false],
      [MIR, false, true, false],
      [SOL, false, true, false],
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
    const refused = await t.call("POST", "/runs/:run/shop/figurines/:li", {}, { li });
    assert.equal(refused.status, 404, li);
  }

  const figurine = await t.call("POST", "/runs/:run/shop/figurines/:li", { requestId: "s-fig-00001" }, { li: KAI });
  assert.equal(figurine.status, 200, JSON.stringify(figurine.body));
  assert.equal(figurine.body.starlight, 200);
  const key = figurineSceneKey(KAI);
  assert.deepEqual(figurine.body.story, { key });
  assert.deepEqual(figurine.body.shop.figurines[0].story, { key });
  assert.equal(figurine.body.shop.figurines[0].owned, true);
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

  const lost = await t.call("POST", "/runs/:run/shop/figurines/:li", { requestId: "s-fig-00001" }, { li: KAI });
  assert.equal(lost.status, 200, "the same request again is answered as before");
  assert.deepEqual(lost.body.story, { key });
  assert.equal(lost.body.starlight, 200);
  await t.setStarlight(9000);
  const twice = await t.call("POST", "/runs/:run/shop/figurines/:li", {}, { li: KAI });
  assert.equal(twice.status, 409);
  assert.equal(twice.body.code, "conflict");
  const mireille = await t.call("POST", "/runs/:run/shop/figurines/:li", {}, { li: MIR });
  assert.equal(mireille.status, 200);
  await t.setStarlight(100);
  const poor = await t.call("POST", "/runs/:run/shop/figurines/:li", {}, { li: SOL });
  assert.equal(poor.status, 409);
  assert.equal(poor.body.code, "insufficient");
  assert.equal((await t.state()).owned.figurines[SOL], undefined);

  const wardrobe = await t.call("GET", "/runs/:run/wardrobe");
  assert.equal(wardrobe.status, 200, JSON.stringify(wardrobe.body));
  assert.deepEqual(wardrobe.body.gifts, { chocolates: 1 });
  assert.deepEqual(wardrobe.body.figurines, [
    { li: KAI, story: { key } },
    { li: MIR, story: { key: figurineSceneKey(MIR) } },
  ]);
  const home = await t.call("GET", "/runs/:run/home");
  assert.equal(home.status, 200, JSON.stringify(home.body));
  assert.deepEqual(home.body.figurines, [], "a figurine not drawn yet does not stand on Home");
  const drawn = normalizeFigurineReply({ svg: FIGURE }, "t");
  assert.ok(typeof drawn !== "string");
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, MIR)), normalizeUnit, (unit) => ({
    ...unit,
    figurineArt: drawn,
  }));
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, SOL)), normalizeUnit, (unit) => ({
    ...unit,
    figurineArt: drawn,
  }));
  const after = await t.call("GET", "/runs/:run/home");
  assert.deepEqual(after.body.figurines, [{ li: MIR, url: plushSvgUrl(drawn.svg) }], "only a bought one stands there");
  assert.equal((await t.call("GET", "/runs/:run/wardrobe")).body.figurines[1].art, plushSvgUrl(drawn.svg));
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
  t.background.ensure({ key: "blocker", connectionId: "conn-text", run: () => new Promise(() => undefined) });
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

test("GET /shop draws each figurine once, in the background, and shows it once kept", async () => {
  const t = await shopWorld("r-shop04-dddddd", {
    replies: [
      figurineReply(FIGURE.replace(' viewBox="0 0 64 96"', "")),
      (messages) => {
        assert.match(messages.at(-1)!.content, /svg needs its viewBox/, "the repair says why");
        return figurineReply();
      },
      figurineReply(),
      figurineReply(`${FIGURE}<script>alert(1)</script>`),
      figurineReply(`${FIGURE}<script>alert(1)</script>`),
    ],
  });
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    accent: "#2EC4C4",
    identityLine: "tall man, cyan hair, red eyes",
  }));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  t.background.ensure({ key: "blocker", connectionId: "conn-text", run: () => gate });
  const first = await t.call("GET", "/runs/:run/shop");
  assert.ok(first.body.figurines.every((entry: Record<string, unknown>) => entry.drawing && !("art" in entry)));
  await t.settle();
  assert.equal(t.figurineCalls().length, 0, "the Shop never waits for a figurine");
  release();
  await t.settle();
  assert.equal(t.figurineCalls().length, 5, "one call each, one repair, one refused twice");
  const prompt = t.figurineCalls().find((call) => call.messages[1]!.content.includes("LOVE INTEREST: Kai"))!.messages;
  assert.match(prompt[1]!.content, /Accent colour: #2EC4C4/);
  assert.match(prompt[1]!.content, /Look: tall man, cyan hair, red eyes/);
  assert.match(prompt[0]!.content, /viewBox "0 0 64 96"/);
  assert.match(
    prompt[0]!.content,
    /Use only these elements: svg, g, path, circle, ellipse, rect, polygon, polyline, line\./,
  );

  const drawn = await Promise.all([KAI, MIR, SOL].map(t.unit));
  const kept = drawn.filter((unit) => unit.figurineArt);
  assert.equal(kept.length, 2);
  for (const unit of kept) {
    assert.ok(unit.figurineArt!.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96">'));
  }
  assert.equal("figurineArt" in drawn.find((unit) => !unit.figurineArt)!, false, "no figurine: no key at all");
  assert.equal("figurineArt" in normalizeUnit({ id: KAI, figurineArt: { svg: "<svg><script/></svg>" } }), false);
  const second = await t.call("GET", "/runs/:run/shop");
  for (const entry of second.body.figurines as Array<Record<string, unknown>>) {
    const unit = drawn.find((candidate) => candidate.id === entry.li)!;
    if (unit.figurineArt) {
      assert.equal(entry.art, plushSvgUrl(unit.figurineArt.svg));
      assert.equal(entry.drawing, false);
    } else {
      assert.equal(entry.drawing, false, "a failed one is left alone for a while, and the shelf stops waiting");
    }
  }
  await t.settle();
  assert.equal(t.figurineCalls().length, 5, "a kept figurine is never drawn again");
  const logged = t.logs.filter((entry) => entry.level === "debugOverride" && entry.args[0] === "figurine");
  assert.ok(logged.length >= 1, "the prompt is logged in debug mode");
});
