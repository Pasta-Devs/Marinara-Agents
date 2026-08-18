import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Commenting on a NoodleR post used to fire a Creator reply generation unconditionally, so every
// comment spent a provider request the player never asked for. The toggle makes that request
// visible. The failure modes worth pinning: the comment must post regardless of the toggle, an
// opt-out must actually skip the request rather than just hiding its result, the choice must not
// persist silently into the next comment, and Noodle must not grow a toggle it cannot honour.

const card = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpPostCard.tsx", "utf8");
const noodler = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");
const noodle = readFileSync("packages/noodle/src/engine/packages/client/src/components/noodle/NoodleHome.tsx", "utf8");
const enLocale = JSON.parse(
  readFileSync("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8"),
) as Record<string, string>;

// On by default, and reset with the composer so one opt-out never leaks into the next comment.
assert.match(card, /const \[askForReply, setAskForReply\] = useState\(true\);/u);
const clearComposer = card.slice(
  card.indexOf("const clearReplyComposer = () => {"),
  card.indexOf("const cancelEditingPost = () => {"),
);
assert.match(clearComposer, /setAskForReply\(true\);/u);

// The toggle only renders where a Creator can actually answer.
assert.match(card, /\{ctx\.creatorReplyRequest && \(/u);
assert.match(card, /askForReply: options\.creatorReplyRequest \? askForReply : false,/u);
assert.match(noodler, /submitReply,\s*creatorReplyRequest: true,/u);
assert.doesNotMatch(noodle, /creatorReplyRequest/u, "Noodle authors have no reply operation");

// The comment is created first and unconditionally; only the generation is skipped.
const submit = noodler.slice(
  noodler.indexOf("const submitReply = async ("),
  noodler.indexOf("const savePost = async ("),
);
const createsComment = submit.indexOf("createInteraction.mutateAsync");
const optsOut = submit.indexOf("if (!input.askForReply) return;");
const generates = submit.indexOf("triggerCreatorReply.mutateAsync");
assert.ok(createsComment >= 0 && optsOut > createsComment, "the comment must post before the opt-out");
assert.ok(generates > optsOut, "the opt-out must return before the provider request");

// So a reply-failure toast can only mean a reply was actually requested.
assert.match(submit, /couldNotGenerateCreatorReply/u);

assert.equal(typeof enLocale["ui.noodle.noodlepostcard.askForReply"], "string");

console.log("NoodleR creator reply-request regressions passed.");
