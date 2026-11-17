// Otome Forge 0.1.1: what the story's prompts carry of the player's own words, and how a love interest stands on stage.
// - The persona's description reaches every protagonist block whole (a story made before 0.1.1 reads it on its first
//   open), and the player's own writing style reaches the writing rules of every prompt that writes.
// - A love interest's look is painted on the chroma matte its colours name least (the Engine's sprite rule), the
//   protagonist's on mid-grey; the run view shows each of his images as its cut-out once one is ready, and says so.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { cutoutsSettled } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import {
  careNoteMessages,
  lookMatte,
  lookPrompt,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import {
  playerId,
  runDocTarget,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { KAI, beatReply, json, planReply, storyWorld } from "./fixtures/otome-forge-story.ts";

const text = (messages: CapabilityLanguageModelMessage[]) => messages.map((message) => message.content).join("\n");
const LONG = `ABOUT-START ${"She maps the harbour by night and trusts no lamp she did not light. ".repeat(40)}ABOUT-END`;

function runRoutes(t: Awaited<ReturnType<typeof storyWorld>>) {
  const routes = new Map<string, (request: unknown, reply: unknown) => unknown>();
  registerRunRoutes({ get: (path, handler) => routes.set(path, handler), post: () => undefined } as never, t.deps);
  return async (runKey: string) =>
    (
      (await routes.get("/runs/:run")!(
        { method: "GET", url: "/runs/:run", params: { run: runKey }, query: { timeZone: "UTC" } },
        { status: () => undefined, send: () => undefined },
      )) as { view: any }
    ).view;
}

test("the persona's whole description and the player's writing style reach the story's prompts", async () => {
  const runKey = "r-persona-aaaaaa";
  const replies = Array.from(
    { length: 20 },
    () => (messages: CapabilityLanguageModelMessage[]) =>
      messages.some((message) => message.content.includes("chapter planner")) ? json(planReply()) : json(beatReply()),
  );
  const t = await storyWorld({
    runKey,
    replies,
    personas: [{ id: "persona-ines", data: { id: "persona-ines", name: "Ines", description: LONG } }],
  });
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    writingStyle: "STYLE-MARK: present tense, second person. Show, don't tell.",
  }));

  // A story made before 0.1.1 has no copy: its first open reads the persona, whole, and keeps it.
  const view = await runRoutes(t)(runKey);
  assert.equal(view.player.about, LONG, "never clipped: the player wrote it");
  assert.equal((await t.store.readDoc(playerId(t.runId), normalizePlayer))!.about, LONG);

  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  assert.equal((await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, { key: "main-1", i: "0" })).status, 200);
  const plan = text(t.calls[0]!.messages);
  const scene = text(t.calls.find((call) => text(call.messages).includes("Narrate node 1 of"))!.messages);
  for (const prompt of [plan, scene]) {
    assert.ok(
      prompt.includes(`Who they are (their persona): ${LONG}`),
      "the whole description, in every protagonist block",
    );
  }
  assert.match(
    scene,
    /HOW THE PLAYER WANTS IT WRITTEN \(follow it in every line you write; the content contract still holds\):\nSTYLE-MARK: present tense, second person\. Show, don't tell\./,
  );

  // The Caring message builds its own rules, and carries the style and the persona there too.
  const world = (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  const care = text(
    careNoteMessages({
      world,
      player: { name: "Ines", pronouns: { subject: "she", object: "her", possessive: "her" }, about: LONG },
      unit: { name: "Kai", pronouns: { subject: "he", object: "him", possessive: "his" }, bible: null },
      careLine: "Ines has told you: today is day 2 of her period.",
    }),
  );
  assert.match(care, /How the player wants it written \(follow it; these rules still hold\): STYLE-MARK/);
  assert.ok(care.includes(`Who they are (their persona): ${LONG}`));
});

test("a look's clothes choose its matte, so a plum cardigan is never keyed on magenta (2026-11-17)", () => {
  // The maintainer's pinafore look: a plum cardigan and green tights border the backdrop, the blue is her eyes.
  const outfit = "ochre corduroy pinafore dress, plum knit cardigan, dark green wool tights";
  assert.equal(lookMatte(outfit, "pale skin, blue eyes, shoulder-length blonde hair"), "chroma cyan #00FFFF");
  assert.equal(lookMatte("burgundy wool knee socks, sage linen shirt"), "chroma cyan #00FFFF");
  assert.equal(lookMatte("navy coat, denim skirt", "green eyes"), "chroma magenta #FF00FF");
});

test("a look keeps only its likeness from the reference, never the reference's hood (2026-11-17)", () => {
  const world = normalizeWorld(undefined);
  const plain = { styleText: "anime style", positiveTags: "", negativeTags: "" };
  const mari = { name: "Mari", identityLine: "blue eyes, blonde hair", presentation: "woman" as const, world };
  const look = lookPrompt({ ...mari, outfitLine: "plum knit cardigan, ochre pinafore", style: plain, matte: true });
  assert.match(
    look.prompt,
    /\. If a reference picture of Mari is attached, use it only for Mari's face, hair and build: Mari wears only the outfit written here, never the clothes, hood, hat or accessories in that picture/,
  );
  assert.match(
    look.negativePrompt,
    /\bhood up, hooded, hat\b/,
    "an outfit naming no headwear keeps the reference's hood out",
  );
  const hooded = lookPrompt({ ...mari, outfitLine: "hooded wool cloak, brown boots", style: plain, matte: true });
  assert.doesNotMatch(hooded.negativePrompt, /hood up/, "an outfit with a hood keeps it");
  const tagged = lookPrompt({ ...mari, outfitLine: "plum cardigan", style: { ...plain, tagged: true }, matte: true });
  assert.doesNotMatch(tagged.prompt, /reference picture/, "a tag prompt gets no sentence");
  assert.match(tagged.negativePrompt, /hood up/);
  const base = lookPrompt({ ...mari, outfitLine: "", style: plain });
  assert.doesNotMatch(base.prompt, /reference picture/, "a look with no outfit written keeps the reference's clothes");
  assert.doesNotMatch(base.negativePrompt, /hood up/);
});

test("a love interest is painted on the matte his colours name least; the run view shows his cut-outs", async () => {
  assert.equal(lookMatte("grey eyes, salt-white hair, oilskin coat"), "chroma green #00FF00");
  assert.equal(lookMatte("green eyes, emerald waistcoat"), "chroma magenta #FF00FF");
  assert.equal(lookMatte("green eyes, pink ribbon, violet sash"), "chroma cyan #00FFFF");

  const runKey = "r-cutview-aaaaaa";
  const t = await storyWorld({ runKey });
  const cuts: string[] = [];
  t.deps.cutouts = {
    async cutOut(url) {
      cuts.push(url);
      return { id: `cut${cuts.length}`, url: `/api/global-gallery/file/cut-${cuts.length}.png` };
    },
    deleteGalleryImage: async () => true,
  };
  const portrait = "/api/global-gallery/file/kai-look.png";
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({ ...unit, portrait }));
  const view = runRoutes(t);

  // The first open queues the cut-out and shows the painted look meanwhile.
  const before = (await view(runKey)).lis.find((li: { id: string }) => li.id === KAI);
  assert.equal(before.portrait, portrait);
  assert.equal(before.cut, undefined);
  await cutoutsSettled();
  assert.deepEqual(cuts, [portrait], "cut out once");

  // From then on he is his cut-out, marked as one.
  const after = (await view(runKey)).lis.find((li: { id: string }) => li.id === KAI);
  assert.equal(after.portrait, "/api/global-gallery/file/cut-1.png");
  assert.deepEqual(after.cut, ["/api/global-gallery/file/cut-1.png"]);
  await view(runKey);
  await cutoutsSettled();
  assert.equal(cuts.length, 1, "never cut twice");
});

test("the run used by the reader polls free cut-out refreshes, keeps old art while pending, and stops after success or failure", async () => {
  const runKey = "r-cutrefresh-bbbbbb";
  const t = await storyWorld({ runKey });
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  let fail = false;
  const cuts: string[] = [];
  t.deps.cutouts = {
    cleanupRevision: async () => 2,
    async cutOut(url) {
      cuts.push(url);
      await gate;
      if (fail) throw new Error("temporary cleanup failure");
      return { id: "new-cut", url: "/new-cut.png", cleanupRevision: 2 };
    },
    deleteGalleryImage: async () => assert.fail("retained art is not deleted"),
  };
  const source = "/api/global-gallery/file/old-feather-look.png";
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait: source,
    cutouts: { [source]: { state: "ready", at: "old", url: "/old-cut.png" } },
  }));
  const view = runRoutes(t);
  const pending = await view(runKey);
  assert.equal(pending.cutoutsPending, true);
  assert.equal(pending.lis.find((li: { id: string }) => li.id === KAI).portrait, "/old-cut.png");
  release();
  await cutoutsSettled();
  const ready = await view(runKey);
  assert.equal(ready.cutoutsPending, undefined);
  assert.equal(ready.lis.find((li: { id: string }) => li.id === KAI).portrait, "/new-cut.png");
  fail = true;
  const secondSource = "/api/global-gallery/file/second-look.png";
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait: secondSource,
    cutouts: { ...unit.cutouts, [secondSource]: { state: "ready", at: "old", url: "/second-old-cut.png" } },
  }));
  assert.equal((await view(runKey)).cutoutsPending, true);
  await cutoutsSettled();
  const fallback = await view(runKey);
  assert.equal(fallback.cutoutsPending, undefined, "a failed free refresh stops polling");
  assert.equal(fallback.lis.find((li: { id: string }) => li.id === KAI).portrait, "/second-old-cut.png");
  assert.deepEqual(cuts, [source, secondSource]);
  assert.equal(t.calls.length, 0, "free cleanup never regenerates text or image prompts");
});
