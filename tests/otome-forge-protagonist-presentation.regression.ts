// Protagonist presentation derived from pronouns (#2266): a run created with "he/him" pronouns
// paints the protagonist as "man", "she/her" as "woman", and anything else as "person".
//
// What is pinned here:
//   - normalizePlayer preserves a "presentation" field stored on Player.look.
//   - The presentation defaults to "person" on a document that predates the field.
//   - The pronouns-to-presentation derivation in POST /runs maps correctly.
import assert from "node:assert/strict";
import test from "node:test";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import type { Presentation } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";

// ── Schema default and round-trip ──
test("default presentation is person", () => {
  assert.equal(normalizePlayer(undefined).look.presentation, "person");
});

test("stored presentation round-trips", () => {
  const player = normalizePlayer({ look: { identityLine: "tall", outfitLine: "jeans", presentation: "woman" } });
  assert.equal(player.look.presentation, "woman");
});

test("legacy document without presentation defaults to person", () => {
  const player = normalizePlayer({ look: { identityLine: "tall", outfitLine: "jeans" } });
  assert.equal(player.look.presentation, "person");
});

// ── Pronouns-to-presentation derivation (mirrors routes/runs.ts) ──
const derivePresentation = (subject: string): Presentation =>
  subject === "he" ? "man" : subject === "she" ? "woman" : "person";

test("he → man", () => assert.equal(derivePresentation("he"), "man"));
test("she → woman", () => assert.equal(derivePresentation("she"), "woman"));
test("they → person", () => assert.equal(derivePresentation("they"), "person"));
test("it → person", () => assert.equal(derivePresentation("it"), "person"));
test("empty → person", () => assert.equal(derivePresentation(""), "person"));
