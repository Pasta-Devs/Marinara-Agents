import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const storage = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
const route = readFileSync("packages/slurp2/src/engine/packages/server/src/routes/slurp-messages.routes.ts", "utf8");
const profileRoute = readFileSync("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
const client = readFileSync("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx", "utf8");
const slurpClientHook = readFileSync("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");
const slurp = readFileSync("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
const packageSchema = readFileSync("packages/slurp2/src/engine/packages/server/src/db/schema/slurp.ts", "utf8");

// A paid request must compensate both sides when income or notification fails after the debit.
assert.match(
  storage,
  /class SlurpCompensationError[\s\S]*?originalFailure[\s\S]*?compensationFailures[\s\S]*?Payment compensation failed/u,
);
assert.match(
  storage,
  /if \(!current\.refundedAt\)[\s\S]*?refundCoins\([\s\S]*?refundedAt[\s\S]*?current = \([\s\S]*?slurpPaymentCompensations[\s\S]*?if \(reversal > 0 && !current\?\.reversedAt\)[\s\S]*?reverseCreatorIncome[\s\S]*?if \(!reversed\) throw new Error[\s\S]*?reversedAt[\s\S]*?throw compensationError/u,
  "compensation failures must remain visible to the caller",
);
assert.match(
  storage,
  /isFileUniqueConstraintError\(error, "slurp2_payment_compensations", \["id"\]\)/u,
  "concurrent compensation claims must reuse the durable row",
);
assert.match(storage, /refundCoins\([^,]+, [^,]+, [^,]+, `\$\{compensationId\}:refund`\)/u);
assert.match(storage, /reverseCreatorIncome\([\s\S]*?`\$\{compensationId\}:reverse`/u);
assert.doesNotMatch(storage, /payment\.creditOperationId \?\?/u, "compensation must not invent a fallback credit ID");
const compensation = storage.slice(
  storage.indexOf("async function compensateSlurpPayment("),
  storage.indexOf("export async function compensateSlurpPaymentForDatabase"),
);
assert.match(
  compensation,
  /current\.creditedAmount[\s\S]*?getCreatorIncomeOperationAmount[\s\S]*?creditedAmount: String\(creditedAmount\)[\s\S]*?reverseCreatorIncome\([\s\S]*?reversal/u,
  "compensation must persist and reverse the exact credited earnings amount",
);
assert.doesNotMatch(
  compensation,
  /walletCreatorRevenueSharePercent|slurpCreatorRevenueShare/u,
  "compensation must not recalculate a historical credit from current settings",
);
assert.ok(
  compensation.indexOf("await slurp.refundCoins") < compensation.indexOf("current.creditedAmount"),
  "a proven viewer debit must be refunded before Creator reversal evidence is resolved",
);
assert.match(
  compensation,
  /if \(!current\.refundedAt\)[\s\S]*?`\$\{compensationId\}:refund`[\s\S]*?status: "partial"/u,
  "refund progress must persist independently so reversal retries cannot refund twice",
);
for (const copy of [storage]) {
  const compensationFlow = copy.slice(
    copy.indexOf("async function compensateSlurpPayment("),
    copy.indexOf("async function persistSlurpPaymentCreditedAmount"),
  );
  assert.ok(compensationFlow.indexOf("await slurp.refundCoins") < compensationFlow.indexOf("current.creditedAmount"));
  assert.match(compensationFlow, /if \(!current\.refundedAt\)[\s\S]*?status: "partial"/u);
}
assert.match(
  compensation,
  /creditedAmount === null[\s\S]*?Matching creator income credit amount was not found/u,
  "legacy compensation without credit proof must fail closed",
);
for (const copy of [storage]) {
  const commissionAcceptance = copy.slice(
    copy.indexOf("async acceptCommissionUnlocked"),
    copy.indexOf("\n    /**", copy.indexOf("async acceptCommissionUnlocked")),
  );
  const recovery =
    copy.match(
      /async function recoverChargingSlurpPayment[\s\S]*?\n\}\n\n(?:async )?function (?:completeSlurpPaymentIntent|queueCommissionOperation)/u,
    )?.[0] ?? "";
  assert.match(
    recovery,
    /Date\.parse\(String\(row\.updatedAt\)\)[\s\S]*?const spendOperationId = String\(row\.id\)[\s\S]*?hasWalletSpendOperation\(String\(row\.viewerAccountId\), spendOperationId\)[\s\S]*?set\(\{ status: "charged"/u,
    "stale charging recovery must mark charged only after ledger proof",
  );
  assert.match(
    recovery,
    /no debit proof[\s\S]*?reset for retry/u,
    "unknown debit outcomes must reset for retry without a refund",
  );
  assert.match(recovery, /status: "created", claimToken: null/u);
  assert.match(recovery, /eq\(slurpPaymentCompensations\.status, "charging"\)/u);
  assert.match(recovery, /eq\(slurpPaymentCompensations\.claimToken, row\.claimToken\)/u);
  assert.doesNotMatch(recovery, /await slurp\.(spendCoins|refundCoins)\(/u, "stale recovery must not debit or refund");
  assert.match(
    copy,
    /eq\(slurpPaymentCompensations\.status, "charging"\)[\s\S]*?eq\(slurpPaymentCompensations\.status, "charged"\)/u,
    "stale charging intents must be included in durable recovery",
  );
  assert.match(
    copy,
    /paymentIntentClaims[\s\S]*?existing\.status === "charged"[\s\S]*?existing\.status === "settled"[\s\S]*?status !== "created"[\s\S]*?status: "charging"[\s\S]*?spendCoins/u,
    "existing payment intents must be durably claimed before either debit path",
  );
  assert.match(
    copy,
    /const claimToken = newId\(\)[\s\S]*?status: "charging", claimToken[\s\S]*?eq\(slurpPaymentCompensations\.claimToken, claimToken\)/u,
    "the charging claim must have a durable owner token",
  );
  assert.match(
    copy,
    /messageRequestId[\s\S]*?paymentIntent === "unpayable"[\s\S]*?spendCoins\([\s\S]*?messageRequestId[\s\S]*?resetSlurpPaymentIntentAfterInsufficientFunds\(slurp, messageRequestId\)/u,
    "a failed message request must reset its claim for a later retry",
  );
  assert.match(
    copy,
    /messageRequestId[\s\S]*?createSlurpPaymentIntent\([\s\S]*?message-request/u,
    "message request payment intents must use the recoverable durable path",
  );
  assert.match(
    copy,
    /const raced = await storage\.getThread[\s\S]*?paymentIntent\?\.status === "charged"[\s\S]*?paymentIntent\?\.status === "settled"[\s\S]*?return \{ status: "ok", thread: raced \}[\s\S]*?chargedByThisCall && !raced/u,
    "a duplicate thread race must keep a completed request payment and compensate only this call's charge when no thread exists",
  );
  assert.match(
    copy,
    /paymentId[\s\S]*?paymentIntent === "unpayable"[\s\S]*?spendCoins\([\s\S]*?paymentId[\s\S]*?resetSlurpPaymentIntentAfterInsufficientFunds\(slurp, paymentId\)/u,
    "a failed PPV unlock must reset its claim for a later retry",
  );
  assert.match(
    copy,
    /paymentId[\s\S]*?createSlurpPaymentIntent\([\s\S]*?PPV unlock/u,
    "PPV payment intents must use the recoverable durable path",
  );
  assert.match(
    commissionAcceptance,
    /const paymentId = `commission:\$\{id\}:accept`[\s\S]*?spendCoins\([\s\S]*?paymentId[\s\S]*?\)[\s\S]*?completeSlurpPaymentIntent\(slurp, paymentId\)/u,
    "commission acceptance must settle its stable payment intent after the accepted state is stored",
  );
  assert.match(
    copy,
    /resetSlurpPaymentIntentAfterInsufficientFunds[\s\S]*?status: "created", claimToken: null/u,
    "insufficient-funds reset must clear the durable claim without refunding",
  );
  assert.match(
    copy,
    /existing\.status === "declined"[\s\S]*?status: "created", claimToken: null[\s\S]*?status !== "created"/u,
    "intents declined by the old insufficient-funds path must be retryable",
  );
  assert.doesNotMatch(copy, /payment\.creditOperationId \?\?/u, "compensation must not invent a fallback credit ID");
  assert.match(copy, /messageRequestCreditId[\s\S]*?creditCreatorIncome\([\s\S]*?messageRequestCreditId/u);
  assert.match(
    copy,
    /messageRequestCreditId[\s\S]*?note: "failed message request"[\s\S]*?creditOperationId: messageRequestCreditId/u,
  );
  assert.match(
    copy,
    /const creditOperationId = `message:\$\{messageId\}:ppv`[\s\S]*?creditCreatorIncome\([\s\S]*?(?:creditOperationId|`message:\$\{messageId\}:ppv`)[\s\S]*?note: "failed PPV unlock"[\s\S]*?creditOperationId/u,
  );
  assert.match(
    copy,
    /creditCreatorIncome\([\s\S]*?`commission:\$\{id\}:audience`/u,
    "audience settlement must use a stable credit ID",
  );
  assert.match(
    copy,
    /creditCreatorIncome\([\s\S]*?`commission:\$\{id\}:accept:credit`[\s\S]*?note: "failed commission accept"[\s\S]*?creditOperationId: `commission:\$\{id\}:accept:credit`/u,
  );
  assert.match(copy, /note: "cancelled commission"[\s\S]*?creditOperationId: `commission:\$\{id\}:accept:credit`/u);
  assert.match(
    copy,
    /note: "failed commission delivery"[\s\S]*?creditOperationId: `commission:\$\{id\}:accept:credit`/u,
  );
  assert.match(
    copy,
    /tipOperationId[\s\S]*?tipCreator\([\s\S]*?tipOperationId[\s\S]*?creditOperationId: tipOperationId/u,
  );
}
for (const copy of [storage]) {
  assert.match(
    copy,
    /deliveryClaimToken = newId\(\)[\s\S]*?deliveryClaimedAt[\s\S]*?Date\.now\(\) - 5 \* 60 \* 1000/u,
    "delivery claims must have a unique owner and five-minute lease",
  );
  assert.match(
    copy,
    /previousClaim[\s\S]*?where\(and\([\s\S]*?previousClaim[\s\S]*?owned\?\.deliveryClaimToken === deliveryClaimToken/u,
    "stale delivery claims must be reclaimed conditionally",
  );
}
assert.match(storage, /sendCreatorMessage\([\s\S]*?id: deliveryId/u);
assert.match(
  storage,
  /catch \(error\) \{[\s\S]*?getMessageById\(deliveryId\)[\s\S]*?state: "delivered"/u,
  "a delivery message persisted before a write failure must complete on retry",
);
assert.match(storage, /async quoteCommission\(id: string, price: number\)[\s\S]{0,180}?queueCommissionOperation\(id/u);
assert.match(storage, /async quoteCommissionUnlocked\(id: string, price: number\)/u);
assert.match(storage, /async acceptCommission\(id: string\)[\s\S]{0,320}?queueCommissionOperation\(id/u);
assert.match(
  storage,
  /async declineCommission\(id: string, by: "creator" \| "viewer"\)[\s\S]{0,320}?queueCommissionOperation\(id/u,
);
assert.match(storage, /async deliverCommission\([\s\S]{0,220}?queueCommissionOperation\(id/u);

// Only the viewer may cancel an accepted commission, and only when no future delivery is set.
assert.match(
  storage,
  /commission\.state === "accepted"[\s\S]*?by === "viewer"[\s\S]*?!commission\.deliverAt \|\| commission\.deliverAt <= new Date\(\)\.toISOString\(\)/u,
);
assert.match(
  storage,
  /note: "cancelled commission"[\s\S]*?new Error\("Commission cancellation requires payment compensation"\)/u,
);
assert.match(storage, /current\.deliveryId[\s\S]*?state: "cancellation_pending"[\s\S]*?deliverAt: null/u);
for (const copy of [storage]) {
  assert.match(
    copy,
    /current\.state === "cancellation_pending" && current\.cancellationId !== cancellationId[\s\S]*?pending\.cancellationId !== cancellationId/u,
    "a failed-accept marker must not be treated as viewer cancellation",
  );
  assert.match(
    copy,
    /cancellationId = `commission:\$\{id\}:settlement`[\s\S]*?completeSlurpPaymentIntent\(slurp, `commission:\$\{id\}:accept`\)[\s\S]*?compensateSlurpPayment/u,
    "viewer cancellation must settle the original acceptance intent before refund settlement",
  );
  assert.match(
    copy,
    /const deliveryId = `commission:\$\{id\}:delivery`[\s\S]*?completeSlurpPaymentIntent\(slurp, `commission:\$\{id\}:accept`\)[\s\S]*?let message/u,
    "delivery ownership must settle the original acceptance intent before sending",
  );
}
assert.match(
  storage,
  /state: "cancellation_pending"[\s\S]*?compensateSlurpPayment\([\s\S]*?state: "declined"/u,
  "the durable non-delivery claim must precede compensation and final state",
);
const cancellationStart = storage.indexOf("async declineCommissionUnlocked");
const cancellation = storage.slice(cancellationStart, storage.indexOf("/**", cancellationStart));
assert.match(cancellation, /note: "cancelled commission"[\s\S]*?new Error/u);
assert.match(
  cancellation,
  /id: `commission:\$\{(?:id|commission\.id)\}:cancellation-message`[\s\S]*?content: "The fan cancelled this commission\. The payment was refunded\."[\s\S]*?state: "declined"/u,
  "the cancellation message must use one stable ID and be durable before the terminal state update",
);
for (const copy of [storage]) {
  const pendingRecoveryStart = copy.indexOf("async recoverPendingPayments");
  const pendingRecovery = copy.slice(pendingRecoveryStart, copy.indexOf("async getThread", pendingRecoveryStart));
  assert.match(
    pendingRecovery,
    /id: `commission:\$\{commission\.id\}:cancellation-message`[\s\S]*?content: "The fan cancelled this commission\. The payment was refunded\."[\s\S]*?state: "declined"/u,
    "cancellation recovery must append the stable visible message before terminal state",
  );
}
assert.ok(
  cancellation.indexOf('new Error("Commission cancellation requires payment compensation")') <
    cancellation.indexOf('state: "declined"'),
  "cancellation must compensate before it marks the commission declined",
);
assert.match(
  route,
  /commission\.state === "accepted"[\s\S]*?isViewer[\s\S]*?!commission\.deliverAt \|\| commission\.deliverAt <= new Date\(\)\.toISOString\(\)/u,
);
assert.match(client, /commission\.state === "accepted"[\s\S]*?Cancel and refund/u);

// Renewal lapses use the existing unsubscribe path, which records the established fan-side lapsed event.
assert.match(slurp, /recordWalletActivity\(wallet, "renew", 0, at, creatorAccountId\)/u);
assert.match(
  slurp,
  /for \(const creatorAccountId of renewal\.lapsed\)[\s\S]*?unsubscribe\(viewerAccountId, creatorAccountId, true, true\)/u,
);
assert.match(slurp, /recordCreatorEvent\(creatorAccountId, "lapsed", \{ actorLabel: viewerAccountId \}\)/u);

// Small money fixes keep the existing kinds and payout rules.
assert.match(
  slurp,
  /creditEarningsNow\([\s\S]*?"tip",[\s\S]*?Math\.floor\(\(amount \* settings\.walletCreatorRevenueSharePercent\) \/ 100\)/u,
);
assert.match(
  slurp,
  /spend\(sender, "tip", amount, new Date\(\), creator\.handle, operationId, binding\)[\s\S]*?creditEarningsNow\([\s\S]*?operationId/u,
  "tip debits and creator credits must share the stable operation ID",
);
const tipCreator = slurp.slice(
  slurp.indexOf("async tipCreator("),
  slurp.indexOf("async spendCoins(", slurp.indexOf("async tipCreator(")),
);
const profileTipRoute = profileRoute.slice(
  profileRoute.indexOf('app.post("/noodler/accounts/:id/tip"'),
  profileRoute.indexOf('app.put("/noodler/accounts/:id/subscription-price"'),
);
assert.deepEqual(
  {
    tipCreatorDoesNotRefund: !/writeWallet\(viewerAccountId, sender\)/u.test(tipCreator),
    profileTipCompensatesOnce: (profileTipRoute.match(/compensateSlurpPaymentForDatabase\(/gu) ?? []).length === 1,
    profileTipCompensationUsesStableKey:
      /hasWalletSpendOperation\(viewer\.id, tipOperationId\)[\s\S]*?compensateSlurpPaymentForDatabase\([\s\S]*?tipOperationId,\s*\);/u.test(
        profileTipRoute,
      ),
    dmCompensatesEveryProvenCharge: [storage].every((copy) =>
      /let charged = false[\s\S]*?tipCreator\([^)]*tipOperationId\)[\s\S]*?charged = true[\s\S]*?appendMessage[\s\S]*?catch \(error\) \{[\s\S]*?charged \|\| \(await slurp\.hasWalletSpendOperation\(viewerAccountId, tipOperationId\)\)[\s\S]*?compensateSlurpPayment/u.test(
        copy.slice(
          copy.indexOf("async tipInThreadUnlocked"),
          copy.indexOf("async resolveRequest", copy.indexOf("async tipInThreadUnlocked")),
        ),
      ),
    ),
  },
  {
    tipCreatorDoesNotRefund: true,
    profileTipCompensatesOnce: true,
    profileTipCompensationUsesStableKey: true,
    dmCompensatesEveryProvenCharge: true,
  },
  "a failed direct-message tip must use durable compensation exactly once",
);
assert.match(
  profileTipRoute,
  /claimSlurpPaymentIntentForDatabase\([\s\S]*?note: "profile tip"[\s\S]*?creditOperationId: tipOperationId[\s\S]*?tipOperationId,[\s\S]*?tipCreator\(/u,
  "profile tips must persist and claim their stable payment intent before debit",
);
for (const copy of [storage]) {
  assert.match(
    copy,
    /existing\.viewerAccountId[\s\S]*?payment\.viewerAccountId[\s\S]*?existing\.creatorAccountId[\s\S]*?payment\.creatorAccountId[\s\S]*?existing\.amount[\s\S]*?payment\.price[\s\S]*?return "unpayable"/u,
    "a reused payment intent must remain bound to its original parties and amount",
  );
}
assert.match(
  profileTipRoute,
  /if \(!wallet\) \{[\s\S]*?resetSlurpPaymentIntentForDatabase\(app\.db, tipOperationId\)[\s\S]*?settleSlurpPaymentIntentForDatabase\(app\.db, tipOperationId, creatorAccountId, tipOperationId\)/u,
  "profile tips must reset an uncharged intent and settle a completed transfer",
);
assert.match(
  profileRoute,
  /requestId: z\.string\(\)\.trim\(\)\.min\(8\)\.max\(100\)\.optional\(\)[\s\S]*?const tipOperationId = `profile-tip:\$\{parsed\.data\.requestId \?\? req\.id\}`[\s\S]*?tipCreator\([\s\S]*?parsed\.data\.amount,[\s\S]*?tipOperationId/u,
  "profile tips must validate and pass the client request ID to tipCreator",
);
assert.match(
  profileRoute,
  /const tipOperationId = `profile-tip:\$\{parsed\.data\.requestId \?\? req\.id\}`/u,
  "profile tip retries must keep the same operation ID across HTTP request IDs",
);
assert.match(
  slurpClientHook,
  /useTipSlurpCreator[\s\S]*?requestId\?: string/u,
  "profile tip hook must accept an idempotency request ID",
);
assert.match(
  readFileSync("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8"),
  /tipCreator\.mutate\(\{[\s\S]*?requestId:[\s\S]*?crypto\.randomUUID\(\)/u,
  "profile tip actions must provide a client idempotency request ID",
);
assert.doesNotMatch(
  tipCreator,
  /recordCreatorEvent|advanceAudienceTie/u,
  "the shared tip transfer must not apply event or relationship effects before the business result is durable",
);
for (const copy of [storage]) {
  assert.match(
    copy,
    /async function applySlurpTipEffects[\s\S]*?operationId: `\$\{paymentId\}:event`[\s\S]*?advanceTie[\s\S]*?effectsAppliedAt: now\(\)/u,
    "tip effects must use a stable event ID and commit audience progress with their durable marker",
  );
}
assert.match(
  profileTipRoute,
  /settleSlurpPaymentIntentForDatabase\([\s\S]*?applySlurpTipEffectsForDatabase\(app\.db, tipOperationId\)/u,
  "profile tip effects must follow durable transfer settlement",
);
assert.match(storage, /stage: "regular"[\s\S]*?spent: commission\.price/u);
assert.match(
  route,
  /creator\.sourceKind === "persona"[\s\S]*?creator\.sourceEntityId === viewer\.id[\s\S]*?You cannot tip yourself/u,
);
assert.match(slurp, /reason === "messageRequest"[\s\S]*?\? "message"/u);

for (const field of [
  "deliverAt",
  "mediaPath",
  "cancellationId",
  "deliveryId",
  "deliveryClaimToken",
  "deliveryClaimedAt",
]) {
  assert.match(packageSchema, new RegExp(`export const slurpCommissions[\\s\\S]*${field}:`, "u"));
}
for (const field of ["note", "creditOperationId", "creditedAmount", "effectsAppliedAt"]) {
  assert.match(packageSchema, new RegExp(`export const slurpPaymentCompensations[\\s\\S]*${field}:`, "u"));
}
assert.match(storage, /async recoverPendingPayments\(\)[\s\S]*status, "charged"[\s\S]*status, "failed"/u);
assert.match(storage, /recoverPendingPayments\(\)/u);
for (const copy of [storage]) {
  assert.match(
    copy,
    /hasCompletedSlurpPaymentOperation[\s\S]*note === "message request"[\s\S]*slurpThreads[\s\S]*viewerAccountId[\s\S]*creatorAccountId/u,
    "completed message requests must be detected before charged compensation",
  );
  assert.match(
    copy,
    /hasCompletedSlurpPaymentOperation[\s\S]*note === "PPV unlock"[\s\S]*slurpMessages[\s\S]*unlockedAt/u,
    "completed PPV unlocks must be detected before charged compensation",
  );
  assert.match(
    copy,
    /note === "commission"[\s\S]*?state === "accepted"[\s\S]*?state === "delivered"[\s\S]*?state === "cancellation_pending"[\s\S]*?state === "declined"[\s\S]*?cancellationId === `commission:\$\{commissionId\}:settlement`/u,
    "all durable post-accept terminal paths must complete the original acceptance payment",
  );
  assert.match(
    copy,
    /note === "profile tip"[\s\S]*?row\.creditedAmount != null[\s\S]*?getCreatorIncomeOperationAmount/u,
    "profile-tip recovery must require stored or ledger-backed completion proof",
  );
  assert.match(
    copy,
    /note === "direct-message tip"[\s\S]*?paymentId\.startsWith\("dm:"\)[\s\S]*?slurpMessages[\s\S]*?messageId/u,
    "a persisted stable DM tip message must prove completed payment recovery",
  );
  assert.match(
    copy,
    /row\.status === "charged"[\s\S]*hasCompletedSlurpPaymentOperation\(db, slurp, row\)[\s\S]*completeSlurpPaymentIntent/u,
    "completed charged operations must settle without compensation",
  );
  assert.match(
    copy,
    /status: "created"[\s\S]*?spendCoins\([\s\S]*?resetSlurpPaymentIntentAfterInsufficientFunds[\s\S]*?insufficient_funds/u,
  );
  assert.match(
    copy,
    /where\(\s*or\([\s\S]*?eq\(slurpPaymentCompensations\.status, "charging"\)[\s\S]*?eq\(slurpPaymentCompensations\.status, "charged"\)[\s\S]*?eq\(slurpPaymentCompensations\.status, "failed"\)[\s\S]*?\)\)/u,
    "recovery must scan stale charging and pending compensation intents",
  );
  assert.doesNotMatch(
    copy.slice(copy.indexOf("async recoverPendingPayments")),
    /eq\(slurpPaymentCompensations\.status, "declined"\)/u,
    "recovery must exclude intents declined for insufficient funds",
  );
  assert.match(copy, /spendCoins\([\s\S]*?markSlurpPaymentIntentCharged\([\s\S]*?creditCreatorIncome/u);
}
for (const copy of [storage]) {
  const dmTip = copy.slice(
    copy.indexOf("async tipInThreadUnlocked"),
    copy.indexOf("async resolveRequest", copy.indexOf("async tipInThreadUnlocked")),
  );
  assert.match(
    dmTip,
    /createSlurpPaymentIntent\([\s\S]*?note: "direct-message tip"[\s\S]*?creditOperationId: tipOperationId[\s\S]*?tipOperationId,[\s\S]*?tipCreator\(/u,
    "DM tips must claim their durable intent before debit",
  );
  assert.match(
    dmTip,
    /tipCreator\([\s\S]*?markSlurpPaymentIntentCharged\(slurp, tipOperationId\)[\s\S]*?persistSlurpPaymentCreditedAmount\([\s\S]*?appendMessage\([\s\S]*?completeSlurpPaymentIntent\(slurp, tipOperationId\)[\s\S]*?applySlurpTipEffects\(slurp, tipOperationId\)/u,
    "DM tips must store exact credit, persist their message, settle, and only then apply relationship effects",
  );
  assert.doesNotMatch(dmTip, /tip-compensation/u, "DM compensation must reuse the stable payment intent");
}
for (const copy of [route]) {
  assert.match(
    copy,
    /const tipSchema = z\.object\([\s\S]*?requestId: z\.string\(\)\.trim\(\)\.min\(8\)\.max\(100\)\.optional\(\)[\s\S]*?messages\.tipInThread\([\s\S]*?parsed\.data\.requestId/u,
    "standalone DM tip routes must validate and forward the client request ID",
  );
}
assert.match(
  slurpClientHook,
  /useTipInSlurpThread[\s\S]*?requestId\?: string/u,
  "the standalone DM tip hook must accept a stable request ID",
);
assert.match(
  client,
  /tip\.mutateAsync\(\{[\s\S]*?requestId: crypto\.randomUUID\(\)/u,
  "standalone DM tip actions must generate a stable request ID",
);
assert.match(
  slurp,
  /getCreatorIncomeOperationAmount[\s\S]*?earnings\.receipts\[id\][\s\S]*?receipt\.amount > 0/u,
  "creator earnings lookup must expose the exact credited ledger amount",
);
for (const copy of [storage]) {
  assert.match(
    copy,
    /creditCreatorIncome\(creatorAccountId, feePaid[\s\S]*?persistSlurpPaymentCreditedAmount\([\s\S]*?messageRequestId/u,
  );
  assert.match(
    copy,
    /creditCreatorIncome\(thread\.creatorAccountId, price, "ppv"[\s\S]*?persistSlurpPaymentCreditedAmount\(slurp, paymentId/u,
  );
  assert.match(
    copy,
    /creditCreatorIncome\([\s\S]*?"commission"[\s\S]*?accept:credit[\s\S]*?persistSlurpPaymentCreditedAmount\([\s\S]*?paymentId/u,
  );
}
assert.match(
  storage,
  /acceptCommissionUnlocked[\s\S]*state: "cancellation_pending"[\s\S]*compensateSlurpPayment/u,
  "a failed accept must become non-payable before compensation retries",
);

console.log("slurp relationship Phase 1 regression passed");
