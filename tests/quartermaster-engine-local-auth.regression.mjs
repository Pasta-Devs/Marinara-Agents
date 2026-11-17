// Quartermaster's item picture route on an Android app install (#2358). The Engine there refuses the device's own
// requests without the app's local secret, so reading the connections and painting failed with 401. The real server
// runs with a fake host; only the Engine's two loopback answers are faked.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const SECRET = "e5".repeat(32);

async function generateItemImage() {
  const handlers = new Map();
  const router = Object.fromEntries(
    ["get", "post", "put", "patch", "delete"].map((method) => [
      method,
      (path, handler) => handlers.set(`${method.toUpperCase()} ${path}`, handler),
    ]),
  );
  const { activate } = await import("../packages/quartermaster/server.mjs");
  const release = await activate({
    dataDir: "unused",
    api: {
      runtime: {
        persistence: {
          documents: { getById: async () => ({ data: { items: [{ id: "apple", name: "Apple", location: "bag" }] } }) },
        },
        resources: {},
        logger: { debug() {}, info() {}, warn() {}, error() {} },
      },
      registerService: () => () => {},
      registerPromptContext: () => () => {},
      async registerPrivilegedRoutes(register) {
        await register(router);
        return () => {};
      },
    },
  });
  const sent = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    sent.push({ url: String(url), headers: { ...init.headers } });
    if (String(url).endsWith("/api/connections"))
      return Response.json([{ id: "images", provider: "image_generation", isDefault: true }]);
    return Response.json({ image: "data:image/png;base64,AAAA", prompt: "an apple" });
  };
  try {
    const route = handlers.get("POST /inventory/:chatId/:ownerId/items/:itemId/image/generate");
    const reply = { status: () => reply, send: (body) => ({ failed: body }) };
    const result = await route(
      { params: { chatId: "c", ownerId: "persona", itemId: "apple" }, body: { prompt: "an apple" } },
      reply,
    );
    assert.equal(result.imageDataUrl, "data:image/png;base64,AAAA", JSON.stringify(result));
    return sent;
  } finally {
    globalThis.fetch = originalFetch;
    release();
  }
}

test("on an Android app install the connection read and the paint carry the local secret", async () => {
  const saved = { secret: process.env.MARINARA_ANDROID_SECRET, file: process.env.MARINARA_ANDROID_SECRET_FILE };
  const directory = await mkdtemp(join(tmpdir(), "quartermaster-local-auth-"));
  process.env.MARINARA_ANDROID_SECRET = SECRET;
  try {
    const sent = await generateItemImage();
    assert.deepEqual(
      sent.map(({ url }) => new URL(url).pathname),
      ["/api/connections", "/api/characters/avatar-generation"],
    );
    for (const { url, headers } of sent) {
      assert.equal(new URL(url).hostname, "127.0.0.1");
      assert.equal(headers["x-marinara-android-secret"], SECRET, url);
    }
    assert.equal(sent[1].headers["Content-Type"], "application/json", "the paint keeps its own header");
    // An invalid secret is never sent.
    process.env.MARINARA_ANDROID_SECRET = "not-a-secret";
    for (const { headers } of await generateItemImage()) assert.equal(headers["x-marinara-android-secret"], undefined);
    // Without the variable, the secret file's first line.
    delete process.env.MARINARA_ANDROID_SECRET;
    process.env.MARINARA_ANDROID_SECRET_FILE = join(directory, "android-secret");
    await writeFile(process.env.MARINARA_ANDROID_SECRET_FILE, `${SECRET.toUpperCase()}\r\nnext line\r\n`);
    for (const { headers } of await generateItemImage())
      assert.equal(headers["x-marinara-android-secret"], SECRET.toUpperCase());
  } finally {
    for (const [name, value] of [
      ["MARINARA_ANDROID_SECRET", saved.secret],
      ["MARINARA_ANDROID_SECRET_FILE", saved.file],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
