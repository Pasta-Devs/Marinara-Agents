import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const agentsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [packageId, testFile] = process.argv.slice(2);
if (!packageId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packageId)) {
  throw new Error("Usage: node scripts/run-package-browser-tests.mjs <package-id> <test-file>");
}
if (!testFile) throw new Error("A package Playwright test file is required");

const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || resolve(agentsRoot, "../Marinara-Engine"));
for (const required of [
  resolve(engineRoot, "package.json"),
  resolve(agentsRoot, "packages", packageId, "manifest.json"),
  resolve(agentsRoot, testFile),
]) {
  if (!existsSync(required)) throw new Error(`Required package-browser input is missing: ${required}`);
}

const executable = process.platform === "win32" ? "playwright.cmd" : "playwright";
const command = resolve(agentsRoot, "node_modules", ".bin", executable);
if (!existsSync(command)) throw new Error("Run npm ci before package browser tests");

const child = spawn(command, ["test", testFile, "-c", "tests/playwright.package.config.ts"], {
  cwd: agentsRoot,
  env: {
    ...process.env,
    MARINARA_ENGINE_ROOT: engineRoot,
    MARINARA_PACKAGE_ID: packageId,
  },
  stdio: "inherit",
  windowsHide: true,
});
child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
