/** Runnable proof for the PR #1230 review fixes, using the actual functions with small host fakes. */
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { slurp2Source } from "./slurp2-source";
import { readSlpSceneLine } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-roleplay-scene";

const source = (path: string) =>
  slurp2Source(new URL(`../packages/slurp2/src/engine/packages/${path}`, import.meta.url));
const evaluate = (code: string, scope: Record<string, unknown>) =>
  runInNewContext(stripTypeScriptTypes(code.replace(/export /gu, "")), scope);

async function main() {
  // A 600-character idea and long brand/collab copy cannot truncate disclosure or partner instructions.
  const assist = source("server/src/slp/features/assist/slp-assist-service.ts");
  let prompt: { context: string; note: string } | undefined;
  const draft = evaluate(`${assist.slice(assist.indexOf("export async function draftSlpPost"))}\ndraftSlpPost;`, {
    readSlurpCreatorTiesDocument: async () => ({
      deals: [{ id: "deal", creatorId: "page", brand: "Brand", product: "Product", copy: "x".repeat(600) }],
      ties: { collabs: [{ id: "collab", hostId: "page", partnerId: "partner", idea: "y".repeat(600) }] },
    }),
    createSlurpStorage: () => ({ getNoodlerAccountById: async () => ({ handle: "partner" }) }),
    runSlpAssistText: async (_db: unknown, input: typeof prompt) => {
      prompt = input;
      return { ok: true, value: { text: "caption" } };
    },
    SLP_ASSIST_NOTE_MAX: 400,
    fail: () => {
      throw new Error("Unexpected refusal");
    },
  }) as (db: object, input: object) => Promise<unknown>;
  await draft({}, { accountId: "page", dealId: "deal", collabId: "collab", idea: "z".repeat(600), picture: false });
  assert.match(prompt!.context, /mark it #ad/u);
  assert.match(prompt!.context, /@partner.*Tag them/u);
  assert.equal(prompt!.note.length, 400);

  // Discarding a sponsored draft must not settle the old deal on the next unrelated post.
  const composer = source("client/src/slp/app/screens/SlpScreenComposer.tsx");
  const guideDealId = { current: "deal" as string | null };
  evaluate(
    `${composer.slice(composer.indexOf("  const discardDraft ="), composer.indexOf("  // Remove is one tap"))}\ndiscardDraft();`,
    {
      composerBusyRef: { current: false },
      drafting: false,
      setComposeGuide: () => undefined,
      guideDealId,
      onDiscardDraft: () => undefined,
      resetLocal: () => undefined,
      onClose: () => undefined,
    },
  );
  assert.equal(guideDealId.current, null);

  // A response for a closed/replaced sheet cannot overwrite the new sheet's scene plan.
  const sheetSource = source("client/src/slp/features/messages/scenes/SlpSceneStartSheet.tsx");
  const writeSource = sheetSource.slice(
    sheetSource.indexOf("  async function write()"),
    sheetSource.indexOf("  async function start()"),
  );
  const scope: Record<string, unknown> = {
    sheet: { threadId: "old" },
    personaId: "persona",
    idea: "idea",
    requestSequence: { current: 0 },
    setError: () => undefined,
    setSettings: () => undefined,
  };
  let planned: unknown;
  const responses: Array<(value: object) => void> = [];
  Object.assign(scope, {
    useSlurpUIStore: { getState: () => ({ sceneSheet: scope.sheet }) },
    plan: { mutateAsync: () => new Promise((resolve) => responses.push(resolve)) },
    setPlanned: (value: unknown) => {
      planned = value;
    },
  });
  const write = evaluate(`${writeSource}\nwrite;`, scope) as () => Promise<void>;
  const old = write();
  scope.sheet = { threadId: "new" };
  const current = write();
  responses[1]!({ plan: "new", settings: {} });
  await current;
  responses[0]!({ plan: "old", settings: {} });
  await old;
  assert.equal((planned as { plan: string }).plan, "new");

  // Failed handback leaves the focus request unacknowledged; success acknowledges only after navigation.
  const hooks = source("client/src/slp/features/messages/scenes/slp-roleplay-scene-hooks.ts");
  const focusSource = hooks.slice(hooks.indexOf("export function useSlpSceneFocus()"));
  for (const succeeds of [false, true]) {
    const calls: string[] = [];
    const store = {
      sceneFocusThreadId: "thread",
      sceneFocusHandled: () => calls.push("handled"),
      setViewerPersonaId: () => calls.push("persona"),
      setNavigation: () => calls.push("navigation"),
    };
    let settle: () => void;
    const response = new Promise((resolve, reject) => {
      settle = () => (succeeds ? resolve({ personaId: "p", creatorAccountId: "c" }) : reject(new Error("offline")));
    });
    evaluate(`${focusSource}\nuseSlpSceneFocus();`, {
      useSlurpUIStore: Object.assign((selector: (state: typeof store) => unknown) => selector(store), {
        getState: () => store,
      }),
      useEffect: (effect: () => void) => effect(),
      threadPath: (id: string) => `/threads/${id}`,
      api: { get: () => response },
    });
    settle!();
    await response.catch(() => undefined);
    await Promise.resolve();
    assert.deepEqual(calls, succeeds ? ["persona", "navigation", "handled"] : []);
  }

  // A still-open invite is found by ID even after it leaves the recent transcript window.
  const planner = source("server/src/slp/features/messages/scenes/slp-roleplay-scene-planner.ts");
  const invite = { threadId: "thread", metadata: { scene: { kind: "invite", pitch: "Meet me", state: "open" } } };
  const accepted = new Error("reached generation context");
  const planScene = evaluate(
    `${planner.slice(planner.indexOf("export async function planSlpRoleplayScene"))}\nplanSlpRoleplayScene;`,
    {
      createSlurpMessagesStorage: () => ({
        getThreadById: async () => ({
          id: "thread",
          viewerAccountId: "viewer",
          creatorAccountId: "creator",
          state: "active",
        }),
        listMessages: async () => [],
        getMessageById: async () => invite,
      }),
      createSlurpStorage: () => ({
        getNoodlerAccountById: async () => ({ settings: { privacy: {} } }),
        resolveAccountSource: async () => ({ kind: "character" }),
        listSubscriptionsForViewer: async () => [],
      }),
      readSlpSceneLine,
      SlpScenePlanRefusal: Error,
      createCharactersStorage: () => ({
        getPersona: async () => {
          throw accepted;
        },
      }),
    },
  ) as (db: object, input: object) => Promise<unknown>;
  await assert.rejects(
    planScene({}, { threadId: "thread", viewer: { id: "viewer" }, inviteMessageId: "invite" }),
    (error) => error === accepted,
  );
  invite.threadId = "another-thread";
  await assert.rejects(
    planScene({}, { threadId: "thread", viewer: { id: "viewer" }, inviteMessageId: "invite" }),
    (error) => error !== accepted,
  );

  // Scene updates and other metadata patches share one transaction, preserving both concurrent writes.
  let metadata = JSON.stringify({ existing: true });
  let queue = Promise.resolve();
  const tx = {
    select: () => ({ from: () => ({ where: async () => [{ metadata }] }) }),
    update: () => ({
      set: (patch: { metadata: string }) => ({
        where: async () => {
          metadata = patch.metadata;
        },
      }),
    }),
  };
  const db = {
    ...tx,
    transaction: (operation: (database: typeof tx) => Promise<void>) => {
      const result = queue.then(() => operation(tx));
      queue = result.catch(() => undefined);
      return result;
    },
  };
  const actions = source("server/src/slp/data/messages/slp-messages-storage-actions.ts");
  const method = actions.slice(
    actions.indexOf("    async mergeMessageMetadata("),
    actions.indexOf("    async setMessageReaction("),
  );
  const storage = evaluate(`({${method}})`, {
    db,
    eq: () => undefined,
    slurpMessages: { id: "id" },
    json: JSON.parse,
  }) as {
    mergeMessageMetadata: (id: string, patch: object) => Promise<void>;
  };
  const scenes = source("server/src/slp/data/messages/slp-messages-storage-scenes.ts");
  const setLine = scenes.slice(scenes.indexOf("    async setSceneLine("), scenes.indexOf("    /** Every thread"));
  const sceneStorage = evaluate(`({${setLine}})`, { context: { storage } }) as {
    setSceneLine: (id: string, line: object) => Promise<void>;
  };
  await Promise.all([
    storage.mergeMessageMetadata("message", { proposal: "kept" }),
    sceneStorage.setSceneLine("message", { kind: "recap" }),
  ]);
  assert.deepEqual(JSON.parse(metadata), { existing: true, proposal: "kept", scene: { kind: "recap" } });
  console.log("slurp2 scene review regressions: ok");
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
