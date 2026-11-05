// Expression painting cost safety: teardown, takeover, stale bases, the live persona avatar and
// revision retries, against the module itself with an in-memory revisioned store and a held lane.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { forgeStoryExpressionNames } from "../sources/forge-kit/story-expressions.mjs";
import { forgeLocalAvatarPath } from "../sources/forge-kit/image-avatar-references.mjs";
import { createForgeStoryExpressions } from "../sources/forge-kit/story-expressions-server.mjs";

globalThis.forgeStoryExpressionNames = forgeStoryExpressionNames;
globalThis.forgeLocalAvatarPath = forgeLocalAvatarPath;
after(() => {
  delete globalThis.forgeStoryExpressionNames;
  delete globalThis.forgeLocalAvatarPath;
});

const until = async (check, message) => {
  for (let index = 0; index < 400; index += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(message);
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
const gallery = (name) => `/api/global-gallery/file/${name}.png`;
const runId = "w";

function world() {
  const docs = new Map();
  const state = {
    run: {
      runId,
      protagonist: { name: "Mari", personaId: "p1", avatarPath: "/api/avatars/file/mari.png" },
      images: { connectionId: "img", expressions: true, portraitWidth: 832, portraitHeight: 1216 },
    },
    persona: "/api/avatars/file/mari.png",
    paid: [],
    deleted: [],
    uploads: 0,
    duringPaint: () => {},
    beforeWrite: () => {},
    held: null,
  };
  const documents = {
    getById: async (_package, id) => structuredClone(docs.get(id) || null),
    list: async () => structuredClone([...docs.values()]),
    update: async (doc) => {
      await state.beforeWrite(doc);
      const old = docs.get(doc.id);
      if (old?.revision !== doc.expectedRevision) return null;
      docs.set(doc.id, { ...old, data: structuredClone(doc.data), revision: old.revision + 1 });
      return structuredClone(docs.get(doc.id));
    },
  };
  // The bundle's Wn: re-read, change, write with the read revision, retry on a conflict.
  const update = async (id, change, tries = 3) => {
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const doc = await documents.getById("gacha-forge", id);
      if (!doc?.data) return null;
      const data = { ...doc.data };
      change(data);
      if (await documents.update({ id, expectedRevision: doc.revision, data })) return data;
    }
    return null;
  };
  const client = {
    cardAvatarImage: async () => ({ base64: "AA==", mime: "image/png" }),
    personaAvatar: async () => state.persona,
    async generateExpression({ expression, base }) {
      state.paid.push(`${base}:${expression}`);
      await state.duringPaint(expression, base);
      return { overrideTook: true, sentPrompt: "", prompt: "" };
    },
    async uploadToGallery() {
      state.uploads += 1;
      return { id: `g${state.uploads}`, url: gallery(`g${state.uploads}`) };
    },
    async deleteGalleryImage(id) {
      state.deleted.push(id);
      return true;
    },
  };
  const create = (overrides = {}) =>
    createForgeStoryExpressions({
      documents,
      packageId: "gacha-forge",
      logger: { warn() {}, info() {}, debug() {} },
      readRun: async () => state.run,
      images: (run) => run.images,
      connection: async () => ({ id: "img", provider: "p", model: "m" }),
      client: () => client,
      // A lane that can be held between two faces.
      slot: async (_target, job) => {
        while (state.held) await state.held.promise;
        return job();
      },
      dedupe: (_key, job) => job(),
      background: (job) => job(),
      update,
      base: (unit) => unit.outfits?.find((outfit) => outfit.id === unit.wornOutfit)?.url || unit.portrait,
      galleryRef: (id) => `global-gallery:${id}`,
      ...overrides,
    });
  const seed = (id, data) => docs.set(`${runId}:unit:${id}`, { id: `${runId}:unit:${id}`, revision: 1, data });
  const unit = (id) => docs.get(`${runId}:unit:${id}`).data;
  const edit = (id, change) => {
    const doc = docs.get(`${runId}:unit:${id}`);
    doc.data = { ...doc.data, ...change };
    doc.revision += 1;
  };
  const hold = () => {
    let release;
    const promise = new Promise((resolve) => (release = resolve));
    state.held = { promise, release };
  };
  const release = () => {
    const held = state.held;
    state.held = null;
    held?.release();
  };
  const speak = (instance, cast) =>
    instance.queue(runId, state.run, cast, { segments: cast.map((character) => ({ speaker: character.name })) });
  return { state, client, create, seed, unit, edit, hold, release, speak };
}

const arden = (url = gallery("o1")) => ({
  kind: "character",
  name: "Arden",
  portrait: gallery("p1"),
  outfits: [{ id: "sea", url }],
  wornOutfit: "sea",
});

test("a disposed instance pays for nothing more; its parked set resumes on the next instance", async () => {
  const w = world();
  w.seed("arden", arden());
  const old = w.create();
  w.state.duringPaint = (expression) => expression === "anger" && w.hold();
  w.speak(old, [{ name: "Arden" }]);
  await until(() => w.state.held && w.unit("arden").expressions?.[gallery("o1")]?.images?.anger, "anger is filed");
  old.dispose();
  w.release();
  await until(() => w.unit("arden").expressions[gallery("o1")].state !== "pending", "the old set is parked");
  assert.deepEqual(w.state.paid, [`${gallery("o1")}:anger`], "nothing is paid after dispose");
  assert.equal(w.unit("arden").expressions[gallery("o1")].state, "stopped");
  w.speak(old, [{ name: "Arden" }]);
  await settle();
  assert.equal(w.state.paid.length, 1, "a disposed instance queues nothing");
  w.state.duringPaint = () => {};
  w.speak(w.create(), [{ name: "Arden" }]);
  await until(() => w.unit("arden").expressions[gallery("o1")].state === "ready", "the next instance resumes");
  assert.equal(w.state.paid.length, 4, "only the three missing faces are painted");
});

test("a teardown during the reads before a paid call still pays for nothing", async () => {
  const w = world();
  w.seed("arden", arden());
  let reads = 0;
  const instance = w.create({
    // The second run read is the one inside the lane, right before the anger face.
    readRun: async () => {
      reads += 1;
      if (reads === 2) instance.dispose();
      return w.state.run;
    },
  });
  w.speak(instance, [{ name: "Arden" }]);
  await until(() => w.unit("arden").expressions?.[gallery("o1")]?.state === "stopped", "the set is parked");
  assert.deepEqual(w.state.paid, [], "nothing is paid after a teardown mid-read");
});

test("a persona set taken over during the avatar read is not paid; ownership uses the newest copy", async () => {
  const w = world();
  w.seed("mari", { kind: "character", name: "Mari", isProtagonist: true, portrait: gallery("p1") });
  const base = w.state.persona;
  let inLane = false;
  w.state.persona = base;
  const instance = w.create({
    client: () => ({
      ...w.client,
      cardAvatarImage: async () => ({ base64: "AA==", mime: "image/png" }),
      personaAvatar: async () => {
        // Another instance takes the set over while this one waits on the avatar inside the lane.
        if (inLane) w.edit("mari", { expressions: { [base]: { state: "pending", at: "takeover", images: {} } } });
        return base;
      },
      generateExpression: async ({ expression }) => {
        w.state.paid.push(expression);
        return { overrideTook: true, sentPrompt: "", prompt: "" };
      },
    }),
    slot: async (_target, job) => {
      inLane = true;
      return job();
    },
  });
  w.speak(instance, [{ name: "Mari", prota: true, art: base }]);
  await until(() => w.unit("mari").expressions?.[base]?.at === "takeover", "the set is taken over");
  await settle();
  assert.deepEqual(w.state.paid, [], "a taken-over set is not paid");
  assert.equal(w.unit("mari").expressions[base].state, "pending", "the new owner's set is untouched");
});

test("a torn-down instance never writes set state, so it cannot fail the next instance's set", async () => {
  const w = world();
  w.seed("arden", arden());
  let open;
  const gate = new Promise((resolve) => (open = resolve));
  const old = w.create({
    readRun: async () => {
      await gate;
      return w.state.run;
    },
  });
  w.speak(old, [{ name: "Arden" }]);
  await settle();
  old.dispose();
  const next = w.create();
  w.state.duringPaint = (expression) => expression === "anger" && w.hold();
  w.speak(next, [{ name: "Arden" }]);
  await until(() => w.state.held && w.unit("arden").expressions?.[gallery("o1")]?.state === "pending", "next paints");
  open();
  await settle();
  assert.equal(w.unit("arden").expressions[gallery("o1")].state, "pending", "the old instance leaves the set alone");
  w.state.duringPaint = () => {};
  w.release();
  await until(() => w.unit("arden").expressions[gallery("o1")].state === "ready", "the next instance finishes");
  assert.equal(w.state.paid.length, 4);
});

test("a teardown before the first paid call writes no pending set", async () => {
  const w = world();
  w.seed("arden", arden());
  const instance = w.create({
    connection: async () => {
      instance.dispose();
      return { id: "img", provider: "p", model: "m" };
    },
  });
  w.speak(instance, [{ name: "Arden" }]);
  await settle();
  assert.equal(w.unit("arden").expressions, undefined, "no set state is written");
  assert.deepEqual(w.state.paid, []);
});

test("the shipped teardown disposes expression painting", async () => {
  const bundle = await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8");
  assert.match(
    bundle,
    /return\(\)=>\{forgeProactiveMessages\?\.dispose\(\);[^}]*forgeStoryExpressions\.dispose\(\)\}/u,
  );
});

test("a set another instance took over is never paid for or rewritten by this attempt", async () => {
  const w = world();
  w.seed("arden", arden());
  w.state.duringPaint = (expression) => expression === "anger" && w.hold();
  w.speak(w.create(), [{ name: "Arden" }]);
  await until(() => w.state.held && w.unit("arden").expressions?.[gallery("o1")]?.images?.anger, "anger is filed");
  const taken = { ...w.unit("arden").expressions[gallery("o1")], at: "2099-01-01T00:00:00.000Z" };
  w.edit("arden", { expressions: { [gallery("o1")]: taken } });
  w.release();
  await settle();
  assert.equal(w.state.paid.length, 1);
  assert.deepEqual(w.unit("arden").expressions[gallery("o1")], taken, "the other owner's record is untouched");
});

test("a base dropped mid-paint parks its set as stopped, so restoring that base resumes it", async () => {
  const w = world();
  w.seed("arden", arden());
  const forge = w.create();
  // The base is redone while a face paints: that face is discarded.
  w.state.duringPaint = (expression) =>
    expression === "fear" && w.edit("arden", { outfits: [{ id: "sea", url: gallery("o2") }] });
  w.speak(forge, [{ name: "Arden" }]);
  await until(
    () => w.unit("arden").expressions?.[gallery("o1")]?.state === "stopped",
    "the in-flight discard parks the set",
  );
  assert.deepEqual(Object.keys(w.unit("arden").expressions[gallery("o1")].images), ["anger"]);
  assert.deepEqual(w.state.deleted, ["g2"], "the unfiled face is deleted");
  await settle();
  w.state.duringPaint = () => {};
  w.edit("arden", { outfits: [{ id: "sea", url: gallery("o1") }] });
  w.speak(forge, [{ name: "Arden" }]);
  await until(() => w.unit("arden").expressions[gallery("o1")].state === "ready", "the restored base resumes");
  assert.equal(w.state.paid.length, 5, "anger and the discarded fear plus the three missing faces");

  // The base is redone between two faces: the next slot stops before paying.
  const v = world();
  v.seed("arden", arden());
  v.state.duringPaint = (expression) => expression === "fear" && v.hold();
  v.speak(v.create(), [{ name: "Arden" }]);
  await until(() => v.state.held && v.unit("arden").expressions?.[gallery("o1")]?.images?.fear, "fear is filed");
  v.edit("arden", { outfits: [{ id: "sea", url: gallery("o2") }] });
  v.release();
  await until(() => v.unit("arden").expressions[gallery("o1")].state === "stopped", "the stale slot parks the set");
  assert.equal(v.state.paid.length, 2);
});

test("the persona's live avatar changing mid-paint stops the set and discards the face", async () => {
  const w = world();
  const mari = "/api/avatars/file/mari.png";
  w.seed("protagonist", { kind: "character", name: "Mari", isProtagonist: true, portrait: mari });
  w.state.duringPaint = () => {
    w.state.persona = "/api/avatars/file/mari-new.png";
  };
  w.speak(w.create(), [{ name: "Mari", art: mari, prota: true }]);
  await until(() => w.unit("protagonist").expressions?.[mari]?.state === "stopped", "the persona set stops");
  assert.equal(w.state.paid.length, 1, "no further face is paid for the old avatar");
  assert.deepEqual(w.state.deleted, ["g1"], "the face painted for the old avatar is deleted");
  assert.deepEqual(w.unit("protagonist").expressions[mari].images, {});
});

test("a revision retry that skips filing deletes the image instead of keeping a stale filed flag", async () => {
  const w = world();
  w.seed("arden", { kind: "character", name: "Arden", portrait: gallery("p1") });
  let raced = false;
  w.state.beforeWrite = (doc) => {
    if (raced || !doc.data.expressions?.[gallery("p1")]?.images?.anger) return;
    raced = true;
    w.edit("arden", { portrait: gallery("p2") }); // a redraw commits between the filing read and write
  };
  w.speak(w.create(), [{ name: "Arden" }]);
  await until(() => w.state.deleted.includes("g1"), "the unfiled image is deleted");
  assert.equal(w.state.paid.length, 1);
  assert.deepEqual(w.unit("arden").expressions[gallery("p1")].images, {});
});

test("a prune retry re-checks bases, so a set restored meanwhile is kept with its images", async () => {
  const w = world();
  const set = {
    state: "ready",
    at: "2026-01-01T00:00:00.000Z",
    images: { anger: { url: gallery("g9"), ref: "global-gallery:g9" } },
  };
  w.seed("arden", { kind: "character", name: "Arden", portrait: gallery("p2"), expressions: { [gallery("p1")]: set } });
  let raced = false;
  w.state.beforeWrite = () => {
    if (raced) return;
    raced = true;
    w.edit("arden", { portrait: gallery("p1") }); // restored between the prune's read and write
  };
  w.speak(w.create(), []);
  await until(() => raced, "the prune runs");
  await settle();
  assert.deepEqual(w.state.deleted, []);
  assert.deepEqual(w.unit("arden").expressions[gallery("p1")], set);
});
