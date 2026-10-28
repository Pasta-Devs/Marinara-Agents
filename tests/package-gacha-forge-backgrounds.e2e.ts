import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("MARINARA_ENGINE_ROOT required");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const nativeImport = new Function("url", "return import(url)");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJRkAAAAASUVORK5CYII=",
  "base64",
);
async function open(page: Page, info: TestInfo, theme: string) {
  const {
    createChatRuntime,
    chatRunId: runId,
    chatUnitId: unitId,
  } = await nativeImport(pathToFileURL(resolve(__dirname, "fixtures/gacha-forge-chat-runtime.mjs")).href);
  const runtime = await createChatRuntime({ port: 7896 + info.parallelIndex });
  // The shared chat fixture names its channel during bootstrap; artwork actions must add no model calls.
  runtime.calls.length = 0;
  runtime.persistence.transaction = async (work: any) => {
    const before = structuredClone([...runtime.docs]);
    try {
      return await work({ documents: runtime.persistence.documents });
    } catch (error) {
      runtime.docs.clear();
      for (const [k, v] of before) runtime.docs.set(k, v);
      throw error;
    }
  };
  const seed = (id: string, kind: string, data: any) =>
    runtime.docs.set(id, { id, kind, packageId: "gacha-forge", revision: 1, name: id, data });
  const run = runtime.docs.get("index").data.runs[0];
  run.hudStyle = "vanguard";
  run.hasStandardBanner = true;
  run.storyUnwritten = false;
  run.storyDeferred = false;
  run.audio = { muted: true, tts: false, generate: false };
  const session = runtime.session();
  session.progress = { 1: { normal: 1 } };
  const plan = {
    chapter: 1,
    title: "Background proof",
    nodes: [
      { type: "story", title: "The harbor", location: "Harbor" },
      { type: "story", title: "The garden", location: "Garden" },
    ],
  };
  seed(`${runId}:chapter:1`, "chapter-plan", plan);
  seed(`${runId}:locations`, "locations", {
    places: {
      harbor: { name: "Harbor", url: "/art/harbor.png" },
      garden: { name: "Garden", url: "/art/garden.png" },
      future: { name: "Unseen secret", url: "/art/future.png" },
    },
  });
  seed(`${runId}:beat:1:0`, "beat", {
    segments: [
      { text: "The harbor is familiar.", place: "Harbor" },
      { text: "The key image.", place: "Harbor" },
    ],
  });
  seed(`${runId}:beat:1:1`, "beat", {
    segments: [
      { text: "A garden we have not visited yet.", place: "Garden" },
      { text: "The garden gate.", place: "Garden" },
    ],
  });
  seed(`${runId}:cg:1:0`, "cg", { title: "Harbor key image", from: 1, to: 1, url: "/art/cg.png" });
  seed(`${runId}:banner:current`, "banner", { title: "Known banner", art: { "char-featured": "/art/banner.png" } });
  runtime.docs.get(unitId).data.bondBg = { url: "/art/bond.png" };
  const paths: string[] = [];
  const mobile = info.project.name.includes("mobile");
  await page.setViewportSize(mobile ? { width: 874, height: 402 } : { width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ version, theme, mobile }) => {
      localStorage.removeItem("marinara-active-chat-id");
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { theme, hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false },
          version: 65,
        }),
      );
      (window as any).__backgroundShares = [];
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => (window as any).__backgroundHidden === true,
      });
      if (mobile)
        Object.defineProperties(navigator, {
          userAgent: {
            configurable: true,
            value:
              "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
          },
          platform: { configurable: true, value: "iPhone" },
          maxTouchPoints: { configurable: true, value: 5 },
          canShare: { configurable: true, value: (data: ShareData) => data.files?.length === 1 },
          share: {
            configurable: true,
            value: (data: ShareData) => {
              (window as any).__backgroundShares.push({
                active: navigator.userActivation?.isActive,
                name: data.files?.[0]?.name,
                type: data.files?.[0]?.type,
              });
              return (window as any).__backgroundCancel
                ? Promise.reject(new DOMException("Cancelled", "AbortError"))
                : Promise.resolve();
            },
          },
        });
    },
    { version: appVersion, theme, mobile },
  );
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/art/*.png", (route) => route.fulfill({ body: png, contentType: "image/png" }));
  await page.route("**/api/gacha-forge/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/gacha-forge", "");
    paths.push(path);
    if (path === "/state")
      return route.fulfill({
        json: {
          runs: [run],
          activeRunId: runId,
          activeRun: run,
          guidesSeen: ["welcome", "home", "chapter", "beat", "combat"],
        },
      });
    if (["/home-options", "/home-decor", "/artwork/witness"].includes(path)) {
      const result = await runtime.post(path, route.request().postDataJSON());
      return route.fulfill({ status: result.status, json: result.body });
    }
    return route.fulfill({
      json:
        path === "/setup/draft"
          ? { ok: true, draft: null }
          : { ok: true, chapters: [], locations: [], memory: { phase: "ready", retryable: false } },
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect.poll(() => forge.evaluate((node) => (node as any)._boot)).toBe("ready");
  await forge.evaluate(
    (node, { plan }) => {
      const g = node as any;
      g._clearBeat();
      g._bannerReady = true;
      g._artReady = true;
      g._planEscaped = true;
      g._storyUnwritten = false;
      g._storyWriteAsked = false;
      g._hudView = "home";
      g._guide = "";
      g._plan = plan;
      g._planChapter = 1;
      g._renderKey = null;
      g._renderBrowser();
    },
    { plan },
  );
  return { runtime, forge, paths, runId, plan };
}
for (const theme of ["dark", "light"]) {
  test(`${theme}: all four background categories download without selecting; future scene art stays hidden`, async ({
    page,
  }, info) => {
    const f = await open(page, info, theme);
    try {
      await f.forge.locator('[data-pick="bg"]').click();
      const picker = f.forge.locator(".hm-pk.bg");
      await expect(picker).toBeVisible();
      const downloads: string[] = [];
      page.on("download", (item) => downloads.push(item.suggestedFilename()));
      for (const source of ["story", "cg", "banner", "bond"]) {
        await picker.locator(`[data-pk-src="${source}"]`).click();
        const save = picker.locator(".gf-background-download");
        await expect(save).toHaveCount(1);
        await expect(save).toBeEnabled();
        await expect.poll(async () => (await save.boundingBox())?.width).toBeGreaterThanOrEqual(44);
        await expect.poll(async () => (await save.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        if (info.project.name.includes("mobile")) {
          await save.tap();
          await expect
            .poll(() => page.evaluate(() => (window as any).__backgroundShares.length))
            .toBe(["story", "cg", "banner", "bond"].indexOf(source) + 1);
        } else {
          const downloaded = page.waitForEvent("download");
          await save.click();
          expect((await downloaded).suggestedFilename()).toMatch(/\.png$/);
        }
        await expect(picker).toBeVisible();
        expect(f.paths.filter((path) => path === "/home-decor")).toEqual([]);
      }
      if (info.project.name.includes("mobile")) {
        expect(
          await page.evaluate(() =>
            (window as any).__backgroundShares.every((item: any) => item.active && item.type === "image/png"),
          ),
        ).toBe(true);
        await page.evaluate(() => ((window as any).__backgroundCancel = true));
        await picker.locator(".gf-background-download").tap();
        await expect(picker.locator(".gf-background-download")).toBeEnabled();
        expect(downloads).toEqual([]);
        await expect(page.getByText("Could not download this image.", { exact: true })).toHaveCount(0);
      }
      await picker.locator('[data-pk-src="story"]').click();
      await expect(picker).not.toContainText("Garden");
      await expect(picker).not.toContainText("Unseen secret");
      await page.screenshot({ path: info.outputPath(`background-picker-${theme}.png`) });
      await picker
        .locator(".hm-pk-card[data-pk-take]")
        .filter({ has: page.locator("img") })
        .first()
        .click();
      await expect(picker).toHaveCount(0);
      expect(f.paths.filter((path) => path === "/home-decor")).toHaveLength(1);
      expect(f.runtime.calls).toEqual([]);
      expect(f.runtime.errors).toEqual([]);
    } finally {
      await f.runtime.close();
    }
  });
  test(`${theme}: viewing a loaded scene unlocks it once with a brief notice and preserves it on reopen`, async ({
    page,
  }, info) => {
    const f = await open(page, info, theme);
    try {
      await f.forge.evaluate(
        (node, { plan }) => {
          const g = node as any;
          (window as any).__backgroundHidden = true;
          g._hudView = "chapter";
          g._activeStoryNode = { ...plan.nodes[1], chapter: 1, storyIndex: 1, nodeIndex: 1, title: "The garden" };
          g._beat = [
            { text: "A garden we have not visited yet.", place: "Garden" },
            { text: "The garden gate.", place: "Garden" },
          ];
          g._beatPlaces = { Garden: "/art/garden.png" };
          g._beatCg = null;
          g._beatState = "ready";
          g._beatRequested = true;
          g._beatStartAt = 0;
          g._beatAt = 0;
          g._renderKey = null;
          g._renderBrowser();
        },
        { plan: f.plan },
      );
      await expect
        .poll(() => f.forge.evaluate((node) => typeof (node as any)._forgeBackgroundWitness?.retry))
        .toBe("function");
      expect(f.paths.filter((path) => path === "/artwork/witness")).toHaveLength(0);
      await page.evaluate(() => {
        (window as any).__backgroundHidden = false;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      const notice = f.forge.getByRole("status").filter({ hasText: "New background unlocked" });
      await expect(notice).toBeVisible();
      await expect(notice).toHaveCount(0, { timeout: 2500 });
      expect(f.paths.filter((path) => path === "/artwork/witness")).toHaveLength(1);
      await f.forge.evaluate((node) => {
        const g = node as any;
        g._clearBeat();
        g._hudView = "home";
        g._renderKey = null;
        g._renderBrowser();
      });
      await f.forge.locator('[data-pick="bg"]').click();
      const picker = f.forge.locator(".hm-pk.bg");
      await expect(picker).toContainText("Garden");
      await expect(picker).not.toContainText("Unseen secret");
      await f.forge.evaluate((node) => {
        const g = node as any;
        g._closePick();
        g._openPick("bg");
      });
      await expect(f.forge.locator(".hm-pk.bg")).toContainText("Garden");
      expect(f.runtime.calls).toEqual([]);
      expect(f.runtime.errors).toEqual([]);
    } finally {
      await f.runtime.close();
    }
  });
}
