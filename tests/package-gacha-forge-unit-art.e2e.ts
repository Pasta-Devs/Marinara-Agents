import { expect, test, type Locator, type Page, type Route, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const portrait = "https://forge.test/1707-unit.png";
const unit = {
  id: "stable-art-unit",
  kind: "character",
  name: "Arden",
  rarity: 5,
  role: "Warrior",
  affinity: "Fire",
  portrait,
  level: 1,
  stats: { hp: 50, atk: 50, def: 40, spd: 50 },
  skills: [],
  story: "A synthetic lighthouse keeper.",
};
const imageSelector = '.gf-stage > .gf-view > .root > [data-screen="unit"] .cp-photo';

async function settle(forge: Locator) {
  await forge.evaluate(async (node) => {
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const view = node.shadowRoot!.querySelector(".gf-stage > .gf-view")!;
    await Promise.all(
      view
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    );
    await new Promise(requestAnimationFrame);
  });
}

async function sample(forge: Locator, selector: string, panel: string) {
  await forge.evaluate(
    (node, { selector, panel }) => {
      const root = node.shadowRoot!;
      const first = root.querySelector(selector);
      const state = { running: true, frames: [] as any[] };
      (window as any).artFrames = state;
      const opacity = (element: Element | null) => {
        if (!element) return 0;
        let value = 1;
        for (let current: Element | null = element; current; current = current.parentElement) {
          const style = getComputedStyle(current);
          if (style.display === "none" || style.visibility !== "visible") return 0;
          value *= Number(style.opacity);
        }
        return value;
      };
      const frame = () => {
        const image = root.querySelector<HTMLImageElement>(selector);
        const rect = image?.getBoundingClientRect();
        const changed = [];
        for (let ancestor: Element | null = image; ancestor; ancestor = ancestor.parentElement)
          if (ancestor.hasAttribute("data-changed")) changed.push(ancestor.className);
        state.frames.push({
          rect: rect ? [rect.x, rect.y, rect.width, rect.height] : null,
          changed,
          swapping: root.querySelector(".gf-stage > .gf-view")?.hasAttribute("data-swap"),
          image: !!image,
          loaded: !!image?.complete && image.naturalWidth > 0,
          sameImage: first === image,
          opacity: opacity(image),
          panelOpacity: opacity(root.querySelector(panel)),
          panelMotion: root
            .querySelector(panel)
            ?.getAnimations({ subtree: true })
            .some((animation) =>
              animation.effect?.getKeyframes().some((keyframe) => keyframe.transform && keyframe.transform !== "none"),
            ),
          tab: (node as any)._unitTab,
          rosterRevision: (node as any)._rosterRev,
        });
        if (state.running) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
    { selector, panel },
  );
}

async function finishSample(page: Page, testInfo: TestInfo, name: string) {
  const frames = await page.evaluate(() => {
    const state = (window as any).artFrames;
    state.running = false;
    return state.frames as Array<{
      image: boolean;
      loaded: boolean;
      sameImage: boolean;
      opacity: number;
      panelOpacity: number;
      panelMotion: boolean;
    }>;
  });
  await testInfo.attach(name, { body: JSON.stringify(frames, null, 2), contentType: "application/json" });
  return frames;
}

async function openForge(page: Page, testInfo: TestInfo, theme: string) {
  await page.setViewportSize(
    testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 },
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(
    ({ version, theme }) => {
      localStorage.removeItem("marinara-active-chat-id");
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            theme,
            hasCompletedOnboarding: true,
            sidebarOpen: false,
            rightPanelOpen: false,
            appAccentPulseMode: false,
          },
          version: 65,
        }),
      );
    },
    { version: appVersion, theme },
  );
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route(portrait + "*", (route) =>
    route.fulfill({
      contentType: "image/png",
      headers: { "cache-control": "public, max-age=31536000, immutable" },
      body: readFileSync(resolve("artwork/agent-covers/gacha-forge.png")),
    }),
  );
  const cards = Array.from({ length: 18 }, (_, index) => ({
    ...unit,
    id: index ? `unit-${index}` : unit.id,
    name: index ? `Unit ${String(index).padStart(2, "0")}` : unit.name,
  }));
  let responseCards = cards;
  let holdRoster = false;
  let pending: Route | null = null;
  await page.route("**/api/gacha-forge/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/gacha-forge", "");
    if (path === "/state") return route.fulfill({ json: { runs: [], guidesSeen: ["welcome"] } });
    if (path === "/setup/draft") return route.fulfill({ json: { ok: true, draft: null } });
    if (path === "/unit")
      return route.fulfill({
        json: { ok: true, unit, level: 1, bond: 0, favorite: false, gear: { slots: [], totals: {} } },
      });
    if (path === "/roster") {
      if (holdRoster) {
        pending = route;
        return;
      }
      return route.fulfill({ json: { ok: true, cards: responseCards } });
    }
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect(forge.locator("textarea").first()).toBeVisible();
  await forge.evaluate((node, cards) => {
    const game = node as any;
    game._boot = "ready";
    game._guidesSeen = new Set(["welcome", "home", "roster", "unit", "unit:stats", "unit:story", "unit:outfits"]);
    game._welcomeBegun = true;
    game._run = { runId: "art-proof", name: "Art proof", scenario: "Synthetic lighthouse", progress: {} };
    game._bannerReady = true;
    game._artReady = true;
    game._hudView = "roster";
    game._rosterUnitId = null;
    game._roster = cards;
    game._rosterCount = cards.length;
    game._rosterState = "ready";
    game._rosterRev += 1;
    game._renderBrowser();
  }, cards);
  const card = forge.locator(`.gf-stage > .gf-view > .root > [data-screen="roster"] [data-unit="${unit.id}"]`);
  await expect(card).toBeVisible();
  await card.locator("img.u-photo").evaluate((node) => (node as HTMLImageElement).decode());
  await settle(forge);
  await card.click();
  const photo = forge.locator(imageSelector);
  await expect(photo).toBeVisible();
  await photo.evaluate((node) => (node as HTMLImageElement).decode());
  await settle(forge);
  return {
    forge,
    card,
    photo,
    cards,
    hold: () => {
      holdRoster = true;
    },
    hasPending: () => !!pending,
    async release() {
      holdRoster = false;
      await pending!.fulfill({ json: { ok: true, cards: responseCards } });
      pending = null;
    },
    update: () => {
      responseCards = cards.map((card, index) =>
        index ? card : { ...card, name: "Arden updated", portrait: portrait + "?updated=1" },
      );
    },
  };
}

for (const theme of ["dark", "light"]) {
  test(`unit portrait stays opaque while Outfits and Story panels change · ${theme}`, async ({ page }, testInfo) => {
    const f = await openForge(page, testInfo, theme);
    await sample(f.forge, imageSelector, '.gf-stage > .gf-view > .root > [data-screen="unit"] .cp-panel');
    for (const tab of ["Outfits", "Story", "Stats"]) {
      await f.forge.getByRole("tab", { name: tab, exact: true }).click();
      await settle(f.forge);
    }
    const frames = await finishSample(page, testInfo, "tab-opacity-frames");
    await page.screenshot({ path: testInfo.outputPath(`unit-art-tabs-${theme}.png`) });
    expect(frames.length).toBeGreaterThan(2);
    expect(
      frames.every((frame) => frame.image && frame.loaded),
      "The actual incoming portrait stays decoded",
    ).toBe(true);
    expect(
      frames.every((frame) => frame.sameImage),
      "Tab changes retain the portrait DOM node",
    ).toBe(true);
    expect(
      Math.min(...frames.map((frame) => frame.opacity)),
      "Portrait ancestors never fade during a panel swap",
    ).toBeGreaterThanOrEqual(0.99);
    expect(
      frames.some((frame) => frame.panelMotion),
      "The content panel keeps its existing transform transition",
    ).toBe(true);
    // Exercise replacement guards through the real renderer with controlled canonical unit payloads.
    for (const [unitId, source, outfit] of [
      [unit.id, portrait + "?replacement=1", false],
      [unit.id, portrait + "?outfit=1", true],
      ["another-unit", portrait + "?outfit=1", false],
    ] as const) {
      const previous = await f.photo.elementHandle();
      await f.forge.evaluate(
        (node, { unitId, source, outfit }) => {
          const game = node as any;
          game._rosterUnitId = unitId;
          game._unit = {
            ...game._unit,
            id: unitId,
            portrait: source,
            outfits: outfit ? [{ id: "raincoat", name: "Raincoat", url: source }] : [],
            wornOutfit: outfit ? "raincoat" : "",
          };
          game._growthRev += 1;
          game._renderBrowser();
        },
        { unitId, source, outfit },
      );
      await expect(f.photo).toHaveAttribute("src", source);
      await f.photo.evaluate((image) => (image as HTMLImageElement).decode());
      expect(
        await previous!.evaluate((node) => node.isConnected),
        "Changed unit/art/outfit replaces the previous resource",
      ).toBe(false);
      await previous!.dispose();
      await settle(f.forge);
    }
  });

  test(`returning to Units preserves cards through an identical refresh and shows changed data · ${theme}`, async ({
    page,
  }, testInfo) => {
    const f = await openForge(page, testInfo, theme);
    f.hold();
    await f.forge.getByRole("button", { name: "◀ Units", exact: true }).click();
    await expect.poll(f.hasPending).toBe(true);
    await expect(f.card).toBeVisible();
    await settle(f.forge);
    const revision = await f.forge.evaluate((node) => (node as any)._rosterRev);
    await sample(
      f.forge,
      `.gf-stage > .gf-view > .root > [data-screen="roster"] [data-unit="${unit.id}"] .u-photo`,
      '.gf-stage > .gf-view > .root > [data-screen="roster"] .roster-body',
    );
    const response = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/gacha-forge/roster");
    await f.release();
    await (await response).finished();
    await settle(f.forge);
    const frames = await finishSample(page, testInfo, "identical-roster-refresh-frames");
    expect(frames.length).toBeGreaterThan(2);
    expect(frames.every((frame) => frame.image && frame.loaded)).toBe(true);
    expect(
      frames.every((frame) => frame.sameImage),
      "An identical response retains the actual visible card image node",
    ).toBe(true);
    expect(
      Math.min(...frames.map((frame) => frame.opacity)),
      "Identical cached cards do not replay their fade",
    ).toBeGreaterThanOrEqual(0.99);
    expect(await f.forge.evaluate((node) => (node as any)._rosterRev)).toBe(revision);
    f.update();
    await f.forge.evaluate((node) => (node as any)._loadRoster());
    await expect(f.card.getByText("Arden updated", { exact: true })).toBeVisible();
    await expect(f.card.locator(".u-photo")).toHaveAttribute("src", portrait + "?updated=1");
    expect(await f.forge.evaluate((node) => (node as any)._rosterRev)).toBe(revision + 1);
    await page.screenshot({ path: testInfo.outputPath(`unit-art-roster-${theme}.png`) });
  });
}
