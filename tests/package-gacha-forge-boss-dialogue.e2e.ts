import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const intro = "You have reached the keeper of this gate.";
const concession = "The gate is yours. You have won.";
const portrait = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#775f81"/><circle cx="100" cy="88" r="44" fill="#e7cda5"/></svg>')}`;

function actor(id: string, name: string, ally = false) {
  return {
    id,
    name,
    role: "Warrior",
    affinity: "Fire",
    position: "front",
    portrait,
    stats: { hp: ally ? 10000 : 100, atk: ally ? 10000 : 1, def: 1, spd: ally ? 200 : 1 },
    power: ally ? 1000 : 1,
    skill: { name: "Strike", effect: "damage", power: 180, target: "enemy", description: "A direct strike." },
    passive: null,
    ...(ally ? { level: 20, isLeader: true, facets: null } : {}),
  };
}

async function openBattle(
  page: Page,
  testInfo: TestInfo,
  options: {
    theme?: string;
    auto?: boolean;
    legacy?: boolean;
    mixed?: boolean;
    voice?: boolean;
    content?: string;
    defeat?: boolean;
    enemyFirst?: boolean;
    pauseSeconds?: number;
  } = {},
) {
  const theme = options.theme || "vanguard";
  const run = {
    runId: "boss-dialogue-proof",
    name: "Gatekeeper world",
    scenario: "A synthetic story confrontation.",
    hudStyle: theme,
    connectionId: "fixture-model",
    hasStandardBanner: true,
    protagonist: { name: "Mari" },
    story: { preforge: "off", choices: true },
    progress: {},
    audio: {
      tts: options.voice === true,
      generate: false,
      muted: false,
      dialogueVolume: 1,
      autoplayPauseSeconds: options.pauseSeconds ?? 0,
    },
  };
  const enemy = {
    ...actor("enemy-0", "Gatekeeper"),
    ...(options.defeat
      ? { stats: { hp: 10000, atk: 10000, def: 1, spd: options.enemyFirst ? 200 : 1 }, power: 1000 }
      : {}),
    characterId: "engine-gatekeeper",
    ...(options.legacy ? {} : { tier: "boss", mech: ["phases", "charge"] }),
  };
  const payload = {
    ok: true,
    battleKey: "gatekeeper-proof",
    opening: "The gatekeeper steps forward.",
    objective: "Defeat the gatekeeper.",
    allies: [
      {
        ...actor("hero", "Mari", true),
        ...(options.defeat ? { stats: { hp: 1, atk: 1, def: 1, spd: options.enemyFirst ? 1 : 200 }, power: 1 } : {}),
      },
    ],
    enemies: options.mixed
      ? [enemy, { ...actor("enemy-1", "Captain"), tier: "elite" }, { ...actor("enemy-2", "Guard"), tier: "soldier" }]
      : [enemy],
    ...(options.legacy
      ? {}
      : {
          tier: "boss",
          dialogueCues: [
            { speaker: "enemy-0", content: options.content || intro, type: "main", trigger: "intro" },
            { speaker: "enemy-0", content: concession, type: "main", trigger: "victory" },
            { speaker: "enemy-0", content: "You cannot pass this gate.", type: "main", trigger: "defeat" },
          ],
        }),
  };
  const speech: Record<string, unknown>[] = [];
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/generate|narrative|\/guide|\/plan/u.test(new URL(request.url()).pathname)) requests.push(request.url());
  });
  await page.setViewportSize(
    testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((version) => {
    localStorage.removeItem("marinara-active-chat-id");
    localStorage.setItem("marinara:whats-new:seen-version", version);
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, appAccentPulseMode: false },
        version: 65,
      }),
    );
    HTMLMediaElement.prototype.play = function () {
      return Promise.resolve();
    };
  }, appVersion);
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/api/gacha-forge/state*", (route) =>
    route.fulfill({
      json: { runs: [run], activeRunId: run.runId, activeRun: run, guidesSeen: ["welcome", "home", "combat"] },
    }),
  );
  await page.route("**/api/gacha-forge/preforge", (route) =>
    route.fulfill({ json: { ok: true, preforge: { mode: "off", locked: false, canAuto: false } } }),
  );
  await page.route("**/api/gacha-forge/battle/start", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/gacha-forge/run/sources", async (route) => {
    const { sources } = route.request().postDataJSON();
    run.audio = { ...run.audio, ...sources.audio };
    await route.fulfill({ json: { ok: true, run } });
  });
  await page.route("**/api/connections", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/tts/config", (route) =>
    route.fulfill({
      json: {
        enabled: false,
        connectionId: "speech-fixture",
        connectionProfiles: {
          "speech-fixture": { voiceAssignments: [{ characterId: "engine-gatekeeper", voice: "voice-gatekeeper" }] },
        },
      },
    }),
  );
  await page.route("**/api/tts/speak", async (route) => {
    speech.push(route.request().postDataJSON());
    // A rejected transport still settles the cue; no external voice provider is contacted.
    await route.fulfill({ status: 503, json: { error: "Synthetic voice transport is unavailable." } });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect.poll(() => forge.evaluate((node) => (node as any)._boot)).toBe("ready");
  await forge.evaluate(
    (node, fixture) => {
      const game = node as any;
      game._clearBeat();
      game._stopCombat();
      game._welcomeBegun = true;
      game._guidesSeen = new Set(["welcome", "home", "combat"]);
      game._bannerReady = true;
      game._artReady = true;
      game._planEscaped = true;
      game._run = fixture.run;
      game._combat = fixture.payload;
      game._combatNode = { title: "The Last Gate", chapter: 1, combatIndex: 0, nodeIndex: 1 };
      game._combatSeed = 7;
      game._combatRun = null;
      game._combatResult = null;
      game._combatOutcome = null;
      game._combatNonce += 1;
      game._combatPhase = "prebattle";
      game._combatPrefs = { story: { auto: fixture.auto, speed: 3 } };
      game.__completed = [];
      // Capture the external progression boundary; the real shipped runner, controls and event playback still execute.
      game._combatFinished = (result: string) => {
        game.__completed.push({ result, log: game._combatLog, auto: game._combatRun?.auto });
        game._stopCombat();
      };
      game._hudView = "combat";
      game._renderBrowser();
    },
    { run, payload, auto: options.auto === true },
  );
  await expect(forge.locator('.gf-arena[data-style="' + theme + '"]')).toBeVisible();
  await expect(forge.locator("[data-start]")).toBeVisible();
  requests.length = 0;
  return { forge, speech, requests };
}

async function expectCueFits(forge: Locator) {
  const result = await forge.evaluate((node) => {
    const root = node.shadowRoot!;
    const cue = root.querySelector("[data-forge-combat-dialogue]")!.getBoundingClientRect();
    const stage = root.querySelector(".gf-stage")!.getBoundingClientRect();
    const next = root.querySelector("[data-forge-dialogue-next]")!;
    const target = next.getBoundingClientRect();
    return {
      fits:
        cue.left >= stage.left - 1 &&
        cue.right <= stage.right + 1 &&
        cue.top >= stage.top - 1 &&
        cue.bottom <= stage.bottom + 1,
      tappable: next.contains(root.elementFromPoint(target.left + target.width / 2, target.top + target.height / 2)),
      overflows: root.querySelector("[data-forge-combat-dialogue]")!.scrollWidth > cue.width + 1,
    };
  });
  expect(result).toEqual({ fits: true, tappable: true, overflows: false });
  await expect(forge.locator("[data-auto]")).toBeVisible();
  await expect(forge.locator(".gf-fs-bar")).toBeVisible();
}

for (const theme of ["vanguard", "bloom"]) {
  test(`${theme}: enemy tiers stay distinct in formation cards and enemy details`, async ({ page }, testInfo) => {
    const { forge } = await openBattle(page, testInfo, { theme, mixed: true });
    for (const [index, tier] of ["boss", "elite", "soldier"].entries()) {
      await expect(forge.locator(`.cbt.enemy[data-id="enemy-${index}"] [data-forge-tier="${tier}"]`)).toBeVisible();
    }
    await forge.locator('[data-foe-inspect="enemy-1"]').click();
    await expect(forge.locator("[data-foe-sheet] .sv-modal-id .kick")).toHaveText("Elite");
    await page.screenshot({ path: testInfo.outputPath(`enemy-tiers-${theme}.png`) });
  });

  test(`${theme}: manual boss dialogue holds the result until its outcome is read`, async ({ page }, testInfo) => {
    const { forge, requests } = await openBattle(page, testInfo, { theme });
    await forge.locator("[data-start]").click();
    const cue = forge.locator("[data-forge-combat-dialogue]");
    await expect(cue).toContainText(intro);
    await expectCueFits(forge);
    await expect(forge.locator("[data-boss]")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`boss-intro-${theme}.png`) });
    await forge.locator("[data-forge-dialogue-next]").click();
    await expect(cue).toBeHidden();
    await forge.getByRole("button", { name: "Attack", exact: true }).click();
    await forge.locator('.cbt.enemy[data-id="enemy-0"]').click();
    await expect(cue).toContainText(concession);
    expect(await forge.evaluate((node) => (node as any).__completed)).toEqual([]);
    await expectCueFits(forge);
    await forge.locator("[data-forge-dialogue-next]").click();
    await expect.poll(() => forge.evaluate((node) => (node as any).__completed.length)).toBe(1);
    expect(await forge.evaluate((node) => (node as any).__completed[0].result)).toBe("win");
    expect(requests).toEqual([]);
  });
}

test("Auto resumes after boss lines and preserves the selected combat preference", async ({ page }, testInfo) => {
  const { forge, requests } = await openBattle(page, testInfo, { auto: true });
  await forge.locator("[data-start]").click();
  await expect.poll(() => forge.evaluate((node) => (node as any).__completed.length)).toBe(1);
  expect(await forge.evaluate((node) => (node as any).__completed[0])).toMatchObject({ result: "win", auto: true });
  expect(await forge.evaluate((node) => (node as any)._combatPrefs.story.auto)).toBe(true);
  expect(requests).toEqual([]);
});

test("Auto reads boss dialogue when the enemy wins before the first player turn", async ({ page }, testInfo) => {
  const { forge } = await openBattle(page, testInfo, { auto: true, defeat: true, enemyFirst: true });
  await forge.locator("[data-start]").click();
  await expect.poll(() => forge.evaluate((node) => (node as any).__completed.length)).toBe(1);
  expect(await forge.evaluate((node) => (node as any).__completed[0])).toMatchObject({
    result: "lose",
    auto: true,
    log: [],
  });
});

test("legacy encounters remain playable without manufactured dialogue or boss status", async ({ page }, testInfo) => {
  const { forge } = await openBattle(page, testInfo, { legacy: true, auto: true });
  await expect(forge.locator('.cbt.enemy [data-forge-tier="soldier"]')).toBeVisible();
  await forge.locator("[data-start]").click();
  await expect(forge.locator("[data-boss]")).toHaveCount(0);
  await expect(forge.locator("[data-forge-combat-dialogue]")).toHaveCount(0);
  await expect.poll(() => forge.evaluate((node) => (node as any).__completed.length)).toBe(1);
});

test("enemy inspection pauses Auto during defeat dialogue", async ({ page }, testInfo) => {
  const { forge } = await openBattle(page, testInfo, { auto: true, defeat: true, pauseSeconds: 3 });
  await forge.locator("[data-start]").click();
  const cue = forge.locator("[data-forge-combat-dialogue]");
  await expect(cue).toContainText(intro);
  expect(await forge.evaluate((node) => (node as any)._combatRun.auto)).toBe(true);
  await forge.locator("[data-forge-dialogue-next]").click();
  await expect(cue).toContainText("You cannot pass this gate.");
  expect(await forge.evaluate((node) => (node as any)._combatRun.auto)).toBe(true);
  const finalFrameDelay = await forge.evaluate((node) => {
    const game = node as any;
    return ((game._combatRun.steps.at(-1).d || 500) * 1.9) / game._combatPrefs.story.speed;
  });
  // The result cue begins inside the final frame; inspect after that frame timer has drained.
  await page.waitForTimeout(finalFrameDelay + 50);
  await forge.locator('.cbt.enemy[data-id="enemy-0"]').click();
  await expect(forge.locator("[data-foe-sheet]")).toBeVisible();
  // Exceed the configured dialogue delay while the real enemy sheet is open.
  await page.waitForTimeout(3200);
  expect(await forge.evaluate((node) => (node as any).__completed)).toEqual([]);
  await expect(cue).toContainText("You cannot pass this gate.");
  await forge.locator("button[data-foe-close]").click();
  await forge.locator("[data-forge-dialogue-next]").click();
  await expect.poll(() => forge.evaluate((node) => (node as any).__completed.length)).toBe(1);
  expect(await forge.evaluate((node) => (node as any).__completed[0])).toMatchObject({ result: "lose", auto: true });
});

test("boss dialogue is plain text, and unavailable assigned speech does not lock combat", async ({
  page,
}, testInfo) => {
  const content = 'You may not pass. <img src="invalid" onerror="window.__forgeInjected=true">';
  const { forge, speech } = await openBattle(page, testInfo, { voice: true, content });
  await forge.locator("[data-start]").click();
  await expect(forge.locator("[data-forge-combat-dialogue]")).toContainText(content);
  await expect(forge.locator('[data-forge-combat-dialogue] img[src="invalid"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__forgeInjected)).toBeUndefined();
  await expect.poll(() => speech.length).toBe(1);
  const mute = forge.locator(".cbar .ctrls > .gf-mute");
  await expect(forge.locator(".gf-mute:visible")).toHaveCount(1);
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await forge.locator("[data-forge-dialogue-next]").click();
  await forge.getByRole("button", { name: "Attack", exact: true }).click();
  await forge.locator('.cbt.enemy[data-id="enemy-0"]').click();
  await expect(forge.locator("[data-forge-combat-dialogue]")).toContainText(concession);
  expect(speech).toHaveLength(1);
  await forge.locator("[data-forge-dialogue-next]").click();
  await expect.poll(() => forge.evaluate((node) => (node as any).__completed.length)).toBe(1);
});

test("blocking combat dialogue supports keyboard continuation and restores visible controls after a rerender", async ({
  page,
}, testInfo) => {
  const { forge } = await openBattle(page, testInfo);
  await forge.evaluate((node) => {
    const game = node as any;
    game._combat.dialogueCues.splice(1, 0, {
      ...game._combat.dialogueCues[0],
      content: "A second line in the same blocking queue.",
    });
  });
  await forge.locator("[data-start]").click();
  const focusedNext = () =>
    forge.evaluate(
      (node) => node.shadowRoot!.activeElement === node.shadowRoot!.querySelector("[data-forge-dialogue-next]"),
    );
  await expect(forge.locator("[data-forge-combat-dialogue]")).toContainText(intro);
  expect(await focusedNext()).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(forge.locator("[data-forge-combat-dialogue] p")).toBeFocused();
  // macOS WebKit's native preference skips buttons on Tab; Option+Tab includes them.
  // An unchanged native paragraph/button/input probe pins that host keyboard behavior.
  await page.keyboard.press(testInfo.project.name === "mobile-webkit" ? "Alt+Tab" : "Tab");
  expect(await focusedNext()).toBe(true);
  await page.keyboard.press("Enter");
  await expect(forge.locator("[data-forge-combat-dialogue]")).toContainText(
    "A second line in the same blocking queue.",
  );
  expect(await focusedNext()).toBe(true);
  await forge.evaluate((node) => {
    const game = node as any;
    game._renderKey = "";
    game._renderBrowser();
  });
  await expect(forge.locator("[data-forge-combat-dialogue]")).toContainText(
    "A second line in the same blocking queue.",
  );
  expect(await focusedNext()).toBe(true);
  await page.keyboard.press("Enter");
  await expect(forge.locator("[data-forge-combat-dialogue]")).toBeHidden();
  await expect(forge.locator("[data-auto]")).toBeFocused();
});

test("Auto restores keyboard focus after its last outcome line without stealing enemy inspection focus", async ({
  page,
}, testInfo) => {
  const { forge } = await openBattle(page, testInfo, { auto: true, defeat: true, pauseSeconds: 1 });
  await forge.locator("[data-start]").click();
  await expect(forge.locator("[data-forge-dialogue-next]")).toBeFocused();
  await forge.locator("[data-forge-dialogue-next]").click();
  await expect(forge.locator("[data-forge-combat-dialogue]")).toContainText("You cannot pass this gate.");
  await forge.locator('.cbt.enemy[data-id="enemy-0"]').click();
  const close = forge.locator("button[data-foe-close]");
  await close.focus();
  await page.waitForTimeout(1200);
  await expect(close).toBeFocused();
  expect(await forge.evaluate((node) => (node as any).__completed)).toEqual([]);
  await close.click();
  await expect.poll(() => forge.evaluate((node) => (node as any).__completed.length)).toBe(1);
  await expect(forge.locator("[data-auto]")).toBeFocused();
});
