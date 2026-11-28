// Modern Life Sim on an Android app install (#2358). The Engine there refuses the device's own requests without the
// app's local secret, so the loopback client's reads and paints failed with 401. The committed server.mjs runs with a
// fake host; only the Engine's answers are faked. HOST can point the client at another address, which never gets it.
// The committed bundle must also be what its bundle-patches.json replays, so a forge kit change is rebuilt into it.
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { rebuildGachaBundles } from "../scripts/gacha-forge-bundle-patches.mjs";

const SECRET = "a7".repeat(32);
const names = ["MARINARA_ANDROID_SECRET", "MARINARA_ANDROID_SECRET_FILE", "ADMIN_SECRET", "PORT", "HOST"];
const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
const directory = await mkdtemp(join(tmpdir(), "modern-life-sim-local-auth-"));
after(async () => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  await rm(directory, { recursive: true, force: true });
});
const { createService } = await import("../packages/modern-life-sim/server.mjs");

/** The `GET /resources` route's Engine requests, with the environment the package reads. */
async function resourceRequests(env) {
  for (const name of names) delete process.env[name];
  process.env.MARINARA_ANDROID_SECRET_FILE = join(directory, "no-secret-file");
  Object.assign(process.env, env);
  const sent = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    sent.push({ url: new URL(url), headers: { ...init.headers } });
    return Response.json([]);
  };
  try {
    const quiet = () => {};
    const service = createService({
      runtime: { persistence: { documents: {} }, logger: { debug: quiet, info: quiet, warn: quiet, error: quiet } },
    });
    const handlers = new Map();
    service.routes(
      Object.fromEntries(
        ["get", "post", "put", "patch", "delete"].map((method) => [
          method,
          (path, handler) => handlers.set(path, handler),
        ]),
      ),
    );
    const resources = await handlers.get("/resources")({ headers: {}, url: "/resources" }, { code() {} });
    assert.deepEqual(resources.problems, [], JSON.stringify(resources.problems));
    return sent;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("every Engine request carries the local secret beside the admin secret, and only on this device", async () => {
  const local = await resourceRequests({ PORT: "7860", MARINARA_ANDROID_SECRET: SECRET, ADMIN_SECRET: "admin" });
  assert.ok(local.length >= 5, "personas, cards, groups, connections and the style profiles");
  assert.ok(local.some(({ url }) => url.pathname === "/api/app-settings/ui"));
  for (const { url, headers } of local) {
    assert.equal(url.origin, "http://127.0.0.1:7860");
    assert.equal(headers["x-marinara-android-secret"], SECRET, url.pathname);
    assert.equal(headers["X-Admin-Secret"], "admin", url.pathname);
    assert.equal(headers.accept, "application/json");
  }
  const lan = await resourceRequests({ PORT: "7860", HOST: "192.168.1.20", MARINARA_ANDROID_SECRET: SECRET });
  assert.ok(lan.length >= 5);
  for (const { url, headers } of lan) {
    assert.equal(url.origin, "http://192.168.1.20:7860");
    assert.equal(headers["x-marinara-android-secret"], undefined, "another address never gets the secret");
  }
  // Without a secret the requests are as they were.
  for (const { headers } of await resourceRequests({ PORT: "7860" }))
    assert.deepEqual(headers, { accept: "application/json" });
});

test("the committed server.mjs is the replay of its bundle-patches.json on the current forge kit", async () => {
  const root = join(directory, "replay");
  const packageRoot = join(root, "packages/modern-life-sim");
  await mkdir(packageRoot, { recursive: true });
  for (const file of ["server.mjs", "bundle-patches.json"]) {
    await cp(new URL(`../packages/modern-life-sim/${file}`, import.meta.url), join(packageRoot, file));
  }
  await cp(new URL("../sources/forge-kit/", import.meta.url), join(root, "sources/forge-kit"), { recursive: true });
  const committed = await readFile(join(packageRoot, "server.mjs"));
  await rebuildGachaBundles(pathToFileURL(`${packageRoot}/`));
  assert.ok((await readFile(join(packageRoot, "server.mjs"))).equals(committed), "rebuild Modern Life Sim");
});
