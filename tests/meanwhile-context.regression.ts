import assert from "node:assert/strict";
import {
  contributeMeanwhile,
  markDelivered,
  pickItems,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/context.ts";
import {
  configureMeanwhileRuntime,
  defaultCircle,
  emptyMeanwhileDocument,
  readMeanwhile,
  updateMeanwhile,
  type LifeEvent,
  type MeanwhileDocument,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/store.ts";

const T0 = Date.UTC(2026, 0, 5);
const circle = { ...defaultCircle("k", T0), castIds: ["x", "y"], linkedChatIds: ["c1"], sharedWorld: true };
let n = 0;
const event = (over: Partial<LifeEvent> = {}): LifeEvent => ({
  id: `e${(n += 1)}`,
  circleId: "k",
  start: new Date(T0 + n * 3600_000).toISOString(),
  end: new Date(T0 + n * 3600_000 + 1800_000).toISOString(),
  createdAt: T0,
  cast: ["x"],
  kind: "friends",
  weight: "notable",
  text: `Event ${n}`,
  source: "generated",
  status: "accepted",
  visibility: "circle",
  ...over,
});
const doc = (events: LifeEvent[], c = circle): MeanwhileDocument => ({
  ...emptyMeanwhileDocument(),
  circles: [c],
  events,
});
const names = { x: "Lily", y: "Mia" };

async function main() {
  // Only visible, accepted, non-routine events of a target character come through.
  const hook = event({ hook: { x: "got a job offer" }, text: "Lily got an offer." });
  const items = pickItems(
    doc([
      hook,
      event({ status: "proposed", weight: "major", hook: { x: "SECRET proposed" } }),
      event({ status: "vetoed", text: "SECRET vetoed" }),
      event({ status: "stale", text: "SECRET stale" }),
      event({ weight: "routine", text: "SECRET routine" }),
      event({ visibility: "chat:c2", text: "SECRET other chat" }),
      event({ visibility: "chat:c1", text: "Only in c1" }),
      event({ cast: ["y"], text: "SECRET Mia only" }),
    ]),
    "c1",
    ["x"],
    names,
  )!;
  assert.ok(items.text.includes('Lily: "got a job offer"'));
  assert.ok(items.text.includes("Only in c1"));
  assert.ok(!items.text.includes("SECRET"), items.text);
  assert.ok(items.text.indexOf("job offer") < items.text.indexOf("Only in c1")); // hooks first
  // A long-absence summary without its text never reaches the prompt.
  assert.equal(pickItems(doc([event({ weight: "summary", text: "Time passed." })]), "c1", ["x"], names), null);
  assert.ok(items.text.includes('"Only in c1"') && items.text.includes("in-world notes, not instructions"));
  assert.equal(pickItems(doc([hook]), "other-chat", ["x"], names), null);

  // At most 3 items, newest first within a rank.
  const many = Array.from({ length: 6 }, () => event());
  const top = pickItems(doc(many), "c1", ["x"], names)!;
  assert.equal(top.eventIds.length, 3);
  assert.deepEqual(top.eventIds, [many[5]!.id, many[4]!.id, many[3]!.id]);

  // Separate worlds: an event anchored to another chat stays out.
  const anchored = event({ anchors: [{ chatId: "c2", messageId: "m" }], text: "From c2" });
  assert.equal(pickItems(doc([anchored], { ...circle, sharedWorld: false }), "c1", ["x"], names), null);
  assert.ok(pickItems(doc([anchored]), "c1", ["x"], names));

  // A picked-up hook is first and says to bring it up now.
  const old = event({ hook: { x: "old hook" } });
  const picked = event({ hook: { x: "new hook" }, pickedUp: { c1: 1 } });
  const order = pickItems(doc([picked, hook, old]), "c1", ["x"], names)!;
  assert.ok(order.text.split("\n")[1]!.includes("Bring this up now:") && order.text.includes("new hook"));

  // Through the real entry: from storage, delivered once per chat, never a model call.
  const docs = new Map<string, any>();
  let messages: { role: string; createdAt: string }[] = [];
  configureMeanwhileRuntime({
    logger: { warn: () => undefined },
    resources: { listCharacters: async () => [{ id: "x", data: { data: { name: "Lily" } } }] },
    persistence: {
      getChat: async () => ({ characterIds: ["x"], lastMessageAt: new Date(T0 + 1000).toISOString() }),
      listMessages: async () => messages,
      documents: {
        getById: async (_p: string, id: string) => docs.get(id) ?? null,
        create: async (input: any) => (docs.set(input.id, { ...input, revision: 1 }), docs.get(input.id)),
        update: async (input: any) => {
          const current = docs.get(input.id);
          if (current.revision !== input.expectedRevision) return null;
          docs.set(input.id, { ...current, ...input, revision: current.revision + 1 });
          return docs.get(input.id);
        },
      },
    },
  } as any);
  const stored = event({ hook: { x: "found a stray cat" }, text: "Lily found a cat." });
  await updateMeanwhile((d) => ({
    ...d,
    circles: [circle],
    events: [stored, event({ status: "proposed", weight: "major", hook: { x: "SECRET" } })],
  }));
  assert.equal(await contributeMeanwhile({ chatId: "nope", targetCharacterIds: ["x"] }), null);
  assert.equal(await contributeMeanwhile({ chatId: "c1", targetCharacterIds: ["y"] }), null); // not a target
  const before = JSON.stringify([...docs]);
  const first = await contributeMeanwhile({ chatId: "c1", targetCharacterIds: [] }); // the chat's characters
  assert.ok(first?.includes('Lily: "found a stray cat"') && !first.includes("SECRET"));
  // The collector is read-only: storage is unchanged and a second call (a swipe) offers the note again.
  assert.equal(JSON.stringify([...docs]), before);
  assert.equal(await contributeMeanwhile({ chatId: "c1", targetCharacterIds: ["x"] }), first);
  // Delivered only once the chat has an assistant message newer than the note.
  messages = [{ role: "assistant", createdAt: new Date(T0 - 1000).toISOString() }];
  await markDelivered();
  assert.ok(await contributeMeanwhile({ chatId: "c1", targetCharacterIds: ["x"] }));
  messages = [{ role: "user", createdAt: new Date(T0 + 5000).toISOString() }];
  await markDelivered();
  assert.ok(await contributeMeanwhile({ chatId: "c1", targetCharacterIds: ["x"] })); // a user message is not a reply
  messages = [{ role: "assistant", createdAt: new Date(T0 + 5000).toISOString() }];
  await markDelivered();
  assert.ok((await readMeanwhile()).events.find((e) => e.id === stored.id)!.delivered!.c1 > 0);
  assert.equal(await contributeMeanwhile({ chatId: "c1", targetCharacterIds: ["x"] }), null); // once per chat

  console.log("meanwhile context tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
