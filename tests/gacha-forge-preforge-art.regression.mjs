// Pre-forge "Story and images" paints each written beat's new places and key image on an art chain beside
// the text. This drives the shipped server's real routes, chain, dedupe and cancellation; only the host
// boundary is faked: deterministic model replies, isolated documents and a stub Engine image endpoint.
import assert from "node:assert/strict";

const serverUrl = new URL("../packages/gacha-forge/server.mjs", import.meta.url);
const packageId = "gacha-forge";
const runId = "preforge-art";
const sessionId = `${runId}:session`;
const clone = (value) => structuredClone(value);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const node = (index) => ({
  index: index + 1,
  type: "story",
  title: `Scene ${index + 1}`,
  goal: "Continue",
  guide: "Meet the next scene.",
});
const plan = (chapter = 1, count = 3) => ({
  chapter,
  title: `Chapter ${chapter}`,
  premise: "Two roads meet again.",
  nodes: Array.from({ length: count }, (_, index) => node(index)),
});
const beat = (text, places) => ({
  places: places.map((name) => ({ name, tags: name.toLowerCase() })),
  segments: [
    { speaker: "", text: `${text} begins.` },
    ...places.map((name) => ({ speaker: "", text: `${text} reaches ${name}.`, place: name })),
  ],
});
const slug = (name) => name.toLowerCase().replace(/\s+/gu, "-");
const fighter = (name) => ({
  name,
  tier: "soldier",
  role: "Warrior",
  affinity: "Fire",
  position: "front",
  look: `${name.toLowerCase()} in a patched coat`,
  stats: { hp: 30, atk: 30, def: 30, spd: 30 },
  skill: { name: "Strike", effect: "damage", power: 100, target: "enemy", description: "A clean hit." },
});
const guide = (name) => ({
  enemy: name,
  tier: "soldier",
  opening: `${name} attacks.`,
  objective: `Defeat ${name}.`,
  outcomeOnWin: `${name} flees.`,
  formation: [fighter(name)],
});
// A chapter plan read from a layout such as "SCCS": S is a scene, C a fight.
const layout = (nodes) => {
  let scenes = 0;
  return {
    ...plan(1, 0),
    nodes: [...nodes].map((kind, index) =>
      kind === "S"
        ? { ...node(scenes++), index: index + 1 }
        : {
            index: index + 1,
            type: "combat",
            title: `Fight ${index + 1}`,
            setup: "Foes block the road.",
            tier: "soldier",
          },
    ),
  };
};

// The Engine's image endpoints, shared by every harness. A paint can be held, and a named paint can fail.
const engine = { paints: [], uploads: [], held: null, failing: new Set(), noImages: false };
const holdNextPaint = () => {
  let release;
  const promise = new Promise((resolve) => (release = resolve));
  engine.held = { promise, entered: false };
  return { release, entered: () => engine.held?.entered === true || engine.paints.length > 0 };
};
const fetchBefore = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const path = new URL(input).pathname;
  if (path === "/api/connections")
    return Response.json([
      { id: "fixture-model", provider: "fixture", model: "fixture-only", maxContext: 128000 },
      ...(engine.noImages ? [] : [{ id: "fixture-images", provider: "image_generation", model: "fixture-only" }]),
    ]);
  if (path === "/api/app-settings/ui") return Response.json({});
  if (path === "/api/characters/avatar-generation") {
    const body = JSON.parse(init.body);
    engine.paints.push(body.name);
    const held = engine.held;
    if (held) {
      engine.held = null;
      held.entered = true;
      await held.promise;
    }
    if (engine.failing.has(body.name) || engine.failing.has("*")) return new Response("boom", { status: 500 });
    const image = `data:image/png;base64,${Buffer.from(body.name).toString("base64")}`;
    return Response.json({ image, prompt: body.promptOverrides?.[0]?.prompt || "prompt" });
  }
  if (path === "/api/global-gallery/upload") {
    engine.uploads.push(engine.uploads.length);
    const id = `gallery-${engine.uploads.length}`;
    return Response.json({ id, url: `/api/global-gallery/file/${id}` });
  }
  throw new Error(`Unexpected Engine request: ${path}`);
};

let sequence = 0;
async function harness({ story = { preforge: "art" }, images, chapters = [plan()], progress = {} } = {}) {
  engine.paints.length = 0;
  engine.uploads.length = 0;
  engine.held = null;
  engine.failing.clear();
  engine.noImages = false;
  const docs = new Map();
  const modelCalls = [];
  const responses = [];
  const warnings = [];
  let pause = null;
  let onRead = null;
  const seed = (id, kind, data) =>
    docs.set(id, {
      id,
      kind,
      packageId,
      name: id,
      description: "fixture",
      revision: (docs.get(id)?.revision ?? 0) + 1,
      data: clone(data),
    });
  const run = {
    runId,
    name: "Pre-forge art",
    scenario: "A fictional harbor town.",
    connectionId: "fixture-model",
    protagonist: { name: "Mari" },
    images: images ?? { connectionId: "fixture-images", backgrounds: true },
    story,
  };
  seed("index", "index", { runs: [run], activeRunId: runId });
  seed(sessionId, "session", { progress });
  seed(`${runId}:combat-art`, "combat-art", { effigies: { byKey: {}, hasArt: false } });
  for (const chapter of chapters) seed(`${runId}:chapter:${chapter.chapter}`, "chapter-plan", chapter);
  const documents = {
    async getById(_id, documentId) {
      if (onRead) await onRead(documentId);
      return clone(docs.get(documentId) ?? null);
    },
    async list(_id, kind) {
      return clone([...docs.values()].filter((doc) => !kind || doc.kind === kind));
    },
    async create(document) {
      if (docs.has(document.id)) throw new Error(`Document already exists: ${document.id}`);
      const stored = { ...clone(document), revision: 1 };
      docs.set(document.id, stored);
      return clone(stored);
    },
    async update(document) {
      const current = docs.get(document.id);
      if (!current || current.revision !== document.expectedRevision) return null;
      const stored = { ...current, ...clone(document), revision: current.revision + 1 };
      delete stored.expectedRevision;
      docs.set(document.id, stored);
      return clone(stored);
    },
    async remove(_id, documentId) {
      return docs.delete(documentId);
    },
  };
  const routes = new Map();
  const { activate } = await import(`${serverUrl.href}?preforge-art=${sequence++}`);
  await activate({
    package: { id: packageId, version: "fixture" },
    api: {
      runtime: {
        persistence: { documents },
        logger: {
          info() {},
          warn: (...args) => warnings.push(args.map(String).join(" | ")),
          error() {},
          debug() {},
        },
        json: { parseJsonish: JSON.parse },
        languageModels: {
          async resolveForRequest({ connectionId }) {
            return {
              connectionId,
              model: "fixture-only",
              async chatComplete(messages) {
                modelCalls.push(messages);
                if (pause && pause.at === modelCalls.length) {
                  pause.entered = true;
                  await pause.promise;
                }
                assert.ok(responses.length, "every generation needs a fixture response");
                return { content: JSON.stringify(responses.shift()), finishReason: "stop" };
              },
            };
          },
        },
      },
      async registerPrivilegedRoutes(register) {
        await register({
          get: (path, handler) => routes.set(`GET ${path}`, handler),
          post: (path, handler) => routes.set(`POST ${path}`, handler),
        });
      },
    },
  });
  const post = (path, body = {}) => {
    const route = routes.get(`POST ${path}`);
    assert.ok(route, `the shipped server registers POST ${path}`);
    return route({ body: clone(body) });
  };
  return {
    docs,
    modelCalls,
    responses,
    warnings,
    seed,
    post,
    data: (id) => clone(docs.get(id)?.data),
    setRun(change) {
      const index = clone(docs.get("index").data);
      change(index.runs[0]);
      seed("index", "index", index);
    },
    keyImage(chapter, storyIndex, title) {
      seed(`${runId}:cg:${chapter}:${storyIndex}`, "cg", { chapter, storyIndex, from: 0, to: 1, title, url: "" });
    },
    pauseModelCall(at) {
      let release;
      const promise = new Promise((resolve) => (release = resolve));
      pause = { at, promise, entered: false };
      return { release, entered: () => pause.entered };
    },
    // Runs before every document read; lets a test land a request between a chain's reads.
    onRead(hook) {
      onRead = hook;
    },
    async status(chapter = 1) {
      return (await post("/preforge", { runId, chapter })).preforge;
    },
  };
}

async function waitFor(check, label) {
  for (let turn = 0; turn < 4000; turn += 1) {
    if (await check()) return;
    await tick();
  }
  assert.fail(`timed out waiting for ${label}; paints ${JSON.stringify(engine.paints)}`);
}
// Lets every queued chain step run; the harness has no timers, so a quiet stretch means it is idle.
async function settle(host) {
  let last = "";
  for (let quiet = 0, turn = 0; quiet < 200 && turn < 8000; turn += 1) {
    const now = JSON.stringify([engine.paints.length, engine.uploads.length, host.modelCalls.length]);
    quiet = now === last ? quiet + 1 : 0;
    last = now;
    await tick();
  }
}
// Holds the first read that matches until the test has landed its own request, which runs in the test's
// context like a separate HTTP request, not inside the paused request's scope.
function pauseRead(host, matches) {
  let reached, resume;
  const arrived = new Promise((resolve) => (reached = resolve)),
    resumed = new Promise((resolve) => (resume = resolve));
  let armed = true;
  host.onRead(async (id) => {
    if (!armed || !matches(id)) return;
    armed = false;
    reached();
    await resumed;
  });
  return { arrived, resume };
}
const artWarnings = (host) => host.warnings.filter((warning) => warning.includes("pre-forge art"));

let cases = 0;
async function test(name, run) {
  await run();
  cases += 1;
  process.stdout.write(`ok ${cases} - ${name}\n`);
}

try {
  await test("Story and images paints new places then the key image beside the text, each once", async () => {
    const host = await harness();
    host.keyImage(1, 0, "The Mill Key");
    host.responses.push(beat("First", ["Old Mill", "Harbor"]), beat("Second", ["Harbor"]), beat("Third", []));
    const held = holdNextPaint();
    assert.equal((await host.post("/preforge/start", { runId, chapter: 1 })).allowed, true);
    await waitFor(held.entered, "the first paint");
    // The text chain does not wait for art: every beat is written and the menu opens while a paint runs.
    await waitFor(async () => (await host.status()).running === false, "the text chain");
    const written = await host.status();
    assert.equal(written.done, 3);
    assert.equal(written.locked, false, "the chapter menu opens when the text is written");
    assert.equal(host.modelCalls.length, 3);
    assert.deepEqual(engine.paints, ["Old Mill"]);
    held.release();
    await settle(host);
    assert.deepEqual(engine.paints, ["Old Mill", "Harbor", "The Mill Key"], "reading order, places first");
    const places = host.data(`${runId}:locations`).places;
    assert.ok(places["old-mill"].url && places.harbor.url);
    assert.ok(host.data(`${runId}:cg:1:0`).url, "the key image is filed");
    const opened = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(opened.cached, true);
    assert.ok(opened.places.length === 2 && opened.places.every((place) => place.url), "the scene opens painted");
    assert.deepEqual(artWarnings(host), []);
  });

  await test("Character Story beats pre-forge their places too", async () => {
    const chapter = "bond-arden";
    const unitId = `${runId}:unit:arden`;
    const host = await harness({ progress: { 1: { normal: 10 } } });
    host.seed(unitId, "unit", {
      kind: "character",
      name: "Arden",
      identitySex: "male",
      rarity: 5,
      role: "Warrior",
      affinity: "Fire",
    });
    host.seed(`${runId}:chapter:${chapter}`, "chapter-plan", {
      ...plan(chapter, 2),
      bondUnitId: unitId,
      bondPart: 1,
      after: 1,
    });
    const session = host.data(sessionId);
    session.roster = { [unitId]: { bondFights: 100, bondCurve: 2 } };
    session.bondChapters = { [unitId]: { beats: 0, after: 1, opened: 1 } };
    host.seed(sessionId, "session", session);
    host.responses.push(beat("Bond", ["Lighthouse"]), beat("Bond again", ["Lighthouse", "Cove"]));
    assert.equal((await host.post("/preforge/start", { runId, chapter })).allowed, true);
    await settle(host);
    assert.equal((await host.status(chapter)).done, 2);
    assert.deepEqual(engine.paints, ["Lighthouse", "Cove"]);
    const opened = await host.post("/bond-chapter/beat", { runId, chapter, unitId, part: 1, storyIndex: 1 });
    assert.equal(opened.ok, true, JSON.stringify(opened));
    assert.ok(opened.places.every((place) => place.url));
  });

  for (const [label, options, expected] of [
    ["Story only", { story: { preforge: "story" } }, []],
    ["Backgrounds off", { images: { connectionId: "fixture-images", backgrounds: false } }, ["The Mill Key"]],
    ["no image connection", { images: { connectionId: "" } }, []],
  ]) {
    await test(`${label} paints no places ahead and still writes every beat`, async () => {
      const host = await harness(options);
      host.keyImage(1, 0, "The Mill Key");
      host.responses.push(beat("First", ["Old Mill"]), beat("Second", ["Harbor"]), beat("Third", []));
      await host.post("/preforge/start", { runId, chapter: 1 });
      await settle(host);
      assert.equal((await host.status()).done, 3);
      assert.deepEqual(engine.paints, expected);
    });
  }

  await test("two failures in a row stop painting ahead; the scenes still paint on open", async () => {
    const host = await harness();
    engine.failing.add("*");
    host.responses.push(beat("First", ["Old Mill", "Harbor"]), beat("Second", ["Cave"]), beat("Third", ["Tower"]));
    await host.post("/preforge/start", { runId, chapter: 1 });
    await settle(host);
    assert.equal((await host.status()).done, 3, "every beat is still written");
    assert.deepEqual(engine.paints, ["Old Mill", "Harbor"]);
    assert.equal(artWarnings(host).length, 2);
    const later = await host.post("/beat", { runId, chapter: 1, storyIndex: 1 });
    assert.deepEqual(
      later.places.map((place) => place.url),
      [""],
    );
    engine.failing.clear();
    const painted = await host.post("/background", { runId, slug: "cave", name: "Cave" });
    assert.equal(painted.ok, true, "painting on open still works");
  });

  await test("one bad place is skipped and painting ahead continues", async () => {
    const host = await harness();
    engine.failing.add("Old Mill");
    host.responses.push(beat("First", ["Old Mill", "Harbor"]), beat("Second", ["Cave"]), beat("Third", []));
    await host.post("/preforge/start", { runId, chapter: 1 });
    await settle(host);
    assert.deepEqual(engine.paints, ["Old Mill", "Harbor", "Cave"]);
    assert.equal(artWarnings(host).length, 1);
  });

  await test("a missing image connection stops painting ahead at once", async () => {
    const host = await harness();
    engine.noImages = true;
    host.keyImage(1, 1, "The Cave Key");
    host.responses.push(beat("First", ["Old Mill", "Harbor"]), beat("Second", ["Cave"]), beat("Third", []));
    await host.post("/preforge/start", { runId, chapter: 1 });
    await settle(host);
    assert.equal((await host.status()).done, 3);
    assert.deepEqual(engine.paints, []);
    const failed = artWarnings(host);
    assert.equal(failed.length, 1);
    assert.match(failed[0], /no-image-connection/u);
  });

  for (const [label, optOut] of [
    ["pre-forge Cancel", (host) => host.post("/preforge/cancel", { runId, chapter: 1 })],
    ["switching to Story only", (host) => host.setRun((run) => (run.story = { preforge: "story" }))],
    ["switching to Off", (host) => host.setRun((run) => (run.story = { preforge: "off" }))],
    ["removing the image connection", (host) => host.setRun((run) => (run.images = { connectionId: "" }))],
  ]) {
    await test(`${label} stops before the next paid image`, async () => {
      const host = await harness();
      host.responses.push(beat("First", ["Old Mill", "Harbor"]), beat("Second", ["Cave"]), beat("Third", []));
      const held = holdNextPaint();
      await host.post("/preforge/start", { runId, chapter: 1 });
      await waitFor(held.entered, "the first paint");
      await optOut(host);
      held.release();
      await settle(host);
      assert.deepEqual(engine.paints, ["Old Mill"]);
      assert.ok(host.data(`${runId}:locations`).places["old-mill"].url, "the paint already running is kept");
    });
  }

  await test("turning Backgrounds off stops painting places ahead while key images keep painting", async () => {
    const host = await harness();
    host.keyImage(1, 0, "The Mill Key");
    host.keyImage(1, 1, "The Cave Key");
    host.responses.push(beat("First", ["Old Mill", "Harbor"]), beat("Second", ["Cave"]), beat("Third", []));
    const held = holdNextPaint();
    await host.post("/preforge/start", { runId, chapter: 1 });
    await waitFor(held.entered, "the first paint");
    host.setRun((run) => (run.images = { ...run.images, backgrounds: false }));
    held.release();
    await settle(host);
    assert.deepEqual(engine.paints, ["Old Mill", "The Mill Key", "The Cave Key"]);
    assert.deepEqual(artWarnings(host), []);
  });

  // The player keeps playing: a scene's own paint holds the image connection, and the pre-forge paint queues
  // behind it. A stop that lands during that wait must still cost nothing.
  for (const [label, stop] of [
    ["pre-forge Cancel", (host) => host.post("/preforge/cancel", { runId, chapter: 1 })],
    ["switching to Story only", (host) => host.setRun((run) => (run.story = { preforge: "story" }))],
    ["switching to Off", (host) => host.setRun((run) => (run.story = { preforge: "off" }))],
    ["turning Backgrounds off", (host) => host.setRun((run) => (run.images = { ...run.images, backgrounds: false }))],
    ["deleting the world", (host) => host.post("/run/delete", { runId })],
  ]) {
    await test(`${label} while a pre-forge paint waits for the image connection pays for nothing more`, async () => {
      const host = await harness();
      host.responses.push(beat("First", ["Old Mill"]), beat("Second", []), beat("Third", []));
      const held = holdNextPaint();
      const foreground = host.post("/background", { runId, slug: "market", name: "Market" });
      await waitFor(held.entered, "the scene's own paint");
      await host.post("/preforge/start", { runId, chapter: 1 });
      await waitFor(async () => (await host.status()).running === false, "the text chain");
      await settle(host); // the art chain has queued Old Mill behind Market
      await stop(host);
      held.release();
      await foreground;
      await settle(host);
      assert.deepEqual(engine.paints, ["Market"]);
      assert.equal(host.data(`${runId}:locations`)?.places?.["old-mill"], undefined);
      const failures = artWarnings(host).filter((warning) => warning.includes("art failed"));
      assert.deepEqual(failures, [], "a stop is not a failure");
      // Deleting the world is a hard stop and says so; the soft stops are silent.
      if (!label.startsWith("deleting")) assert.deepEqual(artWarnings(host), []);
    });
  }

  await test("deleting a world stops its art chain: the paint in flight is neither uploaded nor filed", async () => {
    const host = await harness();
    host.keyImage(1, 0, "The Mill Key");
    host.responses.push(beat("First", ["Old Mill", "Harbor"]), beat("Second", ["Cave"]), beat("Third", []));
    const held = holdNextPaint();
    await host.post("/preforge/start", { runId, chapter: 1 });
    await waitFor(held.entered, "the first paint");
    await waitFor(async () => (await host.status()).running === false, "the text chain");
    assert.equal((await host.post("/run/delete", { runId })).ok, true);
    held.release();
    await settle(host);
    assert.deepEqual(engine.paints, ["Old Mill"], "nothing more is painted");
    assert.deepEqual(engine.uploads, [], "the paint in flight is not uploaded");
    assert.equal(host.data(`${runId}:locations`), undefined, "the swept locations document is not recreated");
    assert.deepEqual(host.data("index").runs, []);
  });

  await test("a Cancel that lands while a scene's paint starts leaves that place paintable", async () => {
    const host = await harness();
    const read = pauseRead(host, (id) => id === `${runId}:locations`);
    const first = host.post("/background", { runId, slug: "harbor", name: "Harbor" });
    await read.arrived;
    await host.post("/story/cancel", { runId, chapter: 2 }); // Cancel from another chapter's loader
    read.resume();
    assert.equal((await first).error, "cancelled");
    await settle(host);
    const again = await host.post("/background", { runId, slug: "harbor", name: "Harbor" });
    assert.equal(again.ok, true, JSON.stringify(again));
    assert.deepEqual(engine.paints, ["Harbor"]);
  });

  await test("a Cancel elsewhere between two pre-forge paints stops the chain and leaves the next place paintable", async () => {
    const host = await harness();
    host.responses.push(beat("First", ["Old Mill", "Harbor"]), beat("Second", []), beat("Third", []));
    const held = holdNextPaint();
    await host.post("/preforge/start", { runId, chapter: 1 });
    await waitFor(held.entered, "the first paint");
    await waitFor(async () => (await host.status()).running === false, "the text chain");
    // The art chain reads the session for its setting after Old Mill is filed: the Cancel lands right then.
    const read = pauseRead(
      host,
      (id) => id === sessionId && !!host.data(`${runId}:locations`)?.places?.["old-mill"]?.url,
    );
    held.release();
    await read.arrived;
    await host.post("/story/cancel", { runId, chapter: 2 });
    read.resume();
    await settle(host);
    assert.deepEqual(engine.paints, ["Old Mill"]);
    const opened = await host.post("/background", { runId, slug: "harbor", name: "Harbor" });
    assert.equal(opened.ok, true, JSON.stringify(opened));
    assert.deepEqual(engine.paints, ["Old Mill", "Harbor"]);
  });

  await test("a hard Cancel discards the paint in flight, stops both chains, and Retry resumes the text", async () => {
    const host = await harness();
    host.keyImage(1, 0, "The Mill Key");
    host.responses.push(beat("First", ["Old Mill", "Harbor"]), beat("Second", ["Cave"]), beat("Third", []));
    const held = holdNextPaint();
    const model = host.pauseModelCall(2);
    await host.post("/preforge/start", { runId, chapter: 1 });
    await waitFor(() => held.entered() && model.entered(), "the first paint and the second beat");
    assert.deepEqual(await host.post("/story/cancel", { runId, chapter: 1 }), { ok: true });
    held.release();
    model.release();
    await settle(host);
    assert.deepEqual(engine.paints, ["Old Mill"], "no further image is requested");
    assert.deepEqual(engine.uploads, [], "the cancelled paint is not uploaded");
    assert.equal(host.data(`${runId}:locations`)?.places?.["old-mill"], undefined, "nor saved");
    assert.equal(host.modelCalls.length, 2, "the text chain stops too");
    const stopped = await host.status();
    assert.equal(stopped.done, 1);
    assert.equal(stopped.running, false);
    assert.ok(
      host.warnings.some((warning) => warning.includes("pre-forge art stopped")),
      JSON.stringify(host.warnings),
    );
    assert.ok(!host.warnings.some((warning) => warning.includes("pre-forge art failed")), "a Cancel is not a failure");
    host.responses.unshift(beat("Second", ["Cave"]));
    const retry = await host.post("/preforge/retry", { runId, chapter: 1 });
    assert.equal(retry.allowed, true);
    await settle(host);
    assert.equal((await host.status()).done, 3);
    assert.deepEqual(engine.paints, ["Old Mill", "Cave"], "the resumed chain paints the beats it writes");
  });

  await test("a scene opened during a pre-forge paint joins it instead of painting twice", async () => {
    const host = await harness();
    host.responses.push(beat("First", ["Old Mill"]), beat("Second", []), beat("Third", []));
    const held = holdNextPaint();
    await host.post("/preforge/start", { runId, chapter: 1 });
    await waitFor(held.entered, "the first paint");
    const opened = host.post("/background", { runId, slug: slug("Old Mill"), name: "Old Mill" });
    await tick();
    held.release();
    const painted = await opened;
    await settle(host);
    assert.equal(painted.ok, true, JSON.stringify(painted));
    assert.deepEqual(engine.paints, ["Old Mill"]);
    assert.equal(engine.uploads.length, 1);
    assert.equal(painted.url, host.data(`${runId}:locations`).places["old-mill"].url);
  });

  await test("a chain longer than the 20-minute dedupe ceiling still reports running and is not started twice", async () => {
    const realNow = Date.now;
    let offset = 0;
    Date.now = () => realNow() + offset;
    try {
      const host = await harness({ story: { preforge: "story" } });
      host.responses.push(beat("First", []), beat("Second", []), beat("Third", []));
      const second = host.pauseModelCall(2);
      await host.post("/preforge/start", { runId, chapter: 1 });
      await waitFor(second.entered, "the second beat");
      offset += 15 * 60_000;
      const third = host.pauseModelCall(3);
      second.release();
      await waitFor(third.entered, "the third beat");
      offset += 15 * 60_000;
      assert.equal((await host.status()).running, true, "30 minutes in, 15 since the last beat");
      await host.post("/preforge/retry", { runId, chapter: 1 });
      await settle(host);
      assert.equal(host.modelCalls.length, 3, "Retry joins the running chain");
      third.release();
      await settle(host);
      assert.equal((await host.status()).done, 3);
      assert.ok(!host.warnings.some((warning) => warning.includes("dedupe ceiling")), JSON.stringify(host.warnings));
    } finally {
      Date.now = realNow;
    }
  });
  await test("pre-forge designs each fight just before the scene that follows it, then the last fight", async () => {
    const withFights = {
      ...plan(1, 2),
      nodes: [
        node(0),
        { index: 2, type: "combat", title: "Mill ambush", setup: "Bandits wait at the mill.", tier: "soldier" },
        { ...node(1), index: 3 },
        { index: 4, type: "combat", title: "Harbor brawl", setup: "Dockhands block the pier.", tier: "soldier" },
      ],
    };
    const host = await harness({ story: { preforge: "story" }, images: { enabled: false }, chapters: [withFights] });
    host.responses.push(beat("First", []), guide("Bandit"), beat("Second", []), guide("Dockhand"));
    assert.equal((await host.post("/preforge/start", { runId, chapter: 1 })).allowed, true);
    await settle(host);
    assert.equal(host.responses.length, 0, "two scenes and two fights were written");
    assert.equal(host.data(`${runId}:combat:1:0`).enemy, "Bandit", "the first fight comes after the first scene");
    assert.equal(host.data(`${runId}:combat:1:1`).enemy, "Dockhand", "the last fight follows the last scene");
    assert.ok(host.data(`${runId}:beat:1:1`).segments.length);
    assert.ok(
      !host.warnings.some((warning) => warning.includes("pre-forge chain stopped")),
      JSON.stringify(host.warnings),
    );
    const before = host.modelCalls.length;
    assert.equal((await host.post("/combat-guide", { runId, chapter: 1, combatIndex: 0 })).cached, true);
    assert.equal(host.modelCalls.length, before, "opening a fight pre-forge designed costs no model call");
  });

  // Each fight design and the scene after them re-read the run and pre-forge state first.
  for (const [label, stop] of [
    ["pre-forge Cancel", (host) => host.post("/preforge/cancel", { runId, chapter: 1 })],
    ["switching to Off", (host) => host.setRun((run) => (run.story = { preforge: "off" }))],
  ]) {
    await test(`${label} between two fight designs stops before the next paid call`, async () => {
      const host = await harness({
        story: { preforge: "story" },
        images: { enabled: false },
        chapters: [layout("SCCS")],
      });
      host.responses.push(beat("First", []), guide("Bandit"), guide("Dockhand"), beat("Second", []));
      const design = host.pauseModelCall(2);
      await host.post("/preforge/start", { runId, chapter: 1 });
      await waitFor(design.entered, "the first fight design");
      await stop(host);
      design.release();
      await settle(host);
      assert.equal(host.modelCalls.length, 2, "neither the second fight nor the next scene is paid for");
      assert.equal(host.data(`${runId}:combat:1:0`).enemy, "Bandit", "the design already running is kept");
      assert.equal(host.data(`${runId}:combat:1:1`), undefined);
      assert.equal(host.data(`${runId}:beat:1:1`), undefined);
      assert.equal((await host.status()).running, false);
      // A stop is a plain return, not a failure.
      assert.ok(!host.warnings.some((warning) => warning.includes("pre-forge chain")), JSON.stringify(host.warnings));
    });
  }

  await test("a gap of several fights keeps the chain's heartbeat fresh past the 20-minute dedupe ceiling", async () => {
    const realNow = Date.now;
    let offset = 0;
    Date.now = () => realNow() + offset;
    try {
      const host = await harness({
        story: { preforge: "story" },
        images: { enabled: false },
        chapters: [layout("SCCCS")],
      });
      host.responses.push(beat("First", []), guide("Bandit"), guide("Dockhand"), guide("Smuggler"), beat("Second", []));
      let held = host.pauseModelCall(2);
      await host.post("/preforge/start", { runId, chapter: 1 });
      await waitFor(held.entered, "the first fight design");
      offset += 15 * 60_000;
      // Every design takes 15 minutes: only a heartbeat per fight keeps the chain inside the ceiling.
      for (const call of [3, 4]) {
        const next = host.pauseModelCall(call);
        held.release();
        await waitFor(next.entered, `fight design ${call - 1}`);
        held = next;
        offset += 15 * 60_000;
        assert.equal((await host.status()).running, true, `${(call - 1) * 15} minutes into one gap`);
        await host.post("/preforge/retry", { runId, chapter: 1 });
        await settle(host);
        assert.equal(host.modelCalls.length, call, "Retry joins the running chain");
      }
      held.release();
      await settle(host);
      assert.equal(host.modelCalls.length, 5);
      assert.equal((await host.status()).done, 2);
      assert.equal(host.data(`${runId}:combat:1:2`).enemy, "Smuggler");
      assert.ok(!host.warnings.some((warning) => warning.includes("dedupe ceiling")), JSON.stringify(host.warnings));
    } finally {
      Date.now = realNow;
    }
  });

  await test("a played scene designs the fights before the next scene in the background, even with pre-forge Off", async () => {
    const host = await harness({
      story: { preforge: "off" },
      images: { connectionId: "fixture-images", enemyArt: true },
      chapters: [layout("SCS")],
    });
    host.responses.push(beat("First", []), guide("Bandit"));
    const design = host.pauseModelCall(2);
    let answered = false;
    const opened = host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    opened.then(() => (answered = true));
    await waitFor(() => answered && design.entered(), "the scene's reply while its next fight is designed");
    assert.equal((await opened).ok, true);
    const ids = [...host.docs.keys()];
    const session = host.data(sessionId);
    design.release();
    await settle(host);
    assert.equal(host.data(`${runId}:combat:1:0`).enemy, "Bandit");
    assert.deepEqual(
      [...host.docs.keys()].filter((id) => !ids.includes(id)),
      [`${runId}:combat:1:0`],
      "only the fight is filed",
    );
    assert.deepEqual(host.data(sessionId), session, "designing ahead does not open the battle");
    assert.deepEqual(engine.paints, ["Bandit"], "the freshly designed enemy is painted");
    const before = host.modelCalls.length;
    assert.equal((await host.post("/combat-guide", { runId, chapter: 1, combatIndex: 0 })).cached, true);
    assert.equal(host.modelCalls.length, before, "opening the fight costs no model call");
    host.responses.push(beat("Second", []));
    assert.equal((await host.post("/beat", { runId, chapter: 1, storyIndex: 1 })).ok, true);
    await settle(host);
    assert.equal(host.modelCalls.length, before + 1, "the last scene has no new fight to design");
    assert.deepEqual(engine.paints, ["Bandit"]);
  });
} finally {
  globalThis.fetch = fetchBefore;
}
console.info(`${cases} Gacha Forge pre-forge art regression cases passed.`);
