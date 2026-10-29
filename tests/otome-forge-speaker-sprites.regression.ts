import assert from "node:assert/strict";
import test from "node:test";
import {
  findSpeakerSprite,
  fullBodySpeakerSprite,
  matchingSpeakerCards,
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
