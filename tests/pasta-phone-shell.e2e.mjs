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
<div id="detail-host"></div>
<script>
  // Stands in for the package's own routes plus the Engine's chat list, so this
  // test covers the UI against the real request shapes without booting an Engine.
  // The stored semantics themselves are checked directly against server.mjs in
  // tests/pasta-phone-groups.test.mjs.
  (() => {
    const chats = [
      { id: "chat-a", name: "Chat A", mode: "roleplay" },
      { id: "mock-chat-b", name: "Lorem Ipsum", mode: "conversation" },
      { id: "mock-chat-c", name: "Dolor Sit", mode: "game" },
    ];
    let groups = {};
    const detach = (chatId) => {
      for (const group of Object.values(groups)) {
        group.chatIds = group.chatIds.filter((id) => id !== chatId);
        if (!group.chatIds.length) delete groups[group.id];
      }
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    window.fetch = async (input, init = {}) => {
      const url = String(input);
      const method = (init.method || "GET").toUpperCase();
      const path = url.replace(/^https?:\\/\\/[^/]+/, "");
      const body = init.body ? JSON.parse(init.body) : {};
      const list = () => Object.values(groups);
      if (path === "/api/chats") return json(chats);
      if (path === "/api/pasta-phone/groups" && method === "GET") return json({ groups: list() });
      const forChat = path.match(/^\\/api\\/pasta-phone\\/groups\\/for-chat\\/(.+)$/);
      if (forChat) return json({ group: list().find((g) => g.chatIds.includes(decodeURIComponent(forChat[1]))) ?? null });
      if (path === "/api/pasta-phone/groups" && method === "POST") {
        detach(body.chatId);
        const group = { id: "grp_" + Object.keys(groups).length, name: body.name, chatIds: [body.chatId], createdAt: new Date().toISOString() };
        groups[group.id] = group;
        return json({ group }, 201);
      }
      const addTo = path.match(/^\\/api\\/pasta-phone\\/groups\\/([^/]+)\\/chats$/);
      if (addTo && method === "POST") {
        const id = decodeURIComponent(addTo[1]);
        const existing = groups[id];
        if (!existing) return json({ error: "gone" }, 404);
        detach(body.chatId);
        const surviving = groups[id] ?? { ...existing, chatIds: [] };
        groups[id] = surviving;
        if (!surviving.chatIds.includes(body.chatId)) surviving.chatIds = [...surviving.chatIds, body.chatId];
        return json({ group: surviving });
      }
      const removeFrom = path.match(/^\\/api\\/pasta-phone\\/groups\\/([^/]+)\\/chats\\/([^/]+)$/);
      if (removeFrom && method === "DELETE") {
        const id = decodeURIComponent(removeFrom[1]);
        const target = groups[id];
        if (!target) return json({ error: "gone" }, 404);
        target.chatIds = target.chatIds.filter((c) => c !== decodeURIComponent(removeFrom[2]));
        if (!target.chatIds.length) delete groups[id];
        return json({ removed: true, group: groups[id] ?? null });
      }
      return json({ error: "not found" }, 404);
    };
  })();
</script>
<script type="module" src="/client.js"></script>
<script>
  // Mirrors how the Engine's FeatureAgentDetailHost mounts the package: set
  // capabilityProps on the element, then let the custom element upgrade.
  window.mountDetail = (chatId, chatName, chatMode) => {
    const host = document.getElementById("detail-host");
    host.innerHTML = "";
    const el = document.createElement("marinara-capability-pasta-phone");
    el.setAttribute("view", "detail");
    el.capabilityProps = { chatId, chatName, chatMode };
    host.appendChild(el);
  };
</script>
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

// Group management + Chats app, driven through the detail view the Engine
// actually mounts. In-memory state only, so this asserts UI behaviour, not
// persistence — that arrives with the package-owned store.
async function runGroupFlow() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => problems.push(`groups: pageerror ${error.message}`));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.mountDetail("chat-a", "Chat A", "roleplay"));
  await page.waitForSelector("[data-pasta-phone-detail]", { timeout: 5000 });

  const openPhone = async () => {
    await page.click('[data-pasta-phone-detail] [data-pasta-phone-button="primary"]:has-text("Open Pasta Phone")');
    await page.waitForSelector("[data-pasta-phone-sheet]", { timeout: 5000 });
    await page.click('[data-pasta-phone-app]:has-text("Chats")');
    await page.waitForSelector("[data-pasta-phone-app-screen]", { timeout: 5000 });
  };
  const closePhone = async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  };

  // No group yet -> Chats must show the defensive empty state, not a blank list.
  await openPhone();
  if (!(await page.locator("[data-pasta-phone-empty]").count())) {
    problems.push("groups: Chats did not show the not-in-a-group empty state");
  }
  await closePhone();

  // Create a group from chat A.
  await page.click('[data-pasta-phone-detail] button:has-text("Create a new group")');
  await page.waitForSelector('[data-pasta-phone-detail] button:has-text("Add another chat")', { timeout: 5000 });

  // Add chat B to it.
  await page.click('[data-pasta-phone-detail] button:has-text("Add another chat")');
  await page.click('[data-pasta-phone-picker] button:has-text("Lorem Ipsum")');
  await page.waitForTimeout(200);

  await openPhone();
  let names = await page.locator("[data-pasta-phone-chat-name]").allInnerTexts();
  if (names.length !== 2) problems.push(`groups: expected 2 member chats, got ${names.length}: ${names.join(", ")}`);
  if (!names.some((n) => n.includes("Chat A"))) problems.push("groups: Chat A missing from the group list");
  if (!names.some((n) => n.includes("Lorem Ipsum"))) problems.push("groups: added chat missing from the group list");
  const modes = await page.locator("[data-pasta-phone-chat-preview]").allInnerTexts();
  if (!modes.some((m) => m.includes("Roleplay"))) problems.push(`groups: chat mode not shown (${modes.join(" | ")})`);
  if (await page.locator("[data-pasta-phone-open-chat]:not([disabled])").count()) {
    problems.push("groups: Open action should stay disabled until the Engine exposes chat navigation");
  }
  await closePhone();

  // Removing the current chat leaves the group intact for its other member.
  await page.click('[data-pasta-phone-detail] button:has-text("Remove this chat")');
  await page.waitForSelector('[data-pasta-phone-detail] button:has-text("Create a new group")', { timeout: 5000 });
  await openPhone();
  names = await page.locator("[data-pasta-phone-chat-name]").allInnerTexts();
  if (!(await page.locator("[data-pasta-phone-empty]").count())) {
    problems.push(`groups: removed chat should fall back to the empty state, saw ${names.join(", ")}`);
  }
  await closePhone();

  await context.close();
  console.log("group-flow: ok");
}

try {
  await runGroupFlow();
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
