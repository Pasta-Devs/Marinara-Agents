import assert from "node:assert/strict";
import { join } from "node:path";
import { resetSlurpBackupState } from "../packages/slurp2/src/engine/packages/server/src/slp/base/locking/slp-backup-state";
import { tryCreatorAccountOperation } from "../packages/slurp2/src/engine/packages/server/src/slp/base/locking/slp-account-operation-lock";
import {
  claimSlurpBackup,
  resetSlpOperationsForTests,
  trySlpOperation,
  trySlurpDataDeletion,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/locking/slp-operation-lock";
import { slurp2Source } from "./slurp2-source";

const root = join(import.meta.dirname, "..");
const read = (path: string) => slurp2Source(join(root, path));
const client = "packages/slurp2/src/engine/packages/client/src";
const server = "packages/slurp2/src/engine/packages/server/src";

const home = read(`${client}/components/slurp/SlurpHome.tsx`);
const shell = read(`${client}/components/slurp/SlurpShell.tsx`);
const splash = read(`${client}/components/slurp/SlurpSplash.tsx`);
const routes = read(`${server}/routes/slurp.routes.ts`);
const ads = read(`${server}/services/garnish-ads/garnish-ads.service.ts`);
const generation = read(`${server}/services/slurp/slurp-garnish-generation.service.ts`);
const garnishContext = read(`${server}/services/slurp/slurp-garnish-context.ts`);
const world = read(`${server}/services/slurp/slurp-world.operation.ts`);
const followUps = read(`${server}/services/slurp/slurp-follow-up-scheduler.service.ts`);
const messageRoutes = read(`${server}/routes/slurp-messages.routes.ts`);
const storage = read(`${server}/services/storage/slurp.storage.ts`);
const postCard = read(`${client}/components/slurp/SlurpPostCard.tsx`);
const inlineAd = read(`${client}/components/slurp/SlurpInlineAd.tsx`);
const coin = read(`${client}/components/slurp/SlurpCoin.tsx`);
const english = read(`${client}/localization/locales/en.json`);

assert.match(home, /items\[Math\.floor\(index \/ inlineAdEvery\) % items\.length\]/u);
assert.match(home, /const emptyWallAd = inlineAdsQuery\.data\?\.items\?\.\[0\] \?\? null;[\s\S]*?<SlurpInlineAdTile/u);
// The dialog's side card hides the picture with `hideImage`; it must not blank `imageUrl`, because
// "Download post card" in the card's own menu still reads it.
assert.match(home, /side=\{<SlpPostCard post=\{post\} ctx=\{ctx\} surface="dialog" hideImage \/>\}/u);
assert.match(postCard, /export function createSlpLightboxImage\(id: string, url: string, prompt = ""\)/u);
assert.match(postCard, /chatId: "noodle",[\s\S]{0,120}prompt,/u);
assert.doesNotMatch(inlineAd, /if \(!promotion\.imageUrl\) return null/u);
assert.match(coin, /DEFAULT_SLURP_SUBSCRIPTION_PRICE = 12/u);
// The Stories landing tile became the storylines tile (planAutomation); the label must stay defined.
assert.match(english, /ui\.slurp\.settings\.backstage\.landing\.planAutomation": "Storylines"/u);
assert.match(garnishContext, /contentCeiling: input\.contentCeiling/u);
assert.match(generation, /z\.enum\(\["tame", "suggestive", "explicit"\]\)\.catch\("tame"\)/u);
assert.match(shell, /import \{ SLURP_LOGO_SRC \} from "\.\/slp-logo"/u);

assert.match(ads, /async canAct[\s\S]*?state\.recentAdIds\.includes\(adId\)[\s\S]*?active\.some/u);
assert.match(routes, /if \(!\(await ads\.canAct[\s\S]*?return reply\.code\(404\)[\s\S]*?earnCoins/u);
assert.match(home, /const feedIsOnScreen = Boolean\(scope\)[\s\S]*?if \(feedIsOnScreen\) onFeedShown\(\)/u);
// A set tip goal must not take the composer's place: the goal bar and the creator tools share
// `preTabsContent`, and a ternary between them left Create post and Add story opening nothing.
assert.doesNotMatch(home, /\) : managedCreator && !editing \? \(/u);
assert.match(home, /editing \? null : \([\s\S]*?\{goalForViewer && \(/u);
// Creator tools no longer couple to `!editing` through their own ternary (the line above), but
// the coupling must still exist: they must stay nested inside the same `editing ? null : (...)`
// block as the goal bar, so editing still hides them, not just unconditionally render them.
// Slice the guarded block (up to the next prop), so a tools card rendered after the block closes
// cannot satisfy the check.
const guardStart = home.search(/afterTabsContent=\{\s*editing \? null : \(/u);
assert.ok(guardStart >= 0, "the editing guard around the profile's after-tabs content must exist");
const guardedBlock = home.slice(guardStart, home.indexOf("postList={cards}", guardStart));
assert.match(
  guardedBlock,
  /\{managedCreator && <SlpCreatorToolsCard model=\{model\} \/>\}/u,
  "creator tools must stay inside the editing-hides-everything block",
);
assert.match(home, /data-slurp-creator-tools/u);

assert.doesNotMatch(splash, /initialFocusRef|hideCloseButton/u);
assert.match(splash, /topRef\.current\?\.focus\(\{ preventScroll: true \}\)/u);
// The close button is disabled, not hidden, when there is no onLeave to return to.
assert.match(splash, /closeDisabled=\{!onLeave\}/u);

assert.match(world, /MAINTENANCE_KEY = "slurp2\.world\.maintenance"/u);
assert.match(world, /const maintenanceSince = maintenanceMark \?\? since/u);
assert.equal((world.match(/for \(const account of maintenanceDue \? accounts : \[\]\)/gu) ?? []).length, 3);
// The mark must also be written when it is absent. Writing it only when maintenance is due leaves
// the fallback resolving to the previous tick forever, so a box that ticks more often than
// CHURN_MIN_ELAPSED_DAYS never arms the clock and maintenance never runs at all.
assert.match(world, /if \(maintenanceDue \|\| !maintenanceMark\) await writeMaintenanceMark\(db, until\)/u);
assert.match(world, /const automaticCreators = accounts\.filter/u);
assert.match(
  world,
  /const messaging = await messages\.getCreatorMessaging\(account\.id\)[\s\S]*?if \(!messaging\.proactiveMessages\) continue/u,
);

// Availability reads the newest *published* post. The filter belongs in the query: a caller that
// fetches one row and filters drafts out afterwards gets nothing when the newest post is a draft,
// which reads as a Creator who has never posted.
// The availability read moved from the message operation into slp-thread-stance.ts.
const availability = read(`${server}/slp/features/messages/slp-thread-stance.ts`);
for (const source of [followUps, availability, messageRoutes]) {
  assert.match(source, /getNoodlerLatestPublishedPost\(creator\.id\)/u);
  assert.match(source, /latestPost\?\.createdAt \?\? null/u);
  assert.doesNotMatch(source, /listNoodlerPostsByAccount\(creator\.id, 1\)/u);
}
assert.match(storage, /getNoodlerLatestPublishedPost[\s\S]*?ne\(slpPosts\.access, "draft"\)[\s\S]*?\.limit\(1\)/u);

function latch() {
  let release!: () => void;
  let started!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  return { wait, ready, release, started };
}

async function main() {
  resetSlurpBackupState();
  resetSlpOperationsForTests();

  const worldLatch = latch();
  const worldRun = trySlpOperation("slurp-world-tick", async () => {
    worldLatch.started();
    await worldLatch.wait;
  });
  await worldLatch.ready;
  assert.equal(claimSlurpBackup(), null, "backup must not overlap a world mutation");
  assert.deepEqual(await trySlurpDataDeletion(async () => undefined), { acquired: false });
  worldLatch.release();
  await worldRun;

  const releaseBackup = claimSlurpBackup();
  assert.ok(releaseBackup);
  assert.deepEqual(await tryCreatorAccountOperation("creator", async () => undefined), { acquired: false });
  assert.deepEqual(await trySlpOperation("slurp-world-tick", async () => undefined), { acquired: false });
  releaseBackup();

  const deletionLatch = latch();
  const deletionRun = trySlurpDataDeletion(async () => {
    deletionLatch.started();
    await deletionLatch.wait;
  });
  await deletionLatch.ready;
  assert.deepEqual(await tryCreatorAccountOperation("creator", async () => undefined), { acquired: false });
  assert.deepEqual(await trySlpOperation("slurp-world-tick", async () => undefined), { acquired: false });
  deletionLatch.release();
  await deletionRun;

  const accountLatch = latch();
  const accountRun = tryCreatorAccountOperation("creator", async () => {
    accountLatch.started();
    await accountLatch.wait;
  });
  await accountLatch.ready;
  assert.deepEqual(await trySlurpDataDeletion(async () => undefined), { acquired: false });
  assert.equal(claimSlurpBackup(), null, "backup must not overlap an account mutation");
  accountLatch.release();
  await accountRun;

  console.log("slurp2 bughunt regressions passed");
}

void main();
