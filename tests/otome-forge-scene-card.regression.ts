// Otome Forge's scene card (M1): a secret not yet revealed never reaches a prompt, only its tells do; a revealed one is
// something the protagonist knows; every list keeps at most 3 items and the card fits its token budget, in any
// script. The writing rules carry the knowledge boundary only for prompts that write story.
import assert from "node:assert/strict";
import test from "node:test";
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import type { Bible } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  otomeSceneCard,
  SCENE_CARD_MAX_TOKENS,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/scene-card.ts";
import { remapLearnedTells } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeBible } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { otomeWritingRules } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/writing-rules.ts";

const THEY = { subject: "they", object: "them", possessive: "their" };

function bible(changes: Partial<Bible> = {}): Bible {
  return {
    ...normalizeBible({})!,
    age: 31,
    pronouns: THEY,
    role: "Lighthouse keeper",
    want: "to keep the harbour lights burning",
    moralCode: "Debts are paid in full",
    redLines: ["never lies to a child", "never leaves a ship to drown", "never sells a friend", "never begs"],
    mask: {
      presents: "Dry, unbothered, always busy",
      tells: ["polishes clean glass", "counts the bells", "won't sit", "hums"],
    },
    voice: {
      ...normalizeBible({})!.voice,
      register: "Clipped and dry",
      never: ["says sorry", "raises their voice", "uses a pet name", "swears"],
      careLanguage: "Fixes things without being asked",
      angerStyle: "Goes very quiet",
      jealousyStyle: "Becomes extremely polite",
    },
    secrets: [
      {
        id: "drowned-light",
        truth: "TRUTH-STAGE-FOUR: they let the north light go dark the night the Arden sank.",
        tells: ["flinches at the north bell", "never looks at the Arden's memorial"],
        revealAt: { stage: 4 },
      },
      {
        id: "brother",
        truth: "TRUTH-STAGE-TWO: the smuggler Vey is their brother.",
        tells: ["knows Vey's boat by its sound"],
        revealAt: { stage: 2 },
      },
    ],
    arc: { ...normalizeBible({})!.arc, "1": { wantsFromHer: "to be left alone, and not quite" } },
    ...changes,
  };
}

const unit = (changes: Partial<Bible> = {}) => ({ name: "Sol", pronouns: THEY, bible: bible(changes) });

test("an unrevealed secret shows only as its tells; a revealed one is what the protagonist knows", () => {
  const first = otomeSceneCard(unit(), { stage: 1 });
  assert.doesNotMatch(first, /TRUTH-STAGE/);
  assert.match(
    first,
    /Hidden \(never state it; it may show only as these tells\): flinches at the north bell; never looks at the Arden's memorial; knows Vey's boat by its sound\./,
  );
  assert.doesNotMatch(first, /The protagonist knows/);
  assert.match(first, /^Sol \(they\/them\) — stage 1 \(Mask\)\. Mask 90 \/ self 10\./);
  assert.match(
    first,
    /Wants from the protagonist now: to be left alone, and not quite\. Own want, besides the protagonist: to keep the harbour lights burning\./,
  );

  const second = otomeSceneCard(unit(), { stage: 2 });
  assert.match(second, /The protagonist knows: TRUTH-STAGE-TWO/);
  assert.doesNotMatch(second, /TRUTH-STAGE-FOUR/);
  assert.match(second, /flinches at the north bell/);
  assert.doesNotMatch(second, /knows Vey's boat/);

  const wound = otomeSceneCard(unit(), { stage: 4 });
  assert.match(wound, /The mask breaks/);
  assert.match(wound, /TRUTH-STAGE-FOUR/);
  assert.doesNotMatch(wound, /Hidden/);
});

test("every list keeps at most 3 items", () => {
  const card = otomeSceneCard(unit(), { stage: 1 });
  assert.match(card, /Never: says sorry; raises their voice; uses a pet name\./);
  assert.doesNotMatch(card, /swears/);
  assert.match(card, /Red lines: never lies to a child; never leaves a ship to drown; never sells a friend\./);
  assert.doesNotMatch(card, /never begs/);
  assert.doesNotMatch(card, /hums/);
});

test("the card fits its token budget, in Latin and CJK text, and never leaks a truth while shrinking", () => {
  const long = (word: string) => Array.from({ length: 80 }, () => word).join(" ");
  for (const word of ["harbour", "灯台守の秘密"]) {
    const card = otomeSceneCard(
      unit({
        want: long(word),
        moralCode: long(word),
        redLines: [long(word), long(word), long(word)],
        mask: { presents: long(word), tells: [long(word), long(word), long(word)] },
        voice: {
          register: long(word),
          tics: [],
          never: [long(word), long(word), long(word)],
          careLanguage: long(word),
          angerStyle: long(word),
          jealousyStyle: long(word),
          samples: { guarded: "", tender: "", angry: "" },
        },
      }),
      { stage: 3 },
    );
    assert.ok(estimateTextTokens(card) <= SCENE_CARD_MAX_TOKENS, `${word}: ${estimateTextTokens(card)} tokens`);
    assert.doesNotMatch(card, /TRUTH-STAGE-FOUR/);
    assert.match(card, /^Sol \(they\/them\) — stage 3 \(Pull\)/);
  }
  // A plain bible fits without shrinking anything.
  const plain = otomeSceneCard(unit(), { stage: 1 });
  assert.doesNotMatch(plain, /…/);
  assert.ok(estimateTextTokens(plain) <= SCENE_CARD_MAX_TOKENS);
});

test("a love interest whose bible is still being written gets only a name line; the stage is clamped", () => {
  assert.equal(otomeSceneCard({ name: "Sol", pronouns: THEY, bible: null }, { stage: 1 }), "Sol (they/them).");
  assert.match(otomeSceneCard(unit(), { stage: 9 }), /stage 6 \(Bond\)\. Changed toward the protagonist only\./);
  assert.match(otomeSceneCard(unit(), { stage: 0 }), /stage 1 \(Mask\)/);
});

test("an edited bible moves the learned tells with their text, never onto a tell that was not read", () => {
  const before = bible().mask.tells;
  const presents = bible().mask.presents;
  const learnedLine = (card: string) => card.split("\n").find((line) => line.startsWith("The protagonist has learned"));
  const cardFor = (tells: string[], tellsLearned: number[]) =>
    otomeSceneCard(unit({ mask: { presents, tells } }), { stage: 1, tellsLearned });

  // Tell 0 was read, then deleted: index 0 now holds another tell, and the card must not call that one out.
  const deleted = before.slice(1);
  assert.deepEqual(remapLearnedTells([0], before, deleted), []);
  assert.equal(learnedLine(cardFor(deleted, remapLearnedTells([0], before, deleted))), undefined);
  // A tell that was reworded is not the one that was read.
  const reworded = ["polishes clean glass", "counts the steps", "won't sit", "hums"];
  assert.deepEqual(remapLearnedTells([1], before, reworded), []);
  // Reordered, the learned tell is the same one at its new place.
  const reversed = [...before].reverse();
  assert.deepEqual(remapLearnedTells([0, 2], before, reversed), [3, 1]);
  assert.match(learnedLine(cardFor(reversed, [3, 1]))!, /: polishes clean glass; won't sit\.$/u);
  assert.doesNotMatch(learnedLine(cardFor(reversed, [3, 1]))!, /hums|counts the bells/u);
  // Appending a tell after the learned ones changes nothing.
  const appended = [...before, "taps the rail"];
  assert.deepEqual(remapLearnedTells([0, 2], before, appended), [0, 2]);
  assert.equal(learnedLine(cardFor(appended, [0, 2])), learnedLine(cardFor(before, [0, 2])));
});

test("writing rules: story prompts get the knowledge boundary first, planners never; banned phrases are listed", () => {
  const story = otomeWritingRules({ story: true });
  const planner = otomeWritingRules({ story: false });
  assert.ok(story.startsWith(forgeKnowledgeBoundary));
  assert.ok(!planner.includes(forgeKnowledgeBoundary));
  for (const rules of [story, planner]) {
    assert.match(rules, /softens toward the protagonist, not toward the world/);
    assert.match(rules, /I'll always protect you/);
    assert.match(rules, /practiced ease/);
  }
});
