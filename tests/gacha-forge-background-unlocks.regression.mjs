import assert from "node:assert/strict";
import { createForgeBackgroundUnlocks } from "../packages/gacha-forge/src/background-unlocks-server.mjs";
const runId = "art-fixture",
  unitId = `${runId}:unit:arden`,
  bond = `bond:${unitId}:2`;
const clone = structuredClone;
function fixture() {
  const docs = new Map();
  const seed = (id, kind, data) => docs.set(id, { id, kind, packageId: "gacha-forge", revision: 1, data: clone(data) });
  const get = (id) => docs.get(id)?.data;
  const reads = [];
  const store = {
    getById: async (_, id) => {
      reads.push(id);
      return clone(docs.get(id));
    },
    list: async (_, kind) => clone([...docs.values()].filter((row) => row.kind === kind)),
    update: async (row) => {
      const before = docs.get(row.id);
      if (!before || before.revision !== row.expectedRevision) return false;
      docs.set(row.id, { ...clone(row), revision: before.revision + 1 });
      return true;
    },
  };
  let fail = false;
  const persistence = {
    documents: store,
    transaction: async (work) => {
      const previous = clone([...docs]);
      try {
        const result = await work({ documents: store });
        if (fail) throw new Error("controlled transaction rollback");
        return result;
      } catch (error) {
        docs.clear();
        for (const [k, v] of previous) docs.set(k, v);
        throw error;
      }
    },
  };
  seed("index", "index", { runs: [{ runId, story: { seasonalEvents: true } }] });
  seed(`${runId}:session`, "session", {
    progress: { 1: { normal: 1 }, 2: { normal: 0 } },
    roster: { [unitId]: {} },
    bondChapters: { [unitId]: { beats2: 0 } },
  });
  seed(`${runId}:chapter:1`, "chapter-plan", { nodes: [{ type: "story" }, { type: "story" }] });
  seed(`${runId}:chapter:2`, "chapter-plan", { nodes: [{ type: "story" }] });
  seed(`${runId}:chapter:${bond}`, "chapter-plan", { bondUnitId: unitId, bondPart: 2, nodes: [{ type: "story" }] });
  seed(`${runId}:chapter:event-1`, "chapter-plan", { eventId: `${runId}:event:1`, nodes: [{ type: "story" }] });
  seed(`${runId}:event:1`, "story-event", { endsAt: 200 });
  for (const [chapter, index, place] of [
    [1, 0, "Old harbor"],
    [1, 1, "Current garden"],
    [2, 0, "Spoiler palace"],
    [bond, 0, "Character secret"],
    ["event-1", 0, "Festival"],
  ])
    seed(`${runId}:beat:${chapter}:${index}`, "beat", {
      segments: [
        { text: "A first line.", place },
        { text: "A second line.", place },
      ],
    });
  const raw = {
    story: ["Old harbor", "Current garden", "Spoiler palace", "Character secret", "Festival", "Unchosen room"].map(
      (name, index) => ({ key: `place-${index}`, name, url: `/art/${index}.png` }),
    ),
    cg: [{ key: `${runId}:cg:${bond}:0`, name: "Bond key image", url: "/cg/bond.png" }],
    banner: [{ key: "banner-1", name: "Known banner", url: "/art/banner.png" }],
    bond: [{ key: unitId, name: "Arden reward", url: "/art/bond.png" }],
  };
  seed(`${runId}:cg:${bond}:0`, "cg", { from: 1, to: 1, url: "/cg/bond.png" });
  const service = createForgeBackgroundUnlocks({
    packageId: "gacha-forge",
    persistence,
    allNodes: (plan) => plan.nodes || [],
    rawOptions: async () => clone(raw),
    now: () => 100,
  });
  const witness = (chapter, storyIndex, at, url, place) =>
    service.witness({ runId, chapter, storyIndex, at, url, place, timeZone: "Europe/Warsaw" });
  return {
    docs,
    get,
    seed,
    service,
    witness,
    raw,
    reads,
    fail: () => {
      fail = true;
    },
  };
}
let passed = 0;
async function test(name, work) {
  await work();
  passed++;
  process.stdout.write(`PASS ${name}\n`);
}
await test("Legacy completed scenes migrate; current and pre-generated scenes stay hidden in options and selection", async () => {
  const f = fixture();
  const options = await f.service.options(runId);
  assert.deepEqual(
    options.story.map((row) => row.name),
    ["Old harbor"],
  );
  assert.equal(await f.service.select(runId, "story", "place-2"), null);
  assert.equal(await f.service.select(runId, "cg", `${runId}:cg:${bond}:0`), null);
  assert.equal(options.banner.length, 1);
  assert.equal(options.bond.length, 1);
  assert.equal(await f.service.select(runId, "__proto__", "anything"), null);
});
await test("First actual current image unlocks once, without unlocking later chapters", async () => {
  const f = fixture();
  assert.deepEqual(await f.witness(1, 1, 0, "/art/1.png", "Current garden"), { ok: true, unlocked: 1 });
  assert.deepEqual(await f.witness(1, 1, 0, "/art/1.png", "Current garden"), { ok: true, unlocked: 0 });
  assert.equal((await f.witness(2, 0, 0, "/art/2.png", "Spoiler palace")).error, "scene-locked");
  assert.equal((await f.service.options(runId)).story.length, 2);
});
await test("Composite Character Story CG IDs retain chapter and only unlock while the CG is actually visible", async () => {
  const f = fixture();
  assert.equal((await f.witness(bond, 0, 0, "/cg/bond.png", "Character secret")).error, "image-not-visible");
  assert.deepEqual(await f.witness(bond, 0, 0, "/art/3.png", "Character secret"), { ok: true, unlocked: 1 });
  assert.deepEqual(await f.witness(bond, 0, 1, "/cg/bond.png", "Character secret"), { ok: true, unlocked: 1 });
  assert.equal((await f.service.options(runId)).cg[0].url, "/cg/bond.png");
});
await test("Unselected branches and mainline after an unresolved choice cannot leak artwork", async () => {
  const f = fixture();
  const beat = f.get(`${runId}:beat:1:1`);
  beat.choices = [
    {
      id: "small",
      at: 0,
      kind: "small",
      options: [
        { id: "garden", segments: [{ place: "Current garden" }] },
        { id: "secret", segments: [{ place: "Unchosen room" }] },
      ],
    },
  ];
  assert.equal((await f.witness(1, 1, 1, "/art/1.png", "Current garden")).error, "image-not-visible");
  assert.equal((await f.witness(1, 1, 0, "/art/5.png", "Unchosen room")).error, "image-not-visible");
  beat.choiceCanon = { small: "garden" };
  assert.equal((await f.witness(1, 1, 0, "/art/5.png", "Unchosen room")).error, "image-not-visible");
  assert.equal((await f.witness(1, 1, 1, "/art/1.png", "Current garden")).ok, true);
});
await test("Regenerated same-key art does not silently replace earned images or an existing selected background", async () => {
  const f = fixture();
  f.get(`${runId}:session`).decor = { bg: { src: "story", key: "place-3" } };
  let options = await f.service.options(runId);
  let secret = options.story.find((row) => row.name === "Character secret");
  assert.equal(secret.url, "/art/3.png");
  assert.equal(f.get(`${runId}:session`).decor.bg.key, secret.key);
  f.raw.story[3].url = "/art/new-secret.png";
  options = await f.service.options(runId);
  assert.equal(options.story.find((row) => row.key === secret.key).url, "/art/3.png");
  assert.equal((await f.service.select(runId, "story", secret.key)).url, "/art/3.png");
  assert.deepEqual(await f.witness(bond, 0, 0, "/art/new-secret.png", "Character secret"), { ok: true, unlocked: 1 });
  options = await f.service.options(runId);
  assert.equal(options.story.filter((row) => row.name === "Character secret").length, 2);
});
await test("Inactive events and stale chapter revisions reject new artwork; completed replay remains earned", async () => {
  const f = fixture();
  f.get(`${runId}:event:1`).endsAt = 99;
  assert.equal((await f.witness("event-1", 0, 0, "/art/4.png", "Festival")).error, "scene-locked");
  f.get(`${runId}:session`).progress["event-1"] = { normal: 1 };
  assert.equal((await f.witness("event-1", 0, 0, "/art/4.png", "Festival")).ok, true);
  f.get(`${runId}:session`).storyRevision = 1;
  assert.equal((await f.witness(1, 1, 0, "/art/1.png", "Current garden")).error, "story-changed");
});
await test("A failed public transaction commits neither migration nor newly witnessed images", async () => {
  const f = fixture();
  const before = clone([...f.docs]);
  f.fail();
  await assert.rejects(f.witness(1, 1, 0, "/art/1.png", "Current garden"), /rollback/);
  assert.deepEqual([...f.docs], before);
});
await test("Legacy migration reads each completed beat and CG once even for long scenes", async () => {
  const f = fixture();
  f.get(`${runId}:beat:1:0`).segments = Array.from({ length: 200 }, (_, index) => ({
    text: `Line ${index}`,
    place: "Old harbor",
  }));
  f.raw.cg.push({ key: `${runId}:cg:1:0`, name: "Harbor key image", url: "/cg/harbor.png" });
  f.seed(`${runId}:cg:1:0`, "cg", { from: 5, to: 10, url: "/cg/harbor.png" });
  await f.service.options(runId);
  assert.equal(f.reads.filter((id) => id === `${runId}:beat:1:0`).length, 1);
  assert.equal(f.reads.filter((id) => id === `${runId}:cg:1:0`).length, 1);
});
await test("Saved artwork retains the authoritative Gallery reference after its raw location is replaced", async () => {
  const f = fixture();
  f.raw.story[0].ref = "global-gallery:original_gallery_id";
  const selected = (await f.service.options(runId)).story[0];
  f.raw.story[0].url = "/art/replaced.png";
  f.raw.story[0].ref = "global-gallery:replacement_gallery_id";
  const snapshot = await f.service.select(runId, "story", selected.key);
  assert.equal(snapshot.url, "/art/0.png");
  assert.equal(snapshot.ref, "global-gallery:original_gallery_id");
  assert.equal(f.get(`${runId}:session`).backgroundUnlocks.images[0].ref, "global-gallery:original_gallery_id");
});
await test("A completed small-choice replay can unlock its selected alternate image without rewriting canon", async () => {
  const f = fixture();
  const choices = [
    {
      id: "small",
      at: 0,
      kind: "small",
      options: [
        { id: "garden", segments: [{ place: "Current garden" }] },
        { id: "secret", segments: [{ place: "Unchosen room" }] },
      ],
    },
  ];
  const beat = f.get(`${runId}:beat:1:0`);
  beat.choices = choices;
  beat.choiceCanon = { small: "garden" };
  await f.service.options(runId);
  const body = {
    runId,
    chapter: 1,
    storyIndex: 0,
    at: 0,
    place: "Unchosen room",
    url: "/art/5.png",
    replay: true,
    choiceId: "small",
    optionId: "secret",
  };
  assert.deepEqual(await f.service.witness(body), { ok: true, unlocked: 1 });
  assert.deepEqual(beat.choiceCanon, { small: "garden" });
  f.get(`${runId}:beat:1:1`).choices = choices;
  f.get(`${runId}:beat:1:1`).choiceCanon = { small: "garden" };
  assert.equal((await f.service.witness({ ...body, storyIndex: 1 })).error, "image-not-visible");
});
await test("Shared image URLs keep each earned selection key stable", async () => {
  const f = fixture();
  f.raw.story[1].url = f.raw.story[0].url;
  f.get(`${runId}:beat:1:0`).segments.push({ text: "A shared view.", place: "Current garden" });
  const options = await f.service.options(runId);
  assert.equal(options.story.length, 2);
  for (const item of options.story) assert.equal((await f.service.select(runId, "story", item.key)).url, item.url);
});
process.stdout.write(`${passed} background unlock contracts passed.\n`);
