import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || "/home/dev/projects/Marinara-Engine");
let overlayRoot = "";
let dataDir = "";

const importOverlay = <T>(relativePath: string) =>
  import(pathToFileURL(join(overlayRoot, relativePath)).href) as Promise<T>;

type FileDb = {
  select: (...args: unknown[]) => { from: (table: unknown) => any };
  insert: (table: unknown) => { values: (row: unknown) => Promise<void> };
  update: (table: unknown) => { set: (patch: unknown) => { where: (condition: unknown) => Promise<void> } };
  _fileStore: {
    close: () => Promise<void>;
    flush: () => Promise<void>;
    registerTables: (tables: unknown[]) => Promise<void>;
  };
};
type Payment = {
  viewerAccountId: string;
  creatorAccountId: string;
  price: number;
  note: string;
  creditOperationId: string;
};
type Wallet = {
  coins: number;
  ledger: Array<{ id?: string; amount: number }>;
  receipts: Record<string, { amount: number }>;
};
type Earnings = { coins: number; ledger: Array<{ id?: string; amount: number }> };
type SlurpStorage = {
  getWallet: (viewerId: string) => Promise<Wallet>;
  getEarnings: (creatorId: string) => Promise<Earnings>;
  setWalletCoinsForDevelopment: (viewerId: string, coins: number) => Promise<Wallet>;
  updateSettings: (patch: Record<string, unknown>) => Promise<unknown>;
  spendCoins: (viewerId: string, kind: string, amount: number, note?: string, id?: string) => Promise<Wallet | null>;
  tipCreator: (viewerId: string, creatorId: string, amount: number, id?: string) => Promise<Wallet | null>;
  creditCreatorIncome: (creatorId: string, amount: number, reason: "commission", id?: string) => Promise<void>;
  getCreatorIncomeOperationAmount: (creatorId: string, id: string) => Promise<number | null>;
  hasWalletSpendOperation: (viewerId: string, id: string) => Promise<boolean>;
  reverseCreatorIncome: (creatorId: string, amount: number, note: string, id?: string) => Promise<boolean>;
  refundCoins: (viewerId: string, amount: number, note: string, id?: string) => Promise<Wallet>;
};
type MessagesStorage = {
  recoverPendingPayments: () => Promise<void>;
  deliverCommission: (id: string, content: string, imageUrl?: string | null) => Promise<{ state: string } | null>;
};

async function main() {
  overlayRoot = await mkdtemp(join(tmpdir(), "marinara-slurp-phase1-source-"));
  dataDir = await mkdtemp(join(tmpdir(), "marinara-slurp-phase1-data-"));
  process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";
  process.env.DATA_DIR = dataDir;
  process.env.LOG_DISABLE_REQUEST_LOGGING = "true";
  process.env.LOG_LEVEL = "silent";
  process.env.MARINARA_ENV_FILE = join(dataDir, ".env");
  process.env.MARINARA_LITE = "true";
  process.env.NODE_ENV = "test";

  let db: FileDb | null = null;

  try {
    await mkdir(join(overlayRoot, "packages/server"), { recursive: true });
    await cp(join(engineRoot, "package.json"), join(overlayRoot, "package.json"));
    await cp(join(engineRoot, "packages/server/package.json"), join(overlayRoot, "packages/server/package.json"));
    await cp(join(engineRoot, "packages/server/src"), join(overlayRoot, "packages/server/src"), { recursive: true });
    await cp(
      join(repoRoot, "packages/slurp/src/engine/packages/server/src"),
      join(overlayRoot, "packages/server/src"),
      { recursive: true, force: true },
    );
    await symlink(join(engineRoot, "node_modules"), join(overlayRoot, "node_modules"), "dir");
    await symlink(
      join(engineRoot, "packages/server/node_modules"),
      join(overlayRoot, "packages/server/node_modules"),
      "dir",
    );

    const [{ createFileNativeDB }, slurpSchema, messagesModule, storageModule, queryModule, schedulerModule] =
      await Promise.all([
        importOverlay<{ createFileNativeDB: () => Promise<FileDb> }>("packages/server/src/db/file-backed-store.ts"),
        importOverlay<Record<string, unknown>>("packages/server/src/db/schema/slurp.ts"),
        importOverlay<{
          claimSlurpPaymentIntentForDatabase: (db: FileDb, payment: Payment, id: string) => Promise<string>;
          compensateSlurpPaymentForDatabase: (
            db: FileDb,
            payment: Payment,
            error: unknown,
            id: string,
          ) => Promise<void>;
          createSlurpMessagesStorage: (db: FileDb) => MessagesStorage;
          settleSlurpPaymentIntentForDatabase: (
            db: FileDb,
            id: string,
            creatorId: string,
            creditId: string,
          ) => Promise<void>;
        }>("packages/server/src/services/storage/slurp-messages.storage.ts"),
        importOverlay<{ createSlurpStorage: (db: FileDb) => SlurpStorage }>(
          "packages/server/src/services/storage/slurp.storage.ts",
        ),
        importOverlay<{ eq: (column: unknown, value: unknown) => unknown }>("packages/server/src/db/file-query.ts"),
        importOverlay<{
          startSlurpPaymentRecoveryScheduler: (app: {
            db: FileDb;
            addHook: (name: string, hook: () => Promise<void>) => void;
          }) => { pollNow: () => Promise<void>; stop: () => Promise<void> };
        }>("packages/server/src/services/slurp/slurp-payment-recovery-scheduler.service.ts"),
      ]);
    assert.match(
      await readFile(
        join(repoRoot, "packages/slurp/src/engine/packages/server/src/services/slurp/server-entry.ts"),
        "utf8",
      ),
      /startSlurpPaymentRecoveryScheduler\(app, addTeardown\)/u,
    );
    const { eq } = queryModule;
    const paymentTable = slurpSchema.slurpPaymentCompensations as any;
    const accountTable = slurpSchema.noodleAccounts as any;
    const commissionTable = slurpSchema.slurpCommissions as any;
    const messageTable = slurpSchema.slurpMessages as any;
    const threadTable = slurpSchema.slurpThreads as any;
    const eventTable = slurpSchema.slurpEvents as any;
    const tieTable = slurpSchema.slurpAudienceTies as any;

    const openDb = async () => {
      const next = await createFileNativeDB();
      await next._fileStore.registerTables(Object.values(slurpSchema));
      db = next;
      return next;
    };
    const restartDb = async () => {
      assert.ok(db);
      await db._fileStore.flush();
      await db._fileStore.close();
      db = null;
      return openDb();
    };
    const rows = async <T>(table: any): Promise<T[]> => (await db!.select().from(table)) as T[];
    const rowById = async <T extends { id: string }>(table: any, id: string): Promise<T> => {
      const row = (await db!.select().from(table).where(eq(table.id, id)))[0] as T | undefined;
      assert.ok(row, `Missing ${id}`);
      return row;
    };
    const timestamp = new Date().toISOString();
    const account = (id: string, kind: "persona" | "character", sourceEntityId: string) => ({
      id,
      kind,
      entityId: sourceEntityId,
      handle: id,
      displayName: id,
      bio: "",
      avatarUrl: null,
      invited: kind === "persona" ? "true" : "false",
      settings: "{}",
      platform: "slurp",
      sourceKind: kind,
      sourceEntityId,
      slurpSourceAccountId: null,
      visibility: "public",
      publicAccountId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const threadRow = (id: string) => ({
      id,
      viewerAccountId: "viewer",
      creatorAccountId: "creator",
      state: "active",
      openedBy: "viewer",
      requestFeePaid: "0",
      lastMessageAt: timestamp,
      lastMessagePreview: "",
      viewerUnread: "0",
      creatorUnread: "0",
      needsReply: "false",
      generationEpoch: "0",
      replyNotBeforeAt: null,
      rapport: "{}",
      mood: "0",
      moodUpdatedAt: null,
      coolUntil: null,
      extendedOnlineUntil: null,
      scheduledFollowUps: "[]",
      clearedAt: null,
      threadState: "{}",
      strikes: "0",
      lastStrikeAt: null,
      notes: "[]",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const paymentRow = (id: string, note: string, status: string) => ({
      id,
      viewerAccountId: "viewer",
      creatorAccountId: "creator",
      amount: "10",
      creditedAmount: "4",
      note,
      creditOperationId: `${id}:credit`,
      status,
      claimToken: null,
      refundedAt: null,
      reversedAt: null,
      effectsAppliedAt: null,
      failedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const commissionRow = (
      id: string,
      state: string,
      cancellationId: string | null,
      deliveryClaimToken: string | null,
      deliveryClaimedAt: string | null,
    ) => ({
      id,
      threadId: "dm-thread",
      viewerAccountId: "viewer",
      creatorAccountId: "creator",
      state,
      brief: id,
      price: "10",
      deliveryMessageId: null,
      deliverAt: null,
      mediaPath: null,
      cancellationId,
      deliveryId: deliveryClaimToken ? `commission:${id}:delivery` : null,
      deliveryClaimToken,
      deliveryClaimedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await openDb();
    await db.insert(accountTable).values(account("viewer", "persona", "viewer"));
    await db.insert(accountTable).values(account("creator", "persona", "operator"));
    await db.insert(threadTable).values(threadRow("dm-thread"));
    let slurp = storageModule.createSlurpStorage(db);
    let messages = messagesModule.createSlurpMessagesStorage(db);
    await slurp.setWalletCoinsForDevelopment("viewer", 1_000);

    // A proven debit with no Creator credit is refunded on restart, and repeated recovery cannot
    // add a second refund because the real wallet and compensation ledgers share stable IDs.
    const debitOnly: Payment = {
      viewerAccountId: "viewer",
      creatorAccountId: "creator",
      price: 80,
      note: "profile tip",
      creditOperationId: "profile-tip:debit-only",
    };
    assert.equal(
      await messagesModule.claimSlurpPaymentIntentForDatabase(db, debitOnly, debitOnly.creditOperationId),
      "claimed",
    );
    assert.ok(await slurp.spendCoins("viewer", "tip", 80, "creator", debitOnly.creditOperationId));
    db = await restartDb();
    slurp = storageModule.createSlurpStorage(db);
    messages = messagesModule.createSlurpMessagesStorage(db);
    await messages.recoverPendingPayments();
    assert.equal((await slurp.getWallet("viewer")).coins, 920, "fresh charging rows wait for their lease");
    await db
      .update(paymentTable)
      .set({ updatedAt: new Date(Date.now() - 6 * 60 * 1_000).toISOString() })
      .where(eq(paymentTable.id, debitOnly.creditOperationId));
    let closeHook: (() => Promise<void>) | null = null;
    const recoveryScheduler = schedulerModule.startSlurpPaymentRecoveryScheduler({
      db,
      addHook: (_name, hook) => {
        closeHook = hook;
      },
    });
    await recoveryScheduler.pollNow();
    await recoveryScheduler.stop();
    assert.ok(closeHook, "payment recovery scheduler must register host shutdown cleanup");
    assert.equal((await slurp.getWallet("viewer")).coins, 1_000);
    assert.equal(
      (await slurp.getWallet("viewer")).ledger.filter((entry) => entry.id === `${debitOnly.creditOperationId}:refund`)
        .length,
      1,
    );
    assert.equal((await rowById<any>(paymentTable, debitOnly.creditOperationId)).status, "failed");

    // Compensation reverses the exact persisted 37% credit even after settings change to 90%.
    await slurp.updateSettings({ walletCreatorRevenueSharePercent: 37 });
    const exact: Payment = {
      viewerAccountId: "viewer",
      creatorAccountId: "creator",
      price: 99,
      note: "profile tip",
      creditOperationId: "profile-tip:exact",
    };
    assert.equal(
      await messagesModule.claimSlurpPaymentIntentForDatabase(db, exact, exact.creditOperationId),
      "claimed",
    );
    assert.ok(await slurp.tipCreator("viewer", "creator", 99, exact.creditOperationId));
    await messagesModule.settleSlurpPaymentIntentForDatabase(
      db,
      exact.creditOperationId,
      "creator",
      exact.creditOperationId,
    );
    await slurp.updateSettings({ walletCreatorRevenueSharePercent: 90 });
    await messagesModule.compensateSlurpPaymentForDatabase(db, exact, new Error("fixture"), exact.creditOperationId);
    assert.equal((await slurp.getEarnings("creator")).coins, 0);
    assert.equal(
      (await slurp.getEarnings("creator")).ledger.find((entry) => entry.id === `${exact.creditOperationId}:reverse`)
        ?.amount,
      -36,
    );
    for (let index = 0; index < 65; index += 1)
      await slurp.creditCreatorIncome("creator", 2, "commission", `later-income:${index}`);
    for (let index = 0; index < 65; index += 1)
      await slurp.refundCoins("viewer", 1, "later activity", `later-wallet-credit:${index}`);
    assert.equal(await slurp.getCreatorIncomeOperationAmount("creator", exact.creditOperationId), 36);
    assert.equal(
      (await slurp.getWallet("viewer")).ledger.some((entry) => entry.id === exact.creditOperationId),
      false,
    );
    assert.equal(await slurp.hasWalletSpendOperation("viewer", exact.creditOperationId), true);
    assert.equal(await slurp.reverseCreatorIncome("creator", 36, "retry", `${exact.creditOperationId}:reverse`), true);
    const coinsBeforeRetry = (await slurp.getWallet("viewer")).coins;
    await messagesModule.compensateSlurpPaymentForDatabase(db, exact, new Error("retry"), exact.creditOperationId);
    const walletAfterRetry = await slurp.getWallet("viewer");
    assert.equal(walletAfterRetry.coins, coinsBeforeRetry);
    assert.equal(walletAfterRetry.receipts[`${exact.creditOperationId}:refund`]?.amount, 99);

    // A restart after the profile transfer settles the intent and applies effects once.
    await slurp.updateSettings({ walletCreatorRevenueSharePercent: 40 });
    const profile: Payment = {
      viewerAccountId: "viewer",
      creatorAccountId: "creator",
      price: 50,
      note: "profile tip",
      creditOperationId: "profile-tip:restart",
    };
    assert.equal(
      await messagesModule.claimSlurpPaymentIntentForDatabase(db, profile, profile.creditOperationId),
      "claimed",
    );
    assert.ok(await slurp.tipCreator("viewer", "creator", 50, profile.creditOperationId));
    await db
      .update(paymentTable)
      .set({ updatedAt: new Date(Date.now() - 6 * 60 * 1_000).toISOString() })
      .where(eq(paymentTable.id, profile.creditOperationId));
    db = await restartDb();
    slurp = storageModule.createSlurpStorage(db);
    messages = messagesModule.createSlurpMessagesStorage(db);
    await messages.recoverPendingPayments();
    await messages.recoverPendingPayments();
    assert.equal((await rowById<any>(paymentTable, profile.creditOperationId)).status, "settled");
    assert.equal(
      (await rows<any>(eventTable)).filter((event) => event.operationId === `${profile.creditOperationId}:event`)
        .length,
      1,
    );
    assert.equal((await rows<any>(tieTable)).filter((tie) => tie.memberId === "viewer").length, 1);

    // A stable persisted DM tip message is completion proof after restart.
    const dm: Payment = {
      viewerAccountId: "viewer",
      creatorAccountId: "creator",
      price: 25,
      note: "direct-message tip",
      creditOperationId: "dm:restart:credit",
    };
    assert.equal(await messagesModule.claimSlurpPaymentIntentForDatabase(db, dm, dm.creditOperationId), "claimed");
    assert.ok(await slurp.tipCreator("viewer", "creator", 25, dm.creditOperationId));
    await db
      .update(paymentTable)
      .set({ updatedAt: new Date(Date.now() - 6 * 60 * 1_000).toISOString() })
      .where(eq(paymentTable.id, dm.creditOperationId));
    await db.insert(messageTable).values({
      id: "dm:restart:tip",
      threadId: "dm-thread",
      senderAccountId: "viewer",
      role: "viewer",
      kind: "tip",
      content: "thanks",
      imageUrl: null,
      imagePrompt: null,
      imageClaimToken: null,
      imageClaimLeaseUntil: null,
      price: "25",
      unlockedAt: null,
      readAt: null,
      metadata: JSON.stringify({ requestId: "restart", tipId: "restart" }),
      senderSnapshot: "{}",
      createdAt: timestamp,
    });
    db = await restartDb();
    slurp = storageModule.createSlurpStorage(db);
    messages = messagesModule.createSlurpMessagesStorage(db);
    await messages.recoverPendingPayments();
    await messages.recoverPendingPayments();
    assert.equal((await rowById<any>(paymentTable, dm.creditOperationId)).status, "settled");
    assert.equal(
      (await rows<any>(eventTable)).filter((event) => event.operationId === `${dm.creditOperationId}:event`).length,
      1,
    );
    assert.equal(
      (await slurp.getWallet("viewer")).ledger.some((entry) => entry.id === `${dm.creditOperationId}:refund`),
      false,
    );

    // Post-accept terminal commission states settle recovery; the failed-accept marker does not.
    for (const fixture of [
      { id: "accepted", state: "accepted", cancellationId: null },
      { id: "delivered", state: "delivered", cancellationId: null },
      { id: "cancelled", state: "declined", cancellationId: "commission:cancelled:settlement" },
    ]) {
      const paymentId = `commission:${fixture.id}:accept`;
      await db.insert(paymentTable).values(paymentRow(paymentId, "commission", "charged"));
      await db
        .insert(commissionTable)
        .values(commissionRow(fixture.id, fixture.state, fixture.cancellationId, null, null));
    }
    await messages.recoverPendingPayments();
    for (const id of ["accepted", "delivered", "cancelled"])
      assert.equal((await rowById<any>(paymentTable, `commission:${id}:accept`)).status, "settled");
    await db.insert(paymentTable).values(paymentRow("commission:failed:accept", "commission", "charged"));
    await db
      .insert(commissionTable)
      .values(commissionRow("failed", "cancellation_pending", "commission:failed:accept", null, null));
    await messages.recoverPendingPayments();
    assert.notEqual((await rowById<any>(paymentTable, "commission:failed:accept")).status, "settled");

    // A fresh foreign delivery lease blocks sending. A stale lease is reclaimed and the stable
    // delivery message remains singular across retries.
    await db
      .insert(commissionTable)
      .values(commissionRow("fresh", "accepted", null, "worker-a", new Date().toISOString()));
    assert.equal((await messages.deliverCommission("fresh", "fresh delivery"))?.state, "accepted");
    assert.equal(
      (await rows<any>(messageTable)).some((message) => message.id === "commission:fresh:delivery"),
      false,
    );
    await db
      .insert(commissionTable)
      .values(
        commissionRow("stale", "accepted", null, "worker-a", new Date(Date.now() - 6 * 60 * 1_000).toISOString()),
      );
    assert.equal((await messages.deliverCommission("stale", "stale delivery"))?.state, "delivered");
    await messages.deliverCommission("stale", "duplicate delivery");
    assert.equal(
      (await rows<any>(messageTable)).filter((message) => message.id === "commission:stale:delivery").length,
      1,
    );

    console.log("slurp Phase 1 file-native durability regression passed");
  } finally {
    if (db) await db._fileStore.close().catch(() => undefined);
    await Promise.all([
      rm(overlayRoot, { recursive: true, force: true }),
      rm(dataDir, { recursive: true, force: true }),
    ]);
  }
}

void main();
