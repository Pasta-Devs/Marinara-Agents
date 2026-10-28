/**
 * Pulse + E (user, 2026-09-28). E: automatic Creators answer about one in four AI fans; follow-ups
 * are promises that wait, retry and arrive late with a sorry instead of being dropped. The rules run
 * on real inputs; wiring checks keep them on the paths that use them (storage needs the Engine DB).
 */
import assert from "node:assert/strict";
import {
  SLURP_AI_FAN_ANSWER_ONE_IN,
  slurpAnswersAiFan,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging.ts";
import {
  formatFollowUpContext,
  isFollowUpLate,
  slurpFailedFollowUpPatch,
  slurpFollowUpExpires,
  slurpFollowUpRetryAt,
  type ScheduledFollowUp,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-follow-up.ts";
import {
  SLURP_ACTIVITY_PRESETS,
  SLURP_PUBLISHING_PRESETS,
  slurpActivityPresetForSettings,
  slurpActivityPresetPatch,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/creator/slp-activity-presets.ts";
import { slurpSizedPostsPerDay } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.ts";
import {
  slurpPulseNext,
  slurpPulsePlayTasks,
  slurpUpcomingAnnualEvents,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/maintenance/slp-pulse.ts";
import {
  slpPulseAiToday,
  slpPulseComingUp,
  slpPulseNextTarget,
  slpPulseServerSection,
  slpPulseServerTarget,
  slpPulseSummaryCounts,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/chrome/slp-pulse-model.ts";
import {
  SLP_TASKS_MAX,
  SLP_TASKS_KEEP_MS,
  slpPutTask,
  slpStoredTasks,
} from "../packages/slurp2/src/engine/packages/client/src/slp/base/state/slp-task-list.ts";
import { slurp2Source } from "./slurp2-source.ts";

const root = new URL("../packages/slurp2/src/engine/packages/", import.meta.url);
const server = (path: string) => slurp2Source(new URL(`server/src/slp/${path}`, root));
const client = (path: string) => slurp2Source(new URL(`client/src/slp/${path}`, root));

// E1. About one AI fan in four is answered, the same one on every retry, text messages only.
{
  const ids = Array.from({ length: 4000 }, (_, index) => `msg-${index}`);
  const answered = ids.filter((id) => slurpAnswersAiFan({ id, kind: "text" })).length;
  assert.equal(SLURP_AI_FAN_ANSWER_ONE_IN, 4);
  assert.ok(answered > 850 && answered < 1150, `about 1 in 4 answered (${answered} of 4000)`);
  const picked = ids.find((id) => slurpAnswersAiFan({ id, kind: "text" }))!;
  assert.equal(slurpAnswersAiFan({ id: picked, kind: "text" }), true, "a retry gets the same answer");
  for (const kind of ["tip", "commission_brief", "post_preview", "ppv"])
    assert.equal(slurpAnswersAiFan({ id: picked, kind }), false, `${kind} has its own path`);

  const operation = server("features/messages/slp-message-operation.ts");
  assert.match(
    operation,
    // Merge L: the viewer comes from L's shared helper; "no persona, not Support" = it found none (changed on purpose).
    /const aiFanTrigger =\s+!listedViewer && !input\.operatorDraft && input\.background && creator/u,
    "only the unattended scheduler answers an AI fan",
  );
  // Decision 1 (Merge L + Pulse follow-ups): a fan the Creator answered keeps the conversation.
  const unpicked = ids.find((id) => !slurpAnswersAiFan({ id, kind: "text" }))!;
  assert.equal(slurpAnswersAiFan({ id: unpicked, kind: "text" }, true), true, "an answered fan keeps it");
  assert.equal(slurpAnswersAiFan({ id: picked, kind: "tip" }, true), false, "still text only");
  assert.match(
    operation,
    /slurpAnswersAiFan\(\s+aiFanTrigger,\s+\(await messagesStore\.listMessages\(thread\.id, 120\)\)\.some\(\s+\(message: SlurpMessage\) => message\.senderAccountId === thread\.creatorAccountId,/u,
    "answered = the Creator already wrote in this thread",
  );
  assert.match(
    operation,
    /const viewer = aiFan \? await resolveSlurpReplyViewer\(db, thread, creator, true\) : listedViewer;/u,
  );
  assert.match(operation, /!support &&\s+\/\/[^\n]+\n\s+!aiFan &&/u, "an AI fan gets words, never a picture");
  assert.match(operation, /if \(stored && aiFan\) await dropSlurpPendingText\(db, input\.triggerMessageId\)/u);
  // Inside the AI budget: an unattended answer is never a player send, so it claims the budget.
  assert.match(operation, /playerSend: input\.background !== true/u);
  // The rest keep expiring after five days (7c M-009, unchanged).
  assert.match(server("features/messages/slp-stuck-messages-service.ts"), /slurpExpiredRequestIds\(/u);
  // AI fans' commissions stay text-only.
  assert.match(
    server("features/messages/slp-stuck-messages-service.ts"),
    /scheduleCommissionDelivery\(repair\.id, \{ deliverAt: repair\.deliverAt, mediaPath: null \}\)/u,
  );
}

// E2. Follow-ups are promises: a wait never ends one; only an old opener nobody asked for ends.
{
  // Decision 2 (Merge L + Pulse follow-ups): the "writes first" switch drops openers only.
  assert.match(
    server("features/messages/slp-follow-up-scheduler-service.ts"),
    /if \(!messaging\.proactiveMessages && followUp\.type === "opener"\) \{\s+await messages\.cancelScheduledFollowUp/u,
  );
  const promised = "2026-09-25T22:35:00.000Z";
  const fiveDaysOn = new Date("2026-09-30T22:35:00.000Z");
  for (const type of ["reminder", "promise_delivery", "task_update", "check_in", "recurring"])
    assert.equal(slurpFollowUpExpires({ type, createdAt: promised }, fiveDaysOn), false, `${type} waits`);
  assert.equal(slurpFollowUpExpires({ type: "opener", createdAt: promised }, fiveDaysOn), true, "old opener ends");
  assert.equal(
    slurpFollowUpExpires({ type: "opener", createdAt: promised }, new Date("2026-09-26T10:00:00.000Z")),
    false,
    "a fresh opener waits",
  );

  // Late: more than two hours past the first due time.
  const due = "2026-09-28T20:00:00.000Z";
  assert.equal(isFollowUpLate(due, new Date("2026-09-28T21:30:00.000Z")), false, "a short wait is on time");
  assert.equal(isFollowUpLate(due, new Date("2026-09-29T07:00:00.000Z")), true, "the next morning is late");
  assert.equal(isFollowUpLate(undefined, new Date()), false, "no date, no guess");

  // Retry after a failure: 15 minutes at first, half the lateness later, never over 12 hours.
  const now = new Date("2026-09-28T20:00:00.000Z");
  const wait = (firstDueAt: string | undefined, at: Date) =>
    (Date.parse(slurpFollowUpRetryAt(firstDueAt, at)) - at.getTime()) / 60_000;
  assert.equal(wait(due, now), 15);
  assert.equal(wait(due, new Date("2026-09-29T02:00:00.000Z")), 180, "six hours late → three hours");
  assert.equal(wait(due, new Date("2026-10-05T20:00:00.000Z")), 720, "a week late → the 12 hour cap");
  assert.equal(wait(undefined, now), 15);

  // The late line is in the Creator's own voice; an on-time promise and an opener get none.
  const followUp: ScheduledFollowUp = {
    id: "f1",
    scheduledAt: due,
    type: "promise_delivery",
    reason: "the gym pic she promised",
    context: "",
  };
  assert.match(
    formatFollowUpContext(followUp, "a pic after the gym", true),
    /You are late with this\. Open with a short, casual sorry/u,
  );
  assert.doesNotMatch(formatFollowUpContext(followUp, "a pic after the gym", false), /late/u);
  assert.doesNotMatch(formatFollowUpContext({ ...followUp, type: "opener" }, undefined, true), /late/u);

  const storage = server("data/messages/slp-messages-storage-follow-ups.ts");
  assert.match(storage, /firstDueAt: followUp\.scheduledAt,\s+status: "pending"/u, "the first due time is kept");
  assert.match(storage, /firstDueAt: row\.firstDueAt \?\? row\.scheduledAt/u, "old rows use their due time");
  // 0.3.0 review: the failure update pins firstDueAt, so an old row (none stored) backs off too.
  assert.match(storage, /\.set\(\{\s+\.\.\.slurpFailedFollowUpPatch\(row, new Date\(timestamp\)\),/u);
  assert.match(storage, /firstDueAt: row\?\.firstDueAt \?\? row\?\.scheduledAt \?\? scheduledAt,/u, "postpone too");
  const opener = slurpFailedFollowUpPatch({ type: "opener", scheduledAt: due, firstDueAt: null }, now);
  assert.deepEqual(opener, { status: "failed", scheduledAt: due, firstDueAt: due }, "an opener fails for good");
  // A pre-0.3.0 promise failing on a dead connection for three days: the rows the storage writes.
  let row: { type: string; scheduledAt: string; firstDueAt: string | null } = {
    type: "promise_delivery",
    scheduledAt: due,
    firstDueAt: null,
  };
  let tries = 0;
  for (let at = new Date(due); at.getTime() < Date.parse(due) + 3 * 24 * 60 * 60_000; tries++) {
    const patch = slurpFailedFollowUpPatch(row, at);
    assert.equal(patch.status, "pending", "a promise is never given up");
    assert.equal(patch.firstDueAt, due, "the first due time stays put");
    row = { ...row, ...patch };
    at = new Date(row.scheduledAt);
  }
  assert.ok(tries < 20, `the retries back off to the 12 hour cap (${tries} tries in three days, not ~288)`);
  assert.equal(isFollowUpLate(row.firstDueAt ?? row.scheduledAt, new Date(row.scheduledAt)), true, "it says sorry");
  assert.doesNotMatch(storage, /failedBefore \? "failed"/u, "no more give-up after two failures");
  const scheduler = server("features/messages/slp-follow-up-scheduler-service.ts");
  assert.match(scheduler, /isFollowUpLate\(followUp\.firstDueAt \?\? followUp\.scheduledAt\)/u);
  // Dropped only when the thread is gone or closed (and the Creator's own "writes first" switch).
  assert.match(
    scheduler,
    /if \(!thread \|\| thread\.state !== "active"\) \{\s+await messages\.cancelScheduledFollowUp/u,
  );
  assert.match(slurp2Source(new URL("server/src/db/schema/slurp.ts", root)), /firstDueAt: text\("first_due_at"\),/u);
}

// Small items. "Posts per day" grows but never below 4; Publishing's fifth preset "Grows with Creators".
{
  assert.deepEqual(
    [0, 1, 2, 3, 8].map(slurpSizedPostsPerDay),
    [4, 4, 6, 8, 17],
    "never below 4, then about 2 more per Creator",
  );
  assert.deepEqual(
    SLURP_PUBLISHING_PRESETS,
    [...SLURP_ACTIVITY_PRESETS, "grows"],
    "five presets, onboarding keeps four",
  );
  assert.equal(SLURP_ACTIVITY_PRESETS.includes("grows"), false);
  // Picked while nothing is set by hand, even when the grown number equals a fixed preset.
  assert.equal(
    slurpActivityPresetForSettings({ autoPostingScheduleEnabled: true, postsPerDay: 4, postsPerDayCustom: false }),
    "grows",
  );
  assert.equal(
    slurpActivityPresetForSettings({ autoPostingScheduleEnabled: true, postsPerDay: 4, postsPerDayCustom: true }),
    "lively",
  );
  assert.equal(
    slurpActivityPresetForSettings({ autoPostingScheduleEnabled: true, postsPerDay: 5, postsPerDayCustom: true }),
    null,
  );
  assert.equal(
    slurpActivityPresetForSettings({ autoPostingScheduleEnabled: false, postsPerDay: 4, postsPerDayCustom: false }),
    "manual",
  );
  assert.deepEqual(slurpActivityPresetPatch("grows"), { autoPostingScheduleEnabled: true, postsPerDayCustom: false });
  // A fixed preset sends a number, which the server marks as the player's.
  assert.deepEqual(slurpActivityPresetPatch("lively"), { autoPostingScheduleEnabled: true, postsPerDay: 4 });
  const panel = client("features/feed/SlpPublishingPanel.tsx");
  assert.match(panel, /SLURP_PUBLISHING_PRESETS\.map/u);
  assert.doesNotMatch(panel, /data-slurp-posts-sizing/u, "the line under the presets is gone");
  const en = JSON.parse(client("locales/en.json")) as Record<string, string>;
  assert.equal(en["ui.slurp.settings.presets.grows"], "Grows with Creators");
  assert.ok(en["ui.slurp.settings.presets.growsDetail_other"]?.includes("{{count}}"));
}

// C. Pulse, server side: Stir plays are tasks; "Coming up" is one list by time.
{
  const now = new Date("2026-09-29T10:00:00.000Z");
  const plays = [
    {
      id: "p1",
      at: "2026-09-29T09:00:00.000Z",
      undone: false,
      steps: [
        { action: "write-post", input: { accountId: "mira" }, ok: true, error: null },
        { action: "set-up-couple", input: { aId: "mira", bId: "kai" }, ok: false, error: "Kai is busy." },
      ],
    },
    {
      id: "p2",
      at: "2026-09-29T08:00:00.000Z",
      undone: true,
      steps: [{ action: "add-idea", input: { accountId: "kai" }, ok: true, error: null }],
    },
    {
      id: "old",
      at: "2026-09-27T08:00:00.000Z",
      undone: false,
      steps: [{ action: "add-idea", input: {}, ok: true, error: null }],
    },
  ];
  const tasks = slurpPulsePlayTasks(plays, now);
  assert.deepEqual(
    tasks.map((task) => task.id),
    ["play:p1", "play:p2"],
    "only the last day",
  );
  assert.equal(tasks[0]!.status, "failed", "a failed step fails the play");
  assert.equal(tasks[0]!.detail, "Kai is busy.", "with the step's reason");
  assert.deepEqual(tasks[0]!.accountIds, ["mira", "kai"]);
  assert.deepEqual(tasks[0]!.progress, { completed: 1, total: 2 });
  assert.deepEqual(tasks[0]!.stirActions, ["write-post", "set-up-couple"]);
  assert.equal(tasks[1]!.status, "undone");

  const next = slurpPulseNext({
    now,
    slots: [
      { id: "s1", accountId: "mira", publishAt: "2026-09-29T12:00:00.000Z" },
      { id: "s0", accountId: "mira", publishAt: "2026-09-29T09:00:00.000Z" },
    ],
    replies: [{ threadId: "t1", creatorAccountId: "kai", viewerAccountId: "me", at: null }],
    followUps: [
      {
        id: "f1",
        creatorAccountId: "mira",
        viewerAccountId: "me",
        type: "promise_delivery",
        at: "2026-09-29T11:00:00.000Z",
        reason: "the gym pic",
      },
      {
        id: "f2",
        creatorAccountId: "kai",
        viewerAccountId: "me",
        type: "opener",
        at: "2026-09-29T15:00:00.000Z",
        reason: "",
      },
    ],
    fansAt: "2026-09-29T13:00:00.000Z",
    events: [{ id: "halloween", name: "Halloween", startsAt: "2026-10-31T00:00:00.000Z" }],
  });
  assert.deepEqual(
    next.map((entry) => `${entry.kind}@${entry.at.slice(11, 16)}`),
    ["reply@10:00", "promise@11:00", "post@12:00", "fans@13:00", "opener@15:00", "event@00:00"],
    "soonest first; a due reply is now; a past slot is dropped",
  );
  assert.equal(next[1]!.label, "the gym pic");
  assert.equal(slurpPulseNext({ now, slots: [], replies: [], followUps: [], fansAt: null, events: [] }, 3).length, 0);

  const upcoming = slurpUpcomingAnnualEvents(
    [
      { id: "halloween", name: "Halloween", enabled: true, activation: { kind: "annual", month: 10, day: 31 } },
      { id: "xmas", name: "Christmas", enabled: true, activation: { kind: "annual", month: 12, day: 24 } },
      { id: "off", name: "Off", enabled: false, activation: { kind: "annual", month: 10, day: 2 } },
      { id: "new-year", name: "New Year", enabled: true, activation: { kind: "annual", month: 1, day: 1 } },
    ],
    new Date("2026-10-20T10:00:00.000Z"),
  );
  assert.deepEqual(
    upcoming.map((event) => event.id),
    ["halloween"],
    "within two weeks, enabled only",
  );
  assert.deepEqual(
    slurpUpcomingAnnualEvents(
      [{ id: "new-year", name: "New Year", enabled: true, activation: { kind: "annual", month: 1, day: 1 } }],
      new Date("2026-12-25T10:00:00.000Z"),
    ).map((event) => event.startsAt),
    ["2027-01-01T00:00:00.000Z"],
    "next year's date across the year end",
  );

  const routes = server("features/maintenance/slp-maintenance-routes.ts");
  assert.match(routes, /return \{\s+tasks,\s+next,/u, "the tasks route sends Coming up");
  assert.match(
    routes,
    /path: "\/slurp\/stir\/play", body: \{ steps: failedSteps/u,
    "a failed play retries its failed steps only",
  );
  assert.match(routes, /path: "\/slurp\/auto-post\/refresh-targeted"/u);
  assert.match(routes, /path: "\/slurp\/first-posts\/enqueue"/u);
  assert.match(routes, /personaIds\.has\(thread\.viewerAccountId\)/u, "only the player's chats get a reply time");
  assert.match(server("features/audience/slp-fan-activity-operation.ts"), /nextRunAt:/u);
  assert.match(server("features/settings/slp-settings-routes.ts"), /callsPerDayLimit: budget\.callsPerDay,/u);
}

// C. Pulse, client side: sections, tap-through, AI use in tokens, Coming up.
{
  assert.equal(slpPulseServerSection("running", false), "running");
  assert.equal(slpPulseServerSection("queued", false), "queued");
  assert.equal(slpPulseServerSection("pending", false), "queued", "a follow-up waiting is queued");
  assert.equal(slpPulseServerSection("failed", true), "failed");
  assert.equal(slpPulseServerSection("abandoned", true), "failed");
  assert.equal(slpPulseServerSection("completed", true), "done");
  assert.equal(slpPulseServerSection("undone", true), "done");
  assert.equal(slpPulseServerSection("scheduled", false), "scheduled");

  const own = new Set(["me"]);
  assert.deepEqual(slpPulseServerTarget({ accountIds: ["mira"], postId: "p1" }, own), {
    accountId: "mira",
    postId: "p1",
  });
  assert.deepEqual(slpPulseServerTarget({ accountIds: ["mira"], viewerAccountId: "me" }, own), {
    chatCreatorId: "mira",
  });
  assert.deepEqual(
    slpPulseServerTarget({ accountIds: ["mira"], viewerAccountId: "fan-9" }, own),
    { accountId: "mira" },
    "an AI fan's chat is not opened",
  );
  assert.equal(slpPulseServerTarget({ accountIds: [] }, own), null);
  assert.deepEqual(
    slpPulseNextTarget({ id: "x", kind: "reply", at: "", accountIds: ["kai"], viewerAccountId: "me" }, own),
    { chatCreatorId: "kai" },
  );

  assert.equal(slpPulseAiToday(undefined), null);
  const today = slpPulseAiToday({
    callsToday: 22,
    callsPerDayLimit: 88,
    tokensPerCall: 3000,
    mode: "present",
    activeCreators: 8,
  })!;
  assert.deepEqual([today.usedTokens, today.limitTokens, today.share, today.off], [66_000, 264_000, 0.25, false]);
  assert.equal(slpPulseAiToday({ callsToday: 120, callsPerDayLimit: 88 })!.share, 1, "capped at full");
  assert.equal(slpPulseAiToday({ callsToday: 0, callsPerDayLimit: 0 })!.share, 1, "a zero limit reads as full");
  assert.equal(slpPulseAiToday({ callsToday: 3, mode: "off" })!.off, true);

  const merged = slpPulseComingUp(
    [{ id: "post:s1", kind: "post", at: "2026-09-29T12:00:00.000Z", accountIds: ["mira"] }],
    [
      { id: "prepared:a", publishAt: "2026-09-29T12:00:00.000Z", accountIds: ["mira"] },
      { id: "prepared:b", publishAt: "2026-09-29T11:00:00.000Z", accountIds: ["kai"] },
    ],
  );
  assert.deepEqual(
    merged.map((entry) => entry.id),
    ["prepared:b", "post:s1"],
    "a scheduled post the list has is not doubled",
  );
  assert.deepEqual(slpPulseSummaryCounts({ running: 1, queued: 0, failed: 2, done: 5, next: 3 }), [
    "running",
    "failed",
    "next",
  ]);

  const pulse = client("modules/chrome/SlpPulse.tsx");
  for (const section of ["running", "queued", "failed", "next", "done"])
    assert.match(pulse, new RegExp(`ui\\.slurp\\.pulse\\.sections\\.${section}`, "u"), `section ${section}`);
  assert.doesNotMatch(pulse, /useMutationState/u, "no nameless copies of every mutation");
  assert.match(pulse, /<PulseAiToday/u);
  const shell = client("modules/chrome/SlpShell.tsx");
  assert.match(shell, /const pulseOpen = useSlpTasks\(\(state\) => state\.pulseOpen\);/u);
  assert.match(
    client("app/screens/SlpHomeDestinations.tsx"),
    /onOpenPulse=\{openSlpPulse\}/u,
    "Stir's See all opens Pulse",
  );
  assert.match(client("app/SlpHomeHost.tsx"), /onOpenPulseTarget: \(target: SlpPulseTarget\) =>/u);
}

// B. Long actions are Pulse tasks: they start, the caller goes on, Pulse keeps result or reason.
// (The store itself needs zustand from the Engine; its list rule is pure and runs here.)
{
  const now = Date.parse("2026-09-29T10:00:00.000Z");
  const hour = 3_600_000;
  const row = (id: string, status: string, finishedAt?: number) => ({ id, status, finishedAt });
  let list = slpPutTask([], row("a", "running"), now);
  list = slpPutTask(list, row("b", "failed", now), now);
  list = slpPutTask(list, row("b", "running"), now);
  assert.deepEqual(
    list.map((task) => `${task.id}:${task.status}`),
    ["b:running", "a:running"],
    "Try again replaces its row",
  );
  list = slpPutTask([row("old", "done", now - 25 * hour), row("slow", "running")], row("new", "done", now), now);
  assert.deepEqual(
    list.map((task) => task.id),
    ["new", "slow"],
    "a day of finished tasks; running ones stay",
  );
  // Merge L + Pulse follow-ups (changed on purpose): 50 rows, the number Pulse keeps across reloads.
  assert.equal(SLP_TASKS_MAX, 50);
  const many = Array.from({ length: 60 }, (_, index) => row(`t${index}`, "done", now));
  assert.equal(
    many.reduce((acc, task) => slpPutTask(acc, task, now), [] as ReturnType<typeof row>[]).length,
    SLP_TASKS_MAX,
  );

  const store = client("base/state/slp-task-store.ts");
  assert.match(
    store,
    /const retry = \(\) => void startSlpTask\(\{ \.\.\.input, startedToast: false \}, id\);/u,
    "retry keeps the id",
  );
  assert.match(
    store,
    /put\(\{ \.\.\.base, status: "failed", finishedAt: Date\.now\(\), error: taskErrorText\(error, input\.t\), retry \}\);/u,
  );
  assert.match(store, /return undefined;/u, "a failure never throws at a caller whose sheet is gone");
  assert.match(store, /export const openSlpPulse = \(\) => useSlpTasks\.setState\(\{ pulseOpen: true \}\);/u);
  assert.match(store, /ui\.slurp\.pulse\.seeInPulse/u, "every toast offers See in Pulse");
  // The bundled i18next copy is never initialised: the store words come from the caller's t.
  assert.doesNotMatch(store, /from "i18next"|i18next\.t\(/u);
  assert.equal((store.match(/seeInPulse\(input\.t\)/gu) ?? []).length, 3);
  // The locks named by the user are gone: sheets close on Do it, the sign-up modal can close, the
  // composer is not held by the picture, the plan survives leaving the box.
  const cards = client("features/stir/SlpStirCards.tsx");
  assert.doesNotMatch(cards, /closeDisabled=\{doIt\.pending\}/u);
  assert.doesNotMatch(client("features/stir/SlpStirPlaySheet.tsx"), /closeDisabled=\{doIt\.pending\}/u);
  assert.match(cards, /options\.onDone\?\.\(\);\s+const label =/u, "the sheet closes on the tap");
  assert.doesNotMatch(client("features/onboarding/SlpOnboardingPanel.tsx"), /closeDisabled=\{pending\}/u);
  const actions = client("app/slp-home-actions.ts");
  assert.doesNotMatch(actions, /await generatePostImage\.mutateAsync/u, "the composer does not wait for the picture");
  assert.match(actions, /kind: "auto-post",/u);
  assert.match(client("app/slp-home-post-actions.ts"), /kind: "generate-post-image",/u);
  const box = client("features/stir/SlpStirBox.tsx");
  assert.match(box, /kind: "stir-plan",/u);
  assert.match(box, /openSlpStirReadyPlan\(answer, origin, request\)/u);
  assert.match(client("features/onboarding/slp-onboarding-wizard-model.ts"), /kind: "sign-up",/u);
  // "Generate now" (Settings › Generate posts): the modal closes on the tap, the run is a task.
  const refresh = client("features/creators/SlpCreatorRefreshModal.tsx");
  assert.doesNotMatch(refresh, /closeDisabled/u);
  assert.match(refresh, /setRefreshModalOpen\(false\);\s+void startSlpTask\(\{\s+t,\s+kind: "generate-posts",/u);
}

console.log("slurp2 pulse + E regression passed");

// Decision 3 (Merge L + Pulse follow-ups): finished tasks survive a reload, the last 50 of the last day.
{
  const now = Date.parse("2026-09-29T10:00:00.000Z");
  const retry = () => undefined;
  const rows = [
    { id: "run", status: "running" },
    { id: "ok", status: "done", finishedAt: now - 1000, open: { label: "Open plan", run: retry } },
    { id: "bad", status: "failed", finishedAt: now - 2000, error: "No connection", retry },
    { id: "old", status: "done", finishedAt: now - SLP_TASKS_KEEP_MS - 1 },
  ];
  const stored = slpStoredTasks(rows, now);
  assert.deepEqual(
    stored.map((task) => task.id),
    ["ok", "bad"],
    "running and day-old tasks are not kept",
  );
  assert.ok(
    stored.every((task) => !("open" in task) && !("retry" in task)),
    "functions of the old tab are dropped",
  );
  assert.equal(JSON.parse(JSON.stringify(stored))[1].error, "No connection", "the reason survives");
  const many = Array.from({ length: 70 }, (_, index) => ({ id: `t${index}`, status: "done", finishedAt: now }));
  assert.equal(slpStoredTasks(many, now).length, 50);
  const store = client("base/state/slp-task-store.ts");
  assert.match(store, /create<SlpTaskState>\(\(\) => \(\{ tasks: readStoredTasks\(\), pulseOpen: false \}\)\)/u);
  assert.match(
    store,
    /localStorage\.setItem\(TASKS_KEY, JSON\.stringify\(slpStoredTasks\(state\.tasks, Date\.now\(\)\)\)\)/u,
  );
  console.log("slurp2 merge L + Pulse follow-ups: ok");
}
