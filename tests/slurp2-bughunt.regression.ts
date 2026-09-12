import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resetSlurpBackupState } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-backup-state";
import { tryNoodlerAccountOperation } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-account-operation-lock";
import {
  claimSlurpBackup,
  resetNoodleOperationsForTests,
  tryNoodleOperation,
  trySlurpDataDeletion,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-operation-lock";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
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
const messages = read(`${server}/services/slurp/slurp-message.operation.ts`);
const messageRoutes = read(`${server}/routes/slurp-messages.routes.ts`);
const storage = read(`${server}/services/storage/slurp.storage.ts`);

assert.match(home, /items\[Math\.floor\(index \/ inlineAdEvery\) % items\.length\]/u);
assert.match(garnishContext, /contentCeiling: input\.contentCeiling/u);
assert.match(generation, /z\.enum\(\["tame", "suggestive", "explicit"\]\)\.catch\("tame"\)/u);
assert.match(shell, /\/api\/capability-packages\/slurp2\/assets\/slurp2-logo\.png/u);

assert.match(ads, /async canAct[\s\S]*?state\.recentAdIds\.includes\(adId\)[\s\S]*?active\.some/u);
assert.match(routes, /if \(!\(await ads\.canAct[\s\S]*?return reply\.code\(404\)[\s\S]*?earnCoins/u);
assert.match(home, /const feedIsOnScreen = Boolean\(scope\)[\s\S]*?if \(feedIsOnScreen\) onFeedShown\(\)/u);
// A set tip goal must not take the composer's place: the goal bar and the creator tools share
// `preTabsContent`, and a ternary between them left Create post and Add story opening nothing.
assert.doesNotMatch(home, /\) : managedCreator && !editing \? \(/u);
assert.match(home, /\{goalForViewer && !editing && \(/u);
assert.match(home, /\{managedCreator && !editing && \(\s*<section data-slurp-creator-tools/u);

assert.doesNotMatch(splash, /initialFocusRef|hideCloseButton/u);
assert.match(splash, /topRef\.current\?\.focus\(\{ preventScroll: true \}\)/u);
assert.match(splash, /panelClassName="\[&>div:first-child>button\]:hidden"/u);

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
for (const source of [followUps, messages, messageRoutes]) {
  assert.match(source, /getNoodlerLatestPublishedPost\(creator\.id\)/u);
  assert.match(source, /latestPost\?\.createdAt \?\? null/u);
  assert.doesNotMatch(source, /listNoodlerPostsByAccount\(creator\.id, 1\)/u);
}
assert.match(storage, /getNoodlerLatestPublishedPost[\s\S]*?ne\(noodlePosts\.access, "draft"\)[\s\S]*?\.limit\(1\)/u);

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
  resetNoodleOperationsForTests();

  const worldLatch = latch();
  const worldRun = tryNoodleOperation("slurp-world-tick", async () => {
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
  assert.deepEqual(await tryNoodlerAccountOperation("creator", async () => undefined), { acquired: false });
  assert.deepEqual(await tryNoodleOperation("slurp-world-tick", async () => undefined), { acquired: false });
  releaseBackup();

  const deletionLatch = latch();
  const deletionRun = trySlurpDataDeletion(async () => {
    deletionLatch.started();
    await deletionLatch.wait;
  });
  await deletionLatch.ready;
  assert.deepEqual(await tryNoodlerAccountOperation("creator", async () => undefined), { acquired: false });
  assert.deepEqual(await tryNoodleOperation("slurp-world-tick", async () => undefined), { acquired: false });
  deletionLatch.release();
  await deletionRun;

  const accountLatch = latch();
  const accountRun = tryNoodlerAccountOperation("creator", async () => {
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
