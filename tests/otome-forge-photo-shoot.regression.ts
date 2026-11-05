// Otome Hearth's Photo Shoot (#2087, S/minigames/photo-shoot.ts and the routes in S/routes/dates.ts): one image of the
// two of them, picked by the player, with no model call; his look, her look and the place as references in that order;
// paid once per id; the Album's Photos and Home's taped photo; delete, and the run's delete sweeping them. Paints run
// against the art fixture's image client, which counts paid calls; t.calls counts model calls.
import assert from "node:assert/strict";
import test from "node:test";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type { Item } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import {
  PHOTO_POSE_PARTNER,
  PHOTO_SHARED_POSES,
  newPhotoId,
  isPhotoId,
  posesAgree,
  withPose,
  type PhotoPick,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/photos.ts";
import type { OtomeArt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/expressions.ts";
import type { CutoutClient } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import { galleryRefIds } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import type {
  OtomeReply,
  RouteDeps,
  RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  RUN_DOC_KINDS,
  itemId,
  playerId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  normalizePhoto,
  photoId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/photo-shoot.ts";
import { registerAlbumRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/album.ts";
import { registerDateRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/dates.ts";
import { registerHomeRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/home.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeItem } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/wish.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { artWorld, setImages, until, type PaidCall } from "./fixtures/otome-forge-art.ts";
import { KAI, MIR, at } from "./fixtures/otome-forge-story.ts";

const FILE = "/api/global-gallery/file";
const PLACE = "the-lamp-room";
const BARE = "the-quay";
const PLACE_URL = `${FILE}/lamp-room.png`;
const KAI_PORTRAIT = `${FILE}/kai-portrait.png`;
const INES_PORTRAIT = `${FILE}/ines-portrait.png`;
const HIS_URL = `${FILE}/harbour-night.png`;
const HER_URL = `${FILE}/lantern-dress.png`;
const CENSORING = /gentle|chaste|innocent|tasteful|wholesome|non-?sexual|consensual|appropriate/iu;

const ready = (url: string, ref: string) => ({ state: "ready" as const, at, url, ref });
const item = (id: string, changes: Partial<Item>): Item => ({
  id,
  kind: "his-look5",
  banner: id.replace(/-(?:f|a[1-3])$/, ""),
  li: KAI,
  title: `Title ${id}`,
  art: null,
  story: null,
  createdAt: at,
  ...changes,
});
const LOOKS = {
  his: item("his-wardrobe-0-f", {
    look: { name: "Harbour Night", outfitLine: "navy greatcoat, brass buttons" },
    art: ready(HIS_URL, "global-gallery:his-look"),
  }),
  hers: item("my-wardrobe-0-f", {
    kind: "her-look5",
    look: { name: "Lantern Dress", outfitLine: "amber silk dress, lantern earrings" },
    art: ready(HER_URL, "global-gallery:her-look"),
  }),
  unpainted: item("my-wardrobe-0-a1", {
    kind: "her-look4",
    look: { name: "Rain Coat", outfitLine: "yellow raincoat" },
  }),
  notWon: item("my-wardrobe-0-a2", {
    kind: "her-look4",
    look: { name: "Velvet", outfitLine: "green velvet" },
    art: ready(`${FILE}/velvet.png`, "global-gallery:velvet"),
  }),
  others: item("his-wardrobe-0-a1", {
    kind: "his-look4",
    li: MIR,
    look: { name: "Pier Shirt", outfitLine: "linen shirt" },
    art: ready(`${FILE}/pier.png`, "global-gallery:pier"),
  }),
};

/** The date, album, home and run routes on a fake router (Home wrapped in the kit's time zones, as server-entry does). */
function routes(deps: RouteDeps, runKey: string) {
  const table = new Map<string, RouteHandler>();
  const router = {
    get: (path: string, handler: RouteHandler) => table.set(`GET ${path}`, handler),
    post: (path: string, handler: RouteHandler) => table.set(`POST ${path}`, handler),
  };
  for (const register of [registerDateRoutes, registerAlbumRoutes, registerRunRoutes]) register(router, deps);
  registerHomeRoutes(forgeTimeZoneRoutes(router), deps);
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

/**
 * The art fixture's world with a painted place and an unpainted one, portraits and lines for both of them, and five
 * looks (owned and painted, owned and not painted, not won, another love interest's). Each reference is the data URL of
 * its own path, so the paid call shows which images it was sent.
 */
async function photoWorld(
  runKey: string,
  { before, images = {} }: { before?: (call: PaidCall, n: number) => void | Promise<void>; images?: object } = {},
) {
  const t = await artWorld({ runKey, before, images });
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    places: {
      [PLACE]: {
        name: "The Lamp Room",
        tags: "lighthouse interior, great lens, no humans",
        art: ready(PLACE_URL, "global-gallery:place"),
      },
      [BARE]: { name: "The Quay", tags: "harbour quay, lanterns, no humans" },
    },
  }));
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    identityLine: "tall, dark hair, grey eyes",
    outfitLine: "black wool coat",
    portrait: KAI_PORTRAIT,
    portraitRef: "global-gallery:kai-portrait",
  }));
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    look: { identityLine: "short dark hair, freckles", outfitLine: "grey wool coat" },
    portrait: INES_PORTRAIT,
    portraitRef: "global-gallery:ines-portrait",
  }));
  for (const value of Object.values(LOOKS)) {
    await t.store.mutateDoc(runDocTarget("item", itemId(t.runId, value.id)), normalizeItem, () => value);
  }
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    owned: { items: [LOOKS.his.id, LOOKS.hers.id, LOOKS.unpainted.id, LOOKS.others.id] },
  }));
  t.images.cardAvatarImage = async (path) => ({ mime: "image/png", base64: Buffer.from(path).toString("base64") });
  let active = true;
  const art: OtomeArt = {
    repaintExpressions: async () => assert.fail("a photo never repaints faces"),
    queueExpressions: () => assert.fail("a photo never queues faces"),
    queueScenePaints: async () => undefined,
    releaseBeatArt: async () => undefined,
    active: () => active,
    dispose: () => {
      active = false;
    },
  };
  const cutouts: CutoutClient = {
    cutOut: async () => ({ id: "cut", url: `${FILE}/cut.png` }),
    deleteGalleryImage: async () => true,
  };
  const deps: RouteDeps = { ...t.deps, art, cutouts } as RouteDeps;
  const call = routes(deps, runKey);
  const photos = async () => t.store.listRun("photo", t.runId);
  const stored = async (id: string) => t.store.readDoc(photoId(t.runId, id), normalizePhoto);
  return { ...t, deps, art, call, photos, stored };
}

type World = Awaited<ReturnType<typeof photoWorld>>;

const pick = (expression: string, pose: string, changes: Partial<PhotoPick> = {}) =>
  ({ expression, pose, ...changes }) as PhotoPick;
const setup = (changes: Record<string, unknown> = {}) => ({
  li: KAI,
  place: PLACE,
  hisLook: LOOKS.his.id,
  herLook: LOOKS.hers.id,
  his: pick("smirk", "peace"),
  her: pick("smile", "wave"),
  ...changes,
});
const take = (t: World, body: Record<string, unknown>) => t.call("POST", "/runs/:run/photos", body);
const promptOf = (t: World, body: Record<string, unknown>) => t.call("POST", "/runs/:run/photos/prompt", body);
const decoded = (call: PaidCall) =>
  (call.request.referenceImages ?? []).map((data) =>
    Buffer.from(data.replace(/^data:image\/png;base64,/u, ""), "base64").toString(),
  );

test("Take picture paints one photo with no model call: his look, her look, then the place as references", async () => {
  const t = await photoWorld("r-photo1-aaaaaa");
  const stateBefore = await t.store.readDoc(stateId(t.runId), normalizeState);
  const review = await promptOf(t, setup());
  assert.equal(review.status, 200, JSON.stringify(review.body));
  assert.equal(t.paid.length, 0, "the review pays nothing");
  assert.deepEqual(await t.photos(), [], "and saves nothing");

  const id = newPhotoId();
  assert.ok(isPhotoId(id));
  const taken = await take(t, { id, ...setup() });
  assert.equal(taken.status, 200, JSON.stringify(taken.body));
  assert.equal(taken.body.photo.art.state, "ready");
  assert.deepEqual(taken.body.photo.place, { key: PLACE, name: "The Lamp Room" });
  assert.equal(taken.body.photo.prompt, undefined, "the prompt stays on the server");
  assert.equal(t.paid.length, 1);
  const paid = t.paid[0]!;
  assert.equal(paid.method, "generateImage", "the kit wrapper never rebuilds these references");
  assert.deepEqual(decoded(paid), [HIS_URL, HER_URL, PLACE_URL], "people first, the place last");
  assert.deepEqual([paid.request.width, paid.request.height], [1024, 1024]);
  assert.equal(paid.request.prompt, review.body.prompt, "the review showed what was sent");
  assert.equal(t.calls.length, 0, "no model call");

  // Only ids and names are kept: deleting the photo never takes the place's or a look's image with it.
  const record = (await t.stored(id))!;
  assert.deepEqual(galleryRefIds(record), ["img1"], "its own image alone");
  assert.equal(record.prompt?.prompt, paid.request.prompt);
  // Nothing is worn, granted or remembered.
  assert.equal((await t.store.readDoc(playerId(t.runId), normalizePlayer))!.wornOutfit, undefined);
  assert.equal((await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!.wornOutfit, undefined);
  assert.deepEqual(await t.store.readDoc(stateId(t.runId), normalizeState), stateBefore);

  // Everyday looks send their portraits; without one, his card's avatar and her persona's.
  const base = await take(t, { id: newPhotoId(), ...setup({ hisLook: "base", herLook: "base" }) });
  assert.equal(base.body.photo.art.state, "ready");
  assert.deepEqual(decoded(t.paid[1]!), [KAI_PORTRAIT, INES_PORTRAIT, PLACE_URL]);
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => {
    const { portrait: _portrait, portraitRef: _ref, ...rest } = unit;
    return { ...rest, cardId: "card-kai" };
  });
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => {
    const { portrait: _portrait, portraitRef: _ref, ...rest } = player;
    return rest;
  });
  t.images.characterCard = async () => ({ avatarPath: "/api/avatars/file/kai-card.png" });
  t.images.personaAvatar = async () => "/api/avatars/file/ines-persona.png";
  await take(t, { id: newPhotoId(), ...setup({ hisLook: "base", herLook: "base" }) });
  assert.deepEqual(decoded(t.paid[2]!), [
    "/api/avatars/file/kai-card.png",
    "/api/avatars/file/ines-persona.png",
    PLACE_URL,
  ]);
  // An avatar may wear something else: it is labelled as who they are, and the outfit line dresses them.
  assert.match(
    t.paid[2]!.request.prompt,
    /Reference images, in order: Kai's face; Ines's face; the place behind them\./u,
  );
  assert.doesNotMatch(t.paid[2]!.request.prompt, /in this outfit/u);
  assert.match(t.paid[2]!.request.prompt, /Kai: tall, dark hair, grey eyes; black wool coat\./u);
  assert.equal(t.calls.length, 0, "still no model call");
});

test("a setup the run cannot take is refused before anything is saved or paid for", async () => {
  const t = await photoWorld("r-photo2-aaaaaa");
  const long = "x".repeat(81);
  const refused: Array<[string, Record<string, unknown>, number, string?]> = [
    ["an unpainted place", setup({ place: BARE }), 400, "bad-request"],
    ["an unknown place", setup({ place: "nowhere" }), 400, "bad-request"],
    ["an inherited key", setup({ place: "toString" }), 400, "bad-request"],
    ["another love interest's look", setup({ hisLook: LOOKS.others.id }), 400, "bad-request"],
    ["her look on him", setup({ hisLook: LOOKS.hers.id }), 400, "bad-request"],
    ["custom words left empty", setup({ his: pick("custom", "peace", { expressionText: "  " }) }), 400],
    ["custom pose with no words", setup({ her: pick("smile", "custom") }), 400],
    ["words over 80", setup({ his: pick("custom", "peace", { expressionText: long }) }), 400],
    ["a shared pose for one of them", setup({ his: pick("smile", "kiss") }), 400, "bad-request"],
    ["mismatched halves", setup({ his: pick("smile", "piggyback-carry"), her: pick("smile", "piggyback-carry") }), 400],
    ["a look not won", setup({ herLook: LOOKS.notWon.id }), 409, "locked"],
    ["a look not painted", setup({ herLook: LOOKS.unpainted.id }), 409, "conflict"],
    ["an unknown love interest", setup({ li: "li-nobody-zz99" }), 404, "not-found"],
    ["no love interest id", setup({ li: "kai" }), 404, "not-found"],
  ];
  for (const [what, body, status, code] of refused) {
    for (const [route, send] of [
      ["take", () => take(t, { id: newPhotoId(), ...body })],
      ["review", () => promptOf(t, body)],
    ] as const) {
      const answer = await send();
      assert.equal(answer.status, status, `${route}: ${what}: ${JSON.stringify(answer.body)}`);
      if (code) assert.equal(answer.body.code, code, `${route}: ${what}`);
    }
  }
  assert.equal((await take(t, { id: "not-a-photo", ...setup() })).status, 400, "a malformed id");
  assert.equal(t.paid.length, 0);
  assert.deepEqual(await t.photos(), []);

  await setImages(t.store, t.runId, { connectionId: null });
  let fetched = 0;
  const avatarImage = t.images.cardAvatarImage;
  t.images.cardAvatarImage = async (path) => {
    fetched += 1;
    return avatarImage(path);
  };
  // Before the other checks: a text-only story has painted no place, and that is not what stops the photo.
  for (const body of [setup(), setup({ place: BARE }), setup({ herLook: LOOKS.notWon.id })]) {
    for (const [route, answer] of [
      ["take", await take(t, { id: newPhotoId(), ...body })],
      ["review", await promptOf(t, body)],
    ] as const) {
      assert.deepEqual([answer.status, answer.body.code], [503, "no-connection"], `${route}: ${JSON.stringify(body)}`);
    }
  }
  assert.equal(fetched, 0, "no reference is fetched without an image connection");
  assert.deepEqual(await t.photos(), [], "nothing is saved without an image connection");
  assert.equal(t.paid.length, 0);
  assert.equal(t.calls.length, 0);
});

test("a photo pays once: a double tap, a resend after it is ready, a Retry after a failure; a teardown stops it", async () => {
  let fail = true;
  const t = await photoWorld("r-photo3-aaaaaa", {
    before: () => {
      if (fail) {
        fail = false;
        throw new Error("provider said no");
      }
    },
  });
  const failedId = newPhotoId();
  const custom = setup({ his: pick("custom", "peace", { expressionText: "SECRET-WORDS grin" }) });
  const failed = await take(t, { id: failedId, ...custom });
  assert.equal(failed.body.photo.art.state, "failed");
  assert.equal((await t.stored(failedId))!.art.state, "failed", "the failure is saved");
  const warned = t.logs.filter((entry) => entry.level === "warn").map((entry) => JSON.stringify(entry));
  assert.ok(
    warned.some((line) => line.includes(`photo ${failedId}`)),
    `the label is logged: ${warned.join("\n")}`,
  );
  const retried = await take(t, { id: failedId, ...custom });
  assert.equal(retried.body.photo.art.state, "ready");
  assert.equal(t.paid.length, 2, "Try again repaints once");

  const id = newPhotoId();
  const taps = await Promise.all([take(t, { id, ...setup() }), take(t, { id, ...setup() })]);
  for (const tap of taps) assert.equal(tap.body.photo.art.state, "ready", JSON.stringify(tap.body));
  assert.equal(taps[0]!.body.photo.art.url, taps[1]!.body.photo.art.url);
  assert.equal(t.paid.length, 3, "a double tap pays once");
  const again = await take(t, { id, ...setup({ place: BARE, his: pick("wink", "kiss") }) });
  assert.equal(again.status, 200);
  assert.equal(again.body.photo.art.url, taps[0]!.body.photo.art.url, "a ready photo is answered as it is");
  assert.equal(t.paid.length, 3, "a resend pays nothing");

  t.art.dispose();
  const stopped = await take(t, { id: newPhotoId(), ...setup() });
  assert.equal(stopped.body.photo.art.state, "stopped");
  assert.equal(t.paid.length, 3, "nothing is paid once the art service is torn down");
  assert.equal(t.calls.length, 0);
  // At every level (the routes run with debug mode on), through the failure, the Retry and the paints after it.
  assert.ok(t.logs.length > 0);
  for (const entry of t.logs) {
    const line = JSON.stringify(entry);
    assert.ok(!line.includes("SECRET-WORDS") && !line.includes("Reference images"), `never the prompt: ${line}`);
  }
});

test("the photo's prompt: both of them posing, each pick in words, the labels, the rating, and nothing softened", async () => {
  const t = await photoWorld("r-photo4-aaaaaa");
  const solo = (await promptOf(t, setup())).body;
  assert.match(solo.prompt, /A photo of Kai and Ines taking a picture together, both facing the camera and posing/u);
  assert.match(solo.prompt, /Kai makes a peace sign\. Ines waves at the camera\./u);
  assert.match(solo.prompt, /Kai's expression: a confident smirk\. Ines's expression: smiling brightly\./u);
  assert.match(
    solo.prompt,
    /Reference images, in order: Kai in this outfit; Ines in this outfit; the place behind them\. Use the pictures of them only for their faces, hair, build and clothing, never for the pose\./u,
  );
  assert.match(solo.prompt, /Kai: tall, dark hair, grey eyes; navy greatcoat, brass buttons\./u);
  assert.match(solo.prompt, /Ines: short dark hair, freckles; amber silk dress, lantern earrings\./u);
  assert.match(solo.prompt, /lighthouse interior, great lens/u);
  assert.doesNotMatch(solo.prompt, /no humans/u, "the place's empty-scene tag stays out of a photo of two people");
  assert.match(solo.prompt, /safe for work, fully clothed/u);
  assert.match(solo.negativePrompt, /nudity, nsfw, sexual content, lingerie/u);
  assert.match(solo.negativePrompt, /extra people/u);
  // How many people to draw and with how many limbs (the maintainer's anatomy report, 2026-11-03).
  assert.match(solo.prompt, /Draw exactly two people, each appearing once, with two arms, two legs and five fingers/u);

  const kiss = (await promptOf(t, setup({ his: pick("fond", "kiss"), her: pick("blush", "kiss") }))).body.prompt;
  assert.match(
    kiss,
    /A photo of Kai and Ines together, taken while they face each other\. Kai and Ines kiss, faces turned to each other, Kai's hands on Ines's waist, shown from the waist up\./u,
  );
  assert.doesNotMatch(kiss, /facing the camera|posing for the camera/u, "a kiss never also poses for the camera");
  // The setup starts both of them on Smile: a kiss with it, or a wink, never also looks at the camera.
  const shot = async (his: PhotoPick, her: PhotoPick) => (await promptOf(t, setup({ his, her }))).body.prompt as string;
  const smiles = await shot(pick("smile", "kiss"), pick("wink", "kiss"));
  assert.match(smiles, /Kai's expression: smiling brightly\. Ines's expression: winking\./u);
  assert.doesNotMatch(smiles, /at the camera|facing the camera/u);
  const forehead = await shot(pick("smile", "forehead"), pick("smile", "forehead"));
  assert.match(
    forehead,
    /taken while they face each other\. Kai and Ines rest their foreheads together, eyes on each/u,
  );
  assert.doesNotMatch(forehead, /at the camera|facing the camera/u);
  // Her cheek kiss on him: she acts, he faces the camera, and the photo opens with them facing each other.
  const cheek = await shot(pick("smile", "cheek-kissed"), pick("smile", "cheek-kiss"));
  assert.match(
    cheek,
    /A photo of Kai and Ines together, Ines turned toward Kai while Kai faces the camera\. Ines leans in and kisses Kai's cheek while Kai faces/u,
  );
  assert.doesNotMatch(cheek, /face each other/u, "only one of them turns");
  assert.doesNotMatch(cheek, /both facing the camera/u);
  const backHug = await shot(pick("smile", "back-hugged"), pick("smile", "back-hug"));
  assert.match(
    backHug,
    /both facing the camera and posing for it\. Ines stands behind Kai with both arms around Kai's waist, chin on Kai's shoulder, shown from the waist up\./u,
  );
  // A pose names no expression of its own: a pout in a hug or a play-fight stays a pout.
  for (const pose of ["hug", "play-fight"]) {
    const pout = await shot(pick("pout", pose), pick("pout", pose));
    assert.match(pout, /Kai's expression: a playful pout\. Ines's expression: a playful pout\./u, pose);
    assert.doesNotMatch(pout, /smiling|laughing/u, pose);
  }
  const carry = (
    await promptOf(t, setup({ his: pick("laugh", "piggyback-ride"), her: pick("laugh", "piggyback-carry") }))
  ).body.prompt;
  // Where every leg and hand goes: left to guess, the model kept the standing legs and added the wrapped ones.
  assert.match(
    carry,
    /Kai rides on Ines's back, Kai's legs wrapped around Ines's waist and arms around Ines's shoulders, while Ines holds Kai's thighs with both hands, shown from the knees up\./u,
  );
  const own = (
    await promptOf(
      t,
      setup({
        his: pick("custom", "custom", {
          expressionText: " “a lopsided   grin” ",
          poseText: '"peace" sign with both hands',
        }),
        her: pick("custom", "wave", { expressionText: 'holding a sign that says "hi"' }),
      }),
    )
  ).body.prompt;
  // As typed, only the spaces tidied: quotes at either end stay (a rule for model output, never for the player's).
  assert.match(own, /Kai's pose: "peace" sign with both hands\. Ines waves at the camera\./u);
  assert.match(own, /Kai's expression: “a lopsided grin”\. Ines's expression: holding a sign that says "hi"\./u);
  // Words the client lets through (it only trims) are words the server takes.
  const quotes = await promptOf(t, setup({ his: pick("custom", "peace", { expressionText: '""' }) }));
  assert.equal(quotes.status, 200, JSON.stringify(quotes.body));

  // Only the references that resolved are labelled.
  t.images.cardAvatarImage = async (path) =>
    path === PLACE_URL ? null : { mime: "image/png", base64: Buffer.from(path).toString("base64") };
  const noPlace = (await promptOf(t, setup())).body.prompt;
  assert.match(noPlace, /Reference images, in order: Kai in this outfit; Ines in this outfit\./u);
  // A tag profile gets the tags and no labels.
  t.images.styleProfile = async () => ({ styleText: "", positiveTags: "", negativeTags: "", tagged: true });
  const tagged = (await promptOf(t, setup())).body.prompt;
  assert.match(tagged, /peace sign, waving, smirk, bright smile/u);
  assert.doesNotMatch(tagged, /Reference images/u);
  // A shared pose is its own tags once, never either person's solo ones.
  const taggedKiss = (await promptOf(t, setup({ his: pick("smile", "kiss"), her: pick("blush", "kiss") }))).body.prompt;
  assert.match(taggedKiss, /kiss, facing each other, upper body, bright smile, blush, shy smile/u);
  assert.doesNotMatch(taggedKiss, /posing,|peace sign|waving|Kai and Ines/u);
  t.images.styleProfile = async () => ({ styleText: "", positiveTags: "", negativeTags: "" });

  // Explicit Heat at the Explicit rating: the photo stays clothed, at most Suggestive.
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    content: { ...world.content, heat: "explicit" },
    images: { ...world.images, rating: "explicit" },
  }));
  const explicit = (await promptOf(t, setup({ his: pick("smirk", "kiss"), her: pick("smile", "kiss") }))).body;
  assert.match(explicit.prompt, /\bclothed\b/u);
  assert.doesNotMatch(explicit.prompt, /explicit adult scene|safe for work/u);
  assert.match(explicit.negativePrompt, /nudity, explicit sexual activity/u);
  assert.match(explicit.negativePrompt, /child, childlike, minor/u);
  const minor = (await promptOf(t, setup({ his: pick("custom", "peace", { expressionText: "a teen idol grin" }) })))
    .body.prompt;
  assert.doesNotMatch(minor, /teen/u);
  assert.match(
    minor,
    /both facing the camera and posing for it\. Kai makes a peace sign\. Ines waves at the camera\. Ines's expression: smiling brightly\. Reference images, in order: Kai in this outfit/u,
    "every other pick stays",
  );
  const minorPose = (await promptOf(t, setup({ her: pick("smile", "custom", { poseText: "holds a kid's kite" }) })))
    .body.prompt;
  assert.doesNotMatch(minorPose, /kid/u);
  assert.match(minorPose, /Kai makes a peace sign\. Kai's expression: a confident smirk\. Ines's expression: smiling/u);

  // An edited prompt keeps its words and gets the required tags back.
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    content: { ...world.content, heat: "sfw" },
    images: { ...world.images, rating: "sfw" },
  }));
  const edited = await take(t, {
    id: newPhotoId(),
    ...setup(),
    prompt: "MY-OWN-WORDS two friends under the great lens",
    negativePrompt: "blurry",
  });
  assert.equal(edited.body.photo.art.state, "ready");
  const sent = t.paid.at(-1)!.request;
  assert.match(sent.prompt, /^MY-OWN-WORDS two friends under the great lens, /u);
  assert.match(sent.prompt, /safe for work, fully clothed, adult person$/u);
  assert.match(sent.negativePrompt, /^blurry, child, childlike, minor/u);

  for (const prompt of [
    solo,
    kiss,
    smiles,
    forehead,
    cheek,
    backHug,
    carry,
    own,
    noPlace,
    tagged,
    taggedKiss,
    explicit.prompt,
    explicit.negativePrompt,
    minor,
  ]) {
    const text = typeof prompt === "string" ? prompt : `${prompt.prompt} ${prompt.negativePrompt}`;
    assert.doesNotMatch(text, CENSORING);
  }
  assert.equal(t.calls.length, 0);
});

test("a long identity line makes a long prompt, and the paid photo is still kept, listed and paid for once", async () => {
  const t = await photoWorld("r-photo7-aaaaaa");
  const long = `tall, ${"grey-eyed and dark-haired, ".repeat(330)}weathered`;
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    identityLine: long,
  }));
  const id = newPhotoId();
  const taken = await take(t, { id, ...setup() });
  assert.equal(taken.status, 200, JSON.stringify(taken.body));
  assert.equal(taken.body.photo.art.state, "ready");
  assert.ok(t.paid[0]!.request.prompt.length > 8000, "a prompt longer than any cap");
  const record = (await t.stored(id))!;
  assert.equal(record.prompt?.prompt, t.paid[0]!.request.prompt, "kept as sent, and the record still reads");
  assert.deepEqual(t.deleted, [], "its image is kept");
  assert.equal((await take(t, { id, ...setup() })).body.photo.art.state, "ready");
  assert.equal(t.paid.length, 1, "a resend pays nothing");
  const album = (await t.call("GET", "/runs/:run/album")).body;
  assert.deepEqual(
    album.photos.map((photo: { key: string }) => photo.key),
    [`photo:${id}`],
  );
});

test("the Album keeps ready photos apart from CGs, Home tapes the newest with him, and delete takes the image", async () => {
  const t = await photoWorld("r-photo5-aaaaaa");
  const first = newPhotoId(Date.now() - 2000);
  const second = newPhotoId(Date.now() - 1000);
  assert.equal((await take(t, { id: first, ...setup() })).body.photo.art.state, "ready");
  await new Promise((resolve) => setTimeout(resolve, 5));
  const newer = await take(t, { id: second, ...setup({ hisLook: "base", herLook: "base" }) });
  assert.equal(newer.body.photo.art.state, "ready");
  // A failed one is never listed.
  t.images.generateImage = async () => {
    throw new Error("no");
  };
  assert.equal((await take(t, { id: newPhotoId(), ...setup() })).body.photo.art.state, "failed");
  assert.equal(t.calls.length, 0, "no model call before Home is read (Home queues line packs)");

  const album = (await t.call("GET", "/runs/:run/album")).body;
  assert.deepEqual(
    album.photos.map((photo: { key: string }) => photo.key),
    [`photo:${second}`, `photo:${first}`],
  );
  assert.deepEqual(
    album.photos.map((photo: { source: string; title: string; li: string }) => [photo.source, photo.title, photo.li]),
    [
      ["photo", "The Lamp Room", KAI],
      ["photo", "The Lamp Room", KAI],
    ],
  );
  assert.deepEqual(album.cgs, [], "photos are not CGs");

  let home = (await t.call("GET", "/runs/:run/home")).body;
  assert.equal(home.li, KAI);
  assert.equal(home.photo.url, newer.body.photo.art.url, "the newest photo with him");
  assert.equal(home.backdrop.kind, "place", "and Home's back layer is unchanged");
  await t.call("POST", "/runs/:run/home/set", { li: MIR });
  assert.equal((await t.call("GET", "/runs/:run/home")).body.photo, null, "none with another love interest");
  await t.call("POST", "/runs/:run/home/set", { li: KAI });

  const deletedBefore = t.deleted.length;
  const removed = await t.call("POST", "/runs/:run/photos/:id/delete", {}, { id: second });
  assert.deepEqual([removed.status, removed.body], [200, { deleted: true }]);
  assert.equal(await t.stored(second), null);
  assert.deepEqual(t.deleted.slice(deletedBefore), ["img2"], "its own image, and nothing else");
  home = (await t.call("GET", "/runs/:run/home")).body;
  assert.equal(home.photo.url, (await t.stored(first))!.art.url, "Home falls back to the one before");
  assert.equal((await t.call("POST", "/runs/:run/photos/:id/delete", {}, { id: second })).status, 404);
  assert.equal((await t.call("POST", "/runs/:run/photos/:id/delete", {}, { id: "nope" })).status, 404);
});

test("a photo cannot be deleted while it paints; deleting the run sweeps the photos and their images", async () => {
  let release = () => {};
  let holding = false;
  const t = await photoWorld("r-photo6-aaaaaa", {
    before: async () => {
      if (!holding) return;
      await new Promise<void>((resolve) => (release = resolve));
    },
  });
  const kept = newPhotoId();
  assert.equal((await take(t, { id: kept, ...setup() })).body.photo.art.state, "ready");
  holding = true;
  const id = newPhotoId();
  const painting = take(t, { id, ...setup() });
  await until(() => t.paid.length === 2, "the second paint started");
  const busy = await t.call("POST", "/runs/:run/photos/:id/delete", {}, { id });
  assert.deepEqual([busy.status, busy.body.code], [409, "busy"]);
  holding = false;
  release();
  assert.equal((await painting).body.photo.art.state, "ready");

  assert.ok((RUN_DOC_KINDS as readonly string[]).includes("photo"), "deleting a run sweeps its photos");
  const images = (await t.photos()).flatMap((record) => galleryRefIds(record.data));
  assert.equal(images.length, 2);
  const gone = await t.call("POST", "/runs/:run/delete", { confirmTitle: "The Lantern Court" });
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.deepEqual(await t.photos(), []);
  for (const image of images) assert.ok(t.deleted.includes(image), `${image} is deleted with the run`);
});

test("a shared pose is one pick for both of them: withPose mirrors it and a solo pick ends it; posesAgree checks it", () => {
  const start = { his: pick("smile", "pose"), her: pick("smile", "pose") };
  let picks = withPose(start, "his", "piggyback-carry");
  assert.deepEqual([picks.his.pose, picks.her.pose], ["piggyback-carry", "piggyback-ride"]);
  picks = withPose(picks, "her", "kiss");
  assert.deepEqual([picks.his.pose, picks.her.pose], ["kiss", "kiss"]);
  picks = withPose({ ...picks, his: { ...picks.his, poseText: "kept" } }, "her", "peace");
  assert.deepEqual([picks.his.pose, picks.her.pose], ["pose", "peace"], "a solo pose ends the shared one");
  assert.equal(picks.his.poseText, "kept", "typed words stay");
  picks = withPose(picks, "his", "custom");
  assert.deepEqual([picks.his.pose, picks.her.pose], ["custom", "peace"], "a solo pose on the other side stays");
  assert.deepEqual(withPose(start, "her", "wave").his, start.his);
  for (const pose of PHOTO_SHARED_POSES) {
    const both = withPose(start, "his", pose);
    assert.equal(PHOTO_POSE_PARTNER[PHOTO_POSE_PARTNER[pose]], pose, `${pose} pairs both ways`);
    assert.ok(posesAgree(both.his, both.her), pose);
    assert.ok(!posesAgree(both.his, start.her), `${pose} alone`);
    assert.ok(!posesAgree(start.his, both.her), `${pose} alone on her side`);
  }
  assert.ok(posesAgree(pick("smile", "custom"), pick("smile", "wave")));
  assert.ok(!posesAgree(pick("smile", "cheek-kiss"), pick("smile", "cheek-kiss")));
});
