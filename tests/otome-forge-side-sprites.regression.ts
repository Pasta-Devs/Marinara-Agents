// Otome Hearth 0.20.0: side characters who come back get a sprite (S/story/side-cast.ts, S/art/side-sprites.ts).
// - A beat read to its end records its named side speakers by their name's core words, never a love interest or the
//   protagonist (however they are named), several people at once, a thought or an option not picked; with no call.
// - Someone qualifies after speaking in two different chapters, or at once when one Engine card matches their name; two
//   cards that match (namesakes) are never guessed. A card's sprite needs no look call and sends the card as likeness.
// - Opening a story records the scenes read before, once per story and one pass at a time, with no call.
// - The look call: once per person, on the Messages connection's background lane, logged in debug mode, with the
//   setting, their scenes and the story's content contract; turning the toggle on in Settings starts it.
// - The sprite: one full-body look on its chroma matte, held for the tap under Ask before painting, a failure kept for
//   Retry, never paid twice for one tap; cut out for free, and GET .../art/scene carries it for the speaker.
// - Toggle off: nothing is called, matched or painted, and the scene carries no sprite.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  Chapter,
  ImageSettings,
  Segment,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  cutoutsSettled,
  type CutoutClient,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import { paintSlot } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import type {
  OtomeReply,
  RouteDeps,
  RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  beatId,
  chapterId,
  runDocTarget,
  sideCastId,
  stateId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  LOOK_SIZE,
  otomeContentContract,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { registerArtRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/art.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { registerStoryRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/story.ts";
import {
  SIDE_PEOPLE_MAX,
  normalizeSideCast,
  qualifies,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/side-cast.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  backfillSideCast,
  matchCard,
  tendSideCast,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/side-cast.ts";
import { beat, fakeImages, setImages, until, type PaidCall } from "./fixtures/otome-forge-art.ts";
import { KAI, MIR, at, json, storyWorld } from "./fixtures/otome-forge-story.ts";

const ARLE_LOOK = {
  identityLine: "tall woman, white hair with black streaks, red crossed pupils",
  outfitLine: "black fur-trimmed greatcoat, long gloves",
  presentation: "female",
};
const CARDS = [
  {
    id: "card-arle",
    data: JSON.stringify({ name: "Arlecchino", extensions: { appearance: "CARD-APPEARANCE: white hair, red eyes" } }),
  },
  { id: "card-col-1", data: JSON.stringify({ name: "Columbina" }) },
  { id: "card-col-2", data: JSON.stringify({ name: "Columbina" }) },
];

const isLookCall = (messages: ReadonlyArray<{ content: string }>) =>
  !!messages[0]?.content.startsWith("You write how one side character");

const line = (speaker: string, text: string, extra: Partial<Segment> = {}): Segment => ({ speaker, text, ...extra });

interface SideWorldOptions {
  /** The image settings over `conn-image` with Side character sprites on; none for a world without images. */
  images?: Partial<ImageSettings>;
  before?: (call: PaidCall, n: number) => void | Promise<void>;
  characters?: Parameters<typeof storyWorld>[0]["characters"];
  replies?: Parameters<typeof storyWorld>[0]["replies"];
}

async function sideWorld(runKey: string, { images, before, characters = [], replies = [] }: SideWorldOptions = {}) {
  const t = await storyWorld({ runKey, characters, replies });
  if (images) await setImages(t.store, t.runId, { connectionId: "conn-image", sideSprites: true, ...images });
  const fake = fakeImages({ before });
  const cuts: string[] = [];
  const cutouts: CutoutClient = {
    async cutOut(url) {
      cuts.push(url);
      return { id: `cut${cuts.length}`, url: `/api/global-gallery/file/cut-${cuts.length}.png` };
    },
    deleteGalleryImage: async () => true,
  };
  const background = createBackgroundQueue(t.runtime);
  const deps: RouteDeps = { ...t.deps, images: fake.images, cutouts, background };
  const routes = new Map<string, RouteHandler>();
  const router = {
    get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
    post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
  };
  for (const register of [registerStoryRoutes, registerRunRoutes, registerArtRoutes]) register(router, deps);
  const call = async (method: "GET" | "POST", path: string, body: object = {}, params: Record<string, string> = {}) => {
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const fields = { timeZone: "UTC", debugMode: true };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        params: { run: runKey, ...params },
        query: method === "GET" ? { ...fields, ...body } : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
  /**
   * A one-node main chapter `n` whose only scene is `segments` (with `extra` on the beat); with `ahead`, a second node
   * whose scene is written ahead and not read yet.
   */
  const scene = async (n: number, segments: Segment[], extra: Parameters<typeof beat>[1] = {}, ahead?: Segment[]) => {
    const key = `main-${n}`;
    const chapter: Chapter = {
      key,
      kind: "main",
      number: n,
      lead: KAI,
      foil: MIR,
      title: `Chapter ${n}`,
      tags: [],
      summary: "The lanterns fail.",
      nodes: [
        { i: 0, kind: "beat", guide: "Node 0.", cast: [KAI] },
        ...(ahead ? [{ i: 1, kind: "beat" as const, guide: "Node 1.", cast: [KAI] }] : []),
      ],
      ledger: { relationship: [], conflict: [], offscreen: [] },
      plannedAt: at,
      connectionId: "conn-text",
    };
    await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, key)), normalizeChapter, () => chapter);
    const written = { ...beat(0, { segments, ...extra }), key, written: { ...beat(0).written, at: `${at}#${n}` } };
    await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, key, 0)), normalizeBeat, () => written);
    if (ahead) {
      const next = { ...beat(1, { segments: ahead }), key, written: { ...beat(1).written, at: `${at}#${n}b` } };
      await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, key, 1)), normalizeBeat, () => next);
    }
    return key;
  };
  /** Reads chapter `key`'s scene to its end through the route, as the reader does. */
  const read = async (key: string, body: object = {}) => {
    const stored = (await t.store.readDoc(beatId(t.runId, key, 0), normalizeBeat))!;
    const done = await call(
      "POST",
      "/runs/:run/chapters/:key/beats/:i/read",
      { segment: stored.segments.length - 1, ...body },
      { key, i: "0" },
    );
    assert.equal(done.status, 200, JSON.stringify(done.body));
    return done.body;
  };
  const sides = async () => (await t.store.readDoc(sideCastId(t.runId), normalizeSideCast))?.people ?? {};
  const lookCalls = () => t.calls.filter((entry) => isLookCall(entry.messages));
  /** Lets background jobs, paints and cut-outs finish. */
  const settle = async () => {
    for (let round = 0; round < 30; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      await runForeground(t.runId, async () => undefined);
      await paintSlot("conn-image", async () => undefined);
    }
    await cutoutsSettled();
  };
  const tend = (review = false) => tendSideCast(deps, t.runId, { debugMode: true, review });
  return { ...t, ...fake, deps, call, scene, read, sides, lookCalls, settle, tend, cuts };
}

const ARLE_SAYS = (text: string, name = "Lady Arlecchino") => line(name, text, { gender: "female" });

test("a scene read to its end records its side speakers by their core name, never the cast, with no call", async () => {
  const t = await sideWorld("r-side01-aaaaaa");
  const key = await t.scene(
    1,
    [
      line("", "The lamp hisses."),
      line("Kai", "You came back.", { expression: "cold" }),
      line("Lord Kai", "A love interest under a title is still him."),
      line("Mireille-sama", "And under an honorific."),
      line("Ines", "Someone had to."),
      line("Ines", "Why is she here?", { thought: true }),
      ARLE_SAYS("Children, gather round."),
      line("Arlecchino", "The same woman, without her title."),
      line("Guard & Porter", "Two at once are nobody's sprite."),
      line("???", "No name at all."),
      line("Columbina", "A thought is never a speaker.", { thought: true }),
    ],
    {
      choices: [
        {
          id: "choice-1",
          kind: "small",
          at: 10,
          options: [
            {
              id: "option-1",
              text: "Ask him.",
              selection: { kind: "dialogue", text: "Who is that?" },
              segments: [line("Pantalone", "A banker, my dear.")],
            },
            {
              id: "option-2",
              text: "Leave.",
              selection: { kind: "action", text: "You leave." },
              segments: [line("Sandrone", "Never heard: this option was not picked.")],
            },
          ],
        },
      ],
      choiceCanon: { "choice-1": "option-1" },
    },
  );
  await t.read(key);
  const people = await t.sides();
  assert.deepEqual(Object.keys(people).sort(), ["arlecchino", "pantalone"]);
  assert.deepEqual(
    { name: people.arlecchino!.name, chapters: people.arlecchino!.chapters, voice: people.arlecchino!.voice },
    { name: "Arlecchino", chapters: [key], voice: "female" },
    "both names are one person, by the name's core words",
  );
  assert.deepEqual(people.pantalone!.chapters, [key], "the picked option's branch was read");
  // Reading it again writes nothing new.
  const before = (await t.store.readDoc(sideCastId(t.runId), (data) => data)) as object;
  await t.read(key);
  assert.deepEqual(await t.store.readDoc(sideCastId(t.runId), (data) => data), before);
  await t.settle();
  assert.equal(t.calls.length, 0, "no model call");
  assert.equal(t.paid.length, 0, "nothing painted: the toggle is off");
});

test("someone qualifies in a second chapter: one look call, logged, with the contract; then one sprite, cut out", async () => {
  const t = await sideWorld("r-side02-bbbbbb", { images: {}, replies: [json(ARLE_LOOK)] });
  // The standalone art calls run on the Messages connection (the maintainer's, 2026-11-10), never Planning.
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    connections: { narration: "conn-text", structured: "conn-plan", chat: "conn-chat" },
  }));
  await t.read(await t.scene(1, [line("", "Snow on the quay."), ARLE_SAYS("FIRST-CHAPTER: Children, gather round.")]));
  await t.settle();
  assert.equal(qualifies((await t.sides()).arlecchino!), false, "one chapter is not enough");
  assert.equal(t.lookCalls().length, 0);
  assert.equal(t.paid.length, 0);

  // Her look reads the scene as it was read: the picked option's branch, never the other one or a scene written ahead.
  const picked = (id: string, text: string) => ({
    id,
    text: id,
    selection: { kind: "action" as const, text: id },
    segments: [ARLE_SAYS(text, "Arlecchino")],
  });
  await t.read(
    await t.scene(
      2,
      [line("", "The House of the Hearth."), ARLE_SAYS("SECOND-CHAPTER: Sit.", "Arlecchino")],
      {
        choices: [
          {
            id: "choice-1",
            kind: "small",
            at: 1,
            options: [picked("option-1", "PICKED-BRANCH: Good."), picked("option-2", "UNPICKED-BRANCH: Never.")],
          },
        ],
        choiceCanon: { "choice-1": "option-1" },
      },
      [ARLE_SAYS("WRITTEN-AHEAD: Not yet.", "Arlecchino")],
    ),
  );
  await until(async () => (await t.sides()).arlecchino?.art?.state === "ready", "her sprite painted");
  await t.settle();
  const [look, ...more] = t.lookCalls();
  assert.ok(look, "her look was written");
  assert.equal(more.length, 0, "once");
  assert.equal(look.connectionId, "conn-chat", "on the Messages connection, never Planning");
  const [system, user] = look.messages.map((message) => message.content);
  const world = (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  assert.ok(
    system!.includes(otomeContentContract({ world, lis: [], kind: "planner" })),
    "the story's content contract",
  );
  assert.match(system!, /known character of an existing book, film, game or series/u, "canon may fill the rest");
  assert.match(system!, /identityLine: English only, visual-only/u);
  assert.match(user!, /A harbour city lit by lanterns/u, "the world's setting");
  assert.match(user!, /Lady Arlecchino: FIRST-CHAPTER/u, "her lines in both chapters");
  assert.match(user!, /Arlecchino: SECOND-CHAPTER/u);
  assert.match(user!, /Snow on the quay\./u, "with the narration around them");
  assert.match(user!, /PICKED-BRANCH/u, "the picked option's branch");
  assert.doesNotMatch(user!, /UNPICKED-BRANCH/u, "never the option not picked");
  assert.doesNotMatch(user!, /WRITTEN-AHEAD/u, "never a scene not read yet");
  const logged = t.logs.filter((entry) => entry.level === "debugOverride" && entry.args[0] === "side-look");
  assert.ok(logged.length >= 1, "the prompt is logged in debug mode");

  const person = (await t.sides()).arlecchino!;
  assert.deepEqual(
    { ...person.look, at: "" },
    { identityLine: ARLE_LOOK.identityLine, outfitLine: ARLE_LOOK.outfitLine, presentation: "woman", at: "" },
  );
  assert.equal(t.paid.length, 1, "one image");
  const [paint] = t.paid;
  assert.equal(paint!.method, "generatePortrait");
  assert.equal(paint!.request.width, LOOK_SIZE.width);
  assert.deepEqual(paint!.request.unit, { kind: "character" }, "nobody's likeness: she has no card");
  assert.match(paint!.request.prompt, /white hair with black streaks/u);
  assert.match(paint!.request.prompt, /full body, standing, neutral pose, plain flat solid chroma/u);
  assert.match(paint!.request.prompt, /adult woman/u);
  assert.deepEqual(t.cuts, [person.art!.url], "cut out for free");

  // Nothing is owed again: more scenes, a tend and a story open call and paint nothing more.
  await t.read(await t.scene(3, [ARLE_SAYS("THIRD-CHAPTER: Again.")]));
  await t.tend();
  await t.call("GET", "/runs/:run");
  await t.settle();
  assert.equal(t.lookCalls().length, 1);
  assert.equal(t.paid.length, 1);

  // The reader view carries her cut-out for the speaker as the beat names her, and nobody who has not qualified.
  const third = await t.scene(4, [ARLE_SAYS("FOURTH: Here."), line("Pantalone", "Once only.")]);
  const art = await t.call("GET", "/runs/:run/art/scene", { key: third, i: "0" });
  assert.equal(art.status, 200, JSON.stringify(art.body));
  assert.deepEqual(art.body.sides, {
    "Lady Arlecchino": { key: "arlecchino", art: person.art, url: "/api/global-gallery/file/cut-1.png", cut: true },
  });
});

test("a unique Engine card match qualifies at once and sends the card; a namesake is never guessed", async () => {
  const t = await sideWorld("r-side03-cccccc", { images: {}, characters: CARDS });
  assert.equal(matchCard("arlecchino", [{ id: "a", name: "Arlecchino" }]), "a");
  assert.equal(
    matchCard(
      "columbina",
      CARDS.slice(1).map((card) => ({ id: card.id, name: "Columbina" })),
    ),
    null,
  );
  await t.read(
    await t.scene(1, [
      ARLE_SAYS("I am a card."),
      line("Columbina", "There are two cards of me.", { gender: "female" }),
    ]),
  );
  await until(async () => (await t.sides()).arlecchino?.art?.state === "ready", "her sprite painted");
  await t.settle();
  const people = await t.sides();
  assert.equal(people.arlecchino!.cardId, "card-arle", "Lady Arlecchino is the card Arlecchino");
  assert.equal(people.columbina!.cardId, undefined, "two Columbina cards: neither is guessed");
  assert.equal(qualifies(people.columbina!), false);
  assert.equal(t.lookCalls().length, 0, "a card's own Appearance stands in for the look call");
  assert.equal(t.paid.length, 1, "her sprite only");
  const request = t.paid[0]!.request;
  assert.deepEqual(
    request.unit,
    { kind: "character", cardId: "card-arle", who: "Lady Arlecchino" },
    "the card's likeness",
  );
  assert.match(request.prompt, /CARD-APPEARANCE: white hair, red eyes/u);
  assert.match(request.prompt, /adult woman/u, "drawn as her voice says");
});

test("opening a story records the scenes read before, once per story, one pass at a time, with no call", async () => {
  const t = await sideWorld("r-side04-dddddd");
  const read = await t.scene(1, [line("Pantalone", "BEFORE: a scene read before 0.20.0.")]);
  await t.scene(2, [line("Sandrone", "NOT YET: a scene written ahead, never read.")]);
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [read]: { beatsRead: 1, completed: at, applied: [] } },
  }));
  let beatLists = 0;
  const list = t.fake.documents.list;
  t.fake.documents.list = async (packageId, kind) => {
    if (kind === "beat") beatLists += 1;
    return list(packageId, kind);
  };
  const first = backfillSideCast(t.deps, t.runId);
  const second = backfillSideCast(t.deps, t.runId);
  assert.equal(first, second, "a second open while it runs gets the same pass");
  await first;
  assert.equal(beatLists, 1, "one pass");
  const people = await t.sides();
  assert.deepEqual(Object.keys(people), ["pantalone"], "only scenes read to their end");
  assert.deepEqual(people.pantalone!.chapters, [read]);
  assert.ok((await t.store.readDoc(sideCastId(t.runId), normalizeSideCast))!.backfilled);

  await backfillSideCast(t.deps, t.runId);
  const opened = await t.call("GET", "/runs/:run");
  assert.equal(opened.status, 200);
  await t.settle();
  assert.equal(beatLists, 1, "once per story: later opens record nothing again");
  assert.deepEqual(Object.keys(await t.sides()), ["pantalone"]);
  assert.equal(t.lookCalls().length, 0);
});

test("Ask before painting holds the sprite for the tap, the review shows its prompt, and no tap pays twice", async () => {
  const t = await sideWorld("r-side05-eeeeee", { images: { ask: true }, replies: [json(ARLE_LOOK)] });
  await t.read(await t.scene(1, [ARLE_SAYS("One.")]));
  await t.read(await t.scene(2, [ARLE_SAYS("Two.")]));
  await until(async () => (await t.sides()).arlecchino?.art?.state === "waiting-consent", "held for the tap");
  await t.settle();
  assert.equal(t.paid.length, 0, "Ask before painting: nothing painted untapped");
  const scene = await t.call("GET", "/runs/:run/art/scene", { key: "main-2", i: "0" });
  assert.equal(scene.body.sides["Lady Arlecchino"].art.state, "waiting-consent", "the reader offers Paint");

  const prompt = await t.call("POST", "/runs/:run/art/side/prompt", { key: "arlecchino" });
  assert.equal(prompt.status, 200);
  assert.match(prompt.body.prompt, /adult woman/u, "the review dialog shows the prompt the paint would send");
  const [first, again] = await Promise.all([
    t.call("POST", "/runs/:run/art/side", { key: "arlecchino" }),
    t.call("POST", "/runs/:run/art/side", { key: "arlecchino" }),
  ]);
  assert.equal(first.body.art.state, "ready");
  assert.equal(again.body.art.state, "ready", "a second tap while it paints waits for the same paint");
  assert.equal(t.paid.length, 1, "one image for both taps");
  await t.call("POST", "/runs/:run/art/side", { key: "arlecchino" });
  assert.equal(t.paid.length, 1, "a ready sprite is never repainted");
});

test("the Engine's prompt review holds the sprite for the tap as Ask before painting does", async () => {
  const t = await sideWorld("r-side08-hhhhhh", { images: {}, replies: [json(ARLE_LOOK)] });
  const review = { reviewImagePrompts: true };
  await t.read(await t.scene(1, [ARLE_SAYS("One.")]), review);
  await t.read(await t.scene(2, [ARLE_SAYS("Two.")]), review);
  await until(async () => (await t.sides()).arlecchino?.art?.state === "waiting-consent", "held for the review");
  await t.settle();
  assert.equal(t.paid.length, 0, "nothing is sent before the player reviews the prompt");
});

test("a failed sprite is kept and painted again only by Retry", async () => {
  const t = await sideWorld("r-side06-ffffff", {
    images: {},
    replies: [json(ARLE_LOOK)],
    before: (_call, n) => {
      if (n === 1) throw new Error("provider refused");
    },
  });
  await t.read(await t.scene(1, [ARLE_SAYS("One.")]));
  await t.read(await t.scene(2, [ARLE_SAYS("Two.")]));
  await until(async () => (await t.sides()).arlecchino?.art?.state === "failed", "the paint failed");
  await t.tend();
  await t.call("GET", "/runs/:run");
  await t.settle();
  assert.equal(t.paid.length, 1, "never repainted by itself");
  const retry = await t.call("POST", "/runs/:run/art/side", { key: "arlecchino" });
  assert.equal(retry.body.art.state, "ready");
  assert.equal(t.paid.length, 2, "Retry paints once");
});

test("with the toggle off nothing is called, matched or painted; turning it on starts what is due", async () => {
  const t = await sideWorld("r-side07-gggggg", {
    images: { sideSprites: false },
    characters: CARDS,
    replies: [json(ARLE_LOOK)],
  });
  await t.read(await t.scene(1, [ARLE_SAYS("One."), line("Pantalone", "A recurring banker.")]));
  await t.read(await t.scene(2, [ARLE_SAYS("Two."), line("Pantalone", "Again.")]));
  await t.tend();
  await t.settle();
  const people = await t.sides();
  assert.ok(qualifies(people.pantalone!), "recorded and recurring all the same");
  assert.equal(people.arlecchino!.cardId, undefined, "no card is read while it is off");
  assert.equal(t.lookCalls().length, 0);
  assert.equal(t.paid.length, 0);
  const scene = await t.call("GET", "/runs/:run/art/scene", { key: "main-2", i: "0" });
  assert.equal(scene.body.sides, undefined, "the reader shows no side sprite");
  assert.equal((await t.call("POST", "/runs/:run/art/side", { key: "pantalone" })).body.code, "locked");

  const saved = await t.call("POST", "/runs/:run/settings", { images: { sideSprites: true } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.world.images.sideSprites, true);
  await until(() => t.paid.length === 2, "both sprites painted");
  await t.settle();
  assert.equal(t.lookCalls().length, 1, "Pantalone's look; Arlecchino is a card");
  assert.equal((await t.sides()).arlecchino!.cardId, "card-arle");
});

test("past the cap the oldest speakers neither holding nor painting an image go; the rest are never dropped", () => {
  const person = (n: number, art?: object) => ({
    name: `Clerk ${n}`,
    chapters: ["main-1"],
    at: `2026-11-08T00:${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}.000Z`,
    ...(art ? { art } : {}),
  });
  const ready = (n: number) => ({ state: "ready", url: `/x/s${n}.png`, ref: `global-gallery:s${n}`, at: "x" });
  // The ten oldest have sprites; the next three's wait for consent, failed, and are painting (paid already); 205 in all.
  const states = [
    { state: "waiting-consent", at: "x" },
    { state: "failed", at: "x", error: "no" },
    { state: "pending", at: "x" },
  ];
  const raw = Object.fromEntries(
    Array.from({ length: SIDE_PEOPLE_MAX + 5 }, (_, n) => [
      `clerk ${n}`,
      person(n, n < 10 ? ready(n) : states[n - 10]),
    ]),
  );
  // Every read and write of `${R}:sides` goes through normalizeSideCast, so this is the cap a paint's save meets too.
  const kept = normalizeSideCast({ version: 1, people: raw }).people;
  assert.equal(Object.keys(kept).length, SIDE_PEOPLE_MAX);
  for (let n = 0; n < 10; n += 1) assert.ok(kept[`clerk ${n}`]?.art?.ref, `clerk ${n}'s sprite is kept`);
  assert.equal(kept["clerk 12"]?.art?.state, "pending", "a sprite being painted is kept, so its save finds them");
  for (const n of [10, 11, 13, 14, 15])
    assert.equal(kept[`clerk ${n}`], undefined, `clerk ${n} is among the oldest without one`);
  assert.ok(kept[`clerk ${SIDE_PEOPLE_MAX + 4}`], "the newest speaker is kept");
});
