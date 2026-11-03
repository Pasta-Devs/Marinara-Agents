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
  cgReferences,
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
  // Their setup portrait stays behind the look, should its file be gone.
  assert.deepEqual(kai!.image, {
    kind: "character",
    portrait: coat.url,
    avatarPath: "/api/global-gallery/file/kai.png",
  });
  assert.deepEqual(sol!.image, {
    kind: "character",
    portrait: gown.url,
    avatarPath: "/api/global-gallery/file/sol.png",
  });
  assert.deepEqual(cgReferences(subjects), { units: [kai!.image, sol!.image], labels: ["Kai", "Sol"] });
  // Alone: who they are, then the look they wear.
  const [alone] = cgSubjects(["Kai"], [unit("coat")], player("gown"));
  assert.equal((alone!.image as { wornOutfit?: string }).wornOutfit, "coat");
  assert.equal((alone!.image as { cardId?: string }).cardId, "card-kai");
  assert.deepEqual(cgReferences([alone!]).labels, ["Kai", "Kai's outfit"]);
});

test("whom each reference shows always matches what is sent: nobody without a picture, a persona's last (2026-11-03)", () => {
  // A love interest with no card, portrait or look has nothing to send: neither sent nor named.
  const bare = { ...unit(), cardId: undefined, portrait: undefined } as unknown as Unit;
  // A protagonist known only by her persona: its avatar may be empty, so she goes last and moves no one else's label.
  const personaOnly = { ...player(), portrait: undefined } as unknown as Player;
  const mir = {
    ...unit(),
    id: "mir",
    name: "Mireille Vane",
    cardId: "card-mir",
    portrait: undefined,
  } as unknown as Unit;
  const subjects = cgSubjects(["Sol", "Kai", "Mireille"], [bare, mir], personaOnly);
  const { units, labels } = cgReferences(subjects);
  assert.deepEqual(labels, ["Mireille", "Sol"]);
  assert.deepEqual(
    units.map((image) => image.cardId ?? image.personaId),
    ["card-mir", "persona-sol"],
  );
  // Alone with only a persona and a look: the look may be all that is sent, so it is named as her.
  const [her] = cgSubjects(["Sol"], [], { ...player("gown"), portrait: undefined } as unknown as Player);
  assert.deepEqual(cgReferences([her!]).labels, ["Sol"]);
});

test("without a worn look a CG keeps the base outfit and sends faces only", () => {
  const [kai, sol] = cgSubjects(["Kai", "Sol"], [unit()], player());
  assert.equal(kai!.person.outfitLine, "keeper's coat");
  assert.equal((kai!.image as { wornOutfit?: string }).wornOutfit, undefined);
  assert.equal(sol!.person.outfitLine, "travel cloak");
  assert.equal((sol!.image as { wornOutfit?: string }).wornOutfit, undefined);
});

test("two people who share a first name are each named in full; a namesake protagonist is still herself (2026-11-03)", () => {
  const ardent = { ...unit("coat"), name: "Kai Ardent" } as unknown as Unit;
  const brenner = { ...unit(), id: "kai-b", name: "Kai Brenner", cardId: "card-kb" } as unknown as Unit;
  const subjects = cgSubjects(["Kai Ardent", "Kai Brenner"], [ardent, brenner], player());
  assert.deepEqual(cgReferences(subjects).labels, ["Kai Ardent", "Kai Brenner"]);
  // A keepsake whose protagonist has the love interest's name: both of them, his picture then hers.
  const namesake = { ...player("gown"), name: "Kai" } as unknown as Player;
  const pair = cgSubjects(["Kai", "Kai"], [unit("coat")], namesake);
  assert.equal(pair.length, 2);
  // Each is their worn look: his coat, then her gown.
  assert.deepEqual(
    pair.map((subject) => subject.image?.portrait),
    [coat.url, gown.url],
  );
});
