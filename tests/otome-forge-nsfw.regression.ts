// Otome Forge M4 (0.0.6): NSFW mode, written out for the maintainer's NSFW prompt within Otome's rules. NSFW Heat and
// Dark romance reach the story prompts only through the 18+ gate and the settings that ask for them; the player's
// Lines and Veils always appear, last, and win; non-consent stays a Line unless the player lifted it under Dark, NSFW
// Heat and the gate, and only then (or with dubious consent open) does the consent framing appear; summaries stay
// non-explicit. Every image keeps the adult-only negatives at every rating and after any edit; looks, faces, outfits,
// the pair portrait and Memory art stay clothed portraits; places carry no person tags above SFW; and the explicit
// tags appear only on a story CG whose brief set `explicit` under Explicit Heat and the Explicit rating.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type {
  ChapterNode,
  Unit,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  DARKNESSES,
  HEATS,
  IMAGE_RATINGS,
  LIMIT_DEFAULTS,
  defaultContent,
  enforceContent,
  type ContentSettings,
  type Darkness,
  type Heat,
  type ImageRating,
  type LimitId,
  type LimitLevel,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import { cgPromptFor } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cg.ts";
import {
  cgPrompt,
  expressionPrompt,
  lookPrompt,
  placePrompt,
  type ImagePrompt,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/prompts.ts";
import {
  ADULT_SENTENCE,
  otomeContentContract,
  type ContractKind,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/content-contract.ts";
import {
  runDocTarget,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { chatMemoryMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/prompts.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  normalizeState,
  readRun,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { normalizeBeatReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts";
import {
  beatMessages,
  chapterPlanMessages,
  confrontationMessages,
  routePlanMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import { bannerPlanMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/prompts.ts";
import { KEY, artWorld, beat, routesOf, saveBeat } from "./fixtures/otome-forge-art.ts";
import {
  CAST,
  HE,
  KAI,
  MIR,
  SHE,
  beatReply,
  bible,
  json,
  planReply,
  storyWorld,
} from "./fixtures/otome-forge-story.ts";

const LIS = [{ name: "Kai" }, { name: "Mireille" }];
const TEXT_KINDS = ["planner", "scene", "chat"] as const;

/** What only NSFW mode writes into a planner, scene or chat contract. */
const NSFW_WORDING = {
  noMinors: /Nothing sexual or romantic ever involves anyone under 18/,
  romance: /a love interest may make the first move/,
  language: /Language is not sanitized/,
  fade: /cut at the threshold and pick up in the aftermath/,
  explicit: /explicit, anatomically grounded, emotionally reactive and detailed/,
  dark: /Villains disregard boundaries and play dirty/,
  angst: /Villains play dirty and are a genuine threat to the world/,
  darkAddition: /options always include refusing/,
  consent: /The player agreed to this scenario outside the story/,
  allowed: /Allowed on the page \(the player opted in\)/,
  win: /The Lines and Veils win over everything above in this contract\./,
};

const worldOf = (content: ContentSettings, rating: ImageRating = "sfw") => ({
  content,
  images: { connectionId: null, rating, ask: false, expressions: true },
});
/** The content the server would store for a gated player who asked for this (enforceContent with the gate). */
const stored = (heat: Heat, darkness: Darkness, limits: Partial<Record<LimitId, LimitLevel>> = {}, gate = true) =>
  enforceContent({ heat, darkness, limits: { ...LIMIT_DEFAULTS[darkness], ...limits }, custom: [] }, gate);
const contract = (content: ContentSettings, kind: ContractKind = "scene", lis: ReadonlyArray<{ name: string }> = LIS) =>
  otomeContentContract({ world: worldOf(content), lis, kind });
const bulletIndex = (text: string, pattern: RegExp) => text.split("\n").findIndex((line) => pattern.test(line));
const systemOf = (messages: Array<{ content: string }>) => messages[0]!.content;

test("each Heat and Darkness adds only its own wording, and only in NSFW mode (NSFW Heat or Dark romance)", () => {
  for (const heat of HEATS) {
    for (const darkness of DARKNESSES) {
      const nsfw = heat !== "sfw" || darkness === "dark";
      for (const kind of TEXT_KINDS) {
        const text = contract(stored(heat, darkness), kind);
        const at = `${kind} ${heat} ${darkness}`;
        const has = (pattern: RegExp, expected: boolean) =>
          assert.equal(pattern.test(text), expected, `${at} ${pattern}`);
        has(NSFW_WORDING.noMinors, nsfw);
        has(NSFW_WORDING.romance, nsfw);
        has(NSFW_WORDING.language, nsfw);
        has(NSFW_WORDING.win, nsfw);
        has(NSFW_WORDING.fade, heat === "fade");
        has(NSFW_WORDING.explicit, heat === "explicit");
        has(NSFW_WORDING.dark, darkness === "dark");
        has(NSFW_WORDING.darkAddition, darkness === "dark");
        has(NSFW_WORDING.angst, darkness === "angst" && heat !== "sfw");
        has(/No menace on the page/, darkness === "gentle");
        has(/never threatens or harms the protagonist/, darkness === "angst");
        // Gentle allows nothing by default; NSFW mode says what the player let onto the page.
        has(NSFW_WORDING.allowed, nsfw && darkness !== "gentle");
        // The fixed rules stay on every contract.
        assert.match(text, /adult \(18 or older\)/, at);
        assert.match(text, /No real people\. Nothing is aimed at the real player/, at);
        assert.match(text, /If the story reaches for a Line, it turns away\./, at);
      }
    }
  }
  // The Dark romance text keeps the protagonist alive, and explicit Heat still means the characters are adults.
  assert.match(contract(stored("explicit", "dark")), /the story never ends the protagonist's life/);
  assert.match(contract(stored("explicit", "dark")), /sex between the adult characters involved/);
});

test("a Line or Veil the player set always appears, after everything NSFW mode adds, and wins", () => {
  const content: ContentSettings = {
    ...stored("explicit", "dark", { gore: "line", torture: "allow", "non-consent": "veil" }),
    custom: [
      { text: "spiders", level: "line" },
      { text: "drowning", level: "veil" },
    ],
  };
  for (const kind of TEXT_KINDS) {
    const text = contract(content, kind);
    const lines = bulletIndex(text, /^- Lines \(never written, not even implied\): /);
    const veils = bulletIndex(text, /^- Veils \(may happen only off the page/);
    assert.match(text.split("\n")[lines]!, /gore; [^\n]*pregnancy; spiders\.$/, kind);
    assert.match(text.split("\n")[veils]!, /non-consent; drowning\.$/, kind);
    assert.doesNotMatch(text.split("\n")[bulletIndex(text, NSFW_WORDING.allowed)]!, /gore|non-consent/, kind);
    assert.match(text.split("\n")[bulletIndex(text, NSFW_WORDING.allowed)]!, /torture/, kind);
    for (const pattern of Object.values(NSFW_WORDING).filter((pattern) => pattern !== NSFW_WORDING.win)) {
      const index = bulletIndex(text, pattern);
      if (index >= 0) assert.ok(index < lines && index < veils, `${kind}: ${pattern} comes before the Lines and Veils`);
    }
    assert.equal(bulletIndex(text, NSFW_WORDING.win), veils + 1, `${kind}: they win, right after them`);
  }
  // Home, care and summary prompts keep every Line and Veil as "never write or mention", under any Heat.
  for (const kind of ["home", "care", "summary"] as const) {
    assert.match(contract(content, kind), /Never write or mention: [^\n]*gore[^\n]*spiders[^\n]*drowning/, kind);
  }
});

test("non-consent stays a Line unless the player lifted it under Dark, NSFW Heat and the 18+ gate", () => {
  const nonConsentIn = (text: string, heading: RegExp) =>
    (text.split("\n")[bulletIndex(text, heading)] ?? "").includes("non-consent");
  for (const gate of [false, true]) {
    for (const heat of HEATS) {
      for (const darkness of DARKNESSES) {
        const lifted = gate && darkness === "dark" && heat !== "sfw";
        const content = stored(heat, darkness, { "non-consent": "allow" }, gate);
        const text = contract(content);
        const at = `${heat} ${darkness} gate=${gate}`;
        assert.equal(nonConsentIn(text, /^- Lines /), !lifted, at);
        assert.equal(nonConsentIn(text, NSFW_WORDING.allowed), lifted, at);
        // A document that holds it open past the rules (written by hand, or by an older build) is still a Line.
        const forced = contract({ ...content, limits: { ...content.limits, "non-consent": "allow" } });
        assert.equal(nonConsentIn(forced, /^- Lines /), !(darkness === "dark" && content.heat !== "sfw"), at);
      }
    }
  }
});

test("the consent framing appears only while dubious consent or non-consent is not a Line, and names Ease off", () => {
  const consent = (content: ContentSettings) => NSFW_WORDING.consent.test(contract(content));
  assert.equal(consent(defaultContent()), false);
  assert.equal(consent(stored("sfw", "dark")), false, "SFW Heat holds both at Line");
  assert.equal(consent(stored("explicit", "angst")), false, "outside Dark both are Lines");
  assert.equal(consent(stored("fade", "dark")), true, "Dark's default Veil on dubious consent opens it");
  assert.equal(consent(stored("fade", "dark", { "dubious-consent": "line" })), false, "both Lines: never");
  assert.equal(consent(stored("explicit", "dark", { "dubious-consent": "line", "non-consent": "allow" })), true);
  const text = contract(stored("explicit", "dark"));
  assert.match(text, /The only real stops are the player's own: Ease off, and their Lines\./);
  assert.match(text, /written as a refusal, never as secret wanting/);
  assert.match(text, /When a choice is about intimacy, one option lets the protagonist decline/);
});

test("summaries stay non-explicit, whatever the Heat, Darkness and limits", () => {
  const open = stored("explicit", "dark", { "non-consent": "allow", "dubious-consent": "allow", torture: "allow" });
  const summary = contract(open, "summary");
  assert.match(summary, /Heat: SFW\./);
  assert.match(summary, /Summarize in neutral, non-explicit words; intimacy is named, never described\./);
  for (const pattern of Object.values(NSFW_WORDING)) assert.doesNotMatch(summary, pattern);
  assert.doesNotMatch(summary, /Heat: NSFW|Dark romance|Allowed on the page/);
  // P18 (chat memory) carries that contract, for the one love interest, and the neutral wording.
  const memory = systemOf(
    chatMemoryMessages({
      world: { language: "English", ...worldOf(open, "explicit") },
      names: { li: "Kai", player: "Ines" },
      conversation: "Kai: Come here.",
    }),
  );
  assert.ok(memory.includes(contract(open, "summary", [{ name: "Kai" }])));
  assert.match(memory, /no sexual detail/);
  assert.doesNotMatch(memory, /Heat: NSFW|anatomically/);
});

/** A small world for the story builders. */
function storyInputs(content: ContentSettings, rating: ImageRating = "sfw") {
  const world = normalizeWorld({ premise: "Lanterns.", content, images: { rating }, connections: { narration: "c" } });
  const units: Unit[] = CAST.map((li) => ({
    ...normalizeUnit({}),
    id: li.id,
    name: li.name,
    pronouns: HE,
    bible: bible(),
  }));
  const player = { ...normalizePlayer({}), name: "Ines", pronouns: SHE };
  return { world, units, player, state: normalizeState({}) };
}

const cgNode = (kind: ChapterNode["kind"] = "beat") =>
  ({ i: 0, kind, guide: "After the storm.", cast: [KAI], cg: true }) as ChapterNode;

function beatPrompt(content: ContentSettings, rating: ImageRating, kind: ChapterNode["kind"] = "beat") {
  const input = storyInputs(content, rating);
  const node = cgNode(kind);
  const chapter = { kind: "main" as const, number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [node] };
  const args = { ...input, chapter, node, storySoFar: "", memory: "" };
  return systemOf(kind === "confrontation" ? confrontationMessages({ ...args, li: KAI }) : beatMessages(args));
}

test("NSFW Heat and Dark romance reach the story prompts only with the 18+ confirmation and those settings", async () => {
  const runKey = "r-nsfwgate-aaaaaa";
  const replies = Array.from(
    { length: 6 },
    () => (messages: CapabilityLanguageModelMessage[]) =>
      systemOf(messages).includes("chapter planner") ? json(planReply()) : json(beatReply()),
  );
  const t = await storyWorld({ runKey, replies });
  const runs = routesOf(registerRunRoutes, t.deps, runKey);
  const asked = {
    ...stored("explicit", "dark", { "non-consent": "allow" }),
    limits: { ...LIMIT_DEFAULTS.dark, "non-consent": "allow" as const },
  };
  const node = { i: 0, kind: "beat", guide: "Rain.", cast: [KAI] } as ChapterNode;
  const scenePrompt = async () => {
    const run = (await readRun(t.store, t.runId))!;
    const chapter = { kind: "main" as const, number: 1, title: "Rain", lead: KAI, foil: MIR, nodes: [node] };
    return systemOf(beatMessages({ ...run, chapter, node, storySoFar: "", memory: "" }));
  };
  const sfw = contract(defaultContent(), "scene", [{ name: "Kai" }]);

  // No gate: the raise is refused, the world keeps the SFW defaults, and so does every prompt built from it.
  const refused = await runs("POST", "/runs/:run/settings", { content: asked, images: { rating: "explicit" } });
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, "age-gate");
  assert.ok((await scenePrompt()).includes(sfw));

  // With the gate and the settings, the planner the model is sent and the scene contract carry NSFW mode.
  assert.equal((await runs("POST", "/age-gate", { confirm: true })).status, 200);
  const raised = await runs("POST", "/runs/:run/settings", { content: asked, images: { rating: "explicit" } });
  assert.equal(raised.status, 200, JSON.stringify(raised.body));
  const planned = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  const planner = systemOf(t.calls[0]!.messages);
  for (const text of [planner, await scenePrompt()]) {
    assert.match(text, /Heat: NSFW, explicit\./);
    assert.match(text, NSFW_WORDING.explicit);
    assert.match(text, NSFW_WORDING.dark);
    assert.match(text, NSFW_WORDING.consent);
    assert.match(text, /Allowed on the page \(the player opted in\): [^\n]*non-consent/);
    assert.match(text, /Lines \(never written, not even implied\): pregnancy\./);
    assert.match(text, NSFW_WORDING.win);
  }
  assert.match(planner, /a first night together/, "the planner may give a first night a key image");

  // Revoking the gate lowers the world (SFW Heat, Angst; the limits the player set are kept, the fixed ones Lines),
  // and nothing of NSFW mode reaches a prompt again.
  assert.equal((await runs("POST", "/age-gate/revoke")).status, 200);
  const lowered = await scenePrompt();
  assert.match(lowered, /Heat: SFW\. [^\n]*\n- Darkness: Angst\. [^\n]*never threatens or harms the protagonist\.\n/);
  assert.match(lowered, /Lines \(never written, not even implied\): [^\n]*non-consent/);
  for (const pattern of Object.values(NSFW_WORDING)) assert.doesNotMatch(lowered, pattern);
  const world = (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  assert.equal(world.content.limits["non-consent"], "line");
  assert.equal(world.images.rating, "sfw");
});

test("the cg brief learns what the rating lets it show; only Explicit Heat with the Explicit rating may mark it explicit", () => {
  for (const kind of ["beat", "confrontation"] as const) {
    const both = beatPrompt(stored("explicit", "dark"), "explicit", kind);
    assert.match(both, /"cg": \{"at": 0, "brief": "\.\.\.", "cast": \["\.\.\."\], "explicit": false\}/, kind);
    assert.match(both, /say plainly who is undressed[^\n]*set "explicit": true\./, kind);
    assert.match(both, /Never draw a Line; a Veil only as its before or after\. Everyone in the frame is an adult\./);
    // Fade Heat keeps the sex off the page, so its key image stays suggestive even at the Explicit rating.
    const fade = beatPrompt(stored("fade", "dark"), "explicit", kind);
    assert.doesNotMatch(fade, /"explicit"/, kind);
    assert.match(fade, /implied intimacy; never exposed nipples, genitals or a sex act/, kind);
    const sfwImages = beatPrompt(stored("explicit", "dark"), "sfw", kind);
    assert.match(sfwImages, /everyone clothed; intimacy shown through faces, hands and closeness/, kind);
    assert.doesNotMatch(sfwImages, /"explicit"/, kind);
  }
  // P10 and P5 may give a first night together a key image only under NSFW Heat.
  const route = (content: ContentSettings) =>
    systemOf(routePlanMessages({ ...storyInputs(content), li: KAI, memory: "", stage: 2 }));
  assert.match(route(stored("fade", "angst")), /under this Heat, a first night together counts/);
  assert.doesNotMatch(route(stored("sfw", "dark")), /first night/);
  const plan = (content: ContentSettings) =>
    systemOf(chapterPlanMessages({ ...storyInputs(content), number: 2, lead: KAI, memory: "" }));
  assert.match(plan(stored("explicit", "gentle")), /a rescue, or under this Heat a first night together\)/);
  assert.doesNotMatch(plan(stored("sfw", "dark")), /first night/);
});

test("P20: Memory art stays at most Suggestive and every look a complete clothed look above SFW", () => {
  const input = storyInputs(stored("explicit", "dark"), "explicit");
  const banner = (kind: "memories" | "his-wardrobe") =>
    systemOf(bannerPlanMessages({ kind, ...input, featured: input.units[0]!, earlierTitles: [], memory: "" }));
  const memories = banner("memories");
  assert.match(memories, /The key image at this rating: allure, embraces, bare shoulders, implied intimacy/);
  assert.doesNotMatch(memories, /set "explicit"/, "Memory art is painted before its story exists");
  assert.match(
    memories,
    /Every look stays a complete clothed look: it may be revealing \(lingerie, swimwear\), never nude\./,
  );
  assert.match(
    memories,
    /IMAGE TAGS every outfit line and key image brief must fit: suggestive, tasteful, clothed, adult/,
  );
  assert.doesNotMatch(banner("his-wardrobe"), /The key image at this rating/, "a wardrobe banner has no key image");
});

test("a brief's explicit mark is kept only when the world allowed it as the beat was written", () => {
  const context = { node: cgNode(), units: CAST, state: normalizeState({}), last: false };
  const reply = beatReply({ cg: { at: 1, brief: "In the lamp room, undressed.", cast: ["Kai"], explicit: true } });
  const kept = normalizeBeatReply(reply as never, { ...context, cgExplicit: true });
  const dropped = normalizeBeatReply(reply as never, { ...context, cgExplicit: false });
  assert.ok(typeof kept !== "string" && typeof dropped !== "string");
  assert.equal(kept.cg?.explicit, true);
  assert.equal(dropped.cg?.explicit, undefined);
  assert.equal(dropped.cg?.brief, "In the lamp room, undressed.");
});

// ── Images ──

const PLAIN = { styleText: "", positiveTags: "", negativeTags: "" };
const TAGGED = { styleText: "anime", positiveTags: "masterpiece", negativeTags: "lowres", tagged: true };
const ADULT_TERMS = ["child", "childlike", "minor", "underage", "school uniform"];
const KAI_LOOK = {
  name: "Kai",
  identityLine: "tall man, grey eyes",
  outfitLine: "keeper's coat",
  presentation: "man" as const,
};
const INES_LOOK = {
  name: "Ines",
  identityLine: "short dark hair",
  outfitLine: "oilskin",
  presentation: "person" as const,
};
/** An edit that drops every tag, and one that writes the opposite of what the rating allows. */
const EDITS: Array<Partial<ImagePrompt>> = [
  {},
  { prompt: "red coat", negativePrompt: "blurry" },
  { prompt: "nsfw, nude, teenager", negativePrompt: "adult, mature" },
];

type Builder = {
  name: string;
  clothed: boolean;
  build: (world: ReturnType<typeof worldOf>, style: typeof PLAIN, edited: Partial<ImagePrompt>) => ImagePrompt;
};
const FACE_UNIT = {
  ...normalizeUnit({}),
  name: "Kai",
  identityLine: "tall man, grey eyes",
  outfitLine: "keeper's coat",
  bible: bible({ look: { identityLine: "tall man", outfitLine: "keeper's coat", presentation: "man" } }),
};
const BUILDERS: Builder[] = [
  { name: "look", clothed: true, build: (world, style, edited) => lookPrompt({ ...KAI_LOOK, world, style }, edited) },
  {
    name: "face",
    clothed: true,
    build: (world, style) => expressionPrompt({ unit: FACE_UNIT, base: "/kai.png", face: "tender", world, style }),
  },
  {
    name: "pair",
    clothed: true,
    build: (world, style, edited) =>
      cgPrompt({ brief: "A couple portrait", people: [KAI_LOOK, INES_LOOK], world, style, use: "clothed" }, edited),
  },
  {
    name: "place",
    clothed: false,
    build: (world, style, edited) => placePrompt({ name: "Quay", tags: "harbour, no humans", world, style }, edited),
  },
  {
    name: "cg",
    clothed: false,
    build: (world, style, edited) =>
      cgPrompt({ brief: "In the lamp room", people: [KAI_LOOK, INES_LOOK], world, style, use: "cg" }, edited),
  },
  {
    name: "explicit cg",
    clothed: false,
    build: (world, style, edited) =>
      cgPrompt(
        { brief: "In the lamp room", people: [KAI_LOOK, INES_LOOK], world, style, use: "cg", explicit: true },
        edited,
      ),
  },
];

/** Every image, at every Heat, rating, style and edit. */
function* everyImage() {
  for (const heat of HEATS) {
    for (const rating of IMAGE_RATINGS) {
      const world = worldOf(stored(heat, "dark"), rating);
      for (const style of [PLAIN, TAGGED]) {
        for (const edited of EDITS) {
          for (const builder of BUILDERS) {
            yield { heat, rating, style, edited, builder, image: builder.build(world, style, edited) };
          }
        }
      }
    }
  }
}

const tags = (text: string) => text.split(",").map((tag) => tag.trim().toLowerCase());

test("the adult-only negatives stay on every image, at every rating and after any edit; nothing above SFW names a minor", () => {
  for (const { heat, rating, style, edited, builder, image } of everyImage()) {
    const at = `${builder.name} ${heat} ${rating} ${style.tagged ? "tagged" : "plain"} ${JSON.stringify(edited)}`;
    const negative = tags(image.negativePrompt);
    for (const term of ADULT_TERMS) assert.ok(negative.includes(term), `${at}: ${term}`);
    if (rating !== "sfw")
      for (const term of ["loli", "shota", "teenager"]) assert.ok(negative.includes(term), `${at}: ${term}`);
    // Everyone drawn is tagged an adult (a place draws nobody).
    if (builder.name !== "place") assert.match(image.prompt, /adult man/, at);
    // A sentence model (Grok drops negatives) is told in words above SFW.
    if (builder.name !== "place" && rating !== "sfw") {
      assert.equal(image.prompt.includes(ADULT_SENTENCE), !style.tagged, at);
    }
    // Above SFW an edit that names a minor loses that part (a face takes no edit).
    if (edited.prompt?.includes("teenager") && builder.name !== "face") {
      assert.equal(image.prompt.includes("teenager"), rating === "sfw", at);
    }
  }
  // So does a model-written brief.
  const world = worldOf(stored("explicit", "dark"), "explicit");
  const brief = "A 16-year-old watches from the door, in the lamp room, a schoolgirl outfit, candlelight";
  const { prompt } = cgPrompt({ brief, people: [KAI_LOOK], world, style: PLAIN, use: "cg", explicit: true });
  assert.doesNotMatch(prompt, /16-year-old|schoolgirl/);
  assert.match(prompt, /in the lamp room, candlelight/);
});

test("the explicit tags appear only at the Explicit rating, on a story CG marked explicit under Explicit Heat", () => {
  for (const { heat, rating, style, edited, builder, image } of everyImage()) {
    if (edited.prompt?.includes("nsfw")) continue; // the player's own words
    const at = `${builder.name} ${heat} ${rating} ${style.tagged ? "tagged" : "plain"}`;
    const explicit = builder.name === "explicit cg" && heat === "explicit" && rating === "explicit";
    assert.equal(/\bnsfw, explicit\b|explicit adult scene/.test(image.prompt), explicit, at);
    if (explicit) {
      assert.match(image.prompt, style.tagged ? /nsfw, explicit/ : /explicit adult scene/, at);
      // Adult and quality negatives only: nothing that would undress it again.
      assert.doesNotMatch(image.negativePrompt, /nude|nudity|nsfw|sex\b/, at);
    } else assert.doesNotMatch(image.prompt, /\bexplicit\b|\bnsfw\b/, at);
  }
});

test("base looks, faces, outfits and the pair portrait stay clothed portraits at every rating", () => {
  for (const { rating, style, edited, builder, image } of everyImage()) {
    if (!builder.clothed) continue;
    const at = `${builder.name} ${rating} ${style.tagged ? "tagged" : "plain"} ${JSON.stringify(edited)}`;
    const positive = tags(image.prompt.replace(/\.\s/g, ", ").replace(/\.$/, ""));
    assert.ok(positive.includes(rating === "sfw" ? "fully clothed" : "clothed"), at);
    if (!edited.prompt) assert.doesNotMatch(image.prompt, /\bnsfw\b|\bexplicit\b|\bnude\b/, at);
    const negative = tags(image.negativePrompt);
    for (const term of rating === "sfw"
      ? ["nudity", "nsfw", "sexual content"]
      : ["nude", "nudity", "nipples", "genitals", "sex", "explicit"]) {
      assert.ok(negative.includes(term), `${at}: ${term}`);
    }
  }
  // The look keeps the outfit line it is painted for.
  assert.match(
    lookPrompt({ ...KAI_LOOK, world: worldOf(stored("explicit", "dark"), "explicit"), style: PLAIN }).prompt,
    /keeper's coat/,
  );
});

test("a place carries no person or rating tags above SFW, and keeps the people and SFW negatives", () => {
  for (const rating of ["suggestive", "explicit"] as const) {
    for (const style of [PLAIN, TAGGED]) {
      const { prompt, negativePrompt } = placePrompt({
        name: "Quay",
        tags: "harbour, night, no humans",
        world: worldOf(stored("explicit", "dark"), rating),
        style,
      });
      assert.doesNotMatch(prompt, /adult|suggestive|explicit|clothed|safe for work|nsfw/, rating);
      assert.match(prompt, /no humans, scenery/);
      for (const term of ["people", "humans", "child", "loli", "nudity", "nsfw", "sexual content"]) {
        assert.ok(tags(negativePrompt).includes(term), `${rating}: ${term}`);
      }
    }
  }
});

test("an explicit CG only when the brief, Heat and rating all say so; then its people are drawn without their outfits", () => {
  for (const heat of HEATS) {
    for (const rating of IMAGE_RATINGS) {
      for (const explicit of [false, true]) {
        const world = worldOf(stored(heat, "dark"), rating);
        const { prompt } = cgPrompt({
          brief: "In the lamp room",
          people: [KAI_LOOK, INES_LOOK],
          world,
          style: PLAIN,
          use: "cg",
          explicit,
        });
        const all = explicit && heat === "explicit" && rating === "explicit";
        assert.equal(prompt.includes("explicit adult scene"), all, `${heat} ${rating} ${explicit}`);
        assert.equal(prompt.includes("keeper's coat"), !all, `${heat} ${rating} ${explicit}: outfit lines`);
        assert.match(prompt, /Kai: tall man, grey eyes/, "the identity line always stays");
      }
    }
  }
  // Memory art and the pair portrait never go explicit, even marked so.
  const world = worldOf(stored("explicit", "dark"), "explicit");
  const memory = cgPrompt({ brief: "x", people: [KAI_LOOK], world, style: PLAIN, use: "clothed", explicit: true });
  assert.doesNotMatch(memory.prompt, /explicit/);
  assert.match(memory.prompt, /keeper's coat/);
});

test("a stored CG is painted explicit only while Heat and the rating are both Explicit at the paid call", async () => {
  const t = await artWorld({ runKey: "r-nsfwcg01-aaaaaa", images: { rating: "explicit" } });
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    identityLine: "tall man, grey eyes",
    outfitLine: "keeper's coat",
  }));
  const setHeat = (heat: Heat) =>
    t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
      ...world,
      content: stored(heat, "dark"),
    }));
  await saveBeat(
    t.store,
    t.runId,
    beat(1, { cg: { at: 1, brief: "In the lamp room.", cast: ["Kai"], explicit: true } }),
  );
  await setHeat("explicit");
  const bare = await cgPromptFor(t.deps, t.runId, KEY, 1);
  assert.match(bare.prompt, /explicit adult scene/);
  assert.doesNotMatch(bare.prompt, /keeper's coat/);
  assert.match(bare.negativePrompt, /child, childlike, minor, underage, school uniform/);
  await setHeat("fade");
  const lowered = await cgPromptFor(t.deps, t.runId, KEY, 1);
  assert.match(lowered.prompt, /suggestive, tasteful/);
  assert.match(lowered.prompt, /keeper's coat/);
  assert.match(lowered.negativePrompt, /explicit, nude, nudity, nipples, genitals, sex/);
});
