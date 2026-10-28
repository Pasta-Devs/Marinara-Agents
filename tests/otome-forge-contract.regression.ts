// Otome Forge's content contract and content rules (M1): every prompt kind gets the wording it may use (Home and
// care stay SFW under any Heat and still list the Lines), the Dark romance addition appears only under Dark, image
// prompts carry the rating and an adult tag for every person, and the 18+ gate and fixed Lines are enforced by the
// same pure rules on the client and the server.
import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOM_LIMIT_TEXT_MAX,
  CUSTOM_LIMITS_MAX,
  DARKNESSES,
  HEATS,
  IMAGE_RATINGS,
  LIMIT_DEFAULTS,
  LIMIT_IDS,
  defaultContent,
  enforceContent,
  limitIsFixed,
  limitsForDarkness,
  normalizeContent,
  normalizeImageRating,
  playerLimits,
  raisesGatedSetting,
  type ContentSettings,
  type ImageRating,
  type LimitLevel,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  emptyDraft,
  isBlankDraft,
  toSetupInput,
  type SetupDraft,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/screens/setup/draft.ts";
import {
  COMFORT_RULE,
  CONTRACT_KINDS,
  otomeContentContract,
  otomeContractReminder,
  type ContractKind,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/content-contract.ts";

const LIS = [
  { name: "Kai", presentation: "man" as const },
  { name: "Mireille", presentation: "woman" as const },
];
const TEXT_KINDS = CONTRACT_KINDS.filter((kind) => kind !== "image");
const DARK_ADDITION = /options always include refusing/;

function world(content: Partial<ContentSettings> = {}, rating: ImageRating = "sfw") {
  const base = defaultContent();
  const darkness = content.darkness ?? base.darkness;
  return {
    content: { ...base, limits: { ...LIMIT_DEFAULTS[darkness] }, ...content },
    images: { connectionId: null, rating, ask: false, expressions: true },
  };
}

const contract = (kind: ContractKind, content: Partial<ContentSettings> = {}, rating: ImageRating = "sfw") =>
  otomeContentContract({ world: world(content, rating), lis: LIS, kind });

test("Home, care and summary prompts use SFW wording under any Heat, and still list the Lines", () => {
  const custom = [{ text: "spiders", level: "line" as const }];
  for (const heat of HEATS) {
    for (const kind of ["home", "care", "summary"] as const) {
      const text = contract(kind, { heat, darkness: "dark", custom });
      assert.match(text, /^CONTENT CONTRACT\n/);
      assert.match(text, /Heat: SFW\./, `${kind} under ${heat}`);
      assert.doesNotMatch(text, /NSFW|explicit\./, `${kind} under ${heat}`);
      assert.match(text, /Never write or mention: [^\n]*non-consent/, `${kind} lists the Lines`);
      assert.match(text, /pregnancy/);
      assert.match(text, /spiders/, "and the player's own Lines");
      assert.doesNotMatch(text, DARK_ADDITION, "Dark romance never reaches these prompts");
      assert.doesNotMatch(text, /Menace and coercion/);
    }
  }
  assert.match(contract("home", { darkness: "dark" }), /possessive or sharp about story events only/);
  assert.doesNotMatch(contract("home", { darkness: "angst" }), /possessive/);
  assert.ok(contract("care", { heat: "explicit", darkness: "dark" }).includes(COMFORT_RULE));
  assert.ok(!contract("home").includes(COMFORT_RULE), "the comfort rule is only for care");
  assert.match(contract("summary", { heat: "explicit" }), /neutral, non-explicit words/);
});

test("planner, scene and chat prompts get the full contract; the Dark addition appears only under Dark", () => {
  for (const kind of ["planner", "scene", "chat"] as const) {
    assert.match(contract(kind, { heat: "explicit", darkness: "dark" }), /Heat: NSFW, explicit\./);
    assert.match(contract(kind, { heat: "fade", darkness: "dark" }), /Heat: NSFW, fade to black\./);
    assert.match(contract(kind), /Heat: SFW\./);
    assert.match(contract(kind, { darkness: "dark" }), DARK_ADDITION, kind);
    for (const darkness of ["gentle", "angst"] as const) {
      assert.doesNotMatch(contract(kind, { darkness }), DARK_ADDITION, `${kind} under ${darkness}`);
    }
    // Lines and Veils are named as such (under SFW Heat dubious consent is held at Line, whatever the document says).
    assert.match(contract(kind, { darkness: "dark" }), /Lines \(never written, not even implied\): dubious consent/);
    const dark = contract(kind, { heat: "fade", darkness: "dark" });
    assert.match(dark, /Lines \(never written, not even implied\): [^\n]*non-consent[^\n]*pregnancy/);
    assert.match(dark, /Veils \(may happen only off the page[^\n]*dubious consent/);
  }
  assert.match(contract("scene", { darkness: "angst" }), /never threatens or harms the protagonist/);
});

test("every text contract keeps the fixed rules, and the reminder points back at it", () => {
  for (const kind of TEXT_KINDS) {
    const text = contract(kind, { heat: "explicit", darkness: "dark" });
    assert.match(text, /adult \(18 or older\)/, kind);
    assert.match(text, /Kai, Mireille are adults/, kind);
    assert.match(text, /No school or student roles/, kind);
    assert.match(text, /No real people\. Nothing is aimed at the real player/, kind);
    assert.match(text, /No medical or self-harm advice outside the fiction/, kind);
    assert.match(text, /If the story reaches for a Line, it turns away\./, kind);
    assert.match(text, /Never mention these rules in the writing\./, kind);
    assert.match(otomeContractReminder(kind), /CONTENT CONTRACT/);
  }
  assert.equal(otomeContractReminder("image"), "");
});

test("image prompts carry the image rating and an adult tag for every person, whatever the Heat", () => {
  assert.equal(
    contract("image", { heat: "explicit", darkness: "dark" }),
    "safe for work, fully clothed, adult man, adult woman",
  );
  // The `image` contract is a clothed portrait's (P20's looks and Memory art): at most Suggestive, said in words too.
  const clothed =
    "suggestive, tasteful, clothed, adult man, adult woman, Everyone shown is an adult over 18 with an adult face and body";
  assert.equal(contract("image", {}, "suggestive"), clothed);
  assert.equal(contract("image", { heat: "explicit" }, "explicit"), clothed);
  const protagonist = otomeContentContract({ world: world(), lis: [{ name: "Her" }, ...LIS], kind: "image" });
  assert.equal(protagonist, "safe for work, fully clothed, adult person, adult man, adult woman");
  assert.equal(
    otomeContentContract({ world: world(), lis: [], kind: "image" }),
    "safe for work, fully clothed, adults only",
  );
  // Tag and CLIP models do not read negation: what a rating forbids goes only to the negative prompt.
  for (const rating of ["sfw", "suggestive", "explicit"] as const) {
    assert.doesNotMatch(contract("image", {}, rating), /\bno\b|nudity/, rating);
  }
  assert.doesNotMatch(contract("image", { darkness: "dark" }), /CONTENT CONTRACT|Heat|Dark/);
});

test("content defaults: Heat SFW, Darkness Angst, images SFW, pregnancy a Line, Dark as the design lists it", () => {
  assert.deepEqual(defaultContent(), { heat: "sfw", darkness: "angst", limits: LIMIT_DEFAULTS.angst, custom: [] });
  assert.equal(normalizeImageRating(undefined), "sfw");
  assert.equal(normalizeImageRating("nsfw"), "sfw");
  for (const darkness of DARKNESSES) {
    assert.equal(LIMIT_DEFAULTS[darkness].pregnancy, "line", darkness);
    assert.equal(LIMIT_DEFAULTS[darkness]["non-consent"], "line", darkness);
    assert.deepEqual(Object.keys(LIMIT_DEFAULTS[darkness]).sort(), [...LIMIT_IDS].sort());
  }
  const byLevel = (level: LimitLevel) => LIMIT_IDS.filter((id) => LIMIT_DEFAULTS.dark[id] === level);
  assert.deepEqual(byLevel("allow"), ["violence-others", "gore", "threats", "captivity", "manipulation", "stalking"]);
  assert.deepEqual(byLevel("veil"), ["violence-to-protagonist", "torture", "self-harm", "dubious-consent"]);
  assert.deepEqual(byLevel("line"), ["non-consent", "pregnancy"]);

  // A stored content keeps its good fields; bad ones take the defaults of its Darkness.
  const stored = normalizeContent({
    heat: "hot",
    darkness: "dark",
    limits: { gore: "nope", torture: "allow" },
    custom: [
      { text: "x", level: "allow" },
      { text: "y", level: "veil" },
    ],
  });
  assert.equal(stored.heat, "sfw");
  assert.equal(stored.darkness, "dark");
  assert.equal(stored.limits.gore, "allow");
  assert.equal(stored.limits.torture, "allow");
  assert.deepEqual(stored.custom, [{ text: "y", level: "veil" }]);
  assert.deepEqual(normalizeContent(undefined), defaultContent());
});

test("the 18+ gate: NSFW Heat, Dark romance and images above SFW need it; lowering never does", () => {
  const at = (heat: (typeof HEATS)[number], darkness: (typeof DARKNESSES)[number], imageRating: ImageRating) => ({
    heat,
    darkness,
    imageRating,
  });
  const base = at("sfw", "angst", "sfw");
  assert.equal(raisesGatedSetting(base, base), false);
  assert.equal(raisesGatedSetting(base, at("sfw", "gentle", "sfw")), false);
  assert.equal(raisesGatedSetting(at("sfw", "gentle", "sfw"), base), false, "Angst needs no gate");
  assert.equal(raisesGatedSetting(base, at("fade", "angst", "sfw")), true);
  assert.equal(raisesGatedSetting(base, at("sfw", "dark", "sfw")), true);
  assert.equal(raisesGatedSetting(base, at("sfw", "angst", "suggestive")), true);
  assert.equal(raisesGatedSetting(at("fade", "dark", "suggestive"), at("explicit", "dark", "suggestive")), true);
  assert.equal(raisesGatedSetting(at("fade", "dark", "suggestive"), at("fade", "dark", "explicit")), true);
  // Every lowering, and keeping a gated level, asks nothing.
  const all = HEATS.flatMap((heat) =>
    DARKNESSES.flatMap((darkness) => IMAGE_RATINGS.map((rating) => at(heat, darkness, rating))),
  );
  for (const from of all) {
    for (const to of all) {
      const lower =
        HEATS.indexOf(to.heat) <= HEATS.indexOf(from.heat) &&
        (to.darkness !== "dark" || from.darkness === "dark") &&
        IMAGE_RATINGS.indexOf(to.imageRating) <= IMAGE_RATINGS.indexOf(from.imageRating);
      assert.equal(raisesGatedSetting(from, to), !lower, JSON.stringify({ from, to }));
    }
  }
});

test("enforceContent only lowers: no gate, no NSFW or Dark; fixed limits are Lines; non-consent moves only when it can apply", () => {
  const permissive = (darkness: (typeof DARKNESSES)[number], heat: (typeof HEATS)[number]): ContentSettings => ({
    heat,
    darkness,
    limits: Object.fromEntries(LIMIT_IDS.map((id) => [id, "allow"])) as ContentSettings["limits"],
    custom: [],
  });
  const rank: Record<LimitLevel, number> = { allow: 0, veil: 1, line: 2 };
  for (const ageGate of [false, true]) {
    for (const heat of HEATS) {
      for (const darkness of DARKNESSES) {
        const asked = permissive(darkness, heat);
        const kept = enforceContent(asked, ageGate);
        assert.equal(kept.heat, ageGate ? heat : "sfw");
        assert.equal(kept.darkness, !ageGate && darkness === "dark" ? "angst" : darkness);
        for (const id of LIMIT_IDS) {
          assert.ok(rank[kept.limits[id]] >= rank[asked.limits[id]], "never raises a limit");
          assert.equal(
            kept.limits[id] === "line",
            limitIsFixed(id, kept, ageGate),
            `${id} ${heat} ${darkness} ${ageGate}`,
          );
        }
        // Non-consent is the player's to move only under Dark romance, NSFW Heat and the gate.
        assert.equal(kept.limits["non-consent"] !== "line", ageGate && darkness === "dark" && heat !== "sfw");
        if (kept.heat === "sfw") assert.equal(kept.limits["dubious-consent"], "line", "SFW: sexual items are Lines");
        if (kept.darkness !== "dark") assert.equal(kept.limits["violence-to-protagonist"], "line");
        assert.equal(kept.limits.pregnancy, "allow", "pregnancy is a default Line the player may change");
      }
    }
  }
  const custom = enforceContent(
    {
      ...defaultContent(),
      custom: [
        { text: "  ", level: "line" },
        ...Array.from({ length: 12 }, (_, index) => ({ text: ` ${"x".repeat(200)}${index} `, level: "veil" as const })),
      ],
    },
    false,
  );
  assert.equal(custom.custom.length, CUSTOM_LIMITS_MAX, "emptied ones dropped, the rest capped");
  assert.ok(custom.custom.every((limit) => limit.text.length === CUSTOM_LIMIT_TEXT_MAX && limit.text.startsWith("x")));
});

test("changing Darkness keeps every level the player set and gives the rest the new Darkness's defaults", () => {
  const angst = defaultContent();
  // Under Angst the player made gore and stalking Lines and let torture happen on the page.
  const chosen: ContentSettings = {
    ...angst,
    limits: { ...angst.limits, gore: "line", stalking: "line", torture: "allow" },
  };
  const picks = playerLimits(chosen, true);
  assert.deepEqual(picks, { gore: "line", stalking: "line", torture: "allow" });
  const dark = limitsForDarkness("dark", picks);
  assert.equal(dark.gore, "line", "a Line the player chose is never loosened by Dark's defaults");
  assert.equal(dark.stalking, "line");
  assert.equal(dark.captivity, LIMIT_DEFAULTS.dark.captivity, "an untouched limit takes the new default");
  // A round trip through Gentle (an arrow key across the radios) keeps them too.
  const back = limitsForDarkness("angst", picks);
  assert.deepEqual(back, chosen.limits);
  // A limit held at Line by the rules is not a pick, and nothing the player left alone is.
  assert.deepEqual(playerLimits(defaultContent(), false), {});
  const held = { ...angst, limits: { ...angst.limits, "violence-to-protagonist": "allow" as const } };
  assert.deepEqual(playerLimits(held, true), {}, "outside Dark it is held at Line, so it is not the player's level");
});

test("the wizard sends gated content as chosen (the server's 403 asks for the gate) and keeps no blank draft", () => {
  const draft: SetupDraft = {
    ...emptyDraft(),
    premise: "A masked court.",
    content: { ...defaultContent(), heat: "explicit", darkness: "dark", limits: { ...LIMIT_DEFAULTS.dark } },
    images: { ...emptyDraft().images, rating: "explicit" },
    connections: { ...emptyDraft().connections, narration: "conn-text" },
  };
  const input = toSetupInput(draft);
  assert.equal(input.content.heat, "explicit", "never quietly lowered to SFW");
  assert.equal(input.content.darkness, "dark");
  assert.equal(input.images.rating, "explicit");
  assert.equal(input.content.limits["non-consent"], "line", "fixed limits are still sent as Lines");

  assert.equal(isBlankDraft(emptyDraft()), true);
  const opened = {
    ...emptyDraft(),
    step: "premise" as const,
    connections: { ...emptyDraft().connections, narration: "c" },
  };
  assert.equal(isBlankDraft(opened), true, "the default story connection alone is not the player's work");
  assert.equal(isBlankDraft({ ...opened, premise: "A" }), false);
  assert.equal(isBlankDraft({ ...opened, connections: { ...opened.connections, chat: "c2" } }), false);
});
