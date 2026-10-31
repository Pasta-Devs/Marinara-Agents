// Otome Forge: the prologue (S/story/prologue.ts). Begin opens a one-scene chapter in the reader: the protagonist alone
// before chapter 1, a scene like any other (places, music, choices) with no love interest shown or named. It is made
// without a model call, a scene that names a love interest is sent back for its repair turn, it pays Starlight and no
// affection, no love interest may know it, and chapter 1's first scene is given its canon to pick up from.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import {
  runDocTarget,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { prologueProblem } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prologue.ts";
import { KAI, beatReply, json, planReply, storyWorld } from "./fixtures/otome-forge-story.ts";

const text = (messages: CapabilityLanguageModelMessage[]) => messages.map((message) => message.content).join("\n");
const isPlanner = (messages: CapabilityLanguageModelMessage[]) => messages[0]!.content.includes("chapter planner");
const isPrologue = (messages: CapabilityLanguageModelMessage[]) => text(messages).includes("This is the PROLOGUE");
const beatPath = "/runs/:run/chapters/:key/beats/:i";

const CHOICE = (branch: string) => ({
  kind: "small",
  at: 1,
  options: [
    {
      text: "Finish the chart tonight",
      selection: { kind: "action", text: "PROLOGUE-CHOICE: you light another candle." },
      segments: [{ speaker: "", text: branch }],
    },
    {
      text: "Go to bed",
      selection: { kind: "action", text: "You blow out the candle." },
      segments: [{ speaker: "", text: "Sleep comes quickly." }],
    },
  ],
});
/** Kai is only in a choice's branch: the check reads what the player reads, not only the mainline. */
const NAMES_KAI = beatReply({
  segments: [
    { speaker: "", text: "The quay is quiet.", place: "The Quay" },
    { speaker: "Ines", text: "Third night this week.", thought: true },
  ],
  choices: [CHOICE("Kai would laugh at you for this.")],
});
const PROLOGUE = beatReply({
  places: [{ name: "The Quay", tags: "harbour quay at dawn, lanterns, no humans" }],
  segments: [
    { speaker: "", text: "Dawn finds you on the quay with ink on your fingers.", place: "The Quay" },
    { speaker: "Ines", text: "Third night this week the lamps burned low.", thought: true },
    { speaker: "Old Bren", text: "Map's not going to finish itself, girl." },
    { speaker: "", text: "PROLOGUE-END: down the quay, the first lantern gutters." },
  ],
  choices: [CHOICE("The chart grows by a street.")],
});

async function getView(t: Awaited<ReturnType<typeof storyWorld>>, runKey: string) {
  const routes = new Map<string, (request: unknown, reply: unknown) => unknown>();
  registerRunRoutes({ get: (path, handler) => routes.set(path, handler), post: () => undefined } as never, t.deps);
  const result = (await routes.get("/runs/:run")!(
    { method: "GET", url: "/runs/:run", params: { run: runKey }, query: { timeZone: "UTC" } },
    { status: () => undefined, send: () => undefined },
  )) as { view: { prologue?: boolean; starlight: number } };
  return result.view;
}

test("Begin's prologue is a scene of the protagonist's own, and chapter 1 opens where it ends", async () => {
  const runKey = "r-prologue-aaaaaa";
  let prologueScenes = 0;
  const replies = Array.from({ length: 40 }, () => (messages: CapabilityLanguageModelMessage[]) => {
    if (isPlanner(messages)) return json(planReply());
    if (isPrologue(messages)) return json(prologueScenes++ === 0 ? NAMES_KAI : PROLOGUE);
    return json(beatReply());
  });
  const t = await storyWorld({ runKey, replies });

  // The chapter is made at once, with no model call, and only once.
  const made = await t.call("POST", "/runs/:run/prologue");
  assert.equal(made.status, 200, JSON.stringify(made.body));
  assert.deepEqual(
    [made.body.chapter.key, made.body.chapter.kind, made.body.chapter.nodes],
    ["prologue", "prologue", [{ i: 0, kind: "beat" }]],
  );
  assert.equal(t.calls.length, 0);
  assert.deepEqual((await t.call("POST", "/runs/:run/prologue")).body, made.body);
  assert.equal((await getView(t, runKey)).prologue, false, "not read yet: Begin opens it");

  // Its scene: framed as the prologue, the cast kept out by name, and a reply that names one sent back.
  const served = await t.call("POST", beatPath, {}, { key: "prologue", i: "0" });
  assert.equal(served.status, 200, JSON.stringify(served.body));
  assert.equal(prologueScenes, 2, "a scene that names a love interest gets the repair turn");
  const repair = t.calls.find((call) =>
    /Kai is a love interest: the prologue is the protagonist's alone/.test(text(call.messages)),
  );
  assert.ok(repair, "the repair turn says why");
  const prompt = text(t.calls.find((call) => isPrologue(call.messages))!.messages);
  assert.match(prompt, /No love interest is in this node\./);
  assert.match(prompt, /Never name Kai, Mireille, Sol\./);
  assert.match(
    prompt,
    /End where the story opens, right after the prologue, without playing it out: The lanterns along the quay go dark one by one\./,
  );
  assert.match(prompt, /CHAPTER: The Lantern Court \(the prologue, before chapter 1\)/);
  assert.doesNotMatch(prompt, /The story opens here:/, "the opening situation is where it ends, not where it starts");
  assert.doesNotMatch(prompt, /This is the chapter's last node/, "the prologue keeps its own choices (#1949)");
  assert.deepEqual(
    served.body.beat.segments.map((segment: { speaker: string }) => segment.speaker),
    ["", "Ines", "Old Bren", ""],
  );
  assert.deepEqual(
    served.body.beat.places.map((place: { name: string }) => place.name),
    ["The Quay"],
  );

  // Its choice is canon, as in any scene.
  const pick = served.body.beat.choices[0];
  const chosen = await t.call(
    "POST",
    `${beatPath}/choose`,
    { choice: pick.id, option: pick.options[0].id },
    { key: "prologue", i: "0" },
  );
  assert.equal(chosen.status, 200, JSON.stringify(chosen.body));

  // Read to its end: Starlight for the scene, no affection for anyone, and Begin now goes straight Home.
  const before = (await t.state()).lis;
  const read = await t.call("POST", `${beatPath}/read`, { segment: 99 }, { key: "prologue", i: "0" });
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.equal(read.body.chapterDone, true);
  assert.ok(read.body.grants.length > 0);
  assert.ok(
    read.body.grants.every((grant: { li?: string }) => !grant.li),
    "no love interest earns from it",
  );
  assert.deepEqual((await t.state()).lis, before);
  assert.equal((await getView(t, runKey)).prologue, true);
  // No love interest was there: it is no memory source, for anyone.
  const sources = await readMemorySources(t.store, t.runId);
  assert.ok(!JSON.stringify(sources).includes("PROLOGUE-END"));

  // The Story screen lists it first.
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  const story = await t.call("GET", "/runs/:run/story");
  assert.deepEqual(
    story.body.chapters.map((chapter: { key: string }) => chapter.key),
    ["prologue", "main-1"],
  );

  // Chapter 1's first scene picks up from the prologue's canon; its second never sees it.
  assert.equal((await t.call("POST", beatPath, {}, { key: "main-1", i: "0" })).status, 200);
  await t.settle();
  const scene = (n: number) =>
    t.calls.find((call) => !isPrologue(call.messages) && text(call.messages).includes(`Narrate node ${n} of`));
  const opening = text(scene(1)!.messages);
  assert.match(opening, /The story opens here: The lanterns along the quay go dark one by one\./);
  assert.match(opening, /The prologue, the protagonist alone before they meet anyone in this story, ended like this/);
  assert.match(opening, /PROLOGUE-END: down the quay, the first lantern gutters\./);
  // The choice taken leads, so a long prologue's ending can't lose it.
  assert.match(
    opening,
    /What the protagonist chose in it \(who they are from now on\):\n- Finish the chart tonight\. PROLOGUE-CHOICE: you light another candle\./,
  );
  assert.ok(scene(2), "the lookahead wrote node 2");
  assert.doesNotMatch(text(scene(2)!.messages), /PROLOGUE-END/);
});

test("the prologue refuses a love interest by name in any line", () => {
  const units = [{ name: "Kai" }, { name: "Mireille" }];
  assert.match(
    String(prologueProblem({ segments: [{ speaker: "", text: "You think of mireille's ledger." }] }, units)),
    /Mireille is a love interest/,
  );
  assert.equal(
    prologueProblem({ segments: [{ speaker: "", text: "Kaimana Street is quiet." }] }, units),
    null,
    "a name inside a word",
  );
  // A name in a script written without word spaces is found inside the running text.
  assert.match(
    String(prologueProblem({ segments: [{ speaker: "", text: "あなたはカイの店の前を通る。" }] }, [{ name: "カイ" }])),
    /カイ is a love interest/,
  );
  assert.match(
    String(prologueProblem({ segments: [{ speaker: "", text: "你想起了李白的诗。" }] }, [{ name: "李白" }])),
    /李白 is a love interest/,
  );
  // Korean spaces its words: 민 with its particle is the name, 민 inside 시민 ("citizen") is not.
  assert.match(
    String(prologueProblem({ segments: [{ speaker: "", text: "민이 웃었다." }] }, [{ name: "민" }])),
    /민 is a love interest/,
  );
  assert.equal(prologueProblem({ segments: [{ speaker: "", text: "시민이 모였다." }] }, [{ name: "민" }]), null);
  // A Latin-spelled name written straight against kana or Han is still a whole word there.
  assert.match(
    String(prologueProblem({ segments: [{ speaker: "", text: "あなたはKaiの店の前を通る。" }] }, [{ name: "Kai" }])),
    /Kai is a love interest/,
  );
  assert.match(
    String(prologueProblem({ segments: [{ speaker: "", text: "Kai가 웃었다." }] }, [{ name: "Kai" }])),
    /Kai is a love interest/,
  );
  for (const text of ["スーパーKaiー", "ーKaiの話"]) {
    assert.match(
      String(prologueProblem({ segments: [{ speaker: "", text }] }, [{ name: "Kai" }])),
      /Kai is a love interest/,
    );
  }
});

test("the prologue waits for the forge", async () => {
  const t = await storyWorld({ runKey: "r-prologue-bbbbbb" });
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    forge: { phase: "forging", steps: [] },
  }));
  const early = await t.call("POST", "/runs/:run/prologue");
  assert.equal(early.status, 409);
  assert.equal(early.body.code, "conflict");
});
