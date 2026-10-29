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
    if (path === "/characters/card-a") return { id: "card-a", name: "Arin Vale" };
    throw new Error(`Unexpected read ${path}`);
  };
  assert.equal(await findSpeakerSprite("Arin Vale", read), "/api/sprites/card-a/file/full_neutral.png?v=12345");
  assert.match(calls[0]!, /search=Arin\+Vale/);
  assert.ok(!calls.some((path) => path.startsWith("http")));
  assert.equal(await findSpeakerSprite("Arin", read), null, "a first name cannot borrow a card");
  assert.equal(
    await findSpeakerSprite("Arin Vale", async (path) =>
      path === "/characters/card-a" ? { name: "Someone Else" } : read(path),
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
  let pages = 0;
  assert.equal(
    await findSpeakerSprite("Arin Vale", async () => {
      pages += 1;
      return {
        items: Array.from({ length: 100 }, (_, i) => ({ id: `card-${i}`, name: "Another person" })),
        hasMore: true,
      };
    }),
    null,
  );
  assert.equal(pages, 20, "the existing catalog ceiling fails closed instead of trusting a partial library");
});
