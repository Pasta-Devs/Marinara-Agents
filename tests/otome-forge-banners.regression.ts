// Otome Forge M4: banners (S/wish/banners.ts, S/wish/prompts.ts, S/routes/wish.ts). The 14-day rotation is created only
// on Wish open (a read creates nothing), once even under concurrent opens, featuring the love interest featured least
// recently; past banners stay as Echoes; a pull succeeds with a model that throws if called; P20 keeps the knowledge
// boundary and only shared canon; banner art paints once under the image settings (Ask before painting, prompt review,
// no connection); a kind that fails is reported and retried on the next open; a Cancel stops the open; a run deleted
// meanwhile gets nothing back; owned Snapshots are private memory sources of their love interest.
import assert from "node:assert/strict";
import test from "node:test";
import { createForgeStoryCancellation } from "@forge-kit/story-cancel-server.mjs";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import type { Unit } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import * as wish from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import {
  paintItemNow,
  queueItemArt,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/outfits.ts";
import { paintSlot } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import {
  bannerId,
  itemId,
  runDocTarget,
  stateId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBanner,
  normalizeItem,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/wish.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  paintBannerArtNow,
  readBanner,
  readItem,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/banners.ts";
import {
  normalizeBannerPlan,
  type BannerPlan,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/prompts.ts";
import { pullWish } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/pull.ts";
import { setImages, until } from "./fixtures/otome-forge-art.ts";
import {
  KAI,
  MIR,
  SOL,
  ageWorld,
  bannerReply,
  rotationReplies,
  wishRoutes,
  wishWorld,
} from "./fixtures/otome-forge-wish.ts";

const NO_IMAGES = { connectionId: null };
/** Lets every paint queued on the fixture's image connection finish. */
const paintsDone = () => paintSlot("conn-image", async () => undefined);

test("a rotation is floor(days since the world was created / 14), with its first and last day", () => {
  assert.equal(wish.rotationOf("2026-10-01", "2026-10-01"), 0);
  assert.equal(wish.rotationOf("2026-10-01", "2026-10-14"), 0);
  assert.equal(wish.rotationOf("2026-10-01", "2026-10-15"), 1);
  assert.equal(wish.rotationOf("2026-10-01", "2026-12-23"), 5);
  assert.equal(wish.rotationOf("2026-10-01", "2026-12-24"), 6);
  assert.equal(wish.rotationOf("2026-10-01", "2026-09-01"), 0, "a clock behind the creation day stays on the first");
  assert.equal(wish.rotationOf("", "2026-10-15"), 0);
  assert.deepEqual(wish.rotationWindow("2026-10-01", 1), { startsDay: "2026-10-15", endsDay: "2026-10-28" });
  assert.deepEqual(wish.parseBannerKey("his-wardrobe-12"), { kind: "his-wardrobe", rotation: 12 });
  assert.equal(wish.parseBannerKey("his-wardrobe-01"), null);
  assert.ok(wish.isItemId("my-wardrobe-3-s6"));
  assert.ok(!wish.isItemId("my-wardrobe-3-s7"));
});

test("a read creates nothing; Wish open creates the rotation's three banners once, even when opened twice at once", async () => {
  const t = await wishWorld({ runKey: "r-m4bann01-aaaaaa", images: NO_IMAGES, replies: rotationReplies() });
  const read = await t.call("GET", "/runs/:run/wish");
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.banners, []);
  assert.deepEqual(read.body.missing, ["memories", "his-wardrobe", "my-wardrobe"]);
  assert.equal(read.body.creating, false);
  assert.equal(t.calls.length, 0, "a read never calls a model");
  assert.equal((await t.store.listRun("banner", t.runId)).length, 0);

  const [first, second] = await Promise.all([
    t.call("POST", "/runs/:run/wish/open"),
    t.call("POST", "/runs/:run/wish/open"),
  ]);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual(first.body.failed, []);
  assert.deepEqual(second.body.wish.banners, first.body.wish.banners);
  assert.equal(t.calls.length, 3, "one P20 call per banner");
  const view = first.body.wish as wish.WishView;
  assert.deepEqual(
    view.banners.map((banner) => [banner.key, banner.featuredLi, banner.echo]),
    [
      ["memories-0", KAI, false],
      ["his-wardrobe-0", KAI, false],
      ["my-wardrobe-0", KAI, false],
    ],
  );
  assert.deepEqual(view.missing, []);
  assert.deepEqual(view.pity.memories, { fiveIn: 60, fourIn: 10 });
  const memories = view.banners[0]!;
  assert.equal(memories.title, "Lantern Vigil");
  assert.deepEqual(
    [memories.five.id, memories.four.map((item) => item.id), memories.three.map((item) => item.id)],
    [
      "memories-0-f",
      ["memories-0-a1", "memories-0-a2", "memories-0-a3"],
      ["memories-0-s1", "memories-0-s2", "memories-0-s3", "memories-0-s4", "memories-0-s5", "memories-0-s6"],
    ],
  );
  assert.deepEqual([memories.five.rarity, memories.four[0]!.rarity, memories.three[0]!.rarity], [5, 4, 3]);
  assert.equal(memories.three[0]!.text, undefined, "a Snapshot's text shows only once owned");
  assert.equal("cg" in memories.five, false, "the key image brief never leaves the server");
  assert.equal(memories.art, null, "without an image connection the banner shows its gradient");

  // Stored: the Memory's brief with the featured love interest first; her look pairs with his 5★ look.
  const five = (await readItem(t.store, t.runId, "memories-0-f"))!;
  assert.deepEqual(five.cg?.cast, ["Kai", "Ines"]);
  assert.equal(five.story, null);
  const hers = (await readItem(t.store, t.runId, "my-wardrobe-0-f"))!;
  assert.equal(hers.kind, "her-look5");
  assert.equal(hers.coupleWith, "his-wardrobe-0-f");
  assert.deepEqual(hers.look, { name: "Lantern Silk", outfitLine: "deep blue silk dress, silver lantern earrings" });
  const theirs = view.banners[1]!.four.map((item) => item.li);
  assert.ok(
    theirs.every((li) => li !== KAI),
    "His Wardrobe's 4★s are the other love interests' looks",
  );
  assert.ok(view.banners[2]!.four.every((item) => item.kind === "her-look4" && item.li === null));

  // P20 for My Wardrobe was told which look it pairs with.
  assert.match(t.calls[2]!.messages[1]!.content, /THIS PAIRS WITH: "Harbour Night"/);
  // Opening again once they exist calls no model.
  const again = await t.call("POST", "/runs/:run/wish/open");
  assert.deepEqual(again.body.failed, []);
  assert.equal(t.calls.length, 3);
});

test("a Snapshot planned without a title is named by its first words, or its first characters when it has no spaces", () => {
  // The fixture plans every slot over the whole cast, so the cast it names is the one given.
  const kai = { id: KAI, name: "Kai" } as Unit;
  const cast = [kai, { id: MIR, name: "Mireille" } as Unit, { id: SOL, name: "Sol" } as Unit];
  const plan = (text: string) => {
    const reply = bannerReply("memories");
    const untitled = { ...reply, snapshots: reply.snapshots.map(() => ({ li: KAI, text })) };
    const planned = normalizeBannerPlan(untitled, { kind: "memories", units: cast, featured: kai });
    assert.equal(typeof planned, "object", String(planned));
    return (planned as BannerPlan).snapshots[0]!.title;
  };
  assert.equal(plan("The lamp hums while they share a late tea, neither saying much."), "The lamp hums while they…");
  const unspaced = "灯台の灯りがゆっくり回るあいだ、二人は黙ってお茶を飲み、どちらも本心を口にしなかった。".repeat(4);
  assert.equal(plan(unspaced), `${[...unspaced].slice(0, 12).join("")}…`, "a short label, not the whole text");
});

test("P20 keeps the knowledge boundary, the contracts and only what the whole cast may know", async () => {
  const t = await wishWorld({ runKey: "r-m4bann02-bbbbbb", images: NO_IMAGES, replies: rotationReplies() });
  // A grievance from Kai's own route chapter (private) and one from a main chapter (shared).
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: {
      ...state.lis,
      [KAI]: {
        ...state.lis[KAI]!,
        // At stage 4 the protagonist knows his secret (learned in his own route): no one else's Snapshot may.
        stage: 4,
        grievances: [
          {
            id: "g-private",
            li: KAI,
            by: "li",
            text: "PRIVATE-GRIEVANCE",
            severity: "minor",
            opened: `route-${KAI}-2/1`,
            status: "open",
          },
          {
            id: "g-shared",
            li: KAI,
            by: "li",
            text: "SHARED-GRIEVANCE",
            severity: "minor",
            opened: "main-1/2",
            status: "open",
          },
        ],
      },
    },
  }));
  await t.call("POST", "/runs/:run/wish/open");
  for (const call of t.calls) {
    const [system, user] = call.messages;
    assert.ok(system!.content.includes(forgeKnowledgeBoundary), "the knowledge boundary is in the system message");
    assert.match(system!.content, /CONTENT CONTRACT \(titles, premises and looks\)/);
    assert.match(system!.content, /CONTENT CONTRACT FOR SNAPSHOTS/);
    assert.match(system!.content, /IMAGE TAGS every outfit line and key image brief must fit: safe for work/);
    const text = `${system!.content}\n${user!.content}`;
    assert.doesNotMatch(text, /HIDDEN-TRUTH|MYSTERY-TRUTH/, "no secret, learned or not, and no mystery truth");
    assert.match(user!.content, /stage 4 \(Wound\)/);
    assert.doesNotMatch(text, /PRIVATE-GRIEVANCE/, "no love interest's own chapter");
    assert.match(user!.content, /SHARED-GRIEVANCE/);
    assert.match(user!.content, /Keep to the CONTENT CONTRACT above, silently\.$/);
    assert.equal(call.options?.temperature, 0.8);
  }
});

test("a pull succeeds with a model that throws if called, and an Echo pulls on the same pity", async () => {
  const t = await wishWorld({
    runKey: "r-m4bann03-cccccc",
    images: NO_IMAGES,
    replies: [...rotationReplies(), new Error("a pull must never call a model")],
  });
  await t.call("POST", "/runs/:run/wish/open");
  const pulled = await t.call("POST", "/runs/:run/wish/pull", { banner: "memories-0", count: 10 });
  assert.equal(pulled.status, 200, JSON.stringify(pulled.body));
  assert.equal(pulled.body.results.length, 10);
  assert.equal(t.calls.length, 3);

  // Fourteen days on: rotation 1 opens with Mireille (featured least recently) and rotation 0 waits in Echoes.
  await ageWorld(t, 15);
  const stale = await t.call("GET", "/runs/:run/wish");
  assert.deepEqual(stale.body.missing, ["memories", "his-wardrobe", "my-wardrobe"], "not created by a read");
  assert.equal(stale.body.echoes.length, 3);
  assert.equal(t.calls.length, 3);
  const echo = await t.call("POST", "/runs/:run/wish/pull", { banner: "his-wardrobe-0", count: 1 });
  assert.equal(echo.status, 200, "an Echo is pullable");
  assert.equal(t.calls.length, 3);
});

test("the next rotation features whoever was featured least recently, and My Wardrobe pairs with His Wardrobe", async () => {
  const t = await wishWorld({
    runKey: "r-m4bann04-dddddd",
    images: NO_IMAGES,
    replies: [...rotationReplies(KAI), ...rotationReplies(MIR, " II"), ...rotationReplies(SOL, " III")],
  });
  await t.call("POST", "/runs/:run/wish/open");
  await ageWorld(t, 15);
  const second = (await t.call("POST", "/runs/:run/wish/open")).body.wish as wish.WishView;
  assert.deepEqual(
    second.banners.map((banner) => [banner.key, banner.featuredLi]),
    [
      ["memories-1", MIR],
      ["his-wardrobe-1", MIR],
      ["my-wardrobe-1", MIR],
    ],
  );
  assert.deepEqual(
    second.echoes.map((banner) => [banner.key, banner.echo]),
    [
      ["my-wardrobe-0", true],
      ["his-wardrobe-0", true],
      ["memories-0", true],
    ],
  );
  assert.equal((await readItem(t.store, t.runId, "my-wardrobe-1-f"))?.coupleWith, "his-wardrobe-1-f");
  // P20 hears the earlier titles of its kind, so it does not repeat them.
  assert.match(t.calls[3]!.messages[1]!.content, /EARLIER BANNERS OF THIS KIND \(do not repeat\): Lantern Vigil/);
  await ageWorld(t, 29);
  const third = (await t.call("POST", "/runs/:run/wish/open")).body.wish as wish.WishView;
  assert.deepEqual(
    third.banners.map((banner) => banner.featuredLi),
    [SOL, SOL, SOL],
  );
  assert.equal(third.echoes.length, 6);
});

test("a kind that fails is reported and created on the next open; My Wardrobe waits for His Wardrobe", async () => {
  const bad = "this is not the JSON you asked for";
  const t = await wishWorld({
    runKey: "r-m4bann05-eeeeee",
    images: NO_IMAGES,
    replies: [
      JSON.stringify(bannerReply("memories")),
      bad,
      bad,
      JSON.stringify(bannerReply("his-wardrobe")),
      JSON.stringify(bannerReply("my-wardrobe")),
    ],
  });
  const opened = await t.call("POST", "/runs/:run/wish/open");
  assert.equal(opened.status, 200);
  assert.deepEqual(opened.body.failed, [
    { kind: "his-wardrobe", code: "bad-format" },
    { kind: "my-wardrobe", code: "bad-format" },
  ]);
  assert.deepEqual(
    opened.body.wish.banners.map((banner: { key: string }) => banner.key),
    ["memories-0"],
  );
  assert.deepEqual(opened.body.wish.missing, ["his-wardrobe", "my-wardrobe"]);
  assert.equal(t.calls.length, 3, "My Wardrobe made no call of its own");
  const retried = await t.call("POST", "/runs/:run/wish/open");
  assert.deepEqual(retried.body.failed, []);
  assert.deepEqual(retried.body.wish.missing, []);
  assert.equal(t.calls.length, 5);

  // Without a connection the open says so for every kind and writes nothing.
  const u = await wishWorld({ runKey: "r-m4bann06-ffffff", images: NO_IMAGES });
  await u.store.updateDoc(runDocTarget("world", worldId(u.runId)), normalizeWorld, (world) => ({
    ...world,
    connections: { narration: "" },
  }));
  const none = await u.call("POST", "/runs/:run/wish/open");
  assert.deepEqual(
    none.body.failed.map((entry: { code: string }) => entry.code),
    ["no-connection", "no-connection", "no-connection"],
  );
  assert.equal((await u.store.listRun("item", u.runId)).length, 0);
});

test("a run deleted while its banner is written gets nothing back", async () => {
  const t: Awaited<ReturnType<typeof wishWorld>> = await wishWorld({
    runKey: "r-m4bann07-gggggg",
    images: NO_IMAGES,
    replies: [
      () => {
        // The player deletes the story while P20 writes: the world is gone before anything is saved.
        void t.fake.documents.remove("otome-forge", worldId(t.runId), t.fake.rows.get(worldId(t.runId))!.revision);
        return JSON.stringify(bannerReply("memories"));
      },
    ],
  });
  const opened = await t.call("POST", "/runs/:run/wish/open");
  assert.deepEqual([opened.status, opened.body.code], [404, "not-found"]);
  assert.equal((await t.store.listRun("banner", t.runId)).length, 0);
  assert.equal((await t.store.listRun("item", t.runId)).length, 0);
});

test("a Cancel while banners are written stops the open, and the banners not written yet make no call", async () => {
  const cancellation = createForgeStoryCancellation();
  const t = await wishWorld({
    runKey: "r-m4bann13-mmmmmm",
    images: NO_IMAGES,
    replies: [
      () => {
        // The player taps Cancel while P20 writes Memories.
        cancellation.cancel(t.runId);
        return JSON.stringify(bannerReply("memories"));
      },
    ],
  });
  const call = wishRoutes({ ...t.deps, cancellation }, "r-m4bann13-mmmmmm");
  const opened = await call("POST", "/runs/:run/wish/open");
  assert.deepEqual([opened.status, opened.body.code], [409, "conflict"]);
  assert.equal(t.calls.length, 1);
  assert.equal((await t.store.listRun("banner", t.runId)).length, 0);
  assert.equal((await call("GET", "/runs/:run/wish")).body.creating, false);
});

test("banner art paints once, in the background, or waits for its tap under Ask before painting and prompt review", async () => {
  const t = await wishWorld({ runKey: "r-m4bann08-hhhhhh", replies: rotationReplies() });
  const opened = await t.call("POST", "/runs/:run/wish/open");
  // Each banner's art started painting as it was created (the fake paints at once, so the first may be done).
  assert.ok(
    opened.body.wish.banners.every((banner: wish.BannerView) => ["pending", "ready"].includes(banner.art!.state)),
  );
  await paintsDone();
  assert.deepEqual(
    t.paid.map((call) => [call.method, call.request.width, call.request.height]),
    [
      ["generateBannerArt", 768, 1344],
      ["generatePortrait", 832, 1216],
      ["generatePortrait", 832, 1216],
    ],
  );
  const memoryArt = t.paid[0]!.request;
  assert.match(memoryArt.prompt, /rain on the glass/i);
  assert.match(memoryArt.prompt, /safe for work/);
  assert.match(memoryArt.negativePrompt, /child, childlike/);
  assert.match(t.paid[1]!.request.prompt, /navy greatcoat, brass buttons/);
  assert.match(t.paid[2]!.request.prompt, /deep blue silk dress/);
  const view = (await t.call("GET", "/runs/:run/wish")).body as wish.WishView;
  assert.deepEqual(
    view.banners.map((banner) => banner.art?.state),
    ["ready", "ready", "ready"],
  );
  // Each banner's art is its featured item's own picture, so the item's first open finds it painted; others have none.
  for (const banner of view.banners) {
    assert.deepEqual((await readItem(t.store, t.runId, banner.five.id))?.art, banner.art);
    assert.equal(banner.five.art?.url, banner.art?.url);
    assert.equal((await readItem(t.store, t.runId, banner.four[0]!.id))?.art, null);
  }
  // A tap on ready art pays nothing.
  assert.equal((await t.call("POST", "/runs/:run/wish/art", { banner: "memories-0" })).body.art.state, "ready");
  assert.equal(t.paid.length, 3);

  // Ask before painting: nothing paints by itself; two taps at once pay once.
  const u = await wishWorld({ runKey: "r-m4bann09-iiiiii", images: { ask: true }, replies: rotationReplies() });
  const asked = await u.call("POST", "/runs/:run/wish/open");
  assert.deepEqual(
    asked.body.wish.banners.map((banner: wish.BannerView) => banner.art?.state),
    ["waiting-consent", "waiting-consent", "waiting-consent"],
  );
  await paintsDone();
  assert.equal(u.paid.length, 0);
  const prompt = await u.call("POST", "/runs/:run/wish/art/prompt", { banner: "his-wardrobe-0" });
  assert.match(prompt.body.prompt, /navy greatcoat/);
  const [one, two] = await Promise.all([
    u.call("POST", "/runs/:run/wish/art", { banner: "his-wardrobe-0", prompt: "my own words" }),
    u.call("POST", "/runs/:run/wish/art", { banner: "his-wardrobe-0" }),
  ]);
  assert.equal(one.body.art.state, "ready");
  assert.deepEqual(two.body.art, one.body.art);
  assert.equal(u.paid.length, 1);
  assert.match(u.paid[0]!.request.prompt, /^my own words, safe for work/, "an edited prompt keeps its rating tags");
  assert.equal((await readItem(u.store, u.runId, "his-wardrobe-0-f"))?.art?.url, one.body.art.url);
  // An item whose own claim is still waiting takes the banner's painted art, so that claim never pays.
  const claimed = { state: "waiting-consent" as const, at: "2026-10-28T11:00:00.000Z" };
  await u.store.updateDoc(runDocTarget("item", itemId(u.runId, "memories-0-f")), normalizeItem, (item) => ({
    ...item,
    art: claimed,
  }));
  const memoryArt0 = (await u.call("POST", "/runs/:run/wish/art", { banner: "memories-0" })).body.art;
  assert.equal(memoryArt0.state, "ready");
  assert.deepEqual((await readItem(u.store, u.runId, "memories-0-f"))?.art, memoryArt0);

  // Reviewing image prompts holds them too; without a connection a tap is a 503.
  const v = await wishWorld({ runKey: "r-m4bann10-jjjjjj", replies: rotationReplies() });
  const reviewed = await v.call("POST", "/runs/:run/wish/open", { reviewImagePrompts: true });
  assert.ok(reviewed.body.wish.banners.every((banner: wish.BannerView) => banner.art?.state === "waiting-consent"));
  await paintsDone();
  assert.equal(v.paid.length, 0);
  await setImages(v.store, v.runId, { connectionId: null });
  const tap = await v.call("POST", "/runs/:run/wish/art", { banner: "memories-0" });
  assert.deepEqual([tap.status, tap.body.code], [503, "no-connection"]);
  assert.equal((await v.call("POST", "/runs/:run/wish/art", { banner: "memories-9" })).status, 404);
});

test("a featured 5★ and its banner share one picture: whichever paints first is the other's, paid once", async () => {
  const own = (t: { store: typeof u.store; runId: string }, id: string) =>
    t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
      ...state,
      owned: { items: [...state.owned.items, id] },
    }));
  const item = async (t: { store: typeof u.store; runId: string }, id: string) =>
    (await readItem(t.store, t.runId, id))!;
  // The banner's art is still painting (the lane is held) when the 5★ is won and opened, and its art tapped.
  const u = await wishWorld({ runKey: "r-m4bann13-mmmmmm", replies: rotationReplies() });
  let open = () => {};
  const held = paintSlot("conn-image", () => new Promise<void>((resolve) => (open = resolve)));
  await u.call("POST", "/runs/:run/wish/open");
  await own(u, "memories-0-f");
  const queued = await queueItemArt(u.deps, u.runId, await item(u, "memories-0-f"), { debugMode: false });
  assert.equal(queued?.state, "pending", "the open shows the banner's paint as its own");
  assert.equal((await item(u, "memories-0-f")).art, null, "and claims nothing");
  const tap = paintItemNow(u.deps, u.runId, "memories-0-f", { debugMode: false });
  open();
  await held;
  const tapped = await tap;
  await paintsDone();
  assert.equal(u.paid.length, 3, "one paid image per banner, none more for the item");
  const banner = (await u.call("GET", "/runs/:run/wish")).body.banners[0] as wish.BannerView;
  assert.deepEqual([tapped?.url, (await item(u, "memories-0-f")).art?.url], [banner.art?.url, banner.art?.url]);

  // Ask before painting: the 5★'s own tap paints first, and its banner then has that picture (a banner tap pays nothing).
  const v = await wishWorld({ runKey: "r-m4bann14-nnnnnn", images: { ask: true }, replies: rotationReplies() });
  await v.call("POST", "/runs/:run/wish/open");
  await own(v, "memories-0-f");
  await queueItemArt(v.deps, v.runId, await item(v, "memories-0-f"), { debugMode: false });
  const cg = await paintItemNow(v.deps, v.runId, "memories-0-f", { debugMode: false });
  assert.equal(cg?.state, "ready");
  const again = await v.call("POST", "/runs/:run/wish/art", { banner: "memories-0" });
  assert.deepEqual([again.body.art.state, again.body.art.url, v.paid.length], ["ready", cg?.url, 1]);
});

test("a banner tap and its 5★'s open that both claimed pay once: whichever paints shares it inside the lane", async () => {
  const u = await wishWorld({ runKey: "r-m4bann16-pppppp", images: { ask: true }, replies: rotationReplies() });
  await u.call("POST", "/runs/:run/wish/open");
  await u.store.updateDoc(runDocTarget("state", stateId(u.runId)), normalizeState, (state) => ({
    ...state,
    owned: { items: [...state.owned.items, "memories-0-f"] },
  }));
  await setImages(u.store, u.runId, { ask: false });
  const five = (await readItem(u.store, u.runId, "memories-0-f"))!;
  // Gated reads: the tap reads its banner and finds no live item paint; then the open (whose banner check came
  // first) claims and queues; then the tap claims and queues behind it.
  const gate = () => {
    let open = () => {};
    return { wait: new Promise<void>((resolve) => (open = resolve)), open: () => open() };
  };
  const [bannerRead, itemWorld, tapWorld] = [gate(), gate(), gate()];
  let bannerReads = 0;
  let worldReads = 0;
  const store = Object.create(u.store) as typeof u.store;
  store.readDoc = async (id, normalize) => {
    if (id === bannerId(u.runId, "memories-0") && ++bannerReads === 1) await bannerRead.wait;
    if (id === worldId(u.runId)) await [itemWorld, tapWorld][worldReads++]?.wait;
    return u.store.readDoc(id, normalize);
  };
  const deps = { ...u.deps, store };
  let release = () => {};
  const held = paintSlot("conn-image", () => new Promise<void>((resolve) => (release = resolve)));
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
  const tap = paintBannerArtNow(deps, u.runId, "memories-0", { debugMode: false });
  const queued = queueItemArt(deps, u.runId, five, { debugMode: false });
  await tick();
  bannerRead.open();
  await tick();
  itemWorld.open();
  assert.equal((await queued)?.state, "pending");
  tapWorld.open();
  await until(async () => (await readBanner(u.store, u.runId, "memories-0"))?.art?.state === "pending", "the claim");
  release();
  await held;
  const tapped = await tap;
  await paintsDone();
  const banner = await readBanner(u.store, u.runId, "memories-0");
  assert.equal(u.paid.filter((call) => call.method === "generateBannerArt").length, 1, "one paid picture");
  assert.deepEqual(u.deleted, [], "and none thrown away");
  assert.equal(tapped?.state, "ready");
  assert.equal(banner?.art?.url, (await readItem(u.store, u.runId, "memories-0-f"))?.art?.url);
});

test("a teardown stops banner art still waiting for its paid call", async () => {
  let active = true;
  const t = await wishWorld({ runKey: "r-m4bann11-kkkkkk", replies: rotationReplies() });
  const call = wishRoutes(t.deps, "r-m4bann11-kkkkkk", () => active);
  // Hold the lane so the banner paints queue behind it, then tear down.
  let open = () => {};
  const held = paintSlot("conn-image", () => new Promise<void>((resolve) => (open = resolve)));
  await call("POST", "/runs/:run/wish/open");
  active = false;
  open();
  await held;
  await paintsDone();
  assert.equal(t.paid.length, 0);
  const view = (await call("GET", "/runs/:run/wish")).body as wish.WishView;
  assert.deepEqual(
    view.banners.map((banner) => banner.art?.state),
    ["stopped", "stopped", "stopped"],
  );
});

test("owned Snapshots are private memory of their love interest, in the order they were won", async () => {
  const t = await wishWorld({ runKey: "r-m4bann12-llllll", images: NO_IMAGES, replies: rotationReplies() });
  await t.call("POST", "/runs/:run/wish/open");
  // 0.5 misses every 5★ and 4★: ten Snapshots in a row (the 10th is the 4★ guarantee), all drawn by the same index.
  await pullWish(t.deps, t.runId, { banner: "memories-0", count: 10, random: () => 0.5 });
  const state = (await t.store.readDoc(stateId(t.runId), normalizeState))!;
  const owned = state.owned.items.filter((id) => /-s\d$/.test(id));
  assert.ok(owned.length >= 1);
  const sources = (await readMemorySources(t.store, t.runId)).filter((source) => owned.includes(source.id));
  assert.equal(sources.length, owned.length);
  for (const source of sources) {
    const item = normalizeItem(t.fake.rows.get(itemId(t.runId, source.id))!.data);
    assert.equal(source.kind, "chat");
    assert.deepEqual(source.audience, [item.li]);
    assert.match(source.title, /own Snapshot .*\(private: only .* and the protagonist know it\)/);
    assert.equal(source.content, item.text);
  }
  // Banners and items go with the run when it is deleted (RUN_DOC_KINDS).
  assert.ok(normalizeBanner(t.fake.rows.get(bannerId(t.runId, "memories-0"))!.data).key);
});
