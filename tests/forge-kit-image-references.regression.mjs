// The kit's image reference wrapper on a fake Engine client: what each painting sends as references, in which
// order, and what it logs when the Engine's four-reference limit leaves some out. No Engine or provider is called.
import assert from "node:assert/strict";
import { test } from "node:test";
import { forgeWrapImageReferenceClient } from "../sources/forge-kit/image-avatar-references.mjs";

const avatar = (id) => `/api/avatars/file/${id}.png`;
const gallery = (id) => `/api/global-gallery/file/${id}`;
const data = (id) => `data:image/png;base64,${Buffer.from(id).toString("base64")}`;

function engine({ cards = {}, personas = {}, removed = [], same = {} } = {}) {
  const calls = [],
    logs = [],
    reads = [];
  const logger = Object.fromEntries(
    ["debug", "info", "warn", "error"].map((level) => [level, (...args) => logs.push([level, ...args])]),
  );
  const client = {
    async characterCard(id) {
      if (removed.includes(id)) throw new Error("engine /api/characters/" + id + " -> 404");
      return cards[id] ? { avatarPath: cards[id] } : null;
    },
    async personaAvatar(id) {
      return personas[id] ?? "";
    },
    async cardAvatarImage(path) {
      reads.push(path);
      const id = path
        .split("/")
        .at(-1)
        .replace(/\.png$/u, "");
      return { mime: "image/png", base64: Buffer.from(same[id] ?? id).toString("base64") };
    },
  };
  for (const method of ["generateBannerArt", "generatePortrait", "generateOutfit"])
    client[method] = async (options) => (calls.push([method, options.referenceImages]), options.referenceImages);
  return { client: forgeWrapImageReferenceClient(client, logger), calls, logs, reads };
}

const wearing = (name, extra = {}) => ({
  kind: "character",
  name,
  wornOutfit: "winter",
  outfits: [
    { id: "summer", url: gallery(`${name}-summer`) },
    { id: "winter", url: gallery(`${name}-winter`) },
  ],
  ...extra,
});

test("a scene sends every subject's identity first, then the outfits they have on", async () => {
  const host = engine({ cards: { ann: avatar("ann") }, personas: { mari: avatar("mari") } });
  const references = await host.client.generateBannerArt({
    units: [
      wearing("ann", { cardId: "ann", portrait: gallery("ann-base") }),
      { kind: "character", name: "Mari", personaId: "mari", avatarPath: avatar("old-mari") },
      wearing("bo", { portrait: gallery("bo-base") }),
    ],
  });
  assert.deepEqual(references, [data("ann"), data("mari"), data("bo-base"), data("ann-winter")]);
  assert.ok(!host.reads.some((path) => path.includes("summer")), "an outfit not worn is never read");
  assert.ok(!host.reads.includes(gallery("ann-base")), "a card's avatar wins over its saved portrait");
});

test("identical bytes are sent once, and an outfit nobody wears or a wornOutfit without an id match adds nothing", async () => {
  const host = engine({ cards: { ann: avatar("ann") }, same: { "ann-winter": "ann", "bo-winter": "bo-base" } });
  const references = await host.client.generateBannerArt({
    units: [
      wearing("ann", { cardId: "ann" }),
      { kind: "character", name: "Ann again", cardId: "ann" },
      wearing("bo", { portrait: gallery("bo-base") }),
      { kind: "character", name: "Cy", portrait: gallery("cy"), outfits: [{ url: gallery("cy-idless") }] },
      wearing("dee", { portrait: gallery("dee"), wornOutfit: "gone" }),
    ],
  });
  assert.deepEqual(references, [data("ann"), data("bo-base"), data("cy"), data("dee")]);
  assert.ok(!host.reads.includes(gallery("cy-idless")), "an outfit without an id is never the one worn");
});

test("past four references the outfits go first, every face is kept, and the drop is logged", async () => {
  const host = engine();
  const references = await host.client.generateBannerArt({
    units: ["a", "b", "c"].map((name) => wearing(name, { portrait: gallery(name) })),
  });
  assert.deepEqual(references, [data("a"), data("b"), data("c"), data("a-winter")]);
  assert.deepEqual(host.logs.at(-1), [
    "warn",
    "[gacha-forge] %s: left out %d identity and %d worn outfit reference(s) past the Engine's limit of %d",
    "generateBannerArt",
    0,
    2,
    4,
  ]);
  const crowd = engine();
  assert.deepEqual(
    await crowd.client.generateBannerArt({
      units: ["a", "b", "c", "d", "e"].map((name) => wearing(name, { portrait: gallery(name) })),
    }),
    ["a", "b", "c", "d"].map(data),
  );
  assert.deepEqual(crowd.logs.at(-1).slice(3), [1, 5, 4]);
  const fits = engine();
  await fits.client.generateBannerArt({ units: [wearing("a", { portrait: gallery("a") })] });
  assert.deepEqual(fits.logs, [
    [
      "debug",
      "[gacha-forge] %s: identity references resolved for %d/%d subjects, %d worn outfit(s); sending %d distinct of at most %d (a provider may keep fewer)",
      "generateBannerArt",
      1,
      1,
      1,
      2,
      4,
    ],
  ]);
});

test("a new base look or a new outfit sends only who the subject is, never the outfit on now", async () => {
  const host = engine({ cards: { ann: avatar("ann") } });
  const ann = wearing("ann", { cardId: "ann", portrait: gallery("ann-base") });
  assert.deepEqual(await host.client.generatePortrait({ unit: ann }), [data("ann")]);
  assert.deepEqual(await host.client.generateOutfit({ unit: ann, outfit: { name: "Spring" } }), [data("ann")]);
  const bo = wearing("bo", { portrait: gallery("bo-base") });
  assert.deepEqual(await host.client.generatePortrait({ unit: bo }), [data("bo-base")]);
  assert.deepEqual(await host.client.generateOutfit({ unit: bo, outfit: { name: "Spring" } }), [data("bo-base")]);
  assert.ok(!host.reads.some((path) => path.includes("winter")));
  const bare = wearing("cy");
  assert.equal(await host.client.generateOutfit({ unit: bare, outfit: { name: "Spring" } }), undefined);
  assert.deepEqual(await host.client.generateBannerArt({ units: [bare] }), [data("cy-winter")]);
});

test("a removed card falls back to the same unit's saved portrait, and a scene still adds its outfit", async () => {
  const host = engine({ removed: ["gone"] });
  const ann = wearing("ann", { cardId: "gone", portrait: gallery("ann-base"), avatarPath: avatar("ann-old") });
  assert.deepEqual(await host.client.generatePortrait({ unit: ann }), [data("ann-base")]);
  assert.deepEqual(await host.client.generateBannerArt({ units: [ann] }), [data("ann-base"), data("ann-winter")]);
  const noPortrait = engine({ removed: ["gone"] });
  assert.deepEqual(await noPortrait.client.generatePortrait({ unit: { ...ann, portrait: "" } }), [data("ann-old")]);
  assert.ok(!host.reads.includes(avatar("ann-old")), "the first saved image that reads is the one sent");
});

test("weapons and unsafe outfit paths are never sent", async () => {
  const host = engine();
  assert.equal(
    await host.client.generateBannerArt({
      units: [
        { kind: "weapon", name: "Blade", portrait: gallery("blade") },
        wearing("ann", { outfits: [{ id: "winter", url: "https://attacker.invalid/coat.png" }] }),
      ],
    }),
    undefined,
  );
  assert.deepEqual(host.reads, []);
});
