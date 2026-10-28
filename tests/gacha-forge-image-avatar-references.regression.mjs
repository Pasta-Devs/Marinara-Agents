// Actual bundled image client and privileged routes; only Engine metadata/assets and
// generation responses are mocked. No image provider or model request is permitted.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { forgeLocalAvatarPath, forgeMatchImageActor } from "../sources/forge-kit/image-avatar-references.mjs";

const directory = await mkdtemp(join(tmpdir(), "marinara-forge-avatar-references-"));
const source = await readFile(
  process.env.GACHA_FORGE_SERVER ?? new URL("../packages/gacha-forge/server.mjs", import.meta.url),
  "utf8",
);
const modulePath = join(directory, "server.mjs");
await writeFile(modulePath, `${source}\nexport { Rg as imageClient };\n`);
const bundled = await import(pathToFileURL(modulePath).href);
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  await rm(directory, { recursive: true, force: true });
});
const clone = (value) => structuredClone(value);
const avatar = (id) => `/api/avatars/file/${id}.png`;
const gallery = (id) => `/api/global-gallery/file/${id}`;
const data = (id) => `data:image/png;base64,${Buffer.from(`actual avatar bytes: ${id}`).toString("base64")}`;
const unit = (name, extra = {}) => ({
  name,
  kind: "character",
  rarity: 5,
  appearance: "A person in a winter coat.",
  imageTags: ["winter coat"],
  identityTags: ["person"],
  identityLine: "A person.",
  identitySex: "1girl",
  outfitTags: [],
  backTags: [],
  ...extra,
});
function engine({ cards = {}, personas = {}, missing = [] } = {}) {
  const requests = [];
  const generations = [];
  const logger = { info() {}, warn() {}, error() {}, debug() {} };
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const path = url.pathname;
    assert.equal(url.hostname, "127.0.0.1", "Never fetch an external avatar or provider");
    requests.push({ path, method: init.method ?? "GET" });
    if (path === "/api/connections")
      return Response.json([{ id: "fixture-images", provider: "image_generation", model: "fixture-only" }]);
    if (path === "/api/app-settings/ui")
      return Response.json({
        imageStyleProfiles: {
          defaultProfileId: "fixture-style",
          profiles: [
            { id: "fixture-style", promptMode: "natural", subjectTags: { avatar: avatar("wrong-style-person") } },
          ],
        },
      });
    if (path === "/api/characters/avatar-generation") {
      const body = JSON.parse(init.body);
      generations.push(body);
      return Response.json({ image: data("generated"), prompt: body.promptOverrides[0].prompt });
    }
    if (path === "/api/global-gallery/upload") return Response.json({ id: "generated", url: gallery("generated") });
    const cardId = path.match(/^\/api\/characters\/([^/]+)$/u)?.[1];
    if (cardId)
      return cards[cardId]
        ? Response.json({
            id: cardId,
            data: JSON.stringify({ data: { name: cards[cardId].name } }),
            avatarPath: cards[cardId].avatarPath,
          })
        : Response.json({}, { status: 404 });
    const personaId = path.match(/^\/api\/characters\/personas\/([^/]+)$/u)?.[1];
    if (personaId)
      return personas[personaId]
        ? Response.json({ avatarPath: personas[personaId] })
        : Response.json({}, { status: 404 });
    if (missing.includes(path)) return Response.json({}, { status: 404 });
    assert.ok(forgeLocalAvatarPath(path), `Unrelated API request forbidden: ${path}`);
    const id = path
      .split("/")
      .at(-1)
      .replace(/\.png$/u, "");
    return new Response(Buffer.from(`actual avatar bytes: ${id}`), { headers: { "content-type": "image/png" } });
  };
  return {
    fetch,
    requests,
    generations,
    logger,
    client: bundled.imageClient({ baseUrl: "http://127.0.0.1:7849", fetch, logger }),
  };
}
const options = { connectionId: "fixture-images", name: "Selected cast", styleProfileId: "fixture-style" };

for (const method of ["generateBannerArt", "generatePortrait", "generateOutfit"]) {
  test(`${method} sends the selected character's current card avatar bytes, preserving prompt/settings`, async () => {
    const host = engine({
      cards: { ann: { name: "Ann", avatarPath: avatar("ann") }, anna: { name: "Anna", avatarPath: avatar("anna") } },
    });
    const subject = unit("Ann", { cardId: "ann", portrait: gallery("older-ann") });
    await host.client[method]({
      ...options,
      unit: subject,
      units: [subject],
      scene: "At the gate",
      outfit: { name: "Winter", prompt: "A winter coat." },
    });
    assert.equal(host.generations.length, 1);
    const body = host.generations[0];
    assert.deepEqual(body.referenceImages, [data("ann")]);
    assert.equal(body.connectionId, options.connectionId);
    assert.equal(body.styleProfileId, options.styleProfileId);
    assert.equal(body.purpose, "avatar");
    assert.ok(body.width > 0 && body.height > 0);
    assert.equal(body.promptOverrides.length, 1);
    assert.ok(body.appearance);
    assert.ok(
      !host.requests.some(
        ({ path }) => path.includes("anna") || path.includes("wrong-style-person") || path.includes("older-ann"),
      ),
    );
  });
}

test("scene character references preserve cast order, use the real persona, deduplicate bytes and keep the Engine's four", async () => {
  const host = engine({ personas: { mari: avatar("mari") } });
  await host.client.generateBannerArt({
    ...options,
    framing: "scene",
    scene: "At the gate",
    units: [
      unit("Mari", { personaId: "mari", avatarPath: avatar("old-mari") }),
      ...["b", "c", "d", "e"].map((id) => unit(id, { portrait: gallery(id) })),
      unit("b again", { portrait: gallery("b") }),
    ],
  });
  // The Engine's avatar-generation route keeps the first four, so the package sends no more than that.
  assert.deepEqual(host.generations[0].referenceImages, [data("mari"), data("b"), data("c"), data("d")]);
});

test("removed/unreadable card falls back to the same unit's base portrait, and only a scene adds the worn outfit", async () => {
  const host = engine({
    cards: { gone: { name: "Ann", avatarPath: avatar("missing") } },
    missing: [avatar("missing")],
  });
  const subject = unit("Ann", {
    cardId: "gone",
    portrait: gallery("base-ann"),
    wornOutfit: "winter",
    outfits: [
      { id: "winter", url: gallery("winter-ann") },
      { id: "other", url: gallery("other-ann") },
    ],
  });
  await host.client.generatePortrait({ ...options, unit: subject });
  assert.deepEqual(host.generations[0].referenceImages, [data("base-ann")]);
  await host.client.generateBannerArt({ ...options, framing: "scene", scene: "At the gate", units: [subject] });
  assert.deepEqual(host.generations[1].referenceImages, [data("base-ann"), data("winter-ann")]);
  assert.ok(!host.requests.some(({ path }) => path.includes("other-ann")));
});

test("unavailable identity references keep text generation compatible without an invented attachment", async () => {
  const host = engine();
  await host.client.generatePortrait({
    ...options,
    unit: unit("New unit", { cardId: "removed", portrait: "https://attacker.invalid/face.png" }),
  });
  assert.equal(host.generations[0].referenceImages, undefined);
  assert.ok(!host.requests.some(({ path }) => path.includes("wrong-style-person")));
});

test("pure backgrounds, anonymous scenes and weapon banners never borrow the style character's face", async () => {
  const host = engine();
  await host.client.generateScene({ ...options, place: { name: "Gate", tags: ["stone gate"] } });
  await host.client.generateBannerArt({ ...options, scene: "A stone gate", units: [] });
  await host.client.generateBannerArt({
    ...options,
    units: [{ kind: "weapon", name: "Blade", portrait: gallery("weapon") }],
  });
  assert.ok(host.generations.every((body) => body.referenceImages === undefined));
  assert.ok(!host.requests.some(({ path }) => path.startsWith("/api/avatars/") || path === gallery("weapon")));
});

test("reference paths admit actual avatar/gallery endpoints and reject unrelated APIs and traversal", () => {
  for (const path of [
    avatar("ann"),
    gallery("ann"),
    "/api/characters/ann/gallery/file/portrait.png",
    "/api/characters/personas/mari/gallery/file/portrait.png",
  ])
    assert.equal(forgeLocalAvatarPath(path), path);
  for (const path of [
    "https://example.com/a.png",
    "//example.com/a.png",
    "/api/connections",
    "/api/avatars/file/../secret",
    "/api/avatars/file/%2e%2e",
    "/api/avatars/file/%2fsecret",
    "/api/avatars/file/%252e%252e",
    "/api/avatars/file/a.png?token=x",
    "/api/avatars/file/a\\b",
    "/api/avatars/file/%00",
  ])
    assert.equal(forgeLocalAvatarPath(path), "", path);
});

test("cast matching is unique and canonical-exact, never a substring or ambiguous identity", () => {
  const ann = { data: { name: "Ann" } },
    anna = { data: { name: "Anna" } };
  assert.equal(forgeMatchImageActor([ann, anna], " ann "), ann);
  assert.equal(forgeMatchImageActor([anna], "Ann"), null);
  assert.equal(forgeMatchImageActor([ann, clone(ann)], "Ann"), null);
  const accented = { data: { name: "Małgosia é" } };
  assert.equal(forgeMatchImageActor([accented], "Małgosia e\u0301"), accented);
});

let sequence = 0;
async function routes({
  characters = [{ name: "Ann" }, { name: "Mari" }],
  cached = false,
  duplicate = false,
  battle = false,
  worn = false,
  outfitCanon = false,
  outfits = true,
  bond = false,
} = {}) {
  const host = engine({
    cards: { ann: { name: "Ann", avatarPath: avatar("ann") }, anna: { name: "Anna", avatarPath: avatar("anna") } },
    personas: { mari: avatar("mari") },
  });
  globalThis.fetch = host.fetch;
  const runId = "avatar-reference-regression",
    packageId = "gacha-forge";
  const docs = new Map(),
    handlers = new Map();
  const seed = (id, kind, value) => docs.set(id, { id, packageId, kind, name: id, revision: 1, data: clone(value) });
  const ann = unit("Ann", {
    unitId: `${runId}:unit:ann`,
    cardId: "ann",
    portrait: gallery("old-ann"),
    // Her default clothes differ from the outfit she can wear, so a prompt shows which one it paints.
    appearance: "A person in a red dress.",
    imageTags: ["red dress"],
    outfitTags: ["red dress"],
    outfitLine: "Wearing a red dress.",
    outfits: [
      {
        id: "winter",
        name: "Winter",
        prompt: "A winter coat.",
        tags: [],
        outfitTags: ["winter coat"],
        outfitLine: "Wearing a winter coat.",
        url: gallery("old-winter-ann"),
      },
    ],
    ...(worn ? { wornOutfit: "winter" } : {}),
  });
  seed("index", "index", {
    activeRunId: runId,
    runs: [
      {
        runId,
        name: "Reference fixture",
        scenario: "At a stone gate",
        connectionId: "fixture-model",
        protagonist: { name: "Mari", personaId: "mari", avatarPath: avatar("old-mari") },
        images: {
          off: false,
          connectionId: "fixture-images",
          styleProfileId: "fixture-style",
          enemyArt: true,
          battleBackgrounds: false,
          outfitCanon,
          outfits,
        },
      },
    ],
  });
  seed(`${runId}:session`, "session", {
    roster: bond ? { [ann.unitId]: { bondFights: 9999 } } : {},
    progress: {},
    wallet: {},
  });
  seed(ann.unitId, "unit", ann);
  seed(
    `${runId}:unit:anna`,
    "unit",
    unit("Anna", { cardId: "anna", appearance: "A person in a grey cloak.", imageTags: ["grey cloak"] }),
  );
  if (duplicate) seed(`${runId}:unit:ann-duplicate`, "unit", unit("Ann", { cardId: "anna" }));
  seed(`${runId}:cg:1:0`, "cg", {
    title: "At the gate",
    characters,
    prompt: "A stone gate, afternoon light",
    ...(cached ? { url: gallery("cached") } : {}),
  });
  seed(`${runId}:banner:standard`, "banner", {
    charIds: [ann.unitId, `${runId}:unit:anna`],
    title: "Selected cast",
    bannerArt: "At a stone gate",
    art: {},
  });
  if (battle) {
    const skill = { name: "Strike", effect: "damage", power: 100, target: "enemy", description: "A clean hit." };
    seed(`${runId}:unit:protagonist`, "unit", {
      ...unit("Mari"),
      isProtagonist: true,
      role: "Warrior",
      affinity: "Fire",
      position: "front",
      stats: { hp: 100, atk: 100, def: 100, spd: 100 },
      skill,
    });
    seed(`${runId}:unit:protagonist-weapon`, "unit", {
      unitId: `${runId}:unit:protagonist-weapon`,
      kind: "weapon",
      rarity: 5,
      name: "Blade",
      stats: {},
    });
    seed(`${runId}:session`, "session", {
      account: { level: 100 },
      roster: { [`${runId}:unit:protagonist`]: { level: 20, weapon: `${runId}:unit:protagonist-weapon` } },
      wallet: { funds: 1000, vigor: 1000 },
      progress: {},
    });
    seed(`${runId}:relics`, "relics", { items: {} });
    seed(`${runId}:combat-art`, "combat-art", { effigies: { byKey: {}, hasArt: true } });
    seed(`${runId}:chapter:1`, "chapter-plan", {
      chapter: 1,
      title: "At the gate",
      premise: "Get through",
      nodes: Array.from({ length: 10 }, (_, index) =>
        index === 0
          ? { index: 1, type: "combat", title: "Ann", setup: "Ann guards the gate" }
          : { index: index + 1, type: "story", title: "Continue", goal: "Continue", guide: "Continue" },
      ),
    });
    seed(`${runId}:combat:1:0`, "combat", {
      chapter: 1,
      combatIndex: 0,
      enemy: "Ann",
      opening: "Ann guards the gate",
      objective: "Win",
      outcomeOnWin: "The gate opens",
      formation: [
        {
          name: "Ann",
          role: "Warrior",
          affinity: "Fire",
          position: "front",
          stats: { hp: 30, atk: 30, def: 30, spd: 30 },
          skill,
          look: "A person in a winter coat",
          lookTags: ["winter coat"],
        },
      ],
    });
  }
  const documents = {
    async getById(id, documentId) {
      assert.equal(id, packageId);
      return clone(docs.get(documentId) ?? null);
    },
    async list(id, kind) {
      assert.equal(id, packageId);
      return clone([...docs.values()].filter((doc) => !kind || kind === doc.kind));
    },
    async create(document) {
      assert.ok(!docs.has(document.id));
      const saved = { ...clone(document), revision: 1 };
      docs.set(document.id, saved);
      return clone(saved);
    },
    async update(document) {
      const current = docs.get(document.id);
      if (current?.revision !== document.expectedRevision) return null;
      const saved = { ...current, ...clone(document), revision: current.revision + 1 };
      delete saved.expectedRevision;
      docs.set(document.id, saved);
      return clone(saved);
    },
    async remove() {
      throw new Error("No deletion expected");
    },
  };
  const server = await import(`${pathToFileURL(modulePath).href}?routes=${sequence++}`);
  await server.activate({
    package: { id: packageId, version: "fixture" },
    api: {
      runtime: {
        persistence: { documents },
        logger: host.logger,
        json: { parseJsonish: JSON.parse },
        languageModels: {
          async resolveForRequest() {
            throw new Error("No model calls expected");
          },
        },
      },
      async registerPrivilegedRoutes(register) {
        await register({
          get(path, handler) {
            handlers.set(`GET ${path}`, handler);
          },
          post(path, handler) {
            handlers.set(`POST ${path}`, handler);
          },
        });
      },
    },
  });
  return {
    ...host,
    data: (id) => clone(docs.get(id)?.data),
    async post(path, body = {}) {
      const handler = handlers.get(`POST ${path}`);
      assert.ok(handler, path);
      return handler({ body: { runId, ...body } });
    },
    runId,
  };
}

test("actual scene-CG route carries matched roster and actual persona avatars; cached art is unchanged", async () => {
  const host = await routes();
  const result = await host.post("/cg-art", { chapter: 1, storyIndex: 0 });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(host.generations[0].referenceImages, [data("ann"), data("mari")]);
  assert.equal(host.data(`${host.runId}:cg:1:0`).url, gallery("generated"));
  const second = await host.post("/cg-art", { chapter: 1, storyIndex: 0 });
  assert.equal(second.cached, true);
  assert.equal(host.generations.length, 1, "Cached artwork is not regenerated");
});

test("actual scene-CG route cannot borrow Anna for Ann or choose between duplicate Ann records", async () => {
  const host = await routes({ characters: [{ name: "An", look: "A faceless traveller in a coat" }], duplicate: true });
  assert.equal((await host.post("/cg-art", { chapter: 1, storyIndex: 0 })).ok, true);
  assert.equal(host.generations[0].referenceImages, undefined);
  assert.match(host.generations[0].appearance, /faceless traveller/u);
  const ambiguous = await routes({ characters: [{ name: "Ann", look: "A traveller" }], duplicate: true });
  assert.equal((await ambiguous.post("/cg-art", { chapter: 1, storyIndex: 0 })).ok, true);
  assert.equal(ambiguous.generations[0].referenceImages, undefined);
  assert.match(ambiguous.generations[0].appearance, /traveller/u);
});

test("actual portrait and outfit-redo routes attach the same selected card avatar", async () => {
  const host = await routes();
  const unitId = `${host.runId}:unit:ann`;
  const portrait = await host.post("/portrait", { unitId, force: true });
  assert.equal(portrait.ok, true, JSON.stringify(portrait));
  const outfit = await host.post("/outfit/redo", { unitId, outfitId: "winter" });
  assert.equal(outfit.ok, true, JSON.stringify(outfit));
  assert.equal(host.generations.length, 2);
  assert.ok(host.generations.every((body) => JSON.stringify(body.referenceImages) === JSON.stringify([data("ann")])));
});

test("existing scene-CG cache returns without avatar reads, provider calls or save edits", async () => {
  const host = await routes({ cached: true });
  const before = host.data(`${host.runId}:cg:1:0`);
  const result = await host.post("/cg-art", { chapter: 1, storyIndex: 0 });
  assert.equal(result.cached, true);
  assert.equal(result.url, gallery("cached"));
  assert.deepEqual(host.data(`${host.runId}:cg:1:0`), before);
  assert.equal(host.requests.length, 0);
});

test("actual standard banner route uses exactly the selected banner units' current card avatars", async () => {
  const host = await routes();
  const result = await host.post("/banner-art", { banner: "char-standard" });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(host.generations[0].referenceImages, [data("ann"), data("anna")]);
  // A unit with nothing on keeps its whole look on a banner.
  assert.match(host.generations[0].promptOverrides[0].prompt, /A person in a red dress\./u);
  assert.equal((await host.post("/banner-art", { banner: "char-standard" })).cached, true);
  assert.equal(host.generations.length, 1);
});

test("actual battle enemy-art path reuses only the uniquely matched world character's avatar", async () => {
  const host = await routes({ battle: true });
  const result = await host.post("/battle", { chapter: 1, combatIndex: 0 });
  assert.equal(result.ok, true, JSON.stringify(result));
  await new Promise(setImmediate); // Let the actual background art task drain its mocked I/O.
  assert.equal(host.generations.length, 1);
  assert.deepEqual(host.generations[0].referenceImages, [data("ann")]);
});

test("actual scene-CG route sends a carded unit's card avatar and the outfit it has on, faces first", async () => {
  const host = await routes({ worn: true, outfitCanon: true });
  const result = await host.post("/cg-art", { chapter: 1, storyIndex: 0 });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(host.generations[0].referenceImages, [data("ann"), data("mari"), data("old-winter-ann")]);
  assert.match(host.generations[0].appearance, /winter coat/u);
});

test("a scene that paints other clothes than the worn outfit never sends it", async () => {
  // "The story uses worn outfits" is off: the scene paints Ann's default clothes.
  const canonOff = await routes({ worn: true });
  assert.equal((await canonOff.post("/cg-art", { chapter: 1, storyIndex: 0 })).ok, true);
  assert.deepEqual(canonOff.generations[0].referenceImages, [data("ann"), data("mari")]);
  assert.match(canonOff.generations[0].appearance, /red dress/u);
  // The beat dressed her itself.
  const dressed = await routes({
    worn: true,
    outfitCanon: true,
    characters: [{ name: "Ann", wearing: "a red swimsuit" }, { name: "Mari" }],
  });
  assert.equal((await dressed.post("/cg-art", { chapter: 1, storyIndex: 0 })).ok, true);
  assert.deepEqual(dressed.generations[0].referenceImages, [data("ann"), data("mari")]);
  assert.match(dressed.generations[0].appearance, /red swimsuit/u);
  assert.ok(![...canonOff.requests, ...dressed.requests].some(({ path }) => path.includes("old-winter-ann")));
});

test("actual banner route adds the worn outfit after both faces; portrait and outfit redo keep the face alone", async () => {
  const host = await routes({ worn: true });
  const banner = await host.post("/banner-art", { banner: "char-standard" });
  assert.equal(banner.ok, true, JSON.stringify(banner));
  assert.deepEqual(host.generations[0].referenceImages, [data("ann"), data("anna"), data("old-winter-ann")]);
  const unitId = `${host.runId}:unit:ann`;
  assert.equal((await host.post("/portrait", { unitId, force: true })).ok, true);
  assert.equal((await host.post("/outfit/redo", { unitId, outfitId: "winter" })).ok, true);
  assert.deepEqual(
    host.generations.slice(1).map((body) => body.referenceImages),
    [[data("ann")], [data("ann")]],
  );
});

const prompt = (body) => body.promptOverrides[0].prompt;

test("actual banner and Bond routes paint the outfit a unit has on and send it after the faces", async () => {
  const host = await routes({ worn: true, bond: true });
  assert.equal((await host.post("/banner-art", { banner: "char-standard" })).ok, true);
  const unitId = `${host.runId}:unit:ann`;
  const bond = await host.post("/bond/repaint", { unitId });
  assert.equal(bond.ok, true, JSON.stringify(bond));
  assert.deepEqual(
    host.generations.map((body) => body.referenceImages),
    [
      [data("ann"), data("anna"), data("old-winter-ann")],
      [data("ann"), data("old-winter-ann")],
    ],
  );
  for (const body of host.generations) {
    assert.match(prompt(body), /winter coat/u);
    assert.doesNotMatch(prompt(body), /red dress/u);
  }
});

test("with Outfits off, banner and Bond art paint the default clothes and send the faces alone", async () => {
  const host = await routes({ worn: true, bond: true, outfits: false });
  assert.equal((await host.post("/banner-art", { banner: "char-standard" })).ok, true);
  assert.equal((await host.post("/bond/repaint", { unitId: `${host.runId}:unit:ann` })).ok, true);
  assert.deepEqual(
    host.generations.map((body) => body.referenceImages),
    [[data("ann"), data("anna")], [data("ann")]],
  );
  for (const body of host.generations) {
    assert.match(prompt(body), /red dress/u);
    assert.doesNotMatch(prompt(body), /winter coat/u);
  }
  assert.ok(!host.requests.some(({ path }) => path.includes("old-winter-ann")));
});
