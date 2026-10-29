// Inspect the actual loopback generation requests: selected-card full_neutral, then the retained Otome base look,
// then existing avatar fallbacks. Metadata URLs and invalid sprite filenames never become fetch targets.
import assert from "node:assert/strict";
import test from "node:test";
import {
  createImageClient,
  type ImageSubject,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import { PNG } from "./fixtures/otome-forge-art.ts";

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
  const client = createImageClient({
    baseUrl: "http://127.0.0.1:9",
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
      assert.fail(`unexpected fetch ${path}`);
    }) as typeof globalThis.fetch,
  });
  return { client, reads, generations };
}

test("initial card looks, new outfits and scenes send the selected card's full-body neutral image", async () => {
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
  assert.deepEqual(
    t.generations.map((call) => call.referenceImages),
    [[neutral], [neutral], [neutral, data(outfit)]],
  );
  assert.ok(!t.reads.includes(portrait), "the existing card full-body neutral takes priority over the generated look");
  assert.ok(!t.reads.some((path) => path.includes("untrusted.invalid")), "sprite metadata URLs are never fetched");
  assert.ok(
    !t.reads.includes("/api/avatars/file/card.png"),
    "an avatar does not displace the available full-body image",
  );
});

test("missing or unreadable neutral art falls back to the saved full-body look, then the selected card avatar", async () => {
  for (const options of [
    { sprites: [] },
    { missing: ["/api/sprites/card-dottore/file/full_neutral.png"] },
    { spriteMime: "text/html" },
    { missing: ["/api/sprites/card-dottore"] },
  ]) {
    const t = engine(options);
    await t.client.generateOutfit({ ...request, unit: { kind: "character", cardId: "card-dottore", portrait } });
    assert.deepEqual(t.generations[0]!.referenceImages, [data(portrait)]);
  }
  const t = engine({ sprites: [], missing: [portrait] });
  await t.client.generateOutfit({ ...request, unit: { kind: "character", cardId: "card-dottore", portrait } });
  assert.deepEqual(t.generations[0]!.referenceImages, [data("/api/avatars/file/card.png")]);
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
  assert.deepEqual(t.generations[0]!.referenceImages, [data(portrait)]);
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
