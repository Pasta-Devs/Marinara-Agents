// Otome Forge: an LI's accent colour, the colour of his name plate and the glow behind his art. The pick is a detail,
// not an average: the most vivid hue a look carries (an earring, the eyes) wins over everything else, coloured pixels
// vote by chroma squared so a small bright thing outbids a big dull one, and the chroma backdrop a look is painted on
// (green, magenta or cyan, S/art/prompts.ts MATTES) is recognised by being both a matte hue and most of the picture,
// then dropped, so the backdrop never becomes his colour. Grey and transparent pixels never vote. No two name plates
// alike: a sampled colour that reads as one the cast already has falls back to the colour from his name, then to the
// first free palette tone. An accent saved by an older picker is a placeholder, so a story already in progress picks
// its colours again when it is opened.
import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCENT_PALETTE,
  ACCENT_SAMPLER_VERSION,
  accentFromPixels,
  accentIsPlaceholder,
  accentOf,
  castAccentFor,
  hueGap,
  nameAccent,
  pickDistinctAccent,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/accent.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import {
  normalizeState,
  toRunView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";

const hueOfHex = (colour: string) => {
  const [red, green, blue] = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16));
  const max = Math.max(red!, green!, blue!);
  const min = Math.min(red!, green!, blue!);
  const delta = max - min;
  if (!delta) return 0;
  const hue =
    max === red
      ? 60 * (((green! - blue!) / delta) % 6)
      : max === green
        ? 60 * ((blue! - red!) / delta + 2)
        : 60 * ((red! - green!) / delta + 4);
  return (hue + 360) % 360;
};

/** Pixels of RGBA: [r, g, b, a] entries. */
const pixels = (entries: Array<[number, number, number, number?]>) =>
  entries.flatMap(([r, g, b, a = 255]) => [r, g, b, a]);
const repeat = (count: number, entry: [number, number, number, number?]) =>
  pixels(Array.from({ length: count }, () => entry));

test("a small vivid detail wins over a large dull area", () => {
  // A coat in every hue of the picture, and one bright cyan earring: the earring is who he is.
  const picture = [...repeat(200, [120, 90, 40]), ...repeat(6, [0, 200, 255])];
  const accent = accentFromPixels(picture);
  assert.ok(accent, "a picture with a colour gives one");
  assert.ok(hueGap(hueOfHex(accent), 193) < 25, `the earring's cyan wins (got ${accent})`);
});

test("the chroma backdrop a look is painted on never becomes his colour", () => {
  // Each matte with a detail colour that is not near it: the detail is the pick, never the backdrop.
  const cases = [
    { matte: [0, 255, 0] as const, detail: [0, 200, 255] as const },
    { matte: [0, 255, 255] as const, detail: [230, 60, 90] as const },
    { matte: [255, 0, 255] as const, detail: [60, 200, 90] as const },
  ];
  for (const { matte, detail } of cases) {
    const picture = [...repeat(900, [...matte]), ...repeat(40, [230, 210, 197]), ...repeat(8, [...detail])];
    const accent = accentFromPixels(picture);
    assert.ok(accent, "the look's own colour still votes");
    const gap = hueGap(hueOfHex(accent), hueOfHex(`#${matte.map((v) => v.toString(16).padStart(2, "0")).join("")}`));
    assert.ok(
      gap > 40,
      `the detail's hue wins over matte ${matte.join(",")} (got ${accent}, ${Math.round(gap)}° away)`,
    );
  }
  assert.equal(accentFromPixels(repeat(400, [0, 255, 0])), null, "a backdrop alone picks nothing");
  assert.equal(accentFromPixels(repeat(400, [120, 120, 120])), null, "grey never votes");
  assert.equal(accentFromPixels(repeat(400, [0, 255, 0, 0])), null, "transparent pixels never vote");
});

test("a backdrop split either side of a bucket edge is still recognised and dropped", () => {
  // A painted backdrop is not one exact RGB value: its pixels land on both sides of a 15° bucket edge. Matte hues are
  // 120, 180 and 300, each exactly on an edge, so half the backdrop falls in each neighbour. Kept apart, neither half is
  // most of the picture and the backdrop would win on vividness; added together, the backdrop is dropped.
  const fromHsl = (hue: number) => {
    const h = ((hue % 360) + 360) % 360;
    const c = 1;
    const x = 1 - Math.abs(((h / 60) % 2) - 1);
    const [r, g, b] =
      h < 60
        ? [c, x, 0]
        : h < 120
          ? [x, c, 0]
          : h < 180
            ? [0, c, x]
            : h < 240
              ? [0, x, c]
              : h < 300
                ? [x, 0, c]
                : [c, 0, x];
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)] as [number, number, number];
  };
  const details = { 120: [0, 200, 255] as const, 180: [230, 60, 90] as const, 300: [60, 200, 90] as const };
  for (const matte of [120, 180, 300] as const) {
    const below = fromHsl(matte - 2);
    const above = fromHsl(matte + 2);
    assert.ok(hueGap(hueOfHex(`#${below.map((v) => v.toString(16).padStart(2, "0")).join("")}`), matte) < 5);
    const picture = [...repeat(450, [...below]), ...repeat(450, [...above]), ...repeat(8, [...details[matte]])];
    const accent = accentFromPixels(picture);
    assert.ok(accent, "the look's own detail still votes");
    assert.ok(
      hueGap(hueOfHex(accent), matte) > 40,
      `a split matte at ${matte}° is dropped, not picked (got ${accent})`,
    );
  }
});

test("a look dressed in its own matte colour keeps it when it is not most of the picture", () => {
  // The matte rule drops a backdrop, not a costume: a green dress beside a larger dull coat is not most of the coloured
  // picture, so its green is picked. Grey and skin never vote, so the coat has to be the other colour here.
  const dress = repeat(60, [0, 255, 0]);
  const coat = repeat(200, [120, 90, 40]);
  const accent = accentFromPixels([...dress, ...coat, ...repeat(400, [120, 120, 120]), ...repeat(20, [230, 210, 197])]);
  assert.ok(accent);
  assert.ok(hueGap(hueOfHex(accent), 120) < 40, `the green dress keeps its green (got ${accent})`);
});

test("two LIs picked in one pass never share a colour, and a failed save hands its colour back", () => {
  const kai = { id: "li-kai", name: "Kai", accent: "#E7A6B8" };
  const mir = { id: "li-mir", name: "Mir", accent: "#E7A6B8" };
  const cast = [kai, mir];
  const picked = new Map<string, string>();
  // Both portraits sample the same cyan in the same pass.
  const first = castAccentFor(kai, "#2FB7D6", cast, picked);
  picked.set(kai.id, first);
  const second = castAccentFor(mir, "#2FB7D6", cast, picked);
  assert.notEqual(second, first, "the second sibling cannot take the colour the first already chose");
  assert.ok(hueGap(hueOfHex(first), hueOfHex(second)) >= 30);
  // A save that fails gives its colour back: the next sibling may take it.
  const third = { id: "li-sol", name: "Sol", accent: "#E7A6B8" };
  const retried = new Map<string, string>();
  const taken = castAccentFor(kai, "#2FB7D6", [kai, third], retried);
  retried.set(kai.id, taken);
  retried.delete(kai.id); // the POST failed
  assert.equal(castAccentFor(third, "#2FB7D6", [kai, third], retried), taken, "the freed colour is available again");
});

test("the cast ends up with a different accent each", () => {
  const sampled = "#2FB7D6";
  const first = pickDistinctAccent(sampled, "Dottore", []);
  assert.equal(first, sampled.toUpperCase(), "his own colour stands when nobody else has it");
  const second = pickDistinctAccent(sampled, "Pantalone", [first]);
  assert.notEqual(second, first, "a second LI with the same sample takes another colour");
  assert.ok(hueGap(hueOfHex(second), hueOfHex(first)) >= 30);
  // A full cast stays distinct, whatever the names hash to.
  const names = ["Dottore", "Pantalone", "Childe", "Zhongli", "Baizhu"];
  const cast: string[] = [];
  for (const name of names) cast.push(pickDistinctAccent(sampled, name, cast));
  assert.equal(new Set(cast).size, names.length, `every plate differs: ${cast.join(", ")}`);
  assert.ok(cast.every((colour) => ACCENT_PALETTE.some((tone) => tone === colour) || colour === sampled.toUpperCase()));
});

test("an accent from an older picker is picked again, so a story already in progress is recoloured", () => {
  const own = { accent: "#A8D8A0", name: "Kai" };
  assert.equal(accentIsPlaceholder({ ...own, accentSampler: ACCENT_SAMPLER_VERSION }), false, "his own is kept");
  assert.equal(accentIsPlaceholder({ ...own, accentSampler: 1 }), true, "an older picker's is stale");
  assert.equal(accentIsPlaceholder(own), true, "a story saved before this change is stale");
  // The stored green the old sampler left behind reads as the name colour, never as his own.
  const green = "#A8D8A0";
  assert.equal(accentOf({ accent: green, name: "Kai", accentSampler: 1 }), nameAccent("Kai"));
  // The default and the name colour stay placeholders however new the save is.
  assert.equal(accentIsPlaceholder({ accent: "#E7A6B8", name: "Kai", accentSampler: ACCENT_SAMPLER_VERSION }), true);
  assert.equal(
    accentIsPlaceholder({ accent: nameAccent("Kai"), name: "Kai", accentSampler: ACCENT_SAMPLER_VERSION }),
    true,
  );
});

test("the unit keeps the picker version and the run view carries it to the client", () => {
  assert.equal(normalizeUnit({}).accentSampler, 0, "an LI written before this change has no picker");
  assert.equal(normalizeUnit({ accent: "#112233", accentSampler: 2 }).accentSampler, 2);
  const world = normalizeWorld({ setting: "x" })!;
  const player = normalizePlayer({
    personaId: "",
    name: "Ines",
    pronouns: { subject: "she", object: "her", possessive: "her" },
    goal: "",
    about: "",
  })!;
  const unit = normalizeUnit({ id: "li-kai", name: "Kai", accent: "#112233", accentSampler: 2 });
  const view = toRunView("run-key", world, player, [unit], normalizeState({ lis: { "li-kai": {} } }));
  assert.equal(view.lis[0]!.accentSampler, 2);
  assert.equal(view.lis[0]!.accent, "#112233");
  // An LI from before the change sends none, which the client reads as a stale pick.
  const older = normalizeUnit({ id: "li-mir", name: "Mir", accent: "#112233" });
  const olderView = toRunView("run-key", world, player, [older], normalizeState({ lis: { "li-mir": {} } }));
  assert.equal(olderView.lis[0]!.accentSampler, undefined);
  assert.equal(accentIsPlaceholder(olderView.lis[0]!), true);
});
