/**
 * 7c messages review fixes (REVIEW-MSG M-002 …). The rules run on real inputs; a few wiring checks
 * at the end keep the guards on the paths that use them (the storage layer needs the Engine DB).
 */
import assert from "node:assert/strict";
import {
  newSlurpCouple,
  slurpCloseCouplePage,
  slurpClosedCouplePageIds,
  slurpIsCouplePage,
  slurpOpenCouplePage,
  SLURP_COUPLE_PAGE_SOURCE,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import {
  slurpCommissionDeliveryDelayMs,
  slurpExpiredRequestIds,
  slurpUnscheduledCommissionDeliveries,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging.ts";
import { slurpAssistChatContext } from "../packages/slurp2/src/engine/packages/client/src/slp/features/messages/slp-assist-chat-context.ts";
import { buildSlpAssistTextMessages } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/assist/slp-assist-prompt.ts";
import { slurpAudienceSubscriptionDecision } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-audience-subscription.ts";
import {
  isFollowUpOverdue,
  SLURP_FOLLOW_UP_OVERDUE_MS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-follow-up.ts";
import {
  slurpChatLanguage,
  slurpCommissionDeliveryNote,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-world-copy.ts";
import {
  SLURP_DM_UNNAMED_FAN,
  slurpDmRoleHeader,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-roles.ts";
import { slurp2Source } from "./slurp2-source.ts";

const root = new URL("../packages/slurp2/src/engine/packages/", import.meta.url);
const server = (path: string) => slurp2Source(new URL(`server/src/slp/${path}`, root));
const client = (path: string) => slurp2Source(new URL(`client/src/slp/${path}`, root));
const T0 = Date.parse("2026-09-28T08:00:00.000Z");
const at = (days: number) => new Date(T0 + days * 86_400_000);

// M-002 / M-003. A shared couple page is not a person, and a closed one takes nothing new.
{
  assert.equal(slurpIsCouplePage({ sourceEntityId: `${SLURP_COUPLE_PAGE_SOURCE}c1` }), true);
  assert.equal(slurpIsCouplePage({ sourceEntityId: "character-42" }), false);
  assert.equal(slurpIsCouplePage({ sourceEntityId: null }), false);
  assert.equal(slurpIsCouplePage({}), false);

  const together = newSlurpCouple("c1", "mira", "kai", "player", at(0).toISOString(), "together");
  const open = slurpOpenCouplePage(together, "page-mk", at(1));
  const other = slurpOpenCouplePage(
    newSlurpCouple("c2", "zoe", "sam", "world", at(0).toISOString(), "together"),
    "page-zs",
    at(1),
  );
  assert.deepEqual([...slurpClosedCouplePageIds([open, other])], [], "open pages are not closed");
  const closed = slurpCloseCouplePage(open, at(5));
  assert.deepEqual([...slurpClosedCouplePageIds([closed, other])], ["page-mk"]);
  // "Open a page" reopens the same page: it takes subscribers again.
  const reopened = slurpOpenCouplePage(closed, "page-mk", at(9));
  assert.deepEqual([...slurpClosedCouplePageIds([reopened, other])], []);
  assert.deepEqual([...slurpClosedCouplePageIds([together])], [], "a couple with no page has none");
}

// M-002 wiring: every chat into a couple page stops in openThread (send, tip, share, commission,
// AI fan opener all open through it); the new-chat list and payment thanks leave the page out;
// a closed page refuses tips, subscriptions and unlocks; the profile's Message asks which partner.
{
  const base = server("data/messages/slp-messages-storage-base.ts");
  assert.match(base, /if \(slurpIsCouplePage\(creator\)\) return \{ status: "closed", reason: "couple_page" \};/u);
  const send = server("features/messages/slp-messages-send-routes.ts");
  assert.equal(send.match(/slurpClosedThreadText\((opened|sent)\)/gu)?.length, 3, "send, tip and share explain it");
  assert.match(
    server("features/messages/slp-messages-thread-routes.ts"),
    /filter\(\s*\(profile: \{ id: string \}\) => !couplePages\.has\(profile\.id\),?\s*\)/u,
  );
  assert.match(server("features/economy/slp-payment-reaction.ts"), /if \(slurpIsCouplePage\(creator\)\) return;/u);
  const wallet = server("features/economy/slp-wallet-routes.ts");
  assert.equal(wallet.match(/if \(await closedPage\([^)]*\)\) return reply\.code\(409\)/gu)?.length, 4);
  assert.match(
    client("app/screens/SlpScreenProfile.tsx"),
    /couplePage \? \{ \.\.\.model, onOpenMessages: \(\) => setCoupleWriteOpen\(true\) \}/u,
  );
  assert.match(client("features/projects/SlpCouples.tsx"), /export function SlpCouplePageWriteSheet/u);
}

// M-005. Paid commissions of automatic Creators always get a delivery time; the two stuck prod rows
// (accepted by an AI fan days ago, no delivery time) are due at once on the next tick.
{
  const now = new Date("2026-09-28T04:00:00.000Z");
  const row = (id: string, over: Partial<Parameters<typeof slurpUnscheduledCommissionDeliveries>[0][number]> = {}) => ({
    id,
    creatorAccountId: "sadie",
    state: "accepted",
    deliverAt: null,
    price: 34,
    brief: "a cozy sketch of you reading",
    updatedAt: "2026-09-26T11:20:00.000Z",
    ...over,
  });
  const automatic = new Set(["sadie", "jennifer"]);
  const rows = [
    row("B-hoIi"),
    row("GVO--g", { creatorAccountId: "jennifer", price: 65, updatedAt: "2026-09-27T18:05:00.000Z" }),
    row("hand-run", { creatorAccountId: "persona-page" }),
    row("scheduled", { deliverAt: "2026-09-28T04:20:00.000Z" }),
    row("delivered", { state: "delivered" }),
    row("quoted", { state: "quoted" }),
    // Just accepted by the player: the accept route may still be drawing it.
    row("fresh", { updatedAt: "2026-09-28T03:55:00.000Z" }),
    // Accepted 20 minutes ago by an AI fan: due at the accept + the usual pacing, not at once.
    row("recent", { updatedAt: "2026-09-28T03:40:00.000Z", price: 200, brief: "x".repeat(600) }),
  ];
  const repairs = slurpUnscheduledCommissionDeliveries(rows, automatic, now);
  assert.deepEqual(
    repairs.map((entry) => entry.id),
    ["B-hoIi", "GVO--g", "recent"],
  );
  assert.equal(repairs[0]!.deliverAt, now.toISOString(), "an old paid commission is due at once");
  assert.equal(repairs[1]!.deliverAt, now.toISOString());
  const recentDue =
    Date.parse("2026-09-28T03:40:00.000Z") + slurpCommissionDeliveryDelayMs({ price: 200, briefLength: 600 });
  assert.equal(repairs[2]!.deliverAt, new Date(recentDue).toISOString(), "the usual pacing, counted from the accept");
  assert.ok(recentDue > now.getTime());
  // Once scheduled it is never listed again.
  assert.deepEqual(
    slurpUnscheduledCommissionDeliveries(
      rows.map((entry) => ({
        ...entry,
        deliverAt: repairs.find((r) => r.id === entry.id)?.deliverAt ?? entry.deliverAt,
      })),
      automatic,
      now,
    ),
    [],
  );
  const upkeep = server("features/messages/slp-stuck-messages-service.ts");
  assert.match(upkeep, /slurpUnscheduledCommissionDeliveries\(\s*await messages\.listAcceptedCommissions\(\),/u);
  assert.match(
    upkeep,
    /scheduleCommissionDelivery\(repair\.id, \{ deliverAt: repair\.deliverAt, mediaPath: null \}\)/u,
  );
  assert.match(
    server("features/world/slp-world-operation.ts"),
    /await settleSlurpStuckMessages\(db, automatedCreatorIds, until\)/u,
    "on every world tick",
  );
  assert.match(
    server("features/messages/commissions/slp-commission-delivery-service.ts"),
    /if \(mediaPath\) \{/u,
    "a text-only delivery skips the picture",
  );
}

// M-004. "Help me write" in a DM sees the chat, from the right seat, in the chat's language.
{
  const msg = (role: "viewer" | "creator", content: string, over: Record<string, unknown> = {}) => ({
    role,
    kind: "text" as const,
    content,
    price: 0,
    metadata: {} as Record<string, unknown>,
    ...over,
  });
  const german = [
    msg("viewer", "Hey Jennifer, dein letzter Post war der Wahnsinn"),
    msg("creator", "Danke dir!! Freut mich total 🥹"),
    msg("viewer", "[paid 30 coins for a commission]", { metadata: { paymentReaction: "commission" } }),
    msg("viewer", "Kannst du mir was Exklusives schicken?"),
  ];
  const persona = slurpAssistChatContext({
    messages: german,
    seat: "persona",
    creatorName: "Jennifer Kipsch",
    viewerName: "Gunter",
    supportName: "Slurp Support",
  });
  assert.equal(
    persona,
    [
      "You write as Gunter to Jennifer Kipsch, a Creator on Slurp.",
      "The chat so far (newest last). The newest line is your own and has no answer yet: write a follow-up, in the language of the chat.",
      "Gunter: Hey Jennifer, dein letzter Post war der Wahnsinn",
      "Jennifer Kipsch: Danke dir!! Freut mich total 🥹",
      "(Gunter paid 30 coins for a commission)",
      "Gunter: Kannst du mir was Exklusives schicken?",
    ].join("\n"),
  );
  const creator = slurpAssistChatContext({
    messages: german,
    seat: "creator",
    creatorName: "Jennifer Kipsch",
    viewerName: "Gunter",
    supportName: "Slurp Support",
  });
  assert.match(
    creator,
    /^You write as Jennifer Kipsch, a Creator on Slurp, to Gunter\.\nThe chat so far \(newest last\)\. Answer the newest line/u,
  );
  // Support: its own lines carry the Support name; the Creator's newest line is answered as staff.
  const support = slurpAssistChatContext({
    messages: [
      msg("viewer", "Hi Mira, quick check-in from the Slurp team.", {
        metadata: { sceneSpeaker: "Pia from Slurp", supportVoice: true },
      }),
      msg("creator", "oh hi! all good, a bit tired tbh"),
    ],
    seat: "support",
    creatorName: "Mira Vale",
    viewerName: null,
    supportName: "Pia from Slurp",
  });
  assert.match(support, /^You write as Pia from Slurp, Slurp's own staff, to Mira Vale/u);
  assert.match(support, /Pia from Slurp: Hi Mira[\s\S]*Mira Vale: oh hi![\s\S]*$/u);
  assert.match(support, /Answer the newest line/u);
  // Only the newest 8 lines, and under the assist's context limit however long the chat is.
  const long = Array.from({ length: 30 }, (_, i) => msg(i % 2 ? "creator" : "viewer", `line ${i} ${"x".repeat(400)}`));
  const clipped = slurpAssistChatContext({
    messages: long,
    seat: "persona",
    creatorName: "Mira",
    viewerName: "Lena",
    supportName: "Slurp Support",
  });
  assert.ok(clipped.length <= 2000, `context fits: ${clipped.length}`);
  assert.match(clipped, /line 29/u);
  assert.doesNotMatch(clipped, /line 21 /u);
  assert.match(
    slurpAssistChatContext({
      messages: [],
      seat: "persona",
      creatorName: "Mira",
      viewerName: null,
      supportName: "Slurp Support",
    }),
    /^You write to Mira, a Creator on Slurp\.\nNothing has been said yet/u,
  );
  // The prompt: the chat reaches the model, and Support is never written as a fan.
  const [system, user] = buildSlpAssistTextMessages({
    mode: "write",
    field: "support",
    context: support,
    name: "Mira Vale",
  });
  assert.match(system!.content, /Write it as Slurp Support, Slurp's own staff team, to Mira Vale/u);
  assert.doesNotMatch(system!.content, /as a fan would/u);
  assert.match(user!.content, /# Nearby\nYou write as Pia from Slurp/u);
  const [dmSystem, dmUser] = buildSlpAssistTextMessages({
    mode: "write",
    field: "dm",
    context: persona,
    name: "Jennifer Kipsch",
  });
  assert.match(dmSystem!.content, /Use the language of the chat/u);
  assert.match(dmUser!.content, /Kannst du mir was Exklusives schicken\?/u);
}

// M-003. The audience pass: a closed shared page takes no new subscriber and renews nobody; a paid
// week still runs out as usual. The same fan on an open page would subscribe or renew.
{
  const day = new Date("2026-09-28T12:00:00.000Z");
  const fan = {
    memberId: "fan-1",
    creatorAccountId: "page-mk",
    stage: "follower" as const,
    spendTier: "whale" as const,
    weeklyBudget: 500,
    subConversionPerDay: 1,
    price: 20,
    paidThroughAt: null,
    renewChance: 1,
  };
  assert.equal(slurpAudienceSubscriptionDecision(fan, day), "subscribe", "control: an eager follower subscribes");
  assert.equal(slurpAudienceSubscriptionDecision({ ...fan, closed: true }, day), "none");
  const paidOut = { ...fan, stage: "subscriber" as const, paidThroughAt: "2026-09-27T12:00:00.000Z" };
  assert.equal(slurpAudienceSubscriptionDecision(paidOut, day), "renew", "control: a paid-out subscriber renews");
  assert.equal(slurpAudienceSubscriptionDecision({ ...paidOut, closed: true }, day), "lapse");
  const stillPaid = { ...paidOut, paidThroughAt: "2026-09-30T12:00:00.000Z", closed: true };
  assert.equal(slurpAudienceSubscriptionDecision(stillPaid, day), "none", "what was paid runs out as usual");
  assert.match(server("features/world/slp-world-operation.ts"), /closed: closedPages\.has\(account\.id\)/u);
}

// M-007. The prod row: promised 2026-09-25 22:35, still moved forward on 09-28 03:47. Two days after
// the promise, the next postpone drops it instead.
{
  const promise = { createdAt: "2026-09-25T22:35:00.000Z" };
  assert.equal(isFollowUpOverdue(promise, new Date("2026-09-26T09:00:00.000Z")), false, "a normal wait");
  assert.equal(isFollowUpOverdue(promise, new Date("2026-09-27T22:34:00.000Z")), false);
  assert.equal(isFollowUpOverdue(promise, new Date("2026-09-28T03:47:00.000Z")), true, "the prod case ends");
  assert.equal(SLURP_FOLLOW_UP_OVERDUE_MS, 2 * 86_400_000);
  assert.equal(isFollowUpOverdue({}, new Date()), false, "no date, no guess");
  const storage = server("data/messages/slp-messages-storage-follow-ups.ts");
  // Pulse + E (user, 2026-09-28): follow-ups are promises. The two-day cap now ends only an opener
  // nobody asked for; a promise waits and is delivered late (tests/slurp2-pulse-e.regression.ts).
  assert.match(
    storage,
    /async postponeScheduledFollowUp\([^)]*\): Promise<void> \{\s+const row = [^\n]+\n\s+const overdue = Boolean\(\s*row && slurpFollowUpExpires\(\{ type: String\(row\.type\), createdAt: String\(row\.createdAt\) \}\),?\s*\);[\s\S]{0,200}overdue\s+\? \{ status: "cancelled"/u,
    "every postpone path goes through the cap",
  );
}

// M-009. The six prod requests (AI fans to AI Creators, no reply owed, oldest 2026-09-23) expire;
// a persona's request still owed a reply, a hand-run Creator's request and a fresh one stay.
{
  const now = new Date("2026-09-28T04:00:00.000Z");
  const request = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    creatorAccountId: "sadie",
    state: "request",
    needsReply: false,
    lastMessageAt: "2026-09-22T20:00:00.000Z",
    ...over,
  });
  const threads = [
    request("us73Qf"),
    request("PnbaxR", { lastMessageAt: "2026-09-22T23:00:00.000Z" }),
    request("owed", { needsReply: true }),
    request("hand-run", { creatorAccountId: "persona-page" }),
    request("fresh", { lastMessageAt: "2026-09-26T10:00:00.000Z" }),
    request("active", { state: "active" }),
  ];
  assert.deepEqual(slurpExpiredRequestIds(threads, new Set(["sadie"]), now), ["us73Qf", "PnbaxR"]);
  const upkeep = server("features/messages/slp-stuck-messages-service.ts");
  assert.match(
    upkeep,
    /resolveRequest\(id, "decline"\);\s+await messages\.markRead\(id, "creator"\);/u,
    "declined and read, no model call",
  );
  assert.doesNotMatch(upkeep, /generate|replyToSlurpMessage/u);
}

// M-008. The delivery note speaks the chat's language (the prod thread F1nLxs is German).
{
  const german = [
    "Hey, dein letzter Post war der Wahnsinn",
    "Danke dir!! Freut mich total",
    "Kannst du mir was Exklusives schicken?",
  ];
  assert.equal(slurpChatLanguage(german), "de");
  assert.equal(slurpChatLanguage(["hey! loved the rooftop set", "thank you, that means a lot"]), "en");
  assert.equal(slurpChatLanguage(["안녕하세요! 사진 너무 좋아요"]), "ko");
  assert.equal(slurpChatLanguage(["cześć, to jest super", "dzięki bardzo, cieszę się"]), "pl");
  assert.equal(slurpChatLanguage([]), "en", "nothing said: English");
  assert.equal(slurpChatLanguage(["ok 👍", "lol"]), "en", "too little to tell: English");
  const note = slurpCommissionDeliveryNote("GVO--g", "de");
  assert.ok(
    ["ich", "dir", "es", "danke", "bitte", "hier", "fertig", "gehört"].some((word) =>
      note.split(/\W+/u).includes(word),
    ),
    `a German note: ${note}`,
  );
  assert.equal(slurpCommissionDeliveryNote("GVO--g", "de"), note, "the same piece, the same note");
  assert.equal(
    slurpCommissionDeliveryNote("GVO--g"),
    slurpCommissionDeliveryNote("GVO--g", "en"),
    "English by default",
  );
  for (const language of ["en", "de", "ko", "pl"] as const)
    for (let i = 0; i < 20; i++) assert.ok(slurpCommissionDeliveryNote(`seed-${i}`, language).length > 10);
  assert.match(
    server("features/messages/commissions/slp-commission-delivery-service.ts"),
    /slurpCommissionDeliveryNote\(commission\.id, language\)/u,
  );
  assert.match(server("features/world/slp-pending-text-service.ts"), /keep the note's language/u);
}

// M-010. A fan with no name: every sentence of the header still reads right.
{
  const line = (role: "viewer" | "creator", content: string) => ({
    id: `${role}-${content.length}`,
    role,
    kind: "text",
    content,
    price: 0,
    unlockedAt: null,
    metadata: {},
    createdAt: "2026-09-28T04:00:00.000Z",
  });
  const header = slurpDmRoleHeader({
    writer: "creator",
    creator: { name: "Mira Vale", handle: "miravale" },
    viewer: { name: SLURP_DM_UNNAMED_FAN, handle: "" },
    openedBy: "viewer",
    requestFee: 10,
    history: [line("viewer", "hi!")],
  });
  assert.match(header, /The person writing to you is a fan\./u);
  assert.match(header, /This fan wrote to you first and paid 10 coins/u);
  assert.doesNotMatch(header, /(^|[.!?]\s+|\n)this fan/u, "no sentence starts lower-case");
  assert.doesNotMatch(header, /this fan is a fan/iu);
  // A named fan is unchanged.
  const named = slurpDmRoleHeader({
    writer: "creator",
    creator: { name: "Mira Vale", handle: "miravale" },
    viewer: { name: "Lena Hart", handle: "lenahart" },
    openedBy: "viewer",
    history: [line("viewer", "hi!")],
  });
  assert.match(named, /Lena Hart is a fan writing to you\.[\s\S]*Lena Hart wrote to you first\./u);
  assert.match(server("features/messages/slp-message-generation-service.ts"), /\|\| SLURP_DM_UNNAMED_FAN/u);
}

console.log("slurp2 7c fixes regression passed");
