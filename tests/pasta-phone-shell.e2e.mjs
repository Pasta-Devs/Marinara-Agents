// Pasta Phone — shell render/navigation check.
//
// Loads the built packages/pasta-phone/client.js into a page carrying the
// Engine's real theme tokens, then drives the shell the way a user does: open
// the sheet, tap all four apps, come back, close with Escape. Runs across both
// installed visual themes, light and dark, and a mobile viewport.
//
// It also guards the constraint that shaped this package: the Engine only emits
// Tailwind utilities listed in its capability-package-safelist.html, so the phone
// styles itself through a package-owned <style> block. The layout assertions below
// fail if that block stops being applied.
//
//   MARINARA_ENGINE_ROOT=../Marinara-Engine node tests/pasta-phone-shell.e2e.mjs
//
// Needs a headless-Chromium-capable box: a machine with no fonts installed
// produces zero-height line boxes and the text assertions will fail for that
// reason rather than a real regression.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const stylesRoot = join(engineRoot, "packages/client/src/styles");
const clientBundle = join(repoRoot, "packages/pasta-phone/client.js");
const PORT = Number(process.env.PASTA_PHONE_TEST_PORT || 8731);
const APPS = ["Noodle", "NoodleR", "Chats", "App Store"];

const HARNESS = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
<link rel="stylesheet" href="/styles/globals.css">
<style>
  body { margin:0; font-family: system-ui, sans-serif; background: var(--background,#111); min-height:100dvh; }
  .mari-chrome-control { border:1px solid var(--marinara-chat-chrome-button-border); background:var(--marinara-chat-chrome-button-bg); color:var(--marinara-chat-chrome-button-text); border-radius:.5rem; cursor:pointer; }
  .flex{display:flex}.h-9{height:2.25rem}.w-9{width:2.25rem}.items-center{align-items:center}.justify-center{justify-content:center}.p-0{padding:0}
</style></head><body>
<marinara-capability-pasta-phone view="toolbar"></marinara-capability-pasta-phone>
<script type="module" src="/client.js"></script>
</body></html>`;

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
const server = createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  try {
    if (url === "/") return res.writeHead(200, { "content-type": "text/html" }).end(HARNESS);
    if (!url.startsWith("/styles/") && url !== "/client.js") throw new Error("not found");
    const path = url.startsWith("/styles/") ? join(stylesRoot, url.slice(8)) : clientBundle;
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    // globals.css @imports "tailwindcss", which only the Vite plugin can resolve.
    // The phone needs the theme tokens, not the utilities, so a 404 here is fine.
    res.writeHead(404).end("not found");
  }
});
await new Promise((done) => server.listen(PORT, done));

const { chromium } = createRequire(join(engineRoot, "package.json"))("@playwright/test");
const browser = await chromium.launch();
const problems = [];

async function run(label, { theme, visual, width, height }) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.on("pageerror", (error) => problems.push(`${label}: pageerror ${error.message}`));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
  await page.evaluate(([t, v]) => {
    document.documentElement.setAttribute("data-theme", t);
    if (v) document.documentElement.setAttribute("data-visual-theme", v);
    else document.documentElement.removeAttribute("data-visual-theme");
  }, [theme, visual]);

  await page.click("marinara-capability-pasta-phone button");
  await page.waitForSelector("[data-pasta-phone-sheet]", { timeout: 5000 });
  await page.waitForTimeout(400);

  const sheet = page.locator("[data-pasta-phone-sheet]");
  const box = await sheet.boundingBox();
  if (!box || box.height < 100) problems.push(`${label}: sheet not laid out (${JSON.stringify(box)})`);
  const styled = await sheet.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius };
  });
  if (styled.bg === "rgba(0, 0, 0, 0)") problems.push(`${label}: sheet has no themed background`);
  if (styled.radius === "0px") problems.push(`${label}: package stylesheet not applied`);

  for (const app of APPS) {
    await page.click(`[data-pasta-phone-app]:has-text("${app}")`);
    await page.waitForSelector("[data-pasta-phone-app-screen]", { timeout: 5000 });
    const title = (await page.locator("[data-pasta-phone-app-title]").textContent())?.trim();
    if (title !== app) problems.push(`${label}: tapped ${app}, header said "${title}"`);
    const body = (await page.locator("[data-pasta-phone-app-body]").innerText()).trim();
    if (body.length < 40) problems.push(`${label}/${app}: screen looks empty`);
    await page.click("[data-pasta-phone-back]");
    await page.waitForSelector("[data-pasta-phone-launcher]", { timeout: 5000 });
  }

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  if (await page.locator("[data-pasta-phone-sheet]").count()) {
    problems.push(`${label}: Escape did not close the sheet`);
  }

  await context.close();
  console.log(`${label}: ok`);
}

try {
  await run("y2k-dark", { theme: "dark", visual: null, width: 1280, height: 900 });
  await run("y2k-light", { theme: "light", visual: null, width: 1280, height: 900 });
  await run("sillytavern-dark", { theme: "dark", visual: "sillytavern", width: 1280, height: 900 });
  await run("sillytavern-light", { theme: "light", visual: "sillytavern", width: 1280, height: 900 });
  await run("mobile", { theme: "dark", visual: null, width: 375, height: 667 });
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("\nPasta Phone shell: all themes, modes, and widths passed.");
