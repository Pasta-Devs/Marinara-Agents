// Otome Forge M2b: painted places and story CGs (S/art/{places,cg}.ts, S/routes/art.ts). Paints run against a fake
// image client that counts paid calls; the CG's loopback request is checked against the real client.
import assert from "node:assert/strict";
import test from "node:test";
import { queueScenePaints } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cg.ts";
import { createImageClient } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import {
  paintSlot,
  startPaint,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import { placeKey } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/places.ts";
import {
  beatId,
  playerId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerArtRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/art.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeBeat } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  KEY,
  PNG,
  artWorld,
  beat,
  readStoredBeat,
  routesOf,
  saveBeat,
  seedChapter,
  setImages,
  type PaidCall,
} from "./fixtures/otome-forge-art.ts";
import { normalizeBeatBody } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts";
import { KAI, MIR, SOL, bible, storyRoutes } from "./fixtures/otome-forge-story.ts";

const CG = { at: 1, brief: "Rain on the lamp room glass; she catches his sleeve.", cast: ["Kai", "Ines"] };

async function sceneWorld(runKey: string, options: Parameters<typeof artWorld>[0] = { runKey }) {
  const t = await artWorld({ ...options, runKey });
  await seedChapter(t.store, t.runId);
  const call = routesOf(registerArtRoutes, t.deps, runKey);
  const world = async () => (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  const state = async () => (await t.store.readDoc(stateId(t.runId), normalizeState))!;
  /** Writes beat `i` and queues its scene paints, as the beat writer does; resolves when they have ended. */
  const write = async (i: number, changes: Parameters<typeof beat>[1] = {}, review = false) => {
    const written = await saveBeat(t.store, t.runId, beat(i, changes));
    await queueScenePaints(t.deps, t.runId, written, { debugMode: true, review });
    return written;
  };
  return { ...t, call, world, state, write };
}

test("a place is painted once, from its English tags with no people, and a known place costs nothing", async () => {
  const t = await sceneWorld("r-m2bart01-aaaaaa");
  await t.write(0);
  const place = (await t.world()).places[placeKey("The Lamp Room")]!;
  assert.equal(place.art?.state, "ready");
  assert.equal(place.art?.ref, "global-gallery:img1");
  assert.equal(t.paid.length, 1);
  const [{ request }] = t.paid;
  assert.equal(request.connectionId, "conn-image");
  assert.deepEqual([request.width, request.height], [768, 1344]);
  assert.match(request.prompt, /lighthouse interior, great lens, no humans/);
  assert.match(request.prompt, /scenery/);
  assert.match(request.prompt, /safe for work/);
  assert.match(request.negativePrompt, /people, person, humans/);
  assert.match(request.negativePrompt, /child, childlike/);
  assert.equal(request.referenceImages, undefined, "a place has no references");
  assert.equal(request.debugMode, true);

  // The same place in the next beat, under another spelling of the same name: nothing more is paid.
  await t.write(1, { places: [{ name: "the lamp  room", tags: "lighthouse" }], cg: undefined });
  assert.equal(t.paid.length, 1);
  assert.equal(Object.keys((await t.world()).places).length, 1);
  // A place name in another script keeps its own key.
  assert.equal(placeKey("灯台の部屋"), "灯台の部屋");
  assert.notEqual(placeKey("灯台の部屋"), placeKey("港の灯"));
});

test("Ask before painting holds every scene paint until its tap, and a tap never pays twice", async () => {
  const t = await sceneWorld("r-m2bart02-bbbbbb");
  await setImages(t.store, t.runId, { ask: true });
  await t.write(1, { cg: CG });
  assert.equal(t.paid.length, 0, "nothing is painted by itself");
  assert.equal((await t.world()).places[placeKey("The Lamp Room")]?.art?.state, "waiting-consent");
  assert.equal((await readStoredBeat(t.store, t.runId, 1))?.cg?.art?.state, "waiting-consent");

  const scene = await t.call("GET", "/runs/:run/art/scene", { key: KEY, i: "1" });
  assert.equal(scene.status, 200);
  assert.equal(scene.body.places[0].art.state, "waiting-consent");
  assert.equal(scene.body.cg.art.state, "waiting-consent");

  // Two taps at once: one paid image, and both answer with it.
  const [first, second] = await Promise.all([
    t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 }),
    t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 }),
  ]);
  assert.equal(first.body.art.state, "ready");
  assert.deepEqual(second.body.art, first.body.art);
  assert.equal(t.paid.length, 1);
  assert.equal(t.paid[0]!.method, "generateBannerArt");
  // Tapping a ready CG again changes nothing.
  assert.deepEqual((await t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 })).body.art, first.body.art);
  assert.equal(t.paid.length, 1);

  const placed = await t.call("POST", "/runs/:run/art/place", { place: "The Lamp Room" });
  assert.equal(placed.body.place.art.state, "ready");
  assert.equal(placed.body.world.places[placeKey("The Lamp Room")].art.state, "ready");
  assert.equal(t.paid.length, 2);

  // The review dialog gets the prompt; an edited one keeps its rating and adult tags.
  const prompt = await t.call("POST", "/runs/:run/art/cg/prompt", { key: KEY, i: 1 });
  assert.match(prompt.body.prompt, /Rain on the lamp room glass/);
  await t
    .call("POST", "/runs/:run/art/place", { place: "Unknown Pier" })
    .then(({ status }) => assert.equal(status, 404));
});

test("reviewing image prompts holds automatic paints too; without an image connection nothing is painted", async () => {
  const t = await sceneWorld("r-m2bart03-cccccc");
  await t.write(1, { cg: CG }, true);
  assert.equal(t.paid.length, 0);
  assert.equal((await readStoredBeat(t.store, t.runId, 1))?.cg?.art?.state, "waiting-consent");

  const u = await sceneWorld("r-m2bart04-dddddd", { runKey: "r-m2bart04-dddddd", images: { connectionId: null } });
  await u.write(1, { cg: CG });
  assert.equal(u.paid.length, 0);
  const place = (await u.world()).places[placeKey("The Lamp Room")];
  assert.deepEqual(place, { name: "The Lamp Room", tags: "lighthouse interior, great lens, no humans" });
  assert.equal((await readStoredBeat(u.store, u.runId, 1))?.cg?.art, undefined, "the reader shows its quiet card");
  const tap = await u.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 });
  assert.deepEqual([tap.status, tap.body.code], [503, "no-connection"]);
});

test("a CG unlocks only once it is ready and shown, exactly once", async () => {
  const t = await sceneWorld("r-m2bart05-eeeeee");
  await t.write(1, { cg: CG });
  assert.equal((await readStoredBeat(t.store, t.runId, 1))?.cg?.art?.state, "ready");
  const notShown = await t.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 });
  assert.deepEqual([notShown.status, notShown.body.code], [409, "conflict"], "read through its segment first");
  assert.equal((await t.state()).album.cgs.length, 0);

  const stored = (await readStoredBeat(t.store, t.runId, 1))!;
  await saveBeat(t.store, t.runId, { ...stored, readThrough: CG.at });
  const seen = await t.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 });
  assert.equal(seen.status, 200);
  assert.equal(seen.body.unlocked, true);
  assert.deepEqual(
    seen.body.album.map(({ key, li, ref }: { key: string; li: string; ref: string }) => ({ key, li, ref })),
    [{ key: `${KEY}/1`, li: KAI, ref: stored.cg!.art!.ref }],
  );
  const again = await t.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 });
  assert.equal(again.body.unlocked, false);
  assert.equal((await t.state()).album.cgs.length, 1);

  // A CG that is not painted yet never unlocks.
  const u = await sceneWorld("r-m2bart06-ffffff");
  await setImages(u.store, u.runId, { ask: true });
  const waiting = await u.write(1, { cg: CG });
  await saveBeat(u.store, u.runId, { ...(await readStoredBeat(u.store, u.runId, 1))!, readThrough: 2 });
  assert.equal((await u.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 })).status, 409);
  assert.equal(waiting.cg?.art, undefined);
  assert.equal((await u.state()).album.cgs.length, 0);
});

test("a failed paint waits for a tap; a rewrite while a CG paints gets nothing, and its image is deleted", async () => {
  const t = await sceneWorld("r-m2bart07-gggggg", {
    runKey: "r-m2bart07-gggggg",
    before: (call) => {
      if (call.method === "generateImage") throw new Error("provider down");
    },
  });
  await t.write(0);
  const failed = (await t.world()).places[placeKey("The Lamp Room")]!.art!;
  assert.equal(failed.state, "failed");
  assert.match(failed.error ?? "", /provider down/);
  await t.write(1, { cg: undefined });
  assert.equal(t.paid.length, 1, "never retried by itself");

  let rewrite: Promise<unknown> | null = null;
  const u = await sceneWorld("r-m2bart08-hhhhhh", {
    runKey: "r-m2bart08-hhhhhh",
    before: (call: PaidCall) => {
      // The beat is rewritten while its CG is painted.
      if (call.method === "generateBannerArt") {
        rewrite = saveBeat(
          u.store,
          u.runId,
          beat(1, { cg: CG, written: { at: "2026-10-28T11:00:00.000Z", connectionId: "c", model: "m" }, rewrites: 1 }),
        );
        return rewrite.then(() => undefined);
      }
    },
  });
  await u.write(1, { cg: CG, places: [] });
  assert.equal(u.paid.length, 1);
  const current = (await readStoredBeat(u.store, u.runId, 1))!;
  assert.equal(current.rewrites, 1);
  assert.equal(current.cg?.art, undefined, "the rewritten beat never receives the old beat's image");
  assert.deepEqual(u.deleted, ["img1"]);
});

test("a run deleted while a place paints keeps nothing: the image leaves the gallery", async () => {
  const t = await sceneWorld("r-m2bart09-iiiiii", {
    runKey: "r-m2bart09-iiiiii",
    before: async () => {
      await t.store.removeDoc(worldId(t.runId));
    },
  });
  await t.write(0, { cg: undefined });
  assert.equal(t.paid.length, 1);
  assert.deepEqual(t.deleted, ["img1"]);
  assert.equal(await t.store.readDoc(worldId(t.runId), normalizeWorld), null, "the world is not brought back");
});

test("a paint a restart left pending reads as stopped and waits for a tap", async () => {
  const t = await sceneWorld("r-m2bart10-jjjjjj");
  await saveBeat(
    t.store,
    t.runId,
    beat(1, { cg: { ...CG, art: { state: "pending", at: "2026-10-28T09:00:00.000Z" } } }),
  );
  const scene = await t.call("GET", "/runs/:run/art/scene", { key: KEY, i: "1" });
  assert.equal(scene.body.cg.art.state, "stopped");
  await queueScenePaints(t.deps, t.runId, (await readStoredBeat(t.store, t.runId, 1))!, { debugMode: false });
  assert.equal(t.paid.filter((call) => call.method === "generateBannerArt").length, 0);
  const tap = await t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 });
  assert.equal(tap.body.art.state, "ready");
});

test("a CG's loopback request carries the override and at most four references, without the Engine's extra-people ban", async () => {
  const t = await sceneWorld("r-m2bart11-kkkkkk");
  // Kai and Mireille have cards with avatars, Sol a painted look, and the protagonist her persona's avatar.
  for (const [li, changes] of [
    [KAI, { cardId: "card-kai", identityLine: "tall man, grey eyes", outfitLine: "keeper's coat" }],
    [MIR, { cardId: "card-mireille" }],
    [SOL, { portrait: "/api/global-gallery/file/sol.png" }],
  ] as const) {
    await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (unit) => ({
      ...unit,
      ...changes,
      bible: bible({ look: { identityLine: "", outfitLine: "", presentation: li === MIR ? "woman" : "man" } }),
    }));
  }
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    look: { identityLine: "short dark hair", outfitLine: "oilskin" },
  }));
  const requests: Array<{ path: string; body: unknown }> = [];
  const json = (value: unknown) =>
    new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  const png = (name: string) => new Response(Buffer.from(name), { headers: { "content-type": "image/png" } });
  const fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace("http://127.0.0.1:7860", "");
    requests.push({ path, body: init?.body });
    if (path === "/api/characters/card-kai") return json({ avatarPath: "/api/avatars/file/kai.png" });
    if (path === "/api/characters/card-mireille") return json({ avatarPath: "/api/avatars/file/mireille.png" });
    if (path === "/api/characters/personas/persona-ines") return json({ avatarPath: "/api/avatars/file/ines.png" });
    if (path.startsWith("/api/avatars/file/") || path.startsWith("/api/global-gallery/file/")) return png(path);
    if (path === "/api/app-settings/ui") return json({ value: {} });
    if (path === "/api/characters/avatar-generation") {
      return json({
        image: `data:image/png;base64,${PNG}`,
        prompt: JSON.parse(String(init?.body)).promptOverrides[0].prompt,
      });
    }
    if (path === "/api/global-gallery/upload") return json({ id: "cg1", url: "/api/global-gallery/file/cg1.png" });
    return new Response(JSON.stringify({ error: "no" }), { status: 404 });
  }) as typeof globalThis.fetch;
  const deps = { ...t.deps, images: createImageClient({ baseUrl: "http://127.0.0.1:7860", fetch }) };
  const crowd = {
    at: 0,
    brief: "All of them at the lamp.",
    cast: ["Kai", "Mireille", "Sol", "Ines", "The Harbour Master"],
  };
  const written = await saveBeat(t.store, t.runId, beat(1, { cg: crowd, places: [] }));
  await queueScenePaints(deps, t.runId, written, { debugMode: true });
  assert.equal((await readStoredBeat(t.store, t.runId, 1))?.cg?.art?.state, "ready");
  const generation = requests.find((request) => request.path === "/api/characters/avatar-generation");
  const body = JSON.parse(String(generation?.body));
  assert.equal(body.referenceImages.length, 4, "one reference per person, four at most");
  assert.equal(body.promptOverrides.length, 1);
  assert.equal(body.promptOverrides[0].id, "avatar:kai", "the override is matched by the first person's first name");
  assert.equal(body.name, "Kai");
  assert.equal(body.debugMode, true);
  assert.deepEqual([body.width, body.height], [768, 1344]);
  const { prompt, negativePrompt } = body.promptOverrides[0];
  assert.match(prompt, /^All of them at the lamp\. Kai: tall man, grey eyes; keeper's coat\./);
  assert.match(prompt, /Ines: short dark hair; oilskin\./);
  assert.match(prompt, /adult man, adult woman, adult person/);
  assert.doesNotMatch(prompt, /Harbour Master/, "four people at most");
  assert.doesNotMatch(negativePrompt, /extra people/);
  assert.match(negativePrompt, /child, childlike/);
});

test("a paint waiting in the lane is built when its turn comes: a rating changed meanwhile is the one it uses", async () => {
  let open: () => void = () => {};
  const gate = new Promise<void>((resolve) => (open = resolve));
  const t = await sceneWorld("r-m2bart12-llllll", {
    runKey: "r-m2bart12-llllll",
    // The CG (asked for first) holds the connection's one paid slot until the gate opens.
    before: (call) => (call.method === "generateBannerArt" ? gate : undefined),
  });
  await setImages(t.store, t.runId, { ask: true });
  const written = await saveBeat(t.store, t.runId, beat(1, { cg: CG }));
  await queueScenePaints(t.deps, t.runId, written, { debugMode: false });
  const cgTap = t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const placeTap = t.call("POST", "/runs/:run/art/place", { place: "The Lamp Room" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(t.paid.length, 1, "the place waits for the CG's paid call");
  await setImages(t.store, t.runId, { rating: "suggestive" });
  open();
  await Promise.all([cgTap, placeTap]);
  const place = t.paid.find((call) => call.method === "generateImage")!;
  // The place was built at its turn, under Suggestive: above SFW a place is scenery only, with no rating or person
  // tags, and keeps the people, adult and SFW negatives. (The CG was built at SFW, before the change.)
  assert.match(place.request.prompt, /no humans/);
  assert.doesNotMatch(place.request.prompt, /safe for work|suggestive|adults only/);
  assert.match(place.request.negativePrompt, /people, person, humans.*child, childlike.*loli.*nudity, nsfw/);
});

test("a tap that lands while another pass holds the place but paints nothing still paints it, once", async () => {
  const t = await sceneWorld("r-m2bart13-mmmmmm");
  await setImages(t.store, t.runId, { ask: true });
  await t.write(0);
  // Another pass (the next beat's) is looking at the same place right now.
  const release = startPaint(t.runId, `place:${placeKey("The Lamp Room")}`)!;
  const tap = t.call("POST", "/runs/:run/art/place", { place: "The Lamp Room" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(t.paid.length, 0, "the tap waits for the claim");
  release();
  const { body } = await tap;
  assert.equal(body.place.art.state, "ready");
  assert.equal(t.paid.length, 1);
});

test("a place named with no description is never painted until a beat describes it; the planned place counts only once used", async () => {
  const t = await sceneWorld("r-m2bart14-nnnnnn");
  const key = placeKey("The Rooftop");
  await t.write(0, { places: [{ name: "The Rooftop", tags: "" }], cg: undefined });
  assert.equal(t.paid.length, 0, "nothing is paid for an image of nothing in particular");
  assert.equal((await t.world()).places[key]!.art, undefined);
  // Nor on a tap: the route holds to the same rule, and the place still takes a later beat's description.
  const tapped = await t.call("POST", "/runs/:run/art/place", { place: "The Rooftop" });
  assert.equal(tapped.status, 409, JSON.stringify(tapped.body));
  assert.equal(tapped.body.code, "conflict");
  assert.equal(t.paid.length, 0);
  assert.equal((await t.world()).places[key]!.art, undefined);
  await t.write(1, { places: [{ name: "The Rooftop", tags: "rooftop garden, lanterns, no humans" }], cg: undefined });
  const place = (await t.world()).places[key]!;
  assert.equal(place.tags, "rooftop garden, lanterns, no humans", "the first description is kept");
  assert.equal(place.art?.state, "ready");
  assert.equal(t.paid.length, 1);
  assert.match(t.paid[0]!.request.prompt, /rooftop garden, lanterns/);

  // The node opens "here", but the narrator names the place its own way: only the place the lines use is listed.
  const context = {
    node: { i: 0, kind: "beat", guide: "", cast: [], place: "The Rooftop Garden" },
    units: [],
    state: { lis: {} },
    last: false,
  } as never;
  const body = normalizeBeatBody(
    {
      places: [{ name: "Rooftop garden of the Academy", tags: "rooftop garden, night, no humans" }],
      segments: [
        { speaker: "", text: "Wind.", place: "Rooftop garden of the Academy" },
        { speaker: "", text: "Lanterns." },
      ],
    },
    { start: "The Rooftop Garden", context },
  )!;
  assert.deepEqual(body.places, [{ name: "Rooftop garden of the Academy", tags: "rooftop garden, night, no humans" }]);
  assert.deepEqual(
    body.segments.map((segment) => segment.place),
    ["Rooftop garden of the Academy", "Rooftop garden of the Academy"],
  );
});

test("a Retry on a failed place paints at once while a beat's automatic pass looks at that place", async () => {
  const t = await sceneWorld("r-m2bart15-oooooo", {
    runKey: "r-m2bart15-oooooo",
    before: (_call, n) => {
      if (n === 1) throw new Error("provider down");
    },
  });
  await t.write(0, { cg: undefined });
  assert.equal((await t.world()).places[placeKey("The Lamp Room")]!.art?.state, "failed");
  // The next beat's pass reads the world slowly; the player taps Retry meanwhile.
  let open = () => {};
  const held = new Promise<void>((resolve) => (open = resolve));
  let first = true;
  const store = {
    ...t.store,
    readDoc: async (...args: Parameters<typeof t.store.readDoc>) => {
      if (first && args[0] === worldId(t.runId)) {
        first = false;
        await held;
      }
      return t.store.readDoc(...args);
    },
  } as typeof t.store;
  const pass = queueScenePaints({ ...t.deps, store }, t.runId, beat(1, { cg: undefined }), { debugMode: false });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const tap = t.call("POST", "/runs/:run/art/place", { place: "The Lamp Room" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  open();
  await pass;
  assert.equal((await tap).body.place.art.state, "ready", "the tap is not swallowed");
  assert.equal(t.paid.length, 2);
});

test("a CG eased off before its line is never paid for, even one already waiting for the lane", async () => {
  const t = await sceneWorld("r-m2bart16-pppppp");
  let free = () => {};
  const lane = paintSlot("conn-image", () => new Promise<void>((resolve) => (free = resolve)));
  const written = await saveBeat(t.store, t.runId, beat(1, { places: [], cg: { ...CG, at: 2 } }));
  const painting = queueScenePaints(t.deps, t.runId, written, { debugMode: false });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await t.store.updateDoc(runDocTarget("beat", beatId(t.runId, KEY, 1)), normalizeBeat, (current) => ({
    ...current,
    easedOff: { at: 0 },
  }));
  free();
  await lane;
  await painting;
  assert.equal(t.paid.length, 0);
  assert.equal((await readStoredBeat(t.store, t.runId, 1))!.cg?.art?.state, "stopped");
});

test("a paint a restart left pending reads as stopped in the run view and the beat as well", async () => {
  const t = await sceneWorld("r-m2bart17-qqqqqq");
  const pending = { state: "pending" as const, at: "2026-10-28T09:00:00.000Z" };
  const key = placeKey("The Lamp Room");
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (current) => ({
    ...current,
    places: { [key]: { name: "The Lamp Room", tags: "lighthouse interior, no humans", art: pending } },
  }));
  await saveBeat(t.store, t.runId, beat(2, { cg: { ...CG, art: pending } }));
  const run = await routesOf(registerRunRoutes, t.deps, "r-m2bart17-qqqqqq")("GET", "/runs/:run");
  assert.equal(run.body.view.world.places[key].art.state, "stopped");
  const served = await storyRoutes(t.deps, "r-m2bart17-qqqqqq")(
    "POST",
    "/runs/:run/chapters/:key/beats/:i",
    {},
    {
      key: KEY,
      i: "2",
    },
  );
  assert.equal(served.body.beat.cg.art.state, "stopped");
  assert.equal((await readStoredBeat(t.store, t.runId, 2))!.cg?.art?.state, "pending", "only the view changes");
});
