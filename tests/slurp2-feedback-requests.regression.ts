/** October 2026 Discord requests (packages/slurp2/docs/FEEDBACK-2026-10.md, R1-R11). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slurpCommissionBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-world-copy.ts";
import { SLURP_COMMISSION_ASKS } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-world.ts";
import { slpSceneUpdateState } from "../packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/slp-scene-draft.ts";
import { buildSlpSceneTurnMessages } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/onboarding/slp-scene-prompt.ts";
import {
  slurpThreadSummaryMessages,
  slurpThreadTranscript,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-thread-export.ts";
import {
  slurpLastAnswer,
  slurpMessageEditable,
  slurpMessageRemovable,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-message-edit.ts";
import {
  normalizeSlpCreatorSteering,
  slpRomanceAllows,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-creator-steering.ts";

const client = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const src = (path: string) => readFileSync(join(client, path), "utf8");

// ── R2: quick replies for the Support desk ──
const quick = readFileSync(join(client, "features/messages/SlpDeskQuickReplies.tsx"), "utf8");
assert.match(
  quick,
  /const replies = saved\.length \? saved : SLP_DESK_QUICK_REPLIES;/u,
  "built-ins until the player saves",
);
assert.match(quick, /setDraft\(reply\);/u, "one tap fills the composer; the player still sends");
assert.match(quick, /supportDesk: \{ \.\.\.desk, quickReplies \}/u);
assert.match(
  src("features/messages/SlpThreadComposer.tsx"),
  /\{asSupport && <SlpDeskQuickReplies model=\{model\} \/>\}/u,
);

// ── R3 + R4: family and blocked pairs never become a couple ──
// One rule every romance gate shares (couple fit, drama ties, drama casting): `never` on either side.
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
// Family bonds and family a card names fill `never` on both sides when the tie rules load the Creators.
assert.match(
  readFileSync(join(client, "../../../server/src/slp/features/projects/slp-creator-ties-service.ts"), "utf8"),
  /bond\.kind === "family" && slurpBondActive\(bond\)[\s\S]*?slurpBondFromRelation\(person\.relation\)\?\.kind === "family"[\s\S]*?never: \[\.\.\.\(creator\.romance\.never \?\? \[\]\), other\]/u,
);

// ── R9: edit and delete DMs, and have the Creator write the last answer again ──
const msg = (id: string, role: "viewer" | "creator", kind = "text", price = 0) => ({ id, role, kind, price });
assert.equal(slurpMessageEditable(msg("a", "viewer"), "viewer"), true);
assert.equal(slurpMessageEditable(msg("a", "creator"), "viewer"), false, "only your own words");
assert.equal(slurpMessageEditable(msg("a", "creator"), "creator"), true, "the Creator's owner writes as them");
assert.equal(slurpMessageRemovable(msg("t", "viewer", "tip", 5)), false, "money stays");
assert.equal(slurpMessageRemovable(msg("p", "creator", "ppv", 20)), false);
assert.equal(slurpMessageRemovable(msg("q", "creator", "commission_quote")), false);
assert.equal(slurpMessageRemovable(msg("x", "creator")), true);
assert.deepEqual(slurpLastAnswer([msg("1", "viewer"), msg("2", "creator"), msg("3", "creator")]), ["2", "3"]);
assert.equal(slurpLastAnswer([msg("1", "viewer")]), null, "no answer yet");
assert.equal(slurpLastAnswer([msg("1", "creator")]), null, "nothing to answer");
assert.equal(slurpLastAnswer([msg("1", "viewer"), msg("2", "creator", "ppv", 9)]), null, "a paid answer stays");
const editRoutes = readFileSync(
  join(client, "../../../server/src/slp/features/messages/slp-message-edit-routes.ts"),
  "utf8",
);
assert.match(
  editRoutes,
  /hasPending\(threadId\)\)\s*return reply\.code\(409\)[\s\S]*?deleteSlurpMessages\(app\.db, threadId, answer\)[\s\S]*?force: true/u,
);
// Every write is locked while the thread is in a scene; the lock only wraps POST routes.
const lock = readFileSync(
  join(client, "../../../server/src/slp/features/messages/scenes/slp-roleplay-scene-lock.ts"),
  "utf8",
);
for (const path of [...editRoutes.matchAll(/app\.(\w+)\("([^"]+)"/gu)]) {
  assert.equal(path[1], "post", path[2]);
  assert.ok(lock.includes(`"${path[2]}"`), path[2]);
}
// Deleting drops queued bubbles and claims and moves the epoch, so an answer in flight does not land.
assert.match(
  readFileSync(join(client, "../../../server/src/slp/data/messages/slp-message-edit-storage.ts"), "utf8"),
  /delete\(slurpReplyBubbles\)[\s\S]*?delete\(slurpMessageClaims\)[\s\S]*?generationEpoch: String\(Number\(thread\?\.generationEpoch \?\? 0\) \+ 1\)/u,
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
  readFileSync(join(client, "../../../server/src/slp/features/messages/slp-thread-export-routes.ts"), "utf8"),
  /side === "viewer" \? maskForViewer\(message\) : message/u,
);

// ── R8: a Creator answering a comment knows the commenter from DMs ──
const replies = readFileSync(
  join(client, "../../../server/src/slp/features/messages/slp-reply-generation-service.ts"),
  "utf8",
);
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
  const state = slpSceneUpdateState(page, { turnOns: ["lingerie"], hardNoes: [] });
  assert.deepEqual(
    [...state.locked].sort(),
    ["appearance", "bio", "displayName", "gender", "handle", "tags", "turnOns"],
    "what the page has stays; the scene asks about the rest",
  );
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
  const model = src("features/onboarding/slp-scene-model.ts");
  // No second first post and no transcript pasted into an old thread; closing early saves nothing.
  assert.match(model, /if \(setup\.existing\) return false;/u);
  assert.match(model, /if \(!id \|\| setup\.existing\) return false;/u);
}

// ── R7: the player edits what the fan wants in a commission request ──
assert.ok(
  SLURP_COMMISSION_ASKS.some((ask) => slurpCommissionBrief("seed").includes(ask)),
  "built-in asks by default",
);
assert.match(
  slurpCommissionBrief("seed", ["Hi."], ["a tiny frog"]),
  /^Hi\. a tiny frog /u,
  "the player's own asks win",
);
const server = join(client, "../../../server/src/slp");
const settings = readFileSync(join(server, "modules/settings/slp-settings.ts"), "utf8");
assert.match(settings, /messagesCommissionAsks: z\s*\.array\(z\.string\(\)\.trim\(\)\.min\(1\)/u);
assert.match(settings, /messagesCommissionAsks: \[\],/u, "empty = the built-in asks");
assert.match(
  readFileSync(join(server, "features/world/slp-world-actions.ts"), "utf8"),
  /settings\.messagesCommissionOpeners,\s*settings\.messagesCommissionAsks,/u,
);
assert.match(
  src("features/messages/SlpMessagingPanel.tsx"),
  /settingKey="messagesCommissionAsks"[\s\S]*?builtIn=\{SLURP_COMMISSION_ASKS\}/u,
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

console.log("slurp2 feedback requests regression passed");
