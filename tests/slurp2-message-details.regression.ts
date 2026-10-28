import assert from "node:assert/strict";
import {
  slpMessageDetailsSchema,
  slpOverrideRapport,
  slpCreatorDetailsSchema,
  slpConversationDetailsSchema,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-message-details.js";
import {
  SLURP_CREATOR_EMOTIONS,
  SLURP_ADULT_INTENTS,
  SLURP_THREAD_POSTURES,
  SLURP_ADULT_LEVELS,
  SLURP_MODIFIER_KINDS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-state.js";
import { slpMessageDetailsRoutes } from "../packages/slurp2/src/engine/packages/server/src/slp/features/messages/slp-message-details-routes.js";

assert.deepEqual(slpCreatorDetailsSchema.shape.emotion.unwrap().options, SLURP_CREATOR_EMOTIONS);
assert.deepEqual(slpCreatorDetailsSchema.shape.intent.unwrap().options, SLURP_ADULT_INTENTS);
assert.deepEqual(slpConversationDetailsSchema.shape.posture.unwrap().options, SLURP_THREAD_POSTURES);
assert.deepEqual(slpConversationDetailsSchema.shape.adultLevel.unwrap().options, SLURP_ADULT_LEVELS);
assert.deepEqual(slpCreatorDetailsSchema.shape.modifiers.unwrap().element.shape.kind.options, SLURP_MODIFIER_KINDS);
for (const patch of [
  { mood: -101 },
  { score: 101 },
  { creatorState: { energy: 1.5 } },
  { threadState: { posture: "invented" } },
  { availability: { online: "true" } },
  { spentCoins: -1 },
  { wallet: 500 },
  { coolUntil: "tomorrow" },
  { creatorState: { updatedAt: "fake" } },
])
  assert.equal(slpMessageDetailsSchema.safeParse(patch).success, false);
assert.equal(
  slpMessageDetailsSchema.safeParse({
    creatorState: { updatedAt: "2026-09-27T18:00:00.000Z" },
    threadState: { updatedAt: "2026-09-27T18:00:00.000Z" },
    coolUntil: null,
  }).success,
  true,
);
const base = {
  score: 15,
  tier: "stranger",
  contributions: [
    { key: "tips", points: 5 },
    { key: "conversation", points: 10 },
  ],
};
assert.deepEqual(slpOverrideRapport(base, { score: 70, tier: "favourite", contributionPoints: { tips: -2 } }), {
  score: 70,
  tier: "favourite",
  contributions: [
    { key: "tips", points: -2 },
    { key: "conversation", points: 10 },
  ],
});
assert.equal(base.score, 15);

async function main() {
  type Handler = (
    request: { body: unknown; params: { threadId: string } },
    reply: { code: (code: number) => { send: (body: unknown) => unknown } },
  ) => Promise<unknown>;
  let handler: Handler;
  let owned = false;
  const writes: unknown[] = [];
  await slpMessageDetailsRoutes(
    {
      get() {},
      post() {},
      patch(path: string, callback: Handler) {
        if (path.endsWith("/details")) handler = callback;
      },
    } as unknown as Parameters<typeof slpMessageDetailsRoutes>[0],
    {
      requireViewer: async (id: string) => (id === "missing" ? null : { id }),
      ownsCreator: async () => owned,
      messages: {
        getThreadById: async () => ({ viewerAccountId: "viewer", creatorAccountId: "creator" }),
        setThreadDetails: async (_id: string, patch: unknown) => {
          writes.push(patch);
        },
        saveDetailsOverrides: async () => {},
      },
      slurp: {
        setCreatorDetails: async (_id: string, patch: unknown) => {
          writes.push(patch);
        },
      },
    } as unknown as Parameters<typeof slpMessageDetailsRoutes>[1],
  );
  async function send(body: unknown) {
    let status = 200;
    await handler(
      { body, params: { threadId: "thread" } },
      {
        code(code) {
          status = code;
          return { send: (value) => value };
        },
      },
    );
    return status;
  }
  assert.equal(await send({ personaId: "other", mood: 20 }), 404);
  assert.equal(await send({ personaId: "missing", mood: 20 }), 404);
  assert.equal(await send({ personaId: "viewer", threadState: { respect: 101 } }), 400);
  assert.equal(writes.length, 0);
  assert.equal(
    await send({
      personaId: "viewer",
      creatorState: { emotion: "warm", energy: 90 },
      threadState: { posture: "playful" },
      spentCoins: 999,
      imageMode: "none",
    }),
    200,
  );
  assert.equal(writes.length, 2);
  owned = true;
  assert.equal(await send({ personaId: "operator", mood: -30 }), 200);
  console.log("Slurp2 Details edits: bounds, option parity, calculated overrides and persona authorization passed");
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
