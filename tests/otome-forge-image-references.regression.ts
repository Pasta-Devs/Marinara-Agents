// Inspect actual loopback requests: selected-card full_neutral, then its current avatar, then retained Otome art.
// Metadata URLs and invalid sprite filenames never become fetch targets.
import assert from "node:assert/strict";
import test from "node:test";
import {
  createImageClient,
  type ImageSubject,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import { paintCgNow } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cg.ts";
import { paintPairNow } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/outfits.ts";
import {
  itemId,
  playerId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  photoPromptFor,
  takePhoto,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/photo-shoot.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeItem } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/wish.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import type {
  Player,
  Unit,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { artWorld, beat, KEY, PNG, saveBeat, seedChapter } from "./fixtures/otome-forge-art.ts";
import { KAI } from "./fixtures/otome-forge-story.ts";

const data = (value: string) => `data:image/png;base64,${Buffer.from(value).toString("base64")}`;
const portrait = "/api/global-gallery/file/otome-neutral.png";
const outfit = "/api/global-gallery/file/winter.png";
const request = {
  connectionId: "image-connection",
  name: "Dottore",
  prompt: "blue and gold feathers, full body, standing, neutral pose",
  negativePrompt: "text",
  width: 832,
  height: 1216,
  debugMode: true,
};

function engine({
  sprites = [{ expression: "full_neutral", filename: "full_neutral.png", url: "https://untrusted.invalid/identity" }],
  missing = [],
  spriteMime = "image/png",
}: { sprites?: unknown; missing?: string[]; spriteMime?: string } = {}) {
  const reads: string[] = [];
  const generations: Array<{ referenceImages?: string[] }> = [];
  /** What the client warned, formatted. */
  const warnings: string[] = [];
  const format = (message: string, ...args: unknown[]) =>
    args.reduce<string>((text, arg) => text.replace("%s", String(arg)).replace("%d", String(arg)), message);
  const client = createImageClient({
    baseUrl: "http://127.0.0.1:9",
    logger: {
      debug: () => undefined,
      warn: (message: string, ...args: unknown[]) => void warnings.push(format(message, ...args)),
    },
    fetch: (async (url, init) => {
      const path = String(url).replace("http://127.0.0.1:9", "");
      reads.push(path);
      if (missing.includes(path)) return new Response("missing", { status: 404 });
      if (/^\/api\/sprites\/[^/]+$/u.test(path)) return Response.json(sprites);
      if (/^\/api\/sprites\/[^/]+\/file\/full_neutral\.png$/u.test(path)) {
        return new Response(path, { headers: { "content-type": spriteMime } });
      }
      if (/^\/api\/characters\/personas\/[^/]+$/u.test(path)) {
        return Response.json({ avatarPath: "/api/avatars/file/persona.png" });
      }
      if (path.startsWith("/api/avatars/file/") || path.startsWith("/api/global-gallery/file/")) {
        return new Response(path, { headers: { "content-type": "image/png" } });
      }
      if (path === "/api/characters/avatar-generation") {
        const body = JSON.parse(String(init?.body));
        generations.push(body);
        return Response.json({ image: `data:image/png;base64,${PNG}`, prompt: body.promptOverrides[0].prompt });
      }
      if (/^\/api\/characters\/[^/]+$/u.test(path)) return Response.json({ avatarPath: "/api/avatars/file/card.png" });
      if (path === "/api/global-gallery/upload") return Response.json({ id: "painted", url: "/painted.png" });
      if (path === "/api/app-settings/ui") return Response.json({ value: {} });
      assert.fail(`unexpected fetch ${path}`);
    }) as typeof globalThis.fetch,
  });
  return { client, reads, generations, warnings };
}

test("a portrait sends the card's full body AND its avatar; a scene sends one per subject", async () => {
  const t = engine();
  const unit: ImageSubject = {
    kind: "character",
    cardId: "card-dottore",
    portrait,
    wornOutfit: "winter",
    outfits: [{ id: "winter", url: outfit }],
  };
  await t.client.generatePortrait({ ...request, unit: { ...unit, portrait: undefined } });
  await t.client.generateOutfit({ ...request, unit });
  await t.client.generateBannerArt({ ...request, units: [unit] });
  const neutral = data("/api/sprites/card-dottore/file/full_neutral.png");
  const avatar = data("/api/avatars/file/card.png");
  assert.deepEqual(
    t.generations.map((call) => call.referenceImages),
    // A look he is painted into keeps both likenesses, full body first; a scene keeps one per subject, because the
    // four-reference budget is shared by the whole cast.
    [
      [neutral, avatar],
      [neutral, avatar],
      [neutral, data(outfit)],
    ],
  );
  assert.ok(!t.reads.includes(portrait), "the existing card full-body neutral takes priority over the generated look");
  assert.ok(!t.reads.some((path) => path.includes("untrusted.invalid")), "sprite metadata URLs are never fetched");
  assert.ok(
    t.reads.includes("/api/avatars/file/card.png"),
    "the card's avatar accompanies the full body in a portrait instead of being displaced by it",
  );
});

test("missing or unreadable neutral art uses the current card avatar before retained art; unreadable avatars retain the look", async () => {
  for (const options of [
    { sprites: [] },
    { missing: ["/api/sprites/card-dottore/file/full_neutral.png"] },
    { spriteMime: "text/html" },
    { missing: ["/api/sprites/card-dottore"] },
  ]) {
    const t = engine(options);
    await t.client.generateOutfit({ ...request, unit: { kind: "character", cardId: "card-dottore", portrait } });
    assert.deepEqual(t.generations[0]!.referenceImages, [data("/api/avatars/file/card.png")]);
    assert.ok(!t.reads.includes(portrait), "the current selected avatar takes priority over the generated look");
  }
  const t = engine({ sprites: [], missing: ["/api/avatars/file/card.png"] });
  await t.client.generateOutfit({ ...request, unit: { kind: "character", cardId: "card-dottore", portrait } });
  assert.deepEqual(t.generations[0]!.referenceImages, [data(portrait)]);
});

test("only the exact neutral raster belonging to the selected card is read; unsafe metadata and IDs add no sprite reference", async () => {
  const t = engine({
    sprites: [
      { expression: "full_neutral", filename: "../full_neutral.png", url: "/api/sprites/other/file/full_neutral.png" },
      { expression: "full_neutral", filename: "full_neutral.svg" },
      { expression: "full_idle", filename: "full_idle.png" },
      { expression: "neutral", filename: "neutral.png" },
      null,
    ],
  });
  await t.client.generateOutfit({ ...request, unit: { kind: "character", cardId: "card-dottore", portrait } });
  assert.deepEqual(t.generations[0]!.referenceImages, [data("/api/avatars/file/card.png")]);
  assert.ok(!t.reads.some((path) => path.includes("/file/full_") || path.includes("/sprites/other/")));
  const unsafe = engine({ sprites: [] });
  await unsafe.client.generateOutfit({ ...request, unit: { kind: "character", cardId: "../other", portrait } });
  assert.ok(!unsafe.reads.some((path) => path.startsWith("/api/sprites/")));
});

test("Otome's reference opt-in preserves persona identity, scene outfit ordering, deduplication and the four-image cap", async () => {
  const t = engine();
  const unit = {
    kind: "character" as const,
    cardId: "card-dottore",
    wornOutfit: "winter",
    outfits: [{ id: "winter", url: outfit }],
  };
  await t.client.generateBannerArt({
    ...request,
    units: [unit, { ...unit }, { kind: "character", personaId: "persona-mari" }],
  });
  assert.deepEqual(t.generations[0]!.referenceImages, [
    data("/api/sprites/card-dottore/file/full_neutral.png"),
    data("/api/avatars/file/persona.png"),
    data(outfit),
  ]);
  await t.client.generateBannerArt({
    ...request,
    units: ["a", "b", "c", "d", "e"].map((id) => ({ ...unit, cardId: `card-${id}` })),
  });
  assert.deepEqual(
    t.generations[1]!.referenceImages,
    ["a", "b", "c", "d"].map((id) => data(`/api/sprites/card-${id}/file/full_neutral.png`)),
  );
});

const hisLook = "/api/global-gallery/file/his-pair-look.png";
const herLook = "/api/global-gallery/file/her-pair-look.png";

/** A run whose couple set (his look, her look) is owned and painted, painted through `host`'s real client. */
async function pairWorld(runKey: string, host: ReturnType<typeof engine>, cardId?: string) {
  const t = await artWorld({ runKey });
  t.deps.images = host.client;
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    source: cardId ? "card" : "archetype",
    cardId,
  }));
  const his = normalizeItem({
    id: "his-wardrobe-0-f",
    kind: "his-look5",
    li: KAI,
    banner: "his-wardrobe-0",
    look: { name: "His pair look", outfitLine: "blue coat" },
    art: { state: "ready", at: "now", url: hisLook },
  });
  const her = normalizeItem({
    id: "my-wardrobe-0-f",
    kind: "her-look5",
    banner: "my-wardrobe-0",
    coupleWith: his.id,
    look: { name: "Her pair look", outfitLine: "amber dress" },
    art: { state: "ready", at: "now", url: herLook },
  });
  for (const item of [his, her]) {
    await t.store.mutateDoc(runDocTarget("item", itemId(t.runId, item.id)), normalizeItem, () => item);
  }
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    owned: { ...state.owned, items: [his.id, her.id] },
  }));
  return { ...t, paint: () => paintPairNow(t.deps, t.runId, her.id, { debugMode: false }) };
}

test("a real couple-portrait paint sends each of them once, as their pair look, in order (2026-11-03)", async () => {
  for (const [i, scenario] of ["neutral", "missing", "no-card"].entries()) {
    const host = engine(scenario === "missing" ? { sprites: [] } : {});
    const t = await pairWorld(`r-pairrefs${i}-aaaaaa`, host, scenario === "no-card" ? undefined : "card-dottore");
    assert.equal((await t.paint()).state, "ready");
    assert.equal(host.generations.length, 1);
    // His card's full body beside his look was two standing pictures of him: the model merged bodies.
    assert.deepEqual(host.generations[0]!.referenceImages, [data(hisLook), data(herLook)], scenario);
    assert.ok(
      !host.reads.some((path) => path.startsWith("/api/characters/personas/")),
      "the persona keeps its painted pair-look reference",
    );
    assert.equal(t.calls.length, 0);
  }
});

test("a pair look whose file is gone fails the pair portrait before anything is paid for (#2145)", async () => {
  const host = engine({ missing: [hisLook] });
  const t = await pairWorld("r-pairgone-aaaaaa", host, "card-dottore");
  const art = await t.paint();
  assert.equal(art.state, "failed");
  assert.match(art.error ?? "", /No picture of Kai could be loaded/);
  assert.equal(host.generations.length, 0, "nothing was painted or paid for");
});

const his = "/api/global-gallery/file/kai-everyday.png";
const hers = "/api/global-gallery/file/ines-everyday.png";
const place = "/api/global-gallery/file/lamp-room.png";
const setup = {
  id: "ph-mh1abc-abcdef",
  li: KAI,
  place: "the-lamp-room",
  hisLook: "base",
  herLook: "base",
  his: { expression: "smile", pose: "hug" },
  her: { expression: "smile", pose: "hug" },
};

/** A run with his and her everyday portraits and a painted Lamp Room, photographed through `host`'s real client. */
async function photoWorld(runKey: string, host: ReturnType<typeof engine>) {
  const t = await artWorld({ runKey });
  t.deps.images = host.client;
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    cardId: "card-dottore",
    portrait: his,
  }));
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    portrait: hers,
  }));
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    places: {
      "the-lamp-room": { name: "The Lamp Room", tags: "lighthouse", art: { state: "ready", at: "now", url: place } },
    },
  }));
  return t;
}

test("a real Photo Shoot paint sends his look, her look and the place to the Engine as given (#2087)", async () => {
  const host = engine();
  const t = await photoWorld("r-photorefs-aaaaaa", host);
  const photo = await takePhoto(t.deps, t.runId, setup, { debugMode: true });
  assert.equal(photo.art.state, "ready");
  assert.equal(host.generations.length, 1);
  // generateImage is not the kit's wrapped scene paint: no card sprite or avatar is put in front of the looks.
  assert.deepEqual(host.generations[0]!.referenceImages, [data(his), data(hers), data(place)]);
  assert.ok(!host.reads.some((path) => path.startsWith("/api/sprites/")), "his card's sprites are not read");
  assert.equal(t.calls.length, 0);
});

test("a Photo Shoot whose picture of him is gone fails before paying; its prompt can still be reviewed (#2145)", async () => {
  const host = engine({ missing: [his] });
  const t = await photoWorld("r-photogone-aaaaaa", host);
  assert.match((await photoPromptFor(t.deps, t.runId, setup)).prompt, /Kai/);
  const photo = await takePhoto(t.deps, t.runId, setup, { debugMode: true });
  assert.equal(photo.art.state, "failed");
  assert.match(photo.art.error ?? "", /No picture of Kai could be loaded/);
  assert.equal(host.generations.length, 0, "nothing was painted or paid for");
});

const gown = "/api/global-gallery/file/gown.png";
const look = (id: string, url: string) => ({ id, name: id, outfitLine: `${id} outfit`, url, at: "now" });

/** A run whose key image (beat 1) shows `cast`, painted through `host`'s real client; Kai and Ines changed first. */
async function keyImage(
  runKey: string,
  host: ReturnType<typeof engine>,
  cast: string[],
  kai: Partial<Unit> = {},
  her: Partial<Player> = {},
) {
  const t = await artWorld({ runKey });
  t.deps.images = host.client;
  await seedChapter(t.store, t.runId);
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({ ...unit, ...kai }));
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    ...her,
  }));
  await saveBeat(t.store, t.runId, beat(1, { cg: { at: 0, brief: "At the lamp.", cast }, places: [] }));
  return { ...t, paint: () => paintCgNow(t.deps, t.runId, KEY, 1, { debugMode: false }) };
}

test("a group key image sends each person's own picture, never the looks they wear (#2145)", async () => {
  const wearing = {
    kai: { cardId: "card-dottore", outfits: [look("winter", outfit)], wornOutfit: "winter" },
    her: { outfits: [look("gown", gown)], wornOutfit: "gown" },
  };
  // His card's full body and her persona's avatar; with no neutral art and both looks gone, his card's avatar.
  for (const [i, options, expected] of [
    [0, {}, data("/api/sprites/card-dottore/file/full_neutral.png")],
    [1, { sprites: [], missing: [outfit, gown] }, data("/api/avatars/file/card.png")],
  ] as const) {
    const host = engine({ ...options, missing: [...(options.missing ?? [])] });
    const t = await keyImage(`r-groupref${i}-aaaaaa`, host, ["Kai", "Ines"], wearing.kai, wearing.her);
    assert.equal((await t.paint())?.state, "ready");
    assert.equal(host.generations.length, 1);
    const body = host.generations[0] as { referenceImages?: string[]; promptOverrides: Array<{ prompt: string }> };
    assert.deepEqual(body.referenceImages, [expected, data("/api/avatars/file/persona.png")]);
    assert.ok(!host.reads.includes(outfit) && !host.reads.includes(gown), "no look picture is read or sent");
    assert.match(
      body.promptOverrides[0]!.prompt,
      /Reference images, in order: Kai; Ines\. Use them only for each person's face, hair and build,/,
    );
    assert.match(body.promptOverrides[0]!.prompt, /Kai: [^.]*winter outfit\./, "the outfit line dresses him");
  }
});

test("beside others, someone whose only picture is the look they wear sends that look once, as them (#2145)", async () => {
  const host = engine();
  const t = await keyImage("r-grouplook-aaaaaa", host, ["Kai", "Ines"], {
    outfits: [look("winter", outfit)],
    wornOutfit: "winter",
  });
  assert.equal((await t.paint())?.state, "ready");
  const body = host.generations[0] as { referenceImages?: string[]; promptOverrides: Array<{ prompt: string }> };
  assert.deepEqual(body.referenceImages, [data(outfit), data("/api/avatars/file/persona.png")]);
  assert.equal(host.reads.filter((path) => path === outfit).length, 1, "the look is read once");
  assert.match(body.promptOverrides[0]!.prompt, /Reference images, in order: Kai; Ines\./);
});

test("a group key image fails before paying when one person's only picture is gone (#2145)", async () => {
  const gone = "/api/global-gallery/file/kai-gone.png";
  for (const [i, kai] of [
    { portrait: gone },
    { portrait: gone, outfits: [look("winter", outfit)], wornOutfit: "winter" },
  ].entries()) {
    const host = engine({ missing: [gone, outfit] });
    const t = await keyImage(`r-groupgone${i}-aaaaaa`, host, ["Kai", "Ines"], kai);
    const failed = await t.paint();
    assert.equal(failed?.state, "failed");
    assert.match(failed?.error ?? "", /No picture of Kai could be loaded/);
    assert.equal(host.generations.length, 0, "nothing was painted or paid for");
  }
});

test("names the story writes another way still send that person: a surname, a title, you, the protagonist (#2145)", async () => {
  for (const [i, cast] of [
    ["Ren", "You"],
    ["Lord Kai", "the protagonist"],
  ].entries()) {
    const host = engine();
    const t = await keyImage(`r-castnames${i}-aaaaaa`, host, cast, {
      name: "Kai Ren",
      portrait: "/api/global-gallery/file/kai.png",
    });
    assert.equal((await t.paint())?.state, "ready");
    assert.deepEqual(
      host.generations[0]!.referenceImages,
      [data("/api/global-gallery/file/kai.png"), data("/api/avatars/file/persona.png")],
      cast.join(", "),
    );
  }
});

test("a likeness whose file is gone fails the key image before paying, and Retry paints it once it is back (#2145)", async () => {
  const gone = "/api/global-gallery/file/kai-gone.png";
  const missing = [gone];
  const host = engine({ missing });
  const t = await keyImage("r-cggone-aaaaaa", host, ["Kai"], { portrait: gone });
  const failed = await t.paint();
  assert.equal(failed?.state, "failed");
  assert.match(failed?.error ?? "", /No picture of Kai could be loaded to send as a reference/);
  assert.equal(host.generations.length, 0, "nothing was painted or paid for");
  missing.length = 0;
  assert.equal((await t.paint())?.state, "ready", "Retry");
  assert.equal(host.generations.length, 1);
  assert.deepEqual(host.generations[0]!.referenceImages, [data(gone)]);
});

test("someone with no picture at all is painted from the description, as before (#2145)", async () => {
  const host = engine();
  // An archetype's new look before he has any portrait: nothing to send, and nothing that failed to load.
  await host.client.generateOutfit({ ...request, unit: { kind: "character", outfits: [], who: "Kai" } });
  assert.equal(host.generations.length, 1);
  assert.equal(host.generations[0]!.referenceImages, undefined);
  assert.ok(
    host.warnings.includes("[otome-forge] generateOutfit: Kai has no picture to send; painted from the description"),
    "the paint says so",
  );
});

test("an adopted Engine sprite portrait, which the kit never reads, stops no key image while his card has a likeness (#2147)", async () => {
  const kai = { cardId: "card-dottore", portrait: "/api/sprites/card-dottore/file/full_neutral.png" };
  // His card's full body, else (no sprites to read) his card's avatar.
  for (const [i, options, expected] of [
    [0, {}, data("/api/sprites/card-dottore/file/full_neutral.png")],
    [1, { missing: ["/api/sprites/card-dottore"] }, data("/api/avatars/file/card.png")],
  ] as const) {
    const host = engine({ missing: [...(options.missing ?? [])] });
    const t = await keyImage(`r-engineref${i}-aaaaaa`, host, ["Kai", "Ines"], kai, {
      portrait: "/api/avatars/file/persona.png",
    });
    assert.equal((await t.paint())?.state, "ready");
    assert.equal(host.generations.length, 1);
    assert.deepEqual(host.generations[0]!.referenceImages, [expected, data("/api/avatars/file/persona.png")]);
  }
});
