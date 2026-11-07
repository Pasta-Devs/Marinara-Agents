// Otome Hearth M4: a CG dresses each person in the look they wear now. The prompt describes the worn look's outfit
// line. Alone, the subject names the look, so the kit sends its image after the face; with others, each person is one
// reference (the maintainer's anatomy report, 2026-11-03): who they are, with the look only as their last resort
// (0.9.5, #2145: a look painted without their likeness put a stranger's face in every group picture). The cast's
// names resolve at paint time (art/cg.ts resolveCast): ids, "you", titles, honorifics, surnames, accents.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  Player,
  Unit,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  type CastMember,
  cgReferences,
  cgSubjects,
  resolveCast,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cg.ts";
import { cgPrompt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";

const coat = { id: "coat", name: "Coat", outfitLine: "long black greatcoat", url: "/api/global-gallery/file/coat.png" };
const gown = { id: "gown", name: "Gown", outfitLine: "silver evening gown", url: "/api/global-gallery/file/gown.png" };

const unit = (wornOutfit?: string) =>
  ({
    id: "li-kai-ab12",
    name: "Kai",
    cardId: "card-kai",
    pronouns: { subject: "he", object: "him", possessive: "his" },
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
    pronouns: { subject: "she", object: "her", possessive: "her" },
    look: { identityLine: "short woman, red hair", outfitLine: "travel cloak" },
    outfits: [gown],
    ...(wornOutfit ? { wornOutfit } : {}),
  }) as unknown as Player;

test("a CG describes and references the look each person wears now", () => {
  const subjects = cgSubjects(["Kai", "Sol"], [unit("coat")], player("gown"));
  const [kai, sol] = subjects;
  assert.equal(kai!.person.outfitLine, "long black greatcoat");
  assert.equal(sol!.person.outfitLine, "silver evening gown");
  // Two people: one picture each, never their face and their look as two standing figures. It is who they are (his
  // card, her persona, then their setup portrait); the look they wear is tried last (avatarPath), and the kit adds no
  // look picture (no wornOutfit). The paint must show each as themselves (`who`).
  assert.deepEqual(kai!.image, {
    kind: "character",
    cardId: "card-kai",
    portrait: "/api/global-gallery/file/kai.png",
    avatarPath: coat.url,
    who: "Kai",
  });
  assert.deepEqual(sol!.image, {
    kind: "character",
    personaId: "persona-sol",
    portrait: "/api/global-gallery/file/sol.png",
    avatarPath: gown.url,
    who: "Sol",
  });
  assert.deepEqual(cgReferences(subjects), { units: [kai!.image, sol!.image], labels: ["Kai", "Sol"] });
  // The outfit line dresses them, so the references are only for face, hair and build.
  assert.deepEqual(
    subjects.map((subject) => subject.person.outfitInText),
    [true, true],
  );
  const style = { styleText: "", positiveTags: "", negativeTags: "" };
  const world = normalizeWorld({});
  const prompt = (people: typeof subjects) =>
    cgPrompt({
      brief: "At the lamp.",
      people: people.map((subject) => subject.person),
      world,
      style,
      use: "clothed",
      references: cgReferences(people).labels,
    }).prompt;
  assert.match(prompt(subjects), /face, hair and build, never for the pose/);
  assert.match(
    prompt(subjects),
    /Kai: tall man, grey eyes; long black greatcoat\./,
    "the outfit line still names the look",
  );
  // Without a look worn, the references still dress them.
  assert.match(prompt(cgSubjects(["Kai", "Sol"], [unit()], player())), /face, hair, build and clothing, never/);
  // Alone: who they are, then the look they wear, as today.
  const [alone] = cgSubjects(["Kai"], [unit("coat")], player("gown"));
  assert.equal((alone!.image as { wornOutfit?: string }).wornOutfit, "coat");
  assert.equal((alone!.image as { cardId?: string }).cardId, "card-kai");
  assert.equal(alone!.person.outfitInText, undefined);
  assert.deepEqual(cgReferences([alone!]).labels, ["Kai", "Kai's outfit"]);
  assert.match(prompt([alone!]), /face, hair, build and clothing, never/);
});

test("an archetype alone in a look, with no card or portrait, sends the look labelled as him (#2145)", () => {
  const archetype = { ...unit("coat"), cardId: undefined, portrait: undefined } as unknown as Unit;
  const [alone] = cgSubjects(["Kai"], [archetype], player());
  assert.deepEqual(cgReferences([alone!]), {
    units: [{ kind: "character", outfits: [coat], wornOutfit: "coat", who: "Kai" }],
    labels: ["Kai"],
  });
});

test("whom each reference shows always matches what is sent: nobody without a picture, a persona's last (2026-11-03)", () => {
  // A love interest with no card, portrait or look has nothing to send: neither sent nor named.
  const bare = { ...unit(), cardId: undefined, portrait: undefined } as unknown as Unit;
  // A protagonist known only by her persona: its avatar may be empty, so she goes last and moves no one else's label.
  const personaOnly = { ...player(), portrait: undefined } as unknown as Player;
  const mir = {
    ...unit(),
    id: "li-mir-cd34",
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
  const brenner = { ...unit(), id: "li-kai-b-ef56", name: "Kai Brenner", cardId: "card-kb" } as unknown as Unit;
  const subjects = cgSubjects(["Kai Ardent", "Kai Brenner"], [ardent, brenner], player());
  assert.deepEqual(cgReferences(subjects).labels, ["Kai Ardent", "Kai Brenner"]);
  // A keepsake whose protagonist has the love interest's name: both of them, his picture then hers.
  const namesake = { ...player("gown"), name: "Kai" } as unknown as Player;
  const pair = cgSubjects(["Kai", "Kai"], [unit("coat")], namesake);
  assert.equal(pair.length, 2);
  // Each is their worn look: his coat, then her gown.
  assert.deepEqual(
    pair.map((subject) => subject.image?.avatarPath),
    [coat.url, gown.url],
  );
});

/** Whom each member is, for comparing: a love interest's id, "player", or the name only (`?` when ambiguous). */
const members = (list: CastMember[]) =>
  list.map((member) =>
    "li" in member ? member.li.id : "player" in member ? "player" : `${member.name}${member.ambiguous ? "?" : ""}`,
  );

test("a cast's names resolve at paint time: ids, the protagonist's role words, titles, honorifics, surnames, accents (#2145)", () => {
  const kai = unit();
  const dottore = { ...unit(), id: "li-dottore-cd34", name: "Il Dottore", cardId: "card-d" } as unknown as Unit;
  const rhys = { ...unit(), id: "li-rhys-ef56", name: "Rhys Ardent", cardId: "card-r" } as unknown as Unit;
  const anna = { ...unit(), id: "li-anna-gh78", name: "Anna", cardId: "card-a" } as unknown as Unit;
  const ines = { ...player(), name: "Inès Valcourt" } as unknown as Player;
  const units = [kai, dottore, rhys, anna];
  const table: Array<[string[], string[]]> = [
    [["li-kai-ab12"], [kai.id]],
    [["li:li-kai-ab12"], [kai.id]],
    [["You"], ["player"]],
    [["the protagonist"], ["player"]],
    [["The Heroine"], ["player"]],
    [["MC"], ["player"]],
    [["main character"], ["player"]],
    [["Lord Kai"], [kai.id]],
    [["Kai-sama"], [kai.id]],
    [["Dottore"], [dottore.id]],
    [["il dottore"], [dottore.id]],
    [["Ardent"], [rhys.id]],
    [["Captain Rhys Ardent of the North"], [rhys.id]],
    [["Kai Ren"], [kai.id]],
    [["Ines"], ["player"]],
    [["Valcourt"], ["player"]],
    // Whole words only, and a possessive names someone else.
    [["Ann"], ["Ann"]],
    [["Kai's mother"], ["Kai's mother"]],
    [
      ["Kai", "Kai's mother"],
      [kai.id, "Kai's mother"],
    ],
    // Each person once, however they are named again.
    [
      ["Kai", "Lord Kai", "li-kai-ab12", "kai", "You", "Ines", "  "],
      [kai.id, "player"],
    ],
    // A pronoun is no one's name; someone only named is named once.
    [["he"], ["he"]],
    [["The innkeeper", "the Innkeeper"], ["The innkeeper"]],
    // No letters at all ("???", an unknown figure) names nobody known.
    [["???"], ["???"]],
    [
      ["Kai", "???"],
      [kai.id, "???"],
    ],
    [
      ["???", "—"],
      ["???", "—"],
    ],
  ];
  for (const [cast, expected] of table) {
    assert.deepEqual(members(resolveCast(cast, units, ines)), expected, cast.join(", "));
  }
  // Someone in the frame answers again only to their own words: "Mrs. Ren" beside Kai Ren is someone else.
  const kaiRen = { ...unit(), name: "Kai Ren" } as unknown as Unit;
  assert.deepEqual(members(resolveCast(["Kai Ren", "Mrs. Ren"], [kaiRen], ines)), [kai.id, "Mrs. Ren"]);
  assert.deepEqual(members(resolveCast(["Kai Ren", "Ren"], [kaiRen], ines)), [kai.id]);
  assert.deepEqual(members(resolveCast(["Ren", "Kai Ren"], [kaiRen], ines)), [kai.id]);
  // A title of the other gender is someone else, wherever it stands in the cast (review, #2145).
  assert.deepEqual(members(resolveCast(["Mrs. Ren", "Kai Ren"], [kaiRen], ines)), ["Mrs. Ren", kai.id]);
  assert.deepEqual(members(resolveCast(["Mrs. Ren", "You"], [kaiRen], ines)), ["Mrs. Ren", "player"]);
  assert.deepEqual(members(resolveCast(["Lady Ren"], [kaiRen], ines)), ["Lady Ren"]);
  assert.deepEqual(members(resolveCast(["Lord Ren"], [kaiRen], ines)), [kai.id]);
  assert.deepEqual(members(resolveCast(["Mr. Valcourt"], [kaiRen], ines)), ["Mr. Valcourt"]);
  assert.deepEqual(members(resolveCast(["Miss Valcourt"], [kaiRen], ines)), ["player"]);
  // Accents fold only on Latin, Greek and Cyrillic letters: ガイ (Gai) is not カイ (Kai), रमा is not राम (review, #2145).
  const gai = { ...unit(), id: "li-gai-ij90", name: "ガイ" } as unknown as Unit;
  const rama = { ...unit(), id: "li-rama-kl12", name: "रमा" } as unknown as Unit;
  assert.deepEqual(members(resolveCast(["カイ"], [gai], ines)), ["カイ"]);
  assert.deepEqual(members(resolveCast(["ガイ"], [gai], ines)), [gai.id]);
  assert.deepEqual(members(resolveCast(["राम"], [rama], ines)), ["राम"]);
  assert.deepEqual(members(resolveCast(["Inès"], [gai], ines)), ["player"]);
  // The protagonist named like a love interest of this node: him first, then her; elsewhere, her (Dottore, #2148).
  const kaiPlayer = { ...player(), name: "Kai" } as unknown as Player;
  assert.deepEqual(members(resolveCast(["Kai"], [kaiRen], kaiPlayer, [kaiRen.id])), [kai.id]);
  assert.deepEqual(members(resolveCast(["Kai", "Kai"], [kaiRen], kaiPlayer, [kaiRen.id])), [kai.id, "player"]);
  assert.deepEqual(members(resolveCast(["Kai"], [kaiRen], kaiPlayer)), ["player"]);
  assert.deepEqual(members(resolveCast(["Kai"], [kaiRen], kaiPlayer, [])), ["player"]);
  // ...unless the title is part of their own name.
  const ladyMir = { ...unit(), id: "li-mir-cd34", name: "Lady Mireille" } as unknown as Unit;
  assert.deepEqual(members(resolveCast(["Lady Mireille"], [ladyMir], ines)), [ladyMir.id]);
  // Exact names are settled first, so the order of the cast never decides whom a partial name means.
  const they = { ...kaiRen, pronouns: { subject: "they", object: "them", possessive: "their" } } as unknown as Unit;
  assert.deepEqual(members(resolveCast(["Mrs. Ren", "Kai Ren"], [they], ines)), ["Mrs. Ren", kai.id]);
});

test("a name several people share is settled by who is in the scene, else left only named (#2145)", () => {
  const takeda = { ...unit(), id: "li-ren-t-1111", name: "Ren Takeda" } as unknown as Unit;
  const kurosawa = { ...unit(), id: "li-ren-k-2222", name: "Ren Kurosawa" } as unknown as Unit;
  const units = [takeda, kurosawa];
  assert.deepEqual(members(resolveCast(["Ren"], units, player())), ["Ren?"]);
  assert.deepEqual(members(resolveCast(["Ren"], units, player(), [kurosawa.id])), [kurosawa.id]);
  // Beside Takeda, "Ren" is the other one.
  assert.deepEqual(members(resolveCast(["Takeda", "Ren"], units, player())), [takeda.id, kurosawa.id]);
  // A love interest and the protagonist who share a name: him first, then her; a third time is a repeat.
  const namesake = { ...player(), name: "Kai" } as unknown as Player;
  assert.deepEqual(members(resolveCast(["Kai", "Kai", "Kai"], [unit()], namesake)), ["li-kai-ab12", "player"]);
  // He is not in the scene: the name is hers.
  assert.deepEqual(members(resolveCast(["Kai"], [unit()], namesake, [])), ["player"]);
});

test("a key image whose cast names nobody takes its people from the brief, and a letter stays a letter (#2145)", () => {
  const mir = { ...unit(), id: "li-mir-cd34", name: "Mireille Vane", cardId: "card-mir" } as unknown as Unit;
  const units = [unit(), mir];
  // Whom the picture shows: the name of each person with a likeness, or `named:` someone only named.
  const scene = (brief: string, present = ["li-kai-ab12"], cast: string[] = []) =>
    cgSubjects(cast, units, player(), { present, brief }).map((subject) =>
      subject.image ? subject.person.name : `named:${subject.person.name}`,
    );
  assert.deepEqual(scene("Kai leans on the rail beside you."), ["Kai", "Sol"]);
  assert.deepEqual(scene("Kai's hand on the lamp."), ["Kai"]);
  assert.deepEqual(scene("Sol watches the harbour."), ["Sol"]);
  assert.deepEqual(scene("A sealed letter on the desk."), []);
  // A pronoun only one of them uses points at them; one both love interests use points at neither.
  assert.deepEqual(scene("He hands her the lamp."), ["Kai", "Sol"]);
  assert.deepEqual(scene("He turns away.", ["li-kai-ab12", "li-mir-cd34"]), []);
  assert.deepEqual(scene("Mireille and Kai argue.", ["li-kai-ab12", "li-mir-cd34"]), ["Kai", "Mireille Vane"]);
  // A cast that names anyone, or a picture that is not a story key image, never reads the brief.
  assert.deepEqual(scene("Kai and the innkeeper.", ["li-kai-ab12"], ["the innkeeper"]), ["named:the innkeeper"]);
  assert.deepEqual(cgSubjects([], units, player()), []);
});
