import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slurpViewerImageOnCooldown } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging.js";

// Redesign step 6.5: player-set cooldowns (picture wait in chat, a Creator's time away, Creator
// replies per day) and the step 6 follow-ups (one-tap cancel + Undo on profile and Discover, the
// persona's name on the Wallet card, a calm refill clock time).
const engine = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const client = (path: string) => readFileSync(join(engine, "client/src/slp", path), "utf8");
const server = (path: string) => readFileSync(join(engine, "server/src/slp", path), "utf8");
const locale = (lang: string) => JSON.parse(client(`locales/${lang}.json`)) as Record<string, string>;

// ── Picture cooldown: 0 = never a 429, N = a 429 only inside N minutes ──
const now = Date.parse("2026-09-27T12:00:00.000Z");
const drawn = (minutesAgo: number, role = "viewer", generatedContext: unknown = "viewer") => ({
  role,
  createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
  metadata: { generatedContext },
});
assert.equal(slurpViewerImageOnCooldown([drawn(1)], 0, now), false, "0 turns the wait off");
assert.equal(slurpViewerImageOnCooldown([drawn(29)], 30, now), true, "inside N minutes: wait");
assert.equal(slurpViewerImageOnCooldown([drawn(30)], 30, now), false, "after N minutes: draw again");
assert.equal(slurpViewerImageOnCooldown([drawn(179)], 180, now), true, "the old 3-hour default still holds");
assert.equal(slurpViewerImageOnCooldown([drawn(1, "creator")], 180, now), false, "a Creator's picture never counts");
assert.equal(slurpViewerImageOnCooldown([drawn(1, "viewer", null)], 180, now), false, "an upload never counts");
assert.equal(slurpViewerImageOnCooldown([], 180, now), false);
const mediaRoutes = server("features/messages/slp-messages-media-routes.ts");
assert.match(
  mediaRoutes,
  // Step 7: the helper now returns when the wait ends, so the 429 can say "Draw again at 4:30 PM".
  /messagesViewerImageCooldownMinutes;\s+const readyAt =\s+cooldownMinutes > 0\s*\? slurpViewerImageReadyAt\(await messages\.listMessages\(thread\.id(?:, [\d_]+)?\), cooldownMinutes\)\s*: null;[\s\S]*?if \(readyAt\) return reply\.code\(429\)/u,
  "the route reads the setting and answers 429 only through the helper",
);
assert.doesNotMatch(mediaRoutes, /3 \* 60 \* 60_000/u, "no hard-coded 3 hours left");

// ── Settings: defaults keep today's behaviour; bounds ──
// (Source pins: the settings module imports the Engine logger, which tests cannot load.
// `normalizeSlurpSettings` fills every missing key from `DEFAULT_SLURP_SETTINGS`, so an install
// without the new keys keeps the old 3 hours / 6 hours / 10 replies.)
const settingsSource = server("modules/settings/slp-settings.ts");
assert.match(settingsSource, /messagesViewerImageCooldownMinutes: z\.number\(\)\.int\(\)\.min\(0\)\.max\(10080\),/u);
assert.match(settingsSource, /messagesCoolOffMinutes: z\.number\(\)\.int\(\)\.min\(0\)\.max\(10080\),/u);
assert.match(
  settingsSource,
  /creatorRepliesPerDay: z\.number\(\)\.int\(\)\.min\(1\)\.max\(200\),/u,
  "the reply cap has no off: it is the audience drain's only cap",
);
assert.match(settingsSource, /messagesViewerImageCooldownMinutes: 180,/u);
assert.match(settingsSource, /messagesCoolOffMinutes: SLURP_COOL_OFF_HOURS \* 60,/u);
assert.match(settingsSource, /creatorRepliesPerDay: DEFAULT_SLP_CREATOR_REPLIES_PER_24_HOURS,/u);
assert.match(
  settingsSource,
  /Object\.entries\(DEFAULT_SLURP_SETTINGS\)\.map\(\(\[key, value\]\) => \[key, rawRecord\[key\] \?\? value\]\)/u,
);
assert.match(server("modules/world/slp-stance.ts"), /export const SLURP_COOL_OFF_HOURS = 6;/u);

// ── Time away after a fight: both boundary paths read the setting ──
for (const path of [
  "features/messages/slp-message-operation.ts",
  "features/messages/slp-follow-up-scheduler-service.ts",
]) {
  const source = server(path);
  assert.match(source, /beginCoolOff\(threadId, coolOffMinutes \/ 60\)/u, path);
  assert.match(source, /reply\.latitude,\s+settings\.messagesCoolOffMinutes,?\s*\)/u, path);
  assert.doesNotMatch(source, /SLURP_COOL_OFF_HOURS/u, path);
}
// 0 minutes = a cool-off that ends at once (the strike still counts).
assert.match(
  server("data/messages/slp-messages-storage-actions.ts"),
  /coolUntil: new Date\(Date\.now\(\) \+ hours \* 3_600_000\)\.toISOString\(\),\s+strikes:/u,
);

// ── Creator replies per day: both claims pass the setting ──
assert.match(
  server("features/messages/slp-creator-reply-operation.ts"),
  /input\.viewerActorAccountId,\s+undefined,\s+settings\.creatorRepliesPerDay,/u,
);
assert.match(
  server("features/audience/slp-audience-reply-operation.ts"),
  /claimNoodlerAudienceReply\(\s*creator\.id,\s+comment\.id,\s+undefined,\s+settings\.creatorRepliesPerDay,?\s*\)/u,
);

// ── Backstage: rows in the Advanced groups, searchable, reset with their page, four locales ──
const messaging = client("features/messages/SlpMessagingPanel.tsx");
assert.match(
  messaging,
  /<AdvancedGroup title=\{t\("ui\.slurp\.settings\.messaging\.cooldownsTitle"[\s\S]*?settingKey="messagesViewerImageCooldownMinutes"[\s\S]*?min=\{0\}\s+max=\{10080\}[\s\S]*?settingKey="messagesCoolOffMinutes"[\s\S]*?<\/AdvancedGroup>/u,
);
const audience = client("features/audience/SlpAudiencePanel.tsx");
assert.match(audience, /settingKey="creatorRepliesPerDay"[\s\S]*?min=\{1\}\s+max=\{200\}/u);
const placement = client("features/backstage/slp-backstage-placement.ts");
assert.match(placement, /messagesViewerImageCooldownMinutes: slurp\("messaging"/u);
assert.match(placement, /messagesCoolOffMinutes: slurp\("messaging"/u);
assert.match(placement, /creatorRepliesPerDay: slurp\("audience"/u);
const defaults = client("features/settings/slp-settings-defaults.ts");
for (const key of ["messagesViewerImageCooldownMinutes", "messagesCoolOffMinutes", "creatorRepliesPerDay"])
  assert.match(defaults, new RegExp(`"${key}"`, "u"), key);
for (const lang of ["en", "de", "ko", "pl"]) {
  const strings = locale(lang);
  for (const key of [
    "ui.slurp.settings.messaging.cooldownsTitle",
    "ui.slurp.settings.messaging.viewerImageCooldown",
    "ui.slurp.settings.messaging.viewerImageCooldownDetail",
    "ui.slurp.settings.messaging.coolOff",
    "ui.slurp.settings.messaging.coolOffDetail",
    "ui.slurp.settings.audience.creatorRepliesPerDay",
    "ui.slurp.settings.audience.creatorRepliesPerDayDetail",
  ])
    assert.ok(strings[key]?.trim(), `${lang}: ${key}`);
}

// ── Step 6 follow-ups ──
// 1. Profile and Discover cancel in one tap with the same Undo toast as the Wallet.
const toastHelper = client("modules/chrome/slp-subscription-toast.ts");
assert.match(toastHelper, /action: \{\s+label: localizeUi\("ui\.slurp\.wallet\.undo"/u);
const profileActions = client("app/screens/SlpProfileLeadingActions.tsx");
const profileCard = client("modules/creator/SlpCreatorProfileCard.tsx");
for (const [name, source] of [
  ["profile", profileActions],
  ["discover", profileCard],
] as const) {
  assert.doesNotMatch(source, /showConfirmDialog/u, `${name}: no confirm dialog`);
  assert.match(source, /showSlpSubscriptionCancelledToast\(\{/u, `${name}: Undo toast`);
  assert.match(
    source,
    // Step 7: Discover names its resume (it also backs the card's Resume button).
    /onUndo: (?:\(\) =>\s+Promise\.resolve\(onToggleSubscription\([^)]+, false\)\)|resume \})/u,
    `${name}: Undo resumes`,
  );
}
assert.match(
  profileCard,
  /const resume = \(\) =>\s+Promise\.resolve\(onToggleSubscription\(creator\.profile\.id, false\)\)/u,
);
// 2. The Wallet card names whose wallet it is.
const walletView = client("app/screens/SlpScreenWallet.tsx");
assert.match(walletView, /ui\.slurp\.wallet\.personaWallet/u);
assert.equal(locale("en")["ui.slurp.wallet.personaWallet"], "{{name}}'s wallet");
// 3. Refill: a calm clock time, no per-second countdown.
assert.equal(locale("en")["ui.slurp.wallet.refillCountdown"], "Next refill {{time}}");
assert.doesNotMatch(walletView, /setInterval/u);
assert.match(walletView, /formatClockTime\(nextRefillAt, i18n\.language\)/u);

console.log("slurp2 step 6.5 cooldowns regression passed");
