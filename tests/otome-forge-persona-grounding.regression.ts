import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import {
  playerId,
  runDocTarget,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  aboutLine,
  normalizePlayer,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  readPersona,
  withPersonaImageAppearance,
  withPersonaStoryAbout,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/setup/prompts.ts";
import { KAI, beatReply, json, planReply, storyWorld } from "./fixtures/otome-forge-story.ts";

const body = (messages: CapabilityLanguageModelMessage[]) => messages.map((message) => message.content).join("\n");
const authored = (version: string) => ({
  id: "persona-ines",
  name: "Ines",
  description: `${version}-DESCRIPTION ${"She charts the harbour by night. ".repeat(160)}${version}-DESCRIPTION-END`,
  personality: `${version}-PERSONALITY ${"She values loyalty over titles. ".repeat(120)}${version}-PERSONALITY-END`,
  backstory: `${version}-BACKSTORY ${"Her family kept the northern lighthouse. ".repeat(120)}${version}-BACKSTORY-END`,
  appearance: `${version}-APPEARANCE ${"Silver hair and a weathered blue coat. ".repeat(120)}${version}-APPEARANCE-END`,
  scenario: "OMIT-ROLEPLAY-SCENARIO",
  first_mes: "OMIT-GREETING",
  mes_example: "OMIT-EXAMPLE-DIALOGUE",
  creatorNotes: "OMIT-CREATOR-NOTES",
  imageAppearanceEnabled: "true",
  imageAppearance: "IMAGE-ONLY-OVERRIDE",
});

function assertFields(prompt: string, fields: ReturnType<typeof authored>) {
  for (const key of ["description", "personality", "backstory", "appearance"] as const)
    assert.ok(prompt.includes(fields[key]), `complete authored ${key} reaches the model`);
  assert.ok(!prompt.includes("OMIT-"), "roleplay and metadata fields stay out of story grounding");
  assert.ok(!prompt.includes("IMAGE-ONLY-OVERRIDE"), "an image override is not story appearance");
}

function assertPersonaVoice(prompt: string) {
  assert.match(
    prompt,
    /When authoring the protagonist's dialogue, thoughts, reactions, choice-option intents\/labels or performed choice selections/,
  );
  assert.match(prompt, /ground their voice, motives and behaviour in these fields/);
  assert.match(prompt, /Keep choice options meaningfully distinct and preserve the player's agency/);
  assert.match(prompt, /never override or rewrite an accepted choice to fit the persona/);
}

const replies = () =>
  Array.from(
    { length: 20 },
    () => (messages: CapabilityLanguageModelMessage[]) =>
      json(messages[0]!.content.includes("chapter planner") ? planReply() : beatReply()),
  );

test("an existing run sends all current persona fields to chapter and scene generation without a prior UI read", async () => {
  const fields = authored("CURRENT");
  const t = await storyWorld({
    runKey: "r-personacanon-aaaaaa",
    replies: replies(),
    personas: [{ id: fields.id, data: fields }],
  });
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    about: "OLD-SAVED-DESCRIPTION",
  }));
  const writingStyle = `STYLE-FIRST ${"Use concrete verbs and a measured rhythm. ".repeat(180)} STYLE-LAST`;
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    writingStyle,
  }));
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  assert.equal((await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, { key: "main-1", i: "0" })).status, 200);
  await t.settle();
  const plan = t.calls.find((call) => body(call.messages).includes("chapter planner"));
  const scene = t.calls.find((call) => body(call.messages).includes("Narrate node 1 of"));
  assert.ok(plan && scene, "the real chapter planner and scene writer ran");
  for (const call of [plan, scene]) {
    const prompt = body(call.messages);
    assertFields(prompt, fields);
    assert.ok(prompt.includes("Treat these authored fields as the protagonist's canon"));
    assertPersonaVoice(prompt);
    assert.ok(prompt.includes(writingStyle), "the complete writing instructions still reach both model calls");
    assert.ok(prompt.includes("the content contract still holds"));
    assert.match(prompt, /Heat: SFW\./);
    assert.match(prompt, /Lines \(never written, not even implied\):/);
    assert.ok(!prompt.includes("OLD-SAVED-DESCRIPTION"));
  }
  assert.match(body(plan.messages), /Every player choice explicitly recorded in the story so far is settled canon/);
  assert.match(body(scene.messages), /Each choice has exactly 2, 3 or 4 distinct options/);
  assert.match(body(scene.messages), /The selection text is the protagonist's performed line\/action/);
  assert.match(body(scene.messages), /Use "action" for physical actions, decisions or nonverbal responses/);
});

test("persona voice guidance is conditional on authored protagonist content and leaves an empty persona block empty", () => {
  assert.equal(aboutLine({}), "");
  assert.equal(aboutLine({ about: "   " }), "");
  assertPersonaVoice(aboutLine({ about: "She answers carefully and keeps her own counsel." }));
});

test("a scene re-reads persona facts edited after its chapter was planned", async () => {
  let fields = authored("BEFORE");
  const t = await storyWorld({ runKey: "r-personarefr-bbbbbb", replies: replies() });
  t.deps.runtime.resources.listPersonas = async () => [{ id: fields.id, data: fields }];
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  assertFields(body(t.calls[0]!.messages), fields);
  fields = authored("AFTER");
  assert.equal((await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, { key: "main-1", i: "0" })).status, 200);
  await t.settle();
  const scene = t.calls.find((call) => body(call.messages).includes("Narrate node 1 of"));
  assert.ok(scene);
  assertFields(body(scene.messages), fields);
  assert.ok(!body(scene.messages).includes("BEFORE-BACKSTORY"));
});

test("story fields remain independent of image overrides and unavailable personas preserve the saved protagonist", async () => {
  const fields = authored("SEPARATE");
  const t = await storyWorld({ runKey: "r-personafall-cccccc", personas: [{ id: fields.id, data: fields }] });
  const player = (await t.store.readDoc(playerId(t.runId), normalizePlayer))!;
  const persona = await readPersona(t.deps.runtime, fields.id);
  assert.equal(persona?.appearance, fields.imageAppearance, "the existing image override still applies to images");
  assert.equal(persona?.authoredAppearance, fields.appearance);
  assertFields((await withPersonaStoryAbout(t.deps.runtime, player)).about!, fields);
  assert.equal((await withPersonaImageAppearance(t.deps.runtime, player)).look.identityLine, fields.imageAppearance);
  const saved = { ...player, about: "SAVED-OWN-PERSONA" };
  t.deps.runtime.resources.listPersonas = async () => [];
  assert.equal(await withPersonaStoryAbout(t.deps.runtime, saved), saved);
  t.deps.runtime.resources.listPersonas = async () => {
    throw new Error("persona resource unavailable");
  };
  assert.equal(await withPersonaStoryAbout(t.deps.runtime, saved), saved);
});
