import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const agentsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [packageId, testFile, ...playwrightArgs] = process.argv.slice(2);
if (!packageId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packageId)) {
  throw new Error(
    "Usage: node scripts/run-package-browser-tests.mjs <package-id> <test-file>",
  );
}
if (!testFile) throw new Error("A package Playwright test file is required");

const engineRoot = resolve(
  process.env.MARINARA_ENGINE_ROOT || resolve(agentsRoot, "../Marinara-Engine"),
);
for (const required of [
  resolve(engineRoot, "package.json"),
  resolve(agentsRoot, "packages", packageId, "manifest.json"),
  resolve(agentsRoot, testFile),
]) {
  if (!existsSync(required))
    throw new Error(`Required package-browser input is missing: ${required}`);
}

const executable =
  process.platform === "win32" ? "playwright.cmd" : "playwright";
const playwrightCommand = resolve(
  agentsRoot,
  "node_modules",
  ".bin",
  executable,
);
if (!existsSync(playwrightCommand))
  throw new Error("Run npm ci before package browser tests");

const environment = {
  ...process.env,
  MARINARA_ENGINE_ROOT: engineRoot,
  MARINARA_PACKAGE_ID: packageId,
};
if (environment.NO_COLOR !== undefined) {
  delete environment.NO_COLOR;
  environment.FORCE_COLOR = "0";
}
let serverProcess;
let serverProcessError;

function stopProcessTree(child, signal = "SIGTERM") {
  if (!child || child.exitCode !== null || child.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

async function waitForUrl(url) {
  const timeoutMs = Number.parseInt(
    process.env.DEV_SERVER_READY_TIMEOUT_MS ?? "180000",
    10,
  );
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    if (serverProcessError) {
      throw new Error(
        `Package browser server exited with an error: ${serverProcessError.message}`,
      );
    }
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(
        `Package browser server exited with ${serverProcess.exitCode}`,
      );
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(
    `Package browser server did not become ready at ${url}: ${String(lastError)}`,
  );
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => {
    stopProcessTree(serverProcess, signal);
    process.exit(signal === "SIGINT" ? 130 : 1);
  });
}

try {
  serverProcess = spawn(
    process.execPath,
    [resolve(agentsRoot, "scripts/start-package-browser-servers.mjs")],
    {
      cwd: agentsRoot,
      detached: process.platform !== "win32",
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  serverProcess.once("error", (error) => {
    serverProcessError = error;
  });
  await waitForUrl(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5188");

  const testProcess = spawn(
    playwrightCommand,
    [
      "test",
      testFile,
      "-c",
      "tests/playwright.package.config.ts",
      ...playwrightArgs,
    ],
    {
      cwd: agentsRoot,
      env: { ...environment, PLAYWRIGHT_SKIP_WEBSERVER: "true" },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const result = await new Promise((resolvePromise) => {
    testProcess.once("exit", (code, signal) =>
      resolvePromise({ code, signal }),
    );
  });
  if (result.signal) process.exitCode = 1;
  else process.exitCode = result.code ?? 1;
} finally {
  stopProcessTree(serverProcess);
}
