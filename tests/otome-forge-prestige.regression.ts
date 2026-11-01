// Otome Forge #2025: prestige past level 10. Every 300 affection past level 10 is a prestige point and every three
// unlock one extra story with him (SH/economy.ts, derived from his points); a choice loss never takes an unlocked story
// back; POST /runs/:run/prestige/:li writes each unlocked story once (S/items/prestige.ts), planned by P25 with a kind
// this world may have (a kink only under NSFW Heat), the not-canon framing and his earlier stories to avoid; and the
// story is read like a Character Story, but imagined: its picks change nothing and it is no memory source.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type { RunState } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  nextPrestige,
  prestigeOf,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import {
  beatId,
  chapterId,
  runDocTarget,
  stateId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { normalizePrestigePlan } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/items/prestige.ts";
import {
  prestigePlanMessages,
  type PrestigePlanReply,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/items/prompts.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  normalizeState,
  toRunView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { applyChoiceEffects } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/relationship.ts";
import { CAST, KAI, MIR, beatReply, bible, json, storyWorld } from "./fixtures/otome-forge-story.ts";

/** Level 10 is reached at 2700 affection. */
const L10 = 2700;
const PLANNER = "You are the Extra Story planner";

/** A valid P25 reply: a what-if for Kai, three nodes (Mireille named in one is left out). */
function prestigePlan(changes: Partial<PrestigePlanReply> = {}): PrestigePlanReply {
  return {
    kind: "what-if",
    premise: "PREMISE-WEDDING: the wedding they would have if the lanterns never went out.",
    title: "If the Lanterns Stayed Lit",
    tags: [],
    summary: "A wedding, imagined in the lamp room.",
    nodes: [
      { kind: "beat", guide: "Kai dares Ines to picture the wedding.", cast: [KAI] },
      { kind: "moment", moment: "read-him", guide: "Ines reads Kai's face at the vows.", cast: [KAI, "Mireille"] },
      { kind: "beat", guide: "They come back to the lamp, laughing.", cast: [KAI] },
    ],
    ...changes,
  };
}

const system = (messages: ReadonlyArray<{ content: string }>) => messages[0]!.content;
const user = (messages: ReadonlyArray<{ content: string }>) => messages.at(-1)!.content;

test("prestige is derived from his points: none below level 10, a point per 300 past it, a story per three", () => {
  const zero = { unlocked: 0, points: 0, current: 0, required: 300 };
  assert.deepEqual(prestigeOf(0), zero, "below level 10: none");
  assert.deepEqual(prestigeOf(L10 - 1), zero, "below level 10: none");
  assert.deepEqual(prestigeOf(L10), zero, "exactly level 10: no point yet");
  assert.deepEqual(prestigeOf(L10 + 299), { ...zero, current: 299 });
  assert.deepEqual(prestigeOf(L10 + 300), { ...zero, points: 1 }, "+300: one point");
  assert.deepEqual(prestigeOf(L10 + 600), { ...zero, points: 2 });
  assert.deepEqual(prestigeOf(L10 + 900), { ...zero, unlocked: 1 }, "+900: one story, and the points start again");
  assert.deepEqual(prestigeOf(L10 + 2000), { ...zero, unlocked: 2, current: 200 }, "+2000: two stories, 200/300");
  assert.deepEqual(prestigeOf(Number.NaN), zero);
  assert.deepEqual(
    [nextPrestige(L10 + 899, 0), nextPrestige(L10 + 900, 0), nextPrestige(L10 + 900, 1)],
    [null, 1, null],
  );
  assert.equal(nextPrestige(L10 + 2000, 1), 2, "the next one is the first not written");
});

test("the run view shows prestige at level 10 only, never his points", () => {
  const unit = normalizeUnit({ id: KAI, name: "Kai", source: "archetype" })!;
  const view = (points: number) =>
    JSON.parse(
      JSON.stringify(
        toRunView(
          "r-prestige-abcdef",
          normalizeWorld({}),
          normalizePlayer({}),
          [unit],
          normalizeState({ lis: { [KAI]: { points } } }),
        ),
      ),
    ).lis[0];
  assert.equal("prestige" in view(L10 - 1), false, "below level 10 there is no prestige");
  assert.deepEqual(view(L10).prestige, { unlocked: 0, points: 0, current: 0, required: 300 });
  const past = view(L10 + 2000);
  assert.equal(past.level, 10);
  assert.deepEqual(past.prestige, { unlocked: 2, points: 0, current: 200, required: 300 });
  assert.equal("points" in past, false, "his affection points stay private");
});

test("a choice loss never takes an unlocked extra story back", () => {
  const hurt = (points: number) => {
    const state = normalizeState({ lis: { [KAI]: { points } } });
    return applyChoiceEffects(state, [{ li: KAI, trust: -1 }], { key: "main-1", choice: "choice-1", at: "x", i: 0 })
      .state.lis[KAI]!.points;
  };
  assert.equal(hurt(L10 + 900), L10 + 900, "the story just unlocked stays unlocked");
  assert.equal(prestigeOf(hurt(L10 + 900)).unlocked, 1);
  assert.equal(hurt(L10 + 905), L10 + 900);
  assert.equal(hurt(L10 + 1800), L10 + 1800, "the second one too");
  assert.equal(hurt(L10 + 950), L10 + 935, "within a cycle, points may fall as they do within a level");
  assert.equal(hurt(L10 + 5), L10, "level 10 itself still holds");
  assert.equal(hurt(305), 300, "below level 10 nothing changes");
  assert.equal(hurt(320), 305);
});

test("P25 offers a kink only under NSFW Heat, always frames the story as imagined and lists his earlier ones", () => {
  const unit = normalizeUnit({
    id: KAI,
    name: "Kai",
    source: "archetype",
    bible: bible({ intimacy: { preferences: ["TASTE-SLOW-BURN"], attractions: ["TASTE-CONFIDENCE"] } }),
  })!;
  const state = normalizeState({ lis: { [KAI]: { points: L10 + 1800, stage: 6 } } });
  const player = normalizePlayer({ name: "Ines" });
  const messages = (heat: "sfw" | "explicit", earlier: Parameters<typeof prestigePlanMessages>[0]["earlier"] = []) =>
    prestigePlanMessages({
      world: normalizeWorld({ language: "English", content: { ...defaultContent(), heat } }),
      player,
      unit,
      state,
      n: earlier.length + 1,
      earlier,
      memory: "",
    });

  const sfw = messages("sfw");
  assert.ok(system(sfw).includes("NOT canon for the main story"), "never canon");
  assert.ok(system(sfw).includes("imagine or play out together, for fun"));
  assert.ok(system(sfw).includes('"kind": "what-if|au"'));
  assert.ok(system(sfw).includes("- what-if: ") && system(sfw).includes("- au: "));
  assert.ok(!/kink/i.test(system(sfw) + user(sfw)), "no kink is offered under SFW");
  assert.ok(!user(sfw).includes("TASTE-SLOW-BURN"), "his tastes stay out of an SFW story");
  assert.ok(user(sfw).includes("EARLIER EXTRA STORIES (never repeat one)\n(none yet)"));
  assert.ok(system(sfw).includes("CONTENT CONTRACT"));

  const explicit = messages("explicit", [
    { title: "If the Lanterns Stayed Lit", kind: "what-if", premise: "PREMISE-WEDDING: their wedding." },
  ]);
  assert.ok(system(explicit).includes('"kind": "kink|what-if|au"'));
  assert.ok(system(explicit).includes("- kink: the two of them explore a kink together"));
  assert.ok(system(explicit).includes("NOT canon for the main story"));
  assert.ok(user(explicit).includes("TASTE-SLOW-BURN"), "his tastes inform a kink under NSFW Heat");
  assert.ok(user(explicit).includes("- [what-if] If the Lanterns Stayed Lit: PREMISE-WEDDING: their wedding."));
  assert.ok(user(explicit).includes("Plan extra story 2 with Kai now"));
});

test("P25's reply is checked: a kind this world has (no kink under SFW), a premise, him alone, no ledger", () => {
  const context = (heat: "sfw" | "fade" | "explicit") => ({
    units: CAST,
    state: normalizeState({ lis: { [KAI]: {}, [MIR]: {} } }),
    world: { content: { ...defaultContent(), heat } },
    li: KAI,
  });
  assert.equal(
    normalizePrestigePlan(prestigePlan({ kind: "space-opera" }), context("sfw")),
    "kind must be one of what-if, au",
  );
  assert.equal(
    normalizePrestigePlan(prestigePlan({ kind: "kink" }), context("sfw")),
    "kind must be one of what-if, au",
  );
  assert.equal(normalizePrestigePlan(prestigePlan({ premise: "  " }), context("sfw")), "premise is empty");
  assert.match(
    String(normalizePrestigePlan(prestigePlan({ nodes: prestigePlan().nodes.slice(0, 2) }), context("sfw"))),
    /3 to 5 nodes/,
  );
  const kink = normalizePrestigePlan(prestigePlan({ kind: " Kink " }), context("fade"));
  assert.ok(typeof kink !== "string", String(kink));
  assert.equal(kink.prestige.kind, "kink", "NSFW Heat opens the kink kind");
  const plan = normalizePrestigePlan(prestigePlan({ kind: "AU" }), context("sfw"));
  assert.ok(typeof plan !== "string", String(plan));
  assert.deepEqual(plan.prestige, { kind: "au", premise: prestigePlan().premise });
  for (const node of plan.nodes) assert.deepEqual(node.cast, [KAI], "only he is in it");
  assert.deepEqual(plan.ledger, { relationship: [], conflict: [], offscreen: [] }, "nothing in it is canon");
});

test("each unlocked extra story is written once, however often it is asked for, and only once unlocked", async () => {
  const t = await storyWorld({
    runKey: "r-prestige-aaaaaa",
    lis: { [KAI]: { points: L10 + 900 }, [MIR]: { points: L10 + 800 } },
    replies: [
      json(prestigePlan()),
      json(prestigePlan({ kind: "au", title: "Vampire Harbour", premise: "PREMISE-VAMPIRE: the harbour at night." })),
    ],
  });
  const claim = (li: string) => t.call("POST", "/runs/:run/prestige/:li", {}, { li });
  const key = `prestige-${KAI}-1`;
  assert.deepEqual((await t.call("GET", "/runs/:run/story")).body.prestige, [{ li: KAI, key }]);

  const [a, b] = await Promise.all([claim(KAI), claim(KAI)]);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(a.body.chapter.key, key);
  assert.equal(b.body.chapter.key, key);
  assert.equal(t.calls.length, 1, "two taps plan one story");
  assert.equal("prestige" in a.body.chapter, false, "the premise stays on the server");
  const chapter = (await t.store.readDoc(chapterId(t.runId, key), normalizeChapter))!;
  assert.equal(chapter.kind, "story");
  assert.equal(chapter.li, KAI);
  assert.deepEqual(chapter.prestige, { kind: "what-if", premise: prestigePlan().premise });
  assert.ok(chapter.nodes.every((node) => node.cast.length === 1 && node.cast[0] === KAI));
  const [planned] = t.calls;
  assert.ok(system(planned!.messages).includes(PLANNER));
  assert.ok(user(planned!.messages).includes("(none yet)"));

  const story = (await t.call("GET", "/runs/:run/story")).body;
  assert.deepEqual(story.prestige, [], "a written story is no longer waiting");
  assert.ok(
    story.chapters.some((entry: { key: string }) => entry.key === key),
    "it is listed like his other stories",
  );
  const again = await claim(KAI);
  assert.equal(again.body.chapter.key, key, "with nothing new unlocked, the same story");
  assert.equal(t.calls.length, 1);
  const early = await claim(MIR);
  assert.equal(early.status, 409, "Mireille is 100 short of her first");
  assert.equal(early.body.code, "locked");
  assert.equal(t.calls.length, 1);

  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state: RunState) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, points: L10 + 2000 } },
  }));
  assert.deepEqual((await t.call("GET", "/runs/:run/story")).body.prestige, [{ li: KAI, key: `prestige-${KAI}-2` }]);
  const second = await claim(KAI);
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.chapter.key, `prestige-${KAI}-2`);
  assert.equal(t.calls.length, 2);
  assert.ok(
    user(t.calls[1]!.messages).includes(`- [what-if] ${prestigePlan().title}: ${prestigePlan().premise}`),
    "the planner is told his earlier story, so it is never repeated",
  );
  assert.equal((await claim(KAI)).body.chapter.key, `prestige-${KAI}-2`);
  assert.equal(t.calls.length, 2);
});

test("an extra story plays as his private side story, imagined: its picks change nothing and it is never canon", async () => {
  const told = beatReply({
    choices: [
      {
        kind: "small",
        at: 2,
        options: [
          {
            text: "Say yes",
            selection: { kind: "dialogue", text: "Yes. In this one, yes." },
            segments: [{ speaker: "Kai", text: "Then it's settled." }],
            effects: [
              { li: KAI, trust: -1, disclose: "She told him her brother drowned." },
              { li: KAI, grievance: { by: "li", text: "She laughed at the vows.", severity: "rupture" } },
            ],
          },
          {
            text: "Laugh",
            selection: { kind: "action", text: "You laugh." },
            segments: [{ speaker: "", text: "The lamp turns." }],
          },
        ],
      },
    ],
  });
  const replies = Array.from({ length: 8 }, () => (messages: CapabilityLanguageModelMessage[]) => {
    if (system(messages).includes(PLANNER)) return json(prestigePlan());
    return json(user(messages).includes("Narrate node 1 of") ? told : beatReply());
  });
  const t = await storyWorld({ runKey: "r-prestigeplay-aaaaaa", lis: { [KAI]: { points: L10 + 900 } }, replies });
  const key = `prestige-${KAI}-1`;
  assert.equal((await t.call("POST", "/runs/:run/prestige/:li", {}, { li: KAI })).status, 200);
  const before = await t.state();

  const node = (i: number) => ({ key, i: String(i) });
  const written = await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, node(0));
  assert.equal(written.status, 200, JSON.stringify(written.body));
  await t.settle();
  const narrated = t.calls.find((call) => user(call.messages).includes("Narrate node 1 of"))!;
  assert.ok(user(narrated.messages).includes("Kai's extra story, imagined together (not canon)"));
  assert.ok(
    user(narrated.messages).includes("EXTRA STORY of Kai's, a what-if of their life together: PREMISE-WEDDING"),
  );
  assert.ok(user(narrated.messages).includes("It is NOT canon"));
  assert.ok(!user(narrated.messages).includes("CHARACTER STORY"), "not framed as a canon Character Story");
  assert.deepEqual((await t.store.readDoc(beatId(t.runId, key, 0), normalizeBeat))!.effects, {});

  const picked = await t.call(
    "POST",
    "/runs/:run/chapters/:key/beats/:i/choose",
    { choice: "choice-1", option: "option-1" },
    node(0),
  );
  assert.equal(picked.status, 200, JSON.stringify(picked.body));
  assert.equal(picked.body.remembered, false);
  for (const i of [0, 1, 2]) {
    assert.equal((await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, node(i))).status, 200);
    const read = await t.call("POST", "/runs/:run/chapters/:key/beats/:i/read", { segment: 2 }, node(i));
    assert.equal(read.status, 200, JSON.stringify(read.body));
    assert.deepEqual(read.body.grants, [{ source: "beat", starlight: 30 }], "it pays its beats, like a side story");
  }
  const after = await t.state();
  assert.ok(after.chapters[key]?.completed, "read to its end");
  assert.deepEqual(after.lis[KAI], before.lis[KAI], "no trust, grievance, rupture, disclosure or affection moved");
  assert.deepEqual(after.ledgers, before.ledgers);
  const sources = await readMemorySources(t.store, t.runId);
  assert.ok(!sources.some((source) => source.id === key), "an imagined story is no memory source");
  assert.ok(!sources.some((source) => source.content.includes("Then it's settled.")));
});
