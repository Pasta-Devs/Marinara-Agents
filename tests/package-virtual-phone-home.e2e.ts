// Virtual Phone on Home: pick a character, create their own phone without a chat, put it down,
// reload and reopen the same saved phone. No chat is created and no story phone appears.
// Run: node scripts/run-package-browser-tests.mjs virtual-phone tests/package-virtual-phone-home.e2e.ts
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("MARINARA_ENGINE_ROOT is required");
const APP_VERSION = (JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")) as { version: string })
  .version;
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];

type HomeCharacter = { id: string; name: string; phoneId: string | null };

async function chatCount(request: APIRequestContext) {
  const body = (await (await request.get("/api/chats")).json()) as unknown;
  return Array.isArray(body) ? body.length : ((body as { chats?: unknown[] }).chats?.length ?? 0);
}

async function homeEntry(request: APIRequestContext, characterId: string) {
  let entry: HomeCharacter | undefined;
  // The first request after start-up can arrive before the package routes are registered.
  await expect(async () => {
    const response = await request.get("/api/virtual-phone/home");
    expect(response.ok(), `${response.status()} ${await response.text()}`).toBe(true);
    entry = ((await response.json()) as { characters: HomeCharacter[] }).characters.find(
      ({ id }) => id === characterId,
    );
    expect(entry).toBeTruthy();
  }).toPass({ timeout: 30_000 });
  return entry!;
}

async function openPhonesTab(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: /character phones|Phones/ }).click();
  await expect(page.getByRole("heading", { name: "Phones" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  expect((await page.request.put("/api/app-settings/ui", { data: { value: "" } })).ok()).toBeTruthy();
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    if (localStorage.getItem("marinara-engine-ui")) return;
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
        version: 65,
      }),
    );
  }, APP_VERSION);
});

test("Home opens a character's own saved phone without a chat", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const failedPhoneRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/api/virtual-phone/")) {
      failedPhoneRequests.push(`${response.status()} ${response.url()}`);
    }
  });
  const name = `Phone Home ${Date.now()}`;
  const character = (await (
    await page.request.post("/api/characters", { data: { data: { name, first_mes: "" } } })
  ).json()) as {
    id: string;
  };
  try {
    const chatsBefore = await chatCount(page.request);
    expect((await homeEntry(page.request, character.id)).phoneId).toBeNull();

    await openPhonesTab(page);
    await page.getByRole("searchbox", { name: "Find a character" }).fill(name);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.screenshot({ path: testInfo.outputPath(`picker-${viewport.name}.png`) });
    }
    await page.getByRole("button", { name: `Create ${name}'s phone` }).click();
    const phone = page.getByRole("dialog");
    await expect(phone).toBeVisible();
    // A Home phone has no story, so the scene actions are not offered.
    await expect(phone.getByRole("button", { name: "Show phone in scene" })).toHaveCount(0);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.screenshot({ path: testInfo.outputPath(`phone-${viewport.name}.png`) });
    }
    await phone.getByRole("button", { name: "Unlock", exact: true }).click();
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.screenshot({ path: testInfo.outputPath(`apps-${viewport.name}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    for (const app of [
      { label: "Messages", id: "messages" },
      { label: "Contacts", id: "contacts" },
      { label: "Gallery", id: "gallery" },
      { label: "Phone", id: "calls" },
      { label: "Maps", id: "maps" },
      { label: "Find", id: "find" },
    ]) {
      await phone.getByRole("button", { name: `Open ${app.label}`, exact: true }).click();
      await expect(phone.locator(`[data-phone-app="${app.id}"]`)).toBeVisible();
      await phone.getByRole("button", { name: "Back", exact: true }).click();
    }
    await phone.getByRole("button", { name: "Open Notes", exact: true }).click();
    await phone.getByRole("button", { name: "New note", exact: true }).first().click();
    await phone.getByRole("textbox", { name: "Note title", exact: true }).fill("Saved Home note");
    const noteSaved = page.waitForResponse(
      (response) =>
        response.url().includes("/apps/notes/storage/notes") && response.request().method() === "PUT" && response.ok(),
    );
    await phone
      .getByRole("textbox", { name: "Note body", exact: true })
      .fill("This stays on this person's Home phone.");
    await noteSaved;
    await page.screenshot({ path: testInfo.outputPath("saved-note.png") });
    await phone.getByRole("button", { name: "Put down" }).click();
    await expect(phone).toBeHidden();
    await expect(page.getByRole("button", { name: `Open ${name}'s phone` })).toBeFocused();

    const saved = await homeEntry(page.request, character.id);
    expect(saved.phoneId).toBeTruthy();

    // Reload: the same saved phone comes back, and reopening does not make a second one.
    await openPhonesTab(page);
    await page.getByRole("searchbox", { name: "Find a character" }).fill(name);
    await page.getByRole("button", { name: `Open ${name}'s phone` }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await phone.getByRole("button", { name: "Unlock", exact: true }).click();
    await phone.getByRole("button", { name: "Open Notes", exact: true }).click();
    await expect(phone.getByText("Saved Home note", { exact: true })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Put down" }).click();
    expect((await homeEntry(page.request, character.id)).phoneId).toBe(saved.phoneId);

    const all = (await (await page.request.get("/api/virtual-phone/phones")).json()) as {
      phones: Array<{ ownerId: string; world?: string; chatScope: string[] }>;
    };
    const owned = all.phones.filter(({ ownerId }) => ownerId === character.id);
    expect(owned).toHaveLength(1);
    expect(owned[0]).toMatchObject({ world: "home", chatScope: [`home:${character.id}`] });
    expect(await chatCount(page.request)).toBe(chatsBefore);
    // A Home scope is never accepted where a chat is expected.
    expect(
      (
        await page.request.get(`/api/virtual-phone/chats/${encodeURIComponent(`home:${character.id}`)}/phones`)
      ).status(),
    ).toBe(400);
    expect(errors).toEqual([]);
    expect(failedPhoneRequests.filter((request) => !request.includes("/chats/home%3A"))).toEqual([]);
  } finally {
    await testInfo.attach("browser-errors", {
      body: JSON.stringify({ errors, consoleErrors, failedPhoneRequests }, null, 2),
      contentType: "application/json",
    });
    await page.request.delete(`/api/characters/${character.id}`, { timeout: 5_000 }).catch(() => undefined);
  }
});

test("Home phone picker shows loading, error with retry, and empty states", async ({ page }, testInfo) => {
  let mode: "slow-error" | "empty" | "live" = "slow-error";
  await page.route("**/api/virtual-phone/home", async (route) => {
    if (mode === "live") return route.continue();
    if (mode === "empty") return route.fulfill({ json: { characters: [] } });
    await new Promise((done) => setTimeout(done, 1_000));
    return route.fulfill({ status: 500, json: { error: "Test outage" } });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: /character phones|Phones/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Loading characters" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("loading.png") });
  await expect(page.getByRole("alert").filter({ hasText: "Test outage" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("error.png") });
  mode = "empty";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No characters yet")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("empty.png") });
});
