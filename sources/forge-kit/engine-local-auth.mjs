// An Android app install sets MARINARA_ANDROID_SECRET, and the Engine then refuses a request from the device itself
// that carries neither a session cookie nor this secret (its androidLocalAuthHook). A package's own server calls to
// Engine routes come from 127.0.0.1, over loopback fetch or app.inject, so they send the secret the way the Engine's
// `mari` CLI does (packages/server/src/bin/mari.ts): MARINARA_ANDROID_SECRET, else the first line of
// MARINARA_ANDROID_SECRET_FILE or ~/.marinara-engine/android-secret, and only 64 hex characters. Never log the value.
// Gacha Forge and Modern Life Sim paste this file into their bundles, so its imports and names carry the forge prefix.
import { readFileSync as forgeEngineLocalReadFile } from "node:fs";
import { homedir as forgeEngineLocalHome } from "node:os";
import { join as forgeEngineLocalJoin } from "node:path";

const FORGE_ENGINE_LOCAL_HEADER = "x-marinara-android-secret";
const FORGE_ENGINE_LOCAL_HEX = /^[a-f0-9]{64}$/iu;
const FORGE_ENGINE_LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
// ponytail: each secret file is read once per process, so a file rewritten while the Engine runs is seen after a
// restart; the upgrade path is reading it again after a 401.
const forgeEngineLocalFiles = new Map();

function forgeEngineLocalSecret() {
  const configured = process.env.MARINARA_ANDROID_SECRET?.trim();
  if (configured) return FORGE_ENGINE_LOCAL_HEX.test(configured) ? configured : "";
  const file =
    process.env.MARINARA_ANDROID_SECRET_FILE?.trim() ||
    forgeEngineLocalJoin(forgeEngineLocalHome(), ".marinara-engine", "android-secret");
  if (!forgeEngineLocalFiles.has(file)) {
    let stored;
    try {
      stored = forgeEngineLocalReadFile(file, "utf8").split(/\r?\n/u, 1)[0]?.trim() ?? "";
    } catch {
      stored = "";
    }
    forgeEngineLocalFiles.set(file, FORGE_ENGINE_LOCAL_HEX.test(stored) ? stored : "");
  }
  return forgeEngineLocalFiles.get(file);
}

/**
 * The plain header object `headers` (the caller's, kept as they are) plus the Android local secret when `url` is this
 * device's Engine (127.0.0.1, localhost or ::1) and a secret is set; otherwise `headers` itself, unchanged.
 */
export function forgeEngineLocalHeaders(url, headers) {
  let hostname;
  try {
    hostname = new URL(String(url)).hostname.toLowerCase();
  } catch {
    return headers;
  }
  const secret = FORGE_ENGINE_LOCAL_HOSTS.has(hostname) ? forgeEngineLocalSecret() : "";
  return secret ? { ...headers, [FORGE_ENGINE_LOCAL_HEADER]: secret } : headers;
}

/** Headers for the package's own app.inject calls, which always arrive from 127.0.0.1: the secret, or none. */
export function forgeEngineInjectHeaders() {
  const secret = forgeEngineLocalSecret();
  return secret ? { [FORGE_ENGINE_LOCAL_HEADER]: secret } : {};
}
