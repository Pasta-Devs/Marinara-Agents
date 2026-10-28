import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to the validated Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const nativeImport = new Function("url", "return import(url)");

async function openClassicGear(page: Page, testInfo: TestInfo) {
  const { createChapterRuntime, chapterRunId, chapterUnitId } = await nativeImport(
    pathToFileURL(resolve(__dirname, "fixtures/gacha-forge-chapter-runtime.mjs")).href,
  );
  const runtime = await createChapterRuntime();
  try {
    const run = runtime.docs.get("index").data.runs[0];
    run.combat = { mode: "classic", revision: 0 };
    run.audio = { tts: false, generate: false, muted: true };
    const signatureId = `${chapterRunId}:unit:signature-focus`;
    const unrelatedId = `${chapterRunId}:unit:unrelated-tome`;
    const genericId = `${chapterRunId}:unit:generic-blade`;
    const signatureName = "Lighthouse Focus";
    const skillName = "Lighthouse Refrain";
    const seed = (id: string, data: any) =>
      runtime.docs.set(id, {
        id,
        packageId: "gacha-forge",
        kind: "unit",
        revision: 1,
        name: data.name,
        data: { ...data, unitId: id },
      });
    seed(chapterUnitId, {
      kind: "character",
      name: "Arden",
      role: "Warrior",
      rarity: 5,
      affinity: "Fire",
      stats: { hp: 100, atk: 10, def: 10, spd: 10 },
      skill: { name: "Fixture strike", effect: "damage", power: 100 },
      passive: { name: "Fixture resolve", effect: "buff", power: 10 },
    });
    const weapon = {
      kind: "weapon",
      rarity: 5,
      stats: { atk: 10 },
      mainStat: { key: "atk", value: 100 },
      subStat: { key: "crit", value: 20 },
    };
    seed(signatureId, {
      ...weapon,
      name: signatureName,
      weaponType: "focus",
      dedicatedToId: chapterUnitId,
      dedicatedTo: "Arden",
      grantedSkill: { name: skillName, effect: "damage", power: 80, target: "enemy", trigger: "active" },
    });
    seed(unrelatedId, { ...weapon, name: "Unrelated Tome", weaponType: "tome" });
    seed(genericId, { ...weapon, name: "Training Blade", rarity: 4, weaponType: "blade" });
    for (const id of [chapterUnitId, signatureId, unrelatedId, genericId]) runtime.session().roster[id] = { level: 1 };
    const saved = () => ({
      ...run,
      name: "Classic signature proof",
      hudStyle: "vanguard",
      hasStandardBanner: true,
      storyUnwritten: false,
      storyDeferred: false,
      progress: runtime.session().progress,
    });
    const requests: Array<{ path: string; body: any; response: any }> = [];
    await page.setViewportSize(
      testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 },
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ({ version }) => {
        localStorage.removeItem("marinara-active-chat-id");
        localStorage.setItem("marinara:whats-new:seen-version", version);
        localStorage.setItem(
          "marinara-engine-ui",
          JSON.stringify({
            state: { theme: "dark", hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false },
            version: 65,
          }),
        );
      },
      { version: appVersion },
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
            guidesSeen: ["welcome", "home", "roster", "unit", "unit:stats", "unit:gear", "unit:skills"],
          },
        });
      if (path === "/setup/draft") return route.fulfill({ json: { ok: true, draft: null } });
      if (["/roster", "/unit", "/equip"].includes(path)) {
        const body = route.request().postDataJSON();
        const result = await runtime.post(path, body);
        requests.push({ path, body, response: result.body });
        return route.fulfill({ status: result.status, json: result.body });
      }
      return route.fulfill({
        json: { ok: true, chapters: [], locations: [], memory: { phase: "ready", retryable: false } },
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
      game._guide = "";
      game._hudView = "roster";
      game._rosterUnitId = null;
      game._rosterState = "idle";
      game._renderKey = null;
      game._renderBrowser();
    });
    await forge.locator(`[data-screen="roster"] [data-unit="${chapterUnitId}"]`).click();
    await forge.getByRole("tab", { name: "Gear", exact: true }).click();
    return {
      runtime,
      forge,
      requests,
      chapterRunId,
      chapterUnitId,
      signatureId,
      unrelatedId,
      signatureName,
      skillName,
    };
  } catch (error) {
    await runtime.close();
    throw error;
  }
}

test("Classic Gear offers and equips its owner's designated weapon despite a different type", async ({
  page,
}, testInfo) => {
  const f = await openClassicGear(page, testInfo);
  try {
    const gear = f.forge.locator('[data-screen="unit"] .gr-root');
    await expect(gear).toBeVisible();
    await f.forge.locator('[data-gear-change="weapon"]').click();
    const signature = f.forge.locator(`[data-gear-pick="${f.signatureId}"]`);
    await expect(signature).toBeVisible();
    await expect(f.forge.locator(`[data-gear-pick="${f.unrelatedId}"]`)).toHaveCount(0);
    await signature.click();
    await expect(f.forge.locator(".gx").getByText(f.signatureName, { exact: true })).toBeVisible();
    await f.forge.locator(`[data-gear-equip="${f.signatureId}"]`).click();
    await expect.poll(() => f.requests.filter((request) => request.path === "/equip").length).toBe(1);
    const equip = f.requests.find((request) => request.path === "/equip")!;
    expect(equip.body).toMatchObject({
      runId: f.chapterRunId,
      unitId: f.chapterUnitId,
      slot: "weapon",
      weaponId: f.signatureId,
      relicId: "",
    });
    expect(equip.response.ok, JSON.stringify(equip.response)).toBe(true);
    expect(f.runtime.session().roster[f.chapterUnitId].weapon).toBe(f.signatureId);
    await expect(gear.locator(".detail .d-head")).toContainText(f.signatureName);
    await expect(gear.locator(".gr-ab")).toContainText(f.skillName);
    await expect(gear.locator(".gr-tag")).toHaveText("Active");
    await page.screenshot({ path: testInfo.outputPath("classic-designated-weapon-equipped.png") });
    await f.forge.getByRole("tab", { name: "Skills", exact: true }).click();
    const granted = f.forge.locator('[data-skill-open="granted"]');
    await expect(granted).toContainText(f.skillName);
    await expect(granted).not.toHaveClass(/\boff\b/);
    expect(f.runtime.errors).toEqual([]);
    expect(f.runtime.calls).toEqual([], "equipping uses saved weapons without model generation");
  } finally {
    await f.runtime.close();
  }
});
