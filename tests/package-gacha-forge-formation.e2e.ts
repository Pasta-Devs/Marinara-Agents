import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to the validated Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const nativeImport = new Function("url", "return import(url)");
const art = (back: string, body: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360"><rect width="240" height="360" fill="${back}"/><path d="M120 24 218 322H22Z" fill="${body}"/><circle cx="120" cy="110" r="32" fill="#f0c879"/></svg>`,
  );
const portrait = art("#29334e", "#72bde7");
const portraits = [
  portrait,
  art("#3a2430", "#e8735a"),
  art("#1f3a2e", "#7fd1a8"),
  art("#2c2546", "#b59cf0"),
  art("#3b3420", "#f2c75c"),
  art("#1d2f40", "#8fc7f0"),
];
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

async function openForge(
  page: Page,
  testInfo: TestInfo,
  theme: string,
  mode = "classic",
  { six = false, viewport }: { six?: boolean; viewport?: { width: number; height: number } } = {},
) {
  const { createChapterRuntime, chapterRunId, chapterUnitId, freshMainPlan } = await nativeImport(
    pathToFileURL(resolve(__dirname, "fixtures/gacha-forge-chapter-runtime.mjs")).href,
  );
  const runtime = await createChapterRuntime({ port: 7856 + testInfo.parallelIndex });
  // A connection with room for the kit prompt and the answer it reserves.
  runtime.transport.maxContext = 262144;
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
  const unit = (id: string, name: string, affinity: string, index = 0, overrides: any = {}) => ({
    unitId: id,
    kind: "character",
    name,
    rarity: 5,
    role: "Warrior",
    affinity,
    identitySex: "female",
    portrait: portraits[index % portraits.length],
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
    ...(mode === "formation" ? { formationKit: kit(), formationKitPrompt: 2 } : {}),
    ...overrides,
  });
  const seed = (id: string, kind: string, data: any) =>
    runtime.docs.set(id, { id, packageId: "gacha-forge", kind, revision: 1, name: id, data: structuredClone(data) });
  seed(heroId, "unit", { ...unit(heroId, "Mari", "Fire"), isProtagonist: true });
  seed(chapterUnitId, "unit", { ...unit(chapterUnitId, "Arden", "Water"), cardId: "chapter-proof-arden-card" });
  const supportId = `${chapterRunId}:unit:vale`;
  seed(supportId, "unit", unit(supportId, "Vale", "Wind", 2));
  const session = runtime.session();
  session.roster[heroId] = { level: 20 };
  session.roster[supportId] = { level: 20 };
  session.wallet.vigor = 1000;
  session.presets = [
    { name: "Three keepers", board: { front: ["leader", null, null], back: [chapterUnitId, supportId, null] } },
  ];
  const extra: string[] = [];
  if (six) {
    // A full team: three fighters in front, three supports behind.
    const backKit = () => ({
      ...kit(),
      preferredRow: "back",
      standard: { ...kit().standard, name: "Soft chime", effect: "heal", target: "ally", power: 6, cost: 1 },
      ultimate: {
        ...kit().ultimate,
        name: "Second dawn",
        description: "Every fallen ally returns.",
        effect: "revive",
        target: "allies",
        power: 60,
        cost: 6,
        elementCost: 2,
      },
      passive: {
        ...kit().passive,
        name: "Hymn of resolve",
        description: "Allies grow bolder at each turn start.",
        effect: "buff",
        target: "allies",
        stat: "atk",
        power: 15,
        duration: 1,
        row: "back",
      },
    });
    const roster = [
      ["kaveh", "Kaveh", "Earth", { formationKit: { ...kit(), preferredRow: "hybrid" } }],
      ["pulcinella", "Pulcinella", "Dark", {}],
      ["nahida", "Nahida", "Light", { formationKit: backKit() }],
    ] as const;
    roster.forEach(([slug, name, affinity, overrides], index) => {
      const id = `${chapterRunId}:unit:${slug}`;
      seed(id, "unit", unit(id, name, affinity, index + 3, overrides));
      session.roster[id] = { level: 20 };
      extra.push(id);
    });
    session.presets = [
      {
        name: "Six keepers",
        board: { front: ["leader", extra[0], extra[1]], back: [chapterUnitId, supportId, extra[2]] },
      },
    ];
  }
  session.activePreset = 0;
  session.progress = { 1: { normal: 10 }, 2: { normal: 4 } };
  seed(`${chapterRunId}:combat:2:1`, "combat", {
    chapter: 2,
    combatIndex: 1,
    enemy: "Gate sentinel",
    opening: "The sentinel waits.",
    objective: "Defeat the sentinel.",
    outcomeOnWin: "The gate opens.",
    formation: six
      ? [
          {
            ...unit("enemy-0", "Leyshell Warden", "Earth", 1),
            tier: "boss",
            position: "front",
            stats: { hp: 900, atk: 20, def: 40, spd: 1 },
            formationKit: { ...kit(), traits: [{ kind: "front_tokens", power: 20 }] },
            mech: ["phases"],
          },
          {
            ...unit("enemy-1", "Leyshell Blade", "Wind", 4),
            tier: "soldier",
            position: "front",
            stats: { hp: 300, atk: 20, def: 20, spd: 1 },
            formationKit: kit(),
          },
          {
            ...unit("enemy-2", "Leyshell Caster", "Water", 5),
            tier: "soldier",
            position: "back",
            stats: { hp: 200, atk: 10, def: 20, spd: 1 },
            formationKit: { ...kit(), preferredRow: "back" },
          },
        ]
      : [
          {
            ...unit("enemy-0", "Sentinel", "Earth"),
            tier: "boss",
            stats: { hp: 800, atk: 1, def: 1, spd: 1 },
            formationKit: kit(),
            mech: ["phases"],
          },
        ],
    ...(six
      ? { formationRules: [{ kind: "defeat_order", order: [1, 0], description: "Fell the Blade before the Warden." }] }
      : {}),
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
    viewport || (testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 }),
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
    if (
      path.startsWith("/combat-mode/") ||
      ["/battle", "/battle/start", "/run/sources", "/formation", "/formation/save"].includes(path)
    ) {
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
  return { runtime, forge, requests, chapterRunId, freshMainPlan, extra };
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

async function startBattle(forge: Locator, runtime: any, plan: any) {
  // The preview names the engine and rules, as the game's own request does.
  const { FORGE_FORMATION_ENGINE, FORGE_FORMATION_RULES } = await nativeImport(
    pathToFileURL(resolve(__dirname, "../packages/gacha-forge/src/formation-combat-shared.mjs")).href,
  );
  const response = (
    await runtime.post("/battle", {
      chapter: 2,
      combatIndex: 1,
      difficulty: "normal",
      expectedFormationEngine: FORGE_FORMATION_ENGINE,
      expectedFormationRules: FORGE_FORMATION_RULES,
    })
  ).body;
  expect(response.ok, JSON.stringify(response)).toBe(true);
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
    { payload: response, plan },
  );
  return response;
}

// On a phone the boss plate sits over the top of the enemy line; in Formation the cards start below the bar, so
// their FRONT/BACK tags and defeat-order badges stay visible.
async function clearOfBar(forge: Locator, testInfo: TestInfo) {
  const measured = await forge.evaluate((node) => {
    const root = (node as any).shadowRoot || node;
    const bar = root.querySelector(".cbar")!.getBoundingClientRect();
    const cards = [...root.querySelectorAll(".side.enemies .cbt")].map((card: any) => card.getBoundingClientRect().top);
    const badge = root.querySelector(".gf-forder");
    const box = badge?.getBoundingClientRect();
    // The badge ignores the pointer; let it take one just long enough to ask what is on top at its centre.
    if (badge) badge.style.pointerEvents = "auto";
    const hit = box ? root.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
    if (badge) badge.style.pointerEvents = "";
    return { bar: bar.bottom, cards, badgeVisible: !badge || badge === hit || badge.contains(hit) };
  });
  writeFileSync(testInfo.outputPath("enemy-bar.json"), JSON.stringify(measured, null, 2));
  for (const top of measured.cards) expect(top).toBeGreaterThanOrEqual(measured.bar - 1);
  expect(measured.badgeVisible).toBe(true);
}

// The turn panel stays inside its slot, nothing scrolls sideways and every control is a comfortable target.
async function geometry(page: Page, forge: Locator, testInfo: TestInfo, name: string) {
  const measured = await forge.evaluate((node) => {
    const root = (node as any).shadowRoot || node;
    const slot = root.querySelector(".cbt-turn-slot")!.getBoundingClientRect();
    const turn = root.querySelector("[data-turn]")!.getBoundingClientRect();
    const buttons = [...root.querySelectorAll("[data-turn] [data-act], [data-turn] button")].map((button: any) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height, text: button.textContent.trim().slice(0, 24) };
    });
    return {
      slot: { left: slot.left, right: slot.right, top: slot.top, bottom: slot.bottom },
      turn: { left: turn.left, right: turn.right, top: turn.top, bottom: turn.bottom },
      buttons,
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  writeFileSync(testInfo.outputPath(`${name}.json`), JSON.stringify(measured, null, 2));
  expect(measured.scroll).toBeLessThanOrEqual(0);
  expect(measured.turn.left).toBeGreaterThanOrEqual(measured.slot.left - 1);
  expect(measured.turn.right).toBeLessThanOrEqual(measured.slot.right + 1);
  expect(measured.turn.bottom).toBeLessThanOrEqual(measured.slot.bottom + 1);
  for (const button of measured.buttons.filter((entry) => entry.width > 0))
    expect(Math.min(button.width, button.height), JSON.stringify(button)).toBeGreaterThanOrEqual(24);
  void page;
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
      await expect(rows.nth(0)).toContainText("Normal skill");
      await expect(rows.nth(0)).toContainText("100% ATK to one enemy fighter");
      await expect(panel).toContainText("Prefers the Front Row");
      await expect(rows.nth(0)).toContainText("Kindled strike");
      await expect(rows.nth(1)).toContainText("Lighthouse dawn");
      await expect(rows.nth(2)).toContainText("Steady watch");
      await expect(rows.nth(2)).toContainText("Turn start · Either row");
      // Damage and shields resolve at once, so neither shows a duration.
      await expect(rows.nth(0)).not.toContainText("turns");
      await expect(rows.nth(2)).toContainText("Shield · Shields itself");
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
  test(`Formation plans each fighter by tapping, then Fight resolves the plan · ${theme}`, async ({
    page,
  }, testInfo) => {
    const { runtime, forge, freshMainPlan, chapterRunId, extra } = await openForge(page, testInfo, theme, "formation", {
      six: true,
    });
    const leader = `${chapterRunId}:unit:protagonist`;
    try {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await startBattle(forge, runtime, freshMainPlan);
      const turn = forge.locator("[data-turn]");
      await expect(turn.locator(".tu-hero")).toBeVisible();
      await expect(turn.locator("select, form")).toHaveCount(0);
      const bank = forge.locator('.cbt-turn-slot [data-formation-bank="ally"]');
      await expect(bank.locator("[data-formation-energy]")).toHaveCount(6);
      await expect(bank).toContainText("+3 next turn");
      // Supports say what they make; fighters are ready to be planned.
      const backCards = forge.locator(".side.allies .row.back .cbt");
      await expect(backCards).toHaveCount(3);
      await expect(backCards.locator(".gf-fgen")).toHaveCount(3);
      const ready = forge.locator(".side.allies .cbt.gf-ready");
      await expect(ready).toHaveCount(3);
      await expect(forge.locator(".side.allies .cbt.is-actor")).toHaveAttribute("data-id", leader);
      await expect(forge.locator("[data-turn-label]")).toHaveText("Plan your turn · 0 of 3");
      const actions = turn.locator(".cbt-acts [data-act]");
      await expect(actions).toHaveCount(6);
      await expect(turn.locator('[data-act="normal"]')).toHaveAttribute("aria-label", "Kindled strike");
      await expect(turn.locator('[data-act="ultimate"] .a-chip')).toHaveText("ULT");
      await expect(turn.locator('[data-act="ultimate"] .cbt-tip')).toContainText("200% ATK to one enemy fighter");
      // The defeat order is on the board: the Warden is protected until the Blade falls.
      await expect(forge.locator('.cbt[data-id="enemy-1"] .gf-forder')).toHaveText("①");
      await expect(forge.locator("[data-formation-rules]")).toContainText("Fell the Blade before the Warden.");
      await geometry(page, forge, testInfo, `formation-tray-${theme}`);
      await clearOfBar(forge, testInfo);
      // The rail enlarges the fighter being planned.
      await expect(forge.locator("[data-queue] .q-t.now")).toHaveAttribute("data-formation-tile", leader);
      await page.screenshot({ path: testInfo.outputPath(`formation-tray-${theme}.png`) });
      // With fighters still unplanned, the tray's Fight opens the plan instead of holding everyone.
      await turn.locator('[data-act="fight"]').click();
      await expect(turn.locator("[data-formation-plan]")).toBeVisible();
      await expect(turn.locator("[data-formation-plan] li.unset")).toHaveCount(3);
      await expect(forge.locator("[data-turn-label]")).toHaveText("Plan your turn · 0 of 3");
      await turn.locator(`[data-formation-pick="${leader}"]`).click();
      await expect(forge.locator(".side.allies .cbt.is-actor")).toHaveAttribute("data-id", leader);
      // 1. Mari: Normal skill on the Blade.
      await turn.locator('[data-act="normal"]').click();
      const aim = turn.locator("[data-aim]");
      await expect(aim).toContainText("An elemental strike.");
      await expect(aim).toContainText("100% ATK to one enemy fighter");
      await expect(forge.locator('.cbt[data-id="enemy-1"]')).toHaveClass(/targetable/);
      await expect(forge.locator('.cbt[data-id="enemy-0"]')).toHaveClass(/dimmed/);
      await expect(forge.locator('.cbt[data-id="enemy-0"] .gf-fprot')).toHaveText("Defeat ① first");
      await expect(forge.locator('.cbt[data-id="enemy-2"] .gf-fprot')).toHaveText("Back Row");
      await expect(forge.locator("[data-turn-label]")).toHaveText("Choose a target");
      // Enemy names read in full, and a protection chip stays clear of the name below it.
      const fit = await forge.locator(".side.enemies .cbt:not(.dead)").evaluateAll((cards) =>
        cards.map((card) => {
          const name = card.querySelector(".nm") as HTMLElement,
            chip = card.querySelector(".gf-fprot"),
            box = name.getBoundingClientRect();
          return {
            id: (card as HTMLElement).dataset.id,
            full: name.scrollWidth <= name.clientWidth + 1 && name.scrollHeight <= name.clientHeight + 1,
            clear: !chip || chip.getBoundingClientRect().bottom <= box.top + 1,
          };
        }),
      );
      for (const card of fit) expect(card, JSON.stringify(card)).toEqual({ ...card, full: true, clear: true });
      await page.screenshot({ path: testInfo.outputPath(`formation-aim-${theme}.png`) });
      await forge.locator('.cbt[data-id="enemy-1"]').click();
      // Aiming is over: no card keeps the "Choose …" name it had as a target.
      await expect(forge.locator('.cbt[aria-label^="Choose"]')).toHaveCount(0);
      await expect(forge.locator(`.cbt[data-id="${leader}"] .gf-fbadge`)).toContainText("①");
      await expect(forge.locator('.cbt[data-id="enemy-1"] .gf-ftargets')).toContainText("①");
      // 2. Kaveh is selected next: Hold.
      await expect(forge.locator(".side.allies .cbt.is-actor")).toHaveAttribute("data-id", extra[0]);
      await turn.locator('[data-act="hold"]').click();
      // Two of three planned: Enter on the tray's Fight opens the plan with focus on the fighter still unplanned,
      // so another Enter cannot resolve the turn.
      await expect(forge.locator(".side.allies .cbt.is-actor")).toHaveAttribute("data-id", extra[1]);
      await turn.locator('[data-act="fight"]').focus();
      await page.keyboard.press("Enter");
      await expect(turn.locator("[data-formation-plan]")).toBeVisible();
      await expect(turn.locator("[data-formation-fight]")).not.toBeFocused();
      await expect(turn.locator(`[data-formation-pick="${extra[1]}"]`)).toBeFocused();
      await page.keyboard.press("Enter");
      // 3. Pulcinella swaps with a support.
      await expect(forge.locator(".side.allies .cbt.is-actor")).toHaveAttribute("data-id", extra[1]);
      await turn.locator('[data-act="row"]').click();
      await expect(forge.locator("[data-turn-label]")).toHaveText("Choose where to move");
      await expect(forge.locator(`.cbt[data-id="${extra[2]}"]`)).toHaveClass(/targetable/);
      await forge.locator(`.cbt[data-id="${extra[2]}"]`).click();
      // Everyone has an action: the plan shows the order and what it spends.
      const plan = turn.locator("[data-formation-plan]");
      await expect(plan).toBeVisible();
      await expect(plan.locator("li")).toHaveCount(3);
      await expect(plan.locator("li").nth(0)).toContainText("Kindled strike → Leyshell Blade");
      await expect(plan.locator("li").nth(1)).toContainText("Holds");
      await expect(plan.locator("li").nth(2)).toContainText("Swaps with Nahida");
      await expect(forge.locator("[data-turn-label]")).toHaveText("Plan your turn · 3 of 3");
      // Change Mari's action: her Ultimate, paid from the projected bank.
      await plan.locator(`[data-formation-pick="${leader}"]`).click();
      await turn.locator('[data-act="ultimate"]').click();
      await expect(aim).toContainText("Pays");
      await forge.locator('.cbt[data-id="enemy-1"]').click();
      await expect(plan.locator("li").nth(0)).toContainText("Lighthouse dawn → Leyshell Blade");
      await expect(bank.locator("i").first()).toContainText("→");
      // Cancel Kaveh's Hold by keyboard: he is listed as holding with no action chosen, and focus stays on him.
      await plan.locator(`[data-formation-clear="${extra[0]}"]`).focus();
      await page.keyboard.press("Enter");
      await expect(plan.locator("li.unset")).toContainText("Holds (no action chosen)");
      await expect(plan.locator(`[data-formation-pick="${extra[0]}"]`)).toBeFocused();
      await geometry(page, forge, testInfo, `formation-plan-${theme}`);
      await page.screenshot({ path: testInfo.outputPath(`formation-plan-${theme}.png`) });
      const fight = plan.locator("[data-formation-fight]");
      const contrast = await fight.evaluate((node) => {
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
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      await fight.click();
      const cutin = forge.locator(".gf-ultimate-portrait");
      await expect(cutin).toBeVisible();
      await expect(cutin).toHaveAttribute("data-element", "fire");
      await expect(cutin.locator("img")).toHaveAttribute("src", portrait);
      expect(await cutin.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
      await page.screenshot({ path: testInfo.outputPath(`formation-ultimate-${theme}.png`) });
      await expect(bank.locator("[data-formation-energy]")).toHaveCount(6);
      // The swap happened and the next turn comes back to the player.
      await expect(forge.locator(`.side.allies .row.front .cbt[data-id="${extra[2]}"]`)).toHaveCount(1, {
        timeout: 20000,
      });
      await expect(forge.locator("[data-turn-label]")).toHaveText(/Plan your turn/, { timeout: 30000 });
      await expect(forge.locator(`.cbt[data-id="${extra[2]}"] .gf-fbadge.wait`)).toHaveCount(0);
      // The Warden's Echoes are clones of its card, but they carry their own name and none of its badges.
      const echo = forge.locator('.side.enemies .cbt[data-id^="enemy-0~"]:not(.dead)').first();
      await expect(echo).toBeVisible();
      await expect(echo.locator(".nm")).toHaveText("Leyshell Warden · Echo");
      await expect(echo.locator(".gf-forder, .gf-enemy-tier")).toHaveCount(0);
      // Its sheet says what an Echo is, under the Echo's own name, instead of listing the Warden's kit.
      await echo.click();
      const echoSheet = forge.locator("[data-foe-sheet]");
      await expect(echoSheet).toContainText("Leyshell Warden · Echo");
      await expect(echoSheet.locator(".kick")).not.toHaveText(/boss/i);
      await expect(echoSheet).toContainText("An Echo of Leyshell Warden");
      await expect(echoSheet).not.toContainText("Lighthouse dawn");
      await page.screenshot({ path: testInfo.outputPath(`formation-echo-${theme}.png`) });
      await echoSheet.getByRole("button", { name: "Close" }).click();
      await expect(echoSheet).toHaveCount(0);
      if (!testInfo.project.name.includes("mobile")) {
        // A large desktop keeps the same layout, scaled up.
        await page.setViewportSize({ width: 1920, height: 1080 });
        await expect(forge.locator(".side.allies .cbt.gf-ready").first()).toBeVisible();
        await geometry(page, forge, testInfo, `formation-next-turn-1920-${theme}`);
        await page.screenshot({ path: testInfo.outputPath(`formation-next-turn-1920-${theme}.png`) });
        await page.setViewportSize({ width: 1440, height: 900 });
      }
      // Enemies open their sheet, with the kit that actually fights. The Caster started in the Back Row and
      // has stepped into a fallen fighter's seat, so its sheet now describes a Front Row unit.
      await expect(forge.locator('.side.enemies .row.front .cbt[data-id="enemy-2"]')).toHaveCount(1);
      await forge.locator('.cbt[data-id="enemy-2"]').click();
      const sheet = forge.locator("[data-foe-sheet]");
      await expect(sheet).toContainText("Lighthouse dawn");
      await expect(sheet).toContainText("Front line");
      await page.screenshot({ path: testInfo.outputPath(`formation-foe-${theme}.png`) });
      await sheet.getByRole("button", { name: "Close" }).click();
      await expect(sheet).toHaveCount(0);
      // Auto plays whole turns with no planning left on screen.
      await forge.locator("[data-auto]").click();
      await expect(forge.locator("[data-turn-label]")).toHaveText(/Auto-battle|Battle over/);
      await expect(forge.locator(".side.allies .cbt.gf-ready")).toHaveCount(0);
      expect(runtime.session().combatPending?.fight?.combatMode).toBe("formation");
      expect(chapterRunId).toBeTruthy();
    } finally {
      await runtime.close();
    }
  });

  test(`a support steps into the seat of a fallen fighter · ${theme}`, async ({ page }, testInfo) => {
    const { runtime, forge, freshMainPlan } = await openForge(page, testInfo, theme, "formation", { six: true });
    try {
      await startBattle(forge, runtime, freshMainPlan);
      await expect(forge.locator("[data-turn] .tu-hero")).toBeVisible();
      const front = forge.locator(".side.enemies .row.front");
      const blade = forge.locator('.cbt[data-id="enemy-1"]');
      const caster = forge.locator('.cbt[data-id="enemy-2"]');
      await expect(caster.locator(".gf-fgen")).toHaveCount(1);
      // Auto fells the Blade first (the defeat order); the Caster takes its seat in the same step.
      await forge.locator("[data-auto]").click();
      await expect(front.locator('.cbt[data-id="enemy-2"]')).toHaveCount(1, { timeout: 30000 });
      await expect(blade).toHaveClass(/dead/);
      await expect(blade).toHaveClass(/gf-fgone/);
      await expect(blade).toBeHidden();
      expect(await caster.evaluate((node) => node.nextElementSibling?.getAttribute("data-id"))).toBe("enemy-1");
      await expect(caster.locator(".gf-fgen")).toHaveCount(0);
      // Fallen Echoes leave the band shortly after; the seated row never shows more than three cards.
      await expect.poll(() => front.locator(".cbt:visible").count()).toBeLessThanOrEqual(3);
      const scroll = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(scroll).toBeLessThanOrEqual(0);
      await page.screenshot({ path: testInfo.outputPath(`formation-step-up-${theme}.png`) });
    } finally {
      await runtime.close();
    }
  });

  test(`Move opens empty seats to bring a support forward, and a support explains itself · ${theme}`, async ({
    page,
  }, testInfo) => {
    const { runtime, forge, freshMainPlan, chapterRunId } = await openForge(page, testInfo, theme, "formation");
    try {
      await startBattle(forge, runtime, freshMainPlan);
      const turn = forge.locator("[data-turn]");
      const arden = `${chapterRunId}:unit:arden`;
      await expect(turn.locator(".tu-hero")).toBeVisible();
      // The battle's help describes Formation, not Classic.
      await forge.evaluate((node) => (node as any)._openGuide("combat"));
      await expect(forge.locator("[data-guide-modal]")).toContainText("Plan everyone, then press Fight");
      await expect(forge.locator("[data-guide-modal]")).not.toContainText("Defend");
      await forge.evaluate((node) => (node as any)._closeGuide());
      await expect(forge.locator("[data-guide-modal]")).toHaveCount(0);
      await expect(forge.locator("[data-formation-rules]")).toContainText("Defeat the sentinel.");
      // Water and Wind supports cannot pay a Fire share: the lock says which element is missing.
      await expect(turn.locator('[data-act="ultimate"] .a-cost.wait')).toHaveText("Need 1 Fire");
      // A support explains what it makes and what its passive does.
      await forge.locator(`.cbt[data-id="${arden}"]`).click();
      const aim = turn.locator("[data-aim]");
      await expect(aim).toContainText("Makes +1 Water energy each turn");
      await expect(aim).toContainText("Steady watch");
      await aim.getByRole("button", { name: "Close" }).click();
      await turn.locator('[data-act="row"]').click();
      const seat = forge.locator('.side.allies [data-formation-seat="front"]');
      await expect(seat).toHaveCount(1);
      await expect(forge.locator('.side.allies [data-formation-seat="back"]')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`formation-move-${theme}.png`) });
      await seat.click();
      await expect(forge.locator(`.cbt[data-id="${arden}"]`)).toHaveClass(/targetable/);
      await forge.locator(`.cbt[data-id="${arden}"]`).click();
      const plan = turn.locator("[data-formation-plan]");
      await expect(plan.locator("li").first()).toContainText("Brings Arden forward");
      await plan.locator("[data-formation-fight]").focus();
      await page.keyboard.press("Enter");
      await expect(forge.locator(`.side.allies .row.front .cbt[data-id="${arden}"]`)).toHaveCount(1, {
        timeout: 20000,
      });
      await expect(forge.locator("[data-turn-label]")).toHaveText(/Plan your turn/, { timeout: 30000 });
      // Next turn Arden fights too, and a keyboard alone can plan: focus comes back to the first action after
      // Fight, then Enter opens it and Enter picks the target card.
      await expect(forge.locator(`.cbt[data-id="${arden}"]`)).toHaveClass(/gf-ready/);
      await expect(turn.locator('[data-act="normal"]')).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(forge.locator('.cbt[data-id="enemy-0"]')).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(forge.locator(".side.allies .cbt.is-actor")).toHaveAttribute("data-id", arden);
      await expect(turn.locator("[data-act]").first()).toBeFocused();
      await expect(forge.locator(`.cbt[data-id="${chapterRunId}:unit:protagonist"] .gf-fbadge`)).toContainText("①");
    } finally {
      await runtime.close();
    }
  });

  test(`the Formation team editor seats six with row labels, badges and energy · ${theme}`, async ({
    page,
  }, testInfo) => {
    const { runtime, forge } = await openForge(page, testInfo, theme, "formation", { six: true });
    try {
      await forge.evaluate((node) => {
        const game = node as any;
        game._guide = "";
        game._guidesSeen.add("formation");
        game._openFormation();
      });
      const board = forge.locator(".board");
      await expect(board.locator(".row-lab").nth(0)).toHaveText(
        "Front Row — fighters act every turn and can be attacked",
      );
      await expect(board.locator(".row-lab").nth(1)).toHaveText(
        "Back Row — supports make energy and can't be attacked",
      );
      await expect(board.locator("[data-slot].filled")).toHaveCount(6);
      const summary = board.locator("[data-formation-editor]");
      await expect(summary).toContainText("Front 3/3 · Back 3/3");
      await expect(summary).toContainText("+3 energy per turn");
      await expect(board.locator('[data-slot="front:1"] .gf-fbadge-row')).toHaveAttribute("data-row", "hybrid");
      await expect(board.locator('[data-slot="back:2"] .gf-fbadge-row')).toHaveAttribute("data-row", "back");
      await page.screenshot({ path: testInfo.outputPath(`formation-editor-${theme}.png`) });
      // Seat names read light on the dark seat cards, like their role line.
      const name = await board
        .locator('[data-slot="front:0"] .slot-name')
        .evaluate((node) => getComputedStyle(node).color);
      const channels = name
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number);
      expect((channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722) / 255).toBeGreaterThan(0.6);
      await forge.evaluate((node) => (node as any)._openGuide("formation"));
      await expect(forge.locator("[data-guide-modal]")).toContainText(
        "three fighters in front and three supports behind",
      );
      await forge.evaluate((node) => (node as any)._closeGuide());
      // Benching a fighter keeps the line truthful and saves the six-seat board as it is.
      await board.locator('[data-remove="front:2"]').click();
      await expect(summary).toContainText("Front 2/3 · Back 3/3");
      await expect.poll(() => runtime.session().presets[0].board.front.filter(Boolean).length).toBe(2);
      expect(runtime.session().presets[0].board.back.filter(Boolean).length).toBe(3);
      // Background work starting between the two taps keeps the picked unit, so the move still lands.
      const { front, back } = runtime.session().presets[0].board;
      await board.locator('[data-slot="front:1"]').click();
      await forge.evaluate((node) => (node as any)._busyStart({ cost: "tokens", label: "Writing the next scene" }));
      await expect(forge.locator("[data-busy]")).toContainText("Writing the next scene");
      await board.locator('[data-slot="back:1"]').click();
      await expect.poll(() => runtime.session().presets[0].board.back[1]).toBe(front[1]);
      expect(runtime.session().presets[0].board.front[1]).toBe(back[1]);
    } finally {
      await runtime.close();
    }
  });

  test(`Classic battles keep the Classic turn panel, queue and foe sheet · ${theme}`, async ({ page }, testInfo) => {
    const { runtime, forge, freshMainPlan } = await openForge(page, testInfo, theme, "classic");
    try {
      await startBattle(forge, runtime, freshMainPlan);
      const turn = forge.locator("[data-turn]");
      await expect(turn.locator(".cbt-acts [data-act]")).toHaveCount(6);
      for (const key of ["attack", "ultimate", "weapon", "defend", "row", "item"])
        await expect(turn.locator(`[data-act="${key}"]`)).toHaveCount(1);
      await expect(forge.locator("[data-queue] .q-strip .q-t").first()).toBeVisible();
      await expect(forge.locator("[data-formation-bank], .gf-fbadge, .gf-fside")).toHaveCount(0);
      expect(await forge.locator(".root[data-formation]").count()).toBe(0);
      await turn.locator('[data-act="attack"]').click();
      await forge.locator('.cbt[data-id="enemy-0"]').click();
      await expect(forge.locator('.cbt[data-id="enemy-0"] .hpn')).not.toHaveText("", { timeout: 15000 });
      await expect(turn.locator(".cbt-acts [data-act]")).toHaveCount(6, { timeout: 30000 });
      await forge.locator('.cbt[data-id="enemy-0"]').click();
      await expect(forge.locator("[data-foe-sheet]")).toContainText("/ 100 energy");
      await page.screenshot({ path: testInfo.outputPath(`classic-battle-${theme}.png`) });
    } finally {
      await runtime.close();
    }
  });
}
