// Otome Hearth (#1955): what the protagonist knows, an existing world's canon, minor characters and time to rest.
// - Every prompt that writes story or a love interest's words, and the bible, says the protagonist knows only what the
//   story has shown them (never a card or a bible), and that an existing world's canon holds.
// - The world plan (P2) names an existing world as it is; the Surprise me premise stays original.
// - The chapter planner (P5) gives minor characters parts and lets a node go without any love interest; P5, P10 and P11
//   let time pass, with rest or sleep. A route or repair chapter keeps its love interest in every node.
// - 0.8.7: the world the player chose holds. Only the arc and chapter planners read the premise (the maintainer's), for
//   its genre, era and technology alone; the world plan keeps them; every other prompt sends what staging sent.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type {
  ChapterNode,
  Unit,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  PLACE_FRAMING,
  appearanceLine,
  arcPlanMessages,
  bannerPlanMessages,
  beatMessages,
  betweenYou,
  bibleMessages,
  chapterPlanMessages,
  chatReplyMessages,
  closerMessages,
  confrontationMessages,
  datePlanMessages,
  noteMessages,
  noticedMessages,
  premiseMessages,
  prestigePlanMessages,
  repairPlanMessages,
  routePlanMessages,
  stageGoal,
  storyPlanMessages,
  worldPlanMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  defaultLiState,
  normalizeState,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { CAST, HE, KAI, MIR, SHE, at, bible } from "./fixtures/otome-forge-story.ts";

const text = (messages: Array<{ content: string }>) => messages.map((message) => message.content).join("\n");

const KNOWS = "The protagonist knows only what the story has shown them and what their own persona would know.";
const CARD = "A card or bible is for writing a character, never what the protagonist knows:";
const UNTIL = "Until then the protagonist does not understand them, and nobody talks to the protagonist as if they do.";
const CANON = "When the story is set in an existing world from a game, book, film or show, keep to its canon:";
const OTHERS = "- The world has other people: give named minor characters";
const ALONE = "a node may be theirs alone or with others (cast [])";
const TIME =
  "- Time passes as in a life: the protagonist is human, resting, sleeping, washing and seeing to the small needs of a day or night in passing.";

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
        storySoFar: [],
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
    for (const rule of [KNOWS, CARD, UNTIL, CANON]) assert.ok(prompt.includes(rule), `${kind}: ${rule}`);
  }
});

test("a love interest may be genuinely evil, a story may have real villains, and a moral code may be none (#2054)", () => {
  const input = inputs();
  const { world, units, player } = input;
  const kai = units.find((unit) => unit.id === KAI)!;
  const node = { i: 0, kind: "beat" as const, guide: "Kai speaks of the harbour's old wards.", cast: [KAI] };
  const EVIL =
    "- A love interest may be genuinely evil, a monster or a villain, as dark as this story's Darkness allows: taming them is the point, so never soften them before the story earns it.";
  const bibleText = text(bibleMessages({ world, player, member: { unit: kai }, others: [] }));
  const prompts: Record<string, string> = {
    bible: bibleText,
    scene: text(
      beatMessages({
        ...input,
        chapter: { kind: "main", number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [node] },
        node,
        storySoFar: [],
        memory: "",
      }),
    ),
    chapterPlan: text(chapterPlanMessages({ ...input, number: 2, lead: KAI, memory: "" })),
  };
  for (const [kind, prompt] of Object.entries(prompts)) assert.ok(prompt.includes(EVIL), kind);
  const plan = text(worldPlanMessages({ world, player, cast: units.map((unit) => ({ unit })) }));
  assert.ok(!/nobody is simply a villain/u.test(plan), "the world plan may have real villains");
  assert.ok(
    bibleText.includes(
      "- moralCode: the code they live by, true to who they are: firm for a good person, far looser for a bad one, or none at all. redLines: what that code forbids them, if anything ([] when nothing does).",
    ),
  );
  assert.ok(!/from their own integrity/u.test(bibleText));
  // The shared rule the bible also receives must not ask for red lines a love interest without a code does not have.
  assert.ok(bibleText.includes("the love interest keeps whatever red lines they have."));
  assert.ok(!bibleText.includes("the love interest keeps their red lines"));
  // The mask may hide a monster, and the bible keeps the card's darkness as dark as the story's Darkness allows. The
  // scene card shows darkness at every stage, so it holds what they are, never a secret's events (CodeRabbit on #2055).
  assert.ok(
    bibleText.includes("mask.presents: the face they show, which may hide something kinder or something worse;"),
  );
  assert.ok(
    bibleText.includes(
      "darkness.kinds: the kinds of darkness in them, as dark as the card or archetype makes them within this story's Darkness, never softened: what they are (cruelty, a hunger for control), never a secret's events, which belong in secrets.",
    ),
  );
  // Love alone does not make a monster good, but they may grow into a better partner as affection grows.
  const LOVE =
    "Falling for the protagonist does not make a monster good or secretly kind at once; as affection grows and they come to know the protagonist, they may become a better partner to them, in their own way.";
  for (const [kind, prompt] of Object.entries(prompts)) assert.ok(prompt.includes(LOVE), `${kind}: love rule`);
  // Every planner reads the monster as a monster, not a human inside one.
  assert.ok(prompts.chapterPlan!.includes("each is a human, even if a monster,"));
  for (const prompt of Object.values(prompts)) assert.ok(!prompt.includes("even if inside a monster"));
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
    scene: beatMessages({ ...input, chapter: chapter([node]), node, storySoFar: [], memory: "" }),
    confrontation: confrontationMessages({
      ...input,
      chapter: chapter([fight]),
      node: fight,
      storySoFar: [],
      memory: "",
      li: KAI,
    }),
    closer: closerMessages({ ...input, chapter: chapter([close]), node: close, storySoFar: [], memory: "", li: KAI }),
  };
  // In each writer's own instructions, after the story context they share (#2066).
  for (const [kind, messages] of Object.entries(prompts)) assert.match(messages[1]!.content, THOUGHTS, kind);
});

test("a slow burn through stage 4, a confession when earned in stage 5, and in stage 6 if not yet (#1960, 0.7.5)", () => {
  const kai = { name: "Kai" };
  const at = (stage: number) => betweenYou(kai, { ...defaultLiState(), stage });
  const SLOW = /Slow burn: Kai never says what they feel for the protagonist, and neither does the protagonist\./;
  // Desire is not feeling: the burn holds back the words, never what the content contract allows.
  const DESIRE = /Desire is not feeling: they may still act on desire, out of lust or to get what they want/;
  const MAY = /The slow burn may break: when a scene has earned it, Kai may confess what they feel/;
  for (const stage of [1, 2, 3, 4]) {
    assert.match(at(stage), SLOW, `stage ${stage}`);
    assert.match(at(stage), DESIRE, `stage ${stage}`);
    assert.doesNotMatch(at(stage), MAY);
  }
  assert.match(at(5), MAY);
  assert.doesNotMatch(at(5), SLOW);
  // Stage 6: if not said yet, it must be; Ease off can end the finale before the words, so it never claims they were.
  assert.match(
    at(6),
    /If the story has not yet shown Kai saying what they feel, Kai says it in words at the first moment/,
  );
  assert.doesNotMatch(at(6), SLOW);
  assert.doesNotMatch(at(6), /has been said/);
  assert.match(
    stageGoal(6, "Kai"),
    /Kai chooses the protagonist and, if they never have, says in words what they feel/,
  );
  // Every prompt about a love interest carries it beside their card: a scene, the planner, a Home note.
  const input = inputs();
  const node = { i: 0, kind: "beat" as const, guide: "Late in the lamp room.", cast: [KAI] };
  const chapter = { kind: "main" as const, number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [node] };
  const scene = beatMessages({ ...input, chapter, node, storySoFar: [], memory: "" });
  assert.match(text(scene), SLOW);
  assert.match(text(chapterPlanMessages({ ...input, number: 2, lead: KAI, memory: "" })), SLOW);
});

test("the story describes a love interest from their current Image appearance and worn look (#1965)", () => {
  const input = inputs();
  const kai = input.units.find((unit) => unit.id === KAI)!;
  // The bible's look says one mask; the player fixed it in Image appearance. A Wardrobe look is worn.
  kai.bible = { ...kai.bible!, look: { ...kai.bible!.look, identityLine: "OLD-MASK: a plain white mask" } };
  kai.identityLine = "NEW-MASK: a crow-beaked half mask over the eyes, cyan hair";
  kai.outfits = [
    { id: "his-wardrobe-0-a1", name: "Harbour Night", outfitLine: "WORN: navy greatcoat", url: "/x.png", at },
  ];
  kai.wornOutfit = "his-wardrobe-0-a1";
  const node = { i: 0, kind: "beat" as const, guide: "Kai turns to face you.", cast: [KAI] };
  const chapter = { kind: "main" as const, number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [node] };
  const scene = text(beatMessages({ ...input, chapter, node, storySoFar: [], memory: "" }));
  const plan = text(chapterPlanMessages({ ...input, number: 2, lead: KAI, memory: "" }));
  for (const [kind, prompt] of Object.entries({ scene, plan })) {
    assert.match(
      prompt,
      /How Kai looks now \(English image tags; describe them from this[^)]*\): NEW-MASK: a crow-beaked/,
      kind,
    );
    assert.match(prompt, /NEW-MASK[^\n]*; wearing WORN: navy greatcoat\./, kind);
    assert.doesNotMatch(prompt, /OLD-MASK/, `${kind}: the bible's old look never reaches the story`);
  }
  // With no edit, the bible's look is used, in their everyday clothes.
  const plain = { ...kai, identityLine: "", outfitLine: "", wornOutfit: undefined };
  assert.equal(
    appearanceLine(plain),
    `How Kai looks now (English image tags; describe them from this, in the story's language, whenever their looks come up): OLD-MASK: a plain white mask; wearing ${plain.bible!.look.outfitLine}.`,
  );
});

test("the story knows what the protagonist wears now, as it does a love interest, without their appearance twice", () => {
  const input = inputs();
  // The persona's Appearance rides in its story fields; the image identity line is that same text.
  const appearance = "PERSONA-LOOK: short black hair, freckles";
  input.player = {
    ...input.player,
    about: `A lantern-keeper's apprentice.\nAppearance: ${appearance}`,
    look: { identityLine: appearance, outfitLine: "EVERYDAY: grey apprentice smock" },
    outfits: [{ id: "my-wardrobe-0-a1", name: "Festival Night", outfitLine: "WORN: red qipao", url: "/x.png", at }],
    wornOutfit: "my-wardrobe-0-a1",
  };
  const node = { i: 0, kind: "beat" as const, guide: "Kai turns to face you.", cast: [KAI] };
  const chapter = { kind: "main" as const, number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [node] };
  const prompts = () => ({
    scene: text(beatMessages({ ...input, chapter, node, storySoFar: [], memory: "" })),
    plan: text(chapterPlanMessages({ ...input, number: 2, lead: KAI, memory: "" })),
  });
  const count = (prompt: string, part: string) => prompt.split(part).length - 1;
  for (const [kind, prompt] of Object.entries(prompts())) {
    assert.match(
      prompt,
      /\nHow Ines looks now \(English image tags; describe them from this[^)]*\): wearing WORN: red qipao\.\n/,
      kind,
    );
    assert.doesNotMatch(prompt, /EVERYDAY/, `${kind}: the worn look replaces the everyday outfit`);
    assert.equal(count(prompt, appearance), 1, `${kind}: the persona's appearance is sent once`);
  }
  // In their base look, the everyday outfit.
  input.player = { ...input.player, wornOutfit: undefined };
  for (const [kind, prompt] of Object.entries(prompts())) {
    assert.match(prompt, /\nHow Ines looks now \([^)]*\): wearing EVERYDAY: grey apprentice smock\.\n/, kind);
    assert.equal(count(prompt, appearance), 1, `${kind}: the persona's appearance is sent once`);
  }
  // P19 is about the look itself: it is named once, as THE LOOK.
  input.player = { ...input.player, wornOutfit: "my-wardrobe-0-a1" };
  const kai = input.units.find((unit) => unit.id === KAI)!;
  const look = { name: "Festival Night", outfitLine: "WORN: red qipao" };
  const noticed = text(noticedMessages({ ...input, unit: kai, look }));
  assert.equal(count(noticed, "WORN: red qipao"), 1, "P19 names the look once");
  assert.doesNotMatch(noticed, /How Ines looks now/);
});

// What every prompt but the planners and the world plan sent on staging (e01922d19), for build() below with the premise:
// sha256 of the messages as JSON. A change to one of them is a change to a prompt the world limits keep as it was; a
// release that changes one on purpose (0.8.7 moves the date plan's WHAT THEY WEAR into protagonistBlock) retakes it.
const STAGING_OTHERS: Record<string, string> = {
  scene: "a9f81dc2b4e41db4",
  callScene: "082f4a96e3320b99",
  confrontation: "646929977ecd71b2",
  closer: "07ddfbafd6578c00",
  bible: "0e8da543f0ac13bf",
  chat: "737cde4c51f826e8",
  daily: "c25471977dd29aa5",
  note: "77c2dd85e08f8023",
  // Retaken 2026-11-05 when the outfit and world fixes shipped together in 0.8.7: the date plan lost its WHAT THEY
  // WEAR block (now in protagonistBlock), its only change from staging; it still never reads the premise (above).
  datePlan: "26811b6da118503b",
};

test("only the arc and chapter planners read the premise, for its world alone; the world plan keeps it (0.8.7)", () => {
  // Players saw a world drift to a period look: the premise reached no planner and the world plan never kept its era.
  // The maintainer's limits (2026-11-05): the premise goes only to the arc and chapter planners, and the outfit and
  // place tags name no era; every other prompt sends what it sent.
  const base = inputs();
  const PREMISE =
    "PREMISE-MARK: a glass tower in a modern city, where a night-shift analyst finds a file that should not exist.";
  const SETTING = "SETTING-MARK: a modern city of glass towers, late trains and phones that never sleep.";
  // Read for the world alone, never for its events (its opening is P2's openingSituation); an au extra story leaves it.
  const LINE = `The player's premise, read only for its genre, era and technology, which the story keeps: ${PREMISE}`;
  const EXTRA = `The player's premise, read only for its genre, era and technology, which an extra story keeps unless its kind is au (an au imagines another world on purpose): ${PREMISE}`;
  const build = (premise: string) => {
    const world = { ...base.world, premise, setting: SETTING };
    const input = { ...base, world };
    const { units, player, state } = input;
    const kai = units.find((unit) => unit.id === KAI)!;
    const scene = (node: ChapterNode) =>
      beatMessages({
        ...input,
        chapter: { kind: "main", number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [node] },
        node,
        storySoFar: [],
        memory: "",
      });
    const node = (kind: ChapterNode["kind"]) =>
      ({ i: 0, kind, guide: "Kai waits by the window.", cast: [KAI], cg: true }) as ChapterNode;
    const climax = (kind: "confrontation" | "closer") => ({
      ...input,
      chapter: { kind: "main" as const, number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [node(kind)] },
      node: node(kind),
      storySoFar: [],
      memory: "",
      li: KAI,
    });
    const chat = (first: boolean) =>
      chatReplyMessages({
        world,
        player,
        unit: kai,
        liState: state.lis[KAI]!,
        tail: first ? [] : [{ id: "m-1", who: "player", text: "Are you awake?", at }],
        memories: [],
        story: "",
        first,
      });
    const arc = { ...input, li: KAI, memory: "" };
    return {
      planners: {
        arcPlan: arcPlanMessages({ ...input, memory: "", previous: [], chapters: [], number: 1, from: 1 }),
        chapterPlan: chapterPlanMessages({ ...input, number: 2, lead: KAI, memory: "" }),
        routePlan: routePlanMessages({ ...arc, stage: 2 }),
        repairPlan: repairPlanMessages({ ...arc, grievance: { id: "g1", text: "The lamp was left dark.", by: "li" } }),
        characterStoryPlan: storyPlanMessages({
          ...input,
          unit: kai,
          item: { title: "Rain", premise: "A quiet night." },
          memory: "",
        }),
        extraStoryPlan: prestigePlanMessages({ ...input, unit: kai, n: 1, earlier: [], memory: "" }),
      },
      others: {
        scene: scene(node("beat")),
        callScene: scene({ ...node("moment"), moment: "call" }),
        confrontation: confrontationMessages(climax("confrontation")),
        closer: closerMessages(climax("closer")),
        bible: bibleMessages({ world, player, member: { unit: kai }, others: [] }),
        chat: chat(false),
        daily: chat(true),
        note: noteMessages({
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
        datePlan: datePlanMessages({ ...input, unit: kai, place: "observatory", makeItRight: null, memory: "" }),
      },
      worldPlan: worldPlanMessages({ world, player, cast: units.map((unit) => ({ unit })) }),
    };
  };
  const withPremise = build(PREMISE);
  const without = build("");

  // The planners read the premise once, right after the setting, and only that line is new.
  for (const [kind, messages] of Object.entries(withPremise.planners)) {
    const prompt = text(messages);
    const line = kind === "extraStoryPlan" ? EXTRA : LINE;
    assert.equal(prompt.split(line).length - 1, 1, `${kind} reads the premise once`);
    assert.equal(prompt.split(PREMISE).length - 1, 1, `${kind}: in that line alone`);
    assert.ok(prompt.includes(SETTING), `${kind} keeps the setting`);
    const bare = text(without.planners[kind as keyof typeof withPremise.planners]);
    // P5 opens its own part with the line and a blank; the others put it on the line after the setting.
    const added = kind === "chapterPlan" ? `${line}\n\n` : `${line}\n`;
    assert.equal(prompt.replace(added, ""), bare, `${kind}: only the line is new`);
    if (kind !== "chapterPlan")
      assert.ok(prompt.includes(`WORLD\n${SETTING}\n${line}\n`), `${kind}: after the setting`);
  }
  // The extra story still offers its au, and P21 and the extra story plan a call as P5, P10 and P11 do.
  assert.ok(text(withPremise.planners.extraStoryPlan).includes("- au: a mini alternate universe they imagine"));
  for (const kind of ["characterStoryPlan", "extraStoryPlan"] as const) {
    const prompt = text(withPremise.planners[kind]);
    assert.ok(prompt.includes("call (a call from afar, only voices)"), kind);
    assert.ok(!prompt.includes("a phone call"), kind);
  }
  // P5's story context is the scenes' cached prefix: the premise stays out of it, in the plan's own part.
  const [context, , ...own] = withPremise.planners.chapterPlan;
  assert.equal(context!.content, withPremise.others.scene[0]!.content, "P5 and the scene share the story context");
  assert.ok(!context!.content.includes(PREMISE), "the shared story context carries no premise");
  assert.ok(own.at(-1)!.content.startsWith(`${LINE}\n\n`), "P5's own part opens with the premise");
  assert.deepEqual(
    build(PREMISE).planners.chapterPlan,
    withPremise.planners.chapterPlan,
    "the same bytes on every call",
  );

  // Every other prompt never reads the premise, and sends exactly what it sent on staging.
  for (const [kind, messages] of Object.entries(withPremise.others)) {
    assert.ok(!text(messages).includes("PREMISE-MARK"), `${kind} never reads the premise`);
    assert.deepEqual(messages, without.others[kind as keyof typeof withPremise.others], `${kind} is unchanged`);
  }
  const digest = (messages: unknown) =>
    createHash("sha256").update(JSON.stringify(messages)).digest("hex").slice(0, 16);
  assert.deepEqual(
    Object.fromEntries(Object.entries(withPremise.others).map(([kind, messages]) => [kind, digest(messages)])),
    STAGING_OTHERS,
    "every other prompt is staging's",
  );

  // The world plan keeps the premise's era and technology, and an existing world its canon.
  const plan = text(withPremise.worldPlan);
  assert.ok(
    plan.includes(
      "- setting: 2 to 4 sentences: the place, its era and technology level as the premise sets them, its order, and what makes it strange or dangerous.",
    ),
  );
  assert.ok(
    plan.includes(
      "- Keep the premise's genre, era and technology: never move the story to another period, and never add a technology or aesthetic its world does not have (in an existing world, its canon decides).",
    ),
  );

  // The outfit and place tag specs name no era: the bible's look, the scene's and the climaxes' place tags and the
  // place image framing stay as they were on staging.
  assert.ok(
    text(withPremise.others.bible).includes(
      "- look: English only, visual-only comma-separated tags. identityLine: face, hair, eyes, build, skin, marks, with adult features. outfitLine: their everyday clothing in this world. presentation: how to draw them, man, woman or person.",
    ),
  );
  assert.ok(
    text(withPremise.others.scene).includes(
      'tags: the same place as 4-8 short comma-separated English tags for an image model, with "no humans". place on a segment:',
    ),
  );
  for (const kind of ["confrontation", "closer"] as const) {
    assert.ok(
      text(withPremise.others[kind]).includes(
        '); tags: 4-8 short comma-separated English tags for an image model, with "no humans".',
      ),
      kind,
    );
  }
  assert.equal(PLACE_FRAMING, "scenery, no humans, wide establishing shot, detailed background, atmospheric lighting");

  // No prompt, and nothing the server ships, names a period aesthetic; the premise box's example names none either.
  const every = [
    ...Object.values(withPremise.planners),
    ...Object.values(withPremise.others),
    withPremise.worldPlan,
    premiseMessages("English"),
  ].map(text);
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const server = readFileSync(join(root, "packages/otome-forge/server.mjs"), "utf8");
  for (const prompt of [...every, server]) assert.doesNotMatch(prompt, /steampunk|clockwork/iu);
  const en = JSON.parse(
    readFileSync(
      join(root, "packages/otome-forge/src/engine/packages/client/src/features/otome-forge/locales/en.json"),
      "utf8",
    ),
  ) as Record<string, string>;
  assert.ok(en["ui.otomeForge.setup.premisePlaceholder"], "the placeholder is still there");
  assert.doesNotMatch(en["ui.otomeForge.setup.premisePlaceholder"]!, /clockwork/iu);
  assert.doesNotMatch(readFileSync(join(root, "packages/otome-forge/client.js"), "utf8"), /clockwork/iu);
});
