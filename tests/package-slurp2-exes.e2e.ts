import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("MARINARA_ENGINE_ROOT is required");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version as string;
const slurpVersion = JSON.parse(readFileSync("packages/slurp2/manifest.json", "utf8")).version as string;
const shots = process.env.SLURP_SHOTS_DIR;
if (shots) mkdirSync(shots, { recursive: true });

async function shoot(page: Page, name: string) {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (shots) await page.screenshot({ path: join(shots, `${name}-${viewport.width}.png`) });
  }
}

test("breakup memory choices and existing exes work in the installed package", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  test.skip(!testInfo.project.name.includes("desktop"), "One flow covers all three viewports.");
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !/favicon|Failed to load resource/u.test(message.text()))
      errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/api/slurp2/"))
      failedRequests.push(`${response.status()} ${response.url()}`);
  });
  const suffix = Date.now();
  const personaResponse = await page.request.post("/api/characters/personas", { data: { name: `Sam ${suffix}` } });
  expect(personaResponse.ok()).toBe(true);
  const persona = (await personaResponse.json()) as { id: string };
  await expect.poll(async () => (await page.request.get("/api/slurp2/settings")).ok(), { timeout: 30_000 }).toBe(true);
  const paused = await page.request.patch("/api/slurp2/settings", { data: { onboarding: "completed", paused: true } });
  expect(paused.ok()).toBe(true);
  const makePage = async (id: string, displayName: string, gender: string) => {
    const response = await page.request.post(`/api/slurp2/accounts/${id}/noodler`, {
      data: {
        stageProfile: {
          displayName,
          handle: `ex_${gender}_${suffix}`,
          bio: "Breakup memory proof.",
          stagePersonality: "Romantic and playful.",
          disclosureMode: "open",
          gender,
          tags: ["art", "music", "fitness"],
        },
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()) as { id: string };
  };
  const mine = await makePage(persona.id, `Sam ${suffix}`, "male");
  const mari = await makePage("__professor_mari__", `Mari With A Very Long Creator Name ${suffix}`, "female");
  const play = async (input: Record<string, unknown>, action = "steer-couple") => {
    const response = await page.request.post("/api/slurp2/slurp/stir/play", {
      data: { steps: [{ action, input }], origin: "deck", personaId: persona.id },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const result = (await response.json()) as {
      results: { ok: boolean; error: string | null }[];
      play: { id: string };
    };
    expect(result.results[0]?.ok, result.results[0]?.error ?? "").toBe(true);
    return result;
  };
  await play({ aId: mari.id, bId: mine.id }, "set-up-couple");
  const view = async () => {
    const response = await page.request.get(`/api/slurp2/slurp/stir?personaId=${persona.id}`);
    expect(response.ok()).toBe(true);
    return (await response.json()) as {
      couples: { id: string; stage: string; aftermath?: string }[];
      plays: { id: string }[];
      bonds: { id: string; kind: string; aId: string; bId: string }[];
    };
  };
  const initialCouple = (await view()).couples[0]!;
  const coupleId = initialCouple.id;
  if (initialCouple.stage === "sparks" || initialCouple.stage === "dating") await play({ coupleId, steer: "official" });
  await page.addInitScript(
    ({ appVersion, slurpVersion, personaId }) => {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      localStorage.setItem("slurp2:splash-seen-version", slurpVersion);
      localStorage.setItem("slurp2:stir-hint-seen", "1");
      localStorage.setItem(
        "marinara:slurp2:package-ui",
        JSON.stringify({
          navigation: { mode: "creator", view: "stir" },
          viewerPersonaId: personaId,
          onboardingState: "completed",
        }),
      );
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
          version: 65,
        }),
      );
    },
    { appVersion, slurpVersion, personaId: persona.id },
  );
  await page.goto("/");
  const tab = page.getByRole("tab", { name: "Open Slurp" });
  await expect(tab).toBeVisible({ timeout: 30_000 });
  await tab.click();
  const yours = page.locator("[data-slp-stir-yours]");
  await expect(yours).toBeVisible({ timeout: 30_000 });
  await yours.getByRole("button").first().click();
  await page.locator("[data-slp-you-two]").getByRole("button", { name: "Break up", exact: true }).click();
  const choices = page.locator("[data-slp-breakup-aftermath]");
  await expect(choices).toBeVisible();
  await expect(choices.locator('[data-slp-aftermath="keep"]')).toHaveAttribute("aria-checked", "true");
  await expect(choices.getByRole("radio")).toHaveCount(3);
  await expect(choices.locator('[data-slp-aftermath="keep"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(choices.locator('[data-slp-aftermath="moveOn"]')).toBeFocused();
  await expect(choices.locator('[data-slp-aftermath="moveOn"]')).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const breakUp = page.locator("[data-slp-you-two]").getByRole("button", { name: "Break up", exact: true });
  await expect(breakUp).toBeFocused();
  await breakUp.click();
  await expect(choices.locator('[data-slp-aftermath="keep"]')).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("End");
  await expect(choices.locator('[data-slp-aftermath="forget"]')).toBeFocused();
  await page.keyboard.press("Home");
  await expect(choices.locator('[data-slp-aftermath="keep"]')).toHaveAttribute("aria-checked", "true");
  await shoot(page, "breakup-choices");
  await choices.locator('[data-slp-aftermath="moveOn"]').click();
  await page
    .getByRole("dialog")
    .filter({ has: choices })
    .getByRole("button", { name: "Break up", exact: true })
    .click();
  await expect(choices).toBeHidden();
  await expect
    .poll(async () => (await view()).couples.find((couple) => couple.id === coupleId)?.aftermath)
    .toBe("moveOn");
  await expect(page.locator("[data-slp-you-two]").getByText("Moved on", { exact: true })).toBeVisible();
  await shoot(page, "moved-on");
  // With the world clock paused, Forget must end an existing ex bond in the same Apply.
  await play({ aId: mari.id, bId: mine.id, kind: "ex", level: 1 }, "set-bond");
  const exBondId = (await view()).bonds.find((bond) => bond.kind === "ex")!.id;
  // An existing ex remains selectable in Stir, including after a page reload.
  await page.reload();
  await tab.click();
  await page.getByRole("button", { name: /^Nudge a couple A date/u }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio", { name: /Split up · Moved on/u })).toBeVisible();
  await dialog.getByRole("radio", { name: /Sam.*Mari|Mari.*Sam/u }).click();
  await dialog.getByRole("radio", { name: "Forget the relationship", exact: true }).click();
  await shoot(page, "forget-existing-ex");
  await dialog.getByRole("button", { name: "See what happens", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Do it", exact: true })).toBeEnabled();
  await shoot(page, "forget-preview");
  await dialog.getByRole("button", { name: "Do it", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(async () => (await view()).couples.find((couple) => couple.id === coupleId)?.aftermath)
    .toBe("forget");
  expect((await view()).bonds.some((bond) => bond.id === exBondId)).toBe(false);
  // Undo restores the prior outcome, rather than reviving the relationship or leaving it forgotten.
  const latest = (await view()).plays[0]!;
  const undone = await page.request.post(`/api/slurp2/slurp/stir/plays/${latest.id}/undo`, {
    data: { personaId: persona.id },
  });
  expect(undone.ok(), await undone.text()).toBe(true);
  expect((await view()).couples.find((couple) => couple.id === coupleId)?.aftermath).toBe("moveOn");
  expect((await view()).bonds.some((bond) => bond.id === exBondId)).toBe(true);
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
