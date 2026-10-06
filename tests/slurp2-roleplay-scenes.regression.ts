/**
 * Roleplay scenes from a DM thread (packages/slurp2/docs/SCENES.md): what the scene reads from the
 * thread, how often a Creator may pitch one, and what the Engine's claim and release do to the thread.
 */
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  readSlpSceneLine,
  readSlpSceneSettings,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-roleplay-scene";
import {
  slpSceneAudienceScope,
  slpSceneInviteAllowed,
  slpSceneTranscript,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-roleplay-scene-rules";
import { readSlpScenePlan } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-roleplay-scene-prompt";
import { slurp2Source } from "./slurp2-source";
import { slurpDmTranscript } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-roles";

// ── What the scene reads: paid content is named, never quoted; scene lines are not conversation ──
const message = (role: "viewer" | "creator", kind: string, content: string, extra: object = {}) => ({
  role,
  kind,
  content,
  imageUrl: null,
  price: 0,
  unlockedAt: null,
  metadata: {},
  ...extra,
});
const transcript = slpSceneTranscript(
  [
    message("viewer", "text", "Hi Mina"),
    message("creator", "ppv", "LOCKED BODY", { price: 40 }),
    message("viewer", "tip", "", { price: 15 }),
    message("creator", "system", "OLD RECAP", { metadata: { scene: { kind: "recap", summary: "x" } } }),
    message("creator", "text", "Come to my shoot?"),
  ],
  { creator: "Mina", fan: "Alex" },
);
assert.deepEqual(transcript, [
  { speaker: "Alex", content: "Hi Mina" },
  { speaker: "Mina", content: "(sent locked paid content)" },
  { speaker: "Alex", content: "(tipped 15 coins)" },
  { speaker: "Mina", content: "Come to my shoot?" },
]);
assert.deepEqual(slpSceneTranscript([message("viewer", "text", "Hi")], { creator: "Mina", fan: "Alex" }, 0), []);

// ── What her DM prompt reads: the recap as something they did, the invite as hers, no empty notes ──
const line = (role: "viewer" | "creator", scene: object, content = "") => ({
  id: Math.random().toString(36),
  role,
  kind: "system",
  content,
  price: 0,
  unlockedAt: null,
  imageUrl: null,
  metadata: { scene },
  createdAt: "2026-10-05T12:00:00Z",
});
const dm = slurpDmTranscript(
  [
    line("creator", { kind: "invite", pitch: "Come to my shoot?", state: "accepted" }, "Come to my shoot?"),
    line("creator", {
      kind: "recap",
      sceneChatId: "s",
      title: "Shoot",
      summary: "They talked all night.",
      reach: "private",
    }),
    line("creator", { kind: "ended", sceneChatId: "s2", outcome: "abandoned" }),
  ] as never,
  { writer: "creator", creator: { name: "Mina", handle: "mina" }, viewer: { name: "Alex", handle: "alex" } },
);
assert.equal(dm.length, 2, "An ended note is not conversation");
assert.match(JSON.stringify(dm[0]), /invited Alex into a scene together/u);
assert.match(
  JSON.stringify(dm[1]),
  /You and Alex spent time together in person\. What happened: They talked all night\./u,
);

// ── Invites stay rare: none while one is open, none within three days of the last ──
const now = new Date("2026-10-05T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const invite = (state: string, createdAt: string) => ({ metadata: { scene: { kind: "invite", state } }, createdAt });
assert.equal(slpSceneInviteAllowed([], now), true);
assert.equal(slpSceneInviteAllowed([invite("open", daysAgo(10))], now), false, "An open invite blocks another");
assert.equal(slpSceneInviteAllowed([invite("declined", daysAgo(1))], now), false, "Too soon after the last one");
assert.equal(slpSceneInviteAllowed([invite("accepted", daysAgo(4))], now), true);

// ── Settings and reach ──
assert.deepEqual(readSlpSceneSettings(null), { lock: true, reach: "private" });
assert.deepEqual(readSlpSceneSettings({ lock: false, reach: "none" }), { lock: false, reach: "none" });
assert.deepEqual(readSlpSceneSettings({ lock: "yes", reach: "everywhere" }), { lock: true, reach: "private" });
assert.equal(slpSceneAudienceScope("private"), "thread_private");
assert.equal(slpSceneAudienceScope("hint"), "creator_private");
assert.equal(slpSceneAudienceScope("public"), "creator_public");
const plan = readSlpScenePlan({
  name: "The Shoot",
  description: "A studio.",
  scenario: "It turns personal.",
  firstMessage: "You came.",
  systemPrompt: "Write it.",
  rating: "nsfw",
  reach: "hint",
});
assert.equal(plan?.name, "Scene: The Shoot", "The Engine's scene title prefix is added");
assert.equal(plan?.lock, true, "A plan locks unless the planner says otherwise");
assert.equal(readSlpScenePlan({ name: "x", reach: "private" }), null, "An incomplete plan is refused");
assert.equal(readSlpSceneLine({ scene: { kind: "ended", outcome: "weird" } })?.kind, "ended");

// ── The origin provider against a fake thread store ──
type Thread = {
  id: string;
  state: string;
  creatorAccountId: string;
  viewerAccountId: string;
  sceneChatId: string | null;
};
const threads = new Map<string, Thread>();
const lines = new Map<string, { id: string; metadata: Record<string, unknown> }>();
const facts: Array<{ text: string; audienceScope: string }> = [];
const retracted: string[] = [];
const released: string[] = [];
let recapAppends = 0;
const reset = () => {
  threads.clear();
  lines.clear();
  facts.length = 0;
  retracted.length = 0;
  released.length = 0;
  recapAppends = 0;
  threads.set("t1", {
    id: "t1",
    state: "active",
    creatorAccountId: "mina",
    viewerAccountId: "alex",
    sceneChatId: null,
  });
};
const messagesStore = {
  getThreadById: async (id: string) => threads.get(id) ?? null,
  claimThreadScene: async (id: string, sceneChatId: string) => {
    const thread = threads.get(id);
    if (!thread || thread.sceneChatId) return false;
    thread.sceneChatId = sceneChatId;
    return true;
  },
  releaseThreadScene: async (id: string, sceneChatId: string) => {
    const thread = threads.get(id);
    if (thread?.sceneChatId !== sceneChatId) return false;
    thread.sceneChatId = null;
    released.push(sceneChatId);
    return true;
  },
  getMessageById: async (id: string) => lines.get(id) ?? null,
  appendMessage: async (_threadId: string, input: { id: string; metadata: Record<string, unknown> }) => {
    recapAppends += 1;
    lines.set(input.id, input);
    return input;
  },
  listMessages: async () => [...lines.values()],
  setSceneLine: async (id: string, scene: unknown) => {
    const line = lines.get(id);
    if (line) line.metadata = { ...line.metadata, scene };
  },
};
const source = slurp2Source(
  new URL(
    "../packages/slurp2/src/engine/packages/server/src/slp/features/messages/scenes/slp-roleplay-scene-origin.ts",
    import.meta.url,
  ),
);
const origin = runInNewContext(
  `${stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, "").replace(/^\s*export /gm, ""))}
  ({ createSlpSceneOriginProvider });`,
  {
    logger: { warn: () => undefined },
    createSlurpMessagesStorage: () => messagesStore,
    createSlurpStorage: () => ({
      getNoodlerAccountById: async (id: string) =>
        id === "mina"
          ? { id, displayName: "Mina", handle: "mina", settings: { privacy: { identityDisclosure: "open" } } }
          : null,
      getViewer: async () => null,
    }),
    createChatsStorage: () => ({ getById: async () => ({ name: "Scene: The Shoot" }) }),
    resolveNoodlerPublicIdentity: async () => null,
    protectCreatorGeneratedIdentity: (value: string) => value,
    recordSlurpContinuityEvent: async () => undefined,
    createSlurpContinuityFact: async (_db: unknown, fact: { text: string; audienceScope: string }) => {
      facts.push(fact);
      return fact;
    },
    retractSlurpContinuitySource: async (_db: unknown, _creator: string, hash: string) => {
      retracted.push(hash);
      return 0;
    },
    readSlpSceneLine,
    readSlpSceneSettings,
    slpSceneAudienceScope,
    slpSceneRecapLine: (input: { sceneChatId: string; title: string; summary: string; reach: string }) => ({
      kind: "recap",
      ...input,
    }),
    slpSceneTranscript,
  },
) as { createSlpSceneOriginProvider: (db: unknown) => import("@marinara-engine/shared").SceneOriginProvider };
const provider = origin.createSlpSceneOriginProvider({});
const concluded = (sceneChatId: string, data: Record<string, unknown> | null) => ({
  kind: "concluded" as const,
  sceneChatId,
  summary: "They talked all night.",
  description: null,
  scenario: null,
  rating: "nsfw" as const,
  characterIds: ["char-mina"],
  data,
});

async function main() {
  // A locking scene: one claim wins; the release brings the recap in once and then unlocks.
  reset();
  assert.equal(await provider.claim!("t1", { sceneChatId: "s1", characterIds: [], data: { lock: true } }), true);
  assert.equal(await provider.claim!("t1", { sceneChatId: "s2", characterIds: [], data: { lock: true } }), false);
  await provider.release!("t1", concluded("s2", { lock: true, reach: "private" }));
  assert.equal(lines.size, 0, "A scene that does not hold the lock changes nothing");
  await provider.release!("t1", concluded("s1", { lock: true, reach: "private" }));
  await provider.release!("t1", concluded("s1", { lock: true, reach: "private" }));
  assert.equal(lines.size, 1, "The recap is written once");
  assert.equal(recapAppends, 1, "A retried release never appends the recap again");
  assert.equal((lines.get("scene-s1")!.metadata.scene as { kind: string }).kind, "recap");
  assert.equal(threads.get("t1")!.sceneChatId, null, "The thread is unlocked");
  assert.equal(facts.length, 1);
  assert.equal(facts[0]!.audienceScope, "thread_private");

  // A scene that does not lock: admitted without a lock, still brought back, never "released".
  reset();
  assert.equal(await provider.claim!("t1", { sceneChatId: "s3", characterIds: [], data: { lock: false } }), true);
  assert.equal(threads.get("t1")!.sceneChatId, null);
  await provider.release!("t1", concluded("s3", { lock: false, reach: "hint" }));
  assert.equal(lines.size, 1);
  assert.deepEqual(released, []);
  assert.equal(facts[0]!.audienceScope, "creator_private");
  assert.match(facts[0]!.text, /never gives details/u, "A hint is stored without the details");

  // Kept out of Slurp: a plain note in the thread, no recap and no memory.
  reset();
  await provider.claim!("t1", { sceneChatId: "s4", characterIds: [], data: { lock: true, reach: "none" } });
  await provider.release!("t1", concluded("s4", { lock: true, reach: "none" }));
  assert.deepEqual(JSON.parse(JSON.stringify(lines.get("scene-s4")!.metadata.scene)), {
    kind: "ended",
    sceneChatId: "s4",
    outcome: "concluded",
  });
  assert.equal(facts.length, 0);
  assert.equal(threads.get("t1")!.sceneChatId, null);

  // Starting a scene answers the open invite.
  reset();
  lines.set("inv", { id: "inv", metadata: { scene: { kind: "invite", pitch: "Shoot?", state: "open" } } });
  await provider.claim!("t1", { sceneChatId: "s5", characterIds: [], data: null });
  assert.equal((lines.get("inv")!.metadata.scene as { state: string }).state, "accepted");

  // A closed thread takes no scene, locked or not.
  reset();
  threads.get("t1")!.state = "declined";
  assert.equal(await provider.claim!("t1", { sceneChatId: "s6", characterIds: [], data: { lock: false } }), false);
}

main().then(
  () => console.log("slurp2 roleplay scenes: ok"),
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
