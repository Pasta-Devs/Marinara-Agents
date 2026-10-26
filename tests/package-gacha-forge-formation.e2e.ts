import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to the validated Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const nativeImport = new Function("url", "return import(url)");
const portrait =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360"><rect width="240" height="360" fill="#29334e"/><path d="M120 24 218 322H22Z" fill="#72bde7"/><circle cx="120" cy="110" r="32" fill="#f0c879"/></svg>',
  );
const kit = () => ({
  version: 1,
  preferredRow: "front",
  standard: {
    name: "Kindled strike",
    description: "An elemental strike.",
    effect: "damage",
    target: "enemy",
    power: 100,
    cost: 0,
    duration: 2,
  },
  ultimate: {
    name: "Lighthouse dawn",
    description: "Release saved energy.",
    effect: "damage",
    target: "enemy",
    power: 200,
    cost: 2,
    elementCost: 0,
    duration: 2,
  },
  passive: {
    name: "Steady watch",
    description: "Hold the line.",
    effect: "shield",
    target: "self",
    power: 0,
    duration: 2,
    trigger: "turn_start",
    row: "both",
  },
  traits: [],
});

async function openForge(page: Page, testInfo: TestInfo, theme: string, mode = "classic") {
  const { createChapterRuntime, chapterRunId, chapterUnitId, freshMainPlan } = await nativeImport(
    pathToFileURL(resolve(__dirname, "fixtures/gacha-forge-chapter-runtime.mjs")).href,
  );
  const runtime = await createChapterRuntime({ port: 7856 + testInfo.parallelIndex });
  const transact = runtime.persistence.transaction;
  let tail = Promise.resolve();
  runtime.persistence.transaction = (operation: any) => {
    const next = tail.then(() => transact(operation));
    tail = next.catch(() => {});
    return next;
  };
  const run = runtime.docs.get("index").data.runs[0];
  run.combat = { mode, revision: 0 };
  run.audio = { tts: false, generate: false, muted: true, combatVoices: false };
  const heroId = `${chapterRunId}:unit:protagonist`;
  const unit = (id: string, name: string, affinity: string) => ({
    unitId: id,
    kind: "character",
    name,
    rarity: 5,
    role: "Warrior",
    affinity,
    identitySex: "female",
    portrait,
    stats: { hp: 100, atk: 100, def: 100, spd: 100 },
    skill: { name: "Classic strike", description: "Classic.", effect: "damage", target: "enemy", power: 100 },
    passive: {
      name: "Watch",
      description: "Stay steady.",
      effect: "shield",
      target: "self",
      power: 0,
      trigger: "battle_start",
    },
    ...(mode === "formation" ? { formationKit: kit() } : {}),
  });
  const seed = (id: string, kind: string, data: any) =>
    runtime.docs.set(id, { id, packageId: "gacha-forge", kind, revision: 1, name: id, data: structuredClone(data) });
  seed(heroId, "unit", { ...unit(heroId, "Mari", "Fire"), isProtagonist: true });
  seed(chapterUnitId, "unit", { ...unit(chapterUnitId, "Arden", "Water"), cardId: "chapter-proof-arden-card" });
  const supportId = `${chapterRunId}:unit:vale`;
  seed(supportId, "unit", unit(supportId, "Vale", "Wind"));
  const session = runtime.session();
  session.roster[heroId] = { level: 20 };
  session.roster[supportId] = { level: 20 };
  session.wallet.vigor = 1000;
  session.presets = [
    { name: "Three keepers", board: { front: ["leader", null, null], back: [chapterUnitId, supportId, null] } },
  ];
  session.activePreset = 0;
  session.progress = { 1: { normal: 10 }, 2: { normal: 4 } };
  seed(`${chapterRunId}:combat:2:1`, "combat", {
    chapter: 2,
    combatIndex: 1,
    enemy: "Gate sentinel",
    opening: "The sentinel waits.",
    objective: "Defeat the sentinel.",
    outcomeOnWin: "The gate opens.",
    formation: [
      {
        ...unit("enemy-0", "Sentinel", "Earth"),
        tier: "boss",
        stats: { hp: 800, atk: 1, def: 1, spd: 1 },
        formationKit: kit(),
        mech: ["phases"],
      },
    ],
    dialogueCues: [],
  });
  runtime.transport.stage = "formation";
  runtime.transport.reply = () => JSON.stringify(kit());
  const saved = () => ({
    ...runtime.docs.get("index").data.runs[0],
    name: "Formation proof",
    hudStyle: "vanguard",
    hasStandardBanner: true,
    storyUnwritten: false,
    storyDeferred: false,
    progress: session.progress,
    audio: run.audio,
  });
  const requests: { path: string; body: any }[] = [];
  await page.setViewportSize(
    testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ version, theme }) => {
      localStorage.removeItem("marinara-active-chat-id");
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { theme, hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false },
          version: 65,
        }),
      );
    },
    { version: appVersion, theme },
  );
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/api/gacha-forge/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/gacha-forge", "");
    if (path === "/state")
      return route.fulfill({
        json: {
          runs: [saved()],
          activeRunId: chapterRunId,
          activeRun: saved(),
          guidesSeen: ["welcome", "home", "chapter", "beat", "combat"],
        },
      });
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : {};
    if (path.startsWith("/combat-mode/") || ["/battle", "/battle/start", "/run/sources"].includes(path)) {
      requests.push({ path, body });
      const response = await runtime.post(path, body);
      return route.fulfill({ status: response.status, json: response.body });
    }
    if (path === "/setup/draft") {
      requests.push({ path, body });
      return route.fulfill({ json: { ok: true, draft: null } });
    }
    return route.fulfill({
      json:
        path === "/preforge"
          ? { ok: true, preforge: { mode: "off", locked: false, canAuto: false } }
          : { ok: true, chapters: [], locations: [], memory: { phase: "ready", retryable: false } },
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect.poll(() => forge.evaluate((node) => (node as any)._boot)).toBe("ready");
  await forge.evaluate((node) => {
    const game = node as any;
    game._clearBeat();
    game._bannerReady = true;
    game._artReady = true;
    game._planEscaped = true;
    game._storyUnwritten = false;
    game._storyWriteAsked = false;
    game._hudView = "settings";
    game._settingsCategory = "continuity";
    game._guide = "";
    game._guidesSeen.add("combat");
    game._renderKey = null;
    game._renderBrowser();
  });
  return { runtime, forge, requests, chapterRunId, freshMainPlan };
}

async function readable(item: Locator) {
  await item.scrollIntoViewIfNeeded();
  const box = await item.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      width: innerWidth,
      height: innerHeight,
      text: node.textContent,
    };
  });
  expect(box.top).toBeGreaterThanOrEqual(-1);
  expect(box.bottom).toBeLessThanOrEqual(box.height + 1);
  expect(box.left).toBeGreaterThanOrEqual(-1);
  expect(box.right).toBeLessThanOrEqual(box.width + 1);
  return box;
}

for (const theme of ["dark", "light"]) {
  test(`new playthrough setup retains the explicitly chosen combat mode · ${theme}`, async ({ page }, testInfo) => {
    const { runtime, forge, requests } = await openForge(page, testInfo, theme);
    try {
      await forge.evaluate((node) => {
        const game = node as any;
        game._creatingNew = true;
        game._showRuns = false;
        game._setupDraftAsked = true;
        game._setupDraftSettled = true;
        game._setupDraft = {
          values: { combatMode: "classic", scenario: "A lighthouse garden.", name: "New keepers" },
          step: 1,
          furthest: 1,
          hudStyle: "vanguard",
        };
        game._renderKey = null;
        game._renderBrowser();
      });
      const classic = forge.locator('[data-forge-combat-mode][value="classic"]');
      const formation = forge.locator('[data-forge-combat-mode][value="formation"]');
      const picker = forge.locator(".gf-combat-mode-setup");
      await expect(picker.getByRole("radio", { name: "Classic", exact: true })).toHaveCount(1);
      await expect(picker.getByRole("radio", { name: "Formation", exact: true })).toHaveCount(1);
      await expect(forge.locator(".gf-combat-mode-setup + .ob-help")).toHaveCount(0);
      for (const [radio, description] of [
        [classic, "The existing turn-based combat system."],
        [formation, "Frontline fighters act while back-row supports supply shared elemental energy."],
      ] as const) {
        const hintId = await radio.getAttribute("aria-describedby");
        expect(hintId).toBeTruthy();
        const hint = picker.locator(`[id=${JSON.stringify(hintId)}]`);
        await expect(hint).toContainText(description);
        await readable(hint);
        expect((await hint.boundingBox())!.width).toBeGreaterThan(150);
        expect((await radio.locator("..").boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await expect(classic).toBeChecked();
      await expect(formation).not.toBeChecked();
      await formation.check();
      await expect(formation).toBeChecked();
      await expect(classic).not.toBeChecked();
      await readable(formation.locator(".."));
      await page.screenshot({ path: testInfo.outputPath(`formation-setup-${theme}.png`) });
      await forge.locator("[data-cancel]").click();
      await expect
        .poll(() =>
          requests
            .filter((request) => request.path === "/setup/draft")
            .some((request) => request.body.snapshot?.values?.combatMode === "formation"),
        )
        .toBe(true);
      expect(runtime.docs.get("index").data.runs[0].combat.mode).toBe("classic");
    } finally {
      await runtime.close();
    }
  });
  test(`a Formation unit shows its kit on the Skills tab only · ${theme}`, async ({ page }, testInfo) => {
    const { runtime, forge, chapterRunId } = await openForge(page, testInfo, theme, "formation");
    try {
      const id = `${chapterRunId}:unit:vale`;
      await forge.evaluate(
        (node, unit) => {
          const game = node as any;
          game._hudView = "roster";
          game._rosterUnitId = unit.id;
          game._unit = unit;
          game._unitState = "ready";
          game._unitTab = "skills";
          game._renderBrowser();
        },
        { ...runtime.docs.get(id)!.data, id },
      );
      // The first visit opens the Skills guide over the card.
      const guide = forge.getByRole("button", { name: "Close", exact: true });
      await guide.click({ timeout: 3000 }).catch(() => {});
      const panel = forge.locator('[data-screen="unit"] .cp-panel');
      const rows = panel.locator(".sk-row");
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText("Standard ability");
      await expect(rows.nth(0)).toContainText("Kindled strike");
      await expect(rows.nth(1)).toContainText("Lighthouse dawn");
      await expect(rows.nth(2)).toContainText("Steady watch");
      await expect(rows.nth(2)).toContainText("Turn start · Either row");
      // Damage and shields resolve at once, so neither shows a duration.
      await expect(rows.nth(0)).not.toContainText("turns");
      await expect(rows.nth(2)).toContainText("Shield · self");
      await expect(rows.nth(2)).not.toContainText("turns");
      await expect(panel).not.toContainText("Classic strike");
      await page.screenshot({ path: testInfo.outputPath(`formation-unit-skills-${theme}.png`) });
      await forge.locator('[data-screen="unit"] [role="tab"][data-tab="stats"]').click();
      await expect(panel).not.toContainText("Formation combat");
      await expect(panel).not.toContainText("Kindled strike");
    } finally {
      await runtime.close();
    }
  });

  test(`Formation warning preserves Cancel and converts only on Confirm · ${theme}`, async ({ page }, testInfo) => {
    const { runtime, forge, requests } = await openForge(page, testInfo, theme);
    try {
      const section = forge.locator("[data-forge-combat-mode-settings]"),
        ask = section.locator("[data-forge-combat-switch]");
      await expect(ask).toBeEnabled();
      const before = structuredClone(runtime.docs);
      await ask.click();
      await expect(section.getByRole("heading", { name: "Change this playthrough’s combat mode?" })).toBeVisible();
      await expect(section.locator("[data-forge-combat-keep]")).toBeFocused();
      const geometry = [];
      for (const paragraph of await section.locator("h4,p").all()) geometry.push(await readable(paragraph));
      writeFileSync(testInfo.outputPath(`formation-warning-${theme}.json`), JSON.stringify(geometry, null, 2));
      await section.locator("[data-forge-combat-keep]").click();
      await expect(section.locator("[data-forge-combat-switch]")).toBeFocused();
      expect(requests.filter((request) => request.path === "/combat-mode/switch")).toEqual([]);
      expect(runtime.docs).toEqual(before);
      await section.locator("[data-forge-combat-switch]").click();
      await section.locator("[data-forge-combat-confirm]").scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`formation-confirmation-${theme}.png`) });
      await section.locator("[data-forge-combat-confirm]").click();
      await expect(section.getByRole("heading", { name: "Combat mode: Formation", exact: true })).toBeVisible();
      expect(requests.filter((request) => request.path === "/combat-mode/switch")).toHaveLength(1);
      expect(runtime.docs.get("index").data.runs[0].combat.mode).toBe("formation");
      expect(runtime.session().wallet).toEqual(
        before.get(`${runtime.docs.get("index").data.runs[0].runId}:session`)!.data.wallet,
      );
    } finally {
      await runtime.close();
    }
  });
  test(`Formation energy, actions and the correct elemental Ultimate portrait · ${theme}`, async ({
    page,
  }, testInfo) => {
    const { runtime, forge, chapterRunId, freshMainPlan } = await openForge(page, testInfo, theme, "formation");
    try {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const response = (await runtime.post("/battle", { chapter: 2, combatIndex: 1, difficulty: "normal" })).body;
      expect(response.ok).toBe(true);
      expect(response.combatMode).toBe("formation");
      await forge.evaluate(
        (node, input) => {
          const game = node as any;
          let seed = 2166136261;
          for (const character of String(input.payload.battleKey)) {
            seed ^= character.charCodeAt(0);
            seed = Math.imul(seed, 16777619);
          }
          game._plan = input.plan;
          game._planChapter = 2;
          game._planState = "ready";
          game._difficulty = "normal";
          game._combat = input.payload;
          game._combatNode = { chapter: 2, combatIndex: 1, nodeIndex: 4, difficulty: "normal", title: "Gate sentinel" };
          game._combatSeed = seed >>> 0;
          game._combatPhase = "prebattle";
          game._hudView = "combat";
          game._combatAuto = false;
          game._guide = "";
          game._renderKey = null;
          game._renderBrowser();
          game._startBattle();
        },
        { payload: response, plan: freshMainPlan, runId: chapterRunId },
      );
      const turn = forge.locator("[data-formation-turn]");
      await expect(turn).toBeVisible();
      const bank = turn.locator("[data-formation-bank]");
      await expect(bank).toBeVisible();
      await expect(bank.locator("span")).toHaveCount(6);
      const bankGeometry = await bank.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const parent = node.closest("form")!.getBoundingClientRect();
        return {
          top: box.top,
          bottom: box.bottom,
          left: box.left,
          right: box.right,
          parentTop: parent.top,
          parentBottom: parent.bottom,
          parentLeft: parent.left,
          parentRight: parent.right,
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
        };
      });
      expect(bankGeometry.top).toBeGreaterThanOrEqual(bankGeometry.parentTop - 1);
      expect(bankGeometry.bottom).toBeLessThanOrEqual(bankGeometry.parentBottom + 1);
      expect(bankGeometry.left).toBeGreaterThanOrEqual(bankGeometry.parentLeft - 1);
      expect(bankGeometry.right).toBeLessThanOrEqual(bankGeometry.parentRight + 1);
      expect(bankGeometry.scrollWidth).toBeLessThanOrEqual(bankGeometry.clientWidth + 1);
      writeFileSync(testInfo.outputPath(`formation-bank-${theme}.json`), JSON.stringify(bankGeometry, null, 2));
      const contrast = await turn.getByRole("button", { name: "Confirm action" }).evaluate((node) => {
        const style = getComputedStyle(node);
        const luminance = (color: string) => {
          const rgb = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((value) => {
              const channel = value / 255;
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        const foreground = luminance(style.color),
          background = luminance(style.backgroundColor);
        return {
          foreground: style.color,
          background: style.backgroundColor,
          ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
        };
      });
      expect(contrast.background).not.toBe("rgba(0, 0, 0, 0)");
      expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
      writeFileSync(testInfo.outputPath(`formation-confirm-contrast-${theme}.json`), JSON.stringify(contrast, null, 2));
      await expect(turn.locator('select[name="action"] option[value="ultimate"]')).toBeEnabled();
      await turn.locator('select[name="action"]').selectOption("ultimate");
      await expect(turn.locator("[data-formation-mover-label]")).toBeHidden();
      await expect(turn.locator("[data-formation-swap-label]")).toBeHidden();
      await expect(turn.locator("[data-formation-payment]")).toBeVisible();
      await readable(turn.getByRole("button", { name: "Confirm action" }));
      await page.screenshot({ path: testInfo.outputPath(`formation-actions-${theme}.png`) });
      await turn.getByRole("button", { name: "Confirm action" }).click();
      const cutin = forge.locator(".gf-ultimate-portrait");
      await expect(cutin).toBeVisible();
      await expect(cutin).toHaveAttribute("data-element", "fire");
      await expect(cutin.locator("img")).toHaveAttribute("src", portrait);
      expect(await cutin.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
      await page.screenshot({ path: testInfo.outputPath(`formation-ultimate-${theme}.png`) });
      await expect(cutin).toHaveCount(0);
    } finally {
      await runtime.close();
    }
  });
}
