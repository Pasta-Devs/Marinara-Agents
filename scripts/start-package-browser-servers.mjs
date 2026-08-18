import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { installPackageBrowserFixture } from "./install-package-browser-fixture.mjs";

const agentsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || resolve(agentsRoot, "../Marinara-Engine"));
const packageId = process.env.MARINARA_PACKAGE_ID;
if (!packageId) throw new Error("MARINARA_PACKAGE_ID is required");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packageId)) {
  throw new Error(`Invalid MARINARA_PACKAGE_ID: ${packageId}`);
}
if (!existsSync(resolve(engineRoot, "package.json"))) {
  throw new Error(`Compatible Marinara Engine checkout not found at ${engineRoot}`);
}

// Keep the engine data dir UNDER the engine's `packages/server/data`, which the engine dev script
// excludes from its file watcher (`tsx watch --ignore ./data`). The engine writes package
// capability snapshots to `<DATA_DIR>/capability-runtime-snapshots/...` and re-snapshots a package
// shortly after boot; with the data dir outside `./data` (the previous `.tmp/...` location) that
// re-snapshot unlinked the imported `server.mjs`, so `tsx watch` restarted the backend mid-suite and
// tests raced an ECONNREFUSED window. `packages/server/data` is gitignored in the engine checkout.
const dataRoot = resolve(engineRoot, "packages", "server", "data", "package-browser", packageId);
const children = new Set();
let shuttingDown = false;

function parsePort(name, fallback) {
  const value = process.env[name];
  return value && /^\d+$/.test(value) ? Number(value) : fallback;
}

const desktopClientPort = parsePort("PLAYWRIGHT_CLIENT_PORT", 5188);
const desktopServerPort = parsePort("PLAYWRIGHT_SERVER_PORT", 7981);
const mobileClientPort = parsePort("PLAYWRIGHT_MOBILE_CLIENT_PORT", 5189);
const mobileServerPort = parsePort("PLAYWRIGHT_MOBILE_SERVER_PORT", 7982);

function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? engineRoot,
    env: options.env ?? process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  child.once("error", (error) => {
    children.delete(child);
    console.error(`Failed to start ${command}: ${error instanceof Error ? error.message : error}`);
  });
  return child;
}

function stopChildren(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.killed || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else child.kill(signal);
  }
}

function runPnpm(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnChild("pnpm", args);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`pnpm ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });
}

async function waitForUrl(url) {
  const timeoutMs = Number.parseInt(process.env.DEV_SERVER_READY_TIMEOUT_MS ?? "180000", 10);
  const startedAt = Date.now();
  let lastError;
  while (!shuttingDown && Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`Package browser server did not become ready at ${url}: ${String(lastError)}`);
}

async function startProject(name, clientPort, serverPort) {
  const dataDir = resolve(dataRoot, name);
  await mkdir(dataDir, { recursive: true });
  await installPackageBrowserFixture({
    agentsRoot,
    engineRoot,
    dataDir,
    packageId,
  });
  const child = spawnChild(process.execPath, [resolve(engineRoot, "scripts/dev.mjs")], {
    env: {
      ...process.env,
      AUTO_CREATE_DEFAULT_CONNECTION: "false",
      AUTO_OPEN_BROWSER: "false",
      DATA_DIR: dataDir,
      DEV_PRESERVE_SHARED_DIST: "true",
      DEV_SERVER_READY_TIMEOUT_MS: "180000",
      DEV_SKIP_SHARED_BUILD: "true",
      LOG_DISABLE_REQUEST_LOGGING: "true",
      LOG_LEVEL: "silent",
      MARINARA_E2E_DISABLE_RATE_LIMIT: "true",
      MARINARA_ENV_FILE: resolve(dataDir, ".env"),
      MARINARA_GIT_BRANCH: "staging",
      PORT: String(serverPort),
      SKIP_PWA: "true",
      VITE_HOST: "127.0.0.1",
      VITE_OPEN_BROWSER: "false",
      VITE_PORT: String(clientPort),
    },
  });
  child.once("exit", (code, signal) => {
    if (shuttingDown) return;
    stopChildren();
    process.exitCode = code ?? (signal ? 1 : 0);
  });
  await waitForUrl(`http://127.0.0.1:${clientPort}`);
}

process.on("SIGINT", () => stopChildren("SIGINT"));
process.on("SIGTERM", () => stopChildren("SIGTERM"));
process.on("SIGHUP", () => stopChildren("SIGHUP"));
process.on("exit", () => stopChildren());

try {
  await rm(dataRoot, { recursive: true, force: true });
  await runPnpm(["--filter", "@marinara-engine/shared", "build:preserve"]);
  await startProject("mobile", mobileClientPort, mobileServerPort);
  await startProject("desktop", desktopClientPort, desktopServerPort);
} catch (error) {
  stopChildren();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
