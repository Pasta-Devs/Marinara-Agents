import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Slurp 0.3.11 browser proof: the story-first Stir with the player's own relationship on top, the
 * Desk switch, Pause all in Settings › Overview, "You two" in a thread's Details, and the Backstage
 * side menu on a short window. Screenshots at 390, 768 and 1440 px go to SLURP_SHOTS_DIR when set.
 */
const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("MARINARA_ENGINE_ROOT is required");
const APP_VERSION = (JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")) as { version: string })
  .version;
const SLURP_VERSION = (JSON.parse(readFileSync("packages/slurp2/manifest.json", "utf8")) as { version: string })
  .version;
const SHOTS = process.env.SLURP_SHOTS_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

function collectUnexpectedErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    if (/favicon|ResizeObserver|Failed to load resource/i.test(value)) return;
    errors.push(value);
  });
  return errors;
}

async function boot(page: Page, personaId: string, navigation: Record<string, unknown>) {
  await page.addInitScript(
    ({ appVersion, slurpVersion, personaId, navigation }) => {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      localStorage.setItem("slurp2:splash-seen-version", slurpVersion);
      localStorage.setItem("slurp2:stir-hint-seen", "1");
      // Once per tab: later steps set their own view and reload.
      if (!sessionStorage.getItem("slurp2:e2e-booted")) {
        localStorage.setItem(
          "marinara:slurp2:package-ui",
          JSON.stringify({ navigation, viewerPersonaId: personaId, onboardingState: "completed" }),
        );
        sessionStorage.setItem("slurp2:e2e-booted", "1");
      }
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
          version: 65,
        }),
      );
    },
    { appVersion: APP_VERSION, slurpVersion: SLURP_VERSION, personaId, navigation },
  );
}

async function openSlurp(page: Page) {
  const slurp = page.locator('[data-component="NoodleView"]');
  const tab = page.getByRole("tab", { name: "Open Slurp" });
  await expect(tab).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () => {
        if (await slurp.isVisible()) return true;
        if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
        return false;
      },
      { timeout: 30_000, intervals: [250, 500, 1_000] },
    )
    .toBe(true);
}

async function shoot(page: Page, name: string) {
  if (!SHOTS) return;
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, `${name}-${viewport.width}.png`), fullPage: false });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test("0.3.11: your relationship, story-first Stir, Pause all", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  test.skip(!testInfo.project.name.includes("desktop"), "One flow; it sets its own viewports.");
  const errors = collectUnexpectedErrors(page);
  const suffix = Date.now();

  // A persona with its own page (he), and a Creator (her).
  const persona = (await (
    await page.request.post("/api/characters/personas", { data: { name: `Sam ${suffix}` } })
  ).json()) as { id: string };
  await expect.poll(async () => (await page.request.get("/api/slurp2/settings")).ok(), { timeout: 30_000 }).toBe(true);
  const settings = (await (await page.request.get("/api/slurp2/settings")).json()) as {
    drama: { level: string; enabled: string[]; dials: Record<string, unknown> };
  };
  expect(
    (
      await page.request.patch("/api/slurp2/settings", {
        // A fresh install starts on Basic only; this flow needs Stir, its Desk mode and Storylines.
        data: {
          onboarding: "completed",
          extStir: true,
          extStorylines: true,
          extSupportDesk: true,
          drama: { ...settings.drama, enabled: ["rivals", "roommates"] },
        },
      })
    ).ok(),
  ).toBe(true);
  const page_ = async (entity: string, displayName: string, gender: string) => {
    const response = await page.request.post(`/api/slurp2/accounts/${entity}/noodler`, {
      data: {
        stageProfile: {
          displayName,
          handle: `${displayName.toLowerCase().replace(/[^a-z]/gu, "")}_${suffix}`,
          bio: "0.3.11 browser proof.",
          stagePersonality: "Romantic, playful, loves the gym.",
          disclosureMode: "open",
          gender,
          tags: ["fitness", "art", "cosplay"],
        },
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()) as { id: string };
  };
  const mine = await page_(persona.id, `Sam ${suffix}`, "male");
  const mari = await page_("__professor_mari__", `Mari ${suffix}`, "female");

  // She and the player become a couple through Stir, like any play.
  const played = await page.request.post("/api/slurp2/slurp/stir/play", {
    data: {
      steps: [{ action: "set-up-couple", input: { aId: mari.id, bId: mine.id } }],
      origin: "deck",
      personaId: persona.id,
    },
  });
  expect(played.ok(), await played.text()).toBe(true);
  const play = (await played.json()) as { results: { ok: boolean; error: string | null }[] };
  expect(play.results[0]?.ok, play.results[0]?.error ?? "").toBe(true);

  // Stir: Your relationship on top, Now showing, Start a story with the packs.
  await boot(page, persona.id, { mode: "creator", view: "stir" });
  await page.goto("/");
  await openSlurp(page);
  await expect(page.locator("[data-slp-stir-yours]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-slp-stir-now]")).toBeVisible();
  await expect(page.locator("[data-slp-stir-pack]").first()).toBeVisible();
  await shoot(page, "stir");
  await page.locator("[data-slp-stir-deck]").scrollIntoViewIfNeeded();
  await shoot(page, "stir-start-a-story");

  // A pack opens its play sheet with the lead pick.
  await page.locator('[data-slp-stir-pack="rivals"]').click();
  await expect(page.getByText("Who leads it (optional)")).toBeVisible();
  await shoot(page, "stir-start-drama-sheet");
  await page.keyboard.press("Escape");

  // Desk mode.
  await page.getByRole("radio", { name: "Desk" }).click();
  await shoot(page, "stir-desk");
  await page.getByRole("radio", { name: "Stir" }).click();

  // Details › You two in the thread with her.
  await page.evaluate(
    ({ creatorAccountId, personaId }) => {
      localStorage.setItem(
        "marinara:slurp2:package-ui",
        JSON.stringify({
          navigation: { mode: "creator", view: "messages", creatorAccountId },
          viewerPersonaId: personaId,
          onboardingState: "completed",
        }),
      );
    },
    { creatorAccountId: mari.id, personaId: persona.id },
  );
  await page.reload();
  await openSlurp(page);
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByText("Details", { exact: true }).last().click();
  await expect(page.locator("[data-slp-you-two]")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Together since/u)).toBeVisible();
  await shoot(page, "thread-you-two");

  // Settings › Overview › Pause all, and back.
  await page.evaluate(
    ({ personaId }) => {
      localStorage.setItem(
        "marinara:slurp2:package-ui",
        JSON.stringify({
          navigation: { mode: "creator-settings", section: "overview", target: "overview" },
          viewerPersonaId: personaId,
          onboardingState: "completed",
        }),
      );
    },
    { personaId: persona.id },
  );
  await page.reload();
  await openSlurp(page);
  await page.getByRole("button", { name: "Pause all" }).click();
  await expect(page.getByText("Slurp is paused")).toBeVisible();
  expect(((await (await page.request.get("/api/slurp2/settings")).json()) as { paused: boolean }).paused).toBe(true);
  await shoot(page, "overview-paused");
  await page.getByRole("button", { name: "Resume Slurp" }).click();
  await expect(page.getByRole("button", { name: "Pause all" })).toBeVisible();

  // The Backstage side menu scrolls on a short window and reaches its last section.
  await page.setViewportSize({ width: 1180, height: 520 });
  const menu = page.getByRole("navigation", { name: /settings sections/iu });
  await menu.getByRole("button").last().scrollIntoViewIfNeeded();
  await expect(menu.getByRole("button").last()).toBeInViewport();
  if (SHOTS) await page.screenshot({ path: join(SHOTS, "backstage-short-window.png") });

  expect(errors, errors.join("\n")).toEqual([]);
});
