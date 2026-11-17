// The forge kit's Android local secret (#2357, #2358). It is read the way the Engine's `mari` CLI reads it: the
// MARINARA_ANDROID_SECRET variable, else the first line of MARINARA_ANDROID_SECRET_FILE or the home directory's
// .marinara-engine/android-secret, and only 64 hex characters count. Only a request to this device's Engine gets it.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { forgeEngineInjectHeaders, forgeEngineLocalHeaders } from "../sources/forge-kit/engine-local-auth.mjs";

const SECRET = "a1".repeat(32);
const OTHER = "B2".repeat(32);
const directory = await mkdtemp(join(tmpdir(), "forge-engine-local-auth-"));
const saved = Object.fromEntries(
  ["MARINARA_ANDROID_SECRET", "MARINARA_ANDROID_SECRET_FILE", "HOME", "USERPROFILE"].map((name) => [
    name,
    process.env[name],
  ]),
);
const restore = () => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
};
// No case may read the real home directory's secret file.
beforeEach(() => {
  restore();
  delete process.env.MARINARA_ANDROID_SECRET;
  process.env.MARINARA_ANDROID_SECRET_FILE = join(directory, "missing");
});
after(async () => {
  restore();
  await rm(directory, { recursive: true, force: true });
});
const secretFile = async (name, text) => {
  const path = join(directory, name);
  await writeFile(path, text);
  return path;
};
const sent = (url) => forgeEngineLocalHeaders(url, { accept: "application/json" });

test("a set secret goes to this device's Engine with the caller's headers, and to no other address", () => {
  process.env.MARINARA_ANDROID_SECRET = ` ${SECRET} `;
  for (const url of ["http://127.0.0.1:7860/api/connections", "https://localhost:7860/x", "http://[::1]:7860/x"]) {
    assert.deepEqual(sent(url), { accept: "application/json", "x-marinara-android-secret": SECRET }, url);
  }
  assert.deepEqual(forgeEngineLocalHeaders(new URL("http://LOCALHOST:1/")), { "x-marinara-android-secret": SECRET });
  const caller = { accept: "application/json" };
  for (const url of ["http://192.168.1.20:7860/api/connections", "https://example.com/", "/api/relative", ""]) {
    assert.equal(forgeEngineLocalHeaders(url, caller), caller, `${url || "no URL"} gets the caller's headers alone`);
  }
  assert.equal(forgeEngineLocalHeaders("http://10.0.0.2/"), undefined);
  assert.deepEqual(forgeEngineInjectHeaders(), { "x-marinara-android-secret": SECRET });
});

test("an invalid secret sends nothing, and a set variable is never replaced by the file", async () => {
  process.env.MARINARA_ANDROID_SECRET_FILE = await secretFile("ignored", `${OTHER}\n`);
  for (const value of ["not-hex", SECRET.slice(1), `${SECRET}0`, `${SECRET.slice(2)}zz`]) {
    process.env.MARINARA_ANDROID_SECRET = value;
    assert.deepEqual(sent("http://127.0.0.1:7860/"), { accept: "application/json" }, value);
    assert.deepEqual(forgeEngineInjectHeaders(), {});
  }
});

test("without the variable, the secret file's first line is the secret", async () => {
  process.env.MARINARA_ANDROID_SECRET = "   ";
  process.env.MARINARA_ANDROID_SECRET_FILE = await secretFile("crlf", `${OTHER}\r\nsecond line\r\n`);
  assert.deepEqual(forgeEngineInjectHeaders(), { "x-marinara-android-secret": OTHER });
  assert.deepEqual(sent("http://localhost:7860/"), { accept: "application/json", "x-marinara-android-secret": OTHER });
  for (const [name, text] of [
    ["short", "abc\n"],
    ["second-line", `\n${SECRET}\n`],
    ["empty", ""],
  ]) {
    process.env.MARINARA_ANDROID_SECRET_FILE = await secretFile(name, text);
    assert.deepEqual(forgeEngineInjectHeaders(), {}, name);
  }
  process.env.MARINARA_ANDROID_SECRET_FILE = join(directory, "no-such-file");
  assert.deepEqual(forgeEngineInjectHeaders(), {});
  // With no file named, the home directory's .marinara-engine/android-secret.
  delete process.env.MARINARA_ANDROID_SECRET_FILE;
  const home = join(directory, "home");
  await mkdir(join(home, ".marinara-engine"), { recursive: true });
  await writeFile(join(home, ".marinara-engine", "android-secret"), `${SECRET}\n`);
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  assert.deepEqual(forgeEngineInjectHeaders(), { "x-marinara-android-secret": SECRET });
});
