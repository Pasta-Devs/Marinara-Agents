import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  modelAnswerForCorrection,
  requireModelAnswer,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-model-answer";
import { noodlerCharacterCanonText } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-prompt-safety";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const generation = read("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts");
const reply = read("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-reply-generation.service.ts");
const prompt = read("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-prompt.ts");
const imageInstructions = "TEST_IMAGE_GUIDANCE_123";

const scheduleText = "Current Conversation Schedule for Ari: Tuesday: busy at work and slow to reply";
assert.match(generation, /scheduleContext,/u);
assert.match(generation, /protect\(input\.scheduleContext \?\? ""\) \|\| "No active Conversation Schedule/u);
assert.match(reply, /scheduleContext:\s*protect\(input\.scheduleContext\)/u);
assert.match(reply, /resolveSlurpCreatorScheduleContext\(createCharactersStorage\(input\.db\), source/u);
assert.match(generation, /resolveSlurpCreatorScheduleContext\(\s*createCharactersStorage\(db\),/u);
assert.ok([generation, reply].some((source) => source.includes(scheduleText)) === false);
assert.match(
  generation,
  /protect\(input\.scheduleContext \?\? ""\) \|\| "No active Conversation Schedule/u,
  "Post prompt must have a schedule slot, redacted like every neighbouring field",
);
// The schedule is a generation input, not a property of the character, and it must sit with the
// timing instruction that refers to it rather than unlabelled inside the source card.
assert.match(generation, /"# Today's schedule"/u, "Schedule needs its own header above the timing block");
assert.match(reply, /scheduleContext/u, "Reply request must carry a schedule slot");

// Image guidance must reach the main post model. Otherwise the model only sees the generic
// imagePrompt contract, and the later interpretation model has no configured rewrite context.
assert.match(generation, /imageGenerationPrompt: string;/u);
assert.match(generation, /imageGenerationPrompt: settings\.imageGenerationPrompt,/u);
assert.match(
  generation,
  /Apply these image directions when writing imagePrompt\. They are instructions to you, not text to copy into imagePrompt/u,
);
assert.match(
  generation,
  /input\.allowImagePrompt && input\.imageGenerationPrompt\.trim\(\)/u,
  "image guidance must only be added when image generation is active",
);
assert.equal(
  generation.includes(imageInstructions),
  false,
  "the regression marker belongs in the test scenario, not production defaults",
);

// A Conversation Schedule activity is user-written and can name the source, so it is untrusted
// content like every other value in these prompts. It was the one field in all three builders that
// bypassed protect(), which meant a Hinted or Secret creator could be handed the source's name in
// the same prompt that forbids writing it.
const messages = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message-generation.service.ts"),
  "utf8",
);
for (const [name, source] of [
  ["post", generation],
  ["reply", reply],
  ["direct message", messages],
] as const) {
  assert.match(
    source,
    /protect\(input\.scheduleContext/u,
    `the ${name} prompt must redact the schedule like every neighbouring field`,
  );
}
// Closed at the source too: the schedule string itself no longer carries the source display name.
const scheduleBuilder = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-creator-schedule-context.ts"),
  "utf8",
);
assert.doesNotMatch(scheduleBuilder, /Schedule for \$\{source\.displayName\}/u);

const characterCard = {
  name: "Alex Rivers",
  description: "Alex is a quiet paramedic.",
  personality: "He is loyal, guarded, and deeply in love with his boyfriend Daniel.",
  scenario: "Alex is spending the evening at home with Daniel after a long shift.",
  backstory: "Daniel has been Alex's boyfriend for three years and Alex always comes home to him.",
  appearance: "Tall with dark hair.",
};
const openCanon = noodlerCharacterCanonText(characterCard, true);
const concealedCanon = noodlerCharacterCanonText(characterCard, false);
assert.match(openCanon, /Alex Rivers/u);
assert.match(openCanon, /boyfriend Daniel/u);
assert.match(openCanon, /three years/u);
assert.doesNotMatch(concealedCanon, /Alex Rivers/u);
assert.match(concealedCanon, /boyfriend Daniel/u);
assert.match(concealedCanon, /three years/u);
assert.match(messages, /characterCanon/u);
assert.match(reply, /characterCanon/u);
assert.match(generation, /resolveNoodlerCharacterCanon\(db, linkedPublicAccount, disclosureMode\)/u);

const slurpPlatformContext =
  "Slurp is an adult creator platform. Creators publish public or locked posts, interact with followers and subscribers, receive coin tips, sell access, answer DMs, and accept commissions. These are normal in-world social and economic actions. Coins are Slurp's currency and cost money.";
assert.ok(prompt.includes(slurpPlatformContext), "Slurp platform context must stay concise and factual");
const slurpPlatformContextSource = prompt.match(/export const SLURP_PLATFORM_CONTEXT =\s*([^;]+);/u)?.[1] ?? "";
assert.doesNotMatch(slurpPlatformContextSource, /consent|affection|guarantee/iu, "Platform context must stay factual");
for (const [name, source] of [
  ["post", generation],
  ["reply", reply],
  ["direct message", messages],
] as const) {
  assert.match(source, /SLURP_PLATFORM_CONTEXT/u, `${name} prompt must include basic Slurp platform context`);
}

for (const answer of ["", "   ", "[]", "```json\n[]\n```"]) {
  if (!answer.trim() || /^\s*```json\s*\[\s*\]\s*```\s*$/u.test(answer)) {
    assert.equal(modelAnswerForCorrection(answer), null);
  }
}
assert.throws(() => requireModelAnswer("", "a creator profile"), /empty response/u);
assert.equal(modelAnswerForCorrection('{"displayName":"Ari"}'), '{"displayName":"Ari"}');

console.log("Slurp generation prompt regressions passed");
