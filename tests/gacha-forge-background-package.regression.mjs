// The real SDK route registration, session CAS adapter and published package bundle.
import assert from "node:assert/strict";
import { createChatRuntime, chatRunId as runId, chatUnitId as unitId } from "./fixtures/gacha-forge-chat-runtime.mjs";
const clone = structuredClone;
function transactions(fixture) {
  fixture.persistence.transaction = async (work) => {
    const before = clone([...fixture.docs]);
    try {
      return await work({ documents: fixture.persistence.documents });
    } catch (error) {
      fixture.docs.clear();
      for (const [key, row] of before) fixture.docs.set(key, row);
      throw error;
    }
  };
  return fixture;
}
let runtime = transactions(await createChatRuntime());
const seed = (id, kind, data) =>
  runtime.docs.set(id, { id, kind, packageId: "gacha-forge", revision: 1, name: id, data: clone(data) });
const body = (extra = {}) => ({ runId, unitId: "", timeZone: "Europe/Warsaw", ...extra });
const post = async (path, extra = {}) => {
  const result = await runtime.post(path, body(extra));
  assert.equal(result.status, 200, JSON.stringify({ path, result, errors: runtime.errors }));
  return result.body;
};
let passed = 0;
const test = async (name, work) => {
  await work();
  passed++;
  process.stdout.write(`PASS ${name}\n`);
};
try {
  const session = runtime.session();
  session.progress = { 1: { normal: 1 }, 2: { normal: 0 } };
  session.bondChapters = { [unitId]: { beats2: 0 } };
  const bond = `bond:${unitId}:2`;
  seed(`${runId}:chapter:1`, "chapter-plan", { nodes: [{ type: "story" }, { type: "story" }] });
  seed(`${runId}:chapter:2`, "chapter-plan", { nodes: [{ type: "story" }] });
  seed(`${runId}:chapter:${bond}`, "chapter-plan", { bondUnitId: unitId, bondPart: 2, nodes: [{ type: "story" }] });
  seed(`${runId}:locations`, "locations", {
    places: {
      harbor: { name: "Harbor", url: "/gallery/harbor.png", ref: "global-gallery:harbor_authoritative_id" },
      garden: { name: "Garden", url: "/gallery/garden.png" },
      future: { name: "Future", url: "/gallery/future.png" },
      secret: { name: "Character secret", url: "/gallery/secret.png" },
    },
  });
  seed(`${runId}:beat:1:0`, "beat", { segments: [{ text: "Known harbor.", place: "Harbor" }] });
  seed(`${runId}:beat:1:1`, "beat", { segments: [{ text: "Garden.", place: "Garden" }] });
  seed(`${runId}:beat:2:0`, "beat", { segments: [{ text: "Future.", place: "Future" }] });
  seed(`${runId}:beat:${bond}:0`, "beat", {
    segments: [
      { text: "Character secret.", place: "Character secret" },
      { text: "A key image.", place: "Character secret" },
    ],
  });
  seed(`${runId}:cg:${bond}:0`, "cg", {
    from: 1,
    to: 1,
    title: "Hidden Character Story CG",
    ref: "global-gallery:cg_authoritative_id",
    url: "/gallery/secret-cg.png",
  });
  let chosen;
  await test("Actual /home-options migrates played scenes but hides future story, Character Story and CG", async () => {
    const options = await post("/home-options");
    assert.equal(options.ok, true);
    assert.deepEqual(
      options.backgrounds.story.map((row) => row.name),
      ["Harbor"],
    );
    assert.equal(options.backgrounds.cg.length, 0);
    chosen = options.backgrounds.story[0];
    assert.equal(chosen.ref, "global-gallery:harbor_authoritative_id");
    assert.equal(runtime.session().backgroundUnlocks.images[0].ref, chosen.ref);
  });
  await test("Actual /home-decor rejects forged raw story and CG keys without changing decoration", async () => {
    const before = clone(runtime.session().decor);
    for (const bg of [
      { src: "story", key: "future" },
      { src: "story", key: "secret" },
      { src: "cg", key: `${runId}:cg:${bond}:0` },
    ])
      assert.deepEqual(await post("/home-decor", { bg }), { ok: false, error: "background-locked" });
    assert.deepEqual(runtime.session().decor, before);
  });
  await test("Actual witness accepts existing timezone metadata, unlocks exactly once and survives normal decoration selection", async () => {
    const request = { chapter: 1, storyIndex: 1, at: 0, place: "Garden", url: "/gallery/garden.png" };
    assert.deepEqual(await post("/artwork/witness", request), { ok: true, unlocked: 1 });
    assert.deepEqual(await post("/artwork/witness", request), { ok: true, unlocked: 0 });
    const options = await post("/home-options");
    const garden = options.backgrounds.story.find((row) => row.name === "Garden");
    const selection = await post("/home-decor", { bg: { src: "story", key: garden.key } });
    assert.equal(selection.ok, true);
    assert.equal(selection.decor.bg.url, garden.url);
  });
  await test("Actual current Character Story image and its right-parsed composite CG unlock separately", async () => {
    assert.equal(
      (
        await post("/artwork/witness", {
          chapter: bond,
          storyIndex: 0,
          at: 0,
          place: "Character secret",
          url: "/gallery/secret-cg.png",
        })
      ).error,
      "image-not-visible",
    );
    assert.deepEqual(
      await post("/artwork/witness", {
        chapter: bond,
        storyIndex: 0,
        at: 0,
        place: "Character secret",
        url: "/gallery/secret.png",
      }),
      { ok: true, unlocked: 1 },
    );
    assert.deepEqual(
      await post("/artwork/witness", {
        chapter: bond,
        storyIndex: 0,
        at: 1,
        place: "Character secret",
        url: "/gallery/secret-cg.png",
      }),
      { ok: true, unlocked: 1 },
    );
    const unlockedCg = (await post("/home-options")).backgrounds.cg[0];
    assert.equal(unlockedCg.url, "/gallery/secret-cg.png");
    assert.equal(unlockedCg.ref, "global-gallery:cg_authoritative_id");
  });
  await test("Actual future chapter witness is rejected even when its image and beat already exist", async () => {
    assert.equal(
      (
        await post("/artwork/witness", {
          chapter: 2,
          storyIndex: 0,
          at: 0,
          place: "Future",
          url: "/gallery/future.png",
        })
      ).error,
      "scene-locked",
    );
  });
  await test("Actual completed alternative-choice replay unlocks its witnessed scene without replacing saved canon", async () => {
    const beat = runtime.docs.get(`${runId}:beat:1:0`).data;
    beat.choices = [
      {
        id: "small-replay",
        kind: "small",
        at: 0,
        options: [
          { id: "canon", text: "Stay at the harbor.", segments: [{ place: "Harbor", text: "The harbor." }] },
          {
            id: "alternate",
            text: "Visit the old room.",
            segments: [{ place: "Character secret", text: "The old room." }],
          },
        ],
      },
    ];
    beat.choiceCanon = { "small-replay": "canon" };
    const selected = await post("/choice", {
      chapter: 1,
      storyIndex: 0,
      choiceId: "small-replay",
      optionId: "alternate",
      replay: true,
    });
    assert.equal(selected.ok, true);
    assert.equal(selected.canonical, false);
    assert.deepEqual(
      await post("/artwork/witness", {
        chapter: 1,
        storyIndex: 0,
        at: 0,
        place: "Character secret",
        url: "/gallery/secret.png",
        choiceId: "small-replay",
        optionId: "alternate",
        replay: true,
      }),
      { ok: true, unlocked: 0 },
    );
    assert.deepEqual(runtime.docs.get(`${runId}:beat:1:0`).data.choiceCanon, { "small-replay": "canon" });
  });
  await test("Closing and reopening the actual activated package preserves earned snapshots and selection", async () => {
    const saved = clone([...runtime.docs]);
    await runtime.close();
    runtime = transactions(await createChatRuntime({ stored: saved }));
    const options = await post("/home-options");
    assert.equal(options.backgrounds.story.length, 3);
    assert.equal(options.backgrounds.cg.length, 1);
    assert.equal((await post("/home-decor", { bg: { src: "story", key: chosen.key } })).decor.bg.url, chosen.url);
    assert.equal(runtime.calls.length, 0);
    assert.deepEqual(runtime.errors, []);
  });
} finally {
  await runtime.close();
}
process.stdout.write(`${passed} actual package background contracts passed.\n`);
