import assert from "node:assert/strict";
import {
  planStatus,
  statusOwner,
  writeStatuses,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/status.ts";
import {
  configureMeanwhileRuntime,
  defaultCircle,
  emptyMeanwhileDocument,
  readMeanwhile,
  updateMeanwhile,
  type Circle,
  type LifeEvent,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/store.ts";

const T0 = Date.parse("2026-11-05T12:00:00Z");
const docs = new Map<string, any>();
const calls: any[] = [];
let handSet = false;
const chats = [
  { id: "rp", mode: "roleplay", characterIds: ["x"] },
  { id: "c1", mode: "conversation", characterIds: ["x"] },
  { id: "c2", mode: "conversation", characterIds: ["x"] },
];
configureMeanwhileRuntime({
  logger: { warn: () => undefined },
  persistence: {
    listChats: async () => chats,
    updateCharacterStatus: async (chatId: string, characterId: string, update: unknown) => {
      calls.push({ chatId, characterId, update });
      return handSet ? null : { targetChatId: chatId };
    },
    documents: {
      getById: async (_p: string, id: string) => docs.get(id) ?? null,
      create: async (input: any) => void docs.set(input.id, { ...input, revision: 1 }),
      update: async (input: any) => {
        docs.set(input.id, { ...input, revision: input.expectedRevision + 1 });
        return docs.get(input.id);
      },
    },
  },
} as any);

const circle = (patch: Partial<Circle> = {}): Circle => ({
  ...defaultCircle("a", T0),
  castIds: ["x"],
  linkedChatIds: ["rp", "c1", "c2"],
  writeStatus: true,
  statusSince: 1,
  clock: { anchorCircle: new Date(T0).toISOString(), anchorReal: T0, speed: 1, timezone: "UTC" },
  ...patch,
});
const event = (patch: Partial<LifeEvent> = {}): LifeEvent =>
  ({
    id: "e1",
    circleId: "a",
    start: new Date(T0 - 600_000).toISOString(),
    end: new Date(T0 + 40 * 60_000).toISOString(),
    createdAt: 0,
    cast: ["x"],
    kind: "friends",
    weight: "notable",
    text: "Lily  and Mia\ntalk over coffee",
    source: "generated",
    status: "accepted",
    visibility: "circle",
    ...patch,
  }) as LifeEvent;
// 12:00 UTC on a Thursday: 09:00-13:00 work (dnd), 13:00-14:00 lunch (no status).
const schedule = {
  days: {
    Thursday: [
      { time: "09:00-13:00", activity: "deep work", status: "dnd" },
      { time: "13:00-14:00", activity: "lunch" },
    ],
  },
};
const plan = (events: LifeEvent[], c = circle(), s: unknown = schedule) =>
  planStatus({ circle: c, characterId: "x", schedule: s, events, nowMs: T0 });

// Routine: the block's status and activity, duration to the end of the block (60 min).
assert.deepEqual(plan([]), { status: "dnd", activity: "deep work", duration: "1h", key: "dnd|deep work" });
// Accepted notable event wins the text, keeps the block status, is plain and at most 120 chars; duration to its end.
const hit = plan([event({ text: "Lily  and Mia\ntalk over coffee " + "x".repeat(200) })])!;
assert.equal(hit.status, "dnd");
assert.ok(hit.activity.startsWith("Lily and Mia talk over coffee") && hit.activity.length === 120);
assert.equal(hit.duration, "40m");
// Never written: proposed, vetoed, stale, routine, other-chat, other character, not covering now.
for (const bad of [
  { status: "proposed" },
  { status: "vetoed" },
  { status: "stale" },
  { weight: "routine" },
  { weight: "summary" },
  { visibility: "chat:c1" },
  { cast: ["y"] },
  { end: new Date(T0 - 1).toISOString() },
  { start: new Date(T0 + 1).toISOString() },
] as Partial<LifeEvent>[])
  assert.equal(plan([event(bad)])!.activity, "deep work", JSON.stringify(bad));
// Duration bounds: min 15 minutes, max 12 hours.
assert.equal(plan([event({ end: new Date(T0 + 60_000).toISOString() })])!.duration, "15m");
assert.equal(plan([event({ end: new Date(T0 + 30 * 3600_000).toISOString() })])!.duration, "12h");
// No status in the schedule: sleeping is offline, anything else online.
assert.equal(
  plan([], circle(), { days: { Thursday: [{ time: "09:00-13:00", activity: "sleeping in" }] } })!.status,
  "offline",
);
assert.equal(
  plan([], circle(), { days: { Thursday: [{ time: "09:00-13:00", activity: "reading" }] } })!.status,
  "online",
);
// One owner per character: the Circle that turned it on later.
assert.equal(statusOwner([circle(), circle({ id: "b", statusSince: 2 })], "x"), "b");
assert.equal(statusOwner([circle({ writeStatus: false })], "x"), null);

async function seed(circles: Circle[], events: LifeEvent[] = []) {
  docs.clear();
  calls.length = 0;
  await updateMeanwhile(() => ({ ...emptyMeanwhileDocument(), circles, events }));
}
const read = async (c: Circle) => ({ schedules: { x: schedule } as Record<string, unknown> });

async function main() {
  // Off by default: a new Circle never writes.
  assert.equal(defaultCircle("n", T0).writeStatus, false);
  await seed([circle({ writeStatus: false })]);
  await writeStatuses(T0, read);
  assert.equal(calls.length, 0);

  // On at x1: one write to the first linked Conversation chat (not the roleplay), then none while unchanged.
  await seed([circle()]);
  await writeStatuses(T0, read);
  assert.deepEqual(calls, [
    { chatId: "c1", characterId: "x", update: { status: "dnd", activity: "deep work", duration: "1h" } },
  ]);
  await writeStatuses(T0 + 60_000, read);
  assert.equal(calls.length, 1);
  assert.ok((await readMeanwhile()).statusSent["c1:x"].at > 0);

  // A veto of the written event makes the next pass write the routine again.
  const e = event({ end: new Date(T0 + 3600_000).toISOString() });
  await seed([circle()], [e]);
  await writeStatuses(T0, read);
  assert.ok(calls[0].update.activity.startsWith("Lily and Mia"));
  await updateMeanwhile((d) => ({ ...d, events: d.events.map((x) => ({ ...x, status: "vetoed" as const })) }));
  await writeStatuses(T0 + 60_000, read);
  assert.equal(calls[1].update.activity, "deep work");

  // Not at other speeds, and only the owner writes.
  await seed([circle({ clock: { ...circle().clock, speed: 24 } })]);
  await writeStatuses(T0, read);
  await seed([circle({ clock: { ...circle().clock, speed: 0 } })]);
  await writeStatuses(T0, read);
  await seed([circle(), circle({ id: "b", statusSince: 2, linkedChatIds: ["c2"] })]);
  await writeStatuses(T0, read);
  assert.deepEqual(
    calls.map((c) => c.chatId),
    ["c2"],
  );

  // A status the user set by hand (the Engine returns null) is not retried until the plan changes.
  handSet = true;
  await seed([circle()]);
  await writeStatuses(T0, read);
  await writeStatuses(T0 + 60_000, read);
  assert.equal(calls.length, 1);
  assert.equal((await readMeanwhile()).statusSent["c1:x"].at, 0);

  // No linked Conversation chat with the character: nothing is written.
  await seed([circle({ linkedChatIds: ["rp"] })]);
  await writeStatuses(T0, read);
  assert.equal(calls.length, 0);
  console.log("Meanwhile status regression passed.");
}
void main();
