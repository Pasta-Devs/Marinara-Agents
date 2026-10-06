/**
 * 7b-spice: the Creator's spice level under one Slurp-wide limit, public teases vs locked explicit
 * posts, the spicy kinds and partners, the player's taste (fit, frequency, variety, never list),
 * learning ("Slurp noticed you like …"), the sign-up limits moved out of the strategy text, and
 * the wiring that carries all of it to posts, chats, pictures and the Backstage.
 */
import assert from "node:assert/strict";
import {
  normalizeSlpSpice,
  SLP_DEFAULT_SPICE,
  SLP_EXPLICIT_LEVELS,
  SLP_SPICE_LEVELS,
  SLP_TASTE_IDEAS,
  slpClampExplicitLevel,
  slpSpiceChips,
  slpSpiceFromExplicit,
  slpSpiceFromStrategyText,
  type SlpSpiceState,
  type SlpTaste,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-spice.ts";
import { normalizeSlpCreatorSteering } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-creator-steering.ts";
import {
  slurpAnswerNoticed,
  slurpDmSpiceLevel,
  slurpLearnTaste,
  slurpNoticedTastes,
  slurpSpiceAngle,
  slurpSpiceBriefLines,
  slurpSpiceLanguageFor,
  slurpSpiceLabelsOf,
  slurpTasteChance,
  slurpTasteFit,
  slurpTasteLabelsIn,
  slurpTastePick,
  type SlurpSpiceCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-spice.ts";
import {
  sanitizeSlurpPostGuidance,
  selectSlurpExplicitLevel,
  slurpPostSexualLevel,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-guidance.ts";
import {
  slurpImageBrief,
  slurpImageNegativePrompt,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief.ts";
import { slurpCreatorStrategy } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-strategy.ts";
import { slurpSteeringContentChanged } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-prepared-rewrite.ts";
import { compileSlurpFlavourBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-flavour.ts";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation.ts";
import {
  slpSceneLimitsText,
  slpSceneSpicePatch,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/slp-scene-draft.ts";
import { FLAVOUR_FIXTURES } from "./slurp2-flavour-fixtures.ts";
import {
  SLURP_NO_TIES,
  slurpPairKey,
  slurpWorkingPartnerIds,
  type SlurpCreatorTies,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import { slurp2Source } from "./slurp2-source.ts";

const root = "packages/slurp2/src/engine/packages";
const server = (path: string) => slurp2Source(`${root}/server/src/slp/${path}`);
const client = (path: string) => slurp2Source(`${root}/client/src/slp/${path}`);

const anchors = (people: { name: string; relation: string }[] = []) => ({
  people,
  places: [],
  work: [],
  objects: [],
  habits: [],
  runningJokes: [],
  palette: {},
  heat: { min: 0, max: 3 },
});
const creator = (over: Partial<SlurpSpiceCreator> = {}): SlurpSpiceCreator => ({
  accountId: "creator-a",
  text: "A cheerful baker who loves early mornings.",
  turnOns: [],
  hardNoes: [],
  anchors: anchors(),
  ...over,
});
const taste = (text: string, strength: SlpTaste["strength"] = "hint"): SlpTaste => ({
  id: `t-${text}`,
  text,
  strength,
});
const state = (over: Partial<SlpSpiceState> = {}): SlpSpiceState => ({ ...SLP_DEFAULT_SPICE, ...over });

// --- 1. Level clamping to the Slurp-wide limit ---------------------------------------------------
assert.equal(SLP_DEFAULT_SPICE.max, "explicit", "no limit unless the player sets one");
assert.equal(slpClampExplicitLevel("explicit", "flirty"), "suggestive");
assert.equal(slpClampExplicitLevel("nudity", "flirty"), "suggestive");
assert.equal(slpClampExplicitLevel("explicit", "suggestive"), "nudity");
assert.equal(slpClampExplicitLevel("suggestive", "suggestive"), "suggestive", "under the limit stays");
assert.equal(slpClampExplicitLevel("none", "flirty"), "none", "a non-spicy Creator stays non-spicy");
for (const max of SLP_SPICE_LEVELS) {
  for (const level of SLP_EXPLICIT_LEVELS) {
    const clamped = slpClampExplicitLevel(level, max);
    assert.ok(SLP_EXPLICIT_LEVELS.indexOf(clamped) <= SLP_EXPLICIT_LEVELS.indexOf(level), "never raised");
    assert.ok(
      SLP_EXPLICIT_LEVELS.indexOf(clamped) <= SLP_SPICE_LEVELS.indexOf(max) + 1,
      `${level} under ${max} stays at or below the limit`,
    );
  }
}
assert.deepEqual(
  SLP_SPICE_LEVELS.map((level) => slpSpiceFromExplicit(slpClampExplicitLevel("explicit", level))),
  ["flirty", "suggestive", "explicit"],
);
// The Creator's own level, the Slurp-wide default, then the limit on top.
const guidance = sanitizeSlurpPostGuidance({
  defaults: { level: "nudity" },
  creators: { mira: { level: "explicit" } },
});
assert.equal(slpClampExplicitLevel(selectSlurpExplicitLevel(guidance, "mira"), "suggestive"), "nudity");
assert.equal(slpClampExplicitLevel(selectSlurpExplicitLevel(guidance, "kai"), "flirty"), "suggestive");
assert.equal(slpClampExplicitLevel(selectSlurpExplicitLevel(guidance, "mira"), "explicit"), "explicit");
assert.match(
  server("data/settings/slp-post-guidance-storage.ts"),
  /slpClampExplicitLevel\(selectSlurpExplicitLevel\(guidance, creatorId\), max\)/u,
  "the one level resolver every post reads applies the limit",
);
assert.match(
  server("features/messages/commissions/slp-commission-image-operation.ts"),
  /input\.level \?\? \(await resolveSlurpExplicitLevel\(db, account\.id\)/u,
  "chat pictures and commissions read the same clamped level",
);
assert.deepEqual(normalizeSlpSpice({ max: "wild" }).max, "explicit", "an unknown limit falls back");

// --- 2. Public posts tease; explicit goes locked ------------------------------------------------
assert.equal(slurpPostSexualLevel({ level: "explicit", access: "locked" }), "explicit");
assert.notEqual(slurpPostSexualLevel({ level: "explicit", access: "public" }), "explicit", "never explicit in public");
assert.equal(slurpPostSexualLevel({ level: "explicit", access: "locked", intent: "business" }), "none");
const base = {
  ceiling: "explicit" as const,
  creator: creator(),
  spice: state(),
  recent: [],
};
assert.equal(
  slurpSpiceAngle({ ...base, level: "nudity", access: "public", teaser: false, sequence: 1 }),
  null,
  "an ordinary public post gets no spicy angle",
);
const tease = slurpSpiceAngle({ ...base, level: "nudity", access: "public", teaser: true, sequence: 1 });
assert.ok(tease && /teases .* behind the lock/u.test(tease.line), "a public teaser hints at what sits behind the lock");
assert.equal(tease?.partner, null, "a teaser never shows a partner scene");
const lockedKinds = new Set<string>();
for (let sequence = 0; sequence < 200; sequence += 1) {
  const locked = slurpSpiceAngle({ ...base, level: "explicit", access: "locked", teaser: false, sequence });
  assert.ok(locked && /^This one is spicy: /u.test(locked.line));
  lockedKinds.add(locked!.kind);
}
for (const kind of ["lingerie", "nudes", "toys", "solo", "partnered"])
  assert.ok(lockedKinds.has(kind), `explicit locked posts include ${kind}`);
const flirtyKinds = new Set<string>();
const nudityKinds = new Set<string>();
for (let sequence = 0; sequence < 120; sequence += 1) {
  flirtyKinds.add(
    slurpSpiceAngle({ ...base, ceiling: "suggestive", level: "suggestive", access: "locked", teaser: false, sequence })!
      .kind,
  );
  nudityKinds.add(
    slurpSpiceAngle({ ...base, ceiling: "nudity", level: "nudity", access: "locked", teaser: false, sequence })!.kind,
  );
}
assert.deepEqual([...flirtyKinds].sort(), ["lingerie", "tease"], "flirty: lingerie and teasing only");
assert.ok(!["toys", "solo", "partnered"].some((kind) => nudityKinds.has(kind)), "suggestive: no sex");
assert.ok(nudityKinds.has("nudes"), "suggestive: nudes");
assert.equal(slurpSpiceAngle({ ...base, level: "none", access: "locked", teaser: false, sequence: 3 }), null);
// Each Creator is spicy in their own way: turn-ons pull their kind forward.
const count = (turnOns: string[], kind: string) =>
  Array.from({ length: 300 }, (_, sequence) =>
    slurpSpiceAngle({
      ...base,
      creator: creator({ turnOns }),
      level: "explicit",
      access: "locked",
      teaser: false,
      sequence,
    }),
  ).filter((angle) => angle?.kind === kind).length;
assert.ok(count(["toys"], "toys") > count([], "toys") * 1.8, "a Creator who loves toys posts toys more");
// Variety: the kind of the previous spicy post steps back.
let repeats = 0;
let recent: { kind: string }[] = [];
for (let sequence = 0; sequence < 200; sequence += 1) {
  const angle = slurpSpiceAngle({ ...base, level: "explicit", access: "locked", teaser: false, recent, sequence })!;
  if (recent[0]?.kind === angle.kind) repeats += 1;
  recent = [{ kind: angle.kind }, ...recent].slice(0, 6);
}
assert.ok(repeats <= 12, `the same kind twice in a row stays rare (${repeats} of 200)`);

// Partners: a couple partner from the card, a collab partner, or someone unnamed.
const couple = creator({ anchors: anchors([{ name: "Jonas", relation: "boyfriend" }]) });
const partners = new Map<string, number>();
for (let sequence = 0; sequence < 400; sequence += 1) {
  const angle = slurpSpiceAngle({
    ...base,
    creator: couple,
    collabs: ["Rue"],
    level: "explicit",
    access: "locked",
    teaser: false,
    sequence,
  });
  if (angle?.partner)
    partners.set(angle.partner.name ?? "unnamed", (partners.get(angle.partner.name ?? "unnamed") ?? 0) + 1);
}
assert.ok(partners.get("Jonas")! > partners.get("Rue")!, "the couple partner is the usual partner");
assert.ok(partners.get("Rue")! > 0 && partners.get("unnamed")! > 0, "collab and unnamed partners happen too");
const withPartner = Array.from({ length: 200 }, (_, sequence) =>
  slurpSpiceAngle({ ...base, creator: couple, level: "explicit", access: "locked", teaser: false, sequence }),
).find((angle) => angle?.partner?.name === "Jonas")!;
assert.match(withPartner.line, /sex with Jonas/u);
assert.match(withPartner.partner!.company, /Jonas, their boyfriend/u);
// Explicit pictures go through the same image pipeline: two people for a partner scene only.
const variation = slurpPostVariation("creator-a", 3, "off");
const picture = (partner?: string) =>
  slurpImageBrief({ cameraPhoto: "close up", variation, sexualLevel: "explicit", partner });
assert.match(picture("Jonas, their boyfriend"), /Two people: the Creator and Jonas, their boyfriend\./u);
assert.match(picture("Jonas, their boyfriend"), /explicit adult content with their partner/u);
assert.match(picture(), /The only person in the photo\./u);
assert.doesNotMatch(slurpImageNegativePrompt("explicit", true), /second person|extra people/u);
assert.match(slurpImageNegativePrompt("explicit", true), /duplicate person/u);
assert.match(slurpImageNegativePrompt("explicit"), /second person/u);
assert.match(slurpImageNegativePrompt("suggestive"), /nudity, nipples, genitals, sexual act/u);

// --- 3. The player's taste: fit, frequency, variety ---------------------------------------------
const feetLover = creator({ turnOns: ["feet", "stockings"] });
assert.equal(slurpTasteFit("feet", feetLover), 1, "their turn-ons fit best");
assert.equal(slurpTasteFit("early mornings", creator()), 0.5, "the card fits a little");
assert.equal(slurpTasteFit("feet", creator()), 0, "everyone else scores 0");
assert.equal(slurpTasteFit("feet", creator({ hardNoes: ["feet stuff"] })), -1, "a hard no always wins");
assert.equal(
  slurpTasteFit("oil", creator({ text: "She hates getting oil on her clothes." })),
  -1,
  "the card's own never/hates wins",
);
assert.ok(slurpTasteChance("hint", 0) > 0, "everyone a little");
assert.ok(slurpTasteChance("hint", 1) > slurpTasteChance("hint", 0), "a fitting Creator leans in more");
assert.ok(slurpTasteChance("obsessed", 0) > slurpTasteChance("hint", 0), "a stronger taste shows more");
const share = (spice: Pick<SlpSpiceState, "tastes" | "never">, who: SlurpSpiceCreator, runs = 3000) =>
  Array.from({ length: runs }, (_, sequence) => slurpTastePick(spice, who, who.accountId, sequence)).filter(Boolean)
    .length / runs;
const hint = { tastes: [taste("feet")], never: [] };
const average = share(hint, creator({ text: "Loves her feet being noticed." }));
assert.ok(average > 0.15 && average < 0.25, `a hint at an average fit: about 1 in 5 (${average.toFixed(3)})`);
const nobody = share(hint, creator());
assert.ok(
  nobody > 0.07 && nobody < 0.17,
  `a Creator it does not fit still touches it now and then (${nobody.toFixed(3)})`,
);
assert.ok(share(hint, feetLover) > average, "a Creator into it leans in more");
assert.ok(
  share({ tastes: [taste("feet", "obsessed")], never: [] }, creator()) > nobody * 2.5,
  "obsessed shows a lot more",
);
assert.equal(share(hint, creator({ hardNoes: ["feet"] })), 0, "never against a hard no");
// Variety: a taste is never picked twice in a row for one Creator; several tastes spread out.
const several = { tastes: [taste("feet", "obsessed"), taste("lingerie", "often"), taste("oil", "often")], never: [] };
let history: { taste: string | null }[] = [];
let twice = 0;
const seen = new Map<string, number>();
for (let sequence = 0; sequence < 600; sequence += 1) {
  const pick = slurpTastePick(several, feetLover, feetLover.accountId, sequence, history);
  if (pick && history[0]?.taste === pick.text) twice += 1;
  if (pick) seen.set(pick.text, (seen.get(pick.text) ?? 0) + 1);
  history = [{ taste: pick?.text ?? null }, ...history].slice(0, 6);
}
assert.equal(twice, 0, "never the same taste twice in a row");
assert.equal(seen.size, 3, "every taste shows up over time");
// The taste reaches the spicy angle, in the Creator's own way.
const touched = Array.from({ length: 60 }, (_, sequence) =>
  slurpSpiceAngle({
    ...base,
    creator: feetLover,
    spice: state({ tastes: [taste("feet", "obsessed")] }),
    level: "explicit",
    access: "locked",
    teaser: false,
    sequence,
  }),
).find((angle) => angle?.taste === "feet")!;
assert.match(touched.line, /Your fans have been into feet lately\. Work it in if you can, your way/u);

// --- 4. Never list ------------------------------------------------------------------------------
const never = { tastes: [taste("feet", "obsessed"), taste("toys", "obsessed")], never: ["toys"] };
for (let sequence = 0; sequence < 300; sequence += 1) {
  assert.notEqual(slurpTastePick(never, creator(), "x", sequence)?.text, "toys", "a never taste is never picked");
  const angle = slurpSpiceAngle({
    ...base,
    spice: state({ never: ["toys"] }),
    level: "explicit",
    access: "locked",
    teaser: false,
    sequence,
  });
  assert.notEqual(angle?.kind, "toys", "never means no toy posts at all");
  const noSex = slurpSpiceAngle({
    ...base,
    creator: creator({ hardNoes: ["sex with anyone"] }),
    level: "explicit",
    access: "locked",
    teaser: false,
    sequence,
  });
  assert.notEqual(noSex?.kind, "partnered", "a Creator's hard no rules partner scenes out");
}
const lines = slurpSpiceBriefLines({
  use: "dm",
  level: "explicit",
  turnOns: ["stockings"],
  hardNoes: ["face pics"],
  never: ["toys"],
  taste: "feet",
});
assert.ok(
  lines.some((line) => /sext fully explicitly, take custom requests/u.test(line)),
  "explicit DMs and customs",
);
assert.ok(lines.some((line) => line === "What turns you on and what you like showing: stockings."));
assert.ok(
  lines.some((line) => line === "Your hard noes, whatever anybody offers: face pics, toys."),
  "never joins the noes",
);
assert.ok(
  lines.some((line) => /has a thing for feet/u.test(line)),
  "sexting touches the taste",
);
assert.deepEqual(slurpSpiceBriefLines({ use: "dm", level: "none", turnOns: ["x"], hardNoes: [], never: [] }), []);
// 0.3.17: the Language choice says which words (how far is the post's own level line), and the
// dirty word list only once nudity is allowed. No stored language reads as "dirty" (the old default).
const post = (level: "suggestive" | "nudity" | "explicit", language?: "soft" | "frank" | "dirty") =>
  slurpSpiceBriefLines({ use: "post", level, turnOns: [], hardNoes: [], never: [], language }).join(" ");
assert.equal(post("suggestive"), "", "with dirty words a flirty level gets no language line");
assert.match(post("nudity"), /dirty everyday words/u);
assert.match(post("explicit", "soft"), /innuendo and euphemism/u);
assert.doesNotMatch(post("explicit", "frank"), /pussy/u);
assert.deepEqual(slurpSpiceBriefLines({ use: "post", level: "none", turnOns: [], hardNoes: [], never: [] }), []);
assert.equal(normalizeSlpSpice({}).language, null, "unset until the old preset is migrated");
assert.equal(normalizeSlpSpice({ language: "frank" }).language, "frank");
// The one-time migration: mild → soft; shipped steamy/explicit and the house style → dirty; an edited
// text keeps its own words.
const shipped = { mild: "MILD", dirty: ["STEAMY", "EXPLICIT", "HOUSE"] };
assert.equal(slurpSpiceLanguageFor("MILD", shipped), "soft");
assert.equal(slurpSpiceLanguageFor("STEAMY", shipped), "dirty");
assert.equal(slurpSpiceLanguageFor("HOUSE", shipped), "dirty");
assert.equal(slurpSpiceLanguageFor("Keep it classy. Do not write explicit sexual detail.", shipped), "soft");
assert.equal(slurpSpiceLanguageFor("Lots of tits and teasing.", shipped), "dirty");
assert.equal(slurpSpiceLanguageFor("Cozy, warm, a little cheeky.", shipped), "frank");
assert.equal(slurpDmSpiceLevel("explicit", true), "explicit", "subscribers get the Creator's level");
assert.equal(slurpDmSpiceLevel("explicit", false), "nudity", "everybody else gets the tease");
assert.ok(
  slurpSpiceBriefLines({ use: "dm", level: "nudity", held: true, turnOns: [], hardNoes: [], never: [] }).some((line) =>
    /for subscribers or a paid unlock/u.test(line),
  ),
);
for (const line of lines)
  assert.doesNotMatch(line, /\b(AI|fiction|simulat\w*|not real|disclaimer)\b/iu, "in-world words only");
// The brief carries the lines as one plain paragraph; no labels, no JSON.
const [mira] = FLAVOUR_FIXTURES;
const brief = compileSlurpFlavourBrief(
  { accountId: mira!.id, name: mira!.name, card: mira!.card, anchors: mira!.anchors, spice: lines },
  { use: "dm", sequence: 4 },
).text;
assert.ok(brief.includes("Your hard noes, whatever anybody offers: face pics, toys."));
assert.doesNotMatch(brief, /[{}]|\bturnOns\b|\bhardNoes\b/u);

// --- 5. Learning: "Slurp noticed you like …" ----------------------------------------------------
const at = new Date("2026-09-28T12:00:00Z");
const day = (days: number) => new Date(at.getTime() + days * 86_400_000);
let learned = state();
learned = slurpLearnTaste(learned, ["lingerie shoots"], "unlock", day(0));
learned = slurpLearnTaste(learned, ["lingerie shoots"], "unlock", day(1));
assert.deepEqual(slurpNoticedTastes(learned, day(1)), [], "two unlocks are not enough: it learns slowly");
learned = slurpLearnTaste(learned, ["lingerie shoots"], "tip", day(2));
learned = slurpLearnTaste(learned, ["lingerie shoots"], "like", day(2));
assert.deepEqual(slurpNoticedTastes(learned, day(2)), [{ label: "lingerie shoots", existing: false }]);
assert.deepEqual(slurpNoticedTastes(learned, day(120)), [], "an old interest fades");
const accepted = slurpAnswerNoticed(learned, "lingerie shoots", "accept", () => "new-id");
assert.deepEqual(accepted.tastes, [{ id: "new-id", text: "lingerie shoots", strength: "hint" }], "accept adds it");
assert.deepEqual(slurpNoticedTastes(accepted, day(2)), [], "an accepted chip is gone");
const stronger = slurpAnswerNoticed(learned, "lingerie shoots", "stronger", () => "id-2");
assert.equal(stronger.tastes[0]?.strength, "often", "strengthen adds it as often");
const removed = slurpAnswerNoticed(learned, "lingerie shoots", "remove", () => "id-3");
let again = removed;
for (let i = 0; i < 6; i += 1) again = slurpLearnTaste(again, ["lingerie shoots"], "tip", day(3));
assert.deepEqual(slurpNoticedTastes(again, day(3)), [], "a removed chip is never suggested again");
// A taste already on the list is offered stronger once it clearly shows.
let existing = state({ tastes: [taste("feet")] });
for (let i = 0; i < 3; i += 1) existing = slurpLearnTaste(existing, ["feet"], "tip", day(i));
assert.deepEqual(slurpNoticedTastes(existing, day(2)), [], "not yet");
for (let i = 0; i < 3; i += 1) existing = slurpLearnTaste(existing, ["Feet"], "unlock", day(3));
assert.deepEqual(slurpNoticedTastes(existing, day(3)), [{ label: "feet", existing: true }]);
assert.equal(slurpAnswerNoticed(existing, "feet", "stronger", () => "x").tastes[0]?.strength, "often");
let blocked = state({ never: ["toys"] });
for (let i = 0; i < 6; i += 1) blocked = slurpLearnTaste(blocked, ["toys"], "tip", day(0));
assert.deepEqual(slurpNoticedTastes(blocked, day(0)), [], "the never list is never suggested");
// Where the labels come from: a spicy post's stored kind and taste, a request's words.
assert.deepEqual(slurpSpiceLabelsOf({ slurpSpice: { kind: "toys", taste: "feet" } }), ["toys", "feet"]);
assert.deepEqual(slurpSpiceLabelsOf({ slurpSpice: { kind: "solo" } }), ["solo play"]);
assert.deepEqual(slurpSpiceLabelsOf({}), []);
assert.deepEqual(
  slurpTasteLabelsIn("Could you do a set in stockings with your new vibrator?", state(), SLP_TASTE_IDEAS).sort(),
  ["lingerie shoots", "stockings", "toys"],
  "stockings are also a lingerie shoot",
);
assert.deepEqual(
  slurpTasteLabelsIn("a nice talk about the weather", state(), SLP_TASTE_IDEAS),
  [],
  "one word of two is not dirty talk",
);
assert.equal(normalizeSlpSpice({ learned: { Feet: { score: 3, signals: 1, at: "x" } } }).learned.feet?.score, 3);

// --- 6. The sign-up chat's limits leave the strategy text -------------------------------------
const draft = { spice: "explicit", turnOns: "feet, lingerie and toys", hardNoes: "face pics; anal" };
const legacy = slpSceneLimitsText(draft as never);
const moved = slpSpiceFromStrategyText(`Posts every morning.\n${legacy}`);
assert.equal(moved.rest, "Posts every morning.");
assert.equal(moved.level, "explicit");
assert.deepEqual(moved.turnOns, ["feet", "lingerie", "toys"]);
assert.deepEqual(moved.hardNoes, ["face pics", "anal"]);
assert.equal(slpSpiceFromStrategyText("Just my own notes.").found, false);
assert.equal(
  slurpCreatorStrategy("mira", { strategyText: `Posts every morning.\n${legacy}` }).strategyText,
  "Posts every morning.",
  "the prompt no longer reads the old lines",
);
assert.deepEqual(slpSceneSpicePatch(draft as never), {
  spiceLevel: "explicit",
  turnOns: ["feet", "lingerie", "toys"],
  hardNoes: ["face pics", "anal"],
});
assert.equal(slpSceneSpicePatch({ spice: null, turnOns: " ", hardNoes: "" } as never), null);
assert.deepEqual(slpSpiceChips("Lingerie & stockings, oil"), ["Lingerie", "stockings", "oil"]);
const steering = normalizeSlpCreatorSteering({ turnOns: ["a", "A", "b"], hardNoes: "nope", limitsMoved: true });
assert.deepEqual(steering.turnOns, ["a", "b"]);
assert.deepEqual(steering.hardNoes, []);
assert.equal(steering.limitsMoved, true);
assert.ok(
  slurpSteeringContentChanged(normalizeSlpCreatorSteering({}), normalizeSlpCreatorSteering({ hardNoes: ["x"] })),
  "a new hard no asks about prepared posts",
);

// --- 7. Wiring --------------------------------------------------------------------------------
const generation = server("features/feed/slp-generation-service.ts");
const postSpice = server("features/feed/slp-post-spice.ts");
assert.match(generation, /const spiced = await planSlurpPostSpice\(db, \{/u, "posts plan their spicy side");
assert.match(postSpice, /slurpSpiceAngle\(\{/u, "posts draw their spicy angle");
assert.match(generation, /slurpPostLevelInstruction\(postLevel\),\n\s*spiceAngle\?\.line \?\? ""/u);
assert.match(postSpice, /slurpSpice: \{ kind: angle\.kind/u, "the post keeps what made it spicy");
assert.match(generation, /\.\.\.spiced\.metadata,/u);
assert.match(generation, /partner: spiceAngle\?\.partner\?\.company \?\? null/u, "the picture knows the partner");
assert.match(postSpice, /cast: \[\.\.\.input\.beat\.cast, partner\]/u, "a named partner is in the cast");
assert.match(generation, /spice: spiced\.spice/u, "the brief gets the same spice");
const dm = server("features/messages/slp-message-generation-service.ts");
assert.match(
  dm,
  /chat: \{\n\s*subscribed: input\.subscribed,\n\s*player: input\.viewer\.kind === "persona" && !fanVoice/u,
);
const operation = server("features/messages/slp-message-operation.ts");
// Slice I (user): a free chat picture is a tease for everybody (a subscriber's casual one too); a paid one goes all the way.
assert.match(
  operation,
  /level: \(offer\.price > 0 \|\| partner\) && !demanded \? creatorLevel : slurpDmSpiceLevel\(creatorLevel, false\)/u,
);
assert.match(
  server("data/creators/slp-flavour-source.ts"),
  /if \(input\.use === "comment" \|\| input\.use === "delivery"\) return \[\];/u,
);
for (const [path, pattern] of [
  [
    "features/economy/slp-wallet-routes.ts",
    /recordSlurpTasteSignal\(app\.db, \{ metadata: post\.metadata \}, "unlock"\)/u,
  ],
  [
    "features/economy/slp-wallet-routes.ts",
    /recordSlurpTasteSignal\(app\.db, \{ creatorId: creatorAccountId \}, "tip"\)/u,
  ],
  [
    "features/feed/slp-feed-post-routes.ts",
    /recordSlurpTasteSignal\(app\.db, \{ metadata: gated\.post\.metadata \}, parsed\.data\.type\)/u,
  ],
  [
    "features/messages/slp-messages-send-routes.ts",
    /recordSlurpTasteSignal\(app\.db, \{ creatorId: parsed\.data\.creatorAccountId \}, "tip"\)/u,
  ],
  ["features/messages/slp-messages-send-routes.ts", /"unlock"\);\n\s*\}/u],
  [
    "features/messages/commissions/slp-commissions-routes.ts",
    /recordSlurpTasteSignal\(app\.db, \{ text: parsed\.data\.brief \}, "request"\)/u,
  ],
] as const) {
  assert.match(server(path), pattern, `learning signal in ${path}`);
}
const routes = server("features/creators/slp-spice-routes.ts");
for (const route of ['app.get("/slurp/spice"', 'app.patch("/slurp/spice"', 'app.post("/slurp/spice/noticed"'])
  assert.ok(routes.includes(route), route);
assert.doesNotMatch(routes, /chatComplete|generate\w*\(/u, "the Spice page makes no AI calls");
assert.match(server("slp-server-entry.ts"), /await slpSpiceRoutes\(app\);/u);
const steeringRoutes = server("features/creators/slp-steering-routes.ts");
assert.match(steeringRoutes, /spiceLevel: z\.enum\(SLP_SPICE_STEPS\)\.nullable\(\)\.optional\(\)/u);
assert.match(steeringRoutes, /levelChanged \|\| slurpSteeringContentChanged/u);
assert.match(
  server("features/creators/slp-creators-routes.ts"),
  /subtree === "strategy"\) await moveSlurpStrategyLimits/u,
);
assert.match(client("app/backstage/slp-backstage-registry.ts"), /\{ target: "spice", Component: SlpSpicePanel \}/u);
assert.match(client("features/onboarding/slp-scene-model.ts"), /\/steering`, spice\)/u, "sign-ups write the spice");
assert.doesNotMatch(client("features/onboarding/slp-scene-model.ts"), /strategyText: limits/u);
const panel = client("features/creators/SlpSpicePanel.tsx");
for (const key of ["ui.slurp.spice.noticedAccept", "ui.slurp.spice.noticedStronger", "ui.slurp.spice.noticedRemove"])
  assert.ok(panel.includes(key), key);
const en = JSON.parse(client("locales/en.json")) as Record<string, string>;
for (const [key, value] of Object.entries(en).filter(([key]) => key.startsWith("ui.slurp.spice."))) {
  assert.doesNotMatch(value, /—|\b(AI|simulat\w*|fiction|not real)\b/u, `in-universe copy: ${key}`);
}

// --- 8. With collabs, rivalries and Slurp Support (merge of 7b-spice and 7b-c) ------------------
// Partner scenes: the pages paired in settings plus the collabs they made, never a blocked pair or
// an open rival, never an asked or declined collab.
const collab = (id: string, hostId: string, partnerId: string, status: string) =>
  ({ id, hostId, partnerId, status }) as unknown as SlurpCreatorTies["collabs"][number];
const rival = (fromId: string, toId: string, stage: string) =>
  ({ id: `${fromId}-${toId}`, fromId, toId, stage }) as unknown as SlurpCreatorTies["rivalries"][number];
const ties: SlurpCreatorTies = {
  ...SLURP_NO_TIES,
  collabs: [
    collab("c1", "mira", "rue", "posted"),
    collab("c2", "tess", "mira", "agreed"),
    collab("c3", "mira", "jo", "asked"),
    collab("c4", "mira", "kai", "declined"),
    collab("c5", "mira", "lin", "posted"),
    collab("c6", "ada", "bo", "posted"),
  ],
  rivalries: [rival("lin", "mira", "feud"), rival("mira", "tess", "over")],
  blocked: [slurpPairKey("mira", "sam")],
};
assert.deepEqual(slurpWorkingPartnerIds(ties, "mira", ["sam", "zoe", "rue"]).sort(), ["rue", "tess", "zoe"]);
assert.deepEqual(slurpWorkingPartnerIds(SLURP_NO_TIES, "mira", ["mira"]), [], "never their own partner");
// A collab post: a partner scene is with the collab partner, or there is none.
const madeWith = Array.from({ length: 300 }, (_, sequence) =>
  slurpSpiceAngle({
    ...base,
    creator: couple,
    madeWith: "Rue",
    level: "explicit",
    access: "locked",
    teaser: false,
    sequence,
  }),
);
const withRue = madeWith.filter((angle) => angle?.partner);
assert.ok(withRue.length > 0, "a collab post can be a partner scene");
assert.ok(
  withRue.every((angle) => angle!.partner!.name === "Rue" && angle!.partner!.kind === "collab"),
  "only with the collab partner, never the couple partner or someone unnamed",
);
assert.ok(
  Array.from({ length: 300 }, (_, sequence) =>
    slurpSpiceAngle({
      ...base,
      creator: couple,
      madeWith: null,
      level: "explicit",
      access: "locked",
      teaser: false,
      sequence,
    }),
  ).every((angle) => angle && !angle.partner && !/sex with/u.test(angle.line)),
  "no partner scene when the collab partner would not do one",
);
const postSpiceMerged = server("features/feed/slp-post-spice.ts");
assert.match(
  postSpiceMerged,
  /tie\?\.kind !== "sponsor" && tie\?\.kind !== "rival"/u,
  "no spicy angle on #ad or rivalry posts",
);
assert.match(postSpiceMerged, /slurpWorkingPartnerIds\(ties, creatorId, ids\)/u);
assert.match(
  generation,
  /const dialLevel = await resolveSlurpPostDial\(db, account\.id, plannedBeat\?\.tie\)/u,
  "a collab post goes only as far as both pages",
);
// Chats: Slurp Support's thread gets no spice; a fellow Creator's page gets the tease without the sales line.
const flavourSource = server("data/creators/slp-flavour-source.ts");
assert.match(flavourSource, /if \(input\.chat\?\.with === "staff"\) return \[\];/u);
assert.match(flavourSource, /held: Boolean\(input\.chat && input\.chat\.with !== "peer" && level !== spice\.level\)/u);
assert.match(dm, /with: input\.viewer\.id === SLURP_SUPPORT_ACCOUNT_ID \? "staff" : viewerPage \? "peer" : "fan"/u);
assert.equal(
  slurpSpiceBriefLines({ use: "dm", level: "nudity", held: false, turnOns: [], hardNoes: [], never: [] }).some((line) =>
    /subscribers or a paid unlock/u.test(line),
  ),
  false,
);
// Undo / Keep of a Support note answer with the spice too, so the Spice block stays on screen.
assert.equal(
  (steeringRoutes.match(/return answer\(id, await noteSlurpSupportChange\(app\.db, id, null\)\);/gu) ?? []).length,
  2,
);

console.log("slurp2 spice regression passed");
