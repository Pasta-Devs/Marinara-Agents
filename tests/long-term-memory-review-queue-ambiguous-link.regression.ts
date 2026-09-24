// Focused regression for the ambiguous-link selector repair.
// Run via the LTM runner: test-ltm.sh review-queue-ambiguous-link
import assert from "node:assert/strict";
import {
  ambiguousLinkChoiceTarget as display,
  replaceAmbiguousLinkTarget,
} from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/review-queue-ambiguous-link.ts";

const diagnostic = {
  code: "ambiguous_subject_link_target",
  details: {
    linkTarget: "char_mara",
    linkRelation: "affects_character",
    candidateTargetNoteIds: ["char_mara", "char_mara_other"],
  },
};

const original = {
  id: "link-choice",
  kind: "add_link",
  claimKind: "static",
  risk: "low",
  confidence: 0.9,
  summary: "Choose a character link",
  evidence: ["source_note:source-a"],
  noteId: "char_rowan",
  link: { target: "char_mara", relation: "affects_character" },
} as never;

const chosen = replaceAmbiguousLinkTarget(original, diagnostic.details, "char_mara_other");
assert.equal((chosen as { link: { target: string } }).link.target, "char_mara_other");

// After selection the control must stay visible and reflect the chosen target.
assert.equal(display(chosen as never, diagnostic), "char_mara_other");
assert.equal(display(original, diagnostic), "char_mara");
// A selection outside the candidate set cannot be represented; hide the control.
assert.equal(
  display(
    { ...(original as object), link: { target: "char_unrelated", relation: "affects_character" } } as never,
    diagnostic,
  ),
  null,
);
// No diagnostic details means no control.
assert.equal(display(original, { code: "other" } as never), null);

console.log("ltm-review-queue-ambiguous-link regression passed");
