// Otome Hearth M4: a CG dresses each person in the look they wear now. The prompt describes the worn look's outfit
// line. Alone, the subject names the look, so the kit sends its image after the face; with others, each person is one
// reference, the look they wear (art/cg.ts cgSubjects, the maintainer's anatomy report, 2026-11-03).
import assert from "node:assert/strict";
import test from "node:test";
import type {
  Player,
  Unit,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  cgReferenceLabels,
  cgSubjects,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cg.ts";

const coat = { id: "coat", name: "Coat", outfitLine: "long black greatcoat", url: "/api/global-gallery/file/coat.png" };
const gown = { id: "gown", name: "Gown", outfitLine: "silver evening gown", url: "/api/global-gallery/file/gown.png" };

const unit = (wornOutfit?: string) =>
  ({
    id: "kai",
    name: "Kai",
    cardId: "card-kai",
    portrait: "/api/global-gallery/file/kai.png",
    identityLine: "tall man, grey eyes",
    outfitLine: "keeper's coat",
    outfits: [coat],
    ...(wornOutfit ? { wornOutfit } : {}),
    bible: null,
  }) as unknown as Unit;

const player = (wornOutfit?: string) =>
  ({
    name: "Sol",
    personaId: "persona-sol",
    portrait: "/api/global-gallery/file/sol.png",
    look: { identityLine: "short woman, red hair", outfitLine: "travel cloak" },
    outfits: [gown],
    ...(wornOutfit ? { wornOutfit } : {}),
  }) as unknown as Player;

test("a CG describes and references the look each person wears now", () => {
  const subjects = cgSubjects(["Kai", "Sol"], [unit("coat")], player("gown"));
  const [kai, sol] = subjects;
  assert.equal(kai!.person.outfitLine, "long black greatcoat");
  assert.equal(sol!.person.outfitLine, "silver evening gown");
  // Two people: one picture each, the look they wear, never their face and their look as two standing figures.
  assert.deepEqual(kai!.image, { kind: "character", portrait: coat.url });
  assert.deepEqual(sol!.image, { kind: "character", portrait: gown.url });
  assert.deepEqual(cgReferenceLabels(subjects), ["Kai", "Sol"]);
  // Alone: who they are, then the look they wear.
  const [alone] = cgSubjects(["Kai"], [unit("coat")], player("gown"));
  assert.equal((alone!.image as { wornOutfit?: string }).wornOutfit, "coat");
  assert.equal((alone!.image as { cardId?: string }).cardId, "card-kai");
  assert.deepEqual(cgReferenceLabels([alone!]), ["Kai", "Kai's outfit"]);
});

test("without a worn look a CG keeps the base outfit and sends faces only", () => {
  const [kai, sol] = cgSubjects(["Kai", "Sol"], [unit()], player());
  assert.equal(kai!.person.outfitLine, "keeper's coat");
  assert.equal((kai!.image as { wornOutfit?: string }).wornOutfit, undefined);
  assert.equal(sol!.person.outfitLine, "travel cloak");
  assert.equal((sol!.image as { wornOutfit?: string }).wornOutfit, undefined);
});
