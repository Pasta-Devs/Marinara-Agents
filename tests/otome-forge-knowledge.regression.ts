// Otome Hearth (#1955): what the protagonist knows, an existing world's canon, minor characters and time to rest.
// - Every prompt that writes story or a love interest's words, and the bible, says the protagonist knows only what the
//   story has shown them (never a card or a bible), and that an existing world's canon holds.
// - The world plan (P2) names an existing world as it is; the Surprise me premise stays original.
// - The chapter planner (P5) gives minor characters parts and lets a node go without any love interest; P5, P10 and P11
//   let time pass, with rest or sleep. A route or repair chapter keeps its love interest in every node.
import assert from "node:assert/strict";
import test from "node:test";
import type { Unit } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { noteMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/prompts.ts";
import { chatReplyMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/prompts.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  defaultLiState,
  normalizeState,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  bibleMessages,
  premiseMessages,
  worldPlanMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/setup/prompts.ts";
import {
  betweenYou,
  beatMessages,
  chapterPlanMessages,
  closerMessages,
  confrontationMessages,
  repairPlanMessages,
  routePlanMessages,
  stageGoal,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import { bannerPlanMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/prompts.ts";
import { CAST, HE, KAI, MIR, SHE, at, bible } from "./fixtures/otome-forge-story.ts";

const text = (messages: Array<{ content: string }>) => messages.map((message) => message.content).join("\n");

const KNOWS = "The protagonist knows only what the story has shown them and what their own persona would know.";
const NEWCOMER = "A newcomer to this world knows none of its people, places, customs or terms yet.";
const CARD = "A card or bible is for writing a character, never what the protagonist knows:";
const UNTIL = "Until then the protagonist does not understand them, and nobody talks to the protagonist as if they do.";
const CANON = "When the story is set in an existing world from a game, book, film or show (such as Teyvat from Genshin";
const OTHERS = "- The world has other people: give named minor characters";
const ALONE = "a node may be theirs alone or with others (cast [])";
const TIME = "- Time passes as in a life: the protagonist eats, rests and sleeps.";

function inputs() {
  const world = normalizeWorld({
    title: "The Lantern Court",
    premise: "In Teyvat, the lanterns of Liyue Harbor go dark one by one.",
    setting: "Liyue Harbor in Teyvat, where the Qixing rule and the lanterns must never go out.",
    mystery: { question: "Who puts out the lanterns?", truth: "The harbour master.", pieces: {} },
    connections: { narration: "conn-text" },
  });
  const units: Unit[] = CAST.map((li) => ({
    ...normalizeUnit({}),
    id: li.id,
    name: li.name,
    pronouns: HE,
    bible: bible({ look: { identityLine: "tall man", outfitLine: "keeper's coat", presentation: "man" } }),
  }));
  const player = { ...normalizePlayer({}), name: "Ines", pronouns: SHE };
  const state = normalizeState({ lis: Object.fromEntries(CAST.map((li) => [li.id, defaultLiState()])) });
  return { world, units, player, state };
}

test("every prompt that writes story or a love interest's words knows only what the story has shown the protagonist", () => {
  const input = inputs();
  const { world, units, player, state } = input;
  const kai = units.find((unit) => unit.id === KAI)!;
  const node = { i: 0, kind: "beat" as const, guide: "Kai speaks of the harbour's old wards.", cast: [KAI] };
  const prompts: Record<string, string> = {
    scene: text(
      beatMessages({
        ...input,
        chapter: { kind: "main", number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [node] },
        node,
        storySoFar: "",
        memory: "",
      }),
    ),
    chapterPlan: text(chapterPlanMessages({ ...input, number: 2, lead: KAI, memory: "" })),
    note: text(
      noteMessages({
        world,
        player,
        unit: kai,
        liState: state.lis[KAI]!,
        today: { weekday: "Wednesday", hour: 9, special: [] },
        recalled: "",
        offscreen: "",
        recent: [],
        curt: false,
      }),
    ),
    chat: text(
      chatReplyMessages({
        world,
        player,
        unit: kai,
        liState: state.lis[KAI]!,
        tail: [{ id: "m-1", who: "player", text: "Are you awake?", at }],
        memories: [],
        story: "",
        offscreen: "",
      }),
    ),
    banner: text(bannerPlanMessages({ kind: "memories", ...input, featured: kai, earlierTitles: [], memory: "" })),
    bible: text(bibleMessages({ world, player, member: { unit: kai }, others: [] })),
  };
  for (const [kind, prompt] of Object.entries(prompts)) {
    for (const rule of [KNOWS, NEWCOMER, CARD, UNTIL, CANON]) assert.ok(prompt.includes(rule), `${kind}: ${rule}`);
  }
});

test("the world plan names an existing world as it is; the Surprise me premise stays original", () => {
  const { world, units, player } = inputs();
  const plan = text(worldPlanMessages({ world, player, cast: units.map((unit) => ({ unit })) }));
  assert.match(
    plan,
    /- setting: [^\n]*When the premise or a love interest's card sets the story in an existing world from a game, book, film or show \(such as Teyvat from Genshin Impact\), the setting is that world, named as it is, with its canon intact; only this story's situation is new\./,
  );
  assert.match(
    plan,
    /- In an existing world, the mystery, the pieces and the web fit its canon: [^\n]*never contradict it\./,
  );
  // The premise writer invents one, so it keeps away from existing media.
  const premise = text(premiseMessages("English"));
  assert.match(premise, /No real people, and no names, places or characters from existing books, films, games/);
  assert.ok(!premise.includes(CANON));
});

test("P5 gives minor characters parts and nodes without a love interest; P5, P10 and P11 let the protagonist rest", () => {
  const input = inputs();
  const arc = { ...input, li: KAI, memory: "" };
  const chapter = text(chapterPlanMessages({ ...input, number: 2, lead: KAI, memory: "" }));
  const route = text(routePlanMessages({ ...arc, stage: 2 }));
  const repair = text(
    repairPlanMessages({ ...arc, grievance: { id: "g1", text: "The lamp was left dark.", by: "li" } }),
  );
  assert.ok(chapter.includes(OTHERS) && chapter.includes(ALONE), "a main chapter");
  for (const [kind, prompt] of Object.entries({ chapter, route, repair })) {
    assert.ok(prompt.includes(TIME), `${kind} lets time pass`);
    assert.match(prompt, /give a node, or part of one, to rest: settling down, sleep, waking up\./, kind);
  }
  // A route or repair chapter is that love interest's own: they stay in every node.
  for (const [kind, prompt] of Object.entries({ route, repair })) {
    assert.ok(!prompt.includes(ALONE), `${kind} never plans a node without its love interest`);
    assert.match(prompt, /Kai is in every node/, kind);
  }
});

test("every scene writer asks the protagonist to sit with what matters to them, in thought", () => {
  const input = inputs();
  const THOUGHTS =
    /The protagonist may think freely\. They are a person, not a camera: when something that matters to them happens \(a first kiss, sex, a quarrel, a secret learned\)[^\n]*with their persona's doubts, insecurities and hopes showing through\./;
  const node = { i: 0, kind: "beat" as const, guide: "The morning after.", cast: [KAI] };
  const fight = { i: 0, kind: "confrontation" as const, guide: "It comes out.", cast: [KAI] };
  const close = { ...fight, kind: "closer" as const };
  const chapter = (nodes: Array<typeof node | typeof fight | typeof close>) =>
    ({ kind: "main", number: 2, title: "Rain", lead: KAI, foil: MIR, nodes }) as const;
  const prompts = {
    scene: beatMessages({ ...input, chapter: chapter([node]), node, storySoFar: "", memory: "" }),
    confrontation: confrontationMessages({
      ...input,
      chapter: chapter([fight]),
      node: fight,
      storySoFar: "",
      memory: "",
      li: KAI,
    }),
    closer: closerMessages({ ...input, chapter: chapter([close]), node: close, storySoFar: "", memory: "", li: KAI }),
  };
  for (const [kind, messages] of Object.entries(prompts)) assert.match(messages[0]!.content, THOUGHTS, kind);
});

test("a slow burn through stage 2, a confession when earned from stage 3, by the finale at the latest (#1960)", () => {
  const kai = { name: "Kai" };
  const at = (stage: number) => betweenYou(kai, { ...defaultLiState(), stage });
  const SLOW = /Slow burn: Kai never says what they feel for the protagonist, and neither does the protagonist\./;
  // Desire is not feeling: the burn holds back the words, never what the content contract allows.
  const DESIRE = /Desire is not feeling: they may still act on desire, out of lust or to get what they want/;
  const MAY = /The slow burn may break: when a scene has earned it, Kai may confess what they feel/;
  for (const stage of [1, 2]) {
    assert.match(at(stage), SLOW, `stage ${stage}`);
    assert.match(at(stage), DESIRE, `stage ${stage}`);
    assert.doesNotMatch(at(stage), MAY);
  }
  for (const stage of [3, 4, 5]) {
    assert.match(at(stage), MAY, `stage ${stage}`);
    assert.doesNotMatch(at(stage), SLOW);
  }
  // Ease off can end the finale before the words, so stage 6 never claims they were said.
  assert.match(at(6), /If the story has not yet shown Kai saying what they feel, they may say it/);
  assert.doesNotMatch(at(6), /has been said/);
  assert.match(
    stageGoal(6, "Kai"),
    /Kai chooses the protagonist and, if they never have, says in words what they feel/,
  );
  // Every prompt about a love interest carries it beside their card: a scene, the planner, a Home note.
  const input = inputs();
  const node = { i: 0, kind: "beat" as const, guide: "Late in the lamp room.", cast: [KAI] };
  const chapter = { kind: "main" as const, number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [node] };
  const scene = beatMessages({ ...input, chapter, node, storySoFar: "", memory: "" });
  assert.match(text(scene), SLOW);
  assert.match(text(chapterPlanMessages({ ...input, number: 2, lead: KAI, memory: "" })), SLOW);
});
