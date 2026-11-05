/** October 2026 Discord requests (packages/slurp2/docs/FEEDBACK-2026-10.md, R1-R11). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slurpCommissionBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-world-copy.ts";
import { SLURP_COMMISSION_ASKS } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-world.ts";
import {
  slpSceneMomentFilled,
  slpSceneUpdateState,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/slp-scene-draft.ts";
import { buildSlpSceneTurnMessages } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/onboarding/slp-scene-prompt.ts";
import { slurpCoupleFit } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-fit.ts";
import {
  normalizeSlpCreatorSteering,
  slpRomanceAllows,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-creator-steering.ts";
import {
  slurpThreadSummaryMessages,
  slurpThreadTranscript,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-thread-export.ts";
import {
  slurpLastAnswer,
  slurpMessageEditable,
  slurpMessageRemovable,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-message-edit.ts";

const client = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const src = (path: string) => readFileSync(join(client, path), "utf8");

// ── R2: quick replies for the Support desk ──
const quick = readFileSync(join(client, "features/messages/SlpDeskQuickReplies.tsx"), "utf8");
assert.match(
  quick,
  /const replies = saved\.length \? saved : SLP_DESK_QUICK_REPLY_KEYS\.map\(\(key\) => t\(key\)\);/u,
  "built-ins until the player saves",
);
assert.match(quick, /setDraft\(reply\);/u, "one tap fills the composer; the player still sends");
assert.match(quick, /supportDesk: \{ \.\.\.desk, quickReplies \}/u);
assert.match(
  src("features/messages/SlpThreadComposer.tsx"),
  // Only Support's own composer, and only while the Support desk is on (`desk` includes `asSupport`).
  /\{desk && <SlpDeskQuickReplies model=\{model\} \/>\}/u,
);

for (const locale of ["en", "de", "ko", "pl"]) {
  const keys = JSON.parse(src(`locales/${locale}.json`)) as Record<string, string>;
  for (const number of [1, 2, 3, 4, 5])
    assert.ok(keys[`ui.slurp.desk.quickReplyBuiltin${number}`], `${locale} built-in ${number}`);
}
assert.match(quick, /min-h-11 min-w-11/u, "the remove button is a 44 px target");

// ── R7: the player edits what the fan wants in a commission request ──
assert.ok(
  SLURP_COMMISSION_ASKS.some((ask) => slurpCommissionBrief("seed").includes(ask)),
  "built-in asks by default",
);
assert.match(slurpCommissionBrief("seed", ["Hi."], ["a tiny frog"]), /^Hi\. a tiny frog /u, "own asks win");
const server = join(client, "../../../server/src/slp");
assert.match(
  readFileSync(join(server, "features/world/slp-world-actions.ts"), "utf8"),
  /settings\.messagesCommissionOpeners,\s*settings\.messagesCommissionAsks,/u,
);

// A no-limit Collect sends the whole balance, so the route must not cap the amount.
assert.doesNotMatch(
  readFileSync(join(server, "features/economy/slp-wallet-routes.ts"), "utf8"),
  /payout[\s\S]{0,300}amount: z\.number\(\)\.int\(\)\.min\(1\)\.max\(/u,
);

// ── R11: tapping an ad showed nothing ──
// Every ad tap (the button, the picture, a wall tile) opens the ad sheet and still records the tap.
const ad = src("features/ads/SlpInlineAd.tsx");
assert.equal(ad.match(/<SlurpAdSheet promotion=\{promotion\} open=\{open\}/gu)?.length, 2, "list card and wall tile");
assert.match(ad, /const show = \(\) => \{\s*setOpen\(true\);\s*onAction\(\);/u);
assert.match(ad, /<SlpButton variant="secondary" onClick=\{show\}/u);
assert.match(ad, /<button\s+type="button"\s+onClick=\{show\}/u, "the picture opens it too");
assert.match(ad, /onClick=\{\(\) => \{\s*setOpen\(true\);\s*onAction\(\);\s*\}\}/u, "wall tile");
// The old "Opening … promotion" toast promised a page that did not exist.
assert.doesNotMatch(src("app/screens/SlpScreenHub.tsx"), /ui\.slurp\.ads\.opened/u);
for (const lang of ["en", "de", "ko", "pl"]) {
  const strings = JSON.parse(src(`locales/${lang}.json`)) as Record<string, string>;
  for (const feel of ["budget", "everyday", "premium"])
    assert.ok(strings[`ui.slurp.ads.price.${feel}`], `${lang} ${feel}`);
  assert.equal(strings["ui.slurp.ads.opened"], undefined, lang);
}

// ── R9: edit and delete DMs, and have the Creator write the last answer again ──
const msg = (id: string, role: "viewer" | "creator", kind = "text", price = 0) => ({ id, role, kind, price });
assert.equal(slurpMessageEditable(msg("a", "viewer"), "viewer"), true);
assert.equal(slurpMessageEditable(msg("a", "creator"), "viewer"), false, "only your own words");
assert.equal(slurpMessageEditable(msg("a", "creator"), "creator"), true, "the Creator's owner writes as them");
assert.equal(slurpMessageRemovable(msg("t", "viewer", "tip", 5)), false, "money stays");
assert.equal(slurpMessageRemovable(msg("p", "creator", "ppv", 20)), false);
assert.equal(slurpMessageRemovable(msg("q", "creator", "commission_quote")), false);
assert.equal(slurpMessageRemovable(msg("x", "creator")), true);
// A commission or scene record is a system line with no price: it still stays.
const system = (metadata: Record<string, unknown>) => ({ ...msg("s", "creator", "system"), metadata });
assert.equal(slurpMessageRemovable(system({ commissionId: "c1" })), false, "commission steps stay");
assert.equal(slurpMessageRemovable(system({ scene: { id: "x" } })), false, "scene cards stay");
assert.equal(slurpMessageRemovable(system({})), true);
assert.equal(slurpLastAnswer([msg("1", "viewer"), system({ commissionId: "c1" })]), null);
assert.deepEqual(slurpLastAnswer([msg("1", "viewer"), msg("2", "creator"), msg("3", "creator")]), ["2", "3"]);
assert.equal(slurpLastAnswer([msg("1", "viewer")]), null, "no answer yet");
assert.equal(slurpLastAnswer([msg("1", "creator")]), null, "nothing to answer");
assert.equal(slurpLastAnswer([msg("1", "viewer"), msg("2", "creator", "ppv", 9)]), null, "a paid answer stays");
const editRoutes = readFileSync(join(server, "features/messages/slp-message-edit-routes.ts"), "utf8");
assert.match(
  editRoutes,
  /hasPending\(threadId\)\)\s*return reply\.code\(409\)[\s\S]*?deleteSlurpMessages\(app\.db, threadId, answer\)[\s\S]*?force: true/u,
);
// Every write is locked while the thread is in a scene; the lock only wraps POST routes.
const lock = readFileSync(join(server, "features/messages/scenes/slp-roleplay-scene-lock.ts"), "utf8");
for (const path of [...editRoutes.matchAll(/app\.(\w+)\("([^"]+)"/gu)]) {
  assert.equal(path[1], "post", path[2]);
  assert.ok(lock.includes(`"${path[2]}"`), path[2]);
}
// Deleting removes only the claims of the deleted messages: another trigger's claim is what stops a
// second answer to it. Deleting the fan's newest line drops the answer owed to it.
const editStorage = readFileSync(join(server, "data/messages/slp-message-edit-storage.ts"), "utf8");
assert.match(
  editStorage,
  /delete\(slurpMessageClaims\)[\s\S]*?or\(inArray\(slurpMessageClaims\.triggerMessageId, gone\), inArray\(slurpMessageClaims\.replyMessageId, gone\)\)/u,
);
assert.doesNotMatch(
  editStorage,
  /delete\(slurpMessageClaims\)\.where\(eq\(slurpMessageClaims\.threadId, threadId\)\)/u,
);
assert.match(
  editStorage,
  /if \(owed && gone\.includes\(String\(owed\.id\)\)\)[\s\S]*?delete\(slurpReplyBubbles\)[\s\S]*?generationEpoch/u,
);
// "Write it again" that could not write puts the old answer back, never a thread without one.
assert.match(
  editRoutes,
  /snapshotSlurpMessages\(app\.db, threadId, answer\)[\s\S]*?deleteSlurpMessages\(app\.db, threadId, answer\)[\s\S]*?if \(outcome\.status !== "replied"\) await restoreSlurpMessages\(app\.db, threadId, oldAnswer\);/u,
);
assert.match(
  editStorage,
  /restoreSlurpMessages[\s\S]*?delete\(slurpReplyBubbles\)[\s\S]*?insert\(slurpMessages\)\.values\(row\)/u,
);

// ── R10: a DM thread as text, or a summary, to paste into a lorebook ──
const row = (role: "viewer" | "creator", content: string, extra: Record<string, unknown> = {}) => ({
  role,
  kind: "text",
  content,
  imageUrl: null,
  createdAt: "2026-10-06T12:34:56.000Z",
  senderSnapshot: {},
  ...extra,
});
const names = { viewer: "Gunter", creator: "Riley" };
assert.equal(
  slurpThreadTranscript(
    [
      row("viewer", "hey"),
      row("creator", "hi you", { senderSnapshot: { displayName: "Riley Vale" } }),
      row("creator", "", { kind: "ppv" }),
      row("creator", "  "),
    ],
    names,
  ),
  "[2026-10-06 12:34] Gunter: hey\n[2026-10-06 12:34] Riley Vale: hi you\n[2026-10-06 12:34] Riley: [locked picture]",
);
const summaryPrompt = slurpThreadSummaryMessages("x".repeat(200_000), names);
assert.ok(summaryPrompt[1]!.content.length <= 120_000, "the newest part of a long thread");
assert.match(summaryPrompt[0]!.content, /Gunter and Riley/u);
// Each side reads what it may see: the fan's copy goes through the same mask as the thread.
assert.match(
  readFileSync(join(server, "features/messages/slp-thread-export-routes.ts"), "utf8"),
  /side === "viewer" \? maskForViewer\(message\) : message/u,
);

// ── R8: a Creator answering a comment knows the commenter from DMs ──
const replies = readFileSync(join(server, "features/messages/slp-reply-generation-service.ts"), "utf8");
assert.match(
  replies,
  /return `\$\{line\}\$\{await describeCommenterDms\(db, creatorAccountId, viewerId, viewerName\)\}`;/u,
);
assert.match(
  replies,
  /dms\.getThread\(viewerId, creatorAccountId\)[\s\S]*?describeSlurpRapport\(await dms\.rapportFor/u,
);
assert.match(replies, /Do not quote private DMs in public/u);
// DM lines can name a protected identity, so the relationship line is redacted like the comment.
assert.match(replies, /relationship: protect\(input\.relationship \?\? "no history with this creator yet"\)/u);

// ── R3 + R4: a blocked pair never becomes a couple; a family bond keeps the pair from an automatic one ──
const free = { off: false, only: [], never: [] };
assert.equal(slpRomanceAllows({ id: "a", romance: free }, { id: "b", romance: free }), true);
assert.equal(slpRomanceAllows({ id: "a", romance: { ...free, never: ["b"] } }, { id: "b", romance: free }), false);
assert.equal(slpRomanceAllows({ id: "a", romance: free }, { id: "b", romance: { ...free, never: ["a"] } }), false);
assert.deepEqual(normalizeSlpCreatorSteering({ romance: { off: false, only: [], never: ["b", "b", ""] } }).romance, {
  off: false,
  only: [],
  never: ["b"],
});
assert.deepEqual(normalizeSlpCreatorSteering({}).romance.never, [], "older saves read as nobody blocked");
{
  const person = (id: string, kin: string[] = []) =>
    ({ id, name: id, text: "", tags: [], automatic: true, gender: null, kin }) as never;
  assert.equal(slurpCoupleFit(person("mum", ["kid"]), person("kid", ["mum"])).misfit, "family");
  assert.equal(slurpCoupleFit(person("mum"), person("kid")).fits, true, "no family bond, no block");
  const lovers = { ...(person("mum", ["kid"]) as object), cardPartners: ["kid"] } as never;
  assert.equal(
    slurpCoupleFit(lovers, person("kid", ["mum"])).misfit,
    "family",
    "a family bond beats a card that says lovers",
  );
}
// The tie rules read the active family bonds into `kin`.
assert.match(
  readFileSync(join(client, "../../../server/src/slp/features/projects/slp-creator-ties-service.ts"), "utf8"),
  /bond\.kind === "family" && slurpBondActive\(bond\)[\s\S]*?kin: family\.flatMap/u,
);

// ── R6: an old Creator's page filled in through the role-play sign-up ──
{
  const page = {
    displayName: "Riley",
    handle: "riley",
    bio: "Gym and cats.",
    stagePersonality: "",
    appearance: "Tall, red hair.",
    wardrobe: "",
    locations: "",
    gender: "female" as const,
    tags: ["gym", "cats", "cosplay"],
  };
  const state = slpSceneUpdateState(page, { turnOns: ["lingerie"], hardNoes: [] }, { level: "suggestive" });
  assert.deepEqual(
    [...state.locked].sort(),
    ["appearance", "bio", "displayName", "gender", "handle", "spice", "tags", "turnOns"],
    "what the page has stays (their spice too); the scene asks about the rest",
  );
  assert.equal(state.draft.spice, null, "saving never writes a level, so a Slurp-wide one stays Slurp-wide");
  assert.equal(state.draft.turnOns, "lingerie");
  const prompt = buildSlpSceneTurnMessages({
    request: {
      preset: "support",
      moment: "voice",
      action: { kind: "continue" },
      transcript: [],
      draft: state.draft,
      locked: state.locked,
      direction: "",
      disclosureMode: "hinted",
      updating: true,
    },
    newcomerCanon: "",
    allowedTags: [],
  })[0]!.content;
  assert.match(prompt, /already has a live Creator page/u);
  assert.doesNotMatch(prompt, /get the newcomer's Creator page live tonight/u);
  // An update asks until every field of a step is there: wardrobe after the look, hard noes after turn-ons.
  const half = { ...state.draft, appearance: "Tall.", wardrobe: "", turnOns: "x", hardNoes: "" };
  assert.equal(slpSceneMomentFilled("look", half, false, true), false);
  assert.equal(slpSceneMomentFilled("limits", half, false, true), false);
  assert.equal(slpSceneMomentFilled("look", half), true, "a new sign-up moves on after the first");
  const model = src("features/onboarding/slp-scene-model.ts");
  // Saving an update keeps the clothing style the page has.
  assert.match(model, /setup\.existing\?\.clothingStyle \? \{ clothingStyle: setup\.existing\.clothingStyle \}/u);
  // No second first post and no transcript pasted into an old thread; closing early saves nothing.
  assert.match(model, /if \(setup\.existing\) return false;/u);
  assert.match(model, /if \(!id \|\| setup\.existing\) return false;/u);
}

console.log("slurp2 feedback requests regression passed");
