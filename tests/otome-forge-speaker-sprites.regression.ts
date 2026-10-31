import assert from "node:assert/strict";
import test from "node:test";
import {
  findSpeakerSprite,
  fullBodySpeakerSprite,
  matchingSpeakerCards,
  speakerHasCutoutAlpha,
  speakerNameKey,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/speaker-sprites.ts";

const sprites = [
  { expression: "full_angry", filename: "full_angry.png", url: "https://untrusted.test/ignored" },
  {
    expression: "full_neutral",
    filename: "full_neutral.png",
    url: "/api/sprites/card-a/file/full_neutral.png?v=12345",
  },
];

test("speaker sprites use exact full names and safe local full-body rasters, neutral first", () => {
  assert.equal(speakerNameKey("  ARIN\tVale  "), "arin\tvale");
  assert.deepEqual(
    matchingSpeakerCards(
      [
        { id: "card-spaces", name: "Arin  Vale" },
        { id: "card-width", name: "Ａｒｉｎ Vale" },
      ],
      "Arin Vale",
    ),
    [],
    "literal host search cannot establish identity through internal-space or fullwidth aliases",
  );
  assert.equal(fullBodySpeakerSprite("card-a", sprites), "/api/sprites/card-a/file/full_neutral.png?v=12345");
  assert.equal(fullBodySpeakerSprite("card-a", sprites.slice(0, 1)), "/api/sprites/card-a/file/full_angry.png");
  for (const filename of [
    "../full_neutral.png",
    "other.png",
    "full_neutral.svg",
    "full_neutral.png?evil=1",
    "full_neutral.png/evil",
  ]) {
    assert.equal(fullBodySpeakerSprite("card-a", [{ expression: "full_neutral", filename }]), null, filename);
  }
  assert.equal(fullBodySpeakerSprite("../card-a", sprites), null);
  assert.equal(fullBodySpeakerSprite("card-a", [{ expression: "neutral", filename: "neutral.png" }]), null);
});

test("speaker lookup pages exact matches, ignores partial names and revalidates the live card", async () => {
  const calls: string[] = [];
  const read = async (path: string) => {
    calls.push(path);
    if (path.includes("catalog"))
      return {
        items: [
          { id: "card-anna", name: "Anna Vale" },
          { id: "card-a", name: "Arin Vale" },
        ],
        hasMore: false,
      };
    if (path === "/sprites/card-a") return sprites;
    if (path === "/characters/card-a") return { id: "card-a", data: JSON.stringify({ name: "Arin Vale" }) };
    throw new Error(`Unexpected read ${path}`);
  };
  assert.equal(await findSpeakerSprite("Arin Vale", read), "/api/sprites/card-a/file/full_neutral.png?v=12345");
  assert.equal(new URL(calls[0]!, "http://local").searchParams.has("search"), false);
  assert.equal(new URL(calls[0]!, "http://local").searchParams.get("limit"), "200");
  assert.ok(!calls.some((path) => path.startsWith("http")));
  assert.equal(await findSpeakerSprite("Arin", read), null, "a first name cannot borrow a card");
  assert.equal(
    await findSpeakerSprite("Arin Vale", async (path) =>
      path === "/characters/card-a" ? { id: "card-a", data: JSON.stringify({ name: "Someone Else" }) } : read(path),
    ),
    null,
  );
  await assert.rejects(
    findSpeakerSprite("Arin Vale", async (path) => {
      if (path === "/characters/card-a") throw new Error("404 deleted card");
      return read(path);
    }),
    /deleted card/,
  );
});

test("speaker revalidation reads verified raw card data and refuses spoofed, malformed or foreign rows", async () => {
  const lookup = (row: unknown) =>
    findSpeakerSprite("Arin Vale", async (path) => {
      if (path.includes("catalog")) return { items: [{ id: "card-a", name: "Arin Vale" }], hasMore: false };
      if (path === "/sprites/card-a") return sprites;
      if (path === "/characters/card-a") return row;
      throw new Error(`Unexpected read ${path}`);
    });
  for (const data of [
    { name: "Arin Vale" },
    { spec: "chara_card_v2", spec_version: "2.0", data: { name: "Arin Vale" } },
    { spec: "chara_card_v3", spec_version: "3.0", data: { name: "Arin Vale" } },
  ]) {
    assert.equal(
      await lookup({ id: "card-a", data: JSON.stringify(data) }),
      "/api/sprites/card-a/file/full_neutral.png?v=12345",
    );
  }
  for (const row of [
    { id: "card-a", name: "Arin Vale" },
    { id: "card-a", name: "Arin Vale", data: JSON.stringify({ name: "Someone Else" }) },
    { id: "card-a", data: "{" },
    { id: "card-a", data: "[]" },
    { id: "card-b", data: JSON.stringify({ name: "Arin Vale" }) },
    { id: "card-a", data: JSON.stringify({ spec: "chara_card_v2", name: "Arin Vale", data: null }) },
  ])
    assert.equal(await lookup(row), null);
});

test("speaker lookup cannot hide a case-equivalent duplicate behind the host's Turkish search", async () => {
  const cards = [
    { id: "card-upper", name: "ARIN VALE" },
    { id: "card-title", name: "Arin Vale" },
  ];
  const selected = await findSpeakerSprite("Arin Vale", async (path) => {
    if (path.includes("catalog")) {
      const search = new URL(path, "http://local").searchParams.get("search");
      return {
        items: search
          ? cards.filter((card) => card.name.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")))
          : cards,
        hasMore: false,
        catalogGeneration: 1,
      };
    }
    if (path === "/sprites/card-title") return sprites;
    if (path === "/characters/card-title") return { id: "card-title", data: JSON.stringify({ name: "Arin Vale" }) };
    throw new Error(`Unexpected read ${path}`);
  });
  assert.equal(selected, null, "both case-equivalent cards must be seen before uniqueness can be trusted");
});

test("duplicate, malformed and truncated character lists never select an arbitrary sprite", async () => {
  const read = async (path: string) => {
    assert.match(path, /catalog/);
    const offset = new URL(path, "http://local").searchParams.get("offset");
    return offset === "0"
      ? { items: [{ id: "card-a", name: "Arin Vale" }], hasMore: true }
      : { items: [{ id: "card-b", name: "ARIN VALE" }], hasMore: false };
  };
  assert.equal(await findSpeakerSprite("Arin Vale", read), null, "duplicates on another page remain ambiguous");
  assert.equal(
    await findSpeakerSprite("Arin Vale", async (path) => {
      assert.match(path, /catalog/);
      return new URL(path, "http://local").searchParams.get("offset") === "0"
        ? { items: [{ id: "card-a", name: "Arin Vale" }], hasMore: true, catalogGeneration: 1 }
        : { items: [], hasMore: false, catalogGeneration: 2 };
    }),
    null,
    "an edited catalog cannot establish uniqueness across different page snapshots",
  );
  assert.equal(
    await findSpeakerSprite("Arin Vale", async () => ({
      items: [{ id: "card-a", name: "Arin Vale" }, { name: "Arin Vale" }],
    })),
    null,
    "a malformed duplicate cannot make another card unique",
  );
  assert.equal(
    await findSpeakerSprite("Arin Vale", async () => ({
      items: [{ id: "card-a", name: "Arin Vale" }],
      hasMore: "false",
    })),
    null,
  );
  assert.equal(await findSpeakerSprite("Arin Vale", async () => ({ items: [], hasMore: true })), null);
  assert.equal(
    await findSpeakerSprite("Arin Vale", async (path) => {
      assert.match(path, /catalog/);
      return [{ id: "card-a", name: "Arin Vale" }, ...Array.from({ length: 2000 }, () => ({ name: "Another person" }))];
    }),
    null,
    "an oversized legacy catalog also fails closed at the same row ceiling",
  );
  let pages = 0;
  assert.equal(
    await findSpeakerSprite("Arin Vale", async () => {
      pages += 1;
      return {
        items: Array.from({ length: 200 }, (_, i) => ({ id: `card-${i}`, name: "Another person" })),
        hasMore: true,
      };
    }),
    null,
  );
  assert.equal(pages, 10, "the existing catalog ceiling fails closed instead of trusting a partial library");
});

function alphaRaster(width: number, height: number, body: (x: number, y: number) => boolean): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) pixels[(y * width + x) * 4 + 3] = body(x, y) ? 255 : 0;
  return pixels;
}

test("speaker alpha accepts full-body silhouettes and tightly cropped busts touching every canvas edge", () => {
  // Head, torso, arms and separate legs: 350 transparent pixels inside the 21×48 subject bounds (34.7%).
  const fullBody = alphaRaster(
    32,
    48,
    (x, y) =>
      ((x - 16) / 6) ** 2 + ((y - 7) / 7) ** 2 <= 1 ||
      (x >= 11 && x <= 21 && y >= 13 && y <= 32) ||
      (x >= 6 && x <= 10 && y >= 17 && y <= 33) ||
      (x >= 22 && x <= 26 && y >= 17 && y <= 33) ||
      (x >= 11 && x <= 14 && y >= 32 && y <= 43) ||
      (x >= 18 && x <= 21 && y >= 32 && y <= 43) ||
      (x >= 9 && x <= 14 && y >= 43) ||
      (x >= 18 && x <= 24 && y >= 43),
  );
  // A head above shoulders filling the lower edge: no outer margin, 531/1,024 transparent pixels (51.9%).
  const bust = alphaRaster(
    32,
    32,
    (x, y) =>
      ((x - 16) / 8) ** 2 + ((y - 9) / 9) ** 2 <= 1 ||
      (x >= 12 && x <= 20 && y >= 17 && y <= 22) ||
      (y >= 21 && x >= 31 - y && x <= y),
  );
  assert.equal(speakerHasCutoutAlpha(fullBody, 32, 48), true);
  assert.equal(speakerHasCutoutAlpha(bust, 32, 32), true);
  for (const alpha of [64, 127]) {
    const translucent = fullBody.slice();
    for (let index = 3; index < translucent.length; index += 4) if (translucent[index] > 0) translucent[index] = alpha;
    assert.equal(speakerHasCutoutAlpha(translucent, 32, 48), true, `alpha${alpha} preserves a real cutout`);
  }
  // A much tighter head/shoulders crop touches every edge and retains only 60/1,024 background pixels (5.86%).
  const tightBust = alphaRaster(32, 32, (x, y) => {
    const inset = y < 12 ? Math.ceil((12 - y) / 3) : 0;
    return x >= inset && x < 32 - inset;
  });
  assert.equal(speakerHasCutoutAlpha(tightBust, 32, 32), true, "a tight crop needs the modest share floor");
  const softEdges = fullBody.slice();
  softEdges[3] = 1;
  assert.equal(speakerHasCutoutAlpha(softEdges, 32, 48), true, "faint outer pixels preserve a real silhouette");
  assert.equal(softEdges[3], 1, "classification never rewrites the supplied pixels");
});

test("speaker alpha refuses opaque artwork with a transparent corner or outer margins, and empty images", () => {
  const opaque = alphaRaster(32, 48, () => true);
  const corner = opaque.slice();
  corner[3] = 0;
  // 960 transparent margin pixels surround a fully opaque 18×32 rectangle; none are inside its bounds.
  const margin = alphaRaster(32, 48, (x, y) => x >= 7 && x <= 24 && y >= 8 && y <= 39);
  assert.equal(speakerHasCutoutAlpha(opaque, 32, 48), false);
  assert.equal(speakerHasCutoutAlpha(corner, 32, 48), false, "one transparent corner does not make a cut-out");
  assert.equal(speakerHasCutoutAlpha(margin, 32, 48), false, "transparent outer margins do not clean opaque art");
  const faintPadding = margin.slice();
  faintPadding[3] = 1;
  assert.equal(speakerHasCutoutAlpha(faintPadding, 32, 48), false, "faint padding noise cannot expand subject bounds");
  assert.equal(
    speakerHasCutoutAlpha(
      alphaRaster(32, 48, () => false),
      32,
      48,
    ),
    false,
  );
  assert.equal(speakerHasCutoutAlpha(new Uint8ClampedArray(), 0, 0), false);
});
