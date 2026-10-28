import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  generateSlpImageWithRetry,
  slpImageRetryable,
  slpCreatorPostImageRetryAttempts,
  SLP_CREATOR_POST_IMAGE_RETRY_LIMIT,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-retry.js";

const read = (file: string) => readFileSync(file, "utf8");
const slurp = "packages/slurp2/src/engine/packages/server/src/slp/";
const compile = (source: string, expression: string, context: Record<string, unknown>) =>
  runInNewContext(
    `${stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, "").replace(/^\s*export /gm, ""))}\n${expression};`,
    { Error, setTimeout, clearTimeout, ...context },
  );

const noodleRetry = compile(
  read("packages/noodle/src/engine/packages/server/src/services/noodle/noodle-image-retry.ts"),
  "generateNoodleImageWithRetry",
  {
    isConnectionAdmissionFailure: (error: unknown) =>
      error instanceof Error && error.name === "BackgroundConnectionBusyError",
  },
) as typeof generateSlpImageWithRetry;

async function main() {
  for (const retry of [noodleRetry, generateSlpImageWithRetry]) {
    for (const failure of [
      Object.assign(new Error("Task already accepted"), { retryable: false }),
      { retryable: false },
    ]) {
      let calls = 0;
      let accounted = 0;
      await assert.rejects(
        retry(
          async () => {
            calls++;
            throw failure;
          },
          async () => {
            accounted++;
          },
        ),
        (error) => error === failure,
      );
      assert.equal(calls, 1, "a submitted task is never automatically replaced");
      assert.equal(accounted, 1, "the failed provider attempt is still accounted for");
    }
    let transientCalls = 0;
    assert.equal(
      await retry(async () => {
        if (++transientCalls === 1) throw new Error("Temporary failure");
        return "image";
      }),
      "image",
    );
    assert.equal(transientCalls, 2, "ordinary transient failures retain their retry");
    let busyCalls = 0;
    const busy = Object.assign(new Error("Busy"), { name: "BackgroundConnectionBusyError" });
    await assert.rejects(
      retry(async () => {
        busyCalls++;
        throw busy;
      }),
      (error) => error === busy,
    );
    assert.equal(busyCalls, 1, "admission failures remain deferrals");
  }

  // Execute the actual failed-post persistence path, with only provider/storage boundaries stubbed.
  const failure = Object.assign(new Error("Task already accepted"), { retryable: false });
  const finish = compile(read(`${slurp}features/feed/slp-post-media-operation.ts`), "finishSlurpPostImage", {
    slpIsAdmissionFailure: () => false,
    slpImageRetryable,
    logger: { warn() {} },
    getErrorMessage: (error: Error) => error.message,
    generateCreatorPostImage: async () => {
      throw failure;
    },
    slurpDeepDetailsImageRunRecorder: () => undefined,
  });
  const result = await finish({
    db: {},
    accountName: "Creator",
    draftImagePrompt: "Original prompt",
    resolveImageInput: async () => ({}),
    galleryFallback: async () => ({}),
    persist: async (extra: unknown) => extra,
    review: false,
    deepDetailsId: null,
    story: false,
    multi: false,
    shots: [],
    shootId: null,
  });
  assert.equal(result.post.imagePrompt, "Original prompt", "the prompt survives for a deliberate retry");
  assert.equal(result.post.metadata.imageGenerationRetryable, false);

  const source = read(`${slurp}data/feed/slp-feed-post-storage-1.ts`);
  const start = source.indexOf("    async listNoodlerPostsAwaitingImageRetry(");
  const end = source.indexOf("    // Unbounded", start);
  assert.ok(start >= 0 && end > start);
  const rows = [
    { id: "nonretryable", authorAccountId: "creator", metadata: JSON.stringify(result.post.metadata) },
    { id: "legacy", authorAccountId: "creator", metadata: JSON.stringify({ imageGenerationFailed: true }) },
    {
      id: "transient",
      authorAccountId: "creator",
      metadata: JSON.stringify({ imageGenerationFailed: true, imageGenerationRetryable: true }),
    },
  ];
  const query = {
    from() {
      return this;
    },
    where() {
      return this;
    },
    orderBy() {
      return this;
    },
    limit() {
      return rows;
    },
  };
  // The method's closure gets query helpers, not a replacement implementation of its policy.
  const selected = compile(`const storage = {${source.slice(start, end)}};`, "storage", {
    now: () => "2026-10-21T00:00:00Z",
    db: { select: () => query },
    slpPosts: {},
    and() {},
    isNull() {},
    isNotNull() {},
    desc() {},
    IMAGE_RETRY_SCAN_LIMIT: 20,
    imageClaimIsAvailable: () => true,
    parseRecord: JSON.parse,
    mapManagedPost: (row: unknown) => row,
    slpCreatorPostImageRetryAttempts,
    SLP_CREATOR_POST_IMAGE_RETRY_LIMIT,
  });
  selected.listNoodlerAccounts = async () => [{ id: "creator" }];
  assert.deepEqual(
    Array.from(await selected.listNoodlerPostsAwaitingImageRetry(10), (row: { id: string }) => row.id),
    ["legacy", "transient"],
  );
  assert.equal(
    await generateSlpImageWithRetry(async () => "deliberate retry"),
    "deliberate retry",
    "a new deliberate request is not globally blocked",
  );
  // Artwork backfill has its own delayed retry loop. Its brake survives a new operation context.
  const saved = new Map<string, string>();
  let artworkCalls = 0;
  let artworkFailure = true;
  let persistFailure = false;
  let clearFailure = false;
  const artworkContext = {
    slpImageRetryable,
    logger: { warn() {} },
    createAppSettingsStorage: () => ({
      get: async (key: string) => saved.get(key),
      set: async (key: string, value: string) => {
        if (persistFailure) throw new Error("Storage unavailable");
        saved.set(key, value);
      },
      remove: async (key: string) => {
        if (clearFailure) throw new Error("Storage unavailable");
        saved.delete(key);
      },
    }),
    tryCreatorAccountOperation: async (_id: string, run: () => Promise<unknown>) => ({
      acquired: true,
      value: await run(),
    }),
    resolveCreatorImageConnectionId: async () => null,
    createConnectionsStorage: () => ({ getDefaultForImageGeneration: async () => ({}) }),
    createSlurpStorage: () => store,
    unlinkCreatorAvatar: () => undefined,
    createCharactersStorage: () => ({}),
    createPromptOverridesStorage: () => ({}),
    generateCreatorPostImage: async () => {
      artworkCalls++;
      if (artworkFailure) throw failure;
      return { metadata: { noodlerMediaPath: "picture.png" } };
    },
    slpCreatorAvatarUrl: () => "/avatar",
    slpCreatorBannerUrl: () => "/banner",
  };
  const artworkSource = read(`${slurp}features/creators/slp-artwork-operation.ts`);
  const loadArtwork = () =>
    compile(
      artworkSource,
      "({ backfillCreatorArtwork, generateCreatorArtwork, generateSlpArtworkImage })",
      artworkContext,
    );
  const creator = {
    id: "creator",
    settings: { privacy: { identityDisclosure: "secret" } },
  };
  const store = {
    getNoodlerAccountById: async () => creator,
    getSettings: async () => ({}),
    resolveAccountSource: async () => null,
    updateNoodlerAvatar: async () => undefined,
    updateNoodlerBanner: async () => undefined,
  };
  const backfill = (operation = loadArtwork()) =>
    operation.backfillCreatorArtwork({}, store, { autoCreatorArtworkEnabled: true }, creator, "avatar");
  await assert.rejects(backfill(), (error) => error === failure);
  assert.equal(await backfill(), "idle", "saved nonretryable artwork is not replayed by a later poll or restart");
  assert.equal(artworkCalls, 1);
  artworkFailure = false;
  assert.equal(await loadArtwork().generateCreatorArtwork({}, { accountId: creator.id, kind: "avatar" }), "avatar");
  assert.equal(saved.size, 0, "successful deliberate artwork generation clears its brake");
  assert.equal(await backfill(), "avatar", "later artwork work is available after the deliberate success");
  assert.equal(artworkCalls, 3);
  clearFailure = true;
  assert.ok(
    await loadArtwork().generateSlpArtworkImage({}, "avatar", { account: creator }),
    "cleanup cannot turn a paid success into a new retry",
  );
  artworkFailure = true;
  persistFailure = true;
  await assert.rejects(
    loadArtwork().generateSlpArtworkImage({}, "avatar", { account: creator }),
    (error) => error === failure,
    "a persistence failure must retain the original nonretryable error",
  );
  console.log("Image retry policy regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
