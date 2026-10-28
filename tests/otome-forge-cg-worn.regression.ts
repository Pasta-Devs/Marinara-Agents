// Otome Hearth M4: a CG dresses each person in the look they wear now. The prompt describes the worn look's outfit
// line, and the subject names it, so the kit sends that look's image after the faces (art/cg.ts cgSubjects).
import assert from "node:assert/strict";
import test from "node:test";
import type {
  Player,
  Unit,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { cgSubjects } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cg.ts";

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
  const [kai, sol] = cgSubjects(["Kai", "Sol"], [unit("coat")], player("gown"));
  assert.equal(kai!.person.outfitLine, "long black greatcoat");
  assert.equal((kai!.image as { wornOutfit?: string }).wornOutfit, "coat");
  assert.equal(sol!.person.outfitLine, "silver evening gown");
  assert.equal((sol!.image as { wornOutfit?: string }).wornOutfit, "gown");
});

test("without a worn look a CG keeps the base outfit and sends faces only", () => {
  const [kai, sol] = cgSubjects(["Kai", "Sol"], [unit()], player());
  assert.equal(kai!.person.outfitLine, "keeper's coat");
  assert.equal((kai!.image as { wornOutfit?: string }).wornOutfit, undefined);
  assert.equal(sol!.person.outfitLine, "travel cloak");
  assert.equal((sol!.image as { wornOutfit?: string }).wornOutfit, undefined);
});
