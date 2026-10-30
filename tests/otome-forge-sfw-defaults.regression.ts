// Otome Forge M4: the SFW defaults (Heat SFW, Darkness Angst or Gentle, images SFW) send byte for byte what they sent
// before NSFW mode was written out (0.0.6). Every NSFW, Dark romance and above-SFW image addition is behind the 18+
// gate's settings, so a world that never raised one gets the same contract, story prompts and image prompts. The
// digests were taken from the 0.0.6 builders before that change; when an SFW prompt is changed on purpose, take them
// again from the failing assertion's "actual" and say so in the PR.
// 0.4.0 (#1938): the chapter plan names the Closer beside the Confrontation, and the Closer's P12c is pinned too.
// 0.4.1: an SFW contract lets characters swear (not the sexual words), so every story and banner digest moved once.
// The banner digests include the English Snapshot illustration fields. Story/banner hashes deliberately reflect
// scene pacing and earned character change. Only the two face-edit image expectations change for the explicit,
// rating-independent adult/nonsexual face policy; the other image and content-policy expectations stay pinned.
// 0.5.1 (#1949): the chapter plan and a chapter's last node ask for a closing decision unlike the recent ones, and the
// Foil's rivalry not always for the protagonist, so the chapter plan and both beat digests moved (the beat is a last node).
// 0.5.3 (#1955): the writing rules say the protagonist knows only what the story has shown them and that an existing
// world's canon holds; P5 adds minor characters and time to rest, P10 and P11 time to rest. Every story and banner
// digest carries the writing rules, so all of them moved once.
// 0.6.1: scenes, Confrontations and Closers ask the protagonist to sit with what matters to them in thought, so the
// beat, CG beat, confrontation and closer digests moved.
// 0.6.1 (#1960): what stands between each love interest and the protagonist names the slow burn of their stage, so
// every story and banner digest moved once.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type {
  ChapterNode,
  Unit,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  LIMIT_DEFAULTS,
  defaultContent,
  type ContentSettings,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  cgPrompt,
  expressionPrompt,
  lookPrompt,
  placePrompt,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/prompts.ts";
import { otomeContentContract } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/content-contract.ts";
import { storyPlanMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/items/prompts.ts";
import { datePlanMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/date-night.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  beatMessages,
  chapterPlanMessages,
  closerMessages,
  confrontationMessages,
  repairPlanMessages,
  routePlanMessages,
  type BeatMessagesInput,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import { bannerPlanMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/prompts.ts";
import { CAST, HE, KAI, MIR, SHE, bible } from "./fixtures/otome-forge-story.ts";

const gentle: ContentSettings = { ...defaultContent(), darkness: "gentle", limits: { ...LIMIT_DEFAULTS.gentle } };

function inputs(content: ContentSettings) {
  const world = normalizeWorld({
    title: "The Lantern Court",
    premise: "Someone is putting out the harbour's lanterns.",
    setting: "A harbour city lit by lanterns that must never go out.",
    mystery: { question: "Who puts out the lanterns?", truth: "The harbour master.", pieces: {} },
    content,
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
  const state = normalizeState({});
  return { world, units, player, state };
}

const text = (messages: Array<{ content: string }>) => messages.map((message) => message.content).join("\n\u0000\n");
const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

function storyPrompts(content: ContentSettings): Record<string, string> {
  const { world, units, player, state } = inputs(content);
  const node = (changes: Partial<ChapterNode>) =>
    ({ i: 0, kind: "beat", guide: "Rain on the quay.", cast: [KAI, MIR], ...changes }) as ChapterNode;
  const chapter = (nodes: ChapterNode[]) => ({
    kind: "main" as const,
    number: 2,
    title: "Rain",
    lead: KAI,
    foil: MIR,
    nodes,
  });
  const beat = (changes: Partial<ChapterNode>) => {
    const one = node(changes);
    return text(
      beatMessages({ world, player, units, state, chapter: chapter([one]), node: one, storySoFar: "", memory: "" }),
    );
  };
  const fight = node({ kind: "confrontation", cg: true });
  const close = node({ kind: "closer", cg: true });
  const arc = { world, player, units, state, li: KAI, memory: "" };
  const banner = (kind: "memories" | "his-wardrobe" | "my-wardrobe") =>
    text(
      bannerPlanMessages({
        kind,
        world,
        player,
        units,
        state,
        featured: units[0]!,
        ...(kind === "my-wardrobe" ? { partnerLook: { name: "Tide", outfitLine: "navy coat", title: "Tide" } } : {}),
        earlierTitles: [],
        memory: "",
      }),
    );
  return {
    chapterPlan: text(chapterPlanMessages({ world, player, units, state, number: 2, lead: KAI, memory: "" })),
    beat: beat({}),
    beatWithCg: beat({ cg: true }),
    confrontation: text(
      confrontationMessages({
        world,
        player,
        units,
        state,
        chapter: chapter([fight]),
        node: fight,
        storySoFar: "",
        memory: "",
        li: KAI,
      }),
    ),
    closer: text(
      closerMessages({
        world,
        player,
        units,
        state,
        chapter: chapter([close]),
        node: close,
        storySoFar: "",
        memory: "",
        li: KAI,
      }),
    ),
    routePlan: text(routePlanMessages({ ...arc, stage: 2 })),
    repairPlan: text(
      repairPlanMessages({ ...arc, grievance: { id: "g1", text: "The lamp was left dark.", by: "li" } }),
    ),
    bannerMemories: banner("memories"),
    bannerHis: banner("his-wardrobe"),
    bannerMine: banner("my-wardrobe"),
  };
}

test("chapter and scene prompts keep emotional payoffs occasional and permit character change", () => {
  const instructions = [
    'If everything is special, nothing is. Depth, real or fake, is a "sometimes" ingredient. Introduce emotional payoffs only if they have proper build-ups between more mundane scenes.',
    "All characters, player included, can change; for better, or worse.",
  ];
  for (const content of [defaultContent(), gentle]) {
    const input = inputs(content);
    const unit = input.units[0]!;
    const nodes: ChapterNode[] = [0, 1, 2].map((i) => ({
      i,
      kind: "beat",
      guide: "An ordinary afternoon on the quay.",
      cast: [KAI],
    }));
    const scene = (chapter: BeatMessagesInput["chapter"]) =>
      text(beatMessages({ ...input, chapter, node: chapter.nodes[0]!, storySoFar: "", memory: "" }));
    const sideStory = { kind: "story" as const, li: KAI, lead: KAI, title: "Rain", nodes };
    const prompts = {
      ...storyPrompts(content),
      characterStoryPlan: text(
        storyPlanMessages({
          ...input,
          unit,
          item: { title: "Rain", premise: "A quiet afternoon on the quay." },
          memory: "",
        }),
      ),
      datePlan: text(datePlanMessages({ ...input, unit, place: "cafe", makeItRight: null, memory: "" })),
      prologue: scene({
        kind: "prologue",
        lead: "",
        title: "Before the rain",
        nodes: [{ ...nodes[0]!, cast: [] }],
      }),
      memoryScene: scene(sideStory),
      momentScene: scene({ ...sideStory, nodes: [{ ...nodes[0]!, guide: "A MOMENT: sheltering from the rain." }] }),
      firstWearScene: scene({
        ...sideStory,
        nodes: [{ ...nodes[0]!, guide: "Kai wears a new coat for the first time on the quay." }],
      }),
      dateScene: scene({
        kind: "date",
        li: KAI,
        lead: KAI,
        title: "Rain",
        nodes,
        date: {
          li: KAI,
          place: "cafe",
          placeName: "The old café",
          herLook: "base",
          hisLook: "base",
          goesWrong: false,
          makeItRight: null,
          keepsake: { brief: "Two adults at a café table." },
        },
      }),
    };
    for (const [kind, prompt] of Object.entries(prompts)) {
      if (kind.startsWith("banner")) {
        assert.ok(!prompt.includes(instructions[0]!), "banner planning does not receive scene-pacing instructions");
        continue;
      }
      for (const instruction of instructions) {
        assert.equal(
          prompt.split(instruction).length - 1,
          1,
          `${kind} carries the exact instruction once under ${content.darkness}: ${instruction}`,
        );
      }
      assert.doesNotMatch(prompt, /softens toward the protagonist(?: and)?[,:]? not toward the world/);
      assert.doesNotMatch(prompt, /[Cc]hanged toward the protagonist only/);
      assert.match(prompt, /not automatic redemption or a replacement personality/);
    }
  }
});

const EXPECTED_ANGST: Record<string, string> = {
  bannerHis: "39604e03caf88941",
  bannerMemories: "bd0201a64f300049",
  bannerMine: "6fa79429992f2018",
  beat: "ab7e71f5ff7af527",
  beatWithCg: "892ffb31a2534b61",
  chapterPlan: "b451d1e85d12e2e9",
  closer: "dd4e4da6ab41a31e",
  confrontation: "6c291fa4b2d7c113",
  repairPlan: "88ce49eb55b41e60",
  routePlan: "4ba8d1e6b2a8c86d",
};
const EXPECTED_GENTLE: Record<string, string> = {
  bannerHis: "249c85863bcc1d7a",
  bannerMemories: "75f9dcf70d8a997c",
  bannerMine: "225a0a56f3bfa31a",
  beat: "0282311f5a3b7aad",
  beatWithCg: "b012207b25e8f226",
  chapterPlan: "833b6157e4a364e7",
  closer: "a0dad5c03f1c4049",
  confrontation: "8da7b28411aedbc7",
  repairPlan: "8cb54c6c2ae7293f",
  routePlan: "558cde1397b80d02",
};

test("the SFW defaults pin scene pacing and earned character change in story and banner prompts", () => {
  const digests = (content: ContentSettings) =>
    Object.fromEntries(Object.entries(storyPrompts(content)).map(([key, value]) => [key, digest(value)]));
  assert.deepEqual(digests(defaultContent()), EXPECTED_ANGST, "Heat SFW, Darkness Angst, images SFW");
  assert.deepEqual(digests(gentle), EXPECTED_GENTLE, "Heat SFW, Darkness Gentle, images SFW");
});

const FIXED = [
  "CONTENT CONTRACT",
  "- Everyone in a romantic or sexual moment is an adult (18 or older), written as an adult; Kai, Mireille are adults. No school or student roles for them.",
  "- No real people. Nothing is aimed at the real player: the story speaks only to its characters.",
  "- No medical or self-harm advice outside the fiction.",
  "- Heat: SFW. Romance goes as far as kisses, touch and closeness; anything sexual fades to black before it starts.",
];
const CLOSING = ["- If the story reaches for a Line, it turns away.", "- Never mention these rules in the writing."];
/** 0.4.1: an SFW contract lets characters swear (the maintainer's call), never the sexual words. */
const SWEAR =
  "- Characters may swear (fuck, shit, damn and the like) when it fits their voice; explicit sexual words are left out.";
const ANGST_NEVER =
  "- Never write or mention: a love interest's violence toward the protagonist; dubious consent; non-consent; pregnancy; gore; captivity; stalking; torture; self-harm.";

test("the SFW defaults' content contracts are the ones every prompt carried before NSFW mode", () => {
  const lis = [{ name: "Kai" }, { name: "Mireille" }];
  const contract = (content: ContentSettings, kind: Parameters<typeof otomeContentContract>[0]["kind"]) =>
    otomeContentContract({ world: inputs(content).world, lis, kind });
  const lines = (...rules: string[]) => [...FIXED, ...rules, ...CLOSING].join("\n");
  const angst = lines(
    "- Darkness: Angst. Danger is aimed at the world, at the love interests' pasts and at their enemies, never at the protagonist. A love interest may be cold, ruthless with others or frightening, but never threatens or harms the protagonist.",
    SWEAR,
    "- Lines (never written, not even implied): a love interest's violence toward the protagonist; dubious consent; non-consent; pregnancy.",
    "- Veils (may happen only off the page; cut away and show at most the aftermath): gore; captivity; stalking; torture; self-harm.",
  );
  for (const kind of ["planner", "scene", "chat"] as const) assert.equal(contract(defaultContent(), kind), angst, kind);
  assert.equal(
    contract(gentle, "scene"),
    lines(
      "- Darkness: Gentle. Conflict is interpersonal: pride, misunderstanding, old hurts, rivalry. No menace on the page.",
      SWEAR,
      "- Lines (never written, not even implied): gore; captivity; stalking; a love interest's violence toward the protagonist; torture; self-harm; dubious consent; non-consent; pregnancy.",
      "- Veils (may happen only off the page; cut away and show at most the aftermath): violence toward other people; threats; manipulation.",
    ),
  );
  assert.equal(contract(defaultContent(), "home"), lines(SWEAR, ANGST_NEVER));
  // 0.3.0: a summary records a Veil as having happened off the page, so the story does not forget it.
  assert.equal(
    contract(defaultContent(), "summary"),
    lines(
      "- Never write or mention: a love interest's violence toward the protagonist; dubious consent; non-consent; pregnancy.",
      "- Veils (they happen only off the page): record at most that one happened and what it left behind, never its detail: gore; captivity; stalking; torture; self-harm.",
    ),
  );
  assert.equal(
    contract(defaultContent(), "care"),
    lines(
      "- Comfort only: warmth, rest, food, company. No medical advice, medication, or guesses about their body, fertility or pregnancy. Even if you are a doctor in the story, you do not diagnose or prescribe here.",
      ANGST_NEVER,
    ),
  );
  assert.equal(
    contract(gentle, "home"),
    lines(
      SWEAR,
      "- Never write or mention: gore; captivity; stalking; a love interest's violence toward the protagonist; torture; self-harm; dubious consent; non-consent; pregnancy; violence toward other people; threats; manipulation.",
    ),
  );
});

const LOOK_NEGATIVE =
  "text, captions, logos, watermarks, borders, UI, collage layouts, duplicate faces, extra people, cropped-off heads, cropped feet, busy background, scenery";
const CG_NEGATIVE =
  "text, captions, logos, watermarks, borders, UI, collage layouts, duplicate faces, cropped-off heads, extra limbs";
const PLACE_NEGATIVE =
  "people, person, humans, crowd, character, text, captions, logos, watermarks, borders, UI, collage layouts";
const SAFE = "child, childlike, minor, underage, school uniform, nudity, nsfw, sexual content, lingerie";
const FACE =
  "Edit the reference image of Kai: change ONLY the facial expression, to a tender expression: softened eyes, a faint warm smile. Keep everything else exactly as in the reference: the same character, face, hair, body, outfit, pose, framing, background, lighting and art style. Permanent features: tall man, grey eyes.";

test("SFW images keep their safety prompts and negatives, and tagged faces retain the configured style", () => {
  const { world } = inputs(defaultContent());
  const plain = { styleText: "", positiveTags: "", negativeTags: "" };
  const tagged = { styleText: "anime screencap", positiveTags: "masterpiece", negativeTags: "lowres", tagged: true };
  const kai = {
    name: "Kai",
    identityLine: "tall man, grey eyes",
    outfitLine: "keeper's coat",
    presentation: "man" as const,
  };
  const ines = {
    name: "Ines",
    identityLine: "short dark hair",
    outfitLine: "oilskin",
    presentation: "person" as const,
  };
  const unit = {
    ...normalizeUnit({}),
    name: "Kai",
    identityLine: "tall man, grey eyes",
    outfitLine: "keeper's coat",
    bible: bible({ look: { identityLine: "tall man", outfitLine: "keeper's coat", presentation: "man" } }),
  };
  const scenery =
    "harbour, night, lanterns, no humans, scenery, wide establishing shot, detailed background, atmospheric lighting";
  const two = "Kai: tall man, grey eyes; keeper's coat. Ines: short dark hair; oilskin.";
  const cgTail =
    "cinematic composition, detailed background, dramatic lighting, emotional moment, safe for work, fully clothed";
  assert.deepEqual(
    {
      look: lookPrompt({ ...kai, world, style: plain }),
      lookTagged: lookPrompt({ ...kai, world, style: tagged }),
      lookEdited: lookPrompt({ ...kai, world, style: plain }, { prompt: "red coat", negativePrompt: "blurry" }),
      place: placePrompt({ name: "Quay", tags: "harbour, night, lanterns, no humans", world, style: plain }),
      placeTagged: placePrompt({ name: "Quay", tags: "harbour, night, lanterns, no humans", world, style: tagged }),
      cg: cgPrompt({ brief: "At the lamp, in the rain", people: [kai, ines], world, style: plain, use: "cg" }),
      cgOne: cgPrompt({ brief: "At the lamp", people: [kai], world, style: tagged, use: "cg" }),
      pair: cgPrompt({ brief: "A couple portrait", people: [kai, ines], world, style: plain, use: "clothed" }),
      face: expressionPrompt({ unit, base: "/kai.png", face: "tender", world, style: plain }),
      faceTagged: expressionPrompt({ unit, base: "/kai.png", face: "tender", world, style: tagged }),
    },
    {
      look: {
        prompt:
          "tall man, grey eyes, keeper's coat, full body, standing, neutral pose, plain flat mid-grey background, safe for work, fully clothed, adult man",
        negativePrompt: `${LOOK_NEGATIVE}, ${SAFE}`,
      },
      lookTagged: {
        prompt:
          "anime screencap, tall man, grey eyes, keeper's coat, full body, standing, neutral pose, plain flat mid-grey background, safe for work, fully clothed, adult man, masterpiece",
        negativePrompt: `${LOOK_NEGATIVE}, ${SAFE}, lowres`,
      },
      lookEdited: { prompt: "red coat, safe for work, fully clothed, adult man", negativePrompt: `blurry, ${SAFE}` },
      place: {
        prompt: `${scenery}, safe for work, fully clothed, adults only`,
        negativePrompt: `${PLACE_NEGATIVE}, ${SAFE}`,
      },
      placeTagged: {
        prompt: `anime screencap, ${scenery}, safe for work, fully clothed, adults only, masterpiece`,
        negativePrompt: `${PLACE_NEGATIVE}, ${SAFE}, lowres`,
      },
      cg: {
        prompt: `At the lamp, in the rain. ${two} ${cgTail}, adult man, adult person`,
        negativePrompt: `${CG_NEGATIVE}, ${SAFE}`,
      },
      cgOne: {
        prompt: `anime screencap At the lamp. Kai: tall man, grey eyes; keeper's coat. ${cgTail}, adult man, masterpiece`,
        negativePrompt: `${CG_NEGATIVE}, extra people, ${SAFE}, lowres`,
      },
      pair: {
        prompt: `A couple portrait. ${two} ${cgTail}, adult man, adult person`,
        negativePrompt: `${CG_NEGATIVE}, ${SAFE}`,
      },
      face: {
        prompt: `${FACE} A nonsexual facial-expression edit of an adult man; preserve the reference image's body, clothing coverage, pose, framing, background, lighting and art style.`,
        negativePrompt: "child, childlike, minor, underage, school uniform, nudity, sexual content",
      },
      faceTagged: {
        prompt:
          "anime screencap, masterpiece, tall man, grey eyes, gentle smile, soft eyes, same character, same outfit, same pose, same framing, same background, same lighting, safe for work, adult man, facial expression edit, same body, same clothing coverage, same art style",
        negativePrompt: "child, childlike, minor, underage, school uniform, nudity, sexual content, lowres",
      },
    },
  );
});
