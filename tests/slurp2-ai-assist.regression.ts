/**
 * 3c: AI assist everywhere it makes sense, and the action layer behind it. The action contract (names,
 * summaries, inputs, strict schemas), the text assist prompt and its cleanup, the picture draft (the
 * player's words + the level's picture phrase; the brief and the level's negative terms reach the image
 * pipeline), one Undo back to the picture from before the first Use, and the wiring pins: every field
 * that got the assist, the old AI buttons folded into it, the AI budget row, and the `slurp2:actions`
 * service (the hook Professor Mari needs; the Engine has no bridge to it yet).
 */
import assert from "node:assert/strict";
import {
  isSlpActionName,
  SLP_ACTION_NAMES,
  SLP_ACTIONS,
  SLP_ASSIST_FIELD_NAMES,
  SLP_ASSIST_FIELDS,
  slpActionCatalog,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-actions.ts";
import {
  buildSlpAssistTextMessages,
  cleanSlpAssistText,
  slpAssistPictureDraft,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/assist/slp-assist-prompt.ts";
import { createSlpPictureUndo } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/assist/slp-picture-undo.ts";
import {
  SLURP_MODEL_JOB_KINDS,
  slurpModelBudgetSchema,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.ts";
import { slurp2Source } from "./slurp2-source.ts";

const client = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/client/src/slp/${path}`);
const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);

// --- 1. The action layer contract ------------------------------------------------------------------
assert.deepEqual(
  [...SLP_ACTION_NAMES].sort(),
  [
    "add-idea",
    // R: brand logos and product pictures, the brands a helper can name, and the Stir brand deal lever.
    "draft-post",
    "draw-brand-picture",
    "draw-picture",
    "improve-text",
    "keep-picture",
    // J2: Professor Mari needs the Creator ids every other action takes (read-only).
    "list-brands",
    "list-creators",
    "offer-brand-deal",
    "steer-creator",
    "undo-picture",
    "use-picture",
    "write-post",
    "write-text",
    // W (Stir): the world levers joined the same layer (ties, events, storylines, audience, spice).
    "cool-rivalry",
    "couple-page",
    "list-world",
    "push-collab",
    "run-audience",
    "set-spice",
    "set-up-couple",
    "start-event",
    "start-rivalry",
    "steer-couple",
    "steer-storyline",
    "suggest-collab",
    // 0.3.1: storylines, goals, looks and made-up events.
    "invent-event",
    "new-look",
    "set-tip-goal",
    "start-storyline",
    // 0.3.5: polyamory and the Slurp Support desk.
    "add-to-couple",
    "cash-favour",
    "grant-perk",
    "offer-contract",
    "plant-rumour",
    "seed-trend",
    "set-challenge",
    "throttle-reach",
    "warn-creator",
    // 0.3.11: bonds and drama packs are Stir plays too.
    "end-bond",
    "end-drama",
    "set-bond",
    "start-drama",
  ].sort(),
  "one named layer: text, pictures, steering, ideas, posting, and (W) every Stir lever",
);
for (const entry of slpActionCatalog()) {
  const action = SLP_ACTIONS[entry.name];
  assert.ok(entry.summary.length > 20, `${entry.name}: a plain summary`);
  assert.deepEqual(
    Object.keys(entry.inputs).sort(),
    Object.keys(action.schema.shape).sort(),
    `${entry.name}: every input is described, nothing described that does not exist`,
  );
  assert.doesNotMatch(JSON.stringify(entry), /schema|zod/iu, "the catalog carries no schema objects");
}
assert.equal(isSlpActionName("write-text"), true);
assert.equal(isSlpActionName("toString"), false, "only own names, never prototype keys");
assert.equal(isSlpActionName("delete-creator"), false);

const parse = <N extends keyof typeof SLP_ACTIONS>(name: N, input: unknown) =>
  SLP_ACTIONS[name].schema.safeParse(input);
assert.equal(parse("write-text", { field: "bio", accountId: "a1" }).success, true);
assert.equal(parse("write-text", { field: "password" }).success, false, "fields are a closed list");
assert.equal(parse("write-text", { field: "bio", extra: 1 }).success, false, "strict: no unknown keys");
assert.equal(parse("improve-text", { field: "caption" }).success, false, "improve needs the current text");
assert.equal(parse("improve-text", { field: "caption", text: "hi", note: "x".repeat(401) }).success, false);
const draw = parse("draw-picture", { accountId: "a1", target: "story" });
assert.ok(draw.success && draw.data.request === "", "the request may be empty (a post draws its caption)");
assert.equal(parse("draw-picture", { accountId: "a1", target: "banner" }).success, false, "cover, not banner");
assert.equal(
  parse("use-picture", { accountId: "a1", target: "avatar", image: "https://example.com/x.png" }).success,
  false,
  "use-picture takes only a drawn picture (a data URL), never a remote URL",
);
assert.equal(
  parse("use-picture", { accountId: "a1", target: "avatar", image: "data:image/png;base64,AAAA" }).success,
  true,
);
assert.equal(
  parse("use-picture", { accountId: "a1", target: "story", image: "data:image/png;base64,AAAA" }).success,
  false,
);
const idea = parse("add-idea", { accountId: "a1", text: "Gym post tonight" });
assert.ok(idea.success && idea.data.story === false);
assert.equal(
  parse("steer-creator", { accountId: "a1", mood: "sleepy" }).success,
  false,
  "moods are the steering moods",
);
assert.equal(parse("steer-creator", { accountId: "a1", mood: null, pace: "busy" }).success, true);
assert.equal(parse("write-post", { accountId: "a1", idea: "" }).success, false, "an empty idea is no idea");

// The runner validates against the same schemas before anything runs, and knows only these names.
const runner = server("features/assist/slp-action-runner.ts");
assert.match(runner, /if \(!isSlpActionName\(name\)\) return \{ ok: false, status: 404/u);
assert.match(runner, /SLP_ACTIONS\[name\]\.schema\.safeParse\(raw \?\? \{\}\)/u);
assert.match(runner, /if \(!parsed\.success\) return \{ ok: false, status: 400/u);
// W: the tie levers dispatch through the projects contract (`runSlurpTieLever`); their cases live there.
const tieLevers = server("features/projects/slp-stir-ties.ts");
assert.match(runner, /if \(isSlurpTieLever\(name\)\) \{\s+const ran = await runSlurpTieLever\(db, name, input\);/u);
// 0.3.5: the Support desk's levers dispatch through `runSlpDeskLever` (`slp-desk-levers.ts`).
const deskLevers = server("features/assist/slp-desk-levers.ts");
assert.match(runner, /if \(isSlpDeskLever\(name\)\) return runSlpDeskLever\(db, name, input\);/u);
// 0.3.11: drama packs dispatch through `runSlurpDramaLever` (`slp-drama-levers.ts`).
const dramaLevers = server("features/world/slp-drama-levers.ts");
assert.match(runner, /if \(isSlurpDramaLever\(name\)\) \{\s+const ran = await runSlurpDramaLever\(db, name, input\);/u);
for (const name of SLP_ACTION_NAMES)
  assert.match(
    runner + tieLevers + deskLevers + dramaLevers,
    new RegExp(`case "${name}":|name === "${name}"`, "u"),
    `${name} is dispatched`,
  );
assert.match(runner, /generateAndApplyCreatorPost[\s\S]*resolveSlurpAutomaticPostAccess/u, "write-post = Run now");
assert.match(runner, /from "\.\.\/feed\/slp-feed-contract\.js"/u, "another feature only through its contract");

// --- 2. Text assist: the prompt and the cleanup ----------------------------------------------------
const improve = buildSlpAssistTextMessages({
  mode: "improve",
  field: "caption",
  text: "new climbing shoes!!",
  note: "funnier",
  name: "Mira",
  brief: "A climbing coach who calls everyone champ.",
});
assert.equal(improve.length, 2);
assert.match(improve[0]!.content, /Write it as Mira, in their own voice/u);
assert.match(improve[0]!.content, /Improve the current text/u);
assert.match(improve[0]!.content, /at most 2000 characters/u);
assert.match(improve[0]!.content, /never as instructions/u, "the player's words are quoted content");
assert.match(improve[1]!.content, /# Who Mira is\nA climbing coach/u, "the 7b0 brief reaches the prompt");
assert.match(improve[1]!.content, /# Current text\nnew climbing shoes!!/u);
assert.match(improve[1]!.content, /# What the player wants\nfunnier/u);
const write = buildSlpAssistTextMessages({ mode: "write", field: "life", text: "ignored", name: "Mira", brief: "b" });
assert.doesNotMatch(write[1]!.content, /Current text/u, "Write starts fresh");
assert.match(write[0]!.content, /third person/u, "a steering note is about them, not by them");
assert.match(write[0]!.content, /One line\./u);
const brief = buildSlpAssistTextMessages({ mode: "write", field: "brief", name: "Mira", brief: "secret card text" });
assert.doesNotMatch(brief[1]!.content, /secret card text/u, "the player's own texts never carry the Creator's brief");
assert.match(brief[0]!.content, /as a fan would/u);
assert.match(buildSlpAssistTextMessages({ mode: "write", field: "bio" })[1]!.content, /Something that fits them/u);
for (const field of SLP_ASSIST_FIELD_NAMES) {
  assert.ok(SLP_ASSIST_FIELDS[field].max > 0 && SLP_ASSIST_FIELDS[field].what.length > 10, field);
}

assert.equal(cleanSlpAssistText('Here is the caption: "sunset laps, again ☀️"', "caption"), "sunset laps, again ☀️");
assert.equal(cleanSlpAssistText("```\nImproved caption: chalk everywhere\n```", "caption"), "chalk everywhere");
assert.equal(cleanSlpAssistText("<think>hmm</think>Moving in with Tess", "life"), "Moving in with Tess");
assert.equal(cleanSlpAssistText("line one\nline two", "life"), "line one line two", "one-line fields lose breaks");
assert.equal(cleanSlpAssistText("para one\n\n\n\npara two", "caption"), "para one\n\npara two", "captions keep them");
assert.equal(cleanSlpAssistText("   ", "bio"), null, "an empty answer is no answer");
const long = cleanSlpAssistText(`${"Short sentence here. ".repeat(20)}`, "life")!;
assert.ok(long.length <= SLP_ASSIST_FIELDS.life.max, "never past the field limit");
assert.match(long, /\.$/u, "cut at a sentence end");

// --- 3. Picture assist: the draft carries the player's words and the level ------------------------
const avatar = slpAssistPictureDraft({
  target: "avatar",
  request: "golden hour on the balcony, messy bun",
  name: "Mira",
  levelPhoto: "Flirty and a little suggestive.",
});
assert.match(avatar, /^Mira\. golden hour on the balcony, messy bun/u, "the player's words lead");
assert.match(avatar, /profile picture: head and shoulders/u);
assert.match(avatar, /Flirty and a little suggestive\./u, "the spice level's picture phrase");
const fromCaption = slpAssistPictureDraft({
  target: "post",
  request: " ",
  context: "chalk bag, new route",
  name: "Mira",
  levelPhoto: "",
});
assert.match(fromCaption, /Mira\. chalk bag, new route/u, "no request: the caption is drawn");
assert.match(
  slpAssistPictureDraft({ target: "story", request: "", name: "Kai", levelPhoto: "" }),
  /An everyday moment from Kai's life\./u,
);
const service = server("features/assist/slp-assist-service.ts");
assert.match(service, /resolveSlurpCreatorFlavour\(db, \{[\s\S]*?spice,/u, "draw reads the 7b0 brief");
assert.match(
  service,
  /postContent: options\.creatorDetails \? \[brief, input\.context/u,
  "the brief is the picture's context",
);
assert.match(service, /negativePromptAdditions: slurpImageNegativePrompt\(level\)/u, "the level's negative terms");
assert.match(
  service,
  // Slice I (user): public pictures stop below nudity; `slurpPublicSexualLevel` is that public level.
  /input\.target === "avatar" \|\| input\.target === "cover" \? slurpPublicSexualLevel\(spice\.level\) : spice\.level/u,
  "a profile picture or cover is public: the level a non-subscriber sees",
);
assert.match(service, /generateCreatorPostImage\(\{/u, "the Creator's own image pipeline");
assert.match(service, /from "\.\.\/media\/slp-media-contract\.js"/u);
assert.match(service, /finally \{\s*unlinkCreatorMedia\(mediaPath\);/u, "a drawn picture is never kept on disk");
// 0.3.6: Write and Improve are the player's tap: never on the AI budget, never blocked by its mode.
assert.doesNotMatch(service, /claimSlurpModelBudget|slurpModelWorkerAllows/u, "the player's own tap is off the budget");
assert.match(service, /playerAsked: true/u, "a drawn picture's prompt rewrite is off the budget too");
assert.match(
  service,
  /creator\?\.open && SLP_ASSIST_FIELDS\[input\.field\]\.voice !== "player"/u,
  "open identities only",
);

// --- 4. Undo -----------------------------------------------------------------------------------------
const undo = createSlpPictureUndo();
assert.equal(undo.previous("a:avatar"), null, "nothing to undo before a Use");
assert.equal(undo.used("a:avatar", "/old.png"), null, "the first Use keeps the old picture");
assert.deepEqual(undo.previous("a:avatar"), { url: "/old.png" });
assert.deepEqual(undo.used("a:avatar", "/drawn-1.png"), { drop: "/drawn-1.png" }, "Retry + Use drops the first draw");
assert.deepEqual(undo.previous("a:avatar"), { url: "/old.png" }, "Undo still goes back to the original");
assert.equal(undo.previous("a:cover"), null, "slots are separate");
undo.forget("a:avatar");
assert.equal(undo.previous("a:avatar"), null);
assert.equal(undo.used("b:avatar", null), null);
assert.deepEqual(undo.previous("b:avatar"), { url: null }, "no picture before: Undo clears it again");
assert.match(
  service,
  /pictureUndo\.forget\(key\);\s*if \(current !== previous\) unlinkPicture/u,
  "Undo drops the drawn one",
);

const textAssist = client("features/assist/SlpTextAssist.tsx");
assert.match(
  textAssist,
  /setUndo\(\{ before: value, after: text \}\);\s*onApply\(text\);/u,
  "Undo remembers the text before",
);
assert.match(textAssist, /undo && undo\.after === value && !open/u, "Undo shows until the player types again");
assert.match(textAssist, /onApply\(undo\.before\);/u);
assert.match(
  textAssist,
  /noteSlpAiUseOnce\(t\);[\s\S]*?runSlpAction\("improve-text"/u,
  "the cost note before the first run",
);
assert.match(textAssist, /mode === "write"[\s\S]*?ui\.slurp\.assist\.write"/u, "Write when empty, Improve when not");
const pictureAssist = client("features/assist/SlpPictureAssist.tsx");
assert.match(pictureAssist, /runSlpAction\("use-picture"/u);
assert.match(pictureAssist, /runSlpAction\("undo-picture"/u);
assert.match(pictureAssist, /runSlpAction\("keep-picture"/u, "the kept picture goes once the player is done");
assert.match(pictureAssist, /ui\.slurp\.assist\.retry/u);

// --- 5. Wiring: one assist, everywhere it helps; the old buttons folded in -------------------------
const composer = client("app/screens/SlpScreenComposer.tsx");
assert.match(composer, /<SlpTextAssist\s+field=\{story \? "story" : "caption"\}/u, "post and Story text");
assert.match(composer, /<SlpPictureAssist[\s\S]*?target=\{story \? "story" : "post"\}/u, "post and Story pictures");
assert.doesNotMatch(composer, /guidePost|onGuidedPost|ui\.slurp\.composer\.aiImage"/u, "Guide and AI image folded in");
assert.match(composer, /drawnOver\.current = image;/u, "Undo in the composer puts back the picture it had");
const steering = client("features/creators/SlpCreatorSteeringCard.tsx");
for (const field of ["life", "focus", "idea"])
  assert.match(steering, new RegExp(`<SlpTextAssist\\s+field="${field}"`, "u"));
const form = client("features/creators/SlpStageProfileForm.tsx");
assert.match(form, /field="bio"/u);
assert.match(form, /field="voice"/u);
assert.equal((client("features/creators/SlpStageFactsFields.tsx").match(/field="facts"/gu) ?? []).length, 3);
const fanTypes = client("features/audience/SlpFanTypesPanel.tsx");
assert.match(fanTypes, /<SlpTextAssist[\s\S]*?run=\{draftVoice\}/u, "Draft voice folded in");
assert.doesNotMatch(fanTypes, /ui\.slurp\.settings\.fanTypes\.voiceDraft"/u);
assert.match(fanTypes, /voice: mode === "improve" \? voice : ""/u);
const guidance = client("features/settings/SlpPostGuidanceField.tsx");
assert.match(guidance, /<SlpTextAssist[\s\S]*?generate\.mutateAsync/u, "Write with AI folded in");
assert.doesNotMatch(guidance, /generateLabel/u);
assert.match(client("features/messages/commissions/SlpCommissions.tsx"), /<SlpTextAssist field="brief"/u);
const threadComposer = client("features/messages/SlpThreadComposer.tsx");
// 7c M-004: the DM draft also knows the seat (Support writes as staff) and gets the chat as context.
assert.match(
  threadComposer,
  /toolTab === "write"[\s\S]*?field=\{ownsCreator \? "reply" : asSupport \? "support" : "dm"\}[\s\S]*?context=\{slurpAssistChatContext\(/u,
  "DM drafts",
);
assert.match(client("features/messages/slp-thread-view-model.ts"), /id: "write"/u);
assert.match(client("features/projects/SlpArcChapterControls.tsx"), /<SlpTextAssist\s+field="chapter"/u);
assert.match(client("modules/post/SlpPostEditSheet.tsx"), /ctx\.textAssist\(\{/u, "editing a post");
assert.match(
  client("app/slp-home-state.ts"),
  /textAssist: \(\{ story, \.\.\.input \}\) => createElement\(SlpTextAssist/u,
);
assert.match(client("app/screens/SlpProfileModals.tsx"), /<SlpPictureAssist/u, "profile picture + cover");
const editor = client("features/creators/SlpCreatorProfileEditor.tsx");
assert.match(editor, /<SlpPictureAssist[\s\S]*?advanced/u, "Creator settings keep the context switches");
assert.doesNotMatch(editor, /useGenerateCreatorArtwork/u, "the old artwork tool folded in");
assert.match(server("modules/audience/slp-fan-voice-draft.ts"), /What the player wants: \$\{input\.note\}/u);

// --- 6. Budget row, routes, service registration (Mari) ---------------------------------------------
assert.ok(SLURP_MODEL_JOB_KINDS.includes("assist"));
const budget = slurpModelBudgetSchema.parse({});
assert.deepEqual(budget.jobs.assist, { enabled: true, priority: 2, maxPerDay: 40 });
assert.deepEqual(
  slurpModelBudgetSchema.parse({ jobs: { dm_reply: { enabled: false, priority: 1, maxPerDay: 1 } } }).jobs.assist
    .maxPerDay,
  40,
  "a saved budget from before 3c gets the new row",
);
const routes = server("features/assist/slp-assist-routes.ts");
assert.match(routes, /app\.get\("\/slurp\/actions"/u);
assert.match(routes, /app\.post\("\/slurp\/actions\/:name"/u);
const entry = server("slp-server-entry.ts");
assert.match(entry, /await slpAssistRoutes\(app\);/u);
// J2: one service object (`slpActionService`), registered under every key `slpActionServiceKeys` names.
assert.match(
  entry,
  /const actions = slpActionService\(app\.db\);\s*for \(const key of slpActionServiceKeys\(installed\?\.manifest\?\.permissions\)\) \{\s*try \{\s*addTeardown\(api\.registerService\(key, actions\)\);/u,
  "the action layer is registered as an in-process service for a helper like Professor Mari",
);

// --- 7. Copy --------------------------------------------------------------------------------------------
const en = JSON.parse(client("locales/en.json")) as Record<string, string>;
for (const key of [
  "ui.slurp.assist.write",
  "ui.slurp.assist.improve",
  "ui.slurp.assist.writeIt",
  "ui.slurp.assist.undo",
  "ui.slurp.assist.drawIt",
  "ui.slurp.assist.retry",
  "ui.slurp.assist.use",
  "ui.slurp.assist.drawTitle.avatar",
  "ui.slurp.assist.picturePlaceholder.story",
  "ui.slurp.messages.helpWrite",
  "ui.slurp.settings.aiBudget.job.assist",
]) {
  assert.ok(en[key], key);
}
const copy = Object.entries(en)
  .filter(([key]) => key.startsWith("ui.slurp.assist.") || key.startsWith("ui.slurp.messages.helpWrite"))
  .map(([, value]) => value)
  .join(" ");
assert.doesNotMatch(copy, /\bAI\b|model|prompt|simulat|—/u, "in-world words, no em dashes");

console.log("slurp2 AI assist: ok");
